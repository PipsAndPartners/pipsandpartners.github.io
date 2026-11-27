// Slide 16 "Không hỗ trợ": quốc gia và vùng lãnh thổ TMGM chưa nhận khách, chia theo khu vực, có ô kiểm tra nhanh. Chỉ dùng nội dung công khai.
const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, input, loadContent } = require("./helpers.js");

const ID = "khong-ho-tro";
const ns = (b) => b.api.html(ID);
const ids = (h) => [...h.matchAll(/<section id="([\w-]+)"/g)].map((m) => m[1]);
const hits = (h) => [...h.matchAll(/<li class="is-hit"><svg[^>]*>[\s\S]*?<\/svg><span>([^<]*)<\/span>/g)].map((m) => m[1]);
const res = (h) => /<p id="ns-res"[^>]*>([\s\S]*?)<\/p>/.exec(h)[1];

// Danh sách đối tác gửi (27/11/2026), đúng tên tiếng Anh
const LIST = [
  "Afghanistan", "Japan", "North Korea", "U.S. Virgin Islands", "U.S. Minor Outlying Islands", "United States", "Iran", "Russia", "Somalia",
  "Congo (DRC)", "Central African Republic", "Guinea-Bissau", "Crimea", "Lebanon", "Sudan", "Libya", "Zimbabwe", "Yemen", "Mali", "Venezuela",
  "Cuba", "Belarus", "Syria", "South Sudan", "Myanmar", "Ukraine", "Singapore", "Romania", "United Kingdom",
];

test("đủ 29 nước theo danh sách, không trùng, không thừa; mỗi nước có đủ 3 ngôn ngữ", () => {
  const s = loadContent({ locked: true }).sections[ID];
  const all = s.regions.flatMap((r) => r.countries);
  assert.equal(all.length, 29);
  assert.deepEqual(Array.from(all, (c) => c.name.en).sort(), [...LIST].sort()); // Array.from: mảng của test, không phải của vm
  for (const c of all) for (const l of ["vi", "en", "zh"]) assert.ok(c.name[l] && c.name[l].trim(), `${c.name.en} thiếu ${l}`);
  for (const r of s.regions) for (const l of ["vi", "en", "zh"]) assert.ok(r.name[l], `khu vực thiếu ${l}`);
});

test("là slide 16 (ngay sau Bắt đầu, trước Hỏi đáp) với đối tượng MIB; với IB vẫn là slide cuối", () => {
  const m = boot({ locked: true }), i = boot({ locked: true, search: "?a=ib" });
  for (const b of [m, i]) {
    const got = ids(b.html());
    assert.equal(got[got.length - 1], ID);
    assert.equal(got[got.length - 2], "bat-dau");
  }
  assert.match(ns(m), /<p class="eyebrow">16 · Not supported<\/p>/);
  assert.match(m.api.header(), /<b>16<\/b><span>Not supported<\/span>/);
  assert.match(ns(m), /<h2 id="h-khong-ho-tro" class="statement">29 countries and regions not supported<\/h2>/);
});

test("hiện đủ 5 khu vực với số đếm và 29 tên nước; chưa gõ gì thì không làm mờ, chỉ hiện gợi ý", () => {
  const h = ns(boot({ locked: true }));
  assert.equal((h.match(/class="ns-reg"/g) || []).length, 5);
  for (const n of LIST) assert.ok(h.includes(`<span>${n.replace(/&/g, "&amp;")}</span>`), n);
  assert.match(h, /<span>Africa<\/span><small>9<\/small>/);
  assert.doesNotMatch(h, /is-filtering|is-hit|is-off/);
  assert.match(res(h), /ns-res-hint/);
});

