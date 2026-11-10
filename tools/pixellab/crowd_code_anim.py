"""방청석 사람을 코드로 움직이기(무료, 그림 다시 그리지 않음). 11-10 망상홈쇼핑 컷F.
사람 칸(people.json)마다 빈 방청석 그림과 다른 칸 = 사람 모양으로 따서, 1칸씩 옮긴다. 빈 자리는 같은 줄 옆 배경색으로 메운다.
움직임 표(MOVES)는 people.json의 "moves"로 바꿀 수 있다(장마다 [dx,dy]).
사용: python3 tools/pixellab/crowd_code_anim.py <세트png> <빈판png> <people.json> <출력폴더> <x0,y0,x1,y1> [장수=16]"""
import sys, os, json, random
import numpy as np
from PIL import Image
full, empty, pj, out, box = sys.argv[1:6]
N = int(sys.argv[6]) if len(sys.argv) > 6 else 16
spec = json.load(open(pj))
MOVES = spec.get("moves", {
    "scared": [[0,0],[1,0],[0,0],[-1,0],[0,0],[1,0],[0,0],[-1,0],[0,1],[0,1],[0,0],[1,0],[0,0],[-1,0],[0,0],[0,0]],
    "amused": [[0,0],[0,0],[0,-1],[0,-1],[0,0],[0,0],[0,-1],[0,-1],[1,0],[1,0],[1,0],[0,0],[0,0],[0,-1],[0,0],[0,0]]})
A = np.array(Image.open(full).convert("RGB"), int)
E = np.array(Image.open(empty).convert("RGB"), int)
random.seed(spec.get("seed", 7))
items = []
for p in sorted(spec["people"], key=lambda p: p["box"][1]):  # 뒤줄 먼저, 앞줄 나중
    x0, y0, x1, y1 = p["box"]
    m = np.abs(A[y0:y1, x0:x1] - E[y0:y1, x0:x1]).sum(2) > spec.get("diff", 40)
    for r in range(m.shape[0]):  # 줄마다 빈틈 메워 덩어리로
        xs = np.where(m[r])[0]
        if len(xs) > 1: m[r, xs[0]:xs[-1]+1] = True
    items.append((p, m, random.randrange(N)))
os.makedirs(out, exist_ok=True)
X0, Y0, X1, Y1 = map(int, box.split(","))
for f in range(N):
    C = A.copy()
    for p, m, ph in items:
        x0, y0, x1, y1 = p["box"]; dx, dy = MOVES[p["kind"]][(f + ph) % len(MOVES[p["kind"]])]
        if dx == 0 and dy == 0: continue
        reg = A[y0:y1, x0:x1].copy(); bg = reg.copy()
        for r in range(m.shape[0]):  # 사람 자리를 옆 배경으로 메움
            xs = np.where(m[r])[0]
            if len(xs):
                L = reg[r, max(xs[0]-1, 0)]; R = reg[r, min(xs[-1]+1, m.shape[1]-1)]
                mid = (xs[0] + xs[-1]) // 2
                bg[r, xs[0]:mid+1] = L; bg[r, mid+1:xs[-1]+1] = R
        new = np.where(m[..., None], bg, C[y0:y1, x0:x1])
        ms = np.roll(np.roll(m, dy, 0), dx, 1); ps = np.roll(np.roll(reg, dy, 0), dx, 1)
        if dy > 0: ms[:dy] = False
        if dy < 0: ms[dy:] = False
        if dx > 0: ms[:, :dx] = False
        if dx < 0: ms[:, dx:] = False
        new = np.where(ms[..., None], ps, new)
        C[y0:y1, x0:x1] = new
    Image.fromarray(C[Y0:Y1, X0:X1].astype(np.uint8)).save(f"{out}/f{f:02d}.png")
print("장", N, "사람", len(items))
