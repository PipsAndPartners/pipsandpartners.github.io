"""Filter a Douyin *search* actor result down to mid-tier IB candidates.

The search actor (zen-studio/douyin-search-scraper) returns one row per video.
This script:
  1. groups rows by author,
  2. keeps only authors whose follower count is in a mid-tier band,
  3. keeps only authors whose bio OR any of their captured video captions
     mention trading, and
  4. writes a deduped, ranked CSV you can import into the review desk.

Usage:
    python scripts/filter_midtier.py results/<file>.json
    python scripts/filter_midtier.py results/<file>.json --min 5000 --max 150000
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

# Chinese + English trading vocabulary. Add your own as you learn the niche.
TRADE_TERMS = re.compile(
    r"外汇|黄金|原油|白银|美股|港股|恒指|期货|交易|操盘|盘面|走势|K线|技术分析|"
    r"日内|多空|止损|止盈|做多|做空|跟单|forex|fx|trading|trader|xauusd|gold",
    re.IGNORECASE,
)


def num(value) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def author_of(row: dict) -> dict:
    return row.get("authorMeta") or row.get("author") or {}


def caption_of(row: dict) -> str:
    return str(row.get("desc") or row.get("title") or row.get("caption") or "")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("results_json", type=Path)
    ap.add_argument("--min", type=int, default=5_000, help="min follower count (default 5000)")
    ap.add_argument("--max", type=int, default=150_000, help="max follower count (default 150000)")
    ap.add_argument("--out", type=Path, default=None, help="output CSV path")
    args = ap.parse_args()

    rows = json.loads(args.results_json.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        print("Expected a JSON array of video rows.", file=sys.stderr)
        sys.exit(1)

    by_author: dict[str, dict] = {}
    for row in rows:
        meta = author_of(row)
        key = meta.get("secUid") or meta.get("id") or meta.get("uniqueId") or meta.get("nickname")
        if not key:
            continue
        entry = by_author.setdefault(
            key,
            {
                "name": meta.get("nickname") or meta.get("uniqueId") or "",
                "handle": meta.get("uniqueId") or "",
                "followers": num(meta.get("followersCount") or meta.get("followerCount")),
                "bio": (meta.get("signature") or "").replace("\n", " ").strip(),
                "sec_uid": meta.get("secUid") or "",
                "video_count": 0,
                "captions": [],
            },
        )
        entry["video_count"] += 1
        cap = caption_of(row).replace("\n", " ").strip()
        if cap:
            entry["captions"].append(cap)

    candidates = []
    for entry in by_author.values():
        if not (args.min <= entry["followers"] <= args.max):
            continue
        haystack = entry["bio"] + " " + " ".join(entry["captions"])
        if not TRADE_TERMS.search(haystack):
            continue
        entry["profile_url"] = (
            f"https://www.douyin.com/user/{entry['sec_uid']}" if entry["sec_uid"] else ""
        )
        candidates.append(entry)

    candidates.sort(key=lambda e: e["followers"])

    out = args.out or args.results_json.with_name(args.results_json.stem + "_midtier.csv")
    with out.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["name", "platform", "profile_url", "country", "language",
                    "followers", "engagement", "bio"])
        for e in candidates:
            w.writerow([e["name"], "Douyin", e["profile_url"], "China", "Chinese",
                        e["followers"], "", e["bio"] or " | ".join(e["captions"][:2])])

    print(f"{len(rows)} videos -> {len(by_author)} authors -> {len(candidates)} mid-tier IB candidates")
    print(f"follower band: {args.min:,}-{args.max:,}")
    print(f"written: {out}")
    for e in candidates[:25]:
        print(f"  {e['followers']:>8,}  {e['name'][:30]:<30}  {e['profile_url']}")


if __name__ == "__main__":
    main()
