"""IB / creator scoring across the 8 requested signals.

Several dimensions need data this project hasn't collected yet: post-level
engagement, audience demographics, follower-count history, and (outside
YouTube) fake-follower analysis. Those come back as None with a note explaining what's
missing, rather than a fabricated number. The rest use best-effort heuristics
from whatever the current entity/raw data actually contains -- each is
labeled with exactly how confident (or not) it is.
"""

from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from statistics import median

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


# Shorts and very-fresh uploads have different/unsettled view-like-comment
# patterns than a channel's normal long-form output, so both score_fake_audience
# and _engagement_posts_from_videos exclude them via _usable_videos().
SHORTS_MAX_SECONDS = 60
MIN_VIDEO_AGE_DAYS = 7

_ISO8601_DURATION_RE = re.compile(r"^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$")


def _duration_seconds(iso_duration: str | None) -> int | None:
    """contentDetails.duration ("PT4M13S") -> seconds, or None if unparseable."""
    if not iso_duration:
        return None
    m = _ISO8601_DURATION_RE.match(iso_duration)
    if not m:
        return None
    hours, minutes, seconds = (int(g) if g else 0 for g in m.groups())
    return hours * 3600 + minutes * 60 + seconds


def _usable_videos(videos: list[dict], now: datetime) -> list[dict]:
    """videos old enough for their view count to have settled and long enough to
    not be a Short (see module-level constants above)."""
    usable = []
    for v in videos or []:
        snippet = v.get("snippet") or {}
        published = snippet.get("publishedAt")
        if not published:
            continue
        try:
            published_at = datetime.fromisoformat(published.replace("Z", "+00:00"))
        except ValueError:
            continue
        if (now - published_at).days < MIN_VIDEO_AGE_DAYS:
            continue
        duration = _duration_seconds((v.get("contentDetails") or {}).get("duration"))
        if duration is not None and duration <= SHORTS_MAX_SECONDS:
            continue
        usable.append(v)
    return usable


def _ratio_to_risk(ratio: float) -> int:
    # log scale: >=10% of subs -> 0 risk, <=1% -> 100 risk.
    return 100 if ratio <= 0 else max(0, min(100, round((1 - math.log10(ratio / 0.01)) * 100)))


def _risk_verdict(risk: int) -> str:
    return "likely bought/inactive subs" if risk >= 70 else "suspicious" if risk >= 40 else "looks organic"


def _fake_audience_from_channel_totals(stats: dict, subs: int) -> dict:
    """Fallback when no per-video stats have been collected yet (see
    discovery/youtube_video_enrich.py): lifetime views/videos from the
    channels.list `statistics` block already in staging_youtube.raw, no extra quota.
    Real subscribers watch: a channel's average video normally reaches a sizeable
    share of its subs (median ~25% across our DB, p5 ~2%). Bought subs never watch,
    so lifetime views per video collapse relative to the subscriber count.
    """
    views, video_count = int(stats.get("viewCount") or 0), int(stats.get("videoCount") or 0)
    if video_count < 3:
        return {"score": None, "note": f"too little to judge ({subs} subs, {video_count} videos, no per-video stats collected yet)"}
    ratio = views / video_count / subs
    risk = _ratio_to_risk(ratio)
    flags = [f"avg views/video = {ratio:.1%} of subs (channel lifetime totals, no per-video stats collected yet)"]
    if views < subs:  # lifetime views below subscriber count -- almost never organic
        risk = max(risk, 90)
        flags.append(f"lifetime views ({views}) < subs ({subs})")
    return {"score": risk, "note": f"{_risk_verdict(risk)}: " + "; ".join(flags)}


def _fake_audience_from_videos(usable: list[dict], subs: int) -> dict:
    """Per-video signals from `usable` (see _usable_videos), each 0-100 risk on
    its own; the channel's score is the WORST of whichever are computable (a
    creator can hide like counts or disable comments without that alone being
    suspicious, so only the signals with enough data count). A weighted
    average would let a great view/sub ratio paper over near-zero likes --
    bought views and bought subs looking "organic" by that one measure is
    exactly the case a single bad signal needs to catch.
    """
    stats_list = [(v.get("statistics") or {}) for v in usable]
    view_counts = [int(s.get("viewCount") or 0) for s in stats_list]

    view_ratio = median(v / subs for v in view_counts)
    risks = {"view": _ratio_to_risk(view_ratio)}
    flags = [f"median views/video = {view_ratio:.1%} of subs across {len(usable)} recent long-form video(s)"]

    like_ratios = [int(s["likeCount"]) / vc for s, vc in zip(stats_list, view_counts)
                   if "likeCount" in s and vc > 0]
    if len(like_ratios) >= 3:
        like_ratio = median(like_ratios)
        # organic long-form finance/trading content usually lands ~0.5%-30% likes/view;
        # far below suggests bought/inactive views, far above suggests bought likes.
        risks["like"] = 100 if like_ratio < 0.005 else 80 if like_ratio > 0.30 else 0
        flags.append(f"median likes/view = {like_ratio:.1%}")

    comment_ratios = [int(s["commentCount"]) / int(s["likeCount"]) for s in stats_list
                       if s.get("commentCount") is not None and int(s.get("likeCount") or 0) > 0]
    if len(comment_ratios) >= 3:
        comment_ratio = median(comment_ratios)
        risks["comment"] = 60 if comment_ratio < 0.01 else 0  # near-zero comments on real likes -- bought likes
        flags.append(f"median comments/like = {comment_ratio:.1%}")

    worst_signal, risk = max(risks.items(), key=lambda kv: kv[1])
    flags.append(f"worst signal: {worst_signal}")

    med_view = median(view_counts)
    if len(view_counts) >= 5 and med_view > 0 and max(view_counts) > 15 * med_view:
        # one bought/viral video can mask an otherwise-dead channel -- a soft bump,
        # since a genuine viral hit looks the same and shouldn't alone fail a channel.
        risk = min(100, risk + 15)
        flags.append(f"one video ({max(view_counts)} views) is a {max(view_counts) / med_view:.0f}x outlier vs the median")

    return {"score": risk, "note": f"{_risk_verdict(risk)}: " + "; ".join(flags)}


