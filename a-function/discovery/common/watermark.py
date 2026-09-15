"""Shared discovery watermark and entity upsert helpers."""

from collections import Counter
from collections.abc import Iterable
from datetime import timedelta
from typing import Any

from psycopg import Connection


_DEFAULT_REFRESH = timedelta(days=1)

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
                website_url = EXCLUDED.website_url,
                follower_count = EXCLUDED.follower_count,
                phone_norm = EXCLUDED.phone_norm,
                email_norm = EXCLUDED.email_norm,
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
