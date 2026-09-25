"""Write local .eml draft files — no Graph, no auth, no admin consent needed.

Each record in drafts.jsonl becomes an .eml with the `X-Unsent: 1` header, so
double-clicking it opens in Outlook as an editable, ready-to-send message with
To / Bcc / Subject / HTML body + company footer already filled in. Review and
send by hand. This is the interim path while the Graph/MCP admin consent is
pending.

    python -m outreach.eml --input outreach/drafts.jsonl \
        --out-dir results/2026-09/2026-09-18/eml \
        --footer outreach/footer.html --from precy.vuong@tmgm.com

The footer is whatever HTML lives in --footer (default outreach/footer.html) —
edit that one file to change the signature/branding on every message.
"""

import argparse
import json
import re
import sys
from datetime import date
from email.message import EmailMessage
from email.utils import formatdate
from pathlib import Path

from outreach.build import strip_contact_block
from outreach.render import text_to_html

DEFAULT_FOOTER = Path(__file__).resolve().parent / "footer.html"
# All .eml go under one dedicated folder, one subfolder per run (--label), so
# large batches stay organized and separate.
EML_ROOT = Path("outreach/eml")

_GREETING_RE = re.compile(r"^\s*Kính gửi\s+", re.IGNORECASE)


def _subject_from_body(body: str) -> str:
    """Derive the subject from the greeting line when the sheet has no subject
    column: keep the addressee together with their honorific/pronoun (e.g. "Anh
    Bắc Dương", "Đội ngũ 5 Phút Crypto"), dropping any "(kênh …)" parenthetical."""
    first = (body.splitlines() or [""])[0]
    name = _GREETING_RE.sub("", first).rstrip(" ,").strip()
    name = re.sub(r"\s*\([^)]*\)\s*$", "", name).rstrip(" ,").strip()
    if name:
        name = name[0].upper() + name[1:]
    return f"{name} | TMGM Úc mời hợp tác" if name else "TMGM Úc mời hợp tác"


def records_from_xlsx(xlsx_path: Path, bcc: str = "", strip_contacts: bool = True) -> list[dict]:
    """Read a sheet with columns email / nội dung email (+ optional source_url)
    into drafts records. Subject is derived from the body greeting."""
    from openpyxl import load_workbook

    ws = load_workbook(xlsx_path).active
    header = [str(ws.cell(1, c).value or "").strip().lower() for c in range(1, ws.max_column + 1)]

    def col(*names):
        for n in names:
            if n in header:
                return header.index(n) + 1
        return None

    c_email = col("email")
    c_body = col("nội dung email", "noi dung email", "body", "content for mail")
    c_subject = col("subject for mail", "subject")
    c_src = col("source_url", "link social network", "link")
    if not c_email or not c_body:
        raise ValueError(f"sheet needs 'email' and 'nội dung email' (or 'Content for mail') columns; got {header}")

    # Sheets sometimes carry each recipient twice (a plain cell and a "mailto:"
    # hyperlink copy). Normalize the address and de-duplicate by it, keeping the
    # first occurrence that actually has a body.
    by_email: dict[str, dict] = {}
    order: list[str] = []
    for r in range(2, ws.max_row + 1):
        raw = ws.cell(r, c_email).value
        if not raw or not str(raw).strip():
            continue
        email = re.sub(r"\s+", " ", str(raw)).strip(" ,")
        if email.lower().startswith("mailto:"):
            email = email[len("mailto:"):].strip()
        key = email.lower()
        if by_email.get(key, {}).get("body", "").strip():
            continue  # already have a filled-in draft for this address
        body = str(ws.cell(r, c_body).value or "")
        if strip_contacts:
            body = strip_contact_block(body)
        subject = str(ws.cell(r, c_subject).value or "").strip() if c_subject else ""
        rec = {
            "to": email,
            "cc": [],
            "bcc": bcc or None,
            "subject": subject or _subject_from_body(body),
            "body": body,
            "source_url": (ws.cell(r, c_src).value if c_src else None),
        }
        if key not in by_email:
            order.append(key)
        by_email[key] = rec
    return [by_email[k] for k in order]


def _addr_list(value) -> list[str]:
    if not value:
        return []
    return value if isinstance(value, list) else [value]


def build_eml(rec: dict, footer_html: str = "", from_addr: str | None = None) -> EmailMessage:
    """One drafts.jsonl record -> an X-Unsent .eml (multipart/alternative)."""
    msg = EmailMessage()
    if from_addr:
        msg["From"] = from_addr
    if rec.get("to"):
        msg["To"] = ", ".join(_addr_list(rec["to"]))
    if rec.get("cc"):
        msg["Cc"] = ", ".join(_addr_list(rec["cc"]))
    if rec.get("bcc"):
        msg["Bcc"] = ", ".join(_addr_list(rec["bcc"]))
    msg["Subject"] = rec.get("subject", "")
    msg["Date"] = formatdate(localtime=True)
    msg["X-Unsent"] = "1"  # tells Outlook to open this as an editable draft

    body = rec.get("body", "")
    msg.set_content(body)  # text/plain alternative
    html = f"<html><body>{text_to_html(body)}{footer_html}</body></html>"
    msg.add_alternative(html, subtype="html")
    return msg


def _slug(rec: dict, index: int) -> str:
    to = (_addr_list(rec.get("to")) or ["draft"])[0]
    local = to.split("@", 1)[0]
    local = re.sub(r"[^\w.-]", "_", local)
    return f"{index:02d}_{local}.eml"


def write_eml_files(records: list[dict], out_dir: Path, footer_html: str = "",
                    from_addr: str | None = None) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for i, rec in enumerate(records, 1):
        path = out_dir / _slug(rec, i)
        path.write_bytes(bytes(build_eml(rec, footer_html, from_addr)))
        paths.append(path)
    return paths


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Write .eml draft files from drafts.jsonl or an Excel sheet")
    ap.add_argument("--input", type=Path, default=Path("outreach/drafts.jsonl"))
    ap.add_argument("--xlsx", type=Path, default=None,
                    help="read from an Excel sheet (email / nội dung email columns) instead of --input")
    ap.add_argument("--bcc", default="j.tran@tmgm.com", help="BCC applied to every message (xlsx mode)")
    ap.add_argument("--limit", type=int, default=None, help="only the first N rows (e.g. 1 to test)")
    ap.add_argument("--out-dir", type=Path, default=None,
                    help="base folder (default outreach/eml)")
    ap.add_argument("--label", default=date.today().isoformat(),
                    help="subfolder for this run under the base folder (default: today)")
    ap.add_argument("--footer", type=Path, default=DEFAULT_FOOTER,
                    help="HTML file appended to every message (default outreach/footer.html)")
    ap.add_argument("--from", dest="from_addr", default=None,
                    help="From address (optional; Outlook uses the signed-in account anyway)")
    args = ap.parse_args()

    if args.xlsx:
        records = records_from_xlsx(args.xlsx, bcc=args.bcc)
    else:
        records = [json.loads(l) for l in args.input.read_text(encoding="utf-8").splitlines() if l.strip()]
    if args.limit:
        records = records[:args.limit]
    footer_html = args.footer.read_text(encoding="utf-8") if args.footer and args.footer.exists() else ""
    if not footer_html:
        print(f"warning: no footer loaded from {args.footer}")

    out_dir = (args.out_dir or EML_ROOT) / args.label
    paths = write_eml_files(records, out_dir, footer_html, args.from_addr)
    for p in paths:
        print(f"wrote {p}")
    print(f"{len(paths)} .eml files -> {out_dir}  (double-click to open as Outlook draft)")


if __name__ == "__main__":
    main()
