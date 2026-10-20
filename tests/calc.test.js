// Chạy tất cả: node --test "tests/*.test.js"
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const C = require("../calc.js");

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8"), ctx);
const D = ctx.window.MIB;

test("ví dụ M5 khớp doc: 21.000 / 14.700 / 6.300 / 12.900 / 19.200", () => {
  const r = C.mibMonth(D.example, D.accounts, D.mibTiers);
  assert.equal(r.rebate, 21000);
  assert.equal(r.toSub, 14700);
  assert.equal(r.keep, 6300);
  assert.equal(r.bonus, 12900);
  assert.equal(r.total, 19200);
  assert.equal(r.gross, 361000);
  assert.equal(r.next.mib, 20000);
});

test("bậc MIB cần đạt cả net deposit lẫn lot", () => {
  assert.equal(C.mibTier(D.mibTiers, 339999, 2400).mib, 6000);
  assert.equal(C.mibTier(D.mibTiers, 340000, 2399).mib, 6000);
  assert.equal(C.mibTier(D.mibTiers, 49999, 5000), null);
  assert.equal(C.mibTier(D.mibTiers, 900000, 9000).mib, 20000);
});

test("chưa đạt bậc nào thì bậc kế là bậc đầu", () => {
  const r = C.mibMonth({ ...D.example, deposit: 10000, lotsFx: 100, lotsGold: 0 }, D.accounts, D.mibTiers);
  assert.equal(r.bonus, 0);
  assert.equal(r.next.deposit, 50000);
  assert.equal(r.needLots, 275);
  assert.equal(r.needDeposit, 40000);
});

test("bậc ECN Q4", () => {
  assert.equal(C.ecnTier(D.ecn.tiers, 4999), -1);
  assert.equal(C.ecnTier(D.ecn.tiers, 5000), 0);
  assert.equal(C.ecnTier(D.ecn.tiers, 199999), 2);
  assert.equal(C.ecnTier(D.ecn.tiers, 400000), 4);
});

test("mức rebate ECN Q4 khớp bảng TMGM: 2 × (1 + %)", () => {
  assert.deepEqual(Array.from(D.ecn.tiers, (t) => C.ecnRate(D.ecn.base.fx, t.fxUp)), [3.0, 3.6, 4.0, 5.0, 5.0]);
  assert.deepEqual(Array.from(D.ecn.tiers, (t) => C.ecnRate(D.ecn.base.gold, t.goldUp)), [2.5, 2.7, 2.9, 3.1, 3.5]);
});

test("ví dụ ECN Q4 trong điều khoản TMGM: 2.000 + 1.600 + 2.720 = 6.320", () => {
  const r = C.ecnMonth(D.ecn.example, D.ecn);
  assert.equal(r.baseFx, 2000);
  assert.equal(r.baseGold, 1600);
  assert.equal(r.add, 2720);
  assert.equal(r.total, 6320);
  assert.equal(r.uplift, 76);
});

test("ECN Q4 dưới 5.000 USD net deposit: chỉ rebate thường", () => {
  const r = C.ecnMonth({ deposit: 4999, lotsFx: 1000, lotsGold: 800 }, D.ecn);
  assert.equal(r.add, 0);
  assert.equal(r.total, 3600);
});

test("KM MIB cao hơn KM IB gộp nhánh 33–58%", () => {
  const ups = Array.from(D.mibTiers, (t) => Math.round((t.mib / t.ibCombined - 1) * 100));
  assert.deepEqual(ups, [44, 50, 58, 52, 33]);
});

// ---------- ECN Q4 trong máy tính MIB (tài khoản Edge) ----------
// ECN là add-on (mặc định tắt, chỉ bật được với Edge). Khi bật: MIB giữ 100% phần ECN cộng thêm (không chia Sub-IB), tính trên net deposit toàn nhánh (ước tính trần).
const edgePlain = { ...D.example, account: "Edge" }; // add-on tắt (mặc định)
const edge = { ...edgePlain, addons: { ecn: true } }; // bật add-on ECN Q4

