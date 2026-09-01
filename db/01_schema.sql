-- ============================================================================
-- IB Discovery Engine — Postgres schema
-- 3 lớp: staging (thô, per-platform) -> entities (identity đã resolve)
--        -> entity_links (bằng chứng nối, giữ nguyên để audit/re-resolve)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- LỚP 1: STAGING — mỗi platform một bảng, append-only, KHÔNG sửa/xoá.
-- Đây là nơi Python đổ raw JSON từ Apify actor / YouTube Data API / Telethon
-- vào ngay sau khi kéo về. Không transform ở đây.
-- Field source_url + collected_at có sẵn ngay từ đầu vì compliance (#7) cần.
-- ----------------------------------------------------------------------------

-- Apify-scraper platforms (see platforms/*.py + db/loader.py) — one table each,
-- same append-only shape: raw JSONB is the untouched Apify dataset item.
CREATE TABLE IF NOT EXISTS staging_linkedin (
    id              BIGSERIAL PRIMARY KEY,
    platform_id     TEXT NOT NULL,          -- publicIdentifier
    raw             JSONB NOT NULL,
    source_url      TEXT,
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    run_id          TEXT,
    ingested_batch  TEXT
);

CREATE TABLE IF NOT EXISTS staging_instagram (
    id              BIGSERIAL PRIMARY KEY,
    platform_id     TEXT NOT NULL,          -- username
    raw             JSONB NOT NULL,
    source_url      TEXT,
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    run_id          TEXT,
    ingested_batch  TEXT
);

CREATE TABLE IF NOT EXISTS staging_twitter (
    id              BIGSERIAL PRIMARY KEY,
    platform_id     TEXT NOT NULL,          -- userName
    raw             JSONB NOT NULL,
    source_url      TEXT,
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    run_id          TEXT,
    ingested_batch  TEXT
);

CREATE TABLE IF NOT EXISTS staging_facebook (
    id              BIGSERIAL PRIMARY KEY,
    platform_id     TEXT NOT NULL,          -- page id từ Apify actor
    raw             JSONB NOT NULL,         -- toàn bộ item Apify trả về, không cắt
    source_url      TEXT,
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    run_id          TEXT,                   -- Apify run id, để trace lại chi phí/lỗi
    ingested_batch  TEXT                    -- nhãn batch thủ công lúc bạn test tay
);

CREATE TABLE IF NOT EXISTS staging_tiktok (
    id              BIGSERIAL PRIMARY KEY,
    platform_id     TEXT NOT NULL,
    raw             JSONB NOT NULL,
    source_url      TEXT,
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    run_id          TEXT,
    ingested_batch  TEXT
);

CREATE TABLE IF NOT EXISTS staging_douyin (
    id              BIGSERIAL PRIMARY KEY,
    platform_id     TEXT NOT NULL,          -- secUid
    raw             JSONB NOT NULL,
    source_url      TEXT,
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    run_id          TEXT,
    ingested_batch  TEXT
);

CREATE TABLE IF NOT EXISTS staging_serp (
    id              BIGSERIAL PRIMARY KEY,
    query           TEXT NOT NULL,
    raw             JSONB NOT NULL,         -- 1 hàng = 1 kết quả SERP
    source_url      TEXT,
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    run_id          TEXT,
    ingested_batch  TEXT
);

CREATE TABLE IF NOT EXISTS staging_youtube (
    id              BIGSERIAL PRIMARY KEY,
    platform_id     TEXT NOT NULL,          -- channelId
    raw             JSONB NOT NULL,         -- response thô từ Data API v3
    source_url      TEXT,
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    quota_units     INT,                    -- theo dõi quota 10k/ngày
    ingested_batch  TEXT
);

CREATE TABLE IF NOT EXISTS staging_telegram (
    id              BIGSERIAL PRIMARY KEY,
    platform_id     TEXT NOT NULL,          -- channel/group id từ Telethon
    raw             JSONB NOT NULL,
    source_url      TEXT,
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ingested_batch  TEXT
);

-- Bio-link / contact-info-scraper cũng là 1 nguồn thô riêng, KHÔNG trộn
-- vào entities cho tới khi qua bước resolve — nó chỉ là "bằng chứng nối".
CREATE TABLE IF NOT EXISTS staging_contact_enrichment (
    id              BIGSERIAL PRIMARY KEY,
    input_url       TEXT NOT NULL,          -- URL bạn đưa vào actor (linktree/website)
    raw             JSONB NOT NULL,         -- emails/phones/social links actor trả về
    source_url      TEXT,
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    run_id          TEXT
);

-- ----------------------------------------------------------------------------
-- LỚP 2: ENTITIES — identity đã resolve, 1 hàng = 1 tài khoản trên 1 platform.
-- QUAN TRỌNG: 1 entity = 1 (platform, platform_id). Một IB có mặt trên
-- 3 platform = 3 hàng entities, nối nhau qua entity_links, KHÔNG gộp thành 1
-- hàng — giữ đúng nguyên tắc "thiên về TÁCH".
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS entities (
    entity_id       BIGSERIAL PRIMARY KEY,
    platform        TEXT NOT NULL CHECK (platform IN
                        ('linkedin','instagram','twitter','facebook','tiktok','douyin',
                         'youtube','telegram','google_serp')),
    platform_id     TEXT NOT NULL,          -- id gốc trên platform đó
    handle          TEXT,                   -- @username hiển thị, có thể đổi
    display_name    TEXT,
    bio_text        TEXT,
    website_url     TEXT,
    avatar_url      TEXT,
    avatar_phash    TEXT,                   -- perceptual hash, tính ở Python khi ingest
    follower_count  INT,
    phone_norm      TEXT,                   -- chuẩn hoá E.164, null nếu chưa có
    email_norm      TEXT,                   -- lowercase trimmed, null nếu chưa có
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_enriched   TIMESTAMPTZ,            -- NULL = chưa qua enrichment, dùng cho watermark
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_url      TEXT,
    stage           TEXT NOT NULL DEFAULT 'discovered'
                        CHECK (stage IN ('discovered','filtered_in','filtered_out',
                                          'enriched','qualified','outreach','rejected')),
    UNIQUE (platform, platform_id)
);

CREATE INDEX IF NOT EXISTS idx_entities_phone ON entities (phone_norm) WHERE phone_norm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entities_email ON entities (email_norm) WHERE email_norm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entities_website ON entities (website_url) WHERE website_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entities_handle ON entities (lower(handle));
CREATE INDEX IF NOT EXISTS idx_entities_last_enriched ON entities (last_enriched);

-- ----------------------------------------------------------------------------
-- LỚP 3: ENTITY_LINKS — cạnh nối giữa 2 entity, KÈM bằng chứng + độ tin cậy.
-- Không bao giờ xoá cạnh yếu, chỉ đánh dấu status. Con người (bạn, hoặc vòng
-- phản hồi outreach) review cạnh "candidate" trước khi nó thành "confirmed".
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS entity_links (
    link_id         BIGSERIAL PRIMARY KEY,
    entity_id_a     BIGINT NOT NULL REFERENCES entities(entity_id),
    entity_id_b     BIGINT NOT NULL REFERENCES entities(entity_id),
    method          TEXT NOT NULL CHECK (method IN
                        ('phone_match','email_match','domain_match',
                         'bio_crossref','handle_exact','avatar_phash')),
    confidence      TEXT NOT NULL CHECK (confidence IN ('strong','candidate')),
    evidence        JSONB,                  -- giá trị khớp cụ thể, để audit sau này
    status          TEXT NOT NULL DEFAULT 'auto'
                        CHECK (status IN ('auto','confirmed','rejected')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at     TIMESTAMPTZ,
    reviewed_by     TEXT,
    CHECK (entity_id_a < entity_id_b),      -- tránh lưu 2 chiều trùng lặp
    UNIQUE (entity_id_a, entity_id_b, method)
);

CREATE INDEX IF NOT EXISTS idx_links_a ON entity_links (entity_id_a);
CREATE INDEX IF NOT EXISTS idx_links_b ON entity_links (entity_id_b);

-- Watermark: bảng phụ đơn giản, dùng khi discovery chạy lại hàng tuần —
-- tra bảng này TRƯỚC khi gọi actor, bỏ qua platform_id đã có.
-- (Thực ra unique(platform, platform_id) trên entities đã đủ làm việc này
--  qua ON CONFLICT DO NOTHING/UPDATE ở bước ingest — xem pipeline.py)
