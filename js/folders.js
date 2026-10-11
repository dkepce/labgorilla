/* LabGorilla — one level of folders for protocols and inventory items, plus moving experiments between projects.
   Folders are plain lists in D.folders.proto / D.folders.item; a protocol or item points at one with `.folder` (empty = no folder).
   Things move by drag and drop (onto a folder or project heading) or with the Folder menu in their details. */
(function (LB) {
  const U = LB.U, esc = U.esc, A = LB.actions;
  const NAME = { proto: "protocol", item: "item" };
  LB.ui.fold = LB.ui.fold || {};

  /* data: always have the lists, and forget folder ids that no longer exist */
  const baseFix = LB.fixData;
  LB.fixData = function () {
    baseFix();
    const D = LB.D; D.folders = D.folders || {}; D.folders.proto = D.folders.proto || []; D.folders.item = D.folders.item || [];
    Object.values(D.protocols).forEach(p => { if (!D.folders.proto.some(f => f.id === p.folder)) p.folder = ""; });
    D.items.forEach(i => { if (!D.folders.item.some(f => f.id === i.folder)) i.folder = ""; });
  };
  LB.fixData();

  const list = scope => LB.D.folders[scope];
  const find = (scope, id) => list(scope).find(f => f.id === id);
  const target = (scope, id) => (scope === "proto" ? LB.D.protocols[id] : LB.D.items.find(i => i.id === id));
  const count = (scope, fid) => (scope === "proto" ? Object.values(LB.D.protocols) : LB.D.items).filter(o => (o.folder || "") === fid).length;
  const key = (scope, fid) => scope + ":" + fid;

  /* ---------- rendering helpers ---------- */
  function head(scope, f, n) {
    const id = f ? f.id : "", shut = LB.ui.fold[key(scope, id)] === true;
    return '<div class="fhead" data-a="foldToggle" data-scope="' + scope + '" data-k="' + id + '" data-drop="' + scope + ":" + id + '" role="button" tabindex="0" aria-expanded="' + (shut ? "false" : "true") + '">' +
      '<span class="fchev">' + (shut ? "▸" : "▾") + '</span><span class="ficon" aria-hidden="true">' + (f ? "📁" : "📄") + "</span><b>" + esc(f ? f.name : "No folder") + '</b><span class="muted sm">' + n + "</span>" +
      (f ? '<span class="tools"><button class="x" data-a="foldRename" data-scope="' + scope + '" data-k="' + id + '" title="Rename folder" aria-label="Rename folder">✎</button><button class="x" data-a="foldDel" data-scope="' + scope + '" data-k="' + id + '" title="Delete folder (its ' + NAME[scope] + 's are kept)" aria-label="Delete folder">🗑</button></span>' : "") + "</div>";
  }
  /* html for a list of things, grouped under their folders. Without any folder it is just the plain list. */
  LB.grouped = function (scope, objs, render, showEmpty, folderOf) {
    const fs = list(scope), of = folderOf || (o => o.folder || "");
    if (!fs.length) return objs.map(render).join("");
    const groups = fs.map(f => ({ f, items: objs.filter(o => of(o) === f.id) })).concat([{ f: null, items: objs.filter(o => !fs.some(f => f.id === of(o))) }]);
    return groups.filter(g => g.items.length || (g.f && showEmpty)).map(g => {
      const shut = LB.ui.fold[key(scope, g.f ? g.f.id : "")] === true;
      return '<div class="fgroup">' + head(scope, g.f, g.items.length) + (shut ? "" : '<div class="fbody">' + (g.items.map(render).join("") || '<div class="muted sm" style="padding:4px 8px 8px 26px">Empty. Drag something here, or use its Folder menu.</div>') + "</div>") + "</div>";
    }).join("");
  };
  LB.dragAttrs = (scope, id) => ' draggable="true" data-drag="' + scope + ":" + id + '"';
  LB.dragHandle = (scope, id) => (list(scope).length ? '<span class="dh"' + LB.dragAttrs(scope, id) + ' title="Drag onto a folder" aria-label="Drag to a folder">⠿</span>' : "");
  /* the Folder menu inside details */
  LB.folderSelect = function (scope, obj, id) {
    return '<label><span class="lbl">Folder</span><br><select class="fsel" data-file="setFolder" data-scope="' + scope + '" data-id="' + id + '"><option value="">No folder</option>' +
      list(scope).map(f => '<option value="' + f.id + '"' + ((obj.folder || "") === f.id ? " selected" : "") + ">" + esc(f.name) + "</option>").join("") + '<option value="__new">＋ New folder…</option></select></label>';
  };
  LB.folderButton = scope => '<button class="link sm" data-a="foldAdd" data-scope="' + scope + '">＋ New folder</button>';

  /* ---------- actions ---------- */
  const name = (msg, cur) => { const n = prompt(msg, cur || ""); return n && n.trim() ? n.trim() : ""; };
  function create(scope) {
    const n = name("Name of the new folder:"); if (!n) return null;
    const f = { id: U.uid(), name: n }; list(scope).push(f); return f;
  }
  A.foldAdd = el => { const f = create(el.dataset.scope); if (f) { LB.save(); LB.render(); } };
  A.foldToggle = (el, ev) => { if (ev.target.closest(".tools")) return; const k = key(el.dataset.scope, el.dataset.k); LB.ui.fold[k] = LB.ui.fold[k] !== true; LB.saveUI(); LB.render(); };
  A.foldRename = el => { const f = find(el.dataset.scope, el.dataset.k), n = f && name("Rename folder:", f.name); if (n) { f.name = n; LB.save(); LB.render(); } };
  A.foldDel = el => {
    const scope = el.dataset.scope, f = find(scope, el.dataset.k); if (!f) return; const n = count(scope, f.id);
    if (!confirm("Delete the folder “" + f.name + "”?" + (n ? "\n\nIts " + n + " " + NAME[scope] + (n > 1 ? "s are" : " is") + " kept and moved to “No folder”." : ""))) return;
    (scope === "proto" ? Object.values(LB.D.protocols) : LB.D.items).forEach(o => { if (o.folder === f.id) o.folder = ""; });
    LB.D.folders[scope] = list(scope).filter(x => x !== f); LB.save(); LB.render();
  };
  function moveInto(scope, id, fid) {
    const o = target(scope, id); if (!o || (o.folder || "") === fid) return;
    o.folder = fid; if (fid) LB.ui.fold[key(scope, fid)] = false; LB.save(); LB.saveUI(); LB.render();
    const f = find(scope, fid); LB.toast(f ? "Moved to “" + f.name + "”." : "Taken out of its folder.");
  }
  A.setFolder = el => {   // the Folder menu (a <select> handled on change)
    const scope = el.dataset.scope, id = el.dataset.id; let v = el.value;
    if (v === "__new") { const f = create(scope); if (!f) { LB.render(); return; } v = f.id; }
    moveInto(scope, id, v);
  };

  /* ---------- drag and drop ---------- */
  let dragging = null;
  const clearOver = () => document.querySelectorAll(".drop-on").forEach(n => n.classList.remove("drop-on"));
  document.addEventListener("dragstart", ev => {
    const el = ev.target.closest && ev.target.closest("[data-drag]"); if (!el) return;
    dragging = el.dataset.drag; ev.dataTransfer.setData("text/plain", dragging); ev.dataTransfer.effectAllowed = "move";
    const row = el.closest(".item, .pitem, .trow"); if (row && el.classList.contains("dh")) ev.dataTransfer.setDragImage(row, 20, 20);
    document.body.classList.add("dragging");
  });
  document.addEventListener("dragend", () => { dragging = null; document.body.classList.remove("dragging"); clearOver(); });
  document.addEventListener("dragover", ev => {
    if (!dragging) return; const t = ev.target.closest && ev.target.closest("[data-drop]");
    if (t && t.dataset.drop.split(":")[0] === dragging.split(":")[0]) { ev.preventDefault(); clearOver(); t.classList.add("drop-on"); } else clearOver();
  });
  document.addEventListener("drop", ev => {
    const t = ev.target.closest && ev.target.closest("[data-drop]"); if (!t || !dragging) return;
    const [scope, id] = dragging.split(":"), [dscope, to] = t.dataset.drop.split(":"); if (scope !== dscope) return;
    ev.preventDefault(); clearOver(); dragging = null; document.body.classList.remove("dragging");
    if (scope === "exp") moveExperiment(id, to); else moveInto(scope, id, to);
  });

  /* ---------- experiments: move to another project ---------- */
  function moveExperiment(id, pid) {
    const x = LB.D.experiments.find(z => z.id === id), p = LB.D.projects.find(z => z.id === pid); if (!x || !p || x.projectId === pid) return;
    x.projectId = pid; LB.ui.openProj[pid] = true; LB.tmp.pop = ""; LB.save(); LB.saveUI(); LB.render(); LB.toast("“" + x.name + "” moved to " + p.name + ".");
  }
  A.moveExp = el => { LB.tmp.mv = el.dataset.id; LB.tmp.pop = "move"; LB.render(); };
  A.moveExpTo = el => moveExperiment(LB.tmp.mv, el.dataset.id);
  A.moveExpNew = () => {
    const n = name("Name of the new project:"); if (!n) return; const p = { id: U.uid(), name: n }; LB.D.projects.push(p); moveExperiment(LB.tmp.mv, p.id);
  };
  LB.moveModal = function () {
    const D = LB.D, x = D.experiments.find(z => z.id === LB.tmp.mv); if (!x) return "";
    return '<div class="backdrop" data-a="closeModal"><div class="modal"><h2>Move experiment</h2><div class="muted sm">“' + esc(x.name) + "” and all its entries move to the project you pick. Entry codes stay the same.</div>" +
      '<div class="col" style="gap:6px">' + D.projects.map(p => '<button class="btn" style="text-align:left" data-a="moveExpTo" data-id="' + p.id + '" ' + (p.id === x.projectId ? "disabled" : "") + ">📁 " + esc(p.name) + (p.id === x.projectId ? " (current)" : "") + "</button>").join("") + "</div>" +
      '<div class="row" style="justify-content:space-between"><button class="link sm" data-a="moveExpNew">＋ New project…</button><button class="btn" data-a="closeModal" data-force="1">Cancel</button></div></div></div>';
  };
})(window.LB);
