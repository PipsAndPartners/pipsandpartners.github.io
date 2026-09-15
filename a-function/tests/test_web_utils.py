import os
import unittest
from unittest.mock import patch

from cryptography.fernet import Fernet

from web.json_to_table import render
from web import crypto_utils


class JsonToTableTests(unittest.TestCase):
    def test_escapes_html_and_counts_rows(self):
        out = render([{"name": "<b>x</b>"}], "T & T")
        self.assertIn("&lt;b&gt;x&lt;/b&gt;", out)   # cell escaped
        self.assertIn("T &amp; T", out)              # title escaped
        self.assertIn("1 row(s)", out)

    def test_reads_items_key_from_dict(self):
        out = render({"items": [{"a": 1}, {"a": 2}]}, "d")
        self.assertIn("2 row(s)", out)

    def test_columns_union_across_rows(self):
        out = render([{"a": 1}, {"b": 2}], "d")
        self.assertIn("<th>a</th>", out)
        self.assertIn("<th>b</th>", out)


class CryptoUtilsTests(unittest.TestCase):
    def test_roundtrip(self):
        key = Fernet.generate_key().decode()
        with patch.dict(os.environ, {"TOKEN_ENC_KEY": key}):
            cipher = crypto_utils.encrypt_token("secret-apify-token")
            self.assertNotEqual(cipher, "secret-apify-token")
            self.assertEqual(crypto_utils.decrypt_token(cipher), "secret-apify-token")

    def test_missing_key_raises(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(RuntimeError):
                crypto_utils.encrypt_token("x")


if __name__ == "__main__":
    unittest.main()
