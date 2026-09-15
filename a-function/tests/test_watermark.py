import unittest

from discovery.common.watermark import NEW, REFRESHED, SKIPPED, claim_entity, summarize


class FakeCursor:
    def __init__(self, fetch_queue):
        self._fetch = list(fetch_queue)
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchone(self):
        return self._fetch.pop(0)


class FakeConn:
    def __init__(self, fetch_queue):
        self.cursor_obj = FakeCursor(fetch_queue)
        self.committed = False

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.committed = True


def _claim(conn):
    return claim_entity(conn, platform="telegram", platform_id="123", entity={})


class ClaimEntityTests(unittest.TestCase):
    def test_skips_when_watermark_fresh(self):
        conn = FakeConn([(7,)])  # SELECT finds a fresh row
        entity_id, outcome = _claim(conn)
        self.assertEqual((entity_id, outcome), (7, SKIPPED))
        self.assertEqual(len(conn.cursor_obj.executed), 1)  # never runs the upsert
        self.assertFalse(conn.committed)

    def test_new_when_inserted(self):
        conn = FakeConn([None, (10, True)])  # SELECT miss, upsert inserts
        entity_id, outcome = _claim(conn)
        self.assertEqual((entity_id, outcome), (10, NEW))
        self.assertTrue(conn.committed)

    def test_refreshed_when_updated(self):
        conn = FakeConn([None, (11, False)])  # SELECT miss, upsert updates a stale row
        _, outcome = _claim(conn)
        self.assertEqual(outcome, REFRESHED)


class SummarizeTests(unittest.TestCase):
    def test_counts_each_outcome(self):
        result = summarize([NEW, NEW, SKIPPED, REFRESHED, SKIPPED, SKIPPED])
        self.assertEqual(result, {NEW: 2, REFRESHED: 1, SKIPPED: 3})

    def test_empty_run(self):
        self.assertEqual(summarize([]), {NEW: 0, REFRESHED: 0, SKIPPED: 0})


if __name__ == "__main__":
    unittest.main()
