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


# 바닥 물건 찾기: 바닥 영역 안에서 윤곽선을 못 넘고 번지는 채우기 → 안 닿는 닫힌 덩어리
free = floor_region & ~wall2
lab, n = nd.label(free)
sizes = nd.sum(free, lab, range(1, n + 1))
floor_ids = [i + 1 for i, s in enumerate(sizes) if s > 2000]   # 큰 덩어리들 = 진짜 바닥(배수구 띠로 나뉜 조각 포함)
reached = np.isin(lab, floor_ids)
cand = floor_region & ~reached
cand[345:370, 783:830] = False          # 오른쪽 바닥 격자(평평, 걸을 수 있음) — 옆 바구니와 붙어 있어 미리 뺀다
labc, nc = nd.label(cand, structure=np.ones((3, 3)))
GUTTER = (377, 392)                    # 가로 배수구 띠(바닥, 걸을 수 있음)
GRATES = [(775, 845, 340, 372)]   # 오른쪽 바닥 격자(평평, 걸을 수 있음); 배수구 띠 아래 격자들은 띠 필터가 맡음   # 바닥 격자(평평, 걸을 수 있음)
objs = []
for i in range(1, nc + 1):
    m = labc == i; ys, xs = np.nonzero(m)
    if len(ys) < 60: continue
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    if y0 >= GUTTER[0] - 1: continue          # 배수구 띠와 그 아래(격자 포함)는 전부 바닥
    if any(x0 >= gx0 - 2 and x1 <= gx1 + 2 and y0 >= gy0 - 2 and y1 <= gy1 + 2 for gx0, gx1, gy0, gy1 in GRATES): continue
    if y1 - y0 < 6 or x1 - x0 < 6: continue
    objs.append(m)
# 덩어리마다 물건 전체(바닥선 위로 튀어나온 윗부분까지)를 윤곽선 따라 다시 딴다
masks = []
for m in objs:
    ys, xs = np.nonzero(m)
    rough = np.zeros((H, W), bool)
    up = 34 if ys.min() <= top[xs].min() + 2 else 4      # 바닥선에 닿는 물건은 위로 34px까지 더 본다
    rough[max(0, ys.min() - up):ys.max() + 3, max(0, xs.min() - 2):xs.max() + 3] = True
    rough &= ~nd.binary_dilation(m, iterations=0) | m
    mm = snap(rough) | m
    masks.append(mm)
# 같은 물건이 둘로 잡힌 것 합치기(겹치면)
merged = []
for mm in masks:
    for j, o in enumerate(merged):
        if (o & nd.binary_dilation(mm, iterations=1)).any(): merged[j] = o | mm; break
    else: merged.append(mm)
masks = merged

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


objects, blocks = [], []
for idx, m in enumerate(sorted(masks, key=lambda m: np.nonzero(m)[1].min())):
    ys, xs = np.nonzero(m); yb = ys.max() + 1
    oid = f'obj{idx:02d}_{xs.min()}_{yb}'
    objects.append((oid, m, yb * K))
    depth = int(min(18, max(8, (yb - ys.min()) * 0.45)))
    # 발 자국은 사람 발 폭(±FOOT_W)만큼 옆으로 넓힌다(17:48 사용자: 대야 옆에 선 사람이 대야 속에 선 듯 보임)
    FOOT_W = 12
    for x in range(max(0, xs.min() - FOOT_W) // 2 * 2, min(W - 1, xs.max() + FOOT_W) + 1, 2):
        c = np.nonzero(m[:, max(0, x - FOOT_W):x + 2 + FOOT_W].any(1))[0]
        if not len(c): continue
        b = c.max() + 1; t = max(c.min(), b - depth)
        blocks.append({'poly': [[x * K, t * K], [(x + 2) * K, t * K], [(x + 2) * K, b * K], [x * K, b * K]], 'h': 999})
for k, m in pillar_masks.items():
    objects.append((k, m, 372 * K))
# 기둥·칸막이 벽 막힘: 바닥선 위는 전부 못 감(바닥 다각형이 맡음). 기둥 발 아래 2px 여유 막힘만 추가
# 기둥 양옆 12px(사람 발 폭)는 뒷벽 밑선부터 기둥 발 아래 4px까지 못 섬(17:48: 기둥 옆에 바짝 서면 기둥 속에 파묻혀 보임)
for x0, x1 in [(118, 152), (405, 437), (712, 749)]:
    blocks.append({'poly': [[(x0 - 12) * K, 300 * K], [(x1 + 12) * K, 300 * K], [(x1 + 12) * K, 377 * K], [(x0 - 12) * K, 377 * K]], 'h': 999})


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
door = {'kind': 'exit', 'x': 880 * K, 'y': 312 * K, 'label': '나가기',
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
print(len(m['objects']), 'objects', len(blocks), 'blocks; floor objs', len(masks))
