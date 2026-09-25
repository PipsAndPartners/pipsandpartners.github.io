import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from openpyxl import Workbook

from outreach.eml import records_from_xlsx
from outreach.mailfields import default_standout, mail_fields
from outreach.standout_source import (
    _read_rows,
    _write_xlsx,
    channel_id_from_url,
    compose_standout,
    enrich,
    fetch_channel,
    infer_topic,
)

AZFIN_URL = "https://www.youtube.com/channel/UCnH3mGTw4w7rjOYIfGAVV7Q"
AZFIN_DESC = ("Chứng khoán TV chuyên cung cấp kiến thức từ đầu tư chứng khoán cơ bản đến nâng cao, "
              "nhận định đánh giá cổ phiếu chi tiết")


def _xlsx(path: Path, header: list, rows: list[list]) -> Path:
    wb = Workbook()
    ws = wb.active
    ws.append(header)
    for r in rows:
        ws.append(r)
    wb.save(path)
    return path


class MailfieldsStandoutTests(unittest.TestCase):
    def test_default_standout_topic_from_name(self):
        self.assertEqual(
            default_standout({"display_name": "ATM Forex", "platform": "youtube"}),
            "những nội dung của ATM Forex về phân tích forex và thị trường vàng trên YouTube",
        )

    def test_default_standout_topic_from_bio_with_audience(self):
        row = {"display_name": "Steve Le", "platform": "youtube", "follower_count": 64700,
               "bio_text": "diễn biến của thị trường chứng khoán Mỹ trong ngày"}
        self.assertEqual(default_standout(row),
                         "những nội dung của Steve Le về thị trường chứng khoán Mỹ trên YouTube, "
                         "nơi có hơn 64K người theo dõi")

    def test_audience_in_millions(self):
        row = {"display_name": "X", "platform": "youtube", "bio_text": "forex", "follower_count": 1_250_000}
        self.assertTrue(default_standout(row).endswith("hơn 1,2 triệu người theo dõi"))

    def test_small_audience_not_mentioned(self):
        row = {"display_name": "X", "platform": "youtube", "bio_text": "forex", "follower_count": 9000}
        self.assertNotIn("theo dõi", default_standout(row))

    def test_no_doubled_ve_in_any_topic_phrase(self):
        from outreach.mailfields import _TOPIC_RULES
        for _, phrase in _TOPIC_RULES:
            self.assertFalse(phrase.startswith(("về ", "kiến thức về")), phrase)

    def test_no_signal_drops_the_standout_sentence(self):
        _, body = mail_fields({"display_name": "Running Man", "platform": "youtube",
                               "bio_text": "gameshow giải trí"})
        self.assertNotIn("ấn tượng", body)
        self.assertNotIn("forex và đầu tư tài chính", body)
        self.assertIn("toàn cầu.\n\nTMGM Úc hiện đang ưu tiên", body)

    def test_default_standout_has_no_pronoun_placeholder_when_named(self):
        # regression: the fallback line used to hardcode "anh/chị"
        _, body = mail_fields({"display_name": "Học Trade", "platform": "youtube"})
        self.assertNotIn("anh/chị", body)

    def test_broker_hit_branch_mentions_tmgm(self):
        s = default_standout({"display_name": "X", "platform": "tiktok", "broker_hit": True})
        self.assertEqual(s, "những nội dung của X về TMGM trên TikTok")

    def test_unknown_platform_falls_back_to_generic_label(self):
        s = default_standout({"display_name": "X", "platform": "zzz", "bio_text": "forex"})
        self.assertTrue(s.endswith("trên mạng xã hội"))

    def test_explicit_standout_overrides_default(self):
        _, body = mail_fields({"display_name": "X", "platform": "youtube"}, "điều đặc biệt")
        self.assertIn("Em đặc biệt ấn tượng với điều đặc biệt.", body)
        self.assertNotIn("forex và đầu tư tài chính", body)


