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

  async function gunzipB64(b64) {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const stream = new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }
  async function api(params) {
    const r = await fetch(CFG.API_URL + (CFG.API_URL.includes('?') ? '&' : '?') + params, { redirect: 'follow' });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j;
  }

  /** Turn the columnar payload into typed arrays + order/customer tables. */
  function decode(p) {
    const n = p.n, o = Int32Array.from(p.o);
    // make sure all lines of one order are adjacent (server sorts, this is a safety net)
    let grouped = true; const seen = new Set();
    for (let i = 0; i < n && grouped; i++) { if (i && o[i] === o[i - 1]) continue; if (seen.has(o[i])) grouped = false; seen.add(o[i]); }
    let perm = null;
    if (!grouped) { perm = Int32Array.from({ length: n }, (_, i) => i); perm.sort((a, b) => p.d[a] - p.d[b] || o[a] - o[b] || a - b); }
    const col = (arr, T) => { const out = new T(n); for (let i = 0; i < n; i++) out[i] = arr[perm ? perm[i] : i]; return out; };
    const D = {
      n, ver: p.v, dict: p.dict, w: p.w || {},
      day: col(p.d, Int32Array), oid: col(p.o, Float64Array), iid: col(p.i, Float64Array), type: col(p.t, Uint8Array), prod: col(p.p, Uint16Array),
      qty: col(p.q, Int32Array), amt: col(p.a, Float64Array), cust: col(p.c, Int32Array), city: col(p.y, Uint16Array), addr: col(p.ad, Int32Array)
    };
    const oi = D.oi = new Int32Array(n);
    let no = 0;
    for (let i = 0; i < n; i++) { if (i && D.oid[i] === D.oid[i - 1]) oi[i] = no - 1; else oi[i] = no++; }
    D.nOrders = no;
    const oTotal = D.oTotal = new Float64Array(no), oStart = D.oStart = new Int32Array(no + 1), oUnits = D.oUnits = new Int32Array(no);
    D.oDay = new Int32Array(no); D.oType = new Uint8Array(no); D.oCity = new Uint16Array(no); D.oCust = new Int32Array(no); D.oId = new Float64Array(no);
    for (let i = 0; i < n; i++) {
      const k = oi[i];
      if (i === 0 || oi[i - 1] !== k) { oStart[k] = i; D.oDay[k] = D.day[i]; D.oType[k] = D.type[i]; D.oCity[k] = D.city[i]; D.oCust[k] = D.cust[i]; D.oId[k] = D.oid[i]; }
      oTotal[k] += D.amt[i]; oUnits[k] += D.qty[i];
    }
    oStart[no] = n;
    D.minDay = n ? D.day[0] : 0; D.maxDay = n ? D.day[n - 1] : 0;
    for (let i = 0; i < n; i++) { if (D.day[i] < D.minDay) D.minDay = D.day[i]; if (D.day[i] > D.maxDay) D.maxDay = D.day[i]; }
    // customers
    const nc = p.dict.cust.length;
    D.custName = p.dict.cust.map(c => c[1] || ''); D.custPhone = p.dict.cust.map(c => c[0]);
    D.custLabel = D.custName.map((nm, i) => nm || ('Customer ' + D.custPhone[i]));
    D.custSearch = D.custLabel.map((l, i) => (l + ' ' + D.custPhone[i]).toLowerCase());
    D.cFirst = new Int32Array(nc).fill(1e9); D.cLast = new Int32Array(nc).fill(-1e9); D.cOrders = new Int32Array(nc);
    for (let k = 0; k < no; k++) { const c = D.oCust[k], d = D.oDay[k]; if (d < D.cFirst[c]) D.cFirst[c] = d; if (d > D.cLast[c]) D.cLast[c] = d; D.cOrders[c]++; }
    // store types (from the StoreTypes tab / bundled file), joined on the store name
    const norm = x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim(), tmap = new Map((p.st || []).map(r => [norm(r[0]), r[1]]));
    D.hasST = tmap.size > 0; D.stNames = [...new Set(tmap.values())].sort(); D.stAll = D.hasST ? [...D.stNames, 'Unmapped'] : [];
    D.cTypeName = D.custName.map(nm => tmap.get(norm(nm)) || 'Unmapped'); D.cST = Int16Array.from(D.cTypeName, x => D.stAll.indexOf(x));
    // stable colours per order type
    D.typeColor = p.dict.type.map((t, i) => CFG.TYPE_COLORS[t] || CFG.PALETTE[(i + 4) % CFG.PALETTE.length]);
    return D;
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
      if (!CFG.API_URL) { try { const r = await fetch(CFG.SAMPLE_INTERSTATE_URL); if (!r.ok) throw 0; return decode(await r.json()); } catch (e) { return S.emptySet(); } }
      const c = await idbGet('payload_' + name);
      if (c) { const D = decode(c); S.sets[name] = D; S.pullSet(name, false).catch(() => { }); return D; }
      return S.pullSet(name, true);
    },
    async pullSet(name, force) {
      if (!force && S.sets[name]) { const { v } = await api('a=ver&tab=' + name); if (v === S.sets[name].ver) return S.sets[name]; }
      const r = await api('a=data&tab=' + name + (force ? '&force=1' : '')), p = await gunzipB64(r.gz); p.v = r.v; p.savedAt = Date.now();
      idbSet('payload_' + name, p); const D = decode(p); S.sets[name] = D; S.loadedAt = Date.now();
      if (S.name === name) { S.D = D; S.emit(false); }
      return D;
    },

    async _init(setStatus) {
      const t0 = performance.now();
      if (!CFG.API_URL) {                                         // demo mode: bundled sample
        const p = await (await fetch(CFG.SAMPLE_URL)).json();
        S.D = decode(p); S.source = 'Demo data (sample file)'; S.loadedAt = Date.now(); S.ms = performance.now() - t0;
        return S.D;
      }
      const cached = await idbGet('payload');
      if (cached) {
        S.D = decode(cached); S.source = 'Local cache'; S.loadedAt = cached.savedAt || Date.now(); S.ms = performance.now() - t0;
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
      const r = await api('a=data' + (force ? '&force=1' : ''));
      const p = await gunzipB64(r.gz); p.v = r.v; p.savedAt = Date.now();
      idbSet('payload', p);
      const first = !S.D, nd = decode(p); S.sets.main = nd;
      if (S.name !== 'main') return true;
      S.D = nd; S.source = 'Live from Google Sheet'; S.loadedAt = Date.now(); S.ms = performance.now() - t0;
      S.emit(first);
      return true;
    }
  };
  return S;
})();
