"""Native Telegram channel/group discovery (Telethon, not Apify) — see web/app.py.

No ACTOR_ID / build_input here: Telegram is not scraped through an Apify actor,
so it never goes through pipeline.py. It only needs to_entity() so that
db/loader.py can stage and upsert the native-search hits like any other platform.
"""


def to_entity(item: dict) -> dict:
    platform_id = item.get("platform_id")
    username = item.get("username")
    return {
        "platform_id": str(platform_id) if platform_id not in (None, "") else None,
        "handle": username,
        "display_name": item.get("title"),
        "bio_text": item.get("about"),
        "website_url": None,
        "avatar_url": None,
        "follower_count": item.get("participants_count"),
        "email_norm": None,
        "source_url": f"https://t.me/{username}" if username else None,
    }
