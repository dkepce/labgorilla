/* LabGorilla — pieces shared by Notebook and Inventory: attachments, material details, new-material form. */
(function (LB) {
  const U = LB.U, esc = U.esc, A = LB.actions;

  /* ---------- attachments grid ---------- */
  function ext(n) { const m = /\.([A-Za-z0-9]+)$/.exec(n); return m ? m[1].toUpperCase() : "FILE"; }
  function fileCard(r, o) {
    const thumb = LB.isImage(r)
      ? '<button class="fthumb" data-a="openFile" data-fid="' + r.id + '" title="Open"><img data-fid="' + r.id + '" alt="' + esc(r.name) + '"></button>'
      : '<button class="fthumb" data-a="openFile" data-fid="' + r.id + '" title="Open">' + ext(r.name) + "</button>";
    return '<div class="fcard"' + (o.mini ? ' style="width:150px"' : "") + ">" + thumb +
      '<div class="fmeta"><span title="' + esc(r.name) + '">' + esc(r.name) + '</span><span class="muted" style="flex-grow:0">' + U.size(r.size || 0) + "</span>" +
      (o.dis ? "" : '<button class="x" data-a="rmFile" data-owner="' + o.owner + '" data-fid="' + r.id + '" aria-label="Remove file">×</button>') + "</div></div>";
  }
  LB.filesGrid = function (refs, o) {
    return '<div class="fgrid">' + refs.map(r => fileCard(r, o)).join("") +
      (o.dis ? "" : '<label class="drop' + (o.mini ? " mini" : "") + '" data-dz="' + o.act + '" data-id="' + o.id + '">+ add image, PDF<br>or data file<input type="file" multiple data-file="' + o.act + '" data-id="' + o.id + '" hidden></label>') + "</div>";
  };
  async function addFiles(el, list, after) {
    const files = Array.from(el.files || []); el.value = "";
    let n = 0;
    for (const f of files) { const r = await LB.fileAdd(f); if (r) { list.push(r); n++; } }
    if (n) { after(n); LB.save(); LB.render(); }
  }
  A.addEntryFiles = el => {
    const e = LB.D.entries[el.dataset.id]; if (!e || e.locked) return;
    return addFiles(el, e.files, n => LB.log(e, "Attached " + n + " file" + (n > 1 ? "s" : "")));
  };
  A.addItemDocs = el => {
    const it = LB.D.items.find(x => x.id === el.dataset.id); if (!it) return;
    return addFiles(el, it.docs, () => { });
  };
  A.openFile = async el => {
    const r = LB.refById(el.dataset.fid); if (!r) return;
    const u = await LB.fileUrl(r);
    if (!u) { LB.toast("This file could not be found. If the lab book folder is not reconnected, reconnect it first."); return; }
    window.open(u, "_blank");
  };
  A.rmFile = async el => {
    const [t, id] = el.dataset.owner.split(":");
    const owner = t === "e" ? LB.D.entries[id] : LB.D.items.find(x => x.id === id); if (!owner) return;
    const list = t === "e" ? owner.files : owner.docs, i = list.findIndex(r => r.id === el.dataset.fid); if (i < 0) return;
    if (!confirm("Remove “" + list[i].name + "”? The file itself is deleted too.")) return;
    const [r] = list.splice(i, 1); if (t === "e") LB.log(owner, "Removed file " + r.name);
    await LB.fileRemove(r); LB.save(); LB.render();
  };

  /* ---------- expiry: state of a material today (ok / soon / expired) ---------- */
  LB.expiry = function (it) {
    if (!it.expires) return null;
    const d = U.daysBetween(U.today(), it.expires), w = LB.S.warnDays == null ? 30 : LB.S.warnDays;
    const state = d < 0 ? "expired" : d <= w ? "soon" : "ok";
    const txt = d < 0 ? "Expired " + (d === -1 ? "yesterday" : -d + " days ago") : d === 0 ? "Expires today" : d === 1 ? "Expires tomorrow" : state === "soon" ? "Expires in " + d + " days" : "Expires " + U.fmt(it.expires);
    return { d, state, txt };
  };
  LB.expBadge = function (it) {
    const x = LB.expiry(it); if (!x) return "";
    return '<span class="exp ' + x.state + '" title="Expiry date: ' + U.fmt(it.expires) + '">' + (x.state === "expired" ? "⚠ " : x.state === "soon" ? "⏳ " : "") + x.txt + "</span>";
  };
  /* used on an entry: was the material already past its date on the day of the experiment? */
  LB.expiredOn = (it, day) => !!(it.expires && day && it.expires < day);

  /* ---------- material details (suppliers, prices, documents) ---------- */
  LB.itemDetails = function (it) {
    const i = LB.D.items.indexOf(it), P = "D.items." + i;
    return '<div class="item-det">' +
      '<div class="row wrap"><label class="grow" style="min-width:160px"><span class="lbl">Name</span><br><input type="text" style="width:100%" data-b="' + P + '.name" value="' + esc(it.name) + '"></label>' +
      '<label><span class="lbl">Type</span><br><select data-b="' + P + '.kind" data-render="1">' + LB.D.types.map(t => '<option' + (t === it.kind ? " selected" : "") + ">" + esc(t) + "</option>").join("") + "</select></label>" +
      '<label><span class="lbl">Expires</span><br><input type="date" aria-label="Expiry date" data-b="' + P + '.expires" data-render="1" value="' + esc(it.expires) + '"></label>' +
      '<div style="align-self:flex-end;padding-bottom:6px">' + LB.expBadge(it) + "</div></div>" +
      '<label><span class="lbl">Details (lot, passage, storage place…)</span><br><input type="text" style="width:100%" data-b="' + P + '.sub" value="' + esc(it.sub) + '"></label>' +
      '<div class="lbl" style="margin-top:4px">Suppliers &amp; prices (optional)</div>' +
      (it.firms.length ? it.firms.map((f, j) => '<div class="firm"><input type="text" aria-label="Firm" placeholder="Firm" data-b="' + P + ".firms." + j + '.name" value="' + esc(f.name) + '"><input type="text" aria-label="Price" placeholder="Price, e.g. € 148 / 100 mg" data-b="' + P + ".firms." + j + '.price" value="' + esc(f.price) + '"><input type="text" aria-label="Order link" placeholder="Link to order page" data-b="' + P + ".firms." + j + '.link" value="' + esc(f.link) + '">' +
        (/^https?:\/\//i.test(f.link) ? '<a href="' + esc(f.link) + '" target="_blank" rel="noopener" class="sm"><b>Open</b></a>' : "<span></span>") +
        '<button class="x" data-a="rmFirm" data-i="' + i + '" data-j="' + j + '" aria-label="Remove firm">×</button></div>').join("") : '<div class="muted sm">No suppliers yet.</div>') +
      '<button class="link" data-a="addFirm" data-i="' + i + '">+ Add firm</button>' +
      '<div class="lbl" style="margin-top:4px">Documents (datasheets, quotes, orders)</div>' +
      LB.filesGrid(it.docs, { act: "addItemDocs", id: it.id, owner: "i:" + it.id, mini: true }) +
      '<div class="row" style="margin-top:6px"><span class="grow"></span><button class="btn sm" style="color:#b42318" data-a="delItem" data-i="' + i + '">Delete this item</button></div></div>';
  };
  A.addFirm = el => { LB.D.items[+el.dataset.i].firms.push({ name: "", price: "", link: "" }); LB.save(); LB.render(); };
  A.rmFirm = el => { LB.D.items[+el.dataset.i].firms.splice(+el.dataset.j, 1); LB.save(); LB.render(); };
  A.toggleItem = el => { LB.tmp.openItem = LB.tmp.openItem === el.dataset.id ? "" : el.dataset.id; LB.render(); };
  A.delItem = async el => {
    const it = LB.D.items[+el.dataset.i]; if (!it) return;
    if (!confirm("Delete “" + it.name + "” from the inventory? It is also removed from entries and protocols that use it.")) return;
    for (const d of it.docs) await LB.fileRemove(d);
    Object.values(LB.D.entries).forEach(e => { e.mats = e.mats.filter(m => m.id !== it.id); });
    Object.values(LB.D.protocols).forEach(p => { p.mats = p.mats.filter(m => m !== it.id); });
    LB.D.items.splice(+el.dataset.i, 1); LB.tmp.openItem = ""; LB.save(); LB.render();
  };

  /* ---------- new material form ---------- */
  LB.newMatForm = function (mode) {
    const nm = LB.tmp.newMat;
    return '<div class="newmat"><div class="row" style="gap:10px;align-items:stretch">' +
      '<input type="text" class="grow" style="flex:2" aria-label="Material name" placeholder="Name, e.g. MDA-MB-231" data-b="tmp.newMat.name" data-enter="addMat" data-mode="' + mode + '" value="' + esc(nm.name) + '" autocomplete="off">' +
      '<select style="flex:1" aria-label="Type" data-b="tmp.newMat.kind" data-render="1">' + LB.D.types.map(t => '<option' + (nm.kind === t ? " selected" : "") + ">" + esc(t) + "</option>").join("") + '<option value="__new"' + (nm.kind === "__new" ? " selected" : "") + ">+ New type…</option></select>" +
      (nm.kind === "__new" ? '<input type="text" style="flex:1;border-color:var(--acc)" aria-label="New type name" placeholder="New type, e.g. plasmid" data-b="tmp.newMat.newKind" value="' + esc(nm.newKind) + '">' : "") + "</div>" +
      '<div class="row" style="gap:10px"><input type="text" class="grow" aria-label="Details" placeholder="Details: lot, passage, storage location…" data-b="tmp.newMat.sub" data-enter="addMat" data-mode="' + mode + '" value="' + esc(nm.sub) + '">' +
      '<label class="row sm" style="gap:6px;white-space:nowrap">Expires <input type="date" aria-label="Expiry date (optional)" data-b="tmp.newMat.expires" value="' + esc(nm.expires) + '"></label></div>' +
      '<div class="row"><button class="btn pri" data-a="addMat" data-mode="' + mode + '">' + (mode === "entry" ? "Add to inventory and link" : "Add to inventory") + '</button><button class="link" data-a="toggleNewMat" style="color:var(--mute)">Cancel</button></div></div>';
  };
  A.toggleNewMat = () => { LB.tmp.showNewMat = !LB.tmp.showNewMat; LB.tmp.newMat = { name: "", kind: LB.D.types[1] || LB.D.types[0] || "reagent", newKind: "", sub: "", expires: "" }; LB.render(); };
  A.addMat = el => {
    const nm = LB.tmp.newMat, kind = nm.kind === "__new" ? nm.newKind.trim() : nm.kind;
    if (!nm.name.trim()) { LB.toast("Please give the material a name."); return; }
    if (!kind) { LB.toast("Please name the new type."); return; }
    const mode = el.dataset.mode, e = mode === "entry" ? LB.cur() : null;
    if (e && e.locked) return;
    const it = { id: U.uid(), name: nm.name.trim(), kind, sub: nm.sub.trim(), expires: nm.expires || "", stock: "", reorder: false, firms: [], docs: [] };
    LB.D.items.push(it); if (!LB.D.types.includes(kind)) LB.D.types.push(kind);
    if (e) { e.mats.push({ id: it.id, used: "", left: "", unit: "" }); LB.log(e, "Added " + it.name + " to inventory and linked it"); }
    LB.tmp.showNewMat = false; LB.tmp.openItem = it.id; LB.save(); LB.render();
    LB.toast(LB.expiredOn(it, e ? e.date : U.today()) ? "⚠ " + it.name + " is already past its expiry date (" + U.fmt(it.expires) + ")." : it.name + (e ? " added to the inventory and linked" : " added to the inventory"));
  };
})(window.LB);
