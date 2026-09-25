-- Watermark per (platform, query): when a search last ran and whether it still
-- finds anything new, so a weekly refresh doesn't pay an actor again for a
-- search that only returns entities we already have (see discovery/common/watermark.py).
-- Entity-level dedup is entities UNIQUE (platform, platform_id) + last_seen_at/last_enriched.

CREATE TABLE IF NOT EXISTS discovery_watermark (
    platform        TEXT NOT NULL,
    query           TEXT NOT NULL,          -- search term / keyword / category, as sent to the actor
    last_run_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    runs            INT NOT NULL DEFAULT 1,
    last_returned   INT NOT NULL DEFAULT 0, -- distinct entities the last run returned
    last_new        INT NOT NULL DEFAULT 0, -- of those, not in entities before the run
    PRIMARY KEY (platform, query)
);
