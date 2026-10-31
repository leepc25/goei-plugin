"""오른쪽 연장 + 끝 옆벽 고정: 앞 그림을 cut까지 자르고, 창 = [기존 keep px | 새 영역 | 왼쪽 옆벽 거울상(side px)].
옆벽은 보존(검은 마스크)하되 옆벽의 문 칸만 다시 그리게 한다.
사용: python3 extend_custom.py <앞 그림> <프롬프트> <출력> <cut> <keep> <new> <side> <문x0> <문x1> <문y0> <문y1>"""
# --- PixelLab 생성 승인 문 (2026-10-31 사용자: 시키지 않은 생성 금지) — 이 파일의 모든 생성 요청은 .pixellab_ok 회수가 있어야 나간다
import sys as _gs, pathlib as _gp
_gs.path.insert(0, str(next(p for p in _gp.Path(__file__).resolve().parents if (p / "tools" / "pixellab_gate.py").exists()) / "tools"))
import pixellab_gate as _gate  # noqa: E402
_gate.spend(__file__ + " 실행")
# ---
import base64, io, json, sys, time
import requests
from PIL import Image, ImageOps

API = "https://api.pixellab.ai/v2"
src, prompt_path, out_path = sys.argv[1:4]
cut, keep, new, side, dx0, dx1, dy0, dy1 = map(int, sys.argv[4:12])
im = Image.open(src).convert("RGBA").crop((0, 0, cut, 444))
h = im.height
w = keep + new + side
assert w <= 512
sidewall = ImageOps.mirror(im.crop((0, 0, side, h)))
win = Image.new("RGBA", (w, h), (255, 255, 255, 255))
win.paste(im.crop((cut - keep, 0, cut, h)), (0, 0))
win.paste(sidewall, (keep + new, 0))
mask = Image.new("RGB", (w, h), (0, 0, 0))
mask.paste((255, 255, 255), (keep, 0, keep + new, h))
# 옆벽 문 칸(왼쪽 옆벽 기준 좌표를 거울로 옮김)
mx0, mx1 = keep + new + (side - dx1), keep + new + (side - dx0)
mask.paste((255, 255, 255), (mx0, dy0, mx1, dy1))
win.save(out_path.replace(".png", "_input.png")); mask.save(out_path.replace(".png", "_mask.png"))

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
out = Image.new("RGBA", (cut + new + side, h))
out.paste(im, (0, 0))
out.paste(res.crop((keep, 0, w, h)), (cut, 0))
out.save(out_path)
print(json.dumps({"seconds": round(time.time() - t0, 1), "out": out.size, "generations_used": round(b0 - balance(), 2)}))
