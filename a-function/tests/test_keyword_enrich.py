import unittest
from unittest.mock import patch

from discovery.keyword_enrich import (
    enrich_keywords,
    expand_seeds,
    resolve_lang,
    score_keyword,
    write_tier_files,
)


class ResolveLangTests(unittest.TestCase):
    def test_known_lang(self):
        hl, chars, sep = resolve_lang("th")
        self.assertEqual(hl, "th")
        self.assertEqual(sep, "")  # Thai doesn't space words
        self.assertIn("ก", chars)

    def test_latin_langs_space_join(self):
        _, _, sep = resolve_lang("vi")
        self.assertEqual(sep, " ")

    def test_explicit_hl_overrides(self):
        hl, _, _ = resolve_lang("vi", hl="en")
        self.assertEqual(hl, "en")

    def test_unknown_lang_falls_back_to_latin(self):
        hl, chars, sep = resolve_lang("xx")
        self.assertEqual((hl, sep), ("xx", " "))
        self.assertIn("a", chars)


class ExpandSeedsTests(unittest.TestCase):
    def test_collects_from_both_engines_at_depth_0(self):
        responses = [["trading forex", "trading 212"], ["trading forex", "trading view"]]
        with patch("discovery.keyword_enrich.fetch_suggest", side_effect=responses):
            found = expand_seeds(["trading"])
        self.assertEqual(found["trading forex"]["sources"], {"google:trading", "youtube:trading"})
        self.assertEqual(found["trading 212"]["sources"], {"google:trading"})
        self.assertTrue(all(e["depth"] == 0 for e in found.values()))

    def test_alphabet_expand_adds_depth_1(self):
        def side_effect(query, ds=None, hl="vi", timeout=10):
            if query == "trading":
                return ["trading forex"]
            if query == "trading a":
                return ["trading academy"]
            return []

        with patch("discovery.keyword_enrich.fetch_suggest", side_effect=side_effect):
            found = expand_seeds(["trading"], alphabet_expand=True)
        self.assertEqual(found["trading forex"]["depth"], 0)
        self.assertEqual(found["trading academy"]["depth"], 1)

    def test_cjk_lang_appends_without_space(self):
        seen = []

        def side_effect(query, ds=None, hl="vi", timeout=10):
            seen.append(query)
            return []

        with patch("discovery.keyword_enrich.fetch_suggest", side_effect=side_effect):
            expand_seeds(["交易"], lang="zh", alphabet_expand=True)
        self.assertIn("交易a", seen)  # no space between seed and sweep char
        self.assertNotIn("交易 a", seen)


class ScoreKeywordTests(unittest.TestCase):
    def test_seed_term_scores_high_level(self):
        row = score_keyword("trading forex", {"google:trading", "youtube:trading"}, 0, 2)
        self.assertEqual(row["tier"], "core")
        self.assertEqual(row["level"], "high")
        self.assertGreaterEqual(row["score"], 40)

    def test_unrelated_term_scores_low(self):
        row = score_keyword("kế toán doanh nghiệp", {"google:trading a"}, 1, 10)
        self.assertLess(row["score"], 15)
        self.assertEqual(row["level"], "low")

    def test_reports_word_count(self):
        self.assertEqual(score_keyword("forex", {"g:x"}, 0, 1)["word_count"], 1)
        self.assertEqual(score_keyword("forex trading úc", {"g:x"}, 0, 1)["word_count"], 3)

    def test_score_is_bounded(self):
        row = score_keyword("forex trading broker cfd affiliate", {"google:x", "youtube:x"}, 0, 2)
        self.assertLessEqual(row["score"], 100)
        self.assertGreaterEqual(row["score"], 0)


class EnrichKeywordsFilterTests(unittest.TestCase):
    def test_level_filter_keeps_only_band(self):
        # "forex trading gold" hits the lexicon hard -> high; "kế toán" has no
        # anchor and is single-source -> lands in a lower band. --level high must
        # keep only the former.
        responses = [["forex trading gold", "kế toán"], []]
        with patch("discovery.keyword_enrich.fetch_suggest", side_effect=responses):
            rows = enrich_keywords(["trading"], levels=["high"])
        self.assertEqual([r["term"] for r in rows], ["forex trading gold"])
        self.assertTrue(all(r["level"] == "high" for r in rows))

    def test_max_words_filter(self):
        responses = [["forex", "forex trading gold broker"], []]
        with patch("discovery.keyword_enrich.fetch_suggest", side_effect=responses):
            rows = enrich_keywords(["trading"], max_words=2)
        self.assertTrue(all(r["word_count"] <= 2 for r in rows))

    def test_min_words_filter(self):
        responses = [["forex", "forex trading gold"], []]
        with patch("discovery.keyword_enrich.fetch_suggest", side_effect=responses):
            rows = enrich_keywords(["trading"], min_words=2)
        self.assertTrue(all(r["word_count"] >= 2 for r in rows))

    def test_prefer_short_breaks_ties_by_length(self):
        # both contain "forex" only -> equal anchor/source/depth -> equal score;
        # tie-break must put the shorter term first.
        responses = [["forex", "forex market analysis daily"], []]
        with patch("discovery.keyword_enrich.fetch_suggest", side_effect=responses):
            rows = enrich_keywords(["trading"], prefer="short")
        self.assertEqual(rows[0]["term"], "forex")

    def test_prefer_long_flips_tie(self):
        responses = [["forex", "forex market analysis daily"], []]
        with patch("discovery.keyword_enrich.fetch_suggest", side_effect=responses):
            rows = enrich_keywords(["trading"], prefer="long")
        self.assertEqual(rows[0]["term"], "forex market analysis daily")

    def test_top_limits(self):
        responses = [["forex trading", "kế toán"], []]
        with patch("discovery.keyword_enrich.fetch_suggest", side_effect=responses):
            rows = enrich_keywords(["trading"], top=1)
        self.assertEqual(len(rows), 1)


class WriteTierFilesTests(unittest.TestCase):
    def test_writes_one_file_per_nonempty_tier(self):
        import tempfile
        from pathlib import Path

        rows = [
            {"term": "trading forex", "tier": "core"},
            {"term": "chứng khoán", "tier": "adjacent"},
            {"term": "kế toán", "tier": "drop"},
        ]
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            paths = write_tier_files(rows, out_dir, "kw")
            self.assertEqual(set(paths), {"core", "adjacent"})
            self.assertIn("trading forex", paths["core"].read_text(encoding="utf-8"))
            self.assertIn("chứng khoán", paths["adjacent"].read_text(encoding="utf-8"))
            self.assertFalse((out_dir / "kw_drop.txt").exists())


if __name__ == "__main__":
    unittest.main()
