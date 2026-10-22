// Mã hóa nội dung nhạy cảm (private/locked-source.json) thành locked.js để đẩy lên GitHub Pages.
//
//   node scripts/lock.mjs                      tạo lại locked.js; tạo mã cho mục chưa có mã trong private/codes.json
//   node scripts/lock.mjs --add "Tên đối tác"  thêm một mã mới cho đối tác đó
//   node scripts/lock.mjs --revoke "Tên"       xóa mã của đối tác đó và đổi khóa nội dung (người đã nhập mã phải nhập lại)
//   node scripts/lock.mjs --rotate             đổi khóa nội dung (mọi người phải nhập lại mã)
//
// private/ không được đẩy lên GitHub (.gitignore): chứa locked-source.json (số thật), codes.json (tên ↔ mã), lock-state.json (khóa nội dung).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Lock = require("../lock.js");
const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_NAMES = ["Precy (demo)", "Partner 01", "Partner 02", "Partner 03", "Partner 04", "Partner 05"];
const MIME = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml" };

const readJson = (f, dflt) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : dflt);
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + "\n"); };

// Ảnh chỉ dành cho người có mã: "@private/img/x.png" → data URL (nằm trong phần mã hóa, không phải file công khai)
function inlineImages(node, root) {
  if (Array.isArray(node)) return node.forEach((n) => inlineImages(n, root));
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === "string" && v.startsWith("@private/")) {
      const f = path.join(root, v.slice(1));
      if (!fs.existsSync(f)) throw new Error(`Thiếu ảnh ${v}`);
      node[k] = `data:${MIME[path.extname(f).toLowerCase()] || "application/octet-stream"};base64,${fs.readFileSync(f).toString("base64")}`;
    } else inlineImages(v, root);
  }
}

export async function build(opts = {}) {
  const root = opts.root || path.join(here, "..");
  const priv = path.join(root, "private");
  const srcFile = path.join(priv, "locked-source.json"), codesFile = path.join(priv, "codes.json"), stateFile = path.join(priv, "lock-state.json");
  if (!fs.existsSync(srcFile)) throw new Error(`Thiếu ${srcFile}`);
  const source = JSON.parse(fs.readFileSync(srcFile, "utf8"));
  inlineImages(source, root);

  let codes = readJson(codesFile, DEFAULT_NAMES.map((name) => ({ name })));
  if (opts.add) codes.push({ name: opts.add });
  let rotate = !!opts.rotate;
  if (opts.revoke) {
    const before = codes.length;
    codes = codes.filter((c) => c.name !== opts.revoke);
    if (codes.length === before) throw new Error(`Không có đối tác tên "${opts.revoke}"`);
    rotate = true;
  }
  const taken = codes.filter((c) => c.code).map((c) => Lock.parse(c.code).id);
  for (const c of codes) if (!c.code) { c.code = Lock.generateCode(taken); taken.push(Lock.parse(c.code).id); }
  if (!codes.length) throw new Error("Cần ít nhất một mã");

  const state = readJson(stateFile, null);
  const contentKey = !rotate && state && state.contentKey ? Lock.fromB64(state.contentKey) : undefined;
  const { bundle, contentKey: key } = await Lock.seal(source, codes.map((c) => c.code), { iter: opts.iter || Lock.ITER, contentKey });

  writeJson(codesFile, codes);
  writeJson(stateFile, { contentKey: Lock.toB64(key), rotatedAt: rotate || !state ? new Date().toISOString() : state.rotatedAt });
  const out = opts.out || path.join(root, "locked.js");
  fs.writeFileSync(out, `/* Nội dung đã mã hóa (AES-GCM). Tạo bằng scripts/lock.mjs, không sửa tay. */\nwindow.PP_LOCKED = ${JSON.stringify(bundle)};\n`);
  return { bundle, codes, out, rotated: rotate || !state };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), val = (f) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : undefined; };
  try {
    const r = await build({ add: val("--add"), revoke: val("--revoke"), rotate: a.includes("--rotate") });
    console.log(`Đã tạo ${path.relative(process.cwd(), r.out)} (${Object.keys(r.bundle.slots).length} mã${r.rotated ? ", đã đổi khóa nội dung" : ""}).`);
    console.log("\nMã truy cập (lưu trong private/codes.json, đổi tên cho đúng đối tác):");
    for (const c of r.codes) console.log(`  ${c.name.padEnd(18)} ${c.code}`);
  } catch (e) { console.error("Lỗi:", e.message); process.exit(1); }
}
