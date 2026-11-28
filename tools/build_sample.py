"""Build ANONYMISED demo files data/sample.json (Local) and data/sample-interstate.json (Interstate + Regional)
from the real workbook. The same rules as Code.gs are used:
  - Local Stores tab -> region 0 ; Interstate Stores tab -> region 2, or 1 when its region text says "regional"
  - Interstate wins when an id is in both tabs
  - store type = the category column of its tab ; ids in no tab are 'Unmapped' (B2B) or 'Website' (B2C)
  - sold = id is in the Multiple Owner Inactive tab
No real names, phones, ids or addresses are written (the demo files are public on GitHub Pages).
usage: python3 -I tools/build_sample.py <workbook.xlsx> <outdir>"""
import sys, json, re, pandas as pd

src, outdir = sys.argv[1], sys.argv[2]
sh = pd.read_excel(src, sheet_name=None)
norm = lambda x: re.sub(r'\s+', ' ', str(x or '')).strip().lower()


def pick(df, *names):
    for n in names:
        if n in df.columns: return n
    return None


def ids(tab):
    idc = pick(sh[tab], 'source_user_id', 'bus_id'); return idc


# registry from the store tabs (same rules as Code.gs)
reg, sold = {}, set()
for tab, default_region in (('Local Stores', 0), ('Interstate Stores', 2)):
    df = sh[tab]; idc = ids(tab); catc = pick(df, 'category', 'store_type'); regc = pick(df, 'region')
    for _, r in df.iterrows():
        if pd.isna(r[idc]): continue
        region = default_region
        if tab == 'Interstate Stores' and regc and 'regional' in str(r[regc]).lower(): region = 1
        cat = str(r[catc]).strip() if catc and not pd.isna(r[catc]) else 'Unmapped'
        reg[str(int(r[idc])) if isinstance(r[idc], float) else str(r[idc])] = dict(region=region, cat=cat or 'Unmapped')
idc = ids('Multiple Owner Inactive')
for v in sh['Multiple Owner Inactive'][idc].dropna(): sold.add(str(int(v)) if isinstance(v, float) else str(v))

d = sh['Sheet1'].copy()
d['uid'] = d.source_user_id.map(lambda v: str(int(v)) if isinstance(v, float) else str(v))
d['nm'] = d.shipping_name.map(norm)
d['delivery_date'] = pd.to_datetime(d.delivery_date)
d = d.sort_values(['delivery_date', 'source_order_id', 'order_item_id'], kind='stable').reset_index(drop=True)
epoch = pd.Timestamp('1970-01-01')


def info(uid):
    r = reg.get(uid)
    s = 1 if uid in sold else 0
    if r: return r['region'], r['cat'], s
    return None, None, s


def build(x, tag):
    x = x.reset_index(drop=True)

    def dic(series):
        vals = list(dict.fromkeys(series.tolist())); ix = {v: i for i, v in enumerate(vals)}
        return vals, [ix[v] for v in series.tolist()]

    types, t = dic(x.order_type); prods, p = dic(x.product_short_name); cities, y = dic(x.shipping_city.fillna(''))
    users, c = dic(x.uid)
    nm = x.dropna(subset=['shipping_name']).groupby('uid').shipping_name.agg(lambda s: s.mode().iat[0])
    typ = x.groupby('uid').order_type.agg(lambda s: 'b2b' in set(s))
    cust, cs, k, demo_name = [], [], 0, {}
    for u in users:
        k += 1
        region, cat, sd = info(u)
        b2b = typ[u]
        if region is None:
            # not in any store tab: B2B is Unmapped, B2C is Website
            cat = 'Unmapped' if b2b else 'Website'; region = 0
        if b2b: name = 'Demo Store %04d' % k
        else: name = 'Demo Customer %04d' % k
        ph = '04%08d' % (10000000 + k)
        cust.append(['U%05d' % k, name, ph, [ph]])
        cs.append([region, cat, sd])
    dd = ((x.delivery_date - epoch).dt.days).tolist()
    return dict(v='sample-' + tag, n=len(x),
                dict=dict(type=types, prod=prods, city=cities, addr=['Address 0'], cust=cust),
                cs=cs, d=dd, o=x.source_order_id.tolist(), i=x.order_item_id.tolist(), t=t, p=p,
                q=x.item_count.tolist(), a=[round(v, 2) for v in x.total_amount_display.tolist()],
                c=c, y=y, ad=[0] * len(x), st=[],
                w={}, meta=dict(sheetRows=len(x), rows=len(x), min=min(dd), max=max(dd), tab=tag))


reg_of = d.uid.map(lambda u: (info(u)[0]))
main = d[(reg_of == 0) | reg_of.isna()]
inter = d[(reg_of.notna()) & (reg_of != 0)]
for tag, x, fn in (('main', main, 'sample.json'), ('interstate', inter, 'sample-interstate.json')):
    json.dump(build(x, tag), open(outdir + '/' + fn, 'w'), separators=(',', ':'))
    print(fn, len(x), 'rows')
