"""Exports all scored entities to a readable local HTML report (with social links).

Usage:
    python db/export_report.py
    python db/export_report.py --output reports/leads.html --platform linkedin
"""

import argparse
import html
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from psycopg import sql
from psycopg.rows import dict_row

from db.connection import get_conn
from platforms import PLATFORMS

DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "reports" / "leads_report.html"

QUERY = """
    SELECT e.entity_id, e.display_name, e.platform, e.platform_id, e.handle,
           e.follower_count, e.source_url,
           s.creator_relevance, s.brand_safety, s.audience_quality, s.engagement_rate,
           s.follower_growth, s.estimated_post_price_usd, s.composite_score, s.data_completeness
    FROM entities e
    JOIN entity_scores s ON s.entity_id = e.entity_id
    WHERE (%(platform)s::text IS NULL OR e.platform = %(platform)s::text)
    ORDER BY s.composite_score DESC NULLS LAST
"""

LINKED_ENTITIES_QUERY = """
    SELECT eb.platform, eb.handle, eb.source_url, l.method, l.confidence, l.status
    FROM entity_links l
    JOIN entities eb ON eb.entity_id = CASE WHEN l.entity_id_a = %(entity_id)s THEN l.entity_id_b ELSE l.entity_id_a END
    WHERE %(entity_id)s IN (l.entity_id_a, l.entity_id_b)
"""


def _tier_class(score: float | None) -> str:
    if score is None:
        return "tier-unknown"
    if score >= 70:
        return "tier-high"
    if score >= 40:
        return "tier-mid"
    return "tier-low"


def _fmt(value, suffix: str = "") -> str:
    return "—" if value is None else f"{value}{suffix}"


def _latest_raw(cur, platform: str, platform_id: str) -> dict:
    if platform not in PLATFORMS:
        return {}
    table = sql.Identifier(f"staging_{platform}")
    cur.execute(
        sql.SQL("SELECT raw FROM {} WHERE platform_id = %s ORDER BY collected_at DESC LIMIT 1").format(table),
        (platform_id,),
    )
    row = cur.fetchone()
    return row["raw"] if row else {}


def _related_links(cur, r: dict) -> list[dict]:
    links = []

    module = PLATFORMS.get(r["platform"])
    if module and hasattr(module, "extract_related_links"):
        raw = _latest_raw(cur, r["platform"], r["platform_id"])
        links.extend(module.extract_related_links(raw))

    cur.execute(LINKED_ENTITIES_QUERY, {"entity_id": r["entity_id"]})
    for row in cur.fetchall():
        if row["source_url"]:
            confidence_tag = "confirmed" if row["status"] == "confirmed" else f"{row['confidence']}, unreviewed"
            links.append(
                {
                    "label": f"{row['platform']}: {row['handle'] or '?'} ({confidence_tag} via {row['method']})",
                    "url": row["source_url"],
                }
            )

    return links


def _related_links_html(links: list[dict]) -> str:
    if not links:
        return "—"
    parts = [
        f'<a href="{html.escape(l["url"])}" target="_blank" rel="noopener">{html.escape(l["label"])}</a>'
        for l in links
    ]
    return "<br>".join(parts)


