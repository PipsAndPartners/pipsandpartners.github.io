// Khóa bằng mã truy cập (lock.js): mã hóa AES-GCM, mỗi mã một ô, sai mã/ô lạ/dữ liệu bị sửa thì không mở được.
// Dùng iter nhỏ cho nhanh; bài kiểm tra cuối đọc locked.js thật (600.000 vòng PBKDF2).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Lock = require("../lock.js");
const { HAS_PRIVATE, root } = require("./helpers.js");

const DATA = { data: { tiers: [1300, 3000, 20000] }, sections: { m2: { title: "bí mật xyz" } }, promos: [{ key: "vip", pics: [{ src: "data:image/png;base64,AAAA" }] }] };
const ITER = 1000;
const plain = (v) => JSON.parse(JSON.stringify(v)); // dữ liệu giải mã từ vm khác realm: so sánh bằng bản sao thuần

test("mã mới: dạng PP-XXXX-XXXX-XXXX-XXXX, chỉ dùng ký tự dễ đọc (không O/0/I/1), không trùng nhau, mã định danh không trùng", () => {
  const seen = new Set(), ids = [];
  for (let i = 0; i < 200; i++) {
    const c = Lock.generateCode(ids);
    assert.match(c, /^PP(-[A-HJ-NP-Z2-9]{4}){4}$/);
    assert.ok(!seen.has(c));
    seen.add(c);
    ids.push(Lock.parse(c).id);
  }
  assert.equal(new Set(ids).size, 200);
});

test("parse: không phân biệt hoa/thường, khoảng trắng, gạch ngang; thiếu PP vẫn nhận; sai dạng thì null", () => {
  const c = "PP-K7M2-ABCD-EFGH-JKLM", p = Lock.parse(c);
  assert.deepEqual(plain(p), { norm: "PPK7M2ABCDEFGHJKLM", id: "K7M2" });
  for (const v of ["pp-k7m2-abcd-efgh-jklm", " PP K7M2 ABCD EFGH JKLM ", "ppk7m2abcdefghjklm", "K7M2-ABCD-EFGH-JKLM"]) assert.deepEqual(plain(Lock.parse(v)), plain(p), v);
  for (const v of ["", null, undefined, "PP-K7M2", "PP-K7M2-ABCD-EFGH-JKL0", "PP-K7M2-ABCD-EFGH-JKLMN", 12345]) assert.equal(Lock.parse(v), null, String(v));
});

test("seal/open: đúng mã mở được và ra đúng dữ liệu; hai mã cùng mở một nội dung", async () => {
  const a = Lock.generateCode(), b = Lock.generateCode([Lock.parse(a).id]);
  const { bundle, contentKey } = await Lock.seal(DATA, [a, b], { iter: ITER });
  assert.equal(bundle.v, 1);
  assert.equal(Object.keys(bundle.slots).length, 2);
  for (const code of [a, b, a.toLowerCase(), a.replace(/-/g, "")]) {
    const r = await Lock.open(bundle, code);
    assert.deepEqual(plain(r.data), DATA, code);
    assert.deepEqual([...r.key], [...contentKey]);
  }
});

test("sai mã không mở được: sai phần bí mật, mã định danh lạ, dạng sai, rỗng", async () => {
  const code = Lock.generateCode();
  const { bundle } = await Lock.seal(DATA, [code], { iter: ITER });
  const id = Lock.parse(code).id;
  const wrongSecret = `PP-${id}-AAAA-AAAA-AAAA`;
  assert.equal(await Lock.open(bundle, wrongSecret), null);
  assert.equal(await Lock.open(bundle, "PP-ZZZZ-AAAA-AAAA-AAAA"), null);
  for (const v of ["", "abc", null, undefined]) assert.equal(await Lock.open(bundle, v), null);
});

test("dữ liệu bị sửa (một byte của nội dung hoặc của ô) thì không mở được", async () => {
  const code = Lock.generateCode();
  const { bundle } = await Lock.seal(DATA, [code], { iter: ITER });
  const flip = (b64) => { const u = Lock.fromB64(b64); u[0] ^= 1; return Lock.toB64(u); };
  assert.equal(await Lock.open({ ...bundle, ct: flip(bundle.ct) }, code), null);
  const id = Lock.parse(code).id;
  assert.equal(await Lock.open({ ...bundle, slots: { [id]: { ...bundle.slots[id], c: flip(bundle.slots[id].c) } } }, code), null);
});

test("thu hồi: gói mới đổi khóa nội dung không còn mở được bằng mã đã bỏ, và khóa cũ không giải được gói mới", async () => {
  const keep = Lock.generateCode(), gone = Lock.generateCode([Lock.parse(keep).id]);
  const v1 = await Lock.seal(DATA, [keep, gone], { iter: ITER });
  const v2 = await Lock.seal(DATA, [keep], { iter: ITER }); // khóa nội dung mới
  assert.ok(await Lock.open(v2.bundle, keep));
  assert.equal(await Lock.open(v2.bundle, gone), null);
  assert.equal(await Lock.openWithKey(v2.bundle, v1.contentKey), null);
  assert.ok(await Lock.openWithKey(v1.bundle, v1.contentKey));
});

test("giữ khóa nội dung (contentKey truyền vào): người đã nhập mã vẫn mở được gói cập nhật", async () => {
  const code = Lock.generateCode();
  const v1 = await Lock.seal(DATA, [code], { iter: ITER });
  const v2 = await Lock.seal({ ...DATA, data: { tiers: [1] } }, [code], { iter: ITER, contentKey: v1.contentKey });
  assert.deepEqual(plain(await Lock.openWithKey(v2.bundle, Lock.toB64(v1.contentKey))), { ...DATA, data: { tiers: [1] } });
});

