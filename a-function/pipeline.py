"""CLI entrypoint: scrape social profiles via Apify actors.

Usage:
    python pipeline.py --platform linkedin
    python pipeline.py --platform instagram --usernames nasa natgeo
    python pipeline.py --platform all
"""

import argparse
from pathlib import Path

from apify_config import get_client
from platforms import ACTOR_PLATFORMS, PLATFORMS
from runner import run_actor_live
from storage import OUTPUT_DIR, save_items


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape social profiles via Apify")
    parser.add_argument("--platform", choices=[*ACTOR_PLATFORMS, "all"], default="linkedin")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--poll-seconds", type=float, default=5.0)
    parser.add_argument("--usernames", nargs="+", help="Instagram usernames to scrape")
    parser.add_argument("--urls", nargs="+", help="Specific profile/page URLs to scrape (instagram)")
    parser.add_argument("--search-query", help="Override the search term (linkedin/twitter/facebook/tiktok/douyin)")
    parser.add_argument("--no-db", action="store_true", help="Skip loading results into Postgres (JSON file only)")
    args = parser.parse_args()

    client = get_client()
    overrides = {
        "usernames": args.usernames,
        "urls": args.urls,
        "search_query": args.search_query,
    }

    names = list(ACTOR_PLATFORMS) if args.platform == "all" else [args.platform]
    for name in names:
        module = PLATFORMS[name]
        run_input = module.build_input(overrides)
        items = run_actor_live(client, name, module.ACTOR_ID, run_input, args.poll_seconds)
        out_path = save_items(name, items, args.output_dir)
        print(f"[{name}] saved -> {out_path}")

        if not args.no_db:
            try:
                from db.connection import get_conn
                from db.loader import load_platform_results

                conn = get_conn()
                try:
                    loaded = load_platform_results(conn, name, items)
                finally:
                    conn.close()
                print(f"[{name}] loaded {loaded} into Postgres")
            except Exception as exc:  # noqa: BLE001 - DB is optional, never break the JSON-only flow
                print(f"[{name}] Postgres load skipped: {exc}")


if __name__ == "__main__":
    main()
