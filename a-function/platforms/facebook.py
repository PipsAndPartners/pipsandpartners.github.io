"""Facebook page/profile scraper actor."""

ACTOR_ID = "apify/facebook-pages-scraper"

DEFAULT_INPUT = {
    "startUrls": [{"url": "https://www.facebook.com/nasa"}],
}


def build_input(overrides: dict) -> dict:
    run_input = dict(DEFAULT_INPUT)
    if overrides.get("urls"):
        run_input["startUrls"] = [{"url": url} for url in overrides["urls"]]
    return run_input


def to_entity(item: dict) -> dict:
    """Best-effort mapping -- field names unverified against a real run, unlike linkedin.py."""
    page_url = item.get("pageUrl") or item.get("url")
    return {
        "platform_id": item.get("pageId") or page_url,
        "handle": item.get("pageName") or item.get("username"),
        "display_name": item.get("title") or item.get("name"),
        "bio_text": item.get("intro") or item.get("about"),
        "website_url": item.get("website"),
        "avatar_url": item.get("profilePictureUrl"),
        "follower_count": item.get("followers") or item.get("likes"),
        "email_norm": None,
        "source_url": page_url,
    }
