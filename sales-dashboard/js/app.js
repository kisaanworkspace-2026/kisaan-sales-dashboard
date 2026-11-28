/* App shell: navigation, filter bar, status, routing. */
const Pages = {};
/** Sidebar model: each page belongs to a group (hierarchy). `ds` = data set, `page` = page module when the id differs. */
const NAV_GROUPS = [
  { name: 'Sales', icon: 'M4 20V10M10 20V4M16 20v-8M2 20h20' }, { name: 'Customers', icon: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0' }, { name: 'Products', icon: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8' },
  { name: 'Geography', icon: 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 100-4 2 2 0 000 4z' }, { name: 'Channels', icon: 'M4 7h14l-3-3M20 17H6l3 3' }, { name: 'Interstate sales', icon: 'M2 12l20-8-8 20-3-9z' }];
const NAV = [
  { grp: 'Sales', id: 'overview', title: 'Overview', icon: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z' },
  { grp: 'Sales', id: 'orders', title: 'Orders', icon: 'M4 6h16M4 12h16M4 18h10', line: true },
  { grp: 'Customers', id: 'customers', title: 'Customers', icon: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0', line: true },
  { grp: 'Customers', id: 'stores', title: 'B2B Stores', icon: 'M3 9l1.5-5h15L21 9M4 9v11h16V9M9 20v-6h6v6', line: true },
  { grp: 'Products', id: 'products', title: 'Products', icon: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', line: true },
  { grp: 'Geography', id: 'geography', title: 'Cities', icon: 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 100-4 2 2 0 000 4z', line: true },
  { grp: 'Channels', id: 'channels', title: 'B2B vs B2C', icon: 'M7 7h13M7 12h13M7 17h13M3 7h.01M3 12h.01M3 17h.01', line: true },
  { grp: 'Interstate sales', id: 'i-overview', page: 'overview', ds: 'interstate', title: 'Overview', icon: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z' },
  { grp: 'Interstate sales', id: 'i-orders', page: 'orders', ds: 'interstate', title: 'Orders', icon: 'M4 6h16M4 12h16M4 18h10', line: true },
  { grp: 'Interstate sales', id: 'i-products', page: 'products', ds: 'interstate', title: 'Products', icon: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', line: true },
  { grp: 'Interstate sales', id: 'i-customers', page: 'customers', ds: 'interstate', title: 'Stores', icon: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0', line: true },
  { grp: 'Interstate sales', id: 'i-regional', page: 'customers', ds: 'main', title: 'Regional stores', icon: 'M3 9l1.5-5h15L21 9M4 9v11h16V9M9 20v-6h6v6', line: true },
  { grp: 'Interstate sales', id: 'i-cities', page: 'geography', ds: 'interstate', title: 'Cities', icon: 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 100-4 2 2 0 000 4z', line: true },
];
/* ---- new-version popup ----
   APP_VERSION must equal VERSION in sw.js and "v" in version.json (tools/release.py bumps all three). The page asks version.json (never cached) at start,
   every 5 minutes and when the tab is opened again. If it differs, a popup asks the person to refresh; the button does what Ctrl+Shift+R does:
   clears the app-shell caches, unregisters the service worker, re-downloads every file bypassing the browser cache, and reloads. Data (IndexedDB) and the PIN are kept. */
const APP_VERSION = 'ksd-v20';
const Updater = (() => {
  let shown = false;
  async function hardRefresh(files) {
    try { await Promise.all((await caches.keys()).map(k => caches.delete(k))); } catch (e) { }
    try { await Promise.all((await navigator.serviceWorker.getRegistrations()).map(r => r.unregister())); } catch (e) { }
    try { await Promise.all(['./', ...(files || [])].map(f => fetch(f, { cache: 'reload' }).catch(() => { }))); } catch (e) { }
    location.reload();
  }
  function popup(j) {
    if (shown) return; shown = true;
    const btn = h('button', { type: 'button', class: 'nvbtn', onclick: () => { btn.disabled = true; btn.textContent = 'Refreshing…'; hardRefresh(j.files); } }, 'Refresh now');
    document.body.append(h('div', { class: 'nvback', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': 'New version available' },
      h('div', { class: 'nvbox' }, h('div', { class: 'nvic' }, '🔄'), h('h3', null, 'New version available'),
        h('p', null, 'The dashboard has been updated. Please refresh to use the latest version. Your data and PIN are kept.'), btn)));
    setTimeout(() => btn.focus(), 50);
  }
  async function check() {
    if (shown || !location.protocol.startsWith('http')) return;
    try { const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; const j = await r.json(); if (j && j.v && j.v !== APP_VERSION) popup(j); } catch (e) { }
  }
  function start() { setTimeout(check, 3000); setInterval(check, 5 * 60 * 1000); document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); }); }
  return { start, check, popup };
})();

const App = (() => {
  let current = null, mounted = {}, slicers = [], chips, dateBar, statusEl;
  const icon = (d, line) => s('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: line ? 'none' : 'currentColor', stroke: line ? 'currentColor' : 'none', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s('path', { d }));

  const chev = () => s('svg', { viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'chev' }, s('path', { d: 'M6 9l6 6 6-6' }));
  function buildNav() {
    $('#nav').replaceChildren(...NAV_GROUPS.map(g => {
      const items = NAV.filter(n => n.grp === g.name), open = store.get('grp_' + g.name, true);
      const el = h('div', { class: 'ngrp' + (open ? ' open' : ''), 'data-g': g.name },
        h('button', { type: 'button', class: 'ghead', 'aria-expanded': String(open), 'data-label': g.name, onclick: () => { const o = el.classList.toggle('open'); store.set('grp_' + g.name, o); el.querySelector('.ghead').setAttribute('aria-expanded', String(o)); } }, icon(g.icon, true), h('span', null, g.name), chev()),
        h('div', { class: 'gitems' }, h('div', { class: 'gtitle' }, g.name), ...items.map(n => h('a', { href: '#/' + n.id, class: 'nav', 'data-id': n.id, 'data-label': n.title, title: g.name + ' › ' + n.title }, icon(n.icon, n.line), h('span', null, n.title)))));
      return el;
    }));
  }
  function markNav(id) {
    document.querySelectorAll('.nav').forEach(a => a.classList.toggle('on', a.dataset.id === id));
    document.querySelectorAll('.ngrp').forEach(g => { const on = !!g.querySelector('.nav.on'); g.classList.toggle('has-on', on); if (on) g.classList.add('open'); });
  }
  /** Refresh button: spinner, staged progress (download > unzip > build), disabled while running, result message with Retry. */
  let refreshing = false, creep = null, hideT = null;
  async function doRefresh(e) {
    if (e && e.preventDefault) e.preventDefault(); if (refreshing) return;
    const b = $('#refresh'), box = $('#rbox'), set = (t, p) => { $('#rlabel').textContent = t; $('#rpct').textContent = p == null ? '' : Math.round(p) + '%'; $('#rbar').style.width = (p || 0) + '%'; };
    const show = (cls, label, pctVis, retry) => { clearTimeout(hideT); box.hidden = false; box.className = 'rbox ' + cls; $('#rbarw').style.display = pctVis ? '' : 'none'; $('#rpct').style.display = pctVis ? '' : 'none'; $('#rretry').hidden = !retry; $('#rclose').hidden = pctVis; $('#rlabel').textContent = label; };
    refreshing = true; b.disabled = true; b.classList.add('spin'); b.setAttribute('aria-busy', 'true'); const t0 = performance.now(); show('run', 'Checking…', true); set('Checking…', 3);
    Store.onProgress = (t, p) => { clearInterval(creep); set(t, p); if (p === 10) { let v = 10; creep = setInterval(() => { v = Math.min(58, v + (58 - v) * .06); set(t, v); }, 250); } };   // server time is unknown: creep towards 58% while waiting
    try {
      if (!CFG.API_URL) { show('ok', 'Demo data – nothing to refresh from a Google Sheet', false); hideT = setTimeout(() => box.hidden = true, 5000); }
      else {
        if (Store.name === 'main') await Store.refresh(true); else await Store.pullSet(Store.name, true);
        clearInterval(creep); set('Done', 100); await new Promise(r => setTimeout(r, 250));
        show('ok', `✓ Updated · ${fmtInt(Store.D.n)} rows · ${((performance.now() - t0) / 1000).toFixed(1)} s`, false); hideT = setTimeout(() => box.hidden = true, 6000);
      }
    } catch (err) { clearInterval(creep); show('err', '✕ Refresh failed: ' + (err && err.message || err), false, true); }
    Store.onProgress = null; refreshing = false; b.disabled = false; b.classList.remove('spin'); b.removeAttribute('aria-busy'); status();
  }
  function initShell() {
    $('#rretry').addEventListener('click', doRefresh); $('#rclose').addEventListener('click', () => $('#rbox').hidden = true);                                              // collapse toggle (desktop) and slide-over menu (mobile)
    const rail = v => { document.body.classList.toggle('rail', v); store.set('rail', v); const b = $('#railbtn'); b.setAttribute('aria-label', v ? 'Expand sidebar' : 'Collapse sidebar'); b.title = v ? 'Expand sidebar' : 'Collapse sidebar'; };
    rail(!!store.get('rail', false)); $('#railbtn').addEventListener('click', () => rail(!document.body.classList.contains('rail')));
    const menu = v => document.body.classList.toggle('menu-open', v);
    $('#menubtn').addEventListener('click', () => menu(!document.body.classList.contains('menu-open'))); $('#sback').addEventListener('click', () => menu(false));
    window.addEventListener('hashchange', () => menu(false)); document.addEventListener('keydown', e => { if (e.key === 'Escape') menu(false); });
  }

  function buildFilters() {
    const D = Store.D, S = F.st; F.pruneUnknown(); F.prepare();
    const preset = (id, t) => h('button', { type: 'button', 'data-p': id, onclick: () => F.set({ preset: id }) }, t);
    const dFrom = h('input', { type: 'date', onchange: e => { const v = isoDay(e.target.value); if (!isNaN(v)) F.set({ preset: 'custom', from: v, to: Math.max(v, F.range().to) }); } });
    const dTo = h('input', { type: 'date', onchange: e => { const v = isoDay(e.target.value); if (!isNaN(v)) F.set({ preset: 'custom', to: v, from: Math.min(v, F.range().from) }); } });
    dateBar = h('div', { class: 'datebar' }, h('div', { class: 'seg' }, preset('7d', '7D'), preset('30d', '30D'), preset('90d', '90D'), preset('mtd', 'MTD'), preset('all', 'All')), dFrom, h('span', null, '→'), dTo);
    dateBar._in = [dFrom, dTo]; dateBar._avail = h('span', { class: 'avail' }); dateBar.append(dateBar._avail);
    const sl = (label, key, list, fmt) => UI.slicer({ label, selected: S[key], options: list.map((v, i) => ({ value: key === 'dows' ? i : v, label: fmt ? fmt(v) : v })).sort((a, b) => key === 'dows' ? a.value - b.value : a.label.localeCompare(b.label)), onToggle: v => F.toggle(key, v), onClear: () => { S[key].clear(); F.changed(); } });
    slicers = [sl('Order type', 'types', D.dict.type, t => t.toUpperCase()), sl('Product', 'prods', D.dict.prod), sl('City', 'cities', D.dict.city, c => c || '(unknown)'), ...(D.hasST ? [sl('Store type', 'stypes', D.stAll)] : []), sl('Weekday', 'dows', DOW)];
    const q = h('input', { type: 'search', class: 'custq', placeholder: 'Customer / phone…', value: S.q, oninput: e => { clearTimeout(q._t); q._t = setTimeout(() => F.set({ q: e.target.value }), 180); } });
    chips = h('div', { class: 'chips' });
    const views = h('div', { class: 'slicer' }), vb = h('button', { class: 'sbtn', type: 'button' }, h('span', null, 'Saved views'), h('i', { class: 'chev' })); let vp = null;
    const closeV = () => { vp && vp.remove(); vp = null; };
    vb.addEventListener('click', () => { if (vp) return closeV(); const list = store.get('views', []);
      vp = h('div', { class: 'spanel' }, h('div', { class: 'slist' }, list.length ? list.map((v, i) => h('div', { class: 'sopt' }, h('span', { style: { flex: 1, cursor: 'pointer' }, onclick: () => { F.apply(v.f); q.value = v.f.q || ''; closeV(); } }, v.name), h('button', { class: 'x', title: 'Delete', onclick: () => { list.splice(i, 1); store.set('views', list); closeV(); } }, '✕'))) : h('div', { class: 'empty' }, 'No saved views yet')),
        h('div', { class: 'sfoot' }, h('button', { type: 'button', onclick: () => { const n = prompt('Name this view (current filters and dates):'); if (n) { list.push({ name: n.trim(), f: F.snapshot() }); store.set('views', list); toast('View saved'); } closeV(); } }, '+ Save current'), h('button', { type: 'button', onclick: closeV }, 'Close')));
      views.append(vp); });
    views.append(vb);
    $('#filters').replaceChildren(h('div', { class: 'frow' }, dateBar, h('span', { class: 'vsep' }), ...slicers, q, views, h('button', { class: 'btn clear', type: 'button', onclick: () => { q.value = ''; F.clear(); } }, 'Reset filters')), chips);
    syncFilters();
  }

  function syncFilters() {
    const S = F.st, D = Store.D, { from, to } = F.range();
    const cq = $('.custq'); if (cq && document.activeElement !== cq) cq.value = S.q;
    dateBar.querySelectorAll('[data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === S.preset));
    dateBar._in[0].value = dISO(from); dateBar._in[1].value = dISO(to);
    dateBar._in.forEach(i => { i.min = dISO(D.minDay); i.max = dISO(D.maxDay); });
    const span = D.maxDay - D.minDay + 1;
    dateBar.querySelectorAll('[data-p]').forEach(b => { const need = { '7d': 7, '30d': 30, '90d': 90 }[b.dataset.p]; const off = need && span < need; b.disabled = !!off; b.title = off ? `Sheet only has ${span} day(s) of data` : ''; b.classList.toggle('off', !!off); });
    dateBar._avail.textContent = `Data available: ${dLong(D.minDay)} – ${dLong(D.maxDay)}`;
    slicers.forEach(x => x.refresh());
    const mk = (label, set, fmt, key) => [...set].map(v => h('span', { class: 'chip' }, label + ': ', h('b', null, fmt ? fmt(v) : v), h('button', { type: 'button', 'aria-label': 'Remove', onclick: () => F.toggle(key, v) }, '✕')));
    chips.replaceChildren(...mk('Type', S.types, t => t.toUpperCase(), 'types'), ...mk('Product', S.prods, null, 'prods'), ...mk('City', S.cities, c => c || '(unknown)', 'cities'), ...mk('Day', S.dows, d => DOW[d], 'dows'), ...mk('Store type', S.stypes, null, 'stypes'));
    chips.style.display = chips.children.length ? '' : 'none';
  }

  function status() {
    const D = Store.D, ago = Math.max(0, Math.round((Date.now() - Store.loadedAt) / 60000));
    statusEl.replaceChildren(h('b', null, Store.mode === 'demo' ? 'DEMO DATA' : 'LIVE'), ` · ${fmtInt(D.n)} lines · ${fmtInt(D.nOrders)} orders · data to ${dLong(D.maxDay)}`, Store.mode === 'live' ? ` · synced ${ago < 1 ? 'just now' : ago + ' min ago'}` : '', ` · ${Math.round(Store.ms)} ms`);
    statusEl.title = Store.source; const w = D.w || {}, m = D.meta;
    if (m && m.rows) {
      statusEl.append(` · ${fmtInt(m.rows)} of ${fmtInt(m.sheetRows)} sheet rows · ${dShort(m.min)} to ${dShort(m.max)}`);
      let prev = 0; try { prev = +localStorage.getItem('ksd_rows_' + Store.name) || 0; } catch (e) { }
      if (m.rows < prev) statusEl.append(h('span', { class: 'warn', title: 'The previous load had ' + fmtInt(prev) + ' rows. If rows were not deleted on purpose, check the Google Sheet.' }, ` · ⚠ ${fmtInt(prev - m.rows)} fewer rows than last time`));
      try { localStorage.setItem('ksd_rows_' + Store.name, String(Math.max(m.rows, 0))); } catch (e) { }
    }
    if (m && m.sheetRows > m.rows + (w.skipped || 0) + 0 && w.skipped) statusEl.append(h('span', { class: 'warn', title: 'Rows with a missing order id or an unreadable date are skipped. Check the Sheet.' }, ` · ⚠ ${fmtInt(w.skipped)} rows skipped`));
    if (w.swapped) statusEl.append(h('span', { class: 'warn', title: 'Dates written day/month were read as month/day by Google Sheets. They were corrected automatically. Tip: File > Settings > Locale = Australia or India.' }, ` · ⚠ ${fmtInt(w.swapped)} dates auto-corrected`));
    if (w.future) statusEl.append(h('span', { class: 'warn', title: 'These rows have a delivery date in the future; check the date column in the Sheet.' }, ` · ⚠ ${fmtInt(w.future)} rows dated in the future`));
  }

  async function ensureDs(ds) {
    if (Store.name === ds) return true;
    const sp = $('#splash'); sp.classList.remove('gone'); sp.querySelector('p').textContent = 'Loading ' + ds + ' data…';
    try { await Store.use(ds); } catch (e) { sp.querySelector('p').textContent = 'Could not load ' + ds + ' data: ' + e.message; return false; }
    F.useSet(ds); buildFilters(); status(); sp.classList.add('gone'); return true;
  }
  async function showStore(ds, id) {
    markNav(''); document.body.classList.add('noflt'); UI.closeDrawer();
    if (!await ensureDs(ds)) return;
    if (!Pages.profile) await new Promise((ok, no) => document.head.append(h('script', { src: 'js/pages/profile.js', onload: ok, onerror: no })));
    UI.page = 'profile'; current = Pages.profile; Pages.profile.render($('#page'), id); window.scrollTo(0, 0);
  }
  async function show() {
    const sm = location.hash.match(/^#\/store\/(i-)?([^/?]+)/);
    if (sm) return showStore(sm[1] ? 'interstate' : 'main', decodeURIComponent(sm[2]));
    document.body.classList.remove('noflt');
    const id = (location.hash.match(/^#\/([\w-]+)/) || [, 'overview'])[1], nav = NAV.find(n => n.id === id && !n.soon && !n.group) || NAV[0], ds = nav.ds || 'main', page = nav.page || nav.id;
    markNav(nav.id); UI.page = nav.page || nav.id;
    if (Store.name !== ds) {
      const sp = $('#splash'); sp.classList.remove('gone'); sp.querySelector('p').textContent = 'Loading ' + ds + ' data…';
      try { await Store.use(ds); } catch (e) { sp.querySelector('p').textContent = 'Could not load ' + ds + ' data: ' + e.message; return; }
      F.useSet(ds); buildFilters(); status(); sp.classList.add('gone');
    }
    const host = $('#page');
    if (!Store.D.n) { host.replaceChildren(h('div', { class: 'empty big' }, h('h3', null, 'No ' + ds + ' data yet'), h('p', null, 'Add a tab named "Interstate" to the Google Sheet (same columns) and paste the interstate sales there, then press refresh.'))); return; }
    if (!Pages[page]) await new Promise((ok, no) => document.head.append(h('script', { src: `js/pages/${page}.js`, onload: ok, onerror: no })));
    current = Pages[page];
    if (!mounted[page] || mounted[page].D !== Store.D) { const el = h('div'); current.mount(el); mounted[page] = { D: Store.D, el }; }
    host.replaceChildren(...[ds !== 'main' ? h('div', { class: 'dsbanner' }, '🚚 Interstate stores (the 6 named interstate stores only) · ', h('a', { href: '#/i-regional' }, 'Regional stores →')) : (nav.id === 'i-regional' ? h('div', { class: 'dsbanner' }, '🏬 Regional stores = every store except the interstate ones · ', h('a', { href: '#/i-customers' }, '← Interstate stores')) : null), mounted[page].el].filter(Boolean));
    if (mounted[page].gen !== F.gen) { current.update(); mounted[page].gen = F.gen; }      // same filters + same data as last time: the page is already up to date
  }

  const rerender = rafOnce(() => { syncFilters(); if (current) { current.update(); for (const k in mounted) if (mounted[k].el.isConnected) mounted[k].gen = F.gen; } });

  return {
    async start() {
      const splash = $('#splash');
      Store.askPin = msg => new Promise(res => {                        // access PIN (kept on this device only)
        const inp = h('input', { type: 'password', placeholder: 'Access PIN', autocomplete: 'current-password' }), err = h('div', { class: 'pinerr' }, msg || ''), box = h('form', { class: 'pinbox', onsubmit: e => { e.preventDefault(); if (!inp.value.trim()) return; box.remove(); res(inp.value); } },
          h('img', { src: 'assets/icon-192.png', alt: '' }), h('h3', null, 'Kisaan Sales Dashboard'), h('p', null, 'Enter the access PIN to open the dashboard.'), inp, err, h('button', { type: 'submit' }, 'Open'));
        document.body.append(box); setTimeout(() => inp.focus(), 50);
      });
      try {
        await Store.init(t => splash.querySelector('p').textContent = t);
      } catch (e) { splash.querySelector('p').textContent = 'Could not load data: ' + e.message + '. If this keeps happening check API_URL in js/config.js and that the Web App is deployed.'; console.error(e); return; }
      buildNav(); initShell(); buildFilters(); statusEl = $('#status'); status();
      F.onChange(rerender);
      Store.onData((D, first) => { mounted = {}; buildFilters(); status(); show(); toast('Data updated'); });
      window.addEventListener('hashchange', show);
      $('#refresh').addEventListener('click', doRefresh);
      $('#theme').addEventListener('click', () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; store.set('theme', t); });
      $('#print').addEventListener('click', () => window.print());
      if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
      setInterval(status, 60000); Updater.start();
      await show(); splash.classList.add('gone');
    }
  };
})();
function toast(msg) { const t = h('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.classList.add('out'), 2200); setTimeout(() => t.remove(), 2700); }

/** Order panel with Back (previous order you looked at), Previous / Next (in the list it was opened from). ctx = array of order indexes in list order. */
UI._oh = [];
UI.openOrder = (k, ctx) => { UI._oh = []; showOrder(k, Array.isArray(ctx) || ctx instanceof Int32Array ? Array.from(ctx) : null, false); };
function showOrder(k, ctx, push, from) {
  const D = Store.D, a = D.oStart[k], b = D.oStart[k + 1], c = D.oCust[k];
  if (push && from != null) UI._oh.push({ k: from, ctx });
  const lines = []; for (let i = a; i < b; i++) lines.push(i);
  const kv = (l, v) => h('div', { class: 'dkv' }, h('span', null, l), h('b', null, v)), ix = ctx ? ctx.indexOf(k) : -1, go = j => showOrder(ctx[j], ctx, true, k);
  const nav = h('div', { class: 'onav' },
    h('button', { class: 'btn', type: 'button', disabled: !UI._oh.length, onclick: () => { const p = UI._oh.pop(); showOrder(p.k, p.ctx, false); } }, '‹ Back'),
    ctx && ix >= 0 ? h('button', { class: 'btn', type: 'button', disabled: ix <= 0, onclick: () => go(ix - 1) }, '← Previous') : null,
    ctx && ix >= 0 ? h('span', { class: 'mut' }, `${ix + 1} of ${ctx.length}`) : null,
    ctx && ix >= 0 ? h('button', { class: 'btn', type: 'button', disabled: ix >= ctx.length - 1, onclick: () => go(ix + 1) }, 'Next →') : null);
  UI.drawer('Order #' + D.oId[k], dLong(D.oDay[k]), h('div', null, nav,
    h('div', { class: 'kvs' }, kv('Customer', UI.storeLink(c)), kv('Phone', D.rawPhone[D.rawCust[a]]), kv('Type', UI.pill(D.dict.type[D.oType[k]], D.oType[k])), kv('Address', (D.dict.addr[D.addr[a]] + ', ' + D.dict.city[D.oCity[k]]).replace(/^, /, '')), kv('Order total', money2(D.oTotal[k]))),
    h('table', { class: 'lines' }, h('thead', null, h('tr', null, h('th', null, 'Product'), h('th', { class: 'r' }, 'Qty'))),
      h('tbody', null, lines.map(i => h('tr', null, h('td', null, D.dict.prod[D.prod[i]]), h('td', { class: 'r' }, D.qty[i])))), h('tfoot', null, h('tr', null, h('td', null, 'Total units'), h('td', { class: 'r' }, fmtInt(D.oUnits[k])))))));
}
{ const t = store.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); document.documentElement.dataset.theme = t; }
document.addEventListener('DOMContentLoaded', App.start);
