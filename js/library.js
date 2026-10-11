/* LabGorilla — References tab: every paper in one library, with folders, search, "cited in" links and .ris export.
   Papers live in D.refs (shared with entries and protocols). One added here directly (ref.lib) stays even when nothing cites it. */
(function (LB) {
  const U = LB.U, esc = U.esc, A = LB.actions;
  LB.ui.refStyle = LB.ui.refStyle || "numbered";
  Object.assign(LB.tmp, { refQ: "", refFolder: "", refSort: "added", refAdd: false });

  /* ---------- where is each paper cited ---------- */
  function citedIn(id) {
    const out = [], D = LB.D;
    Object.values(D.entries).sort((a, b) => b.date.localeCompare(a.date)).forEach(e => { if ((e.refs || []).some(x => x.id === id)) out.push({ kind: "entry", id: e.id, label: e.code, title: e.title }); });
    Object.keys(D.protocols).forEach(pid => { const p = D.protocols[pid]; if ((p.refs || []).some(x => x.id === id)) out.push({ kind: "proto", id: pid, label: p.title, title: "Protocol: " + p.title }); });
    return out;
  }

  /* ---------- filtering and sorting ---------- */
  const folderFilter = () => { const f = LB.tmp.refFolder; return f && f !== "__none" && !LB.D.folders.ref.some(x => x.id === f) ? "" : f; };
  function shown() {
    const q = (LB.tmp.refQ || "").trim().toLowerCase(), f = folderFilter(), sort = LB.tmp.refSort;
    let l = LB.D.refs.filter(r => (!q || [r.title, r.authors, r.journal, r.year, r.doi].join(" ").toLowerCase().includes(q)) && (!f || (f === "__none" ? !r.folder : r.folder === f)));
    if (sort === "added") l = l.slice().reverse();
    else if (sort === "year") l = l.slice().sort((a, b) => String(b.year).localeCompare(String(a.year)));
    else if (sort === "title") l = l.slice().sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    else if (sort === "author") l = l.slice().sort((a, b) => (a.authors || "").localeCompare(b.authors || ""));
    return l;
  }

  /* ---------- .ris export (opens in Zotero, EndNote, Mendeley, Citavi…) ---------- */
  const risName = a => { a = String(a).trim(); const m = a.match(/^(.+?)\s+([A-Z]{1,4})$/); return m ? m[1] + ", " + m[2].split("").join(".") + "." : a; };
  function ris(list) {
    return list.map(r => {
      const L = ["TY  - " + (r.journal ? "JOUR" : "GEN")];
      String(r.authors || "").split(/,\s*/).filter(Boolean).forEach(a => L.push("AU  - " + risName(a)));
      if (r.title) L.push("TI  - " + r.title);
      if (r.journal) L.push("JO  - " + r.journal);
      if (r.year) L.push("PY  - " + r.year);
      if (r.doi) { L.push("DO  - " + r.doi); L.push("UR  - https://doi.org/" + r.doi); } else if (r.url) L.push("UR  - " + r.url);
      if (r.pmid) L.push("AN  - PMID:" + r.pmid);
      L.push("ER  - ");
      return L.join("\r\n");
    }).join("\r\n") + "\r\n";
  }
  function download(name, text) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/x-research-info-systems" })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  A.risAll = () => { const l = shown(); if (!l.length) { LB.toast("There is nothing to export here."); return; } download("LabGorilla-references-" + U.today() + ".ris", ris(l)); LB.toast(l.length + (l.length === 1 ? " paper" : " papers") + " exported as .ris. Import the file in Zotero, EndNote or Mendeley."); };
  A.risOwner = el => {
    const o = el.dataset.kind === "entry" ? LB.D.entries[el.dataset.oid] : LB.D.protocols[el.dataset.oid]; if (!o) return;
    const l = (o.refs || []).map(x => LB.D.refs.find(r => r.id === x.id)).filter(Boolean); if (!l.length) return;
    download((o.code || (o.title || "protocol").replace(/[^\w\-]+/g, "_")) + "-references.ris", ris(l)); LB.toast(l.length + (l.length === 1 ? " reference" : " references") + " exported as .ris.");
  };
  A.copyCites = async () => {
    const l = shown(); if (!l.length) return;
    try { await navigator.clipboard.writeText(l.map((r, i) => "[" + (i + 1) + "] " + LB.refCite(r) + (r.doi ? " doi:" + r.doi : "")).join("\n")); LB.toast("Citations copied."); } catch (e) { LB.toast("Could not copy. Select the text and copy it manually."); }
  };

  /* ---------- .ris import (exports from Zotero, EndNote, Mendeley, PubMed, journal sites…) ---------- */
  const initials = g => g.split(/[\s.\-]+/).filter(Boolean).map(t => t[0].toUpperCase()).join("");
  const authorName = a => {   // "Smith, John K." / "John K. Smith" / "Smith JK"  ->  "Smith JK"
    a = String(a).replace(/\s+/g, " ").trim(); if (!a) return "";
    if (a.includes(",")) { const [f, ...g] = a.split(","); return (f.trim() + " " + initials(g.join(" "))).trim(); }
    const t = a.split(" "); if (t.length < 2 || t.length > 3 || /^[A-Z]{1,4}$/.test(t[t.length - 1])) return a;
    return t[t.length - 1] + " " + initials(t.slice(0, -1).join(" "));
  };
  function risToRef(r) {
    const f = r.f, pick = (...k) => { for (const t of k) if (f[t]) return f[t]; return ""; };
    const ur = (pick("UR").match(/https?:\/\/[^\s;,"<>]+/) || [""])[0];
    let doi = pick("DO", "M3").replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, "").trim();
    if (!/^10\.\d{4,9}\//.test(doi)) doi = ((ur.match(/10\.\d{4,9}\/[^\s"<>]+/) || [""])[0]).replace(/[.,;)\]]+$/, "");
    const pm = (pick("AN").match(/PMID:?\s*(\d+)/i) || ur.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i) || [])[1] || "";
    return { title: (pick("TI", "T1", "CT") || pick("BT")).replace(/\s+/g, " ").trim(), authors: r.au.map(authorName).filter(Boolean).join(", "), journal: pick("JO", "JF", "T2", "J2", "JA").replace(/\s+/g, " ").trim(),
      year: (pick("PY", "Y1", "DA").match(/\d{4}/) || [""])[0], doi, pmid: pm, url: /doi\.org/i.test(ur) || /pubmed\.ncbi/i.test(ur) ? "" : ur };
  }
  LB.parseRis = function (text) {
    const recs = []; let cur = null, last = null;
    String(text).replace(/﻿/g, "").split(/\r\n|\r|\n/).forEach(line => {
      const m = line.match(/^([A-Z][A-Z0-9])\s{1,2}-\s?(.*)$/);
      if (!m) { if (cur && last && line.trim()) cur.f[last] += " " + line.trim(); return; }   // a long value continued on the next line
      const tag = m[1], v = m[2].trim();
      if (tag === "TY") { cur = { au: [], f: { TY: v } }; last = null; return; }
      if (!cur) return;
      if (tag === "ER") { recs.push(cur); cur = null; last = null; return; }
      if (tag === "AU" || tag === "A1") { cur.au.push(v); last = null; return; }
      if (!(tag in cur.f)) cur.f[tag] = v;
      last = tag in cur.f ? tag : null;
    });
    if (cur && Object.keys(cur.f).length > 1) recs.push(cur);   // file that lacks the final ER
    const all = recs.map(risToRef);
    return { refs: all.filter(r => r.title), skipped: all.filter(r => !r.title).length };
  };
  A.risImport = async el => {
    const files = Array.from(el.files || []); try { el.value = ""; } catch (e) { }
    if (!files.length) return;
    const f = folderFilter(), folder = f && f !== "__none" ? f : "";
    let added = 0, dup = 0, skipped = 0, parsed = 0;
    for (const file of files) {
      let res; try { res = LB.parseRis(await file.text()); } catch (e) { res = { refs: [], skipped: 0 }; }
      parsed += res.refs.length; skipped += res.skipped;
      res.refs.forEach(d => { const r = LB.refAddTo(LB.libOwner, d); if (r) { added++; if (folder) r.folder = folder; } else dup++; });
    }
    if (!parsed && !skipped) { LB.toast("No references found. Is that an exported .ris file?"); return; }
    LB.save(); LB.tmp.refQ = ""; LB.render();
    LB.toast("Imported " + added + (added === 1 ? " paper" : " papers") + (folder ? " into this folder" : "") + (dup ? ". " + dup + (dup === 1 ? " was" : " were") + " already in the library" : "") + (skipped ? ". " + skipped + " skipped (no title)" : "") + ".");
  };

  /* ---------- citing a library paper from an entry or protocol ---------- */
  const ownerFor = (kind, id) => (kind === "entry" ? LB.D.entries[id] : LB.D.protocols[id]);
  LB.libPickPanel = function (kind, id, owner) {
    if (LB.tmp.lpFor !== kind + ":" + id || (owner && owner.locked)) return "";
    const D = LB.D, q = (LB.tmp.lq || "").trim().toLowerCase(), have = new Set((owner.refs || []).map(x => x.id)), at = 'data-kind="' + kind + '" data-oid="' + id + '"';
    const list = D.refs.filter(r => !q || [r.title, r.authors, r.journal, r.year].join(" ").toLowerCase().includes(q));
    return '<div class="newmat"><div class="row"><input type="text" class="grow" placeholder="Search your library: title, author, year…" aria-label="Search the library" data-b="tmp.lq" data-rin="1" value="' + esc(LB.tmp.lq || "") + '" autocomplete="off"><button class="link sm" data-a="libPickToggle" ' + at + ' style="color:var(--mute)">Close</button></div>' +
      (list.slice(0, 12).map(r => '<div class="row" style="align-items:flex-start;background:#fff;border:1px solid #e3e5ee;border-radius:8px;padding:8px 10px"><div class="grow sm">' + esc(LB.refCite(r)) + '</div><button class="btn sm" data-a="libCite" ' + at + ' data-id="' + r.id + '" ' + (have.has(r.id) ? "disabled" : "") + ">" + (have.has(r.id) ? "Added ✓" : "Add") + "</button></div>").join("") ||
        '<div class="muted sm">' + (D.refs.length ? "Nothing matches." : "Your library is empty. Add or import papers in the References tab.") + "</div>") + (list.length > 12 ? '<div class="muted sm">Showing 12 of ' + list.length + ". Type to narrow it down.</div>" : "") + "</div>";
  };
  A.libPickToggle = el => { const k = el.dataset.kind + ":" + el.dataset.oid; LB.tmp.lpFor = LB.tmp.lpFor === k ? "" : k; LB.tmp.lq = ""; if (LB.tmp.lpFor) LB.tmp.zOpen = false; LB.render(); };
  A.libCite = el => {
    const o = ownerFor(el.dataset.kind, el.dataset.oid), r = LB.D.refs.find(x => x.id === el.dataset.id); if (!o || o.locked || !r) return;
    o.refs = o.refs || []; if (o.refs.some(x => x.id === r.id)) return;
    o.refs.push({ id: r.id, note: "" }); if (o.hist) LB.log(o, "Added reference: " + (r.title || "untitled").slice(0, 60));
    LB.save(); LB.render();
  };

  /* ---------- left: folders as a filter ---------- */
  function side() {
    const D = LB.D, f = folderFilter(), fs = D.folders.ref, n = D.refs.length, none = D.refs.filter(r => !r.folder).length;
    const row = (cls, attrs, ico, name, cnt, tools) => '<div class="nrow ' + cls + '"' + attrs + ' role="button" tabindex="0"><span class="ico" aria-hidden="true">' + ico + '</span><span class="nm">' + name + '</span><span class="cnt">' + cnt + "</span>" + (tools ? '<span class="tools">' + tools + "</span>" : "") + "</div>";
    return '<aside class="plist" data-scroll="plist"><button class="btn pri" data-a="refAddToggle">＋ Add paper</button><div class="lbl" style="padding:4px 4px 0">Library</div><div class="ftree">' +
      row("proj" + (!f ? " ent on" : ""), ' data-a="refFolder" data-k=""', "📚", "All papers", n) +
      fs.map(x => row(f === x.id ? "ent on" : "", ' data-a="refFolder" data-k="' + x.id + '" data-drop="ref:' + x.id + '"', "📁", esc(x.name), D.refs.filter(r => r.folder === x.id).length,
        '<button class="x" data-a="foldRename" data-scope="ref" data-k="' + x.id + '" title="Rename folder" aria-label="Rename folder">✎</button><button class="x" data-a="foldDel" data-scope="ref" data-k="' + x.id + '" title="Delete folder (its papers are kept)" aria-label="Delete folder">🗑</button>')).join("") +
      (fs.length ? row(f === "__none" ? "ent on" : "", ' data-a="refFolder" data-k="__none" data-drop="ref:"', "📄", "No folder", none) : "") + "</div>" +
      LB.folderButton("ref") + (fs.length ? '<div class="muted sm" style="padding:4px 4px 0;line-height:1.45">Drag a paper onto a folder, or use its folder menu.</div>' : "") + "</aside>";
  }

  /* ---------- right: the papers ---------- */
  function editor(r) {
    const PR = "D.refs." + LB.D.refs.indexOf(r), i = (k, ph, v, st) => '<input type="text" aria-label="' + ph + '" placeholder="' + ph + '" data-b="' + PR + "." + k + '" value="' + esc(v) + '"' + (st ? ' style="' + st + '"' : "") + ">";
    return '<div class="item-det"><div class="muted sm">Changes here apply everywhere this paper is cited.</div>' + i("title", "Title", r.title) + i("authors", "Authors, e.g. Smith J, Doe A", r.authors) +
      '<div class="row">' + i("journal", "Journal", r.journal, "flex:1") + i("year", "Year", r.year, "width:90px") + "</div>" + '<div class="row">' + i("doi", "DOI", r.doi, "flex:1") + i("url", "Link (optional)", r.url, "flex:1") + "</div></div>";
  }
  function paper(r) {
    const cited = citedIn(r.id), links = [];
    if (r.zkey) links.push('<a href="' + esc(LB.refZlink(r)) + '"><b>Open in Zotero</b></a>');
    if (r.doi) links.push('<a href="https://doi.org/' + esc(r.doi) + '" target="_blank" rel="noopener">DOI</a>');
    if (r.pmid) links.push('<a href="https://pubmed.ncbi.nlm.nih.gov/' + esc(r.pmid) + '/" target="_blank" rel="noopener">PubMed</a>');
    if (!r.doi && /^https?:\/\//i.test(r.url)) links.push('<a href="' + esc(r.url) + '" target="_blank" rel="noopener">Open link</a>');
    return '<div class="item paper"><div class="invrow" style="align-items:flex-start">' + LB.dragHandle("ref", r.id) +
      '<div class="n"><b>' + esc(r.title || "Untitled") + '</b><div class="muted sm">' + esc(LB.refShort(r.authors)) + (r.year ? " (" + esc(r.year) + ")" : "") + (r.journal ? " · <i>" + esc(r.journal) + "</i>" : "") + "</div>" +
      (links.length ? '<div class="row wrap sm" style="gap:12px;margin-top:3px">' + links.join("") + "</div>" : "") +
      '<div class="row wrap sm" style="gap:6px;margin-top:5px"><span class="muted">' + (cited.length ? "Cited in" : "Not cited yet") + "</span>" +
      cited.slice(0, 6).map(c => '<button class="chipbtn" data-a="gopen" data-kind="' + c.kind + '" data-id="' + c.id + '" title="' + esc(c.title) + '">' + esc(c.label) + "</button>").join("") + (cited.length > 6 ? '<span class="muted">+' + (cited.length - 6) + "</span>" : "") + "</div></div>" +
      '<div class="col" style="gap:6px;align-items:flex-end;flex-shrink:0">' + (LB.D.folders.ref.length ? LB.folderSelect("ref", r, r.id, true) : "") +
      '<div class="row" style="gap:6px"><button class="btn sm" data-a="refEdit" data-id="' + r.id + '">' + (LB.tmp.refEdit === r.id ? "Close" : "Edit") + '</button><button class="btn sm" style="color:#b42318" data-a="libDelete" data-id="' + r.id + '" title="Delete from the library">Delete</button></div></div></div>' +
      (LB.tmp.refEdit === r.id ? editor(r) : "") + "</div>";
  }
  function page() {
    const D = LB.D, list = shown(), f = folderFilter(), fn = f === "__none" ? "No folder" : f ? (D.folders.ref.find(x => x.id === f) || {}).name : "All papers";
    return '<div class="page" data-scroll="page" data-dz="risImport"><div class="row wrap"><h1 class="grow" style="margin:0;font-size:26px;letter-spacing:-.01em">References <span class="muted" style="font-size:15px;font-weight:500">· ' + esc(fn) + "</span></h1>" +
      '<input type="text" placeholder="Search papers…" aria-label="Search papers" data-b="tmp.refQ" data-rin="1" value="' + esc(LB.tmp.refQ) + '" style="width:220px" autocomplete="off">' +
      '<select aria-label="Sort" data-b="tmp.refSort" data-render="1"><option value="added"' + (LB.tmp.refSort === "added" ? " selected" : "") + '>Newest added</option><option value="year"' + (LB.tmp.refSort === "year" ? " selected" : "") + '>Year</option><option value="title"' + (LB.tmp.refSort === "title" ? " selected" : "") + '>Title</option><option value="author"' + (LB.tmp.refSort === "author" ? " selected" : "") + ">Author</option></select></div>" +
      '<div class="row wrap" style="gap:10px"><span class="muted sm">' + list.length + (list.length === 1 ? " paper" : " papers") + (list.length !== D.refs.length ? " of " + D.refs.length : "") + '</span><span class="grow"></span><label class="btn sm" style="cursor:pointer" title="Add papers from a .ris file exported by Zotero, EndNote, Mendeley or PubMed. You can also drop the file anywhere on this page.">⬆ Import .ris<input type="file" accept=".ris,.txt,text/plain,application/x-research-info-systems" multiple data-file="risImport" hidden></label><button class="btn sm" data-a="risAll" title="Download these papers to import into Zotero, EndNote or Mendeley">⬇ Export .ris (' + list.length + ')</button><button class="btn sm" data-a="copyCites">Copy citations</button></div>' +
      (LB.tmp.refAdd ? '<div class="newmat"><div class="row"><b class="grow">Add a paper to your library</b><button class="link sm" data-a="refAddToggle" style="color:var(--mute)">Close</button></div>' + LB.refsAddBar("lib", "main", LB.libOwner) + "</div>" : "") +
      (list.map(paper).join("") || '<div class="empty"><div class="h" style="font-size:20px">' + (D.refs.length ? "Nothing matches" : "No papers yet") + "</div><div>" + (D.refs.length ? "Try another folder or search." : "Add a paper by DOI, PubMed ID, link or from Zotero. Papers you cite in an entry or protocol appear here too.") + '</div><button class="btn pri" data-a="refAddToggle">＋ Add paper</button></div>') + "</div>";
  }
  LB.views.references = () => side() + page();

  /* ---------- actions ---------- */
  A.refFolder = (el, ev) => { if (ev.target.closest(".tools")) return; LB.tmp.refFolder = el.dataset.k; LB.render(); };
  A.refAddToggle = () => { LB.tmp.refAdd = !LB.tmp.refAdd; if (LB.tmp.refAdd) { LB.tmp.zOpen = false; } LB.render(); };
  A.libDelete = el => {
    const D = LB.D, r = D.refs.find(x => x.id === el.dataset.id); if (!r) return; const c = citedIn(r.id);
    if (!confirm("Delete “" + (r.title || "this paper").slice(0, 80) + "” from the library?" + (c.length ? "\n\nIt is cited in " + c.length + (c.length === 1 ? " place" : " places") + " and is removed from " + (c.length === 1 ? "it" : "them") + " too." : ""))) return;
    Object.values(D.entries).forEach(e => { e.refs = (e.refs || []).filter(x => x.id !== r.id); }); Object.values(D.protocols).forEach(p => { p.refs = (p.refs || []).filter(x => x.id !== r.id); });
    D.refs = D.refs.filter(x => x !== r); LB.save(); LB.render();
  };
})(window.LB);
