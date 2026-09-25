"""Computes IB/creator scores and upserts entity_scores.

Usage:
    python db/run_scoring.py                # every entity
    python db/run_scoring.py --entity-ids 1 2 3

score_entities() is also called automatically after every ingest
(db/loader.py:load_platform_results), so entity_scores stays current without
a separate manual step -- this CLI is for a full backfill/re-score.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from psycopg import Connection, sql
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from db.connection import get_conn
from platforms import PLATFORMS
from scoring import score_entity

UPSERT = """
    INSERT INTO entity_scores (
        entity_id, engagement_rate, audience_quality, audience_demographics,
        follower_growth, brand_safety, estimated_post_price_usd,
        fake_audience_signal, creator_relevance, composite_score,
        data_completeness, notes, scored_at
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
    ON CONFLICT (entity_id) DO UPDATE SET
        engagement_rate = EXCLUDED.engagement_rate,
        audience_quality = EXCLUDED.audience_quality,
        audience_demographics = EXCLUDED.audience_demographics,
        follower_growth = EXCLUDED.follower_growth,
        brand_safety = EXCLUDED.brand_safety,
        estimated_post_price_usd = EXCLUDED.estimated_post_price_usd,
        fake_audience_signal = EXCLUDED.fake_audience_signal,
        creator_relevance = EXCLUDED.creator_relevance,
        composite_score = EXCLUDED.composite_score,
        data_completeness = EXCLUDED.data_completeness,
        notes = EXCLUDED.notes,
        scored_at = now()
"""


def _latest_raw(cur, platform: str, platform_id: str) -> dict:
    if platform not in PLATFORMS:
        return {}
    table = sql.Identifier(f"staging_{platform}")
    cur.execute(
        sql.SQL("SELECT raw FROM {} WHERE platform_id = %s ORDER BY collected_at DESC LIMIT 1").format(table),
        (platform_id,),
    )
    row = cur.fetchone()
    return row["raw"] if row else {}


def _follower_history(cur, entity_id: int) -> list[dict]:
    cur.execute(
        "SELECT follower_count, captured_at FROM entity_follower_history WHERE entity_id = %s ORDER BY captured_at ASC",
        (entity_id,),
    )
    return cur.fetchall()


def _post_engagement(cur, platform: str, platform_id: str) -> list[dict]:
    module = PLATFORMS.get(platform)
    if not module or not hasattr(module, "extract_engagement"):
        return []
    table = sql.Identifier(f"staging_{platform}")
    cur.execute(sql.SQL("SELECT raw FROM {} WHERE platform_id = %s").format(table), (platform_id,))
    posts = []
    for row in cur.fetchall():
        engagement = module.extract_engagement(row["raw"])
        if engagement:
            posts.append(engagement)
    return posts


def _video_stats(cur, platform: str, platform_id: str) -> list[dict]:
    """Latest-known stats per video (see db/13_youtube_video_stats.sql), for
    scoring.score_fake_audience's per-video path. YouTube only for now."""
    if platform != "youtube":
        return []
    cur.execute(
        "SELECT DISTINCT ON (video_id) raw FROM staging_youtube_video "
        "WHERE channel_id = %s ORDER BY video_id, collected_at DESC",
        (platform_id,),
    )
    return [row["raw"] for row in cur.fetchall()]


def score_entities(conn: Connection, entity_ids: list[int] | None = None) -> int:
    """Score `entity_ids` (or every entity when None) and upsert entity_scores.
    Commits its own transaction; safe to call mid-ingest (db/loader.py) or as a
    standalone backfill (this module's CLI)."""
    with conn.cursor(row_factory=dict_row) as cur:
        if entity_ids:
            cur.execute("SELECT * FROM entities WHERE entity_id = ANY(%s)", (list(entity_ids),))
        else:
            cur.execute("SELECT * FROM entities")
        entities = cur.fetchall()

    scored = 0
    with conn.cursor(row_factory=dict_row) as cur:
        for entity in entities:
            raw = _latest_raw(cur, entity["platform"], entity["platform_id"])
            history = _follower_history(cur, entity["entity_id"])
            posts = _post_engagement(cur, entity["platform"], entity["platform_id"])
            videos = _video_stats(cur, entity["platform"], entity["platform_id"])
            result = score_entity(entity, raw, history, posts, videos)
            cur.execute(
                UPSERT,
                (
                    entity["entity_id"],
                    result["engagement_rate"],
                    result["audience_quality"],
                    Jsonb(result["audience_demographics"]) if result["audience_demographics"] is not None else None,
                    result["follower_growth"],
                    result["brand_safety"],
                    result["estimated_post_price_usd"],
                    result["fake_audience_signal"],
                    result["creator_relevance"],
                    result["composite_score"],
                    result["data_completeness"],
                    Jsonb(result["notes"]),
                ),
            )
            scored += 1
    conn.commit()  # explicit: a bare SELECT earlier on this connection (very likely --
                   # callers share `conn` with other steps) turns conn.transaction()'s
                   # would-be auto-commit into a no-op savepoint, so commit for real here.
    return scored


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--entity-ids", type=int, nargs="+", default=None, help="score only these entities")
    args = ap.parse_args()

    conn = get_conn()
    scored = score_entities(conn, args.entity_ids)
    conn.close()
    print(f"Scored {scored} entities.")


if __name__ == "__main__":
    main()
