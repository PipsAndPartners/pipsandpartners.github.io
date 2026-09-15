"""Run bounded Telegram channel/group discovery: python -m discovery.telegram.crawl."""

import asyncio
import json
import logging
import os
from collections import deque
from pathlib import Path
from typing import Any

from psycopg.types.json import Jsonb
from telethon.errors import (
    ChannelPrivateError,
    ChannelsTooMuchError,
    FloodWaitError,
    InviteHashExpiredError,
    RPCError,
    UsernameInvalidError,
    UsernameNotOccupiedError,
)
from telethon.tl.functions.channels import GetFullChannelRequest

from db.connection import get_conn
from discovery.common.watermark import NEW, REFRESHED, SKIPPED, claim_entity, summarize
from discovery.telegram.client import Settings, build_client, polite_sleep
from discovery.telegram.expand import (
    linked_candidates,
    mention_and_forward_candidates,
    recommendation_candidates,
)
from discovery.telegram.extract import extract_about
from discovery.telegram.seeds import load_seeds

LOG = logging.getLogger(__name__)


def _entity_type(entity: Any) -> str | None:
    if getattr(entity, "megagroup", False):
        return "megagroup"
    if getattr(entity, "gigagroup", False):
        return "gigagroup"
    if getattr(entity, "broadcast", False):
        return "channel"
    return None


def _full_raw(entity: Any, full: Any) -> dict[str, Any]:
    full_chat = getattr(full, "full_chat", None)
    about = getattr(full_chat, "about", None)
    chats = [
        {
            "id": str(getattr(chat, "id", "")),
            "username": getattr(chat, "username", None),
            "title": getattr(chat, "title", None),
        }
        for chat in getattr(full, "chats", [])
    ]
    return {
        "id": str(getattr(entity, "id", "")),
        "access_hash": str(getattr(entity, "access_hash", "")),
        "username": getattr(entity, "username", None),
        "title": getattr(entity, "title", None),
        "about": about,
        "participants_count": getattr(full_chat, "participants_count", None),
        "linked_chat_id": getattr(full_chat, "linked_chat_id", None),
        "chats": chats,
        "flags": {
            name: bool(getattr(entity, name, False))
            for name in ("broadcast", "megagroup", "gigagroup", "verified", "scam", "fake", "restricted")
        },
        "extracted": extract_about(about),
    }


def _entity_fields(raw: dict[str, Any], source_url: str) -> dict[str, Any]:
    extracted = raw["extracted"]
    return {
        "handle": raw["username"],
        "display_name": raw["title"],
        "bio_text": raw["about"],
        "website_url": (extracted["websites"] or [None])[0],
        "follower_count": raw["participants_count"],
        "phone_norm": (extracted["phones"] or [None])[0],
        "email_norm": (extracted["emails"] or [None])[0],
        "source_url": source_url,
    }


def _write_staging(conn: Any, raw: dict[str, Any], *, source: str, discovered_from: str | None) -> None:
    username = raw["username"]
    source_url = f"https://t.me/{username}" if username else None
    entity_type = next((key for key, value in raw["flags"].items() if value and key in {"broadcast", "megagroup", "gigagroup"}), "channel")
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO staging_telegram
                (platform_id, username, entity_type, raw, source, discovered_from, source_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (raw["id"], username, entity_type, Jsonb(raw), source, discovered_from, source_url),
        )
    conn.commit()


def _save_frontier(path: Path, queue: deque[tuple[Any, int, str, str | None]]) -> None:
    path.write_text(json.dumps(list(queue), default=str), encoding="utf-8")


def _load_frontier(path: Path, seeds: list[str]) -> deque[tuple[Any, int, str, str | None]]:
    if path.exists():
        values = json.loads(path.read_text(encoding="utf-8"))
        return deque((value[0], value[1], value[2], value[3]) for value in values)
    return deque((seed, 0, "seed", None) for seed in seeds)


async def run(seeds: list[str] | None = None) -> int:
    settings = Settings.from_env()
    frontier_path = Path(os.getenv("TELEGRAM_FRONTIER_FILE", ".telegram_frontier.json"))
    queue = _load_frontier(frontier_path, seeds or load_seeds())
    processed = 0
    outcomes: list[str] = []
    async with build_client(settings) as client:
        with get_conn() as conn:
            while queue and processed < settings.max_channels:
                target, depth, source, discovered_from = queue.popleft()
                try:
                    entity = await client.get_entity(target)
                    entity_type = _entity_type(entity)
                    if not entity_type:
                        continue
                    full = await client(GetFullChannelRequest(entity))
                    raw = _full_raw(entity, full)
                    platform_id = raw["id"]
                    source_url = f"https://t.me/{raw['username']}" if raw["username"] else None
                    _write_staging(conn, raw, source=source, discovered_from=discovered_from)
                    _, outcome = claim_entity(
                        conn,
                        platform="telegram",
                        platform_id=platform_id,
                        entity=_entity_fields(raw, source_url),
                    )
                    outcomes.append(outcome)
                    accepted = outcome != SKIPPED
                    LOG.info("telegram entity=%s source=%s outcome=%s", platform_id, source, outcome)
                    processed += 1
                    if accepted and depth < settings.max_depth:
                        candidates = linked_candidates(full)
                        candidates += await recommendation_candidates(client, entity)
                        candidates += await mention_and_forward_candidates(client, entity, settings.msg_scan_limit)
                        for candidate, candidate_source in candidates:
                            queue.append((candidate, depth + 1, candidate_source, platform_id))
                    _save_frontier(frontier_path, queue)
                    await polite_sleep(settings.min_sleep)
                except FloodWaitError as error:
                    if error.seconds > settings.flood_abort_seconds:
                        LOG.warning("FloodWait %ss exceeds abort threshold; resuming later", error.seconds)
                        queue.appendleft((target, depth, source, discovered_from))
                        _save_frontier(frontier_path, queue)
                        break
                    LOG.warning("FloodWait %ss; sleeping", error.seconds)
                    await asyncio.sleep(error.seconds)
                except (
                    ChannelPrivateError,
                    ChannelsTooMuchError,
                    InviteHashExpiredError,
                    UsernameInvalidError,
                    UsernameNotOccupiedError,
                    ValueError,
                    OSError,
                    RPCError,
                ) as error:
                    LOG.warning("Skipping Telegram target %r: %s", target, error)
    if not queue and frontier_path.exists():
        frontier_path.unlink()
    tally = summarize(outcomes)
    LOG.info(
        "telegram refresh done: new=%d refreshed=%d skipped=%d (processed=%d)",
        tally[NEW], tally[REFRESHED], tally[SKIPPED], processed,
    )
    return processed


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())
