# p2p — web thay cho deck "Hợp tác IB/MIB cùng TMGM"

Trang tĩnh ba ngôn ngữ (English mặc định, Tiếng Việt, 繁體中文), chạy local, không cần build hay cài gì.

## Chạy

- Mở thẳng `index.html` bằng trình duyệt (chạy được cả offline, trừ font Be Vietnam Pro tải từ Google Fonts).
- Hoặc chạy server local:

```bash
python -m http.server 8765 --bind 127.0.0.1
```

rồi mở http://127.0.0.1:8765

## Test

```bash
node --test "tests/*.test.js"
```

Không cần cài thêm gì (chỉ cần Node). Bộ test gồm:

| File | Kiểm tra |
|---|---|
| `calc.test.js`, `addons.test.js` | Tính toán: máy tính MIB, ECN Q4, hoàn swap, bậc KM tùy chỉnh, so sánh 8 sàn, chi phí khách, Points, Cashback Q4 của khách |
| `dates.test.js` | Ngày làm việc, lịch nộp đơn và nhận tiền (T+1, thứ Tư, 5 ngày làm việc đầu tháng, 14 ngày làm việc) |
| `contact.test.js` | Kiểm tra phone/email, dựng email nháp, chống chèn header, giới hạn độ dài |
| `content.test.js` | Số liệu khớp tài liệu TMGM, link, đủ chữ vi/en/zh, các chỗ điền `{x}` khớp nhau |
| `render.test.js` | Giao diện bằng DOM giả: slide nào hiện, nút, form, add-on, bậc tùy chỉnh, menu, chi phí sau Points, Halloween tự ẩn (hôm nay cố định 9/10/2026) |
| `register.test.js` | 2 link đăng ký Global / Việt Nam, menu chọn ở header, gợi ý theo ngôn ngữ, khóa slide So sánh tới khi bấm Register |

## Điều khiển

| Việc | Cách |
|---|---|
| Chuyển slide | Nút "All slides" trên header mở danh sách 14 slide, hoặc thanh cuộn |
| Đổi ngôn ngữ EN / VI / 中文 | Nút trên header, phím `L` (xoay vòng), hoặc `?lang=vi` / `?lang=zh` |
| Đối tượng MIB / IB | Trong danh sách slide (hàng "Audience"), hoặc `?a=ib`. IB còn 12 slide, slide KM chỉ hiện KM tháng IB |
| Đăng ký | Header: nút "Register now ▾" mở menu chọn **Global** hoặc **Việt Nam**. Bìa, slide So sánh (khi khóa), slide cuối, footer: 2 nút "Register · Global" / "Register · Vietnam". Nút gợi ý tô đặc theo ngôn ngữ đang xem (VI → Việt Nam, EN/中文 → Global) |
| Trình bày | Nút ▶ trên header, phím `P`, hoặc `?present` |
| Khi trình bày | `→` / `PageDown` / `Space` tiếp · `←` / `PageUp` lùi · `N` lời thoại + đồng hồ · `F` toàn màn hình · `B` màn đen · `Esc` thoát · Không còn thanh footer che màn hình: chỉ cụm nút nhỏ mờ ở góc phải (lùi / số slide / tiến / thoát) |
| In ra PDF | Ctrl+P (A4 ngang, mỗi section một trang) |

Lựa chọn ngôn ngữ, đối tượng, bậc KM tùy chỉnh và việc đã bấm Register được nhớ trong trình duyệt.

## Thứ tự slide (MIB)

01 Bìa · 02 Pháp lý · 03 Năm dòng thu nhập · 04 Tài khoản · 05 ECN Q4 · 06 Cách tính ECN Q4 · 07 Lịch tiền về · 08 KM MIB / KM IB · 09 Hoàn swap · 10 Ví dụ · 11 So sánh 8 sàn · 12 Ưu đãi cho khách · 13 Ưu đãi khác · 14 Bắt đầu

Slide M1 (Hệ thống), M3 (Điều kiện), IB và Hỏi đáp đang ẩn (`hidden: true` trong `content.js`; xóa dòng đó để hiện lại).

## Các tính năng chính

