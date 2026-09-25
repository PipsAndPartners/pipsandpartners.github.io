"""Turn raw discovery into a ranked IB shortlist for one broker + market.

This is the codified version of the ad-hoc filtering that the XTB run needed:
dedup against what's already been found, drop the broker's own pages and rival
brokers, keep only in-market forex creators, and rank by real IB potential.

Pure helpers (no DB) are unit-tested in tests/test_shortlist.py; the DB glue and
CLI at the bottom read `entities` + `entity_scores` (run db/run_scoring.py first,
or let this module do it with the default --score).

    python -m discovery.shortlist --broker xtb --market vn \
        --exclude-dir results/2026-09/2026-09-16 --top 10
"""

from __future__ import annotations

import argparse
import csv
import io
import math
import re
import sys
from datetime import date, datetime
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "data"

# Distinctively Vietnamese letters only (horn/underdot/stacked-tone + đ). Bare
# á/é/í/ó/ú are shared with Hungarian/Turkish/etc. and caused false positives.
VN_STRONG = re.compile(r"[đăâêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệịỉọỏốồổỗộớờởỡợụủứừửữựỳỷỹỵ]", re.I)
VN_WORDS = ("việt", "vietnam", "viet nam", "người việt", "hà nội", "sài gòn", "hồ chí minh", "hcm", " vn")
VN_PHONE = re.compile(r"(?:\+84|0)(?:[\s.\-]?\d){8,9}")
FOREIGN = ("italia", "italiano", "deutschland", "portugal", "polska", "france", "français", "francais",
           "magyar", "türk", "menkul", "espana", "españa", "romania", "brasil", "indonesia", "malaysia",
           "nederland", "svenska", "polski", "česk", "österreich")

FOREX_TERMS = ("forex", "trading", "trader", "ngoại hối", "ngoai hoi", "đầu tư", "dau tu", "chứng khoán",
               "broker", " ib ", "mib", "tài chính", "sàn ", "san forex", "mt4", "mt5", "phái sinh",
               "exness", "vàng", "gold", "xauusd", "giao dịch", "đầu tư tài chính")

_ID_RE = re.compile(r"(?:tiktok\.com/@|youtube\.com/@|facebook\.com/|channel/)([\w.\-]+)", re.I)
_YDAY_TIKTOK = re.compile(r"tiktok\.com/@([\w.\-]+)", re.I)
_YDAY_YT_ID = re.compile(r"channel/(UC[\w\-]{10,})", re.I)
_YDAY_YT_AT = re.compile(r"youtube\.com/@([\w.\-]+)", re.I)
_YDAY_FB = re.compile(r"facebook\.com/([\w.\-]+)", re.I)


def _load_lines(path: Path, fallback: tuple[str, ...]) -> tuple[str, ...]:
    """Lowercased, comment-stripped lines from a data file; fallback if it's missing."""
    try:
        out = []
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.split("#", 1)[0].strip().lower()
            if line:
                out.append(line)
        return tuple(out) if out else fallback
    except FileNotFoundError:
        return fallback


BROKER_BRANDS = _load_lines(DATA_DIR / "broker_brands.txt",
                            ("vantage", "exness", "tmgm", "roboforex", "fxcm", "vt markets"))
PERSONAL_MAIL = frozenset(_load_lines(DATA_DIR / "personal_mail.txt",
                                      ("gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com")))

# Hardcoded, independent of --broker: drop anyone whose raw staged content already
# mentions TMGM (an existing TMGM IB/affiliate), not just TMGM's own branded page
# (that part is already covered by BROKER_BRANDS/is_other_broker above).
EXCLUDE_BROKER = "tmgm"


# --------------------------------------------------------------------------- #
# Pure predicates (unit-tested; no DB, no I/O)                                 #
# --------------------------------------------------------------------------- #
def vn_signal(*texts: str) -> bool:
    """True if the text looks Vietnamese and not tagged to another country."""
    blob = " ".join(t for t in texts if t)
    low = blob.lower()
    if any(tok in low for tok in FOREIGN):
        return False
    return bool(VN_STRONG.search(blob) or VN_PHONE.search(blob) or any(w in low for w in VN_WORDS))


