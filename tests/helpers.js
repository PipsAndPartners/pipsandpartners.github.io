// Công cụ dùng chung cho test: nạp content.js và chạy app.js trong DOM giả (không cần trình duyệt, không cần cài thêm gì).
// DOM giả chỉ ghi lại HTML mà app.render() tạo ra và cho phép "bắn" sự kiện vào các listener đã đăng ký.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

function loadContent() {
  const ctx = { window: {} };
  vm.runInNewContext(read("content.js"), ctx);
  return ctx.window.MIB;
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

// opts: { search, hash, store, today }
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
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    URLSearchParams,
    setInterval: () => 0,
    setTimeout: () => 0,
    clearTimeout() {},
    requestAnimationFrame: () => 0,
    addEventListener() {},
    navigator: {},
    Element: class {},
    __MIB_TEST__: {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ["content.js", "calc.js", "dates.js", "contact.js"]) vm.runInContext(read(f), ctx, { filename: f });
  ctx.MIB.meta.today = opts.today || "2026-10-09"; // cố định "hôm nay" để kết quả không đổi theo ngày chạy test
  vm.runInContext(read("app.js"), ctx, { filename: "app.js" });

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

module.exports = { loadContent, boot, target, click, input, read };
