"""Loads Apify scrape results into staging_<platform> and upserts them into entities.

This is the "join if same user" step's data-entry point: staging keeps the raw
JSON forever (audit trail), entities holds one deduped row per (platform,
platform_id), and db/02_resolve.sql later links entities across platforms that
look like the same person (see db/01_schema.sql for the full model). Every load
also re-scores the touched entities (db/run_scoring.py) so entity_scores --
composite_score, fake_audience_signal, etc. -- never goes stale.
"""

import logging

from psycopg import Connection, sql
from psycopg.types.json import Jsonb

from discovery.common.contacts import extract_contacts
from platforms import PLATFORMS

LOG = logging.getLogger(__name__)

# Contact channels worth keeping in the entities.contacts JSONB (email/phone/
# wechat live in their own indexed columns, so they're not duplicated here).
_EXTRA_CONTACT_KEYS = ("facebook", "zalo", "telegram", "instagram", "x", "qq")

UPSERT_ENTITY = """
    INSERT INTO entities (
        platform, platform_id, handle, display_name, bio_text,
        website_url, avatar_url, follower_count, email_norm, phone_norm, wechat_norm,
        contacts, source_url
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (platform, platform_id) DO UPDATE SET
        handle = EXCLUDED.handle,
        display_name = EXCLUDED.display_name,
        bio_text = EXCLUDED.bio_text,
        website_url = COALESCE(EXCLUDED.website_url, entities.website_url),
        avatar_url = EXCLUDED.avatar_url,
        follower_count = EXCLUDED.follower_count,
        -- don't blank an existing contact with a NULL from a source that lacks one
        email_norm = COALESCE(EXCLUDED.email_norm, entities.email_norm),
        phone_norm = COALESCE(EXCLUDED.phone_norm, entities.phone_norm),
        wechat_norm = COALESCE(EXCLUDED.wechat_norm, entities.wechat_norm),
        -- merge key-by-key so a manually-added zalo/telegram survives a re-scrape
        -- that only found e.g. facebook (a plain COALESCE would replace the whole blob)
        contacts = COALESCE(entities.contacts, '{}'::jsonb) || COALESCE(EXCLUDED.contacts, '{}'::jsonb),
        source_url = EXCLUDED.source_url,
        last_seen_at = now()
    RETURNING entity_id, (xmax = 0) AS inserted
"""


def contacts_from_entity(entity: dict) -> tuple:
    """Safety net: whatever a platform's to_entity() didn't fill, recover from
    the bio text with the shared contact parser, and collect the extra channels
    (facebook/zalo/telegram/…) into a plain dict. Returns
    (email_norm, phone_norm, wechat_norm, extras_dict_or_None) with the mapper's
    own values kept when present. Callers wrap extras in Jsonb before writing."""
    parsed = extract_contacts(entity.get("bio_text")) if entity.get("bio_text") else {}
    email = entity.get("email_norm") or (parsed.get("email", "").lower() or None)
    phone = entity.get("phone_norm") or parsed.get("phone") or parsed.get("zalo") or None
    wechat = entity.get("wechat_norm") or parsed.get("wechat") or None
    extras = {k: parsed[k] for k in _EXTRA_CONTACT_KEYS if parsed.get(k)}
    return email, phone, wechat, (extras or None)

INSERT_FOLLOWER_SNAPSHOT = """
    INSERT INTO entity_follower_history (entity_id, follower_count) VALUES (%s, %s)
"""


