"""Source-link standouts: turn each channel's own About text into the {standout}.

Reads a sheet that has `email` + `source_url` (a YouTube channel URL, as the
discovery shortlist exports), fetches each channel's title + description via the
YouTube Data API (reusing discovery.youtube_data_api.request), infers the
channel's real topic, and rebuilds the outreach body through mailfields.mail_fields
with a channel-specific standout instead of the generic one.

    # needs YOUTUBE_API_KEY in .env (or .youtube_api_key.env)
    python -m outreach.standout_source --xlsx mailnow.xlsx --out mailnow_standout.xlsx
    python -m outreach.standout_source --xlsx mailnow.xlsx --out out.xlsx --limit 1  # test 1 row

The output sheet carries `email` / `Subject for mail` / `Content for mail` (ready
for `outreach.createmail`) plus `channel_title` / `description` / `standout` so you
can eyeball and tweak any line before generating the .eml files. Rows whose
source_url isn't a resolvable channel, or whose text names no known topic, get no
standout sentence at all and are flagged.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

from outreach.mailfields import infer_topic, mail_fields


def channel_id_from_url(url: str) -> tuple[str | None, str | None]:
    """(param, value) for the channels.list call: ('id', 'UC..') for a /channel/
    URL, ('forHandle', '@name') for an @handle, ('forUsername', name) for /user/.
    Returns (None, None) when the URL isn't a resolvable channel (e.g. /c/custom)."""
    u = (url or "").strip()
    if not u:
        return None, None
    m = re.search(r"/channel/(UC[\w-]+)", u)
    if m:
        return "id", m.group(1)
    m = re.search(r"youtube\.com/(@[\w.-]+)", u)
    if m:
        return "forHandle", m.group(1)
    m = re.search(r"/user/([\w.-]+)", u)
    if m:
        return "forUsername", m.group(1)
    return None, None


def compose_standout(name: str, title: str, description: str) -> str | None:
    """Channel-specific AA from the source link's own text, or None when the
    text names no recognisable topic (the standout sentence is then dropped)."""
    topic = infer_topic(f"{title} {description}")
    return f"những nội dung của {name} về {topic} trên YouTube" if topic else None


def fetch_channel(param: str, value: str) -> dict:
    """Channel title + description via YouTube Data API. Raises if no key."""
    from discovery.youtube_data_api import request  # reuse the v3 client

    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        raise RuntimeError("Missing YOUTUBE_API_KEY (add it to .env or .youtube_api_key.env)")
    data = request("channels", {"part": "snippet", param: value, "key": api_key})
    items = data.get("items") or []
    if not items:
        return {}
    snip = items[0].get("snippet", {})
    return {"title": snip.get("title", ""), "description": snip.get("description", "")}


def _read_rows(xlsx: Path) -> list[dict]:
    from openpyxl import load_workbook

    ws = load_workbook(xlsx).active  # not read_only: that mode keeps the file locked on Windows
    header = [str(ws.cell(1, c).value or "").strip().lower() for c in range(1, ws.max_column + 1)]

    def col(*names):
        for n in names:
            if n in header:
                return header.index(n) + 1
        return None

    c_email = col("email", "email cần gửi")
    c_src = col("source_url", "link social network", "link")
    c_name = col("name", "display_name", "tên", "channel")
    if not c_email or not c_src:
        raise ValueError(f"sheet needs 'email' and 'source_url' columns; got {header}")
    rows = []
    for r in range(2, ws.max_row + 1):
        email = str(ws.cell(r, c_email).value or "").strip()
        if not email:
            continue
        rows.append({
            "email": email,
            "source_url": str(ws.cell(r, c_src).value or "").strip(),
            "name": (str(ws.cell(r, c_name).value or "").strip() if c_name else ""),
        })
    return rows


def enrich(rows: list[dict]) -> list[dict]:
    """Fill subject/body with a source-derived standout for each row."""
    out = []
    for row in rows:
        param, value = channel_id_from_url(row["source_url"])
        title = desc = ""
        flagged = ""
        if param:
            snip = fetch_channel(param, value)
            title, desc = snip.get("title", ""), snip.get("description", "")
        name = row.get("name") or title or "anh/chị"
        standout = compose_standout(name, title, desc) if (title or desc) else None
        if not standout:
            flagged = ("no topic in channel text" if (title or desc) else "no channel text") \
                + "; standout sentence dropped"
        subject, body = mail_fields({"display_name": name, "platform": "youtube"}, standout)
        out.append({
            "email": row["email"], "Subject for mail": subject, "Content for mail": body,
            "source_url": row["source_url"], "channel_title": title,
            "description": desc, "standout": standout or "(none)", "flag": flagged,
        })
    return out


def _write_xlsx(records: list[dict], out: Path) -> None:
    from openpyxl import Workbook

    cols = ["email", "Subject for mail", "Content for mail", "source_url",
            "channel_title", "description", "standout", "flag"]
    wb = Workbook()
    ws = wb.active
    ws.append(cols)
    for rec in records:
        ws.append([rec.get(c, "") for c in cols])
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Rebuild outreach bodies with a source-link standout")
    ap.add_argument("--xlsx", type=Path, required=True, help="sheet with email + source_url")
    ap.add_argument("--out", type=Path, required=True, help="enriched sheet (feed to outreach.createmail)")
    ap.add_argument("--limit", type=int, default=None, help="only the first N rows (e.g. 1 to test)")
    args = ap.parse_args()

    rows = _read_rows(args.xlsx)
    if args.limit:
        rows = rows[:args.limit]
    records = enrich(rows)
    _write_xlsx(records, args.out)
    flagged = sum(1 for r in records if r["flag"])
    for r in records:
        mark = "  [FLAG] " + r["flag"] if r["flag"] else ""
        print(f"{r['email']:40s} {r['standout']}{mark}")
    print(f"\n{len(records)} rows -> {args.out}  ({flagged} fell back to generic)")
    print("review the sheet, then: python -m outreach.createmail \"%s\" --all" % args.out)


if __name__ == "__main__":
    main()
