/* Reusable UI building blocks: cards, KPI tiles, slicers (dropdown filters), tables, drawer */
/* ---- help tooltips: text lives in js/help.js (Help object). Key = slug of the label (digits become n), optionally prefixed by the page id: 'stores.new-stores' wins over 'new-stores'. ---- */
const HelpUI = (() => {
  const slug = t => String(t || '').toLowerCase().replace(/[0-9]+/g, 'n').replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '');
  let pop = null, owner = null, touchAt = 0;
  const find = (label, key) => { const k = key || slug(label), H = typeof Help !== 'undefined' ? Help : {}; return H[(UI.page || '') + '.' + k] || H[k] || null; };
  const hide = () => { if (pop) { pop.remove(); pop = null; owner = null; } };
  const show = (btn, label, hp) => {
    if (owner === btn) return; hide(); owner = btn;
    pop = h('div', { class: 'htip', role: 'tooltip' }, h('b', null, label), h('p', null, hp.purpose), hp.calc ? h('p', { class: 'hcalc' }, h('em', null, 'How it is calculated: '), hp.calc) : null);
    document.body.append(pop);
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, ph = pop.offsetHeight, pad = 8;
    let x = Math.min(Math.max(pad, r.left + r.width / 2 - w / 2), innerWidth - w - pad), y = r.bottom + 8; if (y + ph > innerHeight - pad) y = Math.max(pad, r.top - ph - 8);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  document.addEventListener('touchstart', e => { touchAt = Date.now(); if (owner && !owner.contains(e.target)) hide(); }, true);
  document.addEventListener('mousedown', e => { if (owner && !owner.contains(e.target)) hide(); }, true);
  addEventListener('scroll', hide, true); addEventListener('resize', hide);
  return { slug, find, info(label, kind, key) {
    const hp = find(label, key); (UI._seen = UI._seen || new Map()).set(kind + '|' + (UI.page || '') + '|' + label, !!hp);
    if (!hp) return null;
    const b = h('button', { type: 'button', class: 'info', 'aria-label': 'About ' + label, onmouseenter: () => show(b, label, hp), onmouseleave: () => { if (Date.now() - touchAt > 1500) hide(); }, onfocus: () => show(b, label, hp), onblur: hide,
      onclick: e => { e.stopPropagation(); e.preventDefault(); show(b, label, hp); } }, 'i');
    return b;
  } };
})();
const UI = {
  info: (label, kind, key) => HelpUI.info(label, kind || 'other', key),
  card(title, body, { span = 4, sub, tools, cls = '' } = {}) {
    return h('section', { class: 'card ' + cls, style: { gridColumn: `span ${span}` } },
      h('header', null, h('div', null, h('h3', null, title, HelpUI.info(title, 'card')), sub ? h('p', null, sub) : null), tools || null), body);
  },

  kpi({ label, value, delta, deltaGood = 'up', spark, hint, color, onClick, tip }) {
    let d = null;
    if (delta != null && isFinite(delta)) {
      const up = delta >= 0, good = (deltaGood === 'up') === up;
      d = h('span', { class: 'delta ' + (Math.abs(delta) < .0005 ? 'flat' : good ? 'good' : 'bad') }, (up ? '▲ ' : '▼ ') + pct(Math.abs(delta)), h('em', null, ' vs prev'));
    } else d = h('span', { class: 'delta flat' }, hint || '—');
    const el = h('div', { class: 'kpi' + (onClick ? ' clickable' : ''), title: onClick ? (tip || 'Click for details') : null, role: onClick ? 'button' : null, tabindex: onClick ? 0 : null, onclick: onClick ? () => onClick() : null, onkeydown: onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : null }, h('div', { class: 'kl' }, label, HelpUI.info(label, 'kpi')), h('div', { class: 'kv' }, value), h('div', { class: 'kf' }, d, spark ? Charts.spark(spark, color) : null));
    return el;
  },

  /** Power-BI-style slicer: button + searchable checkbox list. */
  slicer({ label, options, selected, onToggle, onClear, icon }) {
    const root = h('div', { class: 'slicer' }), btn = h('button', { class: 'sbtn', type: 'button' });
    const render = () => { btn.replaceChildren(h('span', null, label), selected.size ? h('b', { class: 'badge' }, selected.size) : h('em', null, 'All'), h('i', { class: 'chev' })); btn.classList.toggle('on', selected.size > 0); };
    let panel = null;
    const close = () => { if (panel) { panel.remove(); panel = null; document.removeEventListener('mousedown', away, true); } };
    const away = e => { if (panel && !panel.contains(e.target) && !btn.contains(e.target)) close(); };
    const open = () => {
      const search = h('input', { type: 'search', placeholder: 'Search ' + label.toLowerCase() + '…', class: 'ssearch' });
      const list = h('div', { class: 'slist' });
      const fill = () => {
        const q = search.value.trim().toLowerCase(); list.replaceChildren();
        const shown = options.filter(o => !q || o.label.toLowerCase().includes(q)).slice(0, 300);
        shown.forEach(o => list.append(h('label', { class: 'sopt' }, h('input', { type: 'checkbox', checked: selected.has(o.value), onchange: () => { onToggle(o.value); render(); } }), h('span', null, o.label), o.note ? h('small', null, o.note) : null)));
        if (!shown.length) list.append(h('div', { class: 'empty' }, 'No match'));
      };
      search.addEventListener('input', fill); fill();
      panel = h('div', { class: 'spanel' }, search, list, h('div', { class: 'sfoot' }, h('button', { type: 'button', onclick: () => { onClear(); render(); fill(); } }, 'Clear'), h('button', { type: 'button', onclick: close }, 'Done')));
      root.append(panel); search.focus(); document.addEventListener('mousedown', away, true);
    };
    btn.addEventListener('click', () => panel ? close() : open());
    render(); root.append(btn); root.refresh = render; return root;
  },

  /** Sortable, searchable, paged table with CSV export. cols:[{label,get(r),val?(r),align,cls?(r)}] */
  table({ cols, rows, pageSize = 25, search, onRow, csvName }) {
    let sortC = -1, dir = 1, page = 0, q = '', all = rows, view = rows;
    const root = h('div', { class: 'tbl' }), tools = h('div', { class: 'ttools' }), wrap = h('div', { class: 'twrap' }), foot = h('div', { class: 'tfoot' });
    const box = search ? h('input', { type: 'search', class: 'tsearch', placeholder: search.placeholder || 'Search…', oninput: e => { q = e.target.value.trim().toLowerCase(); page = 0; run(); } }) : null;
    const exp = csvName ? h('button', { class: 'btn', type: 'button', onclick: () => { const head = cols.map(c => csvCell(c.label)).join(','); download(csvName, [head, ...view.map(r => cols.map(c => csvCell(c.csv ? c.csv(r) : c.get(r))).join(','))].join('\n')); } }, '⬇ Export CSV') : null;
    tools.append(...[box, h('span', { class: 'spacer' }), exp].filter(Boolean));
    function run() {
      view = q ? all.filter(r => search.text(r).includes(q)) : all.slice();
      if (sortC >= 0) {
        const c = cols[sortC], f = c.val || c.get, keys = new Map(); view.forEach(r => keys.set(r, f(r)));
        view.sort((a, b) => { const x = keys.get(a), y = keys.get(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
      }
      draw();
    }
    function draw() {
      const pages = Math.max(1, Math.ceil(view.length / pageSize)); page = Math.min(page, pages - 1);
      const t = h('table', null, h('thead', null, h('tr', null, cols.map((c, i) => h('th', { class: (c.align || '') + (i === sortC ? ' sorted' : ''), onclick: () => { dir = sortC === i ? -dir : (c.align === 'r' ? -1 : 1); sortC = i; run(); } }, c.label, HelpUI.info(c.label, 'column', c.help), i === sortC ? (dir > 0 ? ' ▲' : ' ▼') : '')))),
        h('tbody', null, view.slice(page * pageSize, (page + 1) * pageSize).map(r => h('tr', { class: onRow ? 'click' : '', onclick: onRow ? () => onRow(r, view) : null }, cols.map(c => h('td', { class: (c.align || '') + (c.cls ? ' ' + c.cls(r) : '') }, c.get(r)))))));
      wrap.replaceChildren(t);
      foot.replaceChildren(h('span', null, `${fmtInt(view.length)} rows`), h('span', { class: 'spacer' }),
        h('button', { class: 'btn', type: 'button', disabled: page === 0, onclick: () => { page--; draw(); } }, '‹ Prev'), h('span', null, `Page ${page + 1} / ${pages}`), h('button', { class: 'btn', type: 'button', disabled: page >= pages - 1, onclick: () => { page++; draw(); } }, 'Next ›'));
    }
    root.append(tools, wrap, foot); run();
    root.update = r => { all = r; page = 0; run(); };
    return root;
  },

  drawer(title, sub, body) {
    const d = $('#drawer'); d.replaceChildren(h('div', { class: 'dback', onclick: UI.closeDrawer }), h('aside', { class: 'dpanel' }, h('header', null, h('div', null, h('h3', null, title), h('p', null, sub)), h('button', { class: 'x', onclick: UI.closeDrawer, 'aria-label': 'Close' }, '✕')), h('div', { class: 'dbody' }, body)));
    requestAnimationFrame(() => d.classList.add('open'));
  },
  closeDrawer() { const d = $('#drawer'); d.classList.remove('open'); setTimeout(() => d.replaceChildren(), 200); },
  /** link to the store / customer profile page; c = customer index in Store.D */
  /** make the KPI tiles in `box` clickable: list = [[fn, tip], ...] in tile order (null = leave as is) */
  wireKpis(box, list) { [...box.children].forEach((k, i) => { const x = list[i]; if (!x) return; const [fn, tip] = x; k.classList.add('clickable'); k.title = tip; k.setAttribute('role', 'button'); k.tabIndex = 0; k.onclick = () => fn(); k.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }; }); },
  go(hash) { location.hash = hash; },
  goStore(c) { location.hash = '#/store/' + (Store.name === 'interstate' ? 'i-' : '') + encodeURIComponent(Store.D.custId[c]); },
  /** scroll to a card and flash it */
  jump(el) { if (!el) return; const c = el.closest ? (el.closest('.card') || el) : el; c.scrollIntoView({ behavior: 'smooth', block: 'start' }); c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); },
  /** Performance rule used in EVERY table: revenue of the last 30 days of data vs the 30 days before, per customer / store. Whole history, filters do not change it. */
  perf(c) {
    const D = Store.D;
    if (!D._perf) { const n = D.custName.length, cur = new Float64Array(n), prev = new Float64Array(n), e = D.maxDay, a = e - 29, b = e - 59;
      for (let k = 0; k < D.nOrders; k++) { const d = D.oDay[k]; if (d >= a) cur[D.oCust[k]] += D.oTotal[k]; else if (d >= b) prev[D.oCust[k]] += D.oTotal[k]; }
      D._perf = { cur, prev, a, e, b }; }
    const P = D._perf, x = P.cur[c], y = P.prev[c];
    const tip = `Last 30 days (${dLong(P.a)} – ${dLong(P.e)}): ${money0(x)}\nPrevious 30 days (${dLong(P.b)} – ${dLong(P.a - 1)}): ${money0(y)}\nChange = (last 30 − previous 30) ÷ previous 30. Revenue = order totals, whole history, not changed by filters.`;
    if (!x && !y) return h('span', { class: 'parr flat', title: tip + '\nNo orders in either period.' }, '–');
    if (!y) return h('span', { class: 'parr up', title: tip + '\nNo orders in the previous 30 days, so no % can be shown.' }, '▲ new');
    const d = (x - y) / y; return h('span', { class: 'parr ' + (d >= 0 ? 'up' : 'down'), title: tip }, (d >= 0 ? '▲ ' : '▼ ') + Math.round(Math.abs(d) * 100) + '%');
  },
  /** link to the store / customer profile page + performance arrow; c = customer index in Store.D */
  storeLink(c, text, noArrow) { const D = Store.D, a = h('a', { class: 'slink', href: '#/store/' + (Store.name === 'interstate' ? 'i-' : '') + encodeURIComponent(D.custId[c]), title: 'Open full history', onclick: e => e.stopPropagation() }, text == null ? D.custLabel[c] : text); return noArrow ? a : h('span', { class: 'sl' }, a, UI.perf(c)); },
  pill(type, i) { return h('span', { class: 'pill', style: { '--pc': Store.D.typeColor[i] } }, type); }
};
