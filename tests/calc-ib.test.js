// Máy tính cho IB mới (calc.ibMonth) và add-on ưu đãi khác (calc.promoAddon). Dùng bảng bậc giả để file này công khai được;
// bài đối chiếu với số KM thật nằm ở private/tests/m5-ib.test.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../calc.js");

const ACCOUNTS = [{ name: "STD", fx: 10, gold: 20 }, { name: "Edge", fx: 2, gold: 2, q4: true }];
const TIERS = [{ deposit: 12000, lots: 60, reward: 100 }, { deposit: 52000, lots: 260, reward: 900 }, { deposit: 105000, lots: 510, reward: 2000 }];
const ECN = { base: { fx: 2, gold: 2 }, tiers: [{ min: 5000, max: 49999, fxUp: 50, goldUp: 25 }, { min: 50000, max: 99999, fxUp: 80, goldUp: 35 }] };
const SWAP = [{ pct: 30, ib: 5000 }, { pct: 40, ib: 10000 }, { pct: 50, ib: 30000 }];
const P = { account: "STD", lotsFx: 200, lotsGold: 80, deposit: 52000, clients: 10, active: 6 };
const month = (over = {}, ecn = ECN) => C.ibMonth({ ...P, ...over }, ACCOUNTS, TIERS, ecn, SWAP);

test("IB mới: rebate khách trực tiếp (IB giữ 100%) + thưởng bậc đạt cả net deposit lẫn lot", () => {
  const r = month();
  assert.equal(r.rebate, 3600); // 200 × 10 + 80 × 20
  assert.equal(r.lots, 280);
  assert.equal(r.eligible, true);
  assert.equal(r.tier.reward, 900);
  assert.equal(r.bonus, 900);
  assert.equal(r.total, 4500);
  assert.equal(r.base, 4500);
  assert.equal(r.next.reward, 2000);
  assert.equal(r.needLots, 230);
  assert.equal(r.needDeposit, 53000);
  assert.equal(r.gross, 55600);
});

test("IB mới: thiếu lot hoặc thiếu net deposit thì rớt xuống bậc dưới; chưa đạt bậc nào thì bậc kế là bậc đầu", () => {
  assert.equal(month({ lotsFx: 100, lotsGold: 50 }).tier.reward, 100); // 150 lot < 260
  assert.equal(month({ deposit: 51999 }).tier.reward, 100);
  const none = month({ deposit: 5000 });
  assert.equal(none.tier, null);
  assert.equal(none.bonus, 0);
  assert.equal(none.next.reward, 100);
  assert.equal(none.total, none.rebate);
});

test("IB mới: cần ≥ 5 khách kích hoạt và ≥ 3 khách hoạt động mới nhận thưởng tháng; báo thiếu bao nhiêu", () => {
  assert.equal(C.IB_MIN_CLIENTS, 5);
  assert.equal(C.IB_MIN_ACTIVE, 3);
  const a = month({ clients: 4 });
  assert.deepEqual([a.eligible, a.bonus, a.needClients, a.needActive], [false, 0, 1, 0]);
  assert.equal(a.tier.reward, 900, "vẫn biết bậc đạt được nếu đủ khách");
  const b = month({ clients: 5, active: 2 });
  assert.deepEqual([b.eligible, b.bonus, b.needClients, b.needActive], [false, 0, 0, 1]);
  const c = month({ clients: 5, active: 3 });
  assert.deepEqual([c.eligible, c.bonus], [true, 900]);
  assert.equal(c.total, 4500);
});

test("IB mới: vé IB thay cho thưởng tháng (chọn một) — không cộng cả hai", () => {
  const r = month({ ticket: 450 });
  assert.deepEqual([r.bonus, r.ticket, r.total], [0, 450, 4050]);
  assert.equal(month({ ticket: 0 }).bonus, 900);
  assert.equal(month({ ticket: NaN }).bonus, 900);
  assert.equal(month({ ticket: -5 }).bonus, 900);
});

test("IB mới: ECN Q4 chỉ với Edge và chỉ khi bật add-on; hoàn swap theo phí swap và net deposit khách trực tiếp", () => {
  assert.equal(month({ addons: { ecn: true } }).ecn, 0, "STD không có ECN");
  assert.equal(month({ addons: { ecn: true } }).ecnApplies, false);
  const e = month({ account: "Edge", addons: { ecn: true } });
  assert.equal(e.ecnApplies, true);
  assert.equal(e.ecn, 376); // 200×2×80% + 80×2×35%
  assert.equal(month({ account: "Edge" }).ecn, 0, "add-on tắt");
  assert.equal(month({ addons: { ecn: true }, account: "Edge" }, null).ecn, 0, "hết kỳ Q4 (không có bảng ECN)");
  const s = month({ addons: { swap: true }, swapFee: 2000, swapNd: 40000 });
  assert.deepEqual([s.swap.weekly, s.swap.monthly, s.swap.pct, s.swap.total], [600, 1000, 50, 1600]);
  assert.equal(s.total, 4500 + 1600);
  assert.equal(month({ swapFee: 2000, swapNd: 40000 }).swap.total, 0, "add-on tắt");
});

test("IB mới không sửa dữ liệu đầu vào", () => {
  const p = { ...P, addons: { ecn: true } }, before = JSON.stringify([p, ACCOUNTS, TIERS]);
  C.ibMonth(p, ACCOUNTS, TIERS, ECN, SWAP);
  assert.equal(JSON.stringify([p, ACCOUNTS, TIERS]), before);
});

