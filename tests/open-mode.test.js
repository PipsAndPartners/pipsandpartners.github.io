// Chế độ mở (node scripts/lock.mjs --open): locked.js không mã hóa (window.PP_OPEN) → mọi slide và ưu đãi hiện sẵn, không cần mã.
// Cần nội dung thật (private/locked-source.json) nên máy không có file đó thì bỏ qua.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { boot, HAS_PRIVATE } = require("./helpers.js");
const P = require("./promos-helpers.js");

const skip = !HAS_PRIVATE && "không có private/locked-source.json";
const ids = (h) => [...h.matchAll(/<section id="([\w-]+)"/g)].map((m) => m[1]);

test("trang pitch ở chế độ mở: slide KM, Ví dụ, So sánh có nội dung ngay từ lần vẽ đầu, không có khung khóa, nút Khóa lại hay biểu tượng khóa", { skip }, () => {
  const b = boot({ locked: true, open: true });
  assert.equal(b.api.state.unlocked, true);
  for (const id of ["m2", "m5", "so-sanh"]) {
    assert.equal(b.api.isLocked(id), false, id);
    assert.doesNotMatch(b.api.html(id), /lock-card/, id);
  }
  assert.doesNotMatch(b.html(), /lock-card|menu-lock|data-act="relock"/);
  assert.match(b.api.html("m2"), /class="promo"/);
  assert.match(b.api.html("m5"), /class="ex"/);
  assert.ok(b.ctx.MIB.mibTiers.length >= 5);
});

test("chế độ mở: slide Ưu đãi khác có đủ 12 ưu đãi (cả chỉ chia sẻ riêng), không nhắc nhập mã", { skip }, () => {
  const h = boot({ locked: true, open: true }).api.html("km-khac");
  assert.equal((h.match(/data-xp="/g) || []).length, 12);
  assert.equal((h.match(/xp-card--private/g) || []).length, 4);
  assert.doesNotMatch(h, /xp-private-hint/);
});

test("chế độ mở: IB mới và các add-on dùng được ngay; đổi ngôn ngữ/đối tượng không khóa lại", { skip }, () => {
  const b = boot({ locked: true, open: true, search: "?a=ib" });
  assert.equal(b.api.state.m5mode, "ib");
  assert.match(b.api.html("m5"), /id="ib-wf"/);
  assert.match(b.api.html("m5"), /data-act="ib-promo" data-v="thaiIb"/);
  assert.deepEqual(ids(b.html()).filter((i) => ["m2", "m5"].includes(i)), ["m2", "m5"]);
});

test("trang ưu đãi ở chế độ mở: 12 ưu đãi ngay, link #thaiConcert đi thẳng tới slide, không ô nhập mã", { skip }, () => {
  const b = P.boot({ files: ["promos-data.js", "../dates.js", "../qr.js", "promo-art.js", "../lock.js"], unlock: false, open: true, hash: "#thaiConcert" });
  assert.equal(b.api.slides().length, 15);
  assert.equal(b.api.slides()[b.api.state.i].key, "thaiConcert");
  assert.doesNotMatch(b.html(), /data-form="unlock"|pp-code/);
});

test("scripts/lock.mjs --open ghi locked.js dạng window.PP_OPEN (không mã hóa, ảnh riêng nhúng sẵn); chạy lại không --open thì mã hóa lại", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pp-open-"));
  fs.mkdirSync(path.join(root, "private", "img"), { recursive: true });
  fs.writeFileSync(path.join(root, "private", "img", "t.png"), Buffer.from([137, 80, 78, 71]));
  fs.writeFileSync(path.join(root, "private", "locked-source.json"), JSON.stringify({ data: { secret: 4242 }, sections: {}, promos: [{ key: "p", pics: [{ src: "@private/img/t.png" }] }] }));
  const { build } = await import("../scripts/lock.mjs");
  const r = await build({ root, open: true });
  assert.equal(r.open, true);
  const src = fs.readFileSync(path.join(root, "locked.js"), "utf8");
  const w = {};
  vm.runInNewContext(src, { window: w });
  assert.equal(w.PP_OPEN.data.secret, 4242);
  assert.match(w.PP_OPEN.promos[0].pics[0].src, /^data:image\/png;base64,/);
  assert.equal(w.PP_LOCKED, undefined);
  assert.ok(!fs.existsSync(path.join(root, "private", "codes.json")), "chế độ mở không tạo mã");
  await build({ root, iter: 1000 });
  const again = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, "locked.js"), "utf8"), { window: again });
  assert.ok(again.PP_LOCKED && !again.PP_OPEN);
  assert.ok(!fs.readFileSync(path.join(root, "locked.js"), "utf8").includes("4242"));
});
