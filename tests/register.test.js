// Link đăng ký Global / Việt Nam, menu chọn nơi đăng ký, gợi ý theo ngôn ngữ. DOM giả, "hôm nay" cố định 9/10/2026.
// (Slide KM, Ví dụ, So sánh khóa bằng mã truy cập: xem tests/lock-ui.test.js. Nút Register không còn mở khóa gì.)
const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, click, input, target, read } = require("./helpers.js");

const GLOBAL = "https://portal.tmgm.com/register?sales=NzAwMV9QcmVjeVZ1b25n&amp;language=en";
const VN = "https://portal.tmgm.com/register?sales=NzAwMV9QcmVjeVZ1b25n&amp;language=vi";
const count = (s, re) => (s.match(re) || []).length;
const links = (h) => [...h.matchAll(/<a\b[^>]*data-reg="(\w+)"[^>]*>/g)].map((m) => ({ k: m[1], tag: m[0] }));
const hrefOf = (tag) => /href="([^"]*)"/.exec(tag)[1];

// ---------- link ----------
test("R1 mọi link đăng ký chỉ trỏ tới 2 URL (Global = language=en, Việt Nam = language=vi), mở tab mới", () => {
  for (const lang of ["en", "vi", "zh"]) {
    const n = 8, h = boot({ search: `?lang=${lang}` }).html(), ls = links(h);
    assert.equal(ls.length, n, `${lang}: header 2 + bìa 2 + slide cuối 2 + footer 2`);
    for (const { k, tag } of ls) {
      assert.equal(hrefOf(tag), k === "vn" ? VN : GLOBAL, tag);
      assert.match(tag, /target="_blank"/);
      assert.match(tag, /rel="noopener"/);
      assert.match(tag, new RegExp(`hreflang="${k === "vn" ? "vi" : "en"}"`));
    }
    assert.equal(count(h, /portal\.tmgm\.com\/register/g), n, "không còn link đăng ký nào khác");
  }
});

test("R2 icon cờ Việt Nam và ổ khóa có trong index.html", () => {
  const h = read("index.html");
  assert.match(h, /<symbol id="i-flag-vn"/);
  assert.match(h, /<symbol id="i-lock"/);
});

// ---------- header: menu chọn nơi đăng ký ----------
test("R3 header: nút Register mở menu 2 lựa chọn Global / Việt Nam, mặc định đóng", () => {
  const b = boot();
  let h = b.api.header();
  assert.match(h, /data-act="reg-menu" aria-expanded="false" aria-controls="reg-panel" aria-label="Register now"/);
  assert.match(h, /id="reg-panel" class="reg-panel" hidden/);
  assert.deepEqual(links(h).map((x) => x.k), ["global", "vn"]);
  click(b, { act: "reg-menu" });
  assert.equal(b.api.state.regMenu, true);
  h = b.api.header();
  assert.match(h, /data-act="reg-menu" aria-expanded="true"/);
  assert.doesNotMatch(h, /class="reg-panel" hidden/);
  for (const t of [/Choose where to register/, /English portal · outside Vietnam/, /Vietnamese portal · in Vietnam/]) assert.match(h, t);
});

test("R4 header: bấm lại nút, bấm ra ngoài, Esc, mở danh sách slide hoặc chọn link thì menu đăng ký đóng", () => {
  const b = boot(), open = () => { click(b, { act: "reg-menu" }); assert.equal(b.api.state.regMenu, true); };
  open(); click(b, { act: "reg-menu" });
  assert.equal(b.api.state.regMenu, false, "bấm lại nút");
  open(); click(b, { regmenu: "1" });
  assert.equal(b.api.state.regMenu, true, "bấm vào chữ trong menu: vẫn mở");
  click(b, {});
  assert.equal(b.api.state.regMenu, false, "bấm ra ngoài");
  open(); b.fire("keydown", { target: {}, key: "Escape" });
  assert.equal(b.api.state.regMenu, false, "Esc");
  open(); click(b, { act: "menu" });
  assert.deepEqual([b.api.state.regMenu, b.api.state.menu], [false, true], "mở danh sách slide");
  click(b, { act: "reg-menu" });
  assert.deepEqual([b.api.state.regMenu, b.api.state.menu], [true, false], "mở menu đăng ký thì đóng danh sách slide");
  click(b, { reg: "vn", regmenu: "1" });
  assert.equal(b.api.state.regMenu, false, "chọn link");
});

test("R5 gợi ý theo ngôn ngữ: VI → Việt Nam, EN và 中文 → Global; thứ tự nút cố định Global rồi Việt Nam", () => {
  for (const [lang, pick] of [["en", "global"], ["vi", "vn"], ["zh", "global"]]) {
    const b = boot({ search: `?lang=${lang}` }), h = b.api.header();
    assert.match(h, new RegExp(`class="reg-opt is-pick"[^>]*data-reg="${pick}"`), lang);
    assert.equal(count(h, /is-pick/g), 1);
    for (const id of ["bia", "bat-dau"]) {
      const pair = links(b.api.html(id));
      assert.deepEqual(pair.map((x) => x.k), ["global", "vn"]);
      for (const { k, tag } of pair) assert.match(tag, k === pick ? /class="btn btn--lime btn--lg"/ : /class="btn btn--lime-o btn--lg"/, `${lang}/${id}/${k}`);
    }
  }
});

test("R6 bìa, slide cuối, footer: cặp 2 nút có chữ rõ ràng ở 3 ngôn ngữ", () => {
  const exp = { en: ["Register · Global", "Register · Vietnam"], vi: ["Đăng ký · Global", "Đăng ký · Việt Nam"], zh: ["註冊 · 全球", "註冊 · 越南"] };
  for (const lang of ["en", "vi", "zh"]) {
    const b = boot({ search: `?lang=${lang}` }), foot = b.html().slice(b.html().indexOf('class="foot-row"'));
    for (const h of [b.api.html("bia"), b.api.html("bat-dau"), foot]) {
      assert.match(h, /class="reg-pair" role="group"/);
      for (const t of exp[lang]) assert.ok(h.includes(`<span>${t}</span>`), `${lang}: ${t}`);
    }
    assert.match(b.api.html("bia"), /<use href="#i-flag-vn"\/>/);
  }
});

// ---------- slide 11: khóa tới khi bấm Register ----------
test("R15 đối tượng IB: không có slide So sánh, vẫn có đủ nút đăng ký", () => {
  const h = boot({ search: "?a=ib" }).html();
  assert.doesNotMatch(h, /<section id="so-sanh"/);
  assert.equal(links(h).length, 8);
});