test("Edge mẫu: 4.800 rebate → giữ 1.440 + thưởng 12.900 + ECN 4.540 = 18.880", () => {
  const r = C.mibMonth(edge, D.accounts, D.mibTiers, D.ecn);
  assert.equal(r.rebate, 4800); // 1.000 × 2 + 1.400 × 2
  assert.equal(r.keep, 1440);
  assert.equal(r.bonus, 12900);
  assert.equal(r.ecn, 4540); // 2.000 × 150% + 2.800 × 55% (bậc 200K–399K)
  assert.equal(r.total, 18880);
});

test("tài khoản không phải Edge: không cộng ECN", () => {
  const r = C.mibMonth(D.example, D.accounts, D.mibTiers, D.ecn);
  assert.equal(r.ecn, 0);
  assert.equal(r.total, 19200);
});

test("không truyền bảng ECN: giữ cách tính cũ", () => {
  const r = C.mibMonth(edge, D.accounts, D.mibTiers);
  assert.equal(r.ecn, 0);
  assert.equal(r.total, 1440 + 12900);
});

test("Edge dưới 5.000 USD net deposit: không có ECN cộng thêm", () => {
  const r = C.mibMonth({ ...edge, deposit: 4999 }, D.accounts, D.mibTiers, D.ecn);
  assert.equal(r.ecn, 0);
  assert.equal(r.total, r.keep);
});

test("ECN không bị chia cho Sub-IB theo %", () => {
  const a = C.mibMonth({ ...edge, share: 0 }, D.accounts, D.mibTiers, D.ecn);
  const b = C.mibMonth({ ...edge, share: 100 }, D.accounts, D.mibTiers, D.ecn);
  assert.equal(a.ecn, b.ecn);
  assert.equal(b.keep, 0);
  assert.equal(b.total, 12900 + 4540);
});

test("Edge bậc ECN cao nhất (≥ 400K): FX +150%, vàng +75%", () => {
  const r = C.mibMonth({ ...edge, deposit: 400000 }, D.accounts, D.mibTiers, D.ecn);
  assert.equal(r.ecn, 2000 * 1.5 + 2800 * 0.75); // 5.100
});

// ---------- So sánh 8 sàn (slide So sánh) ----------
// Mẫu = ví dụ slide 10: 1.000 lot FX + 1.400 lot vàng, net deposit 340K, chia 70% cho Sub-IB.
const B = (name) => D.competitors.brokers.find((b) => b.name === name);
const cctx = { mibTiers: D.mibTiers, ecn: D.ecn };
const cmp = (name, cls, p = D.example, c = cctx) => C.compareMonth(p, B(name), cls, c);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);

test("dữ liệu: 10 sàn (8 khảo sát + EC, VT ước tính), đúng tên, mỗi sàn có Standard và Raw/ECN", () => {
  assert.deepEqual(Array.from(D.competitors.brokers, (b) => b.name), ["TMGM", "Exness", "XM", "HFM", "Vantage", "AvaTrade", "Axi", "PU Prime", "EC Markets", "VT Markets"]);
  for (const b of D.competitors.brokers) for (const cls of ["std", "raw"]) {
    const r = b[cls];
    assert.ok(r && r.acc, `${b.name} ${cls}: thiếu tên tài khoản`);
    for (const k of ["costFx", "costGold"]) assert.ok(typeof r[k] === "number" || (b.est && r[k] === null), `${b.name} ${cls}.${k}`);
    // rebate theo lot (fx, gold) hoặc theo % chi phí khách (pct)
    assert.ok(typeof r.pct === "number" || ["fx", "gold"].every((k) => r[k] === null || typeof r[k] === "number"), `${b.name} ${cls}: rebate`);
  }
});

test("TMGM Standard: giữ 11.400 + KM MIB 12.900 = 24.300", () => {
  const r = cmp("TMGM", "std");
  near(r.rebate, 38000);
  near(r.keep, 11400);
  near(r.promo, 12900);
  near(r.ecn, 0);
  near(r.total, 24300);
});

