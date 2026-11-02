"""PixelLab inpaint-v3로 그림을 오른쪽으로 이어 그린다. 앞 그림 오른쪽 keep px + 새 영역 new px를 한 창(최대 512)에 넣고 새 영역만 마스크.
사용: python3 extend_right.py <앞 그림> <프롬프트.txt> <출력(이어 붙인 전체)> <keep> <new> [겹침 ov] [위 겹침] [위 높이] [아래 겹침] [아래 시작 y]
겹침: 앞 그림 쪽으로도 마스크를 덮어 섞는다(extend_left와 같음). 위·아래만 넓게 덮으면 가운데 문·물건은 건드리지 않는다(본부 3층 10-31)."""
# --- PixelLab 생성 승인 문 (2026-10-31 사용자: 시키지 않은 생성 금지) — 이 파일의 모든 생성 요청은 .pixellab_ok 회수가 있어야 나간다
import sys as _gs, pathlib as _gp
_gs.path.insert(0, str(next(p for p in _gp.Path(__file__).resolve().parents if (p / "tools" / "pixellab_gate.py").exists()) / "tools"))
import pixellab_gate as _gate  # noqa: E402
import os as _os
if not _os.environ.get("PREVIEW"): _gate.spend(__file__ + " 실행")
# ---
import os, base64, io, json, sys, time
import requests
from PIL import Image

API = "https://api.pixellab.ai/v2"
src, prompt_path, out_path, keep, new = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
# 보내기 전 3층 원본과 문장 대조 — 핵심 문장이 빠지면 보내지 않는다(2026-11-01 사용자)
import subprocess as _sp
if __import__('os').environ.get('NO_FILL') != '1' and _sp.call([sys.executable, str(__import__('pathlib').Path(__file__).with_name('prompt_diff.py')), prompt_path]) != 0: sys.exit('요청문이 3층 원본 핵심 문장을 빠뜨림 — 중단')
im = Image.open(src).convert("RGBA")
w, h = keep + new, im.height
win = Image.new("RGBA", (w, h), (255, 255, 255, 255))
win.paste(im.crop((im.width - keep, 0, im.width, h)), (0, 0))
mask = Image.new("RGB", (w, h), (0, 0, 0))
# 기본 겹침 60px(사용자 2026-11-01: 옛 그림 끝 바로 다음부터 이으면 이음선이 끊긴다) — 옛 그림 안쪽 60px까지 다시 그리고 그 안에서 섞는다
ov = int(sys.argv[6]) if len(sys.argv) > 6 else 60
FEATHER = min(ov, 60) * 2 // 3
ov_top = int(sys.argv[7]) if len(sys.argv) > 7 else ov
top_h = int(sys.argv[8]) if len(sys.argv) > 8 else 0
ov_bot = int(sys.argv[9]) if len(sys.argv) > 9 else ov
bot_y = int(sys.argv[10]) if len(sys.argv) > 10 else 0
mask.paste((255, 255, 255), (keep - ov, 0, w, h))
if top_h: mask.paste((255, 255, 255), (keep - ov_top, 0, w, top_h))
if bot_y: mask.paste((255, 255, 255), (keep - ov_bot, bot_y, w, h))

# ERASE=1: 다시 그릴 칸 안의 옛 그림을 지우고 보낸다(프로젝트 규칙). 새 칸과 같이 흰색으로 비움(줄무늬 채우기는 따라 그릴 위험, 사용자 11-01).
if os.environ.get("ERASE") == "1":
    win.paste((255, 255, 255, 255), (keep - ov, 0, keep, h))
    if top_h: win.paste((255, 255, 255, 255), (keep - ov_top, 0, keep, top_h))
    if bot_y: win.paste((255, 255, 255, 255), (keep - ov_bot, bot_y, keep, h))
# PROTECT="x0,y0,x1,y1" (앞 그림 좌표): 이 칸의 옛 그림은 지우지도 다시 그리지도 않고 그대로 둔다(사용자 11-02 11:48 「관철빌딩 글자 부분만」 지우지 못하게)
PROT = [int(v) for v in os.environ["PROTECT"].split(",")] if os.environ.get("PROTECT") else None
if PROT:
    off = im.width - keep
    pb = (max(PROT[0] - off, 0), PROT[1], min(PROT[2] - off, keep), PROT[3])
    win.paste(im.crop((pb[0] + off, pb[1], pb[2] + off, pb[3])), (pb[0], pb[1]))
    mask.paste((0, 0, 0), pb)
# PREVIEW=<png>: 창·마스크만 저장하고 보내지 않는다
if os.environ.get("PREVIEW"):
    sh = Image.new("RGB", (w, h * 2 + 8), (255, 0, 255)); sh.paste(win.convert("RGB"), (0, 0)); sh.paste(mask, (0, h + 8))
    sh.resize((w * 2, sh.height * 2), Image.NEAREST).save(os.environ["PREVIEW"]); sys.exit(0)

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

def balance():
    return requests.get(API + "/balance", timeout=30).json()["subscription"]["generations"]

b0 = 0
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
orig = Image.new("RGBA", (w, h), (255, 255, 255, 255)); orig.paste(im.crop((im.width - keep, 0, im.width, h)), (0, 0))
# 섞을 때는 지우기 전 옛 그림과 섞는다(ERASE로 흰 칸을 섞으면 흰 띠가 생김, 11-01)
# 섞지 않고 자른다(사용자 11-01: 반투명 겹침 = 유령). 겹침 칸 안에서 새·옛 그림이 가장 비슷한 세로 길(DP): 왼쪽은 옛 그림, 오른쪽은 새 그림.
import numpy as np
R = np.asarray(res.convert("RGB"), dtype=np.int32); O = np.asarray(orig.convert("RGB"), dtype=np.int32)
x0, x1 = keep - ov + 2, keep - 2
D = np.abs(R[:, x0:x1] - O[:, x0:x1]).sum(axis=2).astype(np.float64)
C = D.copy(); B = np.zeros(D.shape, dtype=np.int32)
for y in range(1, h):
    for x in range(D.shape[1]):
        lo, hi = max(0, x - 1), min(D.shape[1], x + 2)
        k = lo + int(np.argmin(C[y - 1, lo:hi])); B[y, x] = k; C[y, x] += C[y - 1, k]
seam = [0] * h; x = int(np.argmin(C[-1]))
for y in range(h - 1, -1, -1): seam[y] = x0 + x; x = B[y, x]
newpart = res.convert("RGBA"); base = im.width - keep
for y in range(h):
    s = seam[y] if not (top_h and y < top_h) else max(seam[y], 0)
    out.paste(newpart.crop((s, y, w, y + 1)), (base + s, y))
if PROT: out.paste(im.crop((PROT[0], PROT[1], PROT[2], PROT[3])), (PROT[0], PROT[1]))
print("seam x(창 기준)", min(seam), max(seam))
out.save(out_path)
print(json.dumps({"seconds": round(time.time() - t0, 1), "window": res.size, "out": out.size, "usage": j.get("usage") or lr.get("usage")}))
