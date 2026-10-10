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
  U.letter = i => String.fromCharCode(97 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : "");
})(window.LB);
