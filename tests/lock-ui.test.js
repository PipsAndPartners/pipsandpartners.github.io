// Giao diện khóa: slide KM (08), Ví dụ (10), So sánh (11) chỉ hiện khung nhập mã cho tới khi nhập đúng; nhớ, khóa lại, 3 ngôn ngữ.
// Các bài mở khóa thật cần nội dung thật (private/locked-source.json): máy không có file đó thì bỏ qua.
const test = require("node:test");
const assert = require("node:assert/strict");
const Lock = require("../lock.js");
const { boot, click, input, HAS_PRIVATE, loadLocked } = require("./helpers.js");

const LOCKED_IDS = ["m2", "m5", "so-sanh"];
const ITER = 1000;
const skipPrivate = !HAS_PRIVATE && "không có private/locked-source.json";
const ids = (html) => [...html.matchAll(/<section id="([\w-]+)"/g)].map((m) => m[1]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 4000) { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error("hết giờ chờ"); await sleep(5); } }

let sealed;
async function bundle() {
  if (!sealed) {
    const code = Lock.generateCode();
    sealed = { code, ...(await Lock.seal(HAS_PRIVATE ? loadLocked() : { data: {}, sections: {}, promos: [] }, [code], { iter: ITER })) };
  }
  return sealed;
}

test("chưa có mã: 3 slide vẫn nằm trong danh sách nhưng chỉ có khung nhập mã và nút liên hệ", () => {
  const b = boot({ locked: true });
  assert.deepEqual(ids(b.html()).filter((i) => LOCKED_IDS.includes(i)), LOCKED_IDS);
  for (const id of LOCKED_IDS) {
    assert.equal(b.api.isLocked(id), true, id);
    const h = b.api.html(id);
    assert.match(h, /class="lock-card card"/, id);
    assert.match(h, /data-form="unlock"/, id);
    assert.match(h, /<h2 id="h-[\w-]+" class="statement">Partner-only content<\/h2>/, id);
    assert.match(h, /href="https:\/\/wa\.me\/61431840947\?text=Hi%20Precy%2C/, id);
    assert.match(h, /href="https:\/\/t\.me\/guowang26"/, id);
    assert.match(h, /href="mailto:precy\.vuong@tmgm\.com\?subject=Access%20code%20request/, id);
    assert.doesNotMatch(h, /<table|class="gbars|class="ex"|class="cmp|class="h2h|class="wf"/, `${id} không được lộ biểu đồ/bảng`);
  }
});

test("chưa có mã: ô nhập mã nhận chữ gõ vào (state.code) và không có bậc KM nào trong state", () => {
  const b = boot({ locked: true });
  input(b, { code: "1" }, "pp-abcd");
  assert.equal(b.api.state.code, "pp-abcd");
  assert.match(b.api.html("m2"), /value="pp-abcd"/);
  assert.equal(b.api.state.tiers.mib.length, 0);
});

test("menu: 3 slide có biểu tượng khóa; chưa mở khóa thì không có nút Khóa lại", () => {
  const b = boot({ locked: true });
  const menu = b.api.header();
  assert.equal((menu.match(/class="ic menu-lock"/g) || []).length, 3);
  assert.doesNotMatch(menu, /data-act="relock"/);
});

test("đối tượng IB: slide KM và Ví dụ cũng khóa; không có slide So sánh", () => {
  const b = boot({ locked: true, search: "?a=ib" });
  const got = ids(b.html());
  assert.ok(got.includes("m2") && got.includes("m5") && !got.includes("so-sanh"));
  assert.equal(b.api.isLocked("m2"), true);
  assert.equal(b.api.isLocked("m5"), true);
});

test("3 ngôn ngữ × 2 đối tượng: khung khóa đúng ngôn ngữ, không có undefined/NaN", () => {
  const want = { en: /Partner-only content/, vi: /Nội dung dành riêng cho đối tác/, zh: /合作夥伴專屬內容/ };
  for (const lang of ["en", "vi", "zh"]) for (const a of ["mib", "ib"]) {
    const b = boot({ locked: true, search: `?lang=${lang}&a=${a}` });
    assert.match(b.api.html("m2"), want[lang], `${lang}/${a}`);
    assert.doesNotMatch(b.html(), /undefined|NaN|\[object Object\]/, `${lang}/${a}`);
  }
});

test("nút Register không còn mở khóa gì", () => {
  const b = boot({ locked: true });
  click(b, { reg: "global" });
  assert.equal(b.api.isLocked("so-sanh"), true);
  assert.equal(b.store["mib-reg"], undefined);
});

test("nhập sai mã: báo lỗi, vẫn khóa, không ghi nhớ gì", async () => {
  const { bundle: pack } = await bundle();
  const b = boot({ locked: true, bundle: pack });
  input(b, { code: "1" }, "PP-AAAA-BBBB-CCCC-DDDD");
  b.fire("submit", { target: { dataset: { form: "unlock" } } });
  await until(() => /isn't right/.test(b.api.state.lockMsg));
  assert.equal(b.api.state.unlocked, false);
  assert.equal(b.api.isLocked("m2"), true);
  assert.equal(b.store[Lock.STORE_KEY], undefined);
  assert.match(b.api.html("m2"), /That code isn&#39;t right|That code isn't right|isn.t right/);
});

test("trình duyệt không hỗ trợ (không có Web Crypto): báo rõ thay vì im lặng", async () => {
  const { bundle: pack, code } = await bundle();
  const b = boot({ locked: true, bundle: pack });
  b.ctx.crypto = undefined;
  input(b, { code: "1" }, code);
  b.fire("submit", { target: { dataset: { form: "unlock" } } });
  await until(() => /can't unlock/.test(b.api.state.lockMsg));
  assert.equal(b.api.state.unlocked, false);
});

test("nhập đúng mã: mở cả 3 slide, nhớ khóa; mở lại trang không cần nhập; khóa lại thì mất", { skip: skipPrivate }, async () => {
  const { bundle: pack, code } = await bundle();
  const b = boot({ locked: true, bundle: pack });
  input(b, { code: "1" }, code.toLowerCase());
  b.fire("submit", { target: { dataset: { form: "unlock" } } });
  await until(() => b.api.state.unlocked);
  for (const id of LOCKED_IDS) {
    assert.equal(b.api.isLocked(id), false, id);
    assert.doesNotMatch(b.api.html(id), /lock-card/, id);
  }
  assert.match(b.api.html("m2"), /class="promo"/);
  assert.match(b.api.html("m5"), /class="ex"/);
  assert.match(b.api.html("so-sanh"), /class="h2h"|class="cmp"/);
  assert.ok(b.store[Lock.STORE_KEY]);
  assert.doesNotMatch(b.api.header(), /menu-lock/);
  assert.match(b.api.header(), /data-act="relock"/);
  assert.ok(b.ctx.MIB.mibTiers.length >= 5 && b.ctx.MIB.competitors.brokers.length >= 8);

  // mở lại trang với khóa đã nhớ
  const again = boot({ locked: true, bundle: pack, store: { ...b.store } });
  assert.equal(again.api.state.unlocked, false, "lúc vừa mở vẫn khóa");
  await until(() => again.api.state.unlocked);
  assert.equal(again.api.isLocked("m5"), false);

  // khóa lại
  click(again, { act: "relock" });
  assert.equal(again.api.state.unlocked, false);
  for (const id of LOCKED_IDS) assert.equal(again.api.isLocked(id), true, id);
  assert.equal(again.store[Lock.STORE_KEY], undefined);
  assert.equal(again.ctx.MIB.mibTiers.length, 0);
  assert.equal(again.ctx.MIB.competitors.brokers.length, 0);
  assert.equal(again.api.state.tiers.mib.length, 0);
});

test("khóa đã nhớ nhưng hỏng hoặc đã bị thu hồi: vẫn khóa và tự xóa khóa", async () => {
  const { bundle: pack } = await bundle();
  const b = boot({ locked: true, bundle: pack, store: { [Lock.STORE_KEY]: Lock.toB64(new Uint8Array(32)) } });
  await until(() => b.store[Lock.STORE_KEY] === undefined);
  assert.equal(b.api.state.unlocked, false);
  assert.equal(b.api.isLocked("m2"), true);
});

test("đã mở khóa: đổi ngôn ngữ và đối tượng không làm khóa lại", { skip: skipPrivate }, async () => {
  const { bundle: pack, code } = await bundle();
  const b = boot({ locked: true, bundle: pack });
  input(b, { code: "1" }, code);
  b.fire("submit", { target: { dataset: { form: "unlock" } } });
  await until(() => b.api.state.unlocked);
  click(b, { act: "lang", v: "vi" });
  click(b, { act: "aud", v: "ib" });
  assert.equal(b.api.state.unlocked, true);
  assert.equal(b.api.isLocked("m2"), false);
  assert.doesNotMatch(b.html(), /lock-card|undefined|NaN/);
});
