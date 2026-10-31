"""PixelLab inpaint-v3로 그림을 왼쪽으로 이어 그린다(사용자 10-31 중림 지상: 오른쪽 첫 장에서 왼쪽으로).
창 = [새 영역 new px | 앞 그림 왼쪽 keep px] (가로 최대 512), 새 영역만 흰 마스크. 결과 = 새 영역 + 앞 그림 전체.
사용: python3 extend_left.py <앞 그림> <프롬프트.txt> <출력(이어 붙인 전체)> <keep> <new> [겹쳐 다시 그릴 px]
겹침 px: 시험 1(v7)에서 새 칸만 덮었더니 이음 자리가 세로로 끊김 → 기존 그림 쪽으로도 그만큼 마스크를 덮어 섞이게 한다."""
import base64, io, json, sys, time
import requests
from PIL import Image
API = "https://api.pixellab.ai/v2"
src, prompt_path, out_path, keep, new = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
ov = int(sys.argv[6]) if len(sys.argv) > 6 else 0
# 위쪽만 더 넓게 다시 그리기(사용자 10-31: 처마 띠 이음선) — [위쪽 폭] [위쪽 높이]: 그 높이 위로는 위쪽 폭만큼 덮는다(간판·가게가 없는 2층·처마)
ov_top = int(sys.argv[7]) if len(sys.argv) > 7 else ov
top_h = int(sys.argv[8]) if len(sys.argv) > 8 else 0
im = Image.open(src).convert("RGBA")
w, h = keep + new, im.height
assert w <= 512 and h <= 512
win = Image.new("RGBA", (w, h), (255, 255, 255, 255))
win.paste(im.crop((0, 0, keep, h)), (new, 0))
mask = Image.new("RGB", (w, h), (0, 0, 0)); mask.paste((255, 255, 255), (0, 0, new + ov, h))
if top_h: mask.paste((255, 255, 255), (0, 0, new + ov_top, top_h))
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
out = Image.new("RGBA", (im.width + new, h)); out.paste(im, (new, 0)); out.paste(Image.composite(res.crop((0, 0, w, h)), win, mask.convert('L')).crop((0, 0, w, h)), (0, 0))
out.save(out_path)
print(json.dumps({"job": job, "seconds": round(time.time() - t0), "window": res.size, "out": out.size, "usage": j.get("usage") or lr.get("usage")}))
