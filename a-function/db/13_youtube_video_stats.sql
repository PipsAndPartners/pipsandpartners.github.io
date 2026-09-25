-- ============================================================================
-- Per-video stats (views/likes/comments/duration) for YouTube channels, so
-- scoring.py can judge fake-audience risk and engagement at the video level,
-- not just the channel-level subscriber/view totals in staging_youtube.
-- Populated by discovery/youtube_video_enrich.py, which already fetches these
-- videos for contact-recovery -- adding statistics+contentDetails costs 0
-- extra quota (videos.list is a flat 1 unit/call regardless of `part`).
-- Append-only like the other staging_* tables (db/01_schema.sql); scoring
-- reads the latest snapshot per video_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS staging_youtube_video (
    id              BIGSERIAL PRIMARY KEY,
    channel_id      TEXT NOT NULL,
    video_id        TEXT NOT NULL,
    raw             JSONB NOT NULL,         -- video resource: snippet+statistics+contentDetails
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staging_youtube_video_channel ON staging_youtube_video (channel_id, collected_at DESC);
