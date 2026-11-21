/* Dependency-free charts (SVG/HTML). All take plain arrays, respond to resize, show tooltips and support click-to-filter. */
const Tip = (() => {
  let el;
  const get = () => el || (el = document.getElementById('tip'));
  return {
    show(html, ev) {
      const t = get(); t.innerHTML = html; t.style.display = 'block';
      const w = t.offsetWidth, hh = t.offsetHeight; let x = ev.clientX + 14, y = ev.clientY + 14;
      if (x + w > innerWidth - 8) x = ev.clientX - w - 14; if (y + hh > innerHeight - 8) y = ev.clientY - hh - 14;
      t.style.transform = `translate(${x}px,${y}px)`;
    },
    hide() { get().style.display = 'none'; }
  };
})();
const onResize = (el, fn) => { const ro = new ResizeObserver(rafOnce(() => el.isConnected && el.clientWidth && fn(el.clientWidth))); ro.observe(el); return ro; };

const Charts = {
  /** Combo time-series: area line (left axis) + bars (right axis).  opts: {x:[day], a:{name,data,fmt}, b:{name,data,fmt}, label(i)} */
  trend(el, o) {
    el.innerHTML = '';
    const H = 270, M = { l: 52, r: 44, t: 14, b: 26 };
    const draw = W => {
      el.innerHTML = '';
      const n = o.x.length, iw = W - M.l - M.r, ih = H - M.t - M.b;
      const ya = nice(Math.max(0, ...o.a.data)), yb = nice(Math.max(0, ...o.b.data) * 2.4);   // bars stay in the lower part
      const px = i => M.l + (n === 1 ? iw / 2 : (i + .5) * iw / n), pya = v => M.t + ih - v / ya.max * ih, pyb = v => M.t + ih - v / yb.max * ih;
      const svg = s('svg', { width: W, height: H, class: 'chart' });
      for (let v = 0; v <= ya.max + 1e-9; v += ya.step) {
        const y = pya(v); svg.append(s('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, class: 'grid' }), s('text', { x: M.l - 8, y: y + 4, class: 'ax', 'text-anchor': 'end' }, o.a.axis(v)));
      }
      for (let v = 0; v <= yb.max + 1e-9; v += yb.step) if (v) svg.append(s('text', { x: W - M.r + 8, y: pyb(v) + 4, class: 'ax ax2' }, compact(v)));
      const bw = Math.max(1, Math.min(18, iw / n * .62));
      o.b.data.forEach((v, i) => { if (v > 0) svg.append(s('rect', { x: px(i) - bw / 2, y: pyb(v), width: bw, height: pyb(0) - pyb(v), class: 'bar2', rx: bw > 4 ? 2 : 0 })); });
      const pts = o.a.data.map((v, i) => [px(i), pya(v)]);
      if (n > 1) {
        svg.append(s('path', { d: 'M' + pts.map(p => p.join(',')).join('L') + `L${pts[n - 1][0]},${pya(0)}L${pts[0][0]},${pya(0)}Z`, class: 'area' }));
        svg.append(s('path', { d: 'M' + pts.map(p => p.join(',')).join('L'), class: 'line' }));
      }
      if (n <= 45) pts.forEach(p => svg.append(s('circle', { cx: p[0], cy: p[1], r: 2.6, class: 'dot' })));
      const every = Math.ceil(n / Math.max(2, Math.floor(iw / 70)));
      o.x.forEach((_, i) => { if (i % every === 0) svg.append(s('text', { x: px(i), y: H - 6, class: 'ax', 'text-anchor': 'middle' }, o.tick(i))); });
      const cross = s('line', { y1: M.t, y2: M.t + ih, class: 'cross', style: 'display:none' }), hot = s('circle', { r: 5, class: 'dot hot', style: 'display:none' });
      const ov = s('rect', { x: M.l, y: M.t, width: iw, height: ih, fill: 'transparent' });
      ov.addEventListener('mousemove', ev => {
        const r = ov.getBoundingClientRect(), i = Math.max(0, Math.min(n - 1, Math.floor((ev.clientX - r.left) / r.width * n)));
        cross.setAttribute('x1', px(i)); cross.setAttribute('x2', px(i)); cross.style.display = '';
        hot.setAttribute('cx', px(i)); hot.setAttribute('cy', pya(o.a.data[i])); hot.style.display = '';
        Tip.show(`<b>${o.label(i)}</b><div class="tr"><i style="background:var(--c1)"></i>${o.a.name}<span>${o.a.fmt(o.a.data[i])}</span></div><div class="tr"><i style="background:var(--c2)"></i>${o.b.name}<span>${o.b.fmt(o.b.data[i])}</span></div>`, ev);
      });
      ov.addEventListener('mouseleave', () => { cross.style.display = hot.style.display = 'none'; Tip.hide(); });
      svg.append(cross, hot, ov); el.append(svg);
    };
    if (el._ro) el._ro.disconnect();
    el._ro = onResize(el, draw); if (el.clientWidth) draw(el.clientWidth);
  },

  /** Horizontal bars (HTML). items:[{key,label,value,sub}] ; opts:{fmt,selected:Set,onClick,color} */
  hbar(el, items, o = {}) {
    const max = Math.max(1e-9, ...items.map(i => i.value));
    el.innerHTML = ''; el.classList.add('hbar');
    if (!items.length) return el.append(h('div', { class: 'empty' }, 'No data for this selection'));
    const sel = o.selected && o.selected.size ? o.selected : null;
    items.forEach(it => {
      const on = !sel || sel.has(it.key);
      const row = h('div', { class: 'hrow' + (on ? '' : ' dim') + (o.onClick ? ' click' : '') },
        h('div', { class: 'hl', title: it.label }, it.label),
        h('div', { class: 'ht' }, h('div', { class: 'hf', style: { width: Math.max(1.5, it.value / max * 100) + '%', background: it.color || o.color || 'var(--c1)' } })),
        h('div', { class: 'hv' }, o.fmt(it.value)));
      row.addEventListener('mousemove', ev => Tip.show(`<b>${it.label}</b><div class="tr">${o.valueName || 'Value'}<span>${(o.tipFmt || o.fmt)(it.value)}</span></div>${it.sub ? `<div class="tr dimt">${it.sub}</div>` : ''}`, ev));
      row.addEventListener('mouseleave', Tip.hide);
      if (o.onClick) row.addEventListener('click', () => { Tip.hide(); o.onClick(it); });
      el.append(row);
    });
  },

  /** Vertical columns (HTML/SVG-free). items:[{key,label,value}] */
  columns(el, items, o = {}) {
    el.innerHTML = ''; el.classList.add('cols');
    const max = Math.max(1e-9, ...items.map(i => i.value)), sel = o.selected && o.selected.size ? o.selected : null;
    items.forEach(it => {
      const on = !sel || sel.has(it.key);
      const c = h('div', { class: 'col' + (on ? '' : ' dim') + (o.onClick ? ' click' : '') },
        h('div', { class: 'cv' }, o.fmt(it.value)), h('div', { class: 'cb', style: { height: Math.max(2, it.value / max * 100) + '%', background: o.color || 'var(--c1)' } }), h('div', { class: 'cl' }, it.label));
      c.addEventListener('mousemove', ev => Tip.show(`<b>${it.fullLabel || it.label}</b><div class="tr">${o.valueName}<span>${(o.tipFmt || o.fmt)(it.value)}</span></div>`, ev));
      c.addEventListener('mouseleave', Tip.hide);
      if (o.onClick) c.addEventListener('click', () => { Tip.hide(); o.onClick(it); });
      el.append(c);
    });
  },

  /** Donut + legend. items:[{key,label,value,color}] */
  donut(el, items, o = {}) {
    el.innerHTML = ''; el.classList.add('donut');
    const tot = items.reduce((a, b) => a + b.value, 0), sel = o.selected && o.selected.size ? o.selected : null;
    if (!tot) return el.append(h('div', { class: 'empty' }, 'No data for this selection'));
    const R = 62, r = 40, svg = s('svg', { width: 160, height: 160, viewBox: '-80 -80 160 160' });
    let a0 = -Math.PI / 2;
    items.forEach(it => {
      const f = it.value / tot, a1 = a0 + f * Math.PI * 2 - (f > .999 ? .0001 : 0), lg = f > .5 ? 1 : 0, on = !sel || sel.has(it.key);
      const p = (a, rr) => [Math.cos(a) * rr, Math.sin(a) * rr];
      const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, r), [x3, y3] = p(a0, r);
      const path = s('path', { d: `M${x0},${y0}A${R},${R} 0 ${lg} 1 ${x1},${y1}L${x2},${y2}A${r},${r} 0 ${lg} 0 ${x3},${y3}Z`, fill: it.color, class: 'slice' + (on ? '' : ' dim') });
      path.addEventListener('mousemove', ev => Tip.show(`<b>${it.label}</b><div class="tr">${o.valueName}<span>${o.fmt(it.value)}</span></div><div class="tr">Share<span>${pct(f)}</span></div>`, ev));
      path.addEventListener('mouseleave', Tip.hide);
      if (o.onClick) path.addEventListener('click', () => { Tip.hide(); o.onClick(it); });
      svg.append(path); a0 = a1;
    });
    svg.append(s('text', { x: 0, y: -2, 'text-anchor': 'middle', class: 'dc-v' }, o.center), s('text', { x: 0, y: 14, 'text-anchor': 'middle', class: 'dc-l' }, o.centerLabel || ''));
    const lg = h('div', { class: 'legend' }, items.map(it => h('div', { class: 'lg' + (!sel || sel.has(it.key) ? '' : ' dim') + (o.onClick ? ' click' : ''), onclick: o.onClick ? () => o.onClick(it) : null },
      h('i', { style: { background: it.color } }), h('span', { class: 'ln' }, it.label), h('b', null, pct(it.value / tot)))));
    el.append(svg, lg);
  },

  spark(vals, color = 'var(--c1)') {
    vals = Array.from(vals); const W = 84, Hh = 28, n = vals.length;
    if (n < 2) return s('svg', { width: W, height: Hh });
    const mx = Math.max(...vals), mn = Math.min(...vals), rg = mx - mn || 1;
    const d = vals.map((v, i) => `${i ? 'L' : 'M'}${(i / (n - 1) * (W - 2) + 1).toFixed(1)},${(Hh - 3 - (v - mn) / rg * (Hh - 6)).toFixed(1)}`).join('');
    return s('svg', { width: W, height: Hh, class: 'spark' }, s('path', { d, fill: 'none', stroke: color, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }));
  }
};
