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
from datetime import date
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


def load_exclusion_ids(paths: list[Path]) -> set[str]:
    ids = set()
    for base in paths:
        files = base.rglob("*") if base.is_dir() else [base]
        for f in files:
            if f.suffix.lower() in (".csv", ".json") and f.is_file():
                ids |= parse_exclusion_ids(f.read_text(encoding="utf-8-sig", errors="replace"))
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
              since: date | None, top: int, min_followers: int = 0) -> tuple[list[dict], dict]:
    from psycopg.rows import dict_row

    conn.row_factory = dict_row
    params: list = [list(platforms)]  # psycopg adapts a list (not a tuple) to a PG array for ANY()
    where_since = ""
    if since is not None:
        where_since = " and e.first_seen_at >= %s"
        params.append(since)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            select e.entity_id, e.platform, e.platform_id, e.handle, e.display_name, e.bio_text,
                   e.follower_count, e.email_norm, e.phone_norm, e.source_url,
                   s.creator_relevance, s.brand_safety, s.engagement_rate,
                   s.composite_score, s.data_completeness
            from entities e
            left join entity_scores s using (entity_id)
            where e.platform = any(%s){where_since}
            """,
            params,
        )
        rows = cur.fetchall()

        kept: list[dict] = []
        dropped = {"dup": 0, "broker_self": 0, "other_broker": 0, "corp_email": 0, "no_market": 0, "not_forex": 0}
        for r in rows:
            name, handle = r["display_name"] or "", r["handle"] or ""
            if candidate_ids(handle, r["platform_id"], r["source_url"]) & exclude_ids:
                dropped["dup"] += 1; continue
            if is_broker_self(name, handle, broker):
                dropped["broker_self"] += 1; continue
            if is_other_broker(name, handle):
                dropped["other_broker"] += 1; continue
            if r["platform"] == "facebook" and is_broker_corp_email(r["email_norm"]):
                dropped["corp_email"] += 1; continue
            if market == "vn" and not vn_signal(name, handle, r["bio_text"] or ""):
                dropped["no_market"] += 1; continue
            if not is_forex(name, r["bio_text"], r["creator_relevance"]):
                dropped["not_forex"] += 1; continue
            if (r["follower_count"] or 0) < min_followers:
                continue
            r["broker_hit"] = _broker_hit(cur, r["platform"], r["platform_id"], broker)
            kept.append(r)

    kept.sort(key=potential, reverse=True)

    # guarantee a spread across the requested platforms (>=2 each if available), fill the rest by rank
    from collections import defaultdict
    per = defaultdict(list)
    for r in kept:
        per[r["platform"]].append(r)
    picked, chosen = [], set()
    for p in platforms:
        for r in per[p][:2]:
            picked.append(r); chosen.add(r["entity_id"])
    for r in kept:
        if len(picked) >= top:
            break
        if r["entity_id"] not in chosen:
            picked.append(r); chosen.add(r["entity_id"])
    result = sorted(picked, key=potential, reverse=True)[:top]
    result_meta = {"scanned": len(rows), "dropped": dropped, "kept": len(kept),
                   "by_platform": {p: len(per[p]) for p in platforms}}
    return result, result_meta


def _write_csv(rows: list[dict], out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    cols = ["rank", "platform", "name", "handle", "followers", "broker_mention", "relevance",
            "brand_safety", "engagement", "composite", "email", "phone", "source_url"]
    with out.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        for i, r in enumerate(rows, 1):
            w.writerow([i, r["platform"], r["display_name"] or "", (r["handle"] or "").lstrip("@"),
                        r["follower_count"] or "", "Y" if r.get("broker_hit") else "",
                        r["creator_relevance"], r["brand_safety"], r["engagement_rate"],
                        r["composite_score"], r["email_norm"] or "", r["phone_norm"] or "",
                        r["source_url"] or ""])


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows console is cp1252 by default
    ap = argparse.ArgumentParser(description="Rank an IB shortlist for one broker + market")
    ap.add_argument("--broker", default="xtb", help="target broker name (word-matched in staged text)")
    ap.add_argument("--market", default="vn", help="market gate; 'vn' requires a Vietnamese signal")
    ap.add_argument("--platforms", default="tiktok,facebook,facebook_post,youtube")
    ap.add_argument("--exclude-dir", action="append", default=[], type=Path,
                    help="dir/file of prior exports whose accounts to skip (repeatable)")
    ap.add_argument("--since", default=date.today().isoformat(),
                    help="only entities first seen on/after this date (YYYY-MM-DD); 'any' to disable")
    ap.add_argument("--top", type=int, default=10)
    ap.add_argument("--min-followers", type=int, default=0)
    ap.add_argument("--no-score", action="store_true", help="skip re-scoring before selecting")
    ap.add_argument("--output", type=Path,
                    default=Path("results") / date.today().strftime("%Y-%m") / date.today().isoformat()
                    / "ib_shortlist.csv")
    args = ap.parse_args()

    if not args.no_score:
        import db.run_scoring as run_scoring
        run_scoring.main()

    from db.connection import get_conn

    platforms = [p.strip() for p in args.platforms.split(",") if p.strip()]
    exclude_ids = load_exclusion_ids(args.exclude_dir)
    since = None if args.since.lower() == "any" else date.fromisoformat(args.since)

    conn = get_conn()
    rows, meta = shortlist(conn, args.broker, args.market, platforms, exclude_ids, since,
                           args.top, args.min_followers)
    conn.close()

    _write_csv(rows, args.output)
    print(f"exclusion ids: {len(exclude_ids)}  |  scanned {meta['scanned']}  ->  "
          f"dropped {meta['dropped']}  ->  kept {meta['kept']} {meta['by_platform']}")
    print(f"written -> {args.output}\n")
    print(f"{'#':>2}  {'plat':<8} {'followers':>9}  hit  {'comp':>5}  contact  name / @handle")
    for i, r in enumerate(rows, 1):
        has = "Y" if (r["email_norm"] or r["phone_norm"]) else " "
        print(f"{i:>2}  {r['platform']:<8} {str(r['follower_count'] or '-'):>9}  "
              f"{'Y' if r.get('broker_hit') else ' '}   {str(r['composite_score'] or '-'):>5}   {has}     "
              f"{(r['display_name'] or '')[:26]}  @{(r['handle'] or '-').lstrip('@')}")


if __name__ == "__main__":
    main()
