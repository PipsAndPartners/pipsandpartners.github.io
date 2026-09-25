"""YouTube Data API v3 channel mapping.

The channel description (snippet.description) is free text where creators paste
their contact details -- a business email, a Zalo/phone number, links to their
other platforms. We run the same bio contact-extraction pass the other platforms
use (discovery/common/contacts.py) so those land in email_norm / phone_norm and
feed cross-platform identity resolution (db/02_resolve.sql), instead of being
thrown away. (YouTube's separate "business email" behind the About-page captcha
is not exposed by the API and is out of scope here.)
"""

from discovery.common.contacts import contact_links, extract_contacts


def to_entity(item: dict) -> dict:
    snippet = item.get("snippet", {})
    statistics = item.get("statistics", {})
    thumbnails = snippet.get("thumbnails", {})
    avatar = thumbnails.get("high") or thumbnails.get("default") or {}
    channel_id = item.get("id") or item.get("channelId")
    description = snippet.get("description")
    contacts = extract_contacts(description)
    return {
        "platform_id": channel_id,
        "handle": snippet.get("customUrl"),
        "display_name": snippet.get("title"),
        "bio_text": description,
        "website_url": None,
        "avatar_url": avatar.get("url"),
        "follower_count": int(statistics["subscriberCount"]) if statistics.get("subscriberCount") else None,
        "email_norm": contacts["email"].lower() or None,
        "phone_norm": contacts["phone"] or contacts["zalo"] or None,
        "source_url": f"https://www.youtube.com/channel/{channel_id}" if channel_id else None,
    }


def extract_related_links(item: dict) -> list[dict]:
    """Other-platform accounts (Facebook/Telegram/Instagram/X/TikTok/Zalo) the
    creator pasted in the channel description -> linkable evidence for the report
    and for cross-platform matching."""
    description = (item.get("snippet") or {}).get("description") or ""
    return contact_links(description)
