// Add-on (ECN Q4, hoàn swap), bậc KM tùy chỉnh và chi phí khách. Bổ sung cho calc.test.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadContent } = require("./helpers.js");
const C = require("../calc.js");

const D = loadContent();
const B = (name) => D.competitors.brokers.find((b) => b.name === name);
const cctx = { mibTiers: D.mibTiers, ecn: D.ecn };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);
const edgePlain = { ...D.example, account: "Edge" }; // add-on tắt (mặc định)
const edge = { ...edgePlain, addons: { ecn: true } };

// ---------- Add-on: mặc định tắt, bật từng khoản ----------
test("add-on tắt mặc định: Edge chỉ có rebate giữ lại + thưởng KM, không ECN, không swap", () => {
  const r = C.mibMonth(edgePlain, D.accounts, D.mibTiers, D.ecn, D.swapTiers);
  assert.equal(r.ecn, 0);
  assert.equal(r.swap.total, 0);
  assert.equal(r.base, 1440 + 12900);
  assert.equal(r.total, r.base);
});

test("ECN chỉ áp dụng cho Edge: bật add-on với Prime vẫn bằng 0 và báo ecnApplies = false", () => {
  const r = C.mibMonth({ ...D.example, addons: { ecn: true } }, D.accounts, D.mibTiers, D.ecn);
  assert.equal(r.ecn, 0);
  assert.equal(r.ecnApplies, false);
  assert.equal(r.total, 19200);
  assert.equal(C.mibMonth(edge, D.accounts, D.mibTiers, D.ecn).ecnApplies, true);
});

test("ECN hết kỳ (bảng ECN = null): add-on không cộng gì", () => {
  assert.equal(C.mibMonth(edge, D.accounts, D.mibTiers, null).ecn, 0);
});

// ---------- Hoàn swap (chính sách IB: tính trên khách trực tiếp, ngưỡng ">" nghiêm ngặt) ----------
test("swapRebate: hoàn tuần 30% + hoàn tháng theo bậc net deposit", () => {
  const r = C.swapRebate(2000, 40000, D.swapTiers);
  assert.equal(r.weekly, 600);
  assert.equal(r.pct, 50);
  assert.equal(r.monthly, 1000);
  assert.equal(r.total, 1600);
});

test("swapRebate: ngưỡng phải VƯỢT (>) 5.000 / 10.000 / 30.000 USD", () => {
  const pct = (nd) => C.swapRebate(1000, nd, D.swapTiers).pct;
  assert.equal(pct(5000), 0);
  assert.equal(pct(5001), 30);
  assert.equal(pct(10000), 30);
  assert.equal(pct(10001), 40);
  assert.equal(pct(30000), 40);
  assert.equal(pct(30001), 50);
});

test("swapRebate: dưới ngưỡng đầu chỉ còn hoàn tuần; phí swap 0, âm hoặc rác thì bằng 0", () => {
  const r = C.swapRebate(1000, 4000, D.swapTiers);
  assert.equal(r.monthly, 0);
  assert.equal(r.total, 300);
  assert.equal(C.swapRebate(0, 40000, D.swapTiers).total, 0);
  assert.equal(C.swapRebate(-500, 40000, D.swapTiers).total, 0);
  assert.equal(C.swapRebate(NaN, 40000, D.swapTiers).total, 0);
  assert.equal(C.swapRebate(1000, NaN, D.swapTiers).monthly, 0);
  assert.equal(C.swapRebate(1000, 40000, undefined).monthly, 0); // không có bảng bậc: chỉ hoàn tuần
});

test("mibMonth bật add-on swap: cộng hoàn tuần + hoàn tháng vào tổng", () => {
  const p = { ...D.example, addons: { swap: true }, swapFee: 2000, swapNd: 40000 };
  const r = C.mibMonth(p, D.accounts, D.mibTiers, D.ecn, D.swapTiers);
  assert.equal(r.swap.weekly, 600);
  assert.equal(r.swap.monthly, 1000);
  assert.equal(r.total, 19200 + 1600);
  assert.equal(r.base, 19200);
});

test("mibMonth: swap tắt thì phí swap nhập vào không ảnh hưởng", () => {
  const p = { ...D.example, swapFee: 9999, swapNd: 99999 };
  assert.equal(C.mibMonth(p, D.accounts, D.mibTiers, D.ecn, D.swapTiers).total, 19200);
});

