/**
 * Kisaan Sales Dashboard - Apps Script JSON API (bound to the Google Sheet)
 *
 * Sheet tab (row 1 = headers, read BY NAME so column order and extra columns do not matter):
 * source_user_id | shipping_name | shipping_primary_phone | order_type | delivery_date | source_order_id |
 * product_short_name | product_id | item_count | order_item_id | shipping_address_line_1 |
 * shipping_city | total_amount_display
 *
 * SECURITY (Kisaan security standard): every request must carry the access PIN.
 *   Project Settings > Script Properties > add  PIN = <your pin>   (never put the PIN in code).
 *   If PIN is not set the API refuses to answer. After 10 wrong PINs in 10 minutes it locks for 10 minutes.
 *
 * Endpoints (GET, all need &k=PIN):
 *   ?a=ver[&tab=interstate]            -> {v}
 *   ?a=data[&tab=interstate][&force=1] -> {v, gz, n}  gzip+base64 columnar payload
 *
 * Deploy: Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone (the PIN protects it).
 */
var SHEET_NAME = '';            // '' = first tab. Or the exact tab name
var INTERSTATE_TAB = 'Interstate';   // optional tab (same columns). If missing, interstate rows are split out of the main tab by INTERSTATE_STORES.
// Interstate stores. Matched by name (ignoring capitals / extra spaces); then EVERY row of the same source_user_id is interstate, so spelling variants follow.
var INTERSTATE_STORES = ['Divyaa Imports Adelaide', 'Saanjh Foods Brisbane', 'Conscious Choice Imports Sydney', 'The Spice House Launceston', 'The Spice House Hobart', 'The Spice House'];
var STORETYPES_TAB = 'StoreTypes';   // optional tab: bus_name | city | code_value (store type). Matched to the store name.
var DATE_SWAP = 'auto';         // 'auto' | 'always' | 'never'
var CHUNK = 90000;              // CacheService limit is 100KB per key
var CACHE_SECONDS = 21600;      // 6h; a new sheet version invalidates it anyway

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    var auth = auth_(p.k);
    if (auth) return json_({ error: auth });
    var a = p.a || 'data', tab = p.tab === 'interstate' ? 'interstate' : 'main';
    if (a === 'ver') return json_({ v: version_(tab) });
    if (a === 'data') return json_(getData_(p.force === '1', tab));
    return json_({ error: 'unknown action' });
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

/** returns '' when allowed, otherwise an error code the page understands ('auth' = ask for the PIN again) */
function auth_(k) {
  var pin = PropertiesService.getScriptProperties().getProperty('PIN');
  if (!pin) return 'PIN is not set. Add Script Property PIN in Apps Script > Project Settings.';
  var cache = CacheService.getScriptCache(), fails = Number(cache.get('fails') || 0);
  if (fails >= 10) return 'locked';
  if (String(k || '') !== String(pin)) { cache.put('fails', String(fails + 1), 600); return 'auth'; }
  return '';
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function mainSheet_() {
  var ss = SpreadsheetApp.getActive();
  return SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
}

/** version = Drive "last modified" + row counts. Changes whenever the user pastes new data. */
function version_(tab) {
  var ss = SpreadsheetApp.getActive(), i = ss.getSheetByName(INTERSTATE_TAB), s = ss.getSheetByName(STORETYPES_TAB);
  var t = DriveApp.getFileById(ss.getId()).getLastUpdated().getTime();
  return tab + '-' + t + '-' + mainSheet_().getLastRow() + '-' + (i ? i.getLastRow() : 0) + '-' + (s ? s.getLastRow() : 0);
}

function getData_(force, tab) {
  var v = version_(tab);
  var cache = CacheService.getScriptCache();
  if (!force) {
    var meta = cache.get('meta_' + v);
    if (meta) {
      var m = JSON.parse(meta), keys = [];
      for (var i = 0; i < m.chunks; i++) keys.push('d_' + v + '_' + i);
      var got = cache.getAll(keys), parts = [], ok = true;
      for (var j = 0; j < keys.length; j++) { if (got[keys[j]] == null) { ok = false; break; } parts.push(got[keys[j]]); }
      if (ok) return { v: v, n: m.n, gz: parts.join('') };
    }
  }
  var payload = build_(v, tab);
  var gz = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(payload), 'application/json')).getBytes());
  try {
    var put = {}, chunks = Math.ceil(gz.length / CHUNK);
    for (var k = 0; k < chunks; k++) put['d_' + v + '_' + k] = gz.substr(k * CHUNK, CHUNK);
    put['meta_' + v] = JSON.stringify({ chunks: chunks, n: payload.n });
    cache.putAll(put, CACHE_SECONDS);
  } catch (e) { /* cache is best-effort */ }
  return { v: v, n: payload.n, gz: gz };
}

