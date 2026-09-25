"""Best-effort extraction of contact links/handles from free-text bios.

Same spirit as scoring.py's keyword screens: a crude regex pass over whatever
public "about" text a platform gives us, not a verified/authoritative lookup.

Bios are adversarial: creators dodge scrapers and platform contact filters by
styling text in fancy Unicode fonts, splitting an email with "(at)"/"(dot)", or
labelling a WeChat id with an emoji instead of the word. Before matching we
therefore NFKC-normalise (folds full-width AND mathematical/styled letters and
digits back to ASCII in one step) and de-obfuscate emails, so those cases still
resolve. De-obfuscation stays conservative -- it only rewrites unambiguous "@"
substitutes (symbols/brackets, never a bare word "at") to avoid turning prose
like "meet at home dot org" into a false email.
"""

import re
import unicodedata

FACEBOOK_RE = re.compile(r"https?://(?:www\.|m\.)?facebook\.com/[^\s<>()\"']+", re.I)
INSTAGRAM_RE = re.compile(r"https?://(?:www\.)?instagram\.com/[^\s<>()\"']+", re.I)
TIKTOK_RE = re.compile(r"https?://(?:www\.)?tiktok\.com/[^\s<>()\"']+", re.I)
TELEGRAM_RE = re.compile(r"https?://(?:www\.)?t(?:elegram)?\.me/[^\s<>()\"']+", re.I)
X_RE = re.compile(r"https?://(?:www\.)?(?:x\.com|twitter\.com)/[^\s<>()\"']+", re.I)
ZALO_LINK_RE = re.compile(r"https?://(?:www\.)?zalo\.me/[^\s<>()\"']+", re.I)
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# VN number: +84 / (+84) / bare 84 / leading 0, then 8-9 more digits with common
# separators (space . - and parentheses creators wrap the area code in).
PHONE_RE = re.compile(r"(?<!\d)(?:\(?\+?84\)?|0)(?:[\s.\-]?\d){8,9}(?!\d)")
# China mobile (Douyin creators): 11 digits starting 13x-19x, optional +86 prefix.
# Allow spacing/dots/dashes between digits -- creators break the number up (and
# write it full-width) to dodge Douyin's contact filter; NFKC normalises width first.
CN_PHONE_RE = re.compile(r"(?:\+?86[\s.\-]?)?1[3-9](?:[\s.\-]?\d){9}")

# WeChat is the dominant Douyin contact channel, but bios never say "微信: x"
# cleanly -- the filter strips that. Creators dodge it with homophones (威/薇/徽信,
# 卫星), Latin abbreviations (wx/vx/v:/v+/weixin/wechat) and the "add" emoji
# (🈴=合/"加", ➕/✚=加). Accept those as the label; the id must start with a letter
# and run 6-20 chars, so a phone number isn't mistaken for a WeChat id.
# `\bv(?=[:：])` catches "V:" without also matching "TV:".
# Deliberately NOT included: generic 💬/📱/📲 emoji -- real bios put an ordinary
# word after them ("📱 Telegram", "📲 WhatsApp", "📱 Tecnología"), which those
# labels would wrongly capture as a WeChat id.
# Note: extraction runs on NFKC-normalised text, which folds the squared emoji
# 🈴 to its base CJK char 合 -- so 合 (not 🈴) is what the matcher actually sees.
# Both are listed for safety; ➕/✚ pass through NFKC unchanged.
_WX_LABEL = (
    r"(?:微信|威信|薇信|徽信|卫星|微|薇|威|weixin|wechat|\bwx\b|\bvx\b|\bv\+|\bv(?=[:：])"
    r"|🈴|合|➕|✚)"
)
WECHAT_RE = re.compile(
    _WX_LABEL + r"\s*(?:号|id)?\s*[:：=＝\-、,。\s]*([A-Za-z][-_A-Za-z0-9]{5,19})", re.I
)
# QQ: a 5-12 digit number behind a QQ/扣扣/扣/企鹅 label (group 1).
QQ_RE = re.compile(r"(?:QQ|扣扣|扣|企鹅)\s*(?:号|群)?\s*[:：=＝、,。\s]*(\d{5,12})", re.I)

# NFKC folds full-width and styled/mathematical Unicode back to ASCII, but not the
# middle-dot family creators use in place of the domain dot -- map those too.
_EXTRA_MAP = {ord(c): "." for c in "·•∙・‧⋅"}
# A letter O standing in for a zero, but only when it touches a digit (so "google"
# is untouched). Applied to the phone-matching copy of the text only.
_DIGIT_O_RE = re.compile(r"(?<=\d)[Oo]|[Oo](?=\d)")