class ChannelIdTests(unittest.TestCase):
    def test_channel_url(self):
        self.assertEqual(channel_id_from_url(AZFIN_URL), ("id", "UCnH3mGTw4w7rjOYIfGAVV7Q"))

    def test_channel_url_with_tab_suffix(self):
        self.assertEqual(channel_id_from_url(AZFIN_URL + "/about"), ("id", "UCnH3mGTw4w7rjOYIfGAVV7Q"))

    def test_handle_url(self):
        self.assertEqual(channel_id_from_url("https://www.youtube.com/@azfinvietnam/videos"),
                         ("forHandle", "@azfinvietnam"))

    def test_mobile_handle_url(self):
        self.assertEqual(channel_id_from_url("https://m.youtube.com/@abc"), ("forHandle", "@abc"))

    def test_user_url(self):
        self.assertEqual(channel_id_from_url("https://www.youtube.com/user/foo"), ("forUsername", "foo"))

    def test_unresolvable_urls(self):
        for url in ("https://www.youtube.com/c/custom", "https://facebook.com/x", "", None):
            self.assertEqual(channel_id_from_url(url), (None, None), url)


class TopicTests(unittest.TestCase):
    def test_each_rule(self):
        cases = {
            AZFIN_DESC: "phân tích và nhận định cổ phiếu",
            "Phân tích XAUUSD mỗi ngày": "phân tích forex và thị trường vàng",
            "Bitcoin & altcoin": "crypto và tài sản số",
            "Mạnh Dũng Trader FX": "phân tích forex và thị trường vàng",
            "Đầu tư bất động sản Sài Gòn": "đầu tư bất động sản",
            "Hành trình tự do tài chính": "đầu tư và quản lý tài chính cá nhân",
            "Giao dịch chứng khoán phái sinh": "giao dịch chứng khoán phái sinh",
            "AI Trading - Giao dịch chứng khoán & phái sinh": "ứng dụng AI và giao dịch tự động trong trading",
            "Bot trading tự động": "ứng dụng AI và giao dịch tự động trong trading",
            "những diễn biến của thị trường chứng khoán Mỹ": "thị trường chứng khoán Mỹ",
            "Quỹ đầu tư, chứng chỉ quỹ": "đầu tư qua quỹ và chứng chỉ quỹ",
            "Sự kiện kinh tế vĩ mô": "kinh tế vĩ mô và thị trường tài chính",
        }
        for text, topic in cases.items():
            self.assertEqual(infer_topic(text), topic, text)

    def test_case_insensitive(self):
        self.assertEqual(infer_topic("FOREX SIGNALS"), "phân tích forex và thị trường vàng")

    def test_earliest_mention_wins_on_overlap(self):
        self.assertEqual(infer_topic("forex và chứng khoán"), "phân tích forex và thị trường vàng")
        self.assertEqual(infer_topic("quản lý tài chính cá nhân ở Mỹ. Mình làm trong lĩnh vực bất động sản"),
                         "đầu tư và quản lý tài chính cá nhân")

    def test_rule_order_breaks_ties(self):
        self.assertEqual(infer_topic("chứng khoán mỹ"), "thị trường chứng khoán Mỹ")

    def test_gold_word_in_unrelated_name_does_not_match(self):
        self.assertIsNone(infer_topic("CỬA SỔ VÀNG - NGUYỄN DUY CƯƠNG nuôi dạy con, giáo dục sớm"))
        self.assertEqual(infer_topic("Phân tích giá vàng hôm nay"), "phân tích forex và thị trường vàng")

    def test_no_match_is_none(self):
        self.assertIsNone(infer_topic("Kênh du lịch ẩm thực"))
        self.assertIsNone(infer_topic(""))
        self.assertIsNone(compose_standout("A", "Kênh du lịch", ""))

    def test_compose_standout(self):
        self.assertEqual(compose_standout("AzFin", "Chứng khoán TV", ""),
                         "những nội dung của AzFin về phân tích và nhận định cổ phiếu trên YouTube")


class FetchChannelTests(unittest.TestCase):
    def test_sends_snippet_request_with_key(self):
        resp = {"items": [{"snippet": {"title": "AzFin", "description": AZFIN_DESC}}]}
        with patch.dict(os.environ, {"YOUTUBE_API_KEY": "k"}), \
                patch("discovery.youtube_data_api.request", return_value=resp) as req:
            self.assertEqual(fetch_channel("id", "UC1"), {"title": "AzFin", "description": AZFIN_DESC})
        req.assert_called_once_with("channels", {"part": "snippet", "id": "UC1", "key": "k"})

    def test_no_items_returns_empty(self):
        with patch.dict(os.environ, {"YOUTUBE_API_KEY": "k"}), \
                patch("discovery.youtube_data_api.request", return_value={"items": []}):
            self.assertEqual(fetch_channel("forHandle", "@gone"), {})

    def test_missing_key_raises_without_calling_api(self):
        with patch.dict(os.environ, {"YOUTUBE_API_KEY": ""}), \
                patch("discovery.youtube_data_api.request") as req:
            with self.assertRaises(RuntimeError):
                fetch_channel("id", "UC1")
        req.assert_not_called()


