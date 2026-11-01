"""PixelLab create-1-direction-object: 투명 바탕 물체 1장. 화풍 그림 = 배경 일부(최대 256x256, 출력 크기도 이것으로 정해짐).
사용: python3 object_1dir.py <요청문.txt> <출력.png> <화풍배경.png> <x0> <y0> <크기> [view]"""
import sys as _gs, pathlib as _gp
_gs.path.insert(0, str(next(p for p in _gp.Path(__file__).resolve().parents if (p / "tools" / "pixellab_gate.py").exists()) / "tools"))
import pixellab_gate as _gate  # noqa: E402
_gate.spend(__file__ + " 실행")
import base64, io, json, sys, time
import requests
from PIL import Image
API = "https://api.pixellab.ai/v2"
prompt_p, out, stp = sys.argv[1], sys.argv[2], sys.argv[3]
x0, y0, sz = map(int, sys.argv[4:7]); view = sys.argv[7] if len(sys.argv) > 7 else 'sidescroller'
st = Image.open(stp).convert('RGB').crop((x0, y0, x0 + sz, y0 + sz)); st.save(out.replace('.png', '_style.png'))
b = io.BytesIO(); st.save(b, 'PNG')
bal = lambda: requests.get(API + '/balance', timeout=30).json()['subscription']['generations']
b0 = bal(); t0 = time.time()
body = {"description": open(prompt_p, encoding='utf-8').read().strip(), "view": view,
        "style_images": [{"type": "base64", "base64": base64.b64encode(b.getvalue()).decode(), "format": "png"}]}
r = requests.post(API + '/create-1-direction-object', json=body, timeout=60)
if r.status_code >= 300: print('error', r.status_code, r.text[:800]); sys.exit(1)
j = r.json(); oid = j['object_id']; print('queued', oid, flush=True)
while True:
    time.sleep(8)
    g = requests.get(f'{API}/objects/{oid}', timeout=30)
    if g.status_code != 200: continue
    m = g.json(); stt = m.get('status')
    if stt in ('completed', 'review', 'failed'): break
if stt == 'failed': print('failed', json.dumps(m)[:600]); sys.exit(1)
urls = [u for u in (m.get('frame_urls') or []) if u] or [u for u in (m.get('rotation_urls') or {}).values() if u] or list((m.get('storage_urls') or {}).values())
for i, u in enumerate(urls):
    open(out if i == 0 else out.replace('.png', f'_{i}.png'), 'wb').write(requests.get(u, timeout=60).content)
print(json.dumps({"object_id": oid, "status": stt, "files": len(urls), "seconds": round(time.time() - t0, 1), "generations_used": round(b0 - bal(), 2)}))
