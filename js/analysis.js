/* LabGorilla — analysis cards for the Procedure tab: ImageJ analysis record, data table (paste or load a CSV, statistics, plot),
   figure with an auto-built legend, raw data location, and "Copy for Prism" helpers. LabGorilla never opens ImageJ or Prism:
   it records how an analysis was done and takes in the text/CSV that those programs export. */
(function (LB) {
  const K = LB.cardKit, U = LB.U, esc = U.esc, A = LB.actions;
  const { field, txt, sel, num, pathOf, extra, cut, PAL } = K, TYPES = LB.CARD_TYPES, IC = LB.CARD_ICONS;
  const live = () => { const e = LB.cur(); return e && !e.locked ? e : null; };
  const cardOf = id => { const e = LB.cur(); return e ? extra(e).find(c => c.id === id) : null; };
  const area = (P, k, v, dis, ph, rows, cls) => '<textarea rows="' + rows + '" class="' + (cls || "") + '" aria-label="' + esc(ph) + '" data-b="' + P + "." + k + '" placeholder="' + esc(ph) + '" ' + dis + ">" + esc(v) + "</textarea>";
  const opts = (list, cur) => list.map(o => '<option value="' + esc(o) + '"' + (o === cur ? " selected" : "") + ">" + (o === "" ? "–" : esc(o)) + "</option>").join("");
  async function copy(text, ok) { try { await navigator.clipboard.writeText(text); LB.toast(ok || "Copied."); } catch (e) { LB.toast("Could not copy. Select the text and copy it manually."); } }
  const download = (name, text, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const kv = rows => { rows = rows.filter(r => r[1] && String(r[1]).trim()); return rows.length ? '<table class="t">' + rows.map(r => '<tr><th style="width:28%">' + r[0] + "</th><td>" + esc(r[1]) + "</td></tr>").join("") + "</table>" : ""; };

  /* extra icons for the picker tiles */
  Object.assign(IC, {
    imagej: '<rect x="3" y="4" width="13" height="11" rx="2"/><path d="M3 12l4-3 3 2 2-2"/><circle cx="16.5" cy="15.5" r="3.5"/><path d="M19 18l2.5 2.5"/>',
    data: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16M15 4v16"/>',
    figure: '<path d="M4 20V5M4 20h16"/><rect x="7" y="12" width="3" height="8"/><rect x="12" y="8" width="3" height="12"/><rect x="17" y="14" width="3" height="6"/>',
    rawdata: '<rect x="3" y="12" width="18" height="7" rx="2"/><circle cx="7" cy="15.5" r=".8"/><path d="M5 12l2-7h10l2 7"/>'
  });

  /* ================= IMAGEJ ANALYSIS ================= */
  const THR = ["", "Default", "Otsu", "Huang", "Li", "Triangle", "MaxEntropy", "Moments", "Yen", "IsoData", "Mean", "Percentile", "Manual", "Other"];
  function ijBody(e, c, P, dis) {
    return '<div class="muted sm">Write down what you did in Fiji / ImageJ so you can repeat it later. Attach the exported tables and images on the Results tab.</div><div class="cfgrid">' +
      field("Software and version", txt(P, "software", c.software, dis, "e.g. Fiji, ImageJ 2.14.0")) + field("Plugins", txt(P, "plugins", c.plugins, dis, "e.g. StarDist, Bio-Formats")) +
      field("Input images", txt(P, "input", c.input, dis, "e.g. C7_day4_*.tif, 20 images")) + field("Scale", txt(P, "scale", c.scale, dis, "e.g. 0.645 µm / pixel")) +
      field("Channels", txt(P, "channels", c.channels, dis, "e.g. DAPI, calcein, PI")) +
      field("Threshold method", '<select data-b="' + P + '.thr" data-render="1" ' + dis + ">" + opts(THR, c.thr) + "</select>") +
      field("Measurements", txt(P, "measure", c.measure, dis, "e.g. Area, Mean, Circularity, Feret")) + field("Results saved to", txt(P, "out", c.out, dis, "folder or file name")) + "</div>" +
      '<div class="lbl">Processing steps</div>' + area(P, "steps", c.steps, dis, "e.g. Background subtraction (rolling ball 50 px) → Gaussian blur σ = 2 → threshold → Analyze Particles (size 50–∞ µm²)", 3) +
      '<div class="row"><span class="lbl grow">Macro or script</span><button class="link sm" data-a="ijCopy" data-card="' + c.id + '" title="Copy the macro to paste into Fiji">Copy macro</button></div>' + area(P, "macro", c.macro, dis, "Paste your .ijm macro here (optional)", 7, "mono");
  }
  function ijPrint(e, c) {
    return kv([["Software", c.software], ["Plugins", c.plugins], ["Input images", c.input], ["Scale", c.scale], ["Channels", c.channels], ["Threshold", c.thr], ["Measurements", c.measure], ["Results saved to", c.out]]) +
      (c.steps && c.steps.trim() ? '<div class="tx" style="margin-top:4pt"><b>Steps:</b> ' + esc(c.steps) + "</div>" : "") + (c.macro && c.macro.trim() ? '<div class="small" style="margin-top:4pt">Macro:</div><pre class="macro">' + esc(c.macro) + "</pre>" : "");
  }
  A.ijCopy = el => { const c = cardOf(el.dataset.card); if (c) copy(c.macro || "", c.macro ? "Macro copied. Paste it into Fiji (Plugins > New > Macro)." : "There is no macro to copy yet."); };

  /* ================= DATA TABLE ================= */
  const nv = s => { s = String(s == null ? "" : s).trim().replace(",", "."); return s !== "" && isFinite(+s) ? +s : NaN; };
  const fmt = v => (isFinite(v) ? String(+v.toPrecision(4)) : "–");
  function splitLine(line, d) {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === d) { out.push(cur); cur = ""; } else cur += ch; }
    out.push(cur); return out.map(s => s.trim());
  }
  /* pasted from ImageJ's Results table, Excel, Prism or a CSV file: tabs, semicolons or commas */
  function parseTable(text) {
    text = String(text).replace(/\uFEFF/g, "").replace(/\r\n?/g, "\n").replace(/\n+$/, ""); if (!text.trim()) return null;
    const lines = text.split("\n"), first = lines[0], d = first.includes("\t") ? "\t" : first.split(";").length > first.split(",").length ? ";" : ",";
    let rows = lines.filter(l => l.trim()).slice(0, 5001).map(l => splitLine(l, d)); const nc = Math.min(30, Math.max(...rows.map(r => r.length)));
    rows = rows.map(r => { r = r.slice(0, nc); while (r.length < nc) r.push(""); return r; });
    const header = rows[0].some(x => x !== "" && !isFinite(nv(x)));
    const cols = header ? rows[0].map((x, j) => x || (j === 0 ? "#" : "Column " + (j + 1))) : rows[0].map((_, j) => "Column " + (j + 1));
    return { cols, rows: header ? rows.slice(1) : rows };
  }
  const colVals = (c, j) => c.rows.map(r => nv(r[j])).filter(isFinite);
  const isIndexCol = (c, j) => { const v = c.rows.map(r => nv(r[j])); return v.length > 2 && v.every((x, i) => x === i + 1 || x === i); };   // ImageJ's running number column
  const isNumCol = (c, j) => { const filled = c.rows.filter(r => String(r[j]).trim() !== "").length; return filled > 0 && colVals(c, j).length >= filled * 0.6 && !isIndexCol(c, j); };
  const stat = a => {
    const n = a.length; if (!n) return null; const mean = a.reduce((s, x) => s + x, 0) / n, sd = n > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : NaN, so = a.slice().sort((x, y) => x - y);
    return { n, mean, sd, sem: sd / Math.sqrt(n), med: n % 2 ? so[(n - 1) / 2] : (so[n / 2 - 1] + so[n / 2]) / 2, min: so[0], max: so[n - 1], vals: a };
  };
  /* the groups that statistics and the plot are made from */
  function groupsOf(c) {
    const gb = c.groupBy === "" || c.groupBy == null ? -1 : +c.groupBy;
    if (gb < 0 || gb >= c.cols.length) return c.cols.map((name, j) => ({ name, j })).filter(g => isNumCol(c, g.j)).map(g => Object.assign({ name: g.name }, stat(colVals(c, g.j)))).filter(g => g.n);
    const vj = c.valueCol !== "" && c.valueCol != null && +c.valueCol < c.cols.length && +c.valueCol !== gb ? +c.valueCol : c.cols.findIndex((_, j) => j !== gb && isNumCol(c, j));
    if (vj < 0) return [];
    const by = new Map(); c.rows.forEach(r => { const k = String(r[gb]).trim() || "(blank)", v = nv(r[vj]); if (isFinite(v)) { if (!by.has(k)) by.set(k, []); by.get(k).push(v); } });
    return [...by].slice(0, 12).map(([name, a]) => Object.assign({ name }, stat(a)));
  }
  function niceScale(lo, hi) { const span = hi - lo || 1, raw = span / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw); return { a: Math.floor(lo / step) * step, b: Math.ceil(hi / step) * step, step }; }
  function plot(gs) {
    if (!gs.length) return "";
    gs = gs.slice(0, 12); const all = gs.flatMap(g => g.vals), sc = niceScale(Math.min(0, ...all), Math.max(...all)), W = Math.max(300, 78 * gs.length + 70), H = 250, L = 52, B = 40, T = 12, iw = W - L - 12, ih = H - B - T, y = v => T + ih - (v - sc.a) / (sc.b - sc.a) * ih;
    let s = '<svg class="dplot" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Dot plot of the groups, mean and standard deviation"><line class="dp-ax" x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (T + ih) + '"/><line class="dp-ax" x1="' + L + '" y1="' + (T + ih) + '" x2="' + (W - 12) + '" y2="' + (T + ih) + '"/>';
    for (let v = sc.a; v <= sc.b + sc.step / 2; v += sc.step) s += '<line class="dp-grid" x1="' + L + '" y1="' + y(v) + '" x2="' + (W - 12) + '" y2="' + y(v) + '"/><text class="dp-t" x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + +v.toPrecision(3) + "</text>";
    gs.forEach((g, i) => {
      const cx = L + iw / gs.length * (i + 0.5), col = PAL[i % PAL.length], r = g.n > 80 ? 2 : 3.6, w = Math.min(34, iw / gs.length * 0.36);
      g.vals.slice(0, 400).forEach((v, k) => { const jx = (((k * 37) % 11) - 5) / 5 * w * 0.8; s += '<circle class="dp-dot" cx="' + (cx + jx).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="' + r + '" style="fill:' + col + '"/>'; });
      if (isFinite(g.sd)) s += '<line class="dp-sd" x1="' + cx + '" y1="' + y(g.mean - g.sd) + '" x2="' + cx + '" y2="' + y(g.mean + g.sd) + '"/><line class="dp-sd" x1="' + (cx - w * 0.5) + '" y1="' + y(g.mean - g.sd) + '" x2="' + (cx + w * 0.5) + '" y2="' + y(g.mean - g.sd) + '"/><line class="dp-sd" x1="' + (cx - w * 0.5) + '" y1="' + y(g.mean + g.sd) + '" x2="' + (cx + w * 0.5) + '" y2="' + y(g.mean + g.sd) + '"/>';
      s += '<line class="dp-mean" x1="' + (cx - w) + '" y1="' + y(g.mean) + '" x2="' + (cx + w) + '" y2="' + y(g.mean) + '"/><text class="dp-t" x="' + cx + '" y="' + (H - 18) + '" text-anchor="middle">' + esc(cut(g.name, 12)) + '</text><text class="dp-t dp-n" x="' + cx + '" y="' + (H - 5) + '" text-anchor="middle">n=' + g.n + "</text>";
    });
    return s + "</svg>";
  }
  const statRows = gs => gs.map(g => "<tr><td>" + esc(g.name) + "</td><td>" + g.n + "</td><td>" + fmt(g.mean) + "</td><td>" + fmt(g.sd) + "</td><td>" + fmt(g.sem) + "</td><td>" + fmt(g.med) + "</td><td>" + fmt(g.min) + " – " + fmt(g.max) + "</td></tr>").join("");
  const STAT_HEAD = "<tr><th>Group</th><th>n</th><th>Mean</th><th>SD</th><th>SEM</th><th>Median</th><th>Range</th></tr>";
  const SHOW_ROWS = 40;

  function dataBody(e, c, P, dis) {
    const gs = groupsOf(c), nc = c.cols.length, hasData = c.rows.length > 0;
    const numCols = c.cols.map((n, j) => j).filter(j => isNumCol(c, j));
    let h = '<div class="row wrap" style="gap:8px"><button class="btn sm" data-a="dataPasteToggle" data-card="' + c.id + '" ' + dis + '>📋 Paste table…</button>' +
      '<label class="btn sm" style="cursor:pointer" title="Load a CSV or tab-separated file, for example saved from the ImageJ Results table">' + LB.icons.folder(true, 15) + ' Load CSV…<input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" data-file="dataLoad" data-card="' + c.id + '" hidden ' + dis + "></label>" +
      '<button class="btn sm" data-a="dataRow" data-card="' + c.id + '" ' + dis + '>+ Row</button><button class="btn sm" data-a="dataCol" data-card="' + c.id + '" ' + dis + '>+ Column</button><span class="grow"></span>' +
      '<button class="btn sm" data-a="dataCopy" data-card="' + c.id + '" title="Copy the groups as columns to paste into a Prism column table">Copy for Prism</button><button class="btn sm" data-a="dataCsv" data-card="' + c.id + '">⬇ CSV</button><button class="link sm" style="color:#b42318" data-a="dataClear" data-card="' + c.id + '" ' + dis + ">Clear</button></div>";
    if (LB.tmp.dpaste === c.id && !e.locked) h += '<div class="newmat"><div class="muted sm">Copy the table in ImageJ (Results window: Edit > Copy All), Excel or Prism, then paste it here. The first line is used as column names if it has text.</div><textarea rows="6" class="mono" aria-label="Paste your table here" placeholder="Paste here…" data-b="tmp.dtext"></textarea><div class="row"><button class="btn pri sm" data-a="dataUse" data-card="' + c.id + '">Use this data</button><button class="link sm" style="color:var(--mute)" data-a="dataPasteToggle" data-card="' + c.id + '">Cancel</button></div></div>';
    if (c.src) h += '<div class="muted sm">Loaded from ' + esc(c.src) + "</div>";
    if (!hasData) return h + '<div class="muted sm">No data yet. Paste a table, load a file, or start with “+ Row” and “+ Column”. Large raw tables are fine: statistics use every row.</div>';
    h += '<div class="dgrid-wrap"><table class="dgrid"><tr>' + c.cols.map((n, j) => '<th><input type="text" aria-label="Column name" data-b="' + P + ".cols." + j + '" data-rin="1" value="' + esc(n) + '" ' + dis + '><button class="x" data-a="dataRmCol" data-card="' + c.id + '" data-j="' + j + '" ' + dis + ' aria-label="Remove column">×</button></th>').join("") + "<th></th></tr>" +
      c.rows.slice(0, SHOW_ROWS).map((r, i) => "<tr>" + r.map((v, j) => '<td><input type="text" aria-label="Row ' + (i + 1) + ", " + esc(c.cols[j]) + '" data-b="' + P + ".rows." + i + "." + j + '" data-rin="1" value="' + esc(v) + '" ' + dis + "></td>").join("") + '<td><button class="x" data-a="dataRmRow" data-card="' + c.id + '" data-i="' + i + '" ' + dis + ' aria-label="Remove row">×</button></td></tr>').join("") + "</table></div>" +
      '<div class="muted sm">' + c.rows.length + " rows × " + nc + " columns" + (c.rows.length > SHOW_ROWS ? ". The first " + SHOW_ROWS + " rows are shown for editing; statistics use all " + c.rows.length + "." : "") + "</div>";
    h += '<div class="row wrap" style="gap:12px">' + field("Groups", '<select data-b="' + P + '.groupBy" data-render="1" ' + dis + '><option value="">Each number column is a group</option>' + c.cols.map((n, j) => '<option value="' + j + '"' + (String(c.groupBy) === String(j) ? " selected" : "") + ">Group by: " + esc(n) + "</option>").join("") + "</select>");
    if (c.groupBy !== "" && c.groupBy != null) h += field("Values from", '<select data-b="' + P + '.valueCol" data-render="1" ' + dis + '><option value="">First number column</option>' + numCols.filter(j => j !== +c.groupBy).map(j => '<option value="' + j + '"' + (String(c.valueCol) === String(j) ? " selected" : "") + ">" + esc(c.cols[j]) + "</option>").join("") + "</select>");
    h += "</div>";
    h += gs.length ? '<div class="dgrid-wrap"><table class="dstats">' + STAT_HEAD + statRows(gs) + "</table></div>" + plot(gs) + '<div class="muted sm">Dots are single values; the bar is the mean and the whiskers are ± SD. LabGorilla does not run statistical tests. Use Prism for that and note the test in a Figure card.</div>' : '<div class="muted sm">No number columns found yet, so there are no statistics.</div>';
    return h;
  }
  function dataPrint(e, c) {
    const gs = groupsOf(c); if (!c.rows.length) return "";
    return '<div class="small">' + c.rows.length + " rows × " + c.cols.length + " columns" + (c.src ? " · from " + esc(c.src) : "") + "</div>" + (gs.length ? '<table class="t">' + STAT_HEAD + statRows(gs) + "</table>" + '<div class="dpp">' + plot(gs) + "</div>" : "") +
      '<table class="t" style="margin-top:5pt"><tr>' + c.cols.map(n => "<th>" + esc(n) + "</th>").join("") + "</tr>" + c.rows.slice(0, 12).map(r => "<tr>" + r.map(v => "<td>" + esc(v) + "</td>").join("") + "</tr>").join("") + "</table>" + (c.rows.length > 12 ? '<div class="small">First 12 of ' + c.rows.length + " rows.</div>" : "");
  }
  const prismText = c => {
    const gs = c.groupBy !== "" && c.groupBy != null ? groupsOf(c) : c.cols.map((n, j) => ({ name: n, vals: colVals(c, j) })).filter((g, j) => isNumCol(c, j));
    const L = Math.max(0, ...gs.map(g => g.vals.length)); return [gs.map(g => g.name).join("\t")].concat(Array.from({ length: L }, (_, i) => gs.map(g => (g.vals[i] == null ? "" : g.vals[i])).join("\t"))).join("\n");
  };
  const dataGet = el => { const e = live(), c = e && cardOf(el.dataset.card); return c ? { e, c } : {}; };
  function load(c, t, name) {
    const p = parseTable(t); if (!p) { LB.toast("No table found in that text."); return false; }
    c.cols = p.cols; c.rows = p.rows; c.groupBy = ""; c.valueCol = ""; c.src = name || ""; LB.log(LB.cur(), "Loaded a data table (" + p.rows.length + " rows)"); LB.save(); LB.render(); return true;
  }
  A.dataPasteToggle = el => { LB.tmp.dpaste = LB.tmp.dpaste === el.dataset.card ? "" : el.dataset.card; LB.tmp.dtext = ""; LB.render(); };
  A.dataUse = el => { const { c } = dataGet(el); if (c && load(c, LB.tmp.dtext || "", "pasted data")) { LB.tmp.dpaste = ""; LB.render(); } };
  A.dataLoad = async el => { const { c } = dataGet(el), f = el.files && el.files[0]; try { el.value = ""; } catch (x) { } if (!c || !f) return; load(c, await f.text(), f.name); };
  A.dataRow = el => { const { c } = dataGet(el); if (!c) return; if (!c.cols.length) c.cols = ["Group", "Value"]; c.rows.push(c.cols.map(() => "")); LB.save(); LB.render(); };
  A.dataCol = el => { const { c } = dataGet(el); if (!c || c.cols.length >= 30) return; c.cols.push("Column " + (c.cols.length + 1)); c.rows.forEach(r => r.push("")); if (!c.rows.length) c.rows.push(c.cols.map(() => "")); LB.save(); LB.render(); };
  A.dataRmCol = el => { const { c } = dataGet(el); if (!c) return; const j = +el.dataset.j; c.cols.splice(j, 1); c.rows.forEach(r => r.splice(j, 1)); c.groupBy = ""; c.valueCol = ""; LB.save(); LB.render(); };
  A.dataRmRow = el => { const { c } = dataGet(el); if (!c) return; c.rows.splice(+el.dataset.i, 1); LB.save(); LB.render(); };
  A.dataClear = el => { const { c } = dataGet(el); if (!c || (c.rows.length && !confirm("Clear this table?"))) return; c.cols = []; c.rows = []; c.groupBy = ""; c.valueCol = ""; c.src = ""; LB.save(); LB.render(); };
  A.dataCopy = el => { const c = cardOf(el.dataset.card); if (c && c.rows.length) copy(prismText(c), "Copied. In Prism, create a Column table and paste."); };
  A.dataCsv = el => {
    const c = cardOf(el.dataset.card); if (!c || !c.rows.length) return; const q = v => (/[",;\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v);
    download((c.title || "data").replace(/[^\w\-]+/g, "_") + ".csv", [c.cols.map(q).join(",")].concat(c.rows.map(r => r.map(q).join(","))).join("\r\n") + "\r\n", "text/csv");
  };

  /* ================= FIGURE WITH LEGEND ================= */
  const WHAT = ["independent experiments", "biological replicates", "technical replicates", "spheroids", "wells", "images", "cells", "animals", "patients"];
  const SUMMARY = ["", "mean ± SD", "mean ± SEM", "median (IQR)", "individual values"];
  const TESTS = ["", "unpaired t-test", "Welch's t-test", "paired t-test", "Mann–Whitney test", "one-way ANOVA with Tukey's test", "one-way ANOVA with Dunnett's test", "two-way ANOVA with Bonferroni's test", "Kruskal–Wallis test with Dunn's test", "other"];
  const dot = s => { s = String(s || "").trim(); return s && !/[.!?]$/.test(s) ? s + "." : s; };
  function legendText(c) {
    const test = c.test === "other" ? c.testOther : c.test, nn = String(c.n || "").trim();
    return [c.fig && c.fig.trim() ? dot(c.fig) : "", dot(c.desc), c.summary && nn ? "Data are shown as " + c.summary + " of n = " + nn + (c.what ? " " + c.what : "") + "." : c.summary ? "Data are shown as " + c.summary + "." : nn ? "n = " + nn + (c.what ? " " + c.what : "") + "." : "",
      test ? "Statistical analysis: " + test + (c.software && c.software.trim() ? " (" + c.software.trim() + ")" : "") + (c.sig && c.sig.trim() ? "; " + c.sig.trim() : "") + "." : "", c.scale && c.scale.trim() ? "Scale bar: " + dot(c.scale) : ""].filter(Boolean).join(" ");
  }
  const imagesOf = e => e.files.filter(f => LB.isImage(f));
  function figBody(e, c, P, dis) {
    const imgs = imagesOf(e), cur = imgs.find(f => f.id === c.fid), dcs = extra(e).filter(x => x.type === "data" && x.rows.length);
    return '<div class="figrow"><div class="figimgbox">' + (cur ? '<img class="figimg" data-fid="' + cur.id + '" alt="' + esc(cur.name) + '">' : '<div class="figph">🖼<span>No image yet</span></div>') + "</div><div class=\"col grow\" style=\"gap:8px\">" +
      field("Image", '<select data-b="' + P + '.fid" data-render="1" ' + dis + '><option value="">' + (imgs.length ? "Choose an attached image…" : "No images attached yet") + "</option>" + imgs.map(f => '<option value="' + f.id + '"' + (f.id === c.fid ? " selected" : "") + ">" + esc(f.name) + "</option>").join("") + "</select>") +
      '<label class="btn sm" style="cursor:pointer;align-self:flex-start" title="Attach a PNG or JPEG, for example the graph exported from Prism. TIFF files cannot be shown in a browser.">⬆ Attach image…<input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" data-file="figAttach" data-card="' + c.id + '" hidden ' + dis + "></label>" +
      '<div class="muted sm">Export graphs from Prism, and images from ImageJ, as PNG or JPEG. The file is also kept on the Results tab.</div></div></div>' +
      '<div class="cfgrid">' + field("Figure label", txt(P, "fig", c.fig, dis, "e.g. Figure 2B")) + field("Software", txt(P, "software", c.software, dis, "e.g. GraphPad Prism 10")) + field("Scale bar", txt(P, "scale", c.scale, dis, "e.g. 100 µm")) + "</div>" +
      '<div class="lbl">What the figure shows</div>' + area(P, "desc", c.desc, dis, "e.g. Doxorubicin reduces spheroid viability after 72 h", 2) +
      '<div class="cfgrid">' + field("Data shown as", '<select data-b="' + P + '.summary" data-render="1" ' + dis + ">" + opts(SUMMARY, c.summary) + "</select>") +
      field("n", '<span class="row" style="gap:6px">' + txt(P, "n", c.n, dis, "e.g. 3", 'style="width:84px"') + '<select data-b="' + P + '.what" data-render="1" ' + dis + ' style="flex:1">' + opts(WHAT, c.what) + "</select></span>") +
      field("Statistical test", '<select data-b="' + P + '.test" data-render="1" ' + dis + ">" + opts(TESTS, c.test) + "</select>") + (c.test === "other" ? field("Test (describe)", txt(P, "testOther", c.testOther, dis, "e.g. two-way ANOVA with Šídák's test")) : "") +
      field("Significance", txt(P, "sig", c.sig, dis, "* p < 0.05, ** p < 0.01, *** p < 0.001")) + "</div>" +
      (dcs.length ? '<div class="row wrap sm" style="gap:8px"><span class="muted">Take n from a data table:</span>' + dcs.map(x => '<button class="btn sm" data-a="figN" data-card="' + c.id + '" data-src="' + x.id + '" ' + dis + ">" + esc(x.title) + "</button>").join("") + "</div>" : "") +
      '<div class="row"><span class="lbl grow">Figure legend (built from the fields above)</span><button class="link sm" data-a="figCopy" data-card="' + c.id + '">Copy legend</button></div><div class="legendbox">' + (legendText(c) ? esc(legendText(c)) : '<span class="muted">Fill in the fields above and the legend writes itself.</span>') + "</div>";
  }
  async function figPrint(e, c) {
    const f = imagesOf(e).find(x => x.id === c.fid); let img = ""; if (f) { const u = await LB.fileUrl(f); if (u) img = '<figure class="figp"><img src="' + u + '" alt="' + esc(f.name) + '"></figure>'; }
    const lg = legendText(c); return img + (lg ? '<div class="figlegend">' + esc(lg) + "</div>" : "");
  }
  A.figAttach = async el => {
    const e = live(), c = e && cardOf(el.dataset.card), f = el.files && el.files[0]; try { el.value = ""; } catch (x) { } if (!c || !f) return;
    const r = await LB.fileAdd(f); if (!r) return; e.files.push(r); c.fid = r.id; LB.log(e, "Attached " + f.name + " (figure)"); LB.save(); LB.render();
  };
  A.figN = el => {
    const e = live(), c = e && cardOf(el.dataset.card), d = e && extra(e).find(x => x.id === el.dataset.src); if (!c || !d) return;
    const ns = groupsOf(d).map(g => g.n); if (!ns.length) { LB.toast("That table has no numbers to count yet."); return; }
    const lo = Math.min(...ns), hi = Math.max(...ns); c.n = lo === hi ? String(lo) : lo + "–" + hi; LB.save(); LB.render();
  };
  A.figCopy = el => { const c = cardOf(el.dataset.card); if (c) copy(legendText(c), "Legend copied."); };

  /* ================= RAW DATA LOCATION ================= */
  const FORMATS = ["", "TIFF", "CZI (Zeiss)", "ND2 (Nikon)", "LIF (Leica)", "OIB / OIF (Olympus)", "LSM (Zeiss)", "AVI / MP4 (video)", "CSV / text", "Other"];
  function rawBody(e, c, P, dis) {
    return '<div class="muted sm">Large microscope files stay where they are. Write down where, so they can be found again.</div><div class="cfgrid">' +
      field("Instrument", txt(P, "inst", c.inst, dis, "e.g. Zeiss LSM 980, Nikon Ti2")) + field("Objective", txt(P, "obj", c.obj, dis, "e.g. 10× / 0.3 NA")) + field("Channels / lasers / exposure", txt(P, "chan", c.chan, dis, "e.g. 488 nm, 50 ms")) +
      field("File format", '<select data-b="' + P + '.format" data-render="1" ' + dis + ">" + opts(FORMATS, c.format) + "</select>") + field("Number of files / size", txt(P, "size", c.size, dis, "e.g. 48 files, 12 GB")) + field("Acquired on", '<input type="date" data-b="' + P + '.acq" value="' + esc(c.acq || e.date) + '" ' + dis + ">") + "</div>" +
      '<div class="row">' + field("Location", txt(P, "path", c.path, dis, "e.g. D:\\Microscopy\\2026-10-12\\C7  or  \\\\nas\\lab\\imaging\\C7"), "flex:1") + '<button class="btn sm" style="align-self:flex-end" data-a="rawCopy" data-card="' + c.id + '" title="Copy the location">Copy</button></div>';
  }
  function rawPrint(e, c) { return kv([["Instrument", c.inst], ["Objective", c.obj], ["Channels / exposure", c.chan], ["File format", c.format], ["Files / size", c.size], ["Acquired on", c.acq ? U.fmtLong(c.acq) : ""], ["Location", c.path]]); }
  A.rawCopy = el => { const c = cardOf(el.dataset.card); if (c) copy(c.path || "", c.path ? "Location copied." : "There is no location to copy yet."); };

  /* ================= register the card types ================= */
  Object.assign(TYPES, {
    imagej: { label: "Image analysis", desc: "How you analysed images in Fiji / ImageJ", make: () => ({ title: "Image analysis (ImageJ)", software: "Fiji (ImageJ 2.x)", plugins: "", input: "", scale: "", channels: "", thr: "", measure: "", out: "", steps: "", macro: "" }), body: ijBody, print: ijPrint, data: c => !!(c.input || c.steps || c.macro || c.scale || c.measure || c.out) },
    data: { label: "Data table", desc: "Paste or load a CSV; statistics and a plot", make: () => ({ title: "Data table", cols: [], rows: [], groupBy: "", valueCol: "", src: "" }), body: dataBody, print: dataPrint, data: c => c.rows.length > 0 },
    figure: { label: "Figure", desc: "Image or graph with an auto-written legend", make: () => ({ title: "Figure", fid: "", fig: "", desc: "", summary: "mean ± SD", n: "", what: "independent experiments", test: "", testOther: "", sig: "", software: "GraphPad Prism", scale: "" }), body: figBody, print: figPrint, data: c => !!(c.fid || c.desc || c.n || c.test) },
    rawdata: { label: "Raw data location", desc: "Where the microscope files are, and how acquired", make: () => ({ title: "Raw data", inst: "", obj: "", chan: "", format: "", size: "", acq: "", path: "" }), body: rawBody, print: rawPrint, data: c => !!(c.path || c.inst || c.size) }
  });

  /* ================= "Copy for Prism" on existing cards ================= */
  A.dilCopy = el => {
    const c = cardOf(el.dataset.card), s = c && K.dilSeries(c); if (!s) { LB.toast("Enter a start concentration and a dilution factor first."); return; }
    copy("Concentration (" + c.unit + ")\tResponse\n" + s.pts.map(p => +p.conc.toPrecision(6) + "\t").join("\n"), "Copied. In Prism, create an XY table and paste; add your measurements in the Y column.");
  };
  A.plateCopy = el => {
    const c = cardOf(el.dataset.card); if (!c) return; const f = { 6: [2, 3], 12: [3, 4], 24: [4, 6], 48: [6, 8], 96: [8, 12], 384: [16, 24] }[c.fmt] || [8, 12], R = f[0], C = f[1], name = id => (c.conds.find(k => k.id === id) || {}).name || "";
    const row = r => (r < 26 ? String.fromCharCode(65 + r) : "A" + String.fromCharCode(65 + r - 26));
    copy(["\t" + Array.from({ length: C }, (_, j) => j + 1).join("\t")].concat(Array.from({ length: R }, (_, r) => row(r) + "\t" + Array.from({ length: C }, (_, j) => name(c.wells[r * C + j])).join("\t"))).join("\n"), "Plate layout copied. Paste it into Excel or Prism.");
  };
})(window.LB);
