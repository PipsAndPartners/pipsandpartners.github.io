"""Two-phase filter gate between cheap discovery and expensive enrichment (E6, story 6.2).

The whole point is cost: the per-profile enrichment scrapers (Apify profile/
contact actors) are what cost money, so they must never run over the raw
discovered set. This module is the gate the schema (db/01_schema.sql) was built
for -- it drives entities through their `stage` column:

    discovered  --filter_gate()-->  filtered_in / filtered_out
    filtered_in --select_for_enrichment()--> [rows to enrich] --mark_enriched()--> enriched
    filtered_in/enriched --select_for_llm()--> [rows the LLM classifier may see]  (E6 6.8)

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
import re

from discovery.shortlist import BROKER_BRANDS, is_other_broker, vn_signal
from scoring import score_creator_relevance, score_engagement_rate

# Cheap-filter defaults, tuned for the forex/IB niche. Relevance comes from the
# same keyword heuristic scoring uses; the follower floor drops obvious noise.
DEFAULT_MIN_RELEVANCE = 20
DEFAULT_MIN_FOLLOWERS = 1000

# Market checks the shortlist applies at the end anyway -- enriching a row that
# fails them is pure waste. None = no market restriction.
MARKETS = {"vn": vn_signal}

# Minimum avg interactions per follower where post data exists (TikTok today).
# Gated TikTok rows on 2026-09-23: p10 0.04%, p25 0.19%, median 1.3% -- below
# 0.5% the audience is dead or bought, not worth an LLM call.
DEFAULT_MIN_ENGAGEMENT_PCT = 0.5

# Word-bounded IB/forex signals, Vietnamese with or without diacritics. The
# substring lexicon in scoring.py has no Vietnamese terms, so a bio like
# "Trade Vàng - BackCom - Quỹ FTMO" scored ~0 there; any hit here clears the
# relevance floor on its own.
_GENERIC_BRAND_WORDS = {"vantage", "admirals", "bcr", "saxo", "blackwell"}  # "vantage point" is not a broker
IB_SIGNAL_RE = re.compile(
    r"""
    \b(?:forex|ngo[aạ]i\s?h[oố]i|xau\s?/?\s?usd|cfds?|metatrader|mt[45])\b
    | \bfx|\w{3,}fx\b                                              # fxguy, DinhChienFX -- not sfx/vfx
    | \b(?:trade|trading|giao\s?d[iị]ch|ph[aâ]n\s?t[ií]ch)\s+(?:v[aà]ng|gold)\b
    | \b(?:ho[aà]n\s?ph[ií]|back\s?com|rebates?|cash\s?back)\b     # IB rebate offers
    | \bintroducing\s+broker | \b(?:l[aà]m|tr[oở]\s+th[aà]nh|đ[oố]i\s+t[aá]c)\s+ib\b
    | \bib\s+(?:program|partner|forex|broker)\b                    # bare "ib" = inbox in VN slang
    | \bm[aã]\s+gi[oớ]i\s+thi[eệ]u | \bref(?:erral)?\s*(?:code|link) | \bpartner\s*code
    | \bm[oở]\s+t[aà]i\s+kho[aả]n | \bs[aà]n\s+(?:forex|giao\s?d[iị]ch|uy\s?t[ií]n)
    | \bt[ií]n\s?hi[eệ]u | \bcopy\s?trad(?:e|ing) | \bprop\s?firms? | \b(?:ftmo|the5ers)\b
    | \b(?:price\s+action|wyckoff|ichimoku|scalp(?:ing|er)?|supply\s*(?:&|and)?\s*demand)\b
    | \b(?:"""
    + "|".join(re.escape(b) for b in BROKER_BRANDS if b not in _GENERIC_BRAND_WORDS)
    + r""")\b                                                          # a broker named in the bio
    """,
    re.I | re.X,
)

# Niches that are plainly not forex/IB (seen in real discovery noise: gold shops,
# immigration, property, news, game-account shops...). Only drops a row that has
# NO IB/forex signal above -- "tin tức forex" stays in.
IRRELEVANT_RE = re.compile(
    r"""
    \b(?:ti[eệ]m\s+v[aà]ng|trang\s+s[uứ]c|jewel(?:le)?ry)\b
    | \b(?:đ[iị]nh\s+c[uư]|dinh\s+cu|immigration|visa|du\s+h[oọ]c|xu[aấ]t\s+kh[aẩ]u\s+lao\s+đ[oộ]ng)\b
    | \b(?:b[aấ]t\s+đ[oộ]ng\s+s[aả]n|real\s+estate|property)\b
    | \b(?:tin\s+t[uứ]c|th[oờ]i\s+s[uự])\b
    | \b(?:free\s?fire|li[eê]n\s+qu[aâ]n|acc\s+game|pubg|genshin|roblox)\b
    | \b(?:nh[aà]\s+c[aá]i|c[aá]\s+(?:độ|cược)|casino|betting|l[oô]\s+đ[eề]|x[oổ]\s+s[oố])\b
    | \b(?:tuy[eể]n\s+d[uụ]ng|vi[eệ]c\s+l[aà]m|recruit(?:ment|ing|er)?)\b
    | \b(?:dance|ca\s+s[iĩ]|singer|fitness|wellness|gym|s[uứ]c\s+kh[oỏ]e)\b
    | \b(?:đo[aà]n\s+thanh\s+ni[eê]n|tr[uư][oờ]ng\s+thpt|nh[aậ]p\s+kh[aẩ]u|co\.,?\s*ltd)\b
    """,
    re.I | re.X,
)

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
    market: str | None = None,
    min_engagement_pct: float | None = None,
) -> bool:
    """Decide filtered_in (True) vs filtered_out (False) from discovery fields alone.

    Uses only what cheap discovery captured -- display_name / handle / bio_text
    for niche relevance, plus follower_count when present -- so running the gate
    itself costs nothing. A missing follower_count never fails the follower
    check: we don't yet know it, and finding it out is exactly enrichment's job.

    Relevance is the lexicon score OR any IB_SIGNAL_RE hit; a row matching
    IRRELEVANT_RE with no such hit is dropped outright. Also drops a broker's own
    page (never an IB, the shortlist discards it too), with `market` rows without
    that market's signal (e.g. market="vn"), and with `min_engagement_pct` rows
    whose entity["engagement_pct"] is known and below it.
    """
    name, handle, bio = entity.get("display_name"), entity.get("handle"), entity.get("bio_text")
    text = " ".join(filter(None, (name, bio, handle)))
    signal = IB_SIGNAL_RE.search(text)
    if not signal and IRRELEVANT_RE.search(text):
        return False
    if not signal and score_creator_relevance(text)["score"] < min_relevance:
        return False
    if is_other_broker(name or "", handle or ""):
        return False
    if market and not MARKETS[market](name or "", handle or "", bio or ""):
        return False
    followers = entity.get("follower_count")
    if followers is not None:
        if followers < min_followers:
            return False
        if max_followers is not None and followers > max_followers:
            return False
    engagement = entity.get("engagement_pct")
    if min_engagement_pct is not None and engagement is not None and engagement < min_engagement_pct:
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
    market: str | None = None,
) -> dict:
    """Promote every stage='discovered' entity to filtered_in / filtered_out.

    Only touches 'discovered' rows, so re-running after a fresh discovery pass
    gates just the new arrivals (filtered_out rows stay out). Returns counts plus
    enrichment_cut_pct: the share of per-row enrichment spend the gate avoided.
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
                market=market,
            )
            (passed if target else failed).append(entity["entity_id"])
        if passed:
            cur.execute("UPDATE entities SET stage = 'filtered_in' WHERE entity_id = ANY(%s)", (passed,))
        if failed:
            cur.execute("UPDATE entities SET stage = 'filtered_out' WHERE entity_id = ANY(%s)", (failed,))
    conn.commit()
    total = len(passed) + len(failed)
    return {
        "filtered_in": len(passed),
        "filtered_out": len(failed),
        "enrichment_cut_pct": round(100 * len(failed) / total, 1) if total else None,
    }


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


