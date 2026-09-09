"""Bounded Telegram discovery expansion helpers."""

import re
from typing import Any

from telethon.tl.functions.channels import GetChannelRecommendationsRequest


PUBLIC_LINK_RE = re.compile(r"(?:https?://)?(?:www\.)?t\.me/([A-Za-z][A-Za-z0-9_]{3,31})", re.I)
HANDLE_RE = re.compile(r"(?<![\w])@([A-Za-z][A-Za-z0-9_]{3,31})")


def linked_candidates(full: Any) -> list[tuple[str, str]]:
    linked_id = getattr(getattr(full, "full_chat", None), "linked_chat_id", None)
    return [(str(linked_id), "expand:linked")] if linked_id else []


async def recommendation_candidates(client: Any, entity: Any) -> list[tuple[Any, str]]:
    try:
        result = await client(GetChannelRecommendationsRequest(channel=entity))
    except (AttributeError, TypeError):
        return []
    return [(item, "expand:recommendations") for item in getattr(result, "chats", [])]


async def mention_and_forward_candidates(
    client: Any, entity: Any, limit: int
) -> list[tuple[Any, str]]:
    candidates: list[tuple[Any, str]] = []
    async for message in client.iter_messages(entity, limit=limit):
        text = getattr(message, "message", "") or ""
        candidates.extend((match, "expand:mention") for match in PUBLIC_LINK_RE.findall(text))
        candidates.extend((match, "expand:mention") for match in HANDLE_RE.findall(text))
        forwarded = getattr(message, "fwd_from", None) or getattr(message, "forward", None)
        origin = getattr(forwarded, "from_id", None) if forwarded else None
        if origin:
            candidates.append((origin, "expand:forward"))
    return candidates
