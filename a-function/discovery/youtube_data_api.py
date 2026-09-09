"""YouTube discovery through Data API v3, without Apify."""

import argparse
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

from platforms import youtube

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".youtube_api_key.env")
API_ROOT = "https://www.googleapis.com/youtube/v3"
SEARCH_COST = 100
CHANNEL_COST = 1
VIETNAMESE_SIGNAL = ("vietnam", "vietnamese", "việt nam", "viet nam", "người việt", "vn")
OVERSEAS_SIGNAL = ("australia", "melbourne", "sydney", "usa", "united states", "america", "uk", "london", "canada")
FINANCE_SIGNAL = ("forex", "trading", "trade", "financial", "finance", "tài chính", "ngoại hối", "đầu tư", "investment")


class YouTubeApiError(RuntimeError):
    pass


def request(endpoint: str, params: dict) -> dict:
    query = urllib.parse.urlencode(params)
    url = f"{API_ROOT}/{endpoint}?{query}"
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            return json.load(response)
    except Exception as error:
        raise YouTubeApiError(f"YouTube API request failed: {error}") from error


def discover(keywords: list[str], max_results: int = 25) -> dict:
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        raise RuntimeError("Missing YOUTUBE_API_KEY")
    channels: dict[str, dict] = {}
    quota_units = 0
    searches = []
    for keyword in keywords:
        result = request(
            "search",
            {
                "part": "snippet",
                "type": "channel",
                "q": keyword,
                "maxResults": min(max_results, 50),
                "key": api_key,
            },
        )
        quota_units += SEARCH_COST
        searches.append({"keyword": keyword, "raw": result})
        for item in result.get("items", []):
            channel_id = item.get("id", {}).get("channelId")
            if channel_id:
                channels.setdefault(channel_id, {"id": channel_id, "keywords": []})
                if keyword not in channels[channel_id]["keywords"]:
                    channels[channel_id]["keywords"].append(keyword)

    channel_ids = list(channels)
    for start in range(0, len(channel_ids), 50):
        batch = channel_ids[start:start + 50]
        result = request(
            "channels",
            {
                "part": "snippet,statistics,brandingSettings",
                "id": ",".join(batch),
                "key": api_key,
            },
        )
        quota_units += CHANNEL_COST
        for item in result.get("items", []):
            channel_id = item["id"]
            raw = {**item, "discovery_keywords": channels[channel_id]["keywords"]}
            channels[channel_id] = raw

    items = list(channels.values())
    return {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "keywords": keywords,
        "items": items,
        "quota_units": quota_units,
        "quota_model": {"search.list": SEARCH_COST, "channels.list": CHANNEL_COST},
    }


def filter_overseas_vietnamese(items: list[dict]) -> list[dict]:
    """Keep channels with public Vietnamese, overseas, and finance signals."""
    matches = []
    for item in items:
        snippet = item.get("snippet", {})
        text = " ".join((snippet.get("title", ""), snippet.get("description", ""))).lower()
        if (
            any(signal in text for signal in VIETNAMESE_SIGNAL)
            and any(signal in text for signal in OVERSEAS_SIGNAL)
            and any(signal in text for signal in FINANCE_SIGNAL)
        ):
            item["discovery_match"] = "Vietnamese + overseas + finance public text"
            matches.append(item)
    return matches


def rank_channels(items: list[dict], limit: int = 10) -> list[dict]:
    return sorted(
        items,
        key=lambda item: int(item.get("statistics", {}).get("subscriberCount", 0)),
        reverse=True,
    )[:limit]


def save_to_db(items: list[dict], quota_units: int) -> int:
    from db.connection import get_conn
    from db.loader import load_platform_results

    for item in items:
        item["quota_units"] = quota_units
    with get_conn() as conn:
        return load_platform_results(conn, "youtube", items)


def main() -> None:
    parser = argparse.ArgumentParser(description="Discover YouTube channels with Data API v3")
    parser.add_argument("keywords", nargs="+", help="Search terms")
    parser.add_argument("--max-results", type=int, default=25)
    parser.add_argument("--output", type=Path, default=Path("results/youtube_data_api.json"))
    parser.add_argument("--no-db", action="store_true")
    parser.add_argument("--overseas-vietnamese", action="store_true")
    parser.add_argument("--top", type=int, default=10)
    args = parser.parse_args()

    result = discover(args.keywords, args.max_results)
    if args.overseas_vietnamese:
        result["items"] = filter_overseas_vietnamese(result["items"])
        result["filter"] = "Vietnamese + overseas + finance public text"
    result["items"] = rank_channels(result["items"], args.top)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    loaded = None
    if not args.no_db:
        try:
            loaded = save_to_db(result["items"], result["quota_units"])
        except Exception as error:
            print(f"database load skipped: {error}")
    print(json.dumps({"channels": len(result["items"]), "quota_units": result["quota_units"], "loaded": loaded}))
    print(f"saved -> {args.output}")


if __name__ == "__main__":
    main()
