"""손길 대기실 마무리 (사용자 11-02 15:06 「지운거 쓴다」 + 13:55 C06 서향 v2 「이대로 픽스」).
- 배경: songil_v8_noplant(화분 코드로 지운 판). 화분 가림(plant)·화분 막힘 뺌. 원본 songil_v8 그림은 그대로 둠.
- 대기 의자 C06 서향(옆모습, game-src/action/objects/C06_대기의자_돌리기/west.png, 브랜치 x0zdau): 다리 받침 가운데(그림 129,216)를
  2배 (913,759)에, 배율 kc = persp(759)·dotK/1.07 = 1.323 → 오브젝트 그림(sortY = 다리 바닥 759).
- 막힘 = 의자 다리 받침(그림 y190~219, 마름모) ±12.
- 앉는 자리 3(먼 자리부터): 좌석점(그림) 128,99 / 140,122 / 151,146, 옆 앉기(sit_side) 서쪽 봄. seat = C01 서향 원점과 같은 자리
  (좌석점 − (17, −74)·사람배율), seatPt = 좌석점(협회 창구 C06 자리와 같은 꼴: bench 'C06').
  ※ 게임 엔진은 아직 C06 긴 의자 앉기(가까운 좌석이 먼 자리 사람 앞에 오는 가림, C01 의자 안 그리기)를 모름 → 필드 기능 스레드에서 연결.
"""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
p = ROOT / 'game-src/mapedit/jr_songil/map.json'
m = json.loads(p.read_text())
m['file'] = 'songil_v8_noplant_632x424'
m['objects'] = [o for o in m['objects'] if o['id'] != 'plant']
m['blocks'] = [b for b in m['blocks'] if b['poly'] != [[915, 770], [1002, 770], [1002, 848], [915, 848]]]
def persp(y):
    sz = m['sizes']
    for (y0, k0), (y1, k1) in zip(sz, sz[1:]):
        if y <= y1: return k0 + (k1 - k0) * (y - y0) / (y1 - y0)
    return sz[-1][1]
FX, FY = 913, 759
kp = persp(FY) * m['dotK']; kc = kp / 1.07
ox, oy = round(FX - 129 * kc), round(FY - 216 * kc)
S = round(256 * kc)
m['objects'] = [o for o in m['objects'] if o['id'] != 'bench'] + [{'id': 'bench', 'name': '대기 의자(C06 서향)', 'file': 'c06_west', 'x': ox, 'y': oy, 'w': S, 'h': S, 'sortY': FY}]
G = lambda x, y: [round(ox + x * kc), round(oy + y * kc)]
foot = [G(115, 190), G(153, 190), G(175, 215), G(175, 219), G(94, 219), G(94, 214)]
xs = [q[0] for q in foot]; cx = (min(xs) + max(xs)) / 2
foot = [[round(x + (12 if x > cx else -12)), y] for x, y in foot]
m['blocks'] = [b for b in m['blocks'] if b.get('id') != 'bench'] + [{'id': 'bench', 'poly': foot, 'h': 999}]
spots = []
for i, (sx, sy) in enumerate([(128, 99), (140, 122), (151, 146)]):
    P = G(sx, sy); O = [round(P[0] - 17 * kp), round(P[1] + 74 * kp)]
    spots.append({'id': f'wait{i + 1}', 'x': 850, 'y': O[1], 'shared': True, 'verb': '앉기', 'face': -1, 'act': ['sit_side'],
                  'seat': {'x': O[0], 'y': O[1]}, 'bench': 'C06', 'seatPt': {'x': P[0], 'y': P[1]}})
m['spots'] = [s for s in m.get('spots', []) if not s['id'].startswith('wait')] + spots
p.write_text(json.dumps(m, ensure_ascii=False, indent=1))
print('kp', round(kp, 4), 'kc', round(kc, 4), 'bench', ox, oy, S, 'foot', foot, 'spots', [(s['seat'], s['seatPt']) for s in spots])
