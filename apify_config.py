"""Apify credentials and client construction."""

import os

from apify_client import ApifyClient
from dotenv import load_dotenv

load_dotenv()


def get_client() -> ApifyClient:
    token = os.environ.get("APIFY_TOKEN")
    if not token:
        raise RuntimeError("Missing APIFY_TOKEN environment variable (set it in .env)")
    return ApifyClient(token)
