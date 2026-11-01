# 랭크 별 16안(16x16 generate-image-v2) 1회. 사용자 11:51 「뽑아」. 고른 별을 토큰 테두리 위에 겹치고 동·금은 코드로.
import sys, pathlib, json, urllib.request, time, base64, os
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[4] / "tools"))
import pixellab_gate as gate
from PIL import Image
API = "https://api.pixellab.ai/v2"; OUT = os.path.dirname(os.path.abspath(__file__))
body = {"description": "pixel art icon, single silver 3D star, beveled, shading, silver only, no text", "image_size": {"width": 16, "height": 16}, "no_background": True}
def post(p, b):
    r = urllib.request.Request(API + p, data=json.dumps(b).encode(), headers={"Content-Type": "application/json", "Authorization": "Bearer x"})
    return json.load(urllib.request.urlopen(r, timeout=90))
def get(p): return json.load(urllib.request.urlopen(urllib.request.Request(API + p, headers={"Authorization": "Bearer x"}), timeout=60))
gate.spend("랭크 별 16x16 generate-image-v2")
res = post("/generate-image-v2", body); print("sent", json.dumps(res)[:300], flush=True)
jid = res.get("background_job_id")
for _ in range(240):
    time.sleep(4); r = get(f"/background-jobs/{jid}")
    if r.get("status") in ("completed", "failed", "error"): break
imgs = (r.get("last_response") or r.get("result") or r).get("images") or []
for i, im in enumerate(imgs):
    b = im.get("base64") if isinstance(im, dict) else im
    if "," in b[:40]: b = b.split(",", 1)[1]
    open(f"{OUT}/star_{i}.png", "wb").write(base64.b64decode(b))
for im in imgs:
    if isinstance(im, dict): im.pop("base64", None)
json.dump(r, open(f"{OUT}/star_job.json", "w"), ensure_ascii=False)
print("DONE", r.get("status"), len(imgs), json.dumps(r.get("usage") or {}), flush=True)
