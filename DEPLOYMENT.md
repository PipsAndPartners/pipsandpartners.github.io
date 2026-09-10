# PipsAndPartners — Kế hoạch deploy (cloud + free server)

*Ngày lập: 2026-09-04. Không kèm mốc thời gian (bạn tự đẩy tiến độ). Đây là checklist việc-cần-làm, đọc từ trên xuống.*

## 0. Bức tranh tổng thể — 2 phần độc lập

Repo có hai thứ deploy **tách rời nhau, không phụ thuộc nhau**:

- **Marketing site** (`docs/`): HTML/CSS/JS tĩnh, không build step. → host tĩnh free, **không cần server**. Có thể lên online ngay hôm nay.
- **A-function** (`a-function/`): Flask app + PostgreSQL + scraper Apify. → cần Python host + Postgres. Đây mới là phần "server".

Việc scraping thật sự chạy trên **cloud của Apify** (actor), không phải trên host của bạn — nên host chỉ cần chạy Flask + nối DB, nhẹ.

---

## Câu hỏi chiến lược: thiết kế DB trước, hay online sớm rồi upgrade?

**→ Online sớm.** Vì database architecture của bạn **đã thiết kế xong rồi** và thiết kế đó tốt:

- 3 lớp rõ ràng: `staging_<platform>` (append-only, raw JSON, không sửa/xoá) → `entities` (1 hàng = 1 account/platform, tách identity đúng chuẩn) → `entity_links` (cạnh nối kèm evidence + confidence, có review thủ công).
- Kèm `entity_scores`, `entity_follower_history`, `app_users`. Có index hợp lý (phone/email/website/handle).
- Đã áp dụng local trên Postgres 17.

Không có gì phải "thiết kế lại trước khi lên online". Việc còn thiếu **không phải thiết kế DB**, mà là:

1. Chạy các file `.sql` theo đúng thứ tự lên DB cloud (đã có sẵn `db/run_sql_file.py`).
2. Kỷ luật migration từ giờ: mỗi thay đổi schema = **1 file mới đánh số tăng dần** (`07_...`, `08_...`), **không sửa file cũ** đã chạy.

Kết luận: site tĩnh online **ngay**; app + DB lên **free tier như môi trường staging** (schema đã ổn định), chỉ nâng lên trả phí khi có traffic thật hoặc cần đảm bảo dữ liệu bền. Đừng gold-plate — YAGNI.

---

## Phần A — Marketing site → Cloudflare Pages (free, không sleep)

Bạn đã scaffold sẵn: `wrangler.toml` (`pages_build_output_dir = "docs"`), `scripts/deploy-cloudflare.sh`, và `.wrangler/cache/wrangler-account.json` (account đã được link — có thể bạn đã deploy 1 lần).

Việc cần làm:

1. Deploy: chạy `bash scripts/deploy-cloudflare.sh` — nó gọi `npx wrangler pages deploy docs --project-name=pipsandpartners`. Chỉ upload đúng folder `docs/`, không đụng `a-function/` hay secrets.
2. (Tuỳ chọn) CI tự động: vào Cloudflare Pages dashboard → nối repo GitHub → mỗi lần `push` main tự redeploy. Không bắt buộc.
3. Domain: mặc định được `https://pipsandpartners.pages.dev` (free). Muốn branding sạch thì mua domain (`pipsandpartners.com`) → add vào Pages dashboard, không lộ URL `.pages.dev`.

Lựa chọn thay thế: **GitHub Pages** (README đã hướng dẫn: Settings → Pages → branch `main`, folder `/docs`). Cả hai đều free & không sleep. → **Chọn Cloudflare** vì đã scaffold sẵn, khỏi làm lại.

---

## Phần B — A-function (Flask + Postgres) → free host

Chia làm **2 dịch vụ riêng**: DB một nơi, app một nơi. Đây là điểm dễ sai nhất khi tìm "free".

### B1. Database → Neon (free vĩnh viễn) — **KHÔNG dùng Render Postgres**

⚠️ **Postgres free của Render hết hạn sau 30 ngày (+14 ngày ân hạn) rồi bị xoá dữ liệu.** Không xài cho DB thật.

Dùng **Neon** free tier: ~3 GiB/branch, **free vĩnh viễn**, chỉ auto-suspend khi idle chứ không xoá. Thừa sức cho use case này.
(Thay thế: Supabase 500MB — nhưng pause sau ~7 ngày idle. Neon sạch hơn cho Postgres thuần.)

Việc cần làm:

