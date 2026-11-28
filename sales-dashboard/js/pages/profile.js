/* Page: Store / customer profile (#/store/<source_user_id>, interstate: #/store/i-<id>).
   Whole history of ONE customer, independent of the global filters. Order = order id + delivery date. */
Pages.profile = (() => {
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], yearStart = y => Date.UTC(y, 0, 1) / 86400000, yearOf = d => dt(d).getUTCFullYear();
  const kpiTip = {
    Revenue: 'Sum of the order totals of all this customer\'s orders (whole history, all order types).', Orders: 'Number of distinct orders (order id + delivery date).', Units: 'Total units (item_count) over all orders.',
    'Avg order value': 'Revenue divided by number of orders.', 'Avg days between orders': '(Last order date - first order date) / (orders - 1). Needs 2 or more orders.',
    'First order': 'Delivery date of the first order in the Sheet. Orders before the Sheet starts are not known.', 'Last order': 'Delivery date of the latest order.', 'Days since last order': 'Latest date in the data minus the last order date.',
    'Share of revenue': 'This customer\'s revenue divided by the revenue of all B2B stores (for a B2B store) or of all other customers (B2C).'
  };
  let last = null;

  function classOf(D) {                                          // B2B store = has at least one B2B order
    if (D._pcls) return D._pcls;
    const isT = D.dict.type.map(t => String(t).trim().toLowerCase() === 'b2b'), cls = new Uint8Array(D.custName.length);
    for (let k = 0; k < D.nOrders; k++) if (isT[D.oType[k]]) cls[D.oCust[k]] = 1;
    let tb = 0, tc = 0; for (let k = 0; k < D.nOrders; k++) { if (cls[D.oCust[k]]) tb += D.oTotal[k]; else tc += D.oTotal[k]; }
    return D._pcls = { cls, tb, tc };
  }

  function compute(D, c) {
    const S = { c, ords: [], rev: 0, units: 0, byDay: new Map(), mon: new Map(), dow: { rev: new Float64Array(7), ord: new Int32Array(7) } };
    for (let k = 0; k < D.nOrders; k++) {
      if (D.oCust[k] !== c) continue;
      S.ords.push(k); const d = D.oDay[k], t = D.oTotal[k]; S.rev += t; S.units += D.oUnits[k];
      const e = S.byDay.get(d) || S.byDay.set(d, { rev: 0, ord: 0 }).get(d); e.rev += t; e.ord++;
      const w = (d + 3) % 7; S.dow.rev[w] += t; S.dow.ord[w]++;
    }
    S.n = S.ords.length; if (!S.n) return S;
    S.first = D.oDay[S.ords[0]]; S.lastDay = D.oDay[S.ords[S.n - 1]]; S.since = D.maxDay - S.lastDay;
    S.aov = S.rev / S.n; S.gap = S.n > 1 ? (S.lastDay - S.first) / (S.n - 1) : null;
    const C = classOf(D); S.isB2B = !!C.cls[c]; S.classTotal = S.isB2B ? C.tb : C.tc; S.share = S.classTotal ? S.rev / S.classTotal : 0;
    S.city = D.oCity[S.ords[S.n - 1]];
    return S;
  }

  function buckets(S, unit) {                                    // continuous buckets from first order to the latest date in the data
    const key = d => unit === 'day' ? d : unit === 'week' ? weekStart(d) : unit === 'month' ? monthStart(d) : yearStart(yearOf(d)), next = k => unit === 'day' ? k + 1 : unit === 'week' ? k + 7 : unit === 'month' ? monthStart(k + 32) : yearStart(yearOf(k) + 1);
    const m = new Map(); S.byDay.forEach((v, d) => { const k = key(d), e = m.get(k) || m.set(k, { rev: 0, ord: 0 }).get(k); e.rev += v.rev; e.ord += v.ord; });
    const out = []; for (let k = key(S.first); k <= Store.D.maxDay; k = next(k)) { const e = m.get(k) || { rev: 0, ord: 0 }; out.push({ k, rev: e.rev, ord: e.ord }); }
    return out;
  }

  function render(host, id) {
    const D = Store.D, c = D.custId.indexOf(String(id));
    if (c < 0) { host.replaceChildren(h('div', { class: 'empty big' }, h('h3', null, 'Customer not found'), h('p', null, 'No customer with id ' + id + ' in this data set.'), h('a', { href: '#/stores', class: 'btn' }, '← B2B Stores'))); return; }
    const S = last = compute(D, c), els = {}, kv = (l, v, hint) => { const k = UI.kpi({ label: l, value: v, hint: hint || ' ' }); k.title = kpiTip[l] || ''; return k; };
    const cls = S.isB2B ? 'B2B store' : 'B2C customer', stype = D.hasST && S.isB2B ? D.cTypeName[c] : '', phones = D.custPhonesAll[c].filter(Boolean).join(', ');
    const back = h('a', { class: 'btn', href: '#', onclick: e => { e.preventDefault(); history.length > 1 ? history.back() : (location.hash = '#/stores'); } }, '← Back');
    const head = UI.card(D.custLabel[c], h('div', { class: 'phead' },
      h('span', { class: 'sbadge ' + (S.isB2B ? 'ok' : 'new') }, cls), stype ? h('span', { class: 'pchip' }, stype) : null, S.n ? h('span', { class: 'pchip' }, D.dict.city[S.city] || '—') : null,
      phones ? h('span', { class: 'pchip' }, '☎ ' + phones) : null, h('span', { class: 'pchip mut' }, 'ID ' + D.custId[c])), { span: 12, tools: back });
    if (!S.n) { host.replaceChildren(h('div', { class: 'grid' }, head, UI.card('No orders', h('div', { class: 'empty' }, 'This customer has no orders in the Sheet.'), { span: 12 }))); return; }
    const money = money0;
    const kpis = h('div', { class: 'kpis k5' }, kv('Revenue', money(S.rev), 'whole history'), kv('Orders', fmtInt(S.n), 'order id + delivery date'), kv('Units', fmtInt(S.units), (S.units / S.n).toFixed(1) + ' per order'), kv('Avg order value', money(S.aov), 'revenue / orders'), kv('Avg days between orders', S.gap == null ? '—' : S.gap.toFixed(1) + ' days', S.n > 1 ? 'orders every ~' + Math.max(1, Math.round(S.gap)) + ' days' : 'needs 2+ orders'),
      kv('First order', dLong(S.first), D.maxDay - S.first + ' days ago'), kv('Last order', dLong(S.lastDay), S.since + ' days ago'), kv('Days since last order', fmtInt(S.since), S.gap != null && S.since > Math.max(2 * S.gap, S.gap + 7) ? 'longer than usual' : 'normal rhythm'), kv('Share of revenue', pct(S.share, 2), 'of all ' + (S.isB2B ? 'B2B stores' : 'other customers')));
    // trend with switch
    let unit = store.get('ptrend', 'week');
    els.trend = h('div'); els.seg = h('div', { class: 'seg' }, ['day', 'week', 'month', 'year'].map(u => h('button', { type: 'button', 'data-u': u, onclick: () => { unit = u; store.set('ptrend', u); drawTrend(); } }, u[0].toUpperCase() + u.slice(1))));
    function drawTrend() {
      const B = buckets(S, unit); els.seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.u === unit));
      const lab = k => unit === 'day' ? dLong(k) : unit === 'week' ? 'Week of ' + dLong(k) : unit === 'month' ? MON[dt(k).getUTCMonth()] + ' ' + yearOf(k) : String(yearOf(k)), tick = k => unit === 'year' ? String(yearOf(k)) : unit === 'month' ? MON[dt(k).getUTCMonth()] : dShort(k);
      Charts.trend(els.trend, { x: B.map(b => b.k), a: { name: 'Revenue', data: B.map(b => b.rev), fmt: money2, axis: moneyC }, b: { name: 'Orders', data: B.map(b => b.ord), fmt: fmtInt }, label: i => lab(B[i].k), tick: i => tick(B[i].k) });
    }
    // month and weekday columns
    const months = buckets(S, 'month'), multiY = yearOf(months[0].k) !== yearOf(months[months.length - 1].k), mItems = f => months.map(b => ({ key: b.k, label: MON[dt(b.k).getUTCMonth()] + (multiY ? ' ' + String(yearOf(b.k)).slice(2) : ''), fullLabel: MON[dt(b.k).getUTCMonth()] + ' ' + yearOf(b.k), value: f(b) }));
    const dItems = a => DOW.map((n, i) => ({ key: i, label: n, fullLabel: n, value: a[i] }));
    els.mr = h('div'); els.mo = h('div'); els.wr = h('div'); els.wo = h('div');
    // order history
    const T = D.dict.type;
    els.hist = UI.table({ pageSize: 15, rows: S.ords.slice().reverse(), onRow: UI.openOrder, csvName: 'order-history.csv', search: { placeholder: 'Search order #…', text: k => String(D.oId[k]) }, cols: [
      { label: 'Date', get: k => dLong(D.oDay[k]), val: k => D.oDay[k], csv: k => dISO(D.oDay[k]) }, { label: 'Order #', get: k => D.oId[k], val: k => D.oId[k] },
      { label: 'Type', get: k => UI.pill(T[D.oType[k]], D.oType[k]), val: k => D.oType[k], csv: k => T[D.oType[k]] }, { label: 'City', get: k => D.dict.city[D.oCity[k]] },
      { label: 'Lines', align: 'r', get: k => D.oStart[k + 1] - D.oStart[k], val: k => D.oStart[k + 1] - D.oStart[k] }, { label: 'Units', align: 'r', get: k => fmtInt(D.oUnits[k]), val: k => D.oUnits[k] },
      { label: 'Amount', align: 'r', get: k => money2(D.oTotal[k]), val: k => D.oTotal[k], csv: k => D.oTotal[k].toFixed(2) }] });
    els.cal = calendar(S, D);
    const P = prodStats(D, S), PS = peerStats(D, S, P.np), never = []; for (let p = 0; p < P.np; p++) if (!P.units[p]) never.push({ p, share: PS.n ? PS.pen[p] / PS.n : 0, stores: PS.pen[p] });
    never.sort((a, b) => b.share - a.share || D.dict.prod[a.p].localeCompare(D.dict.prod[b.p])); S.prod = P.rows; S.never = never; S.peers = PS; S.ideas = ideas(D, S, P, PS, never);
    els.ideas = h('div', { class: 'ideas' }, S.ideas.map(x => h('div', { class: 'idea ' + x.tone }, h('b', null, x.title), h('p', null, x.text))));
    els.fav = h('div'); els.never = UI.table({ pageSize: 10, rows: never, csvName: 'never-ordered.csv', search: { placeholder: 'Search product…', text: x => D.dict.prod[x.p].toLowerCase() }, cols: [
      { label: 'Product', get: x => D.dict.prod[x.p], cls: () => 'strong' }, { label: 'Share of ' + PS.label + ' that buy it', help: 'share-of-peers', align: 'r', get: x => pct(x.share, 0), val: x => x.share, csv: x => x.share.toFixed(3) }, { label: 'Stores buying it', align: 'r', get: x => fmtInt(x.stores), val: x => x.stores }] });
    els.prod = UI.table({ pageSize: 15, rows: P.rows, csvName: 'store-products.csv', search: { placeholder: 'Search product…', text: x => D.dict.prod[x.p].toLowerCase() }, cols: [
      { label: 'Product', get: x => D.dict.prod[x.p], cls: () => 'strong' }, { label: 'Units', align: 'r', get: x => fmtInt(x.units), val: x => x.units },
      { label: 'Share of units', align: 'r', get: x => pct(x.share, 1), val: x => x.share, csv: x => x.share.toFixed(4) }, { label: 'Orders with it', align: 'r', get: x => fmtInt(x.ords), val: x => x.ords },
      { label: '% of orders', align: 'r', get: x => pct(x.opo, 0), val: x => x.opo, csv: x => x.opo.toFixed(3) }, { label: 'Avg units / order', align: 'r', get: x => (x.units / x.ords).toFixed(1), val: x => x.units / x.ords },
      { label: 'Last ordered', get: x => dLong(x.last), val: x => x.last, csv: x => dISO(x.last) }, { label: 'Days since', align: 'r', get: x => D.maxDay - x.last, val: x => D.maxDay - x.last },
      { label: 'Trend (30d vs prev 30d)', get: arrow, val: x => x.u0 ? x.u1 / x.u0 : x.u1 ? 99 : 0, csv: x => x.u0 ? (x.u1 / x.u0 - 1).toFixed(3) : '' }] });
    els.mtx = h('div'); matrix(S, D, P, els.mtx);
    host.replaceChildren(h('div', { class: 'grid' }, head), kpis, h('div', { class: 'grid' },
      UI.card('Improvement ideas', els.ideas, { span: 12, sub: 'Rules worked out from this customer\'s own history and from ' + PS.label + ' (' + fmtInt(PS.n) + ')' }),
      UI.card('Revenue and orders over time', els.trend, { span: 12, sub: 'From the first order to the latest date in the data', tools: els.seg }),
      UI.card('Revenue by month', els.mr, { span: 6 }), UI.card('Orders by month', els.mo, { span: 6 }),
      UI.card('Revenue by weekday', els.wr, { span: 6, sub: 'Weekday of the delivery date' }), UI.card('Orders by weekday', els.wo, { span: 6 }),
      UI.card('Favourite products', els.fav, { span: 5, sub: 'Top 10 by units · % = share of this customer\'s orders that contain it' }),
      UI.card('Never ordered by this customer', els.never, { span: 7, sub: 'Catalogue products never bought here, and how many ' + PS.label + ' buy them' }),
      UI.card('Products bought', els.prod, { span: 12, sub: 'Product revenue is not in the data (the order total sits on one line), so product weight is shown in units' }),
      UI.card('Day-wise product matrix', els.mtx, { span: 12, sub: 'Units delivered per product per day · pick a week or a month · compared with the period before' }),
      UI.card('Delivery calendar', els.cal, { span: 12, sub: 'Each square is a day · darker = more orders · click a day to see its orders' }),
      UI.card('Order history', els.hist, { span: 12, sub: 'Newest first · click an order to open it (Back, Previous and Next inside)' })));
    drawTrend();
    Charts.hbar(els.fav, P.rows.slice(0, 10).map(x => ({ key: x.p, label: D.dict.prod[x.p], value: x.units, sub: pct(x.opo, 0) + ' of orders', color: 'var(--c1)' })), { fmt: fmtInt, valueName: 'Units' });
    Charts.columns(els.mr, mItems(b => b.rev), { fmt: moneyC, tipFmt: money0, valueName: 'Revenue', color: 'var(--c1)' }); Charts.columns(els.mo, mItems(b => b.ord), { fmt: fmtInt, valueName: 'Orders', color: 'var(--c3)' });
    Charts.columns(els.wr, dItems(S.dow.rev), { fmt: moneyC, tipFmt: money0, valueName: 'Revenue', color: 'var(--c1)' }); Charts.columns(els.wo, dItems(S.dow.ord), { fmt: fmtInt, valueName: 'Orders', color: 'var(--c3)' });
  }

  /* ---------- Pass B: products, similar stores, day-wise matrix, ideas ---------- */
  const TREND_DAYS = 30;
  function prodStats(D, S) {
    const np = D.dict.prod.length, units = new Float64Array(np), ords = new Int32Array(np), lastD = new Int32Array(np).fill(-1), stamp = new Int32Array(np).fill(-1), u1 = new Float64Array(np), u0 = new Float64Array(np);
    const e1 = D.maxDay, s1 = e1 - TREND_DAYS + 1, e0 = s1 - 1, s0 = e0 - TREND_DAYS + 1; S.lineByDay = new Map();
    for (const k of S.ords) {
      const d = D.oDay[k], m = S.lineByDay.get(d) || S.lineByDay.set(d, new Map()).get(d);
      for (let i = D.oStart[k]; i < D.oStart[k + 1]; i++) {
        const p = D.prod[i], q = D.qty[i]; units[p] += q; m.set(p, (m.get(p) || 0) + q); if (stamp[p] !== k) { stamp[p] = k; ords[p]++; } if (d > lastD[p]) lastD[p] = d;
        if (d >= s1 && d <= e1) u1[p] += q; else if (d >= s0 && d <= e0) u0[p] += q;
      }
    }
    const rows = []; for (let p = 0; p < np; p++) if (units[p] > 0) rows.push({ p, units: units[p], ords: ords[p], last: lastD[p], u1: u1[p], u0: u0[p], share: units[p] / S.units, opo: ords[p] / S.n });
    rows.sort((a, b) => b.units - a.units); return { rows, units, np, win: { s1, e1, s0, e0 } };
  }
  function peerStats(D, S, np) {                                 // how many similar stores ever bought each product
    const C = classOf(D), nc = D.custName.length, has = new Uint8Array(nc), want = S.isB2B ? 1 : 0, myT = D.hasST && S.isB2B ? D.cTypeName[S.c] : null;
    for (let k = 0; k < D.nOrders; k++) has[D.oCust[k]] = 1;
    const cand = (c, byType) => c !== S.c && has[c] && C.cls[c] === want && (!byType || D.cTypeName[c] === myT);
    let n = 0, byType = myT != null; for (let c = 0; c < nc; c++) if (cand(c, byType)) n++;
    if (byType && n < 5) { byType = false; n = 0; for (let c = 0; c < nc; c++) if (cand(c, false)) n++; }
    const slot = new Int32Array(nc).fill(-1); let ns = 0; for (let c = 0; c < nc; c++) if (cand(c, byType)) slot[c] = ns++;
    const seen = new Uint8Array(ns * np || 1), pen = new Int32Array(np);
    for (let i = 0; i < D.n; i++) { const q = slot[D.cust[i]]; if (q < 0) continue; const p = D.prod[i]; if (!seen[q * np + p]) { seen[q * np + p] = 1; pen[p]++; } }
    return { n, pen, label: byType ? 'similar ' + myT.toLowerCase() + 's' : S.isB2B ? 'all other B2B stores' : 'all other B2C customers' };
  }
  function ideas(D, S, P, PS, never) {
    const out = [], MIN_PEER = .3;
    const miss = never.filter(x => x.share >= MIN_PEER).slice(0, 6);
    if (miss.length) out.push({ tone: 'good', title: 'Products to offer', text: 'Never ordered here, but bought by ' + Math.round(MIN_PEER * 100) + '%+ of ' + PS.label + ': ' + miss.map(x => D.dict.prod[x.p] + ' (' + pct(x.share, 0) + ')').join(', ') + '.' });
    if (S.n >= 4 && S.gap != null && S.since > Math.max(2 * S.gap, S.gap + 7)) out.push({ tone: 'bad', title: 'Ordering gap is longer than usual', text: 'Last order was ' + S.since + ' days ago (' + dLong(S.lastDay) + '); this customer normally orders every ' + S.gap.toFixed(1) + ' days. Worth a call.' });
    let mg = 0, mgAt = 0, prev = null; for (const k of S.ords) { const d = D.oDay[k]; if (prev != null && d - prev > mg) { mg = d - prev; mgAt = prev; } prev = d; }
    if (S.n >= 4 && mg > Math.max(2 * S.gap, S.gap + 7) + 0) out.push({ tone: 'mut', title: 'Longest break in history', text: mg + ' days without an order, after ' + dLong(mgAt) + '.' });
    const fall = P.rows.filter(x => x.u0 >= 10 && x.u1 <= x.u0 * .7).sort((a, b) => (b.u0 - b.u1) - (a.u0 - a.u1)).slice(0, 5);
    if (fall.length) out.push({ tone: 'bad', title: 'Falling volumes', text: 'Last ' + TREND_DAYS + ' days vs the ' + TREND_DAYS + ' before: ' + fall.map(x => D.dict.prod[x.p] + ' ' + fmtInt(x.u0) + ' → ' + fmtInt(x.u1) + ' units (' + (x.u0 ? Math.round((x.u1 / x.u0 - 1) * 100) : 0) + '%)').join('; ') + '.' });
    const rise = P.rows.filter(x => x.u1 >= 10 && x.u1 >= x.u0 * 1.3).sort((a, b) => (b.u1 - b.u0) - (a.u1 - a.u0)).slice(0, 4);
    if (rise.length) out.push({ tone: 'good', title: 'Growing products', text: rise.map(x => D.dict.prod[x.p] + ' ' + fmtInt(x.u0) + ' → ' + fmtInt(x.u1) + ' units').join('; ') + ' (last ' + TREND_DAYS + ' days vs the ' + TREND_DAYS + ' before).' });
    const lowV = P.rows.length <= 4 && S.n >= 3; if (lowV) out.push({ tone: 'bad', title: 'Very narrow range', text: 'Only ' + P.rows.length + ' different products have ever been ordered.' });
    if (!out.length) out.push({ tone: 'mut', title: 'No flags', text: 'Nothing stands out against the rules above.' });
    return out;
  }
  const arrow = x => { if (!x.u0 && !x.u1) return h('span', { class: 'mut', title: 'No units in the last ' + 2 * TREND_DAYS + ' days' }, '—');
    const ch = x.u0 ? x.u1 / x.u0 - 1 : Infinity, cls = ch >= .1 ? 'good' : ch <= -.1 ? 'bad' : 'mut', sym = ch >= .1 ? '▲' : ch <= -.1 ? '▼' : '▬';
    return h('span', { class: 'ta ' + cls, title: `Units in the last ${TREND_DAYS} days: ${fmtInt(x.u1)}; in the ${TREND_DAYS} days before: ${fmtInt(x.u0)}. Arrow: up if +10% or more, down if -10% or less.` }, sym + ' ' + (isFinite(ch) ? (ch > 0 ? '+' : '') + Math.round(ch * 100) + '%' : 'new')); };
  function matrix(S, D, P, host) {
    let mode = store.get('pmode', 'week'), idx = 0;
    const per = () => { const out = [], first = mode === 'week' ? weekStart(S.first) : monthStart(S.first), nx = k => mode === 'week' ? k + 7 : monthStart(k + 32);
      for (let k = first; k <= D.maxDay; k = nx(k)) out.push({ from: k, to: nx(k) - 1 }); return out.reverse(); };
    const sel = h('select', { class: 'psel', onchange: e => { idx = +e.target.value; draw(); } }), seg = h('div', { class: 'seg' }, ['week', 'month'].map(m => h('button', { type: 'button', 'data-m': m, onclick: () => { mode = m; store.set('pmode', m); idx = 0; idx = firstActive(); fill(); draw(); } }, m[0].toUpperCase() + m.slice(1)))), body = h('div', { class: 'twrap' });
    let list = per();
    function fill() { list = per(); sel.replaceChildren(...list.map((q, i) => h('option', { value: i }, mode === 'week' ? dLong(q.from) + ' – ' + dLong(q.to) : MON[dt(q.from).getUTCMonth()] + ' ' + yearOf(q.from)))); sel.value = idx; }
    function draw() {
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
      const q = list[idx], pq = list[idx + 1], days = []; for (let d = q.from; d <= q.to; d++) days.push(d);
      const tot = (a, b) => { const m = new Map(); for (let d = a; d <= b; d++) { const l = S.lineByDay.get(d); if (l) l.forEach((u, p) => m.set(p, (m.get(p) || 0) + u)); } return m; };
      const cur = tot(q.from, q.to), prv = pq ? tot(pq.from, pq.to) : new Map(), rows = [...cur.entries()].sort((a, b) => b[1] - a[1]);
      const dayOrd = days.map(d => (S.byDay.get(d) || { ord: 0 }).ord), dayUnits = days.map(d => { let u = 0; const l = S.lineByDay.get(d); if (l) l.forEach(x => u += x); return u; });
      if (!rows.length) { S.matrixView = null; body.replaceChildren(h('div', { class: 'empty' }, 'No orders in this period.')); return; }
      const cell = (u, mx) => h('td', { class: 'r mc', style: u ? { background: `color-mix(in srgb, var(--c1) ${Math.round(12 + 55 * u / mx)}%, transparent)` } : {} }, u ? fmtInt(u) : '·');
      body.replaceChildren(h('table', { class: 'mtx' }, h('thead', null, h('tr', null, h('th', null, 'Product'), days.map(d => h('th', { class: 'r' }, mode === 'week' ? DOW[(d + 3) % 7] + ' ' + dt(d).getUTCDate() : String(dt(d).getUTCDate()))), h('th', { class: 'r' }, 'Total'), h('th', { class: 'r' }, 'Previous ' + mode))),
        h('tbody', null, rows.map(([p, t]) => { const mx = Math.max(...days.map(d => (S.lineByDay.get(d) || new Map()).get(p) || 0)), pv = prv.get(p) || 0, ch = pv ? t / pv - 1 : null;
          return h('tr', null, h('td', { class: 'strong' }, D.dict.prod[p]), days.map(d => cell((S.lineByDay.get(d) || new Map()).get(p) || 0, mx)), h('td', { class: 'r strong' }, fmtInt(t)), h('td', { class: 'r' }, fmtInt(pv), ' ', ch == null ? '' : h('span', { class: 'ta ' + (ch >= .1 ? 'good' : ch <= -.1 ? 'bad' : 'mut') }, (ch > 0 ? '+' : '') + Math.round(ch * 100) + '%'))); })),
        h('tfoot', null, h('tr', null, h('td', null, 'Orders'), dayOrd.map(v => h('td', { class: 'r' }, v || '·')), h('td', { class: 'r' }, fmtInt(dayOrd.reduce((a, b) => a + b, 0))), h('td')),
          h('tr', null, h('td', null, 'Units'), dayUnits.map(v => h('td', { class: 'r' }, v ? fmtInt(v) : '·')), h('td', { class: 'r' }, fmtInt(dayUnits.reduce((a, b) => a + b, 0))), h('td')))));;
      S.matrixView = { from: q.from, to: q.to, totals: Object.fromEntries(rows.map(([p, t]) => [p, t])) };
    }
    const firstActive = () => { const i = list.findIndex(q => { for (let d = q.from; d <= q.to; d++) if (S.byDay.has(d)) return true; return false; }); return i < 0 ? 0 : i; };
    idx = firstActive(); fill(); draw(); host.replaceChildren(h('div', { class: 'ttools' }, seg, sel), body);
  }

  function calendar(S, D) {
    const w0 = weekStart(S.first), w1 = weekStart(D.maxDay), nw = (w1 - w0) / 7 + 1; let mx = 0; S.byDay.forEach(v => { if (v.ord > mx) mx = v.ord; });
    const wrap = h('div', { class: 'pcal' }), months = h('div', { class: 'pcm', style: { gridTemplateColumns: `repeat(${nw}, 22px)` } }), grid = h('div', { class: 'pcg', style: { gridTemplateColumns: `repeat(${nw}, 22px)` } });
    for (let w = 0; w < nw; w++) { const d0 = w0 + w * 7, m = dt(d0).getUTCMonth(), prev = w ? dt(d0 - 7).getUTCMonth() : -1; months.append(h('span', null, m !== prev ? MON[m] : '')); }
    for (let w = 0; w < nw; w++) for (let r = 0; r < 7; r++) {
      const d = w0 + w * 7 + r, e = S.byDay.get(d), out = d < S.first || d > D.maxDay, lv = e ? Math.max(1, Math.ceil(4 * e.ord / mx)) : 0;
      const cell = h('i', { class: 'pc l' + lv + (out ? ' out' : ''), style: { gridColumn: w + 1, gridRow: r + 1 } });
      if (!out) { cell.title = dLong(d) + ' · ' + DOW[r] + ' · ' + (e ? e.ord + ' order' + (e.ord > 1 ? 's' : '') + ' · ' + money0(e.rev) : 'no order'); if (e) cell.onclick = () => dayOrders(S, D, d); }
      grid.append(cell);
    }
    wrap.append(months, grid, h('div', { class: 'pcl' }, 'Less ', ...[0, 1, 2, 3, 4].map(l => h('i', { class: 'pc l' + l })), ' More')); return wrap;
  }
  function dayOrders(S, D, d) {
    const ks = S.ords.filter(k => D.oDay[k] === d);
    if (ks.length === 1) return UI.openOrder(ks[0], S.ords);
    UI.drawer(dLong(d), ks.length + ' orders', h('table', { class: 'lines' }, h('tbody', null, ks.map(k => h('tr', { class: 'click', onclick: () => UI.openOrder(k, S.ords) }, h('td', null, 'Order #' + D.oId[k]), h('td', { class: 'r' }, fmtInt(D.oUnits[k]) + ' units'), h('td', { class: 'r' }, money2(D.oTotal[k])))))));
  }

  return { title: 'Store profile', render, update() { }, get stats() { return last; } };
})();
