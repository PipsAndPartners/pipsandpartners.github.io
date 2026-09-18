"""IB / creator scoring across the 8 requested signals.

Several dimensions need data this project hasn't collected yet: post-level
engagement, audience demographics, follower-count history, and bot/fake-
follower analysis. Those come back as None with a note explaining what's
missing, rather than a fabricated number. The rest use best-effort heuristics
from whatever the current entity/raw data actually contains -- each is
labeled with exactly how confident (or not) it is.
"""

from __future__ import annotations

# forex/IB-affiliate niche keywords -> weight, matched against bio/headline/handle.
RELEVANCE_KEYWORDS = {
    "introducing broker": 30,
    "forex": 20,
    "affiliate": 20,
    "cfd": 15,
    "trading": 15,
    "broker": 15,
    "partnership": 15,
    " ib ": 15,
    "fx": 10,
    "signals": 10,
    "currency": 10,
    "financial markets": 10,
    "business development": 10,
    "investment": 8,
    # Gold / precious-metals sub-niche (XAUUSD is a core broker instrument), plus
    # the Chinese terms gold-analysis creators use in their Douyin bios -- without
    # these a 黄金分析 bio scores 0 and the filter gate drops every gold creator.
    "gold": 20,
    "xauusd": 20,
    "黄金": 20,          # gold
    "现货黄金": 20,       # spot gold
    "黄金分析": 30,       # gold analysis (strong niche signal)
    "金价": 15,          # gold price
    "贵金属": 15,         # precious metals
    "外汇": 20,          # forex (Chinese)
    "原油": 10,          # crude oil (usually paired with gold analysis)
    "交易": 10,          # trading (Chinese)
}

# Common scam-adjacent phrasing in the forex/trading niche -- a crude red-flag
# screen, not real brand-safety analysis (which needs content/post history).
BRAND_RISK_PHRASES = [
    "guaranteed profit",
    "guaranteed return",
    "100% profit",
    "risk free",
    "risk-free",
    "double your money",
    "get rich quick",
    "no loss",
    "sure shot",
    "secret strategy",
    "guaranteed win",
]

NOT_COMPUTABLE_NOTES = {
    "audience_demographics": "requires a dedicated audience-analytics actor (e.g. HypeAuditor-style), not integrated yet",
    "fake_audience_signal": "requires follower-graph bot analysis, not collected",
}

SCORE_WEIGHTS = {
    "creator_relevance": 0.35,
    "brand_safety": 0.20,
    "audience_quality": 0.15,
    "engagement_rate": 0.15,
    "audience_demographics": 0.05,
    "follower_growth": 0.05,
    "fake_audience_signal": 0.05,
}


def score_creator_relevance(text: str) -> dict:
    text_lower = f" {(text or '').lower()} "
    matched = [kw for kw in RELEVANCE_KEYWORDS if kw in text_lower]
    score = min(100, sum(RELEVANCE_KEYWORDS[kw] for kw in matched))
    note = f"keyword heuristic; matched: {matched}" if matched else "keyword heuristic; no forex/IB terms found in bio/headline"
    return {"score": score, "note": note}


def score_brand_safety(text: str) -> dict:
    text_lower = (text or "").lower()
    flags = [p for p in BRAND_RISK_PHRASES if p in text_lower]
    score = max(0, 100 - len(flags) * 35)
    note = (
        f"crude keyword screen only, not real brand-safety analysis; flagged phrases: {flags}"
        if flags
        else "crude keyword screen only (no red-flag phrases found) -- not real brand-safety analysis"
    )
    return {"score": score, "note": note}


def _following_count(raw: dict) -> int | None:
    """The account's following/connections count, wherever a given platform's raw
    item keeps it: LinkedIn uses top-level connectionsCount; TikTok nests
    authorMeta.following; Douyin authorMeta.followingCount; Twitter author.following."""
    if not raw:
        return None
    author = raw.get("authorMeta") or raw.get("author") or {}
    for source in (raw, author):
        for key in ("connectionsCount", "followingCount", "following"):
            value = source.get(key)
            if isinstance(value, (int, float)) and value > 0:
                return int(value)
    return None


def score_audience_quality(follower_count: int | None, raw: dict) -> dict:
    following = _following_count(raw or {})
    if not follower_count or not following:
        return {"score": None, "note": "insufficient data (no follower/following figures)"}
    ratio = follower_count / max(following, 1)
    score = max(0, min(100, round(ratio * 20)))
    return {
        "score": score,
        "note": f"weak proxy: follower/following ratio ({ratio:.2f}) -- not real audience-quality analysis",
    }


def score_follower_growth(history: list[dict]) -> dict:
    """history: rows of {"follower_count": int, "captured_at": datetime}, ascending by time."""
    if len(history) < 2:
        return {
            "value": None,
            "note": f"only {len(history)} snapshot(s) recorded so far; need at least 2 scrapes over time to compute growth",
        }
    earliest, latest = history[0], history[-1]
    span_days = max((latest["captured_at"] - earliest["captured_at"]).total_seconds() / 86400, 0.01)
    if earliest["follower_count"] <= 0:
        return {"value": None, "note": "earliest snapshot had 0 followers, can't compute a percentage change"}
    pct_change = round((latest["follower_count"] - earliest["follower_count"]) / earliest["follower_count"] * 100, 2)
    return {
        "value": pct_change,
        "note": f"% change from {earliest['follower_count']} to {latest['follower_count']} followers over {span_days:.1f} days",
    }


