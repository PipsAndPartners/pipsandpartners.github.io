"""YouTube discovery through Data API v3, without Apify."""

import argparse
import json
import os
import time
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

# Adjacent niches -- not forex, but Vietnamese-in-Australia creators one step away
# whose audience overlaps (potential IBs). --au keeps VN channels that match
# FINANCE_SIGNAL *or* one of these, so the net is wider than strict forex.
ADJACENT_SIGNAL = (
    "crypto", "bitcoin", "coin", "chứng khoán", "chung khoan", "cổ phiếu",
    "tài chính cá nhân", "quản lý tài chính", "tự do tài chính", "làm giàu", "kiếm tiền",
    "passive income", "thu nhập thụ động", "kinh doanh", "khởi nghiệp", "startup", "mmo",
    "bất động sản", "real estate", "property", "bảo hiểm", "định cư đầu tư",
    "coaching", "mentor", "money", "wealth",
)

# Australia signals for --au. A VN-in-AU creator rarely writes "Australia" in the
# bio, so we accept any of: a city/suburb, an ASIC/AU broker (they promote their
# local sàn), an AU currency/regulator/phone marker, or a bare "Úc" only in a
# phrase (plain "úc" is a substring of many Vietnamese words -> false positives).
AU_SIGNAL = (
    "australia", "australian", "aussie",
    " úc ", "ở úc", "tại úc", "bên úc", "nước úc", "úc châu", "sống ở úc", "định cư úc", "du học úc",
    "sydney", "melbourne", "brisbane", "perth", "adelaide", "canberra", "gold coast",
    "cabramatta", "bankstown", "footscray", "springvale", "st albans",
    "asic", " aud ", "aud.", "aest", "aedt", ".com.au", "+61", "0061",
    "tmgm", "pepperstone", "ic markets", "icmarkets", "vantage", "eightcap",
    "blackbull", "black bull", "go markets", "gomarkets",
)
# Geo-AU markers in a discovery keyword: if the term that surfaced a channel is
# itself AU-located, keep the channel even when its bio is silent on location
# (its AU signal may live only in the videos -> confirmed later by video enrich).
AU_KEYWORD_MARK = (
    "úc", "australia", "sydney", "melbourne", "brisbane", "perth", "adelaide",
    "cabramatta", "bankstown", "footscray", "springvale", "st albans",
)


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


def discover(keywords: list[str], max_results: int = 25,
             region_code: str | None = None, relevance_language: str | None = None,
             skip_ids: set[str] | None = None) -> dict:
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        raise RuntimeError("Missing YOUTUBE_API_KEY")
    skip_ids = skip_ids or set()
    channels: dict[str, dict] = {}
    quota_units = 0
    searches = []
    for keyword in keywords:
        params = {
            "part": "snippet",
            "type": "channel",
            "q": keyword,
            "maxResults": min(max_results, 50),
            "key": api_key,
        }
        # Bias results to a market/language so a broad brand keyword doesn't pull
        # the broker's own foreign channels (e.g. "XTB" -> XTB Italia/UK/Deutschland).
        if region_code:
            params["regionCode"] = region_code
        if relevance_language:
            params["relevanceLanguage"] = relevance_language
        result = request("search", params)
        quota_units += SEARCH_COST
        searches.append({"keyword": keyword, "raw": result})
        time.sleep(0.5)  # back-to-back search.list calls trip Google's short-window rate limit (429)
        for item in result.get("items", []):
            channel_id = item.get("id", {}).get("channelId")
            if channel_id:
                channels.setdefault(channel_id, {"id": channel_id, "keywords": []})
                if keyword not in channels[channel_id]["keywords"]:
                    channels[channel_id]["keywords"].append(keyword)

    # Watermark skip: drop channels already loaded within the refresh window so we
    # don't re-fetch channels.list details or re-persist them. search.list is spent
    # regardless (it can't be skipped), but this still avoids redundant re-processing.
    skipped = [cid for cid in channels if cid in skip_ids]
    for cid in skipped:
        del channels[cid]

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
        "skipped_fresh": len(skipped),
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


