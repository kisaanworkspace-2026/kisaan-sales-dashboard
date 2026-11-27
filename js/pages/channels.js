/* Page: B2B vs B2C (all order types side by side). Revenue per order; units/customers per line. */
Pages.channels = (() => {
  let els = {}, last = null;
  function compute(from, to) {
    const D = Store.D, nt = D.dict.type.length, nc = D.custName.length, nd = to - from + 1, sel = F.mask(from, to, 0);
    const A = { rev: new Float64Array(nt), ord: new Int32Array(nt), units: new Float64Array(nt), cust: new Int32Array(nt), seen: new Uint8Array(nt * nc), day: new Float64Array(nt * nd), dow: new Float64Array(nt * 7), dayOrd: new Float64Array(nd), nd, tot: 0 };
    const seenO = new Uint8Array(D.nOrders);
    for (let i = 0; i < D.n; i++) {
      if (!sel[i]) continue;
      const t = D.type[i], c = D.cust[i], k = D.oi[i], di = D.day[i] - from;
      A.units[t] += D.qty[i];
      if (!A.seen[t * nc + c]) { A.seen[t * nc + c] = 1; A.cust[t]++; }
      if (!seenO[k]) { seenO[k] = 1; const v = D.oTotal[k]; A.rev[t] += v; A.ord[t]++; A.day[t * nd + di] += v; A.dow[t * 7 + dowOf(D.day[i])] += v; A.dayOrd[di]++; A.tot += v; }
    }
    return A;
  }
  function stackedTime(el, x, series, g) {                          // series:[{name,color,data}]
    const H = 250, M = { l: 52, r: 10, t: 12, b: 26 };
    const draw = W => {
      el.innerHTML = ''; const n = x.length, iw = W - M.l - M.r, ih = H - M.t - M.b, tot = x.map((_, i) => series.reduce((s, q) => s + q.data[i], 0)), ya = nice(Math.max(0, ...tot));
      const svg = s('svg', { width: W, height: H, class: 'chart' }), px = i => M.l + (i + .5) * iw / n, bw = Math.max(1, Math.min(26, iw / n * .7)), py = v => M.t + ih - v / ya.max * ih;
      for (let v = 0; v <= ya.max + 1e-9; v += ya.step) svg.append(s('line', { x1: M.l, x2: W - M.r, y1: py(v), y2: py(v), class: 'grid' }), s('text', { x: M.l - 8, y: py(v) + 4, class: 'ax', 'text-anchor': 'end' }, moneyC(v)));
      x.forEach((d, i) => { let acc = 0; series.forEach(q => { const v = q.data[i]; if (v > 0) { svg.append(s('rect', { x: px(i) - bw / 2, y: py(acc + v), width: bw, height: Math.max(0, py(acc) - py(acc + v)), fill: q.color })); acc += v; } }); });
      const every = Math.ceil(n / Math.max(2, Math.floor(iw / 70))); x.forEach((d, i) => { if (i % every === 0) svg.append(s('text', { x: px(i), y: H - 6, class: 'ax', 'text-anchor': 'middle' }, dShort(d))); });
      const ov = s('rect', { x: M.l, y: M.t, width: iw, height: ih, fill: 'transparent' });
      ov.addEventListener('mousemove', ev => { const r = ov.getBoundingClientRect(), i = Math.max(0, Math.min(n - 1, Math.floor((ev.clientX - r.left) / r.width * n))); Tip.show(`<b>${g > 1 ? 'From ' : ''}${dLong(x[i])}</b>` + series.map(q => `<div class="tr"><i style="background:${q.color}"></i>${q.name}<span>${money0(q.data[i])}</span></div>`).join('') + `<div class="tr dimt">Total<span>${money0(tot[i])}</span></div>`, ev); });
      ov.addEventListener('mouseleave', Tip.hide); svg.append(ov); el.append(svg);
    };
    if (el._ro) el._ro.disconnect(); el._ro = onResize(el, draw); if (el.clientWidth) draw(el.clientWidth);
  }
  function calendar(el, from, to, A) {
    const D = Store.D, start = Math.max(from, to - 7 * 53 + 1), w0 = weekStart(start), weeks = Math.floor((weekStart(to) - w0) / 7) + 1, nt = D.dict.type.length, nd = A.nd;
    const val = d => A.dayOrd[d - from], rev = d => { let s = 0; for (let t = 0; t < nt; t++) s += A.day[t * nd + d - from]; return s; };
    let mx = 0; for (let d = start; d <= to; d++) mx = Math.max(mx, val(d));
    const grid = h('div', { class: 'cal', style: { gridTemplateColumns: `22px repeat(${weeks}, 22px)` } });
    DOW.forEach((l, r) => grid.append(h('span', { class: 'cl', style: { gridRow: r + 2, gridColumn: 1 } }, r % 2 ? '' : l[0])));
    let lastM = -1;
    for (let w = 0; w < weeks; w++) { const m = dt(w0 + w * 7).getUTCMonth(); if (m !== lastM) { lastM = m; grid.append(h('span', { class: 'cm', style: { gridRow: 1, gridColumn: w + 2 } }, MON[m])); } }
    for (let w = 0; w < weeks; w++) for (let r = 0; r < 7; r++) {
      const d = w0 + w * 7 + r; if (d < start || d > to) continue;
      const v = val(d), cell = h('div', { class: 'cc' + (v ? '' : ' z'), style: { gridRow: r + 2, gridColumn: w + 2, background: v ? `color-mix(in srgb, var(--c1) ${Math.round(18 + v / mx * 82)}%, transparent)` : '' } });
      cell.addEventListener('mousemove', ev => Tip.show(`<b>${DOW[r]} ${dLong(d)}</b><div class="tr">Orders<span>${fmtInt(v)}</span></div><div class="tr dimt">Revenue<span>${money0(rev(d))}</span></div>`, ev));
      cell.addEventListener('mouseleave', Tip.hide); cell.addEventListener('click', () => { Tip.hide(); F.set({ preset: 'custom', from: d, to: d }); });
      grid.append(cell);
    }
    el.replaceChildren(grid);
  }
  function update() {
    const D = Store.D, { from, to } = F.range(), A = last = compute(from, to), nt = D.dict.type.length, nd = A.nd, ids = [];
    for (let t = 0; t < nt; t++) if (A.ord[t] > 0) ids.push(t); ids.sort((a, b) => A.rev[b] - A.rev[a]);
    els.sub.textContent = `${dLong(from)} – ${dLong(to)}` + (F.isActive() ? ' · filtered' : '');
    els.cards.replaceChildren(...ids.map(t => h('div', { class: 'tcard click' + (F.st.types.has(D.dict.type[t]) ? ' on' : ''), title: 'Click to filter the whole dashboard to ' + D.dict.type[t].toUpperCase() + ' (click again to remove)', onclick: () => F.toggle('types', D.dict.type[t]), style: { '--pc': D.typeColor[t] } },
      h('div', { class: 'tc-h' }, UI.pill(D.dict.type[t], t), h('span', null, pct(A.rev[t] / (A.tot || 1)) + ' of revenue')),
      h('div', { class: 'kv' }, money0(A.rev[t])),
      h('div', { class: 'tc-g' }, [['Orders', fmtInt(A.ord[t])], ['Customers', fmtInt(A.cust[t])], ['Avg order', money0(A.rev[t] / A.ord[t])], ['Units / order', (A.units[t] / A.ord[t]).toFixed(1)], ['Revenue / day', money0(A.rev[t] / nd)], ['Orders / day', (A.ord[t] / nd).toFixed(1)]].map(([l, v]) => h('div', null, h('span', null, l), h('b', null, v)))),
      Charts.spark(A.day.subarray(t * nd, (t + 1) * nd), D.typeColor[t]))));
    const g = nd < 45 ? 1 : nd < 190 ? 7 : 30, nb = Math.ceil(nd / g), x = Array.from({ length: nb }, (_, i) => from + i * g);
    stackedTime(els.time, x, ids.map(t => ({ name: D.dict.type[t].toUpperCase(), color: D.typeColor[t], data: x.map((_, b) => { let s2 = 0; for (let j = b * g; j < Math.min(nd, b * g + g); j++) s2 += A.day[t * nd + j]; return s2; }) })), g);
    els.legend.replaceChildren(...ids.map(t => h('span', { class: 'lg' }, h('i', { style: { background: D.typeColor[t] } }), D.dict.type[t].toUpperCase())));
    const mxd = Math.max(1, ...DOW.map((_, d) => ids.reduce((s2, t) => s2 + A.dow[t * 7 + d], 0)));
    els.dow.replaceChildren(...DOW.map((l, d) => { const tot = ids.reduce((s2, t) => s2 + A.dow[t * 7 + d], 0); const c = h('div', { class: 'col' }, h('div', { class: 'cv' }, moneyC(tot)), h('div', { class: 'cb stackcol', style: { height: Math.max(2, tot / mxd * 100) + '%' } }, ids.map(t => h('div', { style: { height: tot ? A.dow[t * 7 + d] / tot * 100 + '%' : 0, background: D.typeColor[t] } }))), h('div', { class: 'cl' }, l));
      c.addEventListener('mousemove', ev => Tip.show(`<b>${l}</b>` + ids.map(t => `<div class="tr"><i style="background:${D.typeColor[t]}"></i>${D.dict.type[t].toUpperCase()}<span>${money0(A.dow[t * 7 + d])}</span></div>`).join(''), ev)); c.addEventListener('mouseleave', Tip.hide); return c; }));
    calendar(els.cal, from, to, A);
  }
  function mount(root) {
    els.sub = h('span'); els.cards = h('div', { class: 'tcards' }); els.time = h('div'); els.legend = h('div', { class: 'legend row' }); els.dow = h('div', { class: 'cols' }); els.cal = h('div', { class: 'twrap' });
    root.replaceChildren(h('div', { class: 'pagehead' }, h('h2', null, 'B2B vs B2C'), els.sub), els.cards, h('div', { class: 'grid' },
      UI.card('Revenue over time by order type', h('div', null, els.time, els.legend), { span: 8 }),
      UI.card('Revenue by weekday', els.dow, { span: 4, sub: 'Stacked by order type' }),
      UI.card('Delivery calendar', els.cal, { span: 12, sub: 'Orders per day (darker = more orders) · click a day to filter the dashboard to it' })));
  }
  return { title: 'B2B vs B2C', mount, update };
})();
