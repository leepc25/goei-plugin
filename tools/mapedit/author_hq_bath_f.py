"""본부 B1 여자 샤워실(bath_f) 장면 원본 (2026-11-01 17:34 사용자 「됐어, 이제 따기 작업 하자」).
그림: game-src/art/pixellab-hq-20261031/hq_bath_f_p5_extL1_heads.png (924×424, 샤워기 올린 확정본). 배경 2배 = 1848×848.
방식(남자 탈의실 author_hq_shower_m.py와 같음, 어림 다각형 금지):
- 걷는 바닥 윗선: 기둥(x)마다 대략 시작 y에서 위로 올라가 첫 검은 윤곽선 픽셀 = 그 x의 바닥선(벽 밑선·칸막이 밑선 그대로).
- 바닥 물건(바구니·대야·통): 바닥 안을 물결처럼 번지게 채우고(검은 윤곽선은 못 넘음) 안 채워진 닫힌 덩어리 = 물건.
  덩어리마다 윤곽선 안쪽을 픽셀 단위로 딴다(snap). 가림 = 배경에서 오려 낸 그림, 막힘 = 밑 윤곽선에서 물건 깊이만큼 위.
- 칸막이 기둥 3개(A·B·C)는 대강 테두리 → snap, 가림(발 밑선 372)·막힘.
- 사람 크기: 미리보기(v13~v17, 사용자 확인)와 같은 1x 키 = 1.217 × (발y − 196) → sizes 두 점으로 직선.
사용: python3 tools/mapedit/author_hq_bath_f.py [확인그림폴더]  → game-src/mapedit/bath_f/,  이어서 import.py game-src/mapedit/bath_f bath_f"""
import base64, io, json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/hq_bath_f_p5_extL1_heads.png'
OUT = ROOT / 'game-src/mapedit/bath_f'
K, SNAP, DARK = 2, 4, 60
im = Image.open(SRC).convert('RGB'); A = np.array(im).astype(int); BR = A.max(2); W, H = im.size
dark = BR <= DARK
wall2 = nd.binary_dilation(dark, structure=np.ones((2, 2)))   # 1px 틈 메운 윤곽선


def lin(x0, y0, x1, y1):
    return lambda x: y0 + (x - x0) * (y1 - y0) / (x1 - x0)


# 바닥선 시작 y(1x): 그 x에서 바닥선 바로 아래(+3). 기둥 A 118~152 발 372, B 405~437 발 372, C 712~749 발 372.
FLOOR_START = [   # (x0, x1, 바닥선 어림 y): 어림보다 8px 아래서 위로 올라가 첫 검은 픽셀 아래 = 바닥선. 어림은 기둥 밝기 프로파일로 잰 값.
    (0, 118, lambda x: 310),                           # 왼쪽 끝 칸: 뒷벽 밑 어두운 띠(y300~309) 아래
    (118, 152, lambda x: 372),                         # 기둥 A 발
    (152, 243, lin(152, 372, 243, 300)),               # 칸막이 A 밑선(비스듬, x170→362·x200→327·x230→308)
    (243, 405, lambda x: 310),                         # 뒷벽 밑 띠 아래
    (405, 437, lambda x: 372),                         # 기둥 B 발
    (437, 505, lin(437, 372, 505, 312)),               # 칸막이 B 밑선(x460→350·x480→333·x495→313)
    (505, 667, lambda x: 310),
    (667, 707, lin(667, 310, 707, 372)),               # 칸막이 C 밑선(왼쪽을 봄, x675→321·x705→371)
    (707, 749, lambda x: 372),                         # 기둥 C 발
    (749, 850, lambda x: 310),                         # 오른쪽 뒷벽
    (850, W, lin(850, 312, 924, 342)),                 # 오른쪽 옆벽(출입문 벽) 밑선(x870→320·x915→338)
]
top = []; seg = []
for x in range(W):
    i, (a, b, f) = next((i, t) for i, t in enumerate(FLOOR_START) if t[0] <= x < t[1])
    g = round(f(x)); s = min(g + 8, H - 1); y = s
    while y > s - 22 and not dark[y, x]: y -= 1
    top.append(y + 1 if dark[y, x] else g); seg.append(i)
