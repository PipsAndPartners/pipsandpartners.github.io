"""Two-phase filter gate between cheap discovery and expensive enrichment (E6, story 6.2).

The whole point is cost: the per-profile enrichment scrapers (Apify profile/
contact actors) are what cost money, so they must never run over the raw
discovered set. This module is the gate the schema (db/01_schema.sql) was built
for -- it drives entities through their `stage` column:

    discovered  --filter_gate()-->  filtered_in / filtered_out
    filtered_in --select_for_enrichment()--> [rows to enrich] --mark_enriched()--> enriched

Discovery stays cheap: it only writes a platform_id + minimal identity at
stage='discovered' (see db/loader.py, which leaves stage at its default). The
gate then decides, using ONLY those already-collected fields (no network calls),
which rows are worth paying to enrich.

`select_for_enrichment` returns only filtered_in, not-yet-enriched rows, so a
caller structurally cannot mass-enrich the discovered set. `require_gate` makes
that guarantee explicit: it refuses to hand out enrichment work while any
ungated ('discovered') rows still exist for the target platform.
"""

from __future__ import annotations

import argparse
import json

from scoring import score_creator_relevance

# Cheap-filter defaults, tuned for the forex/IB niche. Relevance comes from the
# same keyword heuristic scoring uses; the follower floor drops obvious noise.
DEFAULT_MIN_RELEVANCE = 20
DEFAULT_MIN_FOLLOWERS = 1000

# Fixed column order for the tuple rows the gate reads (avoids needing dict_row).
_DISCOVERED_COLS = (
    "entity_id", "platform", "platform_id", "handle", "display_name",
    "bio_text", "follower_count",
)


def passes_filter(
    entity: dict,
    *,
    min_relevance: int = DEFAULT_MIN_RELEVANCE,
    min_followers: int = DEFAULT_MIN_FOLLOWERS,
    max_followers: int | None = None,
) -> bool:
    """Decide filtered_in (True) vs filtered_out (False) from discovery fields alone.

    Uses only what cheap discovery captured -- display_name / handle / bio_text
    for niche relevance, plus follower_count when present -- so running the gate
    itself costs nothing. A missing follower_count never fails the follower
    check: we don't yet know it, and finding it out is exactly enrichment's job.
    """
    text = " ".join(
        filter(None, (entity.get("display_name"), entity.get("bio_text"), entity.get("handle")))
    )
    if score_creator_relevance(text)["score"] < min_relevance:
        return False
    followers = entity.get("follower_count")
    if followers is not None:
        if followers < min_followers:
            return False
        if max_followers is not None and followers > max_followers:
            return False
    return True


def _platform_clause(platform: str | None) -> tuple[str, tuple]:
    return (" AND platform = %s", (platform,)) if platform else ("", ())


def filter_gate(
    conn,
    *,
    platform: str | None = None,
    min_relevance: int = DEFAULT_MIN_RELEVANCE,
    min_followers: int = DEFAULT_MIN_FOLLOWERS,
    max_followers: int | None = None,
) -> dict:
    """Promote every stage='discovered' entity to filtered_in / filtered_out.

    Only touches 'discovered' rows, so re-running after a fresh discovery pass
    gates just the new arrivals (filtered_out rows stay out). Returns counts.
    """
    clause, params = _platform_clause(platform)
    select = (
        "SELECT " + ", ".join(_DISCOVERED_COLS) + " FROM entities WHERE stage = 'discovered'" + clause
    )
    passed: list[int] = []
    failed: list[int] = []
    with conn.cursor() as cur:
        cur.execute(select, params)
        for row in cur.fetchall():
            entity = dict(zip(_DISCOVERED_COLS, row))
            target = passes_filter(
                entity,
                min_relevance=min_relevance,
                min_followers=min_followers,
                max_followers=max_followers,
            )
            (passed if target else failed).append(entity["entity_id"])
        if passed:
            cur.execute("UPDATE entities SET stage = 'filtered_in' WHERE entity_id = ANY(%s)", (passed,))
        if failed:
            cur.execute("UPDATE entities SET stage = 'filtered_out' WHERE entity_id = ANY(%s)", (failed,))
    conn.commit()
    return {"filtered_in": len(passed), "filtered_out": len(failed)}


def pending_discovered(conn, *, platform: str | None = None) -> int:
    """How many entities are still ungated (stage='discovered')."""
    clause, params = _platform_clause(platform)
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM entities WHERE stage = 'discovered'" + clause, params)
        return cur.fetchone()[0]


def require_gate(conn, *, platform: str | None = None) -> None:
    """Guard: refuse enrichment while ungated ('discovered') rows still exist.

    This is the story's hard rule -- no mass enrichment before the filter gate.
    Run filter_gate() first; then discovered rows are all filtered_in/out.
    """
    n = pending_discovered(conn, platform=platform)
    if n:
        where = f" for platform={platform!r}" if platform else ""
        raise RuntimeError(
            f"{n} entities still at stage='discovered'{where}; run filter_gate() "
            "before enrichment (E6 6.2: no mass enrichment before the filter gate)."
        )


def select_for_enrichment(conn, *, platform: str | None = None, limit: int | None = None) -> list[dict]:
    """The only rows the expensive enrichment step may touch: filtered_in and
    not yet enriched. discovered/filtered_out rows are excluded by construction,
    and require_gate refuses to run at all if any row is still ungated.
    """
    require_gate(conn, platform=platform)
    clause, params = _platform_clause(platform)
    sql = (
        "SELECT entity_id, platform, platform_id, handle FROM entities "
        "WHERE stage = 'filtered_in' AND last_enriched IS NULL" + clause + " ORDER BY entity_id"
    )
    args = list(params)
    if limit:
        sql += " LIMIT %s"
        args.append(limit)
    cols = ("entity_id", "platform", "platform_id", "handle")
    with conn.cursor() as cur:
        cur.execute(sql, args)
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def mark_enriched(conn, entity_ids: list[int]) -> int:
    """Called after enrichment succeeds: stamp last_enriched and advance stage."""
    ids = list(entity_ids)
    if not ids:
        return 0
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE entities SET stage = 'enriched', last_enriched = now() WHERE entity_id = ANY(%s)",
            (ids,),
        )
        updated = cur.rowcount
    conn.commit()
    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description="Filter gate between discovery and enrichment (E6 6.2)")
    parser.add_argument("--platform", help="Restrict to one platform")
    sub = parser.add_subparsers(dest="action", required=True)

    p_gate = sub.add_parser("gate", help="Promote discovered -> filtered_in/filtered_out")
    p_gate.add_argument("--min-relevance", type=int, default=DEFAULT_MIN_RELEVANCE)
    p_gate.add_argument("--min-followers", type=int, default=DEFAULT_MIN_FOLLOWERS)
    p_gate.add_argument("--max-followers", type=int, default=None)

    sub.add_parser("pending", help="Count ungated (discovered) entities")

    p_select = sub.add_parser("select", help="List rows eligible for enrichment (filtered_in, not enriched)")
    p_select.add_argument("--limit", type=int, default=None)

    args = parser.parse_args()
    from db.connection import get_conn

    conn = get_conn()
    try:
        if args.action == "gate":
            result = filter_gate(
                conn,
                platform=args.platform,
                min_relevance=args.min_relevance,
                min_followers=args.min_followers,
                max_followers=args.max_followers,
            )
        elif args.action == "pending":
            result = {"discovered": pending_discovered(conn, platform=args.platform)}
        else:  # select
            result = {"eligible": select_for_enrichment(conn, platform=args.platform, limit=args.limit)}
    finally:
        conn.close()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
