"""PixelLab inpaint-v3로 그림을 왼쪽으로 이어 그린다(사용자 10-31 중림 지상: 오른쪽 첫 장에서 왼쪽으로).
창 = [새 영역 new px | 앞 그림 왼쪽 keep px] (가로 최대 512), 새 영역만 흰 마스크. 결과 = 새 영역 + 앞 그림 전체.
사용: python3 extend_left.py <앞 그림> <프롬프트.txt> <출력(이어 붙인 전체)> <keep> <new> [겹쳐 다시 그릴 px]
겹침 px: 시험 1(v7)에서 새 칸만 덮었더니 이음 자리가 세로로 끊김 → 기존 그림 쪽으로도 그만큼 마스크를 덮어 섞이게 한다."""
# --- PixelLab 생성 승인 문 (2026-10-31 사용자: 시키지 않은 생성 금지) — 이 파일의 모든 생성 요청은 .pixellab_ok 회수가 있어야 나간다
import sys as _gs, pathlib as _gp
_gs.path.insert(0, str(next(p for p in _gp.Path(__file__).resolve().parents if (p / "tools" / "pixellab_gate.py").exists()) / "tools"))
import pixellab_gate as _gate  # noqa: E402
_gate.spend(__file__ + " 실행")
# ---
import os, base64, io, json, sys, time
import requests
from PIL import Image
API = "https://api.pixellab.ai/v2"
src, prompt_path, out_path, keep, new = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
# 기본 겹침 60px(사용자 2026-11-01: 옛 그림 끝 바로 다음부터 이으면 이음선이 끊긴다) — 옛 그림 안쪽 60px까지 다시 그리고 그 안에서 섞는다
ov = int(sys.argv[6]) if len(sys.argv) > 6 else 60
FEATHER = min(ov, 60) * 2 // 3
# 위쪽만 더 넓게 다시 그리기(사용자 10-31: 처마 띠 이음선) — [위쪽 폭] [위쪽 높이]: 그 높이 위로는 위쪽 폭만큼 덮는다(간판·가게가 없는 2층·처마)
ov_top = int(sys.argv[7]) if len(sys.argv) > 7 else ov
top_h = int(sys.argv[8]) if len(sys.argv) > 8 else 0
# 아래쪽(바닥)도 더 넓게 다시 그리기(본부 3층 10-31: 문틀에 바로 붙여 이을 때) — [아래 폭] [아래 시작 y]
ov_bot = int(sys.argv[9]) if len(sys.argv) > 9 else ov
bot_y = int(sys.argv[10]) if len(sys.argv) > 10 else 0
import subprocess as _sp
# NO_FILL=1: 사용자가 그 건에 한해 꽉 채우기 문장을 빼라고 고른 경우만(2026-11-01 11:52 빈 벽 잇기)
if __import__('os').environ.get('NO_FILL') != '1' and _sp.call([sys.executable, str(__import__('pathlib').Path(__file__).with_name('prompt_diff.py')), prompt_path]) != 0: sys.exit('요청문이 3층 원본 핵심 문장을 빠뜨림 — 중단')
im = Image.open(src).convert("RGBA")
w, h = keep + new, im.height
assert w <= 512 and h <= 512
win = Image.new("RGBA", (w, h), (255, 255, 255, 255))
win.paste(im.crop((0, 0, keep, h)), (new, 0))
mask = Image.new("RGB", (w, h), (0, 0, 0)); mask.paste((255, 255, 255), (0, 0, new + ov, h))
if top_h: mask.paste((255, 255, 255), (0, 0, new + ov_top, top_h))
if bot_y: mask.paste((255, 255, 255), (0, bot_y, new + ov_bot, h))
# ERASE=1: 다시 그릴 칸 안의 옛 그림을 흰색으로 지우고 보낸다(extend_right와 같음, 사용자 11-01)
if os.environ.get("ERASE") == "1":
    win.paste((255, 255, 255, 255), (new, 0, new + ov, h))
def soft_mask(mask, side):
    """붙일 때 이음 자리를 칼로 자르지 않고 서서히 섞는다(사용자 2026-11-01: 끝나는 지점부터 이어서 찐빠). 각 줄의 흰 칸 끝(옛 그림 쪽) FEATHER px를 0으로 가늘게 줄인다."""
    m = mask.convert("L"); px = m.load(); W, H = m.size
    for y in range(H):
        xs = [x for x in range(W) if px[x, y] > 0]
        if not xs or FEATHER <= 0: continue
        n = min(FEATHER, len(xs))
        edge = xs[-1] if side == "left" else xs[0]
        for i in range(n):
            x = edge - i if side == "left" else edge + i
            px[x, y] = int(255 * (i + 1) / (n + 1))
    return m
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
out = Image.new("RGBA", (im.width + new, h)); out.paste(im, (new, 0))
# 섞지 않고 자른다(사용자 11-01: 반투명 겹침으로 기둥·건조기가 유령처럼 겹쳐 망함).
# 겹침 칸 [new, new+ov) 안에서 새 그림과 옛 그림이 가장 비슷한 세로 길(DP)을 찾아 그 왼쪽은 새 그림, 오른쪽은 옛 그림.
import numpy as np
R = np.asarray(res.crop((0, 0, w, h)).convert("RGB"), dtype=np.int32)
O = np.asarray(im.crop((0, 0, keep, h)).convert("RGB"), dtype=np.int32)
x0, x1 = new + 2, new + ov - 2
D = np.abs(R[:, x0:x1] - O[:, x0 - new:x1 - new]).sum(axis=2).astype(np.float64)
C = D.copy(); B = np.zeros(D.shape, dtype=np.int32)
for y in range(1, h):
    for x in range(D.shape[1]):
        lo, hi = max(0, x - 1), min(D.shape[1], x + 2)
        k = lo + int(np.argmin(C[y - 1, lo:hi])); B[y, x] = k; C[y, x] += C[y - 1, k]
seam = [0] * h; x = int(np.argmin(C[-1]))
for y in range(h - 1, -1, -1): seam[y] = x0 + x; x = B[y, x]
newpart = res.crop((0, 0, w, h)).convert("RGBA")
for y in range(h):
    out.paste(newpart.crop((0, y, seam[y], y + 1)), (0, y))
print("seam x(창 기준)", min(seam), max(seam))
out.save(out_path)
print(json.dumps({"job": job, "seconds": round(time.time() - t0), "window": res.size, "out": out.size, "usage": j.get("usage") or lr.get("usage")}))
