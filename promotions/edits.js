/*
 * Nút "Edit": ai cũng sửa được trang ưu đãi (trang chỉ lưu hành nội bộ, không đăng nhập).
 *  - Mỗi slide có nút "Sửa slide này" (luôn hiện) → mở ngăn sửa bên phải, gõ đến đâu slide đổi đến đó (xem trước); Lưu mới ghi.
 *  - "Thêm slide" tạo ưu đãi mới từ mẫu cùng bố cục; thiếu nội dung thì không cho lưu.
 *  - Nút Edit góc trái dưới: các số liệu có viền nét đứt, bấm để sửa riêng một số; "Dữ liệu…" mở danh sách slide, bìa và liên hệ, lịch sử và sao lưu.
 *  - Chỉ có khi mở trang với ?edit. Bản sửa lưu trên máy này (localStorage); muốn đưa lên web: Dữ liệu… → tải bản sao lưu JSON,
 *    cập nhật promotions/promos-data.js rồi đẩy lên GitHub.
 *  - Mỗi lần lưu đều kiểm tra (edits-core.validate): chặn thẻ HTML, link không https, ngày sai, số âm.
 * Trang gọi MIBEdit.attrs(unit, path) để gắn nút Edit cho một số liệu, và MIBEdit.onChange(fn) để vẽ lại khi dữ liệu đổi.
 * MIBEdit.state.focus = mã slide cần giữ trước mắt khi đang xem trước.
 */
