-- ============================================================================
-- Thêm cột contacts JSONB: các kênh liên hệ phụ trích từ bio (facebook, zalo,
-- telegram, instagram, x/twitter, wechat, qq) mà email_norm/phone_norm/
-- wechat_norm không chứa. Giữ dạng JSONB để không phải thêm cột mỗi khi có
-- kênh mới. email/phone/wechat vẫn ở cột riêng như cũ (index, resolve dùng).
-- ============================================================================
ALTER TABLE entities ADD COLUMN IF NOT EXISTS contacts JSONB;
