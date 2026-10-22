// Không để lộ nội dung đã khóa trong file công khai (những file sẽ đẩy lên GitHub Pages), và không còn dấu vết Netlify.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const { HAS_PRIVATE, loadLocked, boot, root } = require("./helpers.js");

const SKIP_DIRS = new Set(["node_modules", ".git", "private", ".claude", "fixtures"]);
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : walk(rel);
    return /\.(js|mjs|html|css|md|json|toml)$/.test(e.name) && !/^PLAN_/.test(e.name) ? [rel] : [];
  });
}
const files = walk(".");
const text = Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(root, f), "utf8")]));

test("danh sách file công khai có đủ các file chính (kiểm tra không quét trượt)", () => {
  for (const f of ["content.js", "app.js", "calc.js", "lock.js", "locked.js", "index.html", "style.css", "promotions/index.html", "promotions/promos-data.js", "tests/lock.test.js"]) {
    assert.ok(files.includes(path.normalize(f)), f);
  }
});

test("tên sàn đối thủ, dữ liệu khảo sát và bảng bậc KM không nằm ở file công khai nào", () => {
  const markers = ["Competitor Research", "mibTierPresets: {", "competitors: {", "Revshare", "Exness", "AvaTrade", "PU Prime", "Vantage", "HFM"];
  for (const f of files) for (const m of markers) {
    if (/^tests[\\/]/.test(f)) continue; // các file test tự liệt kê marker để kiểm tra; phần nội dung thật được quét bởi các bài khác
    if (f === path.normalize("content.js") && m === "competitors: {") continue; // chỗ giữ chỗ rỗng
    if (f === path.normalize("content.js") && m === "mibTierPresets: {") continue;
    assert.ok(!text[f].includes(m), `${f} chứa "${m}"`);
  }
  assert.match(text["content.js"], /mibTiers: \[\],\s+mibTierPresets: \{\},\s+ibTiers: \[\],\s+competitors: \{ brokers: \[\] \},/);
});

test("mọi câu chữ dài trong phần khóa (slide KM, Ví dụ, So sánh, ưu đãi riêng) không xuất hiện ở file công khai", { skip: !HAS_PRIVATE && "không có private/" }, () => {
  const strings = new Set();
  const collect = (v) => {
    if (typeof v === "string") { if (v.length >= 45 && !v.startsWith("@private/")) strings.add(v); }
    else if (v && typeof v === "object") Object.values(v).forEach(collect);
  };
  collect(loadLocked());
  assert.ok(strings.size > 150, `chỉ có ${strings.size} chuỗi để kiểm tra`);
  const hay = Object.entries(text).filter(([f]) => f !== path.normalize("locked.js")).map(([, t]) => t).join("\n");
  const found = [...strings].filter((s) => hay.includes(s));
  assert.deepEqual(found, [], `lộ ${found.length} câu chữ`);
});

test("số bậc KM không lộ ở dạng thô trong file công khai (bậc MIB/IB, thưởng tối đa)", { skip: !HAS_PRIVATE && "không có private/" }, () => {
  const p = loadLocked().data;
  const hay = Object.entries(text).filter(([f]) => f !== path.normalize("locked.js")).map(([, t]) => t).join("\n");
  const re = (t) => new RegExp(`deposit:\\s*${t.deposit},\\s*lots:\\s*${t.lots}\\b`);
  for (const t of [...p.mibTiers, ...p.ibTiers]) assert.doesNotMatch(hay, re(t), `bậc ${t.deposit}/${t.lots}`);
  assert.doesNotMatch(hay, /"deposit":\s*500000/);
});

test("ưu đãi chỉ chia sẻ riêng không nằm trong file công khai; ảnh riêng không nằm trong promotions/img", () => {
  const code = text[path.normalize("promotions/promos-data.js")].replace(/\/\*[\s\S]*?\*\//g, ""); // chỉ tính phần mã, bỏ comment
  assert.doesNotMatch(code, /share:\s*"private"/);
  for (const key of ["thaiConcert", "thaiIb", "carnival", "premierLeague"]) for (const f of files) {
    if (/^tests[\\/]|\.md$/.test(f)) continue;
    assert.ok(!(f !== path.normalize("lock.js") && text[f].includes(`key: "${key}"`)), `${f} chứa ưu đãi riêng ${key}`);
  }
  assert.ok(!fs.existsSync(path.join(root, "promotions", "img", "premier-tickets.png")));
  assert.ok(!fs.existsSync(path.join(root, "img", "premier-tickets.png")));
});

test("không còn dấu vết Netlify: không file cấu hình, không hàm, không /api/data, không chữ 'netlify' trong file công khai", () => {
  for (const f of ["netlify.toml", "netlify", "NETLIFY.md", "package.json", "scripts/build-dist.mjs", "dist"]) assert.ok(!fs.existsSync(path.join(root, f)), f);
  for (const f of files) {
    if (/^tests[\\/]/.test(f)) continue; // các file test tự nhắc tên để kiểm tra
    assert.doesNotMatch(text[f], /netlify|\/api\/data|@netlify\/blobs/i, f);
  }
});

test(".gitignore giữ private/, PLAN_*.md, .claude/, node_modules/ ngoài GitHub; không file nào trong private/ đang được theo dõi", () => {
  const gi = fs.readFileSync(path.join(root, ".gitignore"), "utf8").split(/\r?\n/);
  for (const line of ["private/", "PLAN_*.md", ".claude/", "node_modules/"]) assert.ok(gi.includes(line), line);
  assert.ok(!gi.includes(".netlify/"));
  let tracked = "";
  try { tracked = cp.execFileSync("git", ["ls-files", "private"], { cwd: root, encoding: "utf8" }); } catch (e) { return; } // không có git: bỏ qua
  assert.equal(tracked.trim(), "");
});

test("locked.js khớp content công khai: không chứa khóa, mã hay tên đối tác (kể cả private/codes.json)", { skip: !HAS_PRIVATE && "không có private/" }, () => {
  const lockedJs = text["locked.js"];
  const state = JSON.parse(fs.readFileSync(path.join(root, "private", "lock-state.json"), "utf8"));
  assert.ok(!lockedJs.includes(state.contentKey));
  for (const c of JSON.parse(fs.readFileSync(path.join(root, "private", "codes.json"), "utf8"))) {
    assert.ok(!lockedJs.includes(c.code) && !lockedJs.includes(c.name), c.name);
  }
});

test("trang đang khóa (3 ngôn ngữ × 2 đối tượng): HTML sinh ra không có tên sàn đối thủ, khảo sát hay bảng bậc", () => {
  const bad = /Revshare|Exness|AvaTrade|PU Prime|Vantage|HFM|ibCombined|class="gbars|class="h2h|class="cmp"|class="wf"/;
  for (const lang of ["en", "vi", "zh"]) for (const a of ["mib", "ib"]) {
    const b = boot({ locked: true, search: `?lang=${lang}&a=${a}` });
    assert.doesNotMatch(b.html(), bad, `${lang}/${a}`);
    for (const id of ["m2", "m5", "so-sanh"]) assert.doesNotMatch(b.api.html(id), bad, id);
  }
});
