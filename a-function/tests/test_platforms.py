import unittest

from platforms import twitter, douyin, youtube


class TwitterTests(unittest.TestCase):
    def test_build_input_default(self):
        self.assertEqual(twitter.build_input({})["searchTerms"], ["Forex Affiliate"])

    def test_build_input_usernames_switches_to_handles(self):
        run_input = twitter.build_input({"usernames": ["alice"]})
        self.assertNotIn("searchTerms", run_input)
        self.assertEqual(run_input["twitterHandles"], ["alice"])

    def test_build_input_search_query(self):
        self.assertEqual(twitter.build_input({"search_query": "cfd"})["searchTerms"], ["cfd"])

    def test_to_entity_reads_author(self):
        entity = twitter.to_entity({
            "author": {"userName": "fxguy", "name": "FX Guy", "description": "IB", "followers": 500}
        })
        self.assertEqual(entity["platform_id"], "fxguy")
        self.assertEqual(entity["handle"], "fxguy")
        self.assertEqual(entity["follower_count"], 500)
        self.assertEqual(entity["source_url"], "https://twitter.com/fxguy")

    def test_extract_engagement(self):
        got = twitter.extract_engagement({"likeCount": 10, "retweetCount": 2, "replyCount": 3})
        self.assertEqual(got, {"likes": 10, "shares": 2, "comments": 3})

    def test_extract_engagement_none_when_no_metrics(self):
        self.assertIsNone(twitter.extract_engagement({}))


class DouyinTests(unittest.TestCase):
    def test_build_input_default(self):
        self.assertIn("profileUrls", douyin.build_input({}))

    def test_build_input_urls_override(self):
        urls = ["https://www.douyin.com/user/ABC"]
        self.assertEqual(douyin.build_input({"urls": urls})["profileUrls"], urls)

    def test_to_entity_uses_sec_uid(self):
        entity = douyin.to_entity({"authorMeta": {
            "secUid": "SEC", "uniqueId": "u", "nickname": "N", "followersCount": 12,
        }})
        self.assertEqual(entity["platform_id"], "SEC")
        self.assertEqual(entity["handle"], "u")
        self.assertEqual(entity["follower_count"], 12)
        self.assertEqual(entity["source_url"], "https://www.douyin.com/user/SEC")

    def test_extract_related_links_dedupes(self):
        links = douyin.extract_related_links({"authorMeta": {
            "signature": "site https://a.com/x and again https://a.com/x plus https://b.com"
        }})
        urls = [l["url"] for l in links]
        self.assertEqual(urls, ["https://a.com/x", "https://b.com"])


class YouTubeTests(unittest.TestCase):
    def test_to_entity(self):
        entity = youtube.to_entity({
            "id": "UC9",
            "snippet": {"title": "FX", "description": "Forex", "customUrl": "@fx"},
            "statistics": {"subscriberCount": "1000"},
        })
        self.assertEqual(entity["platform_id"], "UC9")
        self.assertEqual(entity["follower_count"], 1000)
        self.assertEqual(entity["source_url"], "https://www.youtube.com/channel/UC9")

    def test_to_entity_missing_subscriber_count(self):
        entity = youtube.to_entity({"id": "UC1", "snippet": {}, "statistics": {}})
        self.assertIsNone(entity["follower_count"])


if __name__ == "__main__":
    unittest.main()
