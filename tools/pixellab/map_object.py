"""PixelLab map-objects (주의: 배경+마스크 모드는 창 넓이 36,864px(192x192)까지 — 2026-11-01 422 거절): 확정 배경 일부(최대 400x400)를 보내고 마스크(흰=그릴 곳) 안에 배경 화풍·원근에 맞춘 물체를 투명 바탕으로 받는다.
사용: python3 map_object.py <배경.png> <요청문.txt> <출력접두> <창x0> <창y0> <창w> <창h> <네모들 "x0,y0,x1,y1;..." (배경 좌표)>"""
import sys as _gs, pathlib as _gp
_gs.path.insert(0, str(next(p for p in _gp.Path(__file__).resolve().parents if (p / "tools" / "pixellab_gate.py").exists()) / "tools"))
import pixellab_gate as _gate  # noqa: E402
_gate.spend(__file__ + " 실행")
import base64, io, json, os, sys, time
import requests
from PIL import Image, ImageDraw
API = "https://api.pixellab.ai/v2"
bgp, prompt_p, out = sys.argv[1], sys.argv[2], sys.argv[3]
wx, wy, ww, wh = map(int, sys.argv[4:8])
rects = [tuple(map(int, r.split(','))) for r in sys.argv[8].split(';')]
bg = Image.open(bgp).convert('RGB').crop((wx, wy, wx + ww, wy + wh))
mask = Image.new('RGB', (ww, wh), (0, 0, 0)); d = ImageDraw.Draw(mask)
for x0, y0, x1, y1 in rects: d.rectangle((x0 - wx, y0 - wy, x1 - wx - 1, y1 - wy - 1), fill=(255, 255, 255))
bg.save(out + '_window.png'); mask.save(out + '_mask.png')
b64 = lambda im: (lambda b: (im.save(b, 'PNG'), base64.b64encode(b.getvalue()).decode())[1])(io.BytesIO())
bal = lambda: requests.get(API + '/balance', timeout=30).json()['subscription']['generations']
b0 = bal()
body = {"description": open(prompt_p, encoding='utf-8').read().strip(), "image_size": {"width": ww, "height": wh},
        "view": os.environ.get('VIEW', 'low top-down'), "outline": "selective outline", "shading": "detailed shading", "detail": "high detail",
        "background_image": {"type": "base64", "base64": b64(bg), "format": "png"},
        "inpainting": {"type": "mask", "mask_image": {"type": "base64", "base64": b64(mask), "format": "png"}}}
t0 = time.time()
r = requests.post(API + '/map-objects', json=body, timeout=60)
if r.status_code >= 300: print('error', r.status_code, r.text[:800]); sys.exit(1)
j = r.json(); oid = j['object_id']; print('queued', oid, j.get('usage'))
while True:
    time.sleep(6)
    g = requests.get(f'{API}/map-objects/{oid}', timeout=30)
    if g.status_code == 200: break
    if g.status_code in (404, 410): print('failed', g.status_code, g.text[:500]); sys.exit(1)
meta = g.json(); url = meta.get('download_url') or meta.get('url')
img = requests.get(url, timeout=60).content if url else None
if img is None: print(json.dumps(meta)[:800]); sys.exit(1)
open(out + '.png', 'wb').write(img)
print(json.dumps({"seconds": round(time.time() - t0, 1), "generations_used": round(b0 - bal(), 2), "meta_keys": list(meta.keys())}))
