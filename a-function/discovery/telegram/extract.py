"""Extract contact and public Telegram candidates from channel descriptions."""

import re
from urllib.parse import urlparse

EMAIL_RE = re.compile(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b")
PHONE_RE = re.compile(r"(?<!\w)(?:\+?(?:84|61)\s?\d(?:[\s.-]?\d){7,11})(?!\w)")
TELEGRAM_RE = re.compile(r"(?:https?://)?(?:www\.)?t\.me/([A-Za-z][A-Za-z0-9_]{3,31})", re.I)
HANDLE_RE = re.compile(r"(?<![\w])@([A-Za-z][A-Za-z0-9_]{3,31})")
SOCIAL_DOMAINS = (
    "facebook.com", "youtube.com", "tiktok.com", "instagram.com", "zalo.me"
)


def _normalise_phone(value: str) -> str:
    return "+" + re.sub(r"\D", "", value).lstrip("+")


def extract_about(about: str | None) -> dict[str, list[str]]:
    text = about or ""
    emails = sorted({value.lower() for value in EMAIL_RE.findall(text)})
    phones = sorted({_normalise_phone(value) for value in PHONE_RE.findall(text)})
    urls = set(re.findall(r"https?://[^\s<>()]+", text, re.I))
    websites = set()
    social_links = set()
    for url in urls:
        clean = url.rstrip(".,;)")
        host = (urlparse(clean).hostname or "").lower().removeprefix("www.")
        if host == "t.me":
            continue
        if any(host == domain or host.endswith("." + domain) for domain in SOCIAL_DOMAINS):
            social_links.add(clean)
        else:
            websites.add(clean)
    candidates = {match.lower() for match in TELEGRAM_RE.findall(text)}
    candidates.update(match.lower() for match in HANDLE_RE.findall(text))
    return {
        "phones": phones,
        "emails": emails,
        "websites": sorted(websites),
        "social_links": sorted(social_links),
        "telegram_candidates": sorted(candidates),
    }
