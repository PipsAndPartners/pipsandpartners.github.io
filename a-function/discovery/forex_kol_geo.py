"""Find public admins of large Forex/finance Telegram groups by self-declared geo signals."""

import argparse
import asyncio
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.tl.functions.users import GetFullUserRequest
from telethon.tl.types import ChannelParticipantsAdmins

from discovery.telegram.client import Settings, build_client
from discovery.keyword_campaign import search_telegram_entities

VIETNAMESE = re.compile(r"\b(vietnam|viet nam|việt nam|người việt|nguoi viet|tiếng việt|tieng viet|vn)\b", re.I)
AUSTRALIA = re.compile(r"\b(australia|australian|sydney|melbourne|brisbane|perth|adelaide|canberra)\b", re.I)
US_UK = re.compile(r"\b(united states|\busa\b|\bus\b|america|american|new york|california|texas|united kingdom|\buk\b|british|england|london|manchester|birmingham)\b", re.I)
FOREX = re.compile(r"\b(forex|trading|finance|financial|broker|invest|investment|ngoai hoi|ngoại hối|chứng khoán|chung khoan)\b", re.I)

SEARCH_TERMS = [
    "forex vietnam", "forex trading vietnam", "tài chính việt nam", "đầu tư việt nam",
    "forex australia", "vietnamese australia forex", "forex usa", "forex uk",
    "vietnamese trader australia", "vietnamese trader america", "vietnamese trader uk",
]


def geo_bucket(text: str) -> str | None:
    if not VIETNAMESE.search(text):
        return None
    if AUSTRALIA.search(text):
        return "AU"
    if US_UK.search(text):
        return "US-UK"
    return None


def profile_text(user: object, about: str) -> str:
    return " ".join(
        str(value or "")
        for value in (
            getattr(user, "username", ""),
            getattr(user, "first_name", ""),
            getattr(user, "last_name", ""),
            about,
        )
    )


async def inspect_group(client, candidate: dict, min_members: int) -> dict | None:
    if candidate.get("entity_type") not in {"megagroup", "gigagroup"}:
        return None
    entity = await client.get_entity(candidate.get("username") or candidate["platform_id"])
    full = await client(GetFullChannelRequest(entity))
    full_chat = getattr(full, "full_chat", None)
    participants_count = getattr(full_chat, "participants_count", None) or 0
    if participants_count < min_members:
        return None

    admins = await client.get_participants(entity, filter=ChannelParticipantsAdmins(), limit=100)
    results = []
    for admin in admins:
        if getattr(admin, "bot", False) or getattr(admin, "deleted", False):
            continue
        about = ""
        try:
            user_full = await client(GetFullUserRequest(admin))
            about = getattr(getattr(user_full, "full_user", None), "about", "") or ""
        except Exception:
            continue
        text = profile_text(admin, about)
        bucket = geo_bucket(text)
        if not bucket or not FOREX.search(candidate.get("title", "") + " " + " ".join(candidate.get("keywords", []))):
            continue
        results.append(
            {
                "telegram_user_id": str(getattr(admin, "id", "")),
                "username": getattr(admin, "username", None),
                "display_name": " ".join(
                    part for part in (getattr(admin, "first_name", None), getattr(admin, "last_name", None)) if part
                ),
                "about": about,
                "geo_bucket": bucket,
                "evidence": "self-declared public Telegram profile text",
                "group": {
                    "id": str(getattr(entity, "id", "")),
                    "username": getattr(entity, "username", None),
                    "title": getattr(entity, "title", None),
                    "participants_count": participants_count,
                },
            }
        )
    return {
        "id": str(getattr(entity, "id", "")),
        "username": getattr(entity, "username", None),
        "title": getattr(entity, "title", None),
        "participants_count": participants_count,
        "admins_found": len(admins),
        "matches": results,
    }


async def run(min_members: int, max_per_bucket: int) -> dict:
    started = time.perf_counter()
    candidates = await search_telegram_entities(SEARCH_TERMS, 50)
    seen_groups: set[str] = set()
    groups = []
    matches: dict[str, dict] = {}
    async with build_client(Settings.from_env()) as client:
        for candidate in candidates:
            group_id = str(candidate.get("platform_id"))
            if group_id in seen_groups:
                continue
            seen_groups.add(group_id)
            group = await inspect_group(client, candidate, min_members)
            if not group:
                continue
            groups.append(group)
            for match in group["matches"]:
                user_id = match["telegram_user_id"]
                bucket = match["geo_bucket"]
                if user_id in matches:
                    existing = matches[user_id]
                    if group["id"] not in [item["id"] for item in existing["groups"]]:
                        existing["groups"].append({"id": group["id"], "username": group["username"], "title": group["title"], "participants_count": group["participants_count"]})
                    continue
                if sum(value["geo_bucket"] == bucket for value in matches.values()) >= max_per_bucket:
                    continue
                match["groups"] = [{"id": group["id"], "username": group["username"], "title": group["title"], "participants_count": group["participants_count"]}]
                matches[user_id] = match
            if all(sum(value["geo_bucket"] == bucket for value in matches.values()) >= max_per_bucket for bucket in ("AU", "US-UK")):
                break
    output = list(matches.values())
    return {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "criteria": {
            "group_members_at_least": min_members,
            "buckets": "self-declared Vietnamese + Australia or US/UK public profile signal",
            "max_per_bucket": max_per_bucket,
        },
        "groups_inspected": groups,
        "results": {
            "AU": [item for item in output if item["geo_bucket"] == "AU"],
            "US-UK": [item for item in output if item["geo_bucket"] == "US-UK"],
        },
        "counts": {
            "candidate_entities": len(candidates),
            "large_groups_inspected": len(groups),
            "AU": sum(item["geo_bucket"] == "AU" for item in output),
            "US-UK": sum(item["geo_bucket"] == "US-UK" for item in output),
        },
        "elapsed_seconds": round(time.perf_counter() - started, 2),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-members", type=int, default=50000)
    parser.add_argument("--max-per-bucket", type=int, default=10)
    parser.add_argument("--output-dir", type=Path, default=Path("results"))
    args = parser.parse_args()
    result = asyncio.run(run(args.min_members, args.max_per_bucket))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for bucket, rows in result["results"].items():
        path = args.output_dir / f"Forex_KOL_{bucket}.json"
        path.write_text(json.dumps({**result, "results": rows}, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{bucket}: {len(rows)} -> {path}")
    print(json.dumps(result["counts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
