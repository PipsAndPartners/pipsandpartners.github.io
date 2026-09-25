-- ============================================================================
-- Trạng thái outreach trên entities: đã liên hệ chưa + khi nào follow up.
-- contacted_at NULL = chưa liên hệ ("already contact" = Yes khi có giá trị).
-- outreach.createmail ghi các cột này mỗi lần tạo .eml; scripts/backfill_contacted
-- replay các batch cũ + Sent Items. Website không cần cột mới: dùng
-- coalesce(website_url, contacts->>'website').
-- ============================================================================
ALTER TABLE entities ADD COLUMN IF NOT EXISTS contacted_at    TIMESTAMPTZ;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS contacted_batch TEXT;   -- label batch eml / 'sent-items'
ALTER TABLE entities ADD COLUMN IF NOT EXISTS follow_up_at    DATE;   -- ngày cần follow up
ALTER TABLE entities ADD COLUMN IF NOT EXISTS follow_up_note  TEXT;   -- ghi chú / trạng thái (vd "replied")

CREATE INDEX IF NOT EXISTS idx_entities_contacted ON entities (contacted_at) WHERE contacted_at IS NOT NULL;
