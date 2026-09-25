"""Bounded public Telegram member scan followed by Instagram profile enrichment.

The Instagram profile scrape is the paid step (Apify instagram-profile-scraper),
so it runs behind the cheap filter gate (discovery.gate, E6 6.2/6.7): only
members whose Telegram bio carries a forex/IB signal are worth paying to enrich.
`_gate_candidates` applies that gate before `enrich_instagram` is ever called, so
irrelevant members structurally cannot cost enrichment credit.
"""

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

from discovery import gate
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


def _gate_candidates(groups: list[dict], *, min_relevance: int) -> tuple[list[str], list[str]]:
    """Cheap gate BEFORE the paid Instagram enrichment (E6 6.2/6.7).

    Returns (kept, all): `all` is every Instagram username harvested from member
    bios; `kept` is only those whose source member's bio passes the forex/IB
    relevance gate. Follower count is unknown until enrichment runs, so relevance
    alone decides (discovery.gate.passes_filter handles the missing-follower
    case). A username is kept if ANY member it came from passes -- one relevant
    source is enough to justify paying for that profile.
    """
    kept: set[str] = set()
    all_usernames: set[str] = set()
    for group in groups:
        for member in group["members"]:
            handles = member.get("instagram_usernames") or []
            if not handles:
                continue
            all_usernames.update(handles)
            entity = {
                "display_name": member.get("display_name"),
                "bio_text": member.get("about"),
                "handle": member.get("username"),
            }
            if gate.passes_filter(entity, min_relevance=min_relevance):
                kept.update(handles)
    return sorted(kept), sorted(all_usernames)


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
        items = list(client.dataset(run.default_dataset_id).iterate_items())
        return items, None
    except Exception as error:
        return [], f"{type(error).__name__}: {error}"


async def run(input_path: Path, member_limit: int, min_relevance: int = gate.DEFAULT_MIN_RELEVANCE) -> dict:
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
    # Cheap gate BEFORE the paid Instagram scrape: only enrich usernames whose
    # source member's bio shows a forex/IB signal (E6 6.2/6.7).
    usernames, all_candidates = _gate_candidates(groups, min_relevance=min_relevance)
    instagram, instagram_error = await asyncio.to_thread(enrich_instagram, usernames)
    return {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "input": str(input_path),
        "member_limit": member_limit,
        "groups": groups,
        "instagram_usernames": usernames,
        "instagram": instagram,
        "gate": {
            "min_relevance": min_relevance,
            "candidates_before_gate": len(all_candidates),
            "candidates_after_gate": len(usernames),
            "dropped_by_gate": len(all_candidates) - len(usernames),
        },
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
    parser.add_argument("--min-relevance", type=int, default=gate.DEFAULT_MIN_RELEVANCE,
                        help="Cheap gate: min forex/IB relevance a member's bio needs before we pay to enrich its Instagram")
    parser.add_argument("--output", type=Path, default=Path("results/member_instagram_enrich.json"))
    args = parser.parse_args()
    result = asyncio.run(run(args.input, args.member_limit, args.min_relevance))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result["counts"], ensure_ascii=False))
    print(f"saved -> {args.output}")


if __name__ == "__main__":
    main()
