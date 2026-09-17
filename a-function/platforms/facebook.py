"""Facebook Pages search actor.

Uses apify/facebook-search-scraper, which searches for *Pages* (not posts) by
keyword + location and returns each Page's contact fields. Notes that matter for
running it (E6 / dependency 6.1):

- ``categories`` is REQUIRED and behaves as free-text search keywords, not
  Facebook's fixed category list.
- It searches PAGES, not posts, and has NO date filter.
- Billing is roughly $0.012 per page returned, so ``resultsLimit`` caps the spend.
  The final item count is only known after a real run.
"""

from discovery.common.contacts import contact_links

ACTOR_ID = "apify/facebook-search-scraper"

DEFAULT_INPUT = {
    "categories": ["forex"],       # required; acts as search keywords
    "locations": ["Vietnam"],
    "resultsLimit": 50,
}


def build_input(overrides: dict) -> dict:
    run_input = {
        "categories": list(DEFAULT_INPUT["categories"]),
        "locations": list(DEFAULT_INPUT["locations"]),
        "resultsLimit": DEFAULT_INPUT["resultsLimit"],
    }
    # pipeline.py passes --search-query as `search_query`; the web console can set
    # categories/locations/resultsLimit directly in the raw JSON.
    if overrides.get("search_query"):
        run_input["categories"] = [overrides["search_query"]]
    if overrides.get("categories"):
        run_input["categories"] = overrides["categories"]
    if overrides.get("locations"):
        run_input["locations"] = overrides["locations"]
    if overrides.get("resultsLimit") is not None:
        run_input["resultsLimit"] = overrides["resultsLimit"]
    return run_input


def _text(value) -> str:
    """Flatten a field that the actor may return as either a string or a list of
    strings (``info`` comes back as a list, ``about_me`` as a string/None)."""
    if isinstance(value, list):
        return " ".join(str(v) for v in value if v)
    return str(value) if value else ""


def _category_text(item: dict) -> str:
    return _text(item.get("categories") or item.get("category"))


def to_entity(item: dict) -> dict:
    """Map one Facebook Page search result to an entity, keeping contact fields.

    The full raw item (every contact field: address, rating, ad_status,
    priceRange, creation_date, ...) is preserved in staging_facebook by
    db/loader.py; this is the deduped entities view. The Page's categories are
    folded into bio_text so scoring.score_creator_relevance can see them (a Page
    tagged "Forex Broker" should read as relevant even with an empty description).
    """
    page_url = item.get("pageUrl") or item.get("facebookUrl")
    page_id = item.get("pageId") or item.get("facebookId") or page_url
    email = item.get("email")
    bio = " ".join(filter(None, [_text(item.get("info")), _text(item.get("about_me")), _category_text(item)])).strip()
    return {
        "platform_id": str(page_id) if page_id else None,
        "handle": item.get("pageName"),
        "display_name": item.get("title") or item.get("pageName"),
        "bio_text": bio or None,
        "website_url": item.get("website"),
        "avatar_url": item.get("profilePhoto") or item.get("profilePictureUrl"),
        "follower_count": item.get("followers") or item.get("likes"),
        "email_norm": email.strip().lower() if email else None,
        "phone_norm": item.get("phone"),
        "messenger_url": item.get("messenger"),
        "source_url": page_url,
    }


def extract_related_links(item: dict) -> list[dict]:
    """Contactable links for outreach + cross-platform identity evidence: the
    Page's own website, its Messenger link, and any other-platform account pasted
    into its info/about text."""
    links = []
    website = item.get("website")
    if website:
        links.append({"label": "Website", "url": website if website.startswith("http") else f"https://{website}"})
    messenger = item.get("messenger")
    if messenger:
        links.append({"label": "Messenger", "url": messenger})

    corpus = " ".join(filter(None, [_text(item.get("info")), _text(item.get("about_me")), item.get("website")]))
    links.extend(contact_links(corpus))

    seen = set()
    deduped = []
    for link in links:
        if link["url"] not in seen:
            seen.add(link["url"])
            deduped.append(link)
    return deduped
