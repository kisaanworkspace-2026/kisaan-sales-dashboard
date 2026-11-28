/* Web Worker: gunzip + JSON.parse + decode off the main thread, then hand the typed arrays back without copying. */
importScripts('decode.js');
async function gunzipB64(b64) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return JSON.parse(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}
// Same database as js/store.js ('ksd' / 'kv'). Opened at worker start so that put() can run synchronously: put() copies the value at that instant,
// which is what makes it safe to transfer the typed-array buffers to the page right afterwards. The disk write then finishes in the background.
const dbp = new Promise(res => {
  try { const r = indexedDB.open('ksd', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); }
});
const idbPut = (db, key, val) => { try { db.transaction('kv', 'readwrite').objectStore('kv').put(val, key); } catch (e) { } };
onmessage = async e => {
  const m = e.data;
  try {
    let p = m.obj;
    if (m.gz) p = await gunzipB64(m.gz);
    else if (m.url) p = await (await fetch(m.url)).json();
    if (m.v != null) p.v = m.v;
    const D = ksdDecode(p), tr = [];
    if (m.cache) { const db = await dbp; if (db) idbPut(db, m.cache, { fmt: m.fmt, v: D.ver, savedAt: m.savedAt, D }); }      // ready-to-use typed arrays: the next page load needs no unzip / parse / decode. put() copies the value at once, so transferring the buffers below is safe; the disk write finishes in the background
    for (const k in D) { const x = D[k]; if (ArrayBuffer.isView(x)) tr.push(x.buffer); }
    postMessage({ id: m.id, D }, tr);
  } catch (err) { postMessage({ id: m.id, error: String(err && err.message || err) }); }
};