test("seal từ chối mã sai dạng hoặc trùng mã định danh", async () => {
  await assert.rejects(Lock.seal(DATA, ["PP-oops"], { iter: ITER }), /không đúng dạng/);
  const a = "PP-K7M2-AAAA-BBBB-CCCC", b = "PP-K7M2-DDDD-EEEE-FFFF";
  await assert.rejects(Lock.seal(DATA, [a, b], { iter: ITER }), /Trùng/);
});

test("gói mã hóa không chứa chữ gốc (kể cả khóa nội dung, ảnh nhúng)", async () => {
  const code = Lock.generateCode();
  const { bundle, contentKey } = await Lock.seal(DATA, [code], { iter: ITER });
  const txt = JSON.stringify(bundle);
  for (const leak of ["bí mật xyz", "20000", "data:image", "vip", code, Lock.toB64(contentKey)]) assert.ok(!txt.includes(leak), leak);
  assert.ok(!Buffer.from(bundle.ct, "base64").includes("bí mật"));
});

// ---- phần trình duyệt (PPLock trong một cửa sổ giả) ----
function browser(bundle, store = {}) {
  const ctx = { crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob, PP_LOCKED: bundle, localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "lock.js"), "utf8"), ctx);
  return { L: ctx.PPLock, store, ctx };
}

test("trình duyệt: unlock đúng mã → trả dữ liệu và nhớ khóa; restore lần sau không cần mã; forget xóa khóa", async () => {
  const code = Lock.generateCode();
  const { bundle } = await Lock.seal(DATA, [code], { iter: ITER });
  const b = browser(bundle);
  assert.equal(b.L.supported(), true);
  assert.equal(await b.L.unlock("PP-AAAA-BBBB-CCCC-DDDD"), null);
  assert.equal(b.store[Lock.STORE_KEY], undefined, "mã sai không được nhớ");
  assert.deepEqual(plain(await b.L.unlock(code)), DATA);
  assert.ok(b.store[Lock.STORE_KEY]);
  const again = browser(bundle, b.store);
  assert.deepEqual(plain(await again.L.restore()), DATA);
  again.L.forget();
  assert.equal(again.store[Lock.STORE_KEY], undefined);
  assert.equal(await again.L.restore(), null);
});

test("trình duyệt: khóa đã nhớ nhưng nội dung đã đổi khóa (thu hồi) thì tự xóa và vẫn khóa", async () => {
  const code = Lock.generateCode();
  const v1 = await Lock.seal(DATA, [code], { iter: ITER }), v2 = await Lock.seal(DATA, [code], { iter: ITER });
  const b1 = browser(v1.bundle);
  await b1.L.unlock(code);
  const b2 = browser(v2.bundle, b1.store);
  assert.equal(await b2.L.restore(), null);
  assert.equal(b2.store[Lock.STORE_KEY], undefined);
});

test("trình duyệt: không có Web Crypto hoặc không có gói thì unlock báo 'unsupported', restore trả null", async () => {
  const code = Lock.generateCode();
  const { bundle } = await Lock.seal(DATA, [code], { iter: ITER });
  const noCrypto = browser(bundle);
  noCrypto.ctx.crypto = undefined;
  assert.equal(noCrypto.L.supported(), false);
  await assert.rejects(noCrypto.L.unlock(code), /unsupported/);
  assert.equal(await noCrypto.L.restore(), null);
  const noBundle = browser(undefined);
  await assert.rejects(noBundle.L.unlock(code), /unsupported/);
});

// ---- locked.js thật ----
test("locked.js: là gói hợp lệ, ≥ 600.000 vòng PBKDF2, mỗi mã một ô, không lộ chữ gốc", () => {
  const f = path.join(root, "locked.js");
  assert.ok(fs.existsSync(f), "chạy node scripts/lock.mjs để tạo locked.js");
  const src = fs.readFileSync(f, "utf8");
  const ctx = {};
  vm.runInNewContext(src, { window: ctx });
  const b = ctx.PP_LOCKED;
  assert.equal(b.v, 1);
  assert.ok(b.iter >= 600000, `iter ${b.iter}`);
  assert.ok(Object.keys(b.slots).length >= 1);
  for (const k of Object.keys(b.slots)) assert.match(k, /^[A-HJ-NP-Z2-9]{4}$/);
  for (const leak of ["competitors", "mibTiers", "ibCombined", "Exness", "thaiConcert", "premier-tickets", "data:image"]) assert.ok(!src.includes(leak), leak);
});

test("locked.js khớp private/: mọi mã trong private/codes.json mở được và ra đúng nội dung nguồn", { skip: !HAS_PRIVATE && "không có thư mục private/" }, async () => {
  const codes = JSON.parse(fs.readFileSync(path.join(root, "private", "codes.json"), "utf8"));
  const ctx = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, "locked.js"), "utf8"), { window: ctx });
  assert.equal(Object.keys(ctx.PP_LOCKED.slots).length, codes.length);
  const first = await Lock.open(ctx.PP_LOCKED, codes[0].code);
  assert.ok(first, "mã đầu tiên mở được");
  assert.deepEqual(Object.keys(first.data).sort(), ["data", "promos", "sections"]);
  assert.deepEqual(Object.keys(first.data.data).sort(), ["competitors", "ibTiers", "mibTierPresets", "mibTiers"]);
  assert.ok(first.data.promos.every((p) => (p.pics || []).every((x) => !x.src.startsWith("@private/"))), "ảnh riêng đã nhúng data URL");
  for (const c of codes.slice(1)) assert.ok(await Lock.open(ctx.PP_LOCKED, c.code), c.name);
});
