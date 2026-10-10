/* LabGorilla — app shell: render loop, event handling, top bar, dialogs, colors. */
(function (LB) {
  const U = LB.U, esc = U.esc;
  const $ = s => document.querySelector(s);
  const A = (LB.actions = {});
  LB.views = {};

  /* ---------- colors ---------- */
  LB.THEMES = {
    indigo: { name: "Indigo", kind: "one color", acc: "#4f46e5", accD: "#3730a3", accS: "#eceefe", accM: "#a5b4fc", bar: "#1b2030", bar2: "#2b3250" },
    teal: { name: "Teal", kind: "one color", acc: "#0f766e", accD: "#115e59", accS: "#e3f3f1", accM: "#8fd3cb", bar: "#10302e", bar2: "#1c4642" },
    plum: { name: "Plum", kind: "one color", acc: "#a23b72", accD: "#7c2a58", accS: "#f8e8f1", accM: "#e0a6c6", bar: "#2a1726", bar2: "#402338" },
    sunset: { name: "Orange and navy", kind: "two colors", acc: "#d9480f", accD: "#a8380b", accS: "#fdeee5", accM: "#f1b08e", bar: "#1d3b53", bar2: "#2c5473" },
    graphite: { name: "Graphite", kind: "neutral", acc: "#374151", accD: "#1f2937", accS: "#eceef1", accM: "#aab0bb", bar: "#111827", bar2: "#1f2937" }
  };
  LB.applyTheme = function () {
    const t = LB.THEMES[LB.S.theme] || LB.THEMES.indigo, st = document.documentElement.style;
    st.setProperty("--acc", t.acc); st.setProperty("--acc-d", t.accD); st.setProperty("--acc-s", t.accS);
    st.setProperty("--acc-m", t.accM); st.setProperty("--bar", t.bar); st.setProperty("--bar-2", t.bar2);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t.bar;
  };

  /* ---------- small shared helpers ---------- */
  let tt;
  LB.toast = function (msg) {
    let el = $("#toast"); if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("show"), 3200);
  };
  LB.cur = () => LB.D.entries[LB.ui.cur] || null;
  LB.expOf = e => LB.D.experiments.find(x => x.id === e.expId);
  LB.expCode = x => "EXP-" + U.pad(x.num || 0);
  LB.mutate = fn => { fn(); LB.save(); LB.render(); };
  LB.go = function (view, extra) { Object.assign(LB.ui, { view }, extra || {}); LB.saveUI(); LB.render(); };
  LB.openEntry = function (id, sec) {
    const e = LB.D.entries[id]; if (!e) return false;
    LB.ui.view = "notebook"; LB.ui.cur = id; if (sec != null) LB.ui.sec = sec;
    const x = LB.expOf(e); if (x) { LB.ui.openExp[x.id] = true; LB.ui.openProj[x.projectId] = true; }
    LB.tmp.gq = ""; LB.saveUI(); LB.render(); return true;
  };

  /* ---------- render ---------- */
  LB.render = function () {
    const app = $("#app");
    const f = document.activeElement; let fk = null, ss = 0, se = 0;
    if (f && app.contains(f) && (f.dataset.b || f.dataset.fk)) { fk = f.dataset.b || f.dataset.fk; ss = f.selectionStart; se = f.selectionEnd; }
    const scr = {}; app.querySelectorAll("[data-scroll]").forEach(e => { scr[e.dataset.scroll] = e.scrollTop; });
    LB.applyTheme();
    const v = LB.views[LB.ui.view] || LB.views.notebook;
    app.innerHTML = topbar() + '<div class="layout">' + v() + "</div>" + overlays();
    app.querySelectorAll("[data-scroll]").forEach(e => { if (scr[e.dataset.scroll] != null) e.scrollTop = scr[e.dataset.scroll]; });
    if (fk) {
      const n = app.querySelector('[data-b="' + fk + '"],[data-fk="' + fk + '"]');
      if (n) { n.focus(); try { if (ss != null) n.setSelectionRange(ss, se); } catch (e) { } }
    }
    hydrate();
  };
  function hydrate() {
    const refs = {}; LB.allRefs().forEach(r => { refs[r.id] = r; });
    document.querySelectorAll("img[data-fid]").forEach(img => {
      const r = refs[img.dataset.fid]; if (!r) return;
      LB.fileUrl(r).then(u => { if (u) img.src = u; else if (img.parentNode) img.parentNode.textContent = "file not found"; });
    });
  }
  LB.refById = id => LB.allRefs().find(r => r.id === id);

  /* ---------- top bar ---------- */
  const LOGO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/></svg>';
  function fileChip() {
    const F = LB.file;
    const m = { ok: ["✓ Saved to LabGorilla.lbk", ""], saving: ["Saving…", ""], needs: ["⚠ Reconnect file", "warn"], error: ["⚠ File problem", "warn"], none: ["Saved in this browser", ""], local: ["Saved in this browser", ""] };
    const x = m[F.state] || m.none;
    return '<button class="tbtn ' + x[1] + '" data-a="pop" data-p="file" title="Your lab book file">' + x[0] + "</button>";
  }
  function globalResults() {
    const q = (LB.tmp.gq || "").trim().toLowerCase(); if (!q) return "";
    const D = LB.D, out = [];
    const has = (...t) => t.some(s => String(s || "").toLowerCase().includes(q));
    Object.values(D.entries).forEach(e => { if (has(e.code, e.title, e.aim, e.hyp, e.results, e.concl, e.sn.join(" "), e.steps.map(s => s.t).join(" "), e.comments.map(c => c.text).join(" "))) out.push({ k: "Entry", t: e.code + " · " + e.title, a: "gopen", kind: "entry", id: e.id }); });
    Object.entries(D.protocols).forEach(([id, p]) => { if (has(p.title, p.desc, p.steps.join(" "))) out.push({ k: "Protocol", t: p.title, a: "gopen", kind: "proto", id }); });
    D.items.forEach(i => { if (has(i.name, i.sub, i.kind)) out.push({ k: "Inventory", t: i.name + " · " + i.kind, a: "gopen", kind: "item", id: i.id }); });
    D.events.forEach(v => { if (has(v.title)) out.push({ k: "Calendar", t: U.fmt(v.date) + " · " + v.title, a: "gopen", kind: "event", id: v.id }); });
    return '<div class="gres">' + (out.length ? out.slice(0, 14).map(r => '<button data-a="' + r.a + '" data-kind="' + r.kind + '" data-id="' + r.id + '"><span class="k">' + r.k + "</span><span>" + esc(r.t) + "</span></button>").join("") : '<div class="muted sm" style="padding:8px 10px">Nothing found.</div>') + "</div>";
  }
  function topbar() {
    const NAV = [["notebook", "Notebook"], ["protocols", "Protocols"], ["inventory", "Inventory"], ["calendar", "Calendar"]];
    return '<header class="top"><div class="brand">' + LOGO + 'LabGorilla</div><nav class="nav">' +
      NAV.map(([k, l]) => '<button class="' + (LB.ui.view === k ? "on" : "") + '" data-a="nav" data-v="' + k + '">' + l + "</button>").join("") + '</nav><span class="grow"></span>' +
      '<div class="tsearch"><input type="text" placeholder="Search everything…" aria-label="Search everything" autocomplete="off" data-b="tmp.gq" data-rin="1" value="' + esc(LB.tmp.gq || "") + '">' + globalResults() + "</div>" +
      fileChip() + '<button class="tbtn" data-a="pop" data-p="theme" title="Colors"><span style="width:10px;height:10px;border-radius:50%;background:var(--acc);display:inline-block"></span>Colors</button></header>';
  }
  LB.onFileState = function () { if (document.querySelector("#app .top")) LB.render(); };

  /* ---------- popovers & dialogs ---------- */
  function themePop() {
    return '<div class="pop" style="width:300px"><div class="h">Colors</div><div class="muted sm">One accent color, or an accent plus a matching top bar.</div>' +
      Object.keys(LB.THEMES).map(k => { const t = LB.THEMES[k]; return '<button class="themeopt ' + (LB.S.theme === k ? "on" : "") + '" data-a="setTheme" data-k="' + k + '"><span class="sw"><i style="background:' + t.acc + '"></i><i style="background:' + t.bar + '"></i></span><span class="grow">' + t.name + '</span><span class="muted" style="font-size:11px;font-weight:500">' + t.kind + "</span></button>"; }).join("") + "</div>";
  }
  function filePop() {
    const F = LB.file;
    const status = {
      ok: '<div class="okbox">✓ Every change is saved automatically into ' + esc(F.name) + "/LabGorilla.lbk</div>",
      saving: '<div class="okbox">Saving…</div>',
      needs: '<div class="warnbox2">The browser needs your permission again to save into <b>' + esc(F.name) + "</b>. Click Reconnect.</div>",
      error: '<div class="warnbox2">The file could not be written' + (F.msg ? ": " + esc(F.msg) : "") + ".</div>",
      none: '<div class="warnbox2">Right now everything is saved only inside this browser. Choose a folder so it is also saved into a LabGorilla.lbk file that you can back up or keep in iCloud Drive.</div>',
      local: '<div class="warnbox2">This browser cannot save into a file by itself. Everything is saved in the browser; use Backup now and then. (In Brave: enable “File System Access API” in brave://flags.)</div>'
    }[F.state] || "";
    const btns = [];
    if (F.ok && F.state === "needs") btns.push('<button class="btn pri" data-a="fileReconnect">Reconnect</button>');
    if (F.ok && (F.state === "none")) btns.push('<button class="btn pri" data-a="fileChoose">Choose folder…</button>');
    if (F.ok && F.dir) btns.push('<button class="btn" data-a="fileChoose">Change folder…</button>', '<button class="btn" data-a="fileUnlink">Stop saving to file</button>');
    btns.push('<button class="btn" data-a="fileBackup">⬇ Backup</button>', '<label class="btn" style="cursor:pointer">⬆ Restore<input type="file" accept=".lbk,.json,application/json" data-file="fileRestore" hidden></label>');
    return '<div class="pop"><div class="h">Your lab book file</div>' + status +
      '<div class="muted" style="font-size:13px;line-height:1.55">Text, tables and settings live in <b>LabGorilla.lbk</b>. Images and PDFs go into a folder called “LabGorilla files” next to it. Hedgehog can read the same file to show your experiments in the planner.</div>' +
      '<div class="row wrap">' + btns.join("") + "</div>" +
      '<div class="muted sm">A backup is a copy as of now. Restore replaces everything on screen with the backup file.</div>' +
      '<hr style="border:0;border-top:1px solid var(--line2);width:100%"><div class="row wrap"><button class="btn" data-a="demo">Load example data</button><span class="muted sm">Fills the lab book with sample experiments, protocols and inventory.</span></div></div>';
  }
  function newEntryModal() {
    const D = LB.D, nw = LB.tmp.nw;
    const newExp = nw.expId === "__new" || !D.experiments.length;
    return '<div class="backdrop" data-a="closeModal"><div class="modal"><h2>New entry</h2>' +
      '<label>Title<input type="text" data-b="tmp.nw.title" placeholder="e.g. Seeding on chip C8" value="' + esc(nw.title) + '" autocomplete="off"></label>' +
      '<label>Experiment<select data-b="tmp.nw.expId" data-render="1">' + D.experiments.map(x => '<option value="' + x.id + '"' + (nw.expId === x.id ? " selected" : "") + ">" + LB.expCode(x) + " · " + esc(x.name) + "</option>").join("") + '<option value="__new"' + (newExp ? " selected" : "") + ">+ New experiment…</option></select></label>" +
      (newExp ? '<label>New experiment name<input type="text" data-b="tmp.nw.newExp" placeholder="e.g. Spheroid loading" value="' + esc(nw.newExp) + '"></label>' +
        '<label>Project<select data-b="tmp.nw.projId">' + D.projects.map(p => '<option value="' + p.id + '"' + (nw.projId === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>").join("") + '<option value="__new">+ New project…</option></select></label>' : "") +
      (newExp && nw.projId === "__new" ? '<label>New project name<input type="text" data-b="tmp.nw.newProj" value="' + esc(nw.newProj) + '"></label>' : "") +
      '<label>Experiment date (the day you did the work)<input type="date" data-b="tmp.nw.date" value="' + nw.date + '"></label>' +
      '<label>Start from a protocol<select data-b="tmp.nw.proto"><option value="">None (blank entry)</option>' + Object.keys(D.protocols).map(id => '<option value="' + id + '"' + (nw.proto === id ? " selected" : "") + ">" + esc(D.protocols[id].title) + " (v" + D.protocols[id].ver + ")</option>").join("") + "</select></label>" +
      '<div class="row" style="justify-content:flex-end"><button class="btn" data-a="closeModal" data-force="1">Cancel</button><button class="btn pri" data-a="createEntry">Create entry</button></div></div></div>';
  }
  function overlays() {
    const p = LB.tmp.pop;
    return p === "theme" ? themePop() : p === "file" ? filePop() : p === "new" ? newEntryModal() : "";
  }

  /* ---------- shared actions ---------- */
  A.nav = el => { LB.tmp.pop = ""; LB.go(el.dataset.v); };
  A.pop = el => { LB.tmp.pop = LB.tmp.pop === el.dataset.p ? "" : el.dataset.p; LB.render(); };
  A.closeModal = (el, ev) => { if (el.dataset.force || ev.target === el) { LB.tmp.pop = ""; LB.render(); } };
  A.setTheme = el => { LB.S.theme = el.dataset.k; LB.tmp.pop = ""; LB.save(); LB.render(); };
  A.fileChoose = () => LB.chooseFolder();
  A.fileReconnect = () => LB.reconnect();
  A.fileUnlink = async () => { await LB.unlinkFolder(); LB.render(); };
  A.fileBackup = () => LB.downloadBackup();
  A.fileRestore = async el => { const f = el.files[0]; el.value = ""; if (f) await LB.restoreFrom(f); };
  A.demo = () => {
    if (LB.hasContent() && !confirm("Add the example data? It will be added next to what you already have.")) return;
    LB.seedDemo(); LB.tmp.pop = ""; LB.save(); LB.render(); LB.toast("Example data added.");
  };
  A.gopen = el => {
    const { kind, id } = el.dataset; LB.tmp.gq = "";
    if (kind === "entry") LB.openEntry(id, 0);
    else if (kind === "proto") { LB.tmp.protoCur = id; LB.go("protocols"); }
    else if (kind === "item") { LB.tmp.openItem = id; LB.tmp.invQ = ""; LB.tmp.invType = ""; LB.go("inventory"); }
    else { const v = LB.D.events.find(x => x.id === id); if (v) { LB.ui.sel = v.date; const d = U.parse(v.date); LB.ui.calY = d.getFullYear(); LB.ui.calM = d.getMonth(); } LB.go("calendar"); }
  };

  /* ---------- event delegation ---------- */
  document.addEventListener("click", ev => {
    const el = ev.target.closest("[data-a]");
    if (LB.tmp.pop && LB.tmp.pop !== "new" && !ev.target.closest(".pop") && !(el && el.dataset.a === "pop")) { LB.tmp.pop = ""; LB.render(); }
    if (LB.tmp.gq && !ev.target.closest(".tsearch")) { LB.tmp.gq = ""; LB.render(); }
    if (!el) return;
    const fn = A[el.dataset.a]; if (fn) fn(el, ev);
  });
  document.addEventListener("input", ev => {
    const el = ev.target, p = el.dataset && el.dataset.b; if (!p) return;
    const v = el.type === "checkbox" ? el.checked : el.dataset.t === "num" ? +el.value : el.value;
    if (!U.setPath(LB, p, v)) return;
    if (p.startsWith("D.") || p.startsWith("S.")) LB.save(); else if (p.startsWith("ui.")) LB.saveUI();
    document.querySelectorAll('[data-live="' + p + '"]').forEach(n => { n.textContent = v; });
    if (el.dataset.rin) LB.render();
  });
  document.addEventListener("change", ev => {
    const el = ev.target; if (!el.dataset) return;
    if (el.dataset.file) { const fn = A[el.dataset.file]; if (fn) fn(el, ev); return; }
    const p = el.dataset.b; if (!p) return;
    if (p.startsWith("D.entries.") && el.dataset.log) { LB.log(LB.D.entries[p.split(".")[2]], el.dataset.log); LB.save(); }
    if (el.dataset.act && A[el.dataset.act]) A[el.dataset.act](el, ev);
    else if (el.dataset.render) LB.render();
  });
  document.addEventListener("keydown", ev => {
    const el = ev.target;
    if (ev.key === "Enter" && el.dataset && el.dataset.enter && A[el.dataset.enter]) { ev.preventDefault(); A[el.dataset.enter](el, ev); return; }
    if (ev.key === "Escape" && (LB.tmp.pop || LB.tmp.gq)) { LB.tmp.pop = ""; LB.tmp.gq = ""; LB.render(); return; }
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "s") { ev.preventDefault(); if (LB.file.dir) LB.writeFileNow(); else LB.downloadBackup(); }
  });
  /* drop files onto a zone marked data-dz */
  document.addEventListener("dragover", ev => { const z = ev.target.closest && ev.target.closest("[data-dz]"); if (z) { ev.preventDefault(); z.classList.add("dz-over"); } });
  document.addEventListener("dragleave", ev => { const z = ev.target.closest && ev.target.closest("[data-dz]"); if (z) z.classList.remove("dz-over"); });
  document.addEventListener("drop", ev => {
    const z = ev.target.closest && ev.target.closest("[data-dz]"); if (!z) return;
    ev.preventDefault(); z.classList.remove("dz-over");
    const fn = A[z.dataset.dz]; if (fn && ev.dataTransfer.files.length) fn({ dataset: z.dataset, files: ev.dataTransfer.files, value: "" });
  });

  /* ---------- hash links: #/entry/<id or code> (used by Hedgehog) ---------- */
  LB.route = function () {
    const c = location.hash.match(/^#\/calendar\/(\d{4}-\d{2}-\d{2})$/);
    if (c) { const d = U.parse(c[1]); LB.ui.sel = c[1]; LB.ui.calY = d.getFullYear(); LB.ui.calM = d.getMonth(); LB.go("calendar"); return; }
    const m = location.hash.match(/^#\/entry\/(.+)$/); if (!m) return;
    const key = decodeURIComponent(m[1]);
    const e = LB.D.entries[key] || Object.values(LB.D.entries).find(x => x.code === key);
    if (e) LB.openEntry(e.id, 0); else LB.toast("That entry was not found in this lab book.");
  };
  window.addEventListener("hashchange", LB.route);
})(window.LB);
