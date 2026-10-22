/*
 * Khóa nội dung bằng mã truy cập (trang tĩnh, không có máy chủ).
 * Nội dung nhạy cảm được mã hóa AES-256-GCM bằng một khóa nội dung ngẫu nhiên; khóa đó được "bọc" riêng cho từng mã
 * truy cập (PBKDF2-SHA256 → AES-GCM). Mã có dạng PP-XXXX-XXXX-XXXX-XXXX: nhóm đầu sau PP là mã định danh công khai
 * (chọn đúng ô cần giải), 12 ký tự còn lại là phần bí mật (~60 bit).
 *
 * Trình duyệt: window.PPLock (nạp locked.js trước để có window.PP_LOCKED). Node: require("./lock.js") (dùng cho scripts/lock.mjs và test).
 * Khóa đã giải được nhớ trong localStorage ("pp-key") để lần sau không phải nhập lại; sai khóa (đã thu hồi/đổi) thì tự xóa.
 */
(function (root) {
  "use strict";
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 ký tự, bỏ O/0/I/1 cho dễ đọc
  const ITER = 600000;
  const STORE_KEY = "pp-key";
  const te = new TextEncoder(), td = new TextDecoder();
  const cr = () => (typeof globalThis !== "undefined" && globalThis.crypto) || root.crypto;
  const subtle = () => { const c = cr(); return c && c.subtle; };

  const toB64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
  const rand = (n) => cr().getRandomValues(new Uint8Array(n));

  // "pp-k7m2-abcd..." → { norm: "PPK7M2ABCD...", id: "K7M2" }; sai dạng → null
  function parse(code) {
    let n = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (n.length === 16) n = "PP" + n;
    return /^PP[A-HJ-NP-Z2-9]{16}$/.test(n) ? { norm: n, id: n.slice(2, 6) } : null;
  }

  // Mã mới: PP-<id 4>-<bí mật 12>, id chưa dùng
  function generateCode(taken = []) {
    for (;;) {
      const b = rand(16);
      const ch = Array.from(b, (x) => ALPHABET[x & 31]).join("");
      if (taken.includes(ch.slice(0, 4))) continue;
      return `PP-${ch.slice(0, 4)}-${ch.slice(4, 8)}-${ch.slice(8, 12)}-${ch.slice(12, 16)}`;
    }
  }

  async function wrapKey(norm, salt, iter) {
    const base = await subtle().importKey("raw", te.encode(norm), "PBKDF2", false, ["deriveKey"]);
    return subtle().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  const aesKey = (raw, usage) => subtle().importKey("raw", raw, "AES-GCM", false, usage);

  // data: object JSON được; codes: ["PP-...", ...]; opts: { iter, contentKey (Uint8Array 32) }
  async function seal(data, codes, opts = {}) {
    const iter = opts.iter || ITER, key = opts.contentKey || rand(32);
    const iv = rand(12);
    const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, await aesKey(key, ["encrypt"]), te.encode(JSON.stringify(data))));
    const slots = {};
    for (const code of codes) {
      const p = parse(code);
      if (!p) throw new Error(`Mã không đúng dạng: ${code}`);
      if (slots[p.id]) throw new Error(`Trùng mã định danh ${p.id}`);
      const salt = rand(16), siv = rand(12);
      const wrapped = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv: siv }, await wrapKey(p.norm, salt, iter), key));
      slots[p.id] = { s: toB64(salt), i: toB64(siv), c: toB64(wrapped) };
    }
    return { bundle: { v: 1, iter, iv: toB64(iv), ct: toB64(ct), slots }, contentKey: key };
  }

  async function openWithKey(bundle, key) {
    try {
      const k = typeof key === "string" ? fromB64(key) : key;
      const plain = await subtle().decrypt({ name: "AES-GCM", iv: fromB64(bundle.iv) }, await aesKey(k, ["decrypt"]), fromB64(bundle.ct));
      return JSON.parse(td.decode(plain));
    } catch (e) { return null; }
  }

  // Trả { data, key } nếu mã đúng, ngược lại null
  async function open(bundle, code) {
    const p = parse(code), slot = p && bundle && bundle.slots && bundle.slots[p.id];
    if (!slot) return null;
    let key;
    try {
      key = new Uint8Array(await subtle().decrypt({ name: "AES-GCM", iv: fromB64(slot.i) }, await wrapKey(p.norm, fromB64(slot.s), bundle.iter), fromB64(slot.c)));
    } catch (e) { return null; }
    const data = await openWithKey(bundle, key);
    return data ? { data, key } : null;
  }

  // ---- phần dùng trong trình duyệt ----
  const ls = {
    get: (k) => { try { return root.localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) { /* bị chặn: bỏ qua */ } },
    del: (k) => { try { root.localStorage.removeItem(k); } catch (e) { /* bỏ qua */ } },
  };
  const bundle = () => root.PP_LOCKED || null;
  const supported = () => !!(bundle() && subtle());

  // Nhập mã: đúng thì nhớ khóa và trả dữ liệu; sai thì trả null; trình duyệt không hỗ trợ thì ném lỗi "unsupported"
  async function unlock(code) {
    if (!supported()) throw new Error("unsupported");
    const r = await open(bundle(), code);
    if (!r) return null;
    ls.set(STORE_KEY, toB64(r.key));
    return r.data;
  }
  // Mở lại bằng khóa đã nhớ (không cần nhập); khóa hỏng hoặc đã đổi thì xóa
  async function restore() {
    const k = ls.get(STORE_KEY);
    if (!k || !supported()) return null;
    const data = await openWithKey(bundle(), k);
    if (!data) ls.del(STORE_KEY);
    return data;
  }
  const forget = () => ls.del(STORE_KEY);

  const api = { ALPHABET, ITER, STORE_KEY, parse, generateCode, seal, open, openWithKey, unlock, restore, forget, supported, toB64, fromB64 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PPLock = api;
})(typeof window !== "undefined" ? window : this);
