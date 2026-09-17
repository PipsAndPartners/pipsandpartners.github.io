"""Best-effort extraction of contact links/handles from free-text bios.

Same spirit as scoring.py's keyword screens: a crude regex pass over whatever
public "about" text a platform gives us, not a verified/authoritative lookup.
"""

import re

FACEBOOK_RE = re.compile(r"https?://(?:www\.|m\.)?facebook\.com/[^\s<>()\"']+", re.I)
INSTAGRAM_RE = re.compile(r"https?://(?:www\.)?instagram\.com/[^\s<>()\"']+", re.I)
TIKTOK_RE = re.compile(r"https?://(?:www\.)?tiktok\.com/[^\s<>()\"']+", re.I)
TELEGRAM_RE = re.compile(r"https?://(?:www\.)?t(?:elegram)?\.me/[^\s<>()\"']+", re.I)
X_RE = re.compile(r"https?://(?:www\.)?(?:x\.com|twitter\.com)/[^\s<>()\"']+", re.I)
ZALO_LINK_RE = re.compile(r"https?://(?:www\.)?zalo\.me/[^\s<>()\"']+", re.I)
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?:\+84|0)(?:[\s.\-]?\d){8,9}")


def extract_contacts(text) -> dict:
    """Return {facebook, email, zalo, phone, tiktok, instagram, telegram, x} — blank ("") if not found.

    Accepts a str, None, or a list of strings (some actors return a profile's
    "info"/"about" as a list of lines) -- anything else is coerced to text so a
    caller's mapper never crashes on an unexpected shape."""
    if isinstance(text, list):
        text = " ".join(str(t) for t in text if t)
    elif not isinstance(text, str):
        text = str(text) if text else ""

    def first(pattern: re.Pattern) -> str:
        match = pattern.search(text)
        return match.group(0) if match else ""

    zalo = first(ZALO_LINK_RE)
    if not zalo:
        for line in text.splitlines():
            if "zalo" in line.casefold():
                phone_match = PHONE_RE.search(line)
                if phone_match:
                    zalo = phone_match.group(0)
                    break

    return {
        "facebook": first(FACEBOOK_RE),
        "email": first(EMAIL_RE),
        "zalo": zalo,
        "phone": first(PHONE_RE),
        "tiktok": first(TIKTOK_RE),
        "instagram": first(INSTAGRAM_RE),
        "telegram": first(TELEGRAM_RE),
        "x": first(X_RE),
    }


_SOCIAL_LABELS = {
    "facebook": "Facebook",
    "instagram": "Instagram",
    "telegram": "Telegram",
    "x": "X/Twitter",
    "tiktok": "TikTok",
    "zalo": "Zalo",
}


def contact_links(text: str | None) -> list[dict]:
    """Social/contact URLs mentioned in bio text as [{label, url}], deduped.

    Only http(s) values (a zalo phone-number match is skipped here -- it belongs
    in phone_norm, not a link). Used by platform extract_related_links() so any
    other-platform accounts an IB pastes in their bio become linkable evidence.
    """
    contacts = extract_contacts(text)
    links, seen = [], set()
    for key, label in _SOCIAL_LABELS.items():
        url = contacts.get(key)
        if url and url.startswith("http") and url not in seen:
            seen.add(url)
            links.append({"label": label, "url": url})
    return links
