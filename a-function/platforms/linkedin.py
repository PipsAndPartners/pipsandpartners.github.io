"""LinkedIn profile search actor."""

import re

ACTOR_ID = "M2FMdjRVeF1HPGFcc"

_URL_PATTERN = re.compile(r"https?://[^\s,)]+")

DEFAULT_INPUT = {
    "searchQuery": "Forex Affiliate",
    "currentJobTitles": [
        "Founder",
        "CEO",
        "Business Development",
        "Partnership",
        "Affiliate",
    ],
    "locations": ["Vietnam", "Singapore"],
    "profileScraperMode": "Full",
    "maxItems": 25,
    "startPage": 1,
    "takePages": 2,
}


def build_input(overrides: dict) -> dict:
    run_input = dict(DEFAULT_INPUT)
    if overrides.get("search_query"):
        run_input["searchQuery"] = overrides["search_query"]
    return run_input


def to_entity(item: dict) -> dict:
    """Map a raw actor result item to the common `entities` row shape (db/01_schema.sql)."""
    position = (item.get("currentPosition") or [{}])[0]
    emails = item.get("emails") or []
    phones = item.get("phoneNumbers") or item.get("phones") or []
    display_name = " ".join(filter(None, [item.get("firstName"), item.get("lastName")])) or None
    return {
        "platform_id": item.get("publicIdentifier") or item.get("id"),
        "handle": item.get("publicIdentifier"),
        "display_name": display_name,
        "bio_text": " ".join(filter(None, [item.get("headline"), item.get("about")])).strip() or None,
        "website_url": position.get("companyLinkedinUrl"),
        # field name varies by actor build; try the common spellings, else None.
        "avatar_url": (
            item.get("profilePicture")
            or item.get("profilePictureUrl")
            or item.get("pictureUrl")
            or item.get("photoUrl")
        ),
        "follower_count": item.get("followerCount"),
        "email_norm": emails[0].strip().lower() if emails else None,
        "phone_norm": (phones[0] if isinstance(phones, list) and phones else item.get("phone")) or None,
        "source_url": item.get("linkedinUrl"),
    }


def extract_related_links(item: dict) -> list[dict]:
    """Other links found in the raw profile: employer LinkedIn pages + any URL
    mentioned in the bio (personal sites, trading pages, etc.)."""
    links = []
    for exp in item.get("experience") or []:
        company_url = exp.get("companyLinkedinUrl")
        if company_url:
            company_name = exp.get("companyName")
            links.append({"label": f"Company: {company_name}" if company_name else "Company", "url": company_url})

    for site in item.get("websites") or []:
        url = site.get("url") if isinstance(site, dict) else site
        if url:
            label = site.get("label") if isinstance(site, dict) else None
            links.append({"label": f"Website: {label}" if label else "Website", "url": url})

    about = item.get("about") or ""
    for url in _URL_PATTERN.findall(about):
        links.append({"label": "Bio link", "url": url.rstrip(".,)")})

    seen = set()
    deduped = []
    for link in links:
        if link["url"] not in seen:
            seen.add(link["url"])
            deduped.append(link)
    return deduped
