"""쓰러짐 줄을 방(room.html groundBase)과 같은 바닥 기준으로 늘어놓아 떠 보이는지 확인: 빨간 선 = 땅(P.y), 타원 = 그림자 자리.
  python3 game-src/action/testroom3/qa/fall_sheet.py <키> <줄> <out.png>"""
import sys, json, base64, io
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
HERE = Path(__file__).resolve().parents[1]
key, lid, out = sys.argv[1:4]
FLAT = {'19', '20', '38', '38_1', '43', '45'}; LIE = {'20', '38', '38_1', '39', '40', '41', '42', '42_1', '43', '45'}; FALLS = {'18_3', '44', '75', '76', '77'}
def lowF(a, f): return (a['bot'][f] - a['top'][f]) < 0.55 * (a['bot'][0] - a['top'][0])
def lieFrom(a): return a['bot'].index(min(a['bot'])) + 1
def base(lid, a, f):
    BASE = min(a['h'] - 4, a['floor']); mb = a.get('mbot')
    if lid in FALLS: return (mb[f] + 3) if (lowF(a, f) and mb) else min(BASE, a['bot'][f] + 2)
    if lid in LIE or (lid == '19' and f >= lieFrom(a)): return (mb[f] + 3) if (lid in FLAT and mb) else a['bot'][f] + 2
    return BASE
c = json.load(open(HERE / f'.cache/{key}.json')); a = c['A'][lid]
im = Image.open(io.BytesIO(base64.b64decode(a['src'].split(',', 1)[1]))).convert('RGBA')
W, H = a['cw'], a['ch']; GY = 300
S = Image.new('RGB', (W * a['n'], GY + 60), (60, 60, 64)); d = ImageDraw.Draw(S)
for f in range(a['n']):
    fr = im.crop((f * W, 0, (f + 1) * W, H)); b = base(lid, a, f) - a['oy']   # 시트는 공통 상자(oy 만큼 잘림)
    x0 = f * W; y0 = GY - int(b)
    d.ellipse([x0 + W // 2 - 40, GY - 8, x0 + W // 2 + 40, GY + 8], fill=(30, 30, 34))
    S.paste(fr, (x0, y0), fr)
    d.line([(x0, GY), (x0 + W, GY)], fill=(255, 60, 60)); d.line([(x0, 0), (x0, S.height)], fill=(90, 90, 90))
    d.text((x0 + 2, 2), f"{f + 1} b={base(lid, a, f)} bot={a['bot'][f]} mbot={(a.get('mbot') or [0]*99)[f]}", fill=(255, 255, 255))
d.text((2, S.height - 12), f"{key} {lid} h={a['h']} floor={a['floor']} lieFrom={lieFrom(a)}", fill=(255, 255, 0))
S.save(out); print(out)
