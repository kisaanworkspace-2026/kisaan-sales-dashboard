"""Encode the sample xlsx into the same columnar JSON the Apps Script API returns.
usage: python3 -I build_sample.py input.xlsx ../data/sample.json"""
import sys, json, pandas as pd
src, out = sys.argv[1], sys.argv[2]
d = pd.read_excel(src)
d = d.sort_values(['delivery_date','source_order_id','order_item_id'], kind='stable').reset_index(drop=True)
def dic(series):
    vals = list(dict.fromkeys(series.tolist())); ix = {v:i for i,v in enumerate(vals)}
    return vals, [ix[v] for v in series.tolist()]
types, t = dic(d.order_type)
prods, p = dic(d.product_short_name)
cities, y = dic(d.shipping_city.fillna(''))
addrs, ad = dic(d.shipping_address_line_1.fillna(''))
# customers keyed by phone; name = first non-empty name seen
nm = d.dropna(subset=['shipping_name']).groupby('shipping_primary_phone').shipping_name.agg(lambda s: s.mode().iat[0])
phones, c = dic(d.shipping_primary_phone)
cust = [[int(ph), nm.get(ph, '')] for ph in phones]
epoch = pd.Timestamp('1970-01-01')
days = ((d.delivery_date - epoch).dt.days).tolist()
payload = dict(v='sample', n=len(d),
  dict=dict(type=types, prod=prods, city=cities, addr=addrs, cust=cust),
  d=days, o=d.source_order_id.tolist(), i=d.order_item_id.tolist(), t=t, p=p, q=d.item_count.tolist(),
  a=[round(x,2) for x in d.total_amount_display.tolist()], c=c, y=y, ad=ad)
json.dump(payload, open(out,'w'), separators=(',',':'))
print(len(d), 'rows ->', out)
