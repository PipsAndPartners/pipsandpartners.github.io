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
