/* LabGorilla — Notebook view: tree, entry sections, right panel. */
(function (LB) {
  const U = LB.U, esc = U.esc, A = LB.actions;
  const SEC = LB.SECTIONS;
  const T = (rows, v, extra) => '<textarea rows="' + rows + '" ' + extra + ">" + esc(v) + "</textarea>";

  /* ---------- left tree ---------- */
  function sortEntries(a, b) { return b.date.localeCompare(a.date) || (b.enteredAt || 0) - (a.enteredAt || 0); }
  function side() {
    const D = LB.D, q = (LB.tmp.treeQ || "").trim().toLowerCase();
    let h = '<aside class="side" data-scroll="side"><button class="btn pri" data-a="newEntry">+ New entry</button>' +
      '<input type="text" placeholder="Filter entries…" aria-label="Filter entries" data-b="tmp.treeQ" data-rin="1" value="' + esc(LB.tmp.treeQ) + '" autocomplete="off">';
    D.projects.forEach(p => {
      const exps = D.experiments.filter(x => x.projectId === p.id), pOpen = q || LB.ui.openProj[p.id] !== false;
      let body = "";
      exps.forEach(x => {
        const es = Object.values(D.entries).filter(e => e.expId === x.id && (!q || (e.title + " " + e.code + " " + e.aim).toLowerCase().includes(q))).sort(sortEntries);
        if (q && !es.length) return;
        const xOpen = q || LB.ui.openExp[x.id] !== false;
        body += '<div class="trow exp" data-a="toggleExp" data-id="' + x.id + '" role="button" tabindex="0"><span>' + (xOpen ? "▾" : "▸") + '</span><span style="flex-grow:1">' + LB.expCode(x) + " · " + esc(x.name) + '</span><span class="tools"><button class="x" data-a="newEntry" data-exp="' + x.id + '" title="New entry here">＋</button><button class="x" data-a="renameExp" data-id="' + x.id + '" title="Rename">✎</button><button class="x" data-a="delExp" data-id="' + x.id + '" title="Delete experiment">🗑</button></span></div>';
        if (xOpen) body += es.map(e => '<button class="trow ent' + (e.id === LB.ui.cur ? " on" : "") + '" data-a="openEntry" data-id="' + e.id + '"><span class="d">' + U.fmt(e.date, false) + '</span><span data-live="D.entries.' + e.id + '.title">' + esc(e.title) + "</span></button>").join("") || '<div class="muted sm" style="padding:2px 8px 4px 26px">No entries yet</div>';
      });
      if (q && !body) return;
      h += '<div class="th" data-a="toggleProj" data-id="' + p.id + '"><span>' + (pOpen ? "▾ " : "▸ ") + esc(p.name) + '</span><span class="tools"><button class="x" data-a="addExp" data-id="' + p.id + '" title="New experiment">＋</button><button class="x" data-a="renameProj" data-id="' + p.id + '" title="Rename">✎</button><button class="x" data-a="delProj" data-id="' + p.id + '" title="Delete project">🗑</button></span></div>';
      if (pOpen) h += '<div class="col" style="gap:2px">' + body + "</div>";
    });
    h += '<button class="link sm" data-a="addProj" style="margin-top:6px">+ New project</button></aside>';
    return h;
  }

  /* ---------- entry ---------- */
  function enteredLabel(e) {
    const g = U.daysBetween(e.date, e.entered || e.date);
    if (g === 0) return ['Entered the same day', ""];
    if (g > 0) return ["Entered " + U.fmt(e.entered, true) + " · " + g + (g === 1 ? " day" : " days") + " later", "badge"];
    return ["Entered before the experiment date", "badge"];
  }
  function head(e) {
    const P = "D.entries." + e.id, x = LB.expOf(e), dis = e.locked ? "disabled" : "", en = enteredLabel(e);
    return '<div class="ehead"><div class="t"><div class="pmeta"><span class="mono">' + esc(e.code) + "</span>" + (x ? "<span>" + esc(x.name) + "</span>" : "") +
      '<label>Experiment date <input type="date" data-b="' + P + '.date" data-act="entryDate" value="' + e.date + '" ' + dis + '></label><span class="' + en[1] + '" style="' + (en[1] ? "" : "") + '">' + en[0] + "</span></div>" +
      '<input type="text" class="etitle" aria-label="Entry title" data-b="' + P + '.title" data-live="' + P + '.title" data-log="Renamed entry" value="' + esc(e.title) + '" ' + dis + " autocomplete=\"off\"></div>" +
      '<span class="badge ' + (e.locked ? "ok" : "") + '" style="margin-top:8px">' + (e.locked ? "Signed &amp; locked" : "Draft") + "</span>" +
      '<button class="btn" style="margin-top:4px" data-a="exportPdf">Export PDF</button><button class="btn dark" style="margin-top:4px" data-a="toggleLock">' + (e.locked ? "Unlock" : "Sign &amp; lock") + "</button></div>";
  }
  function secBar(e) {
    return '<div class="secs">' + SEC.map((s, i) => '<button class="pill' + (LB.ui.sec === i ? " on" : "") + '" data-a="setSec" data-n="' + i + '">' + (i + 1) + " " + s + (e.sn[i] ? " •" : "") + "</button>").join("") + "</div>";
  }
  function overview(e) {
    const P = "D.entries." + e.id, dis = e.locked ? "disabled" : "", x = LB.expOf(e);
    const loaded = e.map.cells.filter(c => c.on).length;
    return '<div class="card"><h3>Overview</h3><div class="lbl">Aim</div>' + T(3, e.aim, 'aria-label="Aim" data-b="' + P + '.aim" data-log="Edited aim" ' + dis) +
      '<div class="lbl">Hypothesis</div>' + T(2, e.hyp, 'aria-label="Hypothesis" data-b="' + P + '.hyp" data-log="Edited hypothesis" ' + dis) +
      '<div class="kv"><span class="muted">Experiment</span><b>' + (x ? LB.expCode(x) + " · " + esc(x.name) : "–") + '</b><span class="muted">Protocol</span><b>' + (e.protocol ? esc(e.protocol.title) + " v" + e.protocol.ver : "none") + '</b><span class="muted">Linked materials</span><b>' + e.mats.length + ' items</b><span class="muted">Procedure</span><b>' + e.steps.filter(s => s.done).length + " of " + e.steps.length + ' steps done</b><span class="muted">Chip positions</span><b>' + loaded + " of " + e.map.cells.length + ' loaded</b><span class="muted">Files</span><b>' + e.files.length + " attached</b></div>" +
      '<div class="row"><button class="link sm" style="color:#b42318" data-a="delEntry">Delete this entry</button></div></div>';
  }
  function materials(e) {
    const dis = e.locked ? "disabled" : "", q = (LB.tmp.matQ || "").trim().toLowerCase(), D = LB.D;
    const items = D.items.filter(i => !q || (i.name + " " + i.sub + " " + i.kind).toLowerCase().includes(q));
    return '<div class="card"><div class="row"><h3 class="grow">Materials</h3><input type="text" placeholder="Filter…" aria-label="Filter materials" data-b="tmp.matQ" data-rin="1" value="' + esc(LB.tmp.matQ || "") + '" style="width:160px"><button class="btn sm" data-a="toggleNewMat" ' + dis + ">+ New material</button></div>" +
      '<div class="muted sm">Tick what you used in this entry. Anything missing from your inventory can be added with “+ New material”.</div>' +
      (LB.tmp.showNewMat ? LB.newMatForm("entry") : "") +
      (items.length ? items.map(it => {
        const k = e.mats.findIndex(m => m.id === it.id), on = k >= 0, m = on ? e.mats[k] : null, i = D.items.indexOf(it), PM = "D.entries." + e.id + ".mats." + k;
        return '<div class="item' + (on ? " on" : "") + '"><div class="item-h"><input type="checkbox" data-a="toggleMat" data-id="' + it.id + '" ' + (on ? "checked" : "") + " " + dis + ' aria-label="Use ' + esc(it.name) + ' in this entry"><div class="n"><b data-live="D.items.' + i + '.name">' + esc(it.name) + '</b><div class="muted sm">' + esc(it.sub) + '</div></div><span class="kind">' + esc(it.kind) + '</span><button class="btn sm" data-a="toggleItem" data-id="' + it.id + '">' + (LB.tmp.openItem === it.id ? "Hide details" : "Details" + (it.firms.length || it.docs.length ? " (" + it.firms.length + " firms, " + it.docs.length + " docs)" : "")) + "</button></div>" +
          (on ? '<div class="item-use"><span>Amount used</span><input type="text" placeholder="optional" aria-label="Amount used" data-b="' + PM + '.used" data-log="Edited amounts used" value="' + esc(m.used) + '" ' + dis + "><span>Left after</span><input type=\"text\" placeholder=\"optional\" aria-label=\"Amount left after the experiment\" data-b=\"" + PM + '.left" data-log="Edited amounts used" value="' + esc(m.left) + '" ' + dis + "><span>Unit</span><input type=\"text\" placeholder=\"mL, mg, vials…\" aria-label=\"Unit\" data-b=\"" + PM + '.unit" data-log="Edited amounts used" value="' + esc(m.unit) + '" ' + dis + "></div>" : "") +
          (LB.tmp.openItem === it.id ? LB.itemDetails(it) : "") + "</div>";
      }).join("") : '<div class="muted">No materials in the inventory yet.</div>') + "</div>";
  }
  function procedure(e) {
    const P = "D.entries." + e.id, dis = e.locked ? "disabled" : "", total = e.steps.length, done = e.steps.filter(s => s.done).length;
    const mp = e.map, cells = mp.cells, loaded = cells.filter(c => c.on).length, empties = cells.map((c, i) => (c.on ? 0 : i + 1)).filter(Boolean);
    const steps = '<div class="card"><div class="row"><h3 class="grow">Procedure</h3><span class="sm" style="color:var(--acc-d);font-weight:600">' + done + " of " + total + '</span></div><div class="bar"><i style="width:' + (total ? Math.round(done / total * 100) : 0) + '%"></i></div>' +
      e.steps.map((s, i) => '<div class="step' + (s.done ? " done" : "") + '"><input type="checkbox" data-a="toggleStep" data-i="' + i + '" ' + (s.done ? "checked" : "") + " " + dis + ' aria-label="Done"><input type="text" aria-label="Step" data-b="' + P + ".steps." + i + '.t" data-log="Edited a step" value="' + esc(s.t) + '" ' + dis + '><button class="x" data-a="rmStep" data-i="' + i + '" ' + dis + ' aria-label="Remove step">×</button></div>').join("") +
      (e.steps.length ? "" : '<div class="muted sm">No steps yet. Add them below, or start entries from a protocol.</div>') +
      '<input type="text" placeholder="+ Add a step and press Enter" aria-label="Add a step" data-b="tmp.newStep" data-enter="addStep" value="' + esc(LB.tmp.newStep || "") + '" ' + dis + ' autocomplete="off" style="border-width:0;border-top:1px solid var(--line2);border-radius:0;padding:10px 2px 2px"></div>';
    const map = '<div class="card"><h3>Chip loading map</h3><div class="muted sm">Click a position to mark it loaded or empty.</div>' +
      '<div class="chipmap"><div class="port"><i></i>IN</div><div class="pipe"></div><div class="chamber" style="grid-template-columns:repeat(' + mp.cols + ',minmax(0,1fr))">' +
      cells.map((c, i) => '<button class="well' + (c.on ? " on" : "") + '" data-a="well" data-i="' + i + '" ' + dis + ' aria-label="Position ' + (i + 1) + (c.on ? ", loaded" : ", empty") + '">' + (i + 1) + "</button>").join("") + '</div><div class="pipe"></div><div class="port out"><i></i>OUT</div></div>' +
      '<div class="mapset"><span class="mono">chamber · ' + loaded + "/" + cells.length + ' loaded</span><span class="grow"></span>Rows <input type="number" min="1" max="12" data-b="' + P + '.map.rows" data-t="num" data-act="mapResize" value="' + mp.rows + '" ' + dis + ">× columns <input type=\"number\" min=\"1\" max=\"12\" data-b=\"" + P + '.map.cols" data-t="num" data-act="mapResize" value="' + mp.cols + '" ' + dis + '><button class="link sm" data-a="mapClear" ' + dis + ">Clear all</button></div>" +
      (empties.length && loaded ? '<div class="warnbox">Empty positions: ' + empties.join(", ") + ". Note why in Results if this is a deviation.</div>" : "") +
      '<div class="lbl">Notes on loading</div>' + T(2, mp.note || "", 'aria-label="Notes on loading" data-b="' + P + '.map.note" data-log="Edited loading notes" ' + dis) + "</div>";
    return '<div class="two">' + steps + map + "</div>";
  }
  function results(e) {
    const P = "D.entries." + e.id, dis = e.locked ? "disabled" : "";
    return '<div class="card" data-dz="addEntryFiles" data-id="' + e.id + '"><h3>Results</h3>' +
      LB.filesGrid(e.files, { act: "addEntryFiles", id: e.id, owner: "e:" + e.id, dis: e.locked }) +
      '<div class="lbl">Observations</div>' + T(7, e.results, 'aria-label="Results" placeholder="Describe what you observed…" data-b="' + P + '.results" data-log="Edited results" ' + dis) + "</div>";
  }
  function conclusion(e) {
    const P = "D.entries." + e.id, dis = e.locked ? "disabled" : "";
    return '<div class="card"><h3>Conclusion &amp; next steps</h3>' + T(8, e.concl, 'aria-label="Conclusion" placeholder="What did you learn? What happens next?" data-b="' + P + '.concl" data-log="Edited conclusion" ' + dis) +
      '<div class="row muted sm">Ready? <button class="btn dark sm" data-a="toggleLock">' + (e.locked ? "Unlock" : "Sign &amp; lock") + "</button></div></div>";
  }
  function notesCard(e) {
    const dis = e.locked ? "disabled" : "";
    return '<div class="notes"><div class="row"><b style="color:#6b5a12">Notes</b><span class="sm" style="color:#8f7d2e">· ' + SEC[LB.ui.sec] + ' · scratch space for thoughts and reminders</span></div>' +
      T(3, e.sn[LB.ui.sec] || "", 'aria-label="Section notes" placeholder="Jot down thoughts, questions or reminders for this section…" data-b="D.entries.' + e.id + ".sn." + LB.ui.sec + '" data-log="Edited notes" ' + dis) + "</div>";
  }
  function emptyState() {
    return '<div class="empty"><div class="h" style="font-size:20px">Welcome to your lab book</div><div>Create your first entry to get started, or look around with example data.</div><div class="row"><button class="btn pri" data-a="newEntry">+ New entry</button><button class="btn" data-a="demo">Load example data</button></div>' +
      '<div class="muted sm" style="max-width:420px">Tip: open the “Saved in this browser” button at the top to choose a folder. From then on every change is also saved into a LabGorilla.lbk file.</div></div>';
  }
  function main() {
    const e = LB.cur();
    if (!e) return '<main class="main">' + emptyState() + "</main>";
    const body = [overview, materials, procedure, results, conclusion][LB.ui.sec](e);
    return '<main class="main">' + head(e) + secBar(e) + '<div class="mscroll" data-scroll="main">' + body + notesCard(e) + "</div></main>";
  }

  /* ---------- right panel ---------- */
  LB.upcoming = function (n) { const t = U.today(); return LB.D.events.filter(v => v.date >= t).sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || "")).slice(0, n); };
  function right() {
    const e = LB.cur(); if (!e) return "";
    const D = LB.D, tab = LB.ui.tab;
    const TABS = ["Inventory", "Comments" + (e.comments.length ? " (" + e.comments.length + ")" : ""), "History"];
    let body = "";
    if (tab === 0) {
      body = '<div class="muted sm">Materials used in this entry, taken from your lab inventory.</div>' + e.mats.map(m => {
        const it = D.items.find(i => i.id === m.id); if (!it) return "";
        const u = []; if (m.used) u.push("used " + m.used + " " + m.unit); if (m.left) u.push(m.left + " " + m.unit + " left");
        return '<div class="lin"><div class="n"><b>' + esc(it.name) + '</b><div class="s">' + esc(it.sub) + "</div>" + (u.length ? '<div class="u">' + esc(u.join(" · ")) + "</div>" : "") + '</div><button class="x" data-a="toggleMat" data-id="' + it.id + '" aria-label="Unlink" ' + (e.locked ? "disabled" : "") + ">×</button></div>";
      }).join("") + '<button class="link sm" data-a="setSec" data-n="1">+ link or add a material</button>';
    } else if (tab === 1) {
      body = e.comments.map(c => '<div class="lin" style="flex-direction:column;gap:2px"><div class="sm" style="color:var(--acc-d);font-weight:600">' + esc(c.who) + ' <span class="muted" style="font-weight:400">· ' + U.stampStr(c.at) + '</span></div><div style="font-size:13px;line-height:1.5;white-space:pre-wrap">' + esc(c.text) + "</div></div>").join("") +
        (e.comments.length ? "" : '<div class="muted sm">No comments yet. Comments stay possible after an entry is locked.</div>') +
        '<input type="text" aria-label="Write a comment" placeholder="Write a comment, press Enter" data-b="tmp.comment" data-enter="addComment" value="' + esc(LB.tmp.comment) + '" autocomplete="off">';
    } else {
      body = e.hist.map(h => '<div class="hist"><time>' + U.stampStr(h.at) + "</time><span>" + esc(h.msg) + "</span></div>").join("") + '<div class="muted sm" style="padding-top:6px">Every change is kept with its time.</div>';
    }
    const up = LB.upcoming(3);
    return '<aside class="right" data-scroll="right"><div class="tabs">' + TABS.map((t, i) => '<button class="tab' + (i === tab ? " on" : "") + '" data-a="setTab" data-n="' + i + '">' + t + "</button>").join("") + '</div><div class="col" style="gap:8px">' + body + "</div>" +
      '<div class="next"><div class="lbl">Next up</div>' + (up.length ? up.map(v => '<div class="row sm" style="align-items:baseline"><span class="mono" style="color:var(--acc-d);white-space:nowrap">' + U.fmt(v.date, false) + "</span><span>" + esc(v.title) + "</span></div>").join("") : '<div class="muted sm">Nothing planned.</div>') + '<button class="link sm" data-a="nav" data-v="calendar">Open calendar →</button></div></aside>';
  }
  LB.views.notebook = () => side() + main() + right();

  /* ---------- actions ---------- */
  const entryOK = () => { const e = LB.cur(); return e && !e.locked ? e : null; };
  A.openEntry = el => LB.openEntry(el.dataset.id);
  A.toggleProj = el => { if (LB.tmp.treeQ) return; LB.ui.openProj[el.dataset.id] = LB.ui.openProj[el.dataset.id] === false; LB.saveUI(); LB.render(); };
  A.toggleExp = (el, ev) => { if (ev.target.closest(".tools") || LB.tmp.treeQ) return; LB.ui.openExp[el.dataset.id] = LB.ui.openExp[el.dataset.id] === false; LB.saveUI(); LB.render(); };
  A.setSec = el => { LB.ui.sec = +el.dataset.n; LB.saveUI(); LB.render(); };
  A.setTab = el => { LB.ui.tab = +el.dataset.n; LB.saveUI(); LB.render(); };
  A.entryDate = el => { const e = LB.cur(); if (!e || !el.value) return; LB.log(e, "Changed experiment date to " + U.fmt(e.date, true)); LB.save(); LB.render(); };
  A.toggleLock = () => { const e = LB.cur(); if (!e) return; e.locked = !e.locked; LB.log(e, e.locked ? "Signed and locked" : "Unlocked for editing"); LB.save(); LB.render(); LB.toast(e.locked ? "Entry signed and locked." : "Entry unlocked for editing."); };
  A.toggleMat = el => { const e = entryOK(); if (!e) return; const k = e.mats.findIndex(m => m.id === el.dataset.id); if (k >= 0) e.mats.splice(k, 1); else e.mats.push({ id: el.dataset.id, used: "", left: "", unit: "" }); LB.log(e, "Changed linked materials"); LB.save(); LB.render(); };
  A.toggleStep = el => { const e = entryOK(); if (!e) return; const s = e.steps[+el.dataset.i]; s.done = !s.done; LB.log(e, "Ticked a step"); LB.save(); LB.render(); };
  A.rmStep = el => { const e = entryOK(); if (!e) return; e.steps.splice(+el.dataset.i, 1); LB.log(e, "Removed a step"); LB.save(); LB.render(); };
  A.addStep = el => { const e = entryOK(), v = el.value.trim(); if (!e || !v) return; e.steps.push({ t: v, done: false }); LB.tmp.newStep = ""; LB.log(e, "Added a step"); LB.save(); LB.render(); };
  A.well = el => { const e = entryOK(); if (!e) return; const c = e.map.cells[+el.dataset.i]; c.on = !c.on; LB.log(e, "Changed chip loading map"); LB.save(); LB.render(); };
  A.mapClear = () => { const e = entryOK(); if (!e) return; e.map.cells.forEach(c => { c.on = false; }); LB.save(); LB.render(); };
  A.mapResize = () => {
    const e = entryOK(); if (!e) return; const m = e.map;
    m.rows = Math.max(1, Math.min(12, Math.round(m.rows) || 1)); m.cols = Math.max(1, Math.min(12, Math.round(m.cols) || 1));
    const n = m.rows * m.cols; while (m.cells.length < n) m.cells.push({ on: false, note: "" }); m.cells.length = n;
    LB.log(e, "Resized chip map to " + m.rows + " × " + m.cols); LB.save(); LB.render();
  };
  A.addComment = el => { const e = LB.cur(), v = el.value.trim(); if (!e || !v) return; e.comments.push({ who: "You", text: v, at: Date.now() }); LB.tmp.comment = ""; LB.log(e, "Added a comment"); LB.save(); LB.render(); };

  /* entries */
  A.newEntry = el => {
    const D = LB.D, e = LB.cur(), expId = (el && el.dataset && el.dataset.exp) || (e && e.expId) || (D.experiments[0] && D.experiments[0].id) || "__new";
    LB.tmp.nw = { title: "", expId, newExp: "", projId: (D.projects[0] && D.projects[0].id) || "__new", newProj: "", date: U.today(), proto: LB.tmp.nwProto || "" };
    LB.tmp.nwProto = ""; LB.tmp.pop = "new"; LB.render();
    const t = document.querySelector('[data-b="tmp.nw.title"]'); if (t) t.focus();
  };
  A.createEntry = () => {
    const D = LB.D, nw = LB.tmp.nw; let x;
    if (nw.expId === "__new" || !D.experiments.length) {
      let pid = nw.projId;
      if (pid === "__new" || !D.projects.length) { const p = { id: U.uid(), name: (nw.newProj || "").trim() || "My project" }; D.projects.push(p); pid = p.id; }
      x = { id: U.uid(), projectId: pid, name: (nw.newExp || "").trim() || "New experiment", num: ++D.expSeq }; D.experiments.push(x);
    } else x = D.experiments.find(z => z.id === nw.expId);
    const pr = nw.proto ? D.protocols[nw.proto] : null;
    const n = Object.values(D.entries).filter(e => e.expId === x.id).length;
    const e = { id: U.uid(), expId: x.id, code: LB.expCode(x) + U.letter(n), title: nw.title.trim() || (pr ? pr.title : "Untitled entry"), date: nw.date || U.today(), entered: U.today(), enteredAt: Date.now(), locked: false,
      aim: "", hyp: "", results: "", concl: "", sn: ["", "", "", "", ""], steps: pr ? pr.steps.map(t => ({ t, done: false })) : [], protocol: pr ? { id: nw.proto, ver: pr.ver, title: pr.title } : null,
      map: LB.newMap(), mats: pr ? pr.mats.filter(id => D.items.some(i => i.id === id)).map(id => ({ id, used: "", left: "", unit: "" })) : [], files: [], comments: [], hist: [] };
    LB.log(e, pr ? "Entry created from " + pr.title + " v" + pr.ver : "Entry created");
    D.entries[e.id] = e; LB.tmp.pop = ""; LB.ui.openExp[x.id] = true; LB.ui.openProj[x.projectId] = true;
    LB.save(); LB.openEntry(e.id, pr ? 2 : 0);
  };
  A.delEntry = async () => {
    const e = LB.cur(); if (!e || !confirm("Delete “" + e.title + "” for good? Its attached files are deleted too.")) return;
    for (const f of e.files) await LB.fileRemove(f);
    delete LB.D.entries[e.id]; LB.ui.cur = ""; LB.save(); LB.saveUI(); LB.render();
  };
  /* projects & experiments */
  A.addProj = () => { const n = prompt("Name of the new project:"); if (!n || !n.trim()) return; LB.D.projects.push({ id: U.uid(), name: n.trim() }); LB.save(); LB.render(); };
  A.renameProj = el => { const p = LB.D.projects.find(x => x.id === el.dataset.id), n = prompt("Rename project:", p.name); if (n && n.trim()) { p.name = n.trim(); LB.save(); LB.render(); } };
  A.delProj = el => {
    const D = LB.D, p = D.projects.find(x => x.id === el.dataset.id), exps = D.experiments.filter(x => x.projectId === p.id);
    if (exps.length) { alert("This project still has experiments. Delete or move them first."); return; }
    if (confirm("Delete the empty project “" + p.name + "”?")) { D.projects = D.projects.filter(x => x !== p); LB.save(); LB.render(); }
  };
  A.addExp = el => {
    const n = prompt("Name of the new experiment:"); if (!n || !n.trim()) return;
    LB.D.experiments.push({ id: U.uid(), projectId: el.dataset.id, name: n.trim(), num: ++LB.D.expSeq }); LB.save(); LB.render();
  };
  A.renameExp = el => { const x = LB.D.experiments.find(z => z.id === el.dataset.id), n = prompt("Rename experiment:", x.name); if (n && n.trim()) { x.name = n.trim(); LB.save(); LB.render(); } };
  A.delExp = async el => {
    const D = LB.D, x = D.experiments.find(z => z.id === el.dataset.id), es = Object.values(D.entries).filter(e => e.expId === x.id);
    if (!confirm("Delete experiment “" + x.name + "”" + (es.length ? " and its " + es.length + " entries (files included)" : "") + "?")) return;
    for (const e of es) { for (const f of e.files) await LB.fileRemove(f); delete D.entries[e.id]; }
    D.experiments = D.experiments.filter(z => z !== x); if (!D.entries[LB.ui.cur]) LB.ui.cur = ""; LB.save(); LB.render();
  };

  /* ---------- PDF export (print dialog → Save as PDF) ---------- */
  A.exportPdf = async () => {
    const e = LB.cur(); if (!e) return; const D = LB.D, x = LB.expOf(e), proj = x && D.projects.find(p => p.id === x.projectId);
    const tx = (t, v, cls) => v && v.trim() ? "<section" + (cls ? ' class="' + cls + '"' : "") + "><h2>" + t + '</h2><div class="tx">' + esc(v) + "</div></section>" : "";
    const note = (label, v) => (v && v.trim() ? '<div class="note"><b>' + label + ":</b> " + esc(v) + "</div>" : "");
    const signed = e.hist.slice().reverse().find(h => /^Signed/.test(h.msg));
    let h = '<div class="ph"><span class="pb">LabGorilla · Lab notebook</span><span class="stamp' + (e.locked ? " ok" : "") + '">' + (e.locked ? "Signed &amp; locked" + (signed ? " · " + U.stampStr(signed.at) : "") : "Draft") + "</span></div>";
    h += "<h1>" + esc(e.title) + "</h1>";
    const gap = U.daysBetween(e.date, e.entered);
    const rows = [["Entry", esc(e.code)], ["Project / experiment", esc((proj ? proj.name + " / " : "") + (x ? LB.expCode(x) + " · " + x.name : "–"))], ["Experiment date", U.fmtLong(e.date)],
      ["Entered in the lab book", U.fmt(e.entered, true) + (gap > 0 ? " (" + gap + (gap === 1 ? " day" : " days") + " after the experiment)" : "")], ["Protocol", e.protocol ? esc(e.protocol.title) + " (v" + e.protocol.ver + ")" : "none"]];
    h += '<table class="pmeta">' + rows.map(r => "<tr><th>" + r[0] + "</th><td>" + r[1] + "</td></tr>").join("") + "</table>";
    h += tx("Aim", e.aim) + tx("Hypothesis", e.hyp) + note("Notes", e.sn[0]);
    const mats = e.mats.map(m => ({ m, it: D.items.find(i => i.id === m.id) })).filter(r => r.it);
    if (mats.length) h += '<section class="long"><h2>Materials</h2><table class="t"><tr><th>Item</th><th>Type</th><th>Details</th><th>Used</th><th>Left after</th></tr>' + mats.map(({ m, it }) => "<tr><td>" + esc(it.name) + "</td><td>" + esc(it.kind) + "</td><td>" + esc(it.sub) + "</td><td>" + esc(m.used ? (m.used + " " + m.unit).trim() : "") + "</td><td>" + esc(m.left ? (m.left + " " + m.unit).trim() : "") + "</td></tr>").join("") + "</table></section>" + note("Notes", e.sn[1]);
    if (e.steps.length) h += '<section class="long"><h2>Procedure</h2><table class="t"><tr><th style="width:22pt">#</th><th>Step</th><th class="ck">Done</th></tr>' + e.steps.map((s, i) => "<tr><td>" + (i + 1) + "</td><td>" + esc(s.t) + '</td><td class="ck">' + (s.done ? "☑" : "☐") + "</td></tr>").join("") + "</table></section>" + note("Notes", e.sn[2]);
    const mp = e.map, loaded = mp.cells.filter(c => c.on).length;
    if (loaded) h += '<section><h2>Chip loading</h2><div class="chip" style="grid-template-columns:repeat(' + mp.cols + ',13pt)">' + mp.cells.map(c => '<i class="' + (c.on ? "on" : "") + '"></i>').join("") + '</div><div class="small">' + loaded + " of " + mp.cells.length + " positions loaded (" + mp.rows + " × " + mp.cols + "). Empty positions: " + (mp.cells.map((c, i) => (c.on ? 0 : i + 1)).filter(Boolean).join(", ") || "none") + ".</div>" + (mp.note ? '<div class="tx">' + esc(mp.note) + "</div>" : "") + "</section>";
    h += tx("Results", e.results, "long");
    const figs = [], others = [];
    for (const f of e.files) {
      if (LB.isImage(f)) { const u = await LB.fileUrl(f); if (u) { figs.push('<figure><img src="' + u + '" alt="' + esc(f.name) + '"><figcaption>' + esc(f.name) + "</figcaption></figure>"); continue; } }
      others.push(esc(f.name) + " (" + U.size(f.size || 0) + ")");
    }
    if (figs.length || others.length) h += '<section class="long"><h2>Attached files</h2>' + (figs.length ? '<div class="imgs">' + figs.join("") + "</div>" : "") + (others.length ? '<div class="small" style="margin-top:6pt">Other files: ' + others.join(", ") + "</div>" : "") + "</section>";
    h += note("Notes", e.sn[3]) + tx("Conclusion &amp; next steps", e.concl) + note("Notes", e.sn[4]);
    if (e.comments.length) h += '<section class="long rec"><h2>Comments</h2>' + e.comments.map(c => "<div><b>" + esc(c.who) + '</b> <span class="small">' + U.stampStr(c.at) + "</span><br>" + esc(c.text) + "</div>").join("") + "</section>";
    h += '<section class="long rec"><h2>Change history</h2>' + e.hist.slice().reverse().map(z => '<div class="small">' + U.stampStr(z.at) + " · " + esc(z.msg) + "</div>").join("") + '</section><div class="small">Printed ' + U.fmt(U.today(), true) + " from LabGorilla.</div>";
    const p = document.getElementById("print"); p.innerHTML = h;
    await Promise.race([Promise.all(Array.from(p.querySelectorAll("img")).map(i => (i.decode ? i.decode().catch(() => { }) : 0))), new Promise(r => setTimeout(r, 4000))]);
    const old = document.title; document.title = e.code + " " + e.title;   // becomes the suggested PDF file name
    window.print(); setTimeout(() => { document.title = old; }, 500);
  };
})(window.LB);
