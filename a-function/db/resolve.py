"""Cross-platform identity resolution, callable in-process after a load.

This is the Python twin of db/02_resolve.sql: it links entities that look like
the same person ACROSS platforms so a lead already captured on (say) YouTube is
not treated as an unrelated duplicate when the same phone/email/handle turns up
again on Telegram. Strong keys (phone, email, website domain) are linked as
'confirmed'; weak keys (bio cross-reference, exact handle) are 'candidate' and
wait for review -- the same "bias toward splitting" the SQL file documents.

Every statement is ON CONFLICT DO NOTHING, so this is idempotent and safe to run
after each ingest. db/loader.py calls resolve_entities() at the end of every
load, which is why it covers ALL platforms (they all funnel through the loader).

    python -m db.resolve      # run a full resolution pass over the whole table
"""

import logging

from psycopg import Connection

LOG = logging.getLogger(__name__)

# One statement per resolution rule, in strong-key-first order (mirrors
# db/02_resolve.sql). The shared bio-link domains in the website rule are inlined
# as a subquery instead of a TEMP table so this is safe to call repeatedly on any
# connection/transaction.
_LINK_STATEMENTS = (
    # phone match (strong -> confirmed)
    """
    INSERT INTO entity_links (entity_id_a, entity_id_b, method, confidence, evidence, status)
    SELECT LEAST(a.entity_id, b.entity_id), GREATEST(a.entity_id, b.entity_id),
           'phone_match', 'strong', jsonb_build_object('phone', a.phone_norm), 'confirmed'
    FROM entities a JOIN entities b
      ON a.phone_norm = b.phone_norm AND a.entity_id < b.entity_id AND a.platform <> b.platform
    WHERE a.phone_norm IS NOT NULL
    ON CONFLICT (entity_id_a, entity_id_b, method) DO NOTHING
    """,
    # email match (strong -> confirmed)
    """
    INSERT INTO entity_links (entity_id_a, entity_id_b, method, confidence, evidence, status)
    SELECT LEAST(a.entity_id, b.entity_id), GREATEST(a.entity_id, b.entity_id),
           'email_match', 'strong', jsonb_build_object('email', a.email_norm), 'confirmed'
    FROM entities a JOIN entities b
      ON a.email_norm = b.email_norm AND a.entity_id < b.entity_id AND a.platform <> b.platform
    WHERE a.email_norm IS NOT NULL
    ON CONFLICT (entity_id_a, entity_id_b, method) DO NOTHING
    """,
    # same website domain (strong -> confirmed), excluding shared bio-link hosts
    """
    INSERT INTO entity_links (entity_id_a, entity_id_b, method, confidence, evidence, status)
    SELECT LEAST(a.entity_id, b.entity_id), GREATEST(a.entity_id, b.entity_id),
           'domain_match', 'strong', jsonb_build_object('domain', a.website_url), 'confirmed'
    FROM entities a JOIN entities b
      ON a.website_url = b.website_url AND a.entity_id < b.entity_id AND a.platform <> b.platform
    WHERE a.website_url IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM unnest(ARRAY['linktr.ee','bio.link','beacons.ai','lnk.bio','carrd.co']) AS domain
          WHERE a.website_url ILIKE '%' || domain || '%'
      )
    ON CONFLICT (entity_id_a, entity_id_b, method) DO NOTHING
    """,
    # bio of A mentions B's handle (weak -> candidate)
    """
    INSERT INTO entity_links (entity_id_a, entity_id_b, method, confidence, evidence, status)
    SELECT LEAST(a.entity_id, b.entity_id), GREATEST(a.entity_id, b.entity_id),
           'bio_crossref', 'candidate', jsonb_build_object('found_handle_in_bio', b.handle), 'auto'
    FROM entities a JOIN entities b
      ON a.entity_id <> b.entity_id AND a.platform <> b.platform
     AND b.handle IS NOT NULL AND a.bio_text ILIKE '%' || b.handle || '%'
    WHERE a.bio_text IS NOT NULL
    ON CONFLICT (entity_id_a, entity_id_b, method) DO NOTHING
    """,
    # exact handle across platforms (weak -> candidate)
    """
    INSERT INTO entity_links (entity_id_a, entity_id_b, method, confidence, evidence, status)
    SELECT LEAST(a.entity_id, b.entity_id), GREATEST(a.entity_id, b.entity_id),
           'handle_exact', 'candidate', jsonb_build_object('handle', lower(a.handle)), 'auto'
    FROM entities a JOIN entities b
      ON lower(regexp_replace(a.handle, '[^a-zA-Z0-9]', '', 'g'))
       = lower(regexp_replace(b.handle, '[^a-zA-Z0-9]', '', 'g'))
     AND a.entity_id < b.entity_id AND a.platform <> b.platform
    WHERE a.handle IS NOT NULL AND length(a.handle) >= 5
    ON CONFLICT (entity_id_a, entity_id_b, method) DO NOTHING
    """,
)


def resolve_entities(conn: Connection) -> dict:
    """Link same-person entities across platforms. Returns {'links_added': n}.

    Idempotent (every INSERT is ON CONFLICT DO NOTHING), so it is cheap to run
    after each load: only genuinely new cross-platform matches add an edge."""
    added = 0
    with conn.cursor() as cur:
        for statement in _LINK_STATEMENTS:
            cur.execute(statement)
            added += cur.rowcount if cur.rowcount and cur.rowcount > 0 else 0
    conn.commit()
    return {"links_added": added}


def main() -> None:
    import json

    from db.connection import get_conn

    logging.basicConfig(level=logging.INFO)
    conn = get_conn()
    try:
        result = resolve_entities(conn)
    finally:
        conn.close()
    print(json.dumps(result))


if __name__ == "__main__":
    main()
