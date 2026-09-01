"""Instagram profile scraper actor."""

ACTOR_ID = "apify/instagram-profile-scraper"

DEFAULT_INPUT = {
    "usernames": ["nasa"],
}


def build_input(overrides: dict) -> dict:
    run_input = dict(DEFAULT_INPUT)
    if overrides.get("usernames"):
        run_input["usernames"] = overrides["usernames"]
    return run_input


def to_entity(item: dict) -> dict:
    """Best-effort mapping -- field names unverified against a real run, unlike linkedin.py."""
    username = item.get("username")
    return {
        "platform_id": username or item.get("id"),
        "handle": username,
        "display_name": item.get("fullName"),
        "bio_text": item.get("biography"),
        "website_url": item.get("externalUrl"),
        "avatar_url": item.get("profilePicUrlHD") or item.get("profilePicUrl"),
        "follower_count": item.get("followersCount"),
        "email_norm": None,
        "source_url": f"https://www.instagram.com/{username}/" if username else None,
    }
