/*
 * Hình minh họa SVG cho trang ưu đãi (index.html). Vẽ bằng khối đơn giản theo màu thương hiệu,
 * không dùng ảnh sản phẩm, logo hay ảnh người thật (tránh vướng quyền hình ảnh và nhãn hiệu).
 * Mỗi hàm nhận bảng màu p = { bg, main, dark, accent, soft, warm } và trả về phần ruột SVG cho viewBox 0 0 240 180.
 * Trình duyệt: window.MIBArt; node: require.
 */
(function (root) {
  const dots = (p, pts) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.soft}"/>`).join("");
  const spark = (p, x, y, s = 1) => `<path d="M${x} ${y - 7 * s}l${2 * s} ${5 * s} ${5 * s} ${2 * s}-${5 * s} ${2 * s}-${2 * s} ${5 * s}-${2 * s}-${5 * s}-${5 * s}-${2 * s} ${5 * s}-${2 * s}z" fill="${p.accent}"/>`;

  const art = {
    // Bìa: ba hộp quà
    gifts: (p) => `${dots(p, [[30, 40, 4], [210, 30, 3], [200, 150, 4], [26, 140, 3]])}
      <rect x="40" y="88" width="64" height="58" rx="6" fill="${p.main}"/><rect x="34" y="76" width="76" height="16" rx="4" fill="${p.dark}"/>
      <rect x="66" y="76" width="12" height="70" fill="${p.accent}"/>
      <rect x="118" y="64" width="80" height="82" rx="6" fill="${p.soft}"/><rect x="112" y="50" width="92" height="18" rx="4" fill="${p.main}"/>
      <rect x="152" y="50" width="12" height="96" fill="${p.accent}"/>
      <path d="M158 50c-14-20-34-14-26-2 4 5 16 4 26 2zm0 0c14-20 34-14 26-2-4 5-16 4-26 2z" fill="${p.accent}"/>
      ${spark(p, 112, 30)}${spark(p, 214, 96, .8)}`,

    // Halloween: bí ngô + dấu "?" (sản phẩm bí ẩn)
    pumpkin: (p) => `${dots(p, [[34, 36, 4], [206, 28, 3], [214, 150, 4]])}
      <ellipse cx="104" cy="112" rx="34" ry="44" fill="${p.warm}"/><ellipse cx="136" cy="112" rx="34" ry="44" fill="${p.warm}"/>
      <ellipse cx="120" cy="112" rx="26" ry="46" fill="#F5A13A"/>
      <path d="M118 68c0-12 4-18 12-22" stroke="${p.dark}" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M100 104l10-10 10 10zm20 0l10-10 10 10z" fill="${p.dark}"/>
      <path d="M98 126q22 18 44 0l-8 4-6-6-8 8-8-8-6 6z" fill="${p.dark}"/>
      <circle cx="196" cy="72" r="26" fill="${p.main}"/>
      <text x="196" y="84" text-anchor="middle" font-size="34" font-weight="800" fill="#fff" font-family="inherit">?</text>`,

    // 50% Credit: ví + nhãn +50%
    credit: (p) => `${dots(p, [[30, 30, 4], [214, 150, 3], [40, 150, 3]])}
      <rect x="44" y="62" width="120" height="84" rx="12" fill="${p.main}"/>
      <rect x="44" y="62" width="120" height="22" rx="10" fill="${p.dark}"/>
      <rect x="128" y="94" width="44" height="30" rx="8" fill="${p.soft}"/><circle cx="144" cy="109" r="6" fill="${p.dark}"/>
      <rect x="60" y="40" width="70" height="34" rx="6" fill="${p.accent}" transform="rotate(-8 95 57)"/>
      <circle cx="190" cy="58" r="30" fill="${p.accent}"/>
      <text x="190" y="66" text-anchor="middle" font-size="22" font-weight="800" fill="${p.dark}" font-family="inherit">+50%</text>`,

    // Gadget: đồng hồ, máy tính bảng, điện thoại, laptop (nét chung, không thương hiệu)
    gadget: (p) => `${dots(p, [[24, 30, 4], [222, 40, 3]])}
      <rect x="20" y="118" width="150" height="10" rx="5" fill="${p.dark}"/>
      <rect x="34" y="52" width="122" height="68" rx="6" fill="${p.dark}"/><rect x="40" y="58" width="110" height="56" rx="3" fill="${p.soft}"/>
      <rect x="150" y="70" width="54" height="76" rx="8" fill="${p.main}"/><rect x="155" y="76" width="44" height="64" rx="4" fill="#fff" opacity=".85"/>
      <rect x="200" y="96" width="28" height="52" rx="7" fill="${p.dark}"/><rect x="203" y="101" width="22" height="42" rx="4" fill="${p.accent}"/>
      <rect x="72" y="136" width="10" height="34" rx="3" fill="${p.dark}"/><rect x="64" y="142" width="26" height="22" rx="7" fill="${p.main}"/>
      <circle cx="77" cy="153" r="6" fill="${p.accent}"/>
      ${spark(p, 120, 30)}`,

    // Rocket: tên lửa + đồng coin
    rocket: (p) => `${dots(p, [[40, 140, 3], [60, 36, 2.5], [214, 132, 3], [30, 80, 2]])}
      <circle cx="184" cy="52" r="26" fill="${p.accent}"/>
      <text x="184" y="61" text-anchor="middle" font-size="24" font-weight="800" fill="${p.dark}" font-family="inherit">₿</text>
      <g transform="rotate(35 112 96)">
        <path d="M112 26c22 22 26 62 18 104h-36c-8-42-4-82 18-104z" fill="${p.main}"/>
        <circle cx="112" cy="72" r="12" fill="#fff" stroke="${p.dark}" stroke-width="4"/>
        <path d="M94 112l-20 24 20-8zm36 0l20 24-20-8z" fill="${p.dark}"/>
        <path d="M100 130l12 32 12-32z" fill="${p.warm}"/>
      </g>`,

    // Welcome Back: cửa mở + dấu tích
    welcome: (p) => `${dots(p, [[30, 30, 4], [214, 146, 3]])}
      <rect x="54" y="34" width="84" height="122" rx="6" fill="${p.dark}"/>
      <path d="M62 42l52 10v96l-52 4z" fill="${p.main}"/><circle cx="104" cy="100" r="4" fill="${p.accent}"/>
      <rect x="138" y="150" width="76" height="6" rx="3" fill="${p.soft}"/>
      ${[0, 1, 2].map((i) => `<circle cx="${172 + (i % 2) * 22}" cy="${58 + i * 30}" r="12" fill="${p.accent}"/><path d="M${166 + (i % 2) * 22} ${58 + i * 30}l4 4 8-8" stroke="${p.dark}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}`,

    // Win Your Ride: xe máy điện (nét chung) + vé bốc thăm
    scooter: (p) => `${dots(p, [[26, 34, 4], [214, 30, 3]])}
      <circle cx="62" cy="132" r="22" fill="${p.dark}"/><circle cx="62" cy="132" r="9" fill="${p.soft}"/>
      <circle cx="170" cy="132" r="22" fill="${p.dark}"/><circle cx="170" cy="132" r="9" fill="${p.soft}"/>
      <path d="M62 132h40l18-30h34l16 30" stroke="${p.main}" stroke-width="10" fill="none" stroke-linejoin="round"/>
      <path d="M86 100h44l-6 22H80z" fill="${p.main}"/><rect x="88" y="90" width="36" height="12" rx="6" fill="${p.dark}"/>
      <path d="M154 102l10-44h14" stroke="${p.dark}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <g transform="rotate(-12 196 64)"><rect x="168" y="48" width="56" height="32" rx="5" fill="${p.accent}"/>
      <circle cx="168" cy="64" r="6" fill="${p.bg}"/><circle cx="224" cy="64" r="6" fill="${p.bg}"/>
      <text x="196" y="70" text-anchor="middle" font-size="15" font-weight="800" fill="${p.dark}" font-family="inherit">1/20</text></g>`,

    // Concert: micro + sân khấu + nốt nhạc (không ảnh nghệ sĩ)
    concert: (p) => `${dots(p, [[30, 36, 3], [212, 140, 4]])}
      <path d="M20 150h200l-14 20H34z" fill="${p.dark}"/>
      <path d="M56 40l-26 110h40zM184 40l26 110h-40z" fill="${p.soft}" opacity=".7"/>
      <rect x="114" y="92" width="12" height="58" rx="5" fill="${p.dark}"/>
      <rect x="104" y="44" width="32" height="56" rx="16" fill="${p.main}"/>
      <path d="M104 64h32M104 74h32M104 84h32" stroke="${p.soft}" stroke-width="2"/>
      <path d="M160 52v34a8 8 0 1 1-6-8V52l26-6v30a8 8 0 1 1-6-8V54z" fill="${p.accent}"/>
      <path d="M62 64v26a7 7 0 1 1-5-7V64z" fill="${p.accent}"/>`,

    // Carnival II: hai tấm vé + ngôi sao
    tickets: (p) => `${dots(p, [[26, 30, 4], [218, 150, 3]])}
      <g transform="rotate(-10 110 96)"><rect x="40" y="64" width="140" height="62" rx="8" fill="${p.main}"/>
      <circle cx="40" cy="95" r="10" fill="${p.bg}"/><circle cx="180" cy="95" r="10" fill="${p.bg}"/>
      <path d="M142 70v52" stroke="${p.soft}" stroke-width="3" stroke-dasharray="5 5"/>
      <text x="92" y="103" text-anchor="middle" font-size="20" font-weight="800" fill="#fff" font-family="inherit">VIP</text></g>
      <g transform="rotate(8 150 120)"><rect x="96" y="96" width="120" height="52" rx="8" fill="${p.accent}"/>
      <circle cx="96" cy="122" r="9" fill="${p.bg}"/><circle cx="216" cy="122" r="9" fill="${p.bg}"/></g>
      ${spark(p, 46, 40, 1.2)}${spark(p, 206, 48)}`,

    // Getaway: vali + máy bay giấy + đám mây
    travel: (p) => `${dots(p, [[30, 36, 3], [214, 150, 4]])}
      <ellipse cx="70" cy="46" rx="26" ry="12" fill="#fff" opacity=".9"/><ellipse cx="92" cy="40" rx="18" ry="10" fill="#fff" opacity=".9"/>
      <ellipse cx="190" cy="104" rx="22" ry="10" fill="#fff" opacity=".9"/>
      <path d="M150 34l56-18-20 52-14-14-14 20-6-18z" fill="${p.accent}"/><path d="M150 34l36 20 8-24z" fill="${p.warm}"/>
      <rect x="62" y="84" width="104" height="72" rx="10" fill="${p.main}"/>
      <path d="M96 84v-12a8 8 0 0 1 8-8h20a8 8 0 0 1 8 8v12" stroke="${p.dark}" stroke-width="6" fill="none"/>
      <rect x="62" y="104" width="104" height="8" fill="${p.dark}" opacity=".35"/>
      <rect x="104" y="100" width="20" height="16" rx="3" fill="${p.accent}"/>
      <circle cx="82" cy="160" r="6" fill="${p.dark}"/><circle cx="146" cy="160" r="6" fill="${p.dark}"/>`,

    // Premier League: sân bóng + quả bóng + vé (không logo giải)
    football: (p) => `${dots(p, [[24, 28, 3], [220, 30, 4]])}
      <rect x="20" y="70" width="200" height="96" rx="8" fill="${p.main}"/>
      <path d="M120 70v96M20 118h200" stroke="#fff" stroke-width="2" opacity=".6"/>
      <circle cx="120" cy="118" r="20" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>
      <rect x="20" y="96" width="24" height="44" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>
      <rect x="196" y="96" width="24" height="44" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>
      <circle cx="120" cy="118" r="11" fill="#fff"/><path d="M120 111l6 4-2 7h-8l-2-7z" fill="${p.dark}"/>
      <g transform="rotate(-8 176 44)"><rect x="140" y="26" width="76" height="36" rx="6" fill="${p.accent}"/>
      <circle cx="140" cy="44" r="7" fill="${p.bg}"/><circle cx="216" cy="44" r="7" fill="${p.bg}"/></g>`,
  };

  // Bọc thành <svg> hoàn chỉnh
  // fill = true: phủ kín khung (cắt bớt mép), dùng cho thẻ trong danh sách
  const svg = (key, p, label, fill) => `<svg class="pp-svg" viewBox="0 0 240 180"${fill ? ' preserveAspectRatio="xMidYMid slice"' : ""} role="img" aria-label="${String(label).replace(/"/g, "&quot;")}"><rect width="240" height="180" rx="0" fill="${p.bg}"/>${(art[key] || art.gifts)(p)}</svg>`;

  const api = { art, svg, keys: Object.keys(art) };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MIBArt = api;
})(this);
