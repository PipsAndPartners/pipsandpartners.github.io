// Form liên hệ: kiểm tra dữ liệu và dựng bản nháp email (mailto) gửi tới email công ty của Precy.
// Trang chạy local, không có máy chủ nên không tự gửi được: trình duyệt mở app mail với bản nháp, người dùng bấm Gửi.
const test = require("node:test");
const assert = require("node:assert/strict");
const K = require("../contact.js");

const CFG = { to: "precy.vuong@tmgm.com", lang: "vi", audience: "mib" };
const parse = (url) => {
  const [head, query] = url.split("?");
  const p = {};
  for (const kv of query.split("&")) { const i = kv.indexOf("="); p[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); }
  return { to: decodeURIComponent(head.replace(/^mailto:/, "")), ...p };
};
const ok = { name: "Nguyễn Văn A", phone: "+84 90 123 4567", email: "a@example.com", note: "Hẹn thứ Ba 10h" };

test("clean: bỏ xuống dòng, tab và khoảng trắng thừa", () => {
  assert.equal(K.clean("  a\r\nb\tc   d  "), "a b c d");
  assert.equal(K.clean(undefined), "");
});

test("validate: phone và email bắt buộc, tên và ghi chú tùy chọn", () => {
  assert.deepEqual({ ...K.validate(ok) }, { ok: true, errors: {} });
  assert.equal(K.validate({ phone: "0901234567", email: "a@b.co" }).ok, true);
  const empty = K.validate({});
  assert.equal(empty.ok, false);
  assert.equal(empty.errors.phone, "required");
  assert.equal(empty.errors.email, "required");
  assert.equal(empty.errors.name, undefined);
});

test("validate: số điện thoại", () => {
  for (const p of ["+84 90 123 4567", "0901234567", "(090) 123-4567", "+61410678015", "090.123.4567"]) assert.equal(K.validate({ phone: p, email: "a@b.co" }).errors.phone, undefined, p);
  for (const p of ["12345", "abc", "09012345678901234", "+", "0901 abc 4567"]) assert.equal(K.validate({ phone: p, email: "a@b.co" }).errors.phone, "invalid", p);
});

test("validate: email", () => {
  for (const e of ["a@b.co", "first.last+tag@sub.example.com"]) assert.equal(K.validate({ phone: "0901234567", email: e }).errors.email, undefined, e);
  for (const e of ["a@b", "a b@c.com", "@c.com", "a@.com", "a@b..c", "a@@b.com"]) assert.equal(K.validate({ phone: "0901234567", email: e }).errors.email, "invalid", e);
});

test("buildMailto: gửi tới đúng email công ty, có tiêu đề và đủ thông tin", () => {
  const url = K.buildMailto(CFG, ok);
  assert.ok(url.startsWith("mailto:precy.vuong@tmgm.com?"));
  const m = parse(url);
  assert.equal(m.to, "precy.vuong@tmgm.com");
  assert.match(m.subject, /Nguyễn Văn A/);
  assert.match(m.body, /Phone: \+84 90 123 4567/);
  assert.match(m.body, /Email: a@example\.com/);
  assert.match(m.body, /Name: Nguyễn Văn A/);
  assert.match(m.body, /Hẹn thứ Ba 10h/);
  assert.match(m.body, /Language: vi/);
  assert.match(m.body, /Audience: MIB/);
});

test("buildMailto: không có tên thì dùng email trong tiêu đề", () => {
  const m = parse(K.buildMailto(CFG, { phone: "0901234567", email: "a@b.co" }));
  assert.match(m.subject, /a@b\.co/);
  assert.doesNotMatch(m.body, /Name:/);
});

test("buildMailto: ký tự đặc biệt, tiếng Việt và tiếng Trung được mã hóa và giải mã đúng", () => {
  const data = { name: "王 & 李 #1", phone: "0901234567", email: "a@b.co", note: "Cần tư vấn 5 Sub-IB & ECN?\n50% = tốt" };
  const url = K.buildMailto(CFG, data);
  assert.ok(!/[\r\n ]/.test(url), "URL không được có xuống dòng hay khoảng trắng thô");
  const m = parse(url);
  assert.match(m.body, /Name: 王 & 李 #1/);
  assert.match(m.body, /50% = tốt/);
});

test("buildMailto: chống chèn header (CRLF, Bcc) qua tên hoặc email", () => {
  const evil = { name: "x\r\nBcc: evil@x.com", phone: "0901234567", email: "a@b.co", note: "hi" };
  const url = K.buildMailto(CFG, evil);
  assert.ok(!/%0D%0ABcc|%0ABcc/i.test(url.split("body=")[0]), "subject không được chứa xuống dòng");
  const m = parse(url);
  assert.ok(!/\r|\n(?=Bcc)/.test(m.subject));
  assert.equal(m.bcc, undefined);
  assert.equal(m.to, "precy.vuong@tmgm.com");
});

test("buildMailto: người nhận cố định theo cấu hình, không bị dữ liệu nhập ghi đè", () => {
  const url = K.buildMailto(CFG, { ...ok, to: "evil@x.com", email: "evil@x.com" });
  assert.ok(url.startsWith("mailto:precy.vuong@tmgm.com?"));
  assert.equal(url.split("?")[0].includes("evil"), false);
});

test("buildMailto: ghi chú dài bị cắt để URL không vượt giới hạn trình duyệt/app mail", () => {
  const url = K.buildMailto(CFG, { ...ok, note: "x".repeat(5000) }, "Network: 1,000 FX lots");
  assert.ok(url.length <= 1900, `URL dài ${url.length}`);
  assert.match(parse(url).body, /Network: 1,000 FX lots/); // ngữ cảnh vẫn còn
});

test("buildMailto: kèm ngữ cảnh (số đối tác đã nhập ở máy tính) khi có", () => {
  const m = parse(K.buildMailto(CFG, ok, "Network example: 1,000 FX + 1,400 gold lots · Prime · net deposit 340,000"));
  assert.match(m.body, /Network example: 1,000 FX \+ 1,400 gold lots/);
});

test("buildMailto: dữ liệu không hợp lệ thì ném lỗi thay vì dựng email rác", () => {
  assert.throws(() => K.buildMailto(CFG, { name: "A" }), /invalid/i);
});
