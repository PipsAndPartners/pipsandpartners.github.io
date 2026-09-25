import unittest
from types import SimpleNamespace

from discovery import serp


class BuildQueriesTests(unittest.TestCase):
    def test_defaults_when_no_keywords(self):
        self.assertEqual(serp.build_queries(), serp.DEFAULT_QUERIES)

    def test_uses_given_keywords(self):
        self.assertEqual(serp.build_queries(["ib forex"]), ["ib forex"])

    def test_crosses_regions(self):
        got = serp.build_queries(["ib"], ["Vietnam", "Australia"])
        self.assertEqual(got, ["ib Vietnam", "ib Australia"])


class DomainOfTests(unittest.TestCase):
    def test_strips_www(self):
        self.assertEqual(serp.domain_of("https://www.Example.com/path?q=1"), "example.com")

    def test_no_scheme_returns_none(self):
        self.assertIsNone(serp.domain_of("not a url"))


class ParseItemsTests(unittest.TestCase):
    def test_flattens_organic_results_and_extracts_domain(self):
        items = [{
            "searchQuery": {"term": "forex ib"},
            "organicResults": [
                {"url": "https://www.fxpartners.com/", "title": "FX Partners", "description": "IB program"},
                {"link": "https://ib.example.vn/join", "title": "Join IB"},
            ],
        }]
        rows = serp.parse_items(items)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["query"], "forex ib")
        self.assertEqual(rows[0]["domain"], "fxpartners.com")
        self.assertEqual(rows[1]["url"], "https://ib.example.vn/join")
        self.assertEqual(rows[1]["domain"], "ib.example.vn")

    def test_skips_rows_without_url(self):
        rows = serp.parse_items([{"organicResults": [{"title": "no link"}]}])
        self.assertEqual(rows, [])


class FakeCursor:
    def __init__(self):
        self.rows = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params):
        self.rows.append(params)


class FakeConn:
    def __init__(self):
        self.cursor_obj = FakeCursor()
        self.committed = False

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.committed = True


class FakeDataset:
    def __init__(self, items):
        self._items = items

    def iterate_items(self):
        return iter(self._items)


class FakeActor:
    def __init__(self, items):
        self._items = items
        self.run_input = None

    def call(self, run_input):
        self.run_input = run_input
        # apify-client 3.x returns a Run model (attribute access), not a dict
        return SimpleNamespace(id="run123", default_dataset_id="ds1")


class FakeClient:
    def __init__(self, items):
        self.actor_obj = FakeActor(items)
        self._items = items

    def actor(self, actor_id):
        assert actor_id == serp.ACTOR_ID
        return self.actor_obj

    def dataset(self, dataset_id):
        return FakeDataset(self._items)


class DiscoverAndLoadTests(unittest.TestCase):
    def test_discover_sends_newline_queries_and_returns_rows(self):
        client = FakeClient([{
            "searchQuery": {"term": "forex ib"},
            "organicResults": [{"url": "https://fx.example/", "title": "FX"}],
        }])
        result = serp.discover(["a", "b"], client=client)
        self.assertEqual(client.actor_obj.run_input["queries"], "a\nb")
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["run_id"], "run123")

    def test_load_serp_writes_one_row_per_result(self):
        conn = FakeConn()
        rows = [
            {"query": "q1", "url": "https://a.com", "raw": {"url": "https://a.com"}},
            {"query": "q1", "url": "https://b.com", "raw": {"url": "https://b.com"}},
        ]
        loaded = serp.load_serp(conn, rows, run_id="run123")
        self.assertEqual(loaded, 2)
        self.assertTrue(conn.committed)
        self.assertEqual(conn.cursor_obj.rows[0][0], "q1")       # query
        self.assertEqual(conn.cursor_obj.rows[0][2], "https://a.com")  # source_url
        self.assertEqual(conn.cursor_obj.rows[0][3], "run123")   # run_id


if __name__ == "__main__":
    unittest.main()
