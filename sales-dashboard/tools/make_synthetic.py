"""Make a synthetic payload of N rows (same columnar format as the live API) from data/sample.json, for speed tests.
Usage: python3 tools/make_synthetic.py 500000 out.json   (copies of the sample with new order ids and new customers per copy)"""
import json, sys, numpy as np
N = int(sys.argv[1]); out = sys.argv[2]
p = json.load(open('data/sample.json')); n0 = p['n']; copies = -(-N // n0)
cols = ['d','o','i','t','p','q','a','c','y','ad']; A = {k: np.array(p[k]) for k in cols}
ncust = len(p['dict']['cust']); cust = list(p['dict']['cust'])
parts = {k: [] for k in cols}
for j in range(copies):
    for k in cols:
        v = A[k].copy()
        if k == 'o': v = v + j * 100000000
        if k == 'i': v = v + j * 100000000
        if k == 'c': v = v + j * ncust
        parts[k].append(v)
    if j:
        cust += [[str(int(c[0]) + j * 10000000) if str(c[0]).isdigit() else c[0] + '_' + str(j), c[1], c[2], c[3]] for c in p['dict']['cust']]
M = {k: np.concatenate(parts[k])[:N] for k in cols}
order = np.lexsort((M['i'], M['o'], M['d']))      # same order the server sorts: day, order id, line id
q = {k: M[k][order].tolist() for k in cols}
res = dict(p); res.update(q); res['n'] = N; res['dict'] = dict(p['dict']); res['dict']['cust'] = cust
res['meta'] = dict(p['meta']); res['meta']['rows'] = N; res['meta']['sheetRows'] = N
json.dump(res, open(out, 'w'), separators=(',', ':'))
print(out, N, 'rows', len(cust), 'customers')
