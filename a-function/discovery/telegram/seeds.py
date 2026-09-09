"""Read public Telegram seed usernames or t.me links."""

import os
import re
from pathlib import Path


LINK_RE = re.compile(r"(?:https?://)?(?:www\.)?t\.me/([A-Za-z][A-Za-z0-9_]{3,31})", re.I)


def normalise_seed(value: str) -> str | None:
    value = value.strip().lstrip("@")
    match = LINK_RE.fullmatch(value)
    if match:
        return match.group(1)
    if re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{3,31}", value):
        return value
    return None


def load_seeds(path: str | None = None) -> list[str]:
    values = os.getenv("TELEGRAM_SEEDS", "").split(",")
    if path and Path(path).exists():
        values.extend(Path(path).read_text(encoding="utf-8").splitlines())
    return sorted({seed for value in values if (seed := normalise_seed(value))})
