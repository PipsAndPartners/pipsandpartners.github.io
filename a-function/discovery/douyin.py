"""Douyin gold-market discovery channel.

Ties the existing pieces into one command for the gold-analysis niche:

    actor (zen-studio/douyin-search-scraper, via platforms.douyin)
      -> staging_douyin + entities   (db.loader, stage='discovered')
      -> filter gate                 (discovery.gate, 500-5k follower window)

Discovery + the cheap gate only. Contact fields (email/phone/WeChat that the
creator themselves pasted into their signature) are parsed by
platforms.douyin.to_entity and land in entities; there is no contact harvesting
beyond what the bio already publishes. Turn the gated set into a ranked, contactable shortlist with:

    python -m discovery.shortlist --platforms douyin --market cn --min-followers 500

The default keyword preset targets gold analysts (inputs/douyin_gold_midtier.json);
override with --keywords or --preset. The follower window defaults to 500-5000 to
hit the mid-tier band the shortlist wants (E6 6.2: gate before any paid enrichment).
"""

import argparse
import json
import sys
from pathlib import Path

from discovery import gate
from platforms import douyin as douyin_platform
from runner import run_actor_live
from storage import OUTPUT_DIR, save_items

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PRESET = ROOT / "inputs" / "douyin_gold_midtier.json"

# The band the gold-market ask targets: mid-tier creators, not mega-accounts.
DEFAULT_MIN_FOLLOWERS = 500
DEFAULT_MAX_FOLLOWERS = 5000


def load_run_input(preset: Path | None, keywords: list[str] | None, max_results: int | None) -> dict:
    """Build the actor run_input from a preset file plus CLI overrides.

    A preset file is used as the base run_input directly (so its sort/publishTime/
    duration knobs are honored, exactly as the web console passes a preset), falling
    back to platforms.douyin.DEFAULT_INPUT when no preset is present. --keywords
    overrides the preset's keyword list; --max-results caps results per keyword.
    """
    if preset and preset.exists():
        run_input = json.loads(preset.read_text(encoding="utf-8"))
    else:
        run_input = dict(douyin_platform.DEFAULT_INPUT)
    if keywords:
        run_input["keywords"] = keywords
    if max_results is not None:
        run_input["maxResultsPerQuery"] = max_results
    return run_input


def run(
    run_input: dict,
    *,
    min_followers: int = DEFAULT_MIN_FOLLOWERS,
    max_followers: int | None = DEFAULT_MAX_FOLLOWERS,
    min_relevance: int = gate.DEFAULT_MIN_RELEVANCE,
    output_dir: Path = OUTPUT_DIR,
    no_db: bool = False,
    client=None,
) -> dict:
    """Run the actor, save raw JSON, then (unless --no-db) stage + gate to 500-5k."""
    if client is None:
        from apify_config import get_client

        client = get_client()
    items = run_actor_live(client, "douyin", douyin_platform.ACTOR_ID, run_input)
    out_path = save_items("douyin", items, output_dir)

    result = {
        "actor": douyin_platform.ACTOR_ID,
        "keywords": run_input.get("keywords"),
        "scraped": len(items),
        "output": str(out_path),
        "db_status": None,
        "gate": None,
    }
    if no_db:
        return result

    try:
        from db.connection import get_conn
        from db.loader import load_platform_results

        conn = get_conn()
        try:
            loaded = load_platform_results(conn, "douyin", items)
            gated = gate.filter_gate(
                conn,
                platform="douyin",
                min_relevance=min_relevance,
                min_followers=min_followers,
                max_followers=max_followers,
            )
        finally:
            conn.close()
        result["db_status"] = f"loaded {loaded} into staging_douyin/entities"
        result["gate"] = gated
    except Exception as exc:  # noqa: BLE001 - DB optional, raw JSON already saved
        result["db_status"] = f"staging/gate skipped: {exc}"
    return result


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Chinese keywords on a cp1252 console
    parser = argparse.ArgumentParser(
        description="Douyin gold-market discovery channel (actor -> staging/entities -> filter gate)"
    )
    parser.add_argument("--preset", type=Path, default=DEFAULT_PRESET,
                        help="Actor input JSON preset (default: gold analysts)")
    parser.add_argument("--keywords", nargs="+", help="Override the preset's keyword list")
    parser.add_argument("--max-results", type=int, default=None, help="maxResultsPerQuery per keyword")
    parser.add_argument("--min-followers", type=int, default=DEFAULT_MIN_FOLLOWERS)
    parser.add_argument("--max-followers", type=int, default=DEFAULT_MAX_FOLLOWERS)
    parser.add_argument("--min-relevance", type=int, default=gate.DEFAULT_MIN_RELEVANCE)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--no-db", action="store_true", help="Skip staging/entities load + gate (JSON only)")
    args = parser.parse_args()

    run_input = load_run_input(args.preset, args.keywords, args.max_results)
    result = run(
        run_input,
        min_followers=args.min_followers,
        max_followers=args.max_followers,
        min_relevance=args.min_relevance,
        output_dir=args.output_dir,
        no_db=args.no_db,
    )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
