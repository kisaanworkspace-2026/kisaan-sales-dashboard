/* Page: Cities. Revenue is per order (first line's city); units/customers per line. */
Pages.geography = (() => {
  let els = {}, last = null;
  function compute(from, to, slot) {
    const D = Store.D, ny = D.dict.city.length, np = D.dict.prod.length, nc = D.custName.length, nd = to - from + 1, sel = F.mask(from, to, slot);
    const A = { rev: new Float64Array(ny), ord: new Int32Array(ny), units: new Float64Array(ny), cust: new Int32Array(ny), seen: new Uint8Array(ny * nc), day: new Float64Array(ny * nd), mat: new Float64Array(ny * np), nd, tot: 0, orders: 0 };
    const seenO = new Uint8Array(D.nOrders);
    for (let i = 0; i < D.n; i++) {
      if (!sel[i]) continue;
      const y = D.city[i], c = D.cust[i], k = D.oi[i];
      A.units[y] += D.qty[i]; A.mat[y * np + D.prod[i]] += D.qty[i];
      if (!A.seen[y * nc + c]) { A.seen[y * nc + c] = 1; A.cust[y]++; }
      if (!seenO[k]) { seenO[k] = 1; const t = D.oTotal[k]; A.rev[y] += t; A.ord[y]++; A.day[y * nd + D.day[i] - from] += t; A.tot += t; A.orders++; }
    }
    return A;
  }
  function openCity(y) {
    const D = Store.D, { from, to } = F.range(), sel = F.mask(from, to, 0), cu = new Map(), pu = new Map(), name = D.dict.city[y] || '(unknown)', seenO = new Set(), cr = new Map();
    for (let i = 0; i < D.n; i++) if (sel[i] && D.city[i] === y) { const c = D.cust[i], k = D.oi[i]; pu.set(D.prod[i], (pu.get(D.prod[i]) || 0) + D.qty[i]); if (!seenO.has(k)) { seenO.add(k); cr.set(c, (cr.get(c) || 0) + D.oTotal[k]); } }
    const tc = [...cr].sort((a, b) => b[1] - a[1]).slice(0, 12), tp = [...pu].sort((a, b) => b[1] - a[1]).slice(0, 8), kv = (l, v) => h('div', { class: 'dkv' }, h('span', null, l), h('b', null, v));
    UI.drawer(name, `${dLong(from)} – ${dLong(to)}`, h('div', null,
      h('div', { class: 'kvs' }, kv('Revenue', money0(last.rev[y])), kv('Orders', fmtInt(last.ord[y])), kv('Customers', fmtInt(last.cust[y])), kv('Units', fmtInt(last.units[y]))),
      h('button', { class: 'btn', style: { marginBottom: '10px' }, onclick: () => { F.toggle('cities', D.dict.city[y]); UI.closeDrawer(); } }, F.st.cities.has(D.dict.city[y]) ? 'Remove from filters' : 'Filter dashboard to this city'),
      h('h4', null, 'Top customers (revenue)'), h('table', { class: 'lines' }, h('tbody', null, tc.map(([c, r]) => h('tr', { class: 'click', onclick: () => UI.openCustomer && UI.openCustomer(c) }, h('td', null, D.custLabel[c]), h('td', { class: 'r' }, money0(r)))))),
      h('h4', null, 'Top products (units)'), h('table', { class: 'lines' }, h('tbody', null, tp.map(([p, u]) => h('tr', null, h('td', null, D.dict.prod[p]), h('td', { class: 'r' }, fmtInt(u))))))));
  }
  function update() {
    const D = Store.D, { from, to } = F.range(), A = last = compute(from, to, 0), pr = F.prevRange(), P = pr ? compute(pr.from, pr.to, 1) : null, ny = D.dict.city.length, np = D.dict.prod.length;
    els.P = P; els.sub.textContent = `${dLong(from)} – ${dLong(to)}` + (F.isActive() ? ' · filtered' : '');
    const ids = []; for (let y = 0; y < ny; y++) if (A.ord[y] > 0) ids.push(y); ids.sort((a, b) => A.rev[b] - A.rev[a]);
    const top5 = ids.slice(0, 5).reduce((s, y) => s + A.rev[y], 0), nm = y => D.dict.city[y] || '(unknown)';
    els.kpis.replaceChildren(UI.kpi({ label: 'Cities served', value: fmtInt(ids.length), delta: P ? (ids.length - P.ord.filter(v => v > 0).length) / Math.max(1, P.ord.filter(v => v > 0).length) : null }),
      UI.kpi({ label: 'Top city', value: ids.length ? nm(ids[0]) : '—', hint: ids.length ? money0(A.rev[ids[0]]) : '' }),
      UI.kpi({ label: 'Top 5 share of revenue', value: A.tot ? pct(top5 / A.tot, 0) : '—', hint: 'concentration' }),
      UI.kpi({ label: 'Avg revenue / city', value: ids.length ? money0(A.tot / ids.length) : '—', hint: 'in period' }),
      UI.kpi({ label: 'Avg customers / city', value: ids.length ? (ids.reduce((s, y) => s + A.cust[y], 0) / ids.length).toFixed(1) : '—', hint: 'in period' }));
    Charts.hbar(els.bars, ids.slice(0, 15).map(y => ({ key: D.dict.city[y], label: nm(y), value: A.rev[y], sub: fmtInt(A.ord[y]) + ' orders · ' + fmtInt(A.cust[y]) + ' customers', color: 'var(--c2)' })), { fmt: moneyC, tipFmt: money0, valueName: 'Revenue', selected: F.st.cities, onClick: it => F.toggle('cities', it.key) });
    // heat matrix: top 12 cities x top 10 products, colour = share of the city's units
    const pu = new Float64Array(np); for (const y of ids) for (let p = 0; p < np; p++) pu[p] += A.mat[y * np + p];
    const pids = Array.from({ length: np }, (_, p) => p).filter(p => pu[p] > 0).sort((a, b) => pu[b] - pu[a]).slice(0, 8), cids = ids.slice(0, 12);
    els.heat.replaceChildren(h('table', { class: 'heat' }, h('thead', null, h('tr', null, h('th', null, ''), pids.map(p => h('th', { class: 'r', title: D.dict.prod[p] }, D.dict.prod[p].replace('Kisaan ', '').replace('Milk ', 'M ').slice(0, 14))))),
      h('tbody', null, cids.map(y => { const tot = A.units[y] || 1; return h('tr', null, h('td', { class: 'strong' }, nm(y)), pids.map(p => { const v = A.mat[y * np + p], s = v / tot; return h('td', { class: 'r hc', title: `${nm(y)} · ${D.dict.prod[p]}: ${fmtInt(v)} units (${pct(s, 0)} of city)`, style: { background: `color-mix(in srgb, var(--c1) ${Math.round(Math.min(1, s * 2.2) * 80)}%, transparent)` } }, v ? fmtInt(v) : ''); })); }))));
    els.tbl.update(ids);
  }
  function mount(root) {
    const D = Store.D, nm = y => D.dict.city[y] || '(unknown)', dl = y => { const P = els.P; return P && P.rev[y] ? (last.rev[y] - P.rev[y]) / P.rev[y] : null; };
    els.sub = h('span'); els.kpis = h('div', { class: 'kpis k5' }); els.bars = h('div'); els.heat = h('div', { class: 'twrap' });
    els.tbl = UI.table({ pageSize: 15, rows: [], onRow: openCity, csvName: 'cities.csv', search: { placeholder: 'Search city…', text: y => nm(y).toLowerCase() }, cols: [
      { label: 'City', get: nm, cls: () => 'strong' },
      { label: 'Revenue', align: 'r', get: y => money0(last.rev[y]), val: y => last.rev[y], csv: y => last.rev[y].toFixed(2) },
      { label: 'Share', align: 'r', get: y => pct(last.rev[y] / last.tot), val: y => last.rev[y], csv: y => (last.rev[y] / last.tot).toFixed(4) },
      { label: 'Orders', align: 'r', get: y => fmtInt(last.ord[y]), val: y => last.ord[y], csv: y => last.ord[y] },
      { label: 'Customers', align: 'r', get: y => fmtInt(last.cust[y]), val: y => last.cust[y], csv: y => last.cust[y] },
      { label: 'Avg order', align: 'r', get: y => money0(last.rev[y] / last.ord[y]), val: y => last.rev[y] / last.ord[y] },
      { label: 'Units', align: 'r', get: y => fmtInt(last.units[y]), val: y => last.units[y], csv: y => last.units[y] },
      { label: 'vs prev', align: 'r', get: y => { const d = dl(y); return d == null ? '—' : h('span', { class: 'delta ' + (d >= 0 ? 'good' : 'bad') }, (d >= 0 ? '▲ ' : '▼ ') + pct(Math.abs(d))); }, val: y => dl(y) ?? -9, csv: y => dl(y) == null ? '' : dl(y).toFixed(4) },
      { label: 'Trend', get: y => Charts.spark(last.day.subarray(y * last.nd, (y + 1) * last.nd), 'var(--c2)'), val: y => last.rev[y], csv: () => '' }] });
    root.replaceChildren(h('div', { class: 'pagehead' }, h('h2', null, 'Cities'), els.sub), els.kpis, h('div', { class: 'grid' },
      UI.card('Top 15 cities by revenue', els.bars, { span: 5, sub: 'Click a bar to filter' }),
      UI.card('What each city buys', els.heat, { span: 7, sub: 'Units; shading = share of that city\'s units · top 12 cities × top 8 products' }),
      UI.card('All cities', els.tbl, { span: 12, sub: 'Click a row for top customers and products' })));
  }
  return { title: 'Cities', mount, update };
})();