test("ô kiểm tra: tìm bằng tiếng Anh, tiếng Việt có/không dấu, tiếng Trung và tên gọi khác", () => {
  const b = boot({ locked: true });
  const check = (q) => { input(b, { ns: "q" }, q); return hits(ns(b)); };
  assert.deepEqual(check("singapore"), ["Singapore"]);
  assert.deepEqual(check("  JAPAN "), ["Japan"]);
  assert.deepEqual(check("nhat ban"), ["Japan"]);
  assert.deepEqual(check("Nhật"), ["Japan"]);
  assert.deepEqual(check("英國"), ["United Kingdom"]);
  assert.deepEqual(check("britain"), ["United Kingdom"]);
  assert.deepEqual(check("usa"), ["United States"]);
  assert.deepEqual(check("burma"), ["Myanmar"]);
  assert.deepEqual(check("drc"), ["Congo (DRC)"]);
  assert.deepEqual(check("sudan"), ["South Sudan", "Sudan"]);
  // Có dấu thì so có dấu: "Mỹ" chỉ ra lãnh thổ Mỹ, không lẫn Myanmar
  assert.deepEqual(check("Mỹ"), ["United States", "U.S. Minor Outlying Islands", "U.S. Virgin Islands"]);
  // Khớp đầu từ: "us" không bắt nhầm Russia/Belarus
  assert.deepEqual(check("us"), ["United States", "U.S. Minor Outlying Islands", "U.S. Virgin Islands"]);
  assert.match(res(ns(b)), /Not supported: United States, U\.S\. Minor Outlying Islands, U\.S\. Virgin Islands/);
});

test("nước không có trong danh sách: báo không có, không tô nước nào, khu vực mờ đi; xóa ô thì trở lại như cũ", () => {
  const b = boot({ locked: true });
  for (const q of ["Thailand", "Việt Nam", "Hàn Quốc", "South Korea"]) {
    input(b, { ns: "q" }, q);
    const h = ns(b);
    assert.deepEqual(hits(h), [], q);
    assert.match(res(h), /ns-res-miss/, q);
    assert.match(h, /is-filtering/, q);
    assert.equal((h.match(/class="ns-reg is-off"/g) || []).length, 5, q);
  }
  input(b, { ns: "q" }, "");
  assert.doesNotMatch(ns(b), /is-filtering|is-off/);
});

test("chữ người dùng gõ được thoát HTML và giới hạn 60 ký tự", () => {
  const b = boot({ locked: true });
  input(b, { ns: "q" }, '<img src=x onerror="alert(1)">');
  const h = ns(b);
  assert.doesNotMatch(h, /<img src=x/);
  assert.match(res(h), /&lt;img src=x onerror=&quot;alert\(1\)&quot;>/);
  input(b, { ns: "q" }, "x".repeat(200));
  assert.equal(b.api.state.ns.length, 60);
});

test("3 ngôn ngữ: tiêu đề, khu vực và tên nước đúng ngôn ngữ; không có undefined/NaN/[object Object]", () => {
  const vi = ns(boot({ locked: true, search: "?lang=vi" })), zh = ns(boot({ locked: true, search: "?lang=zh" }));
  assert.match(vi, /29 quốc gia và vùng lãnh thổ chưa được hỗ trợ/);
  assert.match(vi, /<span>Vương quốc Anh<\/span>/);
  assert.match(vi, /<span>Châu Phi<\/span><small>9<\/small>/);
  assert.match(zh, /暫不支援的 29 個國家及地區/);
  assert.match(zh, /<span>北韓<\/span>/);
  for (const lang of ["en", "vi", "zh"]) for (const a of ["mib", "ib"]) {
    const h = boot({ locked: true, search: `?lang=${lang}&a=${a}` }).html();
    assert.doesNotMatch(h, /undefined|NaN|\[object Object\]/, `${lang}/${a}`);
  }
});

test("thuộc phần kết, có lời thoại 3 ngôn ngữ cho người trình bày, ô kiểm tra là ô tìm kiếm", () => {
  const D = loadContent({ locked: true }), s = D.sections[ID];
  assert.equal(s.part, "close");
  for (const l of ["vi", "en", "zh"]) assert.ok(s.notes[l].length > 40, l);
  assert.match(ns(boot({ locked: true })), /<input type="search" data-ns="q"/);
});
