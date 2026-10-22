/*
 * Dữ liệu trang ưu đãi TMGM (index.html). Mỗi chuỗi hiển thị là T(vi, en, zh) cho ba ngôn ngữ.
 * Sửa trực tiếp ở đây rồi đẩy lên GitHub. Hoặc mở trang với ?edit để thử chỉnh và xem trước (lưu trên máy này), xuất JSON rồi đưa vào file này.
 * Ưu đãi "chỉ chia sẻ riêng" (vé concert, Premier League...) không nằm ở đây mà trong phần mã hóa locked.js (xem scripts/lock.mjs).
 *
 * extraPromos: mỗi phần tử là một slide ưu đãi.
 *   group: "small" (ưu đãi nhỏ) | "marketing" | "followup" (đã đóng đăng ký, còn hoàn tất)
 *   from / until (YYYY-MM-DD, giờ MT4/MT5): hết "until" thì tự ẩn khỏi trang.
 *   calc (tùy chọn): cách tính để slide Ví dụ của trang pitch dùng ưu đãi này như add-on (kind "client" = khách nhận, "ib" = IB nhận;
 *     type: credit | cashback | cash | table | points | draw | gift | tickets — xem calc.promoAddon trong calc.js). Không có calc thì không hiện ở máy tính.
 *   order (tùy chọn): số nhỏ xếp trước trong cùng nhóm; image (tùy chọn): link ảnh https thay hình minh họa có sẵn.
 *   share: "private" chỉ là nhãn "chỉ chia sẻ riêng", không ẩn mục.
 * Nguồn: TMGM Sales Zendesk, Weekly Update 28/09–04/10/2026, PDF từng chương trình (kiểm tra 09/10/2026).
 */
