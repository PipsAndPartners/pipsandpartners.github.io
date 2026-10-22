// Chức danh Business Development (không còn Account Manager / AM) và số WhatsApp +61 431 840 947 ở mọi nơi.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { boot, loadContent, loadPromos, root } = require("./helpers.js");

const NEW_LINK = "61431840947", NEW_SHOWN = "+61 431 840 947", OLD_LINK = "61410678015", OLD_SHOWN = "+61 410 678 015";
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const publicText = ["content.js", "app.js", "index.html", "README.md", "promotions/promos-data.js", "promotions/promos.js", "promotions/index.html"];

test("chức danh: Business Development ở 3 ngôn ngữ, cả trang pitch lẫn trang ưu đãi", () => {
  const t = loadContent({ locked: true }).presenter.title, c = loadPromos().contact.title;
  for (const x of [t, c]) {
    assert.equal(x.vi, "Business Development · TMGM");
    assert.equal(x.en, "Business Development · TMGM");
    assert.equal(x.zh, "業務拓展 · TMGM");
  }
});

test("không còn 'Account Manager', '客戶經理' hay viết tắt 'AM' trong nội dung công khai", () => {
  for (const f of publicText) {
    const s = read(f);
    assert.doesNotMatch(s, /Account Manager|客戶經理/, f);
    assert.doesNotMatch(s, /\bAM\b/, `${f}: còn chữ AM`);
  }
});

test("'BD' xuất hiện đúng chỗ người dùng gặp: nhãn hỗ trợ, bước nộp đơn, lịch tiền về", () => {
  const D = loadContent({ locked: true });
  assert.deepEqual(JSON.parse(JSON.stringify(D.support[0].label)), { vi: "BD riêng", en: "Dedicated BD", zh: "專屬 BD" });
  const bonus = D.payouts.find((p) => p.key === "bonus");
  assert.equal(bonus.how.en, "Claim via your BD");
  assert.equal(bonus.how.vi, "Nộp đơn qua BD");
  assert.equal(bonus.how.zh, "透過 BD 申請");
  assert.match(JSON.stringify(D.sections["bat-dau"].timeline), /Your BD files the promo claim/);
});

test("WhatsApp: số mới ở nội dung, trang pitch và trang ưu đãi; số cũ không còn ở đâu (trừ mẫu so QR trong test)", () => {
  for (const d of [loadContent({ locked: true }).presenter, loadPromos().contact]) {
    assert.equal(d.whatsapp, NEW_SHOWN);
    assert.equal(d.whatsappLink, NEW_LINK);
  }
  const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return ["node_modules", ".git", "private", ".claude", "fixtures"].includes(e.name) ? [] : walk(rel);
    return /\.(js|mjs|html|css|md|json)$/.test(e.name) && !/^PLAN_/.test(e.name) ? [rel] : [];
  });
  for (const f of walk(".")) {
    if (f === path.join("tests", "qr.test.js") || f === path.join("tests", "bd.test.js")) continue; // qr: giữ số cũ làm mẫu đối chiếu bộ mã hóa QR; bd: chính file này định nghĩa số cũ
    const s = read(f);
    assert.ok(!s.includes(OLD_LINK) && !s.includes(OLD_SHOWN), `${f} còn số WhatsApp cũ`);
  }
});

test("trang pitch: bìa, footer, slide cuối đều có link wa.me số mới; slide cuối có QR vẽ bằng qr.js (không còn ảnh PNG)", () => {
  for (const lang of ["en", "vi", "zh"]) {
    const h = boot({ locked: true, search: `?lang=${lang}` }).html();
    const links = h.match(/href="https:\/\/wa\.me\/61431840947"/g) || [];
    assert.ok(links.length >= 3, `${lang}: bìa + slide cuối + footer, có ${links.length}`);
    assert.ok((h.match(/\+61 431 840 947/g) || []).length >= 4, lang);
    assert.match(h, /<svg class="qr" viewBox="0 0 33 33" width="112" height="112" role="img" aria-label="QR WhatsApp \+61 431 840 947"/, lang);
    assert.doesNotMatch(h, /qr-whatsapp\.png/, lang);
    assert.match(h, /Business Development|業務拓展/, lang);
  }
  assert.ok(!fs.existsSync(path.join(root, "img", "qr-whatsapp.png")), "đã bỏ ảnh QR WhatsApp cũ");
  assert.ok(!fs.existsSync(path.join(root, "promotions", "img", "qr-whatsapp.png")));
});

test("khung khóa dùng đúng số mới trong lời nhắn WhatsApp có sẵn", () => {
  const h = boot({ locked: true }).api.html("m5");
  assert.match(h, /https:\/\/wa\.me\/61431840947\?text=Hi%20Precy%2C%20I'd%20like%20the%20access%20code/);
});
