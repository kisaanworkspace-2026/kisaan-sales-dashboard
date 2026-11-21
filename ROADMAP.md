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
- **5 B2B vs B2C**: side-by-side KPIs, avg order value, weekday pattern, delivery calendar heatmap.
- **6 Polish**: saved filter views, targets/goals line, print/PDF view, installable PWA (manifest + service worker), anomaly highlights (e.g. big drop vs last week).
- **7 Interstate Sales (new page, separate data)**: the main sales export EXCLUDES interstate stores, so this page needs its own Google Sheet tab (same 12 columns) and a second API payload (`?a=data&tab=interstate`, own cache key + IndexedDB key); reuse the same engine and page pattern.
  Interstate = rows matching EITHER rule (the main export's SQL is `AND o.shipping_city NOT IN (...) AND o.shipping_name NOT IN (...)`):
  - shipping_city in: Salisbury Plain, Bahrs Scrub, Seven Hills, New Town, Mowbray, Corio, Geelong, Armstrong Creek, Grovedale, Belmont, Charlemont, Norlane, Moolap, Drumcondra, Sebastopol, Lavington, Wodonga
  - shipping_name in: Sip N Shop Indian Mart Mildura, Nice Indian Store Mildura
  Keep this list in one config constant (js/config.js `INTERSTATE`) so it is easy to edit; if a single combined sheet is used later, split by these rules instead.
