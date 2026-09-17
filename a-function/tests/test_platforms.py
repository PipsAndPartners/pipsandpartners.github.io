import unittest

from platforms import twitter, douyin, youtube, facebook, facebook_post, tiktok, linkedin


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
    def test_build_input_default_searches_keywords(self):
        self.assertIn("keywords", douyin.build_input({}))
        self.assertNotIn("profileUrls", douyin.build_input({}))

    def test_build_input_search_query_maps_to_keywords(self):
        self.assertEqual(douyin.build_input({"search_query": "cfd"})["keywords"], ["cfd"])

    def test_to_entity_uses_sec_uid_and_bio_contacts(self):
        entity = douyin.to_entity({"authorMeta": {
            "secUid": "SEC", "username": "u", "name": "N", "followersCount": 12,
            "signature": "liên hệ fx@mail.com 0912345678",
        }})
        self.assertEqual(entity["platform_id"], "SEC")
        self.assertEqual(entity["handle"], "u")
        self.assertEqual(entity["display_name"], "N")
        self.assertEqual(entity["follower_count"], 12)
        self.assertEqual(entity["email_norm"], "fx@mail.com")
        self.assertEqual(entity["phone_norm"], "0912345678")
        self.assertEqual(entity["source_url"], "https://www.douyin.com/user/SEC")

    def test_extract_engagement_reads_statistics(self):
        got = douyin.extract_engagement({"statistics": {"diggCount": 10, "commentCount": 3, "shareCount": 2}})
        self.assertEqual(got, {"likes": 10, "shares": 2, "comments": 3})

    def test_extract_related_links_dedupes(self):
        links = douyin.extract_related_links({"authorMeta": {
            "signature": "site https://a.com/x and again https://a.com/x plus https://b.com"
        }})
        urls = [l["url"] for l in links]
        self.assertEqual(urls, ["https://a.com/x", "https://b.com"])


class TikTokTests(unittest.TestCase):
    def test_to_entity_pulls_contacts_from_bio(self):
        entity = tiktok.to_entity({"authorMeta": {
            "id": "123", "name": "fxguy", "nickName": "FX Guy", "fans": 500,
            "bioLink": "fx.example", "signature": "contact fx@mail.com or 0912345678",
        }})
        self.assertEqual(entity["platform_id"], "123")
        self.assertEqual(entity["handle"], "fxguy")
        self.assertEqual(entity["follower_count"], 500)
        self.assertEqual(entity["email_norm"], "fx@mail.com")
        self.assertEqual(entity["phone_norm"], "0912345678")
        self.assertEqual(entity["source_url"], "https://www.tiktok.com/@fxguy")

    def test_extract_engagement(self):
        got = tiktok.extract_engagement({"diggCount": 10, "commentCount": 5, "shareCount": 5})
        self.assertEqual(got, {"likes": 10, "shares": 5, "comments": 5})

    def test_extract_related_links_includes_bio_socials(self):
        links = tiktok.extract_related_links({"authorMeta": {
            "bioLink": "linktr.ee/fxguy", "signature": "my ig https://instagram.com/fxguy",
        }})
        urls = [l["url"] for l in links]
        self.assertIn("https://linktr.ee/fxguy", urls)
        self.assertIn("https://instagram.com/fxguy", urls)


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

    def test_bio_text_folds_in_categories(self):
        entity = facebook.to_entity({"pageId": 1, "info": "We are an IB", "categories": ["Forex Broker"]})
        self.assertIn("IB", entity["bio_text"])
        self.assertIn("Forex Broker", entity["bio_text"])

    def test_bio_text_handles_list_valued_info(self):
        # the real actor returns `info` as a list of lines, not a string.
        entity = facebook.to_entity({
            "pageId": 1,
            "info": ["Lirunex Vietnam, HCMC. 12,049 followers", "uy tín forex broker"],
            "categories": ["Forex Broker"],
        })
        self.assertIn("Lirunex", entity["bio_text"])
        self.assertIn("Forex Broker", entity["bio_text"])

    def test_extract_related_links_website_messenger_and_bio_socials(self):
        links = facebook.extract_related_links({
            "website": "fx.example",
            "messenger": "https://m.me/fxbroker",
            "info": "follow us https://instagram.com/fxbroker",
        })
        urls = [l["url"] for l in links]
        self.assertIn("https://fx.example", urls)
        self.assertIn("https://m.me/fxbroker", urls)
        self.assertIn("https://instagram.com/fxbroker", urls)


class FacebookPostTests(unittest.TestCase):
    def test_build_input_search_query_maps_to_query(self):
        self.assertEqual(facebook_post.build_input({"search_query": "sàn XTB"})["query"], "sàn XTB")

    def test_to_entity_reads_author_and_bio_contacts(self):
        entity = facebook_post.to_entity({
            "author": {"id": "100012345", "name": "Nguyễn IB", "profileUrl": "https://facebook.com/nguyenib"},
            "postText": "Sàn XTB đóng cửa, liên hệ ib@fx.com 0912345678",
            "reactionsCount": 12, "commentsCount": 3, "sharesCount": 1,
        })
        self.assertEqual(entity["platform_id"], "100012345")
        self.assertEqual(entity["handle"], "nguyenib")
        self.assertEqual(entity["display_name"], "Nguyễn IB")
        self.assertIn("XTB", entity["bio_text"])
        self.assertEqual(entity["email_norm"], "ib@fx.com")
        self.assertEqual(entity["phone_norm"], "0912345678")
        self.assertEqual(entity["source_url"], "https://facebook.com/nguyenib")

    def test_to_entity_profile_php_id(self):
        entity = facebook_post.to_entity({
            "author": {"name": "X", "profileUrl": "https://facebook.com/profile.php?id=678"},
            "postText": "forex",
        })
        self.assertEqual(entity["platform_id"], "id_678")

    def test_extract_engagement(self):
        got = facebook_post.extract_engagement({"reactionsCount": 12, "commentsCount": 3, "sharesCount": 1})
        self.assertEqual(got, {"likes": 12, "shares": 1, "comments": 3})

    def test_extract_engagement_none(self):
        self.assertIsNone(facebook_post.extract_engagement({}))


class LinkedInTests(unittest.TestCase):
    def test_to_entity_fills_avatar_phone_email(self):
        entity = linkedin.to_entity({
            "publicIdentifier": "jane", "firstName": "Jane", "lastName": "Doe",
            "headline": "Forex IB", "followerCount": 900,
            "profilePicture": "https://pic.example/jane.jpg",
            "phoneNumbers": ["+84901234567"], "emails": ["Jane@FX.com"],
            "linkedinUrl": "https://linkedin.com/in/jane",
        })
        self.assertEqual(entity["platform_id"], "jane")
        self.assertEqual(entity["display_name"], "Jane Doe")
        self.assertEqual(entity["avatar_url"], "https://pic.example/jane.jpg")
        self.assertEqual(entity["phone_norm"], "+84901234567")
        self.assertEqual(entity["email_norm"], "jane@fx.com")

    def test_extract_related_links_includes_personal_websites(self):
        links = linkedin.extract_related_links({
            "websites": [{"url": "https://site.example", "label": "Company"}],
            "experience": [], "about": "",
        })
        urls = [l["url"] for l in links]
        self.assertIn("https://site.example", urls)


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
