import unittest

from discovery.telegram.channel_enrich import is_vietnamese
from discovery.telegram.extract import extract_about
from discovery.telegram.seeds import normalise_seed


class TelegramExtractTests(unittest.TestCase):
    def test_extracts_contacts_and_social_links(self):
        result = extract_about(
            "Call +84 912 345 678, mail FX@Example.COM, https://example.com and t.me/fx_news"
        )
        self.assertEqual(result["phones"], ["+84912345678"])
        self.assertEqual(result["emails"], ["fx@example.com"])
        self.assertEqual(result["websites"], ["https://example.com"])
        self.assertEqual(result["telegram_candidates"], ["fx_news"])

    def test_rejects_private_invite_seed(self):
        self.assertIsNone(normalise_seed("https://t.me/+privatehash"))
        self.assertEqual(normalise_seed("@fx_news"), "fx_news")


class VietnameseFilterTests(unittest.TestCase):
    def test_diacritics_and_phone_pass(self):
        self.assertTrue(is_vietnamese("Tín hiệu vàng mỗi ngày"))   # diacritics
        self.assertTrue(is_vietnamese("Lien he +84912345678"))     # VN phone, no diacritic

    def test_english_channels_fail(self):
        # language-neutral forex jargon must NOT read as Vietnamese
        self.assertFalse(is_vietnamese("Free Forex Signals - daily XAUUSD gold setups"))
        self.assertFalse(is_vietnamese("Daily crypto news channel"))
        self.assertFalse(is_vietnamese(None))


if __name__ == "__main__":
    unittest.main()
