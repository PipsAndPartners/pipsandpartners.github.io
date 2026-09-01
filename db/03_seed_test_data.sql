-- Dữ liệu giả để kiểm tra resolve.sql — có đủ 3 nhóm:
--  (A) PHẢI match strong  (B) PHẢI thành candidate  (C) PHẢI KHÔNG match (negative control)

-- ---- NHÓM A: strong match qua phone (facebook <-> telegram) ----
INSERT INTO entities (platform, platform_id, handle, display_name, bio_text, website_url, phone_norm, email_norm)
VALUES
 ('facebook', 'fb_001', 'forexmaster_vn', 'Forex Master VN', 'Chuyên gia trading, lien he zalo', NULL, '+61400111222', NULL),
 ('telegram', 'tg_001', 'fx_master_channel', 'FX Master Channel', 'Kenh tin hieu trading', NULL, '+61400111222', NULL);

-- ---- NHÓM A: strong match qua email (tiktok <-> youtube) ----
INSERT INTO entities (platform, platform_id, handle, display_name, bio_text, website_url, phone_norm, email_norm)
VALUES
 ('tiktok', 'tt_002', 'traderhanoi', 'Trader Hanoi', 'Day trade forex', NULL, NULL, 'traderhanoi@gmail.com'),
 ('youtube', 'yt_002', 'TraderHanoiOfficial', 'Trader Hanoi Official', 'Kenh youtube chinh thuc', NULL, NULL, 'traderhanoi@gmail.com');

-- ---- NHÓM A: strong match qua domain website riêng (facebook <-> tiktok) ----
INSERT INTO entities (platform, platform_id, handle, display_name, bio_text, website_url, phone_norm, email_norm)
VALUES
 ('facebook', 'fb_003', 'ibsaigon', 'IB Saigon', 'Website chinh thuc', 'https://ibsaigon-partners.com', NULL, NULL),
 ('tiktok', 'tt_003', 'ibsaigon.official', 'IB Saigon Official', NULL, 'https://ibsaigon-partners.com', NULL, NULL);

-- ---- NHÓM C (negative): cùng domain NHƯNG là linktree -> KHÔNG được match ----
INSERT INTO entities (platform, platform_id, handle, display_name, bio_text, website_url, phone_norm, email_norm)
VALUES
 ('facebook', 'fb_004', 'randomib1', 'Random IB 1', NULL, 'https://linktr.ee/randomib1', NULL, NULL),
 ('google_serp', 'serp_004', 'randomib2', 'Random IB 2 - khong lien quan', NULL, 'https://linktr.ee/randomib2', NULL, NULL);

-- ---- NHÓM C (negative): cùng phone NHƯNG cùng platform -> KHÔNG được match ----
INSERT INTO entities (platform, platform_id, handle, display_name, bio_text, website_url, phone_norm, email_norm)
VALUES
 ('facebook', 'fb_005', 'dupfb1', 'Trung Duplicate Page 1', NULL, NULL, '+61499888777', NULL),
 ('facebook', 'fb_006', 'dupfb2', 'Trung Duplicate Page 2', NULL, NULL, '+61499888777', NULL);

-- ---- NHÓM B: candidate qua bio cross-reference (facebook bio nhắc handle Telegram) ----
INSERT INTO entities (platform, platform_id, handle, display_name, bio_text, website_url, phone_norm, email_norm)
VALUES
 ('facebook', 'fb_007', 'vietfxcoach', 'Viet FX Coach', 'Join telegram cua toi: t.me/vietfx_signals de nhan tin hieu mien phi', NULL, NULL, NULL),
 ('telegram', 'tg_007', 'vietfx_signals', 'Viet FX Signals', 'Kenh tin hieu chinh thuc', NULL, NULL, NULL);

-- ---- NHÓM B: candidate qua handle trùng khít (tiktok <-> youtube, đủ dài >=5) ----
INSERT INTO entities (platform, platform_id, handle, display_name, bio_text, website_url, phone_norm, email_norm)
VALUES
 ('tiktok', 'tt_008', 'anhbatrade', 'Anh Ba Trade', NULL, NULL, NULL, NULL),
 ('youtube', 'yt_008', 'anh.ba.trade', 'Anh Ba Trade Channel', NULL, NULL, NULL, NULL);

-- ---- NHÓM C (negative): handle ngắn trùng ngẫu nhiên (<5 ký tự) -> KHÔNG được match ----
INSERT INTO entities (platform, platform_id, handle, display_name, bio_text, website_url, phone_norm, email_norm)
VALUES
 ('facebook', 'fb_009', 'fx88', 'FX88 Page', NULL, NULL, NULL, NULL),
 ('tiktok', 'tt_009', 'fx88', 'FX88 khong lien quan gi ca', NULL, NULL, NULL, NULL);

-- ---- Entity đơn lẻ, không match gì (control) ----
INSERT INTO entities (platform, platform_id, handle, display_name, bio_text, website_url, phone_norm, email_norm)
VALUES
 ('youtube', 'yt_010', 'lonelychannel', 'Lonely Channel', 'Khong lien quan ai', NULL, NULL, NULL);
