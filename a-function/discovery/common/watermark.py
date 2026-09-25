"""Shared discovery watermark and entity upsert helpers."""

from collections import Counter
from collections.abc import Iterable
from datetime import timedelta
from typing import Any

from psycopg import Connection


_DEFAULT_REFRESH = timedelta(days=1)

# Discovery-search freshness window: a channel/profile re-encountered by a keyword
# search within this window is left un-refetched (its data is still recent), so a
# re-run only spends API/time on genuinely new or stale entities. Longer than the
# crawl's 1-day claim window because descriptions/follower counts move slowly.
DEFAULT_DISCOVERY_REFRESH = timedelta(days=30)


def fresh_platform_ids(conn, platform: str, refresh_after: timedelta = DEFAULT_DISCOVERY_REFRESH) -> set[str]:
    """platform_ids already in `entities` for this platform that were last seen
    within `refresh_after` -> safe for a discovery run to skip re-fetching.

    Uses last_seen_at (stamped on every load), so an entity re-touched by any run
    stays "fresh". Ids outside the window (or absent) are worth re-fetching."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT platform_id FROM entities WHERE platform = %s AND last_seen_at >= now() - %s",
            (platform, refresh_after),
        )
        return {row[0] for row in cur.fetchall()}

# claim_entity outcomes, tallied per run for the weekly-refresh cost report
# (E6 watermark feedback loop #1). "skipped" is the one that saves money —
# a known entity still inside its refresh window is left untouched.
NEW = "new"              # first time we've seen this (platform, platform_id)
REFRESHED = "refreshed"  # known but stale / never enriched -> re-processed
SKIPPED = "skipped"      # known and still fresh -> watermark hit, no work done


def claim_entity(
    conn: Connection,
    *,
    platform: str,
    platform_id: str,
    entity: dict[str, Any],
    refresh_after: timedelta = _DEFAULT_REFRESH,
) -> tuple[int | None, str]:
    """Upsert an entity unless its watermark is still fresh.

    Returns ``(entity_id, outcome)`` where ``outcome`` is one of NEW, REFRESHED
    or SKIPPED. A SKIPPED entity keeps its ``entity_id`` but is left untouched,
    so a weekly refresh spends nothing re-processing it.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT entity_id
            FROM entities
            WHERE platform = %s
              AND platform_id = %s
              AND last_enriched IS NOT NULL
              AND last_enriched >= now() - %s
            """,
            (platform, platform_id, refresh_after),
        )
        existing = cur.fetchone()
        if existing:
            return existing[0], SKIPPED

        cur.execute(
            """
            INSERT INTO entities (
                platform, platform_id, handle, display_name, bio_text,
                website_url, follower_count, phone_norm, email_norm,
                source_url, last_enriched
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (platform, platform_id) DO UPDATE SET
                handle = EXCLUDED.handle,
                display_name = EXCLUDED.display_name,
                bio_text = EXCLUDED.bio_text,
                -- don't blank a manually-entered contact with a NULL from a re-scrape
                website_url = COALESCE(EXCLUDED.website_url, entities.website_url),
                follower_count = EXCLUDED.follower_count,
                phone_norm = COALESCE(EXCLUDED.phone_norm, entities.phone_norm),
                email_norm = COALESCE(EXCLUDED.email_norm, entities.email_norm),
                source_url = EXCLUDED.source_url,
                last_enriched = now(),
                last_seen_at = now()
            RETURNING entity_id, (xmax = 0) AS inserted
            """,
            (
                platform,
                platform_id,
                entity.get("handle"),
                entity.get("display_name"),
                entity.get("bio_text"),
                entity.get("website_url"),
                entity.get("follower_count"),
                entity.get("phone_norm"),
                entity.get("email_norm"),
                entity.get("source_url"),
            ),
        )
        entity_id, inserted = cur.fetchone()
    conn.commit()
    return entity_id, (NEW if inserted else REFRESHED)


def summarize(outcomes: Iterable[str]) -> dict[str, int]:
    """Count claim_entity outcomes for the per-run 'new vs skipped' log line."""
    counts = Counter(outcomes)
    return {NEW: counts[NEW], REFRESHED: counts[REFRESHED], SKIPPED: counts[SKIPPED]}


# --- Query-level watermark (db/11_discovery_watermark.sql) -------------------
# The refresh rule -- what a re-run skips so it doesn't pay for data we have:
#   1. A (platform, query) that ran within QUERY_REFRESH is skipped. 6 days, so a
#      weekly schedule still re-runs it.
#   2. A query whose last run returned entities but none of them new is
#      saturated: skipped for SATURATED_REFRESH. This is what stops a weekly
#      refresh re-buying the same profiles every week.
#   3. Whatever does run, a known entity is never duplicated (entities UNIQUE
#      (platform, platform_id)) and keeps its stage, so the gate, enrichment and
#      LLM steps don't process it again (discovery.gate); Data-API channels also
#      skip re-fetching ids seen recently (fresh_platform_ids above).
# A run that returned nothing at all (blocked, actor limit) is not recorded, so
# it is retried next time instead of being marked saturated.
QUERY_REFRESH = timedelta(days=6)
SATURATED_REFRESH = timedelta(days=28)

# run_input key that carries the search terms, per actor platform (str or list).
QUERY_KEYS = {
    "tiktok": "searchQueries",
    "douyin": "keywords",
    "facebook": "categories",
    "facebook_post": "query",
    "twitter": "searchTerms",
    "linkedin": "searchQuery",
}


def run_queries(platform: str, run_input: dict) -> list[str]:
    value = run_input.get(QUERY_KEYS.get(platform, ""))
    return [value] if isinstance(value, str) else list(value or [])


def with_queries(platform: str, run_input: dict, queries: list[str]) -> dict:
    key = QUERY_KEYS[platform]
    return {**run_input, key: queries[0] if isinstance(run_input[key], str) else list(queries)}


def query_is_fresh(age: timedelta, last_returned: int, last_new: int) -> bool:
    """Rule 1 or 2 above: True means skip this query on this run."""
    saturated = last_returned > 0 and last_new == 0
    return age < QUERY_REFRESH or (saturated and age < SATURATED_REFRESH)


def split_queries(conn, platform: str, queries: list[str]) -> tuple[list[str], list[str]]:
    """(to_run, skipped) for this platform's queries, by the watermark rule."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT query, now() - last_run_at, last_returned, last_new FROM discovery_watermark "
            "WHERE platform = %s AND query = ANY(%s)",
            (platform, list(queries)),
        )
        fresh = {q for q, age, returned, new in cur.fetchall() if query_is_fresh(age, returned, new)}
    return [q for q in queries if q not in fresh], [q for q in queries if q in fresh]


