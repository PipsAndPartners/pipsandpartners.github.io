"""Telethon client configuration and conservative request pacing."""

import asyncio
import os
import random
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.sessions import StringSession

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

@dataclass(frozen=True)
class Settings:
    api_id: int
    api_hash: str
    session: str
    max_depth: int = 2
    max_channels: int = 500
    msg_scan_limit: int = 100
    flood_abort_seconds: int = 600
    min_sleep: float = 1.5

    @classmethod
    def from_env(cls) -> "Settings":
        required = ("TELEGRAM_API_ID", "TELEGRAM_API_HASH", "TELEGRAM_SESSION")
        missing = [name for name in required if not os.getenv(name)]
        if missing:
            raise RuntimeError("Missing Telegram settings: " + ", ".join(missing))
        return cls(
            api_id=int(os.environ["TELEGRAM_API_ID"]),
            api_hash=os.environ["TELEGRAM_API_HASH"],
            session=os.environ["TELEGRAM_SESSION"],
            max_depth=int(os.getenv("TELEGRAM_MAX_DEPTH", "2")),
            max_channels=int(os.getenv("TELEGRAM_MAX_CHANNELS_PER_RUN", "500")),
            msg_scan_limit=int(os.getenv("TELEGRAM_MSG_SCAN_LIMIT", "100")),
            flood_abort_seconds=int(os.getenv("TELEGRAM_FLOOD_ABORT_SECONDS", "600")),
            min_sleep=float(os.getenv("TELEGRAM_MIN_SLEEP", "1.5")),
        )


def build_client(settings: Settings) -> TelegramClient:
    return TelegramClient(StringSession(settings.session), settings.api_id, settings.api_hash)


async def polite_sleep(min_sleep: float) -> None:
    await asyncio.sleep(min_sleep + random.random())