test("mibMonth bật cả ECN và swap trên Edge: tổng = giữ lại + thưởng + ECN + swap", () => {
  const p = { ...edgePlain, addons: { ecn: true, swap: true }, swapFee: 2000, swapNd: 40000 };
  const r = C.mibMonth(p, D.accounts, D.mibTiers, D.ecn, D.swapTiers);
  assert.equal(r.total, 1440 + 12900 + 4540 + 1600);
  assert.equal(r.base, 1440 + 12900);
});

// ---------- ECN: số mặc định của máy tính (khác ví dụ chính thức của TMGM) ----------
test("ECN máy tính mặc định: 150K, 1.000 lot FX, 1.000 lot vàng → 4.000 + 2.900 = 6.900 (+73%)", () => {
  const r = C.ecnMonth(D.ecn.defaults, D.ecn);
  assert.equal(r.base, 4000);
  assert.equal(r.add, 2900); // 2.000 × 100% + 2.000 × 45%
  assert.equal(r.total, 6900);
  assert.equal(r.uplift, 73);
});

test("ECN ví dụ chính thức của TMGM vẫn là 1.000 lot FX + 800 lot vàng = 6.320", () => {
  assert.deepEqual({ ...D.ecn.example }, { deposit: 150000, lotsFx: 1000, lotsGold: 800 });
  assert.equal(C.ecnMonth(D.ecn.example, D.ecn).total, 6320);
});

// ---------- Bậc KM tùy chỉnh ----------
test("cleanTiers: đổi chuỗi số thành số, sắp theo net deposit tăng dần", () => {
  const { rows, dropped } = C.cleanTiers([{ deposit: "100000", lots: "750", mib: "3000" }, { deposit: 50000, lots: 375, mib: 1300 }], "mib");
  assert.equal(dropped, 0);
  assert.deepEqual(Array.from(rows, (r) => [r.deposit, r.lots, r.mib]), [[50000, 375, 1300], [100000, 750, 3000]]);
});

test("cleanTiers: bỏ dòng thiếu, bằng 0, âm hoặc không phải số và báo số dòng bị bỏ", () => {
  const { rows, dropped } = C.cleanTiers([
    { deposit: 0, lots: 10, reward: 5 }, { deposit: 100, lots: -1, reward: 5 }, { deposit: 100, lots: 10, reward: "x" },
    { deposit: "", lots: 10, reward: 5 }, { lots: 10, reward: 5 }, { deposit: 200, lots: 20, reward: 9 },
  ], "reward");
  assert.equal(rows.length, 1);
  assert.equal(dropped, 5);
  assert.equal(rows[0].deposit, 200);
});

test("cleanTiers: trùng net deposit thì giữ dòng sau; tối đa 12 dòng", () => {
  const dup = C.cleanTiers([{ deposit: 1000, lots: 1, mib: 1 }, { deposit: 1000, lots: 2, mib: 2 }], "mib").rows;
  assert.equal(dup.length, 1);
  assert.equal(dup[0].mib, 2);
  const many = Array.from({ length: 15 }, (_, i) => ({ deposit: (i + 1) * 1000, lots: i + 1, mib: i + 1 }));
  assert.equal(C.cleanTiers(many, "mib").rows.length, 12);
});

test("cleanTiers: giữ ibCombined nếu là số, bỏ nếu không hợp lệ; đầu vào không phải mảng thì rỗng", () => {
  const rows = C.cleanTiers([{ deposit: 1, lots: 1, mib: 1, ibCombined: "x" }, { deposit: 2, lots: 2, mib: 2, ibCombined: 5 }], "mib").rows;
  assert.equal("ibCombined" in rows[0], false);
  assert.equal(rows[1].ibCombined, 5);
  assert.deepEqual({ ...C.cleanTiers("lỗi", "mib") }, { rows: [], dropped: 0 });
});

test("cleanTiers không sửa mảng đầu vào", () => {
  const input = [{ deposit: "2", lots: "2", mib: "2" }, { deposit: "1", lots: "1", mib: "1" }];
  const before = JSON.stringify(input);
  C.cleanTiers(input, "mib");
  assert.equal(JSON.stringify(input), before);
});

