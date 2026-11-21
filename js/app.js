/* App shell: navigation, filter bar, status, routing. */
const Pages = {};
const NAV = [
  { id: 'overview', title: 'Overview', icon: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z' },
  { id: 'orders', title: 'Orders', icon: 'M4 6h16M4 12h16M4 18h10' , line: true },
  { id: 'products', title: 'Products', icon: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', line: true, soon: 'Soon' },
  { id: 'customers', title: 'Customers', icon: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0', line: true, soon: 'Soon' },
  { id: 'geography', title: 'Cities', icon: 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 100-4 2 2 0 000 4z', line: true, soon: 'Soon' },
  { id: 'channels', title: 'B2B vs B2C', icon: 'M7 7h13M7 12h13M7 17h13M3 7h.01M3 12h.01M3 17h.01', line: true, soon: 'Soon' }
];
const App = (() => {
  let current = null, mounted = {}, slicers = [], chips, dateBar, statusEl;
  const icon = (d, line) => s('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: line ? 'none' : 'currentColor', stroke: line ? 'currentColor' : 'none', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s('path', { d }));

  function buildNav() {
    $('#nav').replaceChildren(...NAV.map(n => h('a', { href: n.soon ? null : '#/' + n.id, class: 'nav' + (n.soon ? ' soon' : ''), 'data-id': n.id, title: n.soon ? n.title + ' – coming in a later phase' : n.title }, icon(n.icon, n.line), h('span', null, n.title), n.soon ? h('em', null, n.soon) : null)));
  }

  function buildFilters() {
    const D = Store.D, S = F.st; F.pruneUnknown(); F.prepare();
    const preset = (id, t) => h('button', { type: 'button', 'data-p': id, onclick: () => F.set({ preset: id }) }, t);
    const dFrom = h('input', { type: 'date', onchange: e => { const v = isoDay(e.target.value); if (!isNaN(v)) F.set({ preset: 'custom', from: v, to: Math.max(v, F.range().to) }); } });
    const dTo = h('input', { type: 'date', onchange: e => { const v = isoDay(e.target.value); if (!isNaN(v)) F.set({ preset: 'custom', to: v, from: Math.min(v, F.range().from) }); } });
    dateBar = h('div', { class: 'datebar' }, h('div', { class: 'seg' }, preset('7d', '7D'), preset('30d', '30D'), preset('90d', '90D'), preset('mtd', 'MTD'), preset('all', 'All')), dFrom, h('span', null, '→'), dTo);
    dateBar._in = [dFrom, dTo];
    const sl = (label, key, list, fmt) => UI.slicer({ label, selected: S[key], options: list.map((v, i) => ({ value: key === 'dows' ? i : v, label: fmt ? fmt(v) : v })).sort((a, b) => key === 'dows' ? a.value - b.value : a.label.localeCompare(b.label)), onToggle: v => F.toggle(key, v), onClear: () => { S[key].clear(); F.changed(); } });
    slicers = [sl('Order type', 'types', D.dict.type, t => t.toUpperCase()), sl('Product', 'prods', D.dict.prod), sl('City', 'cities', D.dict.city, c => c || '(unknown)'), sl('Weekday', 'dows', DOW)];
    const q = h('input', { type: 'search', class: 'custq', placeholder: 'Customer / phone…', value: S.q, oninput: e => { clearTimeout(q._t); q._t = setTimeout(() => F.set({ q: e.target.value }), 180); } });
    chips = h('div', { class: 'chips' });
    $('#filters').replaceChildren(h('div', { class: 'frow' }, dateBar, h('span', { class: 'vsep' }), ...slicers, q, h('button', { class: 'btn clear', type: 'button', onclick: () => { q.value = ''; F.clear(); } }, 'Reset filters')), chips);
    syncFilters();
  }

  function syncFilters() {
    const S = F.st, D = Store.D, { from, to } = F.range();
    dateBar.querySelectorAll('[data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === S.preset));
    dateBar._in[0].value = dISO(from); dateBar._in[1].value = dISO(to);
    dateBar._in.forEach(i => { i.min = dISO(D.minDay); i.max = dISO(D.maxDay); });
    slicers.forEach(x => x.refresh());
    const mk = (label, set, fmt, key) => [...set].map(v => h('span', { class: 'chip' }, label + ': ', h('b', null, fmt ? fmt(v) : v), h('button', { type: 'button', 'aria-label': 'Remove', onclick: () => F.toggle(key, v) }, '✕')));
    chips.replaceChildren(...mk('Type', S.types, t => t.toUpperCase(), 'types'), ...mk('Product', S.prods, null, 'prods'), ...mk('City', S.cities, c => c || '(unknown)', 'cities'), ...mk('Day', S.dows, d => DOW[d], 'dows'));
    chips.style.display = chips.children.length ? '' : 'none';
  }

  function status() {
    const D = Store.D, ago = Math.max(0, Math.round((Date.now() - Store.loadedAt) / 60000));
    statusEl.replaceChildren(h('b', null, Store.mode === 'demo' ? 'DEMO DATA' : 'LIVE'), ` · ${fmtInt(D.n)} lines · ${fmtInt(D.nOrders)} orders · data to ${dLong(D.maxDay)}`, Store.mode === 'live' ? ` · synced ${ago < 1 ? 'just now' : ago + ' min ago'}` : '', ` · ${Math.round(Store.ms)} ms`);
    statusEl.title = Store.source;
  }

  async function show() {
    const id = (location.hash.match(/^#\/(\w+)/) || [, 'overview'])[1], nav = NAV.find(n => n.id === id && !n.soon) || NAV[0];
    document.querySelectorAll('.nav').forEach(a => a.classList.toggle('on', a.dataset.id === nav.id));
    if (!Pages[nav.id]) await new Promise((ok, no) => document.head.append(h('script', { src: `js/pages/${nav.id}.js`, onload: ok, onerror: no })));
    const host = $('#page'); current = Pages[nav.id];
    if (!mounted[nav.id] || mounted[nav.id].D !== Store.D) { const el = h('div'); current.mount(el); mounted[nav.id] = { D: Store.D, el }; }
    host.replaceChildren(mounted[nav.id].el);
    current.update();
  }

  const rerender = rafOnce(() => { syncFilters(); current && current.update(); });

  return {
    async start() {
      const splash = $('#splash');
      try {
        await Store.init(t => splash.querySelector('p').textContent = t);
      } catch (e) { splash.querySelector('p').textContent = 'Could not load data: ' + e.message + '. Check API_URL in js/config.js and that the Web App is deployed for "Anyone".'; console.error(e); return; }
      buildNav(); buildFilters(); statusEl = $('#status'); status();
      F.onChange(rerender);
      Store.onData((D, first) => { mounted = {}; buildFilters(); status(); show(); toast('Data updated'); });
      window.addEventListener('hashchange', show);
      $('#refresh').addEventListener('click', async e => { const b = e.currentTarget; b.classList.add('spin'); try { const ch = await Store.refresh(true); if (!ch) toast('Already up to date'); } catch (err) { toast('Refresh failed: ' + err.message); } b.classList.remove('spin'); status(); });
      $('#theme').addEventListener('click', () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; store.set('theme', t); });
      setInterval(status, 60000);
      await show(); splash.classList.add('gone');
    }
  };
})();
function toast(msg) { const t = h('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.classList.add('out'), 2200); setTimeout(() => t.remove(), 2700); }

UI.openOrder = k => {
  const D = Store.D, a = D.oStart[k], b = D.oStart[k + 1], c = D.oCust[k];
  const lines = []; for (let i = a; i < b; i++) lines.push(i);
  const kv = (l, v) => h('div', { class: 'dkv' }, h('span', null, l), h('b', null, v));
  UI.drawer('Order #' + D.oId[k], dLong(D.oDay[k]), h('div', null,
    h('div', { class: 'kvs' }, kv('Customer', D.custLabel[c]), kv('Phone', D.custPhone[c]), kv('Type', UI.pill(D.dict.type[D.oType[k]], D.oType[k])), kv('Address', (D.dict.addr[D.addr[a]] + ', ' + D.dict.city[D.oCity[k]]).replace(/^, /, '')), kv('Order total', money2(D.oTotal[k]))),
    h('table', { class: 'lines' }, h('thead', null, h('tr', null, h('th', null, 'Product'), h('th', { class: 'r' }, 'Qty'))),
      h('tbody', null, lines.map(i => h('tr', null, h('td', null, D.dict.prod[D.prod[i]]), h('td', { class: 'r' }, D.qty[i])))), h('tfoot', null, h('tr', null, h('td', null, 'Total units'), h('td', { class: 'r' }, fmtInt(D.oUnits[k])))))));
};
{ const t = store.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); document.documentElement.dataset.theme = t; }
document.addEventListener('DOMContentLoaded', App.start);
