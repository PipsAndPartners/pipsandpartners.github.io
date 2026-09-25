import tempfile
import unittest
from pathlib import Path

from openpyxl import Workbook

from outreach.sheet_sync import _norm_email, _norm_phone, _read_rows, sync_sheet

URL = "https://www.youtube.com/channel/UCnH3mGTw4w7rjOYIfGAVV7Q"
UNMATCHED_URL = "https://example.com/profile/nobody"


def _xlsx(path: Path, header: list, rows: list[list]) -> Path:
    wb = Workbook()
    ws = wb.active
    ws.append(header)
    for r in rows:
        ws.append(r)
    wb.save(path)
    return path


class NormEmailTests(unittest.TestCase):
    def test_valid_lowercased_and_mailto_stripped(self):
        self.assertEqual(_norm_email("Mailto:A@X.com"), "a@x.com")

    def test_garbage_rejected(self):
        self.assertIsNone(_norm_email("chưa có"))
        self.assertIsNone(_norm_email(None))


class NormPhoneTests(unittest.TestCase):
    def test_restores_leading_zero_lost_to_excel_number_format(self):
        self.assertEqual(_norm_phone(912345678), "0912345678")
        self.assertEqual(_norm_phone(912345678.0), "0912345678")

    def test_keeps_plus_prefixed_e164(self):
        self.assertEqual(_norm_phone("+84 912 345 678"), "+84912345678")

    def test_strips_separators_from_string_cell(self):
        self.assertEqual(_norm_phone("0912-345-678"), "0912345678")

    def test_blank_is_none(self):
        self.assertIsNone(_norm_phone(""))
        self.assertIsNone(_norm_phone(None))


class ReadRowsTests(unittest.TestCase):
    def test_reads_known_columns_and_skips_rows_without_source_url(self):
        with tempfile.TemporaryDirectory() as d:
            path = _xlsx(Path(d) / "s.xlsx",
                         ["email", "phone", "zalo", "source_url"],
                         [["a@x.com", "0912345678", "0912345678", URL],
                          ["b@x.com", None, None, None]])
            rows = _read_rows(path)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0], {"email": "a@x.com", "phone": "0912345678",
                                    "zalo": "0912345678", "source_url": URL})

    def test_recognizes_mail_and_link_aliases(self):
        with tempfile.TemporaryDirectory() as d:
            path = _xlsx(Path(d) / "s.xlsx", ["mail", "link"], [["a@x.com", URL]])
            rows = _read_rows(path)
        self.assertEqual(rows, [{"email": "a@x.com", "source_url": URL}])


class FakeCursor:
    def __init__(self, fetchall_queue, fetchone_queue):
        self.fetchall_queue = list(fetchall_queue)
        self.fetchone_queue = list(fetchone_queue)
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchall(self):
        return self.fetchall_queue.pop(0)

    def fetchone(self):
        return self.fetchone_queue.pop(0)


class FakeConn:
    def __init__(self, fetchall_queue, fetchone_queue):
        self.cur = FakeCursor(fetchall_queue, fetchone_queue)
        self.committed = False
        self.rolled_back = False

    def cursor(self):
        return self.cur

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


