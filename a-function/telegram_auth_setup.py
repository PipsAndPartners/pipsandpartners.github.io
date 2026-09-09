"""Create a Telethon StringSession locally; never run this in the worker."""

import os

from telethon import TelegramClient
from telethon.sessions import StringSession


async def main() -> None:
    api_id = int(os.environ["TELEGRAM_API_ID"])
    api_hash = os.environ["TELEGRAM_API_HASH"]
    async with TelegramClient(StringSession(), api_id, api_hash) as client:
        print("TELEGRAM_SESSION=" + client.session.save())


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
