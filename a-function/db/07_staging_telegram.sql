-- Telegram discovery additions. Keep staging append-only and preserve legacy rows.
ALTER TABLE staging_telegram
    ADD COLUMN IF NOT EXISTS username TEXT,
    ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'channel',
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'legacy',
    ADD COLUMN IF NOT EXISTS discovered_from TEXT,
    ADD COLUMN IF NOT EXISTS access_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_staging_tg_platform_id
    ON staging_telegram(platform_id);
CREATE INDEX IF NOT EXISTS idx_staging_tg_collected_at
    ON staging_telegram(collected_at);
CREATE INDEX IF NOT EXISTS idx_staging_tg_source
    ON staging_telegram(source);
