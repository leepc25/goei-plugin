"""중림 막힘 정밀 다시 따기(11-02 14:27 사용자 「새 스레드에서 정밀하게 수정」).

좌표는 모두 2배 지도 좌표(1264×848), 배경을 3배로 키워 다리 발끝을 손으로 찍어 정한 값.
- 대박 포커 테이블: 왼쪽 다리 발 (1010,668), 앞 다리 발 (1112,752), 뒤 다리 발 (1145,655).
  막힘 = 벽 밑(592)부터 상판이 덮는 바닥 앞끝까지(타원 왼쪽 끝 둥글게, 몸 반폭 여유 12).
  테이블 뒤와 벽 사이는 사람보다 좁은 틈이라 같이 막는다.
  가림 = 한 장(sortY 760)이면 테이블 왼쪽 앞에 선 사람까지 덮으므로, 세로 띠로 나눠 띠마다 그 x의 앞끝 y를 sortY로.
- 진료실 침대: 머리 쪽 다리 발 (918,633)→(1057,795) 대각선이 침대 앞끝. 그 오른쪽(수레 앞까지)을 침대 발판 h165,
  계단 발판(아래 칸 h36, 위 칸 h70)도 발판으로. 침대 가림 sortY = 침대 뒤끝 627(위에 선 사람이 가려지지 않게).
  눕기 자리 서는 곳은 계단 앞 바닥 (960,742)으로.
- 진료실 책상: 앞 다리 발 (115,773)·(350,775), 오른쪽 뒤 다리 발 (482,600). 왼쪽 벽과 책상 옆 사이 틈은
  폭 40(사람 폭)보다 좁은 위쪽만 막고 아래는 걸을 수 있게.
실행 뒤: python3 tools/mapedit/import.py game-src/mapedit/<방> <방>
"""
import base64, io, json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def load(sid):
    return json.loads((ROOT / f'game-src/mapedit/{sid}/map.json').read_text())


def save(sid, m):
    (ROOT / f'game-src/mapedit/{sid}/map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))


def mask_of(o):
    im = Image.open(io.BytesIO(base64.b64decode(o['coverMask'].split(',', 1)[1]))).convert('L')
    return im.resize((o['w'], o['h']), Image.NEAREST)


def url(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


# ---------- 대박 포커 테이블 ----------
TABLE_FRONT = [(972, 600), (976, 650), (982, 668), (990, 695), (1010, 720), (1040, 742), (1075, 758), (1112, 766), (1264, 768)]


def front_y(x):
    pts = TABLE_FRONT
    if x <= pts[0][0]: return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1: return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


def daebak():
    m = load('jr_daebak')
    # 막힘: 옛 테이블 네모(990~1264 × 640~760) → 벽 밑부터 앞끝 곡선까지
    poly = [[960, 592], [1264, 592], [1264, 768]] + [[x, y] for x, y in reversed(TABLE_FRONT[1:-1])] + [[960, 650]]
    m['blocks'] = [b for b in m['blocks'] if b['poly'] != [[990, 640], [1264, 640], [1264, 760], [990, 760]]]
    m['blocks'].append({'poly': poly, 'h': 999})
    # 가림: 테이블 한 장 → 세로 띠(앞끝 곡선 따라 sortY)
    objs = []
    for o in m['objects']:
        if o['id'] != 'table': objs.append(o); continue
        mk = mask_of(o)
        cuts = list(range(o['x'], 1112, 20)) + [1112, o['x'] + o['w']]
        for i, (a, b) in enumerate(zip(cuts, cuts[1:])):
            sub = mk.crop((a - o['x'], 0, b - o['x'], o['h']))
            if not sub.getbbox(): continue
            objs.append({'id': f'table{i}', 'name': '포커 테이블', 'file': '', 'x': a, 'y': o['y'], 'w': b - a, 'h': o['h'],
                         'sortY': round(front_y(a)), 'coverMask': url(sub)})
    m['objects'] = objs
    save('jr_daebak', m)


# ---------- 진료실 ----------
def jinryo():
    m = load('jr_jinryo')
    old_desk = [[100, 600], [395, 570], [490, 565], [490, 648], [125, 785], [0, 790], [0, 600]]
    old_bed = [[903, 595], [1082, 595], [1082, 700], [903, 700]]
    keep = [b for b in m['blocks'] if b['poly'] not in (old_desk, old_bed)]
    assert len(keep) == len(m['blocks']) - 2, '옛 막힘을 못 찾음'
    desk = [[90, 738], [390, 575], [494, 560], [494, 606], [360, 782], [108, 782], [108, 752]]
    rect = lambda x0, y0, x1, y1, h: {'poly': [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 'h': h}
    bed = [
        rect(925, 628, 1075, 662, 165),   # 침대 뒤쪽(벽 칸막이 앞) — 눕는 자리 (995,640)
        rect(1032, 662, 1075, 765, 165),  # 침대 가운데(계단 오른쪽, 수레 앞까지)
        rect(1000, 724, 1032, 765, 165),  # 침대 밑 앞(계단 앞쪽 대각선 안)
        rect(1048, 765, 1075, 800, 165),  # 앞 다리 (1057,795) 둘레
        rect(914, 668, 965, 728, 36),     # 계단 아래 칸
        rect(965, 662, 1032, 724, 70),    # 계단 위 칸
    ]
    m['blocks'] = [{'poly': desk, 'h': 999}] + keep + bed
    for o in m['objects']:
        if o['id'] == 'bed': o['sortY'] = 627
    for s in m['spots']:
        if s['id'] == 'bed': s['x'], s['y'] = 960, 742
    save('jr_jinryo', m)


if __name__ == '__main__':
    daebak(); jinryo(); print('ok')