test("tierWarnings: bậc cao hơn mà lot hoặc thưởng thấp hơn thì cảnh báo", () => {
  assert.deepEqual(Array.from(C.tierWarnings(D.mibTiers, "mib")), []);
  assert.deepEqual(Array.from(C.tierWarnings([{ deposit: 1, lots: 10, mib: 5 }, { deposit: 2, lots: 5, mib: 9 }], "mib")), ["lots-down"]);
  assert.deepEqual(Array.from(C.tierWarnings([{ deposit: 1, lots: 10, mib: 5 }, { deposit: 2, lots: 20, mib: 1 }], "mib")), ["reward-down"]);
  assert.deepEqual(Array.from(C.tierWarnings([{ deposit: 1, lots: 10, mib: 5 }, { deposit: 2, lots: 5, mib: 1 }], "mib")), ["lots-down", "reward-down"]);
});

test("bậc IB: cần đạt cả net deposit lẫn lot (7 bậc, 260 → 15.000 USD)", () => {
  const t = (d, l) => C.mibTier(D.ibTiers, d, l)?.reward ?? null;
  assert.equal(t(17000, 85), 260);
  assert.equal(t(16999, 85), null);
  assert.equal(t(17000, 84), null);
  assert.equal(t(340000, 1600), 8500);
  assert.equal(t(340000, 1599), 3800); // lot thiếu: rớt xuống bậc 170K/800
  assert.equal(t(500000, 2200), 15000);
  assert.equal(t(9e6, 9999), 15000);
});

test("mibMonth dùng bậc tùy chỉnh do người dùng nhập", () => {
  const custom = [{ deposit: 1000, lots: 10, mib: 777 }];
  const r = C.mibMonth({ ...D.example, deposit: 2000, lotsFx: 10, lotsGold: 0 }, D.accounts, custom);
  assert.equal(r.bonus, 777);
  assert.equal(r.next, null);
  assert.equal(C.mibMonth({ ...D.example, deposit: 999 }, D.accounts, custom).bonus, 0);
});

test("so sánh dùng bậc KM MIB tùy chỉnh và add-on ECN theo ctx", () => {
  const custom = [{ deposit: 1000, lots: 1, mib: 777 }];
  near(C.compareMonth(D.example, B("TMGM"), "std", { mibTiers: custom, ecn: null }).promo, 777);
  near(C.compareMonth(D.example, B("TMGM"), "raw", { ...cctx, ecn: null }).total, 1440 + 12900); // ECN tắt
  near(C.compareMonth(D.example, B("TMGM"), "raw", cctx).ecn, 4540); // ECN bật
});

test("xếp hạng Raw/ECN khi tắt ECN: TMGM vẫn đứng đầu nhờ KM MIB", () => {
  const rows = C.compareAll(D.example, D.competitors.brokers, "raw", { ...cctx, ecn: null });
  assert.equal(rows[0].broker.name, "TMGM");
  near(rows[0].r.total, 14340);
});

// ---------- Chi phí khách: cùng một nguồn (file khảo sát) ở slide Tài khoản và slide So sánh ----------
test("chi phí khách Edge / Classic / STD theo file khảo sát", () => {
  const a = (n) => D.accounts.find((x) => x.name === n);
  assert.deepEqual([a("Edge").costFx, a("Edge").costGold], [7, 15]);
  assert.deepEqual([a("Classic").costFx, a("Classic").costGold], [9, 17]);
  assert.deepEqual([a("STD").costFx, a("STD").costGold], [18, 33]);
});

test("slide Tài khoản và slide So sánh dùng cùng số cho TMGM Edge và STD", () => {
  const a = (n) => D.accounts.find((x) => x.name === n);
  assert.deepEqual([a("Edge").costFx, a("Edge").costGold], [B("TMGM").raw.costFx, B("TMGM").raw.costGold]);
  assert.deepEqual([a("STD").costFx, a("STD").costGold], [B("TMGM").std.costFx, B("TMGM").std.costGold]);
  assert.deepEqual([a("Edge").fx, a("Edge").gold], [B("TMGM").raw.fx, B("TMGM").raw.gold]);
  assert.deepEqual([a("STD").fx, a("STD").gold], [B("TMGM").std.fx, B("TMGM").std.gold]);
});