def is_broker_self(name: str, handle: str, broker: str) -> bool:
    """The target broker's OWN account (e.g. 'XTB', 'XTB UK', handle 'xtbtr')."""
    b = broker.lower()
    if re.match(rf"^\s*{re.escape(b)}(\s+[\wà-ỹ]+){{0,2}}\s*$", name or "", re.I):
        return True
    h = (handle or "").lower().lstrip("@")
    return h.startswith(b) or "menkul" in (name or "").lower()


def is_other_broker(name: str, handle: str, brands: tuple[str, ...] = BROKER_BRANDS) -> bool:
    """A rival broker's own page -- brand leads the name/handle."""
    ident = f"{(name or '').lower()} {(handle or '').lower()}".strip()
    return any(ident.startswith(b) or f" {b}" in ident for b in brands)


def is_forex(name: str, bio: str, relevance) -> bool:
    """A forex/IB creator, not an account that merely shares the broker's letters."""
    if relevance and relevance >= 15:
        return True
    blob = f" {(name or '').lower()} {(bio or '').lower()} "
    return any(t in blob for t in FOREX_TERMS)


def is_broker_corp_email(email: str, personal: frozenset = PERSONAL_MAIL) -> bool:
    """A corporate (non-personal, non-.edu) email on a Facebook Page => broker page."""
    if not email or "@" not in email:
        return False
    domain = email.rsplit("@", 1)[-1].lower()
    return domain not in personal and not domain.endswith(".edu") and not domain.endswith(".edu.vn")


def candidate_ids(handle: str, platform_id, source_url: str) -> set[str]:
    """Lowercased identifiers for one entity, for matching against an exclusion set."""
    ids = set()
    if handle:
        ids.add(handle.strip().lower().lstrip("@"))
    if platform_id:
        ids.add(str(platform_id).strip().lower())
    if source_url:
        ids.update(m.lower() for m in _ID_RE.findall(source_url))
    return ids


def parse_exclusion_ids(text: str) -> set[str]:
    """Pull TikTok handles / YouTube channelIds / FB slugs from prior export text."""
    ids = set()
    try:
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            for col, val in row.items():
                if not val:
                    continue
                if (col or "").strip().lower() == "handle":
                    ids.add(val.strip().lower())
    except Exception:
        pass
    ids.update(m.lower() for m in _YDAY_TIKTOK.findall(text))
    ids.update(m.lower() for m in _YDAY_YT_ID.findall(text))
    ids.update(m.lower() for m in _YDAY_YT_AT.findall(text))
    ids.update(m.lower() for m in _YDAY_FB.findall(text)
               if m.lower() not in ("profile.php", "people", "pages"))
    return ids


def _ids_from_xlsx(path: Path) -> set[str]:
    """Exclusion ids from a shortlist .xlsx: the `handle` column plus any
    TikTok/YouTube/Facebook ids in the `source_url` column. (Shortlists now
    default to .xlsx, so prior exports must be readable to dedup against them.)"""
    from openpyxl import load_workbook

    ids: set[str] = set()
    try:
        ws = load_workbook(path, read_only=True, data_only=True).active
    except Exception:
        return ids
    rows = ws.iter_rows(values_only=True)
    header = [str(c or "").strip().lower() for c in (next(rows, []) or [])]
    h = header.index("handle") if "handle" in header else None
    s = header.index("source_url") if "source_url" in header else None
    for row in rows:
        if h is not None and h < len(row) and row[h]:
            ids.add(str(row[h]).strip().lower().lstrip("@"))
        if s is not None and s < len(row) and row[s]:
            ids |= parse_exclusion_ids(str(row[s]))
    return ids


def load_exclusion_ids(paths: list[Path]) -> set[str]:
    ids = set()
    for base in paths:
        files = base.rglob("*") if base.is_dir() else [base]
        for f in files:
            if not f.is_file():
                continue
            if f.suffix.lower() in (".csv", ".json"):
                ids |= parse_exclusion_ids(f.read_text(encoding="utf-8-sig", errors="replace"))
            elif f.suffix.lower() == ".xlsx":
                ids |= _ids_from_xlsx(f)
    return ids


