import unittest
from unittest.mock import MagicMock, patch

from discovery.youtube_data_api import QuotaExceededError
from discovery.youtube_video_enrich import recent_videos, store_video_stats, uploads_playlist_ids


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


class RecentVideosTests(unittest.TestCase):
    def test_returns_full_video_resources_from_the_uploads_playlist(self):
        responses = [
            {"items": [{"contentDetails": {"videoId": "v1"}}, {"contentDetails": {"videoId": "v2"}}]},
            {"items": [{"id": "v1", "snippet": {"description": "contact: a@b.com"},
                        "statistics": {"viewCount": "100"}, "contentDetails": {"duration": "PT5M"}},
                       {"id": "v2", "snippet": {"description": "Sydney AU"}}]},
        ]
        with patch("discovery.youtube_video_enrich.request", side_effect=responses) as request:
            videos, quota = recent_videos("UU1", "k", max_videos=50)
        self.assertEqual([v["id"] for v in videos], ["v1", "v2"])
        self.assertEqual(videos[0]["statistics"]["viewCount"], "100")
        self.assertEqual(quota, 2)  # 1 playlistItems.list + 1 videos.list
        playlist_params = request.call_args_list[0].args[1]
        self.assertEqual(playlist_params["playlistId"], "UU1")
        self.assertEqual(playlist_params["maxResults"], 50)
        # statistics+contentDetails ride along in videos.list's `part` for 0 extra quota
        video_params = request.call_args_list[1].args[1]
        self.assertEqual(video_params["part"], "snippet,statistics,contentDetails")

    def test_empty_playlist_costs_only_the_playlistItems_call(self):
        with patch("discovery.youtube_video_enrich.request", side_effect=[{"items": []}]) as request:
            videos, quota = recent_videos("UU1", "k", max_videos=50)
        self.assertEqual(videos, [])
        self.assertEqual(quota, 1)
        request.assert_called_once()

    def test_quota_exceeded_propagates_to_the_caller(self):
        with patch("discovery.youtube_video_enrich.request", side_effect=QuotaExceededError("out")):
            with self.assertRaises(QuotaExceededError):
                recent_videos("UU1", "k", max_videos=50)


class StoreVideoStatsTests(unittest.TestCase):
    def test_inserts_one_row_per_video_with_an_id(self):
        cur = MagicMock()
        videos = [{"id": "v1", "snippet": {}}, {"id": "v2", "snippet": {}}, {"snippet": {}}]  # last has no id
        store_video_stats(cur, "UC1", videos)
        cur.executemany.assert_called_once()
        sql, rows = cur.executemany.call_args.args
        self.assertIn("staging_youtube_video", sql)
        self.assertEqual([r[:2] for r in rows], [("UC1", "v1"), ("UC1", "v2")])

    def test_no_videos_does_not_touch_the_cursor(self):
        cur = MagicMock()
        store_video_stats(cur, "UC1", [])
        cur.executemany.assert_not_called()


if __name__ == "__main__":
    unittest.main()