def filter_vietnamese_au(items: list[dict]) -> list[dict]:
    """Keep Vietnamese finance channels that look Australia-based.

    AU is satisfied by (a) the channel's declared country == AU, (b) an AU signal
    in the public title/description, or (c) the term that surfaced it being itself
    AU-located (bio may be silent -- video enrich confirms the geo later)."""
    matches = []
    for item in items:
        snippet = item.get("snippet", {})
        text = " ".join((snippet.get("title", ""), snippet.get("description", ""))).lower()
        keywords = " ".join(item.get("discovery_keywords", [])).lower()
        vn = any(signal in text for signal in VIETNAMESE_SIGNAL)
        finance = (any(signal in text for signal in FINANCE_SIGNAL)
                   or any(signal in text for signal in ADJACENT_SIGNAL))
        au = (
            snippet.get("country") == "AU"
            or any(signal in text for signal in AU_SIGNAL)
            or any(mark in keywords for mark in AU_KEYWORD_MARK)
        )
        if vn and finance and au:
            if snippet.get("country") == "AU":
                why = "country=AU"
            elif any(signal in text for signal in AU_SIGNAL):
                why = "AU text in bio"
            else:
                why = "surfaced by an AU keyword"
            item["discovery_match"] = f"Vietnamese + finance + Australia ({why})"
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
    parser.add_argument("keywords", nargs="*", help="Search terms (or use --keywords-file)")
    parser.add_argument("--keywords-file", type=Path, default=None,
                        help="read search terms from a file, one per line (# = comment); "
                             "merged with any positional keywords")
    parser.add_argument("--max-results", type=int, default=25)
    parser.add_argument("--output", type=Path, default=Path("results/youtube_data_api.json"))
    parser.add_argument("--no-db", action="store_true")
    parser.add_argument("--overseas-vietnamese", action="store_true")
    parser.add_argument("--au", action="store_true",
                        help="keep only Vietnamese finance channels that look Australia-based")
    parser.add_argument("--top", type=int, default=10)
    parser.add_argument("--relevance-language", default="vi",
                        help="bias results to this language (default vi); '' to disable")
    parser.add_argument("--region-code", default=None,
                        help="bias results to this region, e.g. VN; off by default so "
                             "--overseas-vietnamese still finds VN creators living abroad")
    parser.add_argument("--refresh-after", type=int, default=30,
                        help="skip re-fetching channels loaded within this many days (default 30)")
    parser.add_argument("--force", action="store_true",
                        help="ignore the refresh window and re-fetch every match")
    args = parser.parse_args()

    keywords = list(args.keywords)
    if args.keywords_file:
        for line in args.keywords_file.read_text(encoding="utf-8").splitlines():
            line = line.split("#", 1)[0].strip()
            if line:
                keywords.append(line)
    if not keywords:
        parser.error("no keywords: pass search terms or --keywords-file")

    # Watermark: channels loaded within the refresh window are skipped (see discover).
    skip_ids: set[str] = set()
    if not args.no_db and not args.force:
        try:
            from datetime import timedelta

            from db.connection import get_conn
            from discovery.common.watermark import fresh_platform_ids

            with get_conn() as conn:
                skip_ids = fresh_platform_ids(conn, "youtube", timedelta(days=args.refresh_after))
        except Exception as error:  # noqa: BLE001 - watermark is an optimisation, not required
            print(f"watermark skip disabled: {error}")

    # A hard region lock would defeat the overseas-Vietnamese / AU search, so only
    # the language bias applies in those modes.
    region_code = None if (args.overseas_vietnamese or args.au) else args.region_code
    result = discover(keywords, args.max_results,
                      region_code=region_code or None, relevance_language=args.relevance_language or None,
                      skip_ids=skip_ids)
    if args.au:
        result["items"] = filter_vietnamese_au(result["items"])
        result["filter"] = "Vietnamese + finance + Australia"
    elif args.overseas_vietnamese:
        result["items"] = filter_overseas_vietnamese(result["items"])
        result["filter"] = "Vietnamese + overseas + finance public text"

    # Persist EVERY discovered channel first, so dedup on later runs is reliable.
    # (Truncating with --top before the DB load used to drop channels beyond the
    # top-N from the database entirely, so a shortlist could show a channel that
    # was never actually recorded -- and a re-run would rediscover it as "new".)
    loaded = None
    if not args.no_db:
        try:
            loaded = save_to_db(result["items"], result["quota_units"])
        except Exception as error:
            print(f"database load skipped: {error}")

    discovered = len(result["items"])
    result["items"] = rank_channels(result["items"], args.top)  # top-N is only the export view
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"discovered": discovered, "exported_top": len(result["items"]),
                      "skipped_fresh": result.get("skipped_fresh", 0),
                      "quota_units": result["quota_units"], "loaded": loaded}))
    print(f"saved -> {args.output}")


if __name__ == "__main__":
    main()
