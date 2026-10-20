// Kiểm tra giao diện bằng DOM giả: HTML sinh ra và hành vi khi bấm/nhập. Ngày "hôm nay" cố định là 9/10/2026.
const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, click, input } = require("./helpers.js");

const MIB_SLIDES = ["bia", "phap-ly", "nam-dong", "tai-khoan", "ecn-q4", "ecn-calc", "lich-tien", "m2", "m4", "m5", "so-sanh", "uu-dai", "km-khac", "bat-dau"];
const IB_SLIDES = ["bia", "phap-ly", "nam-dong", "tai-khoan", "ecn-q4", "ecn-calc", "lich-tien", "m2", "m4", "uu-dai", "km-khac", "bat-dau"];
const count = (s, re) => (s.match(re) || []).length;
const REG = { "mib-reg": "1" }; // đã bấm Register: slide So sánh mở khóa
const ids = (html) => [...html.matchAll(/<section id="([\w-]+)"/g)].map((m) => m[1]);
const attrs = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "g"))].map((m) => m[0]);

// ---------- tổng quát ----------
test("mặc định: tiếng Anh, đối tượng MIB, 14 slide đúng thứ tự (đã bỏ slide IB)", () => {
  const b = boot();
  assert.equal(b.api.state.lang, "en");
  assert.equal(b.api.state.aud, "mib");
  assert.deepEqual(ids(b.html()), MIB_SLIDES);
});

test("đối tượng IB: giữ các slide chung và slide KM/Swap, bỏ phần riêng của MIB", () => {
  assert.deepEqual(ids(boot({ search: "?a=ib" }).html()), IB_SLIDES);
});

test("cả 3 ngôn ngữ × 2 đối tượng: không có undefined / NaN / [object Object]", () => {
  for (const lang of ["en", "vi", "zh"]) for (const a of ["mib", "ib"]) {
    const h = boot({ search: `?lang=${lang}&a=${a}` }).html();
    assert.ok(h.length > 5000, `${lang}/${a} quá ngắn`);
    assert.doesNotMatch(h, /undefined|NaN|\[object Object\]/, `${lang}/${a}`);
  }
});

test("chuyển ngôn ngữ và đối tượng bằng nút trên header", () => {
  const b = boot();
  click(b, { act: "lang", v: "vi" });
  assert.equal(b.api.state.lang, "vi");
  assert.match(b.html(), /năm dòng thu nhập/);
  click(b, { act: "lang", v: "zh" });
  assert.match(b.html(), /五條收入來源/);
  click(b, { act: "aud", v: "ib" });
  assert.deepEqual(ids(b.html()), IB_SLIDES);
  assert.ok(b.store["mib-lang"] === "zh" && b.store["mib-aud"] === "ib", "ghi nhớ lựa chọn");
});

// ---------- slide 1: bìa và thanh menu ----------
test("bìa: không còn ảnh nền, không còn dòng ghi nguồn ảnh", () => {
  const h = boot().html();
  assert.doesNotMatch(h, /hero-bg|hero-sydney|hero-credit|hero-shade/);
  assert.match(h, /id="h-bia"/);
  assert.match(h, /btn--lime/); // nút Register trên bìa
});

test("thanh menu: một nút mở danh sách đủ các slide; không còn dãy số rút gọn", () => {
  const b = boot();
  const h = b.html();
  assert.doesNotMatch(h, /class="top-nav"/);
  assert.match(h, /<button[^>]*class="menu-btn"[^>]*data-act="menu"[^>]*aria-expanded="false"/);
  assert.match(h, /<nav id="menu-panel" class="menu-panel" hidden/);
  const links = attrs(h.slice(h.indexOf('id="menu-panel"')), "a").filter((a) => /menu-item/.test(a));
  assert.equal(links.length, 14); // 14 slide của MIB
  assert.match(h, /class="top-progress"/);
});

test("thanh menu: bấm nút thì mở, bấm lần nữa hoặc chọn một slide thì đóng", () => {
  const b = boot();
  click(b, { act: "menu" });
  assert.equal(b.api.state.menu, true);
  assert.match(b.api.header(), /aria-expanded="true"/);
  assert.doesNotMatch(b.api.header(), /id="menu-panel" class="menu-panel" hidden/);
  click(b, { go: "ecn-q4" });
  assert.equal(b.api.state.menu, false);
  click(b, { act: "menu" });
  click(b, { act: "menu" });
  assert.equal(b.api.state.menu, false);
});

test("thanh menu: ngôn ngữ (3 nút) và Register ở header; chuyển MIB/IB nằm trong danh sách", () => {
  const h = boot().api.header();
  assert.equal(count(h, /data-act="lang"/g), 3);
  assert.match(h, /btn--lime/);
  const panel = h.slice(h.indexOf('id="menu-panel"'));
  assert.equal(count(panel, /data-act="aud"/g), 2);
  assert.equal(count(h, /data-act="aud"/g), 2); // không bị lặp ngoài danh sách
});

// ---------- chế độ trình bày: mở thẳng một slide bằng #id ----------
test("?present#so-sanh mở thẳng slide 11 (trước đây luôn về bìa) và giữ hash", () => {
  for (const [hash, id] of [["#so-sanh", "so-sanh"], ["#bat-dau", "bat-dau"], ["#phap-ly", "phap-ly"]]) {
    const b = boot({ search: "?present", hash });
    assert.equal(b.api.state.present, true);
    assert.equal(b.api.state.idx, MIB_SLIDES.indexOf(id), hash);
    assert.equal(b.ctx.location.hash, hash);
  }
});

