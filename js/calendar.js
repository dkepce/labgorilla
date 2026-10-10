/* LabGorilla — Calendar view: month grid, optional pastel week view, events. */
(function (LB) {
  const U = LB.U, esc = U.esc, A = LB.actions;
  const KINDS = { imaging: "Imaging", order: "Order", passage: "Passage", other: "Other" };
  const WCOL = [["#b8d6e0", "#d6e7ee", "#f3f8fa"], ["#bfe3cf", "#d9eee2", "#f5fbf8"], ["#ecdf8a", "#f4ebb5", "#fdfbee"], ["#f2b995", "#f7d4bd", "#fef6f0"], ["#f4a7a7", "#f8c9c9", "#fef4f4"], ["#f2a6bd", "#f7c8d7", "#fef4f7"], ["#d4c6ec", "#e5dcf4", "#f8f5fc"]];
  const WN = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

  function itemsOn(d) {
    const D = LB.D;
    return [
      ...Object.values(D.entries).filter(e => e.date === d).map(e => ({ label: e.code + " · " + e.title, kind: "entry", id: e.id })),
      ...D.events.filter(v => v.date === d).sort((a, b) => (a.time || "").localeCompare(b.time || "")).map(v => ({ label: (v.time ? v.time + " " : "") + v.title, kind: v.kind, id: v.id }))
    ];
  }
  const ui = () => { const u = LB.ui; if (u.calY == null) { const d = U.parse(u.sel); u.calY = d.getFullYear(); u.calM = d.getMonth(); } return u; };

  function monthGrid(u, today) {
    const off = (new Date(u.calY, u.calM, 1).getDay() + 6) % 7;
    let h = '<div class="dow">' + ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => "<span>" + d + "</span>").join("") + '</div><div class="cgrid">';
    for (let i = 0; i < 42; i++) {
      const d = new Date(u.calY, u.calM, 1 - off + i), k = U.key(d), its = itemsOn(k);
      h += '<button class="cell' + (d.getMonth() !== u.calM ? " out" : "") + (k === u.sel ? " sel" : "") + (k === today ? " today" : "") + '" data-a="calSel" data-d="' + k + '" aria-label="' + U.fmtLong(k) + '"><span class="dn">' + d.getDate() + "</span>" +
        its.slice(0, 3).map(x => '<span class="px k-' + x.kind + '">' + esc(x.label) + "</span>").join("") + (its.length > 3 ? '<span class="sm muted">+' + (its.length - 3) + " more</span>" : "") + "</button>";
    }
    return h + "</div>";
  }
  function weekGrid(u, today) {
    const w0 = U.weekStart(u.sel);
    return '<div class="week">' + WN.map((n, i) => {
      const k = U.add(w0, i), c = WCOL[i], its = itemsOn(k);
      return '<button class="wcol" data-a="calSel" data-d="' + k + '" style="background:' + (k === today ? "#fdeef0" : c[2]) + ";outline:" + (k === u.sel ? "2px solid var(--acc)" : "none") + ';outline-offset:-2px"><span class="wh" style="background:' + c[0] + '">' + n + '</span><span class="wd" style="background:' + c[1] + '">' + U.fmt(k, true) + '</span><span class="wb">' +
        its.map(x => '<span class="px k-' + x.kind + '">' + esc(x.label) + "</span>").join("") + "</span></button>";
    }).join("") + "</div>";
  }
  function side(u) {
    const D = LB.D, its = itemsOn(u.sel);
    return '<aside class="calside" data-scroll="calside"><div class="h">' + U.fmtLong(u.sel) + "</div>" +
      its.map(x => {
        if (x.kind === "entry") return '<div class="evit"><div class="row" style="align-items:flex-start"><span class="px k-entry" style="flex-shrink:0">Entry</span><span class="grow" style="font-size:13px;font-weight:600;line-height:1.4">' + esc(x.label) + '</span></div><button class="link sm" data-a="gopen" data-kind="entry" data-id="' + x.id + '">Open entry →</button></div>';
        const i = D.events.findIndex(v => v.id === x.id), P = "D.events." + i, v = D.events[i];
        return '<div class="evit"><div class="row"><input type="text" class="grow" aria-label="Event title" data-b="' + P + '.title" value="' + esc(v.title) + '" autocomplete="off"><button class="x" data-a="delEvent" data-id="' + v.id + '" aria-label="Delete event">×</button></div>' +
          '<div class="row wrap sm"><input type="time" aria-label="Time" data-b="' + P + '.time" value="' + esc(v.time || "") + '" style="width:100px"><select aria-label="Type" data-b="' + P + '.kind" data-render="1">' + Object.keys(KINDS).map(k => '<option value="' + k + '"' + (v.kind === k ? " selected" : "") + ">" + KINDS[k] + "</option>").join("") + '</select></div>' +
          '<label class="row sm muted">Move to <input type="date" data-b="' + P + '.date" data-act="evMoved" value="' + v.date + '"></label></div>';
      }).join("") + (its.length ? "" : '<div class="muted sm">Nothing planned for this day.</div>') +
      '<div class="col" style="border-top:1px solid var(--line2);padding-top:12px;gap:8px"><div class="lbl">Add to this day</div>' +
      '<input type="text" placeholder="e.g. Passage MCF-7" aria-label="Event title" data-b="tmp.evTitle" data-enter="addEvent" value="' + esc(LB.tmp.evTitle) + '" autocomplete="off">' +
      '<div class="row"><input type="time" aria-label="Time (optional)" data-b="tmp.evTime" value="' + esc(LB.tmp.evTime) + '" style="width:110px"><select class="grow" aria-label="Type" data-b="tmp.evKind">' + Object.keys(KINDS).map(k => '<option value="' + k + '"' + (LB.tmp.evKind === k ? " selected" : "") + ">" + KINDS[k] + "</option>").join("") + "</select></div>" +
      '<button class="btn pri" data-a="addEvent">Add event</button></div></aside>';
  }
  LB.views.calendar = function () {
    const u = ui(), today = U.today(), week = u.calMode === "week";
    const title = week ? "Week " + U.isoWeek(U.weekStart(u.sel)) + " · " + U.fmt(U.weekStart(u.sel), false) : U.MONTHS[u.calM] + " " + u.calY;
    return '<div class="calwrap"><div class="calhead"><h1>' + title + '</h1><button class="btn sm" data-a="calPrev" aria-label="Previous">‹</button><button class="btn sm" data-a="calNext" aria-label="Next">›</button><button class="btn sm" data-a="calToday">Today</button>' +
      '<button class="pill' + (week ? "" : " on") + '" data-a="calMode" data-m="month">Month</button><button class="pill' + (week ? " on" : "") + '" data-a="calMode" data-m="week">Week</button><span class="grow"></span>' +
      '<span class="px k-entry" style="padding:2px 8px">Experiment entry</span><span class="px k-imaging" style="padding:2px 8px">Imaging</span><span class="px k-order" style="padding:2px 8px">Order</span><span class="px k-passage" style="padding:2px 8px">Passage</span></div>' +
      (week ? weekGrid(u, today) : monthGrid(u, today)) + "</div>" + side(u);
  };

  const shiftSel = n => { const u = ui(); u.sel = U.add(u.sel, n); const d = U.parse(u.sel); u.calY = d.getFullYear(); u.calM = d.getMonth(); };
  A.calSel = el => { LB.ui.sel = el.dataset.d; const d = U.parse(el.dataset.d); if (LB.ui.calMode !== "week") { LB.ui.calY = d.getFullYear(); LB.ui.calM = d.getMonth(); } LB.saveUI(); LB.render(); };
  A.calPrev = () => { const u = ui(); if (u.calMode === "week") shiftSel(-7); else if (--u.calM < 0) { u.calM = 11; u.calY--; } LB.saveUI(); LB.render(); };
  A.calNext = () => { const u = ui(); if (u.calMode === "week") shiftSel(7); else if (++u.calM > 11) { u.calM = 0; u.calY++; } LB.saveUI(); LB.render(); };
  A.calToday = () => { const u = ui(), d = new Date(); u.sel = U.today(); u.calY = d.getFullYear(); u.calM = d.getMonth(); LB.saveUI(); LB.render(); };
  A.calMode = el => { LB.ui.calMode = el.dataset.m; LB.saveUI(); LB.render(); };
  A.addEvent = () => {
    const t = (LB.tmp.evTitle || "").trim(); if (!t) { LB.toast("Please type what the event is."); return; }
    LB.D.events.push({ id: U.uid(), date: LB.ui.sel, time: LB.tmp.evTime || "", title: t, kind: LB.tmp.evKind || "other" });
    LB.tmp.evTitle = ""; LB.save(); LB.render();
  };
  A.delEvent = el => { LB.D.events = LB.D.events.filter(v => v.id !== el.dataset.id); LB.save(); LB.render(); };
  A.evMoved = el => { if (!el.value) return; LB.ui.sel = el.value; const d = U.parse(el.value); LB.ui.calY = d.getFullYear(); LB.ui.calM = d.getMonth(); LB.saveUI(); LB.render(); };
})(window.LB);
