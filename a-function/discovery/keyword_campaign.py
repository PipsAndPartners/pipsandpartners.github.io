"""Keyword-first discovery across public Telegram and Instagram search results."""

import argparse
import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from apify_client import ApifyClient
from dotenv import load_dotenv
from telethon.tl.functions.contacts import SearchRequest

from discovery.telegram.client import Settings, build_client

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
INSTAGRAM_HOSTS = {"instagram.com", "www.instagram.com"}
INSTAGRAM_PATH_EXCLUDE = {"p", "reel", "reels", "explore", "accounts", "direct"}


def instagram_username(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.hostname not in INSTAGRAM_HOSTS:
        return None
    parts = [part for part in parsed.path.split("/") if part]
    if not parts or parts[0].lower() in INSTAGRAM_PATH_EXCLUDE:
        return None
    username = parts[0].lstrip("@").lower()
    return username if re.fullmatch(r"[a-z0-9._]{1,30}", username) else None


async def search_telegram(keywords: list[str], limit: int) -> list[dict]:
    settings = Settings.from_env()
    found: dict[str, dict] = {}
    async with build_client(settings) as client:
        for keyword in keywords:
            async for message in client.iter_messages(None, search=keyword, limit=limit):
                chat = await message.get_chat()
                chat_id = getattr(chat, "id", None)
                if chat_id is None or not (
                    getattr(chat, "broadcast", False)
                    or getattr(chat, "megagroup", False)
                    or getattr(chat, "gigagroup", False)
                ):
                    continue
                username = getattr(chat, "username", None)
                key = str(chat_id)
                found.setdefault(
                    key,
                    {
                        "platform": "telegram",
                        "platform_id": key,
                        "username": username,
                        "title": getattr(chat, "title", None),
                        "source": "telegram:global_search",
                        "keywords": [],
                        "message_url": (
                            f"https://t.me/{username}/{message.id}" if username else None
                        ),
                    },
                )
                if keyword not in found[key]["keywords"]:
                    found[key]["keywords"].append(keyword)
    return list(found.values())


async def search_telegram_entities(keywords: list[str], limit: int) -> list[dict]:
    """Find public channels/groups by Telegram entity search, not message search."""
    settings = Settings.from_env()
    found: dict[str, dict] = {}
    async with build_client(settings) as client:
        for keyword in keywords:
            result = await client(SearchRequest(q=keyword, limit=limit))
            for chat in getattr(result, "chats", []):
                if not (
                    getattr(chat, "broadcast", False)
                    or getattr(chat, "megagroup", False)
                    or getattr(chat, "gigagroup", False)
                ):
                    continue
                chat_id = str(getattr(chat, "id", ""))
                found.setdefault(
                    chat_id,
                    {
                        "platform": "telegram",
                        "platform_id": chat_id,
                        "username": getattr(chat, "username", None),
                        "title": getattr(chat, "title", None),
                        "entity_type": (
                            "megagroup" if getattr(chat, "megagroup", False)
                            else "gigagroup" if getattr(chat, "gigagroup", False)
                            else "channel"
                        ),
                        "source": "telegram:entity_search",
                        "keywords": [],
                    },
                )
                if keyword not in found[chat_id]["keywords"]:
                    found[chat_id]["keywords"].append(keyword)
    return list(found.values())


def _iter_search_rows(item: dict):
    nested = item.get("organicResults") or item.get("organic_results")
    if isinstance(nested, list):
        yield from nested
    else:
        yield item


def search_instagram(keywords: list[str], limit: int) -> list[dict]:
    import os

    token = os.environ.get("APIFY_TOKEN")
    if not token:
        raise RuntimeError("Missing APIFY_TOKEN")
    client = ApifyClient(token)
    query = " OR ".join(f'"{keyword}"' for keyword in keywords)
    run = client.actor("apify/google-search-scraper").call(
        run_input={
            "queries": f"site:instagram.com ({query})",
            "maxPagesPerQuery": 1,
            "resultsPerPage": limit,
            "mobileResults": False,
        }
    )
    found: dict[str, dict] = {}
    for item in client.dataset(run.default_dataset_id).iterate_items():
        for row in _iter_search_rows(item):
            url = row.get("url") or row.get("link")
            username = instagram_username(url or "")
            if not username:
                continue
            found.setdefault(
                username,
                {
                    "platform": "instagram",
                    "platform_id": username,
                    "username": username,
                    "source": "google:keyword_search",
                    "keywords": keywords,
                    "source_url": f"https://www.instagram.com/{username}/",
                    "title": row.get("title"),
                    "description": row.get("description") or row.get("snippet"),
                },
            )
    return list(found.values())


async def run_campaign(
    keywords: list[str], telegram_limit: int, instagram_limit: int, telegram_only: bool = False
) -> dict:
    tasks = [search_telegram(keywords, telegram_limit)]
    if not telegram_only:
        tasks.append(asyncio.to_thread(search_instagram, keywords, instagram_limit))
    results = await asyncio.gather(*tasks, return_exceptions=True)
    telegram_result = results[0]
    instagram_result = results[1] if len(results) > 1 else []
    errors = {}
    telegram = []
    instagram = []
    if isinstance(telegram_result, Exception):
        errors["telegram"] = f"{type(telegram_result).__name__}: {telegram_result}"
    else:
        telegram = telegram_result
    if isinstance(instagram_result, Exception):
        errors["instagram"] = f"{type(instagram_result).__name__}: {instagram_result}"
    else:
        instagram = instagram_result
    return {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "keywords": keywords,
        "telegram": telegram,
        "instagram": instagram,
        "errors": errors,
        "counts": {"telegram": len(telegram), "instagram": len(instagram)},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("keywords", nargs="+", help="Keywords to search")
    parser.add_argument("--telegram-limit", type=int, default=10)
    parser.add_argument("--instagram-limit", type=int, default=10)
    parser.add_argument("--telegram-only", action="store_true")
    parser.add_argument("--output", type=Path, default=Path("results/keyword_campaign.json"))
    args = parser.parse_args()
    result = asyncio.run(
        run_campaign(args.keywords, args.telegram_limit, args.instagram_limit, args.telegram_only)
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result["counts"], ensure_ascii=False))
    print(f"saved -> {args.output}")


if __name__ == "__main__":
    main()
