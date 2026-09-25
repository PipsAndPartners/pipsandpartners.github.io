"""TikTok scraper actor (Clockworks) -- the general one, not -profile-scraper.

Supports both discovery (searchQueries, like LinkedIn's keyword search) and
direct profile lookup (profiles, for known usernames) with the same output
schema either way, so to_entity/extract_engagement/extract_related_links
below work regardless of which mode a given run used.

Input keys checked against the actor's input schema (build 0.0.608).
DEFAULT_INPUT is a one-query smoke test; the VN forex keyword set lives in
inputs/tiktok_forex_vn.json (pipeline.py --platform tiktok --preset ...).
"""

import re

from discovery.common.contacts import contact_links, extract_contacts

ACTOR_ID = "clockworks/tiktok-scraper"

_URL_PATTERN = re.compile(r"https?://[^\s,)]+")

DEFAULT_INPUT = {
    "searchQueries": ["forex trading"],
    "searchSection": "/user",
    "maxProfilesPerQuery": 10,
    # Discovery is billed per video row: 1 per profile is the minimal identity
    # (authorMeta rides on it). Engagement sampling is enrichment -- see build_input.
    "resultsPerPage": 1,
    "shouldDownloadVideos": False,
    "shouldDownloadCovers": False,
}


def build_input(overrides: dict) -> dict:
    run_input = dict(DEFAULT_INPUT)
    if overrides.get("usernames"):
        # Direct lookup of known people (e.g. for engagement scoring), not discovery.
        run_input.pop("searchQueries", None)
        run_input.pop("searchSection", None)
        run_input.pop("maxProfilesPerQuery", None)
        run_input["profiles"] = overrides["usernames"]
        run_input["resultsPerPage"] = 5  # a few recent posts, enough to average engagement from
    elif overrides.get("search_query"):
        run_input["searchQueries"] = [overrides["search_query"]]
    return run_input


def to_entity(item: dict) -> dict:
    """Map one video row's author to an entity. Verified against real runs
    (authorMeta.id/name/nickName/signature/bioLink/avatar/fans); the actor's
    NOT_FOUND error rows carry no authorMeta, so they map to platform_id=None
    and db.loader skips them.

    email_norm/phone_norm are pulled from the bio text -- many forex IBs paste a
    contact email or Telegram/Zalo number in their TikTok signature, and those
    feed cross-platform identity resolution (db/02_resolve.sql).
    """
    meta = item.get("authorMeta") or item
    handle = meta.get("name") or meta.get("uniqueId")
    contacts = extract_contacts(meta.get("signature"))
    return {
        "platform_id": meta.get("id") or handle,
        "handle": handle,
        "display_name": meta.get("nickName") or meta.get("nickname"),
        "bio_text": meta.get("signature"),
        "website_url": meta.get("bioLink"),
        "avatar_url": meta.get("avatar"),
        "follower_count": meta.get("fans"),
        "email_norm": contacts["email"].lower() or None,
        "phone_norm": contacts["phone"] or None,
        "source_url": f"https://www.tiktok.com/@{handle}" if handle else None,
    }


def extract_related_links(item: dict) -> list[dict]:
    """Other links found in the raw profile: the link-in-bio field, any
    other-platform account pasted in the bio, plus any bare URL in the signature.
    Unlike linkedin.py's version, there's no employment-history equivalent here.
    """
    meta = item.get("authorMeta") or item
    links = []

    bio_link = meta.get("bioLink")
    if bio_link:
        url = bio_link if bio_link.startswith("http") else f"https://{bio_link}"
        links.append({"label": "Bio link", "url": url})

    signature = meta.get("signature") or ""
    links.extend(contact_links(signature))  # nicely-labelled other-platform accounts
    for url in _URL_PATTERN.findall(signature):
        links.append({"label": "Mentioned in bio", "url": url.rstrip(".,)")})

    seen = set()
    deduped = []
    for link in links:
        if link["url"] not in seen:
            seen.add(link["url"])
            deduped.append(link)
    return deduped


def extract_engagement(item: dict) -> dict | None:
    """Per-video engagement numbers, for averaging across a profile's videos (scoring.py)."""
    likes, comments, shares = item.get("diggCount"), item.get("commentCount"), item.get("shareCount")
    if likes is None and comments is None and shares is None:
        return None
    return {"likes": likes or 0, "shares": shares or 0, "comments": comments or 0}
