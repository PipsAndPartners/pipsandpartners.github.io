"""Loads Apify scrape results into staging_<platform> and upserts them into entities.

This is the "join if same user" step's data-entry point: staging keeps the raw
JSON forever (audit trail), entities holds one deduped row per (platform,
platform_id), and db/02_resolve.sql later links entities across platforms that
look like the same person (see db/01_schema.sql for the full model).
"""

from psycopg import Connection, sql
from psycopg.types.json import Jsonb

from platforms import PLATFORMS

UPSERT_ENTITY = """
    INSERT INTO entities (
        platform, platform_id, handle, display_name, bio_text,
        website_url, avatar_url, follower_count, email_norm, source_url
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (platform, platform_id) DO UPDATE SET
        handle = EXCLUDED.handle,
        display_name = EXCLUDED.display_name,
        bio_text = EXCLUDED.bio_text,
        website_url = EXCLUDED.website_url,
        avatar_url = EXCLUDED.avatar_url,
        follower_count = EXCLUDED.follower_count,
        email_norm = EXCLUDED.email_norm,
        source_url = EXCLUDED.source_url,
        last_seen_at = now()
    RETURNING entity_id
"""

INSERT_FOLLOWER_SNAPSHOT = """
    INSERT INTO entity_follower_history (entity_id, follower_count) VALUES (%s, %s)
"""


def load_platform_results(conn: Connection, platform: str, items: list[dict], run_id: str | None = None) -> int:
    if platform not in PLATFORMS:
        raise ValueError(f"Unknown platform {platform!r}; must be one of {sorted(PLATFORMS)}")

    module = PLATFORMS[platform]
    if not hasattr(module, "to_entity"):
        raise ValueError(f"platforms.{platform} has no to_entity() mapping yet")

    staging_table = sql.Identifier(f"staging_{platform}")
    insert_staging = sql.SQL(
        "INSERT INTO {} (platform_id, raw, source_url, run_id) VALUES (%s, %s, %s, %s)"
    ).format(staging_table)

    loaded = 0
    with conn.cursor() as cur:
        for item in items:
            entity = module.to_entity(item)
            platform_id = entity.get("platform_id")
            if not platform_id:
                continue  # can't identify this row without a stable platform id

            cur.execute(insert_staging, (platform_id, Jsonb(item), entity.get("source_url"), run_id))
            cur.execute(
                UPSERT_ENTITY,
                (
                    platform,
                    platform_id,
                    entity.get("handle"),
                    entity.get("display_name"),
                    entity.get("bio_text"),
                    entity.get("website_url"),
                    entity.get("avatar_url"),
                    entity.get("follower_count"),
                    entity.get("email_norm"),
                    entity.get("source_url"),
                ),
            )
            entity_id = cur.fetchone()[0]

            follower_count = entity.get("follower_count")
            if follower_count is not None:
                cur.execute(INSERT_FOLLOWER_SNAPSHOT, (entity_id, follower_count))

            loaded += 1

    conn.commit()
    return loaded
