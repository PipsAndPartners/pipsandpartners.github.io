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
# China mobile (Douyin creators): 11 digits starting 13x-19x, optional +86 prefix.
# Allow spacing/dots/dashes between digits -- creators break the number up (and
# write it full-width) to dodge Douyin's contact filter; we normalise width first.
CN_PHONE_RE = re.compile(r"(?:\+?86[\s.\-]?)?1[3-9](?:[\s.\-]?\d){9}")

# WeChat is the dominant Douyin contact channel, but bios never say "微信: x"
# cleanly -- the filter strips that. Creators dodge it with homophones (威/薇/徽信,
# 卫星), Latin abbreviations (wx/vx/weixin/wechat) and emoji-as-label (🈴=合/"加",
# ➕/＋=加). Accept all of those as the label; the id still must start with a letter
# and run 6-20 chars, so a plain phone number isn't mistaken for a WeChat id.
_WX_LABEL = r"(?:微信|威信|薇信|徽信|卫星|微|薇|威|weixin|wechat|\bwx\b|\bvx\b|🈴|➕|＋|✚)"
WECHAT_RE = re.compile(
    _WX_LABEL + r"\s*(?:号|id)?\s*[:：=＝\-、,。\s]*([A-Za-z][-_A-Za-z0-9]{5,19})", re.I
)
# QQ: a 5-12 digit number behind a QQ/扣扣/扣/企鹅 label (group 1).
QQ_RE = re.compile(r"(?:QQ|扣扣|扣|企鹅)\s*(?:号|群)?\s*[:：=＝、,。\s]*(\d{5,12})", re.I)

# Full-width digits/letters/symbols -> ASCII, so obfuscated ('１３８…', '：', '＋')
# contacts normalise before the regex pass. Covers U+FF01..FF5E plus IDEO space.
_FW_MAP = {c: c - 0xFEE0 for c in range(0xFF01, 0xFF5F)}
_FW_MAP[0x3000] = 0x20


def extract_contacts(text) -> dict:
    """Return {facebook, email, zalo, phone, wechat, qq, tiktok, instagram, telegram, x} — blank ("") if not found.

    Accepts a str, None, or a list of strings (some actors return a profile's
    "info"/"about" as a list of lines) -- anything else is coerced to text so a
    caller's mapper never crashes on an unexpected shape."""
    if isinstance(text, list):
        text = " ".join(str(t) for t in text if t)
    elif not isinstance(text, str):
        text = str(text) if text else ""
    text = text.translate(_FW_MAP)  # full-width '１３８'/'：'/'＋' -> ASCII before matching

    def first(pattern: re.Pattern) -> str:
        match = pattern.search(text)
        return match.group(0) if match else ""

    def first_group(pattern: re.Pattern) -> str:
        match = pattern.search(text)
        return match.group(1) if match else ""

    zalo = first(ZALO_LINK_RE)
    if not zalo:
        for line in text.splitlines():
            if "zalo" in line.casefold():
                phone_match = PHONE_RE.search(line)
                if phone_match:
                    zalo = phone_match.group(0)
                    break

    # VN number wins (keeps existing behaviour); CN mobile is the Douyin fallback.
    phone = first(PHONE_RE) or first(CN_PHONE_RE)

    return {
        "facebook": first(FACEBOOK_RE),
        "email": first(EMAIL_RE),
        "zalo": zalo,
        "phone": phone,
        "wechat": first_group(WECHAT_RE),
        "qq": first_group(QQ_RE),
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
