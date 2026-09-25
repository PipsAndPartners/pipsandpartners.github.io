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


class QueryWatermarkTests(unittest.TestCase):
    def test_rule(self):
        from datetime import timedelta

        from discovery.common.watermark import query_is_fresh

        days = lambda n: timedelta(days=n)
        self.assertTrue(query_is_fresh(days(2), 50, 10))     # ran this week
        self.assertFalse(query_is_fresh(days(7), 50, 10))    # weekly refresh re-runs a productive query
        self.assertTrue(query_is_fresh(days(7), 50, 0))      # saturated: nothing new last time
        self.assertFalse(query_is_fresh(days(29), 50, 0))    # ...until the saturation window ends
        self.assertFalse(query_is_fresh(days(7), 0, 0))      # returned nothing at all -> not "saturated"

    def test_attribute_ids_per_query_or_run_level(self):
        from discovery.common.watermark import attribute_ids
        from platforms import douyin, tiktok

        tt = [{"searchQuery": "a", "authorMeta": {"id": "1", "name": "x"}},
              {"searchQuery": "b", "authorMeta": {"id": "2", "name": "y"}},
              {"error": "NOT_FOUND", "input": "a"}]
        self.assertEqual(attribute_ids(tiktok, ["a", "b"], tt), {"a": {"1"}, "b": {"2"}})
        dy = [{"authorMeta": {"secUid": "s1"}}, {"authorMeta": {"secUid": "s2"}}]  # no query echoed
        self.assertEqual(attribute_ids(douyin, ["k1", "k2"], dy), {"k1": {"s1", "s2"}, "k2": {"s1", "s2"}})

    def test_run_queries_and_with_queries(self):
        from discovery.common.watermark import run_queries, with_queries

        self.assertEqual(run_queries("linkedin", {"searchQuery": "ib"}), ["ib"])
        self.assertEqual(run_queries("instagram", {"usernames": ["a"]}), [])  # lookups aren't searches
        self.assertEqual(with_queries("tiktok", {"searchQueries": ["a", "b"], "x": 1}, ["b"]),
                         {"searchQueries": ["b"], "x": 1})
