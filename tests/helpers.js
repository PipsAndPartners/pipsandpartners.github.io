// Công cụ dùng chung cho test: nạp content.js và chạy app.js trong DOM giả (không cần trình duyệt, không cần cài thêm gì).
// DOM giả chỉ ghi lại HTML mà app.render() tạo ra và cho phép "bắn" sự kiện vào các listener đã đăng ký.
//
// Số liệu KM, so sánh sàn và các slide bị khóa nằm trong private/locked-source.json (không đẩy lên GitHub).
// Máy có file đó thì boot() mở khóa sẵn (trừ khi opts.locked); máy không có thì HAS_PRIVATE = false và test cần số thật được bỏ qua.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const PRIVATE_FILE = path.join(root, "private", "locked-source.json");
const HAS_PRIVATE = fs.existsSync(PRIVATE_FILE) && !process.env.PP_NO_PRIVATE; // PP_NO_PRIVATE=1: giả lập máy không có private/ (kiểm tra bộ test công khai chạy được một mình)
const loadLocked = () => JSON.parse(fs.readFileSync(PRIVATE_FILE, "utf8")); // bản mới mỗi lần gọi, test thoải mái sửa

// opts.locked = true: chỉ nội dung công khai (như người chưa nhập mã).
function loadContent(opts = {}) {
  const ctx = { window: {} };
  vm.runInNewContext(read("content.js"), ctx);
  const D = ctx.window.MIB;
  if (!opts.locked && HAS_PRIVATE) {
    const p = loadLocked();
    Object.assign(D, p.data);
    for (const [id, sec] of Object.entries(p.sections)) D.sections[id] = sec;
    D.privatePromos = p.promos;
  }
  return D;
}

// Dữ liệu trang ưu đãi (promotions/promos-data.js): window.PROMOS
function loadPromos() {
  const ctx = { window: {} };
  vm.runInNewContext(read("promotions/promos-data.js"), ctx);
  return ctx.window.PROMOS;
}

// Phần tử giả: mọi thuộc tính/phương thức đều trả về phần tử giả khác, gán giá trị thì bỏ qua.
function dummy() {
  return new Proxy(function () {}, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => "";
      if (k === "then") return undefined;
      if (k === "length") return 0;
      if (k === "style" || k === "dataset") return {};
      if (k === "value") return "";
      if (k === "classList") return { add() {}, remove() {}, toggle() {}, contains: () => false };
      return dummy();
    },
    set: () => true,
    apply: () => dummy(),
  });
}

// opts: { search, hash, store, today, locked, bundle }
//   bundle = gói mã hóa (window.PP_LOCKED) để thử PPLock.unlock/restore trong trang
function boot(opts = {}) {
  const listeners = {};
  const appEl = { innerHTML: "" };
  const store = { ...(opts.store || {}) };
  const document = {
    getElementById: (id) => (id === "app" ? appEl : dummy()),
    querySelector: () => dummy(),
    querySelectorAll: () => [],
    createElement: () => dummy(),
    body: dummy(),
    documentElement: { classList: { add() {}, remove() {}, toggle() {} }, style: {}, lang: "", requestFullscreen() {} },
    addEventListener: (type, fn) => (listeners[type] ||= []).push(fn),
    title: "",
    fullscreenElement: null,
  };
  const ctx = {
    document,
    location: { search: opts.search || "", hash: opts.hash || "", pathname: "/", href: "" },
    // Giống trình duyệt: replaceState đổi luôn location.hash (URL không có # thì hash rỗng)
    history: { replaceState(_s, _t, url) { if (typeof url === "string") { const i = url.indexOf("#"); ctx.location.hash = i < 0 ? "" : url.slice(i); } } },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    URLSearchParams,
    crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob,
    setInterval: () => 0,
    setTimeout: () => 0,
    clearTimeout() {},
    requestAnimationFrame: () => 0,
    addEventListener() {},
    navigator: {},
    Element: class {},
    __MIB_TEST__: {},
  };
  if (opts.bundle) ctx.PP_LOCKED = opts.bundle;
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ["content.js", "calc.js", "dates.js", "contact.js", "qr.js", "promotions/promos-data.js", "lock.js"]) vm.runInContext(read(f), ctx, { filename: f });
  ctx.MIB.meta.today = opts.today || "2026-10-09"; // cố định "hôm nay" để kết quả không đổi theo ngày chạy test
  vm.runInContext(read("app.js"), ctx, { filename: "app.js" });
  if (!opts.locked && HAS_PRIVATE) ctx.__MIB_TEST__.unlock(loadLocked());

  const fire = (type, evt = {}) => (listeners[type] || []).forEach((fn) => fn({ preventDefault() {}, stopPropagation() {}, ...evt }));
  return { ctx, app: appEl, store, fire, api: ctx.__MIB_TEST__, html: () => appEl.innerHTML };
}

// Mục tiêu sự kiện giả: dataset giống thuộc tính data-* của phần tử thật.
function target(dataset = {}, extra = {}) {
  return {
    dataset,
    closest(sel) {
      const m = /^\[data-([\w-]+)\]$/.exec(sel);
      if (!m) return null;
      const key = m[1].replace(/-(\w)/g, (_, c) => c.toUpperCase());
      return dataset[key] !== undefined ? this : null;
    },
    getAttribute: () => null,
    setAttribute() {},
    nextElementSibling: dummy(),
    ...extra,
  };
}
const click = (b, dataset, extra) => b.fire("click", { target: target(dataset, extra) });
const input = (b, dataset, value) => b.fire("input", { target: { ...target(dataset), value } });

module.exports = { loadContent, loadLocked, loadPromos, boot, target, click, input, read, root, HAS_PRIVATE };
