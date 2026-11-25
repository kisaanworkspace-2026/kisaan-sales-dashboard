# Roadmap & how to continue in a NEW chat (keeps usage low)

Engine is done; every new page is ONE small file `js/pages/<id>.js` that registers `Pages.<id> = { title, mount(el), update() }`.
Pages get free: global filters (`F`), masks (`F.mask(from,to,slot)`), typed-array data (`Store.D`), charts (`Charts.trend/hbar/columns/donut/spark`), `UI.card/kpi/table/slicer/drawer/openOrder`.
To enable a page: delete `soon:` on its entry in `NAV` (js/app.js).

## Data model (Store.D)
Line level (n): day, oid, iid, type, prod, qty, amt, cust, city, addr, oi(order index).
Order level (nOrders): oTotal, oDay, oType, oCity, oCust, oId, oUnits, oStart (CSR to lines).
Customer level: custName/custPhone/custLabel/custSearch, cFirst, cLast, cOrders. Dictionaries in D.dict.{type,prod,city,addr,cust}.
Rules: revenue = sum of oTotal over distinct orders touched by the mask; product metrics = units + orders containing; see js/pages/overview.js compute().

## Phases (one chat each; paste "Continue the Kisaan Sales Dashboard from ROADMAP.md, build Phase N" + attach the zip)
- **2 Products (DONE)**: ranking table (units, orders, buyers, avg units/order, trend sparkline), product × order-type stacked bars, product trend over time, click row → drawer with top buyers.
- **3 Customers (DONE)**: new vs returning, inactive customers (days since last order), order frequency, top/bottom lists, customer drawer (order history, product mix).
- **4 Cities (DONE)**: city ranking table, revenue/orders/customers per city, city × product heat matrix.
- **5 B2B vs B2C (DONE)**: side-by-side KPIs, avg order value, weekday pattern, delivery calendar heatmap.
- **6 Polish (DONE: saved views, daily target line, insights strip, print, PWA manifest + sw.js, brand colours; sw.js VERSION must be bumped on each release)**: saved filter views, targets/goals line, print/PDF view, installable PWA (manifest + service worker), anomaly highlights (e.g. big drop vs last week).
- **7 Interstate Sales (DONE: sidebar group 'Interstate sales' reuses Overview/Orders/Products/Stores/Cities on a second dataset; Code.gs ?tab=interstate reads the 'Interstate' tab, or splits rows out of the main tab by the rules below if no such tab; per-dataset filters; empty state when no data. All phases complete.)**: the main sales export EXCLUDES interstate stores, so this page needs its own Google Sheet tab (same 12 columns) and a second API payload (`?a=data&tab=interstate`, own cache key + IndexedDB key); reuse the same engine and page pattern.
  Interstate = rows matching EITHER rule (the main export's SQL is `AND o.shipping_city NOT IN (...) AND o.shipping_name NOT IN (...)`):
  - shipping_city in: Salisbury Plain, Bahrs Scrub, Seven Hills, New Town, Mowbray, Corio, Geelong, Armstrong Creek, Grovedale, Belmont, Charlemont, Norlane, Moolap, Drumcondra, Sebastopol, Lavington, Wodonga
  - shipping_name in: Sip N Shop Indian Mart Mildura, Nice Indian Store Mildura
  Keep this list in one config constant (js/config.js `INTERSTATE`) so it is easy to edit; if a single combined sheet is used later, split by these rules instead.
## Brand assets (in /assets, use in all pages and the Phase 6 PWA)
icon-192.png, icon-512.png, icon-maskable-512.png (PWA maskable), apple-touch-icon.png, kisaan-logo.jpg (full logo). Brand colours from the logo: forest green ~#1a4d2a and cow-brown ~#7a3515 (current UI accent is #1f7a5a; consider aligning in Phase 6).

## Bug-fix round 1 (DONE) – see sales-dashboard-bugs.md
1 & 3 date swap: Code.gs auto-detects day/month swapped dates (DATE_SWAP='auto'), corrects them and reports counts; status bar warns about swapped or future-dated rows. 2 calendar now counts orders. 4 date range clamped to the sheet's first/last date, picker min/max, disabled presets, "Data available" label. 5 new page "B2B Stores" (js/pages/stores.js). Code.gs must be redeployed (new version). sw.js VERSION = ksd-v8.

## Round 2 (DONE): B2B Stores page extended
Store types (global "Store type" filter, StoreTypes tab), stores not ordering for 30/45/60/90 days, stores buying only 3-6 products with the products they are missing (popular with similar store types), revenue-over-time and top products for the selected store type. sw.js VERSION = ksd-v9. Code.gs reads the StoreTypes tab (redeploy needed).


## Audit round (23 Nov 2026) - customer identity
- Problem: a shop ordering from several phone numbers counted as several customers (store counts, new stores, lapsed list, low-variety list all wrong).
- Fix (store.js decode): customers with at least one B2B order are merged by shop NAME; everyone else stays one customer per phone. Revenue totals are unchanged by this (checked: same totals before/after).
- Lapsed list counts ANY order type from the shop. Orders page / order drawer still show the phone actually used on that order (D.rawPhone/D.rawCust).
- B2B page memory: per-store tables sized by B2B stores only; page shows a red message instead of blank if it ever fails.
