/* Page: Customers. Active/new/returning use the global filters + date range; "at risk" uses all-time data. */
Pages.customers = (() => {
  let els = {}, last = null, gap = store.get('riskgap', 30);
  const nc = () => Store.D.custName.length;
  function life(D) {                                              // all-time revenue per customer (cached per data load)
    if (D._life) return D._life;
    const rev = new Float64Array(nc()); for (let k = 0; k < D.nOrders; k++) rev[D.oCust[k]] += D.oTotal[k];
    return D._life = rev;
  }
  function compute(from, to) {
    const D = Store.D, n = nc(), sel = F.mask(from, to, 0), nd = to - from + 1, g = nd < 45 ? 1 : nd < 190 ? 7 : 30, nb = Math.ceil(nd / g);
    const A = { ord: new Int32Array(n), rev: new Float64Array(n), units: new Float64Array(n), lastIn: new Int32Array(n).fill(-1), g, nb,
      act: new Float64Array(nb), neu: new Float64Array(nb), lastB: new Int32Array(n).fill(-1), active: [], newC: 0, retC: 0, newRev: 0, retRev: 0, orders: 0, rev0: 0 };
    const seenO = new Uint8Array(D.nOrders);
    for (let i = 0; i < D.n; i++) {
      if (!sel[i]) continue;
      const c = D.cust[i], d = D.day[i], b = Math.floor((d - from) / g), k = D.oi[i];
      A.units[c] += D.qty[i];
      if (A.lastB[c] !== b) { A.lastB[c] = b; A.act[b]++; }
      if (A.ord[c] === 0 && A.units[c] > 0) { A.active.push(c); const isNew = D.cFirst[c] >= from; if (isNew) { A.newC++; A.neu[Math.floor((D.cFirst[c] - from) / g)]++; } else A.retC++; }
      if (!seenO[k]) { seenO[k] = 1; A.ord[c]++; A.rev[c] += D.oTotal[k]; A.orders++; A.rev0 += D.oTotal[k]; if (D.cFirst[c] >= from) A.newRev += D.oTotal[k]; else A.retRev += D.oTotal[k]; if (d > A.lastIn[c]) A.lastIn[c] = d; }
    }
    return A;
  }
  function risk() {
    const D = Store.D, L = life(D), out = [], lim = D.maxDay - gap;
    for (let c = 0; c < nc(); c++) if (D.cOrders[c] >= 2 && D.cLast[c] < lim && (!F.st.q.trim() || D.custSearch[c].includes(F.st.q.trim().toLowerCase()))) out.push(c);
    return out.sort((a, b) => L[b] - L[a]);
  }
  function openCustomer(c) {
    const D = Store.D, L = life(D), ord = [], pm = new Map();
    for (let k = 0; k < D.nOrders; k++) if (D.oCust[k] === c) { ord.push(k); for (let i = D.oStart[k]; i < D.oStart[k + 1]; i++) pm.set(D.prod[i], (pm.get(D.prod[i]) || 0) + D.qty[i]); }
    ord.sort((a, b) => D.oDay[b] - D.oDay[a]);
    const mix = [...pm].sort((a, b) => b[1] - a[1]).slice(0, 8), a0 = D.oStart[ord[0]], kv = (l, v) => h('div', { class: 'dkv' }, h('span', null, l), h('b', null, v));
    const gapAvg = D.cOrders[c] > 1 ? Math.round((D.cLast[c] - D.cFirst[c]) / (D.cOrders[c] - 1)) : null;
    UI.drawer(D.custLabel[c], 'Phone ' + D.custPhonesAll[c].join(', '), h('div', null,
      h('div', { class: 'kvs' }, kv('Address', (D.dict.addr[D.addr[a0]] + ', ' + D.dict.city[D.oCity[ord[0]]]).replace(/^, /, '')), kv('Lifetime revenue', money0(L[c])), kv('Orders', fmtInt(D.cOrders[c])), kv('First / last order', dLong(D.cFirst[c]) + ' / ' + dLong(D.cLast[c])), kv('Days since last order', D.maxDay - D.cLast[c]), kv('Typical gap between orders', gapAvg == null ? '—' : gapAvg + ' days')),
      h('h4', null, 'Favourite products (units)'), h('table', { class: 'lines' }, h('tbody', null, mix.map(([p, u]) => h('tr', null, h('td', null, D.dict.prod[p]), h('td', { class: 'r' }, fmtInt(u)))))),
      h('h4', null, 'Order history'), h('table', { class: 'lines' }, h('tbody', null, ord.slice(0, 60).map(k => h('tr', { class: 'click', onclick: () => UI.openOrder(k) }, h('td', null, dShort(D.oDay[k])), h('td', null, D.oId[k]), h('td', { class: 'r' }, money2(D.oTotal[k]))))))));
  }
  function update() {
    const D = Store.D, { from, to } = F.range(), A = last = compute(from, to), L = life(D), act = A.active.length;
    els.sub.textContent = `${dLong(from)} – ${dLong(to)}` + (F.isActive() ? ' · filtered' : '');
    const rk = risk(), atRiskRev = rk.reduce((s, c) => s + L[c], 0);
    els.kpis.replaceChildren(UI.kpi({ label: 'Active customers', value: fmtInt(act), hint: 'ordered in period' }), UI.kpi({ label: 'New customers', value: fmtInt(A.newC), hint: act ? pct(A.newC / act, 0) + ' of active' : '' }),
      UI.kpi({ label: 'Returning', value: fmtInt(A.retC), hint: act ? pct(A.retC / act, 0) + ' of active' : '' }), UI.kpi({ label: 'Orders per customer', value: act ? (A.orders / act).toFixed(1) : '—', hint: money0(act ? A.rev0 / act : 0) + ' revenue each' }),
      UI.kpi({ label: `Inactive ${gap}+ days`, value: fmtInt(rk.length), hint: money0(atRiskRev) + ' lifetime value' }));
    const x = Array.from({ length: A.nb }, (_, i) => from + i * A.g);
    Charts.trend(els.trend, { x, a: { name: 'New customers', data: Array.from(A.neu), fmt: fmtInt, axis: compact }, b: { name: 'Active customers', data: Array.from(A.act), fmt: fmtInt }, label: i => (A.g === 1 ? '' : A.g === 7 ? 'Week of ' : 'From ') + dLong(x[i]), tick: i => dShort(x[i]) });
    Charts.donut(els.mix, [{ key: 'n', label: 'New', value: A.newRev, color: 'var(--c3)' }, { key: 'r', label: 'Returning', value: A.retRev, color: 'var(--c1)' }], { fmt: money0, valueName: 'Revenue', center: moneyC(A.rev0), centerLabel: 'revenue' });
    const bins = [['1', 1, 1], ['2', 2, 2], ['3–4', 3, 4], ['5–9', 5, 9], ['10–19', 10, 19], ['20+', 20, 1e9]], cnt = bins.map(() => 0);
    for (const c of A.active) bins.forEach((b, j) => { if (A.ord[c] >= b[1] && A.ord[c] <= b[2]) cnt[j]++; });
    Charts.columns(els.freq, bins.map((b, j) => ({ key: j, label: b[0], fullLabel: b[0] + ' orders', value: cnt[j] })), { fmt: fmtInt, valueName: 'Customers', color: 'var(--c2)' });
    els.risk.update(rk); els.tbl.update(A.active.slice().sort((a, b) => A.rev[b] - A.rev[a]));
    els.seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.g === gap));
  }
  function mount(root) {
    const D = Store.D, L = () => life(D), age = c => D.maxDay - D.cLast[c];
    const sr = { placeholder: 'Search customer…', text: c => D.custSearch[c] };
    els.sub = h('span'); els.kpis = h('div', { class: 'kpis k5' }); els.trend = h('div'); els.mix = h('div'); els.freq = h('div');
    els.seg = h('div', { class: 'seg' }, [14, 30, 60, 90].map(g => h('button', { type: 'button', 'data-g': g, onclick: () => { gap = g; store.set('riskgap', g); update(); } }, g + 'd')));
    els.risk = UI.table({ pageSize: 8, rows: [], onRow: openCustomer, csvName: 'inactive-customers.csv', search: sr, cols: [
      { label: 'Customer', get: c => D.custLabel[c], cls: () => 'strong' }, { label: 'Orders', align: 'r', get: c => D.cOrders[c], val: c => D.cOrders[c] },
      { label: 'Lifetime', align: 'r', get: c => money0(L()[c]), val: c => L()[c], csv: c => L()[c].toFixed(2) }, { label: 'Last order', get: c => dShort(D.cLast[c]), val: c => D.cLast[c], csv: c => dISO(D.cLast[c]) },
      { label: 'Days ago', align: 'r', get: age, val: age }, { label: 'Usual gap', align: 'r', get: c => Math.round((D.cLast[c] - D.cFirst[c]) / (D.cOrders[c] - 1)) + 'd', val: c => (D.cLast[c] - D.cFirst[c]) / (D.cOrders[c] - 1) }] });
    const kind = c => D.cFirst[c] >= F.range().from ? 'New' : 'Returning';
    els.tbl = UI.table({ pageSize: 15, rows: [], onRow: openCustomer, csvName: 'customers.csv', search: sr, cols: [
      { label: 'Customer', get: c => D.custLabel[c], cls: () => 'strong' }, { label: 'Phone', get: c => D.custPhonesAll[c].join(', ') },
      { label: 'Status', get: c => h('span', { class: 'pill', style: { '--pc': kind(c) === 'New' ? 'var(--c3)' : 'var(--c1)' } }, kind(c)), val: kind, csv: kind },
      { label: 'Orders', align: 'r', get: c => last.ord[c], val: c => last.ord[c] }, { label: 'Units', align: 'r', get: c => fmtInt(last.units[c]), val: c => last.units[c] },
      { label: 'Revenue', align: 'r', get: c => money0(last.rev[c]), val: c => last.rev[c], csv: c => last.rev[c].toFixed(2) },
      { label: 'Avg order', align: 'r', get: c => money0(last.rev[c] / last.ord[c]), val: c => last.rev[c] / last.ord[c] },
      { label: 'Last order', get: c => dShort(last.lastIn[c]), val: c => last.lastIn[c], csv: c => dISO(last.lastIn[c]) }] });
    root.replaceChildren(h('div', { class: 'pagehead' }, h('h2', null, 'Customers'), els.sub), els.kpis, h('div', { class: 'grid' },
      UI.card('New vs active customers', els.trend, { span: 8, sub: 'Line = new customers · bars = active customers per period' }),
      UI.card('Revenue: new vs returning', els.mix, { span: 4 }),
      UI.card('Orders per customer', els.freq, { span: 4, sub: 'Active customers by number of orders in period' }),
      UI.card('Inactive customers (at risk)', els.risk, { span: 8, sub: 'Ordered 2+ times ever, none lately · all-time data · click for history', tools: els.seg }),
      UI.card('All active customers', els.tbl, { span: 12, sub: 'Click a row for order history and favourite products' })));
  }
  UI.openCustomer = openCustomer;
  return { title: 'Customers', mount, update };
})();
