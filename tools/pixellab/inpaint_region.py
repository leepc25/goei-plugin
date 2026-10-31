"""그림 일부만 PixelLab inpaint-v3로 다시 그린다(사용자 10-31 지상 지하상가 출입구 축소).
창 = 원본의 [wx0, wx0+512) × 전체 높이(≤512), 마스크 = 사각형(원본 좌표) 안만 흰색. 결과는 마스크 안만 원본에 붙인다.
사용: python3 inpaint_region.py <원본> <프롬프트.txt> <출력> <wx0> <mx0> <my0> <mx1> <my1>
     또는 <wx0> 다음에 사각형 여러 개 "x0,y0,x1,y1" (건물 경계를 따라 계단 모양으로 자를 때, 사용자 10-31 「자를려면 확실하게」)"""
import base64, io, json, sys, time
import requests
from PIL import Image
API = "https://api.pixellab.ai/v2"
src, prompt_path, out_path = sys.argv[1:4]
wx0 = int(sys.argv[4])
rects = [tuple(map(int, a.split(','))) for a in sys.argv[5:]] if ',' in sys.argv[5] else [tuple(map(int, sys.argv[5:9]))]
im = Image.open(src).convert("RGBA")
w, h = min(512, im.width - wx0), im.height
assert h <= 512
win = im.crop((wx0, 0, wx0 + w, h))
mask = Image.new("RGB", (w, h), (0, 0, 0))
for mx0, my0, mx1, my1 in rects: mask.paste((255, 255, 255), (mx0 - wx0, my0, mx1 - wx0, my1))
def b64(img):
    buf = io.BytesIO(); img.save(buf, "PNG"); return base64.b64encode(buf.getvalue()).decode()
body = {"description": open(prompt_path, encoding="utf-8").read().strip(),
        "inpainting_image": {"image": {"type": "base64", "base64": b64(win), "format": "png"}, "size": {"width": w, "height": h}},
        "mask_image": {"image": {"type": "base64", "base64": b64(mask), "format": "png"}, "size": {"width": w, "height": h}},
        "no_background": False}
t0 = time.time()
r = requests.post(API + "/inpaint-v3", json=body, timeout=60)
if r.status_code >= 300: print("error", r.status_code, r.text[:800]); sys.exit(1)
job = r.json()["background_job_id"]
while True:
    time.sleep(8)
    j = requests.get(f"{API}/background-jobs/{job}", timeout=30).json()
    if j.get("status") in ("completed", "failed"): break
if j["status"] != "completed": print("failed", json.dumps(j)[:800]); sys.exit(1)
lr = j["last_response"]
img = (lr.get("images") or [lr.get("image")])[0]
data = img["base64"] if isinstance(img, dict) else img
res = Image.open(io.BytesIO(base64.b64decode(data.split(",")[-1]))).convert("RGBA")
res.save(out_path.replace(".png", "_window.png"))
out = im.copy(); out.paste(Image.composite(res, win, mask.convert('L')), (wx0, 0))
out.save(out_path)
print(json.dumps({"job": job, "seconds": round(time.time() - t0), "window": res.size, "usage": j.get("usage") or lr.get("usage")}))
