/*
 * Nội dung trang pitch "Hợp tác IB/MIB cùng TMGM" — ba ngôn ngữ: Tiếng Việt, English (mặc định), 繁體中文.
 * Nguồn: doc "Kế hoạch nội dung slide: Hợp tác IB/MIB cùng TMGM" (07/10/2026)
 *        và "TMGM 2026 Q4 ECN/EDGE IB Special Promotion" (EN + 中繁).
 *
 * Cập nhật hàng tháng (khi TMGM ra KM mới):
 *   1. Sửa meta.period, meta.validUntil và các bảng số công khai bên dưới (swapTiers, ecn...).
 *      Số KM MIB/IB, so sánh sàn, slide Ví dụ/So sánh/KM nằm trong private/locked-source.json (không đẩy lên GitHub).
 *      Sửa file đó rồi chạy: node scripts/lock.mjs  → tạo lại locked.js (đã mã hóa, đẩy file này).
 *   2. Sửa các câu có số trong chuỗi T(vi, en, zh) nếu số đổi (tìm "USD" / "美元").
 *   3. Chạy: node --test "tests/*.test.js" "private/tests/*.test.js"
 *   4. Mở lại index.html. Banner "hết hạn" tự tắt khi hôm nay <= meta.validUntil.
 *
 * Mỗi chuỗi hiển thị là T(vi, en, zh). Chuỗi khác nhau theo đối tượng dùng { mib: T(...), ib: T(...) }.
 */