# Conservative email de-obfuscation, precision-first. Clean "user@domain.tld"
# already matches EMAIL_RE and is NOT touched here. Two obfuscation shapes are
# recognised, both deliberately narrow to avoid eating social "@handle" mentions:
#   A. a bracketed word substitute for "@"  -- "(at)" / "[at]" / "(a)" -- which is
#      unambiguous, so any dot form (even a plain ".") is accepted after it;
#   B. a SPACED literal "@" -- only when the dot is ALSO obfuscated (spaced or the
#      word "dot"). This lets "info @ gmail . com" through while rejecting
#      "podcast @simpatia.arcano" (a handle: spaced @ but a plain, unspaced dot).
_AT_BRACKET = r"[\(\[\{]\s*(?:at|a)\s*[\)\]\}]"
_DOT_ANY = r"(?:\.|[\(\[\{]\s*dot\s*[\)\]\}]|\bdot\b)"
_DOT_OBFUSCATED = r"(?:\s+\.\s*|\s*\.\s+|[\(\[\{]\s*dot\s*[\)\]\}]|\bdot\b)"
_DOT_WORDED = r"(?:\s*[\(\[\{]\s*dot\s*[\)\]\}]\s*|\s+dot\s+)"  # never a plain "." (that's a normal email)
_LOCAL = r"[A-Za-z0-9._%+-]{1,64}"
_HOST = r"[A-Za-z0-9-]{1,63}"
_TLD = r"[A-Za-z]{2,24}"
_OBFUSCATED_EMAIL_RES = (
    # A: bracketed "@" substitute (strong signal) -> plain dot allowed
    re.compile(r"(" + _LOCAL + r")\s*(?:" + _AT_BRACKET + r")\s*(" + _HOST + r")\s*(?:" + _DOT_ANY + r")\s*(" + _TLD + r")", re.I),
    # B: spaced literal "@" -> require an obfuscated dot too, so "@handle.sub" is not eaten
    re.compile(r"(" + _LOCAL + r")\s+@\s*(" + _HOST + r")(?:" + _DOT_OBFUSCATED + r")(" + _TLD + r")", re.I),
    re.compile(r"(" + _LOCAL + r")\s*@\s+(" + _HOST + r")(?:" + _DOT_OBFUSCATED + r")(" + _TLD + r")", re.I),
    # C: clean "@" but a worded/bracketed domain dot ("info@gmail dot com"). A plain
    # dot is excluded here so ordinary emails stay EMAIL_RE's job, not double-handled.
    re.compile(r"(" + _LOCAL + r")@(" + _HOST + r")(?:" + _DOT_WORDED + r")(" + _TLD + r")", re.I),
)


def _deobfuscate_email(text: str) -> str:
    """Collapse "user (at) domain (dot) com" / "user @ domain . com" ->
    "user@domain.com" in place, so the plain EMAIL_RE then matches it."""
    for pattern in _OBFUSCATED_EMAIL_RES:
        text = pattern.sub(lambda m: f"{m.group(1)}@{m.group(2)}.{m.group(3)}", text)
    return text


def extract_contacts(text) -> dict:
    """Return {facebook, email, zalo, phone, wechat, qq, tiktok, instagram, telegram, x} — blank ("") if not found.

    Accepts a str, None, or a list of strings (some actors return a profile's
    "info"/"about" as a list of lines) -- anything else is coerced to text so a
    caller's mapper never crashes on an unexpected shape."""
    if isinstance(text, list):
        text = " ".join(str(t) for t in text if t)
    elif not isinstance(text, str):
        text = str(text) if text else ""
    text = unicodedata.normalize("NFKC", text)  # full-width + styled Unicode -> ASCII
    text = text.translate(_EXTRA_MAP)           # middle-dot -> "." for split domains

    email_text = _deobfuscate_email(text)       # "(at)"/"(dot)" -> real email
    phone_text = _DIGIT_O_RE.sub("0", text)     # letter-O touching a digit -> zero

    def first(pattern: re.Pattern, source: str = text) -> str:
        match = pattern.search(source)
        return match.group(0) if match else ""

    def first_group(pattern: re.Pattern, source: str = text) -> str:
        match = pattern.search(source)
        return match.group(1) if match else ""

    zalo = first(ZALO_LINK_RE)
    if not zalo:
        for line in phone_text.splitlines():
            if "zalo" in line.casefold():
                phone_match = PHONE_RE.search(line)
                if phone_match:
                    zalo = phone_match.group(0)
                    break

    # VN number wins (keeps existing behaviour); CN mobile is the Douyin fallback.
    phone = first(PHONE_RE, phone_text) or first(CN_PHONE_RE, phone_text)

    return {
        "facebook": first(FACEBOOK_RE),
        "email": first(EMAIL_RE, email_text),
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
