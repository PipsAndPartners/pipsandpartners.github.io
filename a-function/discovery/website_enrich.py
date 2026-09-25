"""Fetch a creator's own website/bio-link page and pull email/phone/social
contacts out of the HTML -- the enrichment source neither youtube_video_enrich
(video descriptions) nor member_enrich (Apify Instagram) covers.

Free (stdlib urllib only, no Apify/API quota, no new dependency). Candidate URLs
come from three places on an entity: `website_url`, `contacts.website`, and any
bare URL pasted in `bio_text` -- YouTube channels in particular store their link
only in the About text, never in `website_url` (db/loader.py never split it out).

Each candidate is classified first so we never waste a request on a social/
broker-referral/junk link (see `classify`); only `site` and `biolink` URLs, and a
`short` redirect once resolved, get fetched. `extract_from_html` prefers
structural signals (mailto:/tel: links, Cloudflare-obfuscated emails, JSON-LD)
over scanning rendered text, and rejects known-junk addresses (image files,
web-tool noreply addresses, other brokers' support inboxes).

Every fetch is logged to staging_contact_enrichment (raw response + what was
extracted) as an audit trail and a 30-day cache -- a URL already crawled inside
that window is skipped unless --recrawl. entities is only ever filled where a
column is NULL; nothing already there is overwritten, and stage/last_enriched
(the paid-enrichment gate in discovery.gate) are left untouched since this pass
is free and orthogonal to it.

    # preview: who would be crawled, no request made, nothing written
    python -m discovery.website_enrich --dry-run --limit 50
    # crawl the 200 highest-follower entities still missing an email
    python -m discovery.website_enrich --limit 200
    python -m discovery.website_enrich --platform youtube --limit 50
    python -m discovery.website_enrich --entity-ids 1905 2968
    python -m discovery.website_enrich --limit 50 --recrawl   # ignore the 30-day cache
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import socket
import ssl
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from html import unescape
from urllib.parse import urljoin, urlparse

from discovery.common.contacts import extract_contacts
from discovery.shortlist import BROKER_BRANDS, DATA_DIR, _load_lines

# Other brokers/exchanges/tools/institutions a bio links to that are NOT the
# creator's own site (discovery/data/referral_domains.txt) -- see that file's
# header for why a host lands here instead of being crawled as `site`.
REFERRAL_DOMAINS = _load_lines(DATA_DIR / "referral_domains.txt", ())

USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
FETCH_TIMEOUT = 10
MAX_BYTES = 2_000_000
MAX_CONTACT_PAGES = 3        # extra same-domain pages fetched when the home page has no email
CACHE_DAYS = 30
CONCURRENCY = 8

# Own social platforms: never worth fetching, but worth recording as a contact link.
SOCIAL_HOSTS = ("youtube.com", "youtu.be", "facebook.com", "fb.com", "fb.me",
                "instagram.com", "tiktok.com", "t.me", "telegram.me", "zalo.me",
                "twitter.com", "x.com", "linkedin.com", "whatsapp.com", "wa.me",
                "line.me", "discord.gg", "discord.com")
# Bio-link aggregators: one page holds the creator's real links -- worth a fetch.
BIOLINK_HOSTS = ("linktr.ee", "beacons.ai", "linkbio.co", "carrd.co", "lnk.bio",
                  "bio.link", "taplink.cc", "solo.to", "msha.ke", "campsite.bio",
                  "linkin.bio", "bio.site")
# Link shorteners: not a destination, just resolve the redirect and reclassify.
SHORT_HOSTS = ("bit.ly", "goo.gl", "shor.by", "s.net.vn", "goto.now", "tinyurl.com",
               "cutt.ly", "rebrand.ly", "t.co", "linkfly.to", "ow.ly", "shorturl.at")
# Obviously irrelevant hosts a creator's bio still ends up linking to.
JUNK_HOSTS = ("capcut.com", "capcutshare.com", "mercari.com", "shopee.vn", "shopee.com", "lazada.vn",
              "google.com", "apple.com", "spotify.com", "gov.vn", "skinsmonkey.com",
              "amazon.com", "play.google.com", "zoom.us", "gov.au", "embassy.gov.au")
# Query-param names and path segments a referral/affiliate/signup link uses --
# broad on purpose (this is an arms race; extend REFERRAL_DOMAINS too when a
# crawl surfaces a new one that slips past this).
_REF_PARAM = re.compile(
    r"[?&](?:ref|r|sales|affid|aff\w*|partner|share\w*|fpr|mktid|agent_?id|brokerid|uid|"
    r"promo|coupon|code|refid|ref_id|invite_code|utm_\w+|af_\w+|onelink_id|shortlink)=",
    re.I,
)
_REF_PATH = re.compile(
    r"/(?:invite|join|refer(?:ral)?|aff|open-account|mo-tai-khoan|dang-ky|register|signup|"
    r"introducing-brokers?)(?:[/?]|$)",
    re.I,
)

_URL_IN_TEXT_RE = re.compile(r"(?:https?://|www\.)[^\s<>()\"']+", re.I)
# Junk addresses that pass EMAIL_RE but are never the creator's own contact.
_JUNK_EMAIL_RE = re.compile(
    r"\.(?:png|jpe?g|gif|svg|webp)$|"
    r"^(?:noreply|no-reply|donotreply|postmaster|webmaster)@|"
    r"@(?:sentry\.io|wixpress\.com|example\.com|godaddy\.com|cloudflare\.com|"
    r"schema\.org|w3\.org|2x|domain\.com|yourdomain\.com|yoursite\.com|email\.com|test\.com)$",
    re.I,
)
# A shape check for JSON-LD's "email" field, which -- unlike every other source
# here -- is trusted as a raw string with no EMAIL_RE match of its own, so a
# template that was never filled in (schema.org boilerplate shipping with a
# literal "your@email") would otherwise pass straight through.
_EMAIL_SHAPE_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_LABEL_RE = re.compile(r"(hotline|hot ?line|đi[eệ]n tho[aạ]i|đt|s[ đ]t|zalo|phone|tel)\s*[:：]?\s*"
                              r"([+(]?\d[\d\s.\-()]{7,}\d)", re.I)
_CF_EMAIL_RE = re.compile(r'data-cfemail="([0-9a-f]+)"', re.I)
_MAILTO_RE = re.compile(r'mailto:([^"\'?&<>\s]+)', re.I)
_TEL_RE = re.compile(r'tel:([+\d][\d\s().\-]{6,})', re.I)
_JSONLD_RE = re.compile(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>', re.I | re.S)
_LINK_RE = re.compile(r'<a\b[^>]*href="([^"]+)"', re.I)
_CONTACT_PAGE_RE = re.compile(r"(contact|lien-?he|li[eê]n h[eệ]|about|gioi-?thieu|gi[ớo]i thi[eệ]u)", re.I)
_NEXT_DATA_RE = re.compile(r'<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.I | re.S)


def _cf_decode(hexstr: str) -> str:
    """Cloudflare's email-obfuscation cipher: first byte is an XOR key."""
    try:
        raw = bytes.fromhex(hexstr)
        key = raw[0]
        return "".join(chr(b ^ key) for b in raw[1:])
    except (ValueError, IndexError):
        return ""


