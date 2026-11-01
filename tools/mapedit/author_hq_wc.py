"""관리국 본부 화장실 장면 원본 만들기 (2026-11-01, 사용자 「걷기·가림 층 만들고 게임에 넣어」).
- wc  = 2층 남자 화장실: 배경 hq_restroom_m_final_v2_984x424.png + 대변기 칸 3개(확정 v9 배치: FOOT368 RIGHT413 PITCH158).
        오른쪽부터 1·2번 칸만 사용, 맨 왼쪽 칸은 늘 닫힘·미사용. 소변기 4개, 세면대 3개.
- wc3 = 3층 여자 화장실: 배경 hq_restroom_w_bg_974x424.png(남자 확정판 복사, 왼쪽 10px 잘림) + 칸 4개(RIGHT668), 전부 사용. 세면대 3개.
층(그림 차례 = 화면 깊이 차례, tools/bg_fix/stall_toilet_raise.py·stall_women_preview.py와 같음):
  배경 ← 칸 몸통(뒷벽·변기·옆판)·끝 기둥을 구워 넣음 → 사람 → 칸 앞 기둥(가림, 깊이선 = 칸 앞 바닥선 y368) → 칸 문(왼쪽 칸부터, 6장면 0닫힘~5열림)
걷는 바닥(사용자 14:16 「칸 정확하게 아주 정확하게 따라. 특히 소변기는 원근 맞아야 하니까 너무 바짝 따지 말고. 세면대도」):
  칸 앞 = 칸 그림(닫힌 문)의 기둥마다 맨 아래 불투명 픽셀 바로 아래 (기둥 앞 y368, 문 아래 들어간 곳은 문 밑선 아래)
  소변기 앞 = 벽 밑선(y333) + 여유 U_GAP, 세면대 앞 = 세면대 밑선(y338) + 여유 S_GAP, 건조기·휴지통 기둥 = 그 밑선 + 4
출력: game-src/mapedit/wc, wc3 → python3 tools/mapedit/import.py game-src/mapedit/wc wc (wc3도)"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/mapedit'))
from outline_trace import floor_line
D = ROOT / 'game-src/art/objects/restroom'
ART = ROOT / 'game-src/art/pixellab-hq-20261031'
K = 2
FOOT, PITCH = 368, 158
U_GAP, S_GAP, C_GAP = 10, 10, 4         # 1x px: 소변기·세면대 앞 여유(원근), 건조기·휴지통 기둥 앞
U_STAND, S_STAND = 24, 28              # 1x px: 서는 자리 = 밑선 + 이만큼

body = Image.open(D / 'stall_body_tall.png').convert('RGBA')
body_end = Image.open(D / 'stall_body_end_tall.png').convert('RGBA')
endpost = Image.open(D / 'stall_endpost.png').convert('RGBA')
doors = [Image.open(D / f'stall_door_{i}.png').convert('RGBA') for i in range(6)]
SEAT = (133, 182)                        # 칸 캔버스 안 변기 좌석 가운데(엉덩이) — stall_toilet_raise.py SEAT(147-X0, 196-R)


def comp(dst, src, xy):
    """alpha_composite인데 왼쪽·위로 삐져나가도 된다 (여자 화장실 맨 왼쪽 칸은 화면 왼쪽 끝에 걸친다)"""
    x, y = xy
    sx, sy = max(0, -x), max(0, -y)
    dst.alpha_composite(src.crop((sx, sy, src.width, src.height)), (x + sx, y + sy))


def build(sid, bg_file, right, n, cut, used, urinals, sinks, exit_x, label):
    out = ROOT / 'game-src/mapedit' / sid; out.mkdir(parents=True, exist_ok=True)
    for f in out.glob('part_*.png'): f.unlink()
    bg0 = Image.open(ART / bg_file).convert('RGBA')
    W1, H1 = bg0.size
    xs = [right - 206 - PITCH * i - cut for i in range(n)]       # i=0 맨 오른쪽 칸
    y = FOOT - 252
    # 1) 칸 몸통·끝 기둥을 배경에 굽는다 (사람보다 늘 뒤)
    bg = bg0.copy()
    for i, x in enumerate(xs): comp(bg, body_end if i == 0 else body, (x, y))
    comp(bg, endpost, (xs[0], y))
    bg.convert('RGB').save(out / f'hq_{sid}_strip.png')
    # 2) 칸 앞 기둥(가림): 몸통의 x44~75(왼쪽 옆판 앞)·x170~(가운데 기둥) + 끝 기둥 → 칸마다 한 장
    objects = []
    def put(im, x, y, name, sortY, extra=None):
        bb = im.getbbox()
        if not bb: return None
        c = im.crop(bb); c = c.resize((c.width * K, c.height * K), Image.NEAREST); c.save(out / f'{name}.png')
        o = {'id': name.replace('part_', ''), 'file': name, 'x': (x + bb[0]) * K, 'y': (y + bb[1]) * K, 'w': c.width, 'h': c.height, 'sortY': sortY, **(extra or {})}
        objects.append(o); return o
    for i, x in enumerate(xs):
        b = body_end if i == 0 else body
        f = Image.new('RGBA', b.size, (0, 0, 0, 0))
        f.alpha_composite(b.crop((170, 0, b.width, b.height)), (170, 0))
        f.alpha_composite(b.crop((44, 0, 76, b.height)), (44, 0))
        if i == 0: f.alpha_composite(endpost)
        put(f, x, y, f'part_front{i}', FOOT * K)
    # 3) 문: 6장면, 같은 캔버스. 깊이선은 앞 기둥보다 살짝 뒤에 그리게(왼쪽 칸 문부터 → 오른쪽 칸 문이 위)
    for i, x in enumerate(xs):
        names = []
        bbs = [d.getbbox() for d in doors]
        x0 = min(bb[0] for bb in bbs); y0 = min(bb[1] for bb in bbs); x1 = max(bb[2] for bb in bbs); y1 = max(bb[3] for bb in bbs)
        for s, d in enumerate(doors):
            c = d.crop((x0, y0, x1, y1)); c = c.resize((c.width * K, c.height * K), Image.NEAREST)
            nm = f'part_door{i}_{s}'; c.save(out / f'{nm}.png'); names.append(nm)
        objects.append({'id': f'door{i}', 'file': names[0], 'frames': names, 'x': (x + x0) * K, 'y': (y + y0) * K, 'w': (x1 - x0) * K, 'h': (y1 - y0) * K,
                        'sortY': FOOT * K + 0.5 + (n - i) * 0.01})
    # 4) 걷는 바닥 윗선(1x, 기둥마다)
    line = floor_line(bg0.convert('RGB'), 380)
    top = [0] * W1
    for xx in range(W1):
        ly = line[xx]
        if ly <= 334: top[xx] = ly + U_GAP          # 소변기 벽(여자: 민 벽·칸 뒤)
        elif ly >= 338: top[xx] = ly + S_GAP        # 세면대
        else: top[xx] = ly + C_GAP                  # 건조기·휴지통 기둥
    # 칸 앞: 닫힌 칸 그림(몸통+끝 기둥+닫힌 문)의 맨 아래 불투명 픽셀 + 1
    st = Image.new('RGBA', (W1, H1), (0, 0, 0, 0))
    for i, x in enumerate(xs): comp(st, body_end if i == 0 else body, (x, y))
    comp(st, endpost, (xs[0], y))
    for x in xs: comp(st, doors[0], (x, y))
    a = np.array(st)[..., 3] > 0
    stall_r = xs[0] + 206
    for xx in range(0, min(W1, stall_r)):
        col = np.nonzero(a[:, xx])[0]
        if len(col): top[xx] = max(top[xx], int(col.max()) + 1)
    # 문 밑 들어간 곳이 기둥 사이 좁은 틈(<6px)이면 막는다(발이 기둥에 끼지 않게)
    floor = [[0, top[0] * K]]
    for xx in range(1, W1):
        if top[xx] != top[xx - 1]: floor += [[xx * K, top[xx - 1] * K], [xx * K, top[xx] * K]]
    floor += [[W1 * K, top[-1] * K], [W1 * K, H1 * K], [0, H1 * K]]
    # 5) 쓰는 자리(1x → 2x): 칸(문 앞에서 E → 안으로), 소변기, 세면대
    toilets = []
    for i, x in enumerate(xs):
        if i not in used: continue
        dx = x + 117                                   # 문 가운데(캔버스 x63~171)
        toilets.append({'id': f'stall{i}', 'kind': 'stall', 'door': f'door{i}', 'x': dx * K, 'y': (FOOT + 6) * K,
                        'seat': {'x': (x + SEAT[0]) * K, 'y': (y + SEAT[1]) * K}})
    for j, ux in enumerate(urinals):
        toilets.append({'id': f'urinal{j}', 'kind': 'urinal', 'x': round(ux * K), 'y': (line[round(ux)] + U_STAND) * K})
    for j, sx in enumerate(sinks):
        toilets.append({'id': f'sink{j}', 'kind': 'sink', 'x': round(sx * K), 'y': (line[round(sx)] + S_STAND) * K})
    W, H = W1 * K, H1 * K
    exits = {'out': {'kind': 'exit', 'x': exit_x * K, 'y': H - 40, 'label': label}}
    m = {'file': f'hq_{sid}_strip', 'bgScale': K, 'w': W, 'h': H, 'under': False,
         'floor': floor, 'lane': [min(top) * K, H - 12], 'blocks': [], 'doors': exits, 'lamps': [], 'spots': [], 'objects': objects,
         'toilets': toilets}
    (out / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
    print(sid, W, H, 'stalls x(1x)', xs, 'used', used, 'top min/max', min(top), max(top))
    return m


if __name__ == '__main__':
    # 남: 칸 3개(오른쪽부터 0·1번 사용, 2번 = 맨 왼쪽 닫힘 고정), 소변기 4개 가운데(흰 그릇 y300), 세면대 수도꼭지 3개
    build('wc', 'hq_restroom_m_final_v2_984x424.png', 413, 3, 0, {0, 1}, [440, 505, 569.5, 632.5], [804, 880, 957], 930, '나가기')
    # 여: 칸 4개 전부 사용(맨 왼쪽은 화면 왼쪽 끝에 걸침), 소변기 없음, 세면대 3개 (배경이 10px 잘려 x -10)
    build('wc3', 'hq_restroom_w_bg_974x424.png', 668, 4, 10, {0, 1, 2, 3}, [], [794, 870, 947], 920, '나가기')
