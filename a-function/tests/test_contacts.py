import unittest

from discovery.common.contacts import extract_contacts


class ContactsTests(unittest.TestCase):
    def test_extracts_each_field(self):
        text = (
            "Reach me: fx@example.com, +84 912 345 678, "
            "https://facebook.com/fxpage https://instagram.com/fxig "
            "https://tiktok.com/@fxtt https://t.me/fxchan https://x.com/fxx "
            "https://zalo.me/123456"
        )
        result = extract_contacts(text)
        self.assertEqual(result["email"], "fx@example.com")
        self.assertTrue(result["phone"].startswith("+84"))
        self.assertIn("facebook.com/fxpage", result["facebook"])
        self.assertIn("instagram.com/fxig", result["instagram"])
        self.assertIn("tiktok.com/@fxtt", result["tiktok"])
        self.assertIn("t.me/fxchan", result["telegram"])
        self.assertIn("x.com/fxx", result["x"])
        self.assertIn("zalo.me/123456", result["zalo"])

    def test_zalo_falls_back_to_phone_on_zalo_line(self):
        result = extract_contacts("Contact\nZalo: 0912345678\nother")
        self.assertEqual(result["zalo"], "0912345678")

    def test_empty_text_returns_blanks(self):
        result = extract_contacts(None)
        self.assertEqual(set(result.values()), {""})

    def test_accepts_list_valued_text(self):
        # some actors return "info"/"about" as a list of lines, not a string.
        result = extract_contacts(["line one", "mail me at ib@fx.com", "0912345678"])
        self.assertEqual(result["email"], "ib@fx.com")
        self.assertEqual(result["phone"], "0912345678")


if __name__ == "__main__":
    unittest.main()
