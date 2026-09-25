"""Recover contacts from a YouTube channel's recent videos, and record their
per-video stats (views/likes/comments/duration) for scoring.py's fake-audience
and engagement signals -- not just the channel's About text.

Many creators only paste their email/Zalo/Telegram in a video's description, not
the channel description. For channels still missing an email, this pulls their
most recent uploads (default 50), scans those descriptions with the shared
contact parser, and fills in the entity's still-empty contact columns. Every
video it fetches also gets its statistics+contentDetails stored into
staging_youtube_video (db/13_youtube_video_stats.sql) at 0 extra quota --
videos.list costs the same 1 unit/call no matter how many `part` values are
requested, so this rides along for free with the contact scan.

Quota: 1 unit per 50 channels (channels.list, to resolve each channel's uploads
playlist) + 1 unit per channel (playlistItems.list, up to 50 recent video ids)
+ 1 unit per channel (videos.list, those ids' snippet+statistics+contentDetails)
-- ~2 units per channel, not the ~101 units/channel a search.list-based
"top-viewed" lookup costs (search.list also has its own 100-call/day bucket,
shared with discovery -- this enrichment no longer touches it at all).
Email/Zalo/phone tend to sit in a boilerplate footer repeated on every upload,
so scanning the 50 most recent videos finds it just as reliably as scanning the
2 most-viewed ones used to -- and recent videos are also the *right* set for
fake-audience scoring (a channel's current audience, not one old viral fluke).

This is paid enrichment, so it runs only AFTER the filter gate (discovery.gate,
E6 6.2): it refuses while any YouTube row is still stage='discovered'. Two
selection modes:

  - default: channels still missing an email (stage='filtered_in', never
    scanned before) -- stamps each scanned channel enriched so it is never paid
    for twice (even when its videos held no email).
  - --stats: any gated channel (filtered_in/enriched/qualified/outreach) whose
    video stats are missing or older than 30 days, regardless of email --
    backfills/refreshes stats for channels the default mode never touches
    (already has an email). Never regresses stage/last_enriched for a channel
    past 'filtered_in' (only a forward filtered_in->enriched transition stamps
    the gate, same as default mode); freshness for the rest is judged purely
    from staging_youtube_video.collected_at.

    python -m discovery.gate --platform youtube gate --market vn

    # preview which channels + quota, write nothing:
    python -m discovery.youtube_video_enrich --limit 20 --dry-run
    # enrich the 20 highest-follower YouTube channels that still lack an email:
    python -m discovery.youtube_video_enrich --limit 20
    # backfill/refresh video stats for scoring, independent of email status:
    python -m discovery.youtube_video_enrich --stats --limit 50
    # specific channels:
    python -m discovery.youtube_video_enrich --channel-ids UCxxxx UCyyyy
"""

import argparse
import math
import os
import re
import sys

from dotenv import load_dotenv

from db.loader import contacts_from_entity
from discovery import gate
from discovery.youtube_data_api import AU_SIGNAL, QuotaExceededError, request
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".youtube_api_key.env")

# A video description mentioning TMGM is as disqualifying as the channel bio
# already being checked by discovery/shortlist.py's _broker_hit -- but that only
# scans staging raw (bio/branding), never video descriptions. Flag it here so
# shortlist.py can drop the row too (see EXCLUDE_TMGM_MENTION below).
TMGM_RE = re.compile(r"\btmgm\b", re.I)

# --stats mode re-scans a channel only once its stored video stats are this stale.
VIDEO_STATS_REFRESH_DAYS = 30


def uploads_playlist_ids(channel_ids: list[str], api_key: str) -> tuple[dict[str, str], int]:
    """(channel_id -> its "uploads" playlist id, quota_units). 1 unit per 50 ids."""
    mapping: dict[str, str] = {}
    quota = 0
    for start in range(0, len(channel_ids), 50):
        batch = channel_ids[start:start + 50]
        result = request("channels", {"part": "contentDetails", "id": ",".join(batch), "key": api_key})
        quota += 1
        for item in result.get("items", []):
            uploads = item.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
            if uploads:
                mapping[item["id"]] = uploads
    return mapping, quota


