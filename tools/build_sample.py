"""Build ANONYMISED demo files (data/sample.json and data/sample-interstate.json) from a real sales xlsx.
No real names, phones, ids or addresses are written (the demo files are public on GitHub Pages).
usage: python3 -I build_sample.py sales.xlsx old_sample_with_st.json ../data"""
import sys, json, re, pandas as pd
src, old, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
d = pd.read_excel(src)
INTER = ['divyaa imports adelaide', 'saanjh foods brisbane', 'conscious choice imports sydney', 'the spice house launceston', 'the spice house hobart', 'the spice house']
norm = lambda x: re.sub(r'\s+', ' ', str(x or '')).strip().lower()
try: oldst = {norm(a): b for a, b in json.load(open(old)).get('st', [])}
except Exception: oldst = {}
d['nm'] = d.shipping_name.map(norm)
inter_ids = set(d[d.nm.isin(INTER)].source_user_id)
d['inter'] = d.source_user_id.isin(inter_ids)
d = d.sort_values(['delivery_date', 'source_order_id', 'order_item_id'], kind='stable').reset_index(drop=True)
epoch = pd.Timestamp('1970-01-01')
def build(x, tag):
    x = x.reset_index(drop=True)
    def dic(series):
        vals = list(dict.fromkeys(series.tolist())); ix = {v: i for i, v in enumerate(vals)}
        return vals, [ix[v] for v in series.tolist()]
    types, t = dic(x.order_type); prods, p = dic(x.product_short_name); cities, y = dic(x.shipping_city.fillna(''))
    users, c = dic(x.source_user_id)
    nm = x.dropna(subset=['shipping_name']).groupby('source_user_id').shipping_name.agg(lambda s: s.mode().iat[0])
    typ = x.groupby('source_user_id').order_type.agg(lambda s: 'b2b' in set(s))
    cust, st, k = [], [], 0
    for u in users:
        k += 1; real = nm.get(u, '')
        if typ[u]:
            name = 'Demo Store %04d' % k
            if norm(real) in oldst: st.append([name, oldst[norm(real)]])
        else: name = 'Demo Customer %04d' % k
        ph = '04%08d' % (10000000 + k)
        cust.append(['U%05d' % k, name, ph, [ph]])
    addrs = ['Address %d' % i for i in range(1)]
    dd = ((x.delivery_date - epoch).dt.days).tolist()
    return dict(v='sample-' + tag, n=len(x), dict=dict(type=types, prod=prods, city=cities, addr=addrs, cust=cust),
        d=dd, o=x.source_order_id.tolist(), i=x.order_item_id.tolist(), t=t, p=p, q=x.item_count.tolist(),
        a=[round(v, 2) for v in x.total_amount_display.tolist()], c=c, y=y, ad=[0] * len(x), st=st,
        w={}, meta=dict(sheetRows=len(x), rows=len(x), min=min(dd), max=max(dd), tab=tag))
for tag, x, fn in (('main', d[~d.inter], 'sample.json'), ('interstate', d[d.inter], 'sample-interstate.json')):
    json.dump(build(x, tag), open(outdir + '/' + fn, 'w'), separators=(',', ':')); print(fn, len(x), 'rows')
