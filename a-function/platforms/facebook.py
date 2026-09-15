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


def to_entity(item: dict) -> dict:
    """Map one Facebook Page search result to an entity, keeping contact fields.

    The full raw item (every contact field) is preserved in staging_facebook by
    db/loader.py; this is the deduped entities view.
    """
    page_url = item.get("pageUrl") or item.get("facebookUrl")
    page_id = item.get("pageId") or item.get("facebookId") or page_url
    email = item.get("email")
    return {
        "platform_id": str(page_id) if page_id else None,
        "handle": item.get("pageName"),
        "display_name": item.get("title") or item.get("pageName"),
        "bio_text": item.get("info") or item.get("about_me"),
        "website_url": item.get("website"),
        "avatar_url": item.get("profilePhoto") or item.get("profilePictureUrl"),
        "follower_count": item.get("followers") or item.get("likes"),
        "email_norm": email.strip().lower() if email else None,
        "phone_norm": item.get("phone"),
        "messenger_url": item.get("messenger"),
        "source_url": page_url,
    }