def score_fake_audience(raw: dict, videos: list[dict] | None = None, now: datetime | None = None) -> dict:
    """0-100 risk that a YouTube channel's subscribers/views/likes are bought or
    inactive (higher = worse). Prefers per-video stats (`videos`, from
    staging_youtube_video via discovery/youtube_video_enrich.py -- 0 extra API
    quota, see its docstring) when at least 3 recent long-form videos are
    available; falls back to the channel's lifetime totals otherwise. Other
    platforms don't expose either, so they get None.
    """
    stats = (raw or {}).get("statistics") or {}
    if not stats.get("subscriberCount"):
        return {"score": None, "note": "needs YouTube channel statistics (subs/views/videos); not available for this platform/entity"}
    if stats.get("hiddenSubscriberCount"):
        return {"score": None, "note": "subscriber count hidden by the channel"}
    subs = int(stats["subscriberCount"])
    if subs <= 0:
        return {"score": None, "note": "0 subscribers, nothing to compare against"}

    usable = _usable_videos(videos or [], now or datetime.now(timezone.utc))
    if len(usable) >= 3:
        return _fake_audience_from_videos(usable, subs)
    return _fake_audience_from_channel_totals(stats, subs)


def _engagement_posts_from_videos(videos: list[dict], now: datetime | None = None) -> list[dict]:
    """{"likes","comments","shares"} rows for score_engagement_rate(), from the
    same recent-long-form-video set score_fake_audience uses. YouTube's API
    exposes no share count, so shares is always 0 here."""
    usable = _usable_videos(videos, now or datetime.now(timezone.utc))
    posts = []
    for v in usable:
        s = v.get("statistics") or {}
        if "likeCount" not in s:
            continue
        posts.append({"likes": int(s["likeCount"]), "comments": int(s.get("commentCount") or 0), "shares": 0})
    return posts


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
            "note": "no post-level data available for this platform/entity (only TikTok, Twitter and YouTube fetch posts today)",
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
    videos: list[dict] | None = None,
) -> dict:
    """entity: a row from the `entities` table (dict). raw: its latest staging JSON (dict, may be empty).
    follower_history: ascending {"follower_count", "captured_at"} rows for this entity, if any.
    posts: {"likes","comments","shares"} dicts from extract_engagement() over this entity's staged posts.
    videos: recent YouTube video resources (snippet+statistics+contentDetails) from
    staging_youtube_video, if any -- feeds fake_audience_signal, and engagement_rate
    when `posts` is empty (YouTube has no extract_engagement of its own; posts here
    are derived from the same videos).
    """
    bio_corpus = " ".join(
        filter(None, [entity.get("display_name"), entity.get("bio_text"), entity.get("handle")])
    )
    follower_count = entity.get("follower_count")

    relevance = score_creator_relevance(bio_corpus)
    brand_safety = score_brand_safety(bio_corpus)
    audience_quality = score_audience_quality(follower_count, raw or {})
    growth = score_follower_growth(follower_history or [])
    if not posts and videos:
        posts = _engagement_posts_from_videos(videos)
    engagement = score_engagement_rate(posts or [], follower_count)
    fake = score_fake_audience(raw or {}, videos)
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
        # risk score (higher = worse) -> invert so the composite stays "higher = better"
        "fake_audience_signal": None if fake["score"] is None else 100 - fake["score"],
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
        "fake_audience_signal": fake["note"],
    }

    return {
        "engagement_rate": engagement["value"],
        "audience_quality": audience_quality["score"],
        "audience_demographics": None,
        "follower_growth": growth["value"],
        "brand_safety": brand_safety["score"],
        "estimated_post_price_usd": post_price["value_usd"],
        "fake_audience_signal": fake["score"],
        "creator_relevance": relevance["score"],
        "composite_score": composite,
        "data_completeness": round(len(available) / len(sub_scores), 2),
        "notes": notes,
    }
