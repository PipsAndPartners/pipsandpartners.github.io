/*
 * Trang ưu đãi TMGM (index.html): mỗi ưu đãi một slide, có hình minh họa, QR tới trang chương trình.
 * Dữ liệu: window.PROMOS (promos-data.js, có thể bị nút Edit ghi đè khi mở với ?edit); hết hạn (until) thì tự ẩn.
 * - Nút "Sửa slide này" ở mỗi slide mở ngăn sửa bên phải (xem trước trực tiếp); "Thêm slide" tạo ưu đãi mới từ mẫu.
 * - Ngôn ngữ EN / VI / 中文: nút trên thanh đầu, phím L, ?lang=vi|zh
 * - Link thẳng tới một ưu đãi: index.html#rocket
 * - Phím: ← → chuyển trang · Home/End · F toàn màn hình · N lời thoại cho đối tác
 * - Mục "chỉ chia sẻ riêng" nằm trong phần mã hóa (locked.js): nhập mã truy cập mới hiện; không bao giờ in
 */
(function () {
  const D = window.PROMOS, Dt = window.MIBDates, A = window.MIBArt, Q = window.MIBQR, Lk = window.PPLock;
  const EDIT = !!window.MIBEdit; // nút sửa chỉ có khi mở trang với ?edit (edits.js được nạp)
  const S = D.promoPage, X = D.sections["km-khac"];
  const LANGS = [["en", "EN"], ["vi", "VI"], ["zh", "中文"]];
  const LOCALE = { en: "en-US", vi: "vi-VN", zh: "zh-TW" };
  const app = document.getElementById("app");
  const $ = (sel) => document.querySelector(sel);
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* bị chặn: bỏ qua */ } },
  };
  const qs = new URLSearchParams(location.search);
  const pick = (v, ok, dflt) => (ok.includes(v) ? v : dflt);
  const now = () => (D.meta && D.meta.today ? new Date(`${D.meta.today}T12:00:00`) : new Date());
  const pad2 = (n) => String(n).padStart(2, "0");
  const today = () => { const d = now(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };

  const state = {
    lang: pick(qs.get("lang") || store.get("mib-lang"), LANGS.map((l) => l[0]), "en"),
    i: 0, filter: "all", notes: false, present: false,
    unlocked: false, code: "", codeMsg: "",
  };

  // ---------- helpers ----------
  const L = (x) => (x && typeof x === "object" ? x[state.lang] ?? x.en : x ?? "");
  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => (o[k] ?? ""));
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const loc = () => LOCALE[state.lang];
  const num = (n, d = 0) => new Intl.NumberFormat(loc(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  const usd = (n, d = 0) => ({ vi: `${num(n, d)} USD`, zh: `${num(n, d)} 美元` })[state.lang] || `USD ${num(n, d)}`;
  const dshort = (iso) => new Intl.DateTimeFormat(loc(), { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const dlong = (iso) => new Intl.DateTimeFormat(loc(), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const ED = (unit, path) => (window.MIBEdit ? window.MIBEdit.attrs(unit, path) : ""); // nút Edit cho từng số liệu (edits.js)
  const delBtn = (unit) => (EDIT && unit.startsWith("promo:") ? `<button type="button" class="pp-del" data-ed-del="${unit}">${ic("x")}<span>${L(S.deleteSlide)}</span></button>` : "");
  const editBtn = (unit) => !EDIT ? "" : `<button type="button" class="pp-edit" data-ed-open="${unit}">${ic("edit")}<span>${L(S.editPromo)}</span></button>`;
  const pu = (p) => `promo:${p.key}`;
  const ic = (name, cls = "") => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  // Bảng màu theo nhóm: ưu đãi nhỏ (xanh), marketing (lime), chỉ chia sẻ riêng (đỏ)
  const PAL = {
    small: { bg: "#EAF1FD", main: "#1F5FD6", dark: "#0B1F4D", accent: "#8DC63F", soft: "#B9CDF2", warm: "#F08A24" },
    marketing: { bg: "#EEF7E3", main: "#3D7A12", dark: "#0B1F4D", accent: "#F5C542", soft: "#C9E5A3", warm: "#F08A24" },
    followup: { bg: "#EEF1F6", main: "#4A5D7A", dark: "#0B1F4D", accent: "#8DC63F", soft: "#C6D0E0", warm: "#F08A24" },
  };
  const kindOf = (p) => p.group;
  const GROUP_ORDER = { small: 0, marketing: 1, followup: 2 };

  // Ưu đãi đang chạy hoặc sắp bắt đầu, không bị ẩn; xếp theo "order" (nhỏ trước, không có thì ở cuối), rồi nhóm, rồi hạn (sắp hết hạn trước)
  const allPromos = () => [...D.extraPromos, ...(D.privatePromos || [])];
  const live = () => allPromos().map((p) => ({ p, st: Dt.promoStatus(p, today()) }))
    .filter((x) => x.st.state !== "ended" && !x.p.hidden)
    .sort((a, b) => (a.p.order ?? 999) - (b.p.order ?? 999) || GROUP_ORDER[kindOf(a.p)] - GROUP_ORDER[kindOf(b.p)] || a.p.until.localeCompare(b.p.until));
  const shown = () => live();
  const slides = () => [{ type: "cover", key: "cover" }, { type: "index", key: "list" }, ...shown().map((x) => ({ type: "promo", key: x.p.key, ...x })), { type: "contact", key: "contact" }];

  const due = (p, st) => {
    if (st.state === "upcoming") return `<em class="xp-tag"${ED(pu(p), "from")}>${fill(L(X.from), { d: dshort(p.from) })}</em>`;
    if (st.state === "closed") return `<em class="xp-tag xp-tag--closed"${ED(pu(p), "until")}>${fill(L(S.closedTag), { d: dshort(p.until) })}</em>`;
    const txt = st.daysLeft === 0 ? L(X.lastDay) : st.level === "ok" ? fill(L(X.until), { d: dshort(p.until) }) : fill(L(X.left), { n: st.daysLeft });
    return `<em class="xp-tag xp-tag--${st.level}"${ED(pu(p), "until")}>${txt}</em>`;
  };
  const tags = (p, st) => `<span class="pp-tags"><em class="xp-tag xp-tag--seg"${ED(pu(p), "seg")}>${L(p.seg)}</em>${p.share === "private" ? `<em class="xp-tag xp-tag--priv">${L(X.private)}</em>` : ""}${due(p, st)}</span>`;
  const artOf = (p, fill) => (p.image ? `<img class="pp-svg pp-img" src="${esc(p.image)}" alt="${esc(L(p.name))}" loading="lazy">` : A.svg(p.art, PAL[kindOf(p)], L(p.name), fill));

  // ---------- phần riêng theo từng ưu đãi ----------
  const variant = (p) => {
    if (p.quests) return `<div class="pp-quests"><p class="pp-h">${L(S.questsTitle)}</p><div class="pp-quests-row">${p.quests.map((q, i) =>
      `<div class="pp-quest"><b${ED(pu(p), `quests.${i}.pct`)}>${q.pct}%</b><span${ED(pu(p), `quests.${i}.label`)}>${L(q.label)}</span><small${ED(pu(p), `quests.${i}.cap`)}>${fill(L(S.questCap), { v: usd(q.cap) })}</small></div>`).join("")}</div></div>`;
    if (p.example) {
      const dep = p.example.deposit;
      return `<div class="pp-credit"><div class="pp-credit-bar"><span class="pp-credit-dep"${ED(pu(p), "example.deposit")}>${fill(L(S.creditDeposit), { v: usd(dep) })}</span><span class="pp-credit-plus">${fill(L(S.creditPlus), { v: usd(dep / 2) })}</span></div><small>${L(S.creditNote)}</small></div>`;
    }
    if (p.tix) return `<div class="pp-tix"><p class="pp-h">${L(S.tixTitle)}</p><table class="tbl tbl--xp"><thead><tr>${S.tixCols.map((c) => `<th scope="col">${L(c)}</th>`).join("")}</tr></thead>
      <tbody>${p.tix.map((t, i) => `<tr><td${ED(pu(p), `tix.${i}.deposit`)}>${usd(t.deposit)}</td><td${ED(pu(p), `tix.${i}.lots`)}>${num(t.lots)}</td><td${ED(pu(p), `tix.${i}.what`)}>${L(t.what)}</td></tr>`).join("")}</tbody></table></div>`;
    if (p.table) return `<div class="pp-tiers"><p class="pp-h">${L(S.tiersTitle)}</p><ol style="--n:${p.table.rows.length}">${p.table.rows.map(([nd, lots, item, cash], i, all) =>
      `<li class="${i === all.length - 1 ? "is-top" : ""}" style="--h:${40 + (i / (all.length - 1)) * 60}%"><span class="pp-tier-bar"></span><b><span${ED(pu(p), `table.rows.${i}.0`)}>${num(nd / 1000)}k</span> · <span${ED(pu(p), `table.rows.${i}.1`)}>${num(lots)}</span></b><span${ED(pu(p), `table.rows.${i}.2`)}>${esc(item)}</span><small${ED(pu(p), `table.rows.${i}.3`)}>${usd(cash, 2)}</small></li>`).join("")}</ol></div>`;
    if (p.draw) return `<div class="pp-draw"><div class="pp-dots" aria-hidden="true">${Array.from({ length: p.draw }, (_, i) => `<i${i === 7 ? ' class="is-win"' : ""}></i>`).join("")}</div><p${ED(pu(p), "draw")}>${fill(L(S.drawText), { n: p.draw })}</p></div>`;
    return "";
  };

  // Ảnh bảng nguyên bản của TMGM (pics: [{ src, alt }]): bấm để mở ảnh gốc ở tab mới
  const pics = (p) => (p.pics && p.pics.length ? `<div class="pp-pics">${p.pics.map((x, i) =>
    `<a class="pp-pic" href="${esc(x.src)}" target="_blank" rel="noopener"${ED(pu(p), `pics.${i}.src`)}><img src="${esc(x.src)}" alt="${esc(L(x.alt))}"></a>`).join("")}</div>` : "");

  // ---------- slide ----------
  const top = (i, n, unit, extra = "") => `<header class="pp-top"><span class="pp-crumb"><b>TMGM</b> · ${L(S.title)} · ${fill(L(S.slideOf), { i: pad2(i + 1), n: pad2(n) })}</span><span class="pp-top-r">${extra}${editBtn(unit)}${delBtn(unit)}</span></header>`;

  const cover = () => {
    const n = live().filter((x) => x.st.state !== "closed" && x.p.group !== "followup").length;
    return `<div class="pp-cover">
      <div class="pp-cover-text">
        <p class="pp-kicker"${ED("cover", "coverKicker")}>${L(S.coverKicker)}</p>
        <h1 class="pp-title"${ED("cover", "coverTitle")}>${L(S.coverTitle)}</h1>
        <p class="pp-lead"${ED("cover", "coverSub")}>${L(S.coverSub)}</p>
        <p class="pp-meta"><span class="badge badge--lime">${fill(L(S.coverCount), { n })}</span><span>${fill(L(S.updated), { d: dlong(today()) })}</span></p>
        <button type="button" class="btn btn--blue" data-go="list">${L(S.start)} ${ic("right")}</button>
        <span class="pp-cover-edit">${editBtn("cover")}</span>
      </div>
      <figure class="pp-fig pp-fig--cover">${A.svg("gifts", PAL.small, L(S.coverTitle))}</figure>
    </div>`;
  };

  // Ưu đãi chỉ chia sẻ riêng nằm trong locked.js (mã hóa): nhập mã thì hiện thêm
  const codeBox = () => {
    if (!Lk || !window.PP_LOCKED) return "";
    if (state.unlocked) return `<p class="pp-code pp-code--on">${ic("lock")}<span>${L(S.unlocked)}</span><button type="button" class="btn btn--ghost btn--sm" data-act="relock">${L(S.relock)}</button></p>`;
    return `<form class="pp-code" data-form="unlock" onsubmit="return false"><label for="pp-code-in">${ic("lock")}<span>${L(S.codeHint)}</span></label>
      <input id="pp-code-in" type="text" data-code="1" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="PP-XXXX-XXXX-XXXX-XXXX" value="${esc(state.code)}">
      <button type="submit" class="btn btn--blue btn--sm">${L(S.codeBtn)}</button><span class="pp-code-msg" role="alert">${esc(state.codeMsg)}</span></form>`;
  };

  const index = () => {
    const items = shown(), f = state.filter;
    const count = (g) => items.filter((x) => g === "all" || x.p.group === g).length;
    const seg = `<div class="seg" role="group" aria-label="${esc(L(X.filterLabel))}">${[["all", X.fAll], ["small", X.fSmall], ["marketing", X.fMkt], ["followup", X.fFollow]].map(([v, t]) =>
      `<button type="button" data-act="filter" data-v="${v}" aria-pressed="${f === v}">${L(t)} <small>${count(v)}</small></button>`).join("")}</div>`;
    const addCard = !EDIT ? "" : `<button type="button" class="pp-card pp-card--add" data-ed-new="1">${ic("plus")}<span><b>${L(S.addSlide)}</b><small>${L(S.addHint)}</small></span></button>`;
    const cards = items.filter((x) => f === "all" || x.p.group === f).map(({ p, st }) =>
      `<button type="button" class="pp-card pp-card--${kindOf(p)}" data-go="${p.key}"><span class="pp-card-art">${artOf(p, true)}</span>
        <span class="pp-card-txt"><b>${L(p.name)}</b><small>${L(p.headline || p.value)}</small>${tags(p, st)}</span></button>`).join("");
    return `<div class="pp-index"><div class="pp-index-head"><div><h2 class="pp-head pp-head--sm"${ED("cover", "indexTitle")}>${L(S.indexTitle)}</h2><p class="pp-sub"${ED("cover", "indexHint")}>${L(S.indexHint)}</p></div>${seg}</div>
      ${codeBox()}<div class="pp-cards">${cards}${addCard}</div>${cards ? "" : `<p class="fine">${L(S.empty)}</p>`}</div>`;
  };

  const promo = ({ p, st }) => {
    const cta = p.url ? `<a class="pp-open" href="${esc(p.url)}" target="_blank" rel="noopener">${L(S.openPage)} ${ic("ext")}</a>
      <span class="pp-qr">${Q.svg(p.url, { size: 92, label: `${L(S.scan)}: ${p.url}` })}<small>${L(S.scan)}</small></span>` : "";
    const note = p.note && p.noteFor !== "partner" ? `<p class="warn warn--sm pp-note">${ic("alert")}<span${ED(pu(p), "note")}>${L(p.note)}</span></p>` : "";
    return `<div class="pp-body">
      <div class="pp-text">
        <p class="pp-kicker"${ED(pu(p), "name")}>${L(p.name)}</p>
        <h2 class="pp-head"${ED(pu(p), p.headline ? "headline" : "value")}>${L(p.headline || p.value)}</h2>
        ${p.sub ? `<p class="pp-sub"${ED(pu(p), "sub")}>${L(p.sub)}</p>` : ""}
        ${pics(p)}${variant(p)}
        <p class="pp-h">${L(S.howTitle)}</p>
        <ol class="pp-steps">${(p.steps || []).map((t, i) => `<li${ED(pu(p), `steps.${i}`)}>${L(t)}</li>`).join("")}</ol>
        <p class="pp-h">${L(S.keyTitle)}</p>
        <ul class="elig">${p.rules.map((r, i) => `<li>${ic("check")}<span${ED(pu(p), `rules.${i}`)}>${L(r)}</span></li>`).join("")}</ul>
      </div>
      <figure class="pp-fig">${artOf(p)}<figcaption class="pp-cta">${cta}<button type="button" class="pp-copy" data-act="copy">${ic("link")}<span>${L(S.copyLink)}</span></button></figcaption></figure>
    </div>
    ${note}
    <p class="pp-foot">${L(S.risk)}</p>`;
  };

  const contact = () => { const C = D.contact; return `<div class="pp-contact">
      <h2 class="pp-head"${ED("cover", "contactTitle")}>${L(S.contactTitle)}</h2><p class="pp-sub"${ED("cover", "contactSub")}>${L(S.contactSub)}</p>
      <div class="pp-contact-row">
        <div class="pp-me"><b${ED("contact", "name")}>${esc(C.name)}</b><span${ED("contact", "title")}>${L(C.title)}</span>
          <a href="https://t.me/${esc(C.telegram)}" target="_blank" rel="noopener"${ED("contact", "telegram")}>${ic("send")} @${esc(C.telegram)}</a>
          <a href="https://wa.me/${esc(C.whatsappLink)}" target="_blank" rel="noopener"${ED("contact", "whatsapp")}>${ic("whatsapp")} ${esc(C.whatsapp)}</a></div>
        <figure><img src="img/qr-telegram.png" alt="QR Telegram" width="120" height="120"><figcaption>Telegram</figcaption></figure>
        <figure>${Q.svg(`https://wa.me/${C.whatsappLink}`, { size: 120, label: `QR WhatsApp ${C.whatsapp}` })}<figcaption>WhatsApp</figcaption></figure>
      </div>
      <p class="pp-actions"><a class="btn btn--lime" href="${esc(C.url)}" target="_blank" rel="noopener"${ED("contact", "url")}>${ic("user-plus")}${L(C.register)}</a></p>
    </div>`; };

  const slideHtml = (s, i, n) => {
    if (s.type === "promo") {
      const k = kindOf(s.p);
      return `<section class="pp pp--promo pp--${k}" id="${s.key}" data-i="${i}" aria-label="${esc(L(s.p.name))}">${top(i, n, pu(s.p), tags(s.p, s.st))}${promo(s)}</section>`;
    }
    const body = s.type === "cover" ? cover() : s.type === "index" ? index() : contact();
    return `<section class="pp pp--${s.type}" id="${s.key}" data-i="${i}">${s.type === "cover" ? "" : top(i, n, s.type === "contact" ? "contact" : "cover")}${body}</section>`;
  };

  const bar = () => `<header class="pp-bar"><div class="pp-bar-in">
      <span class="pp-brand"><img src="img/logo-tmgm.webp" alt="TMGM" height="26"><span>${L(S.title)}</span></span>
      <span class="pp-spacer"></span>
      <div class="seg" role="group" aria-label="Language">${LANGS.map(([v, t]) => `<button type="button" data-act="lang" data-v="${v}" aria-pressed="${state.lang === v}">${t}</button>`).join("")}</div>
      <a class="btn btn--ghost btn--sm" href="../">${ic("left")}<span>${L(S.back)}</span></a>
      ${EDIT ? `<button type="button" class="btn btn--ghost btn--sm" data-ed-new="1" aria-label="${esc(L(S.addSlide))}">${ic("plus")}<span>${L(S.addSlide)}</span></button>` : ""}
      <button type="button" class="btn btn--blue btn--sm" data-act="present" aria-label="${esc(L(S.present))}">${ic("play")}<span>${L(S.present)}</span></button>
    </div></header>`;

  const nav = (n) => `<nav class="pp-nav" aria-label="${esc(L(S.title))}">
      <button type="button" data-act="prev" aria-label="${esc(L(S.prev))}">${ic("left")}</button>
      <span class="pp-dots">${Array.from({ length: n }, (_, i) => `<button type="button" data-goi="${i}" aria-label="${i + 1}"${i === state.i ? ' aria-current="true"' : ""}></button>`).join("")}</span>
      <b id="pp-count">${fill(L(S.slideOf), { i: pad2(state.i + 1), n: pad2(n) })}</b>
      <button type="button" data-act="next" aria-label="${esc(L(S.next))}">${ic("right")}</button>
    </nav>`;

  const notes = () => {
    const s = slides()[state.i], p = s && s.p;
    const txt = p && p.note && p.noteFor === "partner" ? L(p.note) : L(S.notesDefault);
    return `<aside class="pp-notes" id="pp-notes"${state.notes ? "" : " hidden"}><b>${L(S.notesTitle)}</b><p>${txt}</p></aside>`;
  };

  // ---------- render + điều hướng ----------
  function render() {
    const list = slides();
    state.i = Math.min(state.i, list.length - 1);
    document.documentElement.lang = state.lang === "zh" ? "zh-Hant" : state.lang;
    document.title = `TMGM · ${L(S.title)}`;
    app.innerHTML = `${bar()}<main class="deck">${list.map((s, i) => slideHtml(s, i, list.length)).join("")}</main>${nav(list.length)}${notes()}`;
    show();
  }
  function show() {
    const list = slides(), s = list[state.i];
    document.querySelectorAll(".pp").forEach((el) => el.classList.toggle("is-on", +el.dataset.i === state.i));
    document.querySelectorAll("[data-goi]").forEach((b) => (+b.dataset.goi === state.i ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current")));
    const c = $("#pp-count");
    if (c) c.textContent = fill(L(S.slideOf), { i: pad2(state.i + 1), n: pad2(list.length) });
    const nt = $("#pp-notes");
    if (nt) nt.outerHTML = notes();
    if (s && history.replaceState) history.replaceState(null, "", `#${s.key}`);
  }
  function go(i) {
    const n = slides().length;
    state.i = Math.max(0, Math.min(n - 1, i));
    show();
    const el = document.getElementById(slides()[state.i].key);
    if (el && el.scrollIntoView && !state.present) el.scrollIntoView({ block: "start" }); // màn hình hẹp: các slide xếp dọc
  }
  const goKey = (key) => { const i = slides().findIndex((s) => s.key === key); if (i >= 0) go(i); };

  function copyLink() {
    const s = slides()[state.i], url = `${location.href.split("#")[0]}#${s.key}`;
    const done = () => toast(L(S.copied));
    const legacy = () => {
      const t = document.createElement("textarea");
      t.value = url; t.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch (e) { /* bị chặn */ }
      t.remove(); done();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, legacy);
    else legacy();
  }
  function toast(msg) {
    let el = $("#toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2500);
  }
  function togglePresent(on = !state.present) {
    state.present = on;
    document.documentElement.classList.toggle("pp-present", on);
    const de = document.documentElement;
    try {
      if (on && de.requestFullscreen && !document.fullscreenElement) de.requestFullscreen();
      if (!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
    } catch (e) { /* trình duyệt chặn toàn màn hình: vẫn trình bày trong cửa sổ */ }
  }

  document.addEventListener("click", (e) => {
    const g = e.target.closest("[data-go]");
    if (g) { goKey(g.dataset.go); return; }
    const gi = e.target.closest("[data-goi]");
    if (gi) { go(+gi.dataset.goi); return; }
    const a = e.target.closest("[data-act]");
    if (!a) return;
    const v = a.dataset.v, key = slides()[state.i].key;
    switch (a.dataset.act) {
      case "prev": go(state.i - 1); break;
      case "next": go(state.i + 1); break;
      case "lang": state.lang = v; store.set("mib-lang", v); render(); goKey(key); break;
      case "filter": state.filter = v; render(); goKey(key); break;
      case "copy": copyLink(); break;
      case "present": togglePresent(); break;
      case "relock": Lk.forget(); D.privatePromos = []; state.unlocked = false; state.codeMsg = ""; render(); goKey(key); break;
    }
  });
  document.addEventListener("input", (e) => { if (e.target.dataset && e.target.dataset.code) state.code = e.target.value; });
  document.addEventListener("submit", (e) => {
    if (!(e.target && e.target.dataset && e.target.dataset.form === "unlock")) return;
    e.preventDefault();
    tryCode();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    const k = e.key;
    if (k === "ArrowRight" || k === "PageDown" || k === " ") { e.preventDefault(); go(state.i + 1); }
    else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); go(state.i - 1); }
    else if (k === "Home") go(0);
    else if (k === "End") go(slides().length - 1);
    else if (k === "f" || k === "F") togglePresent();
    else if (k === "Escape" && state.present) togglePresent(false);
    else if (k === "n" || k === "N") { state.notes = !state.notes; show(); }
    else if (k === "l" || k === "L") {
      const key = slides()[state.i].key, idx = LANGS.findIndex((l) => l[0] === state.lang);
      state.lang = LANGS[(idx + 1) % LANGS.length][0]; store.set("mib-lang", state.lang); render(); goKey(key);
    }
  });
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && state.present) togglePresent(false); });
  window.addEventListener("hashchange", () => goKey(location.hash.slice(1)));
  window.addEventListener("beforeprint", () => document.querySelectorAll(".pp").forEach((el) => el.classList.add("is-print")));

  // Nhận dữ liệu đã giải mã: thêm các ưu đãi chỉ chia sẻ riêng
  function applyPrivate(payload) {
    D.privatePromos = (payload && payload.promos) || [];
    state.unlocked = true; state.code = ""; state.codeMsg = "";
  }
  const setMsg = (t) => { state.codeMsg = t; document.querySelectorAll(".pp-code-msg").forEach((el) => (el.textContent = t)); };
  async function tryCode() {
    setMsg(L(S.codeChecking));
    try {
      const data = await Lk.unlock(state.code);
      if (!data) { setMsg(L(S.codeWrong)); return; }
      applyPrivate(data);
      const key = (slides()[state.i] || {}).key;
      render();
      if (key) goKey(key);
    } catch (err) {
      setMsg(L(S.codeUnsupported));
    }
  }

  const first = location.hash.slice(1); // đọc trước khi render: render ghi lại hash của slide đang mở
  render();
  if (first) goKey(first); // link riêng: index.html#rocket (mục riêng đang ẩn thì ở lại bìa)
  // Đã nhập mã ở lần trước (khóa nhớ trong trình duyệt): mở lại ưu đãi riêng, rồi tới đúng slide được link tới
  if (Lk && window.PP_LOCKED) Lk.restore().then((data) => { if (!data) return; applyPrivate(data); const k = (slides()[state.i] || {}).key; render(); goKey(first || k); }).catch(() => {});

  // Số liệu được sửa (nút Edit, hoặc người khác vừa lưu): vẽ lại và ở lại slide đang xem
  if (window.MIBEdit) window.MIBEdit.onChange(() => {
    const cur = (slides()[state.i] || {}).key, k = window.MIBEdit.state.focus || cur;
    render();
    if (k === cur) { const i = slides().findIndex((s) => s.key === k); if (i >= 0) { state.i = i; show(); } } // cùng slide (đang gõ): không cuộn lại trang
    else if (k) goKey(k);
  });

  // Móc cho test (chỉ bật khi test đặt window.__MIB_TEST__ trước khi nạp file)
  if (window.__MIB_TEST__) Object.assign(window.__MIB_TEST__, { state, slides, go, goKey, html: () => app.innerHTML, unlock: (d) => { applyPrivate(d); render(); } });
})();
