"""generate-image-v2로 투명 바탕 물체 한 장(no_background=True). 화풍 그림 = 확정 배경(1배).
사용: python3 object_v2.py <요청문.txt> <화풍배경.png> <출력.png> <가로> <세로> [x0 x1 화풍 자를 가로 범위]"""
import sys as _gs, pathlib as _gp
_gs.path.insert(0, str(next(p for p in _gp.Path(__file__).resolve().parents if (p / "tools" / "pixellab_gate.py").exists()) / "tools"))
import pixellab_gate as _gate  # noqa: E402
_gate.spend(__file__ + " 실행")
import base64, io, json, sys, time
import requests
from PIL import Image
API = "https://api.pixellab.ai/v2"
pp, sp, out, w, h = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
st = Image.open(sp).convert('RGB')
if len(sys.argv) > 7: st = st.crop((int(sys.argv[6]), 0, int(sys.argv[7]), st.height))
st.save(out.replace('.png', '_style.png'))
b = io.BytesIO(); st.save(b, 'PNG')
bal = lambda: requests.get(API + '/balance', timeout=30).json()['subscription']['generations']
b0 = bal(); t0 = time.time()
body = {"description": open(pp, encoding='utf-8').read().strip(), "image_size": {"width": w, "height": h}, "no_background": True,
        "style_image": {"image": {"type": "base64", "base64": base64.b64encode(b.getvalue()).decode(), "format": "png"},
                        "size": {"width": st.width, "height": st.height}}}
r = requests.post(API + '/generate-image-v2', json=body, timeout=60)
if r.status_code >= 300: print('error', r.status_code, r.text[:800]); sys.exit(1)
job = r.json()['background_job_id']; print('queued', job, flush=True)
while True:
    time.sleep(8)
    j = requests.get(f'{API}/background-jobs/{job}', timeout=30).json()
    if j.get('status') in ('completed', 'failed'): break
if j['status'] != 'completed': print('failed', json.dumps(j)[:800]); sys.exit(1)
img = j['last_response']['images'][0]; data = img['base64'] if isinstance(img, dict) else img
open(out, 'wb').write(base64.b64decode(data.split(',')[-1]))
print(json.dumps({"seconds": round(time.time() - t0, 1), "generations_used": round(b0 - bal(), 2)}))
