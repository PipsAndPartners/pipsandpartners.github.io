/* Phép tính thuần cho trang pitch — dùng được cả trong trình duyệt (window.MIBCalc) và node (require). */
(function (root) {
  // Bậc KM MIB cao nhất mà cả net deposit lẫn tổng lot đều đạt; null nếu chưa đạt bậc nào.
  function mibTier(tiers, deposit, lots) {
    let hit = null;
    for (const t of tiers) if (deposit >= t.deposit && lots >= t.lots) hit = t;
    return hit;
  }

  const SWAP_WEEKLY_PCT = 30; // hoàn swap tuần: 30% phí swap của khách trực tiếp, không ngưỡng
  const MAX_TIERS = 12;

  // Hoàn swap (chính sách IB, tính trên khách trực tiếp): hoàn tuần 30% + hoàn tháng theo bậc net deposit.
  // Ngưỡng phải VƯỢT (>) mốc trong tài liệu TMGM. tiers = [{ pct, ib }]; không có bảng bậc thì chỉ còn hoàn tuần.
  function swapRebate(fee, nd, tiers) {
    const f = Number.isFinite(Number(fee)) && Number(fee) > 0 ? Number(fee) : 0;
    const n = Number.isFinite(Number(nd)) ? Number(nd) : 0;
    let pct = 0;
    for (const t of tiers || []) if (n > t.ib) pct = t.pct;
    const weekly = (f * SWAP_WEEKLY_PCT) / 100, monthly = (f * pct) / 100;
    return { weekly, monthly, pct, total: weekly + monthly };
  }

  // Một tháng của MIB: rebate nhánh → chia Sub-IB → MIB giữ lại + thưởng KM = "base".
  // Add-on (mặc định tắt, bật bằng p.addons): ecn = ECN Q4 chỉ với tài khoản Edge, MIB giữ 100% phần cộng thêm, tính trên net deposit
  // toàn nhánh (ước tính trần, TMGM tính theo khách trực tiếp từng IB); swap = hoàn swap theo p.swapFee và p.swapNd (khách trực tiếp).
  function mibMonth(p, accounts, tiers, ecn, swapTiers) {
    const acc = accounts.find((a) => a.name === p.account) || accounts[0];
    const rebate = p.lotsFx * acc.fx + p.lotsGold * acc.gold;
    const toSub = (rebate * p.share) / 100;
    const keep = rebate - toSub;
    const lots = p.lotsFx + p.lotsGold;
    const tier = mibTier(tiers, p.deposit, lots);
    const bonus = tier ? tier.mib : 0;
    const on = p.addons || {};
    const ecnApplies = !!acc.q4;
    const ecnAdd = on.ecn && ecnApplies && ecn ? ecnMonth(p, ecn).add : 0;
    const swap = on.swap ? swapRebate(p.swapFee, p.swapNd, swapTiers) : { weekly: 0, monthly: 0, pct: 0, total: 0 };
    const next = tiers[tier ? tiers.indexOf(tier) + 1 : 0] || null;
    const base = keep + bonus;
    return {
      rebate, toSub, keep, bonus, lots, tier, next, base, ecn: ecnAdd, ecnApplies, swap,
      total: base + ecnAdd + swap.total,
      needLots: next ? Math.max(0, next.lots - lots) : 0,
      needDeposit: next ? Math.max(0, next.deposit - p.deposit) : 0,
      // Net deposit đã trừ rebate, nên nạp − rút thực tế phải cao hơn đúng bằng tổng rebate.
      gross: p.deposit + rebate,
    };
  }

  // Bậc KM do người dùng sửa: ép về số hợp lệ, bỏ dòng hỏng (đếm trong dropped), sắp tăng dần theo net deposit,
  // trùng net deposit thì giữ dòng sau, tối đa MAX_TIERS dòng. key = tên trường thưởng ("mib" hoặc "reward").
  function cleanTiers(rows, key) {
    if (!Array.isArray(rows)) return { rows: [], dropped: 0 };
    const num = (v) => (v === "" || v == null ? NaN : Number(v));
    const byDeposit = new Map();
    let dropped = 0;
    for (const r of rows) {
      const deposit = num(r && r.deposit), lots = num(r && r.lots), reward = num(r && r[key]);
      if (![deposit, lots, reward].every((n) => Number.isFinite(n) && n > 0)) { dropped++; continue; }
      const row = { deposit, lots, [key]: reward };
      const ib = num(r.ibCombined);
      if (Number.isFinite(ib) && ib > 0) row.ibCombined = ib;
      byDeposit.set(deposit, row);
    }
    return { rows: [...byDeposit.values()].sort((a, b) => a.deposit - b.deposit).slice(0, MAX_TIERS), dropped };
  }

  // Cảnh báo (không chặn): bậc cao hơn mà lot hoặc thưởng lại thấp hơn bậc trước.
  function tierWarnings(rows, key) {
    const w = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].lots < rows[i - 1].lots && !w.includes("lots-down")) w.push("lots-down");
      if (rows[i][key] < rows[i - 1][key] && !w.includes("reward-down")) w.push("reward-down");
    }
    return w;
  }

  // Chỉ số bậc ECN Q4 theo net deposit; -1 nếu dưới bậc đầu.
  function ecnTier(tiers, deposit) {
    let idx = -1;
    tiers.forEach((t, i) => { if (deposit >= t.min) idx = i; });
    return idx;
  }

  // Mức rebate Q4 = base × (1 + up%), vd 2 × (1 + 50%) = 3,0
  const ecnRate = (base, up) => (base * (100 + up)) / 100;

  // Rebate ECN Q4 theo điều khoản TMGM (mục 5):
  // cộng thêm = lot FX × base × %FX + lot vàng × base × %vàng; dưới 5.000 USD net deposit thì không có phần cộng thêm.
  function ecnMonth(p, ecn) {
    const i = ecnTier(ecn.tiers, p.deposit), t = ecn.tiers[i];
    const baseFx = p.lotsFx * ecn.base.fx, baseGold = p.lotsGold * ecn.base.gold;
    const addFx = t ? (baseFx * t.fxUp) / 100 : 0, addGold = t ? (baseGold * t.goldUp) / 100 : 0;
    const base = baseFx + baseGold, add = addFx + addGold;
    return {
      tier: i, fxUp: t ? t.fxUp : 0, goldUp: t ? t.goldUp : 0,
      baseFx, baseGold, base, addFx, addGold, add,
      total: base + add,
      uplift: base ? Math.round((add / base) * 100) : 0,
    };
  }

  // Rebate USD/lot của một nhóm tài khoản: theo lot (fx, gold), hoặc theo % chi phí khách (pct, như Vantage).
  // null nếu chưa có số liệu.
  function rebateRate(a) {
    if (a.pct != null) return { fx: (a.costFx * a.pct) / 100, gold: (a.costGold * a.pct) / 100 };
    return a.fx == null || a.gold == null ? null : { fx: a.fx, gold: a.gold };
  }

  // So sánh một tháng của MIB ở một sàn (cls = "std" | "raw"): rebate → chia Sub-IB → giữ lại + KM của sàn (+ ECN Q4 với TMGM Raw).
  // KM: tiers = thưởng theo bậc net deposit + lot ("mib" = bảng KM MIB của TMGM); subPct = % thêm trên hoa hồng Sub-IB;
  // keepPct = % thêm trên rebate MIB giữ lại; perLot = thưởng trọn đời quy đổi USD/lot. null nếu sàn chưa có số liệu rebate.
  function compareMonth(p, b, cls, ctx) {
    const a = b[cls] && rebateRate(b[cls]);
    if (!a) return null;
    const rebate = p.lotsFx * a.fx + p.lotsGold * a.gold;
    const toSub = (rebate * p.share) / 100, keep = rebate - toSub;
    const tiers = b.tiers === "mib" ? ctx.mibTiers.map((t) => ({ ...t, reward: t.mib })) : b.tiers;
    const tier = tiers ? mibTier(tiers, p.deposit, p.lotsFx + p.lotsGold) : null;
    const promo = (tier ? tier.reward : 0) + (b.subPct ? (toSub * b.subPct) / 100 : 0) + (b.keepPct ? (keep * b.keepPct) / 100 : 0)
      + (b.perLot ? p.lotsFx * b.perLot.fx + p.lotsGold * b.perLot.gold : 0);
    const ecn = cls === "raw" && b.ecn && ctx.ecn ? ecnMonth(p, ctx.ecn).add : 0;
    return { rebate, toSub, keep, promo, ecn, total: keep + promo + ecn };
  }

  // Xếp các sàn theo tổng MIB nhận, cao xuống thấp; sàn chưa có số liệu xếp cuối.
  function compareAll(p, brokers, cls, ctx) {
    return brokers.map((broker) => ({ broker, r: compareMonth(p, broker, cls, ctx) }))
      .sort((x, y) => (y.r ? y.r.total : -1) - (x.r ? x.r.total : -1));
  }

  // Đối đầu: TMGM (tài khoản tùy chọn, số riêng) với một sàn khác (số riêng; rebate/lot có thể nhập tay).
  // us = { account, lotsFx, lotsGold, deposit, share, ecn }; them = { broker, cls, fx, gold, lotsFx, lotsGold, deposit, share, extra }.
  // fx/gold của "them" để trống ("" hoặc null) = lấy theo số liệu khảo sát; khảo sát cũng không có thì them = null.
  // ctx = { accounts, brokers, mibTiers, ecn }. ECN Q4 chỉ cộng khi tài khoản TMGM là Edge (q4) và us.ecn bật.
  function headToHead(us, them, ctx) {
    const acc = ctx.accounts.find((a) => a.name === us.account) || ctx.accounts[0];
    const tm = { name: "TMGM", tiers: "mib", ecn: !!acc.q4, raw: { acc: acc.name, fx: acc.fx, gold: acc.gold, costFx: acc.costFx, costGold: acc.costGold } };
    const rUs = compareMonth(us, tm, "raw", { mibTiers: ctx.mibTiers, ecn: us.ecn && acc.q4 ? ctx.ecn : null });
    const b = ctx.brokers.find((x) => x.name === them.broker), base = b && b[them.cls];
    const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v)));
    const fx = num(them.fx), gold = num(them.gold);
    let rThem = null;
    if (base) {
      const a = fx != null && gold != null ? { ...base, fx, gold, pct: null } : base;
      rThem = compareMonth(them, { ...b, [them.cls]: a }, them.cls, { mibTiers: ctx.mibTiers, ecn: null });
      if (rThem) {
        const extra = num(them.extra) || 0;
        rThem = { ...rThem, promo: rThem.promo + extra, total: rThem.total + extra };
      }
    }
    const diff = rThem ? rUs.total - rThem.total : null;
    return { acc, us: rUs, them: rThem, diff, diffPct: rThem && rThem.total > 0 ? Math.round((diff / rThem.total) * 100) : null };
  }

  // Các cung của biểu đồ tròn (donut) từ [{ key, value }]: bỏ phần ≤ 0; pct cộng lại = 100; start = vị trí bắt đầu (%).
  function donutArcs(parts) {
    const ok = parts.filter((p) => p.value > 0), total = ok.reduce((s, p) => s + p.value, 0);
    let at = 0;
    return total ? ok.map((p) => { const pct = (p.value / total) * 100, arc = { ...p, pct, start: at }; at += pct; return arc; }) : [];
  }

  // TMGM Points quy ra USD/lot theo món cashback tham chiếu: điểm/lot × USD / điểm, vd 10 × 30 / 600 = 0,5.
  function pointsPerLot(pts) {
    const ref = pts.cashback.find((c) => c.usd === pts.refUsd);
    return ref ? (pts.perLot * ref.usd) / ref.pts : 0;
  }

  // Khách nhận lại trong kỳ: Cashback Q4 (bậc lũy kế cao nhất đạt cả net deposit lẫn lot) + Points quy USD.
  // p = { deposit, lots }; tiers = [{ deposit, lots, total }] với total = cashback lũy kế.
  function clientBack(p, points, tiers) {
    const tier = mibTier(tiers, p.deposit, p.lots), i = tier ? tiers.indexOf(tier) : -1, next = tiers[i + 1] || null;
    const cashback = tier ? tier.total : 0, pts = p.lots * points.perLot, ptsUsd = p.lots * pointsPerLot(points);
    const total = cashback + ptsUsd;
    return {
      tier: i, cashback, pts, ptsUsd, total, next,
      perLot: p.lots ? total / p.lots : 0,
      needDeposit: next ? Math.max(0, next.deposit - p.deposit) : 0,
      needLots: next ? Math.max(0, next.lots - p.lots) : 0,
    };
  }

  const api = { mibTier, mibMonth, swapRebate, cleanTiers, tierWarnings, ecnTier, ecnRate, ecnMonth, rebateRate, compareMonth, compareAll, headToHead, donutArcs, pointsPerLot, clientBack };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MIBCalc = api;
})(this);
