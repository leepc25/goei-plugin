"""그림의 일부(창 x0..x0+w, y0..y0+h)를 잘라 마스크 영역만 PixelLab inpaint-v3로 다시 그려 되붙인다.
마스크: 창 안 좌표 (mx0, my0, mx1, my1) 사각형. right_diag가 주어지면 x < a + (b - y)*c 인 곳만 마스크.
사용: python3 fix_region.py <그림> <프롬프트> <출력> x0 y0 w h mx0 my0 mx1 my1 [a b c]"""
import base64, io, json, sys, time
import requests
from PIL import Image

API = "https://api.pixellab.ai/v2"
src, prompt_path, out_path = sys.argv[1:4]
x0, y0, w, h, mx0, my0, mx1, my1 = map(int, sys.argv[4:12])
diag = list(map(float, sys.argv[12:15])) if len(sys.argv) > 14 else None
im = Image.open(src).convert("RGBA")
win = im.crop((x0, y0, x0 + w, y0 + h))
mask = Image.new("RGB", (w, h), (0, 0, 0))
px = mask.load()
for y in range(my0, my1):
    for x in range(mx0, mx1):
        if diag is None or (x + x0) < diag[0] + (diag[1] - (y + y0)) * diag[2]:
            px[x, y] = (255, 255, 255)
mask.save(out_path.replace(".png", "_mask.png"))

def b64(img):
    buf = io.BytesIO(); img.save(buf, "PNG"); return base64.b64encode(buf.getvalue()).decode()

def balance():
    return requests.get(API + "/balance", timeout=30).json()["subscription"]["generations"]

b0 = balance()
body = {"description": open(prompt_path, encoding="utf-8").read().strip(),
        "inpainting_image": {"image": {"type": "base64", "base64": b64(win), "format": "png"}, "size": {"width": w, "height": h}},
        "mask_image": {"image": {"type": "base64", "base64": b64(mask), "format": "png"}, "size": {"width": w, "height": h}},
        "no_background": False}
t0 = time.time()
r = requests.post(API + "/inpaint-v3", json=body, timeout=60)
if r.status_code >= 300:
    print("error", r.status_code, r.text[:800]); sys.exit(1)
job = r.json()["background_job_id"]
while True:
    time.sleep(8)
    j = requests.get(f"{API}/background-jobs/{job}", timeout=30).json()
    if j.get("status") in ("completed", "failed"):
        break
if j["status"] != "completed":
    print("failed", json.dumps(j)[:800]); sys.exit(1)
lr = j["last_response"]
img = (lr.get("images") or [lr.get("image")])[0]
data = img["base64"] if isinstance(img, dict) else img
res = Image.open(io.BytesIO(base64.b64decode(data.split(",")[-1]))).convert("RGBA")
res.save(out_path.replace(".png", "_window.png"))
# 마스크 칸만 되붙임
m = mask.convert("L")
out = im.copy()
patch = Image.composite(res, win, m)
out.paste(patch, (x0, y0))
out.save(out_path)
print(json.dumps({"seconds": round(time.time() - t0, 1), "generations_used": round(b0 - balance(), 2)}))