test("?present: không có hash, hash lạ, hoặc slide không có ở đối tượng IB thì mở bìa", () => {
  for (const [search, hash] of [["?present", ""], ["?present", "#khong-co"], ["?present&a=ib", "#so-sanh"]]) {
    const b = boot({ search, hash });
    assert.equal(b.api.state.idx, 0, `${search}${hash}`);
    assert.equal(b.ctx.location.hash, "#bia");
  }
  const b = boot({ search: "?present&a=ib", hash: "#uu-dai" }); // IB vẫn có slide Ưu đãi cho khách
  assert.equal(b.api.state.idx, IB_SLIDES.indexOf("uu-dai"));
});

test("không trình bày: #id trên URL giữ nguyên, không bị đổi", () => {
  const b = boot({ hash: "#so-sanh" });
  assert.equal(b.api.state.present, false);
  assert.equal(b.ctx.location.hash, "#so-sanh");
});

// ---------- slide 2: verify và ảnh có link ----------
test("slide 2: 4 nút Verify nổi bật, mỗi nút mở đúng trang của cơ quan quản lý", () => {
  const h = boot().api.html("phap-ly");
  const btns = attrs(h, "a").filter((a) => /btn--verify/.test(a));
  assert.equal(btns.length, 4);
  for (const a of btns) assert.match(a, /target="_blank"[^>]*rel="noopener"|rel="noopener"[^>]*target="_blank"/);
  assert.match(btns[0], /service\.asic\.gov\.au\/search\/EntityDetail\?LicenceNumber=436416/);
  assert.match(btns[1], /vfsc\.vu/);
  assert.match(btns[2], /fsaseychelles\.sc/);
  assert.match(btns[3], /opr\.fscmauritius\.org/);
  assert.match(btns[3], /opr\.fscmauritius\.org\/ords\/opr\/r\/fsc-opr\/fsc-online-public-register-opr"/);
  assert.match(btns[3], /data-copy="Trademax"/);
  assert.equal(count(btns.join(""), /data-copy=/g), 1);
  assert.match(h, /regs-hint/); // FSC: ghi chú hướng dẫn copy/dán
  for (const name of ["ASIC", "VFSC", "FSA Seychelles", "FSC Mauritius"]) assert.match(h, new RegExp(`Verify[^<]*${name}`));
});

test("slide 2: bấm vào ảnh Chelsea, Australian Open, AFF và huy hiệu thì mở bài tương ứng", () => {
  const h = boot().api.html("phap-ly");
  const links = attrs(h, "a").filter((a) => /shot-link/.test(a));
  assert.equal(links.length, 3);
  assert.match(links[0], /chelseafc\.com/);
  assert.match(links[1], /ausopen\.com/);
  assert.match(links[2], /tmgm\.com/);
  for (const a of links) assert.match(a, /target="_blank"/);
  assert.match(h, /class="award-link"[^>]*href="https:\/\/www\.tmgm\.com/);
});

// ---------- slide 4: chi phí khách ----------
test("slide 4: chi phí vàng của Edge là 15 theo file khảo sát", () => {
  const h = boot().api.html("tai-khoan");
  assert.match(h, /<th scope="row">Edge[\s\S]*?~15<\/span>/);
  assert.match(h, /<th scope="row">STD<[\s\S]*?~18<\/span>[\s\S]*?~33<\/span>/);
});

// ---------- slide 6: ECN ----------
test("slide 6: ba bước nằm trong một nút gập, mặc định đóng", () => {
  const h = boot().api.html("ecn-calc");
  assert.match(h, /<details class="steps-fold">\s*<summary/);
  assert.doesNotMatch(h, /<details class="steps-fold"[^>]*\bopen\b/);
  assert.match(h, /class="steps3"/);
  assert.match(h, /<summary[\s\S]*?(3 steps|3 bước|三步驟)[\s\S]*?<\/summary>/);
});

test("slide 6: máy tính mặc định 150.000 / 1.000 lot FX / 1.000 lot vàng → 6.900 USD", () => {
  const h = boot().api.html("ecn-calc");
  for (const [k, v] of [["deposit", 150000], ["lotsFx", 1000], ["lotsGold", 1000]]) assert.match(h, new RegExp(`data-ecn="${k}" value="${v}"`));
  const out = h.slice(h.indexOf('id="ecn-out"'));
  assert.match(out, /USD 4,000/);
  assert.match(out, /\+USD 2,900/);
  assert.match(out, /USD 6,900/);
  assert.match(h, /USD 6,320/); // ví dụ chính thức của TMGM giữ nguyên
});

test("slide 6: nhập số khác thì tính lại; nút reset về mặc định 1.000 lot", () => {
  const b = boot();
  input(b, { ecn: "deposit" }, "450000");
  assert.equal(b.api.state.ecn.deposit, 450000);
  click(b, { act: "reset-ecn" });
  assert.deepEqual({ ...b.api.state.ecn }, { deposit: 150000, lotsFx: 1000, lotsGold: 1000 });
});

// ---------- slide 7: lịch nhận tiền ----------
test("slide 7: mặc định chỉ có rebate cơ bản T+1; các khuyến mãi là add-on đang tắt", () => {
  const h = boot().api.html("lich-tien");
  assert.equal(count(h, /<tr data-row="/g), 1);
  assert.match(h, /<tr data-row="base"/);
  assert.match(h, /Mon, Oct 12, 2026/); // T = 9/10 (thứ Sáu) → T+1 ngày làm việc = thứ Hai 12/10
  const chips = attrs(h, "button").filter((a) => /data-act="pay-addon"/.test(a));
  assert.deepEqual(chips.map((c) => /data-v="(\w+)"/.exec(c)[1]), ["wed", "day13", "bd5", "bonus", "gift"]);
  for (const c of chips) assert.match(c, /aria-pressed="false"/);
  assert.match(h, /data-pay="trade"[^>]*value="2026-10-09"/);
  assert.doesNotMatch(h, /data-pay="apply"/); // ngày nộp đơn chỉ hiện khi bật KM tháng hoặc quà khách
});

test("slide 7: bật add-on ECN Q4 thì hiện cửa sổ 2–6/11/2026, tự động, không cần đăng ký", () => {
  const b = boot();
  click(b, { act: "pay-addon", v: "bd5" });
  const h = b.api.html("lich-tien");
  assert.match(h, /<tr data-row="bd5"/);
  assert.match(h, /Nov 2, 2026[^<]*–[^<]*Nov 6, 2026/);
  assert.match(h, /data-act="pay-addon" data-v="bd5" aria-pressed="true"/);
  click(b, { act: "pay-addon", v: "bd5" }); // bấm lại để tắt
  assert.equal(count(b.api.html("lich-tien"), /<tr data-row="/g), 1);
});

test("slide 7: KM tháng có hạn nộp 7/11 (cuối tuần → nên nộp 6/11) và tiền về chậm nhất 26/11", () => {
  const b = boot();
  click(b, { act: "pay-addon", v: "bonus" });
  const h = b.api.html("lich-tien");
  assert.match(h, /<tr data-row="bonus"/);
  assert.match(h, /Nov 7, 2026/);
  assert.match(h, /Fri, Nov 6, 2026/);
  assert.match(h, /Nov 26, 2026/);
  assert.match(h, /data-pay="apply"[^>]*value="2026-11-06"/);
});

test("slide 7: nộp muộn hơn hạn thì cảnh báo quá hạn", () => {
  const b = boot();
  click(b, { act: "pay-addon", v: "bonus" });
  input(b, { pay: "apply" }, "2026-11-10");
  const h = b.api.html("lich-tien");
  assert.match(h, /class="late"/);
  assert.match(h, /Past the deadline/);
});

test("slide 7: hoàn swap tuần (thứ Tư) và tháng (trước ngày 14); Cashback Q4 của khách về ngay khi đổi", () => {
  const b = boot();
  for (const v of ["wed", "day13", "gift"]) click(b, { act: "pay-addon", v });
  const h = b.api.html("lich-tien");
  assert.match(h, /<tr data-row="wed"[\s\S]*?Wed, Oct 14, 2026/);
  assert.match(h, /<tr data-row="day13"[\s\S]*?Before[^<]*Nov 14, 2026/i);
  assert.match(h, /<tr data-row="gift"[\s\S]*?Fri, Nov 6, 2026/);
});

test("slide 7: đổi ngày giao dịch thì lịch đổi theo; ngoài kỳ Q4 thì ECN báo không áp dụng", () => {
  const b = boot();
  click(b, { act: "pay-addon", v: "bd5" });
  input(b, { pay: "trade" }, "2026-12-15");
  assert.match(b.api.html("lich-tien"), /Jan 1, 2027[^<]*–[^<]*Jan 7, 2027/);
  input(b, { pay: "trade" }, "2026-09-15");
  assert.match(b.api.html("lich-tien"), /Outside the Q4 period/);
});

test("slide 7: ngày nhập sai hoặc trống thì giữ ngày cũ, không vỡ trang", () => {
  const b = boot();
  input(b, { pay: "trade" }, "");
  input(b, { pay: "trade" }, "không phải ngày");
  assert.equal(b.api.state.pay.trade, "2026-10-09");
  assert.doesNotMatch(b.api.html("lich-tien"), /undefined|NaN|Invalid/);
});

test("slide 7: ghi chú rebate cơ bản T+1 'chờ TMGM xác nhận'", () => {
  const h = boot().api.html("lich-tien");
  assert.match(h, /class="pending"[^>]*>[^<]*(awaiting|pending)[^<]*confirmation/i);
});

// ---------- slide 8: KM MIB / KM IB và bậc tùy chỉnh ----------
test("slide 8 (MIB): nút chuyển MIB | IB, mặc định MIB 5 bậc, ghi chú chỉ chọn một trong hai", () => {
  const h = boot().api.html("m2");
  const btns = attrs(h, "button").filter((a) => /data-act="promo"/.test(a));
  assert.equal(btns.length, 2);
  assert.match(btns[0], /data-v="mib"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-v="mib"/);
  assert.equal(count(h, /class="gb"/g), 5);
  assert.match(h, /class="warn"/);
});

test("slide 8: chuyển sang KM IB → 7 bậc, 15.000 USD và các điều kiện lot", () => {
  const b = boot();
  click(b, { act: "promo", v: "ib" });
  const h = b.api.html("m2");
  assert.equal(count(h, /class="gb"/g), 7);
  assert.match(h, /USD 15,000/);
  assert.match(h, /5 direct/i);
  assert.match(h, /2 minutes/);
  click(b, { act: "promo", v: "mib" });
  assert.equal(count(b.api.html("m2"), /class="gb"/g), 5);
});

test("slide 8 (IB): không có nút chuyển, chỉ hiện KM IB", () => {
  const h = boot({ search: "?a=ib" }).api.html("m2");
  assert.doesNotMatch(h, /data-act="promo"/);
  assert.equal(count(h, /class="gb"/g), 7);
});

test("tùy chỉnh bậc: nút mở bảng sửa; thêm, xóa, sửa số thì biểu đồ đổi theo và được ghi nhớ", () => {
  const b = boot();
  assert.doesNotMatch(b.api.html("m2"), /class="tier-editor"/);
  click(b, { act: "tiers-edit" });
  let h = b.api.html("m2");
  assert.match(h, /class="tier-editor"/);
  assert.equal(count(h, /data-tier="mib:\d+:deposit"/g), 5);
  click(b, { act: "tier-add" });
  assert.equal(b.api.state.tiers.mib.length, 6);
  click(b, { act: "tier-del", v: "mib:5" });
  assert.equal(b.api.state.tiers.mib.length, 5);
  input(b, { tier: "mib:0:mib" }, "1500");
  assert.equal(b.api.state.tiers.mib[0].mib, 1500);
  assert.match(b.api.html("m2"), />1,500</);
  assert.ok(JSON.parse(b.store["mib-tiers"]).mib[0].mib === 1500);
});

test("tùy chỉnh bậc: giá trị rác bị bỏ qua, không xóa được bậc cuối cùng", () => {
  const b = boot();
  click(b, { act: "tiers-edit" });
  input(b, { tier: "mib:0:deposit" }, "abc");
  assert.equal(b.api.state.tiers.mib[0].deposit, 50000);
  input(b, { tier: "mib:0:lots" }, "-5");
  assert.equal(b.api.state.tiers.mib[0].lots, 375);
  for (let i = 0; i < 10; i++) click(b, { act: "tier-del", v: "mib:0" });
  assert.equal(b.api.state.tiers.mib.length, 1);
});

test("tùy chỉnh bậc: chọn bộ 7 bậc theo file khảo sát; nút đặt lại về mặc định", () => {
  const b = boot();
  click(b, { act: "tiers-edit" });
  input(b, { tierPreset: "mib" }, "research7");
  assert.equal(b.api.state.tiers.mib.length, 7);
  assert.equal(b.api.state.tiers.mib[0].mib, 300);
  click(b, { act: "tier-reset" });
  assert.equal(b.api.state.tiers.mib.length, 5);
  assert.equal(b.api.state.tiers.mib[0].mib, 1300);
});

test("tùy chỉnh bậc IB độc lập với bậc MIB", () => {
  const b = boot();
  click(b, { act: "promo", v: "ib" });
  click(b, { act: "tiers-edit" });
  assert.equal(count(b.api.html("m2"), /data-tier="ib:\d+:deposit"/g), 7);
  input(b, { tier: "ib:0:reward" }, "300");
  assert.equal(b.api.state.tiers.ib[0].reward, 300);
  assert.equal(b.api.state.tiers.mib[0].mib, 1300);
});

test("bậc tùy chỉnh được nạp lại từ lần dùng trước; dữ liệu hỏng thì về mặc định", () => {
  const saved = JSON.stringify({ mib: [{ deposit: 1000, lots: 10, mib: 999 }], ib: null });
  const b = boot({ store: { "mib-tiers": saved } });
  assert.equal(b.api.state.tiers.mib.length, 1);
  assert.equal(b.api.state.tiers.mib[0].mib, 999);
  assert.equal(b.api.state.tiers.ib.length, 7);
  const bad = boot({ store: { "mib-tiers": "{không phải json" } });
  assert.equal(bad.api.state.tiers.mib.length, 5);
});

test("bậc tùy chỉnh chảy sang máy tính ở slide Ví dụ", () => {
  const b = boot();
  click(b, { act: "tiers-edit" });
  input(b, { tier: "mib:3:mib" }, "20000"); // bậc 340K/2.400 lot: thưởng 20.000 thay vì 12.900
  assert.match(b.api.html("m5"), /USD 26,300/); // 6.300 + 20.000
});

// ---------- slide 10: add-on ----------
test("slide 10: mặc định không add-on, tổng 19.200; chip ECN bị khóa vì đang chọn Prime", () => {
  const h = boot().api.html("m5");
  assert.match(h.slice(h.indexOf('id="calc-out"')), /USD 19,200/);
  const chips = attrs(h, "button").filter((a) => /data-act="addon"/.test(a));
  assert.deepEqual(chips.map((c) => /data-v="(\w+)"/.exec(c)[1]), ["ecn", "swap"]);
  assert.match(chips[0], /disabled/);
  for (const c of chips) assert.match(c, /aria-pressed="false"/);
  assert.doesNotMatch(h, /data-swap=/);
});

test("slide 10: chọn Edge rồi bật ECN → thêm cột ECN, tổng 18.880 và hiện cả tổng cơ bản", () => {
  const b = boot();
  input(b, { calc: "account" }, "Edge");
  click(b, { act: "addon", v: "ecn" });
  assert.equal(b.api.state.addons.ecn, true);
  const h = b.api.html("m5");
  assert.match(h.slice(h.indexOf('id="calc-out"')), /USD 18,880/);
  assert.match(h, /Q4 ECN/);
  assert.match(h, /USD 14,340/); // tổng cơ bản (không add-on)
  assert.doesNotMatch(attrs(h, "button").find((a) => /data-v="ecn"/.test(a)), /disabled/);
});

test("slide 10: bật Swap → hiện 2 ô nhập (phí swap, net deposit khách trực tiếp) và 2 dòng hoàn swap", () => {
  const b = boot();
  click(b, { act: "addon", v: "swap" });
  const h = b.api.html("m5");
  assert.match(h, /data-swap="fee"/);
  assert.match(h, /data-swap="nd"/);
  const out = h.slice(h.indexOf('id="calc-out"'));
  assert.match(out, /USD 20,\d{3}/);
  input(b, { swap: "fee" }, "2000");
  input(b, { swap: "nd" }, "40000");
  assert.equal(b.api.state.swap.fee, 2000);
  assert.match(b.api.html("m5"), /USD 20,800/); // 19.200 + 600 (tuần) + 1.000 (tháng 50%)
});

test("slide 10: chuyển từ Edge sang Prime thì ECN tự tắt", () => {
  const b = boot();
  input(b, { calc: "account" }, "Edge");
  click(b, { act: "addon", v: "ecn" });
  input(b, { calc: "account" }, "Prime");
  assert.equal(b.api.state.addons.ecn, false);
});

test("slide 10: bấm ECN khi chưa chọn Edge thì không có tác dụng", () => {
  const b = boot();
  click(b, { act: "addon", v: "ecn" });
  assert.equal(b.api.state.addons.ecn, false);
});

// ---------- slide 11: so sánh ----------
test("slide 11: dòng 'đang tính' đổi theo công tắc ECN; swap không đưa vào bảng xếp hạng", () => {
  const b = boot({ store: REG });
  click(b, { act: "cmpview", v: "rank" });
  let h = b.api.html("so-sanh");
  assert.match(h, /class="counting"/);
  assert.match(h, /class="tag">[^<]*MIB promo/);
  assert.doesNotMatch(h, /class="tag">[^<]*Q4 ECN/);
  assert.match(h, /not (counted|included)[^<]*swap|swap[^<]*not (counted|included)/i);
  click(b, { act: "cmp", v: "raw" });
  input(b, { calc: "account" }, "Edge");
  click(b, { act: "addon", v: "ecn" });
  h = b.api.html("so-sanh");
  assert.match(h, /class="tag">[^<]*Q4 ECN/);
  assert.match(h, /USD 18,880/); // TMGM Raw/ECN = giữ 1.440 + KM 12.900 + ECN 4.540
});

// ---------- slide 13: form liên hệ ----------
test("slide 13: có form liên hệ (tên, điện thoại, email, ghi chú) và nút gửi; không còn nút Đặt lịch hẹn", () => {
  const h = boot().api.html("bat-dau");
  assert.match(h, /<form class="contact-form" data-form="contact"/);
  for (const k of ["name", "phone", "email", "note"]) assert.match(h, new RegExp(`data-contact="${k}"`));
  assert.match(h, /<button type="submit"/);
  assert.doesNotMatch(h, /Book appointment|Đặt lịch hẹn/);
  assert.match(h, /precy\.vuong@tmgm\.com/);
});

test("form liên hệ: gửi khi thiếu hoặc sai phone/email thì báo lỗi và không mở email", () => {
  const b = boot();
  b.fire("submit", { target: { dataset: { form: "contact" } } });
  assert.equal(b.api.state.contact.status, "invalid");
  assert.equal(b.ctx.location.href, "");
  let h = b.api.html("bat-dau");
  assert.match(h, /data-contact="phone"[^>]*aria-invalid="true"/);
  assert.match(h, /data-contact="email"[^>]*aria-invalid="true"/);
  input(b, { contact: "phone" }, "12345");
  input(b, { contact: "email" }, "a@b");
  b.fire("submit", { target: { dataset: { form: "contact" } } });
  assert.equal(b.api.state.contact.errors.phone, "invalid");
  assert.equal(b.api.state.contact.errors.email, "invalid");
  assert.equal(b.ctx.location.href, "");
});

test("form liên hệ: dữ liệu hợp lệ thì mở bản nháp email tới precy.vuong@tmgm.com kèm số đã nhập", () => {
  const b = boot();
  input(b, { contact: "name" }, "Nguyễn Văn A");
  input(b, { contact: "phone" }, "+84 90 123 4567");
  input(b, { contact: "email" }, "a@example.com");
  input(b, { contact: "note" }, "Hẹn thứ Ba 10h");
  b.fire("submit", { target: { dataset: { form: "contact" } } });
  assert.equal(b.api.state.contact.status, "sent");
  const url = b.ctx.location.href;
  assert.ok(url.startsWith("mailto:precy.vuong@tmgm.com?"), url);
  const body = decodeURIComponent(/body=([^&]*)/.exec(url)[1]);
  assert.match(body, /Phone: \+84 90 123 4567/);
  assert.match(body, /Email: a@example\.com/);
  assert.match(body, /Hẹn thứ Ba 10h/);
  assert.match(body, /1,000 FX/); // số đối tác đã nhập ở máy tính
  assert.match(body, /Language: en/);
  assert.match(b.api.html("bat-dau"), /class="contact-ok"/);
});

test("form liên hệ: giữ nguyên dữ liệu đã nhập khi đổi ngôn ngữ", () => {
  const b = boot();
  input(b, { contact: "email" }, "a@example.com");
  click(b, { act: "lang", v: "vi" });
  assert.match(b.api.html("bat-dau"), /data-contact="email"[^>]*value="a@example\.com"/);
});

test("slide 13: nút Register vẫn có", () => {
  assert.match(boot().api.html("bat-dau"), /btn--lime[\s\S]*portal\.tmgm\.com\/register/);
});

// ---------- ưu đãi cho khách: Points mặc định trừ vào chi phí khách ----------
test("slide 4: không còn phần Points; STD chỉ dành cho IB, Prime cho nhóm IB", () => {
  const h = boot().api.html("tai-khoan");
  assert.doesNotMatch(h, /Points|hbar-pts|sw--pts/);
  assert.match(h, /<th scope="row">Prime<\/th>[\s\S]*?IB groups: MIBs sharing rebates with Sub-IBs/);
  assert.match(h, /<th scope="row">STD<\/th>[\s\S]*?IBs only \(direct clients\)/);
  assert.match(h, /Prime for IB groups[\s\S]*?STD only for IBs with direct clients/);
});

test("slide 11: chỉ dòng TMGM ghi chi phí sau Points", () => {
  const b = boot({ store: REG });
  click(b, { act: "cmpview", v: "rank" });
  const h = b.api.html("so-sanh");
  const rowsHtml = h.split('<div class="cmp-row').slice(1);
  assert.equal(rowsHtml.length, 10);
  for (const r of rowsHtml) {
    if (r.startsWith(" is-us")) assert.match(r, /≈17\.5\/32\.5 after Points/);
    else assert.doesNotMatch(r.split("</small>")[0], /after Points/);
  }
  assert.match(h, /client cost after Points \(minus USD 0\.5\/lot\)/);
});

test("slide Ưu đãi cho khách: mặc định khách nhận lại 585 USD; Halloween đã chuyển sang slide Ưu đãi khác", () => {
  const h = boot().api.html("uu-dai");
  assert.match(h, /TMGM Points/);
  assert.match(h, /Q4 cashback · tier 4/);
  assert.match(h, /USD 585/);
  assert.match(h, /≈ USD 3\.44 per lot/);
  assert.doesNotMatch(h, /class="hw"|lnd\.tmgm-apac\.com\/en\/halloween/);
  assert.match(h, /Only for clients who deposited before 1 Oct 2026/);
  assert.match(h, /<a href="#km-khac" data-go="km-khac">See more promotions/);
});

test("slide Ưu đãi cho khách: nhập số thì cập nhật state; nút reset về mặc định", () => {
  const b = boot();
  input(b, { client: "deposit" }, "999");
  input(b, { client: "lots" }, "-5");
  assert.deepEqual({ ...b.api.state.client }, { deposit: 999, lots: 0 });
  assert.match(b.api.html("uu-dai"), /tier 1 not reached/);
  click(b, { act: "reset-client" });
  assert.deepEqual({ ...b.api.state.client }, { deposit: 10000, lots: 170 });
});

// ---------- chữ phụ gập vào nút ----------
test("slide 4, 5, 6, 10, 11: chữ phụ nằm trong nút gập, mặc định đóng", () => {
  const h = (id) => boot().api.html(id);
  const fold = (s, label) => assert.match(s, new RegExp(`<details class="fold"><summary[^>]*>.*?<span>${label}</span>`, "s"));
  fold(h("tai-khoan"), "Cost notes");
  fold(h("ecn-q4"), "Who qualifies");
  fold(h("ecn-calc"), "Settlement");
  fold(h("m5"), "Sample case");
  fold(h("so-sanh"), "Notes and sources");
  for (const id of ["tai-khoan", "ecn-q4", "ecn-calc", "m5", "so-sanh"]) assert.doesNotMatch(h(id), /<details class="fold"[^>]*\bopen\b/);
  assert.match(h("bia"), /more than five income streams/);
});

// ---------- slide 11: cách so sánh "Đối đầu" ----------
test("slide 11: mặc định là Đối đầu; bảng xếp hạng 10 sàn; nút gập ghi chú gồm cả đoạn nguồn", () => {
  const b = boot({ store: REG });
  assert.equal(b.api.state.cmpView, "h2h");
  assert.match(b.api.html("so-sanh"), /data-act="cmpview" data-v="h2h" aria-pressed="true">Head-to-head/);
  click(b, { act: "cmpview", v: "rank" });
  const h = b.api.html("so-sanh");
  assert.equal(count(h, /class="cmp-row/g), 10);
  assert.match(h, /<b>EC Markets<\/b>[\s\S]*?<em>Updating<\/em>/);
  assert.match(h, /VT Markets<\/b><small>Standard STP[\s\S]*?client pays 12\/30 USD\/lot \(FX\/gold\) · estimate/);
  const notes = h.slice(h.indexOf('<details class="fold">'), h.indexOf("</details>", h.indexOf('<details class="fold">')));
  assert.match(notes, /Notes and sources/);
  for (const t of [/Swap rebates are not counted here/, /The TMGM row also shows client cost after Points/, /Client costs are illustrative/, /Source: TMGM survey of 7 brokers/]) assert.match(notes, t);
});

test("slide 11 Đối đầu: 2 vòng tròn, TMGM STD 24.300 vs XM 14.104, TMGM hơn +10.196 (+72%)", () => {
  const b = boot({ store: REG });
  click(b, { act: "cmpview", v: "h2h" });
  const h = b.api.html("so-sanh");
  assert.equal(count(h, /<svg class="donut"/g), 2);
  assert.match(h, /aria-label="TMGM: USD 24,300"/);
  assert.match(h, /aria-label="XM: USD 14,104"/);
  assert.match(h, /class="h2h-diff is-us"><span>TMGM ahead<\/span>\s*<b>\+USD 10,196<\/b><small>\+72% · per month/);
  assert.match(h, /Sub-IBs get USD 26,600/);
  assert.doesNotMatch(h, /class="cmp-row|data-calc=/); // không dùng bảng xếp hạng hay máy tính chung
});

test("slide 11 Đối đầu: hai khung nhập độc lập; Copy số từ TMGM", () => {
  const b = boot({ store: REG });
  click(b, { act: "cmpview", v: "h2h" });
  input(b, { h2h: "them.lotsFx" }, "3000");
  assert.equal(b.api.state.h2h.them.lotsFx, 3000);
  assert.equal(b.api.state.h2h.us.lotsFx, 1000);
  assert.equal(b.api.state.calc.lotsFx, 1000);
  input(b, { h2h: "us.share" }, "150");
  assert.equal(b.api.state.h2h.us.share, 100);
  click(b, { act: "h2h-copy" });
  assert.equal(b.api.state.h2h.them.lotsFx, 1000);
  assert.equal(b.api.state.h2h.them.share, 100);
});

test("slide 11 Đối đầu: đổi sàn lấy lại rebate khảo sát; EC Markets chưa có rebate thì nhắc nhập; VT có hồ sơ năng lực", () => {
  const b = boot({ store: REG });
  click(b, { act: "cmpview", v: "h2h" });
  input(b, { h2h: "them.broker" }, "EC Markets");
  assert.deepEqual([b.api.state.h2h.them.fx, b.api.state.h2h.them.gold], ["", ""]);
  let h = b.api.html("so-sanh");
  assert.match(h, /Enter EC Markets's FX and gold rebates to compare\./);
  assert.match(h, /class="h2h-diff is-na"/);
  assert.match(h, /What EC Markets offers <em class="xp-tag">estimate<\/em>[\s\S]*?FCA 571881[\s\S]*?Liverpool FC/);
  input(b, { h2h: "them.fx" }, "10");
  input(b, { h2h: "them.gold" }, "20");
  assert.match(b.api.html("so-sanh"), /aria-label="EC Markets: USD 11,400"/);
  input(b, { h2h: "them.broker" }, "VT Markets");
  assert.deepEqual([b.api.state.h2h.them.fx, b.api.state.h2h.them.gold], [8, 17]);
  input(b, { h2h: "them.cls" }, "raw");
  assert.deepEqual([b.api.state.h2h.them.fx, b.api.state.h2h.them.gold], [2, 2]);
  h = b.api.html("so-sanh");
  assert.match(h, /What VT Markets offers[\s\S]*?swap-free on STP and ECN/);
  assert.match(h, /Client pays 9\/16 USD\/lot/);
});

test("slide 11 Đối đầu: ECN chỉ bật được với Edge; sàn kia hơn thì ghi tên sàn kia", () => {
  const b = boot({ store: REG });
  click(b, { act: "cmpview", v: "h2h" });
  assert.match(b.api.html("so-sanh"), /data-act="h2h-ecn" aria-pressed="false" disabled/);
  input(b, { h2h: "us.account" }, "Edge");
  click(b, { act: "h2h-ecn" });
  assert.match(b.api.html("so-sanh"), /aria-label="TMGM: USD 18,880"/);
  input(b, { h2h: "us.lotsFx" }, "0");
  input(b, { h2h: "us.lotsGold" }, "0");
  assert.match(b.api.html("so-sanh"), /class="h2h-diff is-them"><span>XM ahead/);
});

test("slide 11 Đối đầu: 3 ngôn ngữ, mọi sàn, không có undefined/NaN", () => {
  for (const lang of ["en", "vi", "zh"]) for (const br of ["Exness", "Vantage", "EC Markets", "VT Markets"]) {
    const b = boot({ search: `?lang=${lang}`, store: REG });
    click(b, { act: "cmpview", v: "h2h" });
    input(b, { h2h: "them.broker" }, br);
    assert.doesNotMatch(b.api.html("so-sanh"), /undefined|NaN|\[object Object\]/, `${lang}/${br}`);
  }
});

test("slide 11 Đối đầu: lựa chọn Sàn khác để tự nhập tên, rebate và chi phí khách", () => {
  const b = boot({ store: REG });
  assert.match(b.api.html("so-sanh"), /<option value="__other">Others \(enter your own numbers\)<\/option>/);
  input(b, { h2h: "them.broker" }, "__other");
  let h = b.api.html("so-sanh");
  assert.doesNotMatch(h, /data-h2h="them.cls"/); // không có nhóm tài khoản
  assert.match(h, /data-h2h="them.name"/);
  assert.match(h, /Enter Other broker's FX and gold rebates to compare\./);
  assert.match(h, /No client cost data yet/);
  input(b, { h2h: "them.name" }, "ABC Markets");
  input(b, { h2h: "them.fx" }, "6");
  input(b, { h2h: "them.gold" }, "12");
  input(b, { h2h: "them.costFx" }, "10");
  input(b, { h2h: "them.costGold" }, "");
  h = b.api.html("so-sanh");
  assert.match(h, /aria-label="ABC Markets: USD 6,840"/); // (1.000 × 6 + 1.400 × 12) × 30%
  assert.match(h, /Client pays 10\/— USD\/lot/);
  assert.match(h, /TMGM ahead<\/span>\s*<b>\+USD 17,460/);
  assert.equal(b.api.state.h2h.them.costGold, "");
  input(b, { h2h: "them.name" }, "x".repeat(60));
  assert.equal(b.api.state.h2h.them.name.length, 40);
});

// ---------- slide 03: ô "Ngoài 5 dòng chính" ----------
test("slide 03: 3 ô ưu đãi khác 5/2/3, bấm ô thì đặt bộ lọc ở slide Ưu đãi khác", () => {
  const b = boot(), h = b.api.html("nam-dong");
  assert.match(h, /class="otherp" data-step="5"><p class="otherp-h">Beyond the five main streams/);
  assert.deepEqual([...h.matchAll(/data-act="xp-jump" data-v="(\w+)"[\s\S]*?<em>(\d+)<\/em>/g)].map((m) => [m[1], +m[2]]), [["small", 5], ["marketing", 2], ["private", 3]]);
  assert.match(h, /otherp-card--private/);
  click(b, { act: "xp-jump", v: "private" });
  assert.deepEqual({ ...b.api.state.extra }, { filter: "marketing", showPrivate: true });
  click(b, { act: "xp-jump", v: "small" });
  assert.equal(b.api.state.extra.filter, "small");
  assert.doesNotMatch(boot({ today: "2027-06-01" }).api.html("nam-dong"), /class="otherp"/);
});

// ---------- slide Ưu đãi khác ----------
const xpKeys = (h) => [...h.matchAll(/<details class="xp[^"]*" data-xp="(\w+)"/g)].map((m) => m[1]);

test("slide Ưu đãi khác: có ở MIB và IB; mặc định 7 mục đóng, ẩn mục chỉ chia sẻ riêng", () => {
  for (const a of ["mib", "ib"]) assert.ok(ids(boot({ search: `?a=${a}` }).html()).includes("km-khac"), a);
  const h = boot().api.html("km-khac");
  assert.deepEqual(xpKeys(h), ["halloween", "credit50", "gadget", "rocket", "welcomeBack", "winYourRide", "jayChou"]);
  assert.doesNotMatch(h, /<details class="xp[^"]*"[^>]*\bopen\b/);
  assert.doesNotMatch(h, /xp--private|xp-private-warn/);
  assert.match(h, /data-act="xp-private" aria-pressed="false"[^>]*>[\s\S]*?Show private-only \(3\)/);
  assert.match(h, /class="xp-group">Marketing</);
});

test("slide Ưu đãi khác: nhãn hạn, bảng Gadget, cảnh báo xung đột, link chương trình", () => {
  const h = boot().api.html("km-khac");
  assert.match(h, /data-xp="welcomeBack"[\s\S]*?xp-tag--soon">22 days left</);
  assert.match(h, /data-xp="credit50"[\s\S]*?xp-tag--ok">until Dec 31</);
  assert.match(h, /<td>USD 40,000<\/td><td>450<\/td><td>iPhone 18 Pro Max 512 GB<\/td><td>USD 1,292\.20<\/td>/);
  assert.match(h, /data-xp="credit50"[\s\S]*?can't join Halloween Quest/);
  assert.match(h, /href="https:\/\/lnd\.tmgm\.com\/en\/deposit_bonus" target="_blank" rel="noopener"/);
});

test("slide Ưu đãi khác: lọc theo nhóm và bật mục chỉ chia sẻ riêng", () => {
  const b = boot();
  click(b, { act: "xp-filter", v: "small" });
  assert.deepEqual(xpKeys(b.api.html("km-khac")), ["halloween", "credit50", "gadget", "rocket", "welcomeBack"]);
  click(b, { act: "xp-filter", v: "marketing" });
  assert.deepEqual(xpKeys(b.api.html("km-khac")), ["winYourRide", "jayChou"]);
  click(b, { act: "xp-private" });
  const h = b.api.html("km-khac");
  assert.deepEqual(xpKeys(h), ["winYourRide", "jayChou", "thaiConcert", "carnival", "premierLeague"]);
  assert.match(h, /class="warn warn--sm xp-private-warn"/);
  assert.equal(count(h, /<details class="xp xp--private"/g), 3);
  assert.match(h, /data-xp="thaiConcert"[\s\S]*?xp-tag--priv">Private only</);
  click(b, { act: "xp-filter", v: "all" });
  assert.equal(xpKeys(b.api.html("km-khac")).length, 10);
});

test("slide Ưu đãi khác: mục hết hạn tự ẩn; hết sạch thì báo trống", () => {
  const nov = boot({ today: "2026-11-06" }).api.html("km-khac");
  assert.deepEqual(xpKeys(nov), ["credit50", "gadget", "rocket", "winYourRide", "jayChou"]);
  const jan = boot({ today: "2027-01-01" });
  assert.match(jan.api.html("km-khac"), /No promotions left in this group\./);
  assert.doesNotMatch(jan.api.html("km-khac"), /Show private-only \(3\)/);
  click(jan, { act: "xp-private" });
  assert.deepEqual(xpKeys(jan.api.html("km-khac")), ["premierLeague"]);
});

test("slide Ưu đãi khác: 3 ngôn ngữ, kể cả mục chỉ chia sẻ riêng, không có undefined/NaN", () => {
  for (const lang of ["en", "vi", "zh"]) {
    const b = boot({ search: `?lang=${lang}` });
    click(b, { act: "xp-private" });
    assert.doesNotMatch(b.api.html("km-khac"), /undefined|NaN|\[object Object\]/, lang);
  }
});

test("slide 9: quy tắc MIB tính cả hệ thống (ngưỡng tăng 50%) chỉ hiện với MIB", () => {
  assert.match(boot().api.html("m4"), /MIB counting the whole network\?[\s\S]*?over USD 7,500 \/ 15,000 \/ 45,000/);
  assert.doesNotMatch(boot({ search: "?a=ib" }).api.html("m4"), /whole network/);
});