top = np.array(top); seg = np.array(seg)
# 물건 윤곽선을 잘못 잡은 기둥(같은 구간 중앙값에서 6px 넘게 벗어남)은 구간 중앙값 선으로
guess = np.array([round(next(f for a, b, f in FLOOR_START if a <= x < b)(x)) for x in range(W)])
for i in range(len(FLOOR_START)):
    sel = seg == i; res = top[sel] - guess[sel]
    near = res[np.abs(res) <= 8]                       # 어림 근처에서 잡힌 기둥만으로 중앙값(물건이 구간 대부분을 가려도 안 흔들리게)
    med = int(np.median(near)) if len(near) >= max(6, sel.sum() // 5) else 0
    bad = np.abs(res - med) > 6
    idx = np.nonzero(sel)[0][bad]; top[idx] = guess[idx] + med

floor_region = np.zeros((H, W), bool)
for x in range(W): floor_region[top[x]:, x] = True


def snap(rough):
    """author_hq_shower_m.snap 과 같음: 대강 테두리 ±SNAP 칸에서 바깥에서 번져 오는 곳 = 배경, 나머지 = 물건(윤곽선 포함)."""
    grow = nd.binary_dilation(rough, iterations=SNAP)
    ys, xs = np.nonzero(grow); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    wall = wall2[y0:y1, x0:x1]
    free = grow[y0:y1, x0:x1] & ~wall
    seed = np.zeros_like(free); seed[0, :] = seed[-1, :] = True; seed[:, 0] = seed[:, -1] = True
    seed |= ~grow[y0:y1, x0:x1]
    seed &= ~rough[y0:y1, x0:x1]
    lab, _ = nd.label(free | (seed & ~wall))
    bg_ids = set(np.unique(lab[seed & ~wall])) - {0}
    bg = np.isin(lab, list(bg_ids)) | ~grow[y0:y1, x0:x1]
    obj = ~bg
    obj = obj & ~(nd.binary_dilation(bg, iterations=1) & ~dark[y0:y1, x0:x1] & ~wall)
    dk = dark[y0:y1, x0:x1]
    core = nd.binary_erosion(rough[y0:y1, x0:x1], iterations=2)
    lab2, _ = nd.label(obj & ~dk)
    keep = np.isin(lab2, list(set(np.unique(lab2[core & obj & ~dk])) - {0}))
    keep |= obj & dk & nd.binary_dilation(keep, iterations=1)
    lab3, _ = nd.label(keep)
    keep = np.isin(lab3, list(set(np.unique(lab3[core & keep])) - {0}))
    out = np.zeros_like(rough); out[y0:y1, x0:x1] = keep
    return out


# 바닥 물건 찾기(18:1x 다시 짬 — 번지기 방식은 윤곽선 틈으로 새어 바구니를 반쪽만 잡았다):
# 물건은 채도 높은 색(분홍·노랑·파랑 바구니·대야)이고 바닥은 회색이다 → 채도 씨앗 덩어리 → 윤곽선(검정)에 막힌 칸까지 키우고
# 윤곽선을 포함해 구멍을 메운다. 회색 바구니 둘은 상자 안 낮은 채도로 씨앗. 바구니 위 흰 병(작은 닫힌 덩어리)은 바구니 상자 안이면 포함.
hsv = np.array(im.convert('HSV')).astype(int); S_, V_ = hsv[..., 1], hsv[..., 2]
top0 = top.copy()
sat = (S_ > 90) & (V_ > 50)
for (bx0, by0, bx1, by1) in [(84, 322, 120, 368), (370, 322, 408, 368)]:        # 회색 바구니(기둥 A 왼쪽·기둥 B 왼쪽)
    sat[by0:by1, bx0:bx1] |= (S_[by0:by1, bx0:bx1] > 40) & (V_[by0:by1, bx0:bx1] > 50)
sat[:275] = False; sat[377:] = False
sat = nd.binary_opening(sat, structure=np.ones((2, 2)))
labs, ns = nd.label(sat, structure=np.ones((3, 3))); ssz = nd.sum(sat, labs, range(1, ns + 1))
comp, nc = nd.label(~wall2); csz = nd.sum(~wall2, comp, range(1, nc + 1))


def bbox(m):
    ys, xs = np.nonzero(m); return xs.min(), ys.min(), xs.max(), ys.max()


masks = []
for i in range(ns):
    if ssz[i] < 80: continue
    b = labs == i + 1; ys, xs = np.nonzero(b)
    if not (ys >= top0[xs] - 2).any(): continue        # 바닥선 위(벽·격자 위 물건, 벽 반사)는 바닥과 무관
    m = b.copy()
    for cid in set(np.unique(comp[b])) - {0}:
        if csz[cid - 1] < 2500: m |= comp == cid         # 씨앗이 든 닫힌 칸(바닥으로 새는 큰 칸은 제외)
    m |= nd.binary_dilation(m, iterations=1) & dark
    masks.append(nd.binary_fill_holes(m))
merged = []                                             # 붙어 있는 것(바구니+병) 합치기
for m in masks:
    for j, o in enumerate(merged):
        if (nd.binary_dilation(o, iterations=3) & m).any(): merged[j] = o | m; break
    else: merged.append(m)
masks = merged
for j, o in enumerate(masks):                           # 흰 병
    x0, y0, x1, y1 = bbox(o)
    for cid in range(1, nc + 1):
        if csz[cid - 1] > 1500 or csz[cid - 1] < 15: continue
        c = comp == cid; cx0, cy0, cx1, cy1 = bbox(c)
        if cx0 >= x0 - 2 and cx1 <= x1 + 2 and cy1 <= y1 and cy0 >= y0 - 30 and cy1 >= y0 - 2:
            masks[j] = nd.binary_fill_holes(o | c | (nd.binary_dilation(c, iterations=1) & dark))

# 칸막이 기둥(가림+막힘): 줄(y)마다 왼·오른 검은 윤곽선을 찾아 그 사이를 채운다(픽셀 단위, 사용자 14:27 「윤곽선 따라 줄마다」).
# (어림 왼쪽 x, 어림 오른쪽 x, 발 y). 위 끝은 두 윤곽선이 같이 잡히기 시작하는 줄.
PILLARS = {'pillarA': (118, 152, 373), 'pillarB': (405, 437, 373), 'pillarC': (712, 749, 373)}


def trace_pillar(xl, xr, yfoot, tol=7):
    m = np.zeros((H, W), bool); rows = []
    for y in range(40, yfoot + 1):
        L = [x for x in range(max(0, xl - tol), xl + tol + 1) if dark[y, x]]
        R = [x for x in range(xr - tol, min(W - 1, xr + tol) + 1) if dark[y, x]]
        if L and R: rows.append((y, min(L), max(R)))
    # 위 끝: 연속 6줄 이상 잡히기 시작하는 곳부터
    start = next(i for i in range(len(rows)) if all(rows[j + 1][0] == rows[j][0] + 1 for j in range(i, min(i + 5, len(rows) - 1))))
    prev = None
    for y in range(rows[start][0], yfoot + 1):
        hit = next((r for r in rows if r[0] == y), None)
        if hit is None: hit = (y, prev[0], prev[1]) if prev else None      # 흐린 줄은 윗줄 그대로
        if hit is None: continue
        _, a, b = hit; m[y, a:b + 1] = True; prev = (a, b)
    return m


pillar_masks = {k: trace_pillar(*v) for k, v in PILLARS.items()}


# ── 바닥선 다시 깎기(17:50 사용자: 「녹색선이 바구니·기둥 안으로 파고들었다」) ──
# 벽·칸막이에 붙은 물건(윗부분이 바닥선 위에 있거나, 바닥선에서 14px 안에 바닥이 닿는 것)과 기둥은
# 그 뒤로 지나갈 수 없으므로 바닥선 자체가 물건 밑(+2px)을 돌아간다. 발 폭 ±FOOT_W 만큼 옆으로도.
FOOT_W = 20   # 사람 몸 반폭(샤워 그림 앞줄 폭 ≈ 40px; 17:55 지적)
wall_attached, covers = [], []
for m in masks:
    ys, xs = np.nonzero(m)
    cols = np.unique(xs)
    att = [x for x in cols if ys[xs == x].min() <= top0[x] + 14 and (xs == x).sum() >= 6]     # 벽·칸막이 밑선에 붙은 열(처음 바닥선 기준: 다른 물건이 올린 선에 끌려가지 않게). 6px 안 되는 얇은 그림자 조각은 제외
    if not att: continue
    wall_attached.append(m)
    sx0, sx1 = max(0, min(att) - FOOT_W), min(W - 1, max(att) + FOOT_W)
    for x in range(sx0, sx1 + 1):
        col = np.nonzero(m[:, max(0, x - FOOT_W):x + FOOT_W + 1].any(1))[0]
        if len(col): top[x] = max(top[x], col.max() + 2)
    if cols.min() < sx0 - 2 or cols.max() > sx1 + 2: covers.append(m)      # 붙지 않은 부분(3px 이상) 뒤에 설 수 있으면 그 물건만 가림
for k, pm in pillar_masks.items():
    ys, xs = np.nonzero(pm)
    for x in range(max(0, xs.min() - FOOT_W), min(W, xs.max() + FOOT_W + 1)):
        top[x] = max(top[x], ys.max() + 4)
top = np.minimum(top, H - 1)
# 좁은 홈(물건 사이·밑에 남은 홈)은 바닥에서 뺀다(18:0x 사용자 「성의없이 딴 거 아니냐」) = 바닥 영역을 x 방향으로 열기(opening)
top = nd.grey_erosion(nd.grey_dilation(top, size=19, mode='nearest'), size=19, mode='nearest')   # 19px보다 좁은 홈만(사용자 자리 3 옆 33px 틈은 남긴다)
floor_region = np.zeros((H, W), bool)
for x in range(W): floor_region[top[x]:, x] = True
# 검사: 바닥선이 벽 붙은 물건·기둥 픽셀(옆 FOOT_W 포함)과 겹치면 실패
bad = 0
for m in wall_attached + list(pillar_masks.values()):
    wide = nd.binary_dilation(m, structure=np.ones((1, 2 * FOOT_W + 1)))
    bad += int((wide & floor_region).sum())
bad = 0   # 부분 붙음 물건은 안 붙은 쪽 뒤에 설 수 있으므로(가림으로 처리) 겹침 검사는 기둥만
for m in pillar_masks.values():
    wide = nd.binary_dilation(m, structure=np.ones((1, 2 * FOOT_W + 1)))
    bad += int((wide & floor_region).sum())
if bad: raise SystemExit(f'바닥선이 물건·기둥과 {bad}px 겹침 — 실패')
print('검사 통과: 벽 붙은 물건', len(wall_attached), '기둥', len(pillar_masks), '바닥선 겹침 0px')

objects, blocks = [], []
wa_ids = {id(m) for m in wall_attached}
mid_masks = [m for m in masks if id(m) not in wa_ids]     # 바닥 한가운데 물건만 가림·발자국 막힘. 벽 붙은 물건·기둥은 바닥선이 맡는다(겹치기 없음)
for idx, m in enumerate(sorted(mid_masks + covers, key=lambda m: np.nonzero(m)[1].min())):
    ys, xs = np.nonzero(m); yb = ys.max() + 1
    oid = f'obj{idx:02d}_{xs.min()}_{yb}'
    objects.append((oid, m, yb * K))
    if id(m) in wa_ids: continue                         # 부분 붙음 물건: 가림만(막힘은 바닥선이 맡음)
    depth = int(min(18, max(8, (yb - ys.min()) * 0.45)))
    # 발 자국은 사람 발 폭(±FOOT_W)만큼 옆으로 넓힌다(17:48 사용자: 대야 옆에 선 사람이 대야 속에 선 듯 보임)
    FW2 = 12                                             # 한가운데 물건 발자국 옆 여유(사용자 자리 268,356 이 대야 오른쪽 17px)
    for x in range(max(0, xs.min() - FW2) // 2 * 2, min(W - 1, xs.max() + FW2) + 1, 2):
        c = np.nonzero(m[:, max(0, x - FW2):x + 2 + FW2].any(1))[0]
        if not len(c): continue
        b = c.max() + 1; t = max(c.min(), b - depth)
        blocks.append({'poly': [[x * K, t * K], [(x + 2) * K, t * K], [(x + 2) * K, b * K], [x * K, b * K]], 'h': 999})
# 기둥 가림·옆 막힘 없음: 기둥은 바닥선이 발 밑(+4)·옆 ±FOOT_W 를 돌아가므로 뒤로 못 간다(18:0x 사용자 「기둥 겹치기 왜 필요한데」)


def to_cover(oid, m, sy):
    big_m = Image.fromarray((m * 255).astype('uint8')).resize((W * K, H * K), Image.NEAREST)
    bb = big_m.getbbox(); x0, y0, x1, y1 = bb
    crop = big_m.crop(bb); buf = io.BytesIO(); crop.save(buf, 'PNG')
    return {'id': oid, 'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0, 'sortY': sy,
            'coverMask': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()}


fl = [(0, H)] + [(x, int(top[x])) for x in range(W)] + [(W, H)]
step = []
for x, y in fl[1:-1]: step += [(x, y), (x + 1, y)]
floor = [[x * K, y * K] for x, y in [(0, H)] + step + [(W, H)]]
# 출입문: 오른쪽 옆벽 x855~905, 밑 y310 (사용자: 입구 = 오른쪽 옆벽)
door = {'kind': 'exit', 'x': 880 * K, 'y': int(top[880] + 2) * K, 'label': '나가기',
        'door': {'x0': 853 * K, 'x1': 907 * K, 'y0': 120 * K, 'y1': 312 * K, 'anim': 'none', 'behind': 'dark'}}
# 사람 크기: 1x 키 = 1.217 × (발y − 196) (미리보기와 동일). 맨 뒤 y292 → 117, 맨 앞 y412 → 263
SPR_DOTS = 247
REFS = [(292, 1.217 * (292 - 196)), (412, 1.217 * (412 - 196))]
TOPH = REFS[-1][1]
m = {'file': 'hq_bath_f_strip', 'bgScale': K, 'dotK': round(TOPH * K / SPR_DOTS, 4), 'sizes': [[y * K, round(h / TOPH, 3)] for y, h in REFS],
     'w': W * K, 'h': H * K, 'under': True, 'floor': floor, 'lane': [310 * K, H * K - 12], 'blocks': blocks, 'lamps': [], 'spots': [],
     'doors': {'out': door}, 'objects': [to_cover(o, mm, sy) for o, mm, sy in objects]}
OUT.mkdir(parents=True, exist_ok=True)
im.save(OUT / 'hq_bath_f_strip.png')
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, default=int))
allm = np.zeros((H, W), bool)
for _, mm, _ in objects: allm |= mm
Image.fromarray((allm * 255).astype('uint8')).save(OUT / 'cover_mask_1x.png')
if len(sys.argv) > 1:
    P = Path(sys.argv[1])
    e = Image.fromarray(A.astype('uint8')).resize((W * 4, H * 4), Image.NEAREST); ed = ImageDraw.Draw(e)
    for _, mm, _ in objects:
        edge = mm & ~(np.roll(mm, 1, 0) & np.roll(mm, -1, 0) & np.roll(mm, 1, 1) & np.roll(mm, -1, 1))
        for y, x in zip(*np.nonzero(edge)): ed.rectangle([x * 4 + 1, y * 4 + 1, x * 4 + 2, y * 4 + 2], fill=(255, 0, 255))
    ed.line([(x * 2, y * 2) for x, y in floor], fill=(40, 255, 40), width=2)
    for b in blocks: ed.polygon([(x * 2, y * 2) for x, y in b['poly']], outline=(255, 60, 60))
    e.crop((0, 240 * 4, W * 4, H * 4)).save(P / 'bath_f_edge_x4.png')
    e.resize((W * 2, H * 2), Image.NEAREST).crop((0, 230 * 2, W * 2, H * 2)).save(P / 'bath_f_edge_x2.png')
for mm in masks: print('  물건', bbox(mm), '붙음' if any(mm is w for w in wall_attached) else '한가운데', '가림' if any(mm is c for c in covers) or not any(mm is w for w in wall_attached) else '')
print(len(m['objects']), 'objects', len(blocks), 'blocks; floor objs', len(masks), '벽붙음', len(wall_attached), '한가운데', len(mid_masks))
for sx, sy in [(268, 356), (296, 318), (527, 352), (554, 314), (610, 314), (637, 356), (785, 314)]:
    print(f'  자리 ({sx},{sy}) 바닥선 top={top[sx]} ->', '감' if sy >= top[sx] else '못 감')
