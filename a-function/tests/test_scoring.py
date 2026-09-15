import unittest
from datetime import datetime, timedelta

import scoring


class CreatorRelevanceTests(unittest.TestCase):
    def test_matches_and_sums_weights(self):
        result = scoring.score_creator_relevance("Forex trading")
        self.assertEqual(result["score"], 35)  # forex 20 + trading 15

    def test_caps_at_100(self):
        text = "introducing broker forex affiliate cfd trading broker partnership"
        self.assertEqual(scoring.score_creator_relevance(text)["score"], 100)

    def test_no_match(self):
        result = scoring.score_creator_relevance("just a gardener")
        self.assertEqual(result["score"], 0)

    def test_none_text_is_safe(self):
        self.assertEqual(scoring.score_creator_relevance(None)["score"], 0)


class BrandSafetyTests(unittest.TestCase):
    def test_clean_text_is_100(self):
        self.assertEqual(scoring.score_brand_safety("forex educator")["score"], 100)

    def test_each_flag_costs_35(self):
        self.assertEqual(scoring.score_brand_safety("guaranteed profit here")["score"], 65)

    def test_floors_at_0(self):
        text = "guaranteed profit risk free double your money get rich quick"
        self.assertEqual(scoring.score_brand_safety(text)["score"], 0)


class AudienceQualityTests(unittest.TestCase):
    def test_ratio_scaled(self):
        result = scoring.score_audience_quality(1000, {"connectionsCount": 500})
        self.assertEqual(result["score"], 40)  # ratio 2.0 * 20

    def test_missing_data_returns_none(self):
        self.assertIsNone(scoring.score_audience_quality(1000, {})["score"])
        self.assertIsNone(scoring.score_audience_quality(None, {"connectionsCount": 5})["score"])


class FollowerGrowthTests(unittest.TestCase):
    def test_percentage_change(self):
        base = datetime(2026, 1, 1)
        history = [
            {"follower_count": 100, "captured_at": base},
            {"follower_count": 150, "captured_at": base + timedelta(days=10)},
        ]
        self.assertEqual(scoring.score_follower_growth(history)["value"], 50.0)

    def test_needs_two_snapshots(self):
        self.assertIsNone(scoring.score_follower_growth([{"follower_count": 1, "captured_at": datetime.now()}])["value"])

    def test_zero_start_returns_none(self):
        base = datetime(2026, 1, 1)
        history = [
            {"follower_count": 0, "captured_at": base},
            {"follower_count": 100, "captured_at": base + timedelta(days=5)},
        ]
        self.assertIsNone(scoring.score_follower_growth(history)["value"])


class EngagementRateTests(unittest.TestCase):
    def test_computes_er_and_score(self):
        posts = [{"likes": 10, "comments": 5, "shares": 5}]
        result = scoring.score_engagement_rate(posts, 1000)
        self.assertEqual(result["value"], 2.0)  # 20/1000*100
        self.assertEqual(result["score"], 10)   # 2.0 * 5

    def test_no_posts(self):
        self.assertIsNone(scoring.score_engagement_rate([], 1000)["value"])

    def test_no_follower_count(self):
        self.assertIsNone(scoring.score_engagement_rate([{"likes": 1, "comments": 0, "shares": 0}], None)["value"])


class PostPriceTests(unittest.TestCase):
    def test_base_rule(self):
        self.assertEqual(scoring.score_estimated_post_price(10000, None)["value_usd"], 100.0)

    def test_adjusted_by_engagement(self):
        # 10000/1000*10 = 100, *(1 + 5/10) = 150
        self.assertEqual(scoring.score_estimated_post_price(10000, 5.0)["value_usd"], 150.0)

    def test_no_followers(self):
        self.assertIsNone(scoring.score_estimated_post_price(None, None)["value_usd"])


class ScoreEntityTests(unittest.TestCase):
    def test_composite_renormalizes_over_available_signals(self):
        entity = {"display_name": "Forex IB", "bio_text": "introducing broker", "follower_count": 10000}
        result = scoring.score_entity(entity, raw={})
        # only creator_relevance + brand_safety computable (no connections/history/posts)
        self.assertIsNotNone(result["composite_score"])
        self.assertEqual(result["data_completeness"], round(2 / 7, 2))
        self.assertEqual(result["brand_safety"], 100)
        self.assertGreater(result["creator_relevance"], 0)

    def test_all_none_gives_none_composite(self):
        entity = {"display_name": "gardener", "follower_count": None}
        result = scoring.score_entity(entity, raw={})
        # brand_safety + relevance always computable from text, so composite still set;
        # completeness stays low. Guard the not-computable signals stay None.
        self.assertIsNone(result["audience_demographics"])
        self.assertIsNone(result["fake_audience_signal"])

    def test_notes_present_for_every_signal(self):
        result = scoring.score_entity({"display_name": "x", "follower_count": 5}, raw={})
        for key in ("creator_relevance", "brand_safety", "audience_quality",
                    "estimated_post_price", "follower_growth", "engagement_rate"):
            self.assertIn(key, result["notes"])


if __name__ == "__main__":
    unittest.main()
