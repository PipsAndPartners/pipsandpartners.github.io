-- ============================================================================
-- Follower-count history — one append-only row per (entity, scrape), so
-- follower_growth in entity_scores has real data to diff once an entity has
-- been scraped more than once. See db/loader.py and scoring.py.
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_follower_history (
    id              BIGSERIAL PRIMARY KEY,
    entity_id       BIGINT NOT NULL REFERENCES entities(entity_id) ON DELETE CASCADE,
    follower_count  INT NOT NULL,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follower_history_entity ON entity_follower_history (entity_id, captured_at);