def _host(url: str) -> str:
    try:
        return (urlparse(url if "//" in url else f"//{url}").hostname or "").lower().removeprefix("www.")
    except ValueError:
        return ""


def classify(url: str) -> str:
    """One of: social / biolink / short / broker_ref / junk / site."""
    h = _host(url)
    if not h:
        return "junk"
    if any(h == d or h.endswith("." + d) for d in SOCIAL_HOSTS):
        return "social"
    if any(h == d or h.endswith("." + d) for d in BIOLINK_HOSTS):
        return "biolink"
    if any(h == d or h.endswith("." + d) for d in SHORT_HOSTS):
        return "short"
    if any(h == d or h.endswith("." + d) for d in JUNK_HOSTS):
        return "junk"
    if (any(brand.replace(" ", "") in h.replace("-", "") for brand in BROKER_BRANDS)
            or any(h == d or h.endswith("." + d) for d in REFERRAL_DOMAINS)
            or _REF_PARAM.search(url) or _REF_PATH.search(url)):
        return "broker_ref"
    return "site"


def candidate_urls(website_url: str | None, contacts_website: str | None, bio_text: str | None) -> list[str]:
    """Every URL worth classifying for one entity, in priority order, deduped."""
    urls, seen = [], set()
    for u in (website_url, contacts_website, *_URL_IN_TEXT_RE.findall(bio_text or "")):
        u = (u or "").strip().rstrip(".,;)")
        if not u:
            continue
        norm = u if u.startswith(("http://", "https://")) else f"http://{u}"
        key = _host(norm)
        if key and key not in seen:
            seen.add(key)
            urls.append(norm)
    return urls


