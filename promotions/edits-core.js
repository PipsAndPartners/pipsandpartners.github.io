/*
 * Lõi chỉnh sửa số liệu (logic thuần, không đụng DOM): dùng chung cho trình duyệt (window.MIBEditCore),
 * test (node).
 *
 * Mô hình: dữ liệu mặc định nằm trong promos-data.js. Mỗi "đơn vị" (unit) là một phần dữ liệu có thể sửa; người dùng
 * lưu GIÁ TRỊ MỚI của cả đơn vị đó (override). Không có override thì dùng mặc định. Đơn vị (và chỉ những đơn vị này):
 *   cover (chữ bìa và danh sách), contact (liên hệ), và "promo:<key>" (mỗi ưu đãi một đơn vị).
 * Ưu đãi bị xóa = override { deleted: true }; ưu đãi mới = "promo:<key>" chưa có trong mặc định.
 */
(function (root) {
  const FIXED = ["cover", "contact"];
  const OPTIONAL = ["note", "url", "regUntil", "image", "order", "value", "pics", "hidden"]; // trường tùy chọn của một ưu đãi (xóa được)
  const COVER_KEYS = ["coverKicker", "coverTitle", "coverSub", "indexTitle", "indexHint", "contactTitle", "contactSub"];
  const ART_KEYS = ["gifts", "pumpkin", "credit", "gadget", "rocket", "welcome", "scooter", "concert", "tickets", "travel", "football"];
  const ICONS = ["coins", "gift", "zap", "user", "user-plus", "users", "trophy", "calendar", "image", "file", "chart", "link", "building", "monitor"];
  const GROUPS = ["small", "marketing", "followup"];
  const SHARES = ["public", "private"];
  const DATE_KEYS = new Set(["from", "until", "regUntil", "to"]);
  const URL_KEYS = new Set(["url", "image"]);
  const LOCAL_IMG = /^img\/[A-Za-z0-9_-]{1,60}\.(?:png|jpe?g|webp|gif)$/;
  const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const HISTORY_MAX = 60;
  const MAX_JSON = 60000, MAX_STR = 600, MAX_ARR = 60, MAX_DEPTH = 7;
  const PROMO_RE = /^promo:([a-z][A-Za-z0-9]{1,30})$/;
  const UNIT_RE = new RegExp(`^(?:${FIXED.join("|")}|promo:[a-z][A-Za-z0-9]{1,30})$`);

  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const isT = (v) => isObj(v) && Object.keys(v).length === 3 && ["vi", "en", "zh"].every((k) => typeof v[k] === "string");
  const unitOk = (u) => typeof u === "string" && UNIT_RE.test(u);
  const promoKey = (u) => { const m = PROMO_RE.exec(u); return m ? m[1] : null; };

  // ---------- đọc / ghi một đơn vị trong dữ liệu D (window.PROMOS) ----------
  function get(D, unit) {
    if (unit === "cover") return Object.fromEntries(COVER_KEYS.map((k) => [k, D.promoPage[k]]));
    if (unit === "contact") return D.contact;
    const k = promoKey(unit);
    if (k) return D.extraPromos.find((p) => p.key === k);
    return undefined;
  }
  // Ghi tại chỗ (không thay đối tượng) để mã trang giữ tham chiếu vẫn thấy dữ liệu mới
  function set(D, unit, value) {
    if (unit === "cover") Object.assign(D.promoPage, value);
    else if (unit === "contact") { Object.keys(D.contact).forEach((k) => delete D.contact[k]); Object.assign(D.contact, value); }
  }

  // Ảnh chụp dữ liệu mặc định (gọi một lần, trước khi áp bất kỳ override nào)
  function snapshot(D) {
    const fixed = {};
    FIXED.forEach((u) => { fixed[u] = clone(get(D, u)); });
    return { fixed, promos: clone(D.extraPromos) };
  }
  const defaultOf = (defaults, unit) => (promoKey(unit) ? defaults.promos.find((p) => p.key === promoKey(unit)) : defaults.fixed[unit]);

  // Áp toàn bộ override (units = { [unit]: { value, by, at } }) lên D; unit không có override thì về mặc định
  function applyAll(D, defaults, units) {
    units = units || {};
    FIXED.forEach((u) => set(D, u, clone(units[u] ? units[u].value : defaults.fixed[u])));
    const list = [], known = new Set(defaults.promos.map((p) => p.key));
    defaults.promos.forEach((p) => {
      const o = units[`promo:${p.key}`];
      if (!o) list.push(clone(p));
      else if (!o.value.deleted) list.push(clone(o.value));
    });
    Object.keys(units)
      .filter((u) => promoKey(u) && !known.has(promoKey(u)) && !units[u].value.deleted)
      .sort((a, b) => (units[a].at || 0) - (units[b].at || 0) || a.localeCompare(b))
      .forEach((u) => list.push(clone(units[u].value)));
    D.extraPromos.splice(0, D.extraPromos.length, ...list);
    return D;
  }

  // Danh sách đơn vị hiện có: cố định + ưu đãi mặc định + ưu đãi mới (kể cả đã xóa)
  function unitIds(defaults, units) {
    const ids = [...FIXED, ...defaults.promos.map((p) => `promo:${p.key}`)];
    Object.keys(units || {}).forEach((u) => { if (promoKey(u) && !ids.includes(u)) ids.push(u); });
    return ids;
  }

  // ---------- đường dẫn "a.0.b" ----------
  const segs = (path) => (path === "" || path == null ? [] : String(path).split(".").map((s) => (/^\d+$/.test(s) ? Number(s) : s)));
  function getPath(obj, path) {
    let cur = obj;
    for (const s of segs(path)) { if (cur == null || BAD_KEYS.has(s)) return undefined; cur = cur[s]; }
    return cur;
  }
  // Trả về bản sao của obj đã gán val vào path (không sửa obj gốc)
  function setPath(obj, path, val) {
    const out = clone(obj), parts = segs(path);
    if (!parts.length) return clone(val);
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const s = parts[i];
      if (BAD_KEYS.has(s)) throw new RangeError("path");
      if (cur[s] == null) cur[s] = typeof parts[i + 1] === "number" ? [] : {};
      cur = cur[s];
    }
    const last = parts[parts.length - 1];
    if (BAD_KEYS.has(last)) throw new RangeError("path");
    cur[last] = clone(val);
    return out;
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Số liệu ở path (của đơn vị) có khác mặc định không (path rỗng = cả đơn vị)
  function isEdited(defaults, D, unit, path) {
    const def = defaultOf(defaults, unit), cur = get(D, unit);
    if (def === undefined) return cur !== undefined; // ưu đãi mới thêm
    if (cur === undefined) return true; // ưu đãi đã xóa
    return !same(getPath(def, path), getPath(cur, path));
  }

  // ---------- kiểm tra ----------
  const validDate = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return false;
    const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3];
  };
  const err = (errs, path, code, arg) => errs.push({ path, code, arg });

  function walk(v, path, key, errs, depth) {
    if (depth > MAX_DEPTH) return err(errs, path, "depth");
    if (v === null || typeof v === "boolean") return;
    if (typeof v === "number") { if (!Number.isFinite(v) || v < 0) err(errs, path, "num"); return; }
    if (typeof v === "string") {
      if (v.length > MAX_STR) err(errs, path, "long");
      else if (/[<\u0000-\u001f]/.test(v)) err(errs, path, "chars"); // chỉ chặn "<" (không tạo được thẻ HTML); ">" vẫn dùng được, vd "FTD > 0"
      else if (DATE_KEYS.has(key) && !validDate(v)) err(errs, path, "date");
      else if (key === "src" && !LOCAL_IMG.test(v) && !/^https:\/\/[^\s"'<>\x60]+$/.test(v)) err(errs, path, "src");
      else if (URL_KEYS.has(key) && !/^https:\/\/[^\s"'<>\x60]+$/.test(v)) err(errs, path, "url"); // không cho " ' < > ` để link không thoát khỏi thuộc tính HTML
      return;
    }
    if (Array.isArray(v)) {
      if (v.length > MAX_ARR) return err(errs, path, "count", MAX_ARR);
      v.forEach((x, i) => walk(x, path ? `${path}.${i}` : String(i), key, errs, depth + 1));
      return;
    }
    if (isObj(v)) {
      if (isT(v)) { ["vi", "en", "zh"].forEach((l) => { const p = `${path}.${l}`; if (!v[l].trim()) err(errs, p, "t3"); else walk(v[l], p, "", errs, depth + 1); }); return; }
      const keys = Object.keys(v);
      if (keys.length > MAX_ARR) return err(errs, path, "count", MAX_ARR);
      keys.forEach((k) => {
        if (BAD_KEYS.has(k) || !/^[A-Za-z0-9_]{1,40}$/.test(k)) err(errs, path ? `${path}.${k}` : k, "key");
        else walk(v[k], path ? `${path}.${k}` : k, k, errs, depth + 1);
      });
      return;
    }
    err(errs, path, "type");
  }

  function promoRules(errs, v, id) {
    if (v.deleted === true) return Object.keys(v).length === 1 || err(errs, "", "key");
    if (v.key !== promoKey(id)) err(errs, "key", "key");
    if (!GROUPS.includes(v.group)) err(errs, "group", "enum");
    if (!SHARES.includes(v.share)) err(errs, "share", "enum");
    if (v.icon !== undefined && !ICONS.includes(v.icon)) err(errs, "icon", "enum");
    if (!ART_KEYS.includes(v.art)) err(errs, "art", "enum");
    ["name", "seg", "headline", "sub"].forEach((f) => { if (!isT(v[f])) err(errs, f, "required"); });
    ["value", "note"].forEach((f) => { if (v[f] !== undefined && !isT(v[f])) err(errs, f, "required"); });
    if (v.order !== undefined && !(Number.isInteger(v.order) && v.order <= 999)) err(errs, "order", "int");
    if (v.hidden !== undefined && typeof v.hidden !== "boolean") err(errs, "hidden", "type");
    if (v.pics !== undefined && (!Array.isArray(v.pics) || v.pics.length > 4 || !v.pics.every((x) => isObj(x) && typeof x.src === "string" && x.src && isT(x.alt)))) err(errs, "pics", "count", "0–4");
    if (!validDate(v.from)) err(errs, "from", "date");
    if (!validDate(v.until)) err(errs, "until", "date");
    if (validDate(v.from) && validDate(v.until) && v.from > v.until) err(errs, "until", "order");
    if (v.regUntil !== undefined && validDate(v.regUntil) && validDate(v.from) && validDate(v.until) && (v.regUntil < v.from || v.regUntil > v.until)) err(errs, "regUntil", "order");
    if (!Array.isArray(v.steps) || v.steps.length < 2 || v.steps.length > 4 || !v.steps.every(isT)) err(errs, "steps", "count", "2–4");
    if (!Array.isArray(v.rules) || v.rules.length < 1 || !v.rules.every(isT)) err(errs, "rules", "count", "1+");
    if (v.group === "followup" && v.regUntil === undefined) err(errs, "regUntil", "required");
  }
  function check(unit, v, errs) {
    if (unit === "cover") {
      COVER_KEYS.forEach((k) => { if (!isT(v[k])) err(errs, k, "required"); });
      Object.keys(v).forEach((k) => { if (!COVER_KEYS.includes(k)) err(errs, k, "key"); });
    } else if (unit === "contact") {
      if (typeof v.name !== "string" || !v.name.trim()) err(errs, "name", "required");
      if (!isT(v.title)) err(errs, "title", "required");
      if (!isT(v.register)) err(errs, "register", "required");
      if (typeof v.telegram !== "string" || !/^[A-Za-z0-9_]{3,32}$/.test(v.telegram)) err(errs, "telegram", "handle");
      if (typeof v.whatsapp !== "string" || !/^\+?[0-9 ]{6,20}$/.test(v.whatsapp)) err(errs, "whatsapp", "phone");
      if (typeof v.whatsappLink !== "string" || !/^[0-9]{6,15}$/.test(v.whatsappLink)) err(errs, "whatsappLink", "phone");
      if (typeof v.url !== "string" || !v.url) err(errs, "url", "required");
    } else if (promoKey(unit)) promoRules(errs, v, unit);
  }

  // Trả về mảng lỗi { path, code, arg } (rỗng = hợp lệ)
  function validate(unit, value) {
    const errs = [];
    if (!unitOk(unit)) return [{ path: "", code: "unit" }];
    let size = 0;
    try { size = JSON.stringify(value).length; } catch (e) { return [{ path: "", code: "type" }]; }
    if (value === undefined || size > MAX_JSON) return [{ path: "", code: "size" }];
    walk(value, "", "", errs, 0);
    if (!errs.length) check(unit, value, errs);
    return errs;
  }

  // ---------- hàm thuần cho ngăn sửa (xem trước, slide mới) ----------
  // Chữ trống ở ô 3 ngôn ngữ → "…" (chỉ để xem trước khi đang điền dở; không bao giờ lưu)
  const fillBlank = (v) => (isT(v) ? Object.fromEntries(Object.entries(v).map(([k, s]) => [k, s.trim() ? s : "…"]))
    : Array.isArray(v) ? v.map(fillBlank) : isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillBlank(x)])) : v);
  // Ô EN / 中文 còn trống lấy chữ VI (không tự dịch; người dùng chỉnh lại)
  const fillFromVi = (v) => (isT(v) ? { vi: v.vi, en: v.en.trim() ? v.en : v.vi, zh: v.zh.trim() ? v.zh : v.vi }
    : Array.isArray(v) ? v.map(fillFromVi) : isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillFromVi(x)])) : v);
  // Mã slide từ tên: camelCase không dấu, bắt đầu bằng chữ cái, tối đa 30 ký tự, không trùng `taken`
  function slugKey(name, taken) {
    const words = String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().match(/[a-z0-9]+/g) || [];
    let base = words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join("");
    if (!/^[a-z]/.test(base)) base = `slide${base}`;
    base = base.slice(0, 28);
    if (base.length < 2) base = "slide";
    let k = base, n = 2;
    while ((taken || []).includes(k)) k = `${base}${n++}`;
    return k;
  }
  // Mẫu slide mới (cùng bố cục các slide khác): 3 bước, 2 điều kiện, hình có sẵn
  const blank3 = () => ({ vi: "", en: "", zh: "" });
  const newPromo = (todayIso, untilIso) => ({
    key: "", group: "small", share: "public", art: "gifts", from: todayIso, until: untilIso,
    name: blank3(), headline: blank3(), sub: blank3(), seg: blank3(),
    steps: [blank3(), blank3(), blank3()], rules: [blank3(), blank3()],
  });

  // Xóa một dòng/mục theo đường dẫn (không sửa obj gốc): phần tử của danh sách (điều kiện, bước, ảnh, bậc vé, hàng bảng...)
  // hoặc trường tùy chọn ở gốc (`optional` = danh sách khóa được phép). Trả null nếu mục đó không xóa được.
  // Danh sách cấp gốc xóa hết phần tử thì bỏ luôn trường; kiểm tra (validate) sẽ báo nếu trường đó bắt buộc (vd rules cần ít nhất 1).
  function removeAt(obj, path, optional) {
    const parts = path === "" || path == null ? [] : String(path).split(".");
    for (let i = parts.length - 1; i >= 0; i--) {
      if (!/^\d+$/.test(parts[i])) continue;
      const arrPath = parts.slice(0, i).join("."), arr = getPath(obj, arrPath), el = Array.isArray(arr) ? arr[+parts[i]] : undefined;
      if (el === null || typeof el !== "object") continue; // ô đơn (số, chữ) thì xét mức ngoài: cả hàng
      const next = clone(arr);
      next.splice(+parts[i], 1);
      if (next.length) return setPath(obj, arrPath, next);
      if (i === 1) { const w = clone(obj); delete w[parts[0]]; return w; }
      return null;
    }
    if (parts.length === 1 && (optional || []).includes(parts[0])) { const w = clone(obj); delete w[parts[0]]; return w; }
    return null;
  }

  // ---------- lịch sử ----------
  const entry = ({ unit, action, prev, next, by, at }) => ({ id: `${String(at).padStart(13, "0")}-${Math.random().toString(36).slice(2, 7)}`, at, by: String(by || "").slice(0, 40), unit, action, prev: prev === undefined ? null : prev, next: next === undefined ? null : next });

  const api = { removeAt, OPTIONAL, fillBlank, fillFromVi, slugKey, newPromo, FIXED, COVER_KEYS, ART_KEYS, ICONS, GROUPS, SHARES, HISTORY_MAX, MAX_JSON, clone, isT, isObj, unitOk, promoKey, get, set, snapshot, defaultOf, applyAll, unitIds, getPath, setPath, isEdited, validate, validDate, entry };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MIBEditCore = api;
})(this);
