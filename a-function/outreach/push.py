"""Create Outlook draft messages from a drafts.jsonl via Microsoft Graph.

Each line of the input is {to, cc, bcc, subject, body, ...}. Every record is
POSTed to /me/messages, which lands it in the signed-in user's Drafts folder --
it is never sent. --dry-run prints the payloads without calling Graph (and needs
no Azure setup), so the build->render path can be verified on its own.

    python -m outreach.push --input drafts.jsonl --dry-run
    python -m outreach.push --input drafts.jsonl --log results/.../push_log.csv
"""

import argparse
import json
import sys
from pathlib import Path

from outreach.render import text_to_html

GRAPH_MESSAGES = "https://graph.microsoft.com/v1.0/me/messages"


def _recipients(addrs) -> list[dict]:
    """Normalize a str / list / None into Graph's recipient list shape."""
    if not addrs:
        return []
    if isinstance(addrs, str):
        addrs = [addrs]
    return [{"emailAddress": {"address": a}} for a in addrs if a]


def build_payload(rec: dict) -> dict:
    return {
        "subject": rec.get("subject", ""),
        "body": {"contentType": "HTML", "content": text_to_html(rec.get("body", ""))},
        "toRecipients": _recipients(rec.get("to")),
        "ccRecipients": _recipients(rec.get("cc")),
        "bccRecipients": _recipients(rec.get("bcc")),
    }


def _load(input_path: Path) -> list[dict]:
    return [
        json.loads(line)
        for line in input_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Push drafts.jsonl to Outlook Drafts via Graph")
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--dry-run", action="store_true", help="print payloads, no API call")
    ap.add_argument("--log", type=Path, help="write a per-draft result CSV")
    args = ap.parse_args()

    records = _load(args.input)

    if args.dry_run:
        for rec in records:
            payload = build_payload(rec)
            print(json.dumps({
                "to": rec.get("to"),
                "bcc": rec.get("bcc"),
                "subject": payload["subject"],
                "html_chars": len(payload["body"]["content"]),
            }, ensure_ascii=False))
        print(f"[dry-run] {len(records)} drafts prepared (no Graph call)")
        return

    import requests  # noqa: PLC0415 - only needed for the live path
    from outreach.graph_auth import get_token

    token = get_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    results = []
    for rec in records:
        resp = requests.post(GRAPH_MESSAGES, headers=headers, json=build_payload(rec), timeout=30)
        ok = resp.status_code in (200, 201)
        draft_id = resp.json().get("id") if ok else None
        print(f"{'OK ' if ok else 'ERR'} {rec.get('to')} -> {resp.status_code} "
              f"{draft_id or resp.text[:200]}")
        results.append({"to": rec.get("to"), "status": resp.status_code, "draft_id": draft_id})

    if args.log:
        import csv
        args.log.parent.mkdir(parents=True, exist_ok=True)
        with args.log.open("w", newline="", encoding="utf-8-sig") as fh:
            writer = csv.DictWriter(fh, fieldnames=["to", "status", "draft_id"])
            writer.writeheader()
            writer.writerows(results)

    created = sum(1 for r in results if r["draft_id"])
    print(f"created {created}/{len(results)} drafts")


if __name__ == "__main__":
    main()
