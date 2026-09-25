"""Backfill email_norm / phone_norm on existing entities from their bio_text.

YouTube channels were ingested before platforms/youtube.py extracted contacts,
so their descriptions (stored in entities.bio_text) hold emails/phones that were
never parsed into the contact columns. This re-runs the same
discovery/common/contacts.py pass over stored bios and fills in only the columns
that are currently NULL (never overwrites a value a scrape already found).

    # see what would change, touch nothing:
    python -m scripts.backfill_contacts --platform youtube --dry-run
    # apply it:
    python -m scripts.backfill_contacts --platform youtube
    # every platform (safe -- only fills NULLs):
    python -m scripts.backfill_contacts --platform all
"""

import argparse
import sys

from db.loader import contacts_from_entity


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Backfill email/phone/contacts from bio_text")
    ap.add_argument("--platform", default="youtube",
                    help="platform to backfill, or 'all' (default: youtube)")
    ap.add_argument("--dry-run", action="store_true", help="report changes without writing")
    args = ap.parse_args()

    from db.connection import get_conn
    from psycopg.types.json import Jsonb

    where = "" if args.platform == "all" else "and platform = %s"
    params = [] if args.platform == "all" else [args.platform]

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            select entity_id, bio_text, email_norm, phone_norm, wechat_norm, contacts
            from entities
            where bio_text is not null and bio_text <> ''
              and (email_norm is null or phone_norm is null or wechat_norm is null or contacts is null)
              {where}
            """,
            params,
        )
        rows = cur.fetchall()

        emails = phones = extras = 0
        for entity_id, bio, email_norm, phone_norm, wechat_norm, contacts in rows:
            entity = {"bio_text": bio, "email_norm": email_norm,
                      "phone_norm": phone_norm, "wechat_norm": wechat_norm}
            new_email, new_phone, new_wechat, new_extras = contacts_from_entity(entity)
            has_extras = new_extras is not None and contacts is None
            if (new_email == email_norm and new_phone == phone_norm
                    and new_wechat == wechat_norm and not has_extras):
                continue  # nothing new found for this row
            emails += new_email != email_norm
            phones += new_phone != phone_norm
            extras += has_extras
            if not args.dry_run:
                cur.execute(
                    "update entities set email_norm=%s, phone_norm=%s, wechat_norm=%s, "
                    "contacts=coalesce(%s, contacts) where entity_id=%s",
                    (new_email, new_phone, new_wechat,
                     Jsonb(new_extras) if new_extras else None, entity_id),
                )
        if not args.dry_run:
            conn.commit()
    conn.close()

    verb = "would fill" if args.dry_run else "filled"
    print(f"scanned {len(rows)} rows ({args.platform})  ->  {verb} "
          f"{emails} emails, {phones} phones, {extras} contact-blobs")


if __name__ == "__main__":
    main()
