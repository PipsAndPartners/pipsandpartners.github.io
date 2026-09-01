"""Postgres connection for the entity-resolution store (see db/01_schema.sql)."""

import os

import psycopg
from dotenv import load_dotenv

load_dotenv()


def get_conn() -> psycopg.Connection:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("Missing DATABASE_URL environment variable (set it in .env)")
    return psycopg.connect(dsn)
