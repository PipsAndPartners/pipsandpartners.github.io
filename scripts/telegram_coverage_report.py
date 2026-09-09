"""Compare Telegram staging coverage with the Apify web-preview baseline."""

import argparse
import json
from collections import Counter
from pathlib import Path


def report(path: str) -> dict[str, int | bool]:
    rows = [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]
    seed_ids = {str(row["platform_id"]) for row in rows if row.get("source") == "seed"}
    expanded = [row for row in rows if str(row.get("platform_id")) not in seed_ids]
    types = Counter(row.get("entity_type") for row in rows)
    linked = sum(row.get("source") == "expand:linked" for row in rows)
    return {
        "telethon_rows": len(rows),
        "groups_or_supergroups": types["megagroup"] + types["gigagroup"],
        "linked_discussion_groups": linked,
        "expanded_entities": len(expanded),
        "pass": bool(types["megagroup"] + types["gigagroup"] >= 1 and expanded),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("staging_jsonl", help="JSONL export with staging_telegram rows")
    args = parser.parse_args()
    print(json.dumps(report(args.staging_jsonl), indent=2))
