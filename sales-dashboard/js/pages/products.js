/* Page: Products. Metrics are units / orders containing / buyers (order totals can't be split per product). */
Pages.products = (() => {
  let els = {}, last = null, mm = store.get('pmat', 'u');
  const grpN = D => D.hasST ? D.stAll : D.dict.type, grpOf = (D, i) => D.hasST ? D.cST[D.cust[i]] : D.type[i];
  const plast = D => D._plast || (D._plast = (() => { const a = new Int32Array(D.dict.prod.length).fill(-1); for (let i = 0; i < D.n; i++) if (D.day[i] > a[D.prod[i]]) a[D.prod[i]] = D.day[i]; return a; })());
  function compute(from, to, slot) {
    const D = Store.D, np = D.dict.prod.length, nc = D.custName.length, nt = D.dict.type.length, nd = to - from + 1, sel = F.mask(from, to, slot), ng = grpN(D).length;
    const A = { mU: new Float64Array(np * ng), mO: new Int32Array(np * ng), mR: new Float64Array(np * ng), ng, mlast: new Int32Array(np).fill(-1), u: new Float64Array(np), o: new Int32Array(np), b: new Int32Array(np), lastO: new Int32Array(np).fill(-1), seen: new Uint8Array(np * nc),
      byType: new Float64Array(np * nt), day: new Float64Array(np * nd), nd, tot: 0, orders: 0 };
    const seenO = new Uint8Array(D.nOrders);
    for (let i = 0; i < D.n; i++) {
      if (!sel[i]) continue;
      const p = D.prod[i], q = D.qty[i], k = D.oi[i], c = D.cust[i];
      A.u[p] += q; A.tot += q; A.byType[p * nt + D.type[i]] += q; A.day[p * nd + D.day[i] - from] += q;
      const gi = p * ng + grpOf(D, i); A.mU[gi] += q;
      if (A.lastO[p] !== k) { A.lastO[p] = k; A.o[p]++; A.mO[gi]++; A.mR[gi] += D.oTotal[k]; }
      if (!A.seen[p * nc + c]) { A.seen[p * nc + c] = 1; A.b[p]++; }
      if (!seenO[k]) { seenO[k] = 1; A.orders++; }
    }
    return A;
  }
  function openProduct(p) {
    const D = Store.D, { from, to } = F.range(), sel = F.mask(from, to, 0), cu = new Map();
    for (let i = 0; i < D.n; i++) if (sel[i] && D.prod[i] === p) cu.set(D.cust[i], (cu.get(D.cust[i]) || 0) + D.qty[i]);
    const top = [...cu].sort((a, b) => b[1] - a[1]).slice(0, 15), name = D.dict.prod[p];
    UI.drawer(name, `${dLong(from)} – ${dLong(to)}`, h('div', null,
      h('div', { class: 'kvs' }, h('div', { class: 'dkv' }, h('span', null, 'Units'), h('b', null, fmtInt(last.u[p]))), h('div', { class: 'dkv' }, h('span', null, 'Orders containing'), h('b', null, fmtInt(last.o[p]))), h('div', { class: 'dkv' }, h('span', null, 'Buyers'), h('b', null, fmtInt(last.b[p])))),
      h('button', { class: 'btn', style: { marginBottom: '14px' }, onclick: () => { F.toggle('prods', name); UI.closeDrawer(); } }, F.st.prods.has(name) ? 'Remove from filters' : 'Filter dashboard to this product'),
      h('table', { class: 'lines' }, h('thead', null, h('tr', null, h('th', null, 'Top buyers'), h('th', { class: 'r' }, 'Units'))), h('tbody', null, top.map(([c, u]) => h('tr', null, h('td', null, UI.storeLink(c)), h('td', { class: 'r' }, fmtInt(u))))))));
  }
  function update() {
    const D = Store.D, { from, to } = F.range(), A = last = compute(from, to, 0), pr = F.prevRange(), P = pr ? compute(pr.from, pr.to, 1) : null, np = D.dict.prod.length, nt = D.dict.type.length, nd = A.nd;
    const ids = [], allIds = [], zero = []; for (let p = 0; p < np; p++) { allIds.push(p); if (A.u[p] > 0) ids.push(p); else zero.push(p); } ids.sort((a, b) => A.u[b] - A.u[a]); allIds.sort((a, b) => A.u[b] - A.u[a] || D.dict.prod[a].localeCompare(D.dict.prod[b])); els.ids = ids;
    els.sub.textContent = `${dLong(from)} – ${dLong(to)}` + (F.isActive() ? ' · filtered' : '');
    const best = ids[0], avgU = A.orders ? A.tot / A.orders : 0, top3 = ids.slice(0, 3).reduce((s, p) => s + A.u[p], 0);
    els.kpis.replaceChildren(
      UI.kpi({ label: 'Products sold', value: fmtInt(ids.length), hint: 'of ' + np + ' in range' }),
      UI.kpi({ label: 'Units sold', value: fmtInt(A.tot), delta: P && P.tot ? (A.tot - P.tot) / P.tot : null, hint: 'full range' }),
      UI.kpi({ label: 'Units per order', value: avgU.toFixed(1), hint: fmtInt(A.orders) + ' orders' }),
      UI.kpi({ label: 'Best seller', value: best != null ? D.dict.prod[best] : '—', hint: best != null ? fmtInt(A.u[best]) + ' units' : '' }),
      UI.kpi({ label: 'Top 3 share of units', value: A.tot ? pct(top3 / A.tot, 0) : '—', hint: 'concentration' }));
    // units over time (all selected products)
    const g = nd < 45 ? 1 : nd < 190 ? 7 : 30, x = [], u = [], o = [];
    const dayU = new Float64Array(nd); for (const p of ids) for (let d = 0; d < nd; d++) dayU[d] += A.day[p * nd + d];
    for (let d = 0; d < nd; d += g) { let s = 0; for (let j = d; j < Math.min(nd, d + g); j++) s += dayU[j]; x.push(from + d); u.push(s); }
    Charts.trend(els.trend, { x, a: { name: 'Units', data: u, fmt: fmtInt, axis: compact }, b: { name: 'Units (bars)', data: u, fmt: fmtInt }, label: i => (g === 1 ? '' : 'From ') + dLong(x[i]), tick: i => dShort(x[i]) });
    // product x order type (stacked, top 10)
    const mx = Math.max(1, ...ids.slice(0, 10).map(p => A.u[p]));
    els.stack.replaceChildren(h('div', { class: 'stk' }, ids.slice(0, 10).map(p => h('div', { class: 'hrow' },
      h('div', { class: 'hl', title: D.dict.prod[p] + ' – click for top buyers', onclick: () => openProduct(p) }, D.dict.prod[p]),
      h('div', { class: 'ht', style: { display: 'flex', width: '100%' } }, h('div', { style: { display: 'flex', height: '100%', width: A.u[p] / mx * 100 + '%' } },
        Array.from({ length: nt }, (_, t) => { const v = A.byType[p * nt + t]; return v ? h('div', { style: { width: v / A.u[p] * 100 + '%', background: D.typeColor[t] }, title: D.dict.type[t].toUpperCase() + ': ' + fmtInt(v) }) : null; }))),
      h('div', { class: 'hv' }, fmtInt(A.u[p]))))),
      h('div', { class: 'legend row' }, D.dict.type.map((t, i) => h('span', { class: 'lg' }, h('i', { style: { background: D.typeColor[i] } }), t.toUpperCase()))));
    UI.wireKpis(els.kpis, [[() => UI.jump(els.tbl), 'Click: jump to the full product list'], [() => UI.jump(els.trend), 'Click: jump to units over time'], [() => UI.jump(els.stack), 'Click: jump to the top products chart'],
      [() => best != null && openProduct(best), 'Click: open the best seller (top buyers, filter)'], [() => UI.jump(els.stack), 'Click: jump to the top products chart']]);
    els.tbl.update(allIds);
    // not sold in the period (last sale is all-time, so it ignores the date filter)
    const PL = plast(D); zero.sort((a, b) => PL[b] - PL[a]);
    els.zero.update(zero); 
    els.zn.textContent = zero.length ? zero.length + ' of ' + np + ' products' : 'every product sold';
    renderMatrix();
    els.P = P;
  }
  function renderMatrix() {
    const D = Store.D, A = last, ids = els.ids || [], ng = A.ng, names = grpN(D), V = mm === 'u' ? A.mU : mm === 'o' ? A.mO : A.mR;
    const fm = mm === 'r' ? v => '$' + Math.round(v).toLocaleString('en-AU') : fmtInt;
    const cols = []; for (let g = 0; g < ng; g++) { let t = 0; for (const p of ids) t += V[p * ng + g]; if (t > 0 || !D.hasST) cols.push(g); }
    let mx = 0; for (const p of ids) for (const g of cols) mx = Math.max(mx, V[p * ng + g]);
    const rowTot = p => mm === 'u' ? A.u[p] : mm === 'o' ? A.o[p] : cols.reduce((s, g) => s + V[p * ng + g], 0);
    const th = (t, k) => h('th', { class: 'r' }, t, UI.info ? UI.info(t, 'col', k) : null);
    els.mtbl.replaceChildren(h('table', { class: 'lines heat' }, h('thead', null, h('tr', null, h('th', null, 'Product'), cols.map(g => h('th', { class: 'r' }, names[g])), th('Total', 'matrix-total'))),
      h('tbody', null, ids.map(p => h('tr', { class: 'click', title: 'Click for top buyers of ' + D.dict.prod[p], onclick: () => openProduct(p) }, h('td', { class: 'strong' }, D.dict.prod[p]), cols.map(g => { const v = V[p * ng + g]; return h('td', { class: 'r hc', style: v ? { background: 'color-mix(in srgb, var(--c1) ' + Math.round(8 + 42 * v / mx) + '%, transparent)' } : { color: 'var(--mut)' } }, v ? fm(v) : '·'); }), h('td', { class: 'r strong' }, fm(rowTot(p)))))),
      mm === 'u' ? h('tfoot', null, h('tr', null, h('td', { class: 'strong' }, 'All products'), cols.map(g => { let t = 0; for (const p of ids) t += A.mU[p * ng + g]; return h('td', { class: 'r strong' }, fmtInt(t)); }), h('td', { class: 'r strong' }, fmtInt(A.tot)))) : null));
    els.mseg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === mm));
    els.mnote.textContent = (D.hasST ? 'Columns = store type (B2C customers are "Unmapped")' : 'Columns = order type') + (mm === 'r' ? ' · Order revenue = total of the orders that contain the product, so it is NOT split per product and rows overlap.' : mm === 'o' ? ' · Orders containing the product.' : ' · Units delivered.');
  }
  function mount(root) {
    const D = Store.D, dl = p => { const P = els.P; if (!P || !P.u[p]) return null; return (last.u[p] - P.u[p]) / P.u[p]; };
    els.sub = h('span'); els.kpis = h('div', { class: 'kpis k5' }); els.trend = h('div'); els.stack = h('div');
    els.tbl = UI.table({ pageSize: 15, rows: [], onRow: openProduct, csvName: 'products.csv', search: { placeholder: 'Search product…', text: p => D.dict.prod[p].toLowerCase() }, cols: [
      { label: 'Product', get: p => D.dict.prod[p], cls: () => 'strong' },
      { label: 'Units', align: 'r', get: p => fmtInt(last.u[p]), val: p => last.u[p], csv: p => last.u[p] },
      { label: 'Share', align: 'r', get: p => last.tot ? pct(last.u[p] / last.tot) : '—', val: p => last.u[p], csv: p => (last.u[p] / last.tot).toFixed(4) },
      { label: 'Orders', align: 'r', get: p => fmtInt(last.o[p]), val: p => last.o[p], csv: p => last.o[p] },
      { label: 'Buyers', align: 'r', get: p => fmtInt(last.b[p]), val: p => last.b[p], csv: p => last.b[p] },
      { label: 'Units / order', align: 'r', get: p => last.o[p] ? (last.u[p] / last.o[p]).toFixed(1) : '—', val: p => last.o[p] ? last.u[p] / last.o[p] : -1 },
      { label: 'vs prev', align: 'r', get: p => { const d = dl(p); return d == null ? '—' : h('span', { class: 'delta ' + (d >= 0 ? 'good' : 'bad') }, (d >= 0 ? '▲ ' : '▼ ') + pct(Math.abs(d))); }, val: p => dl(p) ?? -9, csv: p => dl(p) == null ? '' : dl(p).toFixed(4) },
      { label: 'Trend', get: p => Charts.spark(last.day.subarray(p * last.nd, (p + 1) * last.nd), 'var(--c2)'), val: p => last.u[p], csv: () => '' }] });
    els.mseg = h('div', { class: 'seg' }, [['u', 'Units'], ['o', 'Orders'], ['r', 'Order revenue']].map(([k, t]) => h('button', { type: 'button', 'data-m': k, onclick: () => { mm = k; store.set('pmat', k); renderMatrix(); } }, t)));
    els.mtbl = h('div', { class: 'scrollx' }); els.mnote = h('div', { class: 'kv-hint', style: { fontSize: '12px', margin: '8px 0 0' } }); els.zn = h('span');
    els.zero = UI.table({ pageSize: 10, rows: [], onRow: openProduct, csvName: 'not-sold-in-period.csv', search: { placeholder: 'Search product…', text: p => D.dict.prod[p].toLowerCase() }, cols: [
      { label: 'Product', get: p => D.dict.prod[p], cls: () => 'strong' },
      { label: 'Last sold (all time)', get: p => plast(D)[p] < 0 ? 'never' : dLong(plast(D)[p]), val: p => plast(D)[p], csv: p => plast(D)[p] < 0 ? '' : dLong(plast(D)[p]) },
      { label: 'Days since last sale', align: 'r', get: p => plast(D)[p] < 0 ? '—' : fmtInt(D.maxDay - plast(D)[p]), val: p => plast(D)[p] < 0 ? -1 : D.maxDay - plast(D)[p], csv: p => plast(D)[p] < 0 ? '' : D.maxDay - plast(D)[p] }] });
    els.zeroCard = UI.card('Not sold in period', els.zero, { span: 5, sub: 'Products in the data with no units in the selected dates', tools: els.zn });
    root.replaceChildren(h('div', { class: 'pagehead' }, h('h2', null, 'Products'), els.sub), els.kpis,
      h('div', { class: 'grid' },
        UI.card('Units sold over time', els.trend, { span: 7 }),
        UI.card('Top 10 products by order type', els.stack, { span: 5, sub: 'Bar length = units · colours = order type' }),
        UI.card('Product × store type', h('div', null, els.mtbl, els.mnote), { span: 7, sub: 'Which kinds of store buy which product', tools: els.mseg }),
        els.zeroCard,
        UI.card('All products', els.tbl, { span: 12, sub: 'Every product in the data, including zero sales in the period · click a row for top buyers · revenue is per order, so products show units' })));
  }
  return { title: 'Products', mount, update };
})();