def broker_ref_name(url: str) -> str:
    """Which broker a broker_ref URL points to, e.g. 'exness' -- for the contacts
    JSONB so shortlist can show who else a creator already promotes."""
    h = _host(url).replace("-", "")
    for brand in BROKER_BRANDS:
        if brand.replace(" ", "") in h:
            return brand
    return h


@dataclass
class FetchResult:
    url: str
    status: str            # ok / http_403 / http_404 / dns_fail / tls_fail / timeout / not_html / error
    final_url: str = ""
    html: str = ""


def fetch(url: str, timeout: int = FETCH_TIMEOUT) -> FetchResult:
    """One GET, stdlib only. Redirects are followed by urllib automatically."""
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "vi,en;q=0.8",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            ctype = resp.headers.get("Content-Type", "")
            if "html" not in ctype and ctype:
                return FetchResult(url, "not_html", resp.geturl())
            raw = resp.read(MAX_BYTES)
            if resp.headers.get("Content-Encoding") == "gzip":
                raw = gzip.decompress(raw)
            charset = (re.search(r"charset=([\w-]+)", ctype) or [None, "utf-8"])[1] or "utf-8"
            html = raw.decode(charset, errors="replace")
            return FetchResult(url, "ok", resp.geturl(), html)
    except urllib.error.HTTPError as e:
        return FetchResult(url, f"http_{e.code}", url)
    except (socket.timeout, TimeoutError):
        return FetchResult(url, "timeout", url)
    except ssl.SSLError:
        return FetchResult(url, "tls_fail", url)
    except urllib.error.URLError as e:
        return FetchResult(url, "dns_fail" if "getaddrinfo" in str(e.reason) else "error", url)
    except Exception:  # noqa: BLE001 - one bad site must never stop a batch
        return FetchResult(url, "error", url)


def _strip_tags(html: str) -> str:
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.I | re.S)
    return unescape(re.sub(r"<[^>]+>", " ", html))


def _is_junk_email(email: str) -> bool:
    return bool(_JUNK_EMAIL_RE.search(email))


def _jsonld_contacts(html: str) -> dict:
    out = {}
    for block in _JSONLD_RE.findall(html):
        try:
            data = json.loads(block.strip())
        except (json.JSONDecodeError, ValueError):
            continue
        for node in (data if isinstance(data, list) else [data]):
            if not isinstance(node, dict):
                continue
            if node.get("email") and not out.get("email"):
                out["email"] = str(node["email"]).removeprefix("mailto:").strip()
            if node.get("telephone") and not out.get("phone"):
                out["phone"] = str(node["telephone"]).strip()
    return out


