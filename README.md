# Kisaan Sales Dashboard

Interactive desktop dashboard (Power-BI style) on **Google Sheet → Apps Script → GitHub Pages**. No build step, no libraries, no cost.

## Daily use
1. Open the Google Sheet, clear the old rows and paste the latest export (same columns, row 1 = headers).
2. Open the dashboard. It shows instantly from its local copy, checks the sheet in the background and updates itself if the data changed. The ⟳ button forces a full re-download.

## One-time setup (≈10 min)
1. **Sheet**: create a Google Sheet, paste the sample data in the first tab with the headers exactly as in the file.
2. **API**: Extensions → Apps Script → paste `apps-script/Code.gs` → Run `testBuild` once (accept permissions) → Deploy → New deployment → Web app → Execute as *Me*, access *Anyone* → copy the `/exec` URL.
3. **Config**: put that URL in `js/config.js` → `API_URL`.
4. **Host**: upload this folder to a GitHub repo (e.g. `kisaanworkspace-2026/sales-dashboard`), Settings → Pages → Deploy from branch `main` / root. Open the Pages URL.
Until `API_URL` is set the app runs in **DEMO mode** on `data/sample.json`.

## How it stays fast
- Apps Script returns a compact column-oriented, dictionary-encoded, gzipped payload (≈330 KB for 34k lines) and caches it server-side; `?a=ver` is a tiny check.
- The browser keeps the decoded data in IndexedDB, so every visit after the first renders from local data in well under a second, then refreshes silently.
- All filtering is typed-array loops in the browser (tested: 344k lines, 84 ms per filter change).

## Data rules (important)
- `total_amount_display` is the **order total, stored on one line of the order**. Revenue = sum of order totals; per-product *revenue* is therefore not reliable and product charts use **units** and **orders containing the product**.
- An "order" = `source_order_id` + `delivery_date` (110 orders in the sample are re-delivered on later dates with $0 lines, so they count as extra deliveries).
- Customer = phone number (name taken from any row that has one).

## Files
`index.html` shell · `css/app.css` · `js/` engine (`store` data layer, `filters`, `charts`, `ui`, `app`) · `js/pages/*.js` one file per page · `apps-script/Code.gs` · `tools/build_sample.py` (xlsx → sample.json) · `ROADMAP.md` (next phases)

## Interstate sales
Add a tab named **Interstate** (same columns) to the Google Sheet and paste interstate sales there. The "Interstate sales" group in the sidebar then shows Overview, Orders, Products, Stores and Cities for those stores only, with their own filters. If there is no such tab, rows matching the interstate cities/store names listed in `apps-script/Code.gs` (`INTERSTATE_CITIES`, `INTERSTATE_NAMES`) are split out of the main tab automatically, and are excluded from the main pages.
After updating `Code.gs` you must redeploy: Deploy > Manage deployments > edit > New version.

## Store types
Add a tab named **StoreTypes** to the Google Sheet and paste your store list there with the same 3 columns as the Excel file: `bus_name | city | code_value`. Stores are matched to sales by name (`shipping_name` = `bus_name`, ignoring case/extra spaces); unmatched stores show as "Unmapped". A "Store type" filter then appears in the filter bar and on the B2B Stores page (click a type to see its revenue, trend, products, cities and stores everywhere). The bundled demo data already contains your 417-store list.



## Phase 8 (25 Nov 2026): user id, interstate list, PIN
- The Sheet now has 13 columns; the first is `source_user_id`. Columns are found by header name, so order does not matter, but all 13 headers must exist.
- **Customer = source_user_id.** Name shown = most common name for that id; phone shown = most common phone.
- **Interstate stores** (edit INTERSTATE_STORES in Code.gs): Divyaa Imports Adelaide, Saanjh Foods Brisbane, Conscious Choice Imports Sydney, The Spice House Launceston, The Spice House Hobart, The Spice House. All rows of the same user id follow. Every other store is regional (main data). The old city rule is gone.
- **PIN (required):** Apps Script > Project Settings > Script Properties > add `PIN` = your code. Redeploy as a NEW version. The page asks for the PIN once per device. Without the Script Property the API refuses to answer. 10 wrong PINs lock it for 10 minutes. Sheet sharing must stay Restricted. If the URL or PIN leaks, change the PIN (and make a new deployment).
- The demo files in `data/` are anonymised (fake names, phones, ids, addresses). Rebuild them with `tools/build_sample.py`; never put the real export in the repo.
- Status line shows rows loaded of Sheet rows, first and last date, and warns if fewer rows than last time or if rows were skipped.


## Releasing a new version (Phase 13)
1. Change the files. 2. Run `python3 tools/release.py` (bumps `VERSION` in sw.js, `APP_VERSION` in js/app.js and `v` in version.json). 3. Upload everything, including version.json. Open dashboards then show a "New version available - Refresh now" popup within 5 minutes (or when the tab is opened again); the button clears the app caches and reloads like Ctrl+Shift+R. Data and PIN are kept.
