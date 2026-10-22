// Trang ưu đãi (promotions/): chạy trên GitHub Pages, không Netlify, nút sửa chỉ khi ?edit, ưu đãi riêng sau mã truy cập.
// "Hôm nay" cố định 12/10/2026. Bài mở khóa thật cần private/locked-source.json.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Lock = require("../lock.js");
const { boot, click, input, read, HAS_PRIVATE, loadData } = require("./promos-helpers.js");
const { loadLocked } = require("./helpers.js");

const PLAIN = ["promos-data.js", "../dates.js", "../qr.js", "promo-art.js", "../lock.js"]; // như khi mở không có ?edit
const EDIT = [...PLAIN, "edits-core.js", "edits.js"]; // như khi mở với ?edit
const skipPrivate = !HAS_PRIVATE && "không có private/locked-source.json";
const page = (opts = {}) => boot({ files: PLAIN, unlock: false, ...opts });
const keys = (b) => Array.from(b.api.slides(), (s) => s.key);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 4000) { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error("hết giờ chờ"); await sleep(5); } }
const PUBLIC_SLIDES = ["cover", "list", "welcomeBack", "credit50", "getaway", "halloween", "jayChou", "gadget", "rocket", "winYourRide", "contact"];

let sealed;
async function bundle() {
  if (!sealed) {
    const code = Lock.generateCode();
    sealed = { code, ...(await Lock.seal(HAS_PRIVATE ? loadLocked() : { data: {}, sections: {}, promos: [] }, [code], { iter: 1000 })) };
  }
  return sealed;
}

test("index.html: dùng style chung của site, nạp locked.js + lock.js, chỉ nạp edits.js khi có ?edit", () => {
  const h = read("index.html");
  assert.match(h, /<link rel="stylesheet" href="\.\.\/style\.css">/);
  assert.match(h, /<script src="\.\.\/locked\.js"><\/script>\s*<script src="\.\.\/lock\.js"><\/script>/);
  assert.match(h, /<script src="\.\.\/dates\.js"><\/script>\s*<script src="\.\.\/qr\.js"><\/script>/);
  assert.doesNotMatch(h, /^<script src="edits(-core)?\.js">/m, "không nạp edits.js trực tiếp bằng thẻ script ở đầu dòng");
  assert.match(h, /if \(EDIT\) document\.write\('<script src="edits-core\.js"><\\\/script><script src="edits\.js"><\\\/script>'\)/);
  assert.match(h, /\/\[\?&\]edit\(=\|&\|\$\)\/\.test\(location\.search\)/);
});

test("dữ liệu công khai: 10 ưu đãi, không có ưu đãi chỉ chia sẻ riêng, biến toàn cục là window.PROMOS (không đè window.MIB của trang pitch)", () => {
  const D = loadData({ unlock: false });
  assert.equal(D.extraPromos.length, 10);
  assert.equal(D.extraPromos.filter((p) => p.share === "private").length, 0);
  assert.deepEqual(Object.keys(D).sort(), ["contact", "extraPromos", "promoPage", "sections"]);
  assert.doesNotMatch(read("promos-data.js"), /window\.MIB\b/);
  for (const f of ["promos.js", "edits.js", "edits-core.js"]) assert.doesNotMatch(read(f), /window\.MIB\b/, f);
});

test("mặc định (chưa mã): bìa, danh sách, 8 ưu đãi công khai theo `order`, liên hệ; không có nút sửa/xóa/thêm slide", () => {
  const b = page();
  assert.deepEqual(keys(b), PUBLIC_SLIDES);
  const h = b.html();
  assert.doesNotMatch(h, /pp-edit|pp-del|data-ed-new|data-ed-open|data-ed-del|data-ed=/);
  assert.match(h, /<a class="btn btn--ghost btn--sm" href="\.\.\/"><svg class="ic " aria-hidden="true"><use href="#i-left"\/><\/svg><span>Back to the partnership page<\/span><\/a>/);
  assert.match(h, /8 promotions running|7 promotions running/);
});

test("mở với ?edit (có edits.js): hiện nút sửa, xóa và thêm slide", () => {
  const b = boot({ files: EDIT, unlock: false });
  const h = b.html();
  assert.match(h, /class="pp-edit"/);
  assert.match(h, /class="pp-del"/);
  assert.match(h, /data-ed-new="1"/);
  assert.equal(b.ctx.MIBEdit.state.mode, "local");
});

