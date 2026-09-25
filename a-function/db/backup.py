"""Back up the Postgres DB (DATABASE_URL) to a timestamped pg_dump file.

The local Postgres here is a plain background process on one laptop disk, and it
is often stopped uncleanly (sleep/shutdown without pg_ctl stop). WAL recovery has
handled that so far, but the disk is still the only copy -- this puts a copy
somewhere else. Default target is OneDrive, so the dump leaves the machine.

    python -m db.backup                 # dump, verify it's readable, keep the newest 14
    python -m db.backup --daily         # same, but skip if today's dump already exists
    python -m db.backup --dir D:\\bak    # somewhere else

Restore into an empty database:

    createdb ib_discovery_restored
    pg_restore --no-owner -d postgresql://.../ib_discovery_restored <file>.dump
"""

import argparse
import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

PG_BIN = Path(os.environ.get("PG_BIN", Path(os.environ.get("LOCALAPPDATA", "")) / "Programs/pgsql17/pgsql/bin"))
DEFAULT_DIR = (
    Path(os.environ["OneDrive"]) / "PipsAndPartners" / "db_backups"
    if os.environ.get("OneDrive")
    else Path(__file__).resolve().parents[1] / "backups"
)
PREFIX = "ib_discovery_"


def _tool(name: str) -> str:
    exe = PG_BIN / f"{name}.exe"
    return str(exe) if exe.exists() else (shutil.which(name) or name)


def backup(out_dir: Path, keep: int = 14, daily: bool = False) -> Path | None:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("Missing DATABASE_URL (set it in .env)")
    out_dir.mkdir(parents=True, exist_ok=True)
    today = datetime.now().strftime("%Y%m%d")
    if daily and any(out_dir.glob(f"{PREFIX}{today}_*.dump")):
        return None

    target = out_dir / f"{PREFIX}{datetime.now():%Y%m%d_%H%M%S}.dump"
    subprocess.run([_tool("pg_dump"), "--format=custom", "--file", str(target), dsn], check=True)
    # A dump nobody can read back is not a backup: list its table of contents.
    subprocess.run([_tool("pg_restore"), "--list", str(target)], check=True, stdout=subprocess.DEVNULL)

    for old in sorted(out_dir.glob(f"{PREFIX}*.dump"))[:-keep]:
        old.unlink()
    return target


def main() -> None:
    ap = argparse.ArgumentParser(description="pg_dump the DATABASE_URL database, keep the newest N")
    ap.add_argument("--dir", type=Path, default=DEFAULT_DIR, help=f"backup folder (default: {DEFAULT_DIR})")
    ap.add_argument("--keep", type=int, default=14, help="how many dumps to keep")
    ap.add_argument("--daily", action="store_true", help="skip if a dump from today already exists")
    args = ap.parse_args()
    target = backup(args.dir, keep=args.keep, daily=args.daily)
    if target is None:
        print(f"today's backup already exists in {args.dir}")
    else:
        print(f"backup ok: {target} ({target.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
