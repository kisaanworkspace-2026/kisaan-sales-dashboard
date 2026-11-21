/* Page: Overview. One pass over the filtered rows computes everything shown on the page. */
Pages.overview = (() => {
  let root, els = {}, last = null, target = store.get('target', 0), gran = store.get('gran', 'auto');
  const money = money0;

  function totals(sel) {
    const D = Store.D, seenO = new Uint8Array(D.nOrders), seenC = new Uint8Array(D.custName.length);
    let rev = 0, orders = 0, units = 0, custs = 0;
    for (let i = 0; i < D.n; i++) {
      if (!sel[i]) continue; units += D.qty[i]; const k = D.oi[i];
      if (!seenO[k]) { seenO[k] = 1; orders++; rev += D.oTotal[k]; const c = D.oCust[k]; if (!seenC[c]) { seenC[c] = 1; custs++; } }
    }
    return { rev, orders, units, custs, aov: orders ? rev / orders : 0 };
  }

  function compute(from, to) {
    const D = Store.D, sel = F.mask(from, to, 0), nd = to - from + 1;
    const A = { revDay: new Float64Array(nd), ordDay: new Float64Array(nd), unitDay: new Float64Array(nd),
      type: new Float64Array(D.dict.type.length), city: new Float64Array(D.dict.city.length), cityOrd: new Int32Array(D.dict.city.length), dow: new Float64Array(7),
      prodU: new Float64Array(D.dict.prod.length), prodO: new Int32Array(D.dict.prod.length), lastO: new Int32Array(D.dict.prod.length).fill(-1),
      custRev: new Float64Array(D.custName.length), custOrd: new Int32Array(D.custName.length), custUnits: new Float64Array(D.custName.length), orders: [] };
    const seenO = new Uint8Array(D.nOrders), seenC = new Uint8Array(D.custName.length);
    let rev = 0, units = 0, custs = 0;
    for (let i = 0; i < D.n; i++) {
      if (!sel[i]) continue;
      const k = D.oi[i], p = D.prod[i], q = D.qty[i], di = D.day[i] - from, c = D.cust[i];
      A.prodU[p] += q; if (A.lastO[p] !== k) { A.lastO[p] = k; A.prodO[p]++; }
      units += q; A.unitDay[di] += q; A.custUnits[c] += q;
      if (!seenO[k]) {
        seenO[k] = 1; const t = D.oTotal[k]; rev += t;
        A.revDay[di] += t; A.ordDay[di]++; A.type[D.oType[k]] += t; A.city[D.oCity[k]] += t; A.cityOrd[D.oCity[k]]++; A.dow[dowOf(D.oDay[k])] += t;
        A.custRev[c] += t; A.custOrd[c]++; if (!seenC[c]) { seenC[c] = 1; custs++; } A.orders.push(k);
      }
    }
    const nO = A.orders.length;
    Object.assign(A, { rev, units, custs, nOrders: nO, aov: nO ? rev / nO : 0 });
    return A;
  }

  function buckets(from, to, A) {
    const g = gran === 'auto' ? (to - from < 45 ? 'day' : to - from < 190 ? 'week' : 'month') : gran;
    const key = d => g === 'day' ? d : g === 'week' ? weekStart(d) : monthStart(d), m = new Map();
    for (let d = from; d <= to; d++) { const k = key(d), e = m.get(k) || m.set(k, { r: 0, o: 0 }).get(k); e.r += A.revDay[d - from]; e.o += A.ordDay[d - from]; }
    const x = [...m.keys()];
    const mon = d => { const t = dt(d); return MON[t.getUTCMonth()] + ' ' + t.getUTCFullYear(); };
    return { g, x, a: x.map(k => m.get(k).r), b: x.map(k => m.get(k).o),
      label: g === 'day' ? dLong : g === 'week' ? d => 'Week of ' + dLong(d) : mon, tick: g === 'month' ? d => MON[dt(d).getUTCMonth()] + " '" + String(dt(d).getUTCFullYear()).slice(2) : dShort };
  }

  function top(arr, n, filterFn) { const idx = []; for (let i = 0; i < arr.length; i++) if (filterFn(i)) idx.push(i); return idx.sort((a, b) => arr[b] - arr[a]).slice(0, n); }

  function insights(from, to, A, P) {
    const D = Store.D, msgs = [], sel = F.mask(Math.max(D.minDay, to - 28), to, 1), seen = new Uint8Array(D.nOrders), dd = new Map();
    for (let i = 0; i < D.n; i++) if (sel[i]) { const k = D.oi[i]; if (!seen[k]) { seen[k] = 1; dd.set(D.oDay[k], (dd.get(D.oDay[k]) || 0) + D.oTotal[k]); } }
    const same = [7, 14, 21, 28].map(x => dd.get(to - x)).filter(v => v != null), lastV = dd.get(to) || 0;
    if (same.length >= 2) { const base = same.reduce((a, b) => a + b, 0) / same.length, ch = base ? (lastV - base) / base : 0; if (Math.abs(ch) >= .25) msgs.push({ bad: ch < 0, t: `${dLong(to)} (${DOW[dowOf(to)]}) revenue ${money0(lastV)} is ${pct(Math.abs(ch), 0)} ${ch < 0 ? 'below' : 'above'} the usual ${DOW[dowOf(to)]} (${money0(base)})` }); }
    if (P && P.rev && Math.abs((A.rev - P.rev) / P.rev) >= .15) { const ch = (A.rev - P.rev) / P.rev; msgs.push({ bad: ch < 0, t: `Revenue is ${pct(Math.abs(ch), 0)} ${ch < 0 ? 'down' : 'up'} on the previous period` }); }
    const days = to - from + 1;
    if (target > 0) { const r = A.rev / days / target; msgs.push({ bad: r < 1, t: `Revenue per day ${money0(A.rev / days)} is ${pct(r, 0)} of your ${money0(target)}/day target` }); }
    let big = 0; for (const k of A.orders) if (D.oTotal[k] > big) big = D.oTotal[k];
    if (A.rev && big / A.rev > .08 && A.nOrders > 20) msgs.push({ bad: false, t: `One order (${money0(big)}) is ${pct(big / A.rev, 0)} of this period's revenue` });
    els.insights.replaceChildren(...msgs.map(m => h('span', { class: 'ins ' + (m.bad ? 'bad' : 'good') }, (m.bad ? '▼ ' : '▲ ') + m.t)));
    els.insights.style.display = msgs.length ? '' : 'none';
  }
  function setTarget() {
    const v = prompt('Daily revenue target in dollars (0 to remove):', target || ''); if (v === null) return;
    target = Math.max(0, parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0); store.set('target', target); update();
  }
  function update() {
    const D = Store.D, { from, to } = F.range(), A = last = compute(from, to), pr = F.prevRange(), P = pr ? totals(F.mask(pr.from, pr.to, 1)) : null;
    const dl = (a, b) => P && b ? (a - b) / b : null, S = F.st;
    els.sub.textContent = `${dLong(from)} – ${dLong(to)} · ${to - from + 1} days` + (F.isActive() ? ' · filtered' : '');
    els.kpis.replaceChildren(
      UI.kpi({ label: 'Revenue', value: money(A.rev), delta: dl(A.rev, P && P.rev), spark: A.revDay, hint: 'full range' }),
      UI.kpi({ label: 'Orders', value: fmtInt(A.nOrders), delta: dl(A.nOrders, P && P.orders), spark: A.ordDay, color: 'var(--c2)', hint: 'full range' }),
      UI.kpi({ label: 'Units sold', value: fmtInt(A.units), delta: dl(A.units, P && P.units), spark: A.unitDay, color: 'var(--c3)', hint: 'full range' }),
      UI.kpi({ label: 'Avg order value', value: money2(A.aov), delta: dl(A.aov, P && P.aov), hint: 'full range' }),
      UI.kpi({ label: 'Customers', value: fmtInt(A.custs), delta: dl(A.custs, P && P.custs), hint: 'full range' }),
      UI.kpi({ label: 'Revenue / day', value: money(A.rev / (to - from + 1)), delta: dl(A.rev, P && P.rev), hint: 'full range' }));

    const B = buckets(from, to, A);
    const tg = target > 0 ? B.x.map((d, i) => target * (B.g === 'day' ? 1 : B.g === 'week' ? Math.min(7, to - d + 1) : Math.min(new Date(Date.UTC(dt(d).getUTCFullYear(), dt(d).getUTCMonth() + 1, 0)).getUTCDate(), to - d + 1))) : null;
    insights(from, to, A, P);
    Charts.trend(els.trend, { target: tg, x: B.x, a: { name: 'Revenue', data: B.a, fmt: money2, axis: moneyC }, b: { name: 'Orders', data: B.b, fmt: fmtInt }, label: i => B.label(B.x[i]), tick: i => B.tick(B.x[i]) });
    els.gran.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.g === (gran === 'auto' ? B.g : gran)));

    Charts.donut(els.type, top(A.type, 9, i => A.type[i] > 0).map(i => ({ key: D.dict.type[i], label: D.dict.type[i].toUpperCase(), value: A.type[i], color: D.typeColor[i] })),
      { fmt: money0, valueName: 'Revenue', center: moneyC(A.rev), centerLabel: 'revenue', selected: S.types, onClick: it => F.toggle('types', it.key) });

    Charts.hbar(els.prod, top(A.prodU, 10, i => A.prodU[i] > 0).map(i => ({ key: D.dict.prod[i], label: D.dict.prod[i], value: A.prodU[i], sub: fmtInt(A.prodO[i]) + ' orders' })),
      { fmt: fmtInt, valueName: 'Units', selected: S.prods, onClick: it => F.toggle('prods', it.key) });
    Charts.hbar(els.city, top(A.city, 10, i => A.city[i] > 0).map(i => ({ key: D.dict.city[i], label: D.dict.city[i] || '(unknown)', value: A.city[i], sub: fmtInt(A.cityOrd[i]) + ' orders', color: 'var(--c2)' })),
      { fmt: moneyC, tipFmt: money0, valueName: 'Revenue', selected: S.cities, onClick: it => F.toggle('cities', it.key) });
    Charts.columns(els.dow, DOW.map((l, i) => ({ key: i, label: l, fullLabel: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i], value: A.dow[i] })),
      { fmt: moneyC, tipFmt: money0, valueName: 'Revenue', color: 'var(--c3)', selected: S.dows, onClick: it => F.toggle('dows', it.key) });

    const custRows = top(A.custRev, 3000, i => A.custOrd[i] > 0);
    els.cust.update(custRows);
    els.big.update(A.orders.slice().sort((a, b) => D.oTotal[b] - D.oTotal[a]).slice(0, 100));
  }

  function mount(container) {
    root = container; const D = Store.D;
    const gbtn = (g, t) => h('button', { type: 'button', 'data-g': g, onclick: () => { gran = g; store.set('gran', g); update(); } }, t);
    els.sub = h('span'); els.insights = h('div', { class: 'insights' }); els.kpis = h('div', { class: 'kpis' }); els.trend = h('div', { class: 'trendbox' });
    els.gran = h('div', { class: 'seg' }, gbtn('day', 'Day'), gbtn('week', 'Week'), gbtn('month', 'Month'));
    els.type = h('div'); els.prod = h('div'); els.city = h('div'); els.dow = h('div');
    els.cust = UI.table({ pageSize: 10, rows: [], search: { placeholder: 'Search customer…', text: c => D.custSearch[c] }, cols: [
      { label: 'Customer', get: c => D.custLabel[c], cls: () => 'strong' },
      { label: 'Orders', align: 'r', get: c => fmtInt(last.custOrd[c]), val: c => last.custOrd[c] },
      { label: 'Units', align: 'r', get: c => fmtInt(last.custUnits[c]), val: c => last.custUnits[c] },
      { label: 'Revenue', align: 'r', get: c => money0(last.custRev[c]), val: c => last.custRev[c], csv: c => last.custRev[c].toFixed(2) }] });
    els.big = UI.table({ pageSize: 10, rows: [], onRow: k => UI.openOrder(k), cols: [
      { label: 'Date', get: k => dShort(D.oDay[k]), val: k => D.oDay[k] }, { label: 'Order #', get: k => D.oId[k], val: k => D.oId[k] },
      { label: 'Customer', get: k => D.custLabel[D.oCust[k]], cls: () => 'strong' }, { label: 'Type', get: k => UI.pill(D.dict.type[D.oType[k]], D.oType[k]), val: k => D.oType[k] },
      { label: 'Amount', align: 'r', get: k => money2(D.oTotal[k]), val: k => D.oTotal[k] }] });
    root.replaceChildren(h('div', { class: 'pagehead' }, h('h2', null, 'Overview'), els.sub, h('button', { class: 'btn', style: { marginLeft: 'auto' }, onclick: setTarget }, '🎯 Daily target')), els.insights, els.kpis,
      h('div', { class: 'grid' },
        UI.card('Revenue & orders over time', els.trend, { span: 8, sub: 'Area = revenue (left axis) · bars = orders (right axis)', tools: els.gran }),
        UI.card('Revenue by order type', els.type, { span: 4, sub: 'Click a slice to filter' }),
        UI.card('Top products', els.prod, { span: 4, sub: 'By units sold · click to filter' }),
        UI.card('Top cities', els.city, { span: 4, sub: 'By revenue · click to filter' }),
        UI.card('Revenue by weekday', els.dow, { span: 4, sub: 'Click a day to filter' }),
        UI.card('Top customers', els.cust, { span: 6, sub: 'By revenue in the selected period' }),
        UI.card('Largest orders', els.big, { span: 6, sub: 'Click a row to see the order lines' })));
  }
  return { title: 'Overview', mount, update };
})();