test("liên hệ: Business Development, WhatsApp số mới, QR vẽ bằng qr.js; thẻ chữ 'BD' thay 'AM'", () => {
  const h = page().html();
  const s = h.slice(h.indexOf('id="contact"'));
  assert.match(s, /Business Development · TMGM/);
  assert.match(s, /href="https:\/\/wa\.me\/61431840947"[^>]*>[\s\S]*?\+61 431 840 947/);
  assert.match(s, /<svg class="qr" viewBox="0 0 33 33" width="120" height="120" role="img" aria-label="QR WhatsApp \+61 431 840 947"/);
  assert.doesNotMatch(s, /qr-whatsapp\.png/);
  assert.match(s, /Contact your BD for step-by-step help/);
  for (const lang of ["vi", "zh"]) assert.doesNotMatch(page({ search: `?lang=${lang}` }).html(), /\bAM\b|客戶經理|Account Manager/);
});

test("ô nhập mã chỉ có khi trang có gói mã hóa; gõ mã vào state.code", async () => {
  assert.doesNotMatch(page().html(), /data-form="unlock"/);
  const { bundle: pack } = await bundle();
  const b = page({ bundle: pack });
  const h = b.html();
  assert.match(h, /<form class="pp-code" data-form="unlock"/);
  assert.match(h, /Have an access code\? Enter it to see the private-only offers/);
  input(b, { code: "1" }, "PP-test");
  assert.equal(b.api.state.code, "PP-test");
});

test("nhập sai mã: báo lỗi, không mở gì, không nhớ khóa", async () => {
  const { bundle: pack } = await bundle();
  const b = page({ bundle: pack });
  input(b, { code: "1" }, "PP-AAAA-BBBB-CCCC-DDDD");
  b.fire("submit", { target: { dataset: { form: "unlock" } } });
  await until(() => b.api.state.codeMsg === "That code isn't right.");
  assert.equal(b.api.state.unlocked, false);
  assert.deepEqual(keys(b), PUBLIC_SLIDES);
  assert.equal(b.store[Lock.STORE_KEY], undefined);
});

test("nhập đúng mã: thêm 4 ưu đãi riêng đúng vị trí; nhớ khóa; mở lại trang tự mở; link #thaiConcert đi thẳng tới slide; khóa lại thì mất", { skip: skipPrivate }, async () => {
  const { bundle: pack, code } = await bundle();
  const b = page({ bundle: pack });
  input(b, { code: "1" }, code);
  b.fire("submit", { target: { dataset: { form: "unlock" } } });
  await until(() => b.api.state.unlocked);
  assert.deepEqual(keys(b), ["cover", "list", "welcomeBack", "credit50", "premierLeague", "getaway", "halloween", "jayChou", "gadget", "carnival", "thaiConcert", "thaiIb", "rocket", "winYourRide", "contact"]);
  assert.match(b.html(), /pp-code pp-code--on/);
  assert.ok(b.store[Lock.STORE_KEY]);

  const deep = page({ bundle: pack, hash: "#thaiConcert", store: { ...b.store } });
  assert.equal(deep.api.slides()[deep.api.state.i].key, "cover", "lúc đầu chưa mở được nên ở bìa");
  await until(() => deep.api.state.unlocked);
  assert.equal(deep.api.slides()[deep.api.state.i].key, "thaiConcert");

  click(deep, { act: "relock" });
  assert.equal(deep.api.state.unlocked, false);
  assert.deepEqual(keys(deep), PUBLIC_SLIDES);
  assert.equal(deep.store[Lock.STORE_KEY], undefined);
});

test("link thẳng tới ưu đãi riêng khi chưa có mã: ở lại bìa, không lỗi", () => {
  const b = page({ hash: "#carnival" });
  assert.equal(b.api.slides()[b.api.state.i].key, "cover");
});

test("3 ngôn ngữ: không có undefined/NaN/[object Object] (có và không có mã)", () => {
  for (const lang of ["en", "vi", "zh"]) for (const unlock of [false, true]) {
    assert.doesNotMatch(boot({ files: PLAIN, unlock, search: `?lang=${lang}` }).html(), /undefined|NaN|\[object Object\]/, `${lang}/${unlock}`);
  }
});

test("edits.js chỉ lưu trên máy: không có mã gọi mạng hay chữ Netlify", () => {
  for (const f of ["edits.js", "edits-core.js", "promos.js", "promos-data.js", "index.html"]) {
    const s = read(f);
    assert.doesNotMatch(s, /netlify|fetch\(|\/api\/data|XMLHttpRequest/i, f);
  }
  assert.ok(!fs.existsSync(path.join(__dirname, "..", "promotions", "img", "premier-tickets.png")));
});
