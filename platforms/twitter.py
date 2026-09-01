"""Twitter/X tweet & profile scraper actor."""

ACTOR_ID = "apidojo/tweet-scraper"

DEFAULT_INPUT = {
    "searchTerms": ["Forex Affiliate"],
    "maxItems": 25,
}


def build_input(overrides: dict) -> dict:
    run_input = dict(DEFAULT_INPUT)
    if overrides.get("usernames"):
        # Fetch a specific person's own tweets (for engagement scoring) instead
        # of a keyword search.
        run_input.pop("searchTerms", None)
        run_input["twitterHandles"] = overrides["usernames"]
    elif overrides.get("search_query"):
        run_input["searchTerms"] = [overrides["search_query"]]
    return run_input


def to_entity(item: dict) -> dict:
    """Field names for author/engagement verified against Apify's actor docs
    (not yet a live run, unlike linkedin.py).

    This actor returns tweets, not profiles: each item nests the poster under
    `author`. Upserting on (platform, platform_id) naturally dedupes repeat
    authors across many tweets down to one entities row.
    """
    author = item.get("author") or item
    username = author.get("userName")
    return {
        "platform_id": username or author.get("id"),
        "handle": username,
        "display_name": author.get("name"),
        "bio_text": author.get("description"),
        "website_url": author.get("url"),
        "avatar_url": author.get("profilePicture"),
        "follower_count": author.get("followers"),
        "email_norm": None,
        "source_url": f"https://twitter.com/{username}" if username else None,
    }


def extract_engagement(item: dict) -> dict | None:
    """Per-tweet engagement numbers, for averaging across an author's tweets (scoring.py)."""
    likes, retweets, replies = item.get("likeCount"), item.get("retweetCount"), item.get("replyCount")
    if likes is None and retweets is None and replies is None:
        return None
    return {"likes": likes or 0, "shares": retweets or 0, "comments": replies or 0}
