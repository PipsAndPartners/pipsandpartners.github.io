/*
 * Nội dung trang pitch "Hợp tác IB/MIB cùng TMGM" — ba ngôn ngữ: Tiếng Việt, English (mặc định), 繁體中文.
 * Nguồn: doc "Kế hoạch nội dung slide: Hợp tác IB/MIB cùng TMGM" (07/10/2026)
 *        và "TMGM 2026 Q4 ECN/EDGE IB Special Promotion" (EN + 中繁).
 *
 * Cập nhật hàng tháng (khi TMGM ra KM mới):
 *   1. Sửa meta.period, meta.validUntil và các bảng số bên dưới (mibTiers, swapTiers, ecn, ib...).
 *   2. Sửa các câu có số trong chuỗi T(vi, en, zh) nếu số đổi (tìm "USD" / "美元").
 *   3. Chạy: node --test "tests/*.test.js"
 *   4. Mở lại index.html. Banner "hết hạn" tự tắt khi hôm nay <= meta.validUntil.
 *
 * Mỗi chuỗi hiển thị là T(vi, en, zh). Chuỗi khác nhau theo đối tượng dùng { mib: T(...), ib: T(...) }.
 */
(function () {
  const T = (vi, en, zh) => ({ vi, en, zh });

  const MIB5 = [
    { deposit: 50000, lots: 375, mib: 1300, ibCombined: 900 },
    { deposit: 100000, lots: 750, mib: 3000, ibCombined: 2000 },
    { deposit: 170000, lots: 1200, mib: 6000, ibCombined: 3800 },
    { deposit: 340000, lots: 2400, mib: 12900, ibCombined: 8500 },
    { deposit: 500000, lots: 3300, mib: 20000, ibCombined: 15000 },
  ];

  window.MIB = {
    meta: {
      period: T("T10/Q4 2026", "Oct/Q4 2026", "2026年10月 / Q4"),
      validUntil: "2026-10-31",
      ecnQ4End: "2026-12-31",
      entityVN: "Trademax Global Limited (VFSC 40356)",
      // Link đăng ký đối tác: Global (portal tiếng Anh) và Việt Nam (portal tiếng Việt). Bấm link nào cũng mở khóa slide So sánh.
      register: {
        global: "https://portal.tmgm.com/register?sales=NzAwMV9QcmVjeVZ1b25n&language=en",
        vn: "https://portal.tmgm.com/register?sales=NzAwMV9QcmVjeVZ1b25n&language=vi",
      },
      // Form liên hệ ở slide cuối: bản nháp email mở tới địa chỉ này (trang chạy local, không tự gửi được).
      contactEmail: "precy.vuong@tmgm.com",
      // Quy tắc "gộp nhánh, lot +50%" bị đánh dấu Internal: chỉ bật khi TMGM đã cho phép chia sẻ với đối tác.
      showInternal: false,
    },

    presenter: {
      name: "Precy Guo",
      title: T("Account Manager · TMGM", "Account Manager · TMGM", "客戶經理 · TMGM"),
      telegram: "guowang26",
      whatsapp: "+61 410 678 015",
      whatsappLink: "61410678015",
    },

    ui: {
      docTitle: T("TMGM · Hợp tác MIB/IB", "TMGM · MIB/IB Partnership", "TMGM · MIB/IB 合作計劃"),
      brandSub: T("Hợp tác MIB/IB · Q4/2026", "MIB/IB Partnership · Q4 2026", "MIB/IB 合作 · 2026 Q4"),
      present: T("Trình bày", "Present", "簡報模式"),
      register: T("Đăng ký ngay", "Register now", "立即註冊"),
      reg: {
        choose: T("Chọn nơi đăng ký", "Choose where to register", "選擇註冊入口"),
        global: T("Global", "Global", "全球"),
        vn: T("Việt Nam", "Vietnam", "越南"),
        globalSub: T("Portal tiếng Anh · ngoài Việt Nam", "English portal · outside Vietnam", "英文入口 · 越南以外"),
        vnSub: T("Portal tiếng Việt · tại Việt Nam", "Vietnamese portal · in Vietnam", "越南文入口 · 越南境內"),
        btn: T("Đăng ký · {r}", "Register · {r}", "註冊 · {r}"),
        suggested: T("Gợi ý", "Suggested", "建議"),
        newTab: T("mở tab mới", "opens in a new tab", "於新分頁開啟"),
        gateTitle: T("Đăng ký để mở công cụ so sánh", "Register to unlock the comparison", "註冊後即可使用比較工具"),
        gateText: T(
          "Bấm một trong hai nút để mở trang đăng ký TMGM ở tab mới. Công cụ so sánh mở ngay sau đó và được ghi nhớ trên trình duyệt này.",
          "Click either button to open the TMGM sign-up page in a new tab. The comparison unlocks right away and stays unlocked in this browser.",
          "點擊任一按鈕，即在新分頁開啟 TMGM 註冊頁。比較工具會立即開啟，並在此瀏覽器中保持開啟。"
        ),
        unlocked: T("Đã mở công cụ so sánh ở slide So sánh", "Comparison unlocked on the Compare slide", "「比較」頁的比較工具已開啟"),
      },
      menu: T("Danh sách slide", "All slides", "全部頁面"),
      verifyOn: T("Verify trên {r}", "Verify on {r}", "前往 {r} 查核"),
      verifyOnCopy: T("Copy tên & Verify trên {r}", "Copy name & Verify on {r}", "複製名稱並前往 {r} 查核"),
      contact: {
        title: T("Để lại thông tin, Precy sẽ liên hệ", "Leave your details and Precy will get back to you", "留下聯絡方式，Precy 會與您聯繫"),
        intro: T(
          "Điền điện thoại và email. Bấm gửi sẽ mở bản nháp email tới {to}, bạn chỉ cần bấm Gửi trong email.",
          "Add your phone and email. Send opens an email draft to {to}; just press Send in your email app.",
          "填寫電話與電子郵件。按送出會開啟寄給 {to} 的郵件草稿，您只需在郵件程式中按「傳送」。"
        ),
        name: T("Họ tên (tùy chọn)", "Name (optional)", "姓名（選填）"),
        phone: T("Điện thoại", "Phone", "電話"),
        email: T("Email", "Email", "電子郵件"),
        note: T("Giờ muốn hẹn / lời nhắn (tùy chọn)", "Preferred time / message (optional)", "希望會面時間／留言（選填）"),
        send: T("Gửi yêu cầu", "Send request", "送出申請"),
        required: T("Bắt buộc nhập", "Required", "必填"),
        badPhone: T("Số điện thoại chưa đúng (8–15 chữ số, có thể bắt đầu bằng +)", "Check the phone number (8–15 digits, may start with +)", "電話號碼格式不正確（8–15 位數字，可用 + 開頭）"),
        badEmail: T("Email chưa đúng", "Check the email address", "電子郵件格式不正確"),
        ok: T(
          "Đã mở email với bản nháp gửi tới {to}. Bấm Gửi trong ứng dụng email để hoàn tất.",
          "Your email app opened with a draft to {to}. Press Send there to finish.",
          "已開啟電子郵件程式並帶入寄給 {to} 的草稿，請在郵件程式中按「傳送」完成。"
        ),
        fallback: T("Không thấy email mở ra? Gửi thông tin trực tiếp tới {to}.", "No email window? Write to {to} directly.", "沒有開啟郵件視窗？請直接寄信至 {to}。"),
      },
      audience: T("Đối tượng", "Audience", "對象"),
      language: T("Ngôn ngữ", "Language", "語言"),
      expired: T(
        "Số liệu KM kỳ {p} đã hết hạn ngày {d}. Cập nhật content.js trước khi pitch.",
        "The {p} promo figures expired on {d}. Update content.js before pitching.",
        "{p} 的活動數據已於 {d} 到期，簡報前請更新 content.js。"
      ),
      dismiss: T("Ẩn", "Dismiss", "隱藏"),
      countdown: T("ECN Q4 còn {n} ngày", "Q4 ECN boost: {n} days left", "ECN Q4 加碼剩餘 {n} 天"),
      risk: T(
        "Giao dịch CFD có rủi ro cao, có thể mất nhiều hơn số tiền nạp. Số liệu là ví dụ minh họa, không phải cam kết thu nhập. Khách hàng Việt Nam: Trademax Global Limited (VFSC 40356).",
        "CFD trading is high risk; you can lose more than you deposit. Figures are illustrative, not an income guarantee. Vietnamese clients: Trademax Global Limited (VFSC 40356).",
        "差價合約（CFD）交易風險高，虧損可能超過入金。數據僅為示例，並非收入承諾。越南客戶：Trademax Global Limited（VFSC 40356）。"
      ),
      notes: T("Lời thoại", "Speaker notes", "講稿"),
      keys: T(
        "← → chuyển · N lời thoại · F toàn màn hình · B màn đen · L ngôn ngữ · Esc thoát",
        "← → navigate · N notes · F fullscreen · B blank · L language · Esc exit",
        "← → 切換 · N 講稿 · F 全螢幕 · B 黑屏 · L 語言 · Esc 退出"
      ),
      elapsed: T("Đã nói", "Elapsed", "已用時間"),
      budget: T("Ngân sách", "Budget", "建議時長"),
      minutes: T("phút", "min", "分鐘"),
      prev: T("Trước", "Previous", "上一頁"),
      next: T("Tiếp", "Next", "下一頁"),
      footerPeriod: T("Số liệu kỳ {p} · Nguồn: tài liệu đối tác TMGM", "Figures: {p} · Source: TMGM partner materials", "數據期間：{p} · 來源：TMGM 合作夥伴資料"),
      verify: T("tra cứu", "verify", "查核"),
      copied: T("Đã copy “{v}” — dán vào ô tìm kiếm", "Copied “{v}” — paste it into the search box", "已複製「{v}」，請貼到搜尋欄"),
      searchFor: T("Tìm: “{v}”", "Search for: “{v}”", "請搜尋：「{v}」"),
      see: T("Xem", "See", "查看"),
      illustrative: T("Ví dụ minh họa, không phải cam kết thu nhập", "Illustrative example, not an income guarantee", "僅為示例，並非收入承諾"),
      supportTitle: {
        mib: T("Đồng hành cùng MIB", "Supporting your MIB business", "全程支援您的 MIB 業務"),
        ib: T("Đồng hành cùng IB", "Supporting your IB business", "全程支援您的 IB 業務"),
      },
      tableData: T("Bảng số liệu", "Data table", "數據表"),
    },

    // Thời lượng từng phần (phút) — hiện trong bảng lời thoại khi trình bày.
    parts: {
      common: { label: T("Phần chung", "Core", "核心內容"), min: 10 },
      mib: { label: T("Trọng tâm MIB", "MIB focus", "MIB 重點"), min: 11 },
      ib: { label: T("IB", "IB", "IB"), min: 2 },
      close: { label: T("Phần kết", "Close", "結尾"), min: 3 },
      qa: { label: T("Hỏi đáp", "Q&A", "問答"), min: 6 },
    },

    support: [
      { icon: "headset", label: T("AM riêng", "Dedicated AM", "專屬客戶經理") },
      { icon: "file", label: T("Marketing tiếng Việt", "Vietnamese marketing kit", "越南語行銷素材") },
      { icon: "monitor", label: T("Hội thảo trực tuyến hàng tháng", "Monthly webinars", "每月線上研討會") },
      { icon: "gift", label: T("Ưu đãi cho khách", "Client offers", "客戶優惠") },
    ],

    // ---------- Bảng số liệu (dùng cho bảng, biểu đồ, máy tính) ----------

    accounts: [
      {
        name: "Edge", fx: 2, gold: 2, fxQ4: "3–5", goldQ4: T("2,5–3,5", "2.5–3.5", "2.5–3.5"), costFx: 7, costGold: 15, q4: true,
        fit: ["zap", "robot"], fitText: T("Scalper, EA, khối lượng lớn", "Scalpers, EAs, high volume", "剝頭皮、EA、大交易量"),
      },
      { name: "Classic", fx: 4, gold: 4, costFx: 9, costGold: 17, fit: ["chart"], fitText: T("Trader chủ động, nhạy chi phí", "Active, cost-sensitive traders", "活躍、重視成本的交易者") },
      { name: "Prime", fx: 7, gold: 10, costFx: 12, costGold: 24, fit: ["users"], fitText: T("Nhóm IB: MIB chia rebate cho Sub-IB", "IB groups: MIBs sharing rebates with Sub-IBs", "IB 團隊：MIB 與子代理分潤") },
      { name: "STD", fx: 10, gold: 20, costFx: 18, costGold: 33, fit: ["user"], fitText: T("Chỉ dành cho IB (khách trực tiếp)", "IBs only (direct clients)", "僅限 IB（直客）") },
      { name: "STD05", fx: 15, gold: 23, costFx: 22, costGold: 36, fit: ["hourglass"], fitText: T("Giao dịch thưa, giữ lệnh dài", "Infrequent traders, long holds", "交易頻率低、長期持倉") },
    ],

    // TMGM 2026 Q4 ECN/EDGE IB Special Promotion (1/10–31/12/2026), nhóm RAW07/EDGE.
    // Mức rebate = base × (1 + up%). Dầu thô và chỉ số giữ 1,5 USD/lot (không tăng).
    ecn: {
      base: { fx: 2, gold: 2 },
      oil: 1.5,
      index: 1.5,
      tiers: [
        { min: 5000, max: 49999, fxUp: 50, goldUp: 25 },
        { min: 50000, max: 99999, fxUp: 80, goldUp: 35 },
        { min: 100000, max: 199999, fxUp: 100, goldUp: 45 },
        { min: 200000, max: 399999, fxUp: 150, goldUp: 55 },
        { min: 400000, max: null, fxUp: 150, goldUp: 75 },
      ],
      // Kỳ khuyến mãi (dùng cho lịch nhận tiền và để biết khi nào hết hiệu lực)
      period: { from: "2026-10-01", to: "2026-12-31" },
      // Số mặc định của máy tính ở slide Cách tính Q4
      defaults: { deposit: 150000, lotsFx: 1000, lotsGold: 1000 },
      // Ví dụ chính thức trong tài liệu TMGM (mục 5): 150K net deposit, 1.000 lot FX, 800 lot vàng → tổng 6.320 USD (không đổi)
      example: { deposit: 150000, lotsFx: 1000, lotsGold: 800 },
    },

    // KM đặc biệt MIB (T10/2026, PDF "October VN MIB Special Promotions"; số giống T9) so với KM IB gộp nhánh (lot +50%) — cùng ngưỡng net deposit và lot.
    // Người dùng sửa được bậc trên web (nút "Tùy chỉnh bậc"); đây là bộ mặc định.
    mibTiers: MIB5,
    // Bộ bậc có sẵn để chọn nhanh: 5 bậc theo PDF, hoặc 7 bậc theo file khảo sát đối thủ (thêm 2 bậc nhỏ 17K và 34K).
    mibTierPresets: {
      pdf5: MIB5,
      research7: [{ deposit: 17000, lots: 140, mib: 300 }, { deposit: 34000, lots: 255, mib: 700 }, ...MIB5],
    },
    // KM tháng IB (T10/2026, PDF "October VN IB Promotions"; số giống T9; nộp đơn qua AM trước ngày 7 tháng sau): chỉ tính khách trực tiếp; cần ≥ 5 khách kích hoạt, trong đó ≥ 3 khách hoạt động
    ibTiers: [
      { deposit: 17000, lots: 85, reward: 260 },
      { deposit: 34000, lots: 170, reward: 580 },
      { deposit: 50000, lots: 250, reward: 900 },
      { deposit: 100000, lots: 500, reward: 2000 },
      { deposit: 170000, lots: 800, reward: 3800 },
      { deposit: 340000, lots: 1600, reward: 8500 },
      { deposit: 500000, lots: 2200, reward: 15000 },
    ],

    // Hoàn Swap hàng tháng (chính sách IB): ngưỡng net deposit của khách trực tiếp
    swapTiers: [
      { pct: 30, ib: 5000 },
      { pct: 40, ib: 10000 },
      { pct: 50, ib: 30000 },
    ],

    // Ví dụ M5 (share = % rebate MIB chia cho Sub-IB)
    example: { lotsFx: 1000, lotsGold: 1400, account: "Prime", share: 70, deposit: 340000, subIBs: 5 },

    payouts: [
      { key: "base", icon: "coins", name: T("Rebate cơ bản", "Base rebate", "基本返傭"), how: T("Trả mỗi ngày làm việc · lệnh thứ Sáu về thứ Hai", "Paid every working day · Friday trades arrive Monday", "每個工作日發放 · 週五交易於週一到帳"), when: T("T+1, không tính T7–CN", "T+1, excluding weekends", "T+1，不含週末") },
      { key: "wed", icon: "moon", name: T("Hoàn Swap tuần", "Weekly swap rebate", "每週隔夜利息返還"), how: T("AM đăng ký, bộ phận BO xử lý", "AM registers, back office processes", "AM 申請，後台處理"), when: T("Mỗi thứ Tư", "Every Wednesday", "每週三") },
      { key: "day13", icon: "calendar", name: T("Hoàn Swap tháng", "Monthly swap rebate", "每月隔夜利息返還"), how: T("AM đăng ký", "AM registers", "AM 申請"), when: T("Trước ngày 14 hàng tháng", "Before the 14th of each month", "每月 14 日前") },
      { key: "bd5", icon: "zap", name: T("Tăng rebate ECN Q4", "Q4 ECN rebate boost", "ECN Q4 返傭加碼"), how: T("Tự động, không cần đăng ký", "Automatic, no sign-up", "自動發放，無需申請"), when: T("5 ngày làm việc đầu tháng", "First 5 working days of the month", "每月前 5 個工作日") },
      { key: "bonus", icon: "trophy", name: T("Thưởng tháng MIB/IB", "MIB/IB monthly bonus", "MIB/IB 月度獎金"), how: T("Nộp đơn qua AM", "Claim via your AM", "透過 AM 申請"), when: T("Trong 14 ngày làm việc sau khi duyệt", "Within 14 working days of approval", "審核通過後 14 個工作日內") },
      { key: "gift", icon: "gift", name: T("Ưu đãi cho khách: Cashback Q4 + Points", "Client offers: Q4 cashback + Points", "客戶優惠：Q4 現金回贈 + 點數"), how: T("Khách tự đổi trên Portal", "Clients redeem on the Portal", "客戶在 Portal 自行兌換"), when: T("Cashback: ngay khi đổi · Points: về ví hôm sau", "Cashback: as soon as redeemed · Points: in the wallet next day", "現金回贈：兌換即入帳 · 點數：次日入點數錢包") },
    ],

    // ---------- Ưu đãi cho khách (khách nhận, không phải thu nhập đối tác) ----------
    // TMGM Points Rewards (FAQ): 10 điểm / lot chuẩn. FX, vàng 1:1; chỉ số, dầu, crypto 10:1; cổ phiếu không tính; lệnh giữ ≥ 2 phút.
    // Tính theo portal, về ví điểm hôm sau, không hết hạn. Luôn bật nên MẶC ĐỊNH trừ vào chi phí khách (slide Tài khoản, So sánh).
    // Giá đổi cashback: ảnh chụp trang TMGM Rewards 9/10/2026. Món 50/100/150/250 USD chưa thấy số điểm: thêm vào `cashback` khi có.
    // refUsd = món dùng để quy đổi điểm ra USD/lot: 600 điểm = 30 USD → 10 × 30 / 600 = 0,5 USD/lot.
    // Giá mỗi USD giảm dần theo món (26 → 20 điểm/USD), nên 0,5 là mức thận trọng cho khách đổi món lớn hơn.
    points: {
      perLot: 10,
      refUsd: 30,
      cashback: [{ usd: 5, pts: 130 }, { usd: 10, pts: 240 }, { usd: 20, pts: 450 }, { usd: 30, pts: 600 }],
    },
    // 2026 Q4 Client Cashback Promotion (SEA + Korea): nạp 1/10–31/12/2026, lot tính tới 31/3/2027.
    // Bậc LŨY KẾ: net deposit + lot lũy kế → cashback lũy kế, tối đa 500 USD/khách. Lot quy đổi như Points.
    // Ví dụ D trong T&C (3.000 USD "bậc 3") mâu thuẫn với bảng (bậc 3 = 6.000 USD): trang theo bảng, vì bảng là điều khoản chính.
    clientCashback: {
      period: { from: "2026-10-01", to: "2026-12-31", lotsTo: "2027-03-31" },
      tiers: [
        { deposit: 1000, lots: 20, total: 50 },
        { deposit: 3000, lots: 55, total: 150 },
        { deposit: 6000, lots: 105, total: 300 },
        { deposit: 10000, lots: 170, total: 500 },
      ],
      defaults: { deposit: 10000, lots: 170 },
    },
    // ---------- Ưu đãi khác (slide "km-khac"): ưu đãi nhỏ và marketing, áp dụng VN, gập mặc định ----------
    // Nguồn: TMGM Sales Zendesk, Weekly Update 28/09–04/10/2026, PDF từng chương trình (kiểm tra 09/10/2026).
    // group: "small" (lợi ích bằng tiền nhưng hẹp/một lần) | "marketing" (quà, bốc thăm, vé).
    // share: "private" = chỉ chia sẻ riêng (không đăng mạng xã hội): ẩn mặc định, không in.
    // from/until (YYYY-MM-DD, giờ MT4/MT5): hết "until" thì tự ẩn. Không mục nào được cộng vào máy tính/biểu đồ.
    extraPromos: [
      {
        key: "halloween", group: "small", share: "public", icon: "user-plus", from: "2026-10-05", until: "2026-11-05",
        url: "https://lnd.tmgm-apac.com/en/halloween",
        name: T("Halloween Quest", "Halloween Quest", "萬聖節任務"),
        value: T("Credit 30% FTD (tối đa 200 USD); đoán đúng sản phẩm bí ẩn: 100% (tối đa 1.000 USD)", "30% credit on the FTD (max USD 200); 100% for picking the Mystery Product (max USD 1,000)", "首入金 30% 贈金（最高 200 美元）；猜中神秘產品 100%（最高 1,000 美元）"),
        seg: T("Khách mới", "New clients", "新客戶"),
        rules: [
          T("FTD ≥ 50 USD trong kỳ và giao dịch ≥ 0,01 lot (trừ cổ phiếu); sản phẩm giao dịch đầu tiên quyết định nhiệm vụ", "FTD ≥ USD 50 in the period and trade ≥ 0.01 lot (shares excluded); the first product traded decides the quest", "期間內首次入金 ≥ 50 美元並交易 ≥ 0.01 手（股票除外）；首個交易產品決定任務"),
          T("Khách chưa có tài khoản đăng ký qua trang chương trình; tài khoản có sẵn nhưng chưa FTD thì nhờ AM", "Clients without an account register via the promotion page; existing accounts without an FTD go through their AM", "未開戶客戶經活動頁註冊；已開戶未首存的客戶請 AM 協助"),
          T("Cuối kỳ: net deposit ≥ FTD và equity ≥ 30 USD; credit về trước 11/12/2026", "At the end: net deposit ≥ FTD and equity ≥ USD 30; credit lands by 11 Dec 2026", "結束時：淨入金 ≥ 首入金且淨值 ≥ 30 美元；贈金於 2026/12/11 前發放"),
        ],
        note: T(
          "Credit bonus, mỗi khách một lần. Khách từng nhận bất kỳ credit bonus nào (kể cả 50% Credit) không tham gia. T&C đầy đủ gửi sau; xác nhận nước đủ điều kiện với AM.",
          "Credit bonus, once per client. Clients who've had any credit bonus (including the 50% Credit) can't join. Full T&Cs to follow; confirm country eligibility with your AM.",
          "贈金，每位客戶限一次。曾領取任何贈金（含 50% 贈金）的客戶不可參加。完整條款稍後公布；請向 AM 確認國家資格。"
        ),
      },
      {
        key: "credit50", group: "small", share: "public", icon: "coins", from: "2026-10-01", until: "2026-12-31",
        url: "https://lnd.tmgm.com/en/deposit_bonus",
        name: T("50% Credit Q4", "Q4 50% Credit", "Q4 50% 贈金"),
        value: T("Credit 50% khoản nạp mới, tối đa 10.000 USD/tài khoản", "50% credit on new deposits, up to USD 10,000 per account", "新入金 50% 贈金，每個帳戶最高 10,000 美元"),
        seg: T("Khách mới và cũ", "New and existing", "新舊客戶"),
        rules: [
          T("Nạp mới tối thiểu 500 USD; mỗi khoản nạp mới xin credit riêng", "New deposit of at least USD 500; each new deposit is applied for separately", "新入金至少 500 美元；每筆新入金分別申請"),
          T("Xin qua AM hoặc email support@tmgm.com từ email đã đăng ký (tiêu đề: số tài khoản + “Request 50% bonus”); credit thường về trong 1 ngày làm việc", "Apply via the AM or email support@tmgm.com from the registered address (subject: account number + “Request 50% bonus”); credit usually lands within 1 business day", "透過 AM 或以註冊郵箱發信至 support@tmgm.com 申請（主旨：帳號 +「Request 50% bonus」）；贈金通常 1 個工作日內入帳"),
          T("Credit chỉ dùng làm margin: không rút, không bù lỗ hay phí; rút tiền hoặc chuyển nội bộ thì credit bị trừ theo tỷ lệ", "Credit is margin only: not withdrawable, doesn't absorb losses or costs; withdrawals or internal transfers reduce it proportionally", "贈金僅作保證金：不可提取，不可抵扣虧損或費用；出金或內部轉帳將按比例扣減"),
          T("Không áp dụng khách ASIC; tài khoản còn bonus 30% phải dùng hết hoặc xin trên tài khoản khác", "Not for ASIC clients; accounts still holding a 30% bonus must use it up or apply on another account", "不適用 ASIC 客戶；仍有 30% 贈金餘額的帳戶須先用完或改用其他帳戶申請"),
        ],
        note: T(
          "Khách nhận credit này sẽ không tham gia được Halloween Quest. Credit bị xóa nếu tổng equity dưới 30 USD và 30 ngày không nạp, rút hay giao dịch.",
          "Clients who take this credit can't join Halloween Quest. Credit is cleared if total equity is below USD 30 with no deposit, withdrawal or trade for 30 days.",
          "領取此贈金的客戶不可參加萬聖節任務。若總淨值低於 30 美元且 30 天內無入金、出金或交易，贈金將被清除。"
        ),
      },
      {
        key: "gadget", group: "small", share: "public", icon: "gift", from: "2026-10-01", until: "2026-12-31",
        url: "https://lnd.tmgm.com/en/ultimate-gadget-rewards",
        name: T("Ultimate Gadget Rewards Q4", "Ultimate Gadget Rewards Q4", "Q4 終極數碼獎賞"),
        value: T("Apple Watch → MacBook Pro, hoặc nhận 70% giá trị bằng tiền", "Apple Watch → MacBook Pro, or 70% of the value in cash", "Apple Watch → MacBook Pro，或領取 70% 現金價值"),
        seg: T("Khách mới và cũ", "New and existing", "新舊客戶"),
        // [net deposit USD, lot chuẩn, quà, encash 70% USD] theo bảng mục 4 PDF Q4
        table: {
          cols: [T("Net deposit", "Net deposit", "淨入金"), T("Lot", "Lots", "手數"), T("Quà", "Gadget", "獎品"), T("Hoặc 70%", "Or 70%", "或 70%")],
          rows: [
            [10000, 150, "Apple Watch Series 12", 401.1],
            [20000, 250, "iPad Air 13\"", 825.3],
            [30000, 350, "iPhone 18 Pro 512 GB", 1206.8],
            [40000, 450, "iPhone 18 Pro Max 512 GB", 1292.2],
            [60000, 650, "iPhone Duo 512 GB", 1864.8],
            [80000, 850, "MacBook Pro 16\" M5 Max", 3285.8],
          ],
        },
        rules: [
          T("Đăng ký trên Portal → Promotions trước khi nạp; nạp xong trước 31/12/2026, lot được thêm tới 31/01/2027", "Register on Portal → Promotions before depositing; deposits by 31 Dec 2026, lots may continue until 31 Jan 2027", "入金前先在 Portal → 活動頁報名；入金須於 2026/12/31 前完成，手數可延至 2027/1/31"),
          T("Đạt cả net deposit lẫn lot của bậc; chọn quà hoặc tiền một lần, không đổi sau khi chọn", "Both the net deposit and lots of a tier must be met; gift or cash is chosen once and can't be changed", "須同時達到該級淨入金與手數；獎品或現金僅可選一次，選定後不可更改"),
          T("Lot: FX, vàng 1:1; chỉ số, dầu, crypto 10:1; cổ phiếu không tính; lệnh giữ ≥ 2 phút; không áp dụng khách ASIC", "Lots: FX, gold 1:1; indices, oil, crypto 10:1; shares excluded; trades held ≥ 2 minutes; not for ASIC clients", "手數：外匯、黃金 1:1；股指、原油、加密貨幣 10:1；股票不計；持倉 ≥ 2 分鐘；不適用 ASIC 客戶"),
        ],
        note: T(
          "T&C ghi 70% của iPhone 18 Pro Max là 1.292,20 USD, trong khi 70% × 1.845 = 1.291,50: chờ TMGM xác nhận.",
          "The T&C lists USD 1,292.20 as 70% for iPhone 18 Pro Max, while 70% × 1,845 = 1,291.50: awaiting TMGM confirmation.",
          "條款列出 iPhone 18 Pro Max 的 70% 為 1,292.20 美元，但 70% × 1,845 = 1,291.50：待 TMGM 確認。"
        ),
      },
      {
        key: "rocket", group: "small", share: "public", icon: "zap", from: "2026-07-26", until: "2026-12-31",
        name: T("Rocket Your Trading Start", "Rocket Your Trading Start", "Rocket Your Trading Start"),
        value: T("Cashback 20 USD", "USD 20 cashback", "20 美元現金回贈"),
        seg: T("Khách mới", "New clients", "新客戶"),
        rules: [
          T("Khách chưa từng nạp trước 26/07/2026; bấm Sign in ở Portal → Promotions trước khi nạp", "Clients with no deposit before 26 Jul 2026; click Sign in on Portal → Promotions before depositing", "2026/7/26 前未曾入金的客戶；入金前在 Portal → 活動頁點擊 Sign in"),
          T("FTD ≥ 50 USD và giao dịch 5 lot BTCUSD (= 0,5 lot chuẩn); chỉ tính BTCUSD, lệnh giữ ≥ 2 phút", "FTD ≥ USD 50 and 5 lots of BTCUSD (= 0.5 standard lots); BTCUSD only, trades held ≥ 2 minutes", "首次入金 ≥ 50 美元並交易 5 手 BTCUSD（= 0.5 標準手）；僅計 BTCUSD，持倉 ≥ 2 分鐘"),
          T("Không dùng chung nạp hay lot với khuyến mãi khác", "Deposits and lots can't be shared with other promotions", "入金與手數不可與其他活動共用"),
        ],
      },
      {
        key: "welcomeBack", group: "small", share: "public", icon: "user", from: "2026-09-28", until: "2026-10-31",
        name: T("Welcome Back", "Welcome Back", "Welcome Back"),
        value: T("320 points + coupon giảm 20% points", "320 points + a 20% points-discount coupon", "320 點 + 點數 8 折券"),
        seg: T("Chỉ khách được mời", "Invited clients only", "僅限受邀客戶"),
        rules: [
          T("Khách được TMGM mời qua email hoặc thông báo; đăng ký ở Portal → Promotions → Sign Up", "Clients invited by TMGM via email or push notification; sign up on Portal → Promotions", "受 TMGM 透過郵件或推播邀請的客戶；於 Portal → 活動頁報名"),
          T("Làm lần lượt 5 nhiệm vụ: nạp 200 USD → 1 lot XAUUSD → 1 lot crypto → 1 lot forex → thêm 2 lot", "Complete 5 tasks in order: deposit USD 200 → 1 lot XAUUSD → 1 lot crypto → 1 lot forex → 2 more lots", "依序完成 5 項任務：入金 200 美元 → 1 手 XAUUSD → 1 手加密貨幣 → 1 手外匯 → 再 2 手"),
          T("Phải xong cả 5 nhiệm vụ mới có thưởng; coupon dùng một lần khi đổi món 20 USD cashback, hạn 08/11/2026", "No reward until all 5 tasks are done; the coupon is used once on the USD 20 cashback item, valid until 8 Nov 2026", "須完成全部 5 項任務才有獎勵；折扣券僅可用於兌換 20 美元現金回贈一次，有效至 2026/11/8"),
        ],
      },
      {
        key: "winYourRide", group: "marketing", share: "public", icon: "trophy", from: "2026-08-20", until: "2026-11-20",
        name: T("Win Your Ride (VN)", "Win Your Ride (VN)", "Win Your Ride（越南）"),
        value: T("Bốc thăm xe máy điện VinFast", "VinFast e-scooter lucky draw", "VinFast 電動機車抽獎"),
        seg: T("Khách mới", "New clients", "新客戶"),
        rules: [
          T("Khách chưa có tài khoản TMGM trước 20/08/2026, đăng ký qua tracking link VN của TMGM", "Clients with no TMGM account before 20 Aug 2026, registered via TMGM's VN tracking link", "2026/8/20 前未有 TMGM 帳戶、經 TMGM 越南追蹤連結註冊的客戶"),
          T("Một khoản FTD ≥ 150 USD (không cộng dồn) và giữ net deposit ≥ 150 USD đủ 90 ngày; không yêu cầu giao dịch", "A single FTD ≥ USD 150 (no top-ups) and net deposit ≥ USD 150 held for 90 days; no trading required", "單筆首次入金 ≥ 150 美元（不可合併）並維持淨入金 ≥ 150 美元 90 天；無交易要求"),
          T("FTD tới 20/11/2026, giữ tiền tới 20/02/2027; 1 xe cho mỗi 20 khách đủ điều kiện, không phải ai cũng trúng", "FTD by 20 Nov 2026, hold until 20 Feb 2027; 1 scooter per 20 eligible clients, not everyone wins", "首次入金截至 2026/11/20，維持至 2027/2/20；每 20 位合格客戶抽出 1 台，並非人人有獎"),
        ],
        note: T("Khách vào qua IB link của đối tác có thể không được tính: hỏi AM trước khi giới thiệu.", "Clients who come through a partner's IB link may not count: check with your AM first.", "經合作夥伴 IB 連結註冊的客戶可能不計入：介紹前請先向 AM 確認。"),
      },
      {
        key: "jayChou", group: "marketing", share: "public", icon: "users", from: "2026-10-01", until: "2026-12-31",
        url: "https://lnd.tmgm.com/en/JayChouMY",
        name: T("Jay Chou Malaysia Giveaway", "Jay Chou Malaysia Giveaway", "周杰倫馬來西亞演唱會門票贈送"),
        value: T("Sạc dự phòng Xiaomi + khăn, bốc thăm vé concert", "Xiaomi power bank + towel, plus a concert ticket draw", "小米行動電源 + 毛巾，另可抽演唱會門票"),
        seg: T("Khách mới", "New clients", "新客戶"),
        rules: [
          T("Đăng ký qua tracking link trên Instagram/Facebook chính thức của TMGM; tài khoản đăng ký từ trước không tính", "Register via the tracking link on TMGM's official Instagram/Facebook; accounts registered earlier don't count", "須經 TMGM 官方 Instagram/Facebook 追蹤連結註冊；先前已註冊者不計"),
          T("FTD ≥ 50 USD và 1,5 lot sản phẩm chỉ định", "FTD ≥ USD 50 and 1.5 lots of the specified products", "首次入金 ≥ 50 美元並交易 1.5 手指定產品"),
          T("5 người trúng, mỗi người 2 vé CAT3 (concert 23/01/2027 tại Malaysia), công bố trước 08/01/2027", "5 winners, 2 CAT3 tickets each (concert 23 Jan 2027, Malaysia), announced by 8 Jan 2027", "抽出 5 位得主，每位 2 張 CAT3 門票（2027/1/23 馬來西亞），2027/1/8 前公布"),
        ],
        note: T("Không đi qua IB link của đối tác.", "Doesn't go through a partner's IB link.", "不經合作夥伴 IB 連結。"),
      },
      {
        key: "thaiConcert", group: "marketing", share: "private", icon: "users", from: "2026-10-01", until: "2026-10-25",
        name: T("Vé Thailand Concert", "Thailand Concert tickets", "泰國演唱會門票"),
        value: T("Tối đa 2 vé, concert 07/11/2026", "Up to 2 tickets, concert 7 Nov 2026", "最多 2 張，演唱會 2026/11/7"),
        seg: T("Khách và IB", "Clients and IBs", "客戶與 IB"),
        rules: [
          T("Khách: đăng ký ở Portal → Promotions, đạt net deposit và lot theo T&C, đổi voucher ở Points Store", "Clients: sign up on Portal → Promotions, meet the T&C net deposit and lots, redeem the voucher in the Points Store", "客戶：於 Portal → 活動頁報名，達到條款淨入金與手數，於點數商城兌換"),
          T("IB: AM nộp đơn; dữ liệu xét theo các mốc 05, 12, 19, 26/10; không trộn hạng vé", "IBs: the AM applies; data is reviewed on 5, 12, 19 and 26 Oct; no mixing ticket tiers", "IB：由 AM 申請；資料於 10/5、12、19、26 審核；不可混搭票價級別"),
          T("Trùng thưởng tháng IB thì chọn một; mỗi người chỉ tham gia bản khách hoặc bản IB", "If it overlaps the monthly IB bonus, pick one; each person joins either the client or the IB version", "與 IB 月度獎金重疊須擇一；每人只能參加客戶版或 IB 版"),
        ],
      },
      {
        key: "carnival", group: "marketing", share: "private", icon: "users", from: "2026-08-10", until: "2026-12-31",
        name: T("Vé Carnival II", "Carnival II tickets", "Carnival II 門票"),
        value: T("Khách tối đa 2 vé, IB tối đa 4 vé (CAT1 đã hết)", "Clients up to 2 tickets, IBs up to 4 (CAT1 sold out)", "客戶最多 2 張，IB 最多 4 張（CAT1 已兌完）"),
        seg: T("Khách và IB", "Clients and IBs", "客戶與 IB"),
        rules: [
          T("Khách (net deposit/lot): 7.000/30 → CAT6 · 10.000/50 → CAT4 · 20.000/80 → CAT3 · 35.000/120 → CAT2", "Clients (net deposit/lots): 7,000/30 → CAT6 · 10,000/50 → CAT4 · 20,000/80 → CAT3 · 35,000/120 → CAT2", "客戶（淨入金／手數）：7,000/30 → CAT6 · 10,000/50 → CAT4 · 20,000/80 → CAT3 · 35,000/120 → CAT2"),
          T("IB: AM nộp đơn khi đủ điều kiện, được trộn hạng vé; trùng thưởng tháng IB thì chọn một", "IBs: the AM applies once eligible, tiers can be mixed; if it overlaps the monthly IB bonus, pick one", "IB：達標後由 AM 申請，可混搭級別；與 IB 月度獎金重疊須擇一"),
          T("Concert 23/01/2027 tại Malaysia; khách đổi voucher ở Points Store", "Concert 23 Jan 2027 in Malaysia; clients redeem the voucher in the Points Store", "演唱會 2027/1/23 於馬來西亞；客戶於點數商城兌換"),
        ],
      },
      {
        key: "premierLeague", group: "marketing", share: "private", icon: "trophy", from: "2026-08-10", until: "2027-05-16",
        name: T("Vé Premier League", "Premier League tickets", "英超門票"),
        value: T("Tối đa 2 vé mỗi kỳ xét", "Up to 2 tickets per review cycle", "每個審核週期最多 2 張"),
        seg: T("Khách và IB", "Clients and IBs", "客戶與 IB"),
        rules: [
          T("Khách (net deposit/lot): General 10.000/50 → 1 vé, 20.000/100 → 2 vé; Hospitality 25.000/150 → 1 vé, 50.000/300 → 2 vé", "Clients (net deposit/lots): General 10,000/50 → 1 ticket, 20,000/100 → 2; Hospitality 25,000/150 → 1, 50,000/300 → 2", "客戶（淨入金／手數）：一般席 10,000/50 → 1 張，20,000/100 → 2 張；招待席 25,000/150 → 1 張，50,000/300 → 2 張"),
          T("IB: AM nộp đơn khi đủ điều kiện, xét theo chu kỳ tháng; trùng thưởng tháng IB thì chọn một", "IBs: the AM applies once eligible, reviewed monthly; if it overlaps the monthly IB bonus, pick one", "IB：達標後由 AM 申請，按月審核；與 IB 月度獎金重疊須擇一"),
          T("Lịch trận theo giờ London; có trận Chelsea – Man United ngày 31/10/2026", "Fixtures in London time; includes Chelsea v Man United on 31 Oct 2026", "賽程以倫敦時間為準；包括 2026/10/31 切爾西對曼聯"),
        ],
      },
    ],

    // So sánh 8 sàn (slide So sánh). Rebate và chi phí khách (USD/lot) theo file "Competitor Research 7 Brokers SEA",
    // sheet "Rebate and Spread": std = dòng STD, raw = dòng Edge. null = chưa có số liệu (hiện "Đang cập nhật", không tính).
    // Rebate: fx/gold = USD/lot, hoặc pct = % chi phí khách (Vantage; "Net Cost" trong file = chi phí × (1 − pct)).
    // Chi phí khách là số minh họa, spread thả nổi.
    // KM: tiers = thưởng tháng theo net deposit + lot ("mib" = bảng mibTiers); subPct = % thêm trên hoa hồng Sub-IB;
    // keepPct = % thêm trên rebate MIB tích lũy (giữ lại); perLot = thưởng trọn đời quy đổi USD/lot theo "Cost $/lot" trong file.
    competitors: {
      brokers: [
        {
          name: "TMGM", tiers: "mib", ecn: true,
          std: { acc: "STD", fx: 10, gold: 20, costFx: 18, costGold: 33 },
          raw: { acc: "Edge", fx: 2, gold: 2, costFx: 7, costGold: 15 },
          promo: T("KM đặc biệt MIB theo tháng; Edge thêm ECN Q4", "Monthly MIB special promo; Edge adds the Q4 ECN boost", "MIB 專屬月度活動；Edge 另加 ECN Q4"),
        },
        {
          name: "Exness", perLot: { fx: 0, gold: 0.94 },
          std: { acc: "Standard", fx: 3.2, gold: 14.4, costFx: 8, costGold: 36 },
          raw: { acc: "Zero", fx: 0, gold: 2.7, costFx: 0.1, costGold: 9.72 },
          promo: T("Thưởng trọn đời theo lot vàng, quy đổi 0,94 USD/lot vàng", "Lifetime gold-volume reward, counted as USD 0.94/gold lot", "黃金終身交易量獎勵，折算每手黃金 0.94 美元"),
        },
        {
          name: "XM", subPct: 10, keepPct: 20,
          std: { acc: "Standard", fx: 9, gold: 17, costFx: 19, costGold: 50 },
          raw: { acc: "Ultra Low", fx: 3.5, gold: 8, costFx: 10, costGold: 22 },
          promo: T("2 khoản: +20% rebate MIB tích lũy, +10% hoa hồng của Sub-IB", "2 parts: +20% on the MIB's accrued rebates, +10% of Sub-IB commissions", "兩部分：MIB 累計返傭 +20%，子代理佣金 +10%"),
        },
        {
          name: "HFM",
          tiers: [
            { deposit: 5000, lots: 50, reward: 100 },
            { deposit: 10000, lots: 150, reward: 500 },
            { deposit: 25000, lots: 250, reward: 1000 },
            { deposit: 50000, lots: 400, reward: 3000 },
            { deposit: 100000, lots: 750, reward: 5000 },
          ],
          std: { acc: "Premium", fx: 6.5, gold: 16, costFx: 13, costGold: 32 },
          raw: { acc: "Zero", fx: 0, gold: 0, costFx: 6, costGold: 20 }, // file ghi rebate "-"
          promo: T("Revshare+ theo tháng: 100–5.000 USD", "Monthly Revshare+: USD 100–5,000", "每月 Revshare+：100–5,000 美元"),
        },
        {
          name: "Vantage",
          std: { acc: "Standard", pct: 53, costFx: 13, costGold: 23 }, // rebate = 53% chi phí khách
          raw: { acc: "ECN", fx: 2, gold: 2, costFx: 7, costGold: 16 },
          promo: T("Không có KM IB", "No IB promotion", "無 IB 活動"),
        },
        {
          name: "AvaTrade",
          std: { acc: "Standard", fx: 6.5, gold: 16, costFx: 13, costGold: 32 },
          raw: { acc: "Premium", fx: 1, gold: 2.5, costFx: 7, costGold: 17 },
          promo: T("Cashback 3 USD/lot 2 tháng đầu (chưa tính)", "USD 3/lot cashback for the first 2 months (not counted)", "首 2 個月每手 3 美元現金回贈（未計入）"),
        },
        {
          name: "Axi", perLot: { fx: 1, gold: 1 },
          std: { acc: "Standard", fx: 5, gold: 7, costFx: 7, costGold: 13 },
          raw: { acc: "Premium", fx: 3, gold: 5, costFx: 4.5, costGold: 10.5 },
          promo: T("Thưởng trọn đời theo khối lượng, quy đổi 1 USD/lot", "Lifetime volume milestone, counted as USD 1/lot", "終身交易量里程碑，折算每手 1 美元"),
        },
        {
          name: "PU Prime",
          std: { acc: "Standard", fx: 8, gold: 15, costFx: 15, costGold: 28 },
          raw: { acc: "Premium", fx: 2.4, gold: 2, costFx: 8, costGold: 14 },
          promo: T("Không có KM IB, cho IB tự cộng markup (chưa tính)", "No IB promotion; IBs add their own markup (not counted)", "無 IB 活動，由 IB 自行加點（未計入）"),
        },
        // EC Markets, VT Markets: KHÔNG có trong file khảo sát. Số liệu lấy từ nguồn công khai (kiểm tra 09/10/2026), là ước tính (est: true).
        // VT Markets: rebate IB = mức TỐI ĐA theo bestforexib.com (Standard 8 FX / 17 vàng; Raw ECN 2 / 2; trang rebate cho trader ghi 7,2 và 1,8 = 90% hoa hồng IB).
        //   Chi phí khách: Standard STP từ 1,2 pip EURUSD (vtmarkets.com) ≈ 12; vàng spread 0,30 ≈ 30 (BrokerAnalysis 08/2026);
        //   Raw ECN 6 USD/lot 2 chiều + EURUSD ≈ 0,3 pip ≈ 9 (Traders Union); vàng 0,10 + 6 ≈ 16.
        // EC Markets: KHÔNG công bố rebate IB theo lot → fx/gold null (nhập tay ở cách Đối đầu).
        //   Chi phí khách: Standard 1,0–1,2 pip ≈ 11; ECN 3 USD/lot 2 chiều + ≈ 0,1 pip ≈ 4 (Finance Magnates, Traders Union). Vàng chưa có số.
        {
          name: "EC Markets", est: true,
          std: { acc: "Standard", fx: null, gold: null, costFx: 11, costGold: null },
          raw: { acc: "ECN", fx: null, gold: null, costFx: 4, costGold: null },
          promo: T("Không công bố mức rebate IB: nhập số EC đề nghị ở cách Đối đầu", "IB rebate rates not published: enter EC's offer in Head-to-head", "未公開 IB 返傭標準：請於「對決」輸入 EC 的報價"),
          profile: [
            T("Giấy phép: FCA 571881, ASIC 414198, FSCA 51886, FMA FSP197465, FSC Mauritius GB2100130, FSA Seychelles SD009", "Licences: FCA 571881, ASIC 414198, FSCA 51886, FMA FSP197465, FSC Mauritius GB2100130, FSA Seychelles SD009", "牌照：FCA 571881、ASIC 414198、FSCA 51886、FMA FSP197465、模里西斯 FSC GB2100130、塞席爾 FSA SD009"),
            T("Thương hiệu: đối tác toàn cầu chính thức của Liverpool FC (hợp đồng nhiều năm từ 2025)", "Brand: Official Global Partner of Liverpool FC (multi-year deal since 2025)", "品牌：利物浦足球俱樂部官方全球合作夥伴（2025 年起多年合約）"),
            T("Tài khoản: Standard (từ 1,0 pip, không phí), ECN (từ 0,0 pip + 3 USD/lot 2 chiều), PRO (không phí, vàng từ 8 USD/lot); đòn bẩy tới 1:1000", "Accounts: Standard (from 1.0 pip, no commission), ECN (from 0.0 pip + USD 3/lot round turn), PRO (no commission, gold from USD 8/lot); leverage up to 1:1000", "帳戶：Standard（1.0 點起，免手續費）、ECN（0.0 點起 + 來回每手 3 美元）、PRO（免手續費，黃金每手 8 美元起）；槓桿最高 1:1000"),
            T("IB: thanh toán tự động, không giới hạn thu nhập, dashboard theo thời gian thực; giải “Best IB/Affiliate Programme” iFX EXPO Dubai 2025", "IB: automated payouts, no earnings cap, real-time dashboard; “Best IB/Affiliate Programme” at iFX EXPO Dubai 2025", "IB：自動結算、收入無上限、即時儀表板；獲 iFX EXPO Dubai 2025「最佳 IB／聯盟計劃」"),
          ],
          src: T("Nguồn: ecmarkets.com, Finance Magnates, Traders Union, liverpoolfc.com (kiểm tra 09/10/2026). Ước tính, chưa xác nhận với sàn.", "Sources: ecmarkets.com, Finance Magnates, Traders Union, liverpoolfc.com (checked 9 Oct 2026). Estimates, not confirmed with the broker.", "來源：ecmarkets.com、Finance Magnates、Traders Union、liverpoolfc.com（2026/10/9 核對）。為估算，未經平台確認。"),
        },
        {
          name: "VT Markets", est: true,
          std: { acc: "Standard STP", fx: 8, gold: 17, costFx: 12, costGold: 30 },
          raw: { acc: "Raw ECN", fx: 2, gold: 2, costFx: 9, costGold: 16 },
          promo: T("Không có KM IB theo tháng công khai; có ClubÉlite (VIP) và IB Support Program theo đợt (chưa tính)", "No public monthly IB promo; ClubÉlite (VIP) and periodic IB Support Program (not counted)", "無公開的每月 IB 活動；另有 ClubÉlite（VIP）及不定期 IB Support Program（未計入）"),
          profile: [
            T("Giấy phép: FSC Mauritius GB23202269, FSCA 50865 (trung gian), UAE CMA 20200000299 (chỉ giới thiệu); không thấy số AFSL ASIC", "Licences: FSC Mauritius GB23202269, FSCA 50865 (intermediary), UAE CMA 20200000299 (introduction only); no ASIC AFSL number found", "牌照：模里西斯 FSC GB23202269、FSCA 50865（中介）、阿聯酋 CMA 20200000299（僅介紹）；未見 ASIC AFSL 編號"),
            T("Tài khoản: Standard STP (từ 1,2 pip, không phí), Raw ECN (từ 0,0 pip + 6 USD/lot 2 chiều), Cent (MT4); có swap-free cho STP và ECN", "Accounts: Standard STP (from 1.2 pips, no commission), Raw ECN (from 0.0 pip + USD 6/lot round turn), Cent (MT4); swap-free on STP and ECN", "帳戶：Standard STP（1.2 點起，免手續費）、Raw ECN（0.0 點起 + 來回每手 6 美元）、Cent（MT4）；STP 與 ECN 可申請免隔夜利息"),
            T("IB: rebate tính hằng ngày, rút qua IB Portal; nhiều tầng Sub-IB; có lựa chọn CPA hoặc Hybrid; chương trình VIP ClubÉlite", "IB: rebates calculated daily, withdrawn via the IB Portal; multi-tier Sub-IBs; CPA or hybrid options; ClubÉlite VIP programme", "IB：返傭每日計算，可經 IB Portal 提取；多層子代理；可選 CPA 或混合模式；ClubÉlite VIP 計劃"),
            T("Rebate IB là mức tối đa theo nguồn bên thứ ba (VT không công bố chính thức): cần xác nhận khi đàm phán", "IB rebates are third-party maximums (VT doesn't publish them): confirm when negotiating", "IB 返傭為第三方所列上限（VT 未正式公布）：洽談時須確認"),
          ],
          src: T("Nguồn: vtmarkets.com, bestforexib.com, BrokerAnalysis (08/2026), Traders Union (kiểm tra 09/10/2026). Ước tính, chưa xác nhận với sàn.", "Sources: vtmarkets.com, bestforexib.com, BrokerAnalysis (Aug 2026), Traders Union (checked 9 Oct 2026). Estimates, not confirmed with the broker.", "來源：vtmarkets.com、bestforexib.com、BrokerAnalysis（2026/8）、Traders Union（2026/10/9 核對）。為估算，未經平台確認。"),
        },
      ],
    },

    // ---------- Nội dung từng section ----------

    sections: {
      bia: {
        part: "common",
        label: T("Bìa", "Cover", "封面"),
        title1: T("Một khách hàng,", "One client,", "一位客戶，"),
        title2: T("nhiều hơn năm dòng thu nhập", "more than five income streams", "超過五條收入來源"),
        sub: {
          mib: T("Chương trình hợp tác MIB cùng TMGM – Q4/2026", "TMGM MIB Partnership Program – Q4 2026", "TMGM MIB 合作計劃 – 2026 Q4"),
          ib: T("Chương trình hợp tác IB cùng TMGM – Q4/2026", "TMGM IB Partnership Program – Q4 2026", "TMGM IB 合作計劃 – 2026 Q4"),
        },
        notes: T(
          "“Hôm nay em không so một con số rebate, mà cho anh/chị thấy một khách hàng có thể tạo ra hơn năm dòng thu nhập.”<br>Hỏi nhanh: hệ thống có bao nhiêu Sub-IB, bao nhiêu lot mỗi tháng? Ghi lại để nhập vào máy tính ở M5.",
          "“Today I won't compare one rebate number — I'll show you how a single client can create more than five income streams.”<br>Quick question: how many Sub-IBs and how many lots a month does your network do? Note it for the M5 calculator.",
          "「今天我不比較單一返傭數字，而是讓您看到一位客戶如何創造超過五條收入來源。」<br>快速提問：您的體系有多少子代理、每月交易多少手？記下來，稍後輸入 M5 計算器。"
        ),
      },

      "phap-ly": {
        part: "common",
        label: T("Pháp lý", "Trust", "監管"),
        title: T("TMGM: 13 năm, 4 giấy phép, thương hiệu khách đã biết", "TMGM: 13 years, 4 licences, a brand clients already know", "TMGM：13 年歷史、4 張牌照、客戶熟悉的品牌"),
        stats: [
          { icon: "shield", num: T("2013", "2013", "2013"), label: T("Thành lập · ASIC AFSL 436416", "Founded · ASIC AFSL 436416", "成立 · ASIC AFSL 436416") },
          { icon: "stamp", num: T("4", "4", "4"), label: T("giấy phép: ASIC, VFSC, FSA, FSC", "licences: ASIC, VFSC, FSA, FSC", "張牌照：ASIC、VFSC、FSA、FSC") },
          { icon: "globe", num: T("150+", "150+", "150+"), label: T("quốc gia", "countries", "個國家") },
          { icon: "umbrella", num: T("10 triệu USD", "USD 10M", "1,000 萬美元"), label: T("bảo hiểm trách nhiệm nghề nghiệp", "professional indemnity insurance", "專業責任保險") },
        ],
        // Link tới đúng bản ghi TMGM trên trang của cơ quan quản lý.
        // FSC (form Oracle APEX) không cho link thẳng tới kết quả: khi bấm, trang copy sẵn `copy` để dán vào ô tìm.
        regulators: [
          { name: "ASIC", id: "AFSL 436416", entity: "Trademax Australia Limited", url: "https://service.asic.gov.au/search/EntityDetail?LicenceNumber=436416&PermissionType=Australian%20financial%20services%20licensees&licenceName=TRADEMAX%20AUSTRALIA%20LIMITED" },
          { name: "VFSC", id: "40356", entity: "Trademax Global Limited", url: "https://www.vfsc.vu/financial-dealers-licensee-list/#:~:text=Trademax%20Global%20Limited" },
          { name: "FSA Seychelles", id: "SD224", entity: "Trademax Global Markets (SE) Limited", url: "https://fsaseychelles.sc/regulated-entities/capital-markets#tab-securities-dealer:~:text=Trademax%20Global%20Markets" },
          { name: "FSC Mauritius", id: "GB22201012", entity: "Trademax Global Markets (International) Pty Ltd", url: "https://opr.fscmauritius.org/ords/opr/r/fsc-opr/fsc-online-public-register-opr", copy: "Trademax" },
        ],
        verifyHint: T(
          "FSC Mauritius không cho liên kết thẳng tới kết quả tìm kiếm: khi bấm, tên đã được copy sẵn, chỉ cần dán vào ô tìm.",
          "FSC Mauritius doesn't allow direct links to search results: clicking copies the name so you can paste it into its search box.",
          "FSC 模里西斯不支援直接連結至搜尋結果：點擊後會自動複製名稱，貼到搜尋欄即可。"
        ),
        platforms: T("7 nhà cung cấp thanh khoản · MT4 · MT5 · TMGM App", "7 liquidity providers · MT4 · MT5 · TMGM App", "7 家流動性提供商 · MT4 · MT5 · TMGM App"),
        // Ảnh đầu tiên là ô lớn. Khi có aff-cup.webp (AFF là giải bóng đá, hợp khán giả Việt), đưa dòng AFF lên đầu mảng.
        // pos = object-position khi ảnh bị cắt cho vừa ô.
        photos: [
          { file: "chelsea.webp", pos: "50% 30%", href: "https://www.chelseafc.com/en/news/article/chelsea-football-club-and-tmgm-agree-multi-year-regional-partnership", caption: T("Đối tác châu Á – Thái Bình Dương của Chelsea FC từ 2023", "Chelsea FC Asia-Pacific partner since 2023", "切爾西足球俱樂部亞太區合作夥伴（2023 年起）") },
          { file: "australian-open.webp", pos: "50% 38%", href: "https://ausopen.com/node/155621", caption: T("Đối tác Australian Open 2021–2023", "Australian Open partner 2021–2023", "澳洲網球公開賽合作夥伴 2021–2023") },
          {
            file: "aff-cup.webp", pos: "50% 60%", href: "https://www.tmgm.com/en-au/past-sponsored-event/tmgm-returns-as-an-official-supporter-of-the-aff-mitsubishi-electric-cup-2022",
            caption: T("Nhà hỗ trợ chính thức AFF Mitsubishi Electric Cup 2022", "Official supporter, AFF Mitsubishi Electric Cup 2022", "AFF 三菱電機盃 2022 官方贊助商"),
            // Ảnh minh họa có giấy phép tự do (không phải trận AFF Cup): CC BY-SA bắt buộc ghi tác giả. Thay bằng ảnh brochure khi có.
            credit: T("Ảnh minh họa: SVĐ Mỹ Đình, Hà Nội · Louis Anderson, CC BY-SA 4.0", "Illustrative: Mỹ Đình Stadium, Hanoi · Louis Anderson, CC BY-SA 4.0", "示意圖：河內美亭體育場 · Louis Anderson, CC BY-SA 4.0"),
          },
        ],
        awardHref: "https://www.tmgm.com/en-au/achievement",
        award: T("Best Multi-Asset Broker APAC 2024 (Brokersview)", "Best Multi-Asset Broker APAC 2024 (Brokersview)", "2024 亞太最佳多資產經紀商（Brokersview）"),
        entity: T(
          "Khách hàng Việt Nam mở tài khoản qua <b>Trademax Global Limited (VFSC 40356)</b>, không phải pháp nhân ASIC.",
          "Vietnamese clients open accounts with <b>Trademax Global Limited (VFSC 40356)</b>, not the ASIC entity.",
          "越南客戶透過 <b>Trademax Global Limited（VFSC 40356）</b> 開戶，而非 ASIC 監管實體。"
        ),
        notes: T(
          "“Pháp lý giúp anh/chị yên tâm, thương hiệu giúp khách của anh/chị yên tâm. Khi khách hỏi ‘sàn này có uy tín không’, đội sales chỉ cần mở trang của Chelsea FC.”<br>Nói rõ ngay từ đầu: khách Việt Nam thuộc Trademax Global Limited (VFSC 40356). Bấm “verify” để mở thẳng trang tra cứu.",
          "“Regulation reassures you; the brand reassures your clients. When a client asks ‘is this broker legit?’, your sales team just opens Chelsea FC's page.”<br>Say it upfront: Vietnamese clients are with Trademax Global Limited (VFSC 40356). Click “verify” to open the regulator's record.",
          "「監管讓您安心，品牌讓您的客戶安心。客戶問『這家平台可靠嗎？』，業務團隊只要打開切爾西的頁面即可。」<br>一開始就說清楚：越南客戶屬於 Trademax Global Limited（VFSC 40356）。點擊「查核」可直接打開監管機構頁面。"
        ),
      },

      "nam-dong": {
        part: "common",
        label: T("Năm dòng thu nhập", "Five streams", "五條收入"),
        title: T("Năm dòng thu nhập từ cùng một khách hàng", "Five income streams from the same client", "同一位客戶的五條收入來源"),
        core: T("1 khách hàng", "1 client", "1 位客戶"),
        streams: [
          {
            icon: "candles", value: T("2–23 USD/lot", "USD 2–23/lot", "2–23 美元/手"), label: T("Rebate theo lot", "Per-lot rebate", "按手數返傭"), base: true, link: "tai-khoan",
            who: T("IB · MIB", "IB · MIB", "IB · MIB"),
            detail: T("2–15 USD/lot Forex và 2–23 USD/lot vàng, tùy loại tài khoản.", "USD 2–15/lot on FX and USD 2–23/lot on gold, depending on account type.", "外匯 2–15 美元/手，黃金 2–23 美元/手，依帳戶類型而定。"),
          },
          {
            icon: "moon", value: T("30% tuần + 30–50% tháng", "30% weekly + 30–50% monthly", "每週 30% + 每月 30–50%"), label: T("Hoàn Swap", "Swap rebate", "隔夜利息返還"), link: "m4",
            who: T("Chính sách IB", "IB policy", "IB 政策"),
            detail: T("Chính sách IB, tính trên swap của khách trực tiếp: 30% mỗi tuần, thêm 30–50% mỗi tháng theo net deposit.", "IB policy, based on direct clients' swap: 30% weekly, plus 30–50% monthly by net deposit.", "IB 政策，按直客隔夜利息計算：每週返還 30%，每月再依淨入金返還 30–50%。"),
          },
          {
            icon: "trophy",
            value: { mib: T("tới 20.000 USD", "up to USD 20,000", "最高 20,000 美元"), ib: T("tới 15.000 USD", "up to USD 15,000", "最高 15,000 美元") },
            label: { mib: T("Thưởng tháng MIB", "MIB monthly bonus", "MIB 月度獎金"), ib: T("Thưởng tháng IB", "IB monthly bonus", "IB 月度獎金") },
            link: "m2",
            who: { mib: T("MIB", "MIB", "MIB"), ib: T("IB", "IB", "IB") },
            detail: T("Theo net deposit và lot: 1.300–20.000 USD (MIB), 260–15.000 USD (IB).", "By net deposit and lots: USD 1,300–20,000 (MIB), USD 260–15,000 (IB).", "依淨入金與手數：MIB 1,300–20,000 美元，IB 260–15,000 美元。"),
          },
          {
            icon: "zap", value: T("tới 5 USD/lot", "up to USD 5/lot", "最高 5 美元/手"), label: T("Rebate ECN Q4", "Q4 ECN boost", "ECN Q4 加碼"), link: "ecn-q4",
            who: T("Tài khoản Edge/RAW", "Edge/RAW accounts", "Edge/RAW 帳戶"),
            detail: T("Forex tới 5 USD/lot, vàng tới 3,5 USD/lot, tự động chi trả.", "FX up to USD 5/lot, gold up to USD 3.5/lot, paid automatically.", "外匯最高 5 美元/手，黃金最高 3.5 美元/手，自動發放。"),
          },
          {
            icon: "gift", value: T("tới 500 USD + Points", "up to USD 500 + Points", "最高 500 美元 + 點數"), label: T("Ưu đãi cho khách", "Client offers", "客戶優惠"), link: "uu-dai", client: true,
            who: T("Dành cho khách", "For clients", "客戶專享"),
            detail: T(
              "Cashback Q4 tới 500 USD/khách và Points 10 điểm/lot. Khách nhận, không phải thu nhập của đối tác: công cụ giúp chốt khách.",
              "Q4 cashback up to USD 500 per client, plus 10 Points per lot. Received by the client, not partner income: a tool to close clients.",
              "Q4 現金回贈每位客戶最高 500 美元，另有每手 10 點。由客戶領取，並非合作夥伴收入：幫助成交的工具。"
            ),
          },
        ],
        legendBase: T("nền cố định", "fixed base", "固定基礎"),
        legendAdd: T("cộng thêm theo kỳ", "periodic add-ons", "週期性加碼"),
        legendClient: T("dành cho khách, không phải thu nhập đối tác", "for clients, not partner income", "客戶專享，非合作夥伴收入"),
        otherTitle: T("Ngoài 5 dòng chính", "Beyond the five main streams", "五條主要收入之外"),
        otherSmall: T("Ưu đãi nhỏ", "Small offers", "小型優惠"),
        otherMkt: T("Marketing", "Marketing", "行銷"),
        otherPriv: T("Chỉ chia sẻ riêng", "Private only", "僅限私下分享"),
        notes: {
          mib: T(
            "“Dòng 1 là nền cố định; dòng 2–4 là phần cộng thêm theo từng kỳ; dòng 5 là ưu đãi khách nhận, giúp chốt khách, không phải thu nhập của anh/chị. Với MIB, rebate và thưởng tháng tính trên toàn hệ thống; hoàn Swap theo chính sách IB.”<br>Bấm phím → để hiện từng nhánh.",
            "“Stream 1 is the fixed base; streams 2–4 are periodic add-ons; stream 5 is a reward the client receives — it helps you close, it isn't your income. For an MIB, rebates and the monthly bonus count across the whole network; swap rebates follow the IB policy.”<br>Press → to reveal each branch.",
            "「第 1 條是固定基礎；第 2–4 條是週期性加碼；第 5 條是客戶領取的獎勵，幫助成交，並非您的收入。對 MIB 而言，返傭和月度獎金按整個體系計算；隔夜利息返還依 IB 政策。」<br>按 → 逐一顯示。"
          ),
          ib: T(
            "“Dòng 1 là nền cố định; dòng 2–4 là phần cộng thêm theo từng kỳ; dòng 5 là ưu đãi khách nhận, giúp chốt khách.”<br>Bấm phím → để hiện từng nhánh.",
            "“Stream 1 is the fixed base; streams 2–4 are periodic add-ons; stream 5 is a reward the client receives, to help you close.”<br>Press → to reveal each branch.",
            "「第 1 條是固定基礎；第 2–4 條是週期性加碼；第 5 條是客戶領取的獎勵，幫助成交。」<br>按 → 逐一顯示。"
          ),
        },
      },

      "tai-khoan": {
        part: "common",
        label: T("Tài khoản", "Accounts", "帳戶"),
        title: T("Chọn tài khoản là chọn mô hình kinh doanh", "Choosing an account is choosing a business model", "選擇帳戶，就是選擇商業模式"),
        cols: {
          account: T("Tài khoản", "Account", "帳戶"),
          fx: T("Rebate FX", "FX rebate", "外匯返傭"),
          gold: T("Rebate vàng", "Gold rebate", "黃金返傭"),
          costFx: T("Chi phí khách FX*", "Client cost FX*", "客戶外匯成本*"),
          costGold: T("Chi phí khách vàng*", "Client cost gold*", "客戶黃金成本*"),
          fit: T("Hợp với", "Best for", "適合"),
        },
        unit: T("USD/lot", "USD/lot", "美元/手"),
        barsTitle: T("Rebate so với chi phí khách", "Rebate vs client cost", "返傭 vs 客戶成本"),
        barRebate: T("Rebate của đối tác", "Partner rebate", "代理返傭"),
        barCost: T("Chi phí khách trả", "Client pays", "客戶支付"),
        costNet: T("≈{n} sau Points", "≈{n} after Points", "扣點數後 ≈{n}"),
        metalFx: T("Forex", "FX", "外匯"),
        metalGold: T("Vàng", "Gold", "黃金"),
        footnote: T(
          "*Chi phí khách = spread + phí giao dịch, ước tính. Edge, Classic, STD theo file khảo sát đối thủ (EURUSD và XAUUSD); Prime và STD05 theo ảnh chụp bảng rebate cũ, cần cập nhật. Spread thả nổi. Dầu, chỉ số, crypto: 1,5 USD/lot (STD05: 2 USD/lot); cổ phiếu: 0,02 USD.",
          "*Client cost = spread + commission, estimated. Edge, Classic and STD follow the competitor research file (EURUSD and XAUUSD); Prime and STD05 come from an older rebate-table screenshot and need refreshing. Spreads float. Oil, indices, crypto: USD 1.5/lot (STD05: USD 2/lot); shares: USD 0.02.",
          "*客戶成本 = 點差 + 手續費，為估算值。Edge、Classic、STD 依競爭對手調查檔（EURUSD 與 XAUUSD）；Prime 與 STD05 來自較舊的返傭表截圖，待更新。點差浮動。原油、股指、加密貨幣：1.5 美元/手（STD05：2 美元/手）；股票：0.02 美元。"
        ),
        costFold: T("Ghi chú chi phí", "Cost notes", "成本說明"),
        insight: T(
          "<b>Rebate cao đi kèm chi phí cao cho khách:</b> STD05 trả 15 USD/lot FX nhưng khách tốn khoảng 22 USD, gấp 3 lần Edge. Q4 thu hẹp khoảng cách: Edge trả tới 5 USD trên 7 USD phí của khách.",
          "<b>Higher rebates mean higher client costs:</b> STD05 pays USD 15/lot on FX but the client pays about USD 22, 3× Edge. Q4 narrows the gap: Edge pays up to USD 5 of the client's USD 7 commission.",
          "<b>返傭越高，客戶成本越高：</b>STD05 外匯返傭 15 美元/手，但客戶成本約 22 美元，是 Edge 的 3 倍。Q4 縮小了差距：在客戶支付的 7 美元手續費中，Edge 最高可返 5 美元。"
        ),
        adviceTitle: T("Định hướng của AM", "Your AM's recommendation", "客戶經理建議"),
        advice: T(
          "<b>Mix account:</b> phối hợp nhiều loại tài khoản trong hệ thống. Edge/Classic cho khách giao dịch nhiều để giữ chân lâu dài; Prime cho nhóm IB (MIB chia rebate cho Sub-IB); STD chỉ dành cho IB có khách trực tiếp.",
          "<b>Mix account:</b> combine account types across your network. Edge/Classic for high-volume clients, to keep them longer; Prime for IB groups (MIBs sharing rebates with Sub-IBs); STD only for IBs with direct clients.",
          "<b>Mix account：</b>在體系內搭配多種帳戶類型。交易頻繁的客戶用 Edge/Classic，有助長期留住客戶；Prime 適合 IB 團隊（MIB 與子代理分潤）；STD 僅限擁有直客的 IB。"
        ),
        notes: T(
          "Rebate cao đi kèm chi phí cao cho khách: STD05 trả 15 USD/lot nhưng khách tốn ~22 USD, gấp 3 lần Edge.<br>Khuyên phối hợp nhiều loại tài khoản; Edge/Classic cho khách giao dịch nhiều. Slide sau: Edge đang được tăng rebate.",
          "Higher rebates mean higher client costs: STD05 pays USD 15/lot but the client pays ~USD 22, 3× Edge.<br>Recommend mixing account types; Edge/Classic for high-volume clients. Next slide: Edge rebates are boosted.",
          "返傭越高，客戶成本越高：STD05 返傭 15 美元/手，但客戶成本約 22 美元，是 Edge 的 3 倍。<br>建議搭配多種帳戶；交易頻繁的客戶用 Edge/Classic。下一頁：Edge 返傭加碼。"
        ),
      },

      "ecn-q4": {
        part: "common",
        label: T("ECN Q4", "Q4 ECN boost", "ECN Q4 加碼"),
        title: T("Edge/RAW được tăng rebate đến 31/12: tới 5 USD/lot Forex", "Edge/RAW rebates boosted until 31 Dec: up to USD 5/lot on FX", "Edge/RAW 返傭加碼至 12 月 31 日：外匯最高 5 美元/手"),
        dates: T("1/10 – 31/12/2026 · nhóm RAW07/EDGE", "1 Oct – 31 Dec 2026 · RAW07/EDGE groups", "2026年10月1日 – 12月31日 · RAW07/EDGE 組別"),
        cols: {
          deposit: T("Net deposit khách trực tiếp ECN/EDGE", "Direct ECN/EDGE client net deposit", "直屬 ECN/EDGE 客戶淨入金"),
          fx: T("Rebate Forex", "Forex rebate", "外匯返傭"),
          gold: T("Rebate kim loại quý", "Bullion rebate", "貴金屬返傭"),
          oil: T("Dầu thô", "Crude oil", "原油"),
          index: T("Chỉ số", "Index", "股指"),
        },
        unit: T("USD/lot", "USD/lot", "美元/手"),
        formulaNote: T("Mức rebate = rebate gốc 2 USD/lot × (1 + % tăng thêm).", "Rate = base rebate USD 2/lot × (1 + boost %).", "返傭 = 基礎返傭 2 美元/手 ×（1 + 加碼比例）。"),
        below: T("Dưới 5.000 USD: không có rebate cộng thêm.", "Below USD 5,000: no additional commission.", "低於 5,000 美元：無額外佣金。"),
        gold: T("vàng", "gold", "黃金"),
        stairsNote: T("Forex · USD/lot theo net deposit", "FX · USD/lot by net deposit", "外匯 · 美元/手（依淨入金）"),
        eligTitle: T("Ai được tham gia", "Who qualifies", "參與資格"),
        elig: [
          T("Nhóm tài khoản RAW07/EDGE; chỉ tính net deposit của khách trực tiếp.", "RAW07/EDGE groups; only direct clients' net deposits count.", "RAW07/EDGE 組別；僅計算直客的淨入金。"),
          T("Chỉ khách đăng ký dưới Trademax Global Limited; không tính khách ASIC, CPA và Affiliate.", "Only clients registered under Trademax Global Limited; ASIC clients, CPA and Affiliates are excluded.", "僅限註冊於 Trademax Global Limited 的客戶；ASIC 客戶、CPA 與 Affiliates 不包括在內。"),
          T("IB ECN ở mọi khu vực trừ Singapore, Tây Ban Nha, Canada, Nhật Bản, Romania, Hồng Kông, Pháp, Anh, Úc và New Zealand.", "ECN IBs in all regions except Singapore, Spain, Canada, Japan, Romania, Hong Kong, France, the UK, Australia and New Zealand.", "除新加坡、西班牙、加拿大、日本、羅馬尼亞、香港、法國、英國、澳大利亞和紐西蘭以外的所有 ECN 代理。"),
          T("Chỉ tăng cho Forex và kim loại quý; dầu thô và chỉ số giữ 1,5 USD/lot.", "Only forex and precious metals are boosted; crude oil and indices stay at USD 1.5/lot.", "僅外匯與貴金屬加碼；原油與股指維持 1.5 美元/手。"),
        ],
        ticks: [
          T("Không cần số khách tối thiểu", "No minimum client count", "對客戶數量無要求"),
          T("Tự động trả trong 5 ngày làm việc đầu tháng, không cần đăng ký", "Paid automatically in the first 5 working days, no application", "每月前 5 個工作日自動結算，無需申請"),
          T("Chạy song song với KM khác", "Runs alongside other promotions", "可與其他活動同時進行"),
        ],
        example: T("Ví dụ TMGM: 3.600 → 6.320 USD (+76%)", "TMGM example: USD 3,600 → 6,320 (+76%)", "TMGM 示例：3,600 → 6,320 美元（+76%）"),
        toCalc: T("Xem cách tính", "See how it's calculated", "查看計算方式"),
        transfer: T(
          "Không được chuyển IB của khách hiện hữu để hưởng KM: TMGM sẽ kiểm tra và có thể giữ lại khoản hoàn tiền (điều khoản mục 2).",
          "Moving existing clients between IBs to claim the promo is not allowed — TMGM reviews IB relationships and may withhold cashback (term 2).",
          "不得為參加活動而轉移客戶的代理關係：TMGM 將審核並可能扣留返傭（條款第 2 條）。"
        ),
        notes: T(
          "Rebate gốc Edge là 2 USD/lot; Q4 nhân thêm theo bậc net deposit của khách trực tiếp. Không cần số khách tối thiểu, tự động trả: đây là chương trình dễ bắt đầu nhất.",
          "Edge's base rebate is USD 2/lot; Q4 multiplies it by the direct clients' net-deposit tier. No minimum clients, paid automatically: the easiest program to start with.",
          "Edge 基礎返傭為 2 美元/手；Q4 依直客淨入金級別加碼。無客戶數量要求、自動發放：最容易開始的活動。"
        ),
      },

      "ecn-calc": {
        part: "common",
        label: T("Cách tính Q4", "Q4 calculation", "Q4 計算方式"),
        title: T("Cách tính rebate ECN Q4 trong 3 bước", "How the Q4 ECN boost is calculated, in 3 steps", "ECN Q4 加碼返傭的計算方式：三步驟"),
        step1: T("Tính net deposit khuyến mãi", "Work out the promo net deposit", "計算活動淨入金"),
        ndParts: [
          T("Tổng nạp trong kỳ", "Total deposits in the period", "活動期內總入金"),
          T("Chuyển nội bộ từ tài khoản IB sang tài khoản giao dịch", "Internal transfers from IB account to trading account", "IB 帳戶轉入交易帳戶的金額"),
          T("Tổng rút trong kỳ", "Total withdrawals in the period", "活動期內出金"),
          T("Rebate phát sinh trong nhóm KM", "Commission generated in the promo group", "活動組別產生的返傭"),
          T("Net deposit khuyến mãi", "Promo net deposit", "活動淨入金"),
        ],
        step2: T("Tra bậc → % tăng thêm", "Find the tier → boost %", "對照級別 → 加碼比例"),
        tierLine: T("Net deposit {d} → Forex <b>+{fx}%</b>, vàng <b>+{g}%</b>", "Net deposit {d} → FX <b>+{fx}%</b>, gold <b>+{g}%</b>", "淨入金 {d} → 外匯 <b>+{fx}%</b>、黃金 <b>+{g}%</b>"),
        noTier: T("Dưới 5.000 USD: chỉ nhận rebate thường, không có phần cộng thêm.", "Below USD 5,000: regular commission only, no additional.", "低於 5,000 美元：僅按常規返傭結算，無額外佣金。"),
        step3: T("Tính rebate cộng thêm", "Calculate the additional commission", "計算額外佣金"),
        formula: T(
          "Cộng thêm = lot FX × 2 × %FX + lot vàng × 2 × %vàng",
          "Additional = FX lots × 2 × FX % + gold lots × 2 × gold %",
          "額外佣金 = 外匯手數 × 2 × 外匯加碼 + 黃金手數 × 2 × 黃金加碼"
        ),
        exampleTitle: T("Ví dụ trong điều khoản của TMGM", "Example from TMGM's terms", "TMGM 活動條款中的示例"),
        exCols: [
          T("Net deposit", "Net deposit", "淨入金"),
          T("Lot FX", "FX lots", "外匯手數"),
          T("Lot vàng", "Gold lots", "黃金手數"),
          T("Rebate FX gốc", "Base FX commission", "外匯基礎佣金"),
          T("Rebate vàng gốc", "Base gold commission", "黃金基礎佣金"),
          T("Rebate cộng thêm", "Additional commission", "額外佣金"),
          T("Tổng rebate", "Total commission", "總佣金"),
        ],
        calcTitle: T("Thử với số của anh/chị", "Try your numbers", "輸入您的數據"),
        inputs: {
          deposit: T("Net deposit khuyến mãi (USD)", "Promo net deposit (USD)", "活動淨入金（美元）"),
          lotsFx: T("Lot Forex / tháng", "FX lots / month", "外匯手數／月"),
          lotsGold: T("Lot vàng / tháng", "Gold lots / month", "黃金手數／月"),
        },
        base: T("Rebate gốc (2 USD/lot)", "Base commission (USD 2/lot)", "基礎佣金（2 美元/手）"),
        add: T("Cộng thêm Q4", "Q4 additional", "Q4 額外佣金"),
        total: T("Tổng rebate", "Total commission", "總佣金"),
        uplift: T("tăng {p}%", "+{p}%", "增加 {p}%"),
        foldBtn: T("Xem cách tính (3 bước)", "Show how it's calculated (3 steps)", "查看計算方式（三步驟）"),
        reset: T("Về mặc định (1.000 lot)", "Reset to default (1,000 lots)", "恢復預設（1,000 手）"),
        defaultNote: T("Máy tính mặc định: 150K net deposit, 1.000 lot Forex và 1.000 lot vàng.", "Calculator default: 150K net deposit, 1,000 FX lots and 1,000 gold lots.", "計算器預設：淨入金 150K、外匯 1,000 手、黃金 1,000 手。"),
        settleTitle: T("Thanh toán", "Settlement", "結算"),
        settle: [
          T("Tính theo net deposit và khối lượng Forex, kim loại quý ECN/EDGE thực tế trong tháng.", "Based on the month's actual net deposit and ECN/EDGE forex & precious-metal volume.", "依當月實際淨入金及 ECN/EDGE 外匯、貴金屬交易量計算。"),
          T("Quyết toán trong 5 ngày làm việc đầu tháng; IB không cần đăng ký.", "Settled in the first 5 working days of each month; no application needed.", "每月前 5 個工作日結算；代理無需申請。"),
          T("Trả bằng USD vào tài khoản IB.", "Paid in USD to the IB account.", "以美元發放至代理帳戶。"),
          T("Net deposit bằng 0 hoặc dưới 5.000 USD: chỉ nhận rebate thường.", "Zero or under USD 5,000 net deposit: regular commission only.", "淨入金為零或低於 5,000 美元：僅按常規返傭結算。"),
        ],
        source: T("Nguồn: TMGM 2026 Q4 ECN/EDGE IB Special Promotion, mục 5–6.", "Source: TMGM 2026 Q4 ECN/EDGE IB Special Promotion, terms 5–6.", "來源：TMGM 2026 Q4 ECN/EDGE 代理特別活動，第 5–6 條。"),
        notes: T(
          "Đi đúng ví dụ trong điều khoản TMGM: 150K net deposit, 1.000 lot FX, 800 lot vàng → rebate thường 3.600, cộng thêm 2.720, tổng 6.320 USD (+76%).<br>Sau đó mở “Thử với số của anh/chị” (mặc định 1.000 lot FX và 1.000 lot vàng → 6.900 USD) và nhập số của đối tác.",
          "Walk through the example in TMGM's terms: 150K net deposit, 1,000 FX lots, 800 gold lots → regular 3,600, additional 2,720, total USD 6,320 (+76%).<br>Then use “Try your numbers” (default 1,000 FX and 1,000 gold lots → USD 6,900) and type the partner's numbers.",
          "按照 TMGM 條款中的示例講解：淨入金 150K、外匯 1,000 手、黃金 800 手 → 常規 3,600，額外 2,720，合計 6,320 美元（+76%）。<br>然後使用「輸入您的數據」（預設外匯 1,000 手、黃金 1,000 手 → 6,900 美元）並輸入合作夥伴的數字。"
        ),
      },

      "lich-tien": {
        part: "common",
        label: T("Lịch tiền về", "Payouts", "入帳時間"),
        title: T("Tiền về theo lịch rõ ràng", "Payouts on a clear schedule", "按明確時間表入帳"),
        weekdays: {
          vi: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
          en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          zh: ["一", "二", "三", "四", "五", "六", "日"],
        },
        lead: T("Rebate cơ bản có mặc định; khuyến mãi là phần cộng thêm.", "The base rebate is the default; promotions are add-ons.", "基本返傭為預設；活動為附加項目。"),
        tradeDate: T("Ngày giao dịch (T)", "Trade date (T)", "交易日期（T）"),
        applyDate: T("Ngày AM nộp đơn", "Date your AM files", "AM 提交申請日期"),
        addonsTitle: T("Thêm khuyến mãi (add-on)", "Add promotions (add-ons)", "加入活動（附加項目）"),
        addonsHint: T(
          "Bật khoản nào để xem ngày nộp đơn và ngày nhận tiền của khoản đó.",
          "Switch one on to see its apply date and payout date.",
          "開啟項目即可查看其申請日期與入帳日期。"
        ),
        colItem: T("Khoản", "Item", "項目"),
        colApply: T("Nộp đơn", "Apply", "申請"),
        colPayout: T("Nhận tiền", "Payout", "入帳"),
        pending: T("chờ TMGM xác nhận", "awaiting TMGM confirmation", "待 TMGM 確認"),
        applyNone: T("Không cần đăng ký", "No application needed", "無需申請"),
        applyAm: T("AM đăng ký một lần", "Your AM registers once", "AM 一次性登記"),
        applyBy: T("Hạn nộp: {d}", "Apply by {d}", "申請截止：{d}"),
        applyWeekend: T("Rơi vào cuối tuần, nên nộp trước {r}", "Falls on a weekend: file by {r}", "適逢週末，請於 {r} 前提交"),
        late: T("Quá hạn nộp", "Past the deadline", "已逾期"),
        redeemOn: T("Khách đổi trên Portal: {d}", "Client redeems on the Portal: {d}", "客戶於 Portal 兌換：{d}"),
        payLatest: T("chậm nhất {d}", "by {d} at the latest", "最遲 {d}"),
        payBefore: T("Trước {d}", "Before {d}", "{d} 之前"),
        outside: T("Ngoài kỳ Q4 (1/10–31/12): không áp dụng", "Outside the Q4 period (1 Oct–31 Dec): not applicable", "不在 Q4 期間（10/1–12/31）：不適用"),
        t1note: T(
          "T = ngày giao dịch. Rebate cơ bản về T+1 ngày làm việc (lệnh thứ Sáu về thứ Hai). Quy tắc này chưa có trong tài liệu TMGM, cần TMGM xác nhận.",
          "T = trade date. The base rebate arrives T+1 working day (a Friday trade arrives Monday). This rule is not in TMGM's documents yet; TMGM to confirm.",
          "T = 交易日。基本返傭於 T+1 個工作日到帳（週五交易於週一到帳）。TMGM 文件尚無此規則，需 TMGM 確認。"
        ),
        holidays: T(
          "Các ngày ở trên chỉ là dự tính, có thể sớm hoặc muộn hơn tùy tiến trình xử lý của công ty. Chưa trừ ngày lễ.",
          "The dates above are estimates only. Payouts may arrive sooner or later depending on the company's processing. Public holidays are not excluded.",
          "以上日期僅為預估，實際入帳可能提前或延後，視公司處理進度而定。未扣除公眾假期。"
        ),
        calTitle: T("Lịch", "Calendar", "月曆"),
        notes: {
          mib: T("“Phần tiếp theo em đi vào chương trình dành riêng cho MIB.”", "“Next, let's go into the program built specifically for MIBs.”", "「接下來介紹專為 MIB 設計的計劃。」"),
          ib: T("“Phần tiếp theo là chính sách dành cho IB.”", "“Next, the policy for IBs.”", "「接下來是 IB 政策。」"),
        },
      },

      m1: {
        hidden: true, // ẩn khỏi trang; xóa dòng này để hiện lại
        part: "mib",
        label: T("Hệ thống", "Network", "體系"),
        title: T("Xây hệ thống, không chỉ một tệp khách", "Build a network, not just a client list", "建立體系，而不只是客戶名單"),
        subLabel: T("Sub-IB", "Sub-IB", "子代理"),
        subValid: T("3 khách kích hoạt · 2 hoạt động", "3 activated · 2 active", "3 位已激活 · 2 位活躍"),
        subOut: T("Chỉ có tài khoản riêng, không được tính", "Own account only — not counted", "僅有自己的帳戶，不計入"),
        frame: T("Toàn bộ phần này được cộng vào KM MIB", "All of this counts toward the MIB promo", "以上全部計入 MIB 活動"),
        // Minh họa: số khách và số khách hoạt động dưới mỗi Sub-IB
        subs: [{ n: 4, active: 3 }, { n: 5, active: 2 }, { n: 3, active: 2 }, { n: 1, active: 0, out: true }],
        rules: [
          T("KM MIB cộng net deposit và lot của khách trực tiếp của MIB <b>và toàn bộ các nhánh Sub-IB</b> bên dưới.", "The MIB promo adds up net deposit and lots from your direct clients <b>and every Sub-IB branch</b> below you.", "MIB 活動合計 MIB 直客<b>及其下所有子代理分支</b>的淨入金與手數。"),
          T("Sub-IB được tính khi có <b>≥ 3 khách trực tiếp được kích hoạt</b> và <b>≥ 2 khách nạp tiền, giao dịch</b> trong kỳ. Sub-IB chỉ có tài khoản riêng không được tính.", "A Sub-IB counts once it has <b>≥ 3 activated direct clients</b> and <b>≥ 2 who deposit and trade</b> in the period. A Sub-IB with only their own account does not count.", "子代理需在期內擁有<b>≥ 3 位已激活直客</b>，且<b>≥ 2 位入金並交易</b>才計入；僅有自己帳戶的子代理不計入。"),
        ],
        notes: T(
          "“Mỗi Sub-IB anh/chị tuyển thêm làm tăng cả rebate lẫn bậc thưởng của cả nhánh.”",
          "“Every Sub-IB you add lifts both the rebate and the bonus tier for the whole branch.”",
          "「每增加一位子代理，整個分支的返傭和獎金級別都會提升。」"
        ),
      },

      m2: {
        part: "common",
        label: T("KM MIB", "MIB promo", "MIB 活動"),
        title: T("KM đặc biệt MIB: tới {v} mỗi tháng", "MIB special promo: up to {v} a month", "MIB 專屬活動：每月最高 {v}"),
        titleIb: T("KM tháng IB: tới {v} mỗi tháng", "IB monthly promo: up to {v} a month", "IB 月度活動：每月最高 {v}"),
        switchLabel: T("Chương trình", "Program", "計劃"),
        promoMib: T("KM đặc biệt MIB", "MIB special promo", "MIB 專屬活動"),
        promoIb: T("KM tháng IB", "IB monthly promo", "IB 月度活動"),
        exclusive: T(
          "<b>Chọn một trong hai:</b> MIB tham gia KM MIB thì MIB và Sub-IB trong nhánh không tham gia KM tháng IB cho khách trực tiếp (và ngược lại).",
          "<b>Pick one:</b> an MIB that joins the MIB promo, and the Sub-IBs in its branch, cannot also join the monthly IB promo for direct clients (and vice versa).",
          "<b>二選一：</b>MIB 參加 MIB 專屬活動後，MIB 及其分支內的子代理不能同時參加直客 IB 月度活動（反之亦然）。"
        ),
        edit: T("Tùy chỉnh bậc", "Customize tiers", "自訂級別"),
        editClose: T("Đóng bảng tùy chỉnh", "Close editor", "關閉編輯"),
        editHint: T(
          "Sửa số, thêm hoặc xóa bậc theo bản KM mới nhất. Thay đổi áp dụng cho biểu đồ này, máy tính và slide So sánh, và được nhớ trên trình duyệt.",
          "Edit the numbers, or add and remove tiers to match the latest promo. Changes apply to this chart, the calculator and the Compare slide, and are remembered in this browser.",
          "依最新活動修改數字、新增或刪除級別。變更會套用至此圖表、計算器與「比較」頁，並保存在此瀏覽器。"
        ),
        colDeposit: T("Net deposit (USD)", "Net deposit (USD)", "淨入金（美元）"),
        colLots: T("Lot", "Lots", "手數"),
        colReward: T("Thưởng (USD)", "Reward (USD)", "獎金（美元）"),
        addTier: T("Thêm bậc", "Add tier", "新增級別"),
        delTier: T("Xóa bậc", "Remove tier", "刪除級別"),
        resetTiers: T("Về mặc định", "Reset to default", "恢復預設"),
        presetLabel: T("Bộ bậc có sẵn", "Ready-made set", "現成級別組"),
        presetPdf5: T("5 bậc (PDF KM MIB tháng 10)", "5 tiers (October MIB promo PDF)", "5 級（10 月 MIB 活動 PDF）"),
        presetXls7: T("7 bậc (file khảo sát đối thủ)", "7 tiers (competitor research file)", "7 級（競爭對手調查檔）"),
        presetCustom: T("Tự nhập", "Custom", "自訂"),
        custom: T("Đã tùy chỉnh", "Customized", "已自訂"),
        warnLots: T("Có bậc cao hơn nhưng lot thấp hơn bậc trước", "A higher tier needs fewer lots than the tier before it", "較高級別所需手數低於前一級"),
        warnReward: T("Có bậc cao hơn nhưng thưởng thấp hơn bậc trước", "A higher tier pays less than the tier before it", "較高級別獎金低於前一級"),
        ib: {
          plain: T("Thưởng tháng theo net deposit và lot của khách trực tiếp.", "Monthly bonus by your direct clients' net deposit and lots.", "依直客的淨入金與手數發放月度獎金。"),
          axisNote: T("Mỗi nhóm: net deposit khách trực tiếp (USD) · lot yêu cầu", "Each group: direct-client net deposit (USD) · lots required", "每組：直客淨入金（美元）· 所需手數"),
          condsTitle: T("Điều kiện KM tháng IB", "Monthly IB promo conditions", "IB 月度活動條件"),
          conds: [
            T("Chỉ tính net deposit và lot của khách trực tiếp (không tính Sub-IB).", "Only your direct clients' net deposit and lots count (not Sub-IBs).", "僅計算直客的淨入金與手數（不含子代理）。"),
            T("Cần ít nhất 5 khách trực tiếp được kích hoạt, trong đó ít nhất 3 khách có nạp tiền và giao dịch trong kỳ.", "Needs at least 5 direct enabled clients, of which at least 3 deposit and trade in the period.", "至少需要 5 位已激活直客，其中至少 3 位於期內入金並交易。"),
            T("Net deposit = tổng nạp − tổng rebate (của mọi MIB và Sub-IB) − rút tiền trong kỳ.", "Net deposit = total deposits − all rebates (including MIBs and Sub-IBs) − withdrawals in the period.", "淨入金 = 總入金 − 全部返傭（含所有 MIB 與子代理）− 期內出金。"),
            T("Forex và kim loại quý tính 1 lot; chỉ số, dầu thô, crypto tính 1/10 lot; cổ phiếu không tính.", "Forex and bullion count as 1 lot; indices, crude oil and crypto count as 1/10 lot; shares are excluded.", "外匯與貴金屬計 1 手；股指、原油、加密貨幣計 1/10 手；股票不計。"),
            T("Lệnh giữ dưới 2 phút và lệnh hedging không tính vào lot.", "Trades held under 2 minutes and hedging trades don't count toward lots.", "持倉少於 2 分鐘的訂單及對沖訂單不計入手數。"),
            T("Tài khoản Cents chỉ tính net deposit, không tính lot.", "Cents accounts count net deposit only, not lots.", "Cents 帳戶僅計淨入金，不計手數。"),
            T("Nộp qua AM, thưởng về trong 14 ngày làm việc sau khi duyệt.", "Apply through your AM; the bonus is paid within 14 working days of approval.", "透過 AM 申請，審核通過後 14 個工作日內發放獎金。"),
          ],
        },
        legendIb: T("KM IB gộp nhánh (lot +50%)", "IB promo, branches combined (lots +50%)", "IB 活動分支合併（手數 +50%）"),
        legendMib: T("KM đặc biệt MIB", "MIB special promo", "MIB 專屬活動"),
        compare: T(
          "Với cùng ngưỡng net deposit và lot, KM đặc biệt MIB trả cao hơn <b>33–58%</b> so với cách gộp Sub-IB vào KM IB thường (ngưỡng lot tăng 50%).",
          "At the same net-deposit and lot thresholds, the MIB special promo pays <b>33–58% more</b> than rolling Sub-IBs into the standard IB promo (lot thresholds +50%).",
          "在相同淨入金與手數門檻下，MIB 專屬活動比將子代理併入一般 IB 活動高出 <b>33–58%</b>（手數門檻提高 50%）。"
        ),
        plain: T("Thưởng tháng theo bậc net deposit và lot của toàn nhánh.", "Monthly bonus by network-wide net deposit and lot tier.", "依整個體系的淨入金與手數級別發放月度獎金。"),
        office: T("Đổi lại, MIB phải chứng minh có văn phòng.", "In return, the MIB must show a physical office.", "相對地，MIB 需證明擁有實體辦公室。"),
        perMonth: T("mỗi tháng", "per month", "每月"),
        tierLine: T("bậc {d} net deposit · {l} lot", "tier: {d} net deposit · {l} lots", "級別：淨入金 {d} · {l} 手"),
        axisNote: T("Mỗi nhóm: net deposit toàn nhánh (USD) · lot yêu cầu", "Each group: network net deposit (USD) · lots required", "每組：體系淨入金（美元）· 所需手數"),
        source: T("Số liệu KM tháng 10/2026, minh họa.", "October 2026 promo figures, illustrative.", "2026 年 10 月活動數據，僅供示例。"),
        lot: T("lot", "lots", "手"),
        warn: T(
          "<b>Không cộng dồn:</b> MIB và Sub-IB trong nhánh không tham gia KM net deposit hàng tháng cho khách trực tiếp.",
          "<b>No stacking:</b> the MIB and the Sub-IBs in its branch cannot also join the monthly direct-client net-deposit promo.",
          "<b>不可疊加：</b>MIB 及其分支內的子代理不能同時參加直客月度淨入金活動。"
        ),
        notes: T(
          "“Cùng ngưỡng, KM đặc biệt MIB trả cao hơn hẳn so với gộp nhánh vào KM IB. Đổi lại MIB cần chứng minh có văn phòng.”<br>Quy tắc “gộp nhánh +50% lot” là Internal: chỉ bật meta.showInternal khi TMGM đã xác nhận.",
          "“At the same thresholds, the MIB special promo pays clearly more than rolling the branch into the IB promo. In return, the MIB needs to show an office.”<br>The “branch combined, lots +50%” rule is Internal: only turn on meta.showInternal once TMGM confirms.",
          "「在相同門檻下，MIB 專屬活動明顯高於將分支併入 IB 活動。相對地，MIB 需證明擁有辦公室。」<br>「分支合併、手數 +50%」屬內部規則：TMGM 確認後才開啟 meta.showInternal。"
        ),
      },

      m3: {
        hidden: true, // ẩn khỏi trang; xóa dòng này để hiện lại
        part: "mib",
        label: T("Điều kiện", "Rules", "條件"),
        title: T("Điều kiện rõ ràng, duyệt nhanh", "Clear conditions, fast approval", "條件清楚，審核快速"),
        office: T("Hồ sơ văn phòng", "Office documents", "辦公室文件"),
        officeItems: [
          { icon: "file", label: T("Hợp đồng thuê", "Lease agreement", "租約") },
          { icon: "building", label: T("Biển địa chỉ văn phòng", "Office address signage", "辦公室地址招牌") },
          { icon: "users", label: T("Ảnh nhân viên làm việc", "Photos of staff at work", "員工工作照片") },
        ],
        sub: T("Sub-IB hợp lệ", "Qualifying Sub-IB", "合格子代理"),
        subRule: T("≥ 3 khách kích hoạt, ≥ 2 hoạt động", "≥ 3 activated, ≥ 2 active clients", "≥ 3 位已激活、≥ 2 位活躍客戶"),
        net: T("Net deposit", "Net deposit", "淨入金"),
        netParts: [T("Nạp", "Deposits", "入金"), T("Rút", "Withdrawals", "出金"), T("Rebate", "Rebates", "返傭"), T("Net deposit", "Net deposit", "淨入金")],
        netNote: T("Rebate gồm toàn bộ rebate của MIB lẫn Sub-IB.", "Rebates include every MIB and Sub-IB rebate.", "返傭包括 MIB 與所有子代理的返傭。"),
        steps: [
          T("Gửi hồ sơ qua AM", "Submit documents via your AM", "透過 AM 提交文件"),
          T("Sales Manager duyệt", "Sales Manager approves", "銷售經理審核"),
          T("Thưởng về trong 14 ngày làm việc", "Bonus paid within 14 working days", "14 個工作日內發放獎金"),
        ],
        notes: T(
          "“Em sẽ chuẩn bị sẵn checklist hồ sơ; anh/chị chỉ cần gửi ảnh và hợp đồng.”",
          "“I'll prepare the document checklist — you just send the photos and the lease.”",
          "「我會準備好文件清單，您只需傳送照片和租約。」"
        ),
      },

      m4: {
        part: "common",
        label: T("Hoàn Swap", "Swap rebate", "隔夜利息"),
        title: T("Hoàn Swap: thêm dòng tiền từ khách giữ lệnh qua đêm", "Swap rebate: extra income from clients holding overnight", "隔夜利息返還：來自隔夜持倉客戶的額外收入"),
        weekly: T("30% mỗi tuần · trả thứ Tư", "30% weekly · paid Wednesdays", "每週 30% · 週三發放"),
        monthlyChip: T("30–50% mỗi tháng · theo net deposit", "30–50% monthly · by net deposit", "每月 30–50% · 依淨入金"),
        monthly: T("hoàn hàng tháng", "monthly rebate", "每月返還"),
        ibLine: T("Net deposit trên {v}", "Net deposit over {v}", "淨入金超過 {v}"),
        policy: T(
          "<b>Chính sách IB:</b> tính trên swap của khách trực tiếp. Hoàn tuần và hoàn tháng là hai khoản riêng.",
          "<b>IB policy:</b> based on direct clients' swap. The weekly and monthly rebates are separate payments.",
          "<b>IB 政策：</b>按直客隔夜利息計算。每週與每月返還為兩筆獨立款項。"
        ),
        treeFold: T("MIB muốn tính cả hệ thống?", "MIB counting the whole network?", "MIB 想以整個體系計算？"),
        treeRule: T(
          "MIB có thể tính swap và net deposit của cả hệ thống (khách trực tiếp và khách của Sub-IB). Khi đó ngưỡng net deposit của hoàn swap tháng tăng 50% (vượt {t} USD) và Sub-IB trong cây không được tham gia cùng lúc. Áp dụng 01/10–31/12/2026.",
          "An MIB may count swap and net deposit across the whole network (direct clients and Sub-IBs' clients). The monthly swap rebate thresholds then rise by 50% (over USD {t}) and Sub-IBs in that tree can't join at the same time. Valid 1 Oct–31 Dec 2026.",
          "MIB 可按整個體系（直客及子代理客戶）計算隔夜利息與淨入金。此時每月返還的淨入金門檻提高 50%（超過 {t} 美元），且該體系內的子代理不可同時參加。適用 2026/10/1–12/31。"
        ),
        art: T("Swap qua đêm của khách quay về ví IB", "Clients' overnight swap flowing back to the IB wallet", "客戶隔夜利息回流至 IB 錢包"),
        notes: T(
          "“Khách giữ lệnh qua đêm càng nhiều, dòng tiền này càng ổn định.”<br>Hoàn tuần và hoàn tháng là hai khoản riêng: không cộng thành “tới 80%”.",
          "“The more clients hold positions overnight, the steadier this stream gets.”<br>Weekly and monthly rebates are separate payments: don't add them up to “up to 80%”.",
          "「隔夜持倉的客戶越多，這筆收入越穩定。」<br>每週與每月返還是兩筆獨立款項：不要合計成「最高 80%」。"
        ),
      },

      m5: {
        part: "mib",
        label: T("Ví dụ", "Example", "示例"),
        title: T("Một tháng của MIB có 5 Sub-IB, 340.000 USD net deposit", "One month for an MIB with 5 Sub-IBs and USD 340,000 net deposit", "擁有 5 個子代理、淨入金 340,000 美元的 MIB 一個月"),
        sampleTitle: T("Ví dụ mẫu", "Sample case", "示例"),
        sample: [
          T("5 Sub-IB", "5 Sub-IBs", "5 個子代理"),
          T("340.000 USD net deposit", "USD 340,000 net deposit", "淨入金 340,000 美元"),
          T("2.400 lot (1.000 FX, 1.400 vàng)", "2,400 lots (1,000 FX, 1,400 gold)", "2,400 手（外匯 1,000、黃金 1,400）"),
          T("Tài khoản Prime", "Prime account", "Prime 帳戶"),
          T("Chia 70% rebate cho Sub-IB", "70% of rebate shared to Sub-IBs", "70% 返傭分給子代理"),
        ],
        sampleNote: T("Tỷ lệ chia do MIB tự thỏa thuận; chưa tính hoàn swap.", "The share is agreed by the MIB; swap rebates not included.", "分成比例由 MIB 自行約定；未計入隔夜利息返還。"),
        calcTitle: T("Số của anh/chị", "Your numbers", "您的數據"),
        inputs: {
          lotsFx: T("Lot FX / tháng", "FX lots / month", "外匯手數／月"),
          lotsGold: T("Lot vàng / tháng", "Gold lots / month", "黃金手數／月"),
          account: T("Loại tài khoản", "Account type", "帳戶類型"),
          deposit: T("Net deposit toàn nhánh (USD)", "Network net deposit (USD)", "體系淨入金（美元）"),
          share: T("Chia cho Sub-IB (%)", "Shared to Sub-IBs (%)", "分給子代理（%）"),
        },
        reset: T("Về ví dụ mẫu", "Reset to sample", "恢復示例"),
        bars: [
          T("Tổng rebate nhánh", "Network rebate", "體系總返傭"),
          T("Chia Sub-IB", "Paid to Sub-IBs", "分給子代理"),
          T("MIB giữ lại", "MIB keeps", "MIB 保留"),
          T("Thưởng KM MIB", "MIB promo bonus", "MIB 活動獎金"),
          T("Tổng MIB nhận", "MIB total", "MIB 總收入"),
        ],
        ecnBar: T("ECN Q4 (Edge)", "Q4 ECN (Edge)", "ECN Q4（Edge）"),
        swapBar: T("Hoàn swap", "Swap rebate", "隔夜利息返還"),
        addonsLabel: T("Add-on (mặc định tắt)", "Add-ons (off by default)", "附加項目（預設關閉）"),
        addonEcn: T("ECN Q4 (chỉ Edge)", "Q4 ECN boost (Edge only)", "ECN Q4 加碼（僅 Edge）"),
        addonSwap: T("Hoàn swap", "Swap rebate", "隔夜利息返還"),
        swapFee: T("Phí swap khách trực tiếp trả / tháng (USD)", "Swap fees direct clients pay / month (USD)", "直客每月支付的隔夜利息（美元）"),
        swapNd: T("Net deposit khách trực tiếp (USD)", "Direct-client net deposit (USD)", "直客淨入金（美元）"),
        swapWeekly: T("Hoàn swap tuần (30%)", "Weekly swap rebate (30%)", "每週隔夜利息返還（30%）"),
        swapMonthly: T("Hoàn swap tháng ({p}%)", "Monthly swap rebate ({p}%)", "每月隔夜利息返還（{p}%）"),
        swapMonthlyNone: T("Hoàn swap tháng (chưa vượt 5.000 USD)", "Monthly swap rebate (not over USD 5,000 yet)", "每月隔夜利息返還（尚未超過 5,000 美元）"),
        swapNote: T(
          "Hoàn swap tính trên khách trực tiếp; MIB giữ 100%, chưa chia Sub-IB. Phí swap và net deposit ở trên chỉ là số minh họa.",
          "Swap rebates are based on direct clients; the MIB keeps 100%, nothing shared with Sub-IBs. The swap fees and net deposit above are illustrative.",
          "隔夜利息返還按直客計算；MIB 全額保留，未分給子代理。上方隔夜利息與淨入金僅為示例。"
        ),
        baseTotal: T("Tổng cơ bản (chưa add-on)", "Base total (no add-ons)", "基本合計（未含附加項目）"),
        withAddons: T("Tổng có add-on", "Total with add-ons", "含附加項目合計"),
        ecnIn: T("Gồm ECN Q4 cộng thêm <b>{v}</b>, MIB giữ 100%.", "Includes the Q4 ECN boost of <b>{v}</b>, kept 100% by the MIB.", "已含 ECN Q4 加碼 <b>{v}</b>，MIB 全額保留。"),
        ecnNote: T("ECN Q4 ước tính trên net deposit toàn nhánh; TMGM tính theo khách trực tiếp của từng IB nên số thực có thể thấp hơn.", "The Q4 ECN boost is estimated on network net deposit; TMGM calculates it per IB on direct clients, so the actual amount may be lower.", "ECN Q4 以體系淨入金估算；TMGM 按各 IB 直客計算，實際金額可能較低。"),
        ecnHint: T("Chọn tài khoản Edge để cộng thêm ECN Q4 (tới 5 USD/lot Forex, đến 31/12).", "Choose Edge to add the Q4 ECN boost (up to USD 5/lot on FX, until 31 Dec).", "選擇 Edge 帳戶即可加計 ECN Q4 加碼（外匯最高 5 美元/手，至 12 月 31 日）。"),
        legend: T("xanh = cộng thêm · đỏ = chia ra", "green = added · red = paid out", "綠色 = 增加 · 紅色 = 分出"),
        tier: T("Bậc đạt: {d} net deposit · {l} lot", "Tier reached: {d} net deposit · {l} lots", "已達級別：淨入金 {d} · {l} 手"),
        noTier: T("Chưa đạt bậc đầu ({d} · {l} lot)", "Below the first tier ({d} · {l} lots)", "未達第一級（{d} · {l} 手）"),
        nextTier: T("Lên bậc {r}: cần thêm {need}.", "To reach the {r} tier: {need} more.", "升至 {r} 級別還需：{need}。"),
        needLots: T("{l} lot", "{l} lots", "{l} 手"),
        needDep: T("{d} net deposit", "{d} net deposit", "淨入金 {d}"),
        and: T(" và ", " and ", " 及 "),
        topTier: T("Đã đạt bậc cao nhất.", "Top tier reached.", "已達最高級別。"),
        gross: T("Net deposit đã trừ rebate, nên tổng nạp trừ rút cần khoảng <b>{g}</b>.", "Net deposit is after rebates, so deposits minus withdrawals need to be about <b>{g}</b>.", "淨入金已扣除返傭，因此入金減出金需約 <b>{g}</b>。"),
        noSwap: T("Chưa tính hoàn swap.", "Swap rebates not included.", "未計入隔夜利息返還。"),
        notes: T(
          "“Thưởng KM gấp đôi phần rebate MIB giữ lại; đây là lý do nên đăng ký đúng chương trình MIB.”<br>Mời đối tác nhập số thực của hệ thống (đã hỏi ở slide 1) vào ô “Số của anh/chị”. Add-on mặc định tắt: chọn Edge rồi bật ECN Q4, hoặc bật Hoàn swap để thấy phần cộng thêm.",
          "“The promo bonus is double what the MIB keeps from rebates — that's why registering for the right MIB program matters.”<br>Invite the partner to enter their real network numbers (asked on slide 1) under “Your numbers”. Add-ons are off by default: choose Edge and switch on the Q4 ECN boost, or switch on the swap rebate, to show the extras.",
          "「活動獎金是 MIB 保留返傭的兩倍，這就是為什麼要報名正確的 MIB 計劃。」<br>請合作夥伴在「您的數據」中輸入體系的真實數字（第 1 頁已詢問）。附加項目預設關閉：選擇 Edge 並開啟 ECN Q4 加碼，或開啟隔夜利息返還，即可顯示額外收入。"
        ),
      },

      "so-sanh": {
        part: "mib",
        label: T("So sánh", "Compare", "比較"),
        title: T("So tổng thu nhập, không so một dòng rebate", "Compare total income, not a single rebate line", "比較總收入，而不是單一返傭"),
        clsLabel: T("Nhóm tài khoản", "Account group", "帳戶類別"),
        std: T("Standard", "Standard", "Standard"),
        raw: T("Raw/ECN", "Raw/ECN", "Raw/ECN"),
        legendKeep: T("Rebate MIB giữ lại", "Rebate the MIB keeps", "MIB 保留返傭"),
        legendPromo: T("KM / thưởng của sàn", "Broker promo / reward", "平台活動／獎勵"),
        legendEcn: T("ECN Q4", "Q4 ECN boost", "ECN Q4 加碼"),
        meta: T("Rebate {r} · khách trả {c} USD/lot (FX/vàng)", "Rebate {r} · client pays {c} USD/lot (FX/gold)", "返傭 {r} · 客戶每手成本 {c} 美元（外匯／黃金）"),
        counting: T("Đang tính:", "Counting:", "目前計入："),
        tagMibPromo: T("KM MIB", "MIB promo", "MIB 活動"),
        tagEcn: T("ECN Q4", "Q4 ECN", "ECN Q4"),
        noSwap: T(
          "Hoàn swap không tính ở bảng này: khách của 5 trong 7 sàn khảo sát và của VT Markets có thể dùng tài khoản swap-free, khách TMGM thì không.",
          "Swap rebates are not counted here: clients at 5 of the 7 surveyed brokers and at VT Markets can use swap-free accounts, TMGM clients can't.",
          "此表不計隔夜利息返還：調查的 7 家平台中有 5 家及 VT Markets 的客戶可使用免隔夜利息帳戶，TMGM 客戶則不能。"
        ),
        notesFold: T("Ghi chú và nguồn", "Notes and sources", "說明與來源"),
        viewLabel: T("Cách xem", "View", "檢視方式"),
        viewRank: T("Xếp hạng", "Ranking", "排名"),
        viewH2h: T("Đối đầu", "Head-to-head", "對決"),
        h2hAccount: T("Tài khoản TMGM", "TMGM account", "TMGM 帳戶"),
        h2hBroker: T("Sàn so sánh", "Compare with", "比較平台"),
        h2hGroup: T("Nhóm tài khoản", "Account group", "帳戶類別"),
        h2hRateFx: T("Rebate FX (USD/lot)", "FX rebate (USD/lot)", "外匯返傭（美元/手）"),
        h2hRateGold: T("Rebate vàng (USD/lot)", "Gold rebate (USD/lot)", "黃金返傭（美元/手）"),
        h2hExtra: T("Thưởng thêm mỗi tháng (USD)", "Extra monthly bonus (USD)", "每月額外獎金（美元）"),
        h2hEcn: T("Cộng ECN Q4 (chỉ Edge)", "Add Q4 ECN (Edge only)", "加入 ECN Q4（僅 Edge）"),
        h2hCopy: T("Copy số từ TMGM", "Copy TMGM numbers", "複製 TMGM 數字"),
        h2hMonthly: T("USD / tháng", "USD / month", "美元／月"),
        h2hSub: T("Sub-IB nhận {v}", "Sub-IBs get {v}", "子代理獲得 {v}"),
        h2hCostUs: T("Khách trả {c} USD/lot (FX/vàng) · ≈{n} sau Points", "Client pays {c} USD/lot (FX/gold) · ≈{n} after Points", "客戶每手成本 {c} 美元（外匯／黃金）· 扣點數後 ≈{n}"),
        h2hCost: T("Khách trả {c} USD/lot (FX/vàng)", "Client pays {c} USD/lot (FX/gold)", "客戶每手成本 {c} 美元（外匯／黃金）"),
        h2hNoCost: T("Chưa có số chi phí khách", "No client cost data yet", "尚無客戶成本數據"),
        h2hAhead: T("{n} hơn", "{n} ahead", "{n} 領先"),
        h2hEqual: T("Bằng nhau", "Even", "持平"),
        h2hPerMonth: T("mỗi tháng", "per month", "每月"),
        h2hNeedRate: T("Nhập rebate FX và vàng của {n} để so sánh.", "Enter {n}'s FX and gold rebates to compare.", "請輸入 {n} 的外匯與黃金返傭以進行比較。"),
        h2hEmpty: T("Chưa có thu nhập", "No income yet", "尚無收入"),
        h2hProfile: T("Năng lực của {n}", "What {n} offers", "{n} 的實力"),
        h2hOther: T("Sàn khác (tự nhập số)", "Others (enter your own numbers)", "其他平台（自行輸入）"),
        h2hOtherName: T("Tên sàn", "Broker name", "平台名稱"),
        h2hOtherDefault: T("Sàn khác", "Other broker", "其他平台"),
        h2hCostFx: T("Chi phí khách FX (USD/lot)", "Client cost FX (USD/lot)", "客戶外匯成本（美元/手）"),
        h2hCostGold: T("Chi phí khách vàng (USD/lot)", "Client cost gold (USD/lot)", "客戶黃金成本（美元/手）"),
        estTag: T("ước tính", "estimate", "估算"),
        h2hNote: T(
          "Mỗi bên nhập số riêng, không ảnh hưởng máy tính ở slide Ví dụ. Rebate của sàn khác lấy từ file khảo sát và sửa được; KM của sàn đó tính theo điều kiện trong khảo sát, cộng thêm ô Thưởng thêm. Vòng tròn chỉ gồm thu nhập MIB; phần Sub-IB ghi bên dưới.",
          "Each side has its own numbers and doesn't change the Example calculator. The other broker's rebates come from the survey file and can be edited; its promo follows the survey terms, plus the Extra bonus field. Donuts show MIB income only; the Sub-IB share is listed below.",
          "兩邊各自輸入數字，不影響「示例」頁的計算器。其他平台的返傭取自調查檔，可修改；其活動依調查條件計算，另加「額外獎金」欄。圓環只含 MIB 收入；子代理部分列於下方。"
        ),
        pointsNote: T(
          "Dòng TMGM ghi thêm chi phí khách sau Points (trừ {r} USD/lot); chưa trừ chương trình điểm hoặc cashback cho khách của các sàn khác. Points không đổi thu nhập MIB.",
          "The TMGM row also shows client cost after Points (minus USD {r}/lot); other brokers' client points or cashback schemes are not deducted. Points don't change MIB income.",
          "TMGM 一列另列扣點數後的客戶成本（每手減 {r} 美元）；其他平台的客戶點數或現金回贈未扣除。點數不影響 MIB 收入。"
        ),
        pending: T("Đang cập nhật", "Updating", "更新中"),
        pctRebate: T("{p}% chi phí khách ≈ {r}", "{p}% of client cost ≈ {r}", "客戶成本的 {p}% ≈ {r}"),
        sync: T("Dùng chung số với slide Ví dụ.", "Shares the numbers with the Example slide.", "與「示例」頁共用數據。"),
        only: T(
          "<b>Trong 8 sàn khảo sát, chỉ TMGM có chương trình thưởng tháng riêng cho MIB.</b>",
          "<b>Of the 8 brokers surveyed, only TMGM has a monthly bonus program built for MIBs.</b>",
          "<b>在調查的 8 家平台中，只有 TMGM 設有 MIB 專屬月度獎金計劃。</b>"
        ),
        notCounted: T(
          "Chi phí khách là số minh họa, spread thả nổi. Vantage Standard trả rebate theo % chi phí khách, quy đổi ra USD/lot. Thưởng trọn đời của Exness và Axi quy đổi ra USD/lot. Chưa tính: cashback 3 USD/lot 2 tháng đầu của AvaTrade, markup của PU Prime, hoàn swap.",
          "Client costs are illustrative; spreads float. Vantage Standard pays rebates as a % of client cost, converted to USD/lot. Exness and Axi lifetime rewards are converted to USD/lot. Not counted: AvaTrade's USD 3/lot cashback for the first 2 months, PU Prime markup, swap rebates.",
          "客戶成本為示例，點差浮動。Vantage Standard 按客戶成本百分比返傭，已折算為每手美元。Exness 與 Axi 的終身獎勵已折算為每手美元。未計入：AvaTrade 首 2 個月每手 3 美元現金回贈、PU Prime 加點、隔夜利息返還。"
        ),
        source: T(
          "Nguồn: khảo sát 7 sàn khu vực Đông Nam Á của TMGM; XM: chương trình đối tác XM (10% hoa hồng Sub-IB); EC Markets, VT Markets: nguồn công khai, ước tính (xem cách Đối đầu).",
          "Source: TMGM survey of 7 brokers in Southeast Asia; XM: XM partner program (10% of Sub-IB commissions); EC Markets, VT Markets: public sources, estimates (see Head-to-head).",
          "來源：TMGM 東南亞 7 家平台調查；XM：XM 合作夥伴計劃（子代理佣金 10%）；EC Markets、VT Markets：公開資料，為估算（見「對決」）。"
        ),
        notes: T(
          "“Anh/chị đừng so một dòng rebate. Cùng hệ thống này, đây là số MIB nhận mỗi tháng ở từng sàn.”<br>Phần xanh lá là KM: TMGM đứng đầu nhờ KM riêng cho MIB, không phải nhờ rebate gốc. Nói rõ cột chi phí khách: TMGM STD đắt hơn cho khách, Edge ở mức giữa. Bấm Standard / Raw/ECN để đổi nhóm tài khoản.",
          "“Don't compare a single rebate line. For this same network, here's what the MIB earns each month at each broker.”<br>The green part is promo: TMGM leads because of its MIB promo, not its base rebate. Be upfront about client cost: TMGM STD costs clients more, Edge sits mid-pack. Click Standard / Raw/ECN to switch account group.",
          "「不要只比一條返傭。同樣的體系，這是 MIB 在每家平台每月的收入。」<br>綠色部分是活動：TMGM 領先靠的是 MIB 專屬活動，而非基本返傭。請坦白說明客戶成本：TMGM STD 對客戶較貴，Edge 居中。點擊 Standard / Raw/ECN 切換帳戶類別。"
        ),
      },

      ib: {
        hidden: true, // ẩn khỏi trang theo yêu cầu (nội dung IB nằm trong slide KM, tab "KM tháng IB"); xóa dòng này để hiện lại
        part: "ib",
        label: T("IB", "IB", "IB"),
        title: T("IB: đủ 5 khách là vào được chương trình thưởng tháng", "IB: five clients gets you into the monthly bonus", "IB：滿 5 位客戶即可參加月度獎金"),
        photo: T("TP. Hồ Chí Minh về đêm, tháp Landmark 81 bên sông Sài Gòn", "Ho Chi Minh City at night, Landmark 81 beside the Saigon River", "夜晚的胡志明市，西貢河畔的 Landmark 81 大樓"),
        cards: [
          { icon: "users", num: T("5 khách", "5 clients", "5 位客戶"), label: T("3 khách hoạt động là đủ điều kiện", "3 active clients to qualify", "3 位活躍客戶即符合資格"), key: true },
          { icon: "trophy", num: T("260–15.000 USD", "USD 260–15,000", "260–15,000 美元"), label: T("thưởng tháng theo net deposit và lot", "monthly bonus by net deposit and lots", "依淨入金與手數發放月度獎金") },
          { icon: "moon", num: T("30% + tới 50%", "30% + up to 50%", "30% + 最高 50%"), label: T("hoàn Swap tuần và tháng", "weekly and monthly swap rebate", "每週及每月隔夜利息返還") },
          { icon: "gift", num: T("Quà cho khách", "Client rewards", "客戶禮品"), label: T("Apple Watch → MacBook Pro, hoặc nhận 70% tiền mặt", "Apple Watch → MacBook Pro, or take 70% in cash", "Apple Watch → MacBook Pro，或領取 70% 現金") },
        ],
        details: T(
          "Thưởng tháng từ 260 USD (net deposit 17.000 USD, 85 lot) đến 15.000 USD (500.000 USD, 2.200 lot), chỉ tính khách trực tiếp. Hoàn Swap 30% mỗi tuần, thêm 30%, 40% hoặc 50% mỗi tháng khi net deposit trên 5.000, 10.000 hoặc 30.000 USD. Quà cho khách từ Apple Watch (10.000 USD, 100 lot) đến MacBook Pro (50.000 USD, 550 lot).",
          "Monthly bonus from USD 260 (USD 17,000 net deposit, 85 lots) to USD 15,000 (USD 500,000, 2,200 lots), direct clients only. Swap rebate of 30% weekly, plus 30%, 40% or 50% monthly when net deposit is over USD 5,000, 10,000 or 30,000. Client rewards from Apple Watch (USD 10,000, 100 lots) to MacBook Pro (USD 50,000, 550 lots).",
          "月度獎金由 260 美元（淨入金 17,000 美元、85 手）至 15,000 美元（500,000 美元、2,200 手），僅計直客。隔夜利息每週返還 30%，淨入金超過 5,000、10,000 或 30,000 美元時，每月再返還 30%、40% 或 50%。客戶禮品由 Apple Watch（10,000 美元、100 手）至 MacBook Pro（50,000 美元、550 手）。"
        ),
        mibNote: T(
          "Nếu MIB tham gia KM đặc biệt MIB, Sub-IB trong nhánh sẽ không nhận thưởng tháng riêng.",
          "If the MIB joins the MIB special promo, Sub-IBs in its branch don't receive a separate monthly bonus.",
          "若 MIB 參加 MIB 專屬活動，其分支內的子代理不會另外獲得月度獎金。"
        ),
        notes: T(
          "“Đây là chính sách cho IB cá nhân.” Chi tiết gửi kèm tài liệu sau buổi gặp.",
          "“This is the policy for individual IBs.” Send the details as a follow-up document after the meeting.",
          "「這是個人 IB 的政策。」詳細內容會後以文件寄送。"
        ),
      },

      "uu-dai": {
        part: "common",
        label: T("Ưu đãi cho khách", "Client offers", "客戶優惠"),
        title: T("Khách của anh/chị cũng được thưởng", "Your clients get rewarded too", "您的客戶也有獎勵"),
        lead: T(
          "Hai ưu đãi chính cho khách: Points cho mọi khách và Cashback Q4 cho khách cũ nạp thêm. Khách nhận, không phải thu nhập của đối tác.",
          "Two main client offers: Points for every client and Q4 cashback for existing clients who add funds. Clients receive these; they are not partner income.",
          "兩項主要客戶優惠：點數適用所有客戶，Q4 現金回贈適用加碼入金的舊客戶。由客戶領取，並非合作夥伴收入。"
        ),
        ptsBadge: T("Luôn bật · đã tính vào chi phí khách", "Always on · counted in client cost", "常態 · 已計入客戶成本"),
        ptsBig: T("10 điểm / lot", "10 points / lot", "每手 10 點"),
        ptsRate: T("≈ {r} USD/lot (ước tính thận trọng: {p} điểm đổi {u} USD cashback)", "≈ USD {r}/lot (conservative: {p} points redeem USD {u} cashback)", "約每手 {r} 美元（保守估算：{p} 點兌換 {u} 美元現金回贈）"),
        ptsUnit: T("điểm", "pts", "點"),
        ptsRules: [
          T("Forex, vàng: 1 lot = 10 điểm · chỉ số, dầu, crypto: 10 lot = 10 điểm · cổ phiếu không tính", "FX, gold: 1 lot = 10 points · indices, oil, crypto: 10 lots = 10 points · shares excluded", "外匯、黃金：1 手 = 10 點 · 股指、原油、加密貨幣：10 手 = 10 點 · 股票不計"),
          T("Lệnh đã đóng, giữ ≥ 2 phút · điểm về ví hôm sau · không hết hạn", "Closed trades held ≥ 2 minutes · points land the next day · never expire", "持倉 ≥ 2 分鐘的已平倉訂單 · 次日入帳 · 永不過期"),
          T("Tính theo portal, mọi loại tài khoản · chưa tự kích hoạt thì nhờ AM bật", "Counted per portal, all account types · if not auto-activated, ask your AM", "按 Portal 計算，不分帳戶類型 · 未自動啟用可請 AM 開通"),
        ],
        cbTitle: T("Cashback Q4", "Q4 cashback", "Q4 現金回贈"),
        cbBadge: T("Tới 500 USD/khách", "Up to USD 500 per client", "每位客戶最高 500 美元"),
        cbPeriod: T("Nạp 1/10–31/12/2026 · lot tính tới 31/3/2027", "Deposits 1 Oct–31 Dec 2026 · lots count until 31 Mar 2027", "入金 2026/10/1–12/31 · 手數計至 2027/3/31"),
        cbStair: T("{d} · {l} lot", "{d} · {l} lots", "{d} · {l} 手"),
        cbRules: [
          T("Khách bấm “Sign Up Now” trên trang Promotions của Portal trước khi nạp; nạp và lot chỉ tính sau khi đăng ký", "The client clicks “Sign Up Now” on the Portal Promotions page before depositing; deposits and lots only count after sign-up", "客戶須先在 Portal 活動頁點擊「Sign Up Now」再入金；報名後的入金與手數才計入"),
          T("Bậc lũy kế: đạt bậc nào đổi ngay bậc đó, tiền về tài khoản giao dịch ngay", "Cumulative tiers: each tier is redeemable as soon as it's reached, paid to the trading account immediately", "累進級別：達標即可兌換，即時入帳至交易帳戶"),
          T("Chỉ tính nạp mới, không tính chuyển nội bộ; tài khoản Cent chỉ tính net deposit", "New deposits only, no internal transfers; Cent accounts count net deposit only", "僅計新入金，不含內部轉帳；美分帳戶只計淨入金"),
        ],
        cbAsk: T(
          "Chỉ dành cho khách đã nạp trước 01/10/2026. Bản cashback cho khách mới không áp dụng Việt Nam (chỉ ID, LA, MY, PH): với khách mới, xem Rocket, Halloween hoặc Gadget ở slide Ưu đãi khác.",
          "Only for clients who deposited before 1 Oct 2026. The new-client cashback version doesn't cover Vietnam (ID, LA, MY, PH only): for new clients, see Rocket, Halloween or Gadget on the More promotions slide.",
          "僅限 2026/10/1 前已入金的客戶。新客戶版現金回贈不適用越南（僅 ID、LA、MY、PH）：新客戶請參考「其他優惠」頁的 Rocket、萬聖節或 Gadget。"
        ),
        calcTitle: T("Khách nhận lại bao nhiêu?", "What does the client get back?", "客戶能拿回多少？"),
        inputs: {
          deposit: T("Net deposit của khách trong Q4 (USD)", "Client's Q4 net deposit (USD)", "客戶 Q4 淨入金（美元）"),
          lots: T("Lot chuẩn trong kỳ", "Standard lots in the period", "期間標準手數"),
        },
        outCb: T("Cashback Q4 · bậc {t}", "Q4 cashback · tier {t}", "Q4 現金回贈 · 第 {t} 級"),
        outCbNone: T("Cashback Q4 · chưa đạt bậc 1", "Q4 cashback · tier 1 not reached", "Q4 現金回贈 · 未達第 1 級"),
        outPts: T("Points · {p} điểm", "Points · {p} points", "點數 · {p} 點"),
        outTotal: T("Khách nhận lại", "Client gets back", "客戶拿回"),
        outPerLot: T("≈ {r} USD mỗi lot", "≈ USD {r} per lot", "約每手 {r} 美元"),
        outEdge: T("Chi phí Edge FX: {c} → ≈{n} USD/lot", "Edge FX cost: {c} → ≈{n} USD/lot", "Edge 外匯成本：{c} → 約 {n} 美元/手"),
        outNext: T("Lên bậc {t} (+{u}): thêm {d} net deposit và {l} lot", "Tier {t} (+{u}): {d} more net deposit and {l} more lots", "升至第 {t} 級（+{u}）：再淨入金 {d}、{l} 手"),
        outMax: T("Đã đạt bậc cao nhất", "Top tier reached", "已達最高級"),
        calcNote: T(
          "Số minh họa. Cashback chỉ tính net deposit nạp trong kỳ; Points tính trên mọi lot, quy đổi theo bảng cashback.",
          "Illustrative. Cashback counts only net deposits made in the period; Points count every lot, valued at the cashback catalog rate.",
          "示例數字。現金回贈只計期間內的淨入金；點數計入所有手數，按現金回贈兌換表折算。"
        ),
        reset: T("Về số mặc định", "Reset to defaults", "恢復預設"),
        moreLink: T("Xem thêm ưu đãi khác (khách mới, credit, quà, vé)", "See more promotions (new clients, credit, gadgets, tickets)", "查看其他優惠（新客戶、贈金、數碼產品、門票）"),
        source: T(
          "Nguồn: TMGM Points Rewards FAQ; trang TMGM Rewards (ảnh chụp 9/10/2026); 2026 Q4 Client Cashback Promotion – SEA Korea; Weekly Update 28/09–04/10/2026.",
          "Sources: TMGM Points Rewards FAQ; TMGM Rewards page (screenshot, 9 Oct 2026); 2026 Q4 Client Cashback Promotion – SEA Korea; Weekly Update 28 Sep–4 Oct 2026.",
          "來源：TMGM 點數獎勵 FAQ；TMGM Rewards 頁面（2026/10/9 截圖）；2026 Q4 客戶現金回贈活動（東南亞及韓國）；2026/9/28–10/4 每週更新。"
        ),
        notes: T(
          "“Trước khi bắt đầu: khách của anh/chị cũng được thưởng, nên đội sales có thêm lý do để chốt.”<br>Points luôn bật và đã trừ vào chi phí khách ở slide Tài khoản và So sánh. Cashback Q4 chỉ cho khách đã nạp trước 1/10, tối đa 500 USD. Khách mới: chuyển sang slide Ưu đãi khác.",
          "“Before we start: your clients get rewarded too, which gives your sales team one more reason to close.”<br>Points are always on and already deducted from client cost on the Accounts and Compare slides. Q4 cashback is only for clients who deposited before 1 Oct, up to USD 500. New clients: go to the More promotions slide.",
          "「開始之前：您的客戶也有獎勵，業務團隊多一個成交理由。」<br>點數常態開啟，已在「帳戶」與「比較」頁扣除客戶成本。Q4 現金回贈僅限 10/1 前已入金的客戶，最高 500 美元。新客戶：請見「其他優惠」頁。"
        ),
      },

      "km-khac": {
        part: "common",
        label: T("Ưu đãi khác", "More promotions", "其他優惠"),
        title: T("Các ưu đãi phụ đang chạy", "Other promotions running now", "其他進行中的優惠"),
        lead: T(
          "Bấm từng dòng để xem điều kiện. Các ưu đãi này không tính vào số nào ở các slide trước.",
          "Click a row to see the conditions. None of these are counted in the earlier slides.",
          "點擊各列查看條件。以下優惠均未計入前面頁面的數字。"
        ),
        filterLabel: T("Lọc ưu đãi", "Filter promotions", "篩選優惠"),
        fAll: T("Tất cả", "All", "全部"),
        fSmall: T("Ưu đãi nhỏ", "Small offers", "小型優惠"),
        fMkt: T("Marketing", "Marketing", "行銷"),
        private: T("Chỉ chia sẻ riêng", "Private only", "僅限私下分享"),
        showPrivate: T("Hiện mục chỉ chia sẻ riêng ({n})", "Show private-only ({n})", "顯示僅限私下分享（{n}）"),
        privateWarn: T(
          "Mục “Chỉ chia sẻ riêng”: chỉ nói riêng với khách hoặc IB đủ điều kiện, không đăng mạng xã hội. Vé có hạn, không đổi tiền, không chuyển nhượng. Không in ra PDF.",
          "“Private only” items: share only privately with eligible clients or IBs, never on social media. Tickets are limited, not exchangeable for cash, not transferable. Not included when printing.",
          "「僅限私下分享」項目：只可私下告知合資格客戶或 IB，不得發布到社群媒體。門票數量有限，不可兌現或轉讓。列印時不包含。"
        ),
        until: T("đến {d}", "until {d}", "至 {d}"),
        left: T("còn {n} ngày", "{n} days left", "剩 {n} 天"),
        lastDay: T("hôm nay là ngày cuối", "last day today", "今天截止"),
        from: T("từ {d}", "from {d}", "{d} 起"),
        link: T("Trang chương trình", "Promotion page", "活動頁面"),
        empty: T("Không còn ưu đãi nào trong mục này.", "No promotions left in this group.", "此分類暫無優惠。"),
        shared: T(
          "Các khuyến mãi online không dùng chung nạp và lot với nhau; khuyến mãi online và offline (qua AM) dùng chung được nếu T&C không cấm. Tài khoản Cent chỉ tính net deposit.",
          "Online promotions can't share deposits or lots with each other; online and offline (via AM) promotions can, unless the T&C says otherwise. Cent accounts count net deposit only.",
          "線上活動之間不可共用入金與手數；線上與線下（經 AM）活動除條款另有規定外可共用。美分帳戶只計淨入金。"
        ),
        source: T(
          "Nguồn: TMGM Sales Zendesk, Weekly Update 28/09–04/10/2026 và T&C từng chương trình (kiểm tra 09/10/2026). Mục hết hạn tự ẩn.",
          "Sources: TMGM Sales Zendesk, Weekly Update 28 Sep–4 Oct 2026 and each promotion's T&C (checked 9 Oct 2026). Expired items hide automatically.",
          "來源：TMGM Sales Zendesk、2026/9/28–10/4 每週更新及各活動條款（2026/10/9 核對）。過期項目自動隱藏。"
        ),
        notes: T(
          "“Ngoài các khoản chính, TMGM còn nhiều ưu đãi nhỏ giúp đội sales chốt khách.”<br>Chỉ mở dòng nào đối tác hỏi. Khách mới: Rocket, Halloween, Gadget. Vé concert/Premier League chỉ nói riêng, không đưa lên mạng xã hội.",
          "“Beyond the main streams, TMGM runs smaller offers that help your sales team close.”<br>Only open the rows the partner asks about. New clients: Rocket, Halloween, Gadget. Concert and Premier League tickets are private only, never on social media.",
          "「除主要收入外，TMGM 還有不少小型優惠幫助業務成交。」<br>只展開合作夥伴問到的項目。新客戶：Rocket、萬聖節、Gadget。演唱會與英超門票僅限私下分享，不得發布到社群媒體。"
        ),
      },
      "bat-dau": {
        part: "close",
        label: T("Bắt đầu", "Get started", "開始"),
        title: T("Bắt đầu hôm nay: rebate về từ T+1", "Start today: rebates arrive from T+1", "今天就開始：返傭 T+1 到帳"),
        timeline: [
          {
            icon: "link", when: T("Ngày 1", "Day 1", "第 1 天"),
            what: {
              mib: T("Mở tài khoản MIB, nhận IB link, chọn loại tài khoản cho từng tệp khách", "Open the MIB account, get your IB link, choose account types per client segment", "開立 MIB 帳戶、取得 IB 連結、為各類客戶選擇帳戶類型"),
              ib: T("Mở tài khoản IB, nhận IB link, chọn loại tài khoản cho từng tệp khách", "Open the IB account, get your IB link, choose account types per client segment", "開立 IB 帳戶、取得 IB 連結、為各類客戶選擇帳戶類型"),
            },
          },
          { icon: "user", when: T("Tuần 1", "Week 1", "第 1 週"), what: T("Khách đầu tiên mở tài khoản, đăng ký ưu đãi trên Portal trước khi nạp; rebate cơ bản về T+1 sau lệnh đầu tiên", "First clients open accounts and register for offers on the Portal before depositing; the base rebate arrives T+1 after the first trade", "首批客戶開戶，入金前在 Portal 登記優惠；首筆交易後基本返傭 T+1 到帳"), key: true },
          {
            icon: "building", when: T("Tuần 2–4", "Weeks 2–4", "第 2–4 週"),
            what: {
              mib: T("Nộp hồ sơ văn phòng, kích hoạt Sub-IB (mỗi Sub-IB ≥ 3 khách kích hoạt, ≥ 2 hoạt động)", "Submit office documents, activate Sub-IBs (each ≥ 3 activated, ≥ 2 active clients)", "提交辦公室文件，激活子代理（每個 ≥ 3 位已激活、≥ 2 位活躍客戶）"),
              ib: T("Đạt 5 khách trực tiếp, trong đó 3 khách hoạt động", "Reach 5 direct clients, 3 of them active", "達到 5 位直客，其中 3 位活躍"),
            },
          },
          { icon: "file", when: T("Cuối tháng", "Month end", "月底"), what: T("AM nộp đơn KM", "Your AM files the promo claim", "AM 提交活動申請") },
          { icon: "coins", when: T("Đầu tháng sau", "Early next month", "下月初"), what: T("ECN Q4 về trong 5 ngày làm việc, Swap tháng trước ngày 14, thưởng tháng trong 14 ngày làm việc sau duyệt", "Q4 ECN within 5 working days, monthly swap before the 14th, bonus within 14 working days of approval", "ECN Q4 於 5 個工作日內發放，隔夜利息於 14 日前，月度獎金於審核後 14 個工作日內") },
        ],
        firstPay: T("Khoản tiền đầu tiên", "First payout", "第一筆收入"),
        notes: T(
          "“Em muốn anh/chị giới thiệu TMGM với đúng những gì TMGM làm được. ECN Q4 chạy đến 31/12, mỗi tháng chậm là một tháng mất phần rebate tăng thêm.”<br>Bấm “Đăng ký ngay” để mở tài khoản đối tác ngay trong buổi gặp, hoặc để họ điền form liên hệ để hẹn buổi tiếp theo.",
          "“I want you to introduce TMGM for exactly what TMGM delivers. The Q4 ECN boost runs until 31 Dec — every month of delay is a month of boosted rebate lost.”<br>Click “Register now” to open the partner account during the meeting, or have them fill in the contact form to set the next meeting.",
          "「我希望您按照 TMGM 實際能做到的來介紹 TMGM。ECN Q4 加碼至 12 月 31 日，每晚一個月就少一個月的加碼返傭。」<br>點擊「立即註冊」，在會議中直接開立合作夥伴帳戶，或請對方填寫聯絡表單以安排下一次會議。"
        ),
      },

      faq: {
        hidden: true, // ẩn khỏi trang; xóa dòng này để hiện lại
        part: "qa",
        label: T("Hỏi đáp", "Q&A", "問答"),
        title: T("Câu hỏi thường gặp", "Common questions", "常見問題"),
        upfrontTitle: T("Nói trước để minh bạch", "Upfront, for transparency", "事先說明，保持透明"),
        upfront: [
          T("Khách Việt Nam mở tài khoản qua Trademax Global Limited (VFSC), không phải pháp nhân ASIC; khách ASIC không được tham gia khuyến mãi.", "Vietnamese clients open accounts with Trademax Global Limited (VFSC), not the ASIC entity; ASIC clients are excluded from promotions.", "越南客戶透過 Trademax Global Limited（VFSC）開戶，而非 ASIC 監管實體；ASIC 客戶不參與活動。"),
          T("Điều kiện khuyến mãi chặt: net deposit bị trừ cả rút tiền lẫn rebate, lệnh phải giữ từ 2 phút, IB cần tối thiểu 5 khách trực tiếp (3 khách hoạt động).", "Promo conditions are strict: net deposit deducts both withdrawals and rebates, trades must be held 2+ minutes, and IBs need at least 5 direct clients (3 active).", "活動條件嚴格：淨入金會扣除出金與返傭，訂單需持倉 2 分鐘以上，IB 至少需要 5 位直客（3 位活躍）。"),
          T("TMGM có quyền thay đổi hoặc dừng chương trình bất kỳ lúc nào; rebate cơ bản mới là phần thu nhập “sàn”, khuyến mãi là phần cộng thêm.", "TMGM may change or end any program at any time; the base rebate is your income floor, promotions are the upside.", "TMGM 有權隨時變更或終止任何活動；基本返傭才是收入底線，活動是額外收益。"),
        ],
        items: [
          {
            q: T("MIB có cần văn phòng thật không?", "Does an MIB need a real office?", "MIB 需要實體辦公室嗎？"),
            a: T("Có, với KM đặc biệt MIB (hợp đồng thuê, địa chỉ, ảnh nhân viên). Chưa có văn phòng thì dùng KM IB.", "Yes, for the MIB special promo (lease, address, staff photos). Without an office, use the IB promo.", "需要，若參加 MIB 專屬活動（租約、地址、員工照片）。沒有辦公室則使用 IB 活動。"),
            internal: T(" Có thể gộp nhánh với ngưỡng lot tăng 50%.", " Branches can be combined with lot thresholds raised 50%.", " 可合併分支，手數門檻提高 50%。"),
            refs: ["m2", "m3"],
          },
          {
            q: T("Sàn khác trả rebate cao hơn.", "Another broker pays a higher rebate.", "其他平台返傭更高。"),
            a: T("So tổng thu nhập của cả hệ thống, không so một dòng. Mời đối tác nhập số thật vào máy tính ở M5.", "Compare total income across the whole network, not a single line. Have the partner enter real numbers in the M5 calculator.", "比較整個體系的總收入，而不是單一項目。請合作夥伴在 M5 計算器輸入真實數據。"),
            refs: ["nam-dong", "m5"],
          },
          {
            q: T("Sub-IB của tôi được gì?", "What do my Sub-IBs get?", "我的子代理能得到什麼？"),
            a: T("Rebate do MIB chia theo thỏa thuận; Sub-IB dùng quà cho khách để chốt khách. Khi MIB tham gia KM đặc biệt, Sub-IB không nhận thưởng tháng riêng.", "A rebate share agreed with the MIB; Sub-IBs use client rewards to close clients. When the MIB joins the special promo, Sub-IBs don't get a separate monthly bonus.", "由 MIB 按約定分配返傭；子代理可用客戶禮品促成交易。MIB 參加專屬活動時，子代理不另外獲得月度獎金。"),
            refs: ["m3", "ib"],
          },
          {
            q: T("Khách Việt có được ASIC bảo vệ không?", "Are Vietnamese clients protected by ASIC?", "越南客戶受 ASIC 保護嗎？"),
            a: T("Nói thẳng: khách Việt thuộc Trademax Global Limited (VFSC 40356), không phải pháp nhân ASIC. Tập đoàn có AFSL 436416 và bảo hiểm trách nhiệm nghề nghiệp 10 triệu USD.", "Straight answer: Vietnamese clients are with Trademax Global Limited (VFSC 40356), not the ASIC entity. The group holds AFSL 436416 and USD 10M professional indemnity cover.", "坦白說：越南客戶屬於 Trademax Global Limited（VFSC 40356），而非 ASIC 監管實體。集團持有 AFSL 436416 及 1,000 萬美元專業責任保險。"),
            refs: ["phap-ly"],
          },
          {
            q: T("Điều kiện khuyến mãi khó quá.", "The promo conditions are too strict.", "活動條件太嚴格。"),
            a: T("Bắt đầu bằng ECN Q4 (không cần số khách tối thiểu, không cần đăng ký) và hoàn Swap tuần (không có ngưỡng).", "Start with the Q4 ECN boost (no minimum clients, no sign-up) and the weekly swap rebate (no threshold).", "從 ECN Q4 加碼（無客戶數量要求、無需申請）和每週隔夜利息返還（無門檻）開始。"),
            refs: ["ecn-q4", "ib"],
          },
          {
            q: T("Tháng sau hết khuyến mãi thì sao?", "What happens when the promo ends?", "活動結束後怎麼辦？"),
            a: T("Lập kế hoạch trên rebate cơ bản; khuyến mãi là phần cộng thêm. TMGM chạy khuyến mãi theo tháng và quý (T10, Q4) nhưng có quyền thay đổi.", "Plan on the base rebate; promotions are the upside. TMGM runs monthly and quarterly promos (Oct, Q4) but may change them.", "以基本返傭做規劃；活動是額外收益。TMGM 按月和季度推出活動（10 月、Q4），但有權變更。"),
            refs: ["nam-dong", "bat-dau"],
          },
          {
            q: T("Tôi đang làm đối tác cho sàn khác, chuyển khách sang được không?", "I partner with another broker — can I bring my clients over?", "我正在與其他平台合作，可以把客戶轉過來嗎？"),
            a: T("Khách mới mở tài khoản qua IB link thì được. Không chuyển khách đang thuộc IB khác của TMGM để hưởng khuyến mãi: TMGM sẽ kiểm tra và có thể thu hồi (điều khoản ECN Q4, mục 2).", "New accounts opened through your IB link, yes. Moving clients who already belong to another TMGM IB to claim promos is not allowed — TMGM checks and may withhold cashback (Q4 ECN terms, term 2).", "透過您的 IB 連結新開戶的客戶可以。不得為獲取活動獎勵而轉移已屬於其他 TMGM 代理的客戶：TMGM 會審核並可能扣留返傭（ECN Q4 條款第 2 條）。"),
            refs: ["ecn-q4"],
          },
          {
            q: T("Bao lâu thì nhận được tiền?", "How soon do I get paid?", "多久能收到款項？"),
            a: T("Xem lịch tiền về.", "See the payout schedule.", "請看入帳時間表。"),
            refs: ["lich-tien"],
          },
          {
            q: T("Khách của tôi chủ yếu scalping vàng.", "My clients mostly scalp gold.", "我的客戶主要做黃金剝頭皮。"),
            a: T("Dùng Edge + ECN Q4: điều khoản ECN Q4 không đặt thời gian giữ lệnh tối thiểu. Lưu ý các KM khác (KM tháng IB/MIB, quà cho khách) chỉ tính lệnh giữ từ 2 phút và không tính lệnh hedging, nên khách scalping khó đạt các KM đó.", "Use Edge + the Q4 ECN boost: the Q4 ECN terms set no minimum holding time. Note that the other promos (monthly IB/MIB promo, client rewards) only count trades held 2+ minutes and exclude hedged trades, so scalping clients will struggle to qualify for those.", "使用 Edge + ECN Q4：ECN Q4 條款沒有設定最短持倉時間。但其他活動（IB/MIB 月度活動、客戶禮品）只計算持倉 2 分鐘以上的訂單，且不計對沖訂單，因此剝頭皮客戶較難達標。"),
            refs: ["tai-khoan", "ecn-q4"],
          },
        ],
        notes: T("Chuẩn bị sẵn 9 câu trả lời; mở đúng câu đối tác hỏi.", "Have all 9 answers ready; open the one the partner asks.", "準備好 9 個答案；打開合作夥伴問到的那一題。"),
      },
    },
  };
})();
