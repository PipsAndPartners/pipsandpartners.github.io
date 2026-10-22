// Mã QR tự viết (qr.js): so từng ô với 2 mã QR đã dùng thật trên trang (img/qr-telegram.png, img/qr-whatsapp.png).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const Q = require("../qr.js");

// Đọc PNG RGB 8 bit (không interlace) → lưới ô QR, biết sẵn lề 20 px và ô 10 px (ảnh 290 × 290, phiên bản 2)
function pngGrid(file, quiet = 20, mod = 10) {
  const b = fs.readFileSync(file.startsWith("fixtures/") ? path.join(__dirname, file) : path.join(__dirname, "..", "img", file));
  let i = 8, w = 0, h = 0;
  const idat = [];
  while (i < b.length) {
    const n = b.readUInt32BE(i), t = b.toString("ascii", i + 4, i + 8), dta = b.subarray(i + 8, i + 8 + n);
    if (t === "IHDR") { w = dta.readUInt32BE(0); h = dta.readUInt32BE(4); }
    if (t === "IDAT") idat.push(dta);
    i += 12 + n;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * 3, rows = [];
  let prev = Buffer.alloc(stride), p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p], line = Buffer.from(raw.subarray(p + 1, p + 1 + stride));
    p += 1 + stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= 3 ? line[x - 3] : 0, up = prev[x], c = x >= 3 ? prev[x - 3] : 0;
      if (ft === 1) line[x] = (line[x] + a) & 255;
      else if (ft === 2) line[x] = (line[x] + up) & 255;
      else if (ft === 3) line[x] = (line[x] + ((a + up) >> 1)) & 255;
      else if (ft === 4) {
        const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c)) & 255;
      }
    }
    rows.push(line);
    prev = line;
  }
  const n = Math.round((w - 2 * quiet) / mod);
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, col) => (rows[Math.floor(quiet + (r + 0.5) * mod)][Math.floor(quiet + (col + 0.5) * mod) * 3] < 128 ? 1 : 0)));
}
const same = (a, b) => a.length === b.length && a.every((row, r) => row.every((v, c) => v === b[r][c]));

test("QR Telegram: khớp từng ô với mã đang dùng (phiên bản 2, mức M, mask tự chọn = 0)", () => {
  assert.ok(same(Q.matrix("https://t.me/guowang26"), pngGrid("qr-telegram.png")));
});

// Mã WhatsApp cũ (số cũ) giữ làm mẫu đối chiếu cho bộ mã hóa; số hiện tại được vẽ trực tiếp bằng qr.js, không còn ảnh PNG.
test("QR WhatsApp: khớp từng ô với mã mẫu khi dùng cùng mask 1 (cách chọn mask khác nhau, cả hai đều hợp lệ)", () => {
  assert.ok(same(Q.matrix("https://wa.me/61410678015", 1), pngGrid("fixtures/qr-whatsapp-old.png")));
  assert.equal(Q.matrix("https://wa.me/61410678015").length, 25);
});

test("QR WhatsApp hiện tại (+61 431 840 947): cùng phiên bản 2, khác mã số cũ, có 3 mẫu định vị", () => {
  const D = require("./helpers").loadContent();
  assert.equal(D.presenter.whatsappLink, "61431840947");
  const m = Q.matrix(`https://wa.me/${D.presenter.whatsappLink}`), old = Q.matrix("https://wa.me/61410678015");
  assert.equal(m.length, 25);
  assert.ok(!same(m, old));
  const n = m.length;
  for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) assert.deepEqual(m[r + 3].slice(c, c + 7), [1, 0, 1, 1, 1, 0, 1]);
});

test("QR: chọn phiên bản theo độ dài; quá dài thì báo lỗi; svg có lề 4 ô", () => {
  assert.equal(Q.matrix("a").length, 21); // phiên bản 1
  assert.equal(Q.matrix("https://lnd.tmgm.com/en/ultimate-gadget-rewards").length, 33); // 47 byte → phiên bản 4
  assert.equal(Q.matrix("x".repeat(213)).length, 57); // phiên bản 10, tối đa
  assert.throws(() => Q.matrix("x".repeat(214)), RangeError);
  const s = Q.svg("https://lnd.tmgm.com/en/JayChouMY", { size: 92, label: 'a"b' });
  assert.match(s, /^<svg class="qr" viewBox="0 0 37 37" width="92" height="92" role="img" aria-label="a&quot;b"/);
  // 3 mẫu định vị ở 3 góc
  const m = Q.matrix("https://lnd.tmgm.com/en/JayChouMY"), n = m.length;
  for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) assert.deepEqual(m[r + 3].slice(c, c + 7), [1, 0, 1, 1, 1, 0, 1]);
});
