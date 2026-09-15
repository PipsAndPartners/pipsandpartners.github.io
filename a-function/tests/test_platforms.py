import unittest

from platforms import twitter, douyin, youtube, facebook


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


class FacebookTests(unittest.TestCase):
    def test_build_input_default_has_required_categories(self):
        run_input = facebook.build_input({})
        self.assertEqual(run_input["categories"], ["forex"])
        self.assertIn("locations", run_input)
        self.assertIn("resultsLimit", run_input)

    def test_build_input_search_query_maps_to_categories(self):
        self.assertEqual(facebook.build_input({"search_query": "cfd"})["categories"], ["cfd"])

    def test_build_input_overrides_locations_and_limit(self):
        run_input = facebook.build_input({"locations": ["Australia"], "resultsLimit": 5})
        self.assertEqual(run_input["locations"], ["Australia"])
        self.assertEqual(run_input["resultsLimit"], 5)

    def test_to_entity_keeps_contact_fields(self):
        entity = facebook.to_entity({
            "pageId": 42,
            "pageName": "fxbroker",
            "title": "FX Broker",
            "info": "Introducing broker",
            "website": "https://fx.example",
            "followers": 1200,
            "email": "  HELLO@FX.Example ",
            "phone": "+61 400 000 000",
            "messenger": "https://m.me/fxbroker",
            "pageUrl": "https://facebook.com/fxbroker",
        })
        self.assertEqual(entity["platform_id"], "42")
        self.assertEqual(entity["handle"], "fxbroker")
        self.assertEqual(entity["follower_count"], 1200)
        self.assertEqual(entity["email_norm"], "hello@fx.example")
        self.assertEqual(entity["phone_norm"], "+61 400 000 000")
        self.assertEqual(entity["messenger_url"], "https://m.me/fxbroker")
        self.assertEqual(entity["source_url"], "https://facebook.com/fxbroker")

    def test_to_entity_falls_back_to_likes_and_no_email(self):
        entity = facebook.to_entity({"pageId": 1, "likes": 7})
        self.assertEqual(entity["follower_count"], 7)
        self.assertIsNone(entity["email_norm"])


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
