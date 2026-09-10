"""X (Twitter) discovery through the X API v2 recent-search endpoint.

Requires a paid API tier (the Free tier has no search access) and a Bearer
Token in X_BEARER_TOKEN. Unlike YouTube's channel search, this searches
*tweets* matching the keyword and collects the distinct authors of the
matches (recent-search only, so it's capped to roughly the last 7 days).
"""

import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".x_api_key.env")
API_ROOT = "https://api.x.com/2"


class XApiError(RuntimeError):
    pass


def request(endpoint: str, params: dict) -> dict:
    token = os.getenv("X_BEARER_TOKEN")
    if not token:
        raise RuntimeError("Missing X_BEARER_TOKEN")
    query = urllib.parse.urlencode(params)
    url = f"{API_ROOT}/{endpoint}?{query}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except Exception as error:
        raise XApiError(f"X API request failed: {error}") from error


def discover(keywords: list[str], max_results: int = 25) -> dict:
    accounts: dict[str, dict] = {}
    requests_made = 0
    for keyword in keywords:
        result = request(
            "tweets/search/recent",
            {
                "query": f"{keyword} -is:retweet",
                "max_results": max(10, min(max_results, 100)),
                "expansions": "author_id",
                "user.fields": "username,name,description,location,public_metrics,profile_image_url",
            },
        )
        requests_made += 1
        for user in result.get("includes", {}).get("users", []):
            user_id = user["id"]
            accounts.setdefault(user_id, {**user, "discovery_keywords": []})
            if keyword not in accounts[user_id]["discovery_keywords"]:
                accounts[user_id]["discovery_keywords"].append(keyword)

    items = []
    for user_id, user in accounts.items():
        metrics = user.get("public_metrics", {})
        items.append({
            "id": user_id,
            "username": user.get("username"),
            "name": user.get("name"),
            "description": user.get("description"),
            "location": user.get("location"),
            "public_metrics": metrics,
            "discovery_keywords": user["discovery_keywords"],
            # Shaped like the Apify tweet-scraper's `author` field so
            # platforms.twitter.to_entity() (built for that shape) works unchanged.
            "author": {
                "id": user_id,
                "userName": user.get("username"),
                "name": user.get("name"),
                "description": user.get("description"),
                "url": None,
                "profilePicture": user.get("profile_image_url"),
                "followers": metrics.get("followers_count"),
            },
        })

    return {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "keywords": keywords,
        "items": items,
        "requests_made": requests_made,
    }
