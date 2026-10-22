// Logic ngày cho slide "Lịch tiền về": ngày làm việc (chỉ bỏ T7/CN, chưa trừ ngày lễ) và lịch nộp đơn / nhận tiền.
// T = ngày giao dịch. Ngày dùng chuỗi ISO "YYYY-MM-DD", tính theo UTC nên không lệch do múi giờ / giờ mùa hè.
const test = require("node:test");
const assert = require("node:assert/strict");
const Dt = require("../dates.js");

const ECN = { from: "2026-10-01", to: "2026-12-31" };
const sched = (o) => Dt.schedule({ ecnPeriod: ECN, ...o });
const row = (s, key) => s.rows.find((r) => r.key === key);

test("ngày làm việc: T2–T6 là ngày làm việc, T7/CN thì không", () => {
  assert.equal(Dt.isWorkday("2026-10-09"), true); // thứ Sáu
  assert.equal(Dt.isWorkday("2026-10-10"), false); // thứ Bảy
  assert.equal(Dt.isWorkday("2026-10-11"), false); // Chủ nhật
  assert.equal(Dt.isWorkday("2026-10-12"), true); // thứ Hai
});

test("addDays không lệch qua giờ mùa hè và qua tháng/năm", () => {
  assert.equal(Dt.addDays("2026-03-08", 1), "2026-03-09");
  assert.equal(Dt.addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(Dt.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(Dt.addDays("2026-03-01", -1), "2026-02-28");
});

test("addWorkdays: T+1 từ thứ Sáu là thứ Hai; từ thứ Bảy cũng là thứ Hai; 0 giữ nguyên", () => {
  assert.equal(Dt.addWorkdays("2026-10-09", 1), "2026-10-12");
  assert.equal(Dt.addWorkdays("2026-10-10", 1), "2026-10-12");
  assert.equal(Dt.addWorkdays("2026-10-09", 0), "2026-10-09");
  assert.equal(Dt.addWorkdays("2026-10-12", 5), "2026-10-19");
  assert.equal(Dt.addWorkdays("2026-11-06", 14), "2026-11-26");
  assert.equal(Dt.addWorkdays("2026-11-06", 7), "2026-11-17");
});

test("nthWorkday: 5 ngày làm việc đầu tháng", () => {
  assert.equal(Dt.nthWorkday(2026, 11, 1), "2026-11-02");
  assert.equal(Dt.nthWorkday(2026, 11, 5), "2026-11-06");
  assert.equal(Dt.nthWorkday(2026, 12, 5), "2026-12-07"); // 1–4/12 rồi sang thứ Hai 7/12
  assert.equal(Dt.nthWorkday(2027, 1, 5), "2027-01-07"); // 1/1/2027 là thứ Sáu, chưa trừ ngày lễ
});

test("weeklyPayDate: thứ Tư của tuần kế tiếp (tuần tính T2–CN)", () => {
  assert.equal(Dt.weeklyPayDate("2026-10-09"), "2026-10-14"); // T6
  assert.equal(Dt.weeklyPayDate("2026-10-11"), "2026-10-14"); // CN vẫn thuộc tuần 5–11/10
  assert.equal(Dt.weeklyPayDate("2026-10-12"), "2026-10-21"); // T2 đầu tuần mới
  assert.equal(Dt.weeklyPayDate("2026-10-14"), "2026-10-21"); // chính thứ Tư
});

test("ngày không hợp lệ bị từ chối", () => {
  assert.throws(() => Dt.schedule({ trade: "abc", ecnPeriod: ECN }), RangeError);
  assert.throws(() => Dt.schedule({ trade: "2026-02-31", ecnPeriod: ECN }), RangeError);
  assert.throws(() => Dt.addWorkdays("2026-13-01", 1), RangeError);
});

test("lịch trả cho T = 9/10/2026: đủ 6 khoản theo đúng thứ tự", () => {
  const s = sched({ trade: "2026-10-09" });
  assert.deepEqual(Array.from(s.rows, (r) => r.key), ["base", "wed", "day13", "bd5", "bonus", "gift"]);
});

test("rebate cơ bản: T+1 ngày làm việc, không cần đăng ký, chờ TMGM xác nhận", () => {
  const b = row(sched({ trade: "2026-10-09" }), "base");
  assert.equal(b.apply.type, "none");
  assert.deepEqual({ ...b.payout }, { type: "date", date: "2026-10-12" });
  assert.equal(b.unconfirmed, true);
  assert.equal(row(sched({ trade: "2026-10-14" }), "base").payout.date, "2026-10-15");
});

test("hoàn swap tuần: AM đăng ký một lần, trả thứ Tư tuần sau", () => {
  const w = row(sched({ trade: "2026-10-09" }), "wed");
  assert.equal(w.apply.type, "am");
  assert.equal(w.payout.date, "2026-10-14");
  assert.deepEqual(Array.from(w.marks, (m) => m.date), ["2026-10-14"]);
});

test("hoàn swap tháng: trước ngày 14 tháng sau, đánh dấu ngày 13", () => {
  const m = row(sched({ trade: "2026-10-09" }), "day13");
  assert.deepEqual({ ...m.payout }, { type: "before", date: "2026-11-14" });
  assert.deepEqual(Array.from(m.marks, (x) => x.date), ["2026-11-13"]);
  assert.equal(row(sched({ trade: "2026-12-15" }), "day13").payout.date, "2027-01-14"); // qua năm
});

test("ECN Q4: cửa sổ 5 ngày làm việc đầu tháng sau, tự động", () => {
  const e = row(sched({ trade: "2026-10-09" }), "bd5");
  assert.equal(e.applicable, true);
  assert.equal(e.apply.type, "none");
  assert.deepEqual({ ...e.payout }, { type: "window", from: "2026-11-02", to: "2026-11-06" });
  assert.deepEqual(Array.from(e.marks, (x) => x.date), ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
});

test("ECN Q4: tháng 12 trả đầu tháng 1/2027; ngoài kỳ 1/10–31/12 thì không áp dụng", () => {
  const dec = row(sched({ trade: "2026-12-31" }), "bd5");
  assert.equal(dec.applicable, true);
  assert.deepEqual({ ...dec.payout }, { type: "window", from: "2027-01-01", to: "2027-01-07" });
  assert.equal(row(sched({ trade: "2026-09-30" }), "bd5").applicable, false);
  assert.equal(row(sched({ trade: "2027-01-01" }), "bd5").applicable, false);
  assert.equal(row(sched({ trade: "2026-10-01" }), "bd5").applicable, true);
  assert.equal(row(sched({ trade: "2026-09-30" }), "bd5").payout, null);
});

test("KM tháng MIB/IB: hạn nộp ngày 7 tháng sau; cuối tuần thì khuyến nghị nộp trước đó", () => {
  const b = row(sched({ trade: "2026-10-09" }), "bonus"); // 7/11/2026 là thứ Bảy
  assert.equal(b.apply.type, "deadline");
  assert.equal(b.apply.date, "2026-11-07");
  assert.equal(b.apply.weekend, true);
  assert.equal(b.apply.recommended, "2026-11-06");
  assert.equal(b.unconfirmed, false); // "ngày 7" có ở cả PDF tháng 9 và tháng 10
  const wk = row(sched({ trade: "2026-09-10" }), "bonus"); // 7/10/2026 là thứ Tư, đúng như PDF tháng 9
  assert.equal(wk.apply.date, "2026-10-07");
  assert.equal(wk.apply.weekend, false);
  assert.equal(wk.apply.recommended, "2026-10-07");
  const sun = row(sched({ trade: "2027-01-20" }), "bonus"); // 7/2/2027 là Chủ nhật
  assert.equal(sun.apply.recommended, "2027-02-05");
});

test("KM tháng: tiền về chậm nhất 14 ngày làm việc sau ngày nộp (mặc định = ngày khuyến nghị)", () => {
  const s = sched({ trade: "2026-10-09" });
  assert.equal(s.recommendedApply, "2026-11-06");
  const b = row(s, "bonus");
  assert.deepEqual({ ...b.payout }, { type: "date", date: "2026-11-26" });
  assert.equal(b.late, false);
  assert.deepEqual(Array.from(b.marks, (x) => x.date), ["2026-11-26"]);
});

test("KM tháng: nộp muộn hơn hạn thì đánh dấu quá hạn nhưng vẫn tính ngày", () => {
  const b = row(sched({ trade: "2026-10-09", apply: "2026-11-09" }), "bonus");
  assert.equal(b.late, true);
  assert.equal(b.payout.date, "2026-11-27"); // 9/11 + 14 ngày làm việc
  assert.equal(row(sched({ trade: "2026-10-09", apply: "2026-11-07" }), "bonus").late, false); // đúng hạn chót
});

test("ưu đãi cho khách: khách đổi trên Portal, Cashback Q4 về ngay khi đổi", () => {
  const g = row(sched({ trade: "2026-10-09", apply: "2026-11-06" }), "gift");
  assert.equal(g.apply.type, "redeem");
  assert.equal(g.apply.date, "2026-11-06");
  assert.equal(g.payout.date, "2026-11-06");
  assert.equal(g.unconfirmed, false);
});

test("focusMonth: tháng có ngày nhận tiền muộn nhất trong các khoản đang bật", () => {
  const s = sched({ trade: "2026-10-09" });
  assert.deepEqual({ ...Dt.focusMonth(s.rows, ["base"]) }, { y: 2026, m: 10 });
  assert.deepEqual({ ...Dt.focusMonth(s.rows, ["base", "bd5"]) }, { y: 2026, m: 11 });
  assert.deepEqual({ ...Dt.focusMonth(s.rows, ["base", "wed", "day13", "bonus"]) }, { y: 2026, m: 11 });
  // khoản không áp dụng (ngoài kỳ) không kéo lịch sang tháng khác
  const out = sched({ trade: "2026-09-15" });
  assert.deepEqual({ ...Dt.focusMonth(out.rows, ["base", "bd5"]) }, { y: 2026, m: 9 });
});

test("kết quả không bị đổi khi gọi lại (hàm thuần)", () => {
  const a = JSON.stringify(sched({ trade: "2026-10-09" }));
  const b = JSON.stringify(sched({ trade: "2026-10-09" }));
  assert.equal(a, b);
});

// ---------- trạng thái ưu đãi (slide Ưu đãi khác) ----------
test("promoStatus: chưa bắt đầu, đang chạy, sắp hết, ngày cuối, đã hết", () => {
  const p = { from: "2026-10-05", until: "2026-10-31" }, st = (t) => ({ ...Dt.promoStatus(p, t) });
  assert.deepEqual(st("2026-10-04"), { state: "upcoming", daysLeft: 27, level: "soon" });
  assert.deepEqual(st("2026-10-09"), { state: "active", daysLeft: 22, level: "soon" });
  assert.deepEqual(st("2026-10-25"), { state: "active", daysLeft: 6, level: "urgent" });
  assert.deepEqual(st("2026-10-31"), { state: "active", daysLeft: 0, level: "urgent" });
  assert.equal(st("2026-11-01").state, "ended");
  assert.equal(Dt.promoStatus({ from: "2026-10-01", until: "2026-12-31" }, "2026-10-09").level, "ok");
  assert.equal(Dt.promoStatus({ until: "2026-12-31" }, "2026-10-09").state, "active"); // thiếu from: coi như đã bắt đầu
  assert.throws(() => Dt.promoStatus({ until: "2026-13-01" }, "2026-10-09"), RangeError);
});

test("promoStatus với hạn đăng ký (regUntil): quá hạn đăng ký nhưng còn hạn hoàn tất thì 'closed'; hết hạn thì 'ended'", () => {
  const p = { from: "2026-09-08", until: "2026-11-08", regUntil: "2026-10-08" }, st = (t) => ({ ...Dt.promoStatus(p, t) });
  assert.equal(st("2026-09-07").state, "upcoming");
  assert.equal(st("2026-10-08").state, "active"); // ngày cuối đăng ký vẫn đăng ký được
  assert.deepEqual(st("2026-10-09"), { state: "closed", daysLeft: 30, level: "ok" });
  assert.equal(st("2026-11-08").state, "closed");
  assert.equal(st("2026-11-09").state, "ended");
  assert.equal(Dt.promoStatus({ from: "2026-10-01", until: "2026-12-31" }, "2026-12-01").state, "active"); // không có regUntil: không bao giờ 'closed'
});
