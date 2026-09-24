import unittest
from unittest.mock import patch

from discovery.youtube_data_api import QuotaExceededError
from discovery.youtube_video_enrich import recent_video_descriptions, uploads_playlist_ids


class UploadsPlaylistIdsTests(unittest.TestCase):
    def test_maps_channel_to_uploads_playlist_in_batches_of_50(self):
        responses = [
            {"items": [{"id": f"UC{i}", "contentDetails": {"relatedPlaylists": {"uploads": f"UU{i}"}}}
                       for i in range(50)]},
            {"items": [{"id": "UC50", "contentDetails": {"relatedPlaylists": {"uploads": "UU50"}}}]},
        ]
        channel_ids = [f"UC{i}" for i in range(51)]
        with patch("discovery.youtube_video_enrich.request", side_effect=responses) as request:
            mapping, quota = uploads_playlist_ids(channel_ids, "k")
        self.assertEqual(request.call_count, 2)  # 51 ids -> two batches of <=50
        self.assertEqual(quota, 2)
        self.assertEqual(mapping["UC0"], "UU0")
        self.assertEqual(mapping["UC50"], "UU50")

    def test_channel_with_no_uploads_playlist_is_omitted(self):
        with patch("discovery.youtube_video_enrich.request",
                   side_effect=[{"items": [{"id": "UC1", "contentDetails": {}}]}]):
            mapping, quota = uploads_playlist_ids(["UC1"], "k")
        self.assertEqual(mapping, {})
        self.assertEqual(quota, 1)


class RecentVideoDescriptionsTests(unittest.TestCase):
    def test_combines_descriptions_from_the_uploads_playlist(self):
        responses = [
            {"items": [{"contentDetails": {"videoId": "v1"}}, {"contentDetails": {"videoId": "v2"}}]},
            {"items": [{"snippet": {"description": "contact: a@b.com"}},
                       {"snippet": {"description": "Sydney AU"}}]},
        ]
        with patch("discovery.youtube_video_enrich.request", side_effect=responses) as request:
            desc, quota = recent_video_descriptions("UU1", "k", max_videos=50)
        self.assertIn("a@b.com", desc)
        self.assertIn("Sydney AU", desc)
        self.assertEqual(quota, 2)  # 1 playlistItems.list + 1 videos.list
        playlist_params = request.call_args_list[0].args[1]
        self.assertEqual(playlist_params["playlistId"], "UU1")
        self.assertEqual(playlist_params["maxResults"], 50)

    def test_empty_playlist_costs_only_the_playlistItems_call(self):
        with patch("discovery.youtube_video_enrich.request", side_effect=[{"items": []}]) as request:
            desc, quota = recent_video_descriptions("UU1", "k", max_videos=50)
        self.assertEqual(desc, "")
        self.assertEqual(quota, 1)
        request.assert_called_once()

    def test_quota_exceeded_propagates_to_the_caller(self):
        with patch("discovery.youtube_video_enrich.request", side_effect=QuotaExceededError("out")):
            with self.assertRaises(QuotaExceededError):
                recent_video_descriptions("UU1", "k", max_videos=50)


if __name__ == "__main__":
    unittest.main()
