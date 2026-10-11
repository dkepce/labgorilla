/* LabGorilla — Protocols view. */
(function (LB) {
  const U = LB.U, esc = U.esc, A = LB.actions;

  const curId = () => {
    const D = LB.D; if (D.protocols[LB.tmp.protoCur]) return LB.tmp.protoCur;
    return (LB.tmp.protoCur = Object.keys(D.protocols).sort((a, b) => D.protocols[a].title.localeCompare(D.protocols[b].title))[0] || "");
  };
  const usedBy = id => Object.values(LB.D.entries).filter(e => e.protocol && e.protocol.id === id);

  function list() {
    const D = LB.D, q = (LB.tmp.protoQ || "").trim().toLowerCase(), cur = curId();
    const ids = Object.keys(D.protocols).filter(id => (D.protocols[id].title + " " + D.protocols[id].desc).toLowerCase().includes(q)).sort((a, b) => D.protocols[a].title.localeCompare(D.protocols[b].title));
    return '<aside class="plist" data-scroll="plist"><input type="text" placeholder="Search protocols…" aria-label="Search protocols" data-b="tmp.protoQ" data-rin="1" value="' + esc(LB.tmp.protoQ) + '" autocomplete="off">' +
      LB.grouped("proto", ids, id => { const p = D.protocols[id]; return '<button class="pitem' + (id === cur ? " on" : "") + '" data-a="protoPick" data-id="' + id + '"' + LB.dragAttrs("proto", id) + '><b>' + esc(p.title) + '</b><span class="muted sm">v' + p.ver + " · " + p.steps.length + " steps · used in " + usedBy(id).length + "</span></button>"; }, !q, id => D.protocols[id].folder || "") +
      (ids.length ? "" : '<div class="muted sm">No protocols found.</div>') +
      '<button class="btn" style="border-style:dashed;color:var(--acc-d)" data-a="newProto">+ New protocol</button>' + LB.folderButton("proto") + "</aside>";
  }
  function page() {
    const D = LB.D, id = curId(), p = D.protocols[id];
    if (!p) return '<div class="page"><div class="empty"><div class="h" style="font-size:20px">No protocols yet</div><div>Write a protocol once, then start experiments from it whenever you need it.</div><button class="btn pri" data-a="newProto">+ New protocol</button></div></div>';
    const P = "D.protocols." + id, used = usedBy(id);
    return '<div class="page" data-scroll="page"><div class="row"><input type="text" class="etitle grow" aria-label="Protocol title" data-b="' + P + '.title" data-live="' + P + '.title" value="' + esc(p.title) + '" autocomplete="off"><span class="badge acc mono">v' + p.ver + '</span>' + LB.folderSelect("proto", p, id) +
      '<button class="btn" data-a="protoSave">Save as new version</button><button class="btn pri" data-a="protoStart">Start experiment from this</button></div>' +
      '<div class="card"><h3>Description</h3><textarea rows="2" aria-label="Description" placeholder="What is this protocol for?" data-b="' + P + '.desc">' + esc(p.desc) + "</textarea></div>" +
      '<div class="card"><h3>Steps</h3>' + p.steps.map((s, i) => '<div class="row" style="gap:8px"><span class="snum">' + (i + 1) + '</span><input type="text" class="grow" aria-label="Step ' + (i + 1) + '" data-b="' + P + ".steps." + i + '" value="' + esc(s) + '" autocomplete="off"><button class="x" data-a="protoUp" data-i="' + i + '" aria-label="Move up">↑</button><button class="x" data-a="protoDown" data-i="' + i + '" aria-label="Move down">↓</button><button class="x" data-a="protoRm" data-i="' + i + '" aria-label="Remove step">×</button></div>').join("") +
      '<input type="text" placeholder="+ Add a step and press Enter" aria-label="Add a step" data-b="tmp.newPStep" data-enter="protoAdd" value="' + esc(LB.tmp.newPStep || "") + '" autocomplete="off" style="border-width:0;border-top:1px solid var(--line2);border-radius:0;padding:10px 2px 2px"></div>' +
      '<div class="card"><h3>Materials needed</h3><div class="muted sm">They are linked automatically when you start an experiment from this protocol.</div><div class="row wrap">' +
      (D.items.map(it => { const on = p.mats.includes(it.id); return '<label class="mchip' + (on ? " on" : "") + '"><input type="checkbox" data-a="protoMat" data-id="' + it.id + '" ' + (on ? "checked" : "") + ' style="accent-color:var(--acc);margin:0">' + esc(it.name) + '<span class="kind">' + esc(it.kind) + "</span></label>"; }).join("") || '<span class="muted sm">Add items in the Inventory tab first.</span>') + "</div></div>" +
      LB.refsCard("proto", p, id) + '<div class="card"><h3>Version history</h3>' + p.history.map(h => '<div class="row sm" style="align-items:baseline"><span class="mono" style="color:var(--acc-d);width:34px">v' + h.v + "</span><span>" + esc(h.note) + "</span></div>").join("") + '<div class="muted sm">Entries started from an older version keep the steps they were started with.</div></div>' +
      '<div class="card"><h3>Used in</h3>' + (used.length ? used.sort((a, b) => b.date.localeCompare(a.date)).map(e => '<div class="row sm"><button class="link sm" data-a="gopen" data-kind="entry" data-id="' + e.id + '">' + esc(e.code + " · " + e.title) + '</button><span class="muted">' + U.fmt(e.date) + " · v" + e.protocol.ver + "</span></div>").join("") : '<div class="muted sm">No entries yet.</div>') + "</div>" +
      '<div class="row"><button class="link sm" data-a="protoDup">Duplicate this protocol</button><button class="link sm" style="color:#b42318" data-a="protoDel">Delete this protocol</button></div></div>';
  }
  LB.views.protocols = () => list() + page();

  const P = () => LB.D.protocols[curId()];
  A.protoPick = el => { LB.tmp.protoCur = el.dataset.id; LB.tmp.newPStep = ""; LB.render(); };
  A.newProto = () => {
    const id = U.uid(); LB.D.protocols[id] = { title: "New protocol", ver: 1, desc: "", steps: [], mats: [], history: [{ v: 1, note: "Created", at: Date.now() }] };
    LB.tmp.protoCur = id; LB.tmp.protoQ = ""; LB.go("protocols"); LB.save();
  };
  A.protoAdd = el => { const v = el.value.trim(); if (!v) return; P().steps.push(v); LB.tmp.newPStep = ""; LB.save(); LB.render(); };
  A.protoRm = el => { P().steps.splice(+el.dataset.i, 1); LB.save(); LB.render(); };
  const mv = (i, d) => { const a = P().steps, j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; LB.save(); LB.render(); };
  A.protoUp = el => mv(+el.dataset.i, -1);
  A.protoDown = el => mv(+el.dataset.i, 1);
  A.protoMat = el => { const p = P(), id = el.dataset.id; p.mats = p.mats.includes(id) ? p.mats.filter(x => x !== id) : [...p.mats, id]; LB.save(); LB.render(); };
  A.protoSave = () => {
    const p = P(), n = prompt("What changed in this version? (optional)", "");
    if (n === null) return; p.ver += 1; p.history.unshift({ v: p.ver, note: n.trim() || "Saved " + U.fmt(U.today(), true), at: Date.now() });
    LB.save(); LB.render(); LB.toast("Saved as v" + p.ver);
  };
  A.protoStart = () => { LB.tmp.nwProto = curId(); A.newEntry(); };
  A.protoDup = () => {
    const p = P(), id = U.uid(); LB.D.protocols[id] = { ...JSON.parse(JSON.stringify(p)), title: p.title + " (copy)", ver: 1, history: [{ v: 1, note: "Copied from " + p.title, at: Date.now() }] };
    LB.tmp.protoCur = id; LB.save(); LB.render();
  };
  A.protoDel = () => {
    const id = curId(), p = P(); if (!confirm("Delete the protocol “" + p.title + "”? Entries that were started from it keep their steps.")) return;
    delete LB.D.protocols[id]; LB.tmp.protoCur = ""; LB.save(); LB.render();
  };
})(window.LB);
