-- ============================================================================
-- Entity scoring — IB/creator quality signals (see scoring.py).
-- Several columns stay NULL until this project actually collects the data
-- they need (post-level engagement, audience demographics, follower-count
-- history, bot/fake-follower analysis) -- `notes` records why, per field,
-- rather than a fabricated number.
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_scores (
    entity_id                BIGINT PRIMARY KEY REFERENCES entities(entity_id) ON DELETE CASCADE,
    engagement_rate          NUMERIC,          -- %, NULL = not computable yet
    audience_quality         NUMERIC,          -- 0-100, weak proxy until real audience data exists
    audience_demographics    JSONB,            -- NULL = not computable yet
    follower_growth          NUMERIC,          -- % change, needs repeated snapshots over time
    brand_safety             NUMERIC,          -- 0-100, crude keyword screen only for now
    estimated_post_price_usd NUMERIC,          -- rough $/1000-followers estimate
    fake_audience_signal     NUMERIC,          -- 0-100 risk score, NULL = not computable yet
    creator_relevance        NUMERIC,          -- 0-100, forex/IB keyword-match heuristic
    composite_score          NUMERIC,          -- weighted average over the fields actually available
    data_completeness        NUMERIC,          -- 0-1, fraction of the 7 scoring fields that were computable
    notes                    JSONB,            -- per-field explanation of method / what's missing
    scored_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_scores_composite ON entity_scores (composite_score DESC NULLS LAST);
