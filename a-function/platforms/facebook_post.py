"""Facebook public *post* search actor -- finds the PEOPLE behind forex posts.

The existing facebook.py searches Pages, which on Facebook are dominated by
brokers' own official pages, not IBs. This actor instead searches public posts
(page/profile/group) by keyword and returns each post's AUTHOR, so an individual
who posts about XTB/forex surfaces as a candidate -- and it carries per-post
engagement, which the Pages actor never did.

Each entity here is a Facebook *person* (the post author). The same author across
several matched posts dedups on (platform, author id); db/run_scoring.py averages
engagement over their staged posts, exactly like TikTok/Douyin.

Actor: scraper_one/facebook-posts-search. Field names are from the actor's Apify
docs and, like the other modules, are unverified against a real run until you do one.
"""

import re

from discovery.common.contacts import contact_links, extract_contacts

ACTOR_ID = "scraper_one/facebook-posts-search"

_PROFILE_ID_RE = re.compile(r"facebook\.com/profile\.php\?id=(\d+)", re.I)
_PROFILE_SLUG_RE = re.compile(r"facebook\.com/([\w.\-]+)", re.I)

DEFAULT_INPUT = {
    "query": "XTB Việt Nam",
    "resultsCount": 50,
    "location": "Vietnam",
}


def build_input(overrides: dict) -> dict:
    run_input = dict(DEFAULT_INPUT)
    if overrides.get("search_query"):
        run_input["query"] = overrides["search_query"]
    if overrides.get("query"):
        run_input["query"] = overrides["query"]
    if overrides.get("resultsCount") is not None:
        run_input["resultsCount"] = overrides["resultsCount"]
    if overrides.get("location"):
        run_input["location"] = overrides["location"]
    return run_input


def _identity(profile_url: str | None, author: dict) -> tuple[str | None, str | None]:
    """Return (stable_id, handle) for a post author. Prefer the numeric/id form so a
    person is deduped correctly across their posts; fall back to the vanity slug."""
    author_id = author.get("id")
    slug = None
    if profile_url:
        m = _PROFILE_ID_RE.search(profile_url)
        if m:
            slug = f"id_{m.group(1)}"
        else:
            m = _PROFILE_SLUG_RE.search(profile_url)
            if m and m.group(1).lower() != "profile.php":
                slug = m.group(1)
    stable = str(author_id) if author_id else slug
    return stable, slug


def to_entity(item: dict) -> dict:
    """Map one matched post to its author. bio_text holds the post text (where the
    forex/XTB context and any contact details live), so scoring and contact
    extraction have something to read even though a post gives no profile bio."""
    author = item.get("author") or {}
    profile_url = author.get("profileUrl") or item.get("profileUrl")
    stable_id, slug = _identity(profile_url, author)
    text = item.get("postText") or item.get("text") or ""
    contacts = extract_contacts(text)
    return {
        "platform_id": stable_id,
        "handle": slug or author.get("name") or item.get("profileName"),
        "display_name": author.get("name") or item.get("profileName"),
        "bio_text": text or None,
        "website_url": None,
        "avatar_url": author.get("profilePicture") or item.get("profilePicture"),
        "follower_count": None,  # post search doesn't expose the author's follower count
        "email_norm": contacts["email"].lower() or None,
        "phone_norm": contacts["phone"] or None,
        "source_url": profile_url,
    }


def extract_engagement(item: dict) -> dict | None:
    """Per-post engagement for averaging across an author's matched posts (scoring.py)."""
    likes, comments, shares = item.get("reactionsCount"), item.get("commentsCount"), item.get("sharesCount")
    if likes is None and comments is None and shares is None:
        return None
    return {"likes": likes or 0, "shares": shares or 0, "comments": comments or 0}


def extract_related_links(item: dict) -> list[dict]:
    """Other-platform accounts an author pasted into the post text (contactable evidence)."""
    text = item.get("postText") or item.get("text") or ""
    links = list(contact_links(text))

    seen = set()
    deduped = []
    for link in links:
        if link["url"] not in seen:
            seen.add(link["url"])
            deduped.append(link)
    return deduped