def load_platform_results(conn: Connection, platform: str, items: list[dict], run_id: str | None = None,
                          resolve_after: bool = True, score_after: bool = True) -> int:
    if platform not in PLATFORMS:
        raise ValueError(f"Unknown platform {platform!r}; must be one of {sorted(PLATFORMS)}")

    module = PLATFORMS[platform]
    if not hasattr(module, "to_entity"):
        raise ValueError(f"platforms.{platform} has no to_entity() mapping yet")

    staging_table = sql.Identifier(f"staging_{platform}")
    # staging tables aren't uniform (see db/01_schema.sql): most carry run_id,
    # staging_youtube carries quota_units instead, staging_telegram carries neither.
    extra_column = {"youtube": "quota_units", "telegram": None}.get(platform, "run_id")
    columns = "platform_id, raw, source_url" + (f", {extra_column}" if extra_column else "")
    placeholders = "%s, %s, %s" + (", %s" if extra_column else "")
    insert_staging = sql.SQL(
        "INSERT INTO {} (" + columns + ") VALUES (" + placeholders + ")"
    ).format(staging_table)

    loaded = 0
    new = 0
    failed = 0
    touched_ids: list[int] = []
    # One outer transaction for the batch, but each item in its own savepoint so a
    # single malformed item (e.g. a field the mapper didn't expect) is skipped
    # instead of aborting the whole load -- a real Facebook run once lost all 40
    # rows because one item's `info` came back as a list. See db/01_schema.sql.
    with conn.cursor() as cur, conn.transaction():
        for item in items:
            try:
                with conn.transaction():  # per-item savepoint
                    entity = module.to_entity(item)
                    platform_id = entity.get("platform_id")
                    if not platform_id:
                        continue  # can't identify this row without a stable platform id

                    staging_row = [platform_id, Jsonb(item), entity.get("source_url")]
                    if extra_column == "quota_units":
                        staging_row.append(item.get("quota_units"))
                    elif extra_column == "run_id":
                        staging_row.append(run_id)
                    cur.execute(insert_staging, staging_row)
                    email_norm, phone_norm, wechat_norm, extras = contacts_from_entity(entity)
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
                            email_norm,
                            phone_norm,
                            wechat_norm,
                            Jsonb(extras) if extras else None,
                            entity.get("source_url"),
                        ),
                    )
                    entity_id, inserted = cur.fetchone()
                    if inserted:
                        new += 1
                    touched_ids.append(entity_id)

                    follower_count = entity.get("follower_count")
                    if follower_count is not None:
                        cur.execute(INSERT_FOLLOWER_SNAPSHOT, (entity_id, follower_count))

                    loaded += 1
            except Exception as exc:  # noqa: BLE001 - one bad item must not sink the batch
                failed += 1
                LOG.warning("%s ingest: skipped a bad item (%s): %r", platform, type(exc).__name__, exc)

    LOG.info("%s ingest: %d new, %d already known, %d skipped (of %d rows)",
             platform, new, loaded - new, failed, len(items))

    # Cross-platform dedup: link the just-loaded rows to any existing same-person
    # entity on another network (matching phone/email/website/handle/bio), so new
    # data never lands as an unrelated duplicate of a lead we already have. Runs
    # for every platform because they all funnel through this loader. A resolve
    # failure must never fail the load, so it is guarded.
    if resolve_after and loaded:
        try:
            from db.resolve import resolve_entities

            result = resolve_entities(conn)
            if result["links_added"]:
                LOG.info("%s ingest: linked %d new cross-platform match(es)", platform, result["links_added"])
        except Exception as exc:  # noqa: BLE001 - dedup linking is best-effort
            LOG.warning("%s ingest: cross-platform resolve skipped (%s): %r", platform, type(exc).__name__, exc)

    # Keep entity_scores current as data comes in, instead of requiring a manual
    # `python db/run_scoring.py` pass before every shortlist/export. Scores only
    # the rows this call touched, not the whole table -- cheap, and a scoring
    # failure must never fail the load (same guard as resolve above).
    if score_after and touched_ids:
        try:
            from db.run_scoring import score_entities

            score_entities(conn, touched_ids)
        except Exception as exc:  # noqa: BLE001 - scoring is best-effort
            LOG.warning("%s ingest: scoring skipped (%s): %r", platform, type(exc).__name__, exc)

    return loaded
