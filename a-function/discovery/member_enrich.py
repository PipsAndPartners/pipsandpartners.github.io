"""Bounded public Telegram member scan followed by Instagram profile enrichment."""

import argparse
import asyncio
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path

from apify_client import ApifyClient
from dotenv import load_dotenv
from telethon.tl.functions.users import GetFullUserRequest

from discovery.keyword_campaign import instagram_username
from discovery.telegram.client import Settings, build_client

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
INSTAGRAM_LINK_RE = re.compile(r"https?://(?:www\.)?instagram\.com/[^\s<>()]+", re.I)


def instagram_candidates(text: str | None) -> set[str]:
    handles = set()
    for link in INSTAGRAM_LINK_RE.findall(text or ""):
        username = instagram_username(link.rstrip(".,;)"))
        if username:
            handles.add(username)
    return handles


async def scan_group(client, candidate: dict, limit: int) -> dict:
    username = candidate.get("username")
    result = {
        "platform_id": candidate.get("platform_id"),
        "username": username,
        "title": candidate.get("title"),
        "source": candidate.get("source"),
        "members_scanned": 0,
        "members": [],
        "instagram_usernames": [],
        "skipped": None,
    }
    entity = await client.get_entity(username or candidate["platform_id"])
    if not (getattr(entity, "megagroup", False) or getattr(entity, "gigagroup", False)):
        result["skipped"] = "broadcast channel; member list is out of scope for this entity"
        return result

    members = await client.get_participants(entity, limit=limit)
    instagram_handles = set()
    for member in members:
        if getattr(member, "bot", False) or getattr(member, "deleted", False):
            continue
        about = ""
        try:
            full = await client(GetFullUserRequest(member))
            about = getattr(getattr(full, "full_user", None), "about", "") or ""
        except Exception:
            pass
        handles = instagram_candidates(about)
        instagram_handles.update(handles)
        result["members"].append(
            {
                "id": str(getattr(member, "id", "")),
                "username": getattr(member, "username", None),
                "display_name": " ".join(
                    part for part in (getattr(member, "first_name", None), getattr(member, "last_name", None)) if part
                ),
                "about": about,
                "instagram_usernames": sorted(handles),
            }
        )
    result["members_scanned"] = len(result["members"])
    result["instagram_usernames"] = sorted(instagram_handles)
    return result


def enrich_instagram(usernames: list[str]) -> tuple[list[dict], str | None]:
    if not usernames:
        return [], None
    token = os.environ.get("APIFY_TOKEN")
    if not token:
        return [], "Missing APIFY_TOKEN"
    try:
        client = ApifyClient(token)
        run = client.actor("apify/instagram-profile-scraper").call(
            run_input={"usernames": usernames}
        )
        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        return items, None
    except Exception as error:
        return [], f"{type(error).__name__}: {error}"


async def run(input_path: Path, member_limit: int) -> dict:
    started = time.perf_counter()
    campaign = json.loads(input_path.read_text(encoding="utf-8"))
    candidates = campaign.get("telegram") or campaign.get("results") or []
    settings = Settings.from_env()
    seen_member_ids: set[str] = set()
    member_records: dict[str, dict] = {}
    duplicate_members = 0
    async with build_client(settings) as client:
        groups = []
        for candidate in candidates:
            if candidate.get("entity_type") not in {"megagroup", "gigagroup"}:
                continue
            group = await scan_group(client, candidate, member_limit)
            unique_members = []
            for member in group["members"]:
                member_id = member["id"]
                if member_id in seen_member_ids:
                    duplicate_members += 1
                    source = group["username"] or group["platform_id"]
                    if source not in member_records[member_id]["source_groups"]:
                        member_records[member_id]["source_groups"].append(source)
                    continue
                seen_member_ids.add(member_id)
                member["source_groups"] = [group["username"] or group["platform_id"]]
                member_records[member_id] = member
                unique_members.append(member)
            group["members"] = unique_members
            group["members_scanned"] = len(unique_members)
            groups.append(group)
            if len(seen_member_ids) >= member_limit:
                break
    unique_members = []
    for group in groups:
        unique_members.extend(group["members"])
    unique_members = unique_members[:member_limit]
    usernames = sorted({name for group in groups for name in group["instagram_usernames"]})
    instagram, instagram_error = await asyncio.to_thread(enrich_instagram, usernames)
    return {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "input": str(input_path),
        "member_limit": member_limit,
        "groups": groups,
        "instagram_usernames": usernames,
        "instagram": instagram,
        "errors": {"instagram": instagram_error} if instagram_error else {},
        "deduplication": {
            "key": "telegram_user_id",
            "unique_members": len(unique_members),
            "duplicate_members_skipped": duplicate_members,
        },
        "counts": {
            "groups": len(groups),
            "members": len(unique_members),
            "instagram_usernames": len(usernames),
            "instagram_profiles": len(instagram),
        },
        "elapsed_seconds": round(time.perf_counter() - started, 2),
        "members_per_second": round(
            len(unique_members) / max(time.perf_counter() - started, 0.001), 2
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("results/telegram_keyword_demo.json"))
    parser.add_argument("--member-limit", type=int, default=10,
                        help="Maximum total public members across selected groups")
    parser.add_argument("--output", type=Path, default=Path("results/member_instagram_enrich.json"))
    args = parser.parse_args()
    result = asyncio.run(run(args.input, args.member_limit))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result["counts"], ensure_ascii=False))
    print(f"saved -> {args.output}")


if __name__ == "__main__":
    main()
