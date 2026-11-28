/* Shared by the page and by js/worker.js: turns the columnar payload into typed arrays + order/customer tables. No DOM, no globals. */
/** Turn the columnar payload into typed arrays + order/customer tables. */
function ksdDecode(p) {
  // customer = source_user_id; dictionary entry = [id, name, main phone, phones[]]
  const rawList = p.dict.cust, rawC = p.c, phonesAll = rawList.map(c => (c[3] && c[3].length) ? c[3].map(String) : [String(c[2] || '')]);
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
    qty: col(p.q, Int32Array), amt: col(p.a, Float64Array), cust: col(p.c, Int32Array), rawCust: col(rawC, Int32Array), city: col(p.y, Uint16Array), addr: col(p.ad, Int32Array)
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
  D.custName = p.dict.cust.map(c => c[1] || ''); D.custPhone = p.dict.cust.map(c => c[2] || '');
  D.rawPhone = rawList.map(c => c[2] || ''); D.custPhonesAll = phonesAll; D.custId = rawList.map(c => String(c[0])); D.meta = p.meta || null;
  D.custLabel = D.custName.map((nm, i) => nm || ('Customer ' + (D.custPhone[i] || D.custId[i])));
  D.custSearch = D.custLabel.map((l, i) => (l + ' ' + phonesAll[i].join(' ')).toLowerCase());
  D.cFirst = new Int32Array(nc).fill(1e9); D.cLast = new Int32Array(nc).fill(-1e9); D.cOrders = new Int32Array(nc);
  for (let k = 0; k < no; k++) { const c = D.oCust[k], d = D.oDay[k]; if (d < D.cFirst[c]) D.cFirst[c] = d; if (d > D.cLast[c]) D.cLast[c] = d; D.cOrders[c]++; }
  // store types (from the StoreTypes tab / bundled file), joined on the store name
  const norm = x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim(), tmap = new Map((p.st || []).map(r => [norm(r[0]), r[1]]));
  D.hasST = tmap.size > 0; D.stNames = [...new Set(tmap.values())].sort(); D.stAll = D.hasST ? [...D.stNames, 'Unmapped'] : [];
  D.cTypeName = D.custName.map(nm => tmap.get(norm(nm)) || 'Unmapped'); D.cST = Int16Array.from(D.cTypeName, x => D.stAll.indexOf(x));
  return D;
}