def potential(row: dict) -> float:
    """Blended IB-potential score: reachable + audience reach + broker link + quality.
    No single signal dominates (a lexicographic key once floated a 46-follower channel
    above a 155k community)."""
    followers = row.get("follower_count") or 0
    has_contact = bool(row.get("email_norm") or row.get("phone_norm"))
    return (
        (2.0 if has_contact else 0.0)
        + (1.0 if row.get("broker_hit") else 0.0)
        + math.log10(followers + 1)
        + float(row.get("composite_score") or 0) / 100.0
    )


# --------------------------------------------------------------------------- #
# DB glue                                                                      #
# --------------------------------------------------------------------------- #
def _broker_hit(cur, platform: str, platform_id: str, broker: str) -> bool:
    from psycopg import sql
    table = sql.Identifier(f"staging_{platform}")
    # \y = word boundary, so the broker name, not its letters inside another word.
    cur.execute(
        sql.SQL(r"select 1 from {} where platform_id = %s and raw::text ~* %s limit 1").format(table),
        (platform_id, rf"\y{re.escape(broker)}\y"),
    )
    return cur.fetchone() is not None


def shortlist(conn, broker: str, market: str, platforms: list[str], exclude_ids: set[str],
              since: datetime | date | None, top: int, min_followers: int = 0,
              primary: str | None = None, include_contacted: bool = False,
              strict_new: bool = False, max_fake_audience: int | None = 70) -> tuple[list[dict], dict]:
    from psycopg.rows import dict_row

    conn.row_factory = dict_row
    params: list = [list(platforms)]  # psycopg adapts a list (not a tuple) to a PG array for ANY()
    where_since = ""
    if since is not None:
        where_since = " and e.first_seen_at >= %s"
        params.append(since)
    # --strict-new: also drop an otherwise-"new" entity that is a confirmed
    # cross-platform alias of someone already known before `since` (e.g. a brand
    # new YouTube channel whose bio phone/email matches a TikTok lead captured
    # last month) -- first_seen_at alone can't see that, only entity_links can.
    where_linked = ""
    if strict_new and since is not None:
        where_linked = """
            and not exists (
                select 1 from entity_links l
                join entities other
                  on other.entity_id = (case when l.entity_id_a = e.entity_id
                                              then l.entity_id_b else l.entity_id_a end)
                where l.status = 'confirmed'
                  and (l.entity_id_a = e.entity_id or l.entity_id_b = e.entity_id)
                  and other.first_seen_at < %s
            )
        """
        params.append(since)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            select e.entity_id, e.platform, e.platform_id, e.handle, e.display_name, e.bio_text,
                   e.follower_count, e.email_norm, e.phone_norm, e.contacts, e.source_url,
                   coalesce(e.website_url, e.contacts->>'website') as website,
                   e.contacted_at, e.follow_up_at, e.follow_up_note,
                   s.creator_relevance, s.brand_safety, s.engagement_rate,
                   s.composite_score, s.data_completeness, s.fake_audience_signal
            from entities e
            left join entity_scores s using (entity_id)
            where e.platform = any(%s){where_since}{where_linked}
            """,
            params,
        )
        rows = cur.fetchall()

        kept: list[dict] = []
        dropped = {"dup": 0, "contacted": 0, "broker_self": 0, "other_broker": 0, "tmgm_ib": 0,
                   "corp_email": 0, "no_market": 0, "not_forex": 0, "fake_audience": 0}
        for r in rows:
            name, handle = r["display_name"] or "", r["handle"] or ""
            if candidate_ids(handle, r["platform_id"], r["source_url"]) & exclude_ids:
                dropped["dup"] += 1; continue
            if r["contacted_at"] and not include_contacted:  # already emailed (outreach.contacted)
                dropped["contacted"] += 1; continue
            if is_broker_self(name, handle, broker):
                dropped["broker_self"] += 1; continue
            if is_other_broker(name, handle):
                dropped["other_broker"] += 1; continue
            if _broker_hit(cur, r["platform"], r["platform_id"], EXCLUDE_BROKER):
                dropped["tmgm_ib"] += 1; continue
            if (r.get("contacts") or {}).get("tmgm_mention"):
                dropped["tmgm_ib"] += 1; continue
            if r["platform"] == "facebook" and is_broker_corp_email(r["email_norm"]):
                dropped["corp_email"] += 1; continue
            if market == "vn" and not vn_signal(name, handle, r["bio_text"] or ""):
                dropped["no_market"] += 1; continue
            if not is_forex(name, r["bio_text"], r["creator_relevance"]):
                dropped["not_forex"] += 1; continue
            # fake_audience_signal is a 0-100 risk score (see scoring.score_fake_audience,
            # YouTube-only today); None (not computable) is never dropped, only a
            # confirmed high-risk reading is.
            if max_fake_audience is not None and (r["fake_audience_signal"] or 0) >= max_fake_audience:
                dropped["fake_audience"] += 1; continue
            if (r["follower_count"] or 0) < min_followers:
                continue
            r["broker_hit"] = _broker_hit(cur, r["platform"], r["platform_id"], broker)
            kept.append(r)

    kept.sort(key=potential, reverse=True)

    from collections import defaultdict
    per = defaultdict(list)
    for r in kept:
        per[r["platform"]].append(r)
    picked, chosen = [], set()
    if primary:
        # primary platform is the main channel: fill it first (by rank), then the
        # other platforms as secondary fill -- no forced per-platform quota.
        for p in [primary] + [q for q in platforms if q != primary]:
            for r in per[p]:
                if len(picked) >= top:
                    break
                picked.append(r); chosen.add(r["entity_id"])
    else:
        # guarantee a spread across the requested platforms (>=2 each if available), fill the rest by rank
        for p in platforms:
            for r in per[p][:2]:
                picked.append(r); chosen.add(r["entity_id"])
        for r in kept:
            if len(picked) >= top:
                break
            if r["entity_id"] not in chosen:
                picked.append(r); chosen.add(r["entity_id"])
    result = sorted(picked, key=potential, reverse=True)[:top]
    _fill_contacts_from_links(conn, result)
    result_meta = {"scanned": len(rows), "dropped": dropped, "kept": len(kept),
                   "by_platform": {p: len(per[p]) for p in platforms}}
    return result, result_meta


def _fill_contacts_from_links(conn, rows: list[dict]) -> None:
    """Cross-platform contact fallback: for a selected row still missing email or
    phone, borrow it from a confirmed entity_links neighbour -- the same person's
    account on another platform (linked by a shared phone/email/domain)."""
    missing = [r for r in rows if not (r.get("email_norm") and r.get("phone_norm"))]
    if not missing:
        return
    ids = [r["entity_id"] for r in missing]
    from psycopg.rows import dict_row

    neigh: dict[int, list[tuple]] = {}
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select l.entity_id_a, l.entity_id_b,
                   ea.email_norm as a_email, ea.phone_norm as a_phone, ea.contacts as a_contacts,
                   eb.email_norm as b_email, eb.phone_norm as b_phone, eb.contacts as b_contacts
            from entity_links l
            join entities ea on ea.entity_id = l.entity_id_a
            join entities eb on eb.entity_id = l.entity_id_b
            where l.status = 'confirmed' and (l.entity_id_a = any(%s) or l.entity_id_b = any(%s))
            """,
            (ids, ids),
        )
        for row in cur.fetchall():
            neigh.setdefault(row["entity_id_a"], []).append(
                (row["b_email"], row["b_phone"], row["b_contacts"]))
            neigh.setdefault(row["entity_id_b"], []).append(
                (row["a_email"], row["a_phone"], row["a_contacts"]))

    for r in missing:
        for email, phone, contacts in neigh.get(r["entity_id"], []):
            if not r.get("email_norm") and email:
                r["email_norm"] = email
            if not r.get("phone_norm") and phone:
                r["phone_norm"] = phone
            if not r.get("contacts") and contacts:
                r["contacts"] = contacts