def select_for_llm(
    conn,
    *,
    platform: str | None = None,
    limit: int | None = None,
    min_engagement_pct: float | None = DEFAULT_MIN_ENGAGEMENT_PCT,
    **filters,
) -> list[dict]:
    """The only rows the LLM IB classifier (E8 8.2) may be sent (E6 6.8).

    Gated rows (filtered_in/enriched) re-checked with passes_filter on their
    current, post-enrichment fields -- enrichment may have changed followers or
    bio -- plus an engagement floor, which only becomes knowable once post rows
    are staged. Rows without post data (YouTube/Facebook/LinkedIn today) are not
    failed on engagement. `filters` are passes_filter's thresholds (min_relevance,
    min_followers, max_followers, market); pass the ones the gate ran with.
    """
    from psycopg.rows import dict_row

    from db.run_scoring import _post_engagement

    require_gate(conn, platform=platform)
    clause, params = _platform_clause(platform)
    candidates = []
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT " + ", ".join(_DISCOVERED_COLS) + " FROM entities "
            "WHERE stage IN ('filtered_in', 'enriched')" + clause + " ORDER BY entity_id",
            params,
        )
        for entity in cur.fetchall():
            posts = _post_engagement(cur, entity["platform"], entity["platform_id"])
            entity["engagement_pct"] = score_engagement_rate(posts, entity["follower_count"])["value"]
            if passes_filter(entity, min_engagement_pct=min_engagement_pct, **filters):
                candidates.append(entity)
                if limit and len(candidates) >= limit:
                    break
    return candidates


