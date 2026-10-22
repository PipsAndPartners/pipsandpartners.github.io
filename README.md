# pipsandpartners.github.io — trang hợp tác MIB/IB cùng TMGM

Trang tĩnh ba ngôn ngữ (English mặc định, Tiếng Việt, 繁體中文), chạy thẳng trên GitHub Pages, không cần build hay cài gì.

| Trang | Địa chỉ | Nội dung |
|---|---|---|
| Pitch hợp tác | `/` | 14 slide: pháp lý, năm dòng thu nhập, tài khoản, ECN Q4, lịch tiền về, KM, ví dụ, so sánh, ưu đãi, liên hệ |
| Ưu đãi | `/promotions/` | Mỗi ưu đãi một slide: cách tham gia, điều kiện chính, link và QR chương trình |

## Chạy thử trên máy

```bash
python -m http.server 8765 --bind 127.0.0.1
```

rồi mở http://127.0.0.1:8765 (trang ưu đãi: http://127.0.0.1:8765/promotions/). Mở thẳng `index.html` cũng được, nhưng mở khóa bằng mã cần `http://` hoặc `https://` (Web Crypto không chạy trên `file://` ở một số trình duyệt).

## Test

```bash
node --test "tests/*.test.js"
```

Chỉ cần Node (không cài thêm gì). Máy có thư mục `private/` thì chạy thêm bộ test dùng số KM thật:

```bash
node --test "tests/*.test.js" "private/tests/*.test.js"
```

Bộ công khai (`tests/`) kiểm tra: chức danh và WhatsApp (`bd`), mã hóa và khóa (`lock`, `lock-build`, `lock-ui`), không lộ nội dung đã khóa và không còn file cấu hình của nơi lưu trữ cũ (`leak`), slide Ưu đãi khác (`slide13`), trang ưu đãi (`promotions`), máy tính IB mới và add-on (`calc-ib`), QR (`qr`), ngày làm việc (`dates`), form liên hệ (`contact`), link đăng ký (`register`).

## Điều khiển

| Việc | Cách |
|---|---|
| Chuyển slide | Nút "All slides" trên header, hoặc thanh cuộn |
| Đổi ngôn ngữ EN / VI / 中文 | Nút trên header, phím `L`, hoặc `?lang=vi` / `?lang=zh` |
| Đối tượng MIB / IB | Trong danh sách slide (hàng "Audience"), hoặc `?a=ib` |
| Đăng ký | Header: "Register now ▾" chọn **Global** hoặc **Việt Nam**; bìa, slide cuối, footer có 2 nút tương ứng |
| Trình bày | Nút ▶, phím `P`, hoặc `?present`; `→` `←` chuyển, `N` lời thoại, `F` toàn màn hình, `B` màn đen, `Esc` thoát |
| In ra PDF | Ctrl+P (A4 ngang, mỗi section một trang) |

## Khóa bằng mã truy cập

Ba slide **KM (08)**, **Ví dụ (10)**, **So sánh (11)** chỉ hiện khung nhập mã cùng nút liên hệ (WhatsApp, Telegram, email). Nhập đúng mã một lần là mở cả ba, trình duyệt nhớ lại; menu có nút **Khóa lại**. Một số ưu đãi chỉ chia sẻ riêng (vé concert, Premier League…) ở slide 13 và trang ưu đãi cũng chỉ hiện sau khi nhập mã.

Trang là file tĩnh nên nội dung khóa được **mã hóa thật** (AES-256-GCM; mỗi mã là một ô bọc khóa nội dung qua PBKDF2) chứ không chỉ ẩn bằng JavaScript. Số liệu thật nằm trong `private/` (không đẩy lên GitHub); chỉ `locked.js` (đã mã hóa) được đẩy lên.

```bash
node scripts/lock.mjs                       # tạo lại locked.js; tạo mã cho mục chưa có mã
node scripts/lock.mjs --add "Tên đối tác"   # thêm một mã mới
node scripts/lock.mjs --revoke "Tên"        # thu hồi một mã (đổi khóa nội dung; người khác phải nhập lại)
node scripts/lock.mjs --rotate              # đổi khóa nội dung, giữ mọi mã
```

| File | Vai trò |
|---|---|
| `private/locked-source.json` | Số thật và chữ của phần khóa (bậc KM, so sánh sàn, slide KM/Ví dụ/So sánh, ưu đãi riêng). Sửa file này rồi chạy `lock.mjs` |
| `private/codes.json` | Tên đối tác ↔ mã (đổi `name` cho đúng người; mã giữ nguyên khi chạy lại) |
| `private/lock-state.json` | Khóa nội dung hiện tại (đừng làm mất; mất thì chạy `--rotate`, mọi người nhập lại mã) |
| `private/img/` | Ảnh chỉ dành cho người có mã (dùng trong `locked-source.json` dạng `@private/img/x.png`, được nhúng vào phần mã hóa) |
| `locked.js` | Gói đã mã hóa — **file duy nhất được đẩy lên** |
| `lock.js` | Mã hóa/giải mã dùng chung cho hai trang |

