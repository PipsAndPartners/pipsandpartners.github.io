/*
 * Trang pitch MIB/IB cùng TMGM: render toàn bộ từ window.MIB (content.js).
 * - Ngôn ngữ EN (mặc định) / VI / 中文: nút trên header, phím L, hoặc ?lang=vi|zh
 * - Đối tượng MIB/IB: trong danh sách slide (nút menu) hoặc ?a=ib
 * - Trình bày: nút "Present", phím P, hoặc ?present
 * Logic tính toán nằm ở calc.js, dates.js, contact.js (có test trong tests/).
 */
(function () {
  const D = window.MIB, C = window.MIBCalc, Dt = window.MIBDates, K = window.MIBContact, S = D.sections, P = D.presenter;
  const ORDER = ["bia", "phap-ly", "nam-dong", "tai-khoan", "ecn-q4", "ecn-calc", "lich-tien", "m1", "m2", "m3", "m4", "m5", "so-sanh", "ib", "uu-dai", "km-khac", "bat-dau", "faq"];
  const RISK = new Set(["nam-dong", "tai-khoan", "ecn-q4", "ecn-calc", "m2", "m4", "m5", "so-sanh", "uu-dai", "km-khac", "bat-dau"]); // I1 tự đặt dòng rủi ro
  const LANGS = [["en", "EN"], ["vi", "VI"], ["zh", "中文"]];
  const LOCALE = { en: "en-US", vi: "vi-VN", zh: "zh-TW" };
  const app = document.getElementById("app");
  const $ = (sel) => document.querySelector(sel);

  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* trình duyệt chặn storage: bỏ qua */ } },
  };
  const qs = new URLSearchParams(location.search);
  const pick = (v, ok, dflt) => (ok.includes(v) ? v : dflt);

  // "Hôm nay": meta.today (YYYY-MM-DD) cho phép cố định ngày khi test; để trống thì dùng giờ máy.
  const now = () => (D.meta.today ? new Date(`${D.meta.today}T12:00:00`) : new Date());
  const pad2 = (n) => String(n).padStart(2, "0");
  const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const daysLeft = () => Math.ceil((new Date(`${D.meta.ecnQ4End}T23:59:59`) - now()) / 864e5);
  const ecnActive = () => daysLeft() > 0;

  // Bậc KM do người dùng sửa được nhớ trong trình duyệt; dữ liệu hỏng hoặc rỗng thì dùng mặc định.
  const defaultTiers = () => ({ mib: C.cleanTiers(D.mibTiers, "mib").rows, ib: C.cleanTiers(D.ibTiers, "reward").rows });
  const TIER_KEY = { mib: "mib", ib: "reward" };
  function loadTiers() {
    const def = defaultTiers();
    try {
      const j = JSON.parse(store.get("mib-tiers") || "null");
      if (j && typeof j === "object") {
        const m = C.cleanTiers(j.mib, "mib").rows, i = C.cleanTiers(j.ib, "reward").rows;
        return { mib: m.length ? m : def.mib, ib: i.length ? i : def.ib };
      }
    } catch (e) { /* JSON hỏng: dùng mặc định */ }
    return def;
  }

  // Cách so sánh "Đối đầu": mỗi bên có số riêng (mặc định lấy từ ví dụ chung); rebate sàn khác lấy theo khảo sát, sửa được.
  const h2hVol = () => ({ lotsFx: D.example.lotsFx, lotsGold: D.example.lotsGold, deposit: D.example.deposit, share: D.example.share });
  const H2H_OTHER = "__other"; // "Sàn khác": người xem tự nhập tên, rebate và chi phí khách
  const h2hRates = (name, cls) => {
    const b = D.competitors.brokers.find((x) => x.name === name), r = b && b[cls] && C.rebateRate(b[cls]);
    return { fx: r ? +r.fx.toFixed(2) : "", gold: r ? +r.gold.toFixed(2) : "" };
  };
  const h2hInit = () => ({ us: { account: "STD", ecn: false, ...h2hVol() }, them: { broker: "XM", cls: "std", extra: 0, name: "", costFx: "", costGold: "", ...h2hVol(), ...h2hRates("XM", "std") } });

  const state = {
    lang: pick(qs.get("lang") || store.get("mib-lang"), LANGS.map((l) => l[0]), "en"),
    aud: pick(qs.get("a") || store.get("mib-aud"), ["mib", "ib"], "mib"),
    present: qs.has("present"),
    idx: 0, step: 0, notes: false, started: 0, cur: null, menu: false,
    calc: { ...D.example }, ecn: { ...D.ecn.defaults }, metal: "fx", cmp: "std",
    promo: "mib", cmpView: "h2h", h2h: h2hInit(), tierEdit: false, tiers: loadTiers(),
    addons: { ecn: false, swap: false }, swap: { fee: 2000, nd: 40000 }, client: { ...D.clientCashback.defaults }, extra: { filter: "all", showPrivate: false },
    pay: { trade: isoOf(now()), apply: null, on: {}, calMonth: null },
    contact: { name: "", phone: "", email: "", note: "", status: "", errors: {} },
    // Slide So sánh khóa tới khi bấm một link đăng ký; đã bấm thì nhớ trong trình duyệt. ?lock khóa lại cho lần mở này (để demo).
    reg: !qs.has("lock") && store.get("mib-reg") === "1", regMenu: false,
    banner: true, first: true,
  };

  // ---------- helpers ----------
  const L = (x) => {
    if (x == null) return "";
    if (typeof x !== "object" || Array.isArray(x)) return x;
    if ("mib" in x || "ib" in x) return L(x[state.aud] ?? x.mib);
    return x[state.lang] ?? x.en;
  };
  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => (o[k] ?? ""));
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const loc = () => LOCALE[state.lang];
  const num = (n, d = 0) => new Intl.NumberFormat(loc(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  const usd = (n, d = 0) => ({ vi: `${num(n, d)} USD`, zh: `${num(n, d)} 美元` })[state.lang] || `USD ${num(n, d)}`;
  const kf = (n) => num(n / 1000) + "k";
  const lot = (n) => new Intl.NumberFormat(loc(), { maximumFractionDigits: 2 }).format(n);
  const dfmt = (iso) => new Intl.DateTimeFormat(loc(), { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const ic = (name, cls = "") => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  // Ảnh thật đặt trong img/; thiếu file thì imgFail() thay bằng khung placeholder ghi tên file cần thêm.
  const img = (file, alt, cls = "", icon = "image", pos = "") =>
    `<img src="img/${file}" alt="${esc(alt)}" class="${cls}" data-f="${file}" data-ic="${icon}"${pos ? ` style="object-position:${pos}"` : ""} onerror="imgFail(this)">`;
  const logo = (file = "logo-tmgm-white.webp", cls = "") =>
    `<img src="img/${file}" alt="TMGM" class="logo ${cls}" data-wm="1" onerror="imgFail(this)">`;

  window.imgFail = (el) => {
    if (el.classList.contains("award")) return el.remove(); // huy hiệu chỉ hiện khi đã có award.webp
    if (el.classList.contains("avatar")) { // chưa có ảnh chân dung: hiện chữ cái đầu của tên
      const m = document.createElement("div");
      m.className = "ph " + el.className;
      m.setAttribute("role", "img");
      m.setAttribute("aria-label", el.alt);
      m.textContent = el.alt.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      return el.replaceWith(m);
    }
    const d = document.createElement(el.dataset.wm ? "span" : "div");
    d.className = (el.dataset.wm ? "wordmark " : "ph ") + el.className;
    if (el.dataset.wm) d.innerHTML = "TMGM<i></i>";
    else {
      d.setAttribute("role", "img");
      d.setAttribute("aria-label", el.alt);
      d.innerHTML = ic(el.dataset.ic || "image") + "<span></span><code></code>";
      d.querySelector("span").textContent = el.alt;
      d.querySelector("code").textContent = "img/" + el.dataset.f;
    }
    el.replaceWith(d);
  };

  const visible = () => ORDER.filter((id) => !S[id].hidden && (state.aud === "mib" || S[id].part !== "mib"));
  const mainCount = () => visible().filter((id) => id !== "faq").length;
  const numOf = (id) => (id === "faq" ? "Q&A" : String(visible().indexOf(id) + 1).padStart(2, "0"));
  const menuLabel = (id) => (id === "bia" ? L(D.ui.menu) : id === "faq" ? L(S.faq.label) : `${numOf(id)} · ${L(S[id].label)}`);

  const head = (id, title) =>
    `<header class="sec-head"><p class="eyebrow">${id === "faq" ? L(S.faq.label) : `${numOf(id)} · ${L(S[id].label)}`}</p><h2 id="h-${id}" class="statement">${(title ?? L(S[id].title)).replace(/Sub-IB/g, '<span class="nw">Sub-IB</span>')}</h2></header>`;
  // Nút gập: ẩn đoạn chữ phụ, bấm mới mở (in PDF thì tự mở hết)
  const foldSum = (label, icon) => `<summary class="fold-sum"><span class="fold-ic">${ic(icon)}</span><span>${L(label)}</span>${ic("chevron", "fold-chev")}</summary>`;
  const fold = (label, inner, icon = "file") => `<details class="fold">${foldSum(label, icon)}<div class="fold-body">${inner}</div></details>`;
  const risk = () => `<p class="risk">${ic("alert")}<span>${L(D.ui.risk)}</span></p>`;
  const sec = (id, inner, cls = "", title) =>
    `<section id="${id}" class="sec ${cls}" aria-labelledby="h-${id}"><div class="wrap">${head(id, title)}${inner}${RISK.has(id) ? risk() : ""}</div></section>`;
  const countdown = () => {
    const n = daysLeft();
    return n > 0 ? `<p class="badge badge--lime">${ic("zap")}${fill(L(D.ui.countdown), { n })}</p>` : "";
  };
  // Đăng ký đối tác: 2 link Global / Việt Nam, gợi ý theo ngôn ngữ đang xem (VI → Việt Nam, EN/中文 → Global).
  const REGS = ["global", "vn"];
  const regPick = () => (state.lang === "vi" ? "vn" : "global");
  const regIcon = (k) => (k === "vn" ? ic("flag-vn", "flag") : ic("globe"));
  const regLink = (k, cls, inner) =>
    `<a class="${cls}" href="${esc(D.meta.register[k])}" target="_blank" rel="noopener" hreflang="${k === "vn" ? "vi" : "en"}" data-reg="${k}">${inner}<span class="sr-only"> (${L(D.ui.reg.newTab)})</span></a>`;
  // Hai nút cạnh nhau (bìa, slide cuối, footer, khung khóa slide So sánh); nút gợi ý tô đặc
  const registerPair = (size = "") => `<div class="reg-pair" role="group" aria-label="${esc(L(D.ui.reg.choose))}">${REGS.map((k) =>
    regLink(k, `btn ${k === regPick() ? "btn--lime" : "btn--lime-o"} ${size}`, `${regIcon(k)}<span>${fill(L(D.ui.reg.btn), { r: L(D.ui.reg[k]) })}</span>${ic("ext", "reg-ext")}`)).join("")}</div>`;
  // Header chật: một nút mở menu nhỏ có 2 lựa chọn
  const registerMenu = () => `<div class="reg-menu" data-regmenu="1">
      <button type="button" class="btn btn--lime btn--sm" data-act="reg-menu" aria-expanded="${state.regMenu}" aria-controls="reg-panel" aria-label="${esc(L(D.ui.register))}">${ic("user-plus")}<span>${L(D.ui.register)}</span>${ic("chevron", "reg-chev")}</button>
      <div id="reg-panel" class="reg-panel"${state.regMenu ? "" : " hidden"}><p class="reg-panel-h">${L(D.ui.reg.choose)}</p>${REGS.map((k) =>
        regLink(k, `reg-opt${k === regPick() ? " is-pick" : ""}`, `${regIcon(k)}<span class="reg-opt-txt"><b>${L(D.ui.reg[k])}${k === regPick() ? ` <em>${L(D.ui.reg.suggested)}</em>` : ""}</b><small>${L(D.ui.reg[`${k}Sub`])}</small></span>${ic("ext", "reg-ext")}`)).join("")}</div>
    </div>`;
  const tgLink = () => `<a href="https://t.me/${P.telegram}" target="_blank" rel="noopener">${ic("send")} @${P.telegram}</a>`;
  const waLink = () => `<a href="https://wa.me/${P.whatsappLink}" target="_blank" rel="noopener">${ic("whatsapp")} ${P.whatsapp}</a>`;
  const segBtns = (act, opts, cur, label) =>
    `<div class="seg" role="group" aria-label="${esc(label)}">${opts
      .map(([v, t]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${cur === v}">${t}</button>`)
      .join("")}</div>`;

  // ---------- đồ họa ----------
  const rays = () => {
    let r = "";
    for (let i = 0; i < 5; i++) {
      const a = ((-90 + i * 72) * Math.PI) / 180;
      const x = (200 + 150 * Math.cos(a)).toFixed(1), y = (200 + 150 * Math.sin(a)).toFixed(1);
      r += `<line class="ray" style="--d:${i * 0.18}s" x1="200" y1="200" x2="${x}" y2="${y}"/><circle class="ray-end" style="--d:${i * 0.18}s" cx="${x}" cy="${y}" r="8"/>`;
    }
    return `<svg viewBox="0 0 400 400"><defs><radialGradient id="glow"><stop offset="0" stop-color="#2EA3F2" stop-opacity=".55"/><stop offset="1" stop-color="#2EA3F2" stop-opacity="0"/></radialGradient></defs><circle cx="200" cy="200" r="120" fill="url(#glow)"/>${r}<circle class="ray-core" cx="200" cy="200" r="24"/></svg>`;
  };

  const night = () => {
    const stars = [[40, 40], [90, 70], [150, 30], [260, 50], [370, 140], [60, 110], [190, 80], [350, 30]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff" opacity=".7"/>`).join("");
    return `<svg viewBox="0 0 400 300" aria-hidden="true">
      <rect width="400" height="300" rx="20" fill="#0B1F4D"/>${stars}
      <circle cx="320" cy="64" r="26" fill="#F3E7B3"/><circle cx="333" cy="55" r="24" fill="#0B1F4D"/>
      <line x1="220" y1="26" x2="220" y2="222" stroke="#2EA3F2" stroke-width="2" stroke-dasharray="5 6" opacity=".8"/>
      <text x="227" y="42" fill="#2EA3F2" font-size="13" font-family="inherit">00:00</text>
      <polyline points="16,170 56,150 92,162 128,128 164,140 200,112 236,124 272,98 308,110 344,86 384,96" fill="none" stroke="#E8C46A" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      <text x="18" y="196" fill="#E8C46A" font-size="12" font-family="inherit">XAUUSD</text>
      <g fill="#E8C46A" stroke="#B8932F" stroke-width="1.5"><circle cx="220" cy="146" r="7"/><circle cx="213" cy="176" r="7"/><circle cx="226" cy="204" r="7"/></g>
      <rect x="176" y="226" width="88" height="50" rx="10" fill="#1F5FD6"/><rect x="238" y="240" width="26" height="20" rx="5" fill="#2EA3F2"/>
      <text x="190" y="258" fill="#fff" font-size="17" font-weight="700" font-family="inherit">IB</text>
    </svg>`;
  };

  // TMGM Points (luôn bật): USD/lot khách nhận lại, mặc định trừ vào chi phí khách
  const ptsLot = () => C.pointsPerLot(D.points);
  const ptsRef = () => D.points.cashback.find((c) => c.usd === D.points.refUsd);
  const netCost = (c) => Math.max(0, c - ptsLot());

  // Cặp thanh rebate / chi phí khách, cùng thang đo; đoạn sọc cuối thanh chi phí = phần Points trả lại khách
  const pairs = () => {
    const [kr, kc] = state.metal === "fx" ? ["fx", "costFx"] : ["gold", "costGold"];
    const top = Math.max(...D.accounts.map((a) => a[kc]));
    return D.accounts.map((a) => `<div class="pair"><span class="pair-name">${a.name}</span><div class="pair-bars">
      <div class="hbar hbar--rebate" style="width:${(a[kr] / top) * 100}%"><span>${num(a[kr])}</span></div>
      <div class="hbar hbar--cost" style="width:${(a[kc] / top) * 100}%"><span>~${num(a[kc])}</span></div></div></div>`).join("");
  };

  // Bậc thang ECN Q4; bậc đang sáng theo net deposit nhập ở slide "Cách tính Q4"
  const q4stairs = () => {
    const s = S["ecn-q4"], E = D.ecn, qi = C.ecnTier(E.tiers, state.ecn.deposit), last = E.tiers.length - 1;
    const fx = (t) => C.ecnRate(E.base.fx, t.fxUp), lo = fx(E.tiers[0]), hi = fx(E.tiers[last]);
    return E.tiers.map((t, i) => `<div class="stair${i === qi ? " is-on" : ""}${i === last ? " is-top" : ""}" style="--h:${40 + ((fx(t) - lo) / (hi - lo)) * 55}%">
      <div class="stair-val"><b>${num(fx(t), 1)}</b><small>${L(s.gold)} ${num(C.ecnRate(E.base.gold, t.goldUp), 1)}</small></div>
      <div class="stair-bar"></div><span class="stair-x">${kf(t.min)}${i === last ? "+" : ""}</span></div>`).join("");
  };

  const ecnStep2 = () => {
    const s = S["ecn-calc"], r = C.ecnMonth(state.ecn, D.ecn);
    return r.tier < 0 ? L(s.noTier) : fill(L(s.tierLine), { d: usd(state.ecn.deposit), fx: r.fxUp, g: r.goldUp });
  };
  const ecnOut = () => {
    const s = S["ecn-calc"], r = C.ecnMonth(state.ecn, D.ecn);
    return `<p class="ecn-row"><span>${L(s.base)}</span><b>${usd(r.base)}</b></p>
      <p class="ecn-row ecn-row--add"><span>${L(s.add)}</span><b>+${usd(r.add)}</b></p>
      <p class="total"><span>${L(s.total)}</span><b>${usd(r.total)}</b></p>
      <p class="ecn-up">${r.add ? `${ic("arrow")} ${fill(L(s.uplift), { p: r.uplift })}` : L(s.noTier)}</p>`;
  };

  // ---------- slide 7: lịch nộp đơn và nhận tiền ----------
  const PAY_ADDONS = ["wed", "day13", "bd5", "bonus", "gift"]; // rebate cơ bản (base) luôn hiện; còn lại là add-on
  const payOn = () => PAY_ADDONS.filter((k) => state.pay.on[k]);
  const paySchedule = () => Dt.schedule({ trade: state.pay.trade, apply: state.pay.apply || undefined, ecnPeriod: D.ecn.period });
  const payMeta = (key) => D.payouts.find((p) => p.key === key);

  const payApplyCell = (r, s) => {
    const a = r.apply;
    if (a.type === "none") return L(s.applyNone);
    if (a.type === "am") return L(s.applyAm);
    if (a.type === "redeem") return fill(L(s.redeemOn), { d: dfmt(a.date) });
    return `${fill(L(s.applyBy), { d: dfmt(a.date) })}${a.weekend ? `<small>${fill(L(s.applyWeekend), { r: dfmt(a.recommended) })}</small>` : ""}${r.late ? `<small class="late">${L(s.late)}</small>` : ""}`;
  };
  const payWhenCell = (r, s) => {
    if (!r.applicable || !r.payout) return `<span class="na">${L(s.outside)}</span>`;
    const p = r.payout;
    if (p.type === "window") return `<b>${dfmt(p.from)} – ${dfmt(p.to)}</b>`;
    if (p.type === "before") return `<b>${fill(L(s.payBefore), { d: dfmt(p.date) })}</b>`;
    return `<b>${dfmt(p.date)}</b>${r.key === "bonus" ? `<small>${fill(L(s.payLatest), { d: dfmt(p.date) })}</small>` : ""}`;
  };
  const payTable = () => {
    const s = S["lich-tien"], on = ["base", ...payOn()];
    const rows = paySchedule().rows.filter((r) => on.includes(r.key));
    return `<table class="tbl tbl--pay"><thead><tr><th scope="col">${L(s.colItem)}</th><th scope="col">${L(s.colApply)}</th><th scope="col">${L(s.colPayout)}</th></tr></thead><tbody>${rows.map((r) => {
      const m = payMeta(r.key);
      return `<tr data-row="${r.key}"><th scope="row"><span class="mark mark--${r.key}">${ic(m.icon)}</span><span><b>${L(m.name)}</b>${r.unconfirmed ? `<small class="pending">${L(s.pending)}</small>` : ""}</span></th><td>${payApplyCell(r, s)}</td><td class="pay-when">${payWhenCell(r, s)}</td></tr>`;
    }).join("")}</tbody></table>`;
  };
  const calFocus = () => {
    const sch = paySchedule();
    return state.pay.calMonth || Dt.focusMonth(sch.rows, ["base", ...payOn()]) || sch.tradeMonth;
  };
  const calendar = () => {
    const s = S["lich-tien"], sch = paySchedule(), on = ["base", ...payOn()], today = isoOf(now());
    const marks = {};
    for (const r of sch.rows) if (on.includes(r.key) && r.applicable) for (const m of r.marks) (marks[m.date] ||= []).push(m.cls);
    const { y, m } = calFocus();
    const off = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    let cells = '<span class="day is-empty"></span>'.repeat(off);
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${pad2(m)}-${pad2(d)}`, wd = Dt.weekday(iso);
      const cls = [...(marks[iso] || []), iso === today && "is-today", (wd === 0 || wd === 6) && "is-weekend"].filter(Boolean).join(" ");
      cells += `<span class="day ${cls}"><span>${d}</span></span>`;
    }
    const t = new Intl.DateTimeFormat(loc(), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
    return `<div class="cal-head">
        <button type="button" data-act="cal" data-v="-1" aria-label="${esc(L(D.ui.prev))}">${ic("left")}</button>
        <h3>${t.charAt(0).toUpperCase() + t.slice(1)}</h3>
        <button type="button" data-act="cal" data-v="1" aria-label="${esc(L(D.ui.next))}">${ic("right")}</button>
      </div>
      <div class="cal-grid">${L(s.weekdays).map((w) => `<span class="wd">${w}</span>`).join("")}${cells}</div>`;
  };
  const calLegend = () => ["base", ...payOn()].map((k) => `<li><span class="mark mark--${k}">${ic(payMeta(k).icon)}</span>${L(payMeta(k).name)}</li>`).join("");

  // ---------- add-on (slide 10 và 11) ----------
  const isEdge = () => D.accounts.some((a) => a.q4 && a.name === state.calc.account);
  const ecnUsable = () => ecnActive() && isEdge();
  const mibCalc = () => C.mibMonth({ ...state.calc, addons: state.addons, swapFee: state.swap.fee, swapNd: state.swap.nd }, D.accounts, state.tiers.mib, ecnActive() ? D.ecn : null, D.swapTiers);
  const addonChips = (withSwap) => {
    const s = S.m5;
    return `<span class="addons-l">${L(s.addonsLabel)}</span>
      <button type="button" class="chip-toggle" data-act="addon" data-v="ecn" aria-pressed="${state.addons.ecn}"${ecnUsable() ? "" : " disabled"}>${ic("zap")}<span>${L(s.addonEcn)}</span></button>
      ${withSwap ? `<button type="button" class="chip-toggle" data-act="addon" data-v="swap" aria-pressed="${state.addons.swap}">${ic("moon")}<span>${L(s.addonSwap)}</span></button>` : ""}
      ${!ecnUsable() && ecnActive() ? `<small class="fine">${L(s.ecnHint)}</small>` : ""}`;
  };

  const waterfall = () => {
    const s = S.m5, r = mibCalc(), b = s.bars;
    const top = Math.max(r.rebate, r.total, 1) * 1.15;
    const cols = [[0, r.rebate, "gray", r.rebate, "", b[0]], [r.keep, r.toSub, "red", r.toSub, "−", b[1]], [0, r.keep, "gray", r.keep, "", b[2]], [r.keep, r.bonus, "lime", r.bonus, "+", b[3]]];
    let acc = r.keep + r.bonus;
    if (r.ecn) { cols.push([acc, r.ecn, "lime", r.ecn, "+", s.ecnBar]); acc += r.ecn; }
    if (r.swap.total) cols.push([acc, r.swap.total, "lime", r.swap.total, "+", s.swapBar]);
    cols.push([0, r.total, "total", r.total, "", b[4]]);
    const aria = cols.map((c) => `${L(c[5])}: ${c[4]}${usd(c[3])}`).join("; ");
    return `<div class="wf" role="img" aria-label="${esc(aria)}">${cols.map(([bot, h, k, v, sign, lbl]) => `<div class="wf-col">
      <div class="wf-area"><div class="wf-bar wf-bar--${k}" style="bottom:${(bot / top) * 100}%;height:${(h / top) * 100}%"><span>${sign}${num(v)}</span></div></div>
      <span class="wf-x">${L(lbl)}</span></div>`).join("")}</div>`;
  };

  const calcOut = () => {
    const s = S.m5, r = mibCalc(), first = state.tiers.mib[0], anyAddon = r.ecn > 0 || r.swap.total > 0;
    const tier = r.tier
      ? fill(L(s.tier), { d: usd(r.tier.deposit), l: num(r.tier.lots) })
      : fill(L(s.noTier), { d: usd(first.deposit), l: num(first.lots) });
    const need = [r.needLots > 0 && fill(L(s.needLots), { l: num(r.needLots) }), r.needDeposit > 0 && fill(L(s.needDep), { d: usd(r.needDeposit) })].filter(Boolean).join(L(s.and));
    const next = r.next ? fill(L(s.nextTier), { r: usd(r.next.mib), need }) : L(s.topTier);
    const swapLines = state.addons.swap ? `<p class="ecn-row"><span>${L(s.swapWeekly)}</span><b>+${usd(r.swap.weekly)}</b></p>
      <p class="ecn-row"><span>${r.swap.pct ? fill(L(s.swapMonthly), { p: r.swap.pct }) : L(s.swapMonthlyNone)}</span><b>+${usd(r.swap.monthly)}</b></p>` : "";
    return `<p class="total"><span>${L(s.bars[4])}</span><b>${usd(r.total)}</b></p>
      ${anyAddon ? `<p class="ecn-row"><span>${L(s.baseTotal)}</span><b>${usd(r.base)}</b></p>` : ""}
      <p>${ic("trophy")} ${tier}</p><p>${ic("arrow")} ${next}</p>
      ${r.ecn ? `<p>${ic("zap")} ${fill(L(s.ecnIn), { v: usd(r.ecn) })}</p>` : ""}${swapLines}
      <p class="fine">${fill(L(s.gross), { g: usd(r.gross) })} ${state.addons.swap ? L(s.swapNote) : L(s.noSwap)}${r.ecn ? ` ${L(s.ecnNote)}` : ""}</p>`;
  };
  const swapInputs = () => {
    const s = S.m5;
    return state.addons.swap ? `<label class="field"><span>${L(s.swapFee)}</span><input type="number" min="0" step="500" value="${state.swap.fee}" data-swap="fee" inputmode="numeric"></label>
      <label class="field"><span>${L(s.swapNd)}</span><input type="number" min="0" step="5000" value="${state.swap.nd}" data-swap="nd" inputmode="numeric"></label>` : "";
  };

  const cmpRows = () => C.compareAll(state.calc, D.competitors.brokers, state.cmp, { mibTiers: state.tiers.mib, ecn: state.addons.ecn && ecnActive() ? D.ecn : null });
  const cmpMeta = (b, a, s) => {
    const rate = C.rebateRate(a), perLot = rate ? `${lot(rate.fx)}/${lot(rate.gold)}` : "—";
    return fill(L(s.meta), { r: a.pct != null ? fill(L(s.pctRebate), { p: a.pct, r: perLot }) : perLot, c: `${dash(a.costFx)}/${dash(a.costGold)}` })
      + (b.est ? ` · ${L(s.estTag)}` : "");
  };
  const dash = (v) => (v == null ? "—" : lot(v));

  // ---- Cách so sánh 2 "Đối đầu": TMGM và một sàn tùy chọn, mỗi bên một vòng tròn + khung nhập riêng ----
  const numOrNull = (v) => (v === "" || v == null ? null : +v);
  const otherBroker = () => {
    const t = state.h2h.them, a = { acc: "—", fx: null, gold: null, costFx: numOrNull(t.costFx), costGold: numOrNull(t.costGold) };
    return { name: H2H_OTHER, std: a, raw: a, promo: "" };
  };
  const h2hRes = () => C.headToHead(state.h2h.us, state.h2h.them, {
    accounts: D.accounts, mibTiers: state.tiers.mib, ecn: ecnActive() ? D.ecn : null,
    brokers: state.h2h.them.broker === H2H_OTHER ? [...D.competitors.brokers, otherBroker()] : D.competitors.brokers,
  });
  const DONUT = { keep: "var(--blue)", promo: "var(--lime)", ecn: "#C9E5A3" };
  const SW = { keep: "blue", promo: "lime", ecn: "ecn" };
  const donut = (r, name) => {
    const s = S["so-sanh"], arcs = r ? C.donutArcs([{ key: "keep", value: r.keep }, { key: "promo", value: r.promo }, { key: "ecn", value: r.ecn }]) : [];
    return `<svg class="donut" viewBox="0 0 120 120" role="img" aria-label="${esc(`${name}: ${r ? usd(r.total) : L(s.pending)}`)}">
      <circle class="donut-bg" cx="60" cy="60" r="46"/>${arcs.map((a) => `<circle cx="60" cy="60" r="46" pathLength="100" stroke="${DONUT[a.key]}" stroke-dasharray="${a.pct.toFixed(3)} 100" stroke-dashoffset="${(-a.start).toFixed(3)}" transform="rotate(-90 60 60)"/>`).join("")}
      <text x="60" y="60" class="donut-v">${r ? num(r.total) : "—"}</text><text x="60" y="76" class="donut-u">${L(s.h2hMonthly)}</text></svg>`;
  };
  const h2hLegend = (r) => {
    const s = S["so-sanh"];
    const rows = [["keep", s.legendKeep, r.keep], ["promo", s.legendPromo, r.promo], ["ecn", s.legendEcn, r.ecn]].filter(([k, , v]) => v > 0 || k !== "ecn");
    return `<ul class="h2h-legend">${rows.map(([k, n, v]) => `<li><i class="sw sw--${SW[k]}"></i>${L(n)}<b>${usd(v)}</b></li>`).join("")}</ul>
      <p class="h2h-sub">${fill(L(s.h2hSub), { v: usd(r.toSub) })}</p>`;
  };
  const h2hUsOut = (x) => {
    const s = S["so-sanh"], a = x.acc;
    return `${donut(x.us, "TMGM")}${h2hLegend(x.us)}<p class="h2h-cost">${fill(L(s.h2hCostUs), { c: `${lot(a.costFx)}/${lot(a.costGold)}`, n: `${lot(netCost(a.costFx))}/${lot(netCost(a.costGold))}` })}</p>`;
  };
  const h2hBroker = () => {
    const t = state.h2h.them;
    if (t.broker !== H2H_OTHER) return D.competitors.brokers.find((b) => b.name === t.broker);
    return { ...otherBroker(), name: t.name.trim() || L(S["so-sanh"].h2hOtherDefault) };
  };
  const h2hThemOut = (x) => {
    const s = S["so-sanh"], b = h2hBroker(), a = b[state.h2h.them.cls];
    const cost = a.costFx == null && a.costGold == null ? L(s.h2hNoCost) : fill(L(s.h2hCost), { c: `${dash(a.costFx)}/${dash(a.costGold)}` });
    return `${donut(x.them, b.name)}${x.them ? h2hLegend(x.them) : `<p class="h2h-need">${fill(L(s.h2hNeedRate), { n: esc(b.name) })}</p>`}<p class="h2h-cost">${cost}</p>`;
  };
  const h2hDiff = (x) => {
    const s = S["so-sanh"];
    if (x.diff == null) return `<div class="h2h-diff is-na"><b>—</b></div>`;
    if (Math.round(x.diff) === 0) return `<div class="h2h-diff is-even"><span>${L(s.h2hEqual)}</span></div>`;
    const us = x.diff > 0, base = us ? x.them.total : x.us.total, pct = base > 0 ? Math.round((Math.abs(x.diff) / base) * 100) : null;
    return `<div class="h2h-diff ${us ? "is-us" : "is-them"}"><span>${fill(L(s.h2hAhead), { n: esc(us ? "TMGM" : h2hBroker().name) })}</span>
      <b>+${usd(Math.abs(Math.round(x.diff)))}</b><small>${pct == null ? "" : `+${pct}% · `}${L(s.h2hPerMonth)}</small></div>`;
  };
  const h2hField = (side, k, label, attrs) =>
    `<label class="field field--sm"><span>${L(label)}</span><input type="number" data-h2h="${side}.${k}" value="${state.h2h[side][k]}" ${attrs} inputmode="decimal"></label>`;
  const h2hView = () => {
    const s = S["so-sanh"], inp = S.m5.inputs, u = state.h2h.us, t = state.h2h.them, x = h2hRes(), b = h2hBroker(), other = t.broker === H2H_OTHER;
    const opt = (v, cur, label) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${label}</option>`;
    const vols = (side) => `${h2hField(side, "lotsFx", inp.lotsFx, 'min="0" step="50"')}${h2hField(side, "lotsGold", inp.lotsGold, 'min="0" step="50"')}${h2hField(side, "deposit", inp.deposit, 'min="0" step="10000"')}${h2hField(side, "share", inp.share, 'min="0" max="100" step="5"')}`;
    const ecnOk = ecnActive() && x.acc.q4;
    const profile = b.profile ? `<div class="h2h-profile"><p class="h2h-profile-h">${fill(L(s.h2hProfile), { n: esc(b.name) })}${b.est ? ` <em class="xp-tag">${L(s.estTag)}</em>` : ""}</p>
      <ul class="elig">${b.profile.map((v) => `<li>${ic("check")}<span>${L(v)}</span></li>`).join("")}</ul>${b.src ? `<p class="fine">${L(b.src)}</p>` : ""}</div>` : "";
    return `<div class="h2h">
      <form class="h2h-side is-us" onsubmit="return false">
        <div class="h2h-head"><h3>TMGM</h3><label class="field field--sm"><span>${L(s.h2hAccount)}</span><select data-h2h="us.account">${D.accounts.map((a) => opt(a.name, u.account, a.name)).join("")}</select></label></div>
        <div class="h2h-out" id="h2h-us">${h2hUsOut(x)}</div>
        <div class="h2h-in">${vols("us")}</div>
        <button type="button" class="chip-toggle" data-act="h2h-ecn" aria-pressed="${!!(u.ecn && ecnOk)}"${ecnOk ? "" : " disabled"}>${ic("zap")}<span>${L(s.h2hEcn)}</span></button>
      </form>
      <div class="h2h-mid" id="h2h-diff">${h2hDiff(x)}</div>
      <form class="h2h-side" onsubmit="return false">
        <div class="h2h-head"><label class="field field--sm"><span>${L(s.h2hBroker)}</span><select data-h2h="them.broker">${D.competitors.brokers.filter((y) => y.name !== "TMGM").map((y) => opt(y.name, t.broker, `${esc(y.name)}${y.est ? ` (${L(s.estTag)})` : ""}`)).join("")}${opt(H2H_OTHER, t.broker, L(s.h2hOther))}</select></label>
        ${other ? `<label class="field field--sm"><span>${L(s.h2hOtherName)}</span><input type="text" data-h2h="them.name" value="${esc(t.name)}" maxlength="40" placeholder="${esc(L(s.h2hOtherDefault))}" autocomplete="off"></label>` : `
        <label class="field field--sm"><span>${L(s.h2hGroup)}</span><select data-h2h="them.cls">${["std", "raw"].map((v) => opt(v, t.cls, esc(b[v].acc))).join("")}</select></label>`}</div>
        <div class="h2h-out" id="h2h-them">${h2hThemOut(x)}</div>
        <div class="h2h-in">${h2hField("them", "fx", s.h2hRateFx, 'min="0" step="0.5"')}${h2hField("them", "gold", s.h2hRateGold, 'min="0" step="0.5"')}${other ? `${h2hField("them", "costFx", s.h2hCostFx, 'min="0" step="0.5"')}${h2hField("them", "costGold", s.h2hCostGold, 'min="0" step="0.5"')}` : ""}${vols("them")}${h2hField("them", "extra", s.h2hExtra, 'min="0" step="100"')}</div>
        <button type="button" class="btn btn--ghost btn--sm h2h-copy" data-act="h2h-copy">${L(s.h2hCopy)}</button>
        ${profile}
      </form>
    </div>
    <p class="fine">${L(s.h2hNote)}</p>`;
  };
  const compareChart = () => {
    const s = S["so-sanh"], cls = state.cmp;
    const rows = cmpRows();
    const top = Math.max(1, ...rows.map((x) => (x.r ? x.r.total : 0)));
    const w = (v) => `style="width:${(v / top) * 100}%"`;
    return rows.map(({ broker: b, r }) => {
      const a = b[cls];
      const meta = cmpMeta(b, a, s)
        + (b.name === "TMGM" ? ` · ${fill(L(S["tai-khoan"].costNet), { n: `${lot(netCost(a.costFx))}/${lot(netCost(a.costGold))}` })}` : "");
      return `<div class="cmp-row${b.name === "TMGM" ? " is-us" : ""}">
        <div class="cmp-name"><b>${b.name}</b><small>${a.acc}</small></div>
        <div class="cmp-track">${r ? `<span class="cb cb--keep" ${w(r.keep)}></span><span class="cb cb--promo" ${w(r.promo)}></span><span class="cb cb--ecn" ${w(r.ecn)}></span>` : `<em>${L(s.pending)}</em>`}</div>
        <b class="cmp-val">${r ? usd(r.total) : "—"}</b>
        <small class="cmp-promo">${meta} · ${L(b.promo)}</small></div>`;
    }).join("");
  };
  const counting = () => {
    const s = S["so-sanh"];
    return `<b>${L(s.counting)}</b> <span class="tag">${L(s.tagMibPromo)}</span>${state.addons.ecn && ecnActive() ? ` <span data-tag="ecn" class="tag">${L(s.tagEcn)}</span>` : ""}`;
  };

  // ---------- slide 8: bậc KM MIB / IB ----------
  const promoKind = () => (state.aud === "ib" ? "ib" : state.promo);
  const isCustomTiers = (kind) => JSON.stringify(state.tiers[kind]) !== JSON.stringify(defaultTiers()[kind]);
  const presetOf = () => {
    const sig = (rows) => JSON.stringify(rows.map((t) => [t.deposit, t.lots, t.mib]));
    return Object.keys(D.mibTierPresets).find((k) => sig(C.cleanTiers(D.mibTierPresets[k], "mib").rows) === sig(state.tiers.mib)) || "custom";
  };
  const promoTitle = (kind) => {
    const s = S.m2, key = TIER_KEY[kind], max = Math.max(...state.tiers[kind].map((t) => t[key]));
    return fill(L(kind === "ib" ? s.titleIb : s.title), { v: usd(max) });
  };
  const promoBody = (kind) => {
    const s = S.m2, key = TIER_KEY[kind], rows = state.tiers[kind], top = Math.max(...rows.map((t) => t[key]));
    const show = D.meta.showInternal && kind === "mib" && rows.every((t) => Number.isFinite(t.ibCombined));
    const topAll = show ? Math.max(top, ...rows.map((t) => t.ibCombined)) : top;
    const groups = rows.map((t) => `<div class="gb">
      ${show ? `<span class="gb-badge">+${Math.round((t.mib / t.ibCombined - 1) * 100)}%</span>` : ""}
      <div class="gb-bars">
        ${show ? `<div class="vbar vbar--muted" style="--h:${(t.ibCombined / topAll) * 100}%"><span>${num(t.ibCombined)}</span></div>` : ""}
        <div class="vbar vbar--blue" style="--h:${(t[key] / topAll) * 100}%"><span>${num(t[key])}</span></div>
      </div>
      <div class="gb-x"><b>${kf(t.deposit)}</b><small>${num(t.lots)} ${L(s.lot)}</small></div></div>`).join("");
    const table = `<table class="sr-only"><caption>${L(D.ui.tableData)}</caption><tr><th>Net deposit</th><th>Lot</th>${show ? `<th>${L(s.legendIb)}</th>` : ""}<th>${L(kind === "ib" ? s.promoIb : s.legendMib)}</th></tr>
      ${rows.map((t) => `<tr><td>${usd(t.deposit)}</td><td>${num(t.lots)}</td>${show ? `<td>${usd(t.ibCombined)}</td>` : ""}<td>${usd(t[key])}</td></tr>`).join("")}</table>`;
    const lead = kind === "ib" ? L(s.ib.plain) : `${show ? L(s.compare) : L(s.plain)} ${L(s.office)}`;
    const topRow = rows[rows.length - 1];
    return `<div class="promo">
      <div class="promo-chart">
        <p class="lead">${lead}</p>
        <p class="legend">${show ? `<span><i class="sw sw--muted"></i>${L(s.legendIb)}</span>` : ""}<span><i class="sw sw--blue"></i>${L(kind === "ib" ? s.promoIb : s.legendMib)}</span></p>
        <div class="gbars${show ? "" : " gbars--solo"}" style="grid-template-columns:repeat(${rows.length},1fr)" aria-hidden="true">${groups}</div>${table}
        <p class="fine">${L(kind === "ib" ? s.ib.axisNote : s.axisNote)} · ${L(s.source)}</p>
      </div>
      <aside class="card--navy big mesh">${ic("trophy", "big-ic")}<b class="big-num">${usd(top)}</b><span>${L(s.perMonth)}</span><small>${fill(L(s.tierLine), { d: usd(topRow.deposit), l: num(topRow.lots) })}</small></aside>
    </div>
    ${kind === "ib" ? `<div class="card conds"><h3>${L(s.ib.condsTitle)}</h3><ul class="elig">${s.ib.conds.map((c) => `<li>${ic("check")}<span>${L(c)}</span></li>`).join("")}</ul></div>` : ""}
    ${state.aud === "mib" ? `<p class="warn">${ic("alert")}<span>${L(s.exclusive)}</span></p>` : ""}`;
  };
  const tierWarnHtml = (kind) => C.tierWarnings(state.tiers[kind], TIER_KEY[kind]).map((w) => `<p class="warn warn--sm">${ic("alert")}<span>${L(w === "lots-down" ? S.m2.warnLots : S.m2.warnReward)}</span></p>`).join("");
  const tierEditor = (kind) => {
    const s = S.m2, key = TIER_KEY[kind], rows = state.tiers[kind];
    const cell = (i, f, v, label) => `<input type="number" min="1" step="any" data-tier="${kind}:${i}:${f}" value="${v}" inputmode="numeric" aria-label="${esc(label)} ${i + 1}">`;
    const preset = presetOf();
    return `<div class="tier-editor">
      <p class="fine">${L(s.editHint)}</p>
      ${kind === "mib" ? `<label class="field field--inline"><span>${L(s.presetLabel)}</span><select data-tier-preset="mib">
        <option value="pdf5"${preset === "pdf5" ? " selected" : ""}>${L(s.presetPdf5)}</option>
        <option value="research7"${preset === "research7" ? " selected" : ""}>${L(s.presetXls7)}</option>
        <option value="custom"${preset === "custom" ? " selected" : ""} disabled>${L(s.presetCustom)}</option></select></label>` : ""}
      <table class="tbl tbl--tiers"><thead><tr><th scope="col">${L(s.colDeposit)}</th><th scope="col">${L(s.colLots)}</th><th scope="col">${L(s.colReward)}</th><th></th></tr></thead>
      <tbody>${rows.map((t, i) => `<tr><td>${cell(i, "deposit", t.deposit, s.colDeposit.en)}</td><td>${cell(i, "lots", t.lots, s.colLots.en)}</td><td>${cell(i, key, t[key], s.colReward.en)}</td>
        <td><button type="button" class="icon-btn" data-act="tier-del" data-v="${kind}:${i}" aria-label="${esc(L(s.delTier))} ${i + 1}"${rows.length <= 1 ? " disabled" : ""}>${ic("x")}</button></td></tr>`).join("")}</tbody></table>
      <div id="tier-warn">${tierWarnHtml(kind)}</div>
      <div class="tier-actions"><button type="button" class="btn btn--ghost btn--sm" data-act="tier-add">${ic("plus")}<span>${L(s.addTier)}</span></button>
        <button type="button" class="btn btn--ghost btn--sm" data-act="tier-reset"><span>${L(s.resetTiers)}</span></button></div>
    </div>`;
  };

  // ---------- slide 13: form liên hệ ----------
  const contactStatus = () => {
    const u = D.ui.contact, c = state.contact, to = D.meta.contactEmail;
    if (c.status !== "sent") return "";
    return `<p class="contact-ok">${ic("check")}<span>${fill(L(u.ok), { to })}</span></p><p class="fine">${fill(L(u.fallback), { to })} <a href="mailto:${to}">${to}</a></p>`;
  };
  const contactForm = () => {
    const u = D.ui.contact, c = state.contact, e = c.errors || {}, to = D.meta.contactEmail;
    const err = (k) => (e[k] ? `<small class="err" id="err-${k}">${L(e[k] === "required" ? u.required : k === "phone" ? u.badPhone : u.badEmail)}</small>` : "");
    const inv = (k) => (e[k] ? ` aria-invalid="true" aria-describedby="err-${k}"` : "");
    return `<form class="contact-form" data-form="contact" novalidate>
      <h3>${L(u.title)}</h3>
      <p class="fine">${fill(L(u.intro), { to })}</p>
      <label class="field"><span>${L(u.name)}</span><input type="text" data-contact="name" value="${esc(c.name)}" autocomplete="name" maxlength="80"></label>
      <label class="field"><span>${L(u.phone)} *</span><input type="tel" data-contact="phone" value="${esc(c.phone)}"${inv("phone")} autocomplete="tel" inputmode="tel" maxlength="30">${err("phone")}</label>
      <label class="field"><span>${L(u.email)} *</span><input type="email" data-contact="email" value="${esc(c.email)}"${inv("email")} autocomplete="email" maxlength="120">${err("email")}</label>
      <label class="field"><span>${L(u.note)}</span><textarea data-contact="note" rows="3" maxlength="800">${esc(c.note)}</textarea></label>
      <button type="submit" class="btn btn--lime btn--lg">${ic("send")}<span>${L(u.send)}</span></button>
      <div id="contact-status" aria-live="polite">${contactStatus()}</div>
    </form>`;
  };

  // ---------- section ----------
  const R = {};

  R.bia = () => {
    const s = S.bia;
    return `<section id="bia" class="hero" aria-labelledby="h-bia">
      <div class="hero-mesh" aria-hidden="true"></div>
      <div class="wrap hero-inner">
        <div class="hero-copy">
          ${logo()}
          <h1 id="h-bia" class="hero-title">${L(s.title1)}<br><span class="hl">${L(s.title2)}</span></h1>
          <p class="hero-sub">${L(s.sub)}</p>
          <div class="hero-cta">${registerPair("btn--lg")}${countdown()}</div>
          <div class="presenter">
            ${img("presenter.webp", P.name, "avatar", "user")}
            <div class="presenter-txt"><strong>${P.name}</strong><span>${L(P.title)}</span>${tgLink()}${waLink()}</div>
            ${img("qr-telegram.png", "QR Telegram", "qr qr--sm", "qr")}
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">${rays()}</div>
      </div>
    </section>`;
  };

  R["phap-ly"] = () => {
    const s = S["phap-ly"];
    const verify = (r) => `<a class="btn btn--verify" href="${r.url}" target="_blank" rel="noopener"${r.copy ? ` data-copy="${esc(r.copy)}"` : ""} title="${esc(r.entity)}">${ic("shield")}<span>${fill(L(r.copy ? D.ui.verifyOnCopy : D.ui.verifyOn), { r: r.name })}</span>${ic("ext")}</a>`;
    return sec("phap-ly", `<div class="trust">
      <div class="trust-panel mesh">
        <div class="stats">${s.stats.map((x) => `<div class="stat">${ic(x.icon)}<b>${L(x.num)}</b><span>${L(x.label)}</span></div>`).join("")}</div>
        <ul class="regs">${s.regulators.map((r) => `<li class="reg"><b>${r.name}</b><span>${r.id}</span><em>${r.entity}</em>${verify(r)}</li>`).join("")}</ul>
        <p class="regs-hint">${L(s.verifyHint)}</p>
        <p class="platforms">${L(s.platforms)}</p>
      </div>
      <div class="bento">${s.photos.map((p, i) => `<figure class="shot shot--${i}"><a class="shot-link" href="${p.href}" target="_blank" rel="noopener" aria-label="${esc(L(p.caption))}">${img(p.file, L(p.caption), "shot-img", "image", p.pos)}</a><figcaption>${L(p.caption)}</figcaption>${p.credit ? `<small class="credit">${L(p.credit)}</small>` : ""}${i === 0 ? `<a class="award-link" href="${s.awardHref}" target="_blank" rel="noopener" aria-label="${esc(L(s.award))}">${img("award.webp", L(s.award), "award", "trophy")}</a>` : ""}</figure>`).join("")}</div>
    </div>
    <p class="note">${ic("shield")}<span>${L(s.entity)}</span></p>`);
  };

  // Slide 03: các nhóm ưu đãi khác (đếm theo ưu đãi đang chạy), bấm ô thì sang slide Ưu đãi khác với bộ lọc tương ứng
  const otherPromos = () => {
    const s = S["nam-dong"], live = xpLive();
    const groups = [
      ["small", "coins", s.otherSmall, live.filter((x) => x.p.group === "small")],
      ["marketing", "trophy", s.otherMkt, live.filter((x) => x.p.group === "marketing" && x.p.share !== "private")],
      ["private", "users", s.otherPriv, live.filter((x) => x.p.share === "private")],
    ].filter((g) => g[3].length);
    if (!groups.length) return "";
    return `<div class="otherp" data-step="5"><p class="otherp-h">${L(s.otherTitle)}</p><div class="otherp-row">${groups.map(([k, icon, label, items]) =>
      `<a class="otherp-card${k === "private" ? " otherp-card--private" : ""}" href="#km-khac" data-act="xp-jump" data-v="${k}"><span class="otherp-top">${ic(icon)}<b>${L(label)}</b><em>${items.length}</em></span>
        <small>${items.slice(0, 3).map((x) => L(x.p.name)).join(", ")}${items.length > 3 ? "…" : ""}</small></a>`).join("")}</div></div>`;
  };

  R["nam-dong"] = () => {
    const s = S["nam-dong"], pts = [[50, 16.7], [83.3, 50], [83.3, 83.3], [16.7, 83.3], [16.7, 50]];
    const cards = s.streams.map((st, i) => {
      const tgt = L(st.link), link = visible().includes(tgt) ? `<a href="#${tgt}" data-go="${tgt}">${L(D.ui.see)}: ${L(S[tgt].label)} →</a>` : "";
      return `<div class="stream stream--${i + 1}${st.base ? " is-base" : ""}${st.client ? " is-client" : ""}" data-step="${i}">
        <button class="stream-btn" type="button" data-act="stream" aria-expanded="false">
          <span class="stream-top"><span class="stream-ic">${ic(st.icon)}</span><em class="stream-who">${L(st.who)}</em></span><b class="stream-val">${L(st.value)}</b><span class="stream-lbl">${i + 1}. ${L(st.label)}</span>
        </button>
        <div class="stream-more" hidden><p>${L(st.detail)}</p>${link}</div>
      </div>`;
    }).join("");
    return sec("nam-dong", `<div class="radial">
      <svg class="radial-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${pts.map(([x, y], i) => `<line x1="50" y1="50" x2="${x}" y2="${y}" data-step="${i}"/>`).join("")}</svg>
      <div class="radial-core">${ic("user")}<b>${L(s.core)}</b></div>${cards}
    </div>
    <p class="legend legend--end"><span><i class="sw sw--navy"></i>${L(s.legendBase)}</span><span><i class="sw sw--outline"></i>${L(s.legendAdd)}</span><span><i class="sw sw--dashed"></i>${L(s.legendClient)}</span></p>${otherPromos()}`, "mesh mesh--light");
  };

  R["tai-khoan"] = () => {
    const s = S["tai-khoan"], c = s.cols, u = `<small>${L(s.unit)}</small>`;
    const rows = D.accounts.map((a) => `<tr class="${a.q4 ? "is-q4" : ""}">
      <th scope="row">${a.name}${a.q4 ? '<span class="badge badge--lime badge--sm">Q4 ↑</span>' : ""}</th>
      <td data-label="${esc(L(c.fx))}"><span><b>${num(a.fx)}</b>${a.fxQ4 ? `<small>Q4: ${L(a.fxQ4)}</small>` : ""}</span></td>
      <td data-label="${esc(L(c.gold))}"><span><b>${num(a.gold)}</b>${a.goldQ4 ? `<small>Q4: ${L(a.goldQ4)}</small>` : ""}</span></td>
      <td class="cost" data-label="${esc(L(c.costFx))}"><span>~${num(a.costFx)}</span></td>
      <td class="cost" data-label="${esc(L(c.costGold))}"><span>~${num(a.costGold)}</span></td>
      <td data-label="${esc(L(c.fit))}"><span class="fit"><span class="fit-ic">${a.fit.map((f) => ic(f)).join("")}</span><span>${L(a.fitText)}</span></span></td>
    </tr>`).join("");
    return sec("tai-khoan", `<div class="acc">
      <div class="acc-main">
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th scope="col">${L(c.account)}</th><th scope="col">${L(c.fx)}${u}</th><th scope="col">${L(c.gold)}${u}</th><th scope="col">${L(c.costFx)}${u}</th><th scope="col">${L(c.costGold)}${u}</th><th scope="col">${L(c.fit)}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>
      <div class="acc-side">
        <div class="callout"><p class="callout-h">${ic("headset")}${L(s.adviceTitle)}</p><p>${L(s.advice)}</p></div>
        <div class="card pairs-card">
          <div class="pairs-head"><h3>${L(s.barsTitle)} <small>(${L(s.unit)})</small></h3>${segBtns("metal", [["fx", L(s.metalFx)], ["gold", L(s.metalGold)]], state.metal, L(s.barsTitle))}</div>
          <p class="legend"><span><i class="sw sw--blue"></i>${L(s.barRebate)}</span><span><i class="sw sw--muted"></i>${L(s.barCost)}</span></p>
          <div id="pairs">${pairs()}</div>
        </div>
        ${fold(s.costFold, `<p class="insight">${L(s.insight)}</p><p class="fine">${L(s.footnote)}</p>`)}
      </div>
    </div>`, "sec--soft");
  };

  R["ecn-q4"] = () => {
    const s = S["ecn-q4"], c = s.cols, E = D.ecn, u = `<small>${L(s.unit)}</small>`, qi = C.ecnTier(E.tiers, state.ecn.deposit);
    const range = (t) => (t.max ? `${num(t.min)} – ${num(t.max)}` : `≥ ${num(t.min)}`);
    const rate = (b, up) => `<span><b>${num(C.ecnRate(b, up), 1)}</b><small>= ${b} × (1 + ${up}%)</small></span>`;
    const rows = E.tiers.map((t, i) => `<tr data-tier="${i}"${i === qi ? ' class="is-on"' : ""}>
      <th scope="row">${range(t)} <small>USD</small></th>
      <td data-label="${esc(L(c.fx))}">${rate(E.base.fx, t.fxUp)}</td>
      <td data-label="${esc(L(c.gold))}">${rate(E.base.gold, t.goldUp)}</td>
      <td class="cost" data-label="${esc(L(c.oil))}"><span>${num(E.oil, 1)}</span></td>
      <td class="cost" data-label="${esc(L(c.index))}"><span>${num(E.index, 1)}</span></td>
    </tr>`).join("");
    return sec("ecn-q4", `<p class="dates">${ic("calendar")}${L(s.dates)}</p>
    <div class="ecn">
      <div class="ecn-main">
        <div class="table-wrap"><table class="tbl tbl--ecn">
          <thead><tr><th scope="col">${L(c.deposit)}</th><th scope="col">${L(c.fx)}${u}</th><th scope="col">${L(c.gold)}${u}</th><th scope="col">${L(c.oil)}${u}</th><th scope="col">${L(c.index)}${u}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <p class="fine">${L(s.formulaNote)} ${L(s.below)}</p>
        ${fold(s.eligTitle, `<ul class="elig">${s.elig.map((x) => `<li>${ic("check")}<span>${L(x)}</span></li>`).join("")}</ul>`, "users")}
        <p class="warn">${ic("alert")}<span>${L(s.transfer)}</span></p>
      </div>
      <aside class="card--navy q4 mesh">
        <p class="eyebrow eyebrow--sky">${L(s.label)}</p>
        <div class="stairs" id="q4stairs">${q4stairs()}</div>
        <p class="stairs-note">${L(s.stairsNote)}</p>
        <ul class="ticks">${s.ticks.map((t) => `<li>${ic("check")}${L(t)}</li>`).join("")}</ul>
        <a class="q4-example" href="#ecn-calc" data-go="ecn-calc">${ic("arrow")}<span>${L(s.example)}<small>${L(s.toCalc)} →</small></span></a>
      </aside>
    </div>`);
  };

  R["ecn-calc"] = () => {
    const s = S["ecn-calc"], e = D.ecn.example, x = C.ecnMonth(e, D.ecn), p = s.ndParts.map((v) => L(v));
    const ex = [usd(e.deposit), num(e.lotsFx), num(e.lotsGold),
      `${num(e.lotsFx)} × 2 = ${num(x.baseFx)}`, `${num(e.lotsGold)} × 2 = ${num(x.baseGold)}`,
      `${num(x.baseFx)} × ${x.fxUp}% + ${num(x.baseGold)} × ${x.goldUp}% = ${num(x.add)}`, usd(x.total)];
    const field = (k, step) => `<label class="field"><span>${L(s.inputs[k])}</span><input type="number" min="0" step="${step}" data-ecn="${k}" value="${state.ecn[k]}" inputmode="numeric"></label>`;
    return sec("ecn-calc", `<details class="steps-fold">${foldSum(s.foldBtn, "chart")}
    <ol class="steps3">
      <li class="step"><span class="step-n">1</span><div><h3>${L(s.step1)}</h3>
        <div class="eq eq--nd"><span class="blk blk--in">${p[0]}</span><i>+</i><span class="blk blk--in">${p[1]}</span><i>−</i><span class="blk blk--out">${p[2]}</span><i>−</i><span class="blk blk--reb">${p[3]}</span><i>=</i><span class="blk blk--net">${p[4]}</span></div></div></li>
      <li class="step"><span class="step-n">2</span><div><h3>${L(s.step2)}</h3><p id="ecn-step2">${ecnStep2()}</p></div></li>
      <li class="step"><span class="step-n">3</span><div><h3>${L(s.step3)}</h3><p class="formula">${L(s.formula)}</p></div></li>
    </ol></details>
    <div class="ecn-calc">
      <div class="ecn-ex">
        <h3>${L(s.exampleTitle)}</h3>
        <table class="tbl tbl--kv"><tbody>${ex.map((v, i) => `<tr${i === 6 ? ' class="is-total"' : ""}><th scope="row">${L(s.exCols[i])}</th><td>${v}</td></tr>`).join("")}</tbody></table>
        ${fold(s.settleTitle, `<ul class="elig">${s.settle.map((v) => `<li>${ic("check")}<span>${L(v)}</span></li>`).join("")}</ul>`, "coins")}
        <p class="fine">${L(s.source)}</p>
      </div>
      <form class="card calc" onsubmit="return false"><h3>${L(s.calcTitle)}</h3>
        <p class="fine">${L(s.defaultNote)}</p>
        ${field("deposit", 10000)}${field("lotsFx", 50)}${field("lotsGold", 50)}
        <div id="ecn-out" class="ecn-out" aria-live="polite">${ecnOut()}</div>
        <button type="button" class="btn btn--ghost" data-act="reset-ecn">${L(s.reset)}</button>
      </form>
    </div>`, "sec--soft");
  };

  R["lich-tien"] = () => {
    const s = S["lich-tien"], needApply = state.pay.on.bonus || state.pay.on.gift;
    const chips = PAY_ADDONS.map((k) => `<button type="button" class="chip-toggle" data-act="pay-addon" data-v="${k}" aria-pressed="${!!state.pay.on[k]}">${ic(payMeta(k).icon)}<span>${L(payMeta(k).name)}</span></button>`).join("");
    return sec("lich-tien", `<p class="lead">${L(s.lead)}</p><div class="pay">
      <div class="pay-main card">
        <div class="pay-inputs">
          <label class="field"><span>${L(s.tradeDate)}</span><input type="date" data-pay="trade" value="${state.pay.trade}"></label>
          ${needApply ? `<label class="field"><span>${L(s.applyDate)}</span><input type="date" data-pay="apply" value="${state.pay.apply || paySchedule().recommendedApply}"></label>` : ""}
        </div>
        <p class="pay-sub"><b>${L(s.addonsTitle)}</b><small>${L(s.addonsHint)}</small></p>
        <div class="pay-chips">${chips}</div>
        <div class="table-wrap" id="pay-table">${payTable()}</div>
        <p class="note">${ic("alert")}<span>${L(s.holidays)}</span></p>
        <p class="fine">${L(s.t1note)}</p>
      </div>
      <div class="pay-side">
        <div class="cal-card"><div id="cal">${calendar()}</div><ul class="cal-legend" id="cal-legend">${calLegend()}</ul></div>
      </div>
    </div>`);
  };

  R.m1 = () => {
    const s = S.m1;
    const subs = s.subs.map((b, i) => `<div class="sub${b.out ? " is-out" : ""}">
      <div class="node node--sub">${ic("user")}<b>${L(s.subLabel)} ${i + 1}</b>${b.out ? "" : ic("check", "ok")}<small>${L(b.out ? s.subOut : s.subValid)}</small></div>
      <div class="people">${Array.from({ length: b.n }, (_, k) => ic("user", k < b.active ? "on" : "")).join("")}</div></div>`).join("");
    return sec("m1", `<div class="net">
      <div class="tree">
        <div class="tree-frame"><span>${L(s.frame)}</span></div>
        <div class="node node--mib">${ic("building")}<b>MIB</b></div>
        <div class="tree-subs">${subs}</div>
      </div>
      <ol class="rules">${s.rules.map((r) => `<li>${L(r)}</li>`).join("")}</ol>
    </div>`, "sec--soft");
  };

  R.m2 = () => {
    const s = S.m2, kind = promoKind();
    const sw = state.aud === "mib" ? `<div class="promo-switch"><span class="addons-l">${L(s.switchLabel)}</span>${segBtns("promo", [["mib", L(s.promoMib)], ["ib", L(s.promoIb)]], kind, L(s.switchLabel))}</div>` : "";
    const edit = `<div class="tier-bar"><button type="button" class="btn btn--ghost btn--sm" data-act="tiers-edit" aria-expanded="${state.tierEdit}">${ic("edit")}<span>${L(state.tierEdit ? s.editClose : s.edit)}</span></button>${isCustomTiers(kind) ? `<span class="badge badge--sm badge--custom">${L(s.custom)}</span>` : ""}</div>`;
    return sec("m2", `${sw}<div id="promo-body">${promoBody(kind)}</div>${edit}${state.tierEdit ? tierEditor(kind) : ""}`, "sec--soft", promoTitle(kind));
  };

  R.m3 = () => {
    const s = S.m3, p = s.netParts.map(L);
    return sec("m3", `<div class="rules3">
      <div class="card"><h3>${L(s.office)}</h3><ul class="thumbs">${s.officeItems.map((o) => `<li><span class="thumb">${ic(o.icon)}${ic("check", "ok")}</span>${L(o.label)}</li>`).join("")}</ul></div>
      <div class="card"><h3>${L(s.sub)}</h3><div class="subq">${ic("user", "subq-ic")}<div class="dots"><i class="on"></i><i class="on"></i><i></i></div></div><p>${L(s.subRule)}</p></div>
      <div class="card"><h3>${L(s.net)}</h3><div class="eq"><span class="blk blk--in">${p[0]}</span><i>−</i><span class="blk blk--out">${p[1]}</span><i>−</i><span class="blk blk--reb">${p[2]}</span><i>=</i><span class="blk blk--net">${p[3]}</span></div><p class="fine">${L(s.netNote)}</p></div>
    </div>
    <ol class="flow">${s.steps.map((st, i) => `<li><span class="flow-n">${i + 1}</span>${L(st)}</li>`).join("")}</ol>`, "sec--soft");
  };

  R.m4 = () => {
    const s = S.m4, last = D.swapTiers.length - 1;
    return sec("m4", `<div class="swap">
      <figure class="night" role="img" aria-label="${esc(L(s.art))}">${night()}</figure>
      <div class="swap-main">
        <div class="swap-chips"><span class="chip">${ic("calendar")}${L(s.weekly)}</span><span class="chip">${ic("moon")}${L(s.monthlyChip)}</span></div>
        <div class="stairs stairs--swap">${D.swapTiers.map((t, i) => `<div class="stair${i === last ? " is-top" : ""}" style="--h:${45 + i * 27}%">
          <div class="stair-val"><b>${t.pct}%</b><small>${L(s.monthly)}</small></div><div class="stair-bar"></div>
          <div class="stair-x"><span>${fill(L(s.ibLine), { v: usd(t.ib) })}</span></div></div>`).join("")}</div>
        <p class="note">${ic("shield")}<span>${L(s.policy)}</span></p>
        ${state.aud === "mib" ? fold(s.treeFold, `<p class="fine">${fill(L(s.treeRule), { t: D.swapTiers.map((x) => num(x.ib * 1.5)).join(" / ") })}</p>`, "users") : ""}
      </div>
    </div>`);
  };

  R.m5 = () => {
    const s = S.m5, c = state.calc, inp = s.inputs;
    const field = (k, attrs) => `<label class="field"><span>${L(inp[k])}</span><input type="number" data-calc="${k}" value="${c[k]}" ${attrs} inputmode="numeric"></label>`;
    return sec("m5", `${fold(s.sampleTitle, `<div class="mini-people">${ic("user").repeat(D.example.subIBs)}</div>
        <ul class="ex-sample">${s.sample.map((x) => `<li>${L(x)}</li>`).join("")}</ul><p class="fine">${L(s.sampleNote)}</p>`, "user")}
    <div class="ex">
      <div class="ex-chart"><div class="addons" id="addons-m5">${addonChips(true)}</div><div id="wf">${waterfall()}</div><p class="legend-txt">${L(s.legend)}</p><div id="calc-out" class="calc-out" aria-live="polite">${calcOut()}</div></div>
      <form class="card calc" onsubmit="return false"><h3>${L(s.calcTitle)}</h3>
        ${field("lotsFx", 'min="0" step="50"')}${field("lotsGold", 'min="0" step="50"')}
        <label class="field"><span>${L(inp.account)}</span><select data-calc="account">${D.accounts.map((a) => `<option${a.name === c.account ? " selected" : ""}>${a.name}</option>`).join("")}</select></label>
        ${field("deposit", 'min="0" step="10000"')}${field("share", 'min="0" max="100" step="5"')}
        <div id="swap-in">${swapInputs()}</div>
        <button type="button" class="btn btn--ghost" data-act="reset">${L(s.reset)}</button>
      </form>
    </div>
    <p class="illus">${ic("alert")}${L(D.ui.illustrative)}</p>`, "sec--soft");
  };

  // Chưa bấm link đăng ký: công cụ so sánh hiện mờ phía sau (không bấm/nhập được), phía trước là khung có 2 nút đăng ký
  const cmpLocked = (body) => {
    const u = D.ui.reg;
    return `<div class="cmp-lock">
      <div class="cmp-gate" data-gate="1" role="region" aria-labelledby="gate-h"><div class="cmp-gate-card">
        <span class="cmp-gate-ic">${ic("lock")}</span><h3 id="gate-h">${L(u.gateTitle)}</h3><p>${L(u.gateText)}</p>${registerPair("btn--lg")}
      </div></div>
      <div class="cmp-lock-preview" inert aria-hidden="true">${body}</div>
    </div>`;
  };

  R["so-sanh"] = () => {
    const s = S["so-sanh"], inp = S.m5.inputs, c = state.calc;
    const field = (k, attrs) => `<label class="field"><span>${L(inp[k])}</span><input type="number" data-calc="${k}" value="${c[k]}" ${attrs} inputmode="numeric"></label>`;
    const views = `<div class="cmp-views">${segBtns("cmpview", [["rank", L(s.viewRank)], ["h2h", L(s.viewH2h)]], state.cmpView, L(s.viewLabel))}</div>`;
    const notes = fold(s.notesFold, [L(s.noSwap), fill(L(s.pointsNote), { r: lot(ptsLot()) }), L(s.notCounted), L(s.source)].map((t) => `<p class="fine">${t}</p>`).join(""));
    const illus = `<p class="illus">${ic("alert")}${L(D.ui.illustrative)}</p>`;
    const body = state.cmpView === "h2h" ? `${views}${h2hView()}${notes}` : `<div class="cmp">
      <div class="cmp-main">
        ${views}
        <div class="cmp-head">${segBtns("cmp", [["std", L(s.std)], ["raw", L(s.raw)]], state.cmp, L(s.clsLabel))}
          <p class="legend"><span><i class="sw sw--blue"></i>${L(s.legendKeep)}</span><span><i class="sw sw--lime"></i>${L(s.legendPromo)}</span><span><i class="sw sw--ecn"></i>${L(s.legendEcn)}</span></p></div>
        <div class="addons" id="addons-cmp">${addonChips(false)}</div>
        <p class="counting" id="counting">${counting()}</p>
        <div id="cmp" class="cmp-list" aria-live="polite">${compareChart()}</div>
        <p class="note">${ic("trophy")}<span>${L(s.only)}</span></p>
        ${notes}
      </div>
      <form class="card calc" onsubmit="return false"><h3>${L(S.m5.calcTitle)}</h3>
        ${field("lotsFx", 'min="0" step="50"')}${field("lotsGold", 'min="0" step="50"')}${field("deposit", 'min="0" step="10000"')}${field("share", 'min="0" max="100" step="5"')}
        <p class="fine">${L(s.sync)}</p>
        <button type="button" class="btn btn--ghost" data-act="reset">${L(S.m5.reset)}</button>
      </form>
    </div>`;
    return sec("so-sanh", `${state.reg ? body : cmpLocked(body)}${illus}`, "sec--soft");
  };

  R.ib = () => {
    const s = S.ib;
    return `<section id="ib" class="sec" aria-labelledby="h-ib"><div class="wrap">
      <div class="ib-strip">${img("ib-strip.webp", L(s.photo), "ib-img")}<div class="ib-shade"></div>${head("ib")}</div>
      <div class="ib-cards">${s.cards.map((c) => `<div class="ib-card${c.key ? " is-key" : ""}">${ic(c.icon)}<b>${L(c.num)}</b><span>${L(c.label)}</span></div>`).join("")}</div>
      <p class="fine">${L(s.details)}</p>
      ${state.aud === "mib" ? `<p class="note">${ic("alert")}<span>${L(s.mibNote)}</span></p>` : ""}
      ${risk()}
    </div></section>`;
  };

  // ---------- slide Ưu đãi cho khách ----------
  const clientRes = () => C.clientBack(state.client, D.points, D.clientCashback.tiers);
  const cbStairs = () => {
    const s = S["uu-dai"], tiers = D.clientCashback.tiers, on = clientRes().tier, last = tiers.length - 1;
    return tiers.map((t, i) => `<div class="stair${i === last ? " is-top" : ""}${i === on ? " is-on" : ""}" style="--h:${30 + (t.total / tiers[last].total) * 70}%">
      <div class="stair-val"><b>${usd(t.total)}</b></div><div class="stair-bar"></div>
      <div class="stair-x"><span>${fill(L(s.cbStair), { d: usd(t.deposit), l: num(t.lots) })}</span></div></div>`).join("");
  };
  const clientOut = () => {
    const s = S["uu-dai"], r = clientRes(), edge = D.accounts.find((a) => a.q4) || D.accounts[0];
    const next = r.next ? fill(L(s.outNext), { t: r.tier + 2, u: usd(r.next.total - r.cashback), d: usd(r.needDeposit), l: num(r.needLots) }) : L(s.outMax);
    return `<p class="ecn-row"><span>${r.tier < 0 ? L(s.outCbNone) : fill(L(s.outCb), { t: r.tier + 1 })}</span><b>${usd(r.cashback)}</b></p>
      <p class="ecn-row ecn-row--add"><span>${fill(L(s.outPts), { p: num(r.pts) })}</span><b>+${usd(r.ptsUsd)}</b></p>
      <p class="total"><span>${L(s.outTotal)}</span><b>${usd(r.total)}</b></p>
      <p class="ecn-up">${ic("arrow")} ${fill(L(s.outPerLot), { r: lot(r.perLot) })} · ${fill(L(s.outEdge), { c: num(edge.costFx), n: lot(Math.max(0, edge.costFx - r.perLot)) })}</p>
      <p class="fine">${next}</p>`;
  };
  R["uu-dai"] = () => {
    const s = S["uu-dai"], ref = ptsRef(), li = (arr) => `<ul class="elig">${arr.map((v) => `<li>${ic("check")}<span>${L(v)}</span></li>`).join("")}</ul>`;
    const field = (k, step) => `<label class="field"><span>${L(s.inputs[k])}</span><input type="number" min="0" step="${step}" data-client="${k}" value="${state.client[k]}" inputmode="numeric"></label>`;
    return sec("uu-dai", `<p class="lead">${L(s.lead)}</p>
    <div class="offers">
      <div class="offers-main">
        <article class="card offer">
          <h3 class="offer-h">${ic("coins")}TMGM Points<span class="badge badge--lime badge--sm">${L(s.ptsBadge)}</span></h3>
          <p class="offer-big"><b>${L(s.ptsBig)}</b><span>${fill(L(s.ptsRate), { r: lot(ptsLot()), p: num(ref.pts), u: num(ref.usd) })}</span></p>
          <ul class="pts-cat">${D.points.cashback.map((c) => `<li${c === ref ? ' class="is-ref"' : ""}><b>${usd(c.usd)}</b><small>${num(c.pts)} ${L(s.ptsUnit)}</small></li>`).join("")}</ul>
          ${li(s.ptsRules)}
        </article>
        <article class="card offer offer--split">
          <h3 class="offer-h">${ic("gift")}${L(s.cbTitle)}<span class="badge badge--lime badge--sm">${L(s.cbBadge)}</span></h3>
          <p class="fine">${L(s.cbPeriod)}</p>
          <div class="stairs stairs--swap stairs--cb" id="cb-stairs">${cbStairs()}</div>
          ${li(s.cbRules)}
          <p class="warn warn--sm">${ic("alert")}<span>${L(s.cbAsk)}</span></p>
        </article>
      </div>
      <form class="card calc" onsubmit="return false"><h3>${L(s.calcTitle)}</h3>
        ${field("deposit", 1000)}${field("lots", 10)}
        <div id="cb-out" class="ecn-out" aria-live="polite">${clientOut()}</div>
        <p class="fine">${L(s.calcNote)}</p>
        <button type="button" class="btn btn--ghost" data-act="reset-client">${L(s.reset)}</button>
      </form>
    </div>
    ${visible().includes("km-khac") ? `<p class="more-link"><a href="#km-khac" data-go="km-khac">${L(s.moreLink)} →</a></p>` : ""}
    <p class="fine">${L(s.source)}</p>`, "mesh mesh--light");
  };

  // ---------- slide Ưu đãi khác: ưu đãi nhỏ + marketing, mỗi mục một dòng gập ----------
  const dshort = (iso) => new Intl.DateTimeFormat(loc(), { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const xpLive = () => D.extraPromos.map((p) => ({ p, st: Dt.promoStatus(p, isoOf(now())) })).filter((x) => x.st.state !== "ended");
  const xpShown = (f) => xpLive().filter(({ p }) => (f === "all" || p.group === f) && (state.extra.showPrivate || p.share !== "private"));
  const xpDue = (p, st, s) => {
    if (st.state === "upcoming") return `<em class="xp-tag">${fill(L(s.from), { d: dshort(p.from) })}</em>`;
    const txt = st.daysLeft === 0 ? L(s.lastDay) : st.level === "ok" ? fill(L(s.until), { d: dshort(p.until) }) : fill(L(s.left), { n: st.daysLeft });
    return `<em class="xp-tag xp-tag--${st.level}">${txt}</em>`;
  };
  const xpRow = ({ p, st }) => {
    const s = S["km-khac"], priv = p.share === "private";
    const table = p.table ? `<div class="table-wrap"><table class="tbl tbl--xp"><thead><tr>${p.table.cols.map((c) => `<th scope="col">${L(c)}</th>`).join("")}</tr></thead>
      <tbody>${p.table.rows.map(([nd, lots, item, cash]) => `<tr><td>${usd(nd)}</td><td>${num(lots)}</td><td>${esc(item)}</td><td>${usd(cash, 2)}</td></tr>`).join("")}</tbody></table></div>` : "";
    return `<details class="xp${priv ? " xp--private" : ""}" data-xp="${p.key}">
      <summary><span class="xp-ic">${ic(p.icon)}</span><span class="xp-name"><b>${L(p.name)}</b><small>${L(p.value)}</small></span>
        <span class="xp-tags"><em class="xp-tag xp-tag--seg">${L(p.seg)}</em>${priv ? `<em class="xp-tag xp-tag--priv">${L(s.private)}</em>` : ""}${xpDue(p, st, s)}</span></summary>
      <div class="xp-body">${table}<ul class="elig">${p.rules.map((r) => `<li>${ic("check")}<span>${L(r)}</span></li>`).join("")}</ul>
        ${p.note ? `<p class="warn warn--sm">${ic("alert")}<span>${L(p.note)}</span></p>` : ""}
        ${p.url ? `<a class="xp-link" href="${p.url}" target="_blank" rel="noopener">${L(s.link)} ${ic("ext")}</a>` : ""}</div>
    </details>`;
  };
  const xpList = () => {
    const s = S["km-khac"], f = state.extra.filter, items = xpShown(f);
    if (!items.length) return `<p class="fine">${L(s.empty)}</p>`;
    const small = items.filter((x) => x.p.group === "small"), mkt = items.filter((x) => x.p.group === "marketing");
    return `${small.map(xpRow).join("")}${mkt.length && f === "all" ? `<p class="xp-group">${L(s.fMkt)}</p>` : ""}${mkt.map(xpRow).join("")}`;
  };

  R["km-khac"] = () => {
    const s = S["km-khac"], nPriv = xpLive().filter((x) => x.p.share === "private").length;
    const chip = (v, label) => [v, `${L(label)} <small>${xpShown(v).length}</small>`];
    return sec("km-khac", `<p class="lead">${L(s.lead)}</p>
    <div class="xp-bar">${segBtns("xp-filter", [chip("all", s.fAll), chip("small", s.fSmall), chip("marketing", s.fMkt)], state.extra.filter, L(s.filterLabel))}
      ${nPriv ? `<button type="button" class="chip-toggle xp-priv-btn" data-act="xp-private" aria-pressed="${state.extra.showPrivate}">${ic("users")}<span>${fill(L(s.showPrivate), { n: nPriv })}</span></button>` : ""}</div>
    ${state.extra.showPrivate && nPriv ? `<p class="warn warn--sm xp-private-warn">${ic("alert")}<span>${L(s.privateWarn)}</span></p>` : ""}
    <div class="xp-list">${xpList()}</div>
    <p class="fine">${L(s.shared)} ${L(s.source)}</p>`, "sec--soft");
  };

  R["bat-dau"] = () => {
    const s = S["bat-dau"];
    return sec("bat-dau", `<ol class="timeline">${s.timeline.map((t, i) => `<li class="tl${t.key ? " is-key" : ""}" data-step="${i}">
        <span class="tl-dot">${ic(t.icon)}</span><b>${L(t.when)}</b>${t.key ? `<em class="badge badge--lime badge--sm">${L(s.firstPay)}</em>` : ""}<span class="tl-txt">${L(t.what)}</span></li>`).join("")}</ol>
      <div class="close2">
        <div class="cta-card card--navy mesh">
          <div class="contact-me">${img("presenter.webp", P.name, "avatar", "user")}<div><b>${P.name}</b><span>${L(P.title)}</span>${tgLink()}${waLink()}</div></div>
          <div class="qrs">
            <figure>${img("qr-telegram.png", "QR Telegram", "qr", "qr")}<figcaption>Telegram @${P.telegram}</figcaption></figure>
            <figure>${img("qr-whatsapp.png", "QR WhatsApp", "qr", "qr")}<figcaption>WhatsApp ${P.whatsapp}</figcaption></figure>
          </div>
          ${registerPair("btn--lg")}
        </div>
        ${contactForm()}
      </div>`);
  };

  R.faq = () => {
    const s = S.faq;
    const items = s.items.map((it) => {
      const refs = it.refs.filter((r) => visible().includes(r));
      const extra = D.meta.showInternal && it.internal ? L(it.internal) : "";
      const links = refs.length ? `<p class="refs">${L(D.ui.see)}: ${refs.map((r) => `<a href="#${r}" data-go="${r}">${numOf(r)} · ${L(S[r].label)}</a>`).join(" · ")}</p>` : "";
      return `<details><summary>${L(it.q)}</summary><p>${L(it.a)}${extra}</p>${links}</details>`;
    }).join("");
    return sec("faq", `<div class="faq">
      <div class="card--navy upfront mesh"><h3>${ic("shield")}${L(s.upfrontTitle)}</h3><ul>${s.upfront.map((u) => `<li>${L(u)}</li>`).join("")}</ul></div>
      <div class="qa">${items}</div>
    </div>`, "sec--soft");
  };

  // ---------- khung trang ----------
  const banner = () => {
    const until = new Date(`${D.meta.validUntil}T23:59:59`);
    if (!state.banner || now() <= until) return "";
    const d = new Intl.DateTimeFormat(loc(), { day: "2-digit", month: "2-digit", year: "numeric" }).format(until);
    return `<div class="banner" role="status">${ic("alert")}<span>${fill(L(D.ui.expired), { p: L(D.meta.period), d })}</span>
      <button type="button" data-act="banner" aria-label="${esc(L(D.ui.dismiss))}">${ic("x")}</button></div>`;
  };

  // Thanh menu: logo · nút mở danh sách slide · ngôn ngữ · Register · Present. Đổi MIB/IB nằm trong danh sách slide.
  const header = () => {
    const ids = visible(), cur = ids.includes(state.cur) ? state.cur : ids[0];
    const items = ids.map((id) => `<a class="menu-item${id === cur ? " is-cur" : ""}" href="#${id}" data-go="${id}"${id === cur ? ' aria-current="true"' : ""}><b>${id === "faq" ? "Q&A" : String(ids.indexOf(id) + 1).padStart(2, "0")}</b><span>${L(S[id].label)}</span></a>`).join("");
    return `<header class="top"><div class="wrap top-in">
      <a class="brand" href="#bia" data-go="bia">${logo("logo-tmgm.webp", "logo--dark")}<span class="brand-sub">${L(D.ui.brandSub)}</span></a>
      <button type="button" class="menu-btn" data-act="menu" data-menu="1" aria-expanded="${state.menu}" aria-controls="menu-panel"><span class="menu-label">${menuLabel(cur)}</span>${ic("chevron")}</button>
      <div class="top-ctl">
        ${segBtns("lang", LANGS, state.lang, L(D.ui.language))}
        ${registerMenu()}
        <button type="button" class="btn btn--blue btn--sm btn--icon" data-act="present" aria-label="${esc(L(D.ui.present))}" title="${esc(L(D.ui.present))}">${ic("play")}</button>
      </div>
      <nav id="menu-panel" class="menu-panel"${state.menu ? "" : " hidden"} data-menu="1" aria-label="${esc(L(D.ui.menu))}">
        <div class="menu-grid">${items}</div>
        <div class="menu-foot"><span>${L(D.ui.audience)}</span>${segBtns("aud", [["mib", "MIB"], ["ib", "IB"]], state.aud, L(D.ui.audience))}</div>
      </nav>
    </div><div class="top-progress" aria-hidden="true"><i style="width:${Math.round(((ids.indexOf(cur) + 1) / ids.length) * 100)}%"></i></div></header>`;
  };

  const footer = () => `<footer class="foot mesh"><div class="wrap">
    <div class="foot-support"><b>${L(D.ui.supportTitle)}</b><ul>${D.support.map((x) => `<li>${ic(x.icon)}${L(x.label)}</li>`).join("")}</ul></div>
    <div class="foot-row">${logo()}<span class="foot-me">${P.name} · ${L(P.title)} · ${tgLink()} · ${waLink()}</span>${registerPair("btn--sm")}</div>
    <p class="foot-risk">${L(D.ui.risk)}</p>
    <p class="foot-period">${fill(L(D.ui.footerPeriod), { p: L(D.meta.period) })}</p>
  </div></footer>`;

  // Footer của slide: chỉ hiện khi trình bày (trừ bìa)
  // Khi trình bày: không còn thanh footer che nội dung, chỉ một cụm nút nhỏ mờ ở góc phải (rõ lên khi rê chuột)
  const pbar = () => `<div class="pbar">
    <div class="pbar-me">
      <button type="button" data-act="prev" aria-label="${esc(L(D.ui.prev))}">${ic("left")}</button><b id="pcount"></b>
      <button type="button" data-act="next" aria-label="${esc(L(D.ui.next))}">${ic("right")}</button>
      <button type="button" data-act="present" aria-label="Esc">${ic("x")}</button>
    </div>
  </div>
  <div class="notes-panel" id="notes" hidden></div>
  <div class="blank" id="blank" hidden></div>`;

  // ---------- render ----------
  const currentId = () => {
    let cur = visible()[0];
    for (const id of visible()) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= 140) cur = id;
    }
    return cur;
  };

  function render() {
    const keep = !state.first && !state.present ? currentId() : null;
    if (keep) state.cur = keep;
    document.documentElement.lang = state.lang === "zh" ? "zh-Hant" : state.lang;
    document.title = L(D.ui.docTitle);
    app.innerHTML = banner() + header() + `<main>${visible().map((id) => R[id]()).join("")}</main>` + footer() + pbar();
    if (state.first) setupReveal();
    applyPresent(false);
    if (keep && keep !== "bia") document.getElementById(keep).scrollIntoView({ behavior: "instant", block: "start" });
    updateNav();
  }

  // Giữ vị trí focus (bàn phím) khi thay HTML của một vùng
  function keepFocus(fn) {
    const a = document.activeElement, d = a && a.dataset;
    const sel = d && (d.act ? `[data-act="${d.act}"]${d.v ? `[data-v="${d.v}"]` : ""}` : d.contact ? `[data-contact="${d.contact}"]` : null);
    fn();
    const n = sel && $(sel);
    if (n && n.focus) n.focus();
  }
  // Vẽ lại một slide (khi cấu trúc thay đổi: bật add-on, chuyển chương trình, mở bảng sửa bậc...)
  function refresh(id) {
    if (!R[id]) return;
    keepFocus(() => { const el = document.getElementById(id); if (el) el.outerHTML = R[id](); applyPresent(false); });
  }
  const refreshHeader = () => keepFocus(() => { const el = $("header.top"); if (el) el.outerHTML = header(); });
  // Đóng menu: đổi trạng thái ngay, vẽ lại header sau một nhịp để không làm mất liên kết vừa bấm
  const closeMenu = () => { state.menu = false; setTimeout(refreshHeader, 0); };
  const closeRegMenu = (focusBtn) => {
    state.regMenu = false;
    setTimeout(() => { refreshHeader(); if (focusBtn) { const b = $('[data-act="reg-menu"]'); if (b && b.focus) b.focus(); } }, 0);
  };

  // Bấm một link đăng ký bất kỳ (header, bìa, slide cuối, footer, khung khóa) thì mở khóa slide So sánh và nhớ trong trình duyệt.
  // Vẽ lại sau một nhịp để trình duyệt kịp mở link vừa bấm ở tab mới.
  function unlockCompare(fromGate) {
    if (state.reg) return;
    state.reg = true;
    store.set("mib-reg", "1");
    setTimeout(() => {
      refresh("so-sanh");
      const b = fromGate && $('[data-act="cmpview"][aria-pressed="true"]');
      if (b && b.focus) b.focus();
    }, 0);
    toast(L(D.ui.reg.unlocked));
  }

  function setupReveal() {
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll("main .sec .wrap > *").forEach((el) => { el.classList.add("rv"); io.observe(el); });
  }

  function updateNav() {
    if (state.present) return;
    const id = currentId();
    if (id === state.cur) return;
    state.cur = id;
    document.querySelectorAll(".menu-item").forEach((a) => {
      const on = a.dataset.go === id;
      a.classList.toggle("is-cur", on);
      if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
    const lab = $(".menu-label"), bar = $(".top-progress i"), ids = visible();
    if (lab) lab.textContent = menuLabel(id);
    if (bar) bar.style.width = `${Math.round(((ids.indexOf(id) + 1) / ids.length) * 100)}%`;
  }

  // ---------- chế độ trình bày ----------
  const stepCount = (i) => new Set([...document.getElementById(visible()[i]).querySelectorAll("[data-step]")].map((e) => e.dataset.step)).size;

  function applyPresent(sectionChanged) {
    const html = document.documentElement, ids = visible();
    html.classList.toggle("present", state.present);
    state.idx = Math.max(0, Math.min(state.idx, ids.length - 1));
    document.querySelectorAll("main > section").forEach((el, i) => el.classList.toggle("is-active", i === state.idx));
    if (!state.present) {
      html.classList.remove("on-cover");
      document.querySelectorAll(".step-hidden").forEach((e) => e.classList.remove("step-hidden"));
      $("#notes").hidden = true;
      $("#blank").hidden = true;
      return;
    }
    const id = ids[state.idx], el = document.getElementById(id);
    el.querySelectorAll("[data-step]").forEach((e) => e.classList.toggle("step-hidden", +e.dataset.step >= state.step));
    if (sectionChanged) el.scrollTop = 0;
    html.classList.toggle("on-cover", id === "bia");
    $("#pcount").textContent = id === "faq" ? "Q&A" : `${numOf(id)} / ${String(mainCount()).padStart(2, "0")}`;
    try { history.replaceState(null, "", "#" + id); } catch (e) { /* file:// có thể chặn */ }
    renderNotes();
  }

  function go(i, step = 0) {
    if (i < 0 || i >= visible().length) return;
    state.idx = i;
    state.step = step;
    applyPresent(true);
  }
  function next() {
    if (state.step < stepCount(state.idx)) { state.step++; applyPresent(false); }
    else go(state.idx + 1);
  }
  function prev() {
    if (state.step > 0 && stepCount(state.idx) > 0) { state.step--; applyPresent(false); }
    else if (state.idx > 0) go(state.idx - 1, stepCount(state.idx - 1));
  }

  function togglePresent(on = !state.present) {
    if (on === state.present) return;
    if (on) {
      state.idx = Math.max(0, visible().indexOf(currentId()));
      state.step = 0;
      state.started = state.started || Date.now();
      state.menu = false;
      state.present = true;
      applyPresent(true);
    } else {
      const id = visible()[state.idx];
      state.present = false;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      applyPresent(false);
      document.getElementById(id).scrollIntoView({ behavior: "instant", block: "start" });
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* bỏ qua */ }
    }
  }

  function renderNotes() {
    const el = $("#notes");
    el.hidden = !(state.present && state.notes);
    if (el.hidden) return;
    const id = visible()[state.idx], part = D.parts[S[id].part];
    el.innerHTML = `<div class="notes-head"><b>${L(D.ui.notes)}</b><span>${L(part.label)} · ${L(D.ui.budget)} ${part.min} ${L(D.ui.minutes)}</span><span id="timer"></span></div>
      <div class="notes-body">${L(S[id].notes)}</div><p class="notes-keys">${L(D.ui.keys)}</p>`;
    tick();
  }
  function tick() {
    const t = $("#timer");
    if (!t || !state.started) return;
    const s = Math.floor((Date.now() - state.started) / 1000);
    t.textContent = `${L(D.ui.elapsed)} ${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }
  setInterval(tick, 1000);

  // ---------- hành động ----------
  function setLang(v) { state.lang = v; store.set("mib-lang", v); render(); }
  function setAud(v) {
    const id = visible()[state.idx];
    state.aud = v;
    store.set("mib-aud", v);
    state.idx = Math.max(0, visible().indexOf(id));
    state.menu = false;
    render();
  }

  // Cập nhật tại chỗ các vùng phụ thuộc máy tính (không đụng vào ô đang nhập)
  function updateCalc() {
    if ($("#wf")) { $("#wf").innerHTML = waterfall(); $("#calc-out").innerHTML = calcOut(); }
    if ($("#cmp")) { $("#cmp").innerHTML = compareChart(); $("#counting").innerHTML = counting(); }
    if ($("#h2h-diff")) updateH2h();
  }
  function updateH2h() {
    const x = h2hRes();
    $("#h2h-us").innerHTML = h2hUsOut(x);
    $("#h2h-them").innerHTML = h2hThemOut(x);
    $("#h2h-diff").innerHTML = h2hDiff(x);
  }
  function updateAddons() {
    keepFocus(() => {
      if ($("#addons-m5")) $("#addons-m5").innerHTML = addonChips(true);
      if ($("#addons-cmp")) $("#addons-cmp").innerHTML = addonChips(false);
      if ($("#swap-in")) $("#swap-in").innerHTML = swapInputs();
    });
    updateCalc();
  }
  function updateEcn() {
    const qi = C.ecnTier(D.ecn.tiers, state.ecn.deposit);
    $("#ecn-out").innerHTML = ecnOut();
    $("#ecn-step2").innerHTML = ecnStep2();
    $("#q4stairs").innerHTML = q4stairs();
    document.querySelectorAll("[data-tier]").forEach((r) => r.classList.toggle("is-on", +r.dataset.tier === qi));
  }
  function updateClient() {
    $("#cb-out").innerHTML = clientOut();
    $("#cb-stairs").innerHTML = cbStairs();
  }
  function updatePay() {
    state.pay.calMonth = null;
    $("#pay-table").innerHTML = payTable();
    $("#cal").innerHTML = calendar();
    $("#cal-legend").innerHTML = calLegend();
  }
  function updateTierViews() {
    const kind = promoKind();
    $("#promo-body").innerHTML = promoBody(kind);
    if ($("#tier-warn")) $("#tier-warn").innerHTML = tierWarnHtml(kind);
    const h = $("#h-m2");
    if (h) h.textContent = promoTitle(kind);
    updateCalc();
  }
  const saveTiers = () => store.set("mib-tiers", JSON.stringify(state.tiers));
  function setTiers(kind, rows) {
    state.tiers[kind] = rows.length ? rows : defaultTiers()[kind];
    saveTiers();
  }
  function tierAction(act, v) {
    const kind = promoKind(), key = TIER_KEY[kind], rows = state.tiers[kind];
    if (act === "tier-add") {
      if (rows.length >= 12) return;
      const last = rows[rows.length - 1];
      setTiers(kind, C.cleanTiers([...rows, { deposit: Math.round(last.deposit * 1.5), lots: Math.round(last.lots * 1.5), [key]: Math.round(last[key] * 1.3) }], key).rows);
    } else if (act === "tier-del") {
      const i = +v.split(":")[1];
      if (rows.length > 1) setTiers(kind, rows.filter((_, k) => k !== i));
    } else if (act === "tier-reset") {
      setTiers(kind, defaultTiers()[kind]);
    }
    refresh("m2");
    updateCalc();
  }

  function setPay(k, v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    try { Dt.addDays(v, 0); } catch (e) { return; } // ngày không có thật (vd 31/02)
    if (k === "trade") { state.pay.trade = v; state.pay.apply = null; } else state.pay.apply = v;
    updatePay();
  }

  function sendContact() {
    const c = state.contact, v = K.validate(c), n = (x) => new Intl.NumberFormat("en-US").format(x);
    c.errors = v.errors;
    if (!v.ok) {
      c.status = "invalid";
      refresh("bat-dau");
      const first = $(`[data-contact="${v.errors.phone ? "phone" : "email"}"]`);
      if (first && first.focus) first.focus();
      return;
    }
    const k = state.calc;
    const context = `Network example: ${n(k.lotsFx)} FX + ${n(k.lotsGold)} gold lots · ${k.account} · net deposit ${n(k.deposit)} · ${k.share}% shared to Sub-IBs`;
    location.href = K.buildMailto({ to: D.meta.contactEmail, lang: state.lang, audience: state.aud }, c, context);
    c.status = "sent";
    refresh("bat-dau");
  }

  // FSC không cho link thẳng tới kết quả tìm kiếm: copy sẵn tên để dán vào ô tìm.
  function copyText(v) {
    const done = () => toast(fill(L(D.ui.copied), { v }));
    const legacy = () => {
      const t = document.createElement("textarea");
      t.value = v;
      t.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(t);
      t.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { /* trình duyệt chặn */ }
      t.remove();
      if (ok) done();
      else toast(fill(L(D.ui.searchFor), { v })); // không copy được: vẫn cho biết cần gõ gì
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(v).then(done, legacy);
    else legacy();
  }
  function toast(msg) {
    let el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("show"), 4000);
  }

  window.addEventListener("beforeprint", () => document.querySelectorAll("details.fold").forEach((d) => (d.open = true)));

  document.addEventListener("click", (e) => {
    const cp = e.target.closest("[data-copy]");
    if (cp) copyText(cp.dataset.copy); // link vẫn mở tab mới như bình thường
    const rg = e.target.closest("[data-reg]");
    if (rg) unlockCompare(!!rg.closest("[data-gate]")); // link vẫn mở tab mới như bình thường
    const a = e.target.closest("[data-act]");
    if (a && a.dataset.act === "menu") { state.menu = !state.menu; state.regMenu = false; refreshHeader(); return; }
    if (a && a.dataset.act === "reg-menu") { state.regMenu = !state.regMenu; state.menu = false; refreshHeader(); return; }
    if (state.menu && !e.target.closest("[data-menu]")) closeMenu(); // bấm ra ngoài
    if (state.regMenu && (rg || !e.target.closest("[data-regmenu]"))) closeRegMenu(); // chọn xong hoặc bấm ra ngoài
    if (a) {
      const v = a.dataset.v;
      switch (a.dataset.act) {
        case "lang": setLang(v); break;
        case "aud": setAud(v); break;
        case "present": togglePresent(); break;
        case "prev": prev(); break;
        case "next": next(); break;
        case "banner": state.banner = false; $(".banner").remove(); break;
        case "metal":
          state.metal = v;
          $("#pairs").innerHTML = pairs();
          document.querySelectorAll('[data-act="metal"]').forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === v));
          break;
        case "xp-filter":
          state.extra.filter = v;
          refresh("km-khac");
          break;
        case "xp-private":
          state.extra.showPrivate = !state.extra.showPrivate;
          refresh("km-khac");
          break;
        case "cmpview":
          state.cmpView = v;
          refresh("so-sanh");
          break;
        case "h2h-ecn":
          state.h2h.us.ecn = !state.h2h.us.ecn;
          refresh("so-sanh");
          break;
        case "h2h-copy":
          Object.assign(state.h2h.them, { lotsFx: state.h2h.us.lotsFx, lotsGold: state.h2h.us.lotsGold, deposit: state.h2h.us.deposit, share: state.h2h.us.share });
          refresh("so-sanh");
          break;
        case "xp-jump":
          state.extra.filter = v === "private" ? "marketing" : v;
          if (v === "private") state.extra.showPrivate = true;
          refresh("km-khac");
          if (state.present) { e.preventDefault(); go(visible().indexOf("km-khac")); }
          break;
        case "cmp":
          state.cmp = v;
          $("#cmp").innerHTML = compareChart();
          document.querySelectorAll('[data-act="cmp"]').forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === v));
          break;
        case "cal": {
          const cur = calFocus();
          let m = cur.m + +v, y = cur.y;
          if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
          state.pay.calMonth = { y, m };
          $("#cal").innerHTML = calendar();
          break;
        }
        case "pay-addon":
          state.pay.on[v] = !state.pay.on[v];
          state.pay.calMonth = null;
          refresh("lich-tien");
          break;
        case "addon":
          if (v === "ecn" && !ecnUsable()) break; // ECN chỉ bật được với Edge và khi Q4 còn hiệu lực
          state.addons[v] = !state.addons[v];
          updateAddons();
          break;
        case "promo": state.promo = v; refresh("m2"); break;
        case "tiers-edit": state.tierEdit = !state.tierEdit; refresh("m2"); break;
        case "tier-add": case "tier-del": case "tier-reset": tierAction(a.dataset.act, v); break;
        case "stream": {
          const open = a.getAttribute("aria-expanded") === "true";
          a.setAttribute("aria-expanded", String(!open));
          a.nextElementSibling.hidden = open;
          break;
        }
        case "reset":
          state.calc = { ...D.example };
          state.addons.ecn = false;
          document.querySelectorAll("[data-calc]").forEach((i) => (i.value = state.calc[i.dataset.calc]));
          updateAddons();
          break;
        case "reset-ecn":
          state.ecn = { ...D.ecn.defaults };
          document.querySelectorAll("[data-ecn]").forEach((i) => (i.value = state.ecn[i.dataset.ecn]));
          updateEcn();
          break;
        case "reset-client":
          state.client = { ...D.clientCashback.defaults };
          document.querySelectorAll("[data-client]").forEach((i) => (i.value = state.client[i.dataset.client]));
          updateClient();
          break;
      }
      return;
    }
    const g = e.target.closest("[data-go]");
    if (g && state.menu) closeMenu(); // chọn một slide trong danh sách
    if (g && state.present) { e.preventDefault(); go(visible().indexOf(g.dataset.go)); }
  });

  // Bấm chuột giữa vào link đăng ký (mở tab nền) cũng tính là đã bấm
  document.addEventListener("auxclick", (e) => {
    const rg = e.button === 1 && e.target.closest("[data-reg]");
    if (rg) unlockCompare(!!rg.closest("[data-gate]"));
  });

  document.addEventListener("input", (e) => {
    const t = e.target, d = t.dataset;
    if (d.calc) {
      const k = d.calc;
      state.calc[k] = k === "account" ? t.value : Math.max(0, +t.value || 0);
      if (k === "share") state.calc.share = Math.min(100, state.calc.share);
      if (k === "account" && !isEdge()) state.addons.ecn = false; // ECN chỉ dành cho Edge
      document.querySelectorAll(`[data-calc="${k}"]`).forEach((i) => { if (i !== t) i.value = state.calc[k]; });
      if (k === "account") updateAddons(); else updateCalc();
    } else if (d.ecn) {
      state.ecn[d.ecn] = Math.max(0, +t.value || 0);
      updateEcn();
    } else if (d.h2h) {
      const [side, k] = d.h2h.split("."), o = state.h2h[side];
      if (k === "name") { o.name = t.value.slice(0, 40); updateH2h(); return; }
      if (k === "account" || k === "broker" || k === "cls") {
        o[k] = t.value;
        if (side === "them") Object.assign(o, h2hRates(o.broker, o.cls)); // đổi sàn/nhóm: rebate về số khảo sát
        refresh("so-sanh");
        return;
      }
      o[k] = ["fx", "gold", "costFx", "costGold"].includes(k) && t.value === "" ? "" : Math.max(0, +t.value || 0);
      if (k === "share") o.share = Math.min(100, o.share);
      updateH2h();
    } else if (d.swap) {
      state.swap[d.swap] = Math.max(0, +t.value || 0);
      updateCalc();
    } else if (d.client) {
      state.client[d.client] = Math.max(0, +t.value || 0);
      updateClient();
    } else if (d.pay) {
      setPay(d.pay, t.value);
    } else if (d.contact) {
      state.contact[d.contact] = t.value;
    } else if (d.tierPreset) {
      if (D.mibTierPresets[t.value]) { setTiers("mib", C.cleanTiers(D.mibTierPresets[t.value], "mib").rows); refresh("m2"); updateCalc(); }
    } else if (d.tier) {
      const [kind, i, f] = d.tier.split(":"), v = Number(t.value), row = state.tiers[kind] && state.tiers[kind][+i];
      if (!row || !Number.isFinite(v) || v <= 0 || t.value === "") return; // giá trị rác: bỏ qua, giữ số cũ
      row[f] = v;
      saveTiers();
      updateTierViews();
    }
  });
  // Rời khỏi ô: sắp lại bậc theo net deposit và bỏ trùng
  document.addEventListener("change", (e) => {
    const d = e.target.dataset;
    if (!d || !d.tier) return;
    const kind = d.tier.split(":")[0];
    setTiers(kind, C.cleanTiers(state.tiers[kind], TIER_KEY[kind]).rows);
    refresh("m2");
    updateCalc();
  });
  document.addEventListener("submit", (e) => {
    if (!(e.target && e.target.dataset && e.target.dataset.form === "contact")) return;
    e.preventDefault();
    sendContact();
  });

  document.addEventListener("keydown", (e) => {
    const t = e.target instanceof Element ? e.target : document.body, k = e.key;
    if (k === "Escape" && state.menu) { closeMenu(); return; }
    if (k === "Escape" && state.regMenu) { closeRegMenu(true); return; }
    if (t.matches("input, select, textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
    if ((k === "Enter" || k === " ") && t.closest("button, a, summary, label")) return;
    if (k === "p" || k === "P") return togglePresent();
    if (k === "l" || k === "L") {
      const ids = LANGS.map((l) => l[0]);
      return setLang(ids[(ids.indexOf(state.lang) + 1) % ids.length]);
    }
    if (!state.present) return;
    if (["ArrowRight", "PageDown", " ", "Enter"].includes(k)) { e.preventDefault(); next(); }
    else if (["ArrowLeft", "PageUp", "Backspace"].includes(k)) { e.preventDefault(); prev(); }
    else if (k === "Home") go(0);
    else if (k === "End") go(visible().length - 1);
    else if (k === "n" || k === "N") { state.notes = !state.notes; renderNotes(); }
    else if (k === "b" || k === "B" || k === ".") $("#blank").hidden = !$("#blank").hidden;
    else if (k === "f" || k === "F") {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (k === "Escape") togglePresent(false);
  });

  let raf = 0;
  addEventListener("scroll", () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; updateNav(); });
  }, { passive: true });

  // In ra PDF: mở hết câu hỏi và chi tiết
  addEventListener("beforeprint", () => {
    document.querySelectorAll("details").forEach((d) => (d.open = true));
    document.querySelectorAll(".stream-more").forEach((d) => (d.hidden = false));
  });

  // ---------- khởi động ----------
  // Đọc #id trước render(): khi trình bày, render() ghi hash của slide đang mở (#bia) đè lên
  const si = visible().indexOf(location.hash.slice(1));
  render();
  state.first = false;
  if (state.present) {
    state.started = Date.now();
    go(Math.max(0, si));
  } else if (si >= 0) {
    document.getElementById(visible()[si]).scrollIntoView({ behavior: "instant", block: "start" });
  }

  // Móc cho test (chỉ bật khi test đặt window.__MIB_TEST__ trước khi nạp app.js)
  if (window.__MIB_TEST__) Object.assign(window.__MIB_TEST__, { state, html: (id) => R[id](), header, visible });
})();