- **Slide 2 (Pháp lý):** 4 nút Verify màu lime, mỗi nút mở trang tra cứu của một cơ quan (ASIC mở thẳng trang chi tiết TMGM). FSC Mauritius không có link thẳng nên nút copy sẵn chữ `Trademax` để dán vào ô tìm (có dòng hướng dẫn bên dưới). Ảnh Chelsea, Australian Open, AFF và huy hiệu giải thưởng bấm được.
- **Slide 6:** ba bước tính gấp trong một nút; máy tính mặc định 150K net deposit, 1.000 lot FX, 1.000 lot vàng. Ví dụ chính thức của TMGM (1.000/800 lot = 6.320 USD) giữ nguyên.
- **Slide 7 (Lịch tiền về):** chọn ngày giao dịch T, bật các khuyến mãi (add-on, mặc định tắt) để xem ngày nộp đơn và ngày nhận. Rebate cơ bản T+1 và hoàn swap tuần được đánh dấu "chờ TMGM xác nhận" vì chưa có trong tài liệu. Ngày chưa trừ ngày lễ.
- **Slide 8:** nút chuyển KM MIB | KM IB (chọn một trong hai theo điều khoản TMGM). Nút **Tùy chỉnh bậc** mở bảng sửa net deposit, lot, thưởng; thêm/xóa bậc; chọn bộ 5 bậc (PDF) hoặc 7 bậc (file khảo sát). Bậc sửa ở đây chảy sang máy tính slide 10 và slide So sánh.
- **Slide 4 (Tài khoản):** bảng rebate và chi phí khách (không trừ Points ở slide này). Cột "Hợp với": STD chỉ dành cho IB (khách trực tiếp), Prime cho nhóm IB (MIB chia rebate cho Sub-IB). Ghi chú chi phí nằm trong nút gập "Ghi chú chi phí".
- **Slide 10 và 11:** add-on ECN Q4 (chỉ Edge) và Hoàn swap, mặc định tắt. Slide 11 không tính hoàn swap vì khách của 5 sàn khác có thể dùng tài khoản swap-free. Dòng TMGM ở slide 11 ghi thêm chi phí khách sau Points; thu nhập MIB không đổi, chương trình điểm của sàn khác chưa trừ.
- **Slide 11 khóa tới khi bấm Register:** công cụ so sánh hiện mờ phía sau khung "Đăng ký để mở công cụ so sánh" (2 nút Global / Việt Nam). Bấm bất kỳ link đăng ký nào trên trang thì mở khóa ngay và nhớ trong trình duyệt (`localStorage` `mib-reg`). Muốn demo lại luồng này trên máy đã mở khóa: thêm `?lock` vào URL.
- **Slide 11, nút "Xếp hạng | Đối đầu":** mặc định là **Đối đầu**; "Xếp hạng" là bảng 10 sàn (8 sàn khảo sát + EC Markets, VT Markets lấy từ nguồn công khai, có nhãn "ước tính"; EC chưa công bố rebate IB nên hiện "Đang cập nhật"). "Đối đầu" đặt 2 vòng tròn cạnh nhau: TMGM (chọn 1 trong 5 tài khoản, ECN Q4 chỉ với Edge) và một sàn tùy chọn, mỗi bên khung nhập riêng (sàn kia sửa được rebate/lot và thêm "Thưởng thêm"; nút "Copy số từ TMGM"; lựa chọn **"Sàn khác (tự nhập số)"** cho nhập tên sàn, rebate và chi phí khách). Ở giữa là ô chênh lệch mỗi tháng; dưới vòng tròn sàn kia là hồ sơ năng lực (giấy phép, tài khoản, chương trình IB) và nguồn. Logic ở `headToHead`, `donutArcs` trong `calc.js`. Nút gập "Ghi chú và nguồn" chứa câu swap, Points, các mục chưa tính và nguồn.
- **Nút gập** (Ghi chú chi phí, Ai được tham gia, Thanh toán, Ví dụ mẫu, Ghi chú và nguồn, cách tính 3 bước): dạng thẻ trắng có icon và mũi tên, mặc định đóng; in PDF thì tự mở.
- **Slide 03:** hàng ô "Ngoài 5 dòng chính" (Ưu đãi nhỏ / Marketing / Chỉ chia sẻ riêng, số đếm theo ưu đãi đang chạy); bấm ô thì sang slide 13 với bộ lọc tương ứng.
- **Slide 12 (Ưu đãi cho khách):** thẻ TMGM Points (bảng đổi cashback), thẻ Cashback Q4 (4 bậc lũy kế, tối đa 500 USD/khách) và máy tính "Khách nhận lại bao nhiêu" (mặc định 10.000 USD, 170 lot → 500 + 85 = 585 USD). Cashback Q4 chỉ cho khách đã nạp trước 01/10/2026 (bản khách mới không có VN). Dòng thu nhập 5 ở slide 3 trỏ tới slide này; cuối slide có link sang "Ưu đãi khác".
- **Slide 13 (Ưu đãi khác):** gom ưu đãi nhỏ (Halloween, 50% Credit, Gadget Q4, Rocket, Welcome Back) và marketing (Win Your Ride, Jay Chou; 3 loại vé chỉ chia sẻ riêng) thành các dòng gập, mặc định đóng. Bộ lọc Tất cả / Ưu đãi nhỏ / Marketing. Mục "chỉ chia sẻ riêng" ẩn sau nút, có cảnh báo và không in ra PDF. Nhãn hạn: "đến …", dưới 30 ngày "còn N ngày" màu cam, dưới 7 ngày màu đỏ; hết hạn (`until`) thì tự ẩn. Không mục nào được cộng vào máy tính hay biểu đồ. Dữ liệu ở `extraPromos` trong `content.js`.
- **Slide 14:** form liên hệ. Bấm Gửi sẽ mở **bản nháp email** tới `meta.contactEmail` (có sẵn tên, điện thoại, email, ghi chú và số đối tác đã nhập ở máy tính); người dùng bấm Gửi trong app email. Trang chạy local nên không tự gửi được.