def score_engagement_rate(posts: list[dict], follower_count: int | None) -> dict:
    """posts: {"likes", "comments", "shares"} dicts from a platform's extract_engagement(),
    for whatever recent posts were fetched in this batch (see db/run_scoring.py).
    """
    if not posts:
        return {
            "value": None,
            "score": None,
            "note": "no post-level data available for this platform/entity (only TikTok and Twitter fetch posts today)",
        }
    if not follower_count:
        return {"value": None, "score": None, "note": "have post data but no follower count to divide by"}

    avg_interactions = sum(p["likes"] + p["comments"] + p["shares"] for p in posts) / len(posts)
    er_pct = round(avg_interactions / follower_count * 100, 3)
    # Rough universal cap (20% ER -> 100) -- real benchmarks vary a lot by platform/niche.
    score = max(0, min(100, round(er_pct * 5)))
    return {
        "value": er_pct,
        "score": score,
        "note": f"avg interactions/follower across {len(posts)} recent post(s)",
    }


def score_estimated_post_price(follower_count: int | None, engagement_rate_pct: float | None) -> dict:
    if not follower_count:
        return {"value_usd": None, "note": "insufficient data (no follower count)"}
    # Rough $/1000-followers rule of thumb, nudged by real engagement rate when we
    # have it. Still a ballpark, not a market-comp-based estimate.
    value = follower_count / 1000 * 10
    note = "rough $/1000-followers rule of thumb; not based on engagement rate (not collected for this platform yet)"
    if engagement_rate_pct is not None:
        value *= 1 + engagement_rate_pct / 10
        note = f"rough $/1000-followers rule of thumb, adjusted by real engagement rate ({engagement_rate_pct}%)"
    return {"value_usd": round(value, 2), "note": note}


def score_entity(
    entity: dict,
    raw: dict,
    follower_history: list[dict] | None = None,
    posts: list[dict] | None = None,
) -> dict:
    """entity: a row from the `entities` table (dict). raw: its latest staging JSON (dict, may be empty).
    follower_history: ascending {"follower_count", "captured_at"} rows for this entity, if any.
    posts: {"likes","comments","shares"} dicts from extract_engagement() over this entity's staged posts.
    """
    bio_corpus = " ".join(
        filter(None, [entity.get("display_name"), entity.get("bio_text"), entity.get("handle")])
    )
    follower_count = entity.get("follower_count")

    relevance = score_creator_relevance(bio_corpus)
    brand_safety = score_brand_safety(bio_corpus)
    audience_quality = score_audience_quality(follower_count, raw or {})
    growth = score_follower_growth(follower_history or [])
    engagement = score_engagement_rate(posts or [], follower_count)
    post_price = score_estimated_post_price(follower_count, engagement["value"])

    # follower_growth is a % change (unbounded, can be negative or huge), but the
    # composite average is on a 0-100 scale like the other sub-scores -- map it to
    # 0-100 with 0% change = neutral (50), clamped at both ends, for composite use only.
    growth_score = None if growth["value"] is None else max(0, min(100, 50 + growth["value"]))

    sub_scores = {
        "creator_relevance": relevance["score"],
        "brand_safety": brand_safety["score"],
        "audience_quality": audience_quality["score"],
        "follower_growth": growth_score,
        "engagement_rate": engagement["score"],
        "audience_demographics": None,
        "fake_audience_signal": None,
    }

    available = {k: v for k, v in sub_scores.items() if v is not None}
    if available:
        used_weight = sum(SCORE_WEIGHTS[k] for k in available)
        composite = round(sum(sub_scores[k] * SCORE_WEIGHTS[k] for k in available) / used_weight, 1)
    else:
        composite = None

    notes = {
        "creator_relevance": relevance["note"],
        "brand_safety": brand_safety["note"],
        "audience_quality": audience_quality["note"],
        "estimated_post_price": post_price["note"],
        "follower_growth": growth["note"],
        "engagement_rate": engagement["note"],
        "audience_demographics": NOT_COMPUTABLE_NOTES["audience_demographics"],
        "fake_audience_signal": NOT_COMPUTABLE_NOTES["fake_audience_signal"],
    }

    return {
        "engagement_rate": engagement["value"],
        "audience_quality": audience_quality["score"],
        "audience_demographics": None,
        "follower_growth": growth["value"],
        "brand_safety": brand_safety["score"],
        "estimated_post_price_usd": post_price["value_usd"],
        "fake_audience_signal": None,
        "creator_relevance": relevance["score"],
        "composite_score": composite,
        "data_completeness": round(len(available) / len(sub_scores), 2),
        "notes": notes,
    }