class EnrichTests(unittest.TestCase):
    def test_channel_text_gives_specific_standout(self):
        snip = {"title": "Chứng khoán TV AzFin Việt Nam", "description": AZFIN_DESC}
        with patch("outreach.standout_source.fetch_channel", return_value=snip) as fc:
            rec = enrich([{"email": "a@x.vn", "source_url": AZFIN_URL, "name": ""}])[0]
        fc.assert_called_once_with("id", "UCnH3mGTw4w7rjOYIfGAVV7Q")
        self.assertEqual(rec["flag"], "")
        self.assertIn("về phân tích và nhận định cổ phiếu trên YouTube", rec["Content for mail"])
        self.assertTrue(rec["Content for mail"].startswith("Kính gửi Chứng khoán TV AzFin Việt Nam,"))
        self.assertEqual(rec["Subject for mail"], "Chứng khoán TV AzFin Việt Nam | TMGM mời hợp tác.")

    def test_name_column_beats_channel_title(self):
        snip = {"title": "Chứng khoán TV AzFin Việt Nam", "description": AZFIN_DESC}
        with patch("outreach.standout_source.fetch_channel", return_value=snip):
            rec = enrich([{"email": "a@x.vn", "source_url": AZFIN_URL, "name": "AzFin"}])[0]
        self.assertTrue(rec["Content for mail"].startswith("Kính gửi AzFin,"))
        self.assertIn("những nội dung của AzFin về", rec["Content for mail"])

    def test_non_channel_url_is_generic_and_skips_api(self):
        with patch("outreach.standout_source.fetch_channel") as fc:
            rec = enrich([{"email": "a@x.vn", "source_url": "https://facebook.com/x", "name": "Kênh A"}])[0]
        fc.assert_not_called()
        self.assertEqual(rec["standout"], "(none)")
        self.assertTrue(rec["flag"])
        self.assertNotIn("ấn tượng", rec["Content for mail"])

    def test_empty_channel_text_is_flagged_and_dropped(self):
        with patch("outreach.standout_source.fetch_channel", return_value={}):
            rec = enrich([{"email": "a@x.vn", "source_url": AZFIN_URL, "name": "Kênh B"}])[0]
        self.assertEqual(rec["standout"], "(none)")
        self.assertTrue(rec["flag"])
        self.assertNotIn("ấn tượng", rec["Content for mail"])

    def test_channel_text_without_topic_is_dropped(self):
        with patch("outreach.standout_source.fetch_channel",
                   return_value={"title": "Gameshow", "description": "giải trí"}):
            rec = enrich([{"email": "a@x.vn", "source_url": AZFIN_URL, "name": "Kênh C"}])[0]
        self.assertIn("no topic", rec["flag"])
        self.assertNotIn("ấn tượng", rec["Content for mail"])


class SheetRoundTripTests(unittest.TestCase):
    def test_read_rows_skips_blank_email_and_needs_columns(self):
        with tempfile.TemporaryDirectory() as d:
            p = _xlsx(Path(d) / "in.xlsx", ["email", "contact", "source_url"],
                      [["a@x.vn", "About", AZFIN_URL], [None, None, None], ["b@x.vn", "About", ""]])
            rows = _read_rows(p)
            self.assertEqual([r["email"] for r in rows], ["a@x.vn", "b@x.vn"])
            self.assertEqual(rows[0]["name"], "")

            bad = _xlsx(Path(d) / "bad.xlsx", ["email", "nội dung email"], [["a@x.vn", "hi"]])
            with self.assertRaises(ValueError):
                _read_rows(bad)

    def test_enriched_sheet_feeds_createmail(self):
        # output of standout_source must be readable by outreach.createmail unchanged
        snip = {"title": "AzFin", "description": AZFIN_DESC}
        with patch("outreach.standout_source.fetch_channel", return_value=snip):
            recs = enrich([{"email": "a@x.vn", "source_url": AZFIN_URL, "name": ""}])
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "out.xlsx"
            _write_xlsx(recs, out)
            drafts = records_from_xlsx(out, bcc="j.tran@tmgm.com")
        self.assertEqual(len(drafts), 1)
        self.assertEqual(drafts[0]["to"], "a@x.vn")
        self.assertEqual(drafts[0]["subject"], recs[0]["Subject for mail"])
        self.assertEqual(drafts[0]["body"], recs[0]["Content for mail"])
        self.assertEqual(drafts[0]["source_url"], AZFIN_URL)


