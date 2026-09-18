"""Douyin (China TikTok) keyword-search actor.

Uses zen-studio/douyin-search-scraper because it does real keyword *discovery*
(the natanielsantos/douyin-scraper it replaced only accepted known profile URLs,
so it couldn't find new IBs at all). This actor also returns one row per video
with an ``authorMeta`` block and a ``statistics`` block, so -- exactly like
clockworks/tiktok-scraper -- we get profile fields AND per-video engagement in
the same run, which feeds scoring.score_engagement_rate.

Its input schema matches inputs/douyin_ib_midtier.json (keywords / sort /
publishTime / duration), which was written for this actor.

Field names below are taken from the actor's Apify docs; like the other
platform modules they're unverified against a real run until you do one.
"""

import re

from discovery.common.contacts import contact_links, extract_contacts

ACTOR_ID = "zen-studio/douyin-search-scraper"

_URL_PATTERN = re.compile(r"https?://[^\s,)]+")

DEFAULT_INPUT = {
    "keywords": ["外汇交易", "forex"],
    "maxResultsPerQuery": 50,
    "sort": "general",
    "publishTime": "half_year",
    "duration": "unlimited",
    "shouldDownloadVideos": False,
    "shouldDownloadCovers": False,
    "shouldDownloadSlideshowImages": False,
    "videoKvStoreName": "",
}


def build_input(overrides: dict) -> dict:
    run_input = dict(DEFAULT_INPUT)
    # pipeline.py's --search-query maps to a single keyword; the web console can
    # pass a full `keywords` list (or the douyin_ib_midtier.json preset) directly.
    if overrides.get("search_query"):
        run_input["keywords"] = [overrides["search_query"]]
    if overrides.get("keywords"):
        run_input["keywords"] = overrides["keywords"]
    if overrides.get("maxResultsPerQuery") is not None:
        run_input["maxResultsPerQuery"] = overrides["maxResultsPerQuery"]
    return run_input


def to_entity(item: dict) -> dict:
    """Map one video row's author to an entity. The same author appears across
    several video rows in a search; entities dedupes on (platform, secUid) and
    run_scoring averages engagement over all their staged rows."""
    meta = item.get("authorMeta") or item
    sec_uid = meta.get("secUid") or meta.get("id")
    # actor docs say username/customUsername/name; scripts/filter_midtier.py sees
    # uniqueId/nickname on real runs -- accept both spellings.
    handle = meta.get("username") or meta.get("customUsername") or meta.get("uniqueId") or meta.get("name")
    contacts = extract_contacts(meta.get("signature"))
    return {
        "platform_id": sec_uid,
        "handle": handle,
        "display_name": meta.get("name") or meta.get("nickname"),
        "bio_text": meta.get("signature"),
        "website_url": None,
        "avatar_url": (
            meta.get("avatarMedium") or meta.get("avatarLarge") or meta.get("avatarThumb") or meta.get("avatar")
        ),
        "follower_count": meta.get("followersCount") or meta.get("followerCount"),
        "email_norm": contacts["email"].lower() or None,
        "phone_norm": contacts["phone"] or None,
        "wechat_norm": contacts["wechat"] or None,
        "source_url": f"https://www.douyin.com/user/{sec_uid}" if sec_uid else None,
    }


def extract_engagement(item: dict) -> dict | None:
    """Per-video engagement for averaging across an author's videos (scoring.py)."""
    stats = item.get("statistics") or item
    likes, comments, shares = stats.get("diggCount"), stats.get("commentCount"), stats.get("shareCount")
    if likes is None and comments is None and shares is None:
        return None
    return {"likes": likes or 0, "shares": shares or 0, "comments": comments or 0}


def extract_related_links(item: dict) -> list[dict]:
    """Douyin has no link-in-bio field, so this only catches URLs someone pasted
    directly into their signature text -- likely sparse."""
    meta = item.get("authorMeta") or item
    signature = meta.get("signature") or ""
    links = list(contact_links(signature))  # other-platform accounts pasted in the bio
    links += [{"label": "Mentioned in bio", "url": url.rstrip(".,)")} for url in _URL_PATTERN.findall(signature)]

    seen = set()
    deduped = []
    for link in links:
        if link["url"] not in seen:
            seen.add(link["url"])
            deduped.append(link)
    return deduped