(function () {
  const T = (vi, en, zh) => ({ vi, en, zh });

  // Slide cần mã truy cập: nội dung thật nằm trong locked.js (đã mã hóa), ở đây chỉ còn nhãn và tiêu đề chung.
  const LOCK_TITLE = T("Nội dung dành riêng cho đối tác", "Partner-only content", "合作夥伴專屬內容");
  const LOCK_NOTES = T(
    "Slide này cần mã truy cập. Chưa có mã thì hướng dẫn đối tác liên hệ để nhận.",
    "This slide needs an access code. If the partner has none yet, point them to the contact buttons.",
    "此頁需要存取碼。若合作夥伴尚未取得，請引導他們使用聯絡按鈕。"
  );
  const locked = (part, label, hidden) => ({ locked: !hidden, hidden: !!hidden, part, label, title: LOCK_TITLE, notes: LOCK_NOTES });


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
      // Trang ưu đãi đầy đủ (slide Ưu đãi khác dẫn sang đây)
      promotionsUrl: "promotions/",
    },

    presenter: {
      name: "Precy Guo",
      title: T("Business Development · TMGM", "Business Development · TMGM", "業務拓展 · TMGM"),
      telegram: "guowang26",
      whatsapp: "+61 431 840 947",
      whatsappLink: "61431840947",
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
      lock: {
        title: LOCK_TITLE,
        text: T(
          "Bảng thưởng KM, máy tính thu nhập và so sánh sàn chỉ mở cho đối tác. Liên hệ để nhận mã truy cập.",
          "The promo tiers, income calculator and broker comparison are for partners only. Get in touch for an access code.",
          "活動獎金級別、收入計算器與平台比較僅供合作夥伴使用。請聯絡取得存取碼。"
        ),
        ask: T("Chưa có mã? Liên hệ", "No code yet? Contact", "還沒有存取碼？請聯絡"),
        mailSubject: T("Xin mã truy cập trang đối tác TMGM", "Access code request: TMGM partnership page", "申請 TMGM 合作夥伴頁面存取碼"),
        mailBody: T(
          "Chào {name}, mình muốn nhận mã truy cập trang hợp tác MIB/IB của TMGM.",
          "Hi {name}, I'd like the access code for the TMGM MIB/IB partnership page.",
          "{name} 您好，我想取得 TMGM MIB/IB 合作夥伴頁面的存取碼。"
        ),
        codeLabel: T("Mã truy cập", "Access code", "存取碼"),
        placeholder: T("PP-XXXX-XXXX-XXXX-XXXX", "PP-XXXX-XXXX-XXXX-XXXX", "PP-XXXX-XXXX-XXXX-XXXX"),
        submit: T("Mở khóa", "Unlock", "解鎖"),
        checking: T("Đang kiểm tra…", "Checking…", "驗證中…"),
        wrong: T("Mã chưa đúng. Kiểm tra lại hoặc liên hệ để nhận mã.", "That code isn't right. Check it or get in touch for a code.", "存取碼不正確。請再確認，或聯絡取得存取碼。"),
        unsupported: T(
          "Trình duyệt này chưa hỗ trợ mở khóa (cần Chrome, Edge, Safari hoặc Firefox bản mới, mở qua https).",
          "This browser can't unlock the content (use a current Chrome, Edge, Safari or Firefox over https).",
          "此瀏覽器無法解鎖內容（請使用新版 Chrome、Edge、Safari 或 Firefox，並以 https 開啟）。"
        ),
        unlocked: T("Đã mở khóa nội dung dành cho đối tác", "Partner content unlocked", "已解鎖合作夥伴內容"),
        relock: T("Khóa lại", "Lock again", "重新鎖定"),
        badge: T("Cần mã", "Code needed", "需存取碼"),
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
      { icon: "headset", label: T("BD riêng", "Dedicated BD", "專屬 BD") },
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


    // Hoàn Swap hàng tháng (chính sách IB): ngưỡng net deposit của khách trực tiếp
    swapTiers: [
      { pct: 30, ib: 5000 },
      { pct: 40, ib: 10000 },
      { pct: 50, ib: 30000 },
    ],

    // Số KM MIB/IB và dữ liệu so sánh sàn nằm trong locked.js (mã hóa), nạp vào đây khi nhập đúng mã.
    mibTiers: [],
    mibTierPresets: {},
    ibTiers: [],
    competitors: { brokers: [] },

    // Ví dụ M5 (share = % rebate MIB chia cho Sub-IB)
    example: { lotsFx: 1000, lotsGold: 1400, account: "Prime", share: 70, deposit: 340000, subIBs: 5 },

    payouts: [
      { key: "base", icon: "coins", name: T("Rebate cơ bản", "Base rebate", "基本返傭"), how: T("Trả mỗi ngày làm việc · lệnh thứ Sáu về thứ Hai", "Paid every working day · Friday trades arrive Monday", "每個工作日發放 · 週五交易於週一到帳"), when: T("T+1, không tính T7–CN", "T+1, excluding weekends", "T+1，不含週末") },
      { key: "wed", icon: "moon", name: T("Hoàn Swap tuần", "Weekly swap rebate", "每週隔夜利息返還"), how: T("BD đăng ký, bộ phận BO xử lý", "BD registers, back office processes", "BD 申請，後台處理"), when: T("Mỗi thứ Tư", "Every Wednesday", "每週三") },
      { key: "day13", icon: "calendar", name: T("Hoàn Swap tháng", "Monthly swap rebate", "每月隔夜利息返還"), how: T("BD đăng ký", "BD registers", "BD 申請"), when: T("Trước ngày 14 hàng tháng", "Before the 14th of each month", "每月 14 日前") },
      { key: "bd5", icon: "zap", name: T("Tăng rebate ECN Q4", "Q4 ECN rebate boost", "ECN Q4 返傭加碼"), how: T("Tự động, không cần đăng ký", "Automatic, no sign-up", "自動發放，無需申請"), when: T("5 ngày làm việc đầu tháng", "First 5 working days of the month", "每月前 5 個工作日") },
      { key: "bonus", icon: "trophy", name: T("Thưởng tháng MIB/IB", "MIB/IB monthly bonus", "MIB/IB 月度獎金"), how: T("Nộp đơn qua BD", "Claim via your BD", "透過 BD 申請"), when: T("Trong 14 ngày làm việc sau khi duyệt", "Within 14 working days of approval", "審核通過後 14 個工作日內") },
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


    // ---------- Nội dung từng section ----------

    sections: {
      m1: locked("mib", T("Hệ thống", "Network", "體系"), true),
      m2: locked("common", T("KM MIB", "MIB promo", "MIB 活動")),
      m3: locked("mib", T("Điều kiện", "Rules", "條件"), true),
      m5: locked("common", T("Ví dụ", "Example", "示例")),
      "so-sanh": locked("mib", T("So sánh", "Compare", "比較")),
      ib: locked("ib", T("IB", "IB", "IB"), true),
      faq: locked("qa", T("Hỏi đáp", "Q&A", "問答"), true),

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
            detail: T("Thưởng theo bậc net deposit và lot, nộp qua BD. Bảng bậc chi tiết dành cho đối tác có mã truy cập.", "Paid by net-deposit and lot tier, claimed through your BD. The full tier table is for partners with an access code.", "依淨入金與手數級別發放，透過 BD 申請。完整級別表僅供持有存取碼的合作夥伴查看。"),
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
        adviceTitle: T("Định hướng của BD", "Your BD's recommendation", "BD 建議"),
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
        applyDate: T("Ngày BD nộp đơn", "Date your BD files", "BD 提交申請日期"),
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
        applyAm: T("BD đăng ký một lần", "Your BD registers once", "BD 一次性登記"),
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
          T("Tính theo portal, mọi loại tài khoản · chưa tự kích hoạt thì nhờ BD bật", "Counted per portal, all account types · if not auto-activated, ask your BD", "按 Portal 計算，不分帳戶類型 · 未自動啟用可請 BD 開通"),
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
        title: T("Các ưu đãi đang chạy cho khách", "Promotions running for clients now", "客戶進行中的優惠"),
        lead: T(
          "Mỗi thẻ là một ưu đãi. Bấm thẻ để mở trang đầy đủ: cách tham gia, điều kiện chính và mã QR của chương trình.",
          "Each card is one promotion. Click a card for the full page: how to join, key conditions and the programme QR code.",
          "每張卡片是一項優惠。點擊卡片可開啟完整頁面：參加方式、主要條件與活動 QR 碼。"
        ),
        open: T("Mở trang ưu đãi đầy đủ", "Open the full promotions page", "開啟完整優惠頁面"),
        filterLabel: T("Lọc ưu đãi", "Filter promotions", "篩選優惠"),
        fAll: T("Tất cả", "All", "全部"),
        fSmall: T("Ưu đãi nhỏ", "Small offers", "小型優惠"),
        fMkt: T("Marketing", "Marketing", "行銷"),
        fFollow: T("Đang hoàn tất", "Wrapping up", "收尾中"),
        private: T("Chỉ chia sẻ riêng", "Private only", "僅限私下分享"),
        privateHint: T(
          "Còn ưu đãi chỉ chia sẻ riêng (vé concert, Premier League…) dành cho đối tác có mã truy cập.",
          "More private-only offers (concert and Premier League tickets…) are for partners with an access code.",
          "另有僅限私下分享的優惠（演唱會、英超門票等），僅供持有存取碼的合作夥伴查看。"
        ),
        privateWarn: T(
          "Mục “Chỉ chia sẻ riêng”: chỉ nói riêng với khách hoặc IB đủ điều kiện, không đăng mạng xã hội. Vé có hạn, không đổi tiền, không chuyển nhượng. Không in ra PDF.",
          "“Private only” items: share only privately with eligible clients or IBs, never on social media. Tickets are limited, not exchangeable for cash, not transferable. Not included when printing.",
          "「僅限私下分享」項目：只可私下告知合資格客戶或 IB，不得發布到社群媒體。門票數量有限，不可兌現或轉讓。列印時不包含。"
        ),
        until: T("đến {d}", "until {d}", "至 {d}"),
        left: T("còn {n} ngày", "{n} days left", "剩 {n} 天"),
        lastDay: T("hôm nay là ngày cuối", "last day today", "今天截止"),
        from: T("từ {d}", "from {d}", "{d} 起"),
        closed: T("Đã đóng đăng ký · hạn {d}", "Registration closed · until {d}", "已截止報名 · 至 {d}"),
        see: T("Xem trang đầy đủ", "See the full page", "查看完整頁面"),
        count: T("{n} ưu đãi", "{n} promotions", "{n} 項優惠"),
        empty: T("Không còn ưu đãi nào trong mục này.", "No promotions left in this group.", "此分類暫無優惠。"),
        shared: T(
          "Các khuyến mãi online không dùng chung nạp và lot với nhau; khuyến mãi online và offline (qua BD) dùng chung được nếu T&C không cấm. Tài khoản Cent chỉ tính net deposit.",
          "Online promotions can't share deposits or lots with each other; online and offline (via BD) promotions can, unless the T&C says otherwise. Cent accounts count net deposit only.",
          "線上活動之間不可共用入金與手數；線上與線下（經 BD）活動除條款另有規定外可共用。美分帳戶只計淨入金。"
        ),
        source: T(
          "Nguồn: TMGM Sales Zendesk, Weekly Update 28/09–04/10/2026 và T&C từng chương trình (kiểm tra 09/10/2026). Mục hết hạn tự ẩn.",
          "Sources: TMGM Sales Zendesk, Weekly Update 28 Sep–4 Oct 2026 and each promotion's T&C (checked 9 Oct 2026). Expired items hide automatically.",
          "來源：TMGM Sales Zendesk、2026/9/28–10/4 每週更新及各活動條款（2026/10/9 核對）。過期項目自動隱藏。"
        ),
        notes: T(
          "“Ngoài các khoản chính, TMGM còn nhiều ưu đãi nhỏ giúp đội sales chốt khách.”<br>Chỉ mở thẻ nào đối tác hỏi. Khách mới: Rocket, Halloween, Gadget. Vé concert/Premier League chỉ nói riêng với đối tác có mã, không đưa lên mạng xã hội.",
          "“Beyond the main streams, TMGM runs smaller offers that help your sales team close.”<br>Only open the cards the partner asks about. New clients: Rocket, Halloween, Gadget. Concert and Premier League tickets are for partners with a code only, never on social media.",
          "「除主要收入外，TMGM 還有不少小型優惠幫助業務成交。」<br>只開啟合作夥伴問到的卡片。新客戶：Rocket、萬聖節、Gadget。演唱會與英超門票僅供持有存取碼的合作夥伴，不得發布到社群媒體。"
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
          { icon: "file", when: T("Cuối tháng", "Month end", "月底"), what: T("BD nộp đơn KM", "Your BD files the promo claim", "BD 提交活動申請") },
          { icon: "coins", when: T("Đầu tháng sau", "Early next month", "下月初"), what: T("ECN Q4 về trong 5 ngày làm việc, Swap tháng trước ngày 14, thưởng tháng trong 14 ngày làm việc sau duyệt", "Q4 ECN within 5 working days, monthly swap before the 14th, bonus within 14 working days of approval", "ECN Q4 於 5 個工作日內發放，隔夜利息於 14 日前，月度獎金於審核後 14 個工作日內") },
        ],
        firstPay: T("Khoản tiền đầu tiên", "First payout", "第一筆收入"),
        notes: T(
          "“Em muốn anh/chị giới thiệu TMGM với đúng những gì TMGM làm được. ECN Q4 chạy đến 31/12, mỗi tháng chậm là một tháng mất phần rebate tăng thêm.”<br>Bấm “Đăng ký ngay” để mở tài khoản đối tác ngay trong buổi gặp, hoặc để họ điền form liên hệ để hẹn buổi tiếp theo.",
          "“I want you to introduce TMGM for exactly what TMGM delivers. The Q4 ECN boost runs until 31 Dec — every month of delay is a month of boosted rebate lost.”<br>Click “Register now” to open the partner account during the meeting, or have them fill in the contact form to set the next meeting.",
          "「我希望您按照 TMGM 實際能做到的來介紹 TMGM。ECN Q4 加碼至 12 月 31 日，每晚一個月就少一個月的加碼返傭。」<br>點擊「立即註冊」，在會議中直接開立合作夥伴帳戶，或請對方填寫聯絡表單以安排下一次會議。"
        ),
      },

    },
  };
})();
