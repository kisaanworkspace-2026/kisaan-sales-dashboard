/* Reusable UI building blocks: cards, KPI tiles, slicers (dropdown filters), tables, drawer */
const UI = {
  card(title, body, { span = 4, sub, tools, cls = '' } = {}) {
    return h('section', { class: 'card ' + cls, style: { gridColumn: `span ${span}` } },
      h('header', null, h('div', null, h('h3', null, title), sub ? h('p', null, sub) : null), tools || null), body);
  },

  kpi({ label, value, delta, deltaGood = 'up', spark, hint, color }) {
    let d = null;
    if (delta != null && isFinite(delta)) {
      const up = delta >= 0, good = (deltaGood === 'up') === up;
      d = h('span', { class: 'delta ' + (Math.abs(delta) < .0005 ? 'flat' : good ? 'good' : 'bad') }, (up ? '▲ ' : '▼ ') + pct(Math.abs(delta)), h('em', null, ' vs prev'));
    } else d = h('span', { class: 'delta flat' }, hint || '—');
    return h('div', { class: 'kpi' }, h('div', { class: 'kl' }, label), h('div', { class: 'kv' }, value), h('div', { class: 'kf' }, d, spark ? Charts.spark(spark, color) : null));
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
      const t = h('table', null, h('thead', null, h('tr', null, cols.map((c, i) => h('th', { class: (c.align || '') + (i === sortC ? ' sorted' : ''), onclick: () => { dir = sortC === i ? -dir : (c.align === 'r' ? -1 : 1); sortC = i; run(); } }, c.label, i === sortC ? (dir > 0 ? ' ▲' : ' ▼') : '')))),
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
  storeLink(c, text) { const D = Store.D; return h('a', { class: 'slink', href: '#/store/' + (Store.name === 'interstate' ? 'i-' : '') + encodeURIComponent(D.custId[c]), title: 'Open full history', onclick: e => e.stopPropagation() }, text == null ? D.custLabel[c] : text); },
  pill(type, i) { return h('span', { class: 'pill', style: { '--pc': Store.D.typeColor[i] } }, type); }
};