COLS = ["rank", "platform", "name", "handle", "followers", "broker_mention", "relevance",
        "brand_safety", "engagement", "composite", "email", "phone",
        "zalo", "telegram", "facebook", "instagram", "website", "source_url",
        "Subject for mail", "Content for mail",
        "already contact", "follow up", "follow up note"]


def _row_values(i: int, r: dict, standouts: dict[str, str] | None) -> list:
    """One shortlist row as a list aligned with COLS, incl. the extra contact
    channels (from the contacts JSONB) and the two mail fields."""
    from outreach.mailfields import mail_fields, standout_for
    subject, content = mail_fields(r, standout_for(r, standouts))
    c = r.get("contacts") or {}
    return [i, r["platform"], r["display_name"] or "", (r["handle"] or "").lstrip("@"),
            r["follower_count"] or "", "Y" if r.get("broker_hit") else "",
            r["creator_relevance"], r["brand_safety"], r["engagement_rate"],
            r["composite_score"], r["email_norm"] or "", r["phone_norm"] or "",
            c.get("zalo") or "", c.get("telegram") or "", c.get("facebook") or "",
            c.get("instagram") or "", r.get("website") or "", r["source_url"] or "", subject, content,
            "Yes" if r.get("contacted_at") else "", r.get("follow_up_at") or "",
            r.get("follow_up_note") or ""]


