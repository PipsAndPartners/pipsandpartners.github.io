"""Apify credentials and client construction."""

import os

from apify_client import ApifyClient
from dotenv import load_dotenv

load_dotenv()


def get_client(token: str | None = None) -> ApifyClient:
    """CLI (pipeline.py) calls this with no args and reads APIFY_TOKEN from .env.
    The web console passes the logged-in user's own token instead.
    """
    token = token or os.environ.get("APIFY_TOKEN")
    if not token:
        raise RuntimeError("Missing APIFY_TOKEN environment variable (set it in .env)")
    return ApifyClient(token)
