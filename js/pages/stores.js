/* Page: B2B Stores. Store = shop with at least one B2B order.
   A store is identified by its NAME (a shop can have several phone numbers); shops with no name fall back to the phone number.
   New store = first order (any type) within the last 60 days of data. Lapsed = no B2B order for N days. Low variety = buys only a few distinct products. */
Pages.stores = (() => {
  const NEW_DAYS = 60;
  let els = {}, last = null, lapseGap = store.get('lapse', 45), maxItems = store.get('maxitems', 4);
  const b2b = D => D._b2b || (D._b2b = D.dict.type.map(t => t.toLowerCase() === 'b2b'));
  const typeName = (D, c) => D.hasST ? groups(D).tname[c] : '';
  function firstOrder(D) {
    if (D._bf) return D._bf;
    const G = groups(D), f = new Int32Array(G.n).fill(1e9);
    for (let k = 0; k < D.nOrders; k++) { const c = G.g[D.oCust[k]]; if (G.b2b[c] && D.oDay[k] < f[c]) f[c] = D.oDay[k]; }
    return D._bf = f;
  }
  const slots = D => D._slot || (D._slot = (() => { const is = b2b(D), G = groups(D), sl = new Int32Array(G.n).fill(-1); let n = 0; for (let i = 0; i < D.n; i++) { const q = G.g[D.cust[i]]; if (is[D.type[i]] && sl[q] < 0) sl[q] = n++; } return { sl, n }; })());
  const groups = D => D._grp || (D._grp = (() => {
    const is = b2b(D), m = new Map(), nc = D.custName.length, g = new Int32Array(nc), norm = x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
    for (let c = 0; c < nc; c++) { const nm = norm(D.custName[c]), key = nm || 'ph' + D.custPhone[c]; g[c] = m.has(key) ? m.get(key) : (m.set(key, m.size), m.size - 1); }
    const n = m.size, first = new Int32Array(n).fill(-1), phones = Array.from({ length: n }, () => []);
    for (let c = 0; c < nc; c++) { const q = g[c]; if (first[q] < 0) first[q] = c; phones[q].push(...D.custPhonesAll[c]); }
    const b = new Uint8Array(n); for (let i = 0; i < D.n; i++) if (is[D.type[i]]) b[g[D.cust[i]]] = 1;
    const G = { g, n, b2b: b, label: Array.from(first, c => D.custLabel[c]), phone: Array.from(first, c => D.custPhonesAll[c].slice(0, 3).join(', ') + (D.custPhonesAll[c].length > 3 ? ' +' + (D.custPhonesAll[c].length - 3) : '')),
      tname: Array.from(first, c => D.hasST ? D.cTypeName[c] : ''), st: Int16Array.from(first, c => D.hasST ? D.cST[c] : 0) };
    G.search = G.label.map((l, q) => (l + ' ' + phones[q].join(' ')).toLowerCase()); return G; })());
  function compute(from, to) {
    const D = Store.D, is = b2b(D), bf = firstOrder(D), cut = D.maxDay - (NEW_DAYS - 1), sel = F.mask(from, to, 0), GR = groups(D), nc = GR.n, np = D.dict.prod.length, nd = to - from + 1, nst = D.stAll.length || 1, SL = slots(D), sl = SL.sl, ns = SL.n || 1;
    const A = { rev: new Float64Array(nc), ord: new Int32Array(nc), city: new Uint16Array(nc), cityOrd: new Int32Array(D.dict.city.length), stores: [], revNew: 0, revOld: 0, newCount: 0,
      sl, seen: new Uint8Array(ns * np), nProd: new Int32Array(nc), units: new Float64Array(ns * np), prodU: new Float64Array(np), pen: new Int32Array((nst + 1) * np), peers: new Int32Array(nst + 1), gpen: new Int32Array(np),
      revDay: new Float64Array(nd), ordDay: new Float64Array(nd), nd };
    const seenO = new Uint8Array(D.nOrders);
    for (let i = 0; i < D.n; i++) {
      if (!sel[i] || !is[D.type[i]]) continue;
      const k = D.oi[i], c = GR.g[D.cust[i]], p = D.prod[i], t = D.hasST ? GR.st[c] : 0;
      A.units[sl[c] * np + p] += D.qty[i]; A.prodU[p] += D.qty[i];
      if (!A.seen[sl[c] * np + p]) { A.seen[sl[c] * np + p] = 1; A.nProd[c]++; A.pen[t * np + p]++; A.gpen[p]++; }
      if (!seenO[k]) {
        seenO[k] = 1; const v = D.oTotal[k], di = D.day[i] - from;
        if (A.ord[c] === 0) { A.stores.push(c); A.city[c] = D.oCity[k]; A.peers[t]++; if (bf[c] >= cut) A.newCount++; }
        A.ord[c]++; A.rev[c] += v; A.cityOrd[D.oCity[k]]++; A.revDay[di] += v; A.ordDay[di]++;
        if (bf[c] >= cut) A.revNew += v; else A.revOld += v;
      }
    }
    A.total = A.revNew + A.revOld; A.cut = cut; A.np = np;
    // store types: revenue per type ignoring the store-type filter so every type stays selectable
    if (D.hasST) {
      const s2 = F.mask(from, to, 1, true), seen2 = new Uint8Array(D.nOrders); A.tRev = new Float64Array(nst); A.tOrd = new Int32Array(nst); A.tStores = new Int32Array(nst); const sc = new Uint8Array(nc);
      for (let i = 0; i < D.n; i++) { if (!s2[i] || !is[D.type[i]]) continue; const k = D.oi[i], c = GR.g[D.cust[i]], t = GR.st[c]; if (!seen2[k]) { seen2[k] = 1; A.tRev[t] += D.oTotal[k]; A.tOrd[t]++; if (!sc[c]) { sc[c] = 1; A.tStores[t]++; } } }
    }
    // lapsed: whole history (other filters still apply)
    // Same shop can have several phone numbers and can also order under another order type, so group by shop name and count any recent order.
    const G = GR, s3 = F.mask(D.minDay, D.maxDay, 1), seen3 = new Uint8Array(D.nOrders), L = new Map();
    for (let i = 0; i < D.n; i++) {
      if (!s3[i]) continue; const k = D.oi[i], g = G.g[D.cust[i]]; if (!G.b2b[g] || seen3[k]) continue; seen3[k] = 1;
      const e = L.get(g) || L.set(g, { c: g, last: -1e9, first: 1e9, n: 0, rev: 0, city: 0 }).get(g);
      e.n++; e.rev += D.oTotal[k]; if (D.oDay[k] > e.last) { e.last = D.oDay[k]; e.city = D.oCity[k]; } if (D.oDay[k] < e.first) e.first = D.oDay[k];
    }
    A.lapsedAll = [...L.values()]; return A;
  }
  function missingFor(A, c) {                                     // popular products among similar stores that this store does not buy
    const D = Store.D, np = A.np, t = D.hasST ? groups(D).st[c] : 0, useType = A.peers[t] >= 5, base = useType ? A.pen.subarray(t * np, (t + 1) * np) : A.gpen, peers = useType ? A.peers[t] : A.stores.length, out = [];
    for (let p = 0; p < np; p++) if (!A.seen[A.sl[c] * np + p] && base[p] / peers >= .1) out.push([p, base[p] / peers]);
    return out.sort((a, b) => b[1] - a[1]);
  }
  function openStore(r) {
    const D = Store.D, A = last, c = r.c, np = A.np, bought = [], miss = missingFor(A, c);
    for (let p = 0; p < np; p++) if (A.seen[A.sl[c] * np + p]) bought.push([p, A.units[A.sl[c] * np + p]]); bought.sort((a, b) => b[1] - a[1]);
    const kv = (l, v) => h('div', { class: 'dkv' }, h('span', null, l), h('b', null, v));
    UI.drawer(groups(D).label[c], 'Phone ' + groups(D).phone[c], h('div', null,
      h('div', { class: 'kvs' }, kv('Store type', typeName(D, c) || '—'), kv('City', D.dict.city[A.city[c]] || '—'), kv('Orders in period', fmtInt(A.ord[c])), kv('Revenue in period', money0(A.rev[c])), kv('Different products bought', bought.length)),
      h('h4', null, 'Buys now (units)'), h('table', { class: 'lines' }, h('tbody', null, bought.map(([p, u]) => h('tr', null, h('td', null, D.dict.prod[p]), h('td', { class: 'r' }, fmtInt(u)))))),
      h('h4', null, `Not buying yet – popular with similar ${D.hasST ? typeName(D, c).toLowerCase() + 's' : 'stores'}`), miss.length ? h('table', { class: 'lines' }, h('tbody', null, miss.map(([p, f]) => h('tr', null, h('td', null, D.dict.prod[p]), h('td', { class: 'r' }, pct(f, 0) + ' of stores buy'))))) : h('div', { class: 'empty' }, 'Nothing missing – this store already buys the popular products')));
  }
  function openLapsed(e) {
    const D = Store.D, kv = (l, v) => h('div', { class: 'dkv' }, h('span', null, l), h('b', null, v)), gapAvg = e.n > 1 ? Math.round((e.last - e.first) / (e.n - 1)) : null;
    UI.drawer(groups(D).label[e.c], 'Phone ' + groups(D).phone[e.c], h('div', { class: 'kvs' }, kv('Store type', typeName(D, e.c) || '—'), kv('City', D.dict.city[e.city] || '—'), kv('Last order', dLong(e.last)), kv('Days since last order', D.maxDay - e.last), kv('Typical gap between orders', gapAvg == null ? '—' : gapAvg + ' days'), kv('Orders (all time)', fmtInt(e.n)), kv('Revenue (all time)', money0(e.rev))));
  }
  function update() {
    try { update2(); } catch (e) { console.error(e); els.kpis.replaceChildren(h('div', { class: 'warn' }, 'B2B Stores could not be built: ' + (e && e.message || e))); }
  }
  function update2() {
    const D = Store.D, { from, to } = F.range(), A = last = compute(from, to), bf = firstOrder(D), nd = to - from + 1, np = A.np;
    els.sub.textContent = `${dLong(from)} – ${dLong(to)}` + (F.isActive() ? ' · filtered' : '');
    const lapsed = A.lapsedAll.filter(e => D.maxDay - e.last >= lapseGap).sort((a, b) => b.rev - a.rev);
    els.kpis.replaceChildren(UI.kpi({ label: 'Total B2B stores', value: fmtInt(A.stores.length), hint: 'ordered in period' }), UI.kpi({ label: 'Total revenue', value: money0(A.total), hint: 'new + existing stores' }),
      UI.kpi({ label: 'Revenue – new stores only', value: money0(A.revNew), hint: A.total ? pct(A.revNew / A.total, 0) + ' of revenue' : '' }), UI.kpi({ label: 'New stores', value: fmtInt(A.newCount), hint: 'first order since ' + dLong(A.cut) }),
      UI.kpi({ label: `Not ordered ${lapseGap}+ days`, value: fmtInt(lapsed.length), hint: money0(lapsed.reduce((s, e) => s + e.rev, 0)) + ' all-time revenue' }));
    // store types
    if (D.hasST) {
      const ids = Array.from({ length: D.stAll.length }, (_, t) => t).filter(t => A.tRev[t] > 0).sort((a, b) => A.tRev[b] - A.tRev[a]);
      Charts.hbar(els.types, ids.map(t => ({ key: D.stAll[t], label: D.stAll[t], value: A.tRev[t], sub: fmtInt(A.tStores[t]) + ' stores · ' + fmtInt(A.tOrd[t]) + ' orders', color: 'var(--c1)' })), { fmt: moneyC, tipFmt: money0, valueName: 'Revenue', selected: F.st.stypes, onClick: it => F.toggle('stypes', it.key) });
    } else els.types.replaceChildren(h('div', { class: 'empty' }, 'Add a "StoreTypes" tab to the Google Sheet (bus_name, city, code_value) to see store types.'));
    // revenue over time
    const g = nd < 45 ? 1 : nd < 190 ? 7 : 30, x = [], rv = [], od = [];
    for (let d = 0; d < nd; d += g) { let r = 0, o = 0; for (let j = d; j < Math.min(nd, d + g); j++) { r += A.revDay[j]; o += A.ordDay[j]; } x.push(from + d); rv.push(r); od.push(o); }
    Charts.trend(els.trend, { x, a: { name: 'Revenue', data: rv, fmt: money2, axis: moneyC }, b: { name: 'Orders', data: od, fmt: fmtInt }, label: i => (g === 1 ? '' : 'From ') + dLong(x[i]), tick: i => dShort(x[i]) });
    // new stores opened
    const monthly = nd > 190, key = d => monthly ? monthStart(d) : weekStart(d), cnt = new Map(), warm = D.minDay + 7;
    for (const c of A.stores) { const d = bf[c]; if (d >= from && d <= to && d >= warm) cnt.set(key(d), (cnt.get(key(d)) || 0) + 1); }
    const items = []; for (let d = key(Math.max(from, warm)); d <= to; d = monthly ? monthStart(d + 32) : d + 7) items.push({ key: d, label: monthly ? MON[dt(d).getUTCMonth()] : dShort(d), fullLabel: (monthly ? 'Month of ' : 'Week of ') + dLong(d), value: cnt.get(d) || 0 });
    Charts.columns(els.opened, items, { fmt: fmtInt, valueName: 'New stores', color: 'var(--c3)' });
    Charts.donut(els.mix, [{ key: 'n', label: 'New stores', value: A.revNew, color: 'var(--c3)' }, { key: 'e', label: 'Existing stores', value: A.revOld, color: 'var(--c1)' }], { fmt: money0, valueName: 'Revenue', center: moneyC(A.total), centerLabel: 'revenue' });
    const topC = Array.from({ length: A.cityOrd.length }, (_, y) => y).filter(y => A.cityOrd[y] > 0).sort((a, b) => A.cityOrd[b] - A.cityOrd[a]).slice(0, 12);
    Charts.hbar(els.city, topC.map(y => ({ key: D.dict.city[y], label: D.dict.city[y] || '(unknown)', value: A.cityOrd[y], color: 'var(--c2)' })), { fmt: fmtInt, valueName: 'Orders', selected: F.st.cities, onClick: it => F.toggle('cities', it.key) });
    const topP = Array.from({ length: np }, (_, p) => p).filter(p => A.prodU[p] > 0).sort((a, b) => A.prodU[b] - A.prodU[a]).slice(0, 12);
    Charts.hbar(els.prod, topP.map(p => ({ key: D.dict.prod[p], label: D.dict.prod[p], value: A.prodU[p], sub: fmtInt(A.gpen[p]) + ' stores buy it' })), { fmt: fmtInt, valueName: 'Units', selected: F.st.prods, onClick: it => F.toggle('prods', it.key) });
    els.tbl.update(A.stores.filter(c => bf[c] >= A.cut).sort((a, b) => A.rev[b] - A.rev[a]));
    els.lapsed.update(lapsed);
    const low = A.stores.filter(c => A.nProd[c] >= 1 && A.nProd[c] <= maxItems).map(c => ({ c, miss: missingFor(A, c) })).sort((a, b) => A.rev[b.c] - A.rev[a.c]);
    els.low.update(low);
    els.lowSub.textContent = `${fmtInt(low.length)} of ${fmtInt(A.stores.length)} stores in the period buy ${maxItems} or fewer different products`;
    [els.lapseSeg, els.itemSeg].forEach(sg => sg.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === (sg === els.lapseSeg ? lapseGap : maxItems))));
    els.warm.textContent = `"New" = the store's first B2B order in the Google Sheet (data starts ${dLong(D.minDay)}) falls in the last ${NEW_DAYS} days of data, so stores that already ordered before the sheet starts can look new until it holds more history; the first 7 days are left out of the "opened" graph. "Not ordered" counts from the latest date in the data across the whole history. "Missing products" are products bought by at least 10% of similar stores (same store type) that this store has not ordered in the selected period.`;
  }
  function mount(root) {
    const D = Store.D, bf = () => firstOrder(D), seg = (vals, cur, set, suf) => h('div', { class: 'seg' }, vals.map(v => h('button', { type: 'button', 'data-v': v, onclick: () => { set(v); update(); } }, v + suf)));
    els.sub = h('span'); els.kpis = h('div', { class: 'kpis k5' }); els.types = h('div'); els.trend = h('div'); els.mix = h('div'); els.opened = h('div'); els.city = h('div'); els.prod = h('div'); els.warm = h('div', { class: 'note' }); els.lowSub = h('span');
    els.lapseSeg = seg([30, 45, 60, 90], lapseGap, v => { lapseGap = v; store.set('lapse', v); }, 'd'); els.itemSeg = seg([3, 4, 5, 6], maxItems, v => { maxItems = v; store.set('maxitems', v); }, '');
    const T = c => typeName(D, c), sr = { placeholder: 'Search store…', text: c => groups(D).search[c] };
    els.tbl = UI.table({ pageSize: 10, rows: [], csvName: 'new-stores.csv', search: sr, cols: [
      { label: 'Store', get: c => groups(D).label[c], cls: () => 'strong' }, ...(D.hasST ? [{ label: 'Type', get: T }] : []), { label: 'City', get: c => D.dict.city[last.city[c]] },
      { label: 'First order', get: c => dShort(bf()[c]), val: c => bf()[c], csv: c => dISO(bf()[c]) }, { label: 'Orders', align: 'r', get: c => fmtInt(last.ord[c]), val: c => last.ord[c] },
      { label: 'Revenue', align: 'r', get: c => money0(last.rev[c]), val: c => last.rev[c], csv: c => last.rev[c].toFixed(2) }] });
    els.lapsed = UI.table({ pageSize: 10, rows: [], onRow: openLapsed, csvName: 'stores-not-ordering.csv', search: { placeholder: 'Search store…', text: e => groups(D).search[e.c] }, cols: [
      { label: 'Store', get: e => groups(D).label[e.c], cls: () => 'strong', val: e => groups(D).label[e.c] }, ...(D.hasST ? [{ label: 'Type', get: e => T(e.c), val: e => T(e.c) }] : []), { label: 'City', get: e => D.dict.city[e.city], val: e => D.dict.city[e.city] },
      { label: 'Last order', get: e => dLong(e.last), val: e => e.last, csv: e => dISO(e.last) }, { label: 'Days since', align: 'r', get: e => D.maxDay - e.last, val: e => D.maxDay - e.last },
      { label: 'Usual gap', align: 'r', get: e => e.n > 1 ? Math.round((e.last - e.first) / (e.n - 1)) + 'd' : '—', val: e => e.n > 1 ? (e.last - e.first) / (e.n - 1) : 1e9 },
      { label: 'Orders', align: 'r', get: e => fmtInt(e.n), val: e => e.n }, { label: 'All-time revenue', align: 'r', get: e => money0(e.rev), val: e => e.rev, csv: e => e.rev.toFixed(2) }] });
    const miss = r => missingFor(last, r.c).slice(0, 6).map(([p, f]) => D.dict.prod[p] + ' (' + pct(f, 0) + ')').join(', ');
    els.low = UI.table({ pageSize: 10, rows: [], onRow: openStore, csvName: 'stores-low-variety.csv', search: { placeholder: 'Search store…', text: r => groups(D).search[r.c] }, cols: [
      { label: 'Store', get: r => groups(D).label[r.c], cls: () => 'strong', val: r => groups(D).label[r.c] }, ...(D.hasST ? [{ label: 'Type', get: r => T(r.c), val: r => T(r.c) }] : []), { label: 'City', get: r => D.dict.city[last.city[r.c]], val: r => D.dict.city[last.city[r.c]] },
      { label: 'Items', align: 'r', get: r => last.nProd[r.c], val: r => last.nProd[r.c] }, { label: 'Orders', align: 'r', get: r => fmtInt(last.ord[r.c]), val: r => last.ord[r.c] },
      { label: 'Revenue', align: 'r', get: r => money0(last.rev[r.c]), val: r => last.rev[r.c], csv: r => last.rev[r.c].toFixed(2) },
      { label: 'Buys now', get: r => { const o = []; for (let p = 0; p < last.np; p++) if (last.seen[last.sl[r.c] * last.np + p]) o.push(D.dict.prod[p]); return o.join(', '); }, cls: () => 'wrap' },
      { label: 'Could also sell (share of similar stores)', get: miss, csv: miss, cls: () => 'wrap' }] });
    root.replaceChildren(h('div', { class: 'pagehead' }, h('h2', null, 'B2B Stores'), els.sub), els.kpis, h('div', { class: 'grid' },
      UI.card('Store types', els.types, { span: 4, sub: 'B2B revenue · click a type to see its performance everywhere' }),
      UI.card('Revenue over time', els.trend, { span: 8, sub: 'Follows the selected store type, dates and filters' }),
      UI.card('New stores opened', els.opened, { span: 7, sub: 'Stores by date of their first B2B order' }),
      UI.card('Revenue: new vs existing stores', els.mix, { span: 5, sub: 'New = first order in the last 60 days of data' }),
      UI.card('B2B sales by city', els.city, { span: 6, sub: 'Number of orders · click a bar to filter' }),
      UI.card('Top products', els.prod, { span: 6, sub: 'Units sold to the selected stores · click to filter' }),
      UI.card('New stores', els.tbl, { span: 12, sub: 'Stores whose first order is in the last 60 days' }),
      UI.card('Stores that have not ordered recently', els.lapsed, { span: 12, sub: 'No B2B order for the selected number of days · call them · click a row for details', tools: els.lapseSeg }),
      UI.card('Stores buying only a few products', els.low, { span: 12, sub: els.lowSub, tools: h('div', { class: 'tl' }, h('span', null, 'Max items'), els.itemSeg) }),
      UI.card('How these numbers are worked out', els.warm, { span: 12, cls: 'flat' })));
  }
  return { title: 'B2B Stores', mount, update };
})();
