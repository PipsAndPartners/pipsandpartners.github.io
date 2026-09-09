"""YouTube Data API v3 channel mapping."""


def to_entity(item: dict) -> dict:
    snippet = item.get("snippet", {})
    statistics = item.get("statistics", {})
    thumbnails = snippet.get("thumbnails", {})
    avatar = thumbnails.get("high") or thumbnails.get("default") or {}
    channel_id = item.get("id") or item.get("channelId")
    return {
        "platform_id": channel_id,
        "handle": snippet.get("customUrl"),
        "display_name": snippet.get("title"),
        "bio_text": snippet.get("description"),
        "website_url": None,
        "avatar_url": avatar.get("url"),
        "follower_count": int(statistics["subscriberCount"]) if statistics.get("subscriberCount") else None,
        "email_norm": None,
        "source_url": f"https://www.youtube.com/channel/{channel_id}" if channel_id else None,
    }