def recent_videos(uploads_playlist_id: str, api_key: str, max_videos: int) -> tuple[list[dict], int]:
    """(the channel's most recent uploads' full video resources -- snippet,
    statistics, contentDetails -- quota_units). Same 2 calls as a plain
    description scan; statistics+contentDetails ride along in videos.list's
    `part` for free (see module docstring)."""
    quota = 0
    playlist_items = request("playlistItems", {
        "part": "contentDetails", "playlistId": uploads_playlist_id,
        "maxResults": min(max_videos, 50), "key": api_key,
    })
    quota += 1
    video_ids = [it.get("contentDetails", {}).get("videoId") for it in playlist_items.get("items", [])
                 if it.get("contentDetails", {}).get("videoId")]
    if not video_ids:
        return [], quota
    vids = request("videos", {"part": "snippet,statistics,contentDetails", "id": ",".join(video_ids), "key": api_key})
    quota += 1
    return vids.get("items", []), quota


def store_video_stats(cur, channel_id: str, videos: list[dict]) -> None:
    """Append this scan's per-video stats to staging_youtube_video (see
    db/13_youtube_video_stats.sql) for scoring.score_fake_audience/engagement_rate."""
    from psycopg.types.json import Jsonb

    rows = [(channel_id, v["id"], Jsonb(v)) for v in videos if v.get("id")]
    if rows:
        cur.executemany(
            "INSERT INTO staging_youtube_video (channel_id, video_id, raw) VALUES (%s, %s, %s)", rows,
        )


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Enrich YouTube contacts from recent-video descriptions")
    ap.add_argument("--limit", type=int, default=25, help="max channels to enrich (quota guard)")
    ap.add_argument("--max-videos", type=int, default=50, help="recent videos per channel to scan (default 50, "
                                                                "the API max per playlistItems.list call)")
    ap.add_argument("--min-followers", type=int, default=0, help="only channels with at least this many subs")
    ap.add_argument("--channel-ids", nargs="+", default=None,
                    help="explicit channel ids to enrich (overrides the missing-email selection)")
    ap.add_argument("--stats", action="store_true",
                    help="target any gated channel with stale/missing video stats, regardless of email "
                         "(for scoring backfill; default mode only targets channels still missing an email)")
    ap.add_argument("--dry-run", action="store_true", help="select + report quota, but call no API and write nothing")
    args = ap.parse_args()

    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key and not args.dry_run:
        raise RuntimeError("Missing YOUTUBE_API_KEY")

    from db.connection import get_conn
    from psycopg.types.json import Jsonb

    conn = get_conn()
    if not args.channel_ids:  # explicit ids are a targeted lookup, not bulk enrichment
        gate.require_gate(conn, platform="youtube")
    with conn.cursor() as cur:
        if args.channel_ids:
            cur.execute(
                "select entity_id, platform_id, email_norm, phone_norm, wechat_norm, contacts, stage "
                "from entities where platform='youtube' and platform_id = any(%s)",
                [args.channel_ids],
            )
        elif args.stats:
            # any gated channel with no/stale video stats, regardless of email -- backfills
            # scoring data for channels the default (email-focused) mode never touches.
            cur.execute(
                """
                select e.entity_id, e.platform_id, e.email_norm, e.phone_norm, e.wechat_norm, e.contacts, e.stage
                from entities e
                where e.platform='youtube' and e.stage in ('filtered_in','enriched','qualified','outreach')
                  and coalesce(e.follower_count,0) >= %s
                  and not exists (
                      select 1 from staging_youtube_video v
                      where v.channel_id = e.platform_id
                        and v.collected_at > now() - make_interval(days => %s)
                  )
                order by e.follower_count desc nulls last
                limit %s
                """,
                [args.min_followers, VIDEO_STATS_REFRESH_DAYS, args.limit],
            )
        else:
            # highest-follower gated YouTube channels that still have no email
            cur.execute(
                """
                select entity_id, platform_id, email_norm, phone_norm, wechat_norm, contacts, stage
                from entities
                where platform='youtube' and email_norm is null
                  and stage='filtered_in' and last_enriched is null
                  and coalesce(follower_count,0) >= %s
                order by follower_count desc nulls last
                limit %s
                """,
                [args.min_followers, args.limit],
            )
        targets = cur.fetchall()

        est_quota = math.ceil(len(targets) / 50) + len(targets) * 2
        print(f"channels to enrich: {len(targets)}  |  est. quota: ~{est_quota} units")
        if args.dry_run:
            conn.close()
            return

        platform_ids = [platform_id for _, platform_id, *_ in targets]
        try:
            uploads_by_channel, quota = uploads_playlist_ids(platform_ids, api_key)
        except QuotaExceededError as exc:
            conn.close()
            print(f"quota exhausted before enrichment started: {exc}")
            return

        enriched = emails = phones = 0
        scanned = []          # every channel whose videos were fetched (for the summary line)
        scanned_for_gate = [] # only originally-'filtered_in' channels -> safe to gate.mark_enriched
                               # (never downgrade an already enriched/qualified/outreach channel's stage)
        quota_exhausted = False
        for entity_id, platform_id, email_norm, phone_norm, wechat_norm, contacts, stage in targets:
            if quota_exhausted:
                break
            playlist_id = uploads_by_channel.get(platform_id)
            if not playlist_id:
                print(f"  {platform_id}: no uploads playlist, skipped")
                continue
            try:
                videos, q = recent_videos(playlist_id, api_key, args.max_videos)
            except QuotaExceededError:
                print(f"  quota exhausted after {len(scanned)} channel(s); stopping, keeping progress so far")
                quota_exhausted = True
                break
            except Exception as exc:  # noqa: BLE001 - one bad channel must not stop the batch
                print(f"  {platform_id}: skipped ({type(exc).__name__})")
                continue
            quota += q
            scanned.append(entity_id)
            if stage == "filtered_in":
                scanned_for_gate.append(entity_id)
            store_video_stats(cur, platform_id, videos)
            desc = "\n".join((v.get("snippet", {}) or {}).get("description", "") for v in videos
                              if (v.get("snippet", {}) or {}).get("description"))
            if not desc:
                continue
            entity = {"bio_text": desc, "email_norm": email_norm,
                      "phone_norm": phone_norm, "wechat_norm": wechat_norm}
            new_email, new_phone, new_wechat, new_extras = contacts_from_entity(entity)
            merged = dict(contacts or {})
            if new_extras:
                merged.update(new_extras)
            # Reading the actual videos is often the only place an AU-based creator
            # reveals location (an AU phone, .com.au, an ASIC broker) -> record it as
            # geo evidence even when the video yields no new contact.
            if any(signal in desc.lower() for signal in AU_SIGNAL):
                merged["au_signal"] = "video description"
            if TMGM_RE.search(desc):
                merged["tmgm_mention"] = True
            if new_email == email_norm and new_phone == phone_norm and new_wechat == wechat_norm \
                    and merged == (contacts or {}):
                continue
            emails += new_email != email_norm
            phones += new_phone != phone_norm
            enriched += 1
            cur.execute(
                "update entities set email_norm=%s, phone_norm=%s, wechat_norm=%s, "
                "contacts=%s where platform='youtube' and platform_id=%s",
                (new_email, new_phone, new_wechat, Jsonb(merged) if merged else None, platform_id),
            )
        conn.commit()
    gate.mark_enriched(conn, scanned_for_gate)  # paid for once -> never re-selected

    rescored = 0
    if scanned:  # freshly stored video stats change fake_audience_signal/engagement_rate -- rescore now,
        from db.run_scoring import score_entities  # not just on the channel's next unrelated ingest

        rescored = score_entities(conn, scanned)
    conn.close()
    print(f"scanned {len(scanned)} channels (video stats stored, {rescored} rescored), enriched {enriched}: "
          f"+{emails} emails, +{phones} phones  |  quota used: {quota} units"
          + ("  (stopped early: quota exhausted)" if quota_exhausted else ""))


if __name__ == "__main__":
    main()
