"""장면에서 잘라 낸 칸을 animate-pixminimax로 움직이기(처음·끝 장 = 원본). 11-09 망상홈쇼핑.
사용: python3 tools/pixellab/gen_anim_req.py <req.json> <out_dir>  — 승인 문(.pixellab_ok) 1회 씀
req.json: {"crop_src":..., "box":[x0,y0,x1,y1], "description":..., "frame_count":..., 그 밖 API 칸}"""
import sys, json, base64, time, io, os, requests
from PIL import Image
sys.path.insert(0, '/home/user/goei-plugin/tools')
import pixellab_gate as g
req, out = sys.argv[1:3]
spec = json.load(open(req))
im = Image.open(spec.pop("crop_src")).convert("RGBA").crop(tuple(spec.pop("box")))
buf = io.BytesIO(); im.save(buf, "PNG"); b64 = base64.b64encode(buf.getvalue()).decode()
frame = {"type": "base64", "base64": b64, "format": "png"}
body = dict(spec, first_frame=frame, last_frame=frame)
g.spend("동작 클립 1개 " + req)
API = "https://api.pixellab.ai/v2"
c0 = requests.get(API + "/balance", timeout=30).json()["credits"]["usd"]
r = requests.post(API + "/animate-pixminimax", json=body, timeout=60)
if r.status_code >= 300: print("error", r.status_code, r.text[:500]); sys.exit(1)
job = r.json()["background_job_id"]
while True:
    time.sleep(10); j = requests.get(f"{API}/background-jobs/{job}", timeout=30).json()
    if j.get("status") in ("completed", "failed"): break
if j["status"] != "completed": print("failed", json.dumps(j)[:800]); sys.exit(1)
os.makedirs(out, exist_ok=True)
for i, img in enumerate(j["last_response"]["images"]):
    d = img["base64"] if isinstance(img, dict) else img
    open(f"{out}/f{i:02d}.png", "wb").write(base64.b64decode(d.split(",")[-1]))
print("frames", len(j["last_response"]["images"]), "credits used", round(c0 - requests.get(API + "/balance", timeout=30).json()["credits"]["usd"], 3))
