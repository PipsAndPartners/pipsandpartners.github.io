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

    def test_extracts_chinese_contacts(self):
        # Douyin bios: WeChat/QQ labels + an 11-digit CN mobile, no VN number.
        result = extract_contacts("黄金分析师 微信：Trader_888 QQ:12345678 电话13812345678")
        self.assertEqual(result["wechat"], "Trader_888")
        self.assertEqual(result["qq"], "12345678")
        self.assertEqual(result["phone"], "13812345678")

    def test_cn_phone_accepts_plus_86_prefix(self):
        self.assertEqual(extract_contacts("联系+8613812345678")["phone"], "+8613812345678")

    def test_vn_phone_still_wins_over_cn(self):
        # A bio with both keeps the VN number (existing behaviour, +84/0 pattern).
        result = extract_contacts("VN 0912345678 CN 13812345678")
        self.assertEqual(result["phone"], "0912345678")

    def test_emoji_label_wechat(self):
        # Real Douyin dodge: 🈴 (合/"加") used as a WeChat label. cf. 说财鲸 bio.
        self.assertEqual(extract_contacts("海外经济学硕士 🈴scj-020")["wechat"], "scj-020")

    def test_homophone_wechat_label(self):
        self.assertEqual(extract_contacts("加威信 GoldMark88 了解详情")["wechat"], "GoldMark88")

    def test_fullwidth_phone_normalised(self):
        # '１３８…' full-width digits normalise to ASCII, then match as a CN mobile.
        self.assertEqual(extract_contacts("电话１３８１２３４５６７８")["phone"], "13812345678")

    def test_spaced_cn_phone(self):
        # Segmented number still resolves once separators are stripped.
        phone = extract_contacts("联系 138 1234 5678")["phone"]
        self.assertEqual(phone.replace(" ", ""), "13812345678")

    def test_qq_with_kou_label(self):
        self.assertEqual(extract_contacts("扣扣：123456789")["qq"], "123456789")

    # --- obfuscated / styled contact recovery ---

    def test_email_at_dot_parenthesised(self):
        self.assertEqual(extract_contacts("lien he info (at) gmail (dot) com")["email"], "info@gmail.com")

    def test_email_bracketed_and_spaced(self):
        self.assertEqual(extract_contacts("info[at]gmail[dot]com")["email"], "info@gmail.com")
        self.assertEqual(extract_contacts("mail: info @ gmail . com")["email"], "info@gmail.com")

    def test_email_symbol_at_word_dot(self):
        self.assertEqual(extract_contacts("info@gmail dot com")["email"], "info@gmail.com")

    def test_email_styled_unicode_font(self):
        # 𝗂𝗇𝖿𝗈@𝗀𝗆𝖺𝗂𝗅.com in a fancy Instagram/TikTok font
        styled = "\U0001d422\U0001d427\U0001d41f\U0001d428@\U0001d420\U0001d426\U0001d41a\U0001d422\U0001d425.com"
        self.assertEqual(extract_contacts(styled)["email"], "info@gmail.com")

    def test_email_deobfuscation_no_false_positive_from_prose(self):
        # a bare " at " must NOT be read as "@" -> this is not an email
        self.assertEqual(extract_contacts("Let's meet at home dot org tomorrow")["email"], "")

    def test_phone_parenthesised_country_code(self):
        self.assertEqual(extract_contacts("Hotline (+84) 912 345 678")["phone"].replace(" ", ""), "(+84)912345678".replace(" ", ""))

    def test_phone_bare_84_prefix(self):
        self.assertTrue(extract_contacts("Zalo 84912345678")["phone"].endswith("84912345678"))

    def test_phone_letter_o_for_zero(self):
        self.assertEqual(extract_contacts("lien he O912345678")["phone"], "0912345678")

    def test_wechat_v_colon_label(self):
        self.assertEqual(extract_contacts("add V: gold_traders88")["wechat"], "gold_traders88")

    def test_wechat_v_colon_not_triggered_by_tv(self):
        # "TV:" must not be read as a WeChat "V:" label
        self.assertEqual(extract_contacts("watch on TV: someshow")["wechat"], "")

    def test_wechat_no_false_positive_from_generic_emoji(self):
        # 📱/📲/💬 emoji are followed by ordinary words in real bios -> NOT a WeChat id
        self.assertEqual(extract_contacts("\U0001F4F1 Tecnologia en todas partes")["wechat"], "")
        self.assertEqual(extract_contacts("\U0001F4F2 Telegram: @somechannel")["wechat"], "")
        self.assertEqual(extract_contacts("\U0001F4AC WhatsApp business")["wechat"], "")


if __name__ == "__main__":
    unittest.main()
