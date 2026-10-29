"""PixelLab inpaint-v3로 그림을 오른쪽으로 이어 그린다. 앞 그림 오른쪽 keep px + 새 영역 new px를 한 창(최대 512)에 넣고 새 영역만 마스크.
사용: python3 extend_right.py <앞 그림> <프롬프트.txt> <출력(이어 붙인 전체)> <keep> <new>"""
import base64, io, json, sys, time
import requests
from PIL import Image

API = "https://api.pixellab.ai/v2"
src, prompt_path, out_path, keep, new = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
im = Image.open(src).convert("RGBA")
w, h = keep + new, im.height
win = Image.new("RGBA", (w, h), (255, 255, 255, 255))
win.paste(im.crop((im.width - keep, 0, im.width, h)), (0, 0))
mask = Image.new("RGB", (w, h), (0, 0, 0))
mask.paste((255, 255, 255), (keep, 0, w, h))

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
out = Image.new("RGBA", (im.width + new, h))
out.paste(im, (0, 0))
out.paste(res.crop((keep, 0, w, h)), (im.width, 0))
out.save(out_path)
print(json.dumps({"seconds": round(time.time() - t0, 1), "window": res.size, "out": out.size, "generations_used": round(b0 - balance(), 2)}))