def build_html(rows: list[dict], links_by_entity: dict[int, list[dict]]) -> str:
    body_rows = []
    for i, r in enumerate(rows, start=1):
        link_html = f'<a href="{r["source_url"]}" target="_blank" rel="noopener">profile ↗</a>' if r["source_url"] else "—"
        related_html = _related_links_html(links_by_entity.get(r["entity_id"], []))
        body_rows.append(f"""
        <tr class="{_tier_class(r['composite_score'])}">
          <td>{i}</td>
          <td>{html.escape(r['display_name'] or '—')}</td>
          <td>{r['platform']}</td>
          <td>{html.escape(r['handle'] or '—')}</td>
          <td>{link_html}</td>
          <td class="links">{related_html}</td>
          <td>{_fmt(r['follower_count'])}</td>
          <td>{_fmt(r['creator_relevance'])}</td>
          <td>{_fmt(r['brand_safety'])}</td>
          <td>{_fmt(r['audience_quality'])}</td>
          <td>{_fmt(r['engagement_rate'], '%')}</td>
          <td>{_fmt(r['follower_growth'], '%')}</td>
          <td>{_fmt(r['estimated_post_price_usd'], ' USD')}</td>
          <td class="composite">{_fmt(r['composite_score'])}</td>
          <td>{int(r['data_completeness'] * 100) if r['data_completeness'] is not None else '—'}%</td>
        </tr>""")

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>IB Lead Scoring Report</title>
<style>
  body {{ font-family: -apple-system, "Segoe UI", system-ui, sans-serif; margin: 2rem; background: #f7f7f8; color: #1c1c1e; }}
  h1 {{ margin-bottom: 0.25rem; }}
  .subtitle {{ color: #666; margin-bottom: 1.5rem; font-size: 0.9rem; }}
  table {{ border-collapse: collapse; width: 100%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
  th, td {{ padding: 0.5rem 0.7rem; text-align: left; border-bottom: 1px solid #eee; font-size: 0.85rem; vertical-align: top; }}
  td:not(.links) {{ white-space: nowrap; }}
  td.links {{ max-width: 260px; white-space: normal; }}
  th {{ background: #1c1c1e; color: white; position: sticky; top: 0; }}
  tr:hover {{ background: #f0f4ff; }}
  td.composite {{ font-weight: 700; }}
  .tier-high td.composite {{ color: #1a7f37; }}
  .tier-mid td.composite {{ color: #9a6700; }}
  .tier-low td.composite {{ color: #cf222e; }}
  a {{ color: #2f6fed; text-decoration: none; }}
  a:hover {{ text-decoration: underline; }}
  .legend {{ margin-top: 1rem; font-size: 0.8rem; color: #666; }}
  .legend span {{ display: inline-block; margin-right: 1.2rem; }}
  .dot {{ display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; }}
</style>
</head>
<body>
  <h1>IB Lead Scoring Report</h1>
  <p class="subtitle">Generated from entities + entity_scores. "Related Links" = employer pages / bio-mentioned URLs found in their profile, plus any other-platform accounts matched to this person via entity_links (empty until you've scraped them on 2+ platforms). Composite score is a weighted average over only the fields with real data (see "completeness" column) — see scoring.py for how each field is computed.</p>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Name</th><th>Platform</th><th>Handle</th><th>Link</th><th>Related Links</th>
        <th>Followers</th><th>Relevance</th><th>Brand Safety</th><th>Audience Qty</th>
        <th>Engagement</th><th>Growth</th><th>Est. Post Price</th><th>Composite</th><th>Completeness</th>
      </tr>
    </thead>
    <tbody>
      {"".join(body_rows)}
    </tbody>
  </table>
  <div class="legend">
    <span><span class="dot" style="background:#1a7f37"></span>Composite ≥ 70</span>
    <span><span class="dot" style="background:#9a6700"></span>Composite 40–69</span>
    <span><span class="dot" style="background:#cf222e"></span>Composite &lt; 40</span>
  </div>
</body>
</html>"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Export scored entities to a readable HTML report")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--platform", default=None, help="Filter to one platform, e.g. linkedin")
    args = parser.parse_args()

    conn = get_conn()
    conn.row_factory = dict_row
    with conn.cursor() as cur:
        cur.execute(QUERY, {"platform": args.platform})
        rows = cur.fetchall()

        links_by_entity = {r["entity_id"]: _related_links(cur, r) for r in rows}

    conn.close()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(build_html(rows, links_by_entity), encoding="utf-8")
    print(f"Wrote {len(rows)} rows -> {args.output}")


if __name__ == "__main__":
    main()
