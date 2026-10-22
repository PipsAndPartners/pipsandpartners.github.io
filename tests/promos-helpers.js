// Công cụ test cho trang ưu đãi (promotions/): nạp promos-data.js và chạy promos.js trong DOM giả.
// Ưu đãi "chỉ chia sẻ riêng" nằm trong private/locked-source.json (xem lock.js): có file đó thì boot() nạp sẵn vào D.privatePromos
// (như người đã nhập mã); opts.unlock = false để giả lập người chưa có mã.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadLocked, HAS_PRIVATE, root: repoRoot } = require("./helpers.js");

const root = path.join(repoRoot, "promotions");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
// Ảnh riêng trong gói mã hóa là "@private/img/x.png" (lock.mjs nhúng thành data URL); khi test dùng dạng img/x.png như lúc hiển thị
const privatePromos = () => (HAS_PRIVATE ? JSON.parse(JSON.stringify(loadLocked().promos).split("@private/img/").join("img/")) : []);

function loadData(opts = {}) {
  const ctx = { window: {} };
  vm.runInNewContext(read("promos-data.js"), ctx);
  const D = ctx.window.PROMOS;
  if (opts.unlock !== false) D.extraPromos = [...D.extraPromos, ...privatePromos()]; // gộp lại thành một danh sách như trước khi tách phần mã hóa
  return D;
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

// opts: { search, hash, store, today, files, main, protocol, unlock, bundle }
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
    location: { search: opts.search || "", hash: opts.hash || "", pathname: "/promotions/", href: "", protocol: opts.protocol || "http:" },
    history: { replaceState(_s, _t, url) { if (typeof url === "string" && url.startsWith("#")) ctx.location.hash = url; } }, // như trình duyệt: đổi hash
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
  const files = opts.files || ["promos-data.js", "../dates.js", "../qr.js", "promo-art.js", "../lock.js", "edits-core.js", "edits.js"];
  for (const f of files) {
    vm.runInContext(read(f), ctx, { filename: f });
    if (f === "promos-data.js") {
      ctx.PROMOS.meta = { today: opts.today || "2026-10-12" }; // cố định "hôm nay" để kết quả không đổi theo ngày chạy test
      if (opts.unlock !== false) ctx.PROMOS.privatePromos = privatePromos();
    }
  }
  const main = opts.main || "promos.js";
  vm.runInContext(read(main), ctx, { filename: main });

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

module.exports = { loadData, boot, target, click, input, read, root, HAS_PRIVATE };
