/* LabGorilla — Thesis tab. Link the thesis .docx and LabGorilla reads its headings and word counts (it never changes the file).
   The chapters can be given a status and linked to the entries, protocols and papers that belong to them.
   A linked file is remembered with the File System Access API (like the lab book folder); only the outline is stored in the .lbk. */
(function (LB) {
  const U = LB.U, esc = U.esc, A = LB.actions;
  const FS = !!window.showOpenFilePicker;
  const MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const STATUS = ["Not started", "Drafting", "Revising", "Done"];
  let handle = null, hstate = FS ? "none" : "unsupported", busy = false;   // none | needs | ok | missing | unsupported
  Object.assign(LB.tmp, { thOpen: "", thq: "", thNew: "", thMsg: "" });
  LB.ui.thesisDepth = LB.ui.thesisDepth || 2;

  const baseFix = LB.fixData;
  LB.fixData = function () {
    baseFix(); const D = LB.D; D.thesis = D.thesis || {}; const T = D.thesis;
    T.title = T.title || ""; T.path = T.path || ""; T.file = T.file || null; T.manual = T.manual || []; T.ch = T.ch || {};
    Object.values(T.ch).forEach(c => { c.items = c.items || []; c.status = c.status || ""; c.note = c.note || ""; });
  };

  /* ---------- reading a .docx (a zip of XML files) ---------- */
  async function inflate(bytes) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()); }
  async function unzip(buf, names) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf), out = {}; let e = u8.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error("This does not look like a Word .docx file.");
    const count = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    for (let i = 0; i < count && dv.getUint32(p, true) === 0x02014b50; i++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      if (names.includes(name)) { const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true), data = u8.subarray(start, start + csize); out[name] = method === 0 ? data : method === 8 ? await inflate(data) : null; }
    }
    return out;
  }
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const kid = (el, n) => (el ? Array.from(el.children).find(c => c.localName === n) : null);
  const wval = el => (el ? el.getAttributeNS(W, "val") || el.getAttribute("w:val") || "" : "");
  function levelOf(styles, id, outline) {
    if (outline != null && outline < 9) return outline + 1;
    let s = styles[id], hops = 0;
    while (s && hops++ < 6) { const m = /^heading (\d)$/i.exec(s.name); if (m) return +m[1]; if (s.outline != null && s.outline < 9) return s.outline + 1; s = styles[s.basedOn]; }
    return 0;
  }
  async function readDocx(file) {
    const z = await unzip(await file.arrayBuffer(), ["word/document.xml", "word/styles.xml", "word/comments.xml", "docProps/core.xml"]);
    if (!z["word/document.xml"]) throw new Error("This does not look like a Word .docx file.");
    const dec = new TextDecoder("utf-8"), xml = n => (z[n] ? new DOMParser().parseFromString(dec.decode(z[n]), "application/xml") : null);
    const doc = xml("word/document.xml"); if (!doc || doc.getElementsByTagName("parsererror").length) throw new Error("The document could not be read.");
    const styles = {}, sx = xml("word/styles.xml");
    if (sx) for (const st of sx.getElementsByTagNameNS(W, "style")) { const ol = kid(st, "pPr") && kid(kid(st, "pPr"), "outlineLvl"); styles[st.getAttributeNS(W, "styleId")] = { name: wval(kid(st, "name")), basedOn: wval(kid(st, "basedOn")), outline: ol ? +wval(ol) : null }; }
    const items = []; let total = 0;
    for (const p of doc.getElementsByTagNameNS(W, "p")) {
      let text = ""; for (const n of p.getElementsByTagNameNS(W, "*")) { if (n.localName === "t") text += n.textContent; else if (n.localName === "tab") text += " "; }
      const pPr = kid(p, "pPr"), ol = pPr && kid(pPr, "outlineLvl"), lvl = levelOf(styles, wval(pPr && kid(pPr, "pStyle")), ol ? +wval(ol) : null), words = text.trim() ? text.trim().split(/\s+/).length : 0;
      total += words;
      if (lvl > 0 && text.trim() && items.length < 600) items.push({ lvl: Math.min(lvl, 9), text: text.replace(/\s+/g, " ").trim().slice(0, 160), own: 0 }); else if (items.length) items[items.length - 1].own += words;
    }
    items.forEach((h, i) => { h.total = h.own; for (let j = i + 1; j < items.length && items[j].lvl > h.lvl; j++) h.total += items[j].own; });
    const core = z["docProps/core.xml"] ? dec.decode(z["docProps/core.xml"]) : "", cm = xml("word/comments.xml");
    return { words: total, comments: cm ? cm.getElementsByTagNameNS(W, "comment").length : 0, author: ((core.match(/<dc:creator>([^<]*)</) || [])[1] || "").trim(), outline: items.map(h => ({ lvl: h.lvl, text: h.text, words: h.total })) };
  }

  /* ---------- the linked file ---------- */
  async function permOk(ask) { if (!handle) return false; try { const o = { mode: "read" }; if ((await handle.queryPermission(o)) === "granted") return true; return !!ask && (await handle.requestPermission(o)) === "granted"; } catch (e) { return false; } }
  async function refresh(force, ask) {
    if (!handle || busy) return; busy = true; LB.tmp.thMsg = "";
    try {
      if (!(await permOk(ask))) { hstate = "needs"; return; }
      hstate = "ok"; const file = await handle.getFile(), T = LB.D.thesis;
      if (!force && T.file && T.file.modified === file.lastModified && T.file.name === file.name) return;
      const info = await readDocx(file); T.file = Object.assign({ name: file.name, size: file.size, modified: file.lastModified, at: Date.now(), live: true }, info); LB.save();
    } catch (e) { if (e.name === "NotFoundError") { hstate = "missing"; LB.tmp.thMsg = "The linked file could not be found. It may have been moved or renamed."; } else LB.tmp.thMsg = e.message || "Could not read the file."; }
    finally { busy = false; if (LB.ui.view === "thesis") LB.render(); }
  }
  (async function init() {
    if (!FS) return; try { handle = (await LB.idbGet("kv", "thesisFile")) || null; } catch (e) { handle = null; }
    if (handle) { hstate = "needs"; await refresh(false, false); }
  })();
  document.addEventListener("visibilitychange", () => { if (!document.hidden && handle) refresh(false, false); });
  const goBase = LB.go; LB.go = function (view) { goBase.apply(this, arguments); if (view === "thesis" && handle) refresh(false, false); };

  A.thesisLink = async () => {
    if (!FS) { const i = document.getElementById("thesisFileInput"); if (i) i.click(); return; }
    try {
      const [h] = await showOpenFilePicker({ id: "thesis", multiple: false, types: [{ description: "Word document", accept: { [MIME]: [".docx"] } }] });
      handle = h; hstate = "ok"; await LB.idbSet("kv", "thesisFile", h); await refresh(true, true); LB.toast("Linked " + h.name + ".");
    } catch (e) { if (e.name !== "AbortError") LB.toast("That did not work: " + e.message); }
  };
  A.thesisPick = async el => {   // browsers without live links: read the file once
    const f = el.files && el.files[0]; try { el.value = ""; } catch (e) { } if (!f) return;
    try { const info = await readDocx(f); LB.D.thesis.file = Object.assign({ name: f.name, size: f.size, modified: f.lastModified, at: Date.now(), live: false }, info); LB.save(); LB.render(); LB.toast("Read " + f.name + "."); } catch (e) { LB.toast(e.message || "Could not read that file."); }
  };
  A.thesisRefresh = () => refresh(true, true);
  A.thesisUnlink = async () => {
    if (!confirm("Unlink the Word file?\n\nThe chapter list, statuses and links stay. LabGorilla simply stops reading the file.")) return;
    handle = null; hstate = FS ? "none" : "unsupported"; try { await LB.idbDel("kv", "thesisFile"); } catch (e) { }
    LB.tmp.thMsg = ""; if (LB.D.thesis.file) LB.D.thesis.file.live = false; LB.save(); LB.render();
  };

  /* ---------- chapters ---------- */
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return "c" + (h >>> 0).toString(36); };
  function chapterKeys() {   // every heading of the document, with a stable key (a repeated heading text gets its own number)
    const T = LB.D.thesis, seen = {}; return (T.file ? T.file.outline : []).map(h => { const base = h.lvl + ":" + h.text.toLowerCase(); seen[base] = (seen[base] || 0) + 1; return { key: hash(base + ":" + seen[base]), text: h.text, lvl: h.lvl, words: h.words, doc: true }; });
  }
  function chapters() {
    const T = LB.D.thesis, depth = LB.ui.thesisDepth || 2, out = chapterKeys().filter(c => c.lvl <= depth);
    T.manual.forEach(m => out.push({ key: "m" + m.id, text: m.text, lvl: 1, words: null, doc: false, manual: m.id }));
    out.forEach(c => { const x = T.ch[c.key] || (T.ch[c.key] = { text: c.text, lvl: c.lvl, status: "", note: "", items: [] }); x.text = c.text; x.lvl = c.lvl; });
    return out;
  }
  LB.thesisFor = (kind, id) => { const T = LB.D.thesis; return T ? Object.values(T.ch).filter(c => c.items.some(x => x.kind === kind && x.id === id)).map(c => c.text) : []; };
  function itemLabel(x) {
    const D = LB.D;
    if (x.kind === "entry") { const e = D.entries[x.id]; return e ? e.code + " · " + e.title : "(deleted entry)"; }
    if (x.kind === "proto") { const p = D.protocols[x.id]; return p ? "Protocol: " + p.title : "(deleted protocol)"; }
    const r = D.refs.find(z => z.id === x.id); return r ? (LB.refShort(r.authors) || "Paper") + (r.year ? " " + r.year : "") + " · " + (r.title || "").slice(0, 40) : "(deleted paper)";
  }
  function candidates(q) {
    const D = LB.D, out = [];
    Object.values(D.entries).sort((a, b) => b.date.localeCompare(a.date)).forEach(e => out.push({ kind: "entry", id: e.id, label: e.code, text: e.title, hay: e.code + " " + e.title + " " + e.aim }));
    Object.keys(D.protocols).forEach(id => out.push({ kind: "proto", id, label: "Protocol", text: D.protocols[id].title, hay: D.protocols[id].title }));
    D.refs.forEach(r => out.push({ kind: "ref", id: r.id, label: "Paper", text: (r.title || "Untitled") + (r.year ? " (" + r.year + ")" : ""), hay: [r.title, r.authors, r.journal, r.year].join(" ") }));
    return out.filter(c => !q || c.hay.toLowerCase().includes(q)).slice(0, 8);
  }

  /* ---------- the page ---------- */
  const fdate = ms => U.fmt(U.key(new Date(ms)), true) + ", " + U.timeStr(ms);
  function docCard(T) {
    const f = T.file, live = FS && hstate === "ok" && !!handle;
    if (!f) return '<div class="card thdrop"><div class="h" style="font-size:18px">Link your thesis</div><div class="muted" style="max-width:560px;line-height:1.55">Choose your thesis Word file (.docx). LabGorilla reads its <b>headings and word counts</b> to build your chapter list. It never changes the file and does not keep a copy; only the outline is stored.</div>' +
      '<div class="row wrap"><button class="btn pri" data-a="thesisLink">Link .docx file…</button>' + (FS ? "" : '<span class="muted sm">This browser cannot keep a live link, so the file is read once. Choose it again to update.</span>') + "</div>" + (LB.tmp.thMsg ? '<div class="warnbox">' + esc(LB.tmp.thMsg) + "</div>" : "") + '<div class="muted sm">No Word file yet? You can add chapters by hand below.</div></div>';
    const badge = live ? '<span class="badge ok">Live link ✓</span>' : hstate === "needs" ? '<span class="badge">Permission needed</span>' : hstate === "missing" ? '<span class="badge">File not found</span>' : '<span class="badge acc">Snapshot</span>';
    return '<div class="card"><div class="row wrap" style="gap:10px"><span class="cicon" style="width:34px;height:34px;border-radius:9px;background:var(--acc-s);color:var(--acc-d);display:flex;align-items:center;justify-content:center;font-weight:800">W</span><div class="grow" style="min-width:0"><b style="font-size:16px">' + esc(f.name) + "</b><div class=\"muted sm\">" + U.size(f.size || 0) + " · last saved " + fdate(f.modified) + (f.author ? " · " + esc(f.author) : "") + "</div></div>" + badge + "</div>" +
      '<div class="row wrap" style="gap:18px"><div><b style="font-size:22px">' + (f.words || 0).toLocaleString() + '</b> <span class="muted sm">words</span></div><div><b style="font-size:22px">' + f.outline.length + '</b> <span class="muted sm">headings</span></div><div><b style="font-size:22px">' + (f.comments || 0) + '</b> <span class="muted sm">Word comments</span></div></div>' +
      (LB.tmp.thMsg ? '<div class="warnbox">' + esc(LB.tmp.thMsg) + "</div>" : "") +
      (live ? '<div class="muted sm">Updates by itself when you come back to this window after saving in Word.</div>' : hstate === "needs" ? '<div class="warnbox">The browser needs your permission again to read this file.</div>' : !f.live ? '<div class="muted sm">This is a snapshot from ' + fdate(f.at) + ". Choose the file again to update it.</div>" : "") +
      '<div class="row wrap">' + (hstate === "needs" ? '<button class="btn pri sm" data-a="thesisRefresh">Reconnect</button>' : "") + (live ? '<button class="btn sm" data-a="thesisRefresh">Refresh now</button>' : "") +
      (FS ? '<button class="btn sm" data-a="thesisLink">Change file…</button>' : '<label class="btn sm" style="cursor:pointer">Update from file…<input type="file" accept=".docx" data-file="thesisPick" hidden></label>') + (handle ? '<button class="link sm" style="color:#b42318" data-a="thesisUnlink">Unlink</button>' : "") + "</div></div>";
  }
  function chapterRow(c, T) {
    const x = T.ch[c.key], open = LB.tmp.thOpen === c.key, P = "D.thesis.ch." + c.key;
    let h = '<div class="chap lvl' + Math.min(c.lvl, 3) + '"><div class="crow"><span class="cname">' + esc(c.text) + "</span>" + (c.words != null ? '<span class="muted sm" style="white-space:nowrap">' + c.words.toLocaleString() + " words</span>" : "") +
      '<select class="cstatus" aria-label="Status" data-st="' + esc(x.status) + '" data-b="' + P + '.status" data-render="1"><option value="">' + STATUS[0] + "</option>" + STATUS.slice(1).map(s => "<option" + (x.status === s ? " selected" : "") + ">" + s + "</option>").join("") + "</select>" +
      '<button class="btn sm' + (open ? " on" : "") + '" data-a="thOpen" data-k="' + c.key + '">Evidence' + (x.items.length ? " (" + x.items.length + ")" : "") + "</button>" + (c.manual ? '<button class="x" data-a="thRmChap" data-id="' + c.manual + '" aria-label="Remove chapter" title="Remove this chapter">×</button>' : "") + "</div>";
    if (open) {
      const q = (LB.tmp.thq || "").trim().toLowerCase(), cand = candidates(q);
      h += '<div class="cpanel"><div class="muted sm">Link the entries, protocols and papers that belong to this chapter.</div><div class="row wrap" style="gap:6px">' +
        x.items.map((it, i) => '<span class="chipx"><button class="chipbtn" data-a="gopen" data-kind="' + it.kind + '" data-id="' + it.id + '">' + esc(itemLabel(it)) + '</button><button class="x" data-a="thUnlink" data-k="' + c.key + '" data-i="' + i + '" aria-label="Remove link">×</button></span>').join("") + (x.items.length ? "" : '<span class="muted sm">Nothing linked yet.</span>') + "</div>" +
        '<input type="text" placeholder="Search entries, protocols and papers to link…" aria-label="Search to link" data-b="tmp.thq" data-rin="1" value="' + esc(LB.tmp.thq || "") + '" autocomplete="off">' +
        cand.map(m => { const have = x.items.some(it => it.kind === m.kind && it.id === m.id); return '<div class="row" style="background:#fff;border:1px solid #e3e5ee;border-radius:8px;padding:6px 10px"><span class="kind" style="width:64px;flex-shrink:0">' + esc(m.label) + '</span><span class="grow sm">' + esc(m.text) + '</span><button class="btn sm" data-a="thLink" data-k="' + c.key + '" data-kind="' + m.kind + '" data-id="' + m.id + '" ' + (have ? "disabled" : "") + ">" + (have ? "Linked ✓" : "Link") + "</button></div>"; }).join("") +
        '<textarea rows="2" aria-label="Notes on this chapter" placeholder="Notes for this chapter: what the data shows, what is still missing…" data-b="' + P + '.note">' + esc(x.note) + "</textarea></div>";
    }
    return h + "</div>";
  }
  function page() {
    const T = LB.D.thesis, ch = chapters(), top = ch.filter(c => c.lvl === 1 || !c.doc), base = top.length ? top : ch, done = base.filter(c => T.ch[c.key].status === "Done").length, pct = base.length ? Math.round(done / base.length * 100) : 0;
    const live = new Set(chapterKeys().map(c => c.key).concat(T.manual.map(m => "m" + m.id)));
    const orphans = Object.keys(T.ch).filter(k => !live.has(k) && (T.ch[k].items.length || T.ch[k].status || (T.ch[k].note || "").trim()));
    return '<div class="page" data-scroll="page" style="max-width:980px;margin:0 auto;width:100%"><div class="row wrap" style="gap:14px">' + LB.ring(pct) + '<div class="grow"><input type="text" class="etitle" aria-label="Thesis title" placeholder="Thesis title" data-b="D.thesis.title" value="' + esc(T.title) + '" autocomplete="off"><div class="muted sm">' + (base.length ? done + " of " + base.length + " chapters done" : "Link your Word file or add chapters to start tracking progress") + "</div></div></div>" +
      docCard(T) +
      '<div class="card"><div class="row wrap"><h3 class="grow">Chapters</h3>' + (T.file ? '<label class="sm muted row" style="gap:6px">Show <select data-b="ui.thesisDepth" data-t="num" data-render="1" aria-label="Heading depth"><option value="1"' + (LB.ui.thesisDepth === 1 ? " selected" : "") + '>chapters</option><option value="2"' + (LB.ui.thesisDepth === 2 ? " selected" : "") + '>+ sections</option><option value="3"' + (LB.ui.thesisDepth === 3 ? " selected" : "") + ">+ subsections</option></select></label>" : "") + "</div>" +
      (ch.length ? '<div class="chaps">' + ch.map(c => chapterRow(c, T)).join("") + "</div>" : '<div class="muted sm">No chapters yet. Link a Word file above, or add one by hand.</div>') +
      '<input type="text" placeholder="＋ Add a chapter by hand and press Enter" aria-label="Add a chapter" data-b="tmp.thNew" data-enter="thAddChap" value="' + esc(LB.tmp.thNew) + '" style="border-style:dashed" autocomplete="off"></div>' +
      (orphans.length ? '<div class="card"><h3>No longer in the document</h3><div class="muted sm">These headings were renamed or removed in Word. Their links and notes are kept here until you delete them.</div>' + orphans.map(k => '<div class="row"><b class="grow sm">' + esc(T.ch[k].text) + '</b><span class="muted sm">' + T.ch[k].items.length + ' links</span><button class="link sm" style="color:#b42318" data-a="thDropCh" data-k="' + k + '">Delete</button></div>').join("") + "</div>" : "") +
      '<div class="card"><h3>Where is the file?</h3><div class="muted sm">A browser cannot open Word for you. Note where the file lives so you can find it fast.</div><div class="row"><input type="text" class="grow" placeholder="e.g. iCloud Drive / Thesis / Thesis_v12.docx" aria-label="Where the thesis file is" data-b="D.thesis.path" value="' + esc(T.path) + '" autocomplete="off"><button class="btn sm" data-a="thCopyPath">Copy</button></div></div></div>';
  }
  LB.views.thesis = () => page() + '<input type="file" id="thesisFileInput" accept=".docx" data-file="thesisPick" hidden>';

  /* ---------- actions ---------- */
  A.thOpen = el => { LB.tmp.thOpen = LB.tmp.thOpen === el.dataset.k ? "" : el.dataset.k; LB.tmp.thq = ""; LB.render(); };
  A.thLink = el => { const x = LB.D.thesis.ch[el.dataset.k]; if (!x || x.items.some(i => i.kind === el.dataset.kind && i.id === el.dataset.id)) return; x.items.push({ kind: el.dataset.kind, id: el.dataset.id }); LB.save(); LB.render(); };
  A.thUnlink = el => { const x = LB.D.thesis.ch[el.dataset.k]; if (!x) return; x.items.splice(+el.dataset.i, 1); LB.save(); LB.render(); };
  A.thAddChap = el => { const v = (el.value || "").trim(); if (!v) return; LB.D.thesis.manual.push({ id: U.uid(), text: v }); LB.tmp.thNew = ""; LB.save(); LB.render(); };
  A.thRmChap = el => {
    const T = LB.D.thesis, m = T.manual.find(z => z.id === el.dataset.id); if (!m) return; const x = T.ch["m" + m.id];
    if (x && (x.items.length || (x.note || "").trim()) && !confirm("Remove “" + m.text + "”? Its links and notes are deleted too.")) return;
    T.manual = T.manual.filter(z => z !== m); delete T.ch["m" + m.id]; LB.save(); LB.render();
  };
  A.thDropCh = el => { delete LB.D.thesis.ch[el.dataset.k]; LB.save(); LB.render(); };
  A.thCopyPath = async () => { try { await navigator.clipboard.writeText(LB.D.thesis.path || ""); LB.toast("Copied."); } catch (e) { LB.toast("Could not copy."); } };
})(window.LB);
