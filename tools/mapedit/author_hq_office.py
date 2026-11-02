"""본부 3F 종합대응팀 사무실(office) 장면 원본 (2026-11-02 08:36 사용자 「뒤에 따는 작업이랑 상호작용 핀 박아」).
배경: hq_office_final_1482x424 (2배 고정 = 2964×848). 책상 8·의자 8 = tools/objects/office_desk_place_v4.py 확정 배치
(08:35 「이게 픽스다」: 뒷줄 의자 +40). 그림자는 배경에 굽고, 책상·의자는 오브젝트(그림 그대로, 깊이 = 그림 밑선).
- 걷는 바닥 맨 뒤: 뒷벽 집기(캐비닛·책장·복사기·사물함·냉장고)는 전부 벽에 붙은 것 → 가림 없음, 바닥선이 그 밑을 돈다.
  밑 윤곽선을 4배로 눈으로 읽음(1배): 302~304 (x 838~960 파일함 304가 가장 낮음) → 바닥선 = 304 + 2 = 306 일자.
- 막힘: 책상 덩이(남+북) 바닥 자국 = 북쪽 책상 밑선 22px 위 ~ 남쪽 책상 발(374), 옆으로 몸 반폭 12px 넓힘.
  의자는 막지 않음(앉으러 들어가야 함), 깊이 순서만.
- 상호작용 핀: 자리 8(앉기, 자리 주인) + 배경 물건(복사기 4·정수기·커피머신·화이트보드) + 오른쪽 끝 출입구(사용자 08:09 「출입문 = 오른쪽 벽」).
사용: python3 tools/mapedit/author_hq_office.py [확인그림폴더]"""
import json, os, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'game-src/mapedit/office'
K, W, H = 2, 1482, 424
PLACE = ROOT / 'tools/objects/office_desk_place_v4.py'

tmp = Path(tempfile.mkdtemp())
env = dict(os.environ, SEATED='0', EXPORT=str(tmp / 'exp'), DUMP=str(tmp / 'meta.json'))
subprocess.run([sys.executable, str(PLACE), str(tmp / 'empty.png')], check=True, env=env, stdout=subprocess.DEVNULL)
meta = json.loads((tmp / 'meta.json').read_text()); layers = json.loads((tmp / 'exp/layers.json').read_text())
OUT.mkdir(parents=True, exist_ok=True)
Image.open(tmp / 'exp/strip.png').save(OUT / 'hq_office_strip.png')

BACK = 306           # 걷는 바닥 맨 뒤(1배)
WIDE = 12            # 막힘 옆 여유(1배, 몸 반폭)
DEPTH_N = 22         # 북쪽 책상 밑선에서 위로 바닥 자국(1배 → 2배 44)
floor = [[0, H * K], [0, BACK * K], [W * K, BACK * K], [W * K, H * K]]

# 오브젝트: 층 그림 그대로, 깊이 = 그림 밑선. 책상은 덩이 막힘을 남쪽 책상에 붙임
desks_s = [m for m in meta if m['kind'] == 'desk_s']; desks_n = [m for m in meta if m['kind'] == 'desk_n']
chairs = [m for m in meta if m['kind'] == 'chair']
objects, blocks = [], []
for r in layers:
    (OUT / f"office_{r['file']}").write_bytes((tmp / 'exp' / r['file']).read_bytes())
    o = {'id': f"obj{r['n']:02d}", 'file': f"office_{r['file']}", 'x': r['x'], 'y': r['y'], 'w': r['w'], 'h': r['h'], 'sortY': r['bottom']}
    s = next((d for d in desks_s if d['x'] <= r['x'] < d['x'] + d['w'] and r['bottom'] == d['y'] + d['h'] and abs(r['w'] - d['w']) < 4), None)
    if s:
        n = desks_n[desks_s.index(s)]
        x0, x1 = min(s['x'], n['x']) - WIDE * K, max(s['x'] + s['w'], n['x'] + n['w']) + WIDE * K
        # 북쪽 의자는 북쪽 책상 밑에 반쯤 들어가 있음 → 막힘은 그 의자 발 바로 앞(+4)부터 (자리에 들어갈 수 있게)
        cn = [c for c in chairs if c['chair'] != 'north.png' and n['x'] <= c['cx'] < n['x'] + n['w'] + 200]
        y0 = max(n['y'] + n['h'] - DEPTH_N * K, round(cn[0]['foot'] * K) + 4) if cn else n['y'] + n['h'] - DEPTH_N * K
        y1 = s['y'] + s['h']
        o['solid'] = [{'x0': x0, 'x1': x1, 'y0': y0, 'y1': y1, 'h': 999}]
        o['kind'] = 'desk'
        blocks.append([x0, x1, y0, y1])
    elif any(abs(r['bottom'] - (n['y'] + n['h'])) < 2 and n['x'] <= r['x'] < n['x'] + n['w'] for n in desks_n):
        o['kind'] = 'desk_n'
    else:
        o['kind'] = 'chair'
    objects.append(o)