def extract_from_html(html: str, page_url: str = "", *, harvest_socials: bool = True) -> dict:
    """{email, phone, socials: {label: url}} from one page's raw HTML. Pure
    function (no I/O) so it's fully unit-testable.

    Structural signals (mailto:, Cloudflare-obfuscated spans, tel:, JSON-LD) are
    trusted first; a plain-text email/phone found by the shared
    discovery.common.contacts scan over rendered prose is kept too (many small
    VN business sites just print "Email: x@y.vn" in a footer with no mailto:),
    but ranked last since prose is more likely to quote someone else's address.

    `harvest_socials` gates whether social links on the page are treated as the
    SITE OWNER's own contacts at all: crawl_site() only passes True for a
    `biolink` page (linktr.ee etc.), where curating the owner's own links is
    the whole point of the page -- a general website's static chrome routinely
    links out to unrelated accounts (an embedded widget, a "powered by"
    footer), so it's never trusted for this. Even a biolink page has its OWN
    such chrome (Linktree's static HTML links its own tiktok/instagram/discord
    in a page footer) -- to avoid that, the scan targets the embedded
    __NEXT_DATA__ JSON payload where the profile's actual links live when the
    page has one (Linktree and other Next.js-based bio-link sites), and only
    falls back to the whole page for a simpler biolink site that has none."""
    if not html:
        return {"email": "", "phone": "", "socials": {}}

    emails = [e for e in _MAILTO_RE.findall(html) if not _is_junk_email(e)]
    emails += [_cf_decode(h) for h in _CF_EMAIL_RE.findall(html)]
    emails = [e for e in emails if e and not _is_junk_email(e)]

    ld = _jsonld_contacts(html)
    if ld.get("email") and _EMAIL_SHAPE_RE.match(ld["email"]) and not _is_junk_email(ld["email"]):
        emails.insert(0, ld["email"])

    text = _strip_tags(html)
    found = extract_contacts(text)
    if found.get("email") and not _is_junk_email(found["email"]):
        emails.append(found["email"])  # lowest priority: plain prose, not a structural signal

    tel_hits = [t.strip() for t in _TEL_RE.findall(html)]
    if tel_hits:
        phone = tel_hits[0]
    elif ld.get("phone"):
        phone = ld["phone"]
    else:
        m = _PHONE_LABEL_RE.search(text)
        phone = m.group(2).strip() if m else (found.get("phone") or "")

    socials: dict[str, str] = {}
    if harvest_socials:
        next_data = _NEXT_DATA_RE.search(html)
        if next_data:  # Next.js/Linktree-style page: its static HTML also has
            # the platform's own chrome, so only the profile's own JSON payload
            # is trusted, not the <a href> tags below.
            scoped = extract_contacts(next_data.group(1))
            socials = {k: v for k, v in scoped.items() if v and v.startswith("http") and k != "website"}
        else:  # a simpler, server-rendered biolink page: its <a href> tags ARE the content
            for href in _LINK_RE.findall(html):
                url = urljoin(page_url, href) if page_url else href
                if classify(url) == "social":
                    label = next((h.split(".")[0] for h in SOCIAL_HOSTS if _host(url).endswith(h)), "")
                    if label and label not in socials:
                        socials[label] = url

    # Validated once, after every phone source (tel:/JSON-LD/label/fallback) has
    # had a chance to fill it -- an earlier per-source check couldn't stop the
    # fallback from re-introducing a junk number after a good source rejected it.
    digits = re.sub(r"\D", "", phone)
    if phone and (len(digits) < 8 or len(set(digits)) <= 1):  # too short, or 0000000000 / 1111111111
        phone = ""

    # domain-matching email ranks first (the creator's own domain beats a stray
    # gmail mentioned in passing), then first-seen order.
    domain = _host(page_url)
    emails_ranked = sorted(dict.fromkeys(emails), key=lambda e: 0 if domain and e.lower().endswith("@" + domain) else 1)
    return {"email": emails_ranked[0] if emails_ranked else "", "phone": phone, "socials": socials}


def contact_page_links(html: str, base_url: str) -> list[str]:
    """Same-domain links whose URL/anchor text look like a contact/about page."""
    base_host = _host(base_url)
    out, seen = [], set()
    for href in _LINK_RE.findall(html):
        if not _CONTACT_PAGE_RE.search(href):
            continue
        url = urljoin(base_url, href)
        if _host(url) == base_host and url not in seen:
            seen.add(url)
            out.append(url)
    return out[:MAX_CONTACT_PAGES]


def crawl_site(url: str, url_class: str) -> tuple[FetchResult, dict, list[str]]:
    """Home page + up to MAX_CONTACT_PAGES contact pages, stopping once an email
    is found. Returns (home page's FetchResult, merged contacts, pages fetched).
    Social links are only trusted as the owner's own contacts when `url_class`
    is `biolink` -- see extract_from_html's `harvest_socials` docstring."""
    harvest = url_class == "biolink"
    home = fetch(url)
    if home.status != "ok":
        return home, {"email": "", "phone": "", "socials": {}}, [url]
    merged = extract_from_html(home.html, home.final_url, harvest_socials=harvest)
    fetched = [home.final_url or url]
    if merged["email"]:
        return home, merged, fetched
    for link in contact_page_links(home.html, home.final_url or url):
        r = fetch(link)
        fetched.append(link)
        if r.status != "ok":
            continue
        found = extract_from_html(r.html, r.final_url, harvest_socials=harvest)
        merged["email"] = merged["email"] or found["email"]
        merged["phone"] = merged["phone"] or found["phone"]
        merged["socials"].update({k: v for k, v in found["socials"].items() if k not in merged["socials"]})
        if merged["email"]:
            break
    return home, merged, fetched


