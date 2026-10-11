/* LabGorilla — small helpers shared by every file. */
window.LB = window.LB || {};
(function (LB) {
  const U = (LB.U = {});
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  U.MONTHS = MONTHS; U.DAYS = DAYS;

  U.uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  U.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  U.pad = n => String(n).padStart(2, "0");
  U.key = d => d.getFullYear() + "-" + U.pad(d.getMonth() + 1) + "-" + U.pad(d.getDate());
  U.parse = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  U.add = (k, n) => { const d = U.parse(k); d.setDate(d.getDate() + n); return U.key(d); };
  U.today = () => U.key(new Date());
  U.fmt = (k, withYear = true) => { if (!k) return ""; const [y, m, d] = k.split("-"); return d + " " + MONTHS[+m - 1].slice(0, 3) + (withYear ? " " + y : ""); };
  U.fmtLong = k => { const d = U.parse(k); return DAYS[d.getDay()] + " " + U.fmt(k, true); };
  U.daysBetween = (a, b) => Math.round((U.parse(b) - U.parse(a)) / 864e5);
  U.weekStart = k => { const d = U.parse(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return U.key(d); };
  U.timeStr = ms => { const d = new Date(ms); return U.pad(d.getHours()) + ":" + U.pad(d.getMinutes()); };
  U.stampStr = ms => U.fmt(U.key(new Date(ms)), true) + ", " + U.timeStr(ms);

  U.getPath = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  U.setPath = (o, p, v) => {
    const ks = p.split("."); const last = ks.pop();
    const t = ks.reduce((a, k) => (a == null ? a : a[k]), o);
    if (t == null) return false;
    t[last] = v; return true;
  };
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.safeName = n => String(n).replace(/[^\w.\-]+/g, "_").slice(-80);
  U.size = b => (b < 1024 ? b + " B" : b < 1048576 ? Math.round(b / 1024) + " KB" : (b / 1048576).toFixed(1) + " MB");
  U.isoWeek = k => {
    const d = U.parse(k); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const w1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  };
  /* blue folder icons in the style of the macOS Finder; gradients (lbFolderBack / lbFolderFront / lbDoc) are defined once in index.html */
  LB.icons = {
    folder: (open, size) => '<svg class="fi" width="' + (size || 18) + '" height="' + Math.round((size || 18) * 0.8) + '" viewBox="0 0 20 16" aria-hidden="true"><path d="M1.6 3.3A1.8 1.8 0 0 1 3.4 1.5h3.5c.5 0 .9.2 1.3.5l.9.9c.3.3.8.5 1.3.5h6.2a1.8 1.8 0 0 1 1.8 1.8v8.3a1.8 1.8 0 0 1-1.8 1.8H3.4a1.8 1.8 0 0 1-1.8-1.8z" fill="url(#lbFolderBack)"/>' +
      (open ? '<path d="M3.2 6.6h14.6c1.1 0 1.9 1 1.6 2l-1.3 4.9c-.3 1-1.1 1.6-2.1 1.6H3.4a1.8 1.8 0 0 1-1.8-1.8V8.4c0-1 .7-1.8 1.6-1.8z" fill="url(#lbFolderFront)"/><path d="M3.4 6.6h14.4" stroke="#fff" stroke-opacity=".55" stroke-width=".7"/>'
        : '<path d="M1.6 6.3A1.8 1.8 0 0 1 3.4 4.5h13.2a1.8 1.8 0 0 1 1.8 1.8v7.2a1.8 1.8 0 0 1-1.8 1.8H3.4a1.8 1.8 0 0 1-1.8-1.8z" fill="url(#lbFolderFront)"/><path d="M3.2 4.9h13.6" stroke="#fff" stroke-opacity=".6" stroke-width=".7"/>') + "</svg>",
    stack: size => '<svg class="fi" width="' + (size || 18) + '" height="' + Math.round((size || 18) * 0.8) + '" viewBox="0 0 20 16" aria-hidden="true"><path d="M3 2.4A1.4 1.4 0 0 1 4.4 1h3.1c.4 0 .8.2 1 .4l.7.7c.2.2.6.4 1 .4h4.2A1.4 1.4 0 0 1 16 3.9v.4H3z" fill="#2f86df"/><path d="M1.6 5.4A1.6 1.6 0 0 1 3.2 3.8h13.6a1.6 1.6 0 0 1 1.6 1.6v.5H1.6z" fill="#4a9cf0"/><path d="M1.6 6.8A1.8 1.8 0 0 1 3.4 5h13.2a1.8 1.8 0 0 1 1.8 1.8v6.9a1.8 1.8 0 0 1-1.8 1.8H3.4a1.8 1.8 0 0 1-1.8-1.8z" fill="url(#lbFolderFront)"/><path d="M3.2 5.4h13.6" stroke="#fff" stroke-opacity=".6" stroke-width=".7"/></svg>',
    doc: size => '<svg class="fi" width="' + Math.round((size || 18) * 0.8) + '" height="' + (size || 18) + '" viewBox="0 0 16 20" aria-hidden="true"><path d="M2.6 1h7.2L14.4 5.6v11.8A1.6 1.6 0 0 1 12.8 19H2.6A1.6 1.6 0 0 1 1 17.4V2.6A1.6 1.6 0 0 1 2.6 1z" fill="url(#lbDoc)" stroke="#aab4c8" stroke-width=".8"/><path d="M9.8 1v3.2a1.4 1.4 0 0 0 1.4 1.4h3.2z" fill="#d4dbea" stroke="#aab4c8" stroke-width=".8" stroke-linejoin="round"/><path d="M4 9.5h8M4 12h8M4 14.5h5" stroke="#9aa6bd" stroke-width="1" stroke-linecap="round"/></svg>'
  };
  U.letter = i => String.fromCharCode(97 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : "");
})(window.LB);
