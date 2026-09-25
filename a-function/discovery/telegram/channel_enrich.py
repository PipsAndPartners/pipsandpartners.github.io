"""Keyword-driven Telegram channel discovery + description contact extraction.

The parity twin of discovery/youtube_video_enrich.py, but for Telegram: it finds
public channels/groups by keyword, then -- unlike the shallow entity search in
discovery/keyword_campaign.py, which returns no description and no member count --
pulls each candidate's full channel record (GetFullChannelRequest) so we get its
`about` text and `participants_count`. It keeps only channels above a member floor
(default 30k) that look Vietnamese, and loads them through db/loader.py so the
owner's direct-contact links pasted in the description (email/phone/Zalo/@admin/
Facebook/…) are extracted into entities the standard way (see platforms/telegram.py).

    # preview Vietnamese forex channels with >30k members, write nothing:
    python -m discovery.telegram.channel_enrich --dry-run
    # discover + persist them:
    python -m discovery.telegram.channel_enrich
    # custom keywords / floor / include broker brand names as search terms:
    python -m discovery.telegram.channel_enrich forex "tín hiệu vàng" --min-followers 50000 --include-brokers
"""

import argparse
import asyncio
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

from telethon.errors import ChannelPrivateError, FloodWaitError, RPCError
from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.tl.functions.contacts import SearchRequest

from discovery.telegram.client import Settings, build_client, polite_sleep

ROOT = Path(__file__).resolve().parents[2]

# Vietnamese forex/IB discovery terms, Vietnamese-language first. SearchRequest
# matches channel title/username/about; a Vietnamese-phrase query already biases
# the hits toward Vietnamese channels, and the >30k floor + is_vietnamese gate
# below prune the rest. A bare English "forex" is intentionally NOT here -- it
# returns the big global (non-Vietnamese) channels. Broker brand names
# (discovery/data/broker_brands.txt) can be appended with --include-brokers.
DEFAULT_KEYWORDS = [
    "tín hiệu forex",
    "tín hiệu vàng",
    "kèo vàng",
    "phân tích forex",
    "ngoại hối",
    "sàn forex",
    "đầu tư forex",
    "chứng khoán phái sinh",
    "vàng XAUUSD",
    "tài chính đầu tư",
]

# Any character carrying a Vietnamese diacritic -> the text is almost certainly VN.
# Vietnamese is heavily diacriticised, so this is the reliable signal; we avoid
# language-neutral niche words like "forex"/"gold" that match English channels too.
_VN_DIACRITICS = set(
    "ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệ"
    "ìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ"
)
_VN_PHONE_RE = re.compile(r"(?:\+84|(?<!\d)0)\d{9}(?!\d)")


def is_vietnamese(text: str | None) -> bool:
    """Heuristic: a Vietnamese diacritic or a +84/0xxxxxxxxx phone in the
    channel's title+description marks it as Vietnamese. Deliberately strict --
    language-neutral trading jargon ("forex", "XAUUSD") is not a Vietnamese signal."""
    t = (text or "").lower()
    if any(ch in _VN_DIACRITICS for ch in t):
        return True
    return bool(_VN_PHONE_RE.search(t))


def _broker_keywords() -> list[str]:
    path = ROOT / "discovery" / "data" / "broker_brands.txt"
    if not path.exists():
        return []
    return [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]


def _entity_type(chat) -> str | None:
    if getattr(chat, "megagroup", False):
        return "megagroup"
    if getattr(chat, "gigagroup", False):
        return "gigagroup"
    if getattr(chat, "broadcast", False):
        return "channel"
    return None


async def discover(
    client,
    keywords: list[str],
    per_keyword: int,
    min_followers: int,
    vietnamese_only: bool,
    min_sleep: float,
    limit: int | None = None,
    fresh_ids: set[str] | None = None,
    known_ids: set[str] | None = None,
) -> tuple[list[dict], dict]:
    """Search each keyword, fetch each hit's full record, keep the ones above the
    member floor (and Vietnamese, unless disabled). Returns (items, tally).

    `fresh_ids` are channels already loaded within the refresh window: they are
    skipped BEFORE the costly GetFullChannelRequest (watermark hit), so a re-run
    only spends Telegram calls on new or stale channels. `known_ids` is every
    telegram id already in the DB, used only to tally new vs refreshed. Stops as
    soon as `limit` accepted channels are collected."""
    fresh_ids = fresh_ids or set()
    known_ids = known_ids or set()
    found: dict[str, dict] = {}
    skipped_ids: set[str] = set()
    for keyword in keywords:
        if limit is not None and len(found) >= limit:
            break
        result = await client(SearchRequest(q=keyword, limit=per_keyword))
        for chat in getattr(result, "chats", []):
            if limit is not None and len(found) >= limit:
                break
            entity_type = _entity_type(chat)
            if not entity_type:
                continue
            chat_id = str(getattr(chat, "id", ""))
            if chat_id in found:
                if keyword not in found[chat_id]["keywords"]:
                    found[chat_id]["keywords"].append(keyword)
                continue
            if chat_id in fresh_ids:
                skipped_ids.add(chat_id)  # watermark hit: recently loaded, don't re-fetch
                continue
            try:
                full = await client(GetFullChannelRequest(chat))
            except (ChannelPrivateError, RPCError, ValueError, OSError):
                continue
            full_chat = getattr(full, "full_chat", None)
            participants = getattr(full_chat, "participants_count", None)
            about = getattr(full_chat, "about", None)
            if participants is None or participants < min_followers:
                continue
            username = getattr(chat, "username", None)
            title = getattr(chat, "title", None)
            if vietnamese_only and not is_vietnamese(f"{title or ''}\n{about or ''}"):
                continue
            found[chat_id] = {
                "platform": "telegram",
                "platform_id": chat_id,
                "username": username,
                "title": title,
                "about": about,
                "participants_count": participants,
                "entity_type": entity_type,
                "source": "telegram:channel_enrich",
                "keywords": [keyword],
                "source_url": f"https://t.me/{username}" if username else None,
            }
            await polite_sleep(min_sleep)
    items = list(found.values())
    new = sum(1 for cid in found if cid not in known_ids)
    tally = {"new": new, "refreshed": len(found) - new, "skipped": len(skipped_ids)}
    return items, tally