# 자리 8: 의자 가운데·의자 발. 남쪽(앞줄) = 등 보이고 앉기(sit_back), 북쪽(뒷줄) = 정면 앉기(sit_front)
WHO = {'1.1': '쟈알디', '1.4': '에일린', '1.2': '스팡달', '1.3': '잼트리', '1.9': '데드폴', '1.10': '게슈간', '1.11': '로제몬', '1.12': '콘쥬스'}
SEAT_S = ['1.1', '1.4', '1.2', '1.3']; SEAT_N = ['1.9', '1.10', '1.11', '1.12']
spots = []
ci = [0, 0]
for c in chairs:
    south = c['chair'] == 'north.png'
    key = (SEAT_S if south else SEAT_N)[ci[0 if south else 1]]; ci[0 if south else 1] += 1
    x, y = round(c['cx']), round(c['foot'] * K)
    spots.append({'id': f'desk:{WHO[key]}', 'x': x, 'y': y, 'who': WHO[key], 'verb': '앉기', 'face': 1,
                  'act': ['sit_back' if south else 'sit_front'], 'seat': {'x': x, 'y': y}, 'chairImg': c['chair']})
# 배경 물건 핀(1배 가운데 x, 서는 발 y = 바닥 맨 뒤 + 10). 그림 3배로 보고 잰 물건 폭 가운데
FOOT = BACK + 10
PINS = [('copier1', '복사기', 140), ('copier2', '복사기', 206), ('board', '화이트보드', 282),
        ('water', '정수기', 572), ('coffee', '커피', 631), ('copier3', '복사기', 1253), ('copier4', '복사기', 1356)]
for pid, verb, x in PINS:
    spots.append({'id': pid, 'x': x * K, 'y': FOOT * K, 'verb': verb, 'face': 1, 'act': ['use'], 'say': ''})

# 사람 크기: 앉은 사람 배율 = 의자 배율(배치 도구 scale(y)·CSC 0.75)과 같은 식 → 서 있는 사람도 같은 깊이 배율
S0, HZ, WALL, P, CSC = 62 / 71, 164, 302, 2 / 3, 0.75
def scale(y): f = S0 * (y - HZ) / (WALL - HZ); return S0 + (f - S0) * P
dotK = round(scale(H) * K * CSC, 4)
sizes = [[BACK * K, round(scale(BACK) / scale(H), 3)], [H * K, 1.0]]

m = {'file': 'hq_office_strip', 'bgScale': K, 'dotK': dotK, 'sizes': sizes, 'w': W * K, 'h': H * K, 'under': False,
     'floor': floor, 'lane': [BACK * K, H * K - 12], 'blocks': [], 'lamps': [], 'spots': spots,
     'doors': {'out': {'kind': 'exit', 'side': 'E', 'x': W * K - 20, 'y': 740, 'label': '나가기'}},
     'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(len(objects), 'objects', len(blocks), 'desk blocks', len(spots), 'spots', 'dotK', dotK, 'sizes', sizes)

if len(sys.argv) > 1:
    P = Path(sys.argv[1]); P.mkdir(parents=True, exist_ok=True)
    full = Image.open(tmp / 'empty.png').convert('RGBA')
    d = ImageDraw.Draw(full, 'RGBA')
    try: font = ImageFont.truetype('/usr/share/fonts/opentype/unifont/unifont.otf', 32)
    except OSError: font = ImageFont.load_default()
    d.line([(x, y) for x, y in floor[1:3]], fill=(40, 255, 40), width=3)
    ov = Image.new('RGBA', full.size, (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    for x0, x1, y0, y1 in blocks: od.rectangle([x0, y0, x1, y1], outline=(255, 40, 40, 255), width=3, fill=(255, 40, 40, 70))
    full.alpha_composite(ov); d = ImageDraw.Draw(full, 'RGBA')
    for s in spots:
        col = (255, 220, 0) if s['verb'] == '앉기' else (0, 220, 255)
        d.ellipse([s['x'] - 9, s['y'] - 9, s['x'] + 9, s['y'] + 9], fill=col, outline=(0, 0, 0), width=2)
        t = s.get('who') or s['verb']; tw = d.textlength(t, font=font)
        d.rectangle([s['x'] - tw / 2 - 4, s['y'] - 42, s['x'] + tw / 2 + 4, s['y'] - 14], fill=(0, 0, 0, 190))
        d.text((s['x'] - tw / 2, s['y'] - 40), t, fill=col, font=font)
    ex = m['doors']['out']; d.polygon([(ex['x'], ex['y']), (ex['x'] - 30, ex['y'] - 18), (ex['x'] - 30, ex['y'] + 18)], fill=(255, 80, 255))
    full.convert('RGB').save(P / 'office_map_check_x2.png')
    # 바닥선 4배 확인(뒷벽 밑, 1배 y 280~330)
    for i, x0 in enumerate(range(0, W, 380)):
        x1 = min(W, x0 + 380)
        c = Image.open(OUT / 'hq_office_strip.png').crop((x0 * K, 280 * K, x1 * K, 330 * K)).resize(((x1 - x0) * 4, 200), Image.NEAREST)
        dd = ImageDraw.Draw(c); dd.line([(0, (BACK - 280) * 4), (c.width, (BACK - 280) * 4)], fill=(40, 255, 40), width=2)
        c.save(P / f'office_floor_x4_{i}.png')
