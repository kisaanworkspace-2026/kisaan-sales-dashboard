/* Global filter state + fast row masks. Every page reads from here, so filters are shared across pages. */
const F = (() => {
  const saved = store.get('filters', {});
  const st = {
    preset: saved.preset || '30d', from: saved.from || null, to: saved.to || null,
    types: new Set(saved.types || []), prods: new Set(saved.prods || []), cities: new Set(saved.cities || []),
    dows: new Set(saved.dows || []), stypes: new Set(saved.stypes || []), q: saved.q || ''
  };
  const subs = [];
  let lut = null, gen = 0, sig = '', cache = [], lastD = null;                    // cache = recent row masks, keyed by filter state + dates, so going back to an earlier filter state costs nothing
  let cur = 'main'; const stash = {};
  const persist = () => store.set(cur === 'main' ? 'filters' : 'filters.' + cur, { preset: st.preset, from: st.from, to: st.to, types: [...st.types], prods: [...st.prods], cities: [...st.cities], dows: [...st.dows], stypes: [...st.stypes], q: st.q });

  function resolve() {                                            // names -> lookup tables for current dictionary
    const D = Store.D; if (!D) return;
    if (D !== lastD) { lastD = D; cache = []; }                    // new data object (reload / other dataset): old masks are void
    gen++; sig = JSON.stringify([[...st.types], [...st.prods], [...st.cities], [...st.dows], [...st.stypes], st.q.trim().toLowerCase()]) + '|' + Store.name + '|' + D.ver + '|' + D.n + '|' + D.custName.length;
    const mk = (set, list) => { if (!set.size) return null; const a = new Uint8Array(list.length); list.forEach((nm, i) => { if (set.has(nm)) a[i] = 1; }); return a; };
    lut = { stp: null, type: mk(st.types, D.dict.type), prod: mk(st.prods, D.dict.prod), city: mk(st.cities, D.dict.city), cust: null, dow: null };
    if (st.stypes.size) { lut.stp = new Uint8Array(D.custName.length); D.cTypeName.forEach((nm, i) => { if (st.stypes.has(nm)) lut.stp[i] = 1; }); }
    if (st.dows.size) { lut.dow = new Uint8Array(7); st.dows.forEach(d => lut.dow[d] = 1); }
    if (st.q.trim()) { const q = st.q.trim().toLowerCase(); lut.cust = new Uint8Array(D.custSearch.length); D.custSearch.forEach((t, i) => { if (t.includes(q)) lut.cust[i] = 1; }); }
  }
  const F = {
    st,
    range() {
      const D = Store.D, mx = D.maxDay, mn = D.minDay, c = (a, b) => ({ from: Math.max(mn, a), to: Math.min(mx, b) });
      switch (st.preset) {
        case '7d': return c(mx - 6, mx);
        case '30d': return c(mx - 29, mx);
        case '90d': return c(mx - 89, mx);
        case 'mtd': return c(monthStart(mx), mx);
        case 'custom': { const r = c(st.from ?? mn, st.to ?? mx); return r.from > r.to ? { from: mn, to: mx } : r; }
        default: return { from: mn, to: mx };
      }
    },
    /** previous period of equal length (null when it would start before the data) */
    prevRange() { const { from, to } = F.range(); const len = to - from + 1; const p = { from: from - len, to: from - 1 }; return p.to < Store.D.minDay ? null : p; },
    /** fills and returns a row mask. slot 0 = current, 1 = previous/second */
    mask(from, to, slot = 0, skipST = false) {
      const key = sig + '|' + from + '|' + to + '|' + (skipST ? 1 : 0), hit = cache.find(e => e.k === key); if (hit) return hit.a;     // same filter state + dates: no new pass over the rows
      const D = Store.D, n = D.n, { type, prod, city, cust, dow } = lut, stp = skipST ? null : lut.stp;
      let ent = cache.length >= 8 ? cache.shift() : { k: '', a: null }; if (!ent.a || ent.a.length !== n) ent.a = new Uint8Array(n); ent.k = key; cache.push(ent); const buf = ent.a;
      const day = D.day, T = D.type, P = D.prod, Y = D.city, C = D.cust;
      for (let i = 0; i < n; i++) {
        const d = day[i];
        buf[i] = (d >= from && d <= to && (!type || type[T[i]]) && (!prod || prod[P[i]]) && (!city || city[Y[i]]) && (!cust || cust[C[i]]) && (!stp || stp[C[i]]) && (!dow || dow[(d + 3) % 7])) ? 1 : 0;
      }
      return buf;
    },
    /** changes whenever the filters or the data change; pages use it to skip a re-calculation */
    get gen() { return gen; },
    isActive() { return st.types.size || st.prods.size || st.cities.size || st.dows.size || st.stypes.size || st.q.trim(); },
    set(patch) { Object.assign(st, patch); F.changed(); },
    toggle(dim, val) { const s = st[dim]; s.has(val) ? s.delete(val) : s.add(val); F.changed(); },
    clear() { st.types.clear(); st.prods.clear(); st.cities.clear(); st.dows.clear(); st.stypes.clear(); st.q = ''; F.changed(); },
    useSet(name) {                                                 // per-dataset filter state
      if (name === cur) return; stash[cur] = F.snapshot(); cur = name;
      const v = stash[name] || store.get('filters.' + name, { preset: '30d' });
      st.preset = v.preset || '30d'; st.from = v.from ?? null; st.to = v.to ?? null; st.q = v.q || '';
      for (const k of ['types', 'prods', 'cities', 'dows', 'stypes']) { st[k].clear(); (v[k] || []).forEach(x => st[k].add(x)); }
      F.pruneUnknown(); resolve();
    },
    snapshot() { return { preset: st.preset, from: st.from, to: st.to, types: [...st.types], prods: [...st.prods], cities: [...st.cities], dows: [...st.dows], stypes: [...st.stypes], q: st.q }; },
    apply(v) { st.preset = v.preset; st.from = v.from; st.to = v.to; st.q = v.q || ''; for (const k of ['types', 'prods', 'cities', 'dows', 'stypes']) { st[k].clear(); (v[k] || []).forEach(x => st[k].add(x)); } F.pruneUnknown(); F.changed(); },
    onChange(fn) { subs.push(fn); },
    changed() { persist(); resolve(); subs.forEach(f => f()); },
    prepare() { resolve(); },                                      // call after (re)loading data
    pruneUnknown() {                                               // drop saved selections that no longer exist in the data
      const D = Store.D; if (!D) return;
      for (const [k, list] of [['types', D.dict.type], ['prods', D.dict.prod], ['cities', D.dict.city], ['stypes', D.stAll]]) for (const v of [...st[k]]) if (!list.includes(v)) st[k].delete(v);
    }
  };
  return F;
})();
