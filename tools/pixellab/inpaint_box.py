"""PixelLab inpaint-v3로 배경의 네모 칸 하나만 다시 그린다(칸 안 옛 그림은 흰색으로 지우고 보냄).
사용: python3 inpaint_box.py <그림> <요청문.txt> <출력> <창x0> <x0> <y0> <x1> <y1>   (창 = x창x0부터 폭 min(512,끝), 높이 전체)
PREVIEW=<png> 이면 창·마스크만 저장하고 보내지 않는다. 결과는 칸 안만 새 그림으로 바꾼다(섞지 않음)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
if not os.environ.get("PREVIEW"):
    import pixellab_gate as _gate; _gate.spend(__file__ + " 실행")
import base64, io, json, time, subprocess
import requests
from PIL import Image
API = "https://api.pixellab.ai/v2"
src, prompt_path, out_path = sys.argv[1:4]; wx, x0, y0, x1, y1 = map(int, sys.argv[4:9])
if subprocess.call([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'prompt_diff.py'), prompt_path]) != 0: sys.exit('요청문 대조 실패')
im = Image.open(src).convert("RGBA"); h = im.height; w = min(512, im.width - wx)
win = im.crop((wx, 0, wx + w, h)).copy()
bx = (x0 - wx, y0, x1 - wx, y1)
win.paste((255, 255, 255, 255), bx)
mask = Image.new("RGB", (w, h)); mask.paste((255, 255, 255), bx)
if os.environ.get("PREVIEW"):
    sh = Image.new("RGB", (w, h * 2 + 8), (255, 0, 255)); sh.paste(win.convert("RGB"), (0, 0)); sh.paste(mask, (0, h + 8))
    sh.resize((w * 2, sh.height * 2), Image.NEAREST).save(os.environ["PREVIEW"]); sys.exit(0)
def b64(img):
    buf = io.BytesIO(); img.save(buf, "PNG"); return base64.b64encode(buf.getvalue()).decode()
body = {"description": open(prompt_path, encoding="utf-8").read().strip(),
        "inpainting_image": {"image": {"type": "base64", "base64": b64(win), "format": "png"}, "size": {"width": w, "height": h}},
        "mask_image": {"image": {"type": "base64", "base64": b64(mask), "format": "png"}, "size": {"width": w, "height": h}},
        "no_background": False}
r = requests.post(API + "/inpaint-v3", json=body, timeout=60)
if r.status_code >= 300: print("error", r.status_code, r.text[:800]); sys.exit(1)
job = r.json()["background_job_id"]
while True:
    time.sleep(8); j = requests.get(f"{API}/background-jobs/{job}", timeout=30).json()
    if j.get("status") in ("completed", "failed"): break
if j["status"] != "completed": print("failed", json.dumps(j)[:800]); sys.exit(1)
lr = j["last_response"]; img = (lr.get("images") or [lr.get("image")])[0]
data = img["base64"] if isinstance(img, dict) else img
res = Image.open(io.BytesIO(base64.b64decode(data.split(",")[-1]))).convert("RGBA")
res.save(out_path.replace(".png", "_window.png"))
out = im.copy(); out.paste(res.crop(bx), (x0, y0)); out.save(out_path)
print(json.dumps({"job": job, "box": [x0, y0, x1, y1], "usage": j.get("usage") or lr.get("usage")}))
