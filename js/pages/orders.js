/* Page: Orders list (one row per order, honours every filter). */
Pages.orders = (() => {
  let root, tbl, sub, sum;
  function rowsNow() {
    const D = Store.D, { from, to } = F.range(), sel = F.mask(from, to, 0), seen = new Uint8Array(D.nOrders), out = []; let rev = 0, units = 0;
    for (let i = 0; i < D.n; i++) if (sel[i]) { const k = D.oi[i]; if (!seen[k]) { seen[k] = 1; out.push(k); rev += D.oTotal[k]; } units += D.qty[i]; }
    return { out, rev, units, from, to };
  }
  function update() {
    const D = Store.D, r = rowsNow();
    sub.textContent = `${dLong(r.from)} – ${dLong(r.to)}` + (F.isActive() ? ' · filtered' : '');
    sum.textContent = `${fmtInt(r.out.length)} orders · ${money0(r.rev)} · ${fmtInt(r.units)} units`;
    tbl.update(r.out.sort((a, b) => D.oDay[b] - D.oDay[a] || D.oId[b] - D.oId[a]));
  }
  function mount(container) {
    root = container; const D = Store.D;
    sub = h('span'); sum = h('div', { class: 'sumline' });
    const ln = k => D.oStart[k + 1] - D.oStart[k];
    tbl = UI.table({ pageSize: 25, rows: [], onRow: k => UI.openOrder(k), csvName: 'orders.csv',
      search: { placeholder: 'Search order #, customer, phone, city…', text: k => (D.oId[k] + ' ' + D.custSearch[D.oCust[k]] + ' ' + D.dict.city[D.oCity[k]]).toLowerCase() },
      cols: [
        { label: 'Date', get: k => dShort(D.oDay[k]), val: k => D.oDay[k], csv: k => dISO(D.oDay[k]) },
        { label: 'Order #', get: k => D.oId[k], val: k => D.oId[k] },
        { label: 'Customer', get: k => D.custLabel[D.oCust[k]], cls: () => 'strong' },
        { label: 'Phone', get: k => D.rawPhone[D.rawCust[D.oStart[k]]], val: k => D.rawPhone[D.rawCust[D.oStart[k]]] },
        { label: 'Type', get: k => UI.pill(D.dict.type[D.oType[k]], D.oType[k]), val: k => D.oType[k], csv: k => D.dict.type[D.oType[k]] },
        { label: 'City', get: k => D.dict.city[D.oCity[k]] },
        { label: 'Lines', align: 'r', get: ln, val: ln },
        { label: 'Units', align: 'r', get: k => fmtInt(D.oUnits[k]), val: k => D.oUnits[k], csv: k => D.oUnits[k] },
        { label: 'Amount', align: 'r', get: k => money2(D.oTotal[k]), val: k => D.oTotal[k], csv: k => D.oTotal[k].toFixed(2) }] });
    root.replaceChildren(h('div', { class: 'pagehead' }, h('h2', null, 'Orders'), sub), UI.card('All orders', tbl, { span: 12, sub: sum, cls: 'flat' }));
    root.querySelector('.card header p').replaceWith(sum);
  }
  return { title: 'Orders', mount, update };
})();
