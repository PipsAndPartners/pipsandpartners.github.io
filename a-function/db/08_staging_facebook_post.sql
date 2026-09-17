-- ============================================================================
-- Facebook POST-search channel (platforms/facebook_post.py).
-- A separate source from staging_facebook: that one holds Pages (mostly brokers),
-- this one holds the AUTHORS of public forex posts (the actual IB people).
-- Same append-only shape as the other Apify staging tables.
-- ============================================================================

CREATE TABLE IF NOT EXISTS staging_facebook_post (
    id              BIGSERIAL PRIMARY KEY,
    platform_id     TEXT NOT NULL,          -- post author's id / profile slug
    raw             JSONB NOT NULL,         -- the whole matched post item
    source_url      TEXT,                   -- author's profile URL
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    run_id          TEXT,
    ingested_batch  TEXT
);

-- entities.platform is a fixed CHECK list (db/01_schema.sql); add the new value.
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_platform_check;
ALTER TABLE entities ADD CONSTRAINT entities_platform_check CHECK (platform IN
    ('linkedin','instagram','twitter','facebook','tiktok','douyin',
     'youtube','telegram','google_serp','facebook_post'));
