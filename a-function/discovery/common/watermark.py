"""Shared discovery watermark and entity upsert helpers."""

from datetime import timedelta
from typing import Any

from psycopg import Connection


_DEFAULT_REFRESH = timedelta(days=1)


def claim_entity(
    conn: Connection,
    *,
    platform: str,
    platform_id: str,
    entity: dict[str, Any],
    refresh_after: timedelta = _DEFAULT_REFRESH,
) -> tuple[int | None, bool]:
    """Return ``(entity_id, processed)`` and skip a fresh discovery watermark."""
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
            return existing[0], False

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
            RETURNING entity_id
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
        entity_id = cur.fetchone()[0]
    conn.commit()
    return entity_id, True