(function () {
  const T = (vi, en, zh) => ({ vi, en, zh });

  window.PROMOS = {
    // Liên hệ ở slide cuối
    contact: {
      name: "Precy Guo",
      title: T("Business Development · TMGM", "Business Development · TMGM", "業務拓展 · TMGM"),
      telegram: "guowang26",
      whatsapp: "+61 431 840 947",
      whatsappLink: "61431840947",
      url: "https://portal.tmgm.com/register?sales=NzAwMV9QcmVjeVZ1b25n&language=vi",
      register: T("Đăng ký ngay", "Register now", "立即註冊"),
    },

    // Chữ dùng chung của thẻ ưu đãi
    sections: {
      "km-khac": {
        filterLabel: T("Lọc ưu đãi", "Filter promotions", "篩選優惠"),
        fAll: T("Tất cả", "All", "全部"),
        fSmall: T("Ưu đãi nhỏ", "Small offers", "小型優惠"),
        fMkt: T("Marketing", "Marketing", "行銷"),
        fFollow: T("Đang hoàn tất", "Wrapping up", "收尾中"),
        private: T("Chỉ chia sẻ riêng", "Private only", "僅限私下分享"),
        until: T("đến {d}", "until {d}", "至 {d}"),
        left: T("còn {n} ngày", "{n} days left", "剩 {n} 天"),
        lastDay: T("hôm nay là ngày cuối", "last day today", "今天截止"),
        from: T("từ {d}", "from {d}", "{d} 起"),
      },
    },

    promoPage: {
      title: T("Ưu đãi khác", "More promotions", "其他優惠"),
      coverKicker: T("TMGM · Tháng 10 – Q4/2026", "TMGM · October – Q4 2026", "TMGM · 2026 年 10 月 – Q4"),
      coverTitle: T("Ưu đãi đang chạy cho khách", "Promotions running now", "進行中的優惠"),
      coverSub: T("Mỗi trang là một ưu đãi: cách tham gia, điều kiện chính và link chương trình.", "One promotion per page: how to join, key conditions and the promotion link.", "每頁一項優惠：參加方式、主要條件與活動連結。"),
      tixTitle: T("Bậc vé", "Ticket tiers", "門票級別"),
      tixCols: [T("Net deposit", "Net deposit", "淨入金"), T("Lot", "Lots", "手數"), T("Vé", "Tickets", "門票")],
      editPromo: T("Sửa slide này", "Edit this slide", "編輯此頁"),
      addSlide: T("Thêm slide", "Add a slide", "新增頁面"),
      deleteSlide: T("Xóa slide này", "Delete this slide", "刪除此頁"),
      addHint: T("Tạo slide mới từ mẫu", "Create a new slide from a template", "從範本建立新頁面"),
      closedTag: T("Đã đóng đăng ký · hạn {d}", "Registration closed · until {d}", "已截止報名 · 至 {d}"),
      coverCount: T("{n} ưu đãi đang chạy", "{n} promotions running", "{n} 項優惠進行中"),
      updated: T("Cập nhật {d}", "Updated {d}", "更新於 {d}"),
      start: T("Xem danh sách", "See the list", "查看列表"),
      indexTitle: T("Chọn một ưu đãi", "Pick a promotion", "選擇一項優惠"),
      indexHint: T("Bấm thẻ để mở trang của ưu đãi đó. Ưu đãi sắp hết hạn xếp trước.", "Click a card to open that promotion. The ones ending soonest come first.", "點擊卡片開啟該優惠。即將截止的排在前面。"),
      howTitle: T("Cách tham gia", "How to join", "參加方式"),
      keyTitle: T("Điều kiện chính", "Key conditions", "主要條件"),
      tiersTitle: T("6 bậc quà (net deposit · lot)", "6 gift tiers (net deposit · lots)", "6 級獎品（淨入金 · 手數）"),
      tasksReward: T("Phần thưởng", "Reward", "獎勵"),
      questsTitle: T("Hai nhiệm vụ", "Two quests", "兩種任務"),
      questCap: T("tối đa {v}", "max {v}", "最高 {v}"),
      drawText: T("1 xe cho mỗi {n} khách đủ điều kiện", "1 scooter for every {n} eligible clients", "每 {n} 位合格客戶抽出 1 台"),
      creditDeposit: T("Nạp {v}", "Deposit {v}", "入金 {v}"),
      creditPlus: T("+{v} credit", "+{v} credit", "+{v} 贈金"),
      creditNote: T("Credit chỉ dùng làm margin, không rút được", "Credit is margin only and can't be withdrawn", "贈金僅作保證金，不可提取"),
      scan: T("Quét để mở trang chương trình", "Scan to open the promotion page", "掃描開啟活動頁面"),
      openPage: T("Mở trang chương trình", "Open the promotion page", "開啟活動頁面"),
      copyLink: T("Copy link trang này", "Copy link to this page", "複製本頁連結"),
      copied: T("Đã copy link", "Link copied", "已複製連結"),
      present: T("Trình chiếu", "Present", "簡報模式"),
      prev: T("Trước", "Previous", "上一頁"),
      next: T("Tiếp", "Next", "下一頁"),
      slideOf: T("{i} / {n}", "{i} / {n}", "{i} / {n}"),
      notesTitle: T("Lời thoại cho đối tác", "Notes for partners", "合作夥伴備註"),
      notesDefault: T("Chỉ nói những điều kiện có trên trang; điều khoản chi tiết theo T&C của TMGM.", "Only state the conditions shown on the page; full terms follow TMGM's T&C.", "只說明頁面上的條件；完整條款以 TMGM 條款為準。"),
      contactTitle: T("Cần hỗ trợ đăng ký?", "Need help signing up?", "需要協助報名嗎？"),
      contactSub: T("Liên hệ BD của bạn để được hướng dẫn từng bước.", "Contact your BD for step-by-step help.", "聯絡您的BD，獲得逐步協助。"),
      back: T("Về trang hợp tác", "Back to the partnership page", "回到合作頁面"),
      codeHint: T("Có mã truy cập? Nhập để xem ưu đãi chỉ chia sẻ riêng", "Have an access code? Enter it to see the private-only offers", "有存取碼？輸入即可查看僅限私下分享的優惠"),
      codeBtn: T("Mở khóa", "Unlock", "解鎖"),
      codeChecking: T("Đang kiểm tra…", "Checking…", "驗證中…"),
      codeWrong: T("Mã chưa đúng.", "That code isn't right.", "存取碼不正確。"),
      codeUnsupported: T("Trình duyệt này chưa hỗ trợ mở khóa.", "This browser can't unlock the content.", "此瀏覽器無法解鎖內容。"),
      unlocked: T("Đã mở khóa ưu đãi chỉ chia sẻ riêng", "Private-only offers unlocked", "已解鎖僅限私下分享的優惠"),
      relock: T("Khóa lại", "Lock again", "重新鎖定"),
      empty: T("Hiện chưa có ưu đãi nào đang chạy.", "No promotions are running right now.", "目前沒有進行中的優惠。"),
      risk: T("Giao dịch CFD có rủi ro cao, có thể mất nhiều hơn số tiền nạp. Điều khoản đầy đủ theo T&C của TMGM.", "CFD trading is high risk; you can lose more than you deposit. Full terms follow TMGM's T&C.", "差價合約交易風險高，虧損可能超過入金。完整條款以 TMGM 條款為準。"),
    },

    extraPromos: [
      {
        key: "halloween", order: 5, group: "small", share: "public", icon: "user-plus", from: "2026-10-05", until: "2026-11-05",
        // Máy tính IB ở slide Ví dụ của trang pitch: cách tính ưu đãi này khi bật như add-on (xem calc.promoAddon)
        calc: { type: "credit", kind: "client", pct: 30, cap: 200, minFtd: 50, excl: "credit" },
        // Trang "Ưu đãi khác" (uu-dai.html): tiêu đề lớn, câu phụ, 3 bước, hình minh họa
        art: "pumpkin",
        headline: T("Credit tới 1.000 USD", "Up to USD 1,000 credit", "最高 1,000 美元贈金"),
        sub: T("Đoán đúng sản phẩm bí ẩn để nhận 100% khoản nạp đầu", "Pick the Mystery Product to get 100% of your first deposit", "猜中神秘產品，可獲首次入金 100% 贈金"),
        steps: [
          T("Đăng ký qua trang chương trình", "Sign up on the promotion page", "經活動頁註冊"),
          T("Nạp lần đầu từ 50 USD", "Make a first deposit of USD 50 or more", "首次入金 50 美元以上"),
          T("Giao dịch 0,01 lot sản phẩm bạn đoán là sản phẩm bí ẩn", "Trade 0.01 lot of the product you think is the Mystery Product", "以 0.01 手交易您猜的神秘產品"),
        ],
        quests: [{ pct: 100, cap: 1000, label: T("Đoán đúng: Mystery Quest", "Right guess: Mystery Quest", "猜中：神秘任務") }, { pct: 30, cap: 200, label: T("Còn lại: Standard Quest", "Otherwise: Standard Quest", "其他：標準任務") }],
        url: "https://lnd.tmgm-apac.com/en/halloween",
        name: T("Halloween Quest", "Halloween Quest", "萬聖節任務"),
        value: T("Credit 30% FTD (tối đa 200 USD); đoán đúng sản phẩm bí ẩn: 100% (tối đa 1.000 USD)", "30% credit on the FTD (max USD 200); 100% for picking the Mystery Product (max USD 1,000)", "首入金 30% 贈金（最高 200 美元）；猜中神秘產品 100%（最高 1,000 美元）"),
        seg: T("Khách mới", "New clients", "新客戶"),
        rules: [
          T("FTD ≥ 50 USD trong kỳ và giao dịch ≥ 0,01 lot (trừ cổ phiếu); sản phẩm giao dịch đầu tiên quyết định nhiệm vụ", "FTD ≥ USD 50 in the period and trade ≥ 0.01 lot (shares excluded); the first product traded decides the quest", "期間內首次入金 ≥ 50 美元並交易 ≥ 0.01 手（股票除外）；首個交易產品決定任務"),
          T("Khách chưa có tài khoản đăng ký qua trang chương trình; tài khoản có sẵn nhưng chưa FTD thì nhờ BD", "Clients without an account register via the promotion page; existing accounts without an FTD go through their BD", "未開戶客戶經活動頁註冊；已開戶未首存的客戶請 BD 協助"),
        ],
        note: T(
          "Credit bonus, mỗi khách một lần. Khách từng nhận bất kỳ credit bonus nào (kể cả 50% Credit) không tham gia. T&C đầy đủ gửi sau; xác nhận nước đủ điều kiện với BD.",
          "Credit bonus, once per client. Clients who've had any credit bonus (including the 50% Credit) can't join. Full T&Cs to follow; confirm country eligibility with your BD.",
          "贈金，每位客戶限一次。曾領取任何贈金（含 50% 贈金）的客戶不可參加。完整條款稍後公布；請向 BD 確認國家資格。"
        ),
      },
      {
        key: "credit50", order: 2, group: "small", share: "public", icon: "coins", from: "2026-10-01", until: "2026-12-31",
        // Máy tính IB ở slide Ví dụ của trang pitch: cách tính ưu đãi này khi bật như add-on (xem calc.promoAddon)
        calc: { type: "credit", kind: "client", pct: 50, cap: 10000, minFtd: 500, excl: "credit" },
        // Trang "Ưu đãi khác" (uu-dai.html): tiêu đề lớn, câu phụ, 3 bước, hình minh họa
        art: "credit",
        headline: T("Credit 50%", "50% credit", "50% 贈金"),
        sub: T("trên mỗi khoản nạp mới, tối đa 10.000 USD mỗi tài khoản", "on every new deposit, up to USD 10,000 per account", "每筆新入金皆可申請，每個帳戶最高 10,000 美元"),
        steps: [
          T("Nạp mới từ 500 USD", "Deposit USD 500 or more", "新入金 500 美元以上"),
          T("Nhờ BD hoặc email support@tmgm.com xin credit", "Ask your BD or email support@tmgm.com for the credit", "請 BD 協助或發信至 support@tmgm.com 申請"),
          T("Credit về tài khoản, thường trong 1 ngày làm việc", "Credit lands in your account, usually within 1 business day", "贈金通常 1 個工作日內入帳"),
        ],
        example: { deposit: 1000 },
        url: "https://lnd.tmgm.com/en/deposit_bonus",
        name: T("50% Credit Q4", "Q4 50% Credit", "Q4 50% 贈金"),
        value: T("Credit 50% khoản nạp mới, tối đa 10.000 USD/tài khoản", "50% credit on new deposits, up to USD 10,000 per account", "新入金 50% 贈金，每個帳戶最高 10,000 美元"),
        seg: T("Khách mới và cũ", "New and existing", "新舊客戶"),
        rules: [
          T("Nạp mới tối thiểu 500 USD; mỗi khoản nạp mới xin credit riêng", "Each new deposit is applied separately", "新入金至少 500 美元；每筆新入金分別申請"),
          T("Credit chỉ dùng làm margin: không rút, không bù lỗ hay phí; rút tiền hoặc chuyển nội bộ thì credit bị trừ theo tỷ lệ", "Credit is margin only: not withdrawable, doesn't absorb losses or costs; withdrawals or internal transfers reduce it proportionally", "贈金僅作保證金：不可提取，不可抵扣虧損或費用；出金或內部轉帳將按比例扣減"),
          T("Không áp dụng khách ASIC; tài khoản còn bonus 30% phải dùng hết hoặc xin trên tài khoản khác", "Accounts still holding a 30% bonus must use it up or apply on another account", "不適用 ASIC 客戶；仍有 30% 贈金餘額的帳戶須先用完或改用其他帳戶申請"),
        ],
        note: T(
          "Khách nhận credit này sẽ không tham gia được Halloween Quest. Credit bị xóa nếu tổng equity dưới 30 USD và 30 ngày không nạp, rút hay giao dịch.",
          "Clients who take this credit can't join Halloween Quest. Credit is cleared if total equity is below USD 30 with no deposit, withdrawal or trade for 30 days.",
          "領取此贈金的客戶不可參加萬聖節任務。若總淨值低於 30 美元且 30 天內無入金、出金或交易，贈金將被清除。"
        ),
      },
      {
        key: "gadget", order: 7, group: "small", share: "public", icon: "gift", from: "2026-10-01", until: "2026-12-31",
        // Máy tính IB ở slide Ví dụ của trang pitch: cách tính ưu đãi này khi bật như add-on (xem calc.promoAddon)
        calc: { type: "table", kind: "client" },
        // Trang "Ưu đãi khác" (uu-dai.html): tiêu đề lớn, câu phụ, 3 bước, hình minh họa
        art: "gadget",
        headline: T("Apple Watch → MacBook Pro", "Apple Watch → MacBook Pro", "Apple Watch → MacBook Pro"),
        sub: T("hoặc nhận 70% giá trị bằng tiền", "or take 70% of the value in cash", "或領取 70% 現金價值"),
        steps: [
          T("Đăng ký trên Portal → Promotions", "Sign up on Portal → Promotions", "在 Portal → 活動頁報名"),
          T("Nạp và giao dịch đạt một bậc", "Deposit and trade to reach a tier", "入金並交易達到某一級"),
          T("Chọn quà hoặc nhận tiền", "Choose the gadget or the cash", "選擇獎品或現金"),
        ],
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
        key: "rocket", order: 11, group: "small", share: "public", icon: "zap", from: "2026-07-26", until: "2026-12-31",
        // Máy tính IB ở slide Ví dụ của trang pitch: cách tính ưu đãi này khi bật như add-on (xem calc.promoAddon)
        calc: { type: "cash", kind: "client", usd: 20, minFtd: 50 },
        // Trang "Ưu đãi khác" (uu-dai.html): tiêu đề lớn, câu phụ, 3 bước, hình minh họa
        art: "rocket",
        headline: T("Cashback 20 USD", "USD 20 cashback", "20 美元現金回贈"),
        sub: T("cho những lot BTCUSD đầu tiên của bạn", "on your first BTCUSD trades", "回饋您的首批 BTCUSD 交易"),
        steps: [
          T("Bấm Sign in ở Portal → Promotions", "Click Sign in on Portal → Promotions", "在 Portal → 活動頁點擊 Sign in"),
          T("Nạp lần đầu từ 50 USD", "Make a first deposit of USD 50 or more", "首次入金 50 美元以上"),
          T("Giao dịch 5 lot BTCUSD (0,5 lot chuẩn)", "Trade 5 lots of BTCUSD (0.5 standard lots)", "交易 5 手 BTCUSD（0.5 標準手）"),
        ],
        name: T("Rocket Your Trading Start", "Rocket Your Trading Start", "Rocket Your Trading Start"),
        value: T("Cashback 20 USD", "USD 20 cashback", "20 美元現金回贈"),
        seg: T("Khách mới", "New clients", "新客戶"),
        rules: [
          T("Khách chưa từng nạp trước 26/07/2026; bấm Sign in ở Portal → Promotions trước khi nạp", "Clients with no deposit before 26 Jul 2026; click Sign in on Portal → Promotions before depositing", "2026/7/26 前未曾入金的客戶；入金前在 Portal → 活動頁點擊 Sign in"),
          T("FTD ≥ 50 USD và giao dịch 5 lot BTCUSD (= 0,5 lot chuẩn); chỉ tính BTCUSD, lệnh giữ ≥ 2 phút", "FTD ≥ USD 50 and 5 lots of BTCUSD (= 0.5 standard lots); BTCUSD only, trades held ≥ 2 minutes", "首次入金 ≥ 50 美元並交易 5 手 BTCUSD（= 0.5 標準手）；僅計 BTCUSD，持倉 ≥ 2 分鐘"),
        ],
      },
      {
        key: "welcomeBack", order: 1, group: "small", share: "public", icon: "user", from: "2026-09-28", until: "2026-10-31",
        // Máy tính IB ở slide Ví dụ của trang pitch: cách tính ưu đãi này khi bật như add-on (xem calc.promoAddon)
        calc: { type: "points", kind: "client", pts: 320 },
        // Trang "Ưu đãi khác" (uu-dai.html): tiêu đề lớn, câu phụ, 3 bước, hình minh họa
        // Ảnh bảng nguyên bản của TMGM (img/), hiện ngay đầu slide, trước phần "Cách tham gia"
        pics: [
          { src: "img/welcome-tasks.png", alt: T("Bảng 5 nhiệm vụ và điểm thưởng", "The 5 tasks and their points", "5 項任務與點數") },
          { src: "img/welcome-products.png", alt: T("Sản phẩm hợp lệ (điều 4(h))", "Eligible products (clause 4(h))", "合資格產品（條款 4(h)）") },
        ],
        art: "welcome",
        headline: T("320 points", "320 points", "320 點"),
        sub: T("và coupon giảm 20% points khi đổi món 20 USD cashback", "plus a 20% points discount on the USD 20 cashback item", "另加兌換 20 美元現金回贈時的點數 8 折券"),
        steps: [
          T("Mở email hoặc thông báo mời từ TMGM", "Open TMGM's invitation email or notification", "打開 TMGM 的邀請郵件或通知"),
          T("Bấm Sign Up ở Portal → Promotions", "Click Sign Up on Portal → Promotions", "在 Portal → 活動頁點擊 Sign Up"),
          T("Hoàn thành 5 nhiệm vụ theo thứ tự", "Complete the 5 tasks in order", "依序完成 5 項任務"),
        ],
        name: T("Welcome Back", "Welcome Back", "Welcome Back"),
        value: T("320 points + coupon giảm 20% points", "320 points + a 20% points-discount coupon", "320 點 + 點數 8 折券"),
        seg: T("Chỉ khách được mời", "Invited clients only", "僅限受邀客戶"),
        rules: [
          T("Khách được TMGM mời qua email hoặc thông báo; đăng ký ở Portal → Promotions → Sign Up", "Clients invited by TMGM via email or push notification; sign up on Portal → Promotions", "受 TMGM 透過郵件或推播邀請的客戶；於 Portal → 活動頁報名"),
          T("Làm lần lượt 5 nhiệm vụ: nạp 200 USD → 1 lot XAUUSD → 1 lot crypto → 1 lot forex → thêm 2 lot", "Complete 5 tasks in order: deposit USD 200 (20 pts) → 1 lot XAUUSD (20pts) → 1 lot crypto (20pts) → 1 lot forex (20pts) → 2 standard lots of any eligible products (200 pts + 20% Points  Discount Coupon)", "依序完成 5 項任務：入金 200 美元 → 1 手 XAUUSD → 1 手加密貨幣 → 1 手外匯 → 再 2 手"),
          T("Phải xong cả 5 nhiệm vụ mới có thưởng; coupon dùng một lần khi đổi món 20 USD cashback, hạn 08/11/2026", "No reward until all 5 tasks are done; the coupon is used once on the USD 20 cashback item, valid until 8 Nov 2026", "須完成全部 5 項任務才有獎勵；折扣券僅可用於兌換 20 美元現金回贈一次，有效至 2026/11/8"),
        ],
      },
      {
        key: "winYourRide", order: 12, group: "marketing", share: "public", icon: "trophy", from: "2026-08-20", until: "2026-11-20",
        // Máy tính IB ở slide Ví dụ của trang pitch: cách tính ưu đãi này khi bật như add-on (xem calc.promoAddon)
        calc: { type: "draw", kind: "client", perN: 20 },
        // Trang "Ưu đãi khác" (uu-dai.html): tiêu đề lớn, câu phụ, 3 bước, hình minh họa; note dành cho đối tác (lời thoại)
        art: "scooter", noteFor: "partner",
        headline: T("Xe máy điện VinFast", "A VinFast e-scooter", "VinFast 電動機車"),
        sub: T("Net Deposit Promotion 2026 (Việt Nam): bốc thăm cho khách mới nạp và giữ 150 USD", "Net Deposit Promotion 2026 (Vietnam): drawn among new clients who deposit and keep USD 150", "Net Deposit Promotion 2026（越南）：抽獎對象為入金並維持 150 美元的新客戶"),
        steps: [
          T("Mở tài khoản qua link chương trình tại Việt Nam", "Open an account via the Vietnam promotion link", "經越南活動連結開戶"),
          T("Nạp lần đầu từ 150 USD", "Make a first deposit of USD 150 or more", "首次入金 150 美元以上"),
          T("Giữ tối thiểu 150 USD đủ 90 ngày", "Keep at least USD 150 for 90 days", "維持至少 150 美元達 90 天"),
        ],
        draw: 20,
        name: T("Win Your Ride (VN)", "Win Your Ride (VN)", "Win Your Ride（越南）"),
        value: T("Bốc thăm xe máy điện VinFast", "VinFast e-scooter lucky draw", "VinFast 電動機車抽獎"),
        seg: T("Khách mới", "New clients", "新客戶"),
        rules: [
          T("Khách chưa có tài khoản TMGM trước 20/08/2026, đăng ký qua tracking link VN của TMGM", "Clients with no TMGM account before 20 Aug 2026, registered via TMGM's VN tracking link", "2026/8/20 前未有 TMGM 帳戶、經 TMGM 越南追蹤連結註冊的客戶"),
          T("Một khoản FTD ≥ 150 USD (không cộng dồn) và giữ net deposit ≥ 150 USD đủ 90 ngày; không yêu cầu giao dịch", "A single FTD ≥ USD 150 (no top-ups) and net deposit ≥ USD 150 held for 90 days; no trading required", "單筆首次入金 ≥ 150 美元（不可合併）並維持淨入金 ≥ 150 美元 90 天；無交易要求"),
          T("FTD tới 20/11/2026, giữ tiền tới 20/02/2027; 1 xe cho mỗi 20 khách đủ điều kiện, không phải ai cũng trúng", "FTD by 20 Nov 2026, hold until 20 Feb 2027; 1 scooter per 20 eligible clients, not everyone wins", "首次入金截至 2026/11/20，維持至 2027/2/20；每 20 位合格客戶抽出 1 台，並非人人有獎"),
        ],
        note: T("Khách vào qua IB link của đối tác có thể không được tính: hỏi BD trước khi giới thiệu.", "Clients who come through a partner's IB link may not count: check with your BD first.", "經合作夥伴 IB 連結註冊的客戶可能不計入：介紹前請先向 BD 確認。"),
      },
      {
        key: "jayChou", order: 6, group: "marketing", share: "public", icon: "users", from: "2026-10-01", until: "2026-12-31",
        // Máy tính IB ở slide Ví dụ của trang pitch: cách tính ưu đãi này khi bật như add-on (xem calc.promoAddon)
        calc: { type: "gift", kind: "client" },
        // Trang "Ưu đãi khác" (uu-dai.html): tiêu đề lớn, câu phụ, 3 bước, hình minh họa; note dành cho đối tác (lời thoại)
        art: "concert", noteFor: "partner",
        headline: T("Quà + vé Jay Chou", "Gifts + Jay Chou tickets", "禮品 + 周杰倫門票"),
        sub: T("sạc dự phòng Xiaomi, khăn và cơ hội trúng 2 vé CAT3", "a Xiaomi power bank, a towel and a chance at 2 CAT3 tickets", "小米行動電源、毛巾，以及抽中 2 張 CAT3 門票的機會"),
        steps: [
          T("Đăng ký qua link trên Facebook/Instagram của TMGM", "Sign up via the link on TMGM's Facebook/Instagram", "經 TMGM Facebook/Instagram 連結註冊"),
          T("Nạp lần đầu từ 50 USD", "Make a first deposit of USD 50 or more", "首次入金 50 美元以上"),
          T("Giao dịch 1,5 lot sản phẩm chỉ định", "Trade 1.5 lots of the specified products", "交易 1.5 手指定產品"),
        ],
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
        key: "getaway", order: 4, group: "followup", share: "public", icon: "calendar", from: "2026-09-08", until: "2026-11-08", regUntil: "2026-10-08",
        // Máy tính IB ở slide Ví dụ của trang pitch: cách tính ưu đãi này khi bật như add-on (xem calc.promoAddon)
        calc: { type: "cashback", kind: "client", pct: 100, cap: 10, minFtd: 1 },
        pics: [
          { src: "img/getaway-rewards.png", alt: T("Bảng thưởng: FTD, net deposit 30 ngày, khối lượng giao dịch", "Reward table: FTD, 30-day net deposit, trading volume", "獎勵表：首存、30 日淨入金、交易量") },
        ],
        art: "travel",
        headline: T("Hoàn 100% khoản nạp đầu, tối đa 10 USD", "100% cashback on your first deposit, up to USD 10", "首次入金 100% 現金回贈，最高 10 美元"),
        sub: T("kèm bốc thăm voucher du lịch Trip.com 5.000 USD", "plus a draw for a USD 5,000 Trip.com travel voucher", "另可參加 5,000 美元 Trip.com 旅遊禮券抽獎"),
        steps: [
          T("Đăng ký qua tracking link hoặc landing page trước khi nạp", "Register via the tracking link or landing page before depositing", "入金前先經追蹤連結或活動頁註冊"),
          T("Nạp lần đầu (không yêu cầu mức tối thiểu); giữ net deposit ≥ 50 USD sau 30 ngày", "Make your first deposit (no minimum); keep a net deposit of at least USD 50 after 30 days", "首次入金（無最低金額）；30 天後淨入金維持 ≥ 50 美元"),
          T("Giao dịch ≥ 0,6 lot chuẩn để nhận cashback; mỗi lot trọn thêm 25 lượt bốc thăm", "Trade at least 0.6 standard lots for the cashback; each full lot adds 25 draw entries", "交易 ≥ 0.6 標準手可獲回贈；每完整 1 手另得 25 次抽獎機會"),
        ],
        name: T("100% Cashback to Getaway", "100% Cashback to Getaway", "100% Cashback to Getaway"),
        value: T("Cashback 100% FTD (tối đa 10 USD) + bốc thăm voucher Trip.com 5.000 USD", "100% FTD cashback (max USD 10) + a USD 5,000 Trip.com voucher draw", "首次入金 100% 現金回贈（最高 10 美元）+ 5,000 美元 Trip.com 禮券抽獎"),
        seg: T("Chỉ khách đã đăng ký và FTD trước 08/10", "Only clients who registered and made their FTD by 8 Oct", "僅限 10/8 前已報名並完成首次入金的客戶"),
        rules: [
          T("Đã đóng nhận FTD từ 08/10/2026; chương trình chạy tới 08/11 chỉ để hoàn thành điều kiện cho người đã tham gia", "FTDs closed on 8 Oct 2026; the promotion runs to 8 Nov only so existing participants can finish", "首次入金已於 2026/10/8 截止；活動延至 11/8 僅供已參加者完成條件"),
          T("Cashback: net deposit ≥ 50 USD tại ngày đánh giá (30 ngày kể từ FTD) và ≥ 0,6 lot chuẩn; không vượt 10 USD", "Cashback: net deposit ≥ USD 50 on the 30-day assessment date and ≥ 0.6 standard lots; capped at USD 10", "現金回贈：評估日（首存後 30 天）淨入金 ≥ 50 美元且 ≥ 0.6 標準手；上限 10 美元"),
          T("Bốc thăm: FTD > 0 được 1 lượt, mỗi lot chuẩn trọn thêm 25 lượt (không giới hạn); 1 người trúng voucher Trip.com 5.000 USD", "Draw: any FTD earns 1 entry, each full standard lot adds 25 (no limit); 1 winner gets a USD 5,000 Trip.com voucher", "抽獎：首存即得 1 次，每完整 1 標準手另得 25 次（無上限）；1 位得主獲 5,000 美元 Trip.com 禮券"),
          T("Áp dụng cho khách VN, TH, MY, ID, PH", "For clients in VN, TH, MY, ID and PH", "適用於 VN、TH、MY、ID、PH 客戶"),
        ],
        note: T("Bốc thăm chỉ diễn ra nếu có ít nhất 300 người tham gia hợp lệ; không bảo đảm trúng thưởng.", "The draw only takes place with at least 300 valid participants; winning isn't guaranteed.", "至少 300 位有效參加者才會抽獎；不保證中獎。"),
      },
      {
        key: "q3Cashback", hidden: true, group: "followup", share: "public", icon: "coins", from: "2026-07-01", until: "2026-12-31", regUntil: "2026-09-30",
        art: "credit",
        headline: T("Hoàn thành lot còn thiếu của bậc đã đạt", "Finish the lots still missing for the tier you reached", "完成已達級別尚缺的手數"),
        sub: T("dành cho khách đã tham gia Cashback Q3 và đủ điều kiện nạp trong Q3", "for clients who joined the Q3 cashback and met its deposit requirement", "適用於已參加 Q3 現金回贈且達到入金條件的客戶"),
        steps: [
          T("Mở Portal → Promotions, xem chương trình Q3 đã đăng ký", "Open Portal → Promotions and find the Q3 promotion you registered for", "開啟 Portal → 活動頁，找到已報名的 Q3 活動"),
          T("Kiểm tra bậc net deposit đã đạt trong kỳ nạp (đóng 30/09)", "Check the net deposit tier you reached in the deposit period (closed 30 Sep)", "確認入金期（9/30 截止）內已達的淨入金級別"),
          T("Hoàn thành số lot còn thiếu trước 31/12/2026", "Complete the missing lots by 31 Dec 2026", "於 2026/12/31 前完成尚缺手數"),
        ],
        name: T("Cashback Q3 (khách cũ)", "Q3 Cashback (existing clients)", "Q3 現金回贈（舊客戶）"),
        value: T("Chỉ hoàn thành phần lot còn thiếu, hạn 31/12/2026", "Only the missing lots to finish, until 31 Dec 2026", "僅需完成尚缺手數，期限 2026/12/31"),
        seg: T("Đã đăng ký Q3 và đạt điều kiện nạp", "Registered for Q3 and met the deposit requirement", "已報名 Q3 並達入金條件"),
        rules: [
          T("Đăng ký và nạp đã đóng 30/09/2026; không nhận người mới", "Registration and deposits closed on 30 Sep 2026; no new entrants", "報名與入金已於 2026/9/30 截止；不再接受新參加者"),
          T("Chỉ hoàn thành phần lot còn thiếu của bậc đã đạt; hạn tính lot 31/12/2026", "Only the missing lots of the tier already reached; lots count until 31 Dec 2026", "僅完成已達級別尚缺的手數；手數計算至 2026/12/31"),
          T("Không dùng bảng thưởng Q4 để thay cam kết Q3", "Don't use the Q4 reward table in place of the Q3 commitment", "不可以 Q4 獎勵表取代 Q3 承諾"),
        ],
        note: T("Mức thưởng theo bảng Q3 đã đăng ký trên Portal (không nằm trong tài liệu đã đối chiếu).", "Rewards follow the Q3 table registered on the Portal (not in the documents we checked).", "獎勵依 Portal 上已報名的 Q3 表（不在已核對文件內）。"),
      },
      {
        key: "q3Gadget", hidden: true, group: "followup", share: "public", icon: "gift", from: "2026-07-15", until: "2026-10-31", regUntil: "2026-09-30",
        art: "gadget",
        headline: T("Hoàn thành lot còn thiếu trước 31/10", "Finish the missing lots by 31 Oct", "於 10/31 前完成尚缺手數"),
        sub: T("Ultimate Gadget Q3: nhận quà hoặc 70% tiền khi đủ lot của bậc đã đạt", "Ultimate Gadget Q3: take the gadget or 70% in cash once the tier's lots are done", "Ultimate Gadget Q3：完成已達級別手數後可領獎品或 70% 現金"),
        steps: [
          T("Mở Portal → Promotions, xem chương trình Gadget Q3 đã đăng ký", "Open Portal → Promotions and find the Q3 Gadget promotion you joined", "開啟 Portal → 活動頁，找到已參加的 Gadget Q3"),
          T("Kiểm tra bậc net deposit đã đạt (nạp đóng 30/09)", "Check the net deposit tier you reached (deposits closed 30 Sep)", "確認已達的淨入金級別（入金 9/30 截止）"),
          T("Hoàn thành lot còn thiếu trước 31/10/2026 rồi chọn quà hoặc tiền", "Finish the missing lots by 31 Oct 2026, then choose the gadget or the cash", "於 2026/10/31 前完成尚缺手數，再選擇獎品或現金"),
        ],
        name: T("Ultimate Gadget Rewards Q3 (khách cũ)", "Ultimate Gadget Rewards Q3 (existing clients)", "Q3 終極數碼獎賞（舊客戶）"),
        value: T("Apple Watch SE 3 → MacBook Pro 14\", hoặc 70% bằng tiền", "Apple Watch SE 3 → MacBook Pro 14\", or 70% in cash", "Apple Watch SE 3 → MacBook Pro 14\"，或 70% 現金"),
        seg: T("Đã đăng ký Q3 và đạt điều kiện nạp", "Registered for Q3 and met the deposit requirement", "已報名 Q3 並達入金條件"),
        // [net deposit USD, lot chuẩn, quà, encash 70% USD] theo PDF "Ultimate Gadget Rewards" Q3
        table: {
          cols: [T("Net deposit", "Net deposit", "淨入金"), T("Lot", "Lots", "手數"), T("Quà", "Gadget", "獎品"), T("Hoặc 70%", "Or 70%", "或 70%")],
          rows: [
            [10000, 100, "Apple Watch SE 3 44mm", 340.8],
            [20000, 150, "iPad Air 11\" 256GB", 608.6],
            [30000, 250, "iPhone 17 512GB", 723.45],
            [40000, 350, "iPhone 17 Pro Max 512GB", 1041.95],
            [50000, 550, "MacBook Pro 14\" M5 Pro 24GB 1TB", 1729.7],
          ],
        },
        rules: [
          T("Nạp đã đóng 30/09/2026; chỉ hoàn thành lot còn thiếu, hạn 31/10/2026", "Deposits closed on 30 Sep 2026; only the missing lots remain, until 31 Oct 2026", "入金已於 2026/9/30 截止；僅需完成尚缺手數，期限 2026/10/31"),
          T("Đạt cả net deposit lẫn lot của bậc; chọn quà hoặc tiền một lần, không đổi sau khi chọn", "Both the net deposit and lots of a tier must be met; gift or cash is chosen once and can't be changed", "須同時達到該級淨入金與手數；獎品或現金僅可選一次，選定後不可更改"),
          T("Không dùng bảng quà Q4 để thay bảng Q3", "Don't use the Q4 gift table in place of the Q3 one", "不可以 Q4 獎品表取代 Q3 表"),
        ],
        note: T("Đây là bảng Q3, khác bảng Q4 của ưu đãi Gadget.", "This is the Q3 table, different from the Q4 table of the Gadget promotion.", "此為 Q3 表，與 Gadget 優惠的 Q4 表不同。"),
      },
    ],
  };
})();