def _write_csv(rows: list[dict], out: Path, standouts: dict[str, str] | None = None) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(COLS)
        for i, r in enumerate(rows, 1):
            w.writerow(_row_values(i, r, standouts))


def _write_xlsx(rows: list[dict], out: Path, standouts: dict[str, str] | None = None) -> None:
    from openpyxl import Workbook

    out.parent.mkdir(parents=True, exist_ok=True)
    wb = Workbook()
    ws = wb.active
    ws.title = "shortlist"
    ws.append(COLS)
    for i, r in enumerate(rows, 1):
        ws.append(_row_values(i, r, standouts))
    from outreach.contacted import yes_no_dropdown
    yes_no_dropdown(ws, COLS.index("already contact") + 1)
    wb.save(out)


def _write(rows: list[dict], out: Path, standouts: dict[str, str] | None = None) -> None:
    """Dispatch on the output suffix: .csv -> CSV, anything else -> .xlsx."""
    if out.suffix.lower() == ".csv":
        _write_csv(rows, out, standouts)
    else:
        _write_xlsx(rows, out, standouts)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows console is cp1252 by default
    ap = argparse.ArgumentParser(description="Rank an IB shortlist for one broker + market")
    ap.add_argument("--broker", default="xtb", help="target broker name (word-matched in staged text)")
    ap.add_argument("--market", default="vn", help="market gate; 'vn' requires a Vietnamese signal")
    ap.add_argument("--platforms", default="tiktok,facebook,facebook_post,youtube")
    ap.add_argument("--exclude-dir", action="append", default=[], type=Path,
                    help="dir/file of prior exports whose accounts to skip (repeatable)")
    ap.add_argument("--since", default=date.today().isoformat(),
                    help="only entities first seen on/after this date or datetime "
                         "(YYYY-MM-DD or YYYY-MM-DDTHH:MM); 'any' to disable")
    ap.add_argument("--top", type=int, default=10)
    ap.add_argument("--min-followers", type=int, default=0)
    ap.add_argument("--max-fake-audience", type=int, default=70,
                    help="drop entities whose fake_audience_signal risk score (0-100, YouTube-only "
                         "today) is at or above this; a NULL score (not computable) is never dropped. "
                         "101 disables the filter (scores are capped at 100)")
    ap.add_argument("--primary", default=None,
                    help="primary platform, filled first as the main channel (e.g. youtube); "
                         "the other --platforms fill the remaining slots as secondary")
    ap.add_argument("--step", type=int, default=0,
                    help="if fewer than --top are selected, lower --min-followers by this much and retry")
    ap.add_argument("--floor", type=int, default=0,
                    help="don't lower --min-followers below this when using --step")
    ap.add_argument("--no-score", action="store_true", help="skip re-scoring before selecting")
    ap.add_argument("--include-contacted", action="store_true",
                    help="keep entities already emailed (default: drop them, see outreach.contacted)")
    ap.add_argument("--strict-new", action="store_true",
                    help="with --since, also drop a 'new' entity that is a confirmed cross-platform "
                         "alias (entity_links, e.g. shared phone/email) of someone seen before --since")
    ap.add_argument("--enrich-websites", action="store_true",
                    help="before writing, crawl the selected rows' own website/bio-link page for a "
                         "missing email (free, no API quota -- see discovery.website_enrich)")
    ap.add_argument("--standouts", type=Path, default=None,
                    help="optional JSON {handle-or-name: standout} to fill the AA (điểm nổi bật) "
                         "in each email body; rows not listed fall back to a generic phrase")
    ap.add_argument("--output", type=Path, default=None,
                    help="output file; .csv writes CSV, any other suffix writes Excel (.xlsx); "
                         "defaults to results/<YYYY-MM>/<YYYY-MM-DD>/<market>/ib_shortlist.xlsx")
    args = ap.parse_args()
    if args.strict_new and args.since.lower() == "any":
        ap.error("--strict-new needs --since (it defines what 'before' means)")
    if args.output is None:
        args.output = (Path("results") / date.today().strftime("%Y-%m") / date.today().isoformat()
                       / args.market / "ib_shortlist.xlsx")

    from db.connection import get_conn

    if not args.no_score:
        from db.run_scoring import score_entities

        conn = get_conn()
        try:
            scored = score_entities(conn)
        finally:
            conn.close()
        print(f"scored {scored} entities")

    platforms = [p.strip() for p in args.platforms.split(",") if p.strip()]
    exclude_ids = load_exclusion_ids(args.exclude_dir)
    since = None if args.since.lower() == "any" else datetime.fromisoformat(args.since)

    standouts = None
    if args.standouts:
        import json
        standouts = json.loads(args.standouts.read_text(encoding="utf-8"))

    conn = get_conn()
    min_f = args.min_followers
    while True:
        rows, meta = shortlist(conn, args.broker, args.market, platforms, exclude_ids, since,
                               args.top, min_f, primary=args.primary,
                               include_contacted=args.include_contacted, strict_new=args.strict_new,
                               max_fake_audience=args.max_fake_audience)
        if len(rows) >= args.top or args.step <= 0 or min_f <= args.floor:
            break
        min_f = max(args.floor, min_f - args.step)  # not enough yet -> lower the bar and retry

    if args.enrich_websites:
        ids = [r["entity_id"] for r in rows if not r["email_norm"]]
        if ids:
            from discovery.website_enrich import run as enrich_websites

            stats = enrich_websites(conn, entity_ids=ids)
            print(f"website enrich: +{stats['emails']} emails, +{stats['phones']} phones, "
                 f"+{stats['socials']} social links  (crawled {stats['urls']} urls, "
                 f"status {stats['by_status']})")
            from psycopg.rows import tuple_row

            # tuple_row explicitly: conn.row_factory is dict_row (set by shortlist() above),
            # which would otherwise turn `row[0]` below into a KeyError.
            with conn.cursor(row_factory=tuple_row) as cur:  # rows are stale after the crawl -- refresh
                cur.execute(
                    "SELECT entity_id, email_norm, phone_norm, "
                    "       coalesce(website_url, contacts->>'website'), contacts "
                    "FROM entities WHERE entity_id = ANY(%s)", (ids,),
                )
                fresh = {row[0]: row[1:] for row in cur.fetchall()}
            for r in rows:
                if r["entity_id"] in fresh:
                    r["email_norm"], r["phone_norm"], r["website"], r["contacts"] = fresh[r["entity_id"]]
    conn.close()

    _write(rows, args.output, standouts)
    print(f"exclusion ids: {len(exclude_ids)}  |  scanned {meta['scanned']}  ->  "
          f"dropped {meta['dropped']}  ->  kept {meta['kept']} {meta['by_platform']}")
    print(f"min-followers used: {min_f}  |  selected {len(rows)}/{args.top}")
    print(f"written -> {args.output}\n")
    print(f"{'#':>2}  {'plat':<8} {'followers':>9}  hit  {'comp':>5}  contact  name / @handle")
    for i, r in enumerate(rows, 1):
        has = "Y" if (r["email_norm"] or r["phone_norm"]) else " "
        print(f"{i:>2}  {r['platform']:<8} {str(r['follower_count'] or '-'):>9}  "
              f"{'Y' if r.get('broker_hit') else ' '}   {str(r['composite_score'] or '-'):>5}   {has}     "
              f"{(r['display_name'] or '')[:26]}  @{(r['handle'] or '-').lstrip('@')}")


if __name__ == "__main__":
    main()
