"""진압팀 사무실(office_riot) 색 (2026-11-02 사용자): 09:04~09:11 「B안, 책상만 배경톤이랑 어울리게」 → 「2번으로」.
배경 = B(나무색 가구 → 청회색 철제, 파란 회색 벽·바닥 → 베이지 회색). 밝은 곳(하늘·모니터·종이, V>0.82)과
골판지 상자(나무색 중 밝은 것, V>0.58)는 원래 색. 책상 상판 = 2번 베이지 회색(나무색만, 빨간 펜 등 붉은색 제외). 의자는 그대로.
사용: python3 tools/mapedit/recolor_office_riot.py [확인그림]  (author_hq_office.py SCENE=office_riot 다음에)"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
D = Path(__file__).resolve().parents[2] / 'game-src/mapedit/office_riot'
def hsv2rgb(h, s, v):
    out = np.zeros(h.shape + (3,)); i = np.floor(h * 6).astype(int) % 6; f = h * 6 - np.floor(h * 6)
    p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s)
    for k, (x, y, z) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        m = i == k; out[m] = np.stack([x[m], y[m], z[m]], -1)
    return out
def parts(im):
    rgb = im.convert('RGB'); a = np.asarray(rgb).astype(float) / 255
    mx = a.max(2); mn = a.min(2); S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    H = np.asarray(rgb.convert('HSV')).astype(float)[..., 0] / 255
    return a, H, S, mx
# 배경
src = Image.open(D / 'hq_office_strip.png'); a, H, S, V = parts(src)
keep = V > 0.82
wood = ((H < 0.14) | (H > 0.97)) & (S > 0.22) & ~keep & (V <= 0.58)
cool = (H > 0.50) & (H < 0.70) & (S > 0.06) & (S < 0.45) & ~keep
o = a.copy()
o[wood] = hsv2rgb(np.full(wood.sum(), 0.58), np.clip(S[wood] * 0.55, 0, 1), np.clip(V[wood] * 0.95, 0, 1))
o[cool] = hsv2rgb((0.10 + (H[cool] - 0.6)) % 1, np.clip(S[cool] * 0.9, 0, 1), V[cool])
Image.fromarray((o * 255).astype('uint8')).save(D / 'hq_office_strip.png')
# 책상(의자 빼고)
m = json.loads((D / 'map.json').read_text())
for ob in m['objects']:
    if ob['kind'] == 'chair': continue
    im = Image.open(D / ob['file']).convert('RGBA'); a, H, S, V = parts(im); al = np.asarray(im)[..., 3]
    w = (H > 0.03) & (H < 0.14) & (S > 0.22) & (V <= 0.82) & (al > 0)
    o = a.copy(); o[w] = hsv2rgb(np.full(w.sum(), 0.10), S[w] * 0.35, np.clip(V[w] * 1.12, 0, 1))
    Image.fromarray(np.dstack([(o * 255).astype('uint8'), al]), 'RGBA').save(D / ob['file'])
if len(sys.argv) > 1:
    bg = Image.open(D / 'hq_office_strip.png').convert('RGBA')
    for ob in sorted(m['objects'], key=lambda o: o['sortY']): bg.alpha_composite(Image.open(D / ob['file']).convert('RGBA'), (ob['x'], ob['y']))
    bg.convert('RGB').save(sys.argv[1])
