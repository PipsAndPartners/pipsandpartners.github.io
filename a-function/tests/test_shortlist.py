import unittest

from discovery import shortlist as sl


class VnSignalTests(unittest.TestCase):
    def test_distinctive_vietnamese_letter(self):
        self.assertTrue(sl.vn_signal("Đầu tư Forex"))

    def test_vn_phone(self):
        self.assertTrue(sl.vn_signal("call 0912345678"))

    def test_plain_latin_accents_are_not_enough(self):
        # Hungarian/Turkish share á/é/ó -- must not read as Vietnamese.
        self.assertFalse(sl.vn_signal("oszinteforex"))

    def test_foreign_token_vetoes(self):
        self.assertFalse(sl.vn_signal("XTB Italia sàn ngoại hối"))  # has VN chars but tagged Italia


class BrokerFilterTests(unittest.TestCase):
    def test_broker_self_by_name(self):
        self.assertTrue(sl.is_broker_self("XTB UK", "", "xtb"))

    def test_broker_self_by_handle(self):
        self.assertTrue(sl.is_broker_self("Some Channel", "@xtbtr", "xtb"))

    def test_not_broker_self(self):
        self.assertFalse(sl.is_broker_self("Đánh Giá Sàn XTB", "reviewfx", "xtb"))

    def test_other_broker_leading_brand(self):
        self.assertTrue(sl.is_other_broker("Exness Vietnam", "exnessvn"))
        self.assertTrue(sl.is_other_broker("VT Markets Vietnam | HCM", "vtmarketsvietnam"))

    def test_not_other_broker(self):
        self.assertFalse(sl.is_other_broker("Ngoại Hối Thực Chiến", "tradingzonefx"))

    def test_custom_brand_list(self):
        self.assertTrue(sl.is_other_broker("Acme FX", "acme", brands=("acme",)))


class ForexGateTests(unittest.TestCase):
    def test_relevance_passes(self):
        self.assertTrue(sl.is_forex("Random", "", 20))

    def test_forex_term_passes(self):
        self.assertTrue(sl.is_forex("Nghề Forex", "", None))

    def test_non_forex_rejected(self):
        self.assertFalse(sl.is_forex("Đoàn Thanh Niên Xuân Trường", "", None))


class CorpEmailTests(unittest.TestCase):
    def test_corporate_domain_is_broker(self):
        self.assertTrue(sl.is_broker_corp_email("support@cwgmarkets.com"))

    def test_gmail_is_not(self):
        self.assertFalse(sl.is_broker_corp_email("ib.person@gmail.com"))

    def test_edu_is_not(self):
        self.assertFalse(sl.is_broker_corp_email("admin@dhe.edu.vn"))

    def test_empty(self):
        self.assertFalse(sl.is_broker_corp_email(None))


class DedupTests(unittest.TestCase):
    def test_candidate_ids_from_handle_and_url(self):
        ids = sl.candidate_ids("@FxGuy", "UC123", "https://www.tiktok.com/@fxguy")
        self.assertIn("fxguy", ids)
        self.assertIn("uc123", ids)

    def test_parse_exclusion_ids_pulls_channels_and_handles(self):
        text = ("name,handle,youtube\n"
                "Foo,dau_tu_a_b_c,https://youtube.com/channel/UC104IJSb0QwNGzG6goH-XcQ\n")
        ids = sl.parse_exclusion_ids(text)
        self.assertIn("dau_tu_a_b_c", ids)
        self.assertIn("uc104ijsb0qwngzg6goh-xcq", ids)

    def test_dedup_intersection(self):
        excl = sl.parse_exclusion_ids("name,handle\nX,giaodichforex\n")
        self.assertTrue(sl.candidate_ids("giaodichforex", "123", "") & excl)


class RankingTests(unittest.TestCase):
    def test_reach_and_contact_beat_a_bare_broker_hit(self):
        big = {"follower_count": 155000, "email_norm": "x@gmail.com", "phone_norm": None,
               "composite_score": 63, "broker_hit": False}
        tiny = {"follower_count": 46, "email_norm": None, "phone_norm": None,
                "composite_score": 55, "broker_hit": True}
        self.assertGreater(sl.potential(big), sl.potential(tiny))


if __name__ == "__main__":
    unittest.main()