## File

| File | Nội dung |
|---|---|
| `content.js` | Toàn bộ chữ (VI/EN/中文), số liệu, link đăng ký, email nhận liên hệ, thông tin trình bày. Cập nhật hàng tháng chỉ sửa file này |
| `calc.js` | Tính toán: máy tính MIB, add-on ECN/swap, bậc tùy chỉnh, so sánh |
| `dates.js` | Ngày làm việc và lịch nhận tiền |
| `contact.js` | Kiểm tra form và dựng email nháp |
| `app.js` | Render các slide, tương tác, chế độ trình bày |
| `style.css` | Bộ nhận diện, layout, responsive, bản in |
| `tests/` | Bộ test (xem trên) |

## Cập nhật số liệu kỳ mới

1. Sửa `meta.period`, `meta.validUntil`, `ecn.period` và các bảng (`mibTiers`, `ibTiers`, `swapTiers`, `ecn`, `accounts`, `points`, `clientCashback`, `extraPromos`...) trong `content.js`. Mục `extraPromos` hết hạn tự ẩn, chỉ cần thêm mục mới. Bậc KM cũng sửa nhanh được ngay trên web bằng nút "Tùy chỉnh bậc".
2. Sửa các câu có số trong chuỗi `T(vi, en, zh)` nếu số đổi.
3. Chạy test. Banner vàng "số liệu đã hết hạn" tự tắt khi hôm nay ≤ `meta.validUntil`.

`meta.showInternal` mặc định `false`: slide KM MIB chỉ hiện cột KM MIB. Chỉ bật `true` khi TMGM đã cho phép chia sẻ quy tắc "gộp nhánh, lot +50%" với đối tác.

Link đăng ký ở `meta.register` (`global`: portal tiếng Anh, `vn`: portal tiếng Việt); email nhận liên hệ ở `meta.contactEmail`; tên, Telegram, WhatsApp ở `presenter`. `meta.today` (YYYY-MM-DD) để trống = dùng ngày máy; chỉ đặt khi cần cố định ngày (test).

## Ảnh (thư mục `img/`)

Thiếu file thì trang hiện khung placeholder ghi tên file cần thêm (huy hiệu giải thưởng thì tự ẩn, chân dung hiện chữ cái đầu).

| File | Nguồn | Ghi chú |
|---|---|---|
| `logo-tmgm-white.webp`, `logo-tmgm.webp` | CDN của TMGM | Logo trắng đã bỏ dòng khẩu hiệu; bản nền trắng tạo từ logo trắng, giữ màu đỏ/xanh lá |
| `chelsea.webp` | tmgm.com, key visual TMGM x Chelsea 2026 | Bấm vào ảnh mở bài trên chelseafc.com |
| `australian-open.webp` | Ảnh cúp do Precy gửi | Chưa rõ nguồn: nên xác nhận quyền sử dụng. Bấm vào ảnh mở bài trên ausopen.com |
| `aff-cup.webp` | Wikimedia Commons, Louis Anderson, CC BY-SA 4.0 | Ảnh minh họa SVĐ Mỹ Đình (chung kết SEA Games 2022, không phải AFF Cup), có dòng ghi nguồn trên ảnh |
| `award.webp` | tmgm.com/achievement, Brokersview Best Multi-Asset Broker APAC 2024 | |
| `tmgm-app.webp` | tmgm.com, ảnh chụp TMGM App chính thức | Hiện không còn dùng (đã bỏ khỏi slide Lịch tiền về) |
| `ib-strip.webp` | Wikimedia Commons, lumoplank, CC0 | Hiện không còn dùng vì slide IB đang ẩn |
| `qr-telegram.png`, `qr-whatsapp.png` | Tự tạo | QR tới t.me/guowang26 và wa.me/61410678015 |
| `presenter.webp` | **Chưa có** | Ảnh chân dung của Precy (vuông, ≥ 400 px). Thiếu thì hiện chữ "PG" |

Chỉ dùng ảnh và logo trong phạm vi TMGM cho phép đối tác sử dụng.
