import json
import unittest
from pathlib import Path

from discovery import douyin


class LoadRunInputTests(unittest.TestCase):
    def test_reads_preset_file_and_keeps_its_knobs(self):
        run_input = douyin.load_run_input(douyin.DEFAULT_PRESET, None, None)
        self.assertIn("黄金分析", run_input["keywords"])
        # preset knobs (not just keywords) survive, unlike routing through build_input
        self.assertEqual(run_input["sort"], "general")
        self.assertFalse(run_input["shouldDownloadVideos"])

    def test_keywords_override_wins_over_preset(self):
        run_input = douyin.load_run_input(douyin.DEFAULT_PRESET, ["现货黄金"], None)
        self.assertEqual(run_input["keywords"], ["现货黄金"])

    def test_max_results_override(self):
        run_input = douyin.load_run_input(douyin.DEFAULT_PRESET, None, 10)
        self.assertEqual(run_input["maxResultsPerQuery"], 10)

    def test_missing_preset_falls_back_to_default_input(self):
        run_input = douyin.load_run_input(Path("does_not_exist.json"), None, None)
        self.assertEqual(run_input["keywords"], douyin.load_run_input(None, None, None)["keywords"])
        self.assertIn("keywords", run_input)

    def test_default_preset_is_valid_json_with_keywords(self):
        data = json.loads(douyin.DEFAULT_PRESET.read_text(encoding="utf-8"))
        self.assertTrue(data["keywords"])


if __name__ == "__main__":
    unittest.main()
