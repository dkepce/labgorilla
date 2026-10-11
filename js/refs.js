/* LabGorilla — References: papers behind an entry or protocol. Add by DOI / PubMed ID / link (CrossRef + PubMed),
   or search the user's Zotero library through the Zotero web API (read-only key kept only in this browser). */
(function (LB) {
  const U = LB.U, esc = U.esc, A = LB.actions;
  Object.assign(LB.tmp, { refIn: "", refEdit: "", zOpen: false, zFor: "", zq: "", zres: [], zmsg: "", zs: { userId: "", key: "", groups: "" } });

  /* ---------- Zotero settings: stored in this browser only, never in the .lbk file ---------- */
  const ZK = "labgorilla.zotero";
  const zset = () => { try { return JSON.parse(localStorage.getItem(ZK) || "null") || {}; } catch (e) { return {}; } };
  const zsave = o => { try { localStorage.setItem(ZK, JSON.stringify(o)); } catch (e) { } };
  const zready = () => { const z = zset(); return !!(z.userId && z.key); };
  const zlibs = () => { const z = zset(), l = ["users/" + z.userId]; String(z.groups || "").split(/[,\s]+/).filter(x => /^\d+$/.test(x)).forEach(g => l.push("groups/" + g)); return l; };
  const zhead = () => ({ "Zotero-API-Key": zset().key, "Zotero-API-Version": "3" });

  /* ---------- turning lookups into reference records ---------- */
  const initials = g => String(g || "").split(/[\s\-.]+/).filter(Boolean).map(x => x[0].toUpperCase()).join("");
  const clean = t => String(t || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  async function fromDoi(doi) {
    const r = await fetch("https://api.crossref.org/works/" + encodeURI(doi));
    if (!r.ok) throw new Error("DOI not found");
    const m = (await r.json()).message;
    return { title: clean((m.title || [""])[0]), authors: (m.author || []).map(a => (a.family || a.name || "") + (a.given ? " " + initials(a.given) : "")).join(", "), journal: clean((m["container-title"] || [""])[0]), year: String(((m.issued || {})["date-parts"] || [[]])[0][0] || ""), doi: m.DOI || doi, url: "" };
  }
  async function fromPmid(id) {
    const r = await fetch("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=" + id);
    if (!r.ok) throw new Error("PubMed ID not found");
    const x = ((await r.json()).result || {})[id]; if (!x || x.error) throw new Error("PubMed ID not found");
    const d = (x.articleids || []).find(a => a.idtype === "doi");
    return { title: clean(x.title), authors: (x.authors || []).map(a => a.name).join(", "), journal: clean(x.source), year: String((x.pubdate || "").slice(0, 4)), doi: d ? d.value : "", pmid: String(id), url: "" };
  }
  function fromZotero(it) {
    const d = it.data || {}, lib = it.library || {};
    const names = (d.creators || []).filter(c => c.creatorType === "author").concat((d.creators || []).filter(c => c.creatorType !== "author" && !(d.creators || []).some(a => a.creatorType === "author")));
    const yr = (String((it.meta || {}).parsedDate || d.date || "").match(/\d{4}/) || [""])[0];
    return { title: clean(d.title), authors: names.map(c => (c.name ? c.name : (c.lastName || "") + (c.firstName ? " " + initials(c.firstName) : ""))).join(", "), journal: clean(d.publicationTitle || d.bookTitle || d.proceedingsTitle || d.websiteTitle || d.publisher || ""), year: yr, doi: d.DOI || "", url: d.url || "", zkey: it.key, zlib: lib.type === "group" ? "groups/" + lib.id : "" };
  }
  async function zFetchItem(lib, key) {
    const r = await fetch("https://api.zotero.org/" + lib + "/items/" + key, { headers: zhead() });
    if (!r.ok) throw new Error("Zotero item not found");
    return fromZotero(await r.json());
  }
  async function zSearch(q) {
    const out = [];
    for (const lib of zlibs()) {
      const r = await fetch("https://api.zotero.org/" + lib + "/items/top?limit=12&qmode=everything&sort=dateModified&direction=desc&q=" + encodeURIComponent(q), { headers: zhead() });
      if (r.status === 403 || r.status === 401) throw new Error("Zotero did not accept the key. Check it in Zotero settings.");
      if (!r.ok) { if (lib.startsWith("groups/")) continue; throw new Error("Zotero answered with an error (" + r.status + ")."); }
      (await r.json()).filter(it => !["attachment", "note", "annotation"].includes((it.data || {}).itemType)).forEach(it => out.push(fromZotero(it)));
    }
    return out;
  }
  async function resolve(input) {
    const s = input.trim(); let m;
    if ((m = s.match(/zotero:\/\/select\/(library|groups\/\d+)\/items\/([A-Z0-9]{8})/i))) {
      const lib = m[1] === "library" ? "users/" + zset().userId : m[1], zlib = m[1] === "library" ? "" : m[1];
      if (zready()) { const r = await zFetchItem(lib, m[2]); r.zlib = zlib; return r; }
      return { title: "Zotero item " + m[2], authors: "", journal: "", year: "", doi: "", url: "", zkey: m[2], zlib };
    }
    if ((m = s.match(/10\.\d{4,9}\/[^\s"<>]+/))) return fromDoi(m[0].replace(/[.,;)\]]+$/, ""));
    if ((m = s.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i) || s.match(/^(?:pmid:?\s*)?(\d{5,9})$/i))) return fromPmid(m[1]);
    if (/^https?:\/\//i.test(s)) return { title: s, authors: "", journal: "", year: "", doi: "", url: s };
    throw new Error("I did not recognise that. Paste a DOI, a PubMed ID or a web link.");
  }

  /* ---------- storing ---------- */
  LB.libOwner = { _lib: true, refs: [] };
  const ownerOf = el => (el.dataset.kind === "lib" ? LB.libOwner : el.dataset.kind === "entry" ? LB.D.entries[el.dataset.oid] : LB.D.protocols[el.dataset.oid]);
  const locked = o => !!(o && o.locked);
  function addRef(owner, data) {
    const D = LB.D;
    let ref = D.refs.find(r => (data.doi && r.doi && r.doi.toLowerCase() === data.doi.toLowerCase()) || (data.pmid && r.pmid === data.pmid) || (data.zkey && r.zkey === data.zkey && (r.zlib || "") === (data.zlib || "")) || (!data.doi && !data.zkey && data.url && r.url === data.url));
    if (!ref) { ref = Object.assign({ id: U.uid(), title: "", authors: "", journal: "", year: "", doi: "", pmid: "", url: "", zkey: "", zlib: "" }, data); D.refs.push(ref); }
    if (owner._lib) { const had = ref.lib; ref.lib = true; return had ? false : ref; }
    owner.refs = owner.refs || [];
    if (owner.refs.some(x => x.id === ref.id)) return false;
    owner.refs.push({ id: ref.id, note: "" });
    if (owner.hist) LB.log(owner, "Added reference: " + (ref.title || "untitled").slice(0, 60));
    return ref;
  }
  const citedElsewhere = (refId, owner) => {
    const out = [];
    Object.values(LB.D.entries).forEach(e => { if (e !== owner && (e.refs || []).some(x => x.id === refId)) out.push(e.code); });
    Object.values(LB.D.protocols).forEach(p => { if (p !== owner && (p.refs || []).some(x => x.id === refId)) out.push("Protocol: " + p.title); });
    return out;
  };

  /* ---------- formatting ---------- */
  const shortAuthors = a => { const l = String(a || "").split(/,\s*/).filter(Boolean); return l.length > 3 ? l[0] + " et al." : l.join(", "); };
  const cite = r => shortAuthors(r.authors) + (r.year ? " (" + r.year + ")" : "") + (r.authors || r.year ? ". " : "") + (r.title || "Untitled") + (/[.?!]$/.test(r.title || "") ? " " : ". ") + (r.journal ? r.journal + "." : "");
  const zlink = r => (r.zkey ? "zotero://select/" + (r.zlib ? r.zlib : "library") + "/items/" + r.zkey : "");
  LB.refCite = cite; LB.refShort = shortAuthors; LB.refZlink = zlink;
  LB.refsPrint = function (owner) {
    const list = (owner.refs || []).map(x => ({ x, r: LB.D.refs.find(r => r.id === x.id) })).filter(v => v.r);
    if (!list.length) return "";
    const style = LB.ui.refStyle === "authoryear" ? "authoryear" : "numbered";
    if (style === "authoryear") list.sort((p, q) => (p.r.authors || p.r.title || "").localeCompare(q.r.authors || q.r.title || "") || String(p.r.year).localeCompare(String(q.r.year)));
    const line = ({ x, r }, i) => "<div>" + (style === "numbered" ? "[" + (i + 1) + "] " : "") + esc(cite(r)) + (r.doi ? " doi:" + esc(r.doi) : r.url ? " " + esc(r.url) : "") + (x.note ? '<br><span class="small">Note: ' + esc(x.note) + "</span>" : "") + "</div>";
    return '<section class="long rec"><h2>References</h2>' + list.map(line).join("") + "</section>";
  };

  /* the "paste a DOI / search Zotero / add by hand" bar, used by entries, protocols and the References tab */
  LB.refsAddBar = function (kind, id, owner) {
    const D = LB.D, dis = locked(owner) ? "disabled" : "", at = 'data-kind="' + kind + '" data-oid="' + id + '"'; let h = "";
    h += '<div class="row wrap"><input type="text" class="grow" style="min-width:240px" placeholder="Paste a DOI, PubMed ID or link and press Enter" aria-label="Add a reference" data-b="tmp.refIn" data-enter="refAdd" ' + at + ' value="' + esc(LB.tmp.refIn) + '" ' + dis + ' autocomplete="off"><button class="btn sm" data-a="zotToggle" ' + at + " " + dis + '>Search Zotero</button><button class="link sm" data-a="refManual" ' + at + " " + dis + ">Add by hand</button></div>";
    if (LB.tmp.zOpen && LB.tmp.zFor === kind + ":" + id && !locked(owner)) {
      h += '<div class="newmat">';
      if (!zready()) h += '<div class="warnbox">Connect your Zotero library first (one time).</div><div><button class="btn pri sm" data-a="zotSetup">Connect Zotero…</button></div>';
      else {
        h += '<div class="row"><input type="text" class="grow" placeholder="Search your Zotero library: title, author, year, tag…" aria-label="Search Zotero" data-b="tmp.zq" data-enter="zotSearch" value="' + esc(LB.tmp.zq) + '" autocomplete="off"><button class="btn sm" data-a="zotSearch">Search</button></div>' + (LB.tmp.zmsg ? '<div class="muted sm">' + esc(LB.tmp.zmsg) + "</div>" : "");
        h += LB.tmp.zres.map((r, k) => { const have = (owner._lib ? D.refs.filter(f => f.lib) : (owner.refs || []).map(x => D.refs.find(z => z.id === x.id)).filter(Boolean)).some(f => (r.zkey && f.zkey === r.zkey) || (r.doi && f.doi && f.doi.toLowerCase() === r.doi.toLowerCase())); return '<div class="row" style="align-items:flex-start;background:#fff;border:1px solid #e3e5ee;border-radius:8px;padding:8px 10px"><div class="grow sm">' + esc(cite(r)) + '</div><button class="btn sm" data-a="zotAdd" ' + at + ' data-k="' + k + '" ' + (have ? "disabled" : "") + ">" + (have ? "Added ✓" : "Add") + "</button></div>"; }).join("");
      }
      h += "</div>";
    }
    return h;
  };

  /* ---------- the card ---------- */
  LB.refsCard = function (kind, owner, id) {
    const D = LB.D, dis = locked(owner) ? "disabled" : "", P = (kind === "entry" ? "D.entries." : "D.protocols.") + id, at = 'data-kind="' + kind + '" data-oid="' + id + '"';
    const list = (owner.refs || []).map((x, i) => ({ x, i, r: D.refs.find(r => r.id === x.id) })).filter(v => v.r);
    let h = '<div class="card"><div class="row"><h3 class="grow">References</h3>' + (list.length ? '<button class="link sm" data-a="risOwner" ' + at + ' title="Download these references to import into Zotero, EndNote or Mendeley">Export .ris</button>' : "") + '<button class="link sm" data-a="zotSetup">' + (zready() ? "Zotero connected ✓ (settings)" : "Connect Zotero…") + "</button></div>" +
      '<div class="muted sm">The papers behind this ' + (kind === "entry" ? "experiment" : "protocol") + ". Paste a DOI, PubMed ID or link, or search your Zotero library.</div>";
    h += list.map(({ x, i, r }, n) => {
      const ri = D.refs.indexOf(r), PR = "D.refs." + ri, other = citedElsewhere(r.id, owner), editing = LB.tmp.refEdit === r.id;
      return '<div class="ref"><span class="snum">' + (n + 1) + '</span><div class="rb"><div>' + esc(shortAuthors(r.authors)) + (r.year ? " (" + esc(r.year) + ")" : "") + (r.authors || r.year ? ". " : "") + "<b>" + esc(r.title || "Untitled") + "</b>. " + (r.journal ? "<i>" + esc(r.journal) + "</i>." : "") + "</div>" +
        '<div class="row wrap sm" style="gap:12px">' + (r.zkey ? '<a href="' + esc(zlink(r)) + '"><b>Open in Zotero</b></a>' : "") + (r.doi ? '<a href="https://doi.org/' + esc(r.doi) + '" target="_blank" rel="noopener">DOI</a>' : "") + (r.pmid ? '<a href="https://pubmed.ncbi.nlm.nih.gov/' + esc(r.pmid) + '/" target="_blank" rel="noopener">PubMed</a>' : "") + (!r.doi && /^https?:\/\//i.test(r.url) ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">Open link</a>' : "") +
        '<button class="link sm" data-a="refEdit" data-id="' + r.id + '">' + (editing ? "Close editor" : "Edit details") + "</button>" + (other.length ? '<span class="muted">also cited in ' + esc(other.slice(0, 3).join(", ")) + (other.length > 3 ? " +" + (other.length - 3) : "") + "</span>" : "") + "</div>" +
        '<input type="text" placeholder="Your note: which figure, page or method?" aria-label="Note on this reference" data-b="' + P + ".refs." + i + '.note" data-log="Edited a reference note" value="' + esc(x.note || "") + '" ' + dis + ' autocomplete="off">' +
        (editing ? '<div class="newmat" style="margin-top:6px"><div class="muted sm">Changes here apply everywhere this paper is cited.</div><input type="text" aria-label="Title" placeholder="Title" data-b="' + PR + '.title" value="' + esc(r.title) + '"><input type="text" aria-label="Authors" placeholder="Authors, e.g. Smith J, Doe A" data-b="' + PR + '.authors" value="' + esc(r.authors) + '"><div class="row"><input type="text" class="grow" aria-label="Journal" placeholder="Journal" data-b="' + PR + '.journal" value="' + esc(r.journal) + '"><input type="text" style="width:80px" aria-label="Year" placeholder="Year" data-b="' + PR + '.year" value="' + esc(r.year) + '"></div><input type="text" aria-label="DOI" placeholder="DOI" data-b="' + PR + '.doi" value="' + esc(r.doi) + '"><input type="text" aria-label="Link" placeholder="Link (optional)" data-b="' + PR + '.url" value="' + esc(r.url) + '"></div>' : "") + "</div>" +
        '<button class="x" data-a="refRemove" ' + at + ' data-i="' + i + '" ' + dis + ' aria-label="Remove reference">×</button></div>';
    }).join("");
    if (!list.length) h += '<div class="muted sm">No references yet.</div>';
    h += LB.refsAddBar(kind, id, owner);
    return h + "</div>";
  };

  /* ---------- Zotero connection dialog ---------- */
  LB.zoteroModal = function () {
    const s = LB.tmp.zs;
    return '<div class="backdrop" data-a="closeModal"><div class="modal"><h2>Connect Zotero</h2>' +
      '<div class="muted sm" style="line-height:1.55">LabGorilla only <b>reads</b> your library, to search it. Your key stays in this browser. It is never saved in the lab book file or sent anywhere except to Zotero.</div>' +
      '<ol class="muted sm" style="margin:0;padding-left:18px;line-height:1.6"><li>Open <a href="https://www.zotero.org/settings/keys" target="_blank" rel="noopener">zotero.org/settings/keys</a> (sign in).</li><li>Note your <b>userID</b> shown there (“for use in API calls”).</li><li>Click <b>Create new private key</b>, tick <b>Allow library access</b> (read only). For a group library, also allow read access to groups.</li><li>Paste both below.</li></ol>' +
      '<label>Zotero userID<input type="text" data-b="tmp.zs.userId" placeholder="e.g. 1234567" value="' + esc(s.userId) + '" autocomplete="off"></label>' +
      '<label>API key<input type="password" data-b="tmp.zs.key" placeholder="paste your key" value="' + esc(s.key) + '" autocomplete="off"></label>' +
      '<label>Group library IDs (optional, comma separated)<input type="text" data-b="tmp.zs.groups" placeholder="e.g. 98765, 43210" value="' + esc(s.groups) + '" autocomplete="off"></label>' +
      '<div class="row wrap"><button class="btn pri" data-a="zotSave">Save and test</button><button class="btn" data-a="closeModal" data-force="1">Close</button><span class="grow"></span>' + (zready() ? '<button class="link sm" style="color:#b42318" data-a="zotForget">Remove key</button>' : "") + "</div></div></div>";
  };

  /* ---------- actions ---------- */
  A.zotSetup = () => { LB.tmp.zs = Object.assign({ userId: "", key: "", groups: "" }, zset()); LB.tmp.pop = "zotero"; LB.render(); };
  A.zotSave = async () => {
    const s = LB.tmp.zs, o = { userId: String(s.userId || "").trim(), key: String(s.key || "").trim(), groups: String(s.groups || "").trim() };
    if (!/^\d+$/.test(o.userId) || !o.key) { LB.toast("Please enter your numeric userID and the API key."); return; }
    zsave(o);
    try {
      const r = await fetch("https://api.zotero.org/users/" + o.userId + "/items/top?limit=1", { headers: zhead() });
      if (r.ok) { LB.tmp.pop = ""; LB.render(); LB.toast("Zotero connected."); }
      else LB.toast(r.status === 403 || r.status === 401 ? "Zotero did not accept this userID/key combination." : "Zotero answered with an error (" + r.status + ").");
    } catch (e) { LB.toast("Could not reach Zotero. Check your internet connection."); }
  };
  A.zotForget = () => { try { localStorage.removeItem(ZK); } catch (e) { } LB.tmp.zs = { userId: "", key: "", groups: "" }; LB.tmp.pop = ""; LB.tmp.zres = []; LB.render(); LB.toast("Zotero key removed from this browser."); };
  A.zotToggle = el => { const k = el.dataset.kind + ":" + el.dataset.oid; LB.tmp.zOpen = !(LB.tmp.zOpen && LB.tmp.zFor === k); LB.tmp.zFor = k; LB.render(); };
  A.zotSearch = async el => {
    const q = (LB.tmp.zq || "").trim(); if (!q) return;
    LB.tmp.zmsg = "Searching…"; LB.render();
    try { LB.tmp.zres = await zSearch(q); LB.tmp.zmsg = LB.tmp.zres.length ? "" : "Nothing found for “" + q + "”."; } catch (e) { LB.tmp.zres = []; LB.tmp.zmsg = e.message || "Search failed."; }
    LB.render();
  };
  A.zotAdd = el => {
    const o = ownerOf(el), r = LB.tmp.zres[+el.dataset.k]; if (!o || locked(o) || !r) return;
    addRef(o, r); LB.save(); LB.render();
  };
  A.refAdd = async el => {
    const o = ownerOf(el), v = (el.value || "").trim(); if (!o || locked(o) || !v) return;
    LB.toast("Looking it up…");
    try { const data = await resolve(v); const r = addRef(o, data); LB.tmp.refIn = ""; LB.save(); LB.render(); LB.toast(r === false ? "That reference is already listed here." : "Added: " + (data.title || "reference").slice(0, 70)); }
    catch (e) { LB.toast(e.message === "Failed to fetch" ? "Could not reach the lookup service. Check your internet connection, or use “Add by hand”." : e.message); }
  };
  A.refManual = el => {
    const o = ownerOf(el); if (!o || locked(o)) return;
    const r = addRef(o, { title: "New reference" }); if (r) { LB.tmp.refEdit = r.id; LB.save(); LB.render(); }
  };
  A.refEdit = el => { LB.tmp.refEdit = LB.tmp.refEdit === el.dataset.id ? "" : el.dataset.id; LB.render(); };
  A.refRemove = el => {
    const o = ownerOf(el); if (!o || locked(o)) return;
    const x = o.refs[+el.dataset.i]; if (!x) return;
    o.refs.splice(+el.dataset.i, 1);
    const used = Object.values(LB.D.entries).some(e => (e.refs || []).some(z => z.id === x.id)) || Object.values(LB.D.protocols).some(p => (p.refs || []).some(z => z.id === x.id));
    if (!used && !(LB.D.refs.find(r => r.id === x.id) || {}).lib) LB.D.refs = LB.D.refs.filter(r => r.id !== x.id);
    if (o.hist) LB.log(o, "Removed a reference");
    LB.save(); LB.render();
  };
})(window.LB);
