// scripts/lock.mjs: tạo locked.js từ private/locked-source.json trong một thư mục tạm (không đụng file thật).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const Lock = require("../lock.js");

const ITER = 1000;
const plain = (v) => JSON.parse(JSON.stringify(v));
function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pp-lock-"));
  fs.mkdirSync(path.join(root, "private", "img"), { recursive: true });
  fs.writeFileSync(path.join(root, "private", "img", "t.png"), Buffer.from([137, 80, 78, 71, 1, 2, 3]));
  fs.writeFileSync(path.join(root, "private", "locked-source.json"), JSON.stringify({ data: { secret: 12345 }, sections: {}, promos: [{ key: "p", pics: [{ src: "@private/img/t.png" }] }] }));
  return root;
}
const load = (file) => { const w = {}; vm.runInNewContext(fs.readFileSync(file, "utf8"), { window: w }); return w.PP_LOCKED; };
const build = async (opts) => (await import("../scripts/lock.mjs")).build({ iter: ITER, ...opts });

test("lần đầu: tạo 6 mã mặc định (có tên), ghi codes.json và lock-state.json, locked.js mở được bằng từng mã", async () => {
  const root = project();
  const r = await build({ root });
  assert.equal(r.codes.length, 6);
  assert.equal(r.codes[0].name, "Precy (demo)");
  assert.equal(new Set(r.codes.map((c) => Lock.parse(c.code).id)).size, 6);
  assert.deepEqual(plain(JSON.parse(fs.readFileSync(path.join(root, "private", "codes.json"), "utf8"))), plain(r.codes));
  assert.ok(JSON.parse(fs.readFileSync(path.join(root, "private", "lock-state.json"), "utf8")).contentKey);
  const bundle = load(path.join(root, "locked.js"));
  assert.equal(bundle.iter, ITER);
  for (const c of r.codes) assert.deepEqual(plain((await Lock.open(bundle, c.code)).data.data), { secret: 12345 }, c.name);
});

test("ảnh '@private/...' được nhúng thành data URL trong phần mã hóa, không để lộ ở locked.js", async () => {
  const root = project();
  const r = await build({ root });
  const src = fs.readFileSync(path.join(root, "locked.js"), "utf8");
  assert.ok(!src.includes("t.png") && !src.includes("data:image"));
  const out = (await Lock.open(load(path.join(root, "locked.js")), r.codes[0].code)).data;
  assert.equal(out.promos[0].pics[0].src, `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 1, 2, 3]).toString("base64")}`);
  fs.rmSync(path.join(root, "private", "img", "t.png"));
  await assert.rejects(build({ root }), /Thiếu ảnh/);
});

test("chạy lại: giữ nguyên mã và khóa nội dung (người đã nhập mã không phải nhập lại)", async () => {
  const root = project();
  const a = await build({ root });
  const key1 = fs.readFileSync(path.join(root, "private", "lock-state.json"), "utf8");
  const b = await build({ root });
  assert.deepEqual(plain(b.codes), plain(a.codes));
  assert.equal(fs.readFileSync(path.join(root, "private", "lock-state.json"), "utf8"), key1);
  assert.equal(b.rotated, false);
});

test("--add thêm một mã mới, các mã cũ vẫn mở được", async () => {
  const root = project();
  const a = await build({ root });
  const b = await build({ root, add: "Đối tác Hà Nội" });
  assert.equal(b.codes.length, 7);
  assert.equal(b.codes[6].name, "Đối tác Hà Nội");
  assert.deepEqual(plain(b.codes.slice(0, 6)), plain(a.codes));
  const bundle = load(path.join(root, "locked.js"));
  for (const c of b.codes) assert.ok(await Lock.open(bundle, c.code), c.name);
});

test("--revoke xóa mã và đổi khóa nội dung: mã đó và khóa cũ không còn mở được, mã khác vẫn mở", async () => {
  const root = project();
  const a = await build({ root });
  const oldBundle = load(path.join(root, "locked.js"));
  const oldKey = (await Lock.open(oldBundle, a.codes[1].code)).key;
  const b = await build({ root, revoke: "Partner 01" });
  assert.equal(b.rotated, true);
  assert.equal(b.codes.length, 5);
  const bundle = load(path.join(root, "locked.js"));
  assert.equal(await Lock.open(bundle, a.codes[1].code), null);
  assert.equal(await Lock.openWithKey(bundle, oldKey), null);
  assert.ok(await Lock.open(bundle, a.codes[0].code));
  await assert.rejects(build({ root, revoke: "Không có người này" }), /Không có đối tác/);
});

test("--rotate đổi khóa nội dung nhưng giữ mọi mã", async () => {
  const root = project();
  const a = await build({ root });
  const oldKey = (await Lock.open(load(path.join(root, "locked.js")), a.codes[0].code)).key;
  const b = await build({ root, rotate: true });
  assert.deepEqual(plain(b.codes), plain(a.codes));
  const bundle = load(path.join(root, "locked.js"));
  assert.equal(await Lock.openWithKey(bundle, oldKey), null);
  assert.ok(await Lock.open(bundle, a.codes[0].code));
});

test("thiếu private/locked-source.json thì báo lỗi rõ ràng", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pp-lock-"));
  await assert.rejects(build({ root }), /Thiếu .*locked-source\.json/);
});
