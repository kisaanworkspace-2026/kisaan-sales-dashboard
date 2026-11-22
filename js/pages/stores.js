/* Page: B2B Stores. Store = customer with at least one B2B order. New store = first B2B order within the last 60 days before the latest date in the data. */
Pages.stores = (() => {
  const NEW_DAYS = 60;
  let els = {}, last = null;
  const b2b = D => D._b2b || (D._b2b = D.dict.type.map(t => t.toLowerCase() === 'b2b'));
  function firstOrder(D) {                                         // first B2B order day per customer, whole sheet
    if (D._bf) return D._bf;
    const is = b2b(D), f = new Int32Array(D.custName.length).fill(1e9);
    for (let k = 0; k < D.nOrders; k++) if (is[D.oType[k]]) { const c = D.oCust[k]; if (D.oDay[k] < f[c]) f[c] = D.oDay[k]; }
    return D._bf = f;
  }
  function compute(from, to) {
    const D = Store.D, is = b2b(D), bf = firstOrder(D), cut = D.maxDay - (NEW_DAYS - 1), sel = F.mask(from, to, 0), nc = D.custName.length;
    const A = { rev: new Float64Array(nc), ord: new Int32Array(nc), city: new Uint16Array(nc), cityOrd: new Int32Array(D.dict.city.length), stores: [], revNew: 0, revOld: 0, newCount: 0 };
    const seenO = new Uint8Array(D.nOrders);
    for (let i = 0; i < D.n; i++) {
      if (!sel[i] || !is[D.type[i]]) continue;
      const k = D.oi[i], c = D.cust[i];
      if (!seenO[k]) {
        seenO[k] = 1; const t = D.oTotal[k];
        if (A.ord[c] === 0) { A.stores.push(c); A.city[c] = D.oCity[k]; if (bf[c] >= cut) A.newCount++; }
        A.ord[c]++; A.rev[c] += t; A.cityOrd[D.oCity[k]]++;
        if (bf[c] >= cut) A.revNew += t; else A.revOld += t;
      }
    }
    A.total = A.revNew + A.revOld; A.cut = cut; return A;
  }
  function update() {
    const D = Store.D, { from, to } = F.range(), A = last = compute(from, to), bf = firstOrder(D), nd = to - from + 1;
    els.sub.textContent = `${dLong(from)} – ${dLong(to)}` + (F.isActive() ? ' · filtered' : '');
    els.kpis.replaceChildren(
      UI.kpi({ label: 'Total B2B stores', value: fmtInt(A.stores.length), hint: 'ordered in period' }),
      UI.kpi({ label: 'Total revenue', value: money0(A.total), hint: 'new + existing stores' }),
      UI.kpi({ label: 'Revenue – new stores only', value: money0(A.revNew), hint: A.total ? pct(A.revNew / A.total, 0) + ' of revenue' : '' }),
      UI.kpi({ label: 'New stores', value: fmtInt(A.newCount), hint: 'first order since ' + dLong(A.cut) }));
    Charts.donut(els.mix, [{ key: 'n', label: 'New stores', value: A.revNew, color: 'var(--c3)' }, { key: 'e', label: 'Existing stores', value: A.revOld, color: 'var(--c1)' }], { fmt: money0, valueName: 'Revenue', center: moneyC(A.total), centerLabel: 'revenue' });
    // new stores opened per week (or month for long ranges), by first-ever B2B order; the first week of data is skipped (can't tell new from existing)
    const monthly = nd > 190, key = d => monthly ? monthStart(d) : weekStart(d), cnt = new Map(), warm = D.minDay + 7;
    for (const c of A.stores) { const d = bf[c]; if (d >= from && d <= to && d >= warm) cnt.set(key(d), (cnt.get(key(d)) || 0) + 1); }
    const items = []; for (let d = key(Math.max(from, warm)); d <= to; d = monthly ? monthStart(d + 32) : d + 7) items.push({ key: d, label: monthly ? MON[dt(d).getUTCMonth()] : dShort(d), fullLabel: (monthly ? 'Month of ' : 'Week of ') + dLong(d), value: cnt.get(d) || 0 });
    Charts.columns(els.opened, items, { fmt: fmtInt, valueName: 'New stores', color: 'var(--c3)' });
    const top = Array.from({ length: A.cityOrd.length }, (_, y) => y).filter(y => A.cityOrd[y] > 0).sort((a, b) => A.cityOrd[b] - A.cityOrd[a]).slice(0, 15);
    Charts.hbar(els.city, top.map(y => ({ key: D.dict.city[y], label: D.dict.city[y] || '(unknown)', value: A.cityOrd[y], color: 'var(--c2)' })), { fmt: fmtInt, valueName: 'Orders', selected: F.st.cities, onClick: it => F.toggle('cities', it.key) });
    els.tbl.update(A.stores.filter(c => bf[c] >= A.cut).sort((a, b) => A.rev[b] - A.rev[a]));
    els.warm.textContent = `"First order" means the store's first order in the Google Sheet (from ${dLong(D.minDay)}), so stores that were already ordering before the sheet starts can look new until it holds more history. The first 7 days of data are left out of the bar graph.`;
  }
  function mount(root) {
    const D = Store.D, bf = () => firstOrder(D);
    els.sub = h('span'); els.kpis = h('div', { class: 'kpis k4' }); els.mix = h('div'); els.opened = h('div'); els.city = h('div'); els.warm = h('div', { class: 'note' });
    els.tbl = UI.table({ pageSize: 10, rows: [], csvName: 'new-stores.csv', search: { placeholder: 'Search store…', text: c => D.custSearch[c] }, cols: [
      { label: 'Store', get: c => D.custLabel[c], cls: () => 'strong' }, { label: 'City', get: c => D.dict.city[last.city[c]] },
      { label: 'First order', get: c => dShort(bf()[c]), val: c => bf()[c], csv: c => dISO(bf()[c]) },
      { label: 'Orders', align: 'r', get: c => fmtInt(last.ord[c]), val: c => last.ord[c] },
      { label: 'Revenue', align: 'r', get: c => money0(last.rev[c]), val: c => last.rev[c], csv: c => last.rev[c].toFixed(2) }] });
    root.replaceChildren(h('div', { class: 'pagehead' }, h('h2', null, 'B2B Stores'), els.sub), els.kpis, h('div', { class: 'grid' },
      UI.card('New stores opened', els.opened, { span: 7, sub: 'Count of stores by date of their first B2B order' }),
      UI.card('Revenue: new vs existing stores', els.mix, { span: 5, sub: 'New = first order in the last 60 days of data' }),
      UI.card('B2B sales by city', els.city, { span: 6, sub: 'Number of orders · click a bar to filter' }),
      UI.card('New stores', els.tbl, { span: 6, sub: 'Stores whose first order is in the last 60 days' }),
      UI.card('How "new" is decided', els.warm, { span: 12, cls: 'flat' })));
  }
  return { title: 'B2B Stores', mount, update };
})();
