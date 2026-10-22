// Slide 13 (Ưu đãi khác) = lưới thẻ lấy dữ liệu từ trang ưu đãi (promotions/promos-data.js), mỗi thẻ dẫn sang trang đầy đủ;
// ô "ưu đãi khác" ở slide 03. Ưu đãi chỉ chia sẻ riêng chỉ hiện sau khi nhập mã. "Hôm nay" cố định 9/10/2026.
const test = require("node:test");
const assert = require("node:assert/strict");
const Lock = require("../lock.js");
const { boot, click, HAS_PRIVATE, loadPromos } = require("./helpers.js");

const skipPrivate = !HAS_PRIVATE && "không có private/locked-source.json";
const PUBLIC_ORDER = ["welcomeBack", "credit50", "getaway", "halloween", "jayChou", "gadget", "rocket", "winYourRide"];
const ALL_ORDER = ["welcomeBack", "credit50", "premierLeague", "getaway", "halloween", "jayChou", "gadget", "carnival", "thaiConcert", "thaiIb", "rocket", "winYourRide"];
const cards = (h) => [...h.matchAll(/<a class="xp-card[^"]*" href="([^"]*)" target="_blank" rel="noopener" data-xp="(\w+)"/g)].map((m) => ({ href: m[1], key: m[2] }));
const keys = (h) => cards(h).map((c) => c.key);
const locked = (opts = {}) => boot({ locked: true, ...opts });
const open = (opts = {}) => boot(opts); // mở khóa sẵn khi có private/
const plain = (v) => JSON.parse(JSON.stringify(v));

test("chưa có mã: chỉ ưu đãi công khai, theo thứ tự `order`; Q3 Cashback/Gadget đang ẩn không hiện", () => {
  const h = locked().api.html("km-khac");
  assert.deepEqual(keys(h), PUBLIC_ORDER);
  assert.doesNotMatch(h, /q3Cashback|q3Gadget|xp-card--private|thaiConcert|premierLeague|carnival/);
  assert.match(h, /<h2 id="h-km-khac" class="statement">Promotions running for clients now<\/h2>/);
});

test("mỗi thẻ mở đúng ưu đãi trên trang mới (promotions/?lang=..#key) ở tab mới; có nút mở cả trang", () => {
  const h = locked().api.html("km-khac");
  for (const c of cards(h)) assert.equal(c.href, `promotions/?lang=en#${c.key}`);
  assert.match(h, /<a class="btn btn--blue btn--sm" href="promotions\/\?lang=en" target="_blank" rel="noopener">Open the full promotions page/);
  const vi = locked({ search: "?lang=vi" }).api.html("km-khac");
  assert.ok(cards(vi).every((c) => c.href === `promotions/?lang=vi#${c.key}`));
  assert.match(vi, /href="promotions\/\?lang=vi" target="_blank"/);
  const zh = locked({ search: "?lang=zh" }).api.html("km-khac");
  assert.match(zh, /href="promotions\/\?lang=zh#welcomeBack"/);
});

test("mỗi thẻ có tên, tiêu đề lớn, đối tượng và nhãn hạn đúng màu", () => {
  const h = locked().api.html("km-khac");
  const card = (k) => h.slice(h.indexOf(`data-xp="${k}"`), h.indexOf("</a>", h.indexOf(`data-xp="${k}"`)));
  assert.match(card("welcomeBack"), /<b>Welcome Back<\/b><small>320 points<\/small>[\s\S]*xp-tag--seg">Invited clients only<[\s\S]*xp-tag--soon">22 days left</);
  assert.match(card("credit50"), /<b>Q4 50% Credit<\/b><small>50% credit<\/small>[\s\S]*xp-tag--ok">until Dec 31</);
  assert.match(card("getaway"), /xp-tag--closed">Registration closed · until Nov 8</);
  assert.match(card("halloween"), /xp-tag--soon">27 days left</);
  assert.match(card("winYourRide"), /xp-tag--ok">until Nov 20</);
  assert.match(card("rocket"), /See the full page/);
});

test("bộ lọc: Tất cả / Ưu đãi nhỏ / Marketing / Đang hoàn tất, có số đếm", () => {
  const b = locked();
  let h = b.api.html("km-khac");
  assert.match(h, /data-act="xp-filter" data-v="all" aria-pressed="true">All <small>8<\/small>/);
  assert.match(h, /data-v="small" aria-pressed="false">Small offers <small>5<\/small>/);
  assert.match(h, /data-v="marketing" aria-pressed="false">Marketing <small>2<\/small>/);
  assert.match(h, /data-v="followup" aria-pressed="false">Wrapping up <small>1<\/small>/);
  click(b, { act: "xp-filter", v: "small" });
  assert.deepEqual(keys(b.api.html("km-khac")), ["welcomeBack", "credit50", "halloween", "gadget", "rocket"]);
  click(b, { act: "xp-filter", v: "marketing" });
  assert.deepEqual(keys(b.api.html("km-khac")), ["jayChou", "winYourRide"]);
  click(b, { act: "xp-filter", v: "followup" });
  assert.deepEqual(keys(b.api.html("km-khac")), ["getaway"]);
  click(b, { act: "xp-filter", v: "all" });
  assert.equal(keys(b.api.html("km-khac")).length, 8);
});

test("mục hết hạn tự ẩn; hết sạch thì báo trống", () => {
  assert.deepEqual(keys(locked({ today: "2026-11-06" }).api.html("km-khac")), ["credit50", "getaway", "jayChou", "gadget", "rocket", "winYourRide"]);
  assert.deepEqual(keys(locked({ today: "2026-11-21" }).api.html("km-khac")), ["credit50", "jayChou", "gadget", "rocket"]);
  const jan = locked({ today: "2027-01-01" }).api.html("km-khac");
  assert.deepEqual(keys(jan), []);
  assert.match(jan, /No promotions left in this group\./);
});

test("chưa có mã: có dòng nhắc còn ưu đãi chỉ chia sẻ riêng (khi trang có gói mã hóa); không có gói thì không nhắc", async () => {
  const code = Lock.generateCode();
  const { bundle } = await Lock.seal({ data: {}, sections: {}, promos: [] }, [code], { iter: 1000 });
  assert.match(locked({ bundle }).api.html("km-khac"), /class="warn warn--sm xp-private-hint"[\s\S]*More private-only offers/);
  assert.doesNotMatch(locked().api.html("km-khac"), /xp-private-hint/);
});

test("đã có mã: thêm 4 ưu đãi chỉ chia sẻ riêng vào đúng vị trí theo `order`, có nhãn và cảnh báo; hết dòng nhắc", { skip: skipPrivate }, () => {
  const h = open().api.html("km-khac");
  assert.deepEqual(keys(h), ALL_ORDER);
  assert.equal((h.match(/xp-card--private/g) || []).length, 4);
  assert.match(h, /data-xp="thaiConcert"[\s\S]*?xp-tag--priv">Private only</);
  assert.match(h, /class="warn warn--sm xp-private-warn"/);
  assert.doesNotMatch(h, /xp-private-hint/);
  assert.match(h, /data-xp="premierLeague"[\s\S]*?href="promotions\/\?lang=en#premierLeague"|href="promotions\/\?lang=en#premierLeague"[\s\S]*?data-xp="premierLeague"/);
});

test("đã có mã: lọc Marketing có cả vé; mục riêng hết hạn thì ẩn (Thai concert sau 25/10)", { skip: skipPrivate }, () => {
  const b = open();
  click(b, { act: "xp-filter", v: "marketing" });
  assert.deepEqual(keys(b.api.html("km-khac")), ["premierLeague", "jayChou", "carnival", "thaiConcert", "thaiIb", "winYourRide"]);
  const later = open({ today: "2026-10-26" });
  assert.ok(!keys(later.api.html("km-khac")).some((k) => ["thaiConcert", "thaiIb"].includes(k)));
  assert.ok(keys(later.api.html("km-khac")).includes("carnival"));
});

test("slide 03: ô 'ưu đãi khác' đếm 5/2 khi chưa có mã (không có ô riêng); 5/2/4 khi đã có mã; bấm ô thì đặt bộ lọc", { skip: skipPrivate }, () => {
  const counts = (h) => [...h.matchAll(/data-act="xp-jump" data-v="(\w+)"[\s\S]*?<em>(\d+)<\/em>/g)].map((m) => [m[1], +m[2]]);
  const l = locked();
  assert.deepEqual(counts(l.api.html("nam-dong")), [["small", 5], ["marketing", 2]]);
  assert.doesNotMatch(l.api.html("nam-dong"), /otherp-card--private/);
  const u = open();
  assert.deepEqual(counts(u.api.html("nam-dong")), [["small", 5], ["marketing", 2], ["private", 4]]);
  assert.match(u.api.html("nam-dong"), /otherp-card--private/);
  click(u, { act: "xp-jump", v: "private" });
  assert.deepEqual(plain(u.api.state.extra), { filter: "marketing" });
  click(u, { act: "xp-jump", v: "small" });
  assert.equal(u.api.state.extra.filter, "small");
  assert.doesNotMatch(boot({ locked: true, today: "2027-06-01" }).api.html("nam-dong"), /class="otherp"/);
});

test("3 ngôn ngữ (có và không có mã): không có undefined/NaN/[object Object]", () => {
  for (const lang of ["en", "vi", "zh"]) for (const b of [locked({ search: `?lang=${lang}` }), open({ search: `?lang=${lang}` })]) {
    assert.doesNotMatch(b.api.html("km-khac") + b.api.html("nam-dong"), /undefined|NaN|\[object Object\]/, lang);
  }
});

test("slide 13 không còn giữ dữ liệu ưu đãi riêng: content.js không có extraPromos, dữ liệu duy nhất ở promotions/promos-data.js", () => {
  const b = locked();
  assert.equal(b.ctx.MIB.extraPromos, undefined);
  const P = loadPromos();
  assert.equal(P.extraPromos.length, 10);
  assert.equal(P.extraPromos.filter((p) => p.share === "private").length, 0, "ưu đãi chỉ chia sẻ riêng không nằm trong file công khai");
});
