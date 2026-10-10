/* LabGorilla — start-up. */
(function (LB) {
  LB.fixData();
  LB.D.experiments.forEach((x, i) => { x.num = x.num || i + 1; });
  if (!LB.D.entries[LB.ui.cur]) { const ids = Object.keys(LB.D.entries); LB.ui.cur = ids.length ? ids.sort((a, b) => LB.D.entries[b].date.localeCompare(LB.D.entries[a].date))[0] : ""; }
  LB.applyTheme();
  LB.render();
  LB.route();
  LB.initFile();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => { }));
  }
})(window.LB);
