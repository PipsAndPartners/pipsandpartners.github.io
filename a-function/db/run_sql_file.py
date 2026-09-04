"""Runs a .sql file against the configured database via psql.

Usage:
    python db/run_sql_file.py db/01_schema.sql
    python db/run_sql_file.py db/02_resolve.sql
"""

import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def run_sql_file(sql_path: Path) -> None:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("Missing DATABASE_URL environment variable (set it in .env)")
    psql = os.environ.get("PSQL_PATH", "psql")
    subprocess.run([psql, dsn, "-v", "ON_ERROR_STOP=1", "-f", str(sql_path)], check=True)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python db/run_sql_file.py <path-to-sql-file>")
    run_sql_file(Path(sys.argv[1]))
