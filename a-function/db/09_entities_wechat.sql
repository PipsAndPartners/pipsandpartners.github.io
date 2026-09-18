-- Douyin discovery (E6): WeChat is the dominant Douyin contact channel, but
-- entities only had phone_norm/email_norm. Add wechat_norm for existing DBs.
-- Idempotent, so re-running the schema bundle is safe.
ALTER TABLE entities
    ADD COLUMN IF NOT EXISTS wechat_norm TEXT;

CREATE INDEX IF NOT EXISTS idx_entities_wechat
    ON entities (wechat_norm) WHERE wechat_norm IS NOT NULL;
