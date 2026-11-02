"""준비된 창(input.png, 마스크 칸은 흰색)·마스크(mask.png)로 inpaint-v3 1회. 결과 창을 원본 배경에 되붙여 전체 그림도 저장.
사용: python3 inpaint_spot.py <요청문.txt> <input.png> <mask.png> <원본배경.png> <WX0> <출력.png>"""
import sys as _gs, pathlib as _gp
_gs.path.insert(0, str(next(p for p in _gp.Path(__file__).resolve().parents if (p / "tools" / "pixellab_gate.py").exists()) / "tools"))
import pixellab_gate as _gate  # noqa: E402
_gate.spend(__file__ + " 실행")
import base64, io, json, sys, time
import requests
from PIL import Image
API = "https://api.pixellab.ai/v2"
pp, ip, mp, bgp, wx0, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5]), sys.argv[6]
win = Image.open(ip).convert("RGBA"); mask = Image.open(mp).convert("RGB"); bg = Image.open(bgp).convert("RGBA")
def b64(img):
    buf = io.BytesIO(); img.save(buf, "PNG"); return base64.b64encode(buf.getvalue()).decode()
bal = lambda: requests.get(API + "/balance", timeout=30).json()["subscription"]["generations"]
b0 = bal(); t0 = time.time()
body = {"description": open(pp, encoding="utf-8").read().strip(),
        "inpainting_image": {"image": {"type": "base64", "base64": b64(win), "format": "png"}, "size": {"width": win.width, "height": win.height}},
        "mask_image": {"image": {"type": "base64", "base64": b64(mask), "format": "png"}, "size": {"width": mask.width, "height": mask.height}},
        "no_background": False}
r = requests.post(API + "/inpaint-v3", json=body, timeout=60)
if r.status_code >= 300: print("error", r.status_code, r.text[:800]); sys.exit(1)
job = r.json()["background_job_id"]; print("queued", job, flush=True)
while True:
    time.sleep(8); j = requests.get(f"{API}/background-jobs/{job}", timeout=30).json()
    if j.get("status") in ("completed", "failed"): break
if j["status"] != "completed": print("failed", json.dumps(j)[:800]); sys.exit(1)
lr = j["last_response"]; img = (lr.get("images") or [lr.get("image")])[0]; data = img["base64"] if isinstance(img, dict) else img
res = Image.open(io.BytesIO(base64.b64decode(data.split(",")[-1]))).convert("RGBA")
res.save(out.replace(".png", "_window.png"))
full = bg.copy(); full.paste(res, (wx0, 0)); full.save(out)
print(json.dumps({"seconds": round(time.time() - t0, 1), "generations_used": round(b0 - bal(), 2)}))
