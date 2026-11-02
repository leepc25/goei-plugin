"""백일몽 본사 1층 로비 · 15층 복도 장면 원본 만들기 (2026-11-02).
- 로비(사용자 14:02 카드 「로비 붙여 거리에서 들어가기」): 확정 그림 by_lobby_final_632x424.png(=g2, 11:51 채택). 배경 2배.
  읽은 값(1x, 2배 눈금): 뒷벽 바닥선 y300(x≥160), 왼쪽 유리 옆벽 밑선 (160,302)→(0,392) 비스듬, 엘리베이터 문짝 262~368·y177~298(이음 315),
  왼쪽 옆벽 유리 양문 x75~135·y170~345, 오른쪽 안내 데스크 x450~632 앞 밑선 y318(막힘: 바닥에서 뺌. 뒤로 들어갈 틈 없음).
  사람 배율: 엘리베이터 문짝 242px(2배) → 맨 뒤 사람 약 0.85배 문 높이 = 배율 0.88, 앞으로 크게(far 0.75 → dotK 1.17).
- 15층(사용자 14:05 「휴게실이 13층에 있으니까 15층은 필요 없잖아 적당이 잘라야해」): 13층 확정 그림을 휴게실 문틀 바로 앞 x1246에서 자름
  (엘리베이터 오른쪽 기둥 + 벽등 판넬까지 남김). 문 4개(남·여 = 샤워실, 유리 양문 = 정예팀, 엘리베이터).
출력: game-src/mapedit/by_lobby/, game-src/mapedit/by_f15/ → python3 tools/mapedit/import.py game-src/mapedit/<id> <id>"""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'game-src/art/pixellab-baekilmong'
K = 2
def door(x0, x1, y0, y1, **kw): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'behind': 'dark', **kw}
def save(sid, im, m):
    out = ROOT / 'game-src/mapedit' / sid; out.mkdir(parents=True, exist_ok=True)
    im.save(out / f'{sid}.png'); (out / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1)); print(sid, m['w'], m['h'], list(m['doors']))

# 로비
im = Image.open(ART / 'by_lobby_final_632x424.png').convert('RGB'); W, H = im.width * K, im.height * K
FY = 300 * K
floor = [[160 * K, 302 * K], [450 * K, 302 * K], [450 * K, 318 * K], [W, 318 * K], [W, H], [0, H], [0, 392 * K]]
save('by_lobby', im, {'file': 'by_lobby', 'bgScale': K, 'w': W, 'h': H, 'under': False, 'dotK': 1.17, 'far': 0.75,
    'floor': floor, 'lane': [FY + 4, H - 12], 'blocks': [], 'lamps': [], 'spots': [], 'objects': [],
    'doors': {
        'main': {'kind': 'glass', 'x': 118 * K, 'y': 345 * K, 'label': '정문', 'door': door(75, 135, 170, 345, anim='none')},
        'elev': {'kind': 'elevator', 'x': 315 * K, 'y': FY + 14, 'label': '엘리베이터', 'door': door(262, 368, 177, 298, anim='slide2', seam=315 * K, behind='car')},
    }})

# 15층
CUT = 1246
im = Image.open(ART / 'by_f13_hall_g4_full_fix.png').convert('RGB').crop((0, 0, CUT, 424)); W, H = im.width * K, im.height * K
FY = 330 * K
save('by_f15', im, {'file': 'by_f15', 'bgScale': K, 'w': W, 'h': H, 'under': False,
    'floor': [[0, FY], [W, FY], [W, H], [0, H]], 'lane': [FY, H - 12], 'blocks': [], 'lamps': [], 'spots': [], 'objects': [],
    'doors': {
        'wc_m': {'kind': 'door', 'x': 126 * K, 'y': FY + 10, 'label': '샤워실(남)', 'door': door(83, 170, 122, 328, anim='none')},
        'wc_f': {'kind': 'door', 'x': 400 * K, 'y': FY + 10, 'label': '샤워실(여)', 'door': door(357, 443, 120, 328, anim='none')},
        'office': {'kind': 'glass', 'x': 721 * K, 'y': FY + 10, 'label': '정예팀 사무실', 'door': door(639, 802, 118, 327, anim='none')},
        'elev': {'kind': 'elevator', 'x': 1059 * K, 'y': FY + 10, 'label': '엘리베이터', 'door': door(1000, 1118, 127, 327, anim='slide2', seam=1059 * K, behind='car')},
    }})