// ---------- add-on ưu đãi khác ----------
const HALLOWEEN = { type: "credit", kind: "client", pct: 30, cap: 200, minFtd: 50 };
const CREDIT50 = { type: "credit", kind: "client", pct: 50, cap: 10000, minFtd: 500 };
const ROWS = [[10000, 150, "Quà A", 401.1], [20000, 250, "Quà B", 825.3]];
const POINTS = { perLot: 10, refUsd: 30, cashback: [{ usd: 5, pts: 130 }, { usd: 30, pts: 600 }] };
const TICKETS = { type: "tickets", kind: "ib", minActive: 5, tiers: [{ deposit: 33000, lots: 85, value: 400 }, { deposit: 66000, lots: 105, value: 500 }] };

test("credit: % khoản nạp đầu, có trần và mức nạp tối thiểu; credit là margin nên ghi riêng (cur = credit)", () => {
  assert.deepEqual({ ...C.promoAddon(HALLOWEEN, { n: 10, ftd: 500 }) }, { kind: "client", cur: "credit", per: 150, total: 1500, ok: true });
  assert.equal(C.promoAddon(HALLOWEEN, { n: 10, ftd: 1000 }).per, 200, "trần 200");
  const low = C.promoAddon(HALLOWEEN, { n: 10, ftd: 49 });
  assert.deepEqual([low.ok, low.per, low.total], [false, 0, 0]);
  assert.equal(C.promoAddon(CREDIT50, { n: 4, ftd: 1000 }).per, 500);
  assert.equal(C.promoAddon(CREDIT50, { n: 1, ftd: 30000 }).per, 10000, "trần 10.000");
  assert.equal(C.promoAddon(CREDIT50, { n: 1, ftd: 499 }).ok, false);
});

test("cashback và tiền cố định: cur = cash", () => {
  const getaway = { type: "cashback", kind: "client", pct: 100, cap: 10, minFtd: 1 };
  assert.deepEqual([C.promoAddon(getaway, { n: 3, ftd: 5 }).per, C.promoAddon(getaway, { n: 3, ftd: 100 }).per, C.promoAddon(getaway, { n: 3, ftd: 100 }).cur], [5, 10, "cash"]);
  const rocket = { type: "cash", kind: "client", usd: 20, minFtd: 50 };
  assert.deepEqual([C.promoAddon(rocket, { n: 5, ftd: 50 }).total, C.promoAddon(rocket, { n: 5, ftd: 49 }).total], [100, 0]);
});

test("bảng bậc (Gadget): theo net deposit và lot MỖI KHÁCH, cần đạt cả hai; ra quà và 70% tiền", () => {
  const calc = { type: "table", kind: "client", rows: ROWS };
  const a = C.promoAddon(calc, { n: 2, deposit: 15000, lots: 200 });
  assert.deepEqual([a.per, a.total, a.item, a.ok], [401.1, 802.2, "Quà A", true]);
  assert.equal(C.promoAddon(calc, { n: 2, deposit: 25000, lots: 300 }).item, "Quà B");
  assert.equal(C.promoAddon(calc, { n: 2, deposit: 25000, lots: 100 }).ok, false, "đủ nạp nhưng thiếu lot");
  assert.equal(C.promoAddon(calc, { n: 2, deposit: 5000, lots: 500 }).per, 0);
});

test("points quy USD theo bảng đổi cashback (600 điểm = 30 USD): 320 điểm ≈ 16 USD; bốc thăm và quà không quy tiền", () => {
  const p = C.promoAddon({ type: "points", kind: "client", pts: 320 }, { n: 10, points: POINTS });
  assert.deepEqual([p.cur, p.pts, p.per, p.total], ["points", 320, 16, 160]);
  const noTable = C.promoAddon({ type: "points", pts: 320 }, { n: 10 });
  assert.equal(noTable.total, 0);
  const d = C.promoAddon({ type: "draw", kind: "client", perN: 20 }, { n: 50 });
  assert.deepEqual([d.cur, d.total, d.prizes], ["draw", 0, 2.5]);
  assert.deepEqual([C.promoAddon({ type: "gift", kind: "client" }, { n: 9 }).cur, C.promoAddon({ type: "gift" }, { n: 9 }).total], ["gift", 0]);
});

test("vé IB: bậc theo net deposit và lot của khách trực tiếp, cần đủ khách hoạt động; kind = ib", () => {
  const r = (over) => C.promoAddon(TICKETS, { ibDeposit: 45000, ibLots: 90, active: 5, ...over });
  assert.deepEqual([r().kind, r().cur, r().value, r().ok], ["ib", "ticket", 400, true]);
  assert.equal(r({ ibDeposit: 70000, ibLots: 120 }).value, 500);
  assert.deepEqual([r({ active: 4 }).ok, r({ active: 4 }).value], [false, 0]);
  assert.deepEqual([r({ ibLots: 70 }).ok, r({ ibDeposit: 20000 }).value], [false, 0]);
});

test("promoAddon: số khách âm, NaN hay thập phân được làm tròn xuống ≥ 0; loại lạ thì ok = false", () => {
  for (const n of [-3, NaN, undefined]) assert.equal(C.promoAddon(HALLOWEEN, { n, ftd: 500 }).total, 0, String(n));
  assert.equal(C.promoAddon(HALLOWEEN, { n: 3.9, ftd: 500 }).total, 450);
  assert.equal(C.promoAddon({ type: "khong-co" }, { n: 3 }).ok, false);
});
