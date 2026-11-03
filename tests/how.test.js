// Slide 03 "IB/MIB là gì": sơ đồ dòng tiền theo vai trò (IB / MIB) và ví dụ 1 lot Forex theo loại tài khoản. Chỉ dùng số công khai.
const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, click, loadContent } = require("./helpers.js");

const how = (b) => b.api.html("co-che");
const ids = (h) => [...h.matchAll(/<section id="([\w-]+)"/g)].map((m) => m[1]);
const split = (h) => [...h.matchAll(/<li><i class="sw how-sw--(\w+)"><\/i><span>([^<]*)<\/span><b>([^<]*)<\/b>/g)].map((m) => [m[1], m[2], m[3]]);
const paid = (h) => /<p class="how-paid"><span>[\s\S]*?<\/span><b>([^<]*)<\/b>/.exec(h)[1];

test("slide mới nằm ngay sau Pháp lý, trước Năm dòng thu nhập, có ở cả MIB và IB, đánh số 03", () => {
  for (const a of ["mib", "ib"]) {
    const got = ids(boot({ locked: true, search: `?a=${a}` }).html());
    assert.equal(got[got.indexOf("phap-ly") + 1], "co-che", a);
    assert.equal(got[got.indexOf("co-che") + 1], "nam-dong", a);
  }
  assert.match(how(boot({ locked: true })), /<p class="eyebrow">03 · How it works<\/p>/);
  assert.match(boot({ locked: true }).api.header(), /<b>03<\/b><span>How it works<\/span>/);
});

test("mặc định theo đối tượng: MIB xem sơ đồ MIB, IB xem sơ đồ IB; đổi đối tượng đổi theo; công tắc đổi tự do", () => {
  const m = boot({ locked: true }), i = boot({ locked: true, search: "?a=ib" });
  assert.equal(m.api.state.how.role, "mib");
  assert.equal(i.api.state.how.role, "ib");
  assert.match(how(m), /data-act="how-role" data-v="mib" aria-pressed="true"/);
  assert.match(how(i), /data-act="how-role" data-v="ib" aria-pressed="true"/);
  click(m, { act: "how-role", v: "ib" });
  assert.equal(m.api.state.how.role, "ib");
  click(m, { act: "aud", v: "ib" });
  assert.equal(m.api.state.how.role, "ib");
  click(m, { act: "aud", v: "mib" });
  assert.equal(m.api.state.how.role, "mib");
});

test("sơ đồ IB: TMGM, bạn (IB), khách; 3 mũi tên (giới thiệu, giao dịch, trả rebate) và 3 dòng chú thích", () => {
  const h = how(boot({ locked: true, search: "?a=ib" }));
  assert.equal((h.match(/class="how-e how-e--(refer|trade|pay)"/g) || []).length, 3);
  for (const k of ["refer", "trade", "pay"]) assert.match(h, new RegExp(`how-e--${k}`));
  assert.match(h, /<text[^>]*>TMGM<\/text>/);
  assert.match(h, /<text[^>]*>You \(IB\)<\/text>/);
  assert.match(h, /<text[^>]*>Clients<\/text>/);
  assert.doesNotMatch(h, /Sub-IB<\/text>|monthly bonus<\/text>/);
  assert.equal((h.match(/<ol class="how-legend"><li><b>1<\/b>/g) || []).length, 1);
  assert.equal((h.match(/<li><b>\d<\/b><span>/g) || []).length, 3);
  assert.match(h, /<h3>Introducing Broker: the referrer<\/h3>/);
});

test("sơ đồ MIB: thêm 3 Sub-IB, 3 nhóm khách, thanh thưởng tháng và dòng chú thích thứ 4 (chia cho Sub-IB)", () => {
  const h = how(boot({ locked: true }));
  assert.equal((h.match(/<text[^>]*>Sub-IB<\/text>/g) || []).length, 3);
  assert.equal((h.match(/<text[^>]*>Clients<\/text>/g) || []).length, 3);
  assert.match(h, /<text[^>]*>You \(MIB\)<\/text>/);
  assert.match(h, /<text[^>]*>\+ monthly bonus<\/text>/);
  assert.equal((h.match(/<li><b>\d<\/b><span>/g) || []).length, 4);
  assert.match(h, /The MIB passes part of the rebate to its Sub-IBs/);
  assert.match(h, /<h3>Master IB: runs a network of Sub-IBs<\/h3>/);
  assert.equal((h.match(/class="how-e how-e--pay"/g) || []).length, 4, "TMGM → MIB và MIB → 3 Sub-IB");
});

