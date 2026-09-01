-- ============================================================================
-- Entity resolution — chạy SAU khi entities đã có dữ liệu từ nhiều platform.
-- Thứ tự bắt buộc: khóa mạnh trước, khóa yếu sau. Khóa yếu KHÔNG BAO GIỜ tự
-- động merge — chỉ tạo cạnh 'candidate' chờ người duyệt (hoặc chờ vòng phản
-- hồi outreach xác nhận). Đây là chỗ hiện thực hoá "thiên về TÁCH".
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BƯỚC 1 — KHÓA MẠNH: số điện thoại trùng (đã chuẩn hoá E.164 lúc ingest)
-- ----------------------------------------------------------------------------
INSERT INTO entity_links (entity_id_a, entity_id_b, method, confidence, evidence, status)
SELECT
    LEAST(a.entity_id, b.entity_id),
    GREATEST(a.entity_id, b.entity_id),
    'phone_match',
    'strong',
    jsonb_build_object('phone', a.phone_norm),
    'confirmed'                              -- khóa mạnh -> confirmed thẳng, khỏi chờ review
FROM entities a
JOIN entities b
  ON a.phone_norm = b.phone_norm
 AND a.entity_id < b.entity_id
 AND a.platform <> b.platform               -- không tự nối 2 hàng cùng platform
WHERE a.phone_norm IS NOT NULL
ON CONFLICT (entity_id_a, entity_id_b, method) DO NOTHING;

-- ----------------------------------------------------------------------------
-- BƯỚC 2 — KHÓA MẠNH: email trùng
-- ----------------------------------------------------------------------------
INSERT INTO entity_links (entity_id_a, entity_id_b, method, confidence, evidence, status)
SELECT
    LEAST(a.entity_id, b.entity_id),
    GREATEST(a.entity_id, b.entity_id),
    'email_match',
    'strong',
    jsonb_build_object('email', a.email_norm),
    'confirmed'
FROM entities a
JOIN entities b
  ON a.email_norm = b.email_norm
 AND a.entity_id < b.entity_id
 AND a.platform <> b.platform
WHERE a.email_norm IS NOT NULL
ON CONFLICT (entity_id_a, entity_id_b, method) DO NOTHING;

-- ----------------------------------------------------------------------------
-- BƯỚC 3 — KHÓA MẠNH: cùng domain website (bỏ qua domain platform chung như
-- linktr.ee/bio.link — nếu không sẽ nối nhầm hàng trăm IB không liên quan)
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _shared_bio_domains AS
SELECT unnest(ARRAY['linktr.ee','bio.link','beacons.ai','lnk.bio','carrd.co']) AS domain;

INSERT INTO entity_links (entity_id_a, entity_id_b, method, confidence, evidence, status)
SELECT
    LEAST(a.entity_id, b.entity_id),
    GREATEST(a.entity_id, b.entity_id),
    'domain_match',
    'strong',
    jsonb_build_object('domain', a.website_url),
    'confirmed'
FROM entities a
JOIN entities b
  ON a.website_url = b.website_url
 AND a.entity_id < b.entity_id
 AND a.platform <> b.platform
WHERE a.website_url IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM _shared_bio_domains d
      WHERE a.website_url ILIKE '%' || d.domain || '%'
  )
ON CONFLICT (entity_id_a, entity_id_b, method) DO NOTHING;

-- ----------------------------------------------------------------------------
-- BƯỚC 4 — KHÓA YẾU (candidate, chờ review): bio của A nhắc trực tiếp URL/
-- handle của B. Đây là bằng chứng tốt hơn "trùng tên" nhưng vẫn không chắc
-- 100% (có thể IB đăng chéo kênh của người khác).
-- ----------------------------------------------------------------------------
INSERT INTO entity_links (entity_id_a, entity_id_b, method, confidence, evidence, status)
SELECT
    LEAST(a.entity_id, b.entity_id),
    GREATEST(a.entity_id, b.entity_id),
    'bio_crossref',
    'candidate',
    jsonb_build_object('found_handle_in_bio', b.handle),
    'auto'
FROM entities a
JOIN entities b
  ON a.entity_id <> b.entity_id
 AND a.platform <> b.platform
 AND b.handle IS NOT NULL
 AND a.bio_text ILIKE '%' || b.handle || '%'
WHERE a.bio_text IS NOT NULL
ON CONFLICT (entity_id_a, entity_id_b, method) DO NOTHING;

-- ----------------------------------------------------------------------------
-- BƯỚC 5 — KHÓA YẾU (candidate): handle trùng khít y hệt giữa 2 platform.
-- KHÔNG dùng similarity/fuzzy — chỉ so khớp tuyệt đối sau khi lowercase và bỏ
-- ký tự đặc biệt. Tên tiếng Việt không fuzzy match (theo đúng ghi chú của bạn).
-- ----------------------------------------------------------------------------
INSERT INTO entity_links (entity_id_a, entity_id_b, method, confidence, evidence, status)
SELECT
    LEAST(a.entity_id, b.entity_id),
    GREATEST(a.entity_id, b.entity_id),
    'handle_exact',
    'candidate',
    jsonb_build_object('handle', lower(a.handle)),
    'auto'
FROM entities a
JOIN entities b
  ON lower(regexp_replace(a.handle, '[^a-zA-Z0-9]', '', 'g'))
   = lower(regexp_replace(b.handle, '[^a-zA-Z0-9]', '', 'g'))
 AND a.entity_id < b.entity_id
 AND a.platform <> b.platform
WHERE a.handle IS NOT NULL AND length(a.handle) >= 5   -- handle ngắn quá dễ trùng ngẫu nhiên
ON CONFLICT (entity_id_a, entity_id_b, method) DO NOTHING;

-- ----------------------------------------------------------------------------
-- BƯỚC 6 — avatar_phash: để dành khi bạn đã tính phash lúc ingest (Python,
-- thư viện imagehash). So khớp bằng Hamming distance, không so bằng SQL text.
-- Gợi ý: tính phash ở Python, lưu dạng hex string, so bằng hàm khoảng cách
-- Hamming viết ở Python (loop qua entities chưa có strong link), không viết
-- lại thuật toán Hamming trong SQL thuần — không đáng.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- KIỂM TRA NHANH SAU KHI CHẠY — xem entity nào đang có link nhưng chưa merge
-- view thành "IB đã resolve" (đi từ 1 nhóm liên thông qua strong links)
-- ----------------------------------------------------------------------------
-- Đơn giản nhất ở giai đoạn 1: xem từng cặp confirmed, chưa cần union-find.
SELECT ea.platform AS platform_a, ea.handle AS handle_a,
       eb.platform AS platform_b, eb.handle AS handle_b,
       l.method, l.confidence, l.status
FROM entity_links l
JOIN entities ea ON ea.entity_id = l.entity_id_a
JOIN entities eb ON eb.entity_id = l.entity_id_b
ORDER BY l.confidence DESC, l.created_at DESC;