def _watermark_sets(refresh_after_days: int, force: bool) -> tuple[set[str], set[str], str | None]:
    """(fresh_ids to skip, all known telegram ids, error note). DB is optional --
    if it is down we return empty sets so discovery still runs, just without skip."""
    from datetime import timedelta

    known: set[str] = set()
    fresh: set[str] = set()
    try:
        from db.connection import get_conn
        from discovery.common.watermark import fresh_platform_ids

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT platform_id FROM entities WHERE platform = 'telegram'")
                known = {row[0] for row in cur.fetchall()}
            if not force:
                fresh = fresh_platform_ids(conn, "telegram", timedelta(days=refresh_after_days))
    except Exception as error:  # noqa: BLE001 - watermark is an optimisation, not required
        return set(), set(), f"{type(error).__name__}: {error}"
    return fresh, known, None


async def run(args) -> dict:
    started = time.perf_counter()
    keywords = list(args.keywords)
    if args.include_brokers:
        keywords += _broker_keywords()

    fresh_ids, known_ids, watermark_note = _watermark_sets(args.refresh_after, args.force)

    settings = Settings.from_env()
    tally = {"new": 0, "refreshed": 0, "skipped": 0}
    async with build_client(settings) as client:
        try:
            items, tally = await discover(
                client,
                keywords,
                per_keyword=args.per_keyword,
                min_followers=args.min_followers,
                vietnamese_only=not args.include_non_vietnamese,
                min_sleep=settings.min_sleep,
                limit=args.limit,
                fresh_ids=fresh_ids,
                known_ids=known_ids,
            )
        except FloodWaitError as error:
            items = []
            print(f"FloodWait {error.seconds}s from Telegram; aborting this run early.")
    items = items[: args.limit]

    # Build the report first so the discovered channels + extracted contacts are
    # never lost to a downstream DB failure -- the Telegram calls are the costly
    # part. The DB load then runs in its own guard and records any error.
    from platforms.telegram import extract_related_links, to_entity

    channels = []
    for item in items:
        entity = to_entity(item)
        channels.append({
            "title": item["title"],
            "username": item["username"],
            "participants_count": item["participants_count"],
            "source_url": item["source_url"],
            "email": entity["email_norm"],
            "phone": entity["phone_norm"],
            "contact_links": extract_related_links(item),
            "about": item["about"],
        })

    loaded = 0
    errors: dict[str, str] = {}
    if watermark_note:
        errors["watermark"] = watermark_note  # DB unreachable at pre-check: ran without skip
    if not args.dry_run and items:
        try:
            from db.connection import get_conn
            from db.loader import load_platform_results

            with get_conn() as conn:
                loaded = load_platform_results(conn, "telegram", items)
        except Exception as error:  # noqa: BLE001 - keep the discovered JSON regardless
            errors["database"] = f"{type(error).__name__}: {error}"

    return {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "keywords": keywords,
        "min_followers": args.min_followers,
        "vietnamese_only": not args.include_non_vietnamese,
        "refresh_after_days": args.refresh_after,
        "dry_run": args.dry_run,
        "channels": channels,
        "watermark": tally,  # new = first seen, refreshed = re-fetched stale, skipped = fresh, not re-fetched
        "errors": errors,
        "counts": {"channels": len(items), "loaded": loaded, **tally},
        "elapsed_seconds": round(time.perf_counter() - started, 2),
    }


def main() -> None:
    import sys

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="Discover Vietnamese Telegram channels + extract description contacts")
    parser.add_argument("keywords", nargs="*", default=DEFAULT_KEYWORDS,
                        help="search terms (default: Vietnamese forex/IB niche terms)")
    parser.add_argument("--min-followers", type=int, default=30000,
                        help="keep only channels with at least this many members (default 30000)")
    parser.add_argument("--per-keyword", type=int, default=20,
                        help="max channels Telegram search returns per keyword")
    parser.add_argument("--limit", type=int, default=50,
                        help="max channels to persist (guard on a trial run)")
    parser.add_argument("--include-brokers", action="store_true",
                        help="also search each broker brand name from broker_brands.txt")
    parser.add_argument("--include-non-vietnamese", action="store_true",
                        help="do not drop non-Vietnamese channels")
    parser.add_argument("--refresh-after", type=int, default=30,
                        help="skip re-fetching channels loaded within this many days (default 30)")
    parser.add_argument("--force", action="store_true",
                        help="ignore the refresh window and re-fetch every match")
    parser.add_argument("--dry-run", action="store_true",
                        help="discover + report, but write nothing to the database")
    parser.add_argument("--output", type=Path, default=Path("results/telegram_channel_enrich.json"))
    args = parser.parse_args()
    if not args.keywords:
        args.keywords = DEFAULT_KEYWORDS

    result = asyncio.run(run(args))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result["counts"], ensure_ascii=False))
    print(f"saved -> {args.output}")


if __name__ == "__main__":
    main()
