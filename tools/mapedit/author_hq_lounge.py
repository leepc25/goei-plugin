"""본부 3층 휴게실(lounge) 장면 원본 (사용자 11-02 06:07 「이대로 확정한다」).
그림: game-src/art/pixellab-hq-20261031/hq_lounge_p13s_extL5_fix.png (896×424, 배경 2배 = 1792×848).
좌표(1x)는 4~6배 확대 + 5px 격자로 윤곽선을 직접 읽었다(scratchpad zA~zF).
- 뒷벽 밑(바닥 시작): 걸레받이 아래 y290. 벽 물건 밑: 전자레인지 장 x68~143 y298, 정수기 2대 x143~221 y301,
  보라 자판기 x221~318 y303(다리), 소화기·쓰레기통 x398~500 y292, 출입문(비상구 표지 밑 유리문) 틀 x501~568 y98~287,
  흰 자판기 x563~645 y300, 싱크대 조리대 x647~835 y295, 오른쪽 분리수거함 앞 윤곽 (835,295)→(896,353).
- 테이블 3개는 배경에 그려져 있고, 오려 낸 그림(game-src/art/objects/lounge_tables)을 가림으로 다시 그린다.
  뒷다리 부분은 뒷다리 바닥(y348)에서, 나머지는 앞다리 바닥(y377)에서 정렬(앉혀 보기 v8과 같은 나눔).
- 벽에 붙은 물건은 가림 없음(사용자 규칙). 분리수거함도 벽에 붙어 뒤로 못 감 → 막힘만.
- 상호작용(사용자 06:07 확정, NPC 생활 동작): 싱크대 104 / 자판기 57→27→142 / 정수기·커피메이커 57→142 /
  전자레인지·간식 찬장 57→157 / 게시판 57 / 출입문 걸어 나감. 의자 12개 = 앉혀 보기 v8 자리.
출력: game-src/mapedit/lounge/ (map.json + 그림) → python3 tools/mapedit/import.py game-src/mapedit/lounge lounge"""
import json, os, shutil, sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/hq_lounge_p13s_extL5_fix.png'
TD = ROOT / 'game-src/art/objects/lounge_tables'
OUT = ROOT / 'game-src/mapedit/lounge'; OUT.mkdir(parents=True, exist_ok=True)
K = 2
im = Image.open(SRC).convert('RGB'); im.save(OUT / 'hq_lounge_strip.png')
W, H = im.width * K, im.height * K
P = lambda pts: [[x * K, y * K] for x, y in pts]
# 바닥: 벽 물건 밑선(검은 윤곽 줄)+2px, 옆으로 몸 반폭 여유 12px (11-01 마스크 규칙).
# 06:13 사용자 「높이 올라 탔잖아 싱크대」: 조리대 밑선은 y299(8배로 다시 읽음) — 처음 295는 조리대 위를 걷게 했다.
WALL = 291   # 걸레받이 밑 y289 + 2
SEG = [(68, 143, 298), (143, 221, 301), (221, 318, 303), (398, 500, 292), (563, 645, 299), (645, 835, 299)]   # x0, x1, 밑선 y
MARGIN = 12
top = [WALL] * 896
for x0, x1, yb in SEG:
    for x in range(max(0, x0 - MARGIN), min(896, x1 + MARGIN)): top[x] = max(top[x], yb + 2)
BINS = [(835, 297), (838, 312), (841, 318), (846, 322), (851, 326), (856, 329), (862, 332), (866, 338), (872, 341), (877, 342),
        (880, 345), (885, 350), (890, 353), (896, 354)]   # 분리수거함 앞 밑 윤곽(6배로 읽음) +2
pts, prev = [], None
for x in range(0, BINS[0][0] - MARGIN):
    if top[x] != prev:
        if prev is not None: pts.append((x, prev))
        pts.append((x, top[x])); prev = top[x]
pts += [(x - MARGIN, y) for x, y in BINS[1:-1] if y > prev] + [(896, BINS[-1][1])]   # 조리대 선보다 높은 윤곽 점은 버림
floor = P(pts + [(896, 424), (0, 424)])
# 테이블 = 올라설 수 있는 발판(사용자 06:14 「올라가게 잡아」). 바닥 자리 = 상판이 덮는 바닥(뒷다리 y348~앞다리 y377, 상판 좌우 끝),
# 높이 = 앞다리 바닥 y377 - 상판 앞끝 윗면 y302 = 75(1x) → 150(2x). import.py가 h<400이면 발판(solid)으로 굽는다.
TOP_H = (377 - 302) * K
SLAB = {'table1': (82, 205), 'table2': (383, 506), 'table3': (669, 793)}
blocks = [{'poly': P([(x0, 348), (x1, 348), (x1, 377), (x0, 377)]), 'h': TOP_H} for x0, x1 in SLAB.values()]
TM = json.loads((TD / 'tables.json').read_text())
BACKLEG = {'table1': [(120, 128, 308, 348), (197, 203, 296, 348)], 'table2': [(420, 427, 308, 348), (498, 504, 295, 348)],
           'table3': [(671, 677, 294, 348), (748, 755, 308, 348)]}