function norm_(x) { return String(x == null ? '' : x).toLowerCase().replace(/\s+/g, ' ').trim(); }

/** Columnar, dictionary-encoded payload: small to ship, instant to filter in the browser. */
// Amount may be a number or text such as "$1,171.22" (or "-$5.00" / "(5.00)"): strip everything except digits, dot and minus.
function money_(v) {
  if (typeof v === 'number') return v;
  var t = String(v == null ? '' : v).trim();
  if (!t) return 0;
  var neg = /^\(.*\)$/.test(t) || t.indexOf('-') >= 0;
  var n = parseFloat(t.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : (neg ? -n : n);
}

function build_(v, tab) {
  var ss = SpreadsheetApp.getActive();
  var sepSheet = tab === 'interstate' ? ss.getSheetByName(INTERSTATE_TAB) : null;
  var sh = sepSheet || mainSheet_();
  var last = sh.getLastRow(), lastCol = sh.getLastColumn();
  var empty = { v: v, n: 0, dict: { type: [], prod: [], city: [], addr: [], cust: [] }, d: [], o: [], i: [], t: [], p: [], q: [], a: [], c: [], y: [], ad: [], st: [], w: {}, meta: { sheetRows: Math.max(0, last - 1), rows: 0, min: null, max: null, tab: tab } };
  if (last < 2) return empty;
  var vals = sh.getRange(1, 1, last, lastCol).getValues();           // ALL columns, found by header name below
  var hdr = vals[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var col = function (name) { var ix = hdr.indexOf(name); if (ix < 0) throw new Error('Missing column: ' + name + ' (headers found: ' + hdr.join(', ') + ')'); return ix; };
  var C = {
    uid: col('source_user_id'), name: col('shipping_name'), phone: col('shipping_primary_phone'), type: col('order_type'), date: col('delivery_date'),
    oid: col('source_order_id'), prod: col('product_short_name'), qty: col('item_count'), iid: col('order_item_id'),
    addr: col('shipping_address_line_1'), city: col('shipping_city'), amt: col('total_amount_display')
  };
  var tz = ss.getSpreadsheetTimeZone();
  var dayCache = {}, swapped = 0, future = 0, tomorrow = Date.now() / 86400000 + 1;
  var swapOn = DATE_SWAP === 'always';
  if (DATE_SWAP === 'auto') for (var q = 1; q < vals.length && !swapOn; q++) { var dv = vals[q][C.date]; if (typeof dv === 'string') { var mm = dv.match(/^\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); if (mm && +mm[1] > 12) swapOn = true; } }
  function dayNum(x) {
    if (x instanceof Date) {
      var k = x.getTime();
      if (dayCache[k] == null) {
        var s = Utilities.formatDate(x, tz, 'yyyy-MM-dd').split('-'), yy = +s[0], mo = +s[1], dd = +s[2];
        if (swapOn && dd <= 12) { dayCache[k] = Date.UTC(yy, dd - 1, mo) / 86400000; dayCache[k + '_s'] = 1; }
        else dayCache[k] = Date.UTC(yy, mo - 1, dd) / 86400000;
      }
      if (dayCache[k + '_s']) swapped++;
      return dayCache[k];
    }
    var m = String(x).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);            // text date yyyy-mm-dd
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000;
    m = String(x).match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);      // text date dd/mm/yyyy
    if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]) / 86400000;
    return NaN;
  }
  // interstate user ids (only needed when there is no separate Interstate tab)
  var interNames = {}, interIds = {};
  INTERSTATE_STORES.forEach(function (n) { interNames[norm_(n)] = 1; });
  if (!sepSheet) for (var z = 1; z < vals.length; z++) if (interNames[norm_(vals[z][C.name])]) interIds['_' + vals[z][C.uid]] = 1;
  var rows = [], skipped = 0;
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r], dn = dayNum(row[C.date]);
    if (isNaN(dn) || row[C.oid] === '') { if (row[C.oid] !== '' || String(row[C.date]) !== '') skipped++; continue; }
    if (!sepSheet) {
      var inter = !!interIds['_' + row[C.uid]] || !!interNames[norm_(row[C.name])];
      if (inter !== (tab === 'interstate')) continue;
    }
    if (dn > tomorrow) future++;
    rows.push({ r: row, d: dn });
  }
  rows.sort(function (a, b) { return a.d - b.d || a.r[C.oid] - b.r[C.oid] || a.r[C.iid] - b.r[C.iid]; });

  var mk = function () { return { list: [], ix: {} }; };
  var put = function (m, val) { var k = '_' + val; var i = m.ix[k]; if (i === undefined) { i = m.list.length; m.ix[k] = i; m.list.push(val); } return i; };
  var T = mk(), P = mk(), Y = mk(), A = mk(), U = mk(), names = {}, phones = {};
  var out = { v: v, n: rows.length, d: [], o: [], i: [], t: [], p: [], q: [], a: [], c: [], y: [], ad: [] };
  var tally = function (o, key, val) { if (val === '' || val == null) return; var m = o[key] || (o[key] = {}); m[val] = (m[val] || 0) + 1; };
  var mode = function (m) { var best = '', n = 0; for (var k in m) if (m[k] > n) { n = m[k]; best = k; } return best; };
  var minD = 1e9, maxD = -1e9;
  for (var k = 0; k < rows.length; k++) {
    var x = rows[k].r, uid = String(x[C.uid]);
    if (rows[k].d < minD) minD = rows[k].d; if (rows[k].d > maxD) maxD = rows[k].d;
    out.d.push(rows[k].d);
    out.o.push(Number(x[C.oid]));
    out.i.push(Number(x[C.iid]));
    out.t.push(put(T, String(x[C.type])));
    out.p.push(put(P, String(x[C.prod])));
    out.q.push(Number(x[C.qty]) || 0);
    out.a.push(Math.round(money_(x[C.amt]) * 100) / 100);
    out.c.push(put(U, uid));
    out.y.push(put(Y, String(x[C.city] || '')));
    out.ad.push(put(A, String(x[C.addr] || '')));
    tally(names, uid, String(x[C.name] || '').trim());
    tally(phones, uid, String(x[C.phone] || '').trim());
  }
  out.w = { swapped: swapped, future: future, skipped: skipped };
  out.meta = { sheetRows: last - 1, rows: rows.length, min: rows.length ? minD : null, max: rows.length ? maxD : null, tab: tab };
  out.st = storeTypes_();
  // customer dictionary: [user id, most common name, most common phone, up to 3 phones]
  out.dict = { type: T.list, prod: P.list, city: Y.list, addr: A.list, cust: U.list.map(function (uid) {
    var pm = phones[uid] || {}, pl = Object.keys(pm).sort(function (a, b) { return pm[b] - pm[a]; }).slice(0, 3);
    return [uid, mode(names[uid] || {}), pl[0] || '', pl];
  }) };
  return out;
}

function storeTypes_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(STORETYPES_TAB);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().filter(function (r) { return r[0] && r[2]; }).map(function (r) { return [String(r[0]).trim(), String(r[2]).trim()]; });
}

/** Run once from the editor to authorise and to time a cold build. */
function testBuild() {
  var t = Date.now(); var d = getData_(true, 'main'), i = getData_(true, 'interstate');
  Logger.log('main rows=' + d.n + ', interstate rows=' + i.n + ', gzBase64=' + Math.round(d.gz.length / 1024) + 'KB in ' + (Date.now() - t) + 'ms');
  Logger.log('PIN set: ' + !!PropertiesService.getScriptProperties().getProperty('PIN'));
}
