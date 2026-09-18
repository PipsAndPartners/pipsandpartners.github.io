import unittest

from discovery import gate


class PassesFilterTests(unittest.TestCase):
    def test_relevant_and_enough_followers_passes(self):
        entity = {"display_name": "Forex IB", "bio_text": "introducing broker", "follower_count": 5000}
        self.assertTrue(gate.passes_filter(entity))

    def test_irrelevant_bio_filtered_out(self):
        entity = {"display_name": "Garden tips", "bio_text": "just a gardener", "follower_count": 100000}
        self.assertFalse(gate.passes_filter(entity))

    def test_relevant_but_too_few_followers_filtered_out(self):
        entity = {"display_name": "Forex trading", "follower_count": 50}
        self.assertFalse(gate.passes_filter(entity))

    def test_missing_follower_count_does_not_fail_follower_check(self):
        # Cheap discovery may not have a follower count yet -- relevance alone decides.
        entity = {"display_name": "Forex trading", "follower_count": None}
        self.assertTrue(gate.passes_filter(entity))

    def test_max_followers_cap(self):
        entity = {"display_name": "Forex trading", "follower_count": 5_000_000}
        self.assertTrue(gate.passes_filter(entity, max_followers=None))
        self.assertFalse(gate.passes_filter(entity, max_followers=1_000_000))

    def test_relevance_threshold_is_configurable(self):
        entity = {"bio_text": "investment", "follower_count": None}  # relevance 8
        self.assertFalse(gate.passes_filter(entity))  # default min 20
        self.assertTrue(gate.passes_filter(entity, min_relevance=5))

    def test_gold_creator_in_window_passes(self):
        # Douyin gold channel: a gold analyst inside the 500-5k band clears the gate.
        entity = {"display_name": "现货黄金分析", "bio_text": "每日金价走势", "follower_count": 2000}
        self.assertTrue(gate.passes_filter(entity, min_followers=500, max_followers=5000))

    def test_gold_creator_above_window_filtered_out(self):
        entity = {"display_name": "现货黄金分析", "follower_count": 50000}
        self.assertFalse(gate.passes_filter(entity, min_followers=500, max_followers=5000))


class _FakeCursor:
    def __init__(self, count):
        self._count = count

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=()):
        self._sql = sql

    def fetchone(self):
        return (self._count,)


class _FakeConn:
    def __init__(self, discovered_count):
        self._count = discovered_count

    def cursor(self):
        return _FakeCursor(self._count)


class RequireGateTests(unittest.TestCase):
    def test_raises_when_ungated_rows_exist(self):
        with self.assertRaises(RuntimeError):
            gate.require_gate(_FakeConn(3))

    def test_passes_when_nothing_ungated(self):
        gate.require_gate(_FakeConn(0))  # no raise

    def test_mark_enriched_noop_on_empty(self):
        self.assertEqual(gate.mark_enriched(_FakeConn(0), []), 0)


class MemberEnrichGateTests(unittest.TestCase):
    """The cheap gate must sit before member_enrich's paid Instagram scrape."""

    def _groups(self):
        return [
            {
                "members": [
                    # forex bio -> keep its instagram
                    {"display_name": "IB guy", "about": "introducing broker, forex signals",
                     "username": "tg_ib", "instagram_usernames": ["ib_ig"]},
                    # irrelevant bio -> drop its instagram (no paid enrichment)
                    {"display_name": "Gardener", "about": "just growing tomatoes",
                     "username": "tg_garden", "instagram_usernames": ["garden_ig"]},
                    # no instagram harvested -> ignored entirely
                    {"display_name": "Lurker", "about": "forex trading", "username": "tg_lurk",
                     "instagram_usernames": []},
                ]
            }
        ]

    def test_only_relevant_members_reach_enrichment(self):
        from discovery.member_enrich import _gate_candidates

        kept, all_usernames = _gate_candidates(self._groups(), min_relevance=20)
        self.assertEqual(kept, ["ib_ig"])
        self.assertEqual(all_usernames, ["garden_ig", "ib_ig"])

    def test_shared_username_kept_if_any_source_relevant(self):
        from discovery.member_enrich import _gate_candidates

        groups = [
            {
                "members": [
                    {"about": "gardening", "instagram_usernames": ["shared_ig"]},
                    {"about": "forex introducing broker", "instagram_usernames": ["shared_ig"]},
                ]
            }
        ]
        kept, _ = _gate_candidates(groups, min_relevance=20)
        self.assertEqual(kept, ["shared_ig"])


if __name__ == "__main__":
    unittest.main()
