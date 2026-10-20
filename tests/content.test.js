// Kiểm tra dữ liệu và chữ trong content.js: số liệu khớp tài liệu TMGM, link đúng, đủ 3 ngôn ngữ.
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../calc.js");
const { loadContent } = require("./helpers.js");

const D = loadContent();
const S = D.sections;
const rows = (arr, ...keys) => Array.from(arr, (r) => keys.map((k) => r[k]));

// ---------- đủ 3 ngôn ngữ ----------
const isT = (o) => o && typeof o === "object" && !Array.isArray(o) && "vi" in o && "en" in o && "zh" in o;
const walk = (o, p, fn) => {
  if (isT(o)) return fn(o, p);
  if (Array.isArray(o)) return o.forEach((x, i) => walk(x, `${p}[${i}]`, fn));
  if (o && typeof o === "object") for (const k of Object.keys(o)) walk(o[k], `${p}.${k}`, fn);
};

test("mọi chuỗi đều có đủ vi / en / zh, không để trống", () => {
  const bad = [];
  walk(D, "MIB", (t, p) => {
    for (const l of ["vi", "en", "zh"]) {
      const v = t[l];
      if (Array.isArray(v) ? v.length === 0 || v.some((x) => !String(x).trim()) : typeof v !== "string" || !v.trim()) bad.push(`${p}.${l}`);
    }
  });
  assert.deepEqual(bad, []);
});

test("các chỗ điền {x} giống nhau ở cả 3 ngôn ngữ", () => {
  const bad = [];
  const ph = (s) => (typeof s === "string" ? [...new Set(s.match(/\{\w+\}/g) || [])].sort().join(",") : "");
  walk(D, "MIB", (t, p) => {
    if (typeof t.en !== "string") return;
    if (ph(t.vi) !== ph(t.en) || ph(t.zh) !== ph(t.en)) bad.push(p);
  });
  assert.deepEqual(bad, []);
});

