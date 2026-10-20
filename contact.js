/*
 * Form liên hệ: kiểm tra dữ liệu và dựng bản nháp email (mailto). Chạy được trong trình duyệt (window.MIBContact) và node.
 * Trang chạy local, không có máy chủ nên không tự gửi được: trình duyệt mở app email với bản nháp sẵn, người dùng bấm Gửi.
 */
(function (root) {
  const MAX_URL = 1900; // giữ URL dưới giới hạn của trình duyệt và app mail
  const MAX_NOTE = 800;

  // Bỏ xuống dòng, tab và khoảng trắng thừa: chặn chèn thêm header email (Bcc, ...) qua tên hoặc ghi chú.
  const clean = (s) => String(s == null ? "" : s).replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();

  const EMAIL = /^[^\s@.][^\s@]*@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;
  const PHONE = /^\+?\d{8,15}$/;

  function validate(data) {
    const errors = {};
    const phone = clean(data.phone), email = clean(data.email);
    if (!phone) errors.phone = "required";
    else if (!PHONE.test(phone.replace(/[\s().-]/g, ""))) errors.phone = "invalid";
    if (!email) errors.email = "required";
    else if (!EMAIL.test(email)) errors.email = "invalid";
    return { ok: Object.keys(errors).length === 0, errors };
  }

  // cfg: { to, lang, audience }. context: một dòng mô tả số đối tác đã nhập ở máy tính (tùy chọn).
  function buildMailto(cfg, data, context) {
    if (!validate(data).ok) throw new Error("invalid contact data");
    const name = clean(data.name), phone = clean(data.phone), email = clean(data.email);
    const subject = `[TMGM partnership] Appointment request - ${name || email}`;
    const ctx = clean(context);
    const lines = (note) => [
      name && `Name: ${name}`, `Phone: ${phone}`, `Email: ${email}`,
      note && `Preferred time / message: ${note}`,
      ctx && ctx, `Language: ${cfg.lang || "en"}`, `Audience: ${String(cfg.audience || "mib").toUpperCase()}`,
    ].filter(Boolean).join("\r\n");
    const url = (note) => `mailto:${cfg.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines(note))}`;

    let note = clean(data.note).slice(0, MAX_NOTE);
    let out = url(note);
    while (out.length > MAX_URL && note) { note = note.slice(0, Math.max(0, note.length - 100)); out = url(note); }
    return out;
  }

  const api = { clean, validate, buildMailto };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MIBContact = api;
})(this);
