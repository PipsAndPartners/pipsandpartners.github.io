"""CLI entrypoint: scrape social profiles via Apify actors.

Usage:
    python pipeline.py --platform linkedin
    python pipeline.py --platform instagram --usernames nasa natgeo
    python pipeline.py --platform all
    python pipeline.py --platform tiktok --from-gate --limit 50   # enrichment, after discovery.gate
"""

import argparse
import json
from pathlib import Path

from apify_config import get_client
from discovery.common import watermark
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
    parser.add_argument("--categories", nargs="+",
                        help="Facebook Pages search keywords (list); overrides --search-query for facebook")
    parser.add_argument("--location", action="append", dest="locations",
                        help="Facebook Pages location filter, e.g. Australia (repeatable)")
    parser.add_argument("--results-limit", type=int, default=None,
                        help="Facebook resultsLimit -- caps spend (~$0.012/page)")
    parser.add_argument("--preset", type=Path,
                        help="Actor input JSON used as-is instead of the platform default (e.g. inputs/tiktok_forex_vn.json)")
    parser.add_argument("--from-gate", action="store_true",
                        help="Enrichment pass: look up only the gate's filtered_in, not-yet-enriched handles "
                             "(instagram/tiktok/twitter); run `python -m discovery.gate ... gate` first")
    parser.add_argument("--limit", type=int, default=None, help="With --from-gate: max profiles to enrich (spend cap)")
    parser.add_argument("--force", action="store_true",
                        help="Ignore the query watermark: re-run searches that ran this week or found nothing new")
    parser.add_argument("--no-db", action="store_true", help="Skip loading results into Postgres (JSON file only)")
    args = parser.parse_args()
    if args.preset and args.platform == "all":
        parser.error("--preset is one actor's input; pick a single --platform")
    if args.from_gate and (args.platform not in ("instagram", "tiktok", "twitter") or args.preset or args.no_db):
        parser.error("--from-gate needs one of instagram/tiktok/twitter, a DB, and no --preset")

    client = get_client()
    overrides = {
        "usernames": args.usernames,
        "urls": args.urls,
        "search_query": args.search_query,
        "categories": args.categories,
        "locations": args.locations,
        "resultsLimit": args.results_limit,
    }

    gated = []
    if args.from_gate:
        from db.connection import get_conn
        from discovery import gate

        conn = get_conn()
        try:  # raises while any row of this platform is still ungated
            gated = [r for r in gate.select_for_enrichment(conn, platform=args.platform, limit=args.limit)
                     if r["handle"]]
        finally:
            conn.close()
        if not gated:
            print(f"[{args.platform}] nothing filtered_in left to enrich")
            return
        overrides["usernames"] = [r["handle"] for r in gated]

    names = list(ACTOR_PLATFORMS) if args.platform == "all" else [args.platform]
    for name in names:
        module = PLATFORMS[name]
        if args.preset:
            run_input = json.loads(args.preset.read_text(encoding="utf-8"))
        else:
            run_input = module.build_input(overrides)

        # Query watermark: don't pay the actor again for searches that ran this
        # week or stopped finding new entities (discovery/common/watermark.py).
        queries = watermark.run_queries(name, run_input)
        if queries and not args.no_db and not args.force:
            try:
                from db.connection import get_conn

                conn = get_conn()
                try:
                    queries, skipped = watermark.split_queries(conn, name, queries)
                finally:
                    conn.close()
                if skipped:
                    print(f"[{name}] watermark: skipping {len(skipped)} fresh/saturated quer(ies): {skipped}")
                if not queries:
                    print(f"[{name}] watermark: nothing new to buy, actor not run (--force to override)")
                    continue
                run_input = watermark.with_queries(name, run_input, queries)
            except Exception as exc:  # noqa: BLE001 - watermark is an optimisation; run everything
                print(f"[{name}] watermark check skipped: {exc}")

        items = run_actor_live(client, name, module.ACTOR_ID, run_input, args.poll_seconds)
        out_path = save_items(name, items, args.output_dir)
        print(f"[{name}] saved -> {out_path}")

        if not args.no_db:
            try:
                from db.connection import get_conn
                from db.loader import load_platform_results

                conn = get_conn()
                try:
                    per_query = watermark.attribute_ids(module, queries, items) if items else {}
                    known = watermark.known_platform_ids(conn, name, set().union(*per_query.values()))
                    loaded = load_platform_results(conn, name, items)
                    if per_query:  # an empty run (blocked / actor limit) is retried, not recorded
                        watermark.record_queries(conn, name, per_query, known)
                    if gated:  # `gate` imported in the --from-gate branch above
                        gate.mark_enriched(conn, [r["entity_id"] for r in gated])
                finally:
                    conn.close()
                print(f"[{name}] loaded {loaded} into Postgres")
            except Exception as exc:  # noqa: BLE001 - DB is optional, never break the JSON-only flow
                print(f"[{name}] Postgres load skipped: {exc}")


if __name__ == "__main__":
    main()
