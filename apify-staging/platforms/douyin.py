"""Douyin (China TikTok) profile scraper actor.

Uses natanielsantos/douyin-scraper because it accepts plain profile URLs
(`profileUrls`) -- most other Douyin actors on Apify require an internal
`sec_uid` you'd have to look up separately, which is a lot more friction.
"""

import re

ACTOR_ID = "natanielsantos/douyin-scraper"

_URL_PATTERN = re.compile(r"https?://[^\s,)]+")

DEFAULT_INPUT = {
    "profileUrls": ["https://www.douyin.com/user/MS4wLjABAAAA_placeholder"],
    "scrapeAdditionalUserInfo": True,
    "maxItemsPerUrl": 1,
    "shouldDownloadVideos": False,
    "shouldDownloadCovers": False,
}


def build_input(overrides: dict) -> dict:
    run_input = dict(DEFAULT_INPUT)
    if overrides.get("urls"):
        run_input["profileUrls"] = overrides["urls"]
    return run_input


def to_entity(item: dict) -> dict:
    """Best-effort mapping -- field names unverified against a real run, unlike linkedin.py."""
    meta = item.get("authorMeta") or item
    sec_uid = meta.get("secUid")
    return {
        "platform_id": sec_uid or meta.get("id"),
        "handle": meta.get("uniqueId") or meta.get("nickname"),
        "display_name": meta.get("nickname") or meta.get("name"),
        "bio_text": meta.get("signature"),
        "website_url": None,
        "avatar_url": meta.get("avatarThumb") or meta.get("avatar"),
        "follower_count": meta.get("followersCount") or meta.get("followerCount"),
        "email_norm": None,
        # Derived from the known Douyin profile URL pattern, not returned directly
        # by the actor -- unverified against a real run.
        "source_url": f"https://www.douyin.com/user/{sec_uid}" if sec_uid else None,
    }


def extract_related_links(item: dict) -> list[dict]:
    """Douyin doesn't support a link-in-bio field the way TikTok does (platform
    restriction), so this only catches URLs someone pasted directly into their
    signature text -- likely to be sparse.
    """
    meta = item.get("authorMeta") or item
    signature = meta.get("signature") or ""
    links = [{"label": "Mentioned in bio", "url": url.rstrip(".,)")} for url in _URL_PATTERN.findall(signature)]

    seen = set()
    deduped = []
    for link in links:
        if link["url"] not in seen:
            seen.add(link["url"])
            deduped.append(link)
    return deduped
