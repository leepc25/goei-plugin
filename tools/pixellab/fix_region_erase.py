"""fix_region.py + 승인 문(.pixellab_ok) + 마스크 칸 지우고 보내기(ERASE) + PREVIEW. 물건 지우기용(사용자 11-01: 칸을 지우고 보내고 없앨 물건 이름은 요청문에 안 씀).
사용: python3 fix_region_erase.py <그림> <프롬프트> <출력> x0 y0 w h mx0 my0 mx1 my1"""
import sys as _gs, pathlib as _gp, os
_gs.path.insert(0, str(next(p for p in _gp.Path(__file__).resolve().parents if (p / "tools" / "pixellab_gate.py").exists()) / "tools"))
import pixellab_gate as _gate
import base64, io, json, time, requests
from PIL import Image
API = "https://api.pixellab.ai/v2"
src, prompt_path, out_path = sys.argv[1:4] if False else _gs.argv[1:4]
x0, y0, w, h, mx0, my0, mx1, my1 = map(int, _gs.argv[4:12])
im = Image.open(src).convert("RGBA"); win = im.crop((x0, y0, x0 + w, y0 + h))
mask = Image.new("RGB", (w, h), (0, 0, 0)); mask.paste((255, 255, 255), (mx0, my0, mx1, my1))
send = win.copy(); send.paste((255, 255, 255, 255), (mx0, my0, mx1, my1))
if os.environ.get("PREVIEW"):
    sh = Image.new("RGB", (w, h * 2 + 8), (255, 0, 255)); sh.paste(send.convert("RGB"), (0, 0)); sh.paste(mask, (0, h + 8))
    sh.resize((w * 2, sh.height * 2), Image.NEAREST).save(os.environ["PREVIEW"]); _gs.exit(0)
_gate.spend(__file__ + " 실행")
def b64(img):
    buf = io.BytesIO(); img.save(buf, "PNG"); return base64.b64encode(buf.getvalue()).decode()
body = {"description": open(prompt_path, encoding="utf-8").read().strip(),
        "inpainting_image": {"image": {"type": "base64", "base64": b64(send), "format": "png"}, "size": {"width": w, "height": h}},
        "mask_image": {"image": {"type": "base64", "base64": b64(mask), "format": "png"}, "size": {"width": w, "height": h}},
        "no_background": False}
t0 = time.time(); r = requests.post(API + "/inpaint-v3", json=body, timeout=60)
if r.status_code >= 300: print("error", r.status_code, r.text[:800]); _gs.exit(1)
job = r.json()["background_job_id"]
while True:
    time.sleep(8); j = requests.get(f"{API}/background-jobs/{job}", timeout=30).json()
    if j.get("status") in ("completed", "failed"): break
if j["status"] != "completed": print("failed", json.dumps(j)[:800]); _gs.exit(1)
lr = j["last_response"]; img = (lr.get("images") or [lr.get("image")])[0]
data = img["base64"] if isinstance(img, dict) else img
res = Image.open(io.BytesIO(base64.b64decode(data.split(",")[-1]))).convert("RGBA")
res.save(out_path.replace(".png", "_window.png"))
out = im.copy(); out.paste(Image.composite(res, win, mask.convert("L")), (x0, y0)); out.save(out_path)
print(json.dumps({"job": job, "seconds": round(time.time() - t0), "usage": j.get("usage") or lr.get("usage")}))
