"""Native Telegram channel/group discovery (Telethon, not Apify) — see web/app.py.

No ACTOR_ID / build_input here: Telegram is not scraped through an Apify actor,
so it never goes through pipeline.py. It only needs to_entity() so that
db/loader.py can stage and upsert the native-search hits like any other platform.

A channel's description ("about") is where the owner pastes their direct contact
-- a business email, a Zalo/phone number, an @admin handle or a t.me/Facebook/
Instagram link. We run the same shared contact pass the other platforms use
(discovery/common/contacts.py) so email/phone land in email_norm/phone_norm (and
the loader's safety net folds the rest into entities.contacts), and we expose
extract_related_links() so those cross-platform links show up in the report just
like YouTube's -- see db/export_report.py.
"""

from discovery.common.contacts import contact_links, extract_contacts
from discovery.telegram.extract import extract_about


def _about(item: dict) -> str | None:
    return item.get("about") or item.get("bio_text")


def to_entity(item: dict) -> dict:
    platform_id = item.get("platform_id")
    username = item.get("username") or item.get("handle")
    about = _about(item)
    contacts = extract_contacts(about)
    followers = item.get("participants_count")
    if followers is None:
        followers = item.get("follower_count")
    return {
        "platform_id": str(platform_id) if platform_id not in (None, "") else None,
        "handle": username,
        "display_name": item.get("title") or item.get("display_name"),
        "bio_text": about,
        "website_url": None,
        "avatar_url": None,
        "follower_count": followers,
        "email_norm": contacts["email"].lower() or None,
        "phone_norm": contacts["phone"] or contacts["zalo"] or None,
        "source_url": f"https://t.me/{username}" if username else None,
    }


def extract_related_links(item: dict) -> list[dict]:
    """Direct-contact / other-platform links the owner pasted in the channel
    description -> linkable evidence for the report and cross-platform matching.

    Shared social links (Facebook/Instagram/Telegram/X/TikTok/Zalo) come from the
    same parser the other platforms use; on top of that we add bare Telegram
    @admin handles (t.me/<handle>), which is the owner's usual "contact me" pointer
    on Telegram and which the http-only shared parser doesn't catch."""
    about = _about(item) or ""
    links = contact_links(about)
    seen = {link["url"].lower() for link in links}  # case-insensitive: t.me handles aren't case-sensitive
    for handle in extract_about(about)["telegram_candidates"]:
        url = f"https://t.me/{handle}"
        if url.lower() not in seen:
            seen.add(url.lower())
            links.append({"label": "Telegram", "url": url})
    return links
