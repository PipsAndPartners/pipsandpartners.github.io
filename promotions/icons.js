/* Bộ icon nét mảnh 2px, 24×24, dùng qua <use href="#i-name">. Dùng cho index.html. */
(function () {
  const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></symbol>
    <symbol id="i-stamp" viewBox="0 0 24 24"><path d="M9 3h6v5l-1 4h-4L9 8z"/><path d="M4 15h16v3H4z"/><path d="M6 21h12"/></symbol>
    <symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3.5 3 14.5 0 18"/><path d="M12 3c-3 3.5-3 14.5 0 18"/></symbol>
    <symbol id="i-umbrella" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v6a2 2 0 0 0 4 0"/><path d="M12 3v0"/></symbol>
    <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></symbol>
    <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.8c2.4.6 4 2.4 4 5.2"/></symbol>
    <symbol id="i-candles" viewBox="0 0 24 24"><path d="M7 3v18"/><rect x="4.5" y="7" width="5" height="8" rx="1"/><path d="M17 3v18"/><rect x="14.5" y="5" width="5" height="10" rx="1"/></symbol>
    <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></symbol>
    <symbol id="i-trophy" viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4"/><path d="M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4"/><path d="M8 21h8"/><path d="M9 17h6"/></symbol>
    <symbol id="i-zap" viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></symbol>
    <symbol id="i-gift" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9"/><path d="M12 8v13"/><path d="M12 8c-2-4-6-4-6-1.5S9.5 8 12 8c2.5 0 6 .5 6-1.5S14 4 12 8z"/></symbol>
    <symbol id="i-building" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2"/><path d="M13 7h2"/><path d="M9 11h2"/><path d="M13 11h2"/><path d="M9 15h2"/><path d="M13 15h2"/><path d="M10 21v-3h4v3"/></symbol>
    <symbol id="i-file" viewBox="0 0 24 24"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/><path d="M9 12h6"/><path d="M9 16h6"/></symbol>
    <symbol id="i-monitor" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M10 8l5 2.5-5 2.5z"/></symbol>
    <symbol id="i-headset" viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2" y="14" width="5" height="6" rx="1.5"/><rect x="17" y="14" width="5" height="6" rx="1.5"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></symbol>
    <symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/></symbol>
    <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></symbol>
    <symbol id="i-coins" viewBox="0 0 24 24"><circle cx="9" cy="9" r="6"/><path d="M15.4 9.6A6 6 0 1 1 9.6 15.4"/><path d="M9 6.5v5"/></symbol>
    <symbol id="i-robot" viewBox="0 0 24 24"><rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 4v4"/><circle cx="12" cy="3.5" r="1"/><circle cx="9.5" cy="13" r="1"/><circle cx="14.5" cy="13" r="1"/><path d="M9.5 16.5h5"/></symbol>
    <symbol id="i-chart" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></symbol>
    <symbol id="i-hourglass" viewBox="0 0 24 24"><path d="M6 2h12"/><path d="M6 22h12"/><path d="M7 2v4l5 6-5 6v4"/><path d="M17 2v4l-5 6 5 6v4"/></symbol>
    <symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 3l10 18H2z"/><path d="M12 10v5"/><path d="M12 18h.01"/></symbol>
    <symbol id="i-user-plus" viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3.5-6 7-6s7 2 7 6"/><path d="M19 8v6"/><path d="M16 11h6"/></symbol>
    <symbol id="i-whatsapp" viewBox="0 0 24 24"><path d="M3 21l1.6-4.7A9 9 0 1 1 7.8 19.5z"/><path d="M9 8.5c.2 3.2 3.3 6.4 6.5 6.6l1.3-1.6-2.2-1-1 .9a5 5 0 0 1-2.6-2.6l.9-1-1-2.2z"/></symbol>
    <symbol id="i-chevron" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></symbol>
    <symbol id="i-ext" viewBox="0 0 24 24"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></symbol>
    <symbol id="i-edit" viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></symbol>
    <symbol id="i-send" viewBox="0 0 24 24"><path d="M22 3L2 11l7 2 2 7 4-5 5 4z"/><path d="M9 13L22 3"/></symbol>
    <symbol id="i-play" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></symbol>
    <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></symbol>
    <symbol id="i-left" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></symbol>
    <symbol id="i-right" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></symbol>
    <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></symbol>
    <symbol id="i-image" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></symbol>
    <symbol id="i-qr" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M20 14v.01"/><path d="M14 20h.01"/><path d="M17 17h4v4h-4"/></symbol>
  </defs>
</svg>`;
  document.body.insertAdjacentHTML("afterbegin", sprite);
})();
