"""Computes IB/creator scores for every entity in the DB and upserts entity_scores.

Usage:
    python db/run_scoring.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from psycopg import sql
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


def main() -> None:
    conn = get_conn()
    conn.row_factory = dict_row

    with conn.cursor() as cur:
        cur.execute("SELECT * FROM entities")
        entities = cur.fetchall()

    scored = 0
    with conn.cursor() as cur:
        for entity in entities:
            raw = _latest_raw(cur, entity["platform"], entity["platform_id"])
            history = _follower_history(cur, entity["entity_id"])
            posts = _post_engagement(cur, entity["platform"], entity["platform_id"])
            result = score_entity(entity, raw, history, posts)
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

    conn.commit()
    conn.close()
    print(f"Scored {scored} entities.")


if __name__ == "__main__":
    main()
