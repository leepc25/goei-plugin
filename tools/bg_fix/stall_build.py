"""대변기 칸 오브젝트 만들기 (2026-11-01 사용자 「진행해」, 생성 없음)
원본: hq_restroom_m_stalls_v2.png(400x256, 왼쪽 열린 칸 + 오른쪽 닫힌 칸)
- body.png : 왼쪽 칸 몸통(열린 문짝 떼고 왼쪽 기둥 다시 이음, 칸 안 바닥 타일 투명)
- door_0..N.png : 문짝 장면. 0 = 닫힘(오른쪽 칸 문짝을 왼쪽 입구로 옮김), 마지막 = 원래 열린 문짝
모든 그림은 같은 캔버스(원본 x14~244, y0~256) — 같은 자리에 겹쳐 그리면 된다."""
import numpy as np
from PIL import Image
SRC = 'game-src/art/pixellab-hq-20261031/hq_restroom_m_stalls_v2.png'
OUT = 'game-src/art/objects/restroom/'
X0, X1 = 14, 244
a = np.array(Image.open(SRC).convert('RGBA'))
H = a.shape[0]
kill = np.load(OUT + '_floor_kill_v2.npy')
# 1) 열린 문짝(원래 그대로) 떼어 두기: 왼쪽 기둥 앞 x14~89
leaf = np.zeros_like(a); post_cols = slice(60, 88)
leafmask = np.zeros(a.shape[:2], bool)
for y in range(H):
    for x in range(14, 90):
        if a[y, x, 3] == 0: continue
        # 문짝 윗변 (16,30)-(88,48), 아랫변 (16,249)-(88,231)
        top = 30 + (x - 16) * 18 / 72; bot = 249 - (x - 16) * 18 / 72
        if top - 4 <= y <= bot + 2: leafmask[y, x] = True
leaf[leafmask] = a[leafmask]
# 2) 몸통: 문짝 지우고 기둥 다시 잇기(기둥 y12~35 줄을 반복)
body = a.copy(); body[leafmask] = 0
tpl = a[14:30, 60:87]
for y in range(30, 245):
    body[y, 60:87] = tpl[(y - 30) % 16]
# 기둥과 칸 안 옆판 사이(문짝에 가려 있던 틈): 검은 테두리 1줄 + 옆판 색
for y in range(36, 245):
    xs = [x for x in range(87, 120) if body[y, x, 3] > 0]
    if not xs or xs[0] == 87: continue
    x1 = xs[0]
    body[y, 87] = [32, 30, 34, 255]
    body[y, 88:x1] = body[y, min(x1 + 1, 119)]
body[kill] = 0                       # 칸 안·앞 바닥 타일
# 12:37 사용자 「타일 다 안 지워졌다」: 휴지통 둘레·변기 오른쪽에 남은 그늘진 타일 조각 지움(원본 좌표 = 캔버스+14)
L = body[..., :3].astype(int).mean(2)
for y in range(218, 256):
    for x in range(86, 132):          # 변기 밑동(x132~)은 건드리지 않음
        if 104 <= x <= 121 and y <= 237: continue          # 휴지통
        if y >= 227 or L[y, x] > 85: body[y, x, 3] = 0
body[234:238, 162:172, 3] = 0                               # 변기 오른쪽 끝 줄
body[:, 244:] = 0                    # 오른쪽 칸 버림(가운데 기둥 오른쪽 끝 x243까지 둠)
# 3) 닫힌 문짝: 오른쪽 칸 문(x236~343, y46~231, 경첩 포함)을 -159 옮김
closed = np.zeros_like(a)
src = a[46:231, 236:344]  # y230 = 문짝 아래 테두리 줄(12:36 사용자 지적으로 포함)
closed[46:231, 236 - 159:344 - 159] = src
# 12:38 사용자 「문짝이 완전히 닫히지 않아 틈」: 문 오른쪽 끝(x184)과 가운데 기둥(x186) 사이 x185를 검은 테두리로 메움
closed[46:231, 185] = [1, 1, 1, 255]
# 4) 문 여는 장면: 닫힌 문 폭 100%→66%→33%(경첩 x86 기준), 열린 문 33%→66%→100%
HX = 86
def squash(img, keep_from, keep_to, ratio, hinge, side):
    out = np.zeros_like(img)
    w = keep_to - keep_from; nw = max(1, round(w * ratio))
    part = Image.fromarray(img[:, keep_from:keep_to]).resize((nw, H), Image.NEAREST)
    p = np.array(part)
    if side == 'right': out[:, hinge:hinge + nw] = p
    else: out[:, hinge - nw:hinge] = p
    return out
frames = [closed,
          squash(closed, 86, 186, 0.66, HX, 'right'),
          squash(closed, 86, 186, 0.33, HX, 'right'),
          squash(leaf, 14, 88, 0.33, 88, 'left'),
          squash(leaf, 14, 88, 0.66, 88, 'left'),
          leaf]
# 경첩판(x77~95)은 닫힘 장면에만 — 나머지 장면에선 몸통 기둥 위에 경첩만 남김
hinge = closed[:, 77:96].copy()
for i, f in enumerate(frames[1:3], 1):
    f[:, 77:96] = np.where(hinge[..., 3:4] > 0, hinge, f[:, 77:96])
Image.fromarray(body[:, X0:X1]).save(OUT + 'stall_body.png')
for i, f in enumerate(frames):
    Image.fromarray(f[:, X0:X1]).save(OUT + f'stall_door_{i}.png')
print('ok', X1 - X0, H)
