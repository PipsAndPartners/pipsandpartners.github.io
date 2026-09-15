"""Cheapest discovery channel: find IB websites via Google SERP.

Uses the Apify Google Search Scraper actor (apify/google-search-scraper),
~$1.80 / 1000 pages at 100 results/page. This deliberately does NOT use Google's
Custom Search JSON API, which is closed to new customers and must be migrated off
before 2027-01-01.

Each organic result's URL/domain is written to staging_serp (one row per result,
raw JSON kept for audit — see db/01_schema.sql).
"""

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from psycopg.types.json import Jsonb

from apify_config import get_client

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

ACTOR_ID = "apify/google-search-scraper"

# Intent queries for finding forex Introducing Brokers / affiliates on the open web.
DEFAULT_QUERIES = [
    "forex introducing broker",
    "forex affiliate program",
    "IB forex đối tác hoa hồng",
    "giới thiệu sàn forex Việt Nam",
    "đối tác môi giới forex",
]

INSERT_SERP = "INSERT INTO staging_serp (query, raw, source_url, run_id) VALUES (%s, %s, %s, %s)"


def build_queries(keywords: list[str] | None = None, regions: list[str] | None = None) -> list[str]:
    """Return the query list. Defaults to IB-hunting queries; cross with regions if given."""
    base = list(keywords) if keywords else list(DEFAULT_QUERIES)
    if regions:
        return [f"{query} {region}" for query in base for region in regions]
    return base


def domain_of(url: str) -> str | None:
    host = (urlparse(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host or None


def _iter_rows(item: dict):
    """One Apify dataset item may hold many organicResults, or be a single row."""
    nested = item.get("organicResults") or item.get("organic_results")
    if isinstance(nested, list):
        yield from nested
    else:
        yield item


def parse_items(items: list[dict]) -> list[dict]:
    """Flatten actor dataset items into one staging-ready record per organic result."""
    rows = []
    for item in items:
        query = (item.get("searchQuery") or {}).get("term") or item.get("query")
        for row in _iter_rows(item):
            url = row.get("url") or row.get("link")
            if not url:
                continue
            rows.append({
                "query": query,
                "url": url,
                "domain": domain_of(url),
                "title": row.get("title"),
                "description": row.get("description") or row.get("snippet"),
                "raw": row,
            })
    return rows


def discover(queries: list[str], *, max_pages: int = 1, results_per_page: int = 100, client=None) -> dict:
    client = client or get_client()
    run = client.actor(ACTOR_ID).call(run_input={
        "queries": "\n".join(queries),
        "maxPagesPerQuery": max_pages,
        "resultsPerPage": results_per_page,
        "mobileResults": False,
    })
    items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
    rows = parse_items(items)
    return {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "queries": queries,
        "items": rows,
        "count": len(rows),
        "run_id": run.get("id"),
    }


def load_serp(conn, rows: list[dict], run_id: str | None = None) -> int:
    """Write each SERP result into staging_serp. Returns rows inserted."""
    with conn.cursor() as cur:
        for row in rows:
            cur.execute(INSERT_SERP, (row["query"], Jsonb(row["raw"]), row["url"], run_id))
    conn.commit()
    return len(rows)


def run(queries: list[str], *, max_pages: int, results_per_page: int, output: Path, no_db: bool) -> dict:
    result = discover(queries, max_pages=max_pages, results_per_page=results_per_page)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    result["db_status"] = None
    if not no_db:
        try:
            from db.connection import get_conn

            conn = get_conn()
            try:
                loaded = load_serp(conn, result["items"], run_id=result.get("run_id"))
            finally:
                conn.close()
            result["db_status"] = f"loaded {loaded} into staging_serp"
        except Exception as exc:  # noqa: BLE001 - DB optional, JSON already saved
            result["db_status"] = f"staging load skipped: {exc}"
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Google SERP discovery for IB websites")
    parser.add_argument("queries", nargs="*", help="Override the default query list")
    parser.add_argument("--region", action="append", dest="regions", help="Append a region to each query (repeatable)")
    parser.add_argument("--max-pages", type=int, default=1)
    parser.add_argument("--results-per-page", type=int, default=100)
    parser.add_argument("--output", type=Path, default=Path("results/serp_discovery.json"))
    parser.add_argument("--no-db", action="store_true", help="Skip staging_serp load (JSON only)")
    args = parser.parse_args()

    queries = build_queries(args.queries or None, args.regions)
    result = run(
        queries,
        max_pages=args.max_pages,
        results_per_page=args.results_per_page,
        output=args.output,
        no_db=args.no_db,
    )
    print(json.dumps({"queries": len(queries), "results": result["count"], "db": result["db_status"]}, ensure_ascii=False))
    print(f"saved -> {args.output}")


if __name__ == "__main__":
    main()