test("TMGM Raw/ECN khớp máy tính slide 10 khi chọn Edge (18.880)", () => {
  const r = cmp("TMGM", "raw");
  near(r.ecn, 4540);
  near(r.total, 18880);
  near(r.total, C.mibMonth(edge, D.accounts, D.mibTiers, D.ecn).total);
});

test("TMGM Raw/ECN hết kỳ Q4: không cộng ECN", () => {
  near(cmp("TMGM", "raw", D.example, { ...cctx, ecn: null }).total, 1440 + 12900);
});

test("ECN Q4 chỉ cộng cho TMGM ở nhóm Raw", () => {
  near(cmp("TMGM", "std").ecn, 0);
  near(cmp("XM", "raw").ecn, 0);
});

test("HFM Revshare+: Standard 8.670 + 5.000 = 13.670; Zero không có rebate → 5.000", () => {
  near(cmp("HFM", "std").total, 13670);
  near(cmp("HFM", "raw").rebate, 0);
  near(cmp("HFM", "raw").total, 5000);
});

test("HFM Revshare+: cần đạt cả net deposit lẫn lot; dưới bậc đầu thì 0", () => {
  near(cmp("HFM", "std", { ...D.example, deposit: 100000, lotsFx: 300, lotsGold: 400 }).promo, 3000); // 700 lot < 750
  near(cmp("HFM", "std", { ...D.example, deposit: 4999 }).promo, 0);
});

test("XM: 2 cách tính cộng dồn: +20% rebate MIB giữ lại, +10% hoa hồng của Sub-IB", () => {
  near(cmp("XM", "std").promo, 9840 * 0.2 + 22960 * 0.1); // 1.968 + 2.296 = 4.264
  near(cmp("XM", "std").total, 14104);
  near(cmp("XM", "raw").total, 4410 + 882 + 1029); // 6.321
  const all = cmp("XM", "std", { ...D.example, share: 100 }); // chia hết cho Sub-IB: chỉ còn phần 10%
  near(all.keep, 0);
  near(all.promo, 3280);
  near(cmp("XM", "std", { ...D.example, share: 0 }).promo, 6560); // không chia: chỉ còn phần 20%
});

test("Exness: thưởng trọn đời quy đổi 0,94 USD/lot vàng", () => {
  near(cmp("Exness", "std").promo, 1316);
  near(cmp("Exness", "std").total, 7008 + 1316);
  near(cmp("Exness", "raw").total, 1134 + 1316);
});

test("Axi: thưởng trọn đời quy đổi 1 USD/lot", () => {
  near(cmp("Axi", "std").total, 4440 + 2400);
  near(cmp("Axi", "raw").total, 3000 + 2400);
});

test("sàn không có KM IB: chỉ còn phần rebate giữ lại", () => {
  const r = cmp("PU Prime", "std");
  near(r.promo, 0);
  near(r.total, 8700);
  near(cmp("AvaTrade", "std").total, 8670);
});

test("Vantage Standard: rebate 53% chi phí khách → 6,89 / 12,19 USD/lot", () => {
  const rate = C.rebateRate(B("Vantage").std);
  near(rate.fx, 6.89); // 13 × 53%
  near(rate.gold, 12.19); // 23 × 53%
  near(cmp("Vantage", "std").rebate, 23956);
  near(cmp("Vantage", "std").total, 7186.8);
  near(cmp("Vantage", "raw").total, 1440); // ECN: 2 USD/lot
});

test("rebate theo lot giữ nguyên; thiếu số liệu → null (hiện “Đang cập nhật”)", () => {
  assert.deepEqual(C.rebateRate({ fx: 10, gold: 20, costFx: 18, costGold: 33 }), { fx: 10, gold: 20 });
  assert.equal(C.rebateRate({ fx: null, gold: null, costFx: 13, costGold: 23 }), null);
  assert.equal(C.compareMonth(D.example, { name: "X", std: { acc: "S", fx: null, gold: null, costFx: 1, costGold: 1 } }, "std", cctx), null);
});

