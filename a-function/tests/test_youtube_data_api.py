import os
import unittest
from unittest.mock import patch

from discovery.youtube_data_api import discover, filter_overseas_vietnamese, rank_channels
from platforms.youtube import to_entity


class YouTubeDataApiTests(unittest.TestCase):
    def test_discover_uses_search_and_channel_quota(self):
        responses = [
            {"items": [{"id": {"channelId": "UC1"}, "snippet": {"title": "FX"}}]},
            {
                "items": [
                    {
                        "id": "UC1",
                        "snippet": {"title": "FX", "description": "Forex"},
                        "statistics": {"subscriberCount": "42"},
                    }
                ]
            },
        ]
        with patch.dict(os.environ, {"YOUTUBE_API_KEY": "test-key"}), patch(
            "discovery.youtube_data_api.request", side_effect=responses
        ) as request:
            result = discover(["forex"], max_results=10)
        self.assertEqual(result["quota_units"], 101)
        self.assertEqual(result["items"][0]["id"], "UC1")
        self.assertEqual(request.call_count, 2)

    def test_skip_ids_drops_fresh_channels(self):
        responses = [
            {"items": [{"id": {"channelId": "UC1"}, "snippet": {"title": "A"}},
                       {"id": {"channelId": "UC2"}, "snippet": {"title": "B"}}]},
            {"items": [{"id": "UC2", "snippet": {"title": "B"}, "statistics": {"subscriberCount": "5"}}]},
        ]
        with patch.dict(os.environ, {"YOUTUBE_API_KEY": "k"}), patch(
            "discovery.youtube_data_api.request", side_effect=responses
        ):
            result = discover(["forex"], max_results=10, skip_ids={"UC1"})
        self.assertEqual(result["skipped_fresh"], 1)
        ids = {item.get("id") for item in result["items"]}
        self.assertEqual(ids, {"UC2"})  # fresh UC1 dropped before channels.list

    def test_region_and_language_bias_are_passed(self):
        responses = [{"items": []}]
        with patch.dict(os.environ, {"YOUTUBE_API_KEY": "k"}), patch(
            "discovery.youtube_data_api.request", side_effect=responses
        ) as request:
            discover(["xtb"], max_results=5, region_code="VN", relevance_language="vi")
        params = request.call_args.args[1]
        self.assertEqual(params["regionCode"], "VN")
        self.assertEqual(params["relevanceLanguage"], "vi")

    def test_no_bias_by_default(self):
        with patch.dict(os.environ, {"YOUTUBE_API_KEY": "k"}), patch(
            "discovery.youtube_data_api.request", side_effect=[{"items": []}]
        ) as request:
            discover(["xtb"], max_results=5)
        params = request.call_args.args[1]
        self.assertNotIn("regionCode", params)
        self.assertNotIn("relevanceLanguage", params)

    def test_maps_channel_to_entity(self):
        entity = to_entity(
            {
                "id": "UC1",
                "snippet": {"title": "FX", "description": "Forex"},
                "statistics": {"subscriberCount": "42"},
            }
        )
        self.assertEqual(entity["platform_id"], "UC1")
        self.assertEqual(entity["follower_count"], 42)
        self.assertEqual(entity["source_url"], "https://www.youtube.com/channel/UC1")

    def test_filters_public_overseas_vietnamese_finance_signal(self):
        items = [{"snippet": {"title": "Vietnamese Forex Trader in Australia", "description": "Trading"}}]
        self.assertEqual(len(filter_overseas_vietnamese(items)), 1)

    def test_ranks_by_subscribers(self):
        rows = [{"statistics": {"subscriberCount": "2"}}, {"statistics": {"subscriberCount": "10"}}]
        self.assertEqual(rank_channels(rows, 1)[0]["statistics"]["subscriberCount"], "10")


if __name__ == "__main__":
    unittest.main()
