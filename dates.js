/*
 * Logic ngày cho slide "Lịch tiền về". Hàm thuần, chạy được trong trình duyệt (window.MIBDates) và node (require).
 * Ngày là chuỗi ISO "YYYY-MM-DD", tính theo UTC nên không lệch do múi giờ hay giờ mùa hè.
 * Ngày làm việc = T2–T6 (chưa trừ ngày lễ). T = ngày giao dịch.
 */
(function (root) {
  const DAY = 864e5;

  function toMs(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    if (!m) throw new RangeError(`Ngày không hợp lệ: ${iso}`);
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    const t = Date.UTC(y, mo - 1, d);
    const back = new Date(t);
    if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) throw new RangeError(`Ngày không hợp lệ: ${iso}`);
    return t;
  }
  const toIso = (t) => new Date(t).toISOString().slice(0, 10);
  const pad = (n) => String(n).padStart(2, "0");

  const addDays = (iso, n) => toIso(toMs(iso) + n * DAY);
  const weekday = (iso) => new Date(toMs(iso)).getUTCDay(); // 0 = Chủ nhật
  const isWorkday = (iso) => { const w = weekday(iso); return w >= 1 && w <= 5; };

  // Cộng n ngày làm việc (n ≥ 0). Bắt đầu đếm từ ngày SAU iso: T6 + 1 = T2; T7 + 1 = T2.
  function addWorkdays(iso, n) {
    toMs(iso);
    let d = iso;
    for (let left = n; left > 0; ) { d = addDays(d, 1); if (isWorkday(d)) left--; }
    return d;
  }

  // Ngày làm việc thứ n của tháng (month: 1–12).
  function nthWorkday(year, month, n) {
    let d = `${year}-${pad(month)}-01`;
    toMs(d);
    for (let left = n; ; d = addDays(d, 1)) if (isWorkday(d) && --left === 0) return d;
  }

  // Thứ Tư của tuần kế tiếp; tuần tính T2–CN.
  function weeklyPayDate(iso) {
    const w = weekday(iso);
    const monday = addDays(iso, -((w + 6) % 7));
    return addDays(monday, 7 + 2);
  }

  const monthStart = (iso) => iso.slice(0, 7) + "-01";
  const firstOfNextMonth = (iso) => { const [y, m] = iso.split("-").map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`; };
  // Hạn nộp KM tháng: ngày 7 của tháng sau (PDF KM tháng 9 và tháng 10: nộp trước 7/10, 7/11). Cuối tuần thì khuyến nghị nộp trước đó.
  function promoDeadline(iso) {
    const date = firstOfNextMonth(iso).slice(0, 8) + "07";
    let recommended = date;
    while (!isWorkday(recommended)) recommended = addDays(recommended, -1);
    return { date, weekend: !isWorkday(date), recommended };
  }

  const WORKDAYS_PROMO = 14; // thưởng KM tháng về trong 14 ngày làm việc sau khi duyệt
  const WORKDAYS_GIFT = 0; // Cashback Q4 của khách: đổi là về tài khoản giao dịch ngay

  // Lịch nộp đơn và nhận tiền cho một ngày giao dịch T. Trả về đủ 6 khoản; giao diện chỉ hiện khoản đang bật.
  // opts: { trade, apply?, ecnPeriod: {from, to} }
  function schedule(opts) {
    const trade = opts.trade;
    toMs(trade);
    const next = firstOfNextMonth(trade);
    const deadline = promoDeadline(trade);
    const apply = opts.apply || deadline.recommended;
    toMs(apply);
    const nextY = +next.slice(0, 4), nextM = +next.slice(5, 7);
    const mark = (date, cls) => ({ date, cls });

    const basePay = addWorkdays(trade, 1);
    const weekPay = weeklyPayDate(trade);
    const before14 = next.slice(0, 8) + "14";
    const ecnOk = trade >= opts.ecnPeriod.from && trade <= opts.ecnPeriod.to;
    const win = ecnOk ? { from: nthWorkday(nextY, nextM, 1), to: nthWorkday(nextY, nextM, 5) } : null;
    const winDays = [];
    if (win) for (let d = win.from; d <= win.to; d = addDays(d, 1)) if (isWorkday(d)) winDays.push(d);
    const promoPay = addWorkdays(apply, WORKDAYS_PROMO);
    const giftPay = addWorkdays(apply, WORKDAYS_GIFT);

    const rows = [
      { key: "base", applicable: true, unconfirmed: true, apply: { type: "none" }, payout: { type: "date", date: basePay }, marks: [mark(basePay, "is-base")] },
      { key: "wed", applicable: true, unconfirmed: true, apply: { type: "am" }, payout: { type: "date", date: weekPay }, marks: [mark(weekPay, "is-wed")] },
      { key: "day13", applicable: true, unconfirmed: false, apply: { type: "am" }, payout: { type: "before", date: before14 }, marks: [mark(addDays(before14, -1), "is-13")] },
      {
        key: "bd5", applicable: ecnOk, unconfirmed: false, apply: { type: "none" },
        payout: win ? { type: "window", from: win.from, to: win.to } : null,
        marks: winDays.map((d) => mark(d, "is-ecn")),
      },
      {
        key: "bonus", applicable: true, unconfirmed: false,
        apply: { type: "deadline", date: deadline.date, weekend: deadline.weekend, recommended: deadline.recommended },
        late: apply > deadline.date, payout: { type: "date", date: promoPay }, marks: [mark(promoPay, "is-promo")],
      },
      { key: "gift", applicable: true, unconfirmed: false, apply: { type: "redeem", date: apply }, payout: { type: "date", date: giftPay }, marks: [mark(giftPay, "is-gift")] },
    ];
    return { rows, recommendedApply: deadline.recommended, tradeMonth: { y: +trade.slice(0, 4), m: +trade.slice(5, 7) } };
  }

  // Tháng có ngày nhận tiền muộn nhất trong các khoản đang bật (keys); khoản không áp dụng thì bỏ qua.
  function focusMonth(rows, keys) {
    let last = null;
    for (const r of rows) {
      if (!keys.includes(r.key) || !r.applicable) continue;
      for (const m of r.marks) if (!last || m.date > last) last = m.date;
    }
    return last ? { y: +last.slice(0, 4), m: +last.slice(5, 7) } : null;
  }

  // Trạng thái một ưu đãi theo ngày hôm nay (p = { from, until }, cả hai ngày đều tính):
  // "upcoming" chưa bắt đầu, "active" đang chạy, "ended" đã hết. daysLeft = số ngày tới hạn (0 = hôm nay là ngày cuối).
  // level: "urgent" (< 7 ngày), "soon" (< 30 ngày), "ok".
  function promoStatus(p, today) {
    const t = toMs(today), until = toMs(p.until);
    const state = t > until ? "ended" : p.from && t < toMs(p.from) ? "upcoming" : "active";
    const daysLeft = Math.round((until - t) / DAY);
    return { state, daysLeft, level: daysLeft < 7 ? "urgent" : daysLeft < 30 ? "soon" : "ok" };
  }

  const api = { addDays, weekday, isWorkday, addWorkdays, nthWorkday, weeklyPayDate, monthStart, firstOfNextMonth, promoDeadline, schedule, focusMonth, promoStatus };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MIBDates = api;
})(this);