def attribute_ids(module, queries: list[str], items: list[dict]) -> dict[str, set[str]]:
    """platform_ids each query returned. Items that echo their query (TikTok:
    searchQuery/input) count for that query only; actors that don't (Douyin,
    Facebook posts, LinkedIn) give every query of the run the run-level set."""
    per_query = {q: set() for q in queries}
    unattributed = set()
    for item in items:
        try:
            platform_id = module.to_entity(item).get("platform_id")
        except Exception:  # noqa: BLE001 - error rows etc.; the loader skips them too
            continue
        if platform_id:
            query = item.get("searchQuery") or item.get("input")
            (per_query[query] if query in per_query else unattributed).add(str(platform_id))
    return {q: ids | unattributed for q, ids in per_query.items()}


def known_platform_ids(conn, platform: str, platform_ids: set[str]) -> set[str]:
    """Which of these ids are already in entities (call BEFORE loading the run)."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT platform_id FROM entities WHERE platform = %s AND platform_id = ANY(%s)",
            (platform, list(platform_ids)),
        )
        return {row[0] for row in cur.fetchall()}


def record_queries(conn, platform: str, per_query: dict[str, set[str]], known: set[str]) -> None:
    with conn.cursor() as cur:
        for query, ids in per_query.items():
            cur.execute(
                """
                INSERT INTO discovery_watermark (platform, query, last_returned, last_new)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (platform, query) DO UPDATE SET
                    last_run_at = now(),
                    runs = discovery_watermark.runs + 1,
                    last_returned = EXCLUDED.last_returned,
                    last_new = EXCLUDED.last_new
                """,
                (platform, query, len(ids), len(ids - known)),
            )
    conn.commit()
