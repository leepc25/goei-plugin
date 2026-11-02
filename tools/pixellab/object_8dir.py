"""PixelLab create-8-direction-object: 투명 바탕 물체 8방향 한 번에(10~25회). 화풍 그림(style_image) 크기 = 출력 크기(24~168 정사각).
사용: python3 object_8dir.py <요청문.txt> <화풍.png> <출력폴더> [view=low top-down]"""
import sys as _gs, pathlib as _gp
_gs.path.insert(0, str(next(p for p in _gp.Path(__file__).resolve().parents if (p / "tools" / "pixellab_gate.py").exists()) / "tools"))
import pixellab_gate as _gate  # noqa: E402
_gate.spend(__file__ + " 실행")
import base64, json, os, sys, time
import requests
API = "https://api.pixellab.ai/v2"
prompt_p, stp, outd = sys.argv[1], sys.argv[2], sys.argv[3]
view = sys.argv[4] if len(sys.argv) > 4 else 'low top-down'
os.makedirs(outd, exist_ok=True)
bal = lambda: requests.get(API + '/balance', timeout=30).json()['subscription']['generations']
b0 = bal(); t0 = time.time()
body = {"description": open(prompt_p, encoding='utf-8').read().strip(), "view": view,
        "style_image": {"type": "base64", "base64": base64.b64encode(open(stp, 'rb').read()).decode(), "format": "png"}}
r = requests.post(API + '/create-8-direction-object', json=body, timeout=60)
if r.status_code >= 300: print('error', r.status_code, r.text[:800]); sys.exit(1)
oid = r.json()['object_id']; print('queued', oid, flush=True)
while True:
    time.sleep(8)
    g = requests.get(f'{API}/objects/{oid}', timeout=30)
    if g.status_code != 200: continue
    m = g.json(); stt = m.get('status')
    if stt in ('completed', 'review', 'failed'): break
json.dump(m, open(os.path.join(outd, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
if stt == 'failed': print('failed', json.dumps(m)[:600]); sys.exit(1)
rot = m.get('rotation_urls') or {}
items = list(rot.items()) or [(str(i), u) for i, u in enumerate(m.get('frame_urls') or [])]
for k, u in items:
    if u: open(os.path.join(outd, f'{k}.png'), 'wb').write(requests.get(u, timeout=60).content)
print(json.dumps({"object_id": oid, "status": stt, "files": [k for k, _ in items], "seconds": round(time.time() - t0, 1), "generations_used": round(b0 - bal(), 2)}))
