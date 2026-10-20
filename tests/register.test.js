// Link đăng ký Global / Việt Nam và khóa slide So sánh tới khi bấm Register. DOM giả, "hôm nay" cố định 9/10/2026.
const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, click, input, target, read } = require("./helpers.js");

const GLOBAL = "https://portal.tmgm.com/register?sales=NzAwMV9QcmVjeVZ1b25n&amp;language=en";
const VN = "https://portal.tmgm.com/register?sales=NzAwMV9QcmVjeVZ1b25n&amp;language=vi";
const REG = { "mib-reg": "1" };
const count = (s, re) => (s.match(re) || []).length;
const links = (h) => [...h.matchAll(/<a\b[^>]*data-reg="(\w+)"[^>]*>/g)].map((m) => ({ k: m[1], tag: m[0] }));
const hrefOf = (tag) => /href="([^"]*)"/.exec(tag)[1];
const isLocked = (h) => /class="cmp-gate"/.test(h);

// ---------- link ----------
test("R1 mọi link đăng ký chỉ trỏ tới 2 URL (Global = language=en, Việt Nam = language=vi), mở tab mới", () => {
  for (const lang of ["en", "vi", "zh"]) for (const [store, n] of [[{}, 10], [REG, 8]]) {
    const h = boot({ search: `?lang=${lang}`, store }).html(), ls = links(h);
    assert.equal(ls.length, n, `${lang}: header 2 + bìa 2 + slide cuối 2 + footer 2${n === 10 ? " + khung khóa 2" : ""}`);
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
test("R7 slide 11 mặc định bị khóa: khung đăng ký ở trước, công cụ so sánh mờ phía sau và không bấm được", () => {
  const b = boot();
  assert.equal(b.api.state.reg, false);
  const h = b.api.html("so-sanh"), cut = h.indexOf('class="cmp-lock-preview"');
  assert.match(h, /<div class="cmp-gate" data-gate="1" role="region" aria-labelledby="gate-h">/);
  assert.match(h, /<h3 id="gate-h">Register to unlock the comparison<\/h3>/);
  assert.deepEqual(links(h).map((x) => x.k), ["global", "vn"]);
  assert.match(h, /<div class="cmp-lock-preview" inert aria-hidden="true">/);
  assert.doesNotMatch(h.slice(0, cut), /data-h2h=|data-calc=|data-act="(cmpview|cmp|h2h-copy|h2h-ecn|reset)"/, "không có điều khiển nào ngoài vùng inert");
  assert.match(h.slice(cut), /data-act="cmpview"[\s\S]*data-h2h="us\.lotsFx"/, "bản xem trước vẫn là công cụ thật");
});

test("R8 chỉ slide 11 bị khóa; máy tính slide 10 và các slide khác dùng bình thường", () => {
  const b = boot();
  for (const id of ["bia", "ecn-calc", "lich-tien", "m2", "m5", "uu-dai", "km-khac", "bat-dau"]) assert.doesNotMatch(b.api.html(id), /cmp-gate|\binert\b/, id);
  input(b, { calc: "lotsFx" }, "2000");
  assert.equal(b.api.state.calc.lotsFx, 2000);
});

test("R9 bấm Register ở bất kỳ đâu (menu header, bìa, slide cuối, footer, khung khóa) thì mở khóa và ghi nhớ", () => {
  for (const ds of [{ reg: "global", regmenu: "1" }, { reg: "vn", regmenu: "1" }, { reg: "global" }, { reg: "vn" }, { reg: "global", gate: "1" }, { reg: "vn", gate: "1" }]) {
    const b = boot();
    click(b, ds);
    assert.equal(b.api.state.reg, true, JSON.stringify(ds));
    assert.equal(b.store["mib-reg"], "1");
    const h = b.api.html("so-sanh");
    assert.ok(!isLocked(h), JSON.stringify(ds));
    assert.doesNotMatch(h, /\binert\b|data-gate/);
    assert.match(h, /data-act="cmpview" data-v="h2h" aria-pressed="true"/);
    assert.equal(links(h).length, 0, "khung khóa và 2 nút trong khung biến mất");
  }
});

test("R10 bấm các nút khác hoặc nhập số không mở khóa", () => {
  const b = boot();
  for (const ds of [{ act: "cmpview", v: "rank" }, { act: "lang", v: "vi" }, { act: "menu" }, { act: "menu" }, { go: "so-sanh" }, { act: "h2h-copy" }, { act: "reg-menu" }, { regmenu: "1" }, { copy: "Trademax" }]) click(b, ds);
  input(b, { h2h: "us.lotsFx" }, "5000");
  b.fire("auxclick", { target: target({ reg: "vn" }), button: 2 }); // chuột phải: chỉ mở menu ngữ cảnh
  assert.equal(b.api.state.reg, false);
  assert.equal(b.store["mib-reg"], undefined);
  assert.ok(isLocked(b.api.html("so-sanh")));
});

test("R11 bấm chuột giữa vào link đăng ký (mở tab nền) cũng mở khóa", () => {
  const b = boot();
  b.fire("auxclick", { target: target({ reg: "vn", gate: "1" }), button: 1 });
  assert.equal(b.api.state.reg, true);
  assert.ok(!isLocked(b.api.html("so-sanh")));
});

test("R12 mở lại trang: đã bấm thì vẫn mở; ?lock khóa lại cho lần mở đó; giá trị lạ trong storage thì khóa", () => {
  assert.equal(boot({ store: REG }).api.state.reg, true);
  const b = boot({ store: REG, search: "?lock" });
  assert.equal(b.api.state.reg, false);
  assert.ok(isLocked(b.api.html("so-sanh")));
  assert.equal(b.store["mib-reg"], "1", "?lock không xóa trạng thái đã lưu");
  assert.equal(boot({ store: { "mib-reg": "yes" } }).api.state.reg, false);
});

test("R13 mở khóa xong đổi ngôn ngữ, đối tượng, cách xem thì vẫn mở; công cụ so sánh chạy đúng", () => {
  const b = boot();
  click(b, { reg: "vn", gate: "1" });
  click(b, { act: "lang", v: "vi" });
  click(b, { act: "aud", v: "ib" });
  click(b, { act: "aud", v: "mib" });
  assert.ok(!isLocked(b.api.html("so-sanh")));
  click(b, { act: "lang", v: "en" });
  let h = b.api.html("so-sanh");
  assert.match(h, /class="h2h-diff is-us"><span>TMGM ahead<\/span>\s*<b>\+USD 10,196<\/b>/);
  click(b, { act: "cmpview", v: "rank" });
  h = b.api.html("so-sanh");
  assert.equal(count(h, /class="cmp-row/g), 10);
  assert.ok(!isLocked(h));
});

test("R14 3 ngôn ngữ × khóa/mở: không có undefined/NaN; chữ khung khóa đúng ngôn ngữ", () => {
  const title = { en: "Register to unlock the comparison", vi: "Đăng ký để mở công cụ so sánh", zh: "註冊後即可使用比較工具" };
  for (const lang of ["en", "vi", "zh"]) for (const store of [{}, REG]) {
    const b = boot({ search: `?lang=${lang}`, store }), h = b.html();
    assert.doesNotMatch(h, /undefined|NaN|\[object Object\]/, `${lang}/${store["mib-reg"] ? "mở" : "khóa"}`);
    assert.equal(h.includes(title[lang]), !store["mib-reg"], lang);
    click(b, { act: "reg-menu" });
    assert.doesNotMatch(b.api.header(), /undefined|NaN|\[object Object\]/);
  }
});

test("R15 đối tượng IB: không có slide So sánh, vẫn có đủ nút đăng ký", () => {
  const h = boot({ search: "?a=ib" }).html();
  assert.doesNotMatch(h, /<section id="so-sanh"|cmp-gate/);
  assert.equal(links(h).length, 8);
});

test("R16 chế độ trình bày (?present): khung khóa vẫn có 2 nút để bấm ngay trên slide", () => {
  const b = boot({ search: "?present" });
  assert.equal(b.api.state.present, true);
  assert.deepEqual(links(b.api.html("so-sanh")).map((x) => x.k), ["global", "vn"]);
  click(b, { reg: "global", gate: "1" });
  assert.ok(!isLocked(b.api.html("so-sanh")));
});
