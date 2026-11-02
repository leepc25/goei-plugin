# 통합창 UI 조각 한 장 (11-01): 창 테두리·안쪽 판·탭 2개·빈 퍽 자리를 한 장에. 「뽑아」 1회분만.
import sys, pathlib, json, urllib.request, time, base64, os
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[4] / "tools"))
import pixellab_gate as gate
API = "https://api.pixellab.ai/v2"
OUT = os.path.dirname(os.path.abspath(__file__))
body = {
  "description": "clean simple pixel art game UI kit sheet, flat rectangular dark navy panels with thin silver rims: one window frame, one inner panel, two tab buttons (active and inactive), one empty round badge socket. No text. Everything else is up to you.",
  "image_size": {"width": 512, "height": 256}, "no_background": True,
}
def post(p, b):
    r = urllib.request.Request(API + p, data=json.dumps(b).encode(), headers={"Content-Type": "application/json", "Authorization": "Bearer x"})
    return json.load(urllib.request.urlopen(r, timeout=90))
def get(p):
    return json.load(urllib.request.urlopen(urllib.request.Request(API + p, headers={"Authorization": "Bearer x"}), timeout=60))
gate.spend("통합창 UI 조각 512x256 generate-ui-v2")
res = post("/generate-ui-v2", body); print("sent", json.dumps(res)[:300], flush=True)
jid = res.get("background_job_id")
for _ in range(240):
    time.sleep(5)
    r = get(f"/background-jobs/{jid}")
    if r.get("status") in ("completed", "failed", "error"): break
json.dump(r, open(f"{OUT}/kit_job.json", "w"))
imgs = (r.get("last_response") or {}).get("images") or []
for i, im in enumerate(imgs):
    b = im.get("base64") if isinstance(im, dict) else im
    if "," in b[:40]: b = b.split(",", 1)[1]
    open(f"{OUT}/kit_{i}.png", "wb").write(base64.b64decode(b))
print("DONE", r.get("status"), len(imgs), json.dumps(r.get("usage") or (r.get("last_response") or {}).get("billing_usage") or {}), flush=True)
