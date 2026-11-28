/* Data layer: instant load from IndexedDB, silent background refresh from the Apps Script API.
   Exposes window.D (typed-array "database") once loaded. */
const Store = (() => {
  const IDB = { db: null };
  function idb() {
    return IDB.db || (IDB.db = new Promise(res => {
      try {
        const r = indexedDB.open('ksd', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    }));
  }
  const idbGet = async k => { const db = await idb(); if (!db) return null; return new Promise(r => { try { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => r(q.result || null); q.onerror = () => r(null); } catch (e) { r(null); } }); };
  const idbSet = async (k, v) => { const db = await idb(); if (!db) return; try { db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) { } };

  const prog = async (t, pct) => { S.onProgress && S.onProgress(t, pct); await new Promise(res => setTimeout(res, 0)); };   // lets the page paint each step
  async function gunzipB64(b64) {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const stream = new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }
  const PIN_KEY = 'ksd_pin', getPin = () => { try { return localStorage.getItem(PIN_KEY) || ''; } catch (e) { return ''; } }, setPin = v => { try { v ? localStorage.setItem(PIN_KEY, v) : localStorage.removeItem(PIN_KEY); } catch (e) { } };
  async function api(params) {
    for (let tries = 0; ; tries++) {
      const pin = getPin(), r = await fetch(CFG.API_URL + (CFG.API_URL.includes('?') ? '&' : '?') + params + '&k=' + encodeURIComponent(pin), { redirect: 'follow' });
      const j = await r.json();
      if (j.error === 'auth' || j.error === 'locked') {
        setPin('');
        if (!S.askPin || tries > 5) throw new Error(j.error === 'locked' ? 'Too many wrong PINs - try again in 10 minutes' : 'PIN required');
        const np = await S.askPin(j.error === 'locked' ? 'Too many wrong PINs. Try again in 10 minutes.' : (pin ? 'Wrong PIN, try again.' : ''));
        if (np == null) throw new Error('PIN required'); setPin(String(np).trim()); continue;
      }
      if (j.error) throw new Error(j.error);
      return j;
    }
  }

  /** payload -> D (same function as in the worker). Colours need CFG, which the worker does not have, so they are added here. */
  function finish(D) { D.typeColor = D.dict.type.map((t, i) => CFG.TYPE_COLORS[t] || CFG.PALETTE[(i + 4) % CFG.PALETTE.length]); return D; }
  const decode = p => finish(ksdDecode(p)), DEC_FMT = 2;        // DEC_FMT: bump when the shape of D changes, so old caches are ignored

  /** Web Worker: unzip + JSON.parse + decode happen off the main thread, so the page stays responsive while 100k-1M rows load.
      Falls back to the main thread if workers are unavailable. job = { gz | url | obj, v, savedAt } */
  let worker = null, wid = 0; const pend = new Map();
  function getWorker() {
    if (worker !== null) return worker;
    try {
      worker = new Worker('js/worker.js');
      worker.onmessage = e => { const m = e.data, q = pend.get(m.id); if (!q) return; pend.delete(m.id); m.error ? q.rej(new Error(m.error)) : q.res(m.D); };
      worker.onerror = () => { const q = [...pend.values()]; pend.clear(); worker = false; q.forEach(x => x.rej(new Error('worker'))); };
    } catch (e) { worker = false; }
    return worker;
  }
  async function build(job) {
    const w = getWorker();
    if (w) { try { return finish(await new Promise((res, rej) => { const id = ++wid; pend.set(id, { res, rej }); w.postMessage(Object.assign({ id }, job)); })); } catch (e) { if (worker !== false) throw e; } }
    let p = job.obj;                                                   // fallback: same steps on the main thread
    if (job.gz) p = await gunzipB64(job.gz); else if (job.url) p = await (await fetch(job.url)).json();
    if (job.v != null) p.v = job.v; const D = decode(p); if (job.cache) idbSet(job.cache, { fmt: job.fmt, v: D.ver, savedAt: job.savedAt, D }); return D;
  }

  const listeners = [];
  const S = {
    D: null, name: 'main', sets: {}, mode: CFG.API_URL ? 'live' : 'demo', loadedAt: 0, source: '',
    onData(fn) { listeners.push(fn); },
    emit(first) { listeners.forEach(f => f(S.D, first)); },

    async init(setStatus) { const D = await S._init(setStatus); S.sets.main = D; return D; },

    /** switch the active dataset ('main' | 'interstate'); loads it on first use */
    async use(name) {
      if (S.name === name && S.D) return S.D;
      if (!S.sets[name]) S.sets[name] = await S.loadSet(name);
      S.name = name; S.D = S.sets[name]; return S.D;
    },
    emptySet() { return decode({ v: 'empty', n: 0, dict: { type: [], prod: [], city: [], addr: [], cust: [] }, d: [], o: [], i: [], t: [], p: [], q: [], a: [], c: [], y: [], ad: [] }); },
    async loadSet(name) {
      if (!CFG.API_URL) { try { return await build({ url: new URL(CFG.SAMPLE_INTERSTATE_URL, location.href).href }); } catch (e) { return S.emptySet(); } }
      let c = await idbGet('dec_' + name); if (c && c.fmt !== DEC_FMT) c = null;
      const old = c ? null : await idbGet('payload_' + name);                                              // old = cache format of earlier versions
      if (c || old) { const D = c ? finish(c.D) : await build({ obj: old, cache: 'dec_' + name, fmt: DEC_FMT, savedAt: old.savedAt }); S.sets[name] = D; S.pullSet(name, false).catch(() => { }); return D; }
      return S.pullSet(name, true);
    },
    async pullSet(name, force) {
      if (!force && S.sets[name]) { const { v } = await api('a=ver&tab=' + name); if (v === S.sets[name].ver) return S.sets[name]; }
      await prog('Downloading from Google Sheet…', 10); const r = await api('a=data&tab=' + name + (force ? '&force=1' : ''));
      await prog('Unzipping…', 65); const job = build({ gz: r.gz, v: r.v, cache: 'dec_' + name, fmt: DEC_FMT, savedAt: Date.now() });
      await prog('Building tables…', 85); const D = await job; S.sets[name] = D; S.loadedAt = Date.now();
      if (S.name === name) { S.D = D; S.emit(false); }
      return D;
    },

    async _init(setStatus) {
      const t0 = performance.now();
      if (!CFG.API_URL) {                                         // demo mode: bundled sample
        S.D = await build({ url: new URL(CFG.SAMPLE_URL, location.href).href }); S.source = 'Demo data (sample file)'; S.loadedAt = Date.now(); S.ms = performance.now() - t0;
        return S.D;
      }
      let cached = await idbGet('dec_main'); if (cached && cached.fmt !== DEC_FMT) cached = null;
      const old = cached ? null : await idbGet('payload');
      if (cached || old) {
        S.D = cached ? finish(cached.D) : await build({ obj: old, cache: 'dec_main', fmt: DEC_FMT, savedAt: old.savedAt }); S.source = 'Local cache'; S.loadedAt = (cached || old).savedAt || Date.now(); S.ms = performance.now() - t0;
        S.refresh(false).catch(() => { });                         // silent background check
        return S.D;
      }
      setStatus && setStatus('First load – fetching data…');
      await S.refresh(true);
      return S.D;
    },

    /** force=true ignores caches (Refresh button). Emits only if data actually changed. */
    async refresh(force) {
      if (!CFG.API_URL) return false;
      const t0 = performance.now();
      if (!force && S.D) { const { v } = await api('a=ver'); if (v === S.D.ver) { S.checkedAt = Date.now(); S.emitStatus && S.emitStatus(); return false; } }
      await prog('Downloading from Google Sheet…', 10); const r = await api('a=data' + (force ? '&force=1' : ''));
      await prog('Unzipping…', 65); const job = build({ gz: r.gz, v: r.v, cache: 'dec_main', fmt: DEC_FMT, savedAt: Date.now() });
      await prog('Building tables…', 85); const nd = await job;
      const first = !S.D; S.sets.main = nd;
      if (S.name !== 'main') return true;
      S.D = nd; S.source = 'Live from Google Sheet'; S.loadedAt = Date.now(); S.ms = performance.now() - t0;
      S.emit(first);
      return true;
    }
  };
  return S;
})();
