/* Small shared helpers (no dependencies) */
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs, ...kids) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const fmtInt = n => Math.round(n).toLocaleString('en-AU');
const money0 = n => '$' + Math.round(n).toLocaleString('en-AU');
const money2 = n => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function compact(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return fmtInt(n);
}
const moneyC = n => '$' + compact(n);
const pct = (n, d = 1) => (n * 100).toFixed(d).replace(/\.0+$/, '') + '%';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dt = day => new Date(day * 864e5);
const dowOf = day => (Math.floor(day) + 3) % 7;               // 1970-01-01 was Thursday -> Mon=0
const dShort = day => { const d = dt(day); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; };
const dLong = day => { const d = dt(day); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
const dISO = day => dt(day).toISOString().slice(0, 10);
const isoDay = str => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : NaN; };
const monthStart = day => { const d = dt(day); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 864e5; };
const weekStart = day => day - dowOf(day);
function nice(max, ticks = 4) {                                   // nice axis maximum + step
  if (max <= 0) return { max: 1, step: 1 / ticks };
  const raw = max / ticks, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  return { max: Math.ceil(max / step) * step, step };
}
const rafOnce = fn => { let q = 0; return (...a) => { if (q) return; q = requestAnimationFrame(() => { q = 0; fn(...a); }); }; };
const store = {                                                   // localStorage that never throws
  get(k, d) { try { const v = localStorage.getItem('ksd.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ksd.' + k, JSON.stringify(v)); } catch (e) { } }
};
function download(name, text, type = 'text/csv') {
  const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
}
const csvCell = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