objects = []
for n, t in TM.items():
    src = Image.open(TD / f'{n}.png').convert('RGBA'); tb = Image.new('RGBA', src.size, (0, 0, 0, 0)); tf = src.copy()
    for x0, x1, y0, y1 in BACKLEG[n]:
        box = (x0 - t['x'], y0 - t['y'], x1 - t['x'] + 1, y1 - t['y'] + 1)
        tb.paste(src.crop(box), box[:2]); tf.paste((0, 0, 0, 0), box)
    tb.save(OUT / f'{n}_back.png'); tf.save(OUT / f'{n}_front.png')
    for part, sy in (('back', 348), ('front', 377)):
        objects.append({'id': f'{n}_{part}', 'file': f'{n}_{part}.png', 'x': t['x'] * K, 'y': t['y'] * K,
                        'w': src.width * K, 'h': src.height * K, 'sortY': sy * K})
door = lambda x0, x1, y0, y1: {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': 'none', 'behind': 'dark'}
doors = {'out': {'kind': 'glass', 'x': 534 * K, 'y': 296 * K, 'to': 'f3', 'toDoor': 'lounge', 'label': '복도', 'door': door(504, 566, 131, 285)}}
# 의자 자리 = 앉혀 보기 v8 (tools/objects/lounge_p13_people.py) 그대로: 의자 발 y와 기준점 x(1x)
TAB = {'table1': (162, 134, 82, 205), 'table2': (462, 434, 383, 506), 'table3': (713, 740, 669, 793)}
FB, FF, FS, TUCK = 340, 395, 371, 12
spots = []
for n, (xb, xf, xl, xr) in TAB.items():
    spots += [{'id': f'{n}_N', 'x': xb * K, 'y': FB * K, 'dir': 'front', 'face': 1, 'verb': '앉기', 'chair': 'front'},
              {'id': f'{n}_W', 'x': (xl + TUCK) * K, 'y': FS * K, 'dir': 'side', 'face': 1, 'verb': '앉기', 'chair': 'side', 'edge': 'inner'},
              {'id': f'{n}_E', 'x': (xr - TUCK) * K, 'y': FS * K, 'dir': 'side', 'face': -1, 'verb': '앉기', 'chair': 'side', 'edge': 'inner'},
              {'id': f'{n}_S', 'x': xf * K, 'y': FF * K, 'dir': 'back', 'face': 1, 'verb': '앉기', 'chair': 'back'}]
# 생활 동작 자리(1x 발 위치, 물건 정면 앞; 테이블 뒤 의자 줄 y340보다 뒤)
USE = [('microwave_L', 105, 312, [57, 157]), ('water', 200, 314, [57, 142]), ('vend_purple', 265, 318, [57, 27, 142]),
       ('board', 370, 312, [57]), ('vend_white', 604, 314, [57, 27, 142]), ('coffee', 668, 312, [57, 142]),
       ('sink', 728, 312, [104]), ('snack', 775, 312, [57, 157]), ('microwave_R', 815, 312, [57, 157])]
for sid, x, y, seq in USE:
    spots.append({'id': sid, 'x': x * K, 'y': y * K, 'verb': '쓰기', 'face': 1, 'act': ['npc_use'], 'motions': seq, 'faceDir': 'N'})
m = {'file': 'hq_lounge_strip', 'bgScale': K, 'w': W, 'h': H, 'under': True, 'floor': floor, 'lane': [290 * K, H - 12],
     'blocks': blocks, 'doors': doors, 'lamps': [], 'spots': spots, 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, len(spots), 'spots', len(objects), 'objects')
if len(sys.argv) > 1:   # 확인 그림: 걷는 바닥(초록), 막힘(빨강), 자리(점)
    from PIL import ImageDraw
    b = im.resize((W, H), Image.NEAREST).convert('RGBA'); ov = Image.new('RGBA', b.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    d.polygon([tuple(p) for p in floor], fill=(0, 200, 80, 70), outline=(0, 160, 60, 255))
    for bl in blocks: d.polygon([tuple(p) for p in bl['poly']], fill=(230, 40, 40, 110), outline=(200, 0, 0, 255))
    for s in spots:
        c = (40, 120, 255, 255) if 'chair' in s else (255, 150, 0, 255)
        d.ellipse((s['x'] - 6, s['y'] - 6, s['x'] + 6, s['y'] + 6), fill=c, outline=(0, 0, 0, 255))
        if 'chair' not in s: d.text((s['x'] - 20, s['y'] + 8), s['id'], fill=(0, 0, 0, 255))
    d.rectangle((504 * K, 131 * K, 566 * K, 285 * K), outline=(255, 0, 255, 255), width=3)
    out = Image.alpha_composite(b, ov)
    for o in objects:   # 게임처럼 테이블 그림을 위에 다시 그려 깊이를 보이게
        t = Image.open(OUT / o['file']).convert('RGBA'); t = t.resize((t.width * K, t.height * K), Image.NEAREST)
        out.alpha_composite(t, (o['x'], o['y']))
    out.convert('RGB').save(sys.argv[1])
