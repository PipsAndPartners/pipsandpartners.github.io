"""Build a drafts.jsonl from a curated shortlist CSV + an outreach markdown file.

The CSV supplies name/contact/source_url (one row per channel, ranked); the
markdown supplies the per-channel email body under `## <rank>. ...` headers.
Only rows whose contact field contains an email address are kept, since a draft
needs a recipient. The email address is pulled out of the contact column; the
rest of that column is ignored here (it's phone/Telegram/etc. for humans).

    python -m outreach.build \
        --csv results/2026-09/2026-09-18/ib_shortlist_vietnam_curated.csv \
        --md  results/2026-09/2026-09-18/outreach_emails_vietnam.md \
        --bcc j.tran@tmgm.com \
        --out drafts.jsonl

Output is one JSON object per line: {to, cc, bcc, subject, body, source_url}.
"""

import argparse
import csv
import json
import re
import sys
from pathlib import Path

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")

# The personal contact block at the end of each body ("... liên hệ trực tiếp với
# em qua / WhatsApp / Telegram / Linkedin"). The footer now carries all contacts,
# so strip this to avoid duplicating it. Collapses the lead-in to a period.
_CONTACT_RE = re.compile(
    r"\s*(?:hoặc|hay)\s+liên hệ trực tiếp với em qua\s*\n"
    r"\s*WhatsApp:[^\n]*\n"
    r"\s*Telegram:[^\n]*\n"
    r"\s*Linkedin:[^\n]*",
    re.IGNORECASE,
)


def strip_contact_block(body: str) -> str:
    return _CONTACT_RE.sub(".", body)


def parse_bodies(md_path: Path) -> dict[int, str]:
    """Map each `## <n>. ...` section of the outreach markdown to its body text
    (everything after the header line, trimmed). Sections are `---`-separated."""
    bodies: dict[int, str] = {}
    md = md_path.read_text(encoding="utf-8")
    for chunk in md.split("\n---\n"):
        match = re.match(r"\s*##\s*(\d+)\.", chunk)
        if not match:
            continue
        lines = chunk.strip().split("\n")
        bodies[int(match.group(1))] = "\n".join(lines[1:]).strip()
    return bodies


def build(csv_path: Path, md_path: Path, bcc: str, subject_tmpl: str,
          only_with_email: bool = True, strip_contacts: bool = True) -> list[dict]:
    bodies = parse_bodies(md_path)
    drafts: list[dict] = []
    with csv_path.open(encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            rank = int(row["rank"])
            match = EMAIL_RE.search(row.get("contact") or "")
            email = match.group(0) if match else ""
            if not email and only_with_email:
                continue
            body = bodies.get(rank, "")
            if strip_contacts:
                body = strip_contact_block(body)
            drafts.append({
                "to": email,
                "cc": [],
                "bcc": bcc or None,
                "subject": subject_tmpl.format(name=row["name"]),
                "body": body,
                "source_url": row.get("source_url"),
            })
    return drafts


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Build drafts.jsonl for outreach.push")
    ap.add_argument("--csv", type=Path, required=True, help="curated shortlist CSV")
    ap.add_argument("--md", type=Path, required=True, help="outreach markdown with bodies")
    ap.add_argument("--bcc", default="", help="BCC address applied to every draft")
    ap.add_argument("--subject-tmpl", default="TMGM Úc — Lời mời hợp tác cùng {name}")
    ap.add_argument("--out", type=Path, default=Path("drafts.jsonl"))
    ap.add_argument("--all", action="store_true",
                    help="keep rows without an email too (to is left blank)")
    ap.add_argument("--keep-contacts", action="store_true",
                    help="keep the WhatsApp/Telegram/Linkedin block in the body "
                         "(default: strip it, since the footer carries contacts)")
    args = ap.parse_args()

    drafts = build(args.csv, args.md, args.bcc, args.subject_tmpl,
                   only_with_email=not args.all, strip_contacts=not args.keep_contacts)
    args.out.write_text(
        "".join(json.dumps(d, ensure_ascii=False) + "\n" for d in drafts),
        encoding="utf-8",
    )
    print(f"wrote {len(drafts)} drafts -> {args.out}")


if __name__ == "__main__":
    main()
