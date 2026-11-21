# Kisaan Sales Dashboard

Interactive desktop dashboard (Power-BI style) on **Google Sheet → Apps Script → GitHub Pages**. No build step, no libraries, no cost.

## Daily use
1. Open the Google Sheet, clear the old rows and paste the latest export (same 12 columns, row 1 = headers).
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
Add a tab named **Interstate** (same 12 columns) to the Google Sheet and paste interstate sales there. The "Interstate sales" group in the sidebar then shows Overview, Orders, Products, Stores and Cities for those stores only, with their own filters. If there is no such tab, rows matching the interstate cities/store names listed in `apps-script/Code.gs` (`INTERSTATE_CITIES`, `INTERSTATE_NAMES`) are split out of the main tab automatically, and are excluded from the main pages.
After updating `Code.gs` you must redeploy: Deploy > Manage deployments > edit > New version.