test("mũi tên có đầu mũi tên; đồng xu chạy theo đường trả tiền (SMIL), và tắt khi người dùng chọn giảm chuyển động", () => {
  const h = how(boot({ locked: true }));
  assert.match(h, /<marker id="how-a-pay"[^>]*markerUnits="userSpaceOnUse"/);
  assert.match(h, /marker-end="url\(#how-a-pay\)"/);
  assert.ok((h.match(/<animateMotion /g) || []).length >= 2);
  const b = boot({ locked: true });
  b.ctx.matchMedia = () => ({ matches: true });
  assert.doesNotMatch(b.api.html("co-che"), /animateMotion/);
});

test("ví dụ 1 lot Forex: IB giữ cả rebate của tài khoản; số lấy từ bảng tài khoản công khai", () => {
  const D = loadContent({ locked: true }), b = boot({ locked: true, search: "?a=ib" });
  for (const a of D.accounts) {
    click(b, { act: "how-acc", v: a.name });
    const h = how(b);
    assert.equal(b.api.state.how.acc, a.name);
    assert.equal(paid(h), `USD ${a.fx}`, a.name);
    assert.deepEqual(split(h), [["you", "You receive", `USD ${a.fx}`]], a.name);
    assert.match(h, new RegExp(`data-act="how-acc" data-v="${a.name}" aria-pressed="true"`));
  }
});

test("ví dụ MIB: chia theo tỷ lệ của ví dụ chung (70%): Prime 7 → Sub-IB 4,90 và MIB giữ 2,10; tổng luôn bằng rebate", () => {
  const D = loadContent({ locked: true }), b = boot({ locked: true });
  click(b, { act: "how-acc", v: "Prime" });
  const h = how(b);
  assert.equal(paid(h), "USD 7");
  assert.deepEqual(split(h), [["sub", "Sub-IBs receive (70%)", "USD 4.90"], ["you", "The MIB keeps", "USD 2.10"]]);
  assert.match(h, /how-seg--sub" style="flex:70"/);
  assert.match(h, /how-seg--you" style="flex:30"/);
  for (const a of D.accounts) {
    click(b, { act: "how-acc", v: a.name });
    const nums = split(how(b)).map((x) => +x[2].replace("USD ", ""));
    assert.ok(Math.abs(nums[0] + nums[1] - a.fx) < 1e-9, a.name);
  }
});

test("4 bước 'tiền về như thế nào' và ghi chú minh họa; có link sang Năm dòng thu nhập", () => {
  const h = how(boot({ locked: true }));
  assert.equal((h.match(/<li data-step="\d"><span class="how-step-ic">/g) || []).length, 4);
  assert.match(h, /TMGM calculates the rebate per lot and pays T\+1/);
  assert.match(h, /Illustrative, not an income guarantee/);
  assert.match(h, /<a href="#nam-dong" data-go="nam-dong">See the five income streams →<\/a>/);
  assert.match(h, /class="how-money card" data-step="4"/);
});

test("3 ngôn ngữ × 2 vai trò: đủ chữ, không có undefined/NaN/[object Object]; chữ đúng ngôn ngữ", () => {
  const want = { en: /Introducing Broker/, vi: /Introducing Broker: người giới thiệu/, zh: /介紹經紀人/ };
  for (const lang of ["en", "vi", "zh"]) for (const role of ["ib", "mib"]) {
    const b = boot({ locked: true, search: `?lang=${lang}` });
    click(b, { act: "how-role", v: role });
    const h = how(b);
    assert.doesNotMatch(h, /undefined|NaN|\[object Object\]/, `${lang}/${role}`);
    if (role === "ib") assert.match(h, want[lang], lang);
  }
  assert.match(how(boot({ locked: true, search: "?lang=vi" })), /Master IB: quản lý mạng lưới Sub-IB/);
  assert.match(how(boot({ locked: true, search: "?lang=zh" })), /主代理（MIB）/);
});

test("trình bày: slide có đủ các bước hiện dần (data-step 0–4) và lời thoại", () => {
  const b = boot({ locked: true });
  const h = how(b);
  for (const n of [0, 1, 2, 3, 4]) assert.match(h, new RegExp(`data-step="${n}"`), `bước ${n}`);
  assert.match(b.ctx.MIB.sections["co-che"].notes.en, /Click IB \/ MIB to switch the diagram/);
});

test("slide không chứa số KM: không có bậc, tên sàn khác hay khoản thưởng tối đa", () => {
  const h = how(boot({ locked: true }));
  assert.doesNotMatch(h, /20,000|15,000|3,300|Exness|XM\b/);
});
