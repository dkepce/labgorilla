/* Labbook — Inventory view: all materials, types, suppliers, order list. */
(function (LB) {
  const U = LB.U, esc = U.esc, A = LB.actions;

  const usedIn = id => Object.values(LB.D.entries).filter(e => e.mats.some(m => m.id === id)).length;
  const firmText = it => it.firms.map(f => [f.name, f.price].filter(Boolean).join(" · ")).filter(Boolean).join("   ") || "no suppliers yet";

  function page() {
    const D = LB.D, q = (LB.tmp.invQ || "").trim().toLowerCase(), t = LB.tmp.invType;
    const rows = D.items.filter(i => (!t || i.kind === t) && (!q || (i.name + " " + i.sub + " " + i.kind).toLowerCase().includes(q)));
    const chips = ['<button class="pill' + (!t ? " on" : "") + '" data-a="invType" data-k="">All (' + D.items.length + ")</button>"]
      .concat(D.types.map(k => '<button class="pill' + (t === k ? " on" : "") + '" data-a="invType" data-k="' + esc(k) + '">' + esc(k) + " (" + D.items.filter(i => i.kind === k).length + ")</button>"));
    return '<div class="page" data-scroll="page"><div class="row"><h1 class="grow" style="margin:0;font-size:26px;letter-spacing:-.01em">Inventory</h1>' +
      '<input type="text" placeholder="Search inventory…" aria-label="Search inventory" data-b="tmp.invQ" data-rin="1" value="' + esc(LB.tmp.invQ) + '" style="width:220px" autocomplete="off"><button class="btn pri" data-a="toggleNewMat">+ New item</button></div>' +
      (LB.tmp.showNewMat ? LB.newMatForm("inv") : "") +
      '<div class="types">' + chips.join("") + '<input type="text" placeholder="+ new type, Enter" aria-label="Create a new type" data-b="tmp.newType" data-enter="addType" value="' + esc(LB.tmp.newType || "") + '" style="width:150px;border-style:dashed;border-radius:99px;padding:5px 12px" autocomplete="off"></div>' +
      (rows.map(it => {
        const i = D.items.indexOf(it);
        return '<div class="item"><div class="invrow"><div class="n"><b data-live="D.items.' + i + '.name">' + esc(it.name) + '</b><div class="muted sm">' + esc(it.sub) + '</div></div><span class="kind" style="width:78px">' + esc(it.kind) + '</span><input type="text" placeholder="stock on hand" aria-label="Stock on hand" data-b="D.items.' + i + '.stock" value="' + esc(it.stock) + '"><div class="f">' + esc(firmText(it)) + '</div><span class="muted sm" style="width:70px">used in ' + usedIn(it.id) + '</span>' +
          '<button class="btn sm' + (it.reorder ? " on" : "") + '" style="' + (it.reorder ? "background:var(--acc-s);color:var(--acc-d)" : "") + '" data-a="reorder" data-id="' + it.id + '">' + (it.reorder ? "On order list ✓" : "Add to order list") + '</button><button class="btn sm" data-a="toggleItem" data-id="' + it.id + '">' + (LB.tmp.openItem === it.id ? "Hide details" : "Details") + "</button></div>" +
          (LB.tmp.openItem === it.id ? LB.itemDetails(it) : "") + "</div>";
      }).join("") || '<div class="muted" style="padding:10px 2px">' + (D.items.length ? "Nothing matches. Try another type or search." : "Your inventory is empty. Add the first item with “+ New item”.") + "</div>") + "</div>";
  }
  function order() {
    const list = LB.D.items.filter(i => i.reorder);
    return '<aside class="order" data-scroll="order"><div class="h">Order list</div><div class="muted sm" style="line-height:1.45">Items you marked “Add to order list”, with their suppliers and prices.</div>' +
      list.map(it => { const l = (it.firms.find(f => /^https?:\/\//i.test(f.link)) || {}).link; return '<div class="lin"><div class="n"><b>' + esc(it.name) + '</b><div class="s" style="line-height:1.4">' + esc(firmText(it)) + "</div>" + (l ? '<a class="sm" href="' + esc(l) + '" target="_blank" rel="noopener"><b>Open order page</b></a>' : "") + '</div><button class="x" data-a="reorder" data-id="' + it.id + '" aria-label="Remove from order list">×</button></div>'; }).join("") +
      (list.length ? "" : '<div class="muted sm">Nothing to order right now.</div>') +
      '<button class="btn" style="margin-top:auto" data-a="copyOrder">Copy order list</button></aside>';
  }
  LB.views.inventory = () => page() + order();

  A.invType = el => { LB.tmp.invType = el.dataset.k; LB.render(); };
  A.addType = el => { const v = el.value.trim(); if (!v) return; if (!LB.D.types.includes(v)) LB.D.types.push(v); LB.tmp.newType = ""; LB.save(); LB.render(); };
  A.reorder = el => { const it = LB.D.items.find(i => i.id === el.dataset.id); it.reorder = !it.reorder; LB.save(); LB.render(); };
  A.copyOrder = async () => {
    const list = LB.D.items.filter(i => i.reorder); if (!list.length) { LB.toast("The order list is empty."); return; }
    const txt = list.map(it => "• " + it.name + (it.sub ? " (" + it.sub + ")" : "") + (it.firms.length ? "\n    " + it.firms.map(f => [f.name, f.price, f.link].filter(Boolean).join(" · ")).join("\n    ") : "")).join("\n");
    try { await navigator.clipboard.writeText(txt); LB.toast("Order list copied."); } catch (e) { LB.toast("Could not copy. Select and copy it manually."); }
  };
})(window.LB);