test("xếp hạng Standard: TMGM, XM, HFM, VT Markets, PU Prime, AvaTrade, Exness, Vantage, Axi; EC Markets chưa có rebate xếp cuối", () => {
  const rows = C.compareAll(D.example, D.competitors.brokers, "std", cctx);
  assert.deepEqual(Array.from(rows, (x) => x.broker.name), ["TMGM", "XM", "HFM", "VT Markets", "PU Prime", "AvaTrade", "Exness", "Vantage", "Axi", "EC Markets"]);
  near(rows[3].r.total, 9540); // VT Standard: (1.000 × 8 + 1.400 × 17) × 30% giữ lại
  assert.equal(rows[9].r, null);
});

test("sàn chưa có số liệu xếp cuối", () => {
  const pending = { name: "Pending", std: { acc: "S", fx: null, gold: null, costFx: 1, costGold: 1 } };
  const rows = C.compareAll(D.example, [pending, ...D.competitors.brokers], "std", cctx);
  const tail = rows.filter((x) => !x.r);
  assert.deepEqual(Array.from(tail, (x) => x.broker.name), ["Pending", "EC Markets"]);
  assert.deepEqual(rows.slice(-2), tail);
});

test("xếp hạng Raw/ECN: TMGM, XM, Axi, HFM, Exness, PU Prime, Vantage, VT Markets, AvaTrade, EC Markets", () => {
  const rows = C.compareAll(D.example, D.competitors.brokers, "raw", cctx);
  assert.deepEqual(Array.from(rows, (x) => x.broker.name), ["TMGM", "XM", "Axi", "HFM", "Exness", "PU Prime", "Vantage", "VT Markets", "AvaTrade", "EC Markets"]);
});

// ---------- ưu đãi cho khách: Points + Cashback Q4 ----------
test("Points: 10 điểm/lot, quy đổi theo món 30 USD = 600 điểm → 0,5 USD/lot", () => {
  assert.equal(C.pointsPerLot(D.points), 0.5);
  assert.equal(C.pointsPerLot({ perLot: 10, refUsd: 5, cashback: [{ usd: 5, pts: 130 }] }).toFixed(4), "0.3846");
  assert.equal(C.pointsPerLot({ perLot: 10, refUsd: 99, cashback: [] }), 0); // không có món tham chiếu
});

test("Cashback Q4: mặc định 10k net deposit, 170 lot → bậc 4 = 500 USD + 1.700 điểm (85 USD)", () => {
  const r = C.clientBack(D.clientCashback.defaults, D.points, D.clientCashback.tiers);
  assert.equal(r.tier, 3);
  assert.equal(r.cashback, 500);
  assert.equal(r.pts, 1700);
  assert.equal(r.ptsUsd, 85);
  assert.equal(r.total, 585);
  assert.equal(r.perLot.toFixed(2), "3.44");
  assert.equal(r.next, null);
});

test("Cashback Q4 theo ví dụ trong T&C: cần đạt cả net deposit lẫn lot lũy kế", () => {
  const T = D.clientCashback.tiers, back = (deposit, lots) => C.clientBack({ deposit, lots }, D.points, T);
  assert.equal(back(1000, 20).cashback, 50); // ví dụ 1: bậc 1
  assert.equal(back(3000, 55).cashback, 150); // ví dụ 1: nạp thêm 2.000, thêm 35 lot → bậc 2 (lũy kế 150)
  assert.equal(back(999, 20).cashback, 0); // ví dụ 2: thiếu 1 USD net deposit
  const d = back(3000, 20); // ví dụ D: đủ tiền bậc 2 nhưng lot chỉ đủ bậc 1
  assert.equal(d.cashback, 50);
  assert.deepEqual([d.needDeposit, d.needLots], [0, 35]);
  assert.equal(back(0, 0).perLot, 0);
});