class SyncSheetTests(unittest.TestCase):
    def _sheet(self, d, header, rows):
        return _xlsx(Path(d) / "s.xlsx", header, rows)

    def test_fills_empty_fields_and_merges_into_contacts(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._sheet(d, ["email", "phone", "zalo", "source_url"],
                               [["a@x.com", "912345678", "0912345678", URL]])
            # find_entities: exact source_url match hits entity 1;
            # then the current-row select returns all-empty contact fields.
            conn = FakeConn(fetchall_queue=[[(1,)]], fetchone_queue=[(None, None, None, None)])
            report = sync_sheet(conn, path)

        self.assertEqual({(k, ) for _, k, *_ in report.filled}, {("email",), ("phone",), ("zalo",)})
        self.assertEqual(report.conflicts, [])
        self.assertTrue(conn.committed)
        update_sql, params = conn.cur.executed[-1]
        self.assertIn("update entities", update_sql)
        self.assertEqual(params[:3], ("a@x.com", "0912345678", None))  # phone gets its 0 back

    def test_phone_formatting_difference_is_not_a_conflict(self):
        # phone_norm keeps whatever separators the scraper found in the bio text --
        # a sheet value that's the same number with different punctuation must not
        # be reported as a conflict (real-world DB data is full of these).
        with tempfile.TemporaryDirectory() as d:
            path = self._sheet(d, ["phone", "source_url"], [["0203655678", URL]])
            conn = FakeConn(fetchall_queue=[[(1,)]],
                            fetchone_queue=[(None, "0203.655.678", None, None)])
            report = sync_sheet(conn, path)

        self.assertEqual(report.filled, [])
        self.assertEqual(report.conflicts, [])
        self.assertFalse(any("update entities" in sql for sql, _ in conn.cur.executed))

    def test_existing_value_kept_and_conflict_reported_without_overwrite(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._sheet(d, ["email", "source_url"], [["new@x.com", URL]])
            conn = FakeConn(fetchall_queue=[[(1,)]],
                            fetchone_queue=[("old@x.com", None, None, None)])
            report = sync_sheet(conn, path)

        self.assertEqual(report.conflicts, [(URL, "email", "old@x.com", "new@x.com")])
        self.assertEqual(report.filled, [])
        # nothing changed -> only the two selects/lookups ran, no UPDATE
        self.assertFalse(any("update entities" in sql for sql, _ in conn.cur.executed))

    def test_overwrite_replaces_existing_value(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._sheet(d, ["email", "source_url"], [["new@x.com", URL]])
            conn = FakeConn(fetchall_queue=[[(1,)]],
                            fetchone_queue=[("old@x.com", None, None, None)])
            report = sync_sheet(conn, path, overwrite=True)

        self.assertEqual(report.overwritten, [(URL, "email", "old@x.com", "new@x.com")])
        update_sql, params = conn.cur.executed[-1]
        self.assertEqual(params[0], "new@x.com")

    def test_contacts_jsonb_merge_preserves_untouched_keys(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._sheet(d, ["zalo", "source_url"], [["0912345678", URL]])
            conn = FakeConn(fetchall_queue=[[(1,)]],
                            fetchone_queue=[(None, None, None, {"facebook": "fb.com/x"})])
            sync_sheet(conn, path)

        _, params = conn.cur.executed[-1]
        self.assertEqual(params[3].obj, {"facebook": "fb.com/x", "zalo": "0912345678"})

    def test_dry_run_reports_but_never_writes(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._sheet(d, ["email", "source_url"], [["a@x.com", URL]])
            conn = FakeConn(fetchall_queue=[[(1,)]], fetchone_queue=[(None, None, None, None)])
            report = sync_sheet(conn, path, dry_run=True)

        self.assertEqual(len(report.filled), 1)
        self.assertFalse(any("update entities" in sql for sql, _ in conn.cur.executed))
        self.assertTrue(conn.rolled_back)
        self.assertFalse(conn.committed)

    def test_unmatched_row_reported(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._sheet(d, ["email", "source_url"], [["a@x.com", UNMATCHED_URL]])
            conn = FakeConn(fetchall_queue=[[]], fetchone_queue=[])
            report = sync_sheet(conn, path)

        self.assertEqual(report.unmatched, [UNMATCHED_URL])

    def test_invalid_email_reported_and_not_applied(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._sheet(d, ["email", "source_url"], [["chưa có", URL]])
            conn = FakeConn(fetchall_queue=[[(1,)]], fetchone_queue=[(None, None, None, None)])
            report = sync_sheet(conn, path)

        self.assertEqual(report.invalid, [(URL, "chưa có")])
        self.assertFalse(any("update entities" in sql for sql, _ in conn.cur.executed))


if __name__ == "__main__":
    unittest.main()