def resolve_url(entity_id: int, url: str, *, _seen: frozenset[str] = frozenset()) -> dict:
    """Fetch/classify one candidate all the way through (following a `short`
    redirect once), returning what to write to staging_contact_enrichment.
    `_seen` guards against a shortener that redirects to itself."""
    cls = classify(url)
    if cls in ("social", "broker_ref", "junk"):
        return {"entity_id": entity_id, "input_url": url, "class": cls, "status": "skipped",
                "final_url": "", "pages": [], "email": "", "phone": "", "socials": {}}
    if cls == "short":
        r = fetch(url)
        if r.status == "ok" and r.final_url and r.final_url not in _seen:
            return resolve_url(entity_id, r.final_url, _seen=_seen | {url})
        return {"entity_id": entity_id, "input_url": url, "class": cls, "status": r.status,
                "final_url": r.final_url, "pages": [url], "email": "", "phone": "", "socials": {}}
    home, contacts, pages = crawl_site(url, cls)
    return {"entity_id": entity_id, "input_url": url, "class": cls, "status": home.status,
            "final_url": home.final_url, "pages": pages,
            "email": contacts["email"], "phone": contacts["phone"], "socials": contacts["socials"]}


# --------------------------------------------------------------------------- #
# DB glue                                                                      #
# --------------------------------------------------------------------------- #
SELECT_CANDIDATES = """
    SELECT entity_id, platform, website_url, contacts->>'website' AS contacts_website, bio_text
    FROM entities
    WHERE email_norm IS NULL
      AND stage NOT IN ('filtered_out', 'rejected')
      AND contacted_at IS NULL
      {platform_clause}
    ORDER BY follower_count DESC NULLS LAST
    LIMIT %(limit)s
"""


def _cursor(conn):
    """A tuple-row cursor regardless of conn.row_factory -- callers like
    discovery.shortlist.shortlist() set conn.row_factory = dict_row on the
    connection they hand us, which would otherwise silently break every
    positional (row[0], a, b = row, ...) read below."""
    from psycopg.rows import tuple_row

    return conn.cursor(row_factory=tuple_row)


def select_candidates(conn, *, platform: str | None = None, limit: int = 200,
                      entity_ids: list[int] | None = None) -> list[dict]:
    cols = ("entity_id", "platform", "website_url", "contacts_website", "bio_text")
    with _cursor(conn) as cur:
        if entity_ids:
            cur.execute(
                "SELECT entity_id, platform, website_url, contacts->>'website', bio_text "
                "FROM entities WHERE entity_id = ANY(%s)", (entity_ids,),
            )
        else:
            clause = "AND platform = %(platform)s" if platform else ""
            cur.execute(SELECT_CANDIDATES.format(platform_clause=clause),
                       {"platform": platform, "limit": limit})
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    out = []
    for r in rows:
        r["urls"] = [u for u in candidate_urls(r["website_url"], r["contacts_website"], r["bio_text"])
                     if classify(u) in ("site", "biolink", "short")]
        if r["urls"]:
            out.append(r)
    return out


def already_cached(conn, urls: list[str], days: int = CACHE_DAYS) -> set[str]:
    if not urls:
        return set()
    with _cursor(conn) as cur:
        cur.execute(
            "SELECT DISTINCT input_url FROM staging_contact_enrichment "
            "WHERE input_url = ANY(%s) AND collected_at >= now() - (%s || ' days')::interval",
            (urls, days),
        )
        return {r[0] for r in cur.fetchall()}


def log_result(conn, result: dict, run_id: str) -> None:
    from psycopg.types.json import Jsonb

    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO staging_contact_enrichment (input_url, raw, source_url, run_id) VALUES (%s, %s, %s, %s)",
            (result["input_url"], Jsonb({k: v for k, v in result.items() if k not in ("entity_id",)}),
             result.get("final_url") or result["input_url"], run_id),
        )


