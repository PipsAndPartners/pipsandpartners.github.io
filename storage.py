"""Persisting scraped profile data to local disk."""

import json
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent / "results"


def save_items(platform: str, items: list[dict], output_dir: Path = OUTPUT_DIR) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / f"{platform}_results.json"
    out_path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    return out_path
