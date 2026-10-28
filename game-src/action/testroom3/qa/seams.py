"""이음새 검사(10-29 사용자: 걷기·달리기·동작 사이가 뚝뚝 끊김): 반복 줄의 끝→첫 장, 줄 전환의 끝→첫 장을 바닥·가운데 맞춰 마스크 차이 비율로.
  python3 qa/seams.py [문턱=0.35]  → 쌍별 통계와 최악 목록"""
import json, glob, base64, io, statistics, collections, sys
import numpy as np
from PIL import Image
THR = float(sys.argv[1]) if len(sys.argv) > 1 else 0.35
def frames(a):
    im = Image.open(io.BytesIO(base64.b64decode(a['src'].split(',', 1)[1]))).convert('RGBA'); m = np.array(im)[:, :, 3] > 40
    return [m[:, i * a['cw']:(i + 1) * a['cw']] for i in range(a['n'])]
def place(a, m, f):
    """몸 가운데(cx)·발 바닥(bot)을 맞춰 700×700 캔버스에"""
    cv = np.zeros((700, 700), bool); H, W = m.shape
    x0 = 350 - int(a['cx'][f] + a['w'] / 2 - a['ox']); y0 = 600 - int(a['bot'][f] - a['oy'])
    x0 = max(0, min(700 - W, x0)); y0 = max(0, min(700 - H, y0)); cv[y0:y0 + H, x0:x0 + W] = m; return cv
def diff(a1, m1, f1, a2, m2, f2):
    A = place(a1, m1[f1], f1); B = place(a2, m2[f2], f2); u = (A | B).sum(); return (A ^ B).sum() / u if u else 0
PAIRS = [('4', -1, '4', 0), ('5', -1, '5', 0), ('1', -1, '1', 0), ('3', -1, '3', 0), ('3_0', -1, '3', 0), ('9', -1, '3', 0), ('10', -1, '3', 0), ('11', -1, '3', 0), ('12', -1, '3', 0), ('16', -1, '3', 0), ('17', -1, '3', 0), ('18', -1, '3', 0), ('20', -1, '1', 0), ('W', -1, 'W_1', 0), ('W_1', -1, 'W_1', 0), ('23', -1, '24', 0), ('42', -1, '42_1', 0), ('38', -1, '38_1', 0), ('37', -1, '37_1', 0), ('9', -1, '10', 0), ('10', -1, '11', 0), ('11', -1, '12', 0)]
res = collections.defaultdict(list)
for p in sorted(glob.glob('.cache/*.json')):
    c = json.load(open(p)); key = p.split('/')[-1][:-5]; A = c['A']; cache = {}
    def F(l):
        if l not in cache: cache[l] = frames(A[l])
        return cache[l]
    for l1, f1, l2, f2 in PAIRS:
        if l1 not in A or l2 not in A: continue
        a1, a2 = A[l1], A[l2]
        res[(l1, l2)].append((key, round(diff(a1, F(l1), f1 if f1 >= 0 else a1['n'] + f1, a2, F(l2), f2), 2)))
for k, v in res.items():
    v.sort(key=lambda t: -t[1]); d = [x for _, x in v]
    print(k, 'n', len(v), 'median', round(statistics.median(d), 2), f'>={THR}:', sum(1 for x in d if x >= THR), 'worst', v[:5])