test("không còn chữ 'undefined' hay '[object Object]' trong chuỗi", () => {
  const bad = [];
  walk(D, "MIB", (t, p) => { for (const l of ["vi", "en", "zh"]) if (/undefined|\[object/.test(String(t[l]))) bad.push(`${p}.${l}`); });
  assert.deepEqual(bad, []);
});

test("thứ trong tuần có đủ 7 ngày ở cả 3 ngôn ngữ", () => {
  const w = S["lich-tien"].weekdays;
  for (const l of ["vi", "en", "zh"]) assert.equal(w[l].length, 7);
});

// ---------- thông tin liên hệ ----------
test("liên hệ: email công ty, link đăng ký, Telegram, WhatsApp", () => {
  assert.equal(D.meta.contactEmail, "precy.vuong@tmgm.com");
  assert.deepEqual({ ...D.meta.register }, {
    global: "https://portal.tmgm.com/register?sales=NzAwMV9QcmVjeVZ1b25n&language=en",
    vn: "https://portal.tmgm.com/register?sales=NzAwMV9QcmVjeVZ1b25n&language=vi",
  });
  assert.equal("registerUrl" in D.meta, false); // thay bằng 2 link Global / Việt Nam
  assert.equal("bookingUrl" in D.meta, false); // thay bằng form liên hệ
  assert.equal(D.presenter.telegram, "guowang26");
  assert.equal(D.presenter.whatsappLink, "61410678015");
});

// ---------- slide 2: 4 nút verify và ảnh có link ----------
test("4 cơ quan quản lý, link https, ASIC mở thẳng trang chi tiết của TMGM", () => {
  const r = S["phap-ly"].regulators;
  assert.deepEqual(Array.from(r, (x) => x.name), ["ASIC", "VFSC", "FSA Seychelles", "FSC Mauritius"]);
  for (const x of r) { assert.match(x.url, /^https:\/\//); assert.ok(x.entity && x.id, x.name); }
  assert.equal(r[0].url, "https://service.asic.gov.au/search/EntityDetail?LicenceNumber=436416&PermissionType=Australian%20financial%20services%20licensees&licenceName=TRADEMAX%20AUSTRALIA%20LIMITED");
  assert.equal(r[3].copy, "Trademax"); // FSC không có link thẳng tới kết quả: copy sẵn tên để dán
  assert.equal(r.filter((x) => x.copy).length, 1);
});

test("ảnh Chelsea và Australian Open dẫn tới bài của chính câu lạc bộ / ban tổ chức giải", () => {
  const ph = S["phap-ly"].photos;
  const by = (f) => ph.find((p) => p.file === f);
  assert.equal(new URL(by("chelsea.webp").href).hostname, "www.chelseafc.com");
  assert.match(by("chelsea.webp").href, /tmgm/);
  assert.equal(new URL(by("australian-open.webp").href).hostname, "ausopen.com");
  assert.equal(new URL(by("aff-cup.webp").href).hostname, "www.tmgm.com");
  for (const p of ph) assert.match(p.href, /^https:\/\//, p.file);
  assert.equal(new URL(S["phap-ly"].awardHref).hostname, "www.tmgm.com");
});

// ---------- slide 4: chi phí khách theo file khảo sát ----------
test("tài khoản: rebate theo bảng TMGM, chi phí Edge/Classic/STD theo file khảo sát", () => {
  const a = Object.fromEntries(D.accounts.map((x) => [x.name, x]));
  assert.deepEqual(rows(D.accounts, "name", "fx", "gold"), [["Edge", 2, 2], ["Classic", 4, 4], ["Prime", 7, 10], ["STD", 10, 20], ["STD05", 15, 23]]);
  assert.deepEqual([a.Edge.costFx, a.Edge.costGold], [7, 15]);
  assert.deepEqual([a.Classic.costFx, a.Classic.costGold], [9, 17]);
  assert.deepEqual([a.STD.costFx, a.STD.costGold], [18, 33]);
});

// ---------- slide 6: ECN ----------
test("ECN: kỳ 1/10–31/12/2026, số mặc định 1.000/1.000 lot, ví dụ TMGM giữ nguyên", () => {
  assert.deepEqual({ ...D.ecn.period }, { from: "2026-10-01", to: "2026-12-31" });
  assert.deepEqual({ ...D.ecn.defaults }, { deposit: 150000, lotsFx: 1000, lotsGold: 1000 });
  assert.deepEqual({ ...D.ecn.example }, { deposit: 150000, lotsFx: 1000, lotsGold: 800 });
  assert.deepEqual(Array.from(D.ecn.tiers, (t) => C.ecnRate(2, t.fxUp)), [3, 3.6, 4, 5, 5]);
});

// ---------- slide 7: lịch tiền về ----------
test("danh sách khoản tiền: đủ 6 khoản, rebate cơ bản đứng đầu", () => {
  assert.deepEqual(Array.from(D.payouts, (p) => p.key), ["base", "wed", "day13", "bd5", "bonus", "gift"]);
  assert.equal(D.payouts[0].key, "base");
});

// ---------- slide 8: bậc KM ----------
test("bậc KM MIB mặc định: 5 bậc theo PDF KM MIB tháng 9", () => {
  assert.deepEqual(rows(D.mibTiers, "deposit", "lots", "mib"), [[50000, 375, 1300], [100000, 750, 3000], [170000, 1200, 6000], [340000, 2400, 12900], [500000, 3300, 20000]]);
});

test("bậc KM MIB: có thêm bộ 7 bậc theo file khảo sát để chọn nhanh", () => {
  const p = D.mibTierPresets;
  assert.deepEqual(Object.keys(p), ["pdf5", "research7"]);
  assert.deepEqual(rows(p.pdf5, "deposit", "lots", "mib"), rows(D.mibTiers, "deposit", "lots", "mib"));
  assert.deepEqual(rows(p.research7, "deposit", "lots", "mib"), [[17000, 140, 300], [34000, 255, 700], [50000, 375, 1300], [100000, 750, 3000], [170000, 1200, 6000], [340000, 2400, 12900], [500000, 3300, 20000]]);
});

test("bậc KM IB: 7 bậc theo PDF KM IB tháng 9 (260 → 15.000 USD)", () => {
  assert.deepEqual(rows(D.ibTiers, "deposit", "lots", "reward"), [[17000, 85, 260], [34000, 170, 580], [50000, 250, 900], [100000, 500, 2000], [170000, 800, 3800], [340000, 1600, 8500], [500000, 2200, 15000]]);
});

test("mọi bộ bậc đều tăng dần theo net deposit, lot và thưởng", () => {
  assert.deepEqual(Array.from(C.tierWarnings(D.mibTiers, "mib")), []);
  assert.deepEqual(Array.from(C.tierWarnings(D.mibTierPresets.research7, "mib")), []);
  assert.deepEqual(Array.from(C.tierWarnings(D.ibTiers, "reward")), []);
  for (const set of [D.mibTiers, D.mibTierPresets.research7]) assert.equal(C.cleanTiers(set, "mib").dropped, 0);
  assert.equal(C.cleanTiers(D.ibTiers, "reward").dropped, 0);
});

test("slide KM có nội dung IB: tiêu đề, điều kiện, quy tắc lot", () => {
  const ib = S.m2.ib;
  assert.ok(S.m2.titleIb && S.m2.tierLine && ib.plain && ib.condsTitle);
  assert.ok(ib.conds.length >= 6);
  assert.match(S.m2.titleIb.en, /\{v\}/); // số lớn tính động theo bậc người dùng sửa
});

// ---------- slide ẩn / hiện ----------
test("slide IB, M1, M3 và Q&A bị ẩn; KM MIB và Swap hiện cho cả MIB lẫn IB", () => {
  for (const id of ["ib", "m1", "m3", "faq"]) assert.equal(S[id].hidden, true, id);
  for (const id of ["m2", "m4"]) assert.equal(S[id].part, "common", id);
  for (const id of ["m5", "so-sanh"]) assert.equal(S[id].part, "mib", id);
});

// ---------- link giữa các slide ----------
test("link từ slide Năm dòng thu nhập không trỏ tới slide IB đã ẩn", () => {
  for (const st of S["nam-dong"].streams) {
    for (const v of [st.link, st.link?.mib, st.link?.ib]) if (typeof v === "string") assert.ok(!S[v].hidden || v === "faq", `${v} đang ẩn`);
  }
});

// ---------- bìa ----------
test("bìa không còn ảnh nền và dòng ghi nguồn ảnh", () => {
  assert.equal("credit" in S.bia, false);
  assert.equal("photo" in S.bia, false);
});

// ---------- ưu đãi cho khách ----------
test("Points: 10 điểm/lot; bảng đổi cashback theo trang TMGM Rewards (9/10/2026)", () => {
  assert.equal(D.points.perLot, 10);
  assert.deepEqual(rows(D.points.cashback, "usd", "pts"), [[5, 130], [10, 240], [20, 450], [30, 600]]);
  assert.ok(D.points.cashback.some((c) => c.usd === D.points.refUsd), "refUsd phải có trong bảng");
});

test("Cashback Q4 khớp PDF SEA Korea: bậc lũy kế 1k/20 → 10k/170, thưởng 50/100/150/200, tối đa 500", () => {
  const T = D.clientCashback.tiers;
  assert.deepEqual(rows(T, "deposit", "lots", "total"), [[1000, 20, 50], [3000, 55, 150], [6000, 105, 300], [10000, 170, 500]]);
  assert.deepEqual(Array.from(T, (t, i) => t.total - (i ? T[i - 1].total : 0)), [50, 100, 150, 200]);
  assert.deepEqual({ ...D.clientCashback.period }, { from: "2026-10-01", to: "2026-12-31", lotsTo: "2027-03-31" });
});

test("Halloween (trong Ưu đãi khác): 5/10–5/11/2026, link landing page SEA", () => {
  const h = D.extraPromos.find((p) => p.key === "halloween");
  assert.deepEqual([h.from, h.until, h.group, h.share], ["2026-10-05", "2026-11-05", "small", "public"]);
  assert.equal(h.url, "https://lnd.tmgm-apac.com/en/halloween");
});

test("dòng thu nhập 5 trỏ tới slide Ưu đãi cho khách", () => {
  const st = S["nam-dong"].streams[4];
  assert.equal(st.link, "uu-dai");
  assert.equal(st.client, true);
});

// ---------- ưu đãi khác (slide km-khac) ----------
test("extraPromos: đủ trường, nhóm/chia sẻ hợp lệ, ngày đúng định dạng, link https", () => {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  assert.equal(D.extraPromos.length, 10);
  assert.equal(new Set(D.extraPromos.map((p) => p.key)).size, 10);
  for (const p of D.extraPromos) {
    assert.ok(["small", "marketing"].includes(p.group), p.key);
    assert.ok(["public", "private"].includes(p.share), p.key);
    assert.match(p.from, iso, p.key);
    assert.match(p.until, iso, p.key);
    assert.ok(p.from <= p.until, p.key);
    assert.ok(p.name && p.value && p.seg && p.rules.length >= 2, p.key);
    if (p.url) assert.match(p.url, /^https:\/\//, p.key);
  }
  const by = (g, s) => Array.from(D.extraPromos.filter((p) => p.group === g && (!s || p.share === s)), (p) => p.key);
  assert.deepEqual(by("small"), ["halloween", "credit50", "gadget", "rocket", "welcomeBack"]);
  assert.deepEqual(by("marketing", "public"), ["winYourRide", "jayChou"]);
  assert.deepEqual(by("marketing", "private"), ["thaiConcert", "carnival", "premierLeague"]);
});

test("extraPromos: số liệu khớp PDF (Credit, Gadget, Rocket, Welcome Back, Win Your Ride)", () => {
  const p = (k) => D.extraPromos.find((x) => x.key === k), txt = (k) => JSON.stringify(p(k));
  assert.match(p("credit50").value.vi, /50%.*10\.000 USD/);
  assert.match(txt("credit50"), /tối thiểu 500 USD/);
  assert.deepEqual(rows(p("gadget").table.rows, 0, 1, 3), [[10000, 150, 401.1], [20000, 250, 825.3], [30000, 350, 1206.8], [40000, 450, 1292.2], [60000, 650, 1864.8], [80000, 850, 3285.8]]);
  assert.equal(p("gadget").table.cols.length, 4);
  assert.match(txt("rocket"), /FTD ≥ 50 USD và giao dịch 5 lot BTCUSD \(= 0,5 lot chuẩn\)/);
  assert.match(p("rocket").value.en, /USD 20/);
  assert.match(txt("welcomeBack"), /nạp 200 USD/);
  assert.match(p("welcomeBack").value.vi, /^320 points/);
  assert.match(txt("winYourRide"), /FTD ≥ 150 USD/);
  assert.deepEqual([p("winYourRide").from, p("winYourRide").until], ["2026-08-20", "2026-11-20"]);
});

test("KM tháng 10: bậc IB và MIB giữ nguyên số tháng 9 theo PDF tháng 10; kỳ đổi sang T10", () => {
  assert.deepEqual(rows(D.ibTiers, "deposit", "lots", "reward"), [[17000, 85, 260], [34000, 170, 580], [50000, 250, 900], [100000, 500, 2000], [170000, 800, 3800], [340000, 1600, 8500], [500000, 2200, 15000]]);
  assert.deepEqual(rows(D.mibTiers, "deposit", "lots", "mib"), [[50000, 375, 1300], [100000, 750, 3000], [170000, 1200, 6000], [340000, 2400, 12900], [500000, 3300, 20000]]);
  assert.equal(D.meta.validUntil, "2026-10-31");
  assert.equal(D.meta.period.en, "Oct/Q4 2026");
});
