"""CreateMail — Excel → Outlook draft (.eml) files, in one command.

Takes a spreadsheet with `email` and `nội dung email` (or `Content for mail`,
as produced by discovery.shortlist) columns — `Subject for mail`/`source_url`
optional — and writes one .eml per row. Each .eml has X-Unsent:1, so
double-clicking opens it in Outlook as an editable draft with the company footer
already attached. No sign-in, no admin consent.

    # first row only (quick test):
    python -m outreach.createmail "C:\\Users\\PrecyVuong\\Downloads\\mailnow.xlsx"

    # every row:
    python -m outreach.createmail "C:\\Users\\PrecyVuong\\Downloads\\mailnow.xlsx" --all

BCC and From default to the TMGM values; override with --bcc / --from. Files go
to outreach/eml/<label>/ (label defaults to today) so each batch stays separate.

Before drafting, the sheet's own email/phone/zalo/telegram/facebook/instagram/
website columns are synced back into the DB (outreach.sheet_sync) -- so contacts
you hand-typed into the sheet aren't lost the next time a scrape only fills
some of them. Every row it writes an .eml for then counts as contacted: the
entity is marked in the DB (entities.contacted_at / follow_up_at, see
outreach.contacted) and the input sheet gets "already contact" = Yes (+
website / follow up columns). Pass --no-mark for a throwaway test run that
touches neither (sheet-sync nor contacted-marking).
"""

import argparse
import sys
from datetime import date
from pathlib import Path

from outreach.contacted import record_contacted
from outreach.eml import DEFAULT_FOOTER, EML_ROOT, records_from_xlsx, write_eml_files
from outreach.sheet_sync import sync_sheet


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Excel -> Outlook .eml drafts")
    ap.add_argument("xlsx", type=Path, help="path to the .xlsx (email + nội dung email columns)")
    ap.add_argument("--all", action="store_true", help="all rows (default: only the first row)")
    ap.add_argument("--footer", action="store_true",
                    help="append outreach/footer.html (for machines with no Outlook signature). "
                         "Default: no footer — Outlook adds your own signature.")
    ap.add_argument("--keep-contacts", action="store_true",
                    help="keep the WhatsApp/Telegram/LinkedIn block in the body. "
                         "Default: strip it (your Outlook signature already carries contacts).")
    ap.add_argument("--bcc", default="j.tran@tmgm.com")
    ap.add_argument("--from", dest="from_addr", default="precy.vuong@tmgm.com")
    ap.add_argument("--label", default=date.today().isoformat(),
                    help="subfolder under outreach/eml/ for this batch")
    ap.add_argument("--no-mark", action="store_true",
                    help="skip DB writes for this run: no sheet->DB contact sync, "
                         "no marking these rows contacted")
    args = ap.parse_args()

    records = records_from_xlsx(args.xlsx, bcc=args.bcc, strip_contacts=not args.keep_contacts)
    if not records:
        print("no rows with an email address found")
        return
    if not args.all:
        records = records[:1]

    if not args.no_mark:
        try:
            from db.connection import get_conn

            with get_conn() as conn:
                sync_sheet(conn, args.xlsx).print()
        except Exception as e:  # DB down / not configured: drafting still proceeds
            print(f"warning: sheet_sync skipped ({e})")

    footer = DEFAULT_FOOTER.read_text(encoding="utf-8") if args.footer and DEFAULT_FOOTER.exists() else ""
    out_dir = EML_ROOT / args.label
    paths = write_eml_files(records, out_dir, footer, args.from_addr)
    for p in paths:
        print(f"wrote {p}")
    print(f"{len(paths)} .eml -> {out_dir}  (double-click to open in Outlook)")
    if not args.no_mark:
        record_contacted(records, args.label, args.xlsx)


if __name__ == "__main__":
    main()
