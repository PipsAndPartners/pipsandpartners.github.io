/*
 * Mã QR tối giản, chạy offline (không thư viện): chế độ byte (UTF-8), mức sửa lỗi M, phiên bản 1–10 (tới 213 byte).
 * Dùng cho link trang chương trình ở trang "Ưu đãi khác". Trình duyệt: window.MIBQR; node: require.
 *   matrix(text) → mảng 2 chiều 0/1 (không gồm lề trắng)
 *   svg(text, { size, label }) → chuỗi <svg> vuông, có lề 4 ô
 */
(function (root) {
  // Mức M: [số codeword sửa lỗi mỗi khối, [số khối, số codeword dữ liệu mỗi khối], ...] cho phiên bản 1–10
  const BLOCKS = [null,
    [10, [1, 16]], [16, [1, 28]], [26, [1, 44]], [18, [2, 32]], [24, [2, 43]],
    [16, [4, 27]], [18, [4, 31]], [22, [2, 38], [2, 39]], [22, [3, 36], [2, 37]], [26, [4, 43], [1, 44]]];
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

  // GF(256) với đa thức 0x11D
  const EXP = new Array(512), LOG = new Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

  function rsEcc(data, n) {
    let gen = [1];
    for (let i = 0; i < n; i++) {
      const next = new Array(gen.length + 1).fill(0);
      gen.forEach((g, j) => { next[j] ^= g; next[j + 1] ^= mul(g, EXP[i]); });
      gen = next;
    }
    const res = new Array(n).fill(0);
    for (const d of data) {
      const f = d ^ res.shift();
      res.push(0);
      for (let j = 0; j < n; j++) res[j] ^= mul(gen[j + 1], f);
    }
    return res;
  }

  const utf8 = (s) => Array.from(unescape(encodeURIComponent(s)), (c) => c.charCodeAt(0));
  const dataCap = (v) => BLOCKS[v].slice(1).reduce((s, [n, k]) => s + n * k, 0);

  // Chuỗi codeword cuối cùng (dữ liệu + sửa lỗi, đã xen kẽ các khối)
  function codewords(bytes, v) {
    const cap = dataCap(v), bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4);
    put(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach((b) => put(b, 8));
    put(0, Math.min(4, cap * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    for (let pad = 0xec; data.length < cap; pad ^= 0xec ^ 0x11) data.push(pad);
    const [ecLen, ...groups] = BLOCKS[v], blocks = [];
    let at = 0;
    for (const [n, k] of groups) for (let i = 0; i < n; i++) { const d = data.slice(at, at + k); at += k; blocks.push({ d, e: rsEcc(d, ecLen) }); }
    const out = [], maxK = Math.max(...blocks.map((b) => b.d.length));
    for (let i = 0; i < maxK; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
    for (let i = 0; i < ecLen; i++) for (const b of blocks) out.push(b.e[i]);
    return out;
  }

  const bch = (val, poly, len) => {
    let r = val << len;
    const top = Math.floor(Math.log2(poly));
    for (let i = Math.floor(Math.log2(r)); i >= top; i--) if ((r >>> i) & 1) r ^= poly << (i - top);
    return (val << len) | r;
  };
  const MASKS = [
    (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  // Ma trận với các mẫu cố định; fn[r][c] = true là ô chức năng (không đặt dữ liệu, không áp mask)
  function base(v) {
    const n = 17 + 4 * v, m = Array.from({ length: n }, () => new Array(n).fill(0)), fn = Array.from({ length: n }, () => new Array(n).fill(false));
    const set = (r, c, val) => { if (r >= 0 && c >= 0 && r < n && c < n) { m[r][c] = val ? 1 : 0; fn[r][c] = true; } };
    const finder = (r0, c0) => {
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
        const inR = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        set(r0 + r, c0 + c, inR && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)));
      }
    };
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const al = ALIGN[v];
    for (const r of al) for (const c of al) {
      if (fn[r][c]) continue; // trùng mẫu định vị
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
    for (let i = 0; i < 9; i++) { if (!fn[8][i]) set(8, i, 0); if (!fn[i][8]) set(i, 8, 0); }
    for (let i = 0; i < 8; i++) { set(8, n - 1 - i, 0); set(n - 1 - i, 8, 0); }
    set(n - 8, 8, 1); // ô tối cố định
    if (v >= 7) {
      const bits = bch(v, 0x1f25, 12);
      for (let i = 0; i < 18; i++) { const b = (bits >>> i) & 1, a = Math.floor(i / 3), c = n - 11 + (i % 3); set(a, c, b); set(c, a, b); }
    }
    return { n, m, fn };
  }

  function placeFormat(m, n, mask) {
    const bits = bch((0 << 3) | mask, 0x537, 10) ^ 0x5412; // mức M = 00
    const bit = (i) => (bits >>> i) & 1;
    for (let i = 0; i <= 5; i++) m[8][i] = bit(14 - i);
    m[8][7] = bit(8); m[8][8] = bit(7); m[7][8] = bit(6);
    for (let i = 9; i <= 14; i++) m[14 - i][8] = bit(14 - i);
    for (let i = 0; i < 7; i++) m[n - 1 - i][8] = bit(14 - i); // cột 8, đáy lên: bit 14..8 (ô n-8 là ô tối cố định)
    for (let j = 0; j < 8; j++) m[8][n - 8 + j] = bit(7 - j); // hàng 8, phải: bit 7..0
  }

  function penalty(m, n) {
    let p = 0;
    const lines = (get) => {
      for (let a = 0; a < n; a++) {
        let run = 1;
        for (let b = 1; b <= n; b++) {
          if (b < n && get(a, b) === get(a, b - 1)) run++;
          else { if (run >= 5) p += run - 2; run = 1; }
        }
        for (let b = 0; b + 10 < n + 1; b++) {
          const s = Array.from({ length: 11 }, (_, k) => (b + k < n ? get(a, b + k) : 0)).join("");
          if (b + 11 <= n && (s === "10111010000" || s === "00001011101")) p += 40;
        }
      }
    };
    lines((r, c) => m[r][c]);
    lines((c, r) => m[r][c]);
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) p += 3;
    }
    const dark = m.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
    p += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
    return p;
  }

  // forceMask chỉ dùng khi kiểm thử (so với mã QR có sẵn)
  function matrix(text, forceMask) {
    const bytes = utf8(String(text));
    let v = 1;
    while (v <= 10 && dataCap(v) < bytes.length + (v < 10 ? 2 : 3)) v++;
    if (v > 10) throw new RangeError("Chuỗi quá dài cho mã QR (tối đa phiên bản 10)");
    const cw = codewords(bytes, v), { n, m, fn } = base(v);
    const bits = [];
    cw.forEach((b) => { for (let i = 7; i >= 0; i--) bits.push((b >>> i) & 1); });
    let k = 0;
    for (let right = n - 1, up = true; right > 0; right -= 2, up = !up) {
      if (right === 6) right = 5;
      for (let i = 0; i < n; i++) {
        const r = up ? n - 1 - i : i;
        for (const c of [right, right - 1]) if (!fn[r][c]) { m[r][c] = k < bits.length ? bits[k] : 0; k++; }
      }
    }
    let best = null;
    for (let mask = 0; mask < 8; mask++) {
      if (forceMask != null && mask !== forceMask) continue;
      const t = m.map((row, r) => row.map((val, c) => (fn[r][c] ? val : val ^ (MASKS[mask](r, c) ? 1 : 0))));
      placeFormat(t, n, mask);
      const score = penalty(t, n);
      if (!best || score < best.score) best = { t, score };
    }
    return best.t;
  }

  function svg(text, opts = {}) {
    const m = matrix(text), n = m.length, q = 4, size = opts.size || 120;
    let d = "";
    m.forEach((row, r) => row.forEach((v, c) => { if (v) d += `M${c + q} ${r + q}h1v1h-1z`; }));
    const label = String(opts.label || text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    return `<svg class="qr" viewBox="0 0 ${n + 2 * q} ${n + 2 * q}" width="${size}" height="${size}" role="img" aria-label="${label}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#0B1F4D"/></svg>`;
  }

  const api = { matrix, svg };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MIBQR = api;
})(this);