Mỗi lần sửa số thì chạy lại `lock.mjs` rồi đẩy `locked.js`. Lưu ý: mọi thứ từng đẩy lên GitHub trước đây vẫn nằm trong lịch sử repo; khóa chỉ bảo vệ từ lần đẩy kế tiếp.

## Slide 10: MIB và IB mới

Công tắc **Mô hình** đầu slide: *MIB có Sub-IB* (chia rebate cho Sub-IB, thưởng KM MIB) hoặc *IB mới* (chỉ khách trực tiếp: rebate + thưởng KM tháng IB, cần ≥ 5 khách kích hoạt trong đó ≥ 3 hoạt động). Cả hai có add-on ECN Q4 (chỉ Edge) và hoàn swap, mặc định tắt.

Chế độ IB mới có thêm khung **Ưu đãi khác (add-on)**: mỗi ưu đãi đang nhận đăng ký mà có trường `calc` sẽ hiện thành một nút. Thưởng cho chính IB (vé) cộng vào thu nhập và thay cho thưởng tháng IB; ưu đãi của khách (credit, cashback, points, bốc thăm…) ghi riêng, không cộng vào thu nhập. Halloween Quest và 50% Credit loại trừ nhau. Thêm ưu đãi mới vào máy tính: chỉ cần điền `calc` (xem đầu `promotions/promos-data.js` và `calc.promoAddon` trong `calc.js`).

## Trang ưu đãi (`/promotions/`)

- Dữ liệu ở `promotions/promos-data.js` (biến `window.PROMOS`). `from`/`until` là ngày bắt đầu và hết hạn: hết hạn thì tự ẩn. `hidden: true` để ẩn tay. Ưu đãi đã đóng đăng ký nhưng còn hoàn tất dùng nhóm `followup` kèm `regUntil`.
- Slide 13 của trang pitch lấy cùng dữ liệu này (một nguồn), mỗi thẻ dẫn tới đúng ưu đãi: `/promotions/?lang=vi#halloween`.
- **Sửa nội dung**: mở `/promotions/?edit` để thử chỉnh và xem trước (nút Sửa slide, Thêm slide, Xóa slide, ngăn "Dữ liệu…"). Bản sửa chỉ lưu trong trình duyệt của bạn; muốn đưa lên web thì tải bản sao lưu JSON ở "Dữ liệu…" rồi cập nhật `promos-data.js` và đẩy lên GitHub.
- Ảnh bảng của TMGM: `pics: [{ src: "img/xxx.png", alt }]`; chép ảnh vào `promotions/img/`.

## Liên hệ và chức danh

Tên, chức danh (Business Development), Telegram, WhatsApp ở `presenter` trong `content.js` và `contact` trong `promotions/promos-data.js`. Mã QR WhatsApp được vẽ từ số (`qr.js`), đổi số là QR đổi theo. Email nhận form liên hệ: `meta.contactEmail` (form mở bản nháp email, trang tĩnh không tự gửi được). Link đăng ký: `meta.register` (Global và Việt Nam).

## File

| File | Nội dung |
|---|---|
| `content.js` | Chữ (VI/EN/中文) và số công khai của trang pitch; các slide khóa chỉ còn nhãn |
| `calc.js` | Tính toán: máy tính MIB và IB mới, add-on ECN/swap, ưu đãi khác, bậc tùy chỉnh, so sánh |
| `dates.js` | Ngày làm việc, lịch nhận tiền, trạng thái ưu đãi theo ngày |
| `contact.js` | Kiểm tra form và dựng email nháp |
| `qr.js` | Mã QR vẽ offline (không thư viện) |
| `lock.js`, `locked.js` | Mở khóa bằng mã (xem trên) |
| `app.js`, `style.css`, `index.html` | Giao diện trang pitch |
| `promotions/` | Trang ưu đãi (`promos.js`, `promos-data.js`, `promos.css`, `promo-art.js`, `icons.js`, `edits*.js` chỉ nạp khi `?edit`) |
| `scripts/lock.mjs` | Tạo `locked.js` |
| `tests/` | Bộ test công khai |

## Đưa lên GitHub Pages

Repo `PipsAndPartners/pipsandpartners.github.io` (nhánh `main`), Pages phục vụ thẳng từ gốc repo — không có bước build. Trước khi đẩy:

1. `node scripts/lock.mjs` nếu đã sửa `private/locked-source.json`.
2. `node --test "tests/*.test.js"` phải xanh (có cả bài kiểm tra không lộ nội dung đã khóa).
3. `git status`: không được thấy `private/`, `PLAN_*.md`, `.claude/`.

## Ảnh (`img/`)

Thiếu file thì trang hiện khung placeholder ghi tên file cần thêm (huy hiệu giải thưởng thì tự ẩn, chân dung hiện chữ cái đầu). Chỉ dùng ảnh và logo trong phạm vi TMGM cho phép đối tác sử dụng; nguồn từng ảnh xem `private/README-chi-tiet-cu.md`.