def apply_result(conn, entity_id: int, result: dict) -> tuple[bool, bool, int]:
    """Fill only NULL columns on `entities`. Returns (got_email, got_phone, new_socials)."""
    from psycopg.types.json import Jsonb

    if result["status"] == "skipped" and result["class"] != "broker_ref":
        return False, False, 0
    with _cursor(conn) as cur:
        cur.execute("SELECT website_url, contacts, phone_norm FROM entities WHERE entity_id = %s", (entity_id,))
        row = cur.fetchone()
        if not row:
            return False, False, 0
        website_url, contacts, phone_norm = row
        contacts = dict(contacts or {})
        added_socials = 0
        if result["class"] == "broker_ref":
            contacts.setdefault("broker_ref", broker_ref_name(result["input_url"]))
        else:
            for label, link in result.get("socials", {}).items():
                if label not in contacts:
                    contacts[label] = link
                    added_socials += 1
            if result.get("email") and not contacts.get("email_source"):
                contacts["email_source"] = f"website:{result.get('final_url') or result['input_url']}"
            if not website_url and result.get("final_url") and result["class"] in ("site", "biolink"):
                website_url = result["final_url"]
        got_phone = bool(result.get("phone")) and not phone_norm
        cur.execute(
            "UPDATE entities SET "
            "  email_norm = COALESCE(email_norm, NULLIF(%s, '')), "
            "  phone_norm = COALESCE(phone_norm, NULLIF(%s, '')), "
            "  website_url = COALESCE(website_url, %s), "
            "  contacts = %s "
            "WHERE entity_id = %s",
            (result.get("email", ""), result.get("phone", ""), website_url,
             Jsonb(contacts) if contacts else None, entity_id),
        )
        return bool(result.get("email")), got_phone, added_socials


def run(conn, *, platform: str | None = None, limit: int = 200, entity_ids: list[int] | None = None,
       recrawl: bool = False, dry_run: bool = False, workers: int = CONCURRENCY) -> dict:
    candidates = select_candidates(conn, platform=platform, limit=limit, entity_ids=entity_ids)
    jobs = [(r["entity_id"], u) for r in candidates for u in r["urls"]]
    if not recrawl:
        cached = already_cached(conn, [u for _, u in jobs])
        jobs = [(eid, u) for eid, u in jobs if u not in cached]
    print(f"entities: {len(candidates)}  |  urls to crawl: {len(jobs)}")
    if dry_run:
        for eid, u in jobs[:limit]:
            print(f"  entity {eid}: {u}  ({classify(u)})")
        return {"candidates": len(candidates), "urls": len(jobs), "emails": 0, "phones": 0, "socials": 0}

    run_id = time.strftime("%Y%m%dT%H%M%S")
    stats = {"candidates": len(candidates), "urls": len(jobs), "emails": 0, "phones": 0, "socials": 0,
             "by_status": {}}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = pool.map(lambda job: resolve_url(job[0], job[1]), jobs)
        for (eid, url), result in zip(jobs, results):
            stats["by_status"][result["status"]] = stats["by_status"].get(result["status"], 0) + 1
            log_result(conn, result, run_id)
            got_email, got_phone, socials = apply_result(conn, eid, result)
            stats["emails"] += got_email
            stats["phones"] += got_phone
            stats["socials"] += socials
    conn.commit()
    return stats


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Crawl an entity's own website/bio-link page for contacts")
    ap.add_argument("--limit", type=int, default=200, help="max entities to consider (candidates, not URLs)")
    ap.add_argument("--platform", default=None, help="restrict to one platform (e.g. youtube)")
    ap.add_argument("--entity-ids", nargs="+", type=int, default=None,
                    help="explicit entity ids to (re)crawl, ignoring the missing-email selection")
    ap.add_argument("--recrawl", action="store_true", help="ignore the 30-day staging cache")
    ap.add_argument("--dry-run", action="store_true", help="show what would be crawled; fetch/write nothing")
    ap.add_argument("--workers", type=int, default=CONCURRENCY)
    args = ap.parse_args()

    from db.connection import get_conn

    conn = get_conn()
    stats = run(conn, platform=args.platform, limit=args.limit, entity_ids=args.entity_ids,
               recrawl=args.recrawl, dry_run=args.dry_run, workers=args.workers)
    conn.close()
    if not args.dry_run:
        print(f"crawled {stats['urls']} urls across {stats['candidates']} entities: "
             f"+{stats['emails']} emails, +{stats['phones']} phones, +{stats['socials']} social links")
        print(f"status breakdown: {stats['by_status']}")


if __name__ == "__main__":
    main()