// ---------- so sánh "Đối đầu": TMGM và một sàn tùy chọn, mỗi bên số riêng ----------
const H = { accounts: D.accounts, brokers: D.competitors.brokers, mibTiers: D.mibTiers, ecn: D.ecn };
const vol = { lotsFx: 1000, lotsGold: 1400, deposit: 340000, share: 70 };

test("headToHead: TMGM STD 24.300 vs XM Standard 14.104 → TMGM hơn 10.196 (+72%)", () => {
  const r = C.headToHead({ ...vol, account: "STD", ecn: false }, { ...vol, broker: "XM", cls: "std", fx: "", gold: "", extra: 0 }, H);
  assert.deepEqual([r.us.total, r.them.total, r.diff, r.diffPct], [24300, 14104, 10196, 72]);
  assert.equal(r.acc.name, "STD");
});

test("headToHead: ECN Q4 chỉ cộng khi tài khoản TMGM là Edge và bật ECN", () => {
  const them = { ...vol, broker: "VT Markets", cls: "raw", fx: "", gold: "", extra: 0 };
  assert.equal(C.headToHead({ ...vol, account: "Edge", ecn: true }, them, H).us.total, 18880);
  assert.equal(C.headToHead({ ...vol, account: "Edge", ecn: false }, them, H).us.total, 14340);
  assert.equal(C.headToHead({ ...vol, account: "STD", ecn: true }, them, H).us.ecn, 0);
  assert.equal(C.headToHead({ ...vol, account: "Edge", ecn: true }, them, { ...H, ecn: null }).us.ecn, 0); // hết kỳ Q4
});

test("headToHead: sàn chưa có rebate (EC Markets) thì bên kia null; nhập rebate tay và thưởng thêm thì tính được", () => {
  const us = { ...vol, account: "STD", ecn: false };
  const none = C.headToHead(us, { ...vol, broker: "EC Markets", cls: "std", fx: "", gold: "", extra: 0 }, H);
  assert.equal(none.them, null);
  assert.deepEqual([none.diff, none.diffPct], [null, null]);
  const r = C.headToHead(us, { ...vol, broker: "EC Markets", cls: "std", fx: 10, gold: 20, extra: 1000 }, H);
  assert.deepEqual([r.them.keep, r.them.promo, r.them.total], [11400, 1000, 12400]);
  assert.equal(r.diff, 11900);
  const own = C.headToHead(us, { ...vol, lotsFx: 2000, broker: "VT Markets", cls: "std", fx: 8, gold: 17, extra: 0 }, H);
  assert.equal(own.them.rebate, 2000 * 8 + 1400 * 17); // số riêng của bên kia, không dùng số TMGM
});

test("headToHead: rebate theo % chi phí khách (Vantage Standard) bị ghi đè khi nhập số", () => {
  const us = { ...vol, account: "STD", ecn: false };
  const base = C.headToHead(us, { ...vol, broker: "Vantage", cls: "std", fx: "", gold: "", extra: 0 }, H).them;
  near(base.rebate, 1000 * 13 * 0.53 + 1400 * 23 * 0.53);
  assert.equal(C.headToHead(us, { ...vol, broker: "Vantage", cls: "std", fx: 1, gold: 1, extra: 0 }, H).them.rebate, 2400);
});

test("donutArcs: bỏ phần 0, cộng lại 100%, vị trí bắt đầu nối tiếp; tổng 0 thì rỗng", () => {
  const arcs = C.donutArcs([{ key: "keep", value: 11400 }, { key: "promo", value: 12900 }, { key: "ecn", value: 0 }]);
  assert.deepEqual(Array.from(arcs, (a) => a.key), ["keep", "promo"]);
  near(arcs[0].pct + arcs[1].pct, 100);
  near(arcs[1].start, arcs[0].pct);
  assert.equal(C.donutArcs([{ key: "keep", value: 0 }]).length, 0);
});
