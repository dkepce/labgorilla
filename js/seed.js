/* LabGorilla — example data ("Load example data"). Dates are relative to today. */
(function (LB) {
  const U = LB.U;
  LB.seedDemo = function () {
    const D = LB.D, t = U.today(), now = Date.now();
    const item = (name, kind, sub, firms, expDays) => { const it = { id: U.uid(), name, kind, sub, expires: expDays == null ? "" : U.add(t, expDays), stock: "", reorder: false, firms: firms || [], docs: [] }; D.items.push(it); return it.id; };
    const mcf7 = item("MCF-7", "cell line", "P18 · freezer box 3B");
    const col = item("Collagen I, rat tail", "reagent", "lot 220518 · 4 °C", [{ name: "Supplier A", price: "€ 148 / 100 mg", link: "https://example.com/collagen" }, { name: "Supplier B", price: "€ 131 / 100 mg", link: "" }], 200);
    const dmem = item("DMEM + 10% FBS", "medium", "opened 02 Oct · use by 16 Oct", [], 5);
    const pbs = item("PBS, sterile", "reagent", "lot 0911 · room temperature");
    const chip = item("Chip batch C7", "chips", "PDMS · bonded");
    item("Doxorubicin 10 mM", "drug", "−20 °C · aliquot 3", [], -3);
    const proto = (title, desc, steps, mats, hist) => { const id = U.uid(); D.protocols[id] = { title, ver: hist.length, desc, steps, mats, history: hist.map((n, i) => ({ v: hist.length - i, note: n, at: now })) }; return id; };
    const pSph = proto("Spheroid loading into perfusion chip", "Load pre-formed spheroids into the culture chamber of a PDMS perfusion chip and start low-flow perfusion.",
      ["Prime channels with PBS, 5 min", "Coat chamber with collagen I, 30 min", "Collect spheroids and wash in medium", "Load 8 spheroids per chip at 2 µL/min", "Start perfusion at 0.5 µL/min and image at 0 h"], [mcf7, col, dmem, pbs, chip], ["Added collagen coating step", "Lowered loading flow rate to 2 µL/min", "First version"]);
    const pPl = proto("Plasma bonding of PDMS to glass", "Oxygen-plasma bonding of PDMS chips to glass slides, followed by a leak test.",
      ["Clean PDMS and glass with isopropanol", "Plasma-treat both surfaces, 60 s", "Bond immediately and bake at 70 °C, 20 min", "Leak test with dyed water"], [chip, pbs], ["Plasma time changed from 30 s to 60 s", "First version"]);
    proto("Cell passaging, adherent lines", "Routine passaging of adherent cell lines such as MCF-7.",
      ["Warm medium and PBS to 37 °C", "Wash cells with PBS", "Add trypsin and incubate 3–5 min", "Neutralise with medium and count cells", "Reseed at the planned density"], [mcf7, dmem, pbs], ["First version"]);

    const pr = { id: U.uid(), name: "Tumour-on-chip" }; D.projects.push(pr);
    const exp = (name) => { const x = { id: U.uid(), projectId: pr.id, name, num: ++D.expSeq }; D.experiments.push(x); return x; };
    const e7 = exp("Spheroid loading"), e6 = exp("Flow calibration");
    const mk = (x, n, o) => {
      const e = Object.assign({ id: U.uid(), expId: x.id, code: LB.expCode(x) + U.letter(n), locked: false, enteredAt: now, entered: o.date, aim: "", hyp: "", results: "", concl: "", sn: ["", "", "", "", ""], steps: [], protocol: null, map: LB.newMap(), mats: [], files: [], comments: [], hist: [] }, o);
      e.hist.push({ at: now, msg: "Entry created (example)" }); D.entries[e.id] = e; return e;
    };
    const steps = (arr, done) => arr.map((s, i) => ({ t: s, done: i < done }));
    const m = ids => ids.map(id => ({ id, used: "", left: "", unit: "" }));
    mk(e7, 2, { title: "Chip bonding, batch C7", date: U.add(t, -4), entered: U.add(t, -1), locked: true, aim: "Bond PDMS chips to glass by oxygen plasma and test for leaks.", hyp: "60 s plasma gives leak-free chips at 5 µL/min.", results: "No leaks at 60 s. 30 s chips delaminated.", concl: "Use 60 s plasma for all future batches.", protocol: { id: pPl, ver: 2, title: "Plasma bonding of PDMS to glass" }, steps: steps(D.protocols[pPl].steps, 4), mats: m([chip, pbs]) });
    mk(e7, 1, { title: "Spheroid formation, day 4", date: U.add(t, -2), locked: true, aim: "Check that MCF-7 spheroids reach 150 µm by day 4.", hyp: "Seeding 1000 cells per well gives uniform spheroids.", results: "Mean diameter about 170 µm, uniform in 22 of 24 wells.", concl: "Good enough to proceed to chip loading.", steps: steps(["Seed 1000 cells per well", "Image at day 2 and day 4"], 2), mats: m([mcf7, dmem]) });
    const cur = mk(e7, 0, { title: "Seeding on C7: spheroids into the perfusion chip", date: t, aim: "Load MCF-7 spheroids into the culture chamber of chip C7 and verify integrity under 0.5 µL/min perfusion before the drug series.", hyp: "Spheroids of 150–200 µm stay intact at this flow rate for 24 h.", protocol: { id: pSph, ver: 3, title: "Spheroid loading into perfusion chip" }, steps: steps(D.protocols[pSph].steps, 3), mats: m([mcf7, col, dmem, chip]), comments: [{ who: "Supervisor", text: "Please add the spheroid diameter distribution before the drug series.", at: now }] });
    cur.map.cells.forEach((c, i) => { c.on = i !== 7; });
    if (LB.newCard) {   // a few example lab cards on the current entry
      const pl = LB.newCard("plate"); pl.fmt = "24"; pl.title = "Drug plate (24-well)"; pl.conds = [{ id: "k1", name: "Vehicle", color: "#9ca3af" }, { id: "k2", name: "Dox 1 µM", color: "#f97316" }, { id: "k3", name: "Dox 10 µM", color: "#ef4444" }];
      pl.wells = Array.from({ length: 24 }, (_, i) => (i % 6 < 2 ? "k1" : i % 6 < 4 ? "k2" : "k3"));
      const tl = LB.newCard("timeline"); tl.events = [{ day: 0, kind: "seed", label: "Load spheroids", done: true }, { day: 1, kind: "drug", label: "Start doxorubicin", done: false }, { day: 2, kind: "medium", label: "Refresh medium", done: false }, { day: 4, kind: "image", label: "Live/dead imaging", done: false }];
      const fl = LB.newCard("flow"); Object.assign(fl, { chip: "C7", rate: "0.5", dur: "24", medium: "DMEM + 10% FBS" });
      const ij = Object.assign(LB.newCard("imagej"), { input: "C7_day4_*.tif, 20 images", scale: "0.645 µm / pixel", channels: "calcein, PI", thr: "Otsu", measure: "Area, Feret's diameter", steps: "Gaussian blur σ = 2 → threshold → Analyze Particles (size 50–∞ µm²)", macro: ['run("Set Scale...", "distance=1 known=0.645 unit=um");', 'setAutoThreshold("Otsu dark");', 'run("Analyze Particles...", "size=50-Infinity display");'].join("\n") });
      const dt = Object.assign(LB.newCard("data"), { title: "Spheroid diameter (µm)", src: "example", groupBy: "0", cols: ["Treatment", "Diameter (µm)"], rows: [["Vehicle", "182"], ["Vehicle", "176"], ["Vehicle", "190"], ["Dox 1 µM", "151"], ["Dox 1 µM", "148"], ["Dox 1 µM", "160"], ["Dox 10 µM", "101"], ["Dox 10 µM", "95"], ["Dox 10 µM", "110"]] });
      const fg = Object.assign(LB.newCard("figure"), { fig: "Figure 1B", desc: "Doxorubicin reduces spheroid diameter after 72 h", n: "3", test: "one-way ANOVA with Dunnett's test", sig: "* p < 0.05, ** p < 0.01" });
      const rw = Object.assign(LB.newCard("rawdata"), { inst: "Zeiss LSM 980", obj: "10× / 0.3 NA", chan: "488 nm, 561 nm", format: "CZI (Zeiss)", size: "48 files, 12 GB", path: ["D:", "Microscopy", "2026-10-12", "C7"].join("\\") });
      cur.extra = [tl, fl, pl, ij, dt, fg, rw];
      cur.steps.forEach(s => { if (!s.done && !s.min) { s.min = 5; } });
    }
    mk(e6, 0, { title: "Syringe pump flow calibration", date: U.add(t, -9), locked: true, aim: "Compare set flow rate with measured outlet volume.", hyp: "Deviation stays below 5% down to 0.1 µL/min.", results: "Within 3% from 0.5 µL/min; 9% at 0.1 µL/min.", concl: "Use 0.5 µL/min or higher.", steps: steps(["Collect outlet for 30 min per rate"], 1), mats: m([pbs]) });
    D.events.push({ id: U.uid(), date: U.add(t, 1), time: "09:00", title: "Live/dead imaging at 24 h", kind: "imaging" }, { id: U.uid(), date: U.add(t, 2), time: "", title: "Passage MCF-7", kind: "passage" },
      { id: U.uid(), date: U.add(t, 3), time: "", title: "Start doxorubicin series", kind: "other" }, { id: U.uid(), date: U.add(t, 4), time: "", title: "Order collagen I", kind: "order" });
    if (LB.D.refs) {   // three well-known papers as example references
      const rf = (title, authors, journal, year, doi) => { const r = { id: U.uid(), title, authors, journal, year, doi, pmid: "", url: "", zkey: "", zlib: "", lib: true, folder: "" }; LB.D.refs.push(r); return r.id; };
      const r1 = rf("Microfluidic organs-on-chips", "Bhatia SN, Ingber DE", "Nature Biotechnology", "2014", "10.1038/nbt.2989");
      const r2 = rf("Hallmarks of cancer: the next generation", "Hanahan D, Weinberg RA", "Cell", "2011", "10.1016/j.cell.2011.02.013");
      const r3 = rf("Spheroid-based drug screen: considerations and practical approach", "Friedrich J, Seidel C, Ebner R, Kunz-Schughart LA", "Nature Protocols", "2009", "10.1038/nprot.2008.226");
      cur.refs = [{ id: r1, note: "Chip design, Figure 2" }, { id: r3, note: "" }]; D.protocols[pSph].refs = [{ id: r3, note: "Spheroid sizes" }];
    }
    LB.ui.cur = cur.id; LB.ui.view = "notebook"; LB.ui.sec = 0; LB.ui.openExp[e7.id] = true;
  };
})(window.LB);