def main() -> None:
    parser = argparse.ArgumentParser(description="Filter gate between discovery and enrichment (E6 6.2)")
    parser.add_argument("--platform", help="Restrict to one platform")
    sub = parser.add_subparsers(dest="action", required=True)

    p_gate = sub.add_parser("gate", help="Promote discovered -> filtered_in/filtered_out")
    p_llm = sub.add_parser("llm", help="List rows the LLM classifier may be sent (gated + re-check + engagement)")
    p_llm.add_argument("--min-engagement", type=float, default=DEFAULT_MIN_ENGAGEMENT_PCT,
                       help="Min engagement rate %% where post data exists")
    p_llm.add_argument("--limit", type=int, default=None)
    for p in (p_gate, p_llm):  # same thresholds at both gates
        p.add_argument("--min-relevance", type=int, default=DEFAULT_MIN_RELEVANCE)
        p.add_argument("--min-followers", type=int, default=DEFAULT_MIN_FOLLOWERS)
        p.add_argument("--max-followers", type=int, default=None)
        p.add_argument("--market", choices=sorted(MARKETS), default=None,
                       help="Only let in-market rows through (the shortlist drops the rest anyway)")

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
                market=args.market,
            )
        elif args.action == "llm":
            rows = select_for_llm(
                conn,
                platform=args.platform,
                limit=args.limit,
                min_engagement_pct=args.min_engagement,
                min_relevance=args.min_relevance,
                min_followers=args.min_followers,
                max_followers=args.max_followers,
                market=args.market,
            )
            result = {"llm_candidates": len(rows),
                      "rows": [{k: r[k] for k in ("entity_id", "platform", "handle", "engagement_pct")} for r in rows]}
        elif args.action == "pending":
            result = {"discovered": pending_discovered(conn, platform=args.platform)}
        else:  # select
            result = {"eligible": select_for_enrichment(conn, platform=args.platform, limit=args.limit)}
    finally:
        conn.close()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