def _shortlist_row(**kw) -> dict:
    r = {"platform": "youtube", "display_name": "Kênh", "handle": "@kenh", "follower_count": 0,
         "bio_text": "", "creator_relevance": 1, "brand_safety": 1, "engagement_rate": 1,
         "composite_score": 1, "email_norm": "a@x.vn", "phone_norm": None, "contacts": None,
         "source_url": AZFIN_URL}
    r.update(kw)
    return r


class ShortlistToDraftTests(unittest.TestCase):
    """The shortlist export is the everyday source of `Content for mail`."""

    def _content(self, r, standouts=None):
        from discovery import shortlist as sl
        return dict(zip(sl.COLS, sl._row_values(1, r, standouts)))["Content for mail"]

    def test_bio_topic_and_audience_reach_the_export(self):
        body = self._content(_shortlist_row(display_name="Tần Nguyễn Channel", follower_count=299000,
                                            bio_text="phân tích thị trường vĩ mô sớm nhất. chứng khoán"))
        self.assertIn("Em đặc biệt ấn tượng với những nội dung của Tần Nguyễn Channel về kinh tế vĩ mô "
                      "và thị trường tài chính trên YouTube, nơi có hơn 299K người theo dõi.\n", body)

    def test_no_topic_drops_the_sentence_in_the_export(self):
        body = self._content(_shortlist_row(display_name="CỬA SỔ VÀNG", bio_text="nuôi dạy con"))
        self.assertNotIn("ấn tượng", body)
        self.assertNotIn("forex và đầu tư tài chính", body)
        self.assertIn("toàn cầu.\n\nTMGM Úc hiện đang ưu tiên", body)

    def test_standouts_map_beats_bio(self):
        body = self._content(_shortlist_row(handle="@tta", bio_text="forex"),
                             {"tta": "những chia sẻ thực chiến về quản lý vốn"})
        self.assertIn("ấn tượng với những chia sẻ thực chiến về quản lý vốn.", body)
        self.assertNotIn("thị trường vàng", body)

    def test_export_to_eml_end_to_end(self):
        from email import policy
        from email import message_from_bytes

        from discovery import shortlist as sl
        from outreach.eml import write_eml_files

        rows = [_shortlist_row(display_name="TTA TRADING", email_norm="a@x.vn", bio_text="forex, vàng"),
                _shortlist_row(display_name="Running Man", email_norm="b@x.vn", bio_text="gameshow")]
        with tempfile.TemporaryDirectory() as d:
            xlsx = Path(d) / "shortlist.xlsx"
            sl._write_xlsx(rows, xlsx)
            drafts = records_from_xlsx(xlsx, bcc="j.tran@tmgm.com")
            msgs = [message_from_bytes(p.read_bytes(), policy=policy.default)
                    for p in write_eml_files(drafts, Path(d) / "eml")]
        plain = [m.get_body(("plain",)).get_content() for m in msgs]
        html = [m.get_body(("html",)).get_content() for m in msgs]
        self.assertEqual([m["To"] for m in msgs], ["a@x.vn", "b@x.vn"])
        self.assertIn("ấn tượng với những nội dung của TTA TRADING về phân tích forex", plain[0])
        self.assertIn("ấn tượng", html[0])
        self.assertNotIn("ấn tượng", plain[1])
        self.assertNotIn("ấn tượng", html[1])
        self.assertTrue(all(m["X-Unsent"] == "1" for m in msgs))


if __name__ == "__main__":
    unittest.main()
