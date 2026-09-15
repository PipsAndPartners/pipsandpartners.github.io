import unittest
from unittest.mock import patch

from discovery import x_api


def _response(user_id, username, followers, keyword_users=None):
    return {"includes": {"users": [{
        "id": user_id,
        "username": username,
        "name": username.upper(),
        "description": "Forex trader",
        "location": "AU",
        "public_metrics": {"followers_count": followers},
        "profile_image_url": "http://img/pic.jpg",
    }]}}


class XApiDiscoverTests(unittest.TestCase):
    def test_single_keyword_shapes_author(self):
        with patch("discovery.x_api.request", return_value=_response("1", "fxguy", 500)) as req:
            result = x_api.discover(["forex"], max_results=10)
        self.assertEqual(result["requests_made"], 1)
        self.assertEqual(req.call_count, 1)
        item = result["items"][0]
        self.assertEqual(item["id"], "1")
        # author sub-dict is shaped for platforms.twitter.to_entity()
        self.assertEqual(item["author"]["userName"], "fxguy")
        self.assertEqual(item["author"]["followers"], 500)
        self.assertEqual(item["discovery_keywords"], ["forex"])

    def test_same_author_deduped_across_keywords(self):
        responses = [_response("1", "fxguy", 500), _response("1", "fxguy", 500)]
        with patch("discovery.x_api.request", side_effect=responses):
            result = x_api.discover(["forex", "cfd"])
        self.assertEqual(len(result["items"]), 1)
        self.assertEqual(result["items"][0]["discovery_keywords"], ["forex", "cfd"])
        self.assertEqual(result["requests_made"], 2)


if __name__ == "__main__":
    unittest.main()