1. Tạo account Neon → tạo project → copy `DATABASE_URL` (dạng `postgresql://user:pass@host/db?sslmode=require`). Neon **bắt buộc SSL**, nhớ giữ `sslmode=require` trong chuỗi.
2. Áp schema lên Neon **theo đúng thứ tự**, dùng chính script có sẵn (chỉ cần trỏ `DATABASE_URL` sang Neon):
   ```
   python db/run_sql_file.py db/01_schema.sql
   python db/run_sql_file.py db/04_scores.sql
   python db/run_sql_file.py db/05_follower_history.sql
   python db/run_sql_file.py db/06_users.sql
   ```
   (`02_resolve.sql` là logic resolve, `03_seed_test_data.sql` là seed test — chạy khi cần, không bắt buộc cho production.)
3. Kiểm tra `db/connection.py` đọc `DATABASE_URL` từ env — đã đúng, không cần sửa code.

### B2. Flask app → Render free web service

Việc cần làm:

1. New **Web Service** → repo = repo này → **Root Directory = `a-function`**.
2. Build command: `pip install -r requirements.txt`. Start: đã có sẵn `Procfile` (`gunicorn -w 1 --threads 8 --timeout 120 -b 0.0.0.0:$PORT web.app:app`) — Render tự nhận.
3. Set env vars (Settings → Environment):
   - `DATABASE_URL` = Neon URL (từ B1)
   - `APIFY_TOKEN` = Apify token của bạn
   - `SECRET_KEY` = sinh bằng `python -c "import secrets; print(secrets.token_hex(32))"`
   - `TOKEN_ENC_KEY` = sinh bằng `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` — **BACKUP key này cẩn thận. Mất nó = mọi Apify token đã mã hoá trong DB thành rác không khôi phục được.**
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_APIFY_TOKEN`
4. Seed admin lần đầu: chạy `python db/seed_admin.py` (qua Render Shell, hoặc chạy local trỏ vào Neon DATABASE_URL).
5. Deploy → nhận URL dạng `https://pipsandpartners-afunction.onrender.com`.

⚠️ Render free web **sleep sau 15 phút idle**; request đầu sau khi ngủ chậm ~1 phút (cold start), có 750 giờ/tháng. Chấp nhận được cho một internal tool. Muốn always-on ≈ $7/tháng.

### B3. Nối 2 phần lại (sau khi app có URL)

README ghi rõ có URL `http://127.0.0.1:*` **hardcode** ở:

- Menu "A-function" trong nav của **mỗi trang** `docs/*.html`.
- Link "Home" / "Register as IB" trong `a-function/web/templates/index.html`.

→ Sửa các URL đó thành URL Render thật, rồi **redeploy site tĩnh** (Phần A). Xong thì hai phần đã nối vào nhau.

---

## Phần C — Trước khi cho người ngoài dùng (bảo mật / compliance)

App này lưu **PII người thật** (tên, số điện thoại, email cào từ social). Đây là rủi ro pháp lý (GDPR/quyền riêng tư), không chỉ là chuyện kỹ thuật:

1. Giữ app **login-gated** (đã có: mọi route redirect `/login`) + secrets mạnh + HTTPS (Render tự cấp). ✅
2. Cân nhắc để app **private/internal**, không cho search engine index.
3. `.env` **không bao giờ commit** (đã gitignore). ✅
4. Apify **tính tiền theo run** — "free" ở đây chỉ là hosting; scraping vẫn tốn tiền theo lượng dùng.
5. Nghĩ trước về **data retention**: cào PII cần cơ sở hợp lý + cơ chế xoá khi được yêu cầu.

---

## Checklist thứ tự thực hiện

- [ ] 1. Deploy site tĩnh lên Cloudflare Pages (làm ngay, độc lập mọi thứ khác)
- [ ] 2. Tạo Neon DB, copy `DATABASE_URL`
- [ ] 3. Áp schema (`01`, `04`, `05`, `06`) lên Neon theo thứ tự
- [ ] 4. Tạo Render web service, Root = `a-function`, set đủ env vars
- [ ] 5. Seed admin (`db/seed_admin.py`)
- [ ] 6. Test đăng nhập + chạy thử 1 actor nhỏ để xác nhận app ↔ DB ↔ Apify thông
- [ ] 7. Sửa URL `127.0.0.1` → URL Render, redeploy site tĩnh
- [ ] 8. (Về sau) chuyển migration sang đánh số tăng dần; nâng cấp trả phí khi cần persistence/always-on

---

## Ghi chú kiến trúc (để không phải nghĩ lại)

| Thành phần | Chạy ở đâu | Free? | Cảnh báo |
|---|---|---|---|
| Marketing site (`docs/`) | Cloudflare Pages | Free, không sleep | — |
| Flask app (`a-function/`) | Render Web Service | Free, sleep 15' idle | Cold start ~1' |
| PostgreSQL | **Neon** | Free vĩnh viễn | KHÔNG dùng Render Postgres (xoá sau 30 ngày) |
| Scraping | Apify cloud | **Trả phí theo run** | Không phải hosting cost |