(function () {
  "use strict";
  const Core = window.MIBEditCore, D = window.PROMOS;
  if (!Core || !D) return;
  const TEST = !!window.__MIB_TEST__;
  const defaults = Core.snapshot(D);
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* bị chặn: bỏ qua */ } },
  };
  const KEY = "promos-edits", NAME = "promos-editor";
  const S = { mode: "local", units: {}, rev: 0, on: false, pending: false, listeners: [], hist: [], focus: null };
  let local = { units: {}, history: [] };
  try { const j = JSON.parse(ls.get(KEY) || "null"); if (j && typeof j === "object" && j.units) local = { units: j.units, history: Array.isArray(j.history) ? j.history : [] }; } catch (e) { /* dữ liệu hỏng: bỏ */ }
  const saveLocal = () => ls.set(KEY, JSON.stringify(local));

  // ---------- chữ giao diện (vi / en; zh dùng en) ----------
  const TX = {
    vi: {
      edit: "Edit", editing: "Đang sửa", done: "Xong", data: "Dữ liệu…", hint: "Bấm vào số liệu có viền nét đứt để sửa", pickUnit: "Chọn một mục ở cột bên trái để sửa.",
      localMode: "Lưu trên máy này (xem trước, chưa đưa lên web)",
      save: "Lưu", cancel: "Hủy", reset: "Về mặc định", openForm: "Mở form đầy đủ", close: "Đóng", add: "Thêm", remove: "Xóa",
      saved: "Đã lưu", resetDone: "Đã về mặc định", edited: "đã sửa", defaultTag: "mặc định", conflict: "{by} vừa sửa mục này sau khi bạn mở. Ghi đè hay tải lại?", overwrite: "Ghi đè", reload: "Tải lại",
      network: "Không kết nối được máy chủ. Thử lại.", yourName: "Tên của bạn (tùy chọn)", title: "Chỉnh sửa trang ưu đãi",
      hiddenTag: "ẩn", tPromos: "Slide ưu đãi", tPage: "Bìa & liên hệ", tHistory: "Lịch sử & sao lưu", addSlide: "Thêm slide", newSlide: "Slide mới", editing2: "Đang sửa",
      liveNote: "Xem trước trực tiếp ở trang. Bấm Lưu để giữ trên máy này; Hủy để bỏ thay đổi.", fillVi: "Điền ô EN/中文 còn trống từ VI", fillViHint: "Chỉ sao chép chữ tiếng Việt, không tự dịch: nhớ chỉnh lại.", keyAuto: "Mã slide (tự sinh từ tên EN, có thể sửa)", unsaved: "Chưa lưu: bấm Lưu hoặc Hủy.",
      addPromo: "Thêm slide mới", delPromo: "Xóa slide", restorePromo: "Khôi phục", deleted: "đã xóa", newPromo: "Ưu đãi mới", newKey: "Mã slide (chữ không dấu, không khoảng trắng, vd getaway2)",
      create: "Tạo", saveUnit: "Lưu thay đổi", discard: "Bỏ thay đổi", advanced: "JSON nâng cao", applyJson: "Áp dụng JSON", addField: "Thêm trường…", addRow: "Thêm hàng",
      history: "Lịch sử chỉnh sửa", none: "Chưa có chỉnh sửa nào.", restore: "Khôi phục bản trước", export: "Tải bản sao lưu (JSON)", import: "Nhập sao lưu…", importOk: "Đã nhập {n} mục", importBad: "File không hợp lệ",
      when: "Khi nào", who: "Ai", what: "Mục", act: "Thao tác", set: "sửa", resetA: "về mặc định", restoreA: "khôi phục", anon: "(ẩn danh)",
      errPrefix: "Chưa lưu được", removedOk: "Đã xóa. Có thể khôi phục ở Lịch sử.", slideRemoved: "Đã xóa slide. Khôi phục ở Dữ liệu… → Slide ưu đãi.", confirmDel: "Xóa slide này khỏi trang?",
      unitMissing: "(ưu đãi này đã bị xóa)", errs: {
        size: "Dữ liệu quá lớn", depth: "Cấu trúc quá sâu", num: "Phải là số không âm", long: "Chữ quá dài (tối đa 600 ký tự)", chars: "Không dùng ký tự < hoặc ký tự điều khiển",
        date: "Ngày không hợp lệ (dạng 2026-12-31)", url: "Link phải bắt đầu bằng https://", t3: "Cần điền đủ 3 ngôn ngữ (VI, EN, 中文)", key: "Tên trường/mã không hợp lệ",
        count: "Số lượng không hợp lệ ({arg})", type: "Kiểu dữ liệu không đúng", unit: "Mục không hợp lệ", enum: "Giá trị không nằm trong danh sách", required: "Còn thiếu thông tin bắt buộc",
        order: "Ngày không đúng thứ tự", int: "Phải là số nguyên từ 0 đến 999", src: "Ảnh: dùng link https hoặc ảnh trong thư mục img/ (vd img/ten-anh.png)", handle: "Tên Telegram: 3–32 ký tự chữ, số, gạch dưới", phone: "Số điện thoại không hợp lệ", pos: "Phải là số lớn hơn 0", pct: "Phải từ 0 đến 100", ref: "Phải trùng một món trong bảng quy đổi", tmgm: "Phải còn dòng TMGM", dup: "Tên bị trùng", server: "Máy chủ từ chối",
      },
    },
    en: {
      edit: "Edit", editing: "Editing", done: "Done", data: "Data…", hint: "Click a dashed figure to edit it", pickUnit: "Pick an item on the left to edit.",
      localMode: "Saved on this device (preview, not on the web yet)",
      save: "Save", cancel: "Cancel", reset: "Reset to default", openForm: "Open full form", close: "Close", add: "Add", remove: "Remove",
      saved: "Saved", resetDone: "Reset to default", edited: "edited", defaultTag: "default", conflict: "{by} just edited this after you opened it. Overwrite or reload?", overwrite: "Overwrite", reload: "Reload",
      network: "Can't reach the server. Try again.", yourName: "Your name (optional)", title: "Edit the promotions page",
      hiddenTag: "hidden", tPromos: "Promotion slides", tPage: "Cover & contact", tHistory: "History & backup", addSlide: "Add a slide", newSlide: "New slide", editing2: "Editing",
      liveNote: "Live preview on the page. Press Save to keep it on this device; Cancel to drop your changes.", fillVi: "Fill empty EN/中文 boxes from VI", fillViHint: "Only copies the Vietnamese text, no translation: remember to fix it.", keyAuto: "Slide code (auto from the EN name, editable)", unsaved: "Not saved: press Save or Cancel.",
      addPromo: "Add a new slide", delPromo: "Delete slide", restorePromo: "Restore", deleted: "deleted", newPromo: "New promotion", newKey: "Promotion code (letters/digits, no spaces, e.g. getaway2)",
      create: "Create", saveUnit: "Save changes", discard: "Discard changes", advanced: "Advanced JSON", applyJson: "Apply JSON", addField: "Add field…", addRow: "Add row",
      history: "Edit history", none: "No edits yet.", restore: "Restore previous", export: "Download backup (JSON)", import: "Import backup…", importOk: "Imported {n} items", importBad: "Invalid file",
      when: "When", who: "Who", what: "Item", act: "Action", set: "edit", resetA: "reset", restoreA: "restore", anon: "(anonymous)",
      errPrefix: "Couldn't save", removedOk: "Deleted. You can restore it from History.", slideRemoved: "Slide deleted. Restore it in Data… → Promotion slides.", confirmDel: "Delete this slide from the page?",
      unitMissing: "(this promotion was deleted)", errs: {
        size: "Data too large", depth: "Structure too deep", num: "Must be a non-negative number", long: "Text too long (max 600 characters)", chars: "Don't use < or control characters",
        date: "Invalid date (format 2026-12-31)", url: "Link must start with https://", t3: "Fill all 3 languages (VI, EN, 中文)", key: "Invalid field name/code",
        count: "Invalid count ({arg})", type: "Wrong data type", unit: "Invalid item", enum: "Value not in the list", required: "Required information missing",
        order: "Dates out of order", int: "Must be a whole number from 0 to 999", src: "Image: use an https link or a file in the img/ folder (e.g. img/name.png)", handle: "Telegram name: 3–32 letters, digits or underscores", phone: "Invalid phone number", pos: "Must be greater than 0", pct: "Must be between 0 and 100", ref: "Must match one item in the conversion table", tmgm: "The TMGM row must stay", dup: "Duplicate name", server: "Server rejected it",
      },
    },
  };
  const lang = () => { const q = typeof location !== "undefined" && /[?&]lang=(\w+)/.exec(location.search || ""); const l = (q && q[1]) || ls.get("mib-lang"); return l === "vi" ? "vi" : "en"; };
  const tx = (k, o) => { const s = TX[lang()][k] ?? TX.en[k] ?? k; return o ? s.replace(/\{(\w+)\}/g, (_, x) => o[x] ?? "") : s; };
  const errText = (e) => (TX[lang()].errs[e.code] || TX.en.errs[e.code] || e.code).replace("{arg}", e.arg ?? "");
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  // ---------- nhãn ----------
  const UNIT_LABEL = { cover: ["Bìa & danh sách", "Cover & list"], contact: ["Liên hệ", "Contact"] };
  const FIELD = {
    name: ["Tên", "Name"], value: ["Giá trị tóm tắt", "Summary value"], seg: ["Đối tượng", "Audience"], headline: ["Tiêu đề lớn", "Headline"], sub: ["Câu phụ", "Subtitle"],
    steps: ["Bước", "Step"], rules: ["Điều kiện", "Condition"], note: ["Lưu ý", "Note"], from: ["Từ ngày", "From"], until: ["Đến ngày", "Until"], regUntil: ["Đóng đăng ký", "Registration closes"],
    url: ["Link chương trình (https)", "Promotion link (https)"], image: ["Link ảnh (https), thay hình có sẵn", "Image link (https), replaces the built-in picture"], order: ["Thứ tự trong nhóm (số nhỏ trước)", "Order in group (small first)"],
    hidden: ["Ẩn khỏi trang (bỏ chọn để hiện lại)", "Hide from the page (untick to show again)"], pics: ["Ảnh bảng (hiện ngay đầu slide)", "Table pictures (shown at the top of the slide)"], src: ["Ảnh: link https hoặc img/ten-anh.png", "Image: https link or img/name.png"], alt: ["Mô tả ảnh", "Image description"],
    key: ["Mã", "Code"], group: ["Nhóm", "Group"], share: ["Chia sẻ", "Sharing"], icon: ["Biểu tượng", "Icon"], art: ["Hình minh họa", "Illustration"], what: ["Nội dung", "Item"],
    deposit: ["Net deposit (USD)", "Net deposit (USD)"], lots: ["Lot", "Lots"], pct: ["Tỷ lệ (%)", "Rate (%)"], label: ["Tên", "Label"], cap: ["Tối đa (USD)", "Cap (USD)"],
    table: ["Bảng quà", "Gift table"], rows: ["Hàng", "Rows"], tix: ["Bậc vé", "Ticket tiers"], quests: ["Nhiệm vụ", "Quests"], tasks: ["Nhiệm vụ", "Tasks"], example: ["Ví dụ", "Example"], draw: ["Số người cho 1 giải", "Clients per prize"],
    coverKicker: ["Dòng nhỏ trên bìa", "Cover kicker"], coverTitle: ["Tiêu đề bìa", "Cover title"], coverSub: ["Câu phụ bìa", "Cover subtitle"], indexTitle: ["Tiêu đề danh sách", "List title"], indexHint: ["Gợi ý danh sách", "List hint"],
    contactTitle: ["Tiêu đề liên hệ", "Contact title"], contactSub: ["Câu phụ liên hệ", "Contact subtitle"],
    title: ["Chức danh", "Job title"], telegram: ["Telegram (không có @)", "Telegram (no @)"], whatsapp: ["WhatsApp (hiển thị)", "WhatsApp (shown)"], whatsappLink: ["WhatsApp (chỉ số, không +)", "WhatsApp (digits only, no +)"], register: ["Chữ nút đăng ký", "Register button text"],
  };
  const L2 = (pair) => (lang() === "vi" ? pair[0] : pair[1]);
  const unitLabel = (u) => {
    if (UNIT_LABEL[u]) return L2(UNIT_LABEL[u]);
    const k = Core.promoKey(u), p = k && (Core.get(D, u) || defaults.promos.find((x) => x.key === k));
    return p ? `${lang() === "vi" ? "Ưu đãi" : "Promotion"}: ${p.name[lang()] || p.name.en}` : u;
  };
  const pathLabel = (path) => String(path).split(".").filter((s) => s !== "").map((s) => (/^\d+$/.test(s) ? `#${+s + 1}` : FIELD[s] ? L2(FIELD[s]) : s)).join(" › ");
  const ENUMS = { group: Core.GROUPS, share: Core.SHARES, icon: Core.ICONS, art: Core.ART_KEYS };
  const ENUM_TXT = { small: ["Ưu đãi nhỏ", "Small offer"], marketing: ["Marketing", "Marketing"], followup: ["Đang hoàn tất", "Wrapping up"], public: ["Công khai", "Public"], private: ["Chỉ chia sẻ riêng (nhãn)", "Private only (label)"] };
  const DATE_KEYS = new Set(["from", "until", "regUntil", "to"]);
  const LANGS = { vi: "VI", en: "EN", zh: "中文" };
  const PROMO_ORDER = ["key", "hidden", "group", "share", "order", "art", "image", "pics", "from", "until", "regUntil", "url", "name", "headline", "sub", "seg", "steps", "rules", "note", "value", "icon", "table", "tix", "quests", "example", "tasks", "draw"];
  const OPTIONAL = Core.OPTIONAL;

  // ---------- áp dữ liệu ----------
  function notify() { S.listeners.forEach((fn) => { try { fn(); } catch (e) { /* trang tự xử lý */ } }); }
  function applyAndNotify() {
    if (modalOpen()) { S.pending = true; Core.applyAll(D, defaults, S.units); if (P && P.drawer && P.work) preview(); else notifyAfterClose = true; if (!TEST) refreshChrome(); return; }
    Core.applyAll(D, defaults, S.units);
    notify();
    if (!TEST) refreshChrome();
  }
  let notifyAfterClose = false;
  const modalOpen = () => !TEST && ((popEl && !popEl.hidden) || (panelEl && !panelEl.hidden));
  function flushPending() { if (notifyAfterClose) { notifyAfterClose = false; notify(); } }

  // ---------- lưu trên máy này ----------
  const editor = () => (ls.get(NAME) || "").slice(0, 40);
  const baseOf = (unit) => (S.units[unit] ? S.units[unit].at : 0);
  // value === undefined: về mặc định. Trả { ok } | { ok:false, errors | conflict | network }
  async function commit(unit, value, opts = {}) {
    if (value !== undefined) { const errors = Core.validate(unit, value); if (errors.length) return { ok: false, errors }; }
    const by = editor(), cur = S.units[unit];
    {
      const at = Date.now();
      local.history = [Core.entry({ unit, action: value === undefined ? "reset" : "set", prev: cur ? cur.value : null, next: value, by, at }), ...local.history].slice(0, Core.HISTORY_MAX);
      if (value === undefined) delete S.units[unit]; else S.units[unit] = { value: Core.clone(value), by, at };
      local.units = S.units;
      saveLocal();
    }
    applyAndNotify();
    return { ok: true };
  }
  async function restore(id) {
    const e = local.history.find((x) => x.id === id);
    if (!e) return { ok: false, errors: [{ path: "", code: "server" }] };
    return commit(e.unit, e.prev === null ? undefined : e.prev, { force: true });
  }
  async function history() {
    return local.history;
  }
  // ---------- giao diện ----------
  let fabEl, barEl, popEl, panelEl, toastEl;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const icon = (n) => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "ed-toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove("show"), 3500);
  }
  const where = () => tx("localMode");
  function refreshChrome() {
    if (!fabEl) return;
    fabEl.setAttribute("aria-pressed", String(S.on));
    document.documentElement.classList.toggle("ed-on", S.on);
    barEl.hidden = !S.on;
    $(".ed-bar-where", barEl).textContent = `${tx("editing")} · ${where()}`;
    $(".ed-bar-hint", barEl).textContent = tx("hint");
    $("[data-ed-x=data]", barEl).textContent = tx("data");
    $("[data-ed-x=done]", barEl).textContent = tx("done");
    $(".ed-fab-t", fabEl).textContent = tx("edit");
  }
  function build() {
    fabEl = document.createElement("button");
    fabEl.type = "button"; fabEl.className = "ed-fab"; fabEl.id = "ed-fab"; fabEl.setAttribute("data-ed-x", "toggle");
    fabEl.innerHTML = `${icon("edit")}<span class="ed-fab-t">Edit</span>`;
    barEl = document.createElement("div"); barEl.className = "ed-bar"; barEl.id = "ed-bar"; barEl.hidden = true;
    barEl.innerHTML = `<div class="ed-bar-txt"><span class="ed-bar-where"></span><span class="ed-bar-hint"></span></div><button type="button" class="ed-btn" data-ed-x="data"></button><button type="button" class="ed-btn ed-btn--solid" data-ed-x="done"></button>`;
    popEl = document.createElement("div"); popEl.className = "ed-pop"; popEl.id = "ed-pop"; popEl.hidden = true; popEl.setAttribute("role", "dialog");
    panelEl = document.createElement("div"); panelEl.className = "ed-panel"; panelEl.id = "ed-panel"; panelEl.hidden = true;
    [fabEl, barEl, popEl, panelEl].forEach((el) => document.body.appendChild(el));
    refreshChrome();
  }

  // --- hộp sửa một số liệu ---
  let pop = null; // { unit, path, el, work }
  function valueKind(v, path) {
    if (Core.isT(v)) return "t";
    if (typeof v === "number") return "num";
    if (v === null) return "nnum";
    if (typeof v === "string") return DATE_KEYS.has(String(path).split(".").pop()) ? "date" : "text";
    return "json";
  }
  function openPop(el) {
    const unit = el.dataset.ed, path = el.dataset.ep || "";
    const cur = Core.getPath(Core.get(D, unit), path);
    if (cur === undefined) return;
    pop = { unit, path, el, kind: valueKind(cur, path), cur: Core.clone(cur) };
    const label = `${unitLabel(unit)} › ${pathLabel(path)}`;
    const canDel = Core.removeAt(Core.get(D, unit), path, Core.promoKey(unit) ? OPTIONAL : []) !== null;
    const inputs = pop.kind === "t"
      ? ["vi", "en", "zh"].map((l) => `<label class="ed-row"><b>${LANGS[l]}</b><textarea rows="2" data-pv="${l}">${esc(cur[l])}</textarea></label>`).join("")
      : pop.kind === "json" ? `<textarea rows="4" data-pv="json">${esc(JSON.stringify(cur))}</textarea>`
      : `<input data-pv="v" type="${pop.kind === "date" ? "date" : pop.kind === "text" ? "text" : "number"}" ${pop.kind === "text" || pop.kind === "date" ? "" : 'min="0" step="any"'} value="${esc(cur === null ? "" : cur)}">`;
    popEl.innerHTML = `<p class="ed-pop-h">${esc(label)}</p>${inputs}<p class="ed-err" id="ed-pop-err" role="alert"></p>
      <div class="ed-pop-act"><button type="button" class="ed-btn ed-btn--solid" data-ed-x="pop-save">${tx("save")}</button>
      <button type="button" class="ed-btn" data-ed-x="pop-reset">${tx("reset")}</button><button type="button" class="ed-btn" data-ed-x="pop-cancel">${tx("cancel")}</button>
      ${canDel ? `<button type="button" class="ed-btn ed-btn--danger" data-ed-x="pop-del">${tx("remove")}</button>` : ""}
      <button type="button" class="ed-link" data-ed-x="pop-full">${tx("openForm")}</button></div>`;
    popEl.hidden = false;
    const r = el.getBoundingClientRect(), w = Math.min(360, window.innerWidth - 16);
    popEl.style.width = `${w}px`;
    popEl.style.left = `${Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - w - 8))}px`;
    popEl.style.top = `${r.bottom + window.scrollY + 8}px`;
    const f = $("[data-pv]", popEl); if (f) f.focus();
  }
  function closePop() { if (popEl) popEl.hidden = true; pop = null; flushPending(); }
  function popValue() {
    if (pop.kind === "t") return Object.fromEntries(["vi", "en", "zh"].map((l) => [l, $(`[data-pv=${l}]`, popEl).value]));
    const raw = $("[data-pv]", popEl).value;
    if (pop.kind === "json") { try { return JSON.parse(raw); } catch (e) { return undefined; } }
    if (pop.kind === "num") return raw === "" ? "" : Number(raw);
    if (pop.kind === "nnum") return raw === "" ? null : Number(raw);
    return raw;
  }
  function showErrors(el, errors, prefix) {
    el.innerHTML = errors.map((e) => `${e.path ? `${esc(pathLabel(e.path))}: ` : ""}${esc(errText(e))}`).join("<br>");
    el.dataset.has = errors.length ? "1" : "";
    if (prefix && errors.length) el.insertAdjacentHTML("afterbegin", `<b>${esc(tx("errPrefix"))}</b><br>`);
  }
  async function savePop(force) {
    const v = popValue(), err = $("#ed-pop-err", popEl);
    if (v === undefined || v === "") return showErrors(err, [{ path: "", code: v === "" ? "num" : "type" }], true);
    const unitVal = Core.setPath(Core.get(D, pop.unit), pop.path, v);
    const r = await commit(pop.unit, unitVal, { force });
    handleResult(r, err, () => { toast(tx("saved")); closePop(); });
  }
  // Xóa dòng/mục đang sửa (điều kiện, bước, ảnh, hàng bảng, trường tùy chọn); bản trước vẫn còn trong Lịch sử
  async function removePop() {
    const err = $("#ed-pop-err", popEl), w = Core.removeAt(Core.get(D, pop.unit), pop.path, Core.promoKey(pop.unit) ? OPTIONAL : []);
    if (w === null) return;
    const r = await commit(pop.unit, w);
    handleResult(r, err, () => { toast(tx("removedOk")); closePop(); });
  }
  // Xóa cả slide: slide mặc định chỉ bị ẩn ({ deleted: true }, khôi phục được); slide tự thêm thì xóa hẳn
  const removePromo = (unit, opts) => commit(unit, defaults.promos.some((p) => `promo:${p.key}` === unit) ? { deleted: true } : undefined, opts);
  async function deleteSlide(unit) { // nút "Xóa slide này" ở mỗi slide
    if (P && P.drawer && P.dirty) return toast(tx("unsaved"));
    if (!Core.promoKey(unit) || !window.confirm(tx("confirmDel"))) return;
    if (P && P.drawer) closePanel();
    const r = await removePromo(unit, { force: true });
    toast(r.ok ? tx("slideRemoved") : r.network ? tx("network") : errText((r.errors || [{ code: "server" }])[0]));
  }
  async function resetPop() {
    const def = Core.getPath(Core.defaultOf(defaults, pop.unit), pop.path), err = $("#ed-pop-err", popEl);
    const r = await commit(pop.unit, Core.setPath(Core.get(D, pop.unit), pop.path, def));
    handleResult(r, err, () => { toast(tx("resetDone")); closePop(); });
  }
  function handleResult(r, errEl, ok, retryForce) {
    if (r.ok) return ok();
    if (r.network) return showErrors(errEl, [], false), (errEl.textContent = tx("network"));
    if (r.conflict) {
      errEl.innerHTML = `${esc(tx("conflict", { by: (r.current && r.current.by) || tx("anon") }))} <button type="button" class="ed-btn" data-ed-x="${retryForce || "pop-force"}">${tx("overwrite")}</button> <button type="button" class="ed-btn" data-ed-x="reload">${tx("reload")}</button>`;
      return;
    }
    showErrors(errEl, r.errors || [{ path: "", code: "server" }], true);
  }

  // --- bảng sửa đầy đủ ---
  let P = null; // { tab, unit, work, creating, errors }
  const TABS = [["promos", "tPromos"], ["page", "tPage"], ["history", "tHistory"]];
  const TAB_UNITS = { page: ["cover", "contact"] };
  const isEditedUnit = (u) => Core.isEdited(defaults, D, u, "");
  const promoIds = () => Core.unitIds(defaults, S.units).filter((u) => Core.promoKey(u));
  const cleanName = (u) => { const k = Core.promoKey(u); const p = Core.get(D, u) || defaults.promos.find((x) => x.key === k) || (S.units[u] && S.units[u].value); return (p && p.name && (p.name[lang()] || p.name.en)) || k; };

  // Bảng "Dữ liệu…" (danh sách, lịch sử) ở giữa màn hình; ngăn sửa (drawer) ở bên phải để vừa sửa vừa xem trang
  function openPanel() {
    if (!panelEl) return;
    closePop();
    if (P && P.drawer && P.dirty) return toast(tx("unsaved"));
    P = { tab: "promos", unit: null, work: null, creating: false, errors: [] };
    panelEl.hidden = false;
    document.documentElement.classList.add("ed-modal");
    renderPanel();
  }
  function openDrawer(unit, creating) {
    if (!panelEl) return;
    closePop();
    if (P && P.drawer && P.dirty) return toast(tx("unsaved"));
    if (creating) P = { drawer: true, tab: "promos", unit: null, creating: true, work: Core.newPromo(today(), plusDays(30)), errors: [] };
    else selectUnit(unit, true);
    if (!P) return;
    P.drawer = true;
    panelEl.hidden = false;
    document.documentElement.classList.remove("ed-modal");
    document.documentElement.classList.add("ed-with-drawer");
    renderPanel();
    if (creating) preview();
    else focusFor(unit);
  }
  const focusFor = (unit) => { S.focus = Core.promoKey(unit); if (S.focus) notify(); };
  function closePanel() {
    const wasDrawer = !!(P && P.drawer);
    panelEl.hidden = true; P = null;
    document.documentElement.classList.remove("ed-modal", "ed-with-drawer");
    S.focus = null;
    if (wasDrawer) { Core.applyAll(D, defaults, S.units); notify(); } // bỏ phần xem trước chưa lưu
    flushPending();
  }
  function selectUnit(unit, drawer) {
    const tab = Core.promoKey(unit) ? "promos" : Object.keys(TAB_UNITS).find((t) => TAB_UNITS[t].includes(unit)) || "promos";
    const cur = Core.get(D, unit) || (S.units[unit] && S.units[unit].value && !S.units[unit].value.deleted ? S.units[unit].value : null);
    if (drawer && !cur) { P = null; return; }
    P = { tab, unit, work: cur ? Core.clone(cur) : null, creating: false, errors: [], drawer: !!drawer };
    renderPanel();
  }
  const when = (at) => { try { return new Date(at).toLocaleString(lang() === "vi" ? "vi-VN" : "en-GB"); } catch (e) { return String(at); } };

  function nav() {
    const tabs = TABS.map(([k, t]) => `<button type="button" class="ed-tab${P.tab === k ? " is-on" : ""}" data-ed-x="tab" data-v="${k}">${tx(t)}</button>`).join("");
    let list = "";
    if (P.tab === "promos") {
      list = promoIds().map((u) => {
        const gone = S.units[u] && S.units[u].value && S.units[u].value.deleted;
        return `<button type="button" class="ed-unit${P.unit === u ? " is-on" : ""}${gone ? " is-gone" : ""}" data-ed-x="unit" data-v="${u}"><span>${esc(cleanName(u))}</span>${gone ? `<em>${tx("deleted")}</em>` : (Core.get(D, u) || {}).hidden ? `<em>${tx("hiddenTag")}</em>` : isEditedUnit(u) ? `<em>${tx("edited")}</em>` : ""}</button>`;
      }).join("") + `<button type="button" class="ed-unit ed-unit--add" data-ed-x="new">${icon("plus")}<span>${tx("addPromo")}</span></button>`;
    } else if (TAB_UNITS[P.tab]) {
      list = TAB_UNITS[P.tab].map((u) => `<button type="button" class="ed-unit${P.unit === u ? " is-on" : ""}" data-ed-x="unit" data-v="${u}"><span>${esc(unitLabel(u))}</span>${isEditedUnit(u) ? `<em>${tx("edited")}</em>` : ""}</button>`).join("");
    }
    return `<nav class="ed-nav"><div class="ed-tabs">${tabs}</div><div class="ed-units">${list}</div></nav>`;
  }

  // Form tự dựng theo kiểu dữ liệu. Mỗi ô có data-fp = đường dẫn; sửa xong cập nhật P.work.
  function node(v, path, key) {
    if (Core.isT(v)) return tBox(v, path, 2);
    if (Array.isArray(v)) return arrayBox(v, path, key);
    if (Core.isObj(v)) return objectBox(v, path, key);
    return leaf(v, path, key);
  }
  function leaf(v, path, key) {
    if (ENUMS[key]) return `<select data-fp="${path}" data-ft="text">${ENUMS[key].map((o) => `<option value="${o}"${o === v ? " selected" : ""}>${esc(ENUM_TXT[o] ? L2(ENUM_TXT[o]) : o)}</option>`).join("")}</select>`;
    if (typeof v === "boolean") return `<input type="checkbox" data-fp="${path}" data-ft="bool"${v ? " checked" : ""}>`;
    if (typeof v === "number" || v === null) return `<input type="number" min="0" step="any" data-fp="${path}" data-ft="${v === null ? "nnum" : "num"}" value="${v === null ? "" : v}">`;
    return `<input type="${DATE_KEYS.has(key) ? "date" : "text"}" data-fp="${path}" data-ft="text" value="${esc(v)}"${key === "key" && !P.creating ? " readonly" : ""}>`;
  }
  const tBox = (t, path, rows) => `<div class="ed-t">${["vi", "en", "zh"].map((l) => `<label><b>${LANGS[l]}</b><textarea rows="${rows}" data-fp="${path}.${l}" data-ft="text">${esc(t[l])}</textarea></label>`).join("")}</div>`;
  const delBtn = (path) => `<button type="button" class="ed-x" data-ed-x="del" data-v="${path}" aria-label="${esc(tx("remove"))}">${icon("x")}</button>`;
  function arrayBox(arr, path, key) {
    const add = `<button type="button" class="ed-btn ed-btn--sm" data-ed-x="add" data-v="${path}">${icon("plus")} ${tx("addRow")}</button>`;
    if (!arr.length) return `<div class="ed-arr">${add}</div>`;
    if (arr.every(Core.isT)) return `<div class="ed-arr">${arr.map((t, i) => `<div class="ed-item"><span class="ed-n">${i + 1}</span>${tBox(t, `${path}.${i}`, 2)}${delBtn(`${path}.${i}`)}</div>`).join("")}${add}</div>`;
    if (arr.every((x) => x === null || typeof x !== "object")) return `<div class="ed-arr ed-arr--row">${arr.map((x, i) => `<span class="ed-cellw">${leaf(x, `${path}.${i}`, "")}</span>`).join("")}</div>`;
    if (arr.every(Array.isArray)) return `<div class="ed-arr">${arr.map((r, i) => `<div class="ed-item ed-item--row"><span class="ed-n">${i + 1}</span>${arrayBox(r, `${path}.${i}`, "")}${delBtn(`${path}.${i}`)}</div>`).join("")}${add}</div>`;
    return `<div class="ed-arr">${arr.map((o, i) => `<fieldset class="ed-card"><legend>#${i + 1}${o && o.name ? ` · ${esc(Core.isT(o.name) ? o.name[lang()] || o.name.en : o.name)}` : ""}</legend>${delBtn(`${path}.${i}`)}${objectBox(o, `${path}.${i}`, "")}</fieldset>`).join("")}${add}</div>`;
  }
  function objectBox(o, path, key) {
    let keys = Object.keys(o);
    if (P.unit && Core.promoKey(P.unit) && path === "") keys = [...PROMO_ORDER.filter((k) => k in o), ...keys.filter((k) => !PROMO_ORDER.includes(k))];
    const rows = keys.map((k) => {
      const p = path ? `${path}.${k}` : k, v = o[k], wide = Core.isT(v) || Array.isArray(v) || Core.isObj(v);
      const optional = path === "" && P.unit && Core.promoKey(P.unit) && OPTIONAL.includes(k);
      return `<div class="ed-fld${wide ? " ed-fld--wide" : ""}"><label>${esc(FIELD[k] ? L2(FIELD[k]) : k)}${optional ? ` <button type="button" class="ed-link" data-ed-x="dropf" data-v="${k}">${tx("remove")}</button>` : ""}</label>${node(v, p, k)}</div>`;
    }).join("");
    let addf = "";
    if (path === "" && P.unit && Core.promoKey(P.unit)) {
      const miss = OPTIONAL.filter((k) => !(k in o));
      if (miss.length) addf = `<div class="ed-fld"><label>${tx("addField")}</label><select data-ed-x="addf"><option value="">—</option>${miss.map((k) => `<option value="${k}">${esc(L2(FIELD[k]))}</option>`).join("")}</select></div>`;
    }
    return `<div class="ed-obj">${rows}${addf}</div>`;
  }

  function mainHtml() {
    if (P.tab === "history") return `<div class="ed-main-in" id="ed-hist"><p class="ed-muted">…</p></div>`;
    if (!P.unit && !P.creating) return `<div class="ed-main-in"><p class="ed-muted">${tx("pickUnit")}</p></div>`;
    if (P.creating) return `<div class="ed-main-in"><h3>${tx("newPromo")}</h3><div class="ed-fld"><label>${tx("keyAuto")}</label><input id="ed-newkey" type="text" maxlength="31" autocomplete="off" placeholder="getaway2" value="${esc(P.key || "")}"></div>
      ${fillBtn()}<div class="ed-form" id="ed-form">${objectBoxWithoutKey()}</div><div class="ed-errs" id="ed-errs"></div><div class="ed-act"><button type="button" class="ed-btn ed-btn--solid" data-ed-x="create">${tx("create")}</button><button type="button" class="ed-btn" data-ed-x="cancel-new">${tx("cancel")}</button></div></div>`;
    if (P.work === null) return `<div class="ed-main-in"><p class="ed-muted">${tx("unitMissing")}</p><div class="ed-act"><button type="button" class="ed-btn ed-btn--solid" data-ed-x="unit-reset">${tx("restorePromo")}</button></div></div>`;
    const promo = Core.promoKey(P.unit);
    return `<div class="ed-main-in"><h3>${esc(unitLabel(P.unit))}${isEditedUnit(P.unit) ? ` <em class="ed-tag">${tx("edited")}</em>` : ` <em class="ed-tag ed-tag--def">${tx("defaultTag")}</em>`}</h3>
      ${P.drawer && promo ? fillBtn() : ""}<div class="ed-form" id="ed-form">${node(P.work, "", "")}</div>
      <details class="ed-adv"><summary>${tx("advanced")}</summary><textarea id="ed-json" rows="8">${esc(JSON.stringify(P.work, null, 2))}</textarea><button type="button" class="ed-btn ed-btn--sm" data-ed-x="json">${tx("applyJson")}</button></details>
      <div class="ed-errs" id="ed-errs" role="alert"></div>
      <div class="ed-act"><button type="button" class="ed-btn ed-btn--solid" data-ed-x="unit-save">${tx("saveUnit")}</button><button type="button" class="ed-btn" data-ed-x="unit-discard">${tx("discard")}</button>
      <button type="button" class="ed-btn" data-ed-x="unit-reset">${tx("reset")}</button>${promo ? `<button type="button" class="ed-btn ed-btn--danger" data-ed-x="unit-delete">${tx("delPromo")}</button>` : ""}</div></div>`;
  }
  const fillBtn = () => `<div class="ed-fillvi"><button type="button" class="ed-btn ed-btn--sm" data-ed-x="fillvi">${tx("fillVi")}</button><small>${tx("fillViHint")}</small></div>`;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () => iso(new Date());
  const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  const objectBoxWithoutKey = () => { const w = P.work; P.unit = "promo:new"; const html = objectBox(Object.fromEntries(Object.entries(w).filter(([k]) => k !== "key")), "", ""); return html; };

  function renderPanel() {
    if (P.drawer) {
      panelEl.className = "ed-panel ed-panel--drawer";
      const t = P.creating ? tx("newSlide") : Core.promoKey(P.unit) ? cleanName(P.unit) : unitLabel(P.unit);
      panelEl.innerHTML = `<aside class="ed-drawer" role="dialog" aria-label="${esc(tx("title"))}">
        <header class="ed-ph"><h2>${esc(tx("editing2"))}: ${esc(t)}</h2><button type="button" class="ed-x" data-ed-x="drawer-close" aria-label="${esc(tx("close"))}">${icon("x")}</button>
        <span class="ed-where">${esc(where())}</span>
        <label class="ed-me">${tx("yourName")} <input id="ed-name" type="text" maxlength="40" value="${esc(editor())}" autocomplete="off"></label></header>
        <p class="ed-live">${tx("liveNote")}</p>
        <section class="ed-main" id="ed-main">${mainHtml()}</section></aside>`;
      return;
    }
    panelEl.className = "ed-panel";
    panelEl.innerHTML = `<div class="ed-ov" data-ed-x="close"></div><div class="ed-panel-in" role="dialog" aria-modal="true" aria-label="${esc(tx("title"))}">
      <header class="ed-ph"><h2>${tx("title")}</h2><span class="ed-where">${esc(where())}</span>
        <label class="ed-me">${tx("yourName")} <input id="ed-name" type="text" maxlength="40" value="${esc(editor())}" autocomplete="off"></label>
        <button type="button" class="ed-x" data-ed-x="close" aria-label="${esc(tx("close"))}">${icon("x")}</button></header>
      <div class="ed-pbody">${nav()}<section class="ed-main" id="ed-main">${mainHtml()}</section></div></div>`;
    if (P.tab === "history") loadHistory();
  }
  async function loadHistory() {
    const h = await history(), el = $("#ed-hist");
    if (!el || !P || P.tab !== "history") return;
    const actTxt = { set: tx("set"), reset: tx("resetA"), restore: tx("restoreA") };
    el.innerHTML = `<h3>${tx("history")}</h3><div class="ed-act"><button type="button" class="ed-btn" data-ed-x="export">${icon("download")} ${tx("export")}</button>
      <label class="ed-btn">${tx("import")}<input type="file" id="ed-import" accept="application/json,.json" hidden></label></div>
      ${h.length ? `<table class="ed-tbl"><thead><tr><th>${tx("when")}</th><th>${tx("who")}</th><th>${tx("what")}</th><th>${tx("act")}</th><th></th></tr></thead><tbody>${h.map((e) =>
        `<tr><td>${esc(when(e.at))}</td><td>${esc(e.by || tx("anon"))}</td><td>${esc(unitLabel(e.unit))}</td><td>${esc(actTxt[e.action] || e.action)}</td><td><button type="button" class="ed-btn ed-btn--sm" data-ed-x="restore" data-v="${esc(e.id)}">${tx("restore")}</button></td></tr>`).join("")}</tbody></table>` : `<p class="ed-muted">${tx("none")}</p>`}`;
  }
  function liveErrors() {
    const el = $("#ed-errs"); if (!el || !P || !P.work) return;
    const unit = P.creating ? `promo:${keyOf() || "x0"}` : P.unit;
    const w = P.creating ? { ...P.work, key: keyOf() } : P.work;
    showErrors(el, Core.unitOk(unit) || !P.creating ? Core.validate(unit, w) : [{ path: "key", code: "key" }], false);
  }
  function setFromInput(inp) {
    if (!P || !P.work) return;
    const t = inp.dataset.ft, path = inp.dataset.fp;
    const v = t === "bool" ? inp.checked : t === "num" ? (inp.value === "" ? 0 : Number(inp.value)) : t === "nnum" ? (inp.value === "" ? null : Number(inp.value)) : inp.value;
    P.work = Core.setPath(P.work, path, v);
    P.dirty = true;
    if (P.creating && path === "name.en") autoKey();
    liveErrors();
    schedulePreview();
  }
  // Mã slide tự sinh từ tên EN cho tới khi người dùng tự gõ mã
  function autoKey() {
    if (P.keyTouched) return;
    P.key = Core.slugKey(P.work.name.en, takenKeys());
    const k = $("#ed-newkey");
    if (k) k.value = P.key;
  }
  const takenKeys = () => [...defaults.promos.map((p) => p.key), ...Object.keys(S.units).filter((u) => Core.promoKey(u)).map(Core.promoKey)];
  const keyOf = () => ((P && P.key) || "").trim();
  // Xem trước: áp bản đang sửa (chữ trống tạm thành "…") lên trang mà không lưu; chỉ khi bản này hợp lệ
  let previewT = 0;
  function schedulePreview() { if (TEST) return preview(); clearTimeout(previewT); previewT = setTimeout(preview, 120); }
  function preview() {
    if (!P || !P.drawer || !P.work) return;
    const unit = P.creating ? `promo:${keyOf() || "newslide"}` : P.unit;
    if (!Core.unitOk(unit)) return;
    const w = Core.fillBlank(P.creating ? { ...P.work, key: keyOf() || "newslide" } : P.work);
    if (Core.validate(unit, w).length) return;
    Core.applyAll(D, defaults, { ...S.units, [unit]: { value: w, at: Number.MAX_SAFE_INTEGER } });
    S.focus = Core.promoKey(unit);
    notify();
  }
  function arrayOp(op, path) {
    const parts = path.split(".");
    if (op === "add") {
      const arr = Core.getPath(P.work, path) || [], last = arr[arr.length - 1];
      const blank = (x) => (Core.isT(x) ? { vi: "", en: "", zh: "" } : Array.isArray(x) ? x.map(blank) : Core.isObj(x) ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, blank(y)])) : typeof x === "number" ? 0 : "");
      const item = last === undefined ? { vi: "", en: "", zh: "" } : Core.isT(last) ? blank(last) : Core.clone(last);
      P.work = Core.setPath(P.work, path, [...arr, item]);
    } else {
      const idx = Number(parts.pop()), arr = Core.clone(Core.getPath(P.work, parts.join(".")));
      arr.splice(idx, 1);
      P.work = Core.setPath(P.work, parts.join("."), arr);
    }
    renderMainKeep();
  }
  function renderMainKeep() { const m = $("#ed-main"); if (m) { m.innerHTML = mainHtml(); liveErrors(); if (P && P.drawer) { P.dirty = true; schedulePreview(); } } }
  async function saveUnit(force) {
    const el = $("#ed-errs");
    const r = await commit(P.unit, P.work, { force });
    handleResult(r, el, () => { toast(tx("saved")); if (P.drawer) closePanel(); else selectUnit(P.unit); }, "unit-force");
  }
  async function createPromo() {
    const key = keyOf() || Core.slugKey(P.work.name.en, takenKeys()), unit = `promo:${key}`, el = $("#ed-errs");
    if (!Core.unitOk(unit) || defaults.promos.some((p) => p.key === key) || (S.units[unit] && !S.units[unit].value.deleted)) return showErrors(el, [{ path: "key", code: Core.unitOk(unit) ? "dup" : "key" }], true);
    const r = await commit(unit, { ...P.work, key });
    handleResult(r, el, () => { toast(tx("saved")); if (P.drawer) { S.focus = key; closePanel(); notify(); } else selectUnit(unit); });
  }
  async function exportJson() {
    const blob = new Blob([JSON.stringify({ app: "tmgm-uu-dai", at: Date.now(), units: S.units }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `promos-edits-${today()}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function importJson(file) {
    let j;
    try { j = JSON.parse(await file.text()); } catch (e) { return toast(tx("importBad")); }
    if (!j || !j.units || typeof j.units !== "object") return toast(tx("importBad"));
    let n = 0;
    for (const [u, o] of Object.entries(j.units)) {
      if (!Core.unitOk(u) || !o || o.value === undefined) continue;
      if ((await commit(u, o.value, { force: true })).ok) n++;
    }
    toast(tx("importOk", { n }));
    renderPanel();
  }

  // ---------- sự kiện ----------
  function onClick(e) {
    const x = e.target.closest && e.target.closest("[data-ed-x]");
    if (x) { handle(x, e); return; }
    const inUi = e.target.closest && e.target.closest("#ed-pop, #ed-panel, #ed-bar, #ed-fab");
    const o = !inUi && e.target.closest && e.target.closest("[data-ed-open]"), nw = !inUi && e.target.closest && e.target.closest("[data-ed-new]");
    const dl = !inUi && e.target.closest && e.target.closest("[data-ed-del]");
    if (dl) { e.preventDefault(); e.stopPropagation(); deleteSlide(dl.dataset.edDel); return; } // nút "Xóa slide này": luôn dùng được
    if (o || nw) { e.preventDefault(); e.stopPropagation(); if (o) openDrawer(o.dataset.edOpen); else openDrawer(null, true); return; } // nút ở mỗi slide: luôn dùng được
    if (!S.on || inUi) return;
    const t = e.target.closest && e.target.closest("[data-ed]");
    if (t) { e.preventDefault(); e.stopPropagation(); openPop(t); }
    else if (popEl && !popEl.hidden) closePop();
  }
  function handle(x, e) {
    const k = x.dataset.edX, v = x.dataset.v;
    if (k === "addf") return; // ô chọn: để trình duyệt tự mở danh sách, xử lý ở sự kiện "change"
    e.preventDefault(); e.stopPropagation();
    switch (k) {
      case "toggle": S.on = !S.on; if (!S.on) { closePop(); } refreshChrome(); break;
      case "done": S.on = false; closePop(); refreshChrome(); break;
      case "data": openPanel(); break;
      case "close": closePanel(); break;
      case "pop-save": savePop(false); break;
      case "pop-force": savePop(true); break;
      case "pop-reset": resetPop(); break;
      case "pop-del": removePop(); break;
      case "pop-cancel": closePop(); break;
      case "pop-full": { const u = pop && pop.unit; closePop(); openDrawer(u); break; }
      case "tab": P.tab = v; P.unit = null; P.work = null; P.creating = false; renderPanel(); break;
      case "unit": { const gone = S.units[v] && S.units[v].value && S.units[v].value.deleted; if (gone) selectUnit(v); else { closePanel(); openDrawer(v); } break; }
      case "new": closePanel(); openDrawer(null, true); break;
      case "cancel-new": if (P.drawer) closePanel(); else { P = { ...P, creating: false, work: null, unit: null }; renderPanel(); } break;
      case "create": createPromo(); break;
      case "add": case "del": arrayOp(k, v); break;
      case "dropf": { const w = { ...P.work }; delete w[v]; P.work = w; renderMainKeep(); break; }
      case "json": { try { P.work = JSON.parse($("#ed-json").value); renderMainKeep(); } catch (err) { showErrors($("#ed-errs"), [{ path: "", code: "type" }], true); } break; }
      case "unit-save": saveUnit(false); break;
      case "unit-force": saveUnit(true); break;
      case "unit-discard": if (P.drawer) closePanel(); else selectUnit(P.unit); break;
      case "drawer-close": closePanel(); break;
      case "fillvi": P.work = Core.fillFromVi(P.work); P.dirty = true; renderMainKeep(); schedulePreview(); break;
      case "unit-reset": commit(P.unit, undefined).then((r) => handleResult(r, $("#ed-errs") || document.createElement("p"), () => { toast(tx("resetDone")); if (P.drawer) closePanel(); else selectUnit(P.unit); })); break;
      case "unit-delete": if (window.confirm(tx("confirmDel"))) { removePromo(P.unit).then(() => { toast(tx("saved")); if (P.drawer) closePanel(); else { P.unit = null; P.work = null; renderPanel(); } }); } break;
      case "restore": restore(v).then((r) => { if (r.ok) { toast(tx("saved")); renderPanel(); } }); break;
      case "export": exportJson(); break;
    }
  }
  function onInput(e) {
    const t = e.target;
    if (t.id === "ed-name") { ls.set(NAME, t.value.slice(0, 40)); return; }
    if (t.id === "ed-newkey") { P.key = t.value; P.keyTouched = true; P.dirty = true; liveErrors(); schedulePreview(); return; }
    if (t.dataset && t.dataset.fp) setFromInput(t);
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === "ed-import" && t.files && t.files[0]) { importJson(t.files[0]); t.value = ""; return; }
    if (t.dataset && t.dataset.edX === "addf") { if (!t.value) return; const k = t.value; const b3 = { vi: "", en: "", zh: "" }, empty = { note: b3, value: b3, url: "https://", image: "https://", order: 0, hidden: true, pics: [{ src: "img/", alt: b3 }] }[k] ?? P.work.until; P.work = { ...P.work, [k]: empty }; renderMainKeep(); return; }
    if (t.dataset && t.dataset.fp && (t.tagName === "SELECT" || t.type === "checkbox")) setFromInput(t);
  }
  function onKey(e) {
    if (e.key === "Escape") {
      if (panelEl && !panelEl.hidden) { if (P && P.drawer && P.dirty) toast(tx("unsaved")); else closePanel(); } // ngăn sửa đang dở: không đóng nhầm, dùng Hủy
      else if (popEl && !popEl.hidden) closePop();
    }
    else if (e.key === "Enter" && popEl && !popEl.hidden && e.target && e.target.tagName === "INPUT" && popEl.contains(e.target)) { e.preventDefault(); savePop(false); }
  }

  // ---------- giao diện công khai ----------
  const api = {
    attrs(unit, path) { return ` data-ed="${unit}" data-ep="${path}"${Core.isEdited(defaults, D, unit, path) ? ' data-edited="1"' : ""}`; },
    onChange(fn) { S.listeners.push(fn); },
    commit, restore, history, defaults, state: S, local: () => local, openDrawer, removePromo,
  };
  window.MIBEdit = api;

  Core.applyAll(D, defaults, local.units); // dữ liệu đã sửa trên máy này áp ngay, trước khi trang vẽ lần đầu
  S.units = local.units;
  if (!TEST && typeof document !== "undefined" && document.body) {
    build();
    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput);
    document.addEventListener("change", onChange);
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeprint", () => { S.on = false; refreshChrome(); });
  }
})();
