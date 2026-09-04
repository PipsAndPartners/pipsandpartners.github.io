"""One-time bootstrap: create the first admin user from env vars.

Run once (`python db/seed_admin.py`), needed because the admin page itself
requires being logged in already. Safe to re-run: upserts by username.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db.connection import get_conn
from web.crypto_utils import encrypt_token

load_dotenv()


def main() -> None:
    username = os.environ.get("ADMIN_USERNAME")
    password = os.environ.get("ADMIN_PASSWORD")
    apify_token = os.environ.get("ADMIN_APIFY_TOKEN")
    if not username or not password or not apify_token:
        raise SystemExit("Set ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_APIFY_TOKEN in .env first.")

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app_users (username, password_hash, apify_token_encrypted, is_admin)
                VALUES (%s, %s, %s, true)
                ON CONFLICT (username) DO UPDATE
                    SET password_hash = EXCLUDED.password_hash,
                        apify_token_encrypted = EXCLUDED.apify_token_encrypted,
                        is_admin = true
                """,
                (username, generate_password_hash(password), encrypt_token(apify_token)),
            )
        conn.commit()
    finally:
        conn.close()

    print(f"Admin user '{username}' ready.")


if __name__ == "__main__":
    main()
