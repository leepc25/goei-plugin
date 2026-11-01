"""관리국 본부 3층(hq_f3) 장면 원본 만들기 (2026-11-01, 사용자 「레이어 딴 다음에 작업」).
그림: game-src/art/pixellab-hq-20261031/hq_f3_v3_full_cut1340.png (1340×424, 첫 판 p1f + 오른쪽 ext1R·ext2R_fix·ext3R, x1340에서 자름). 배경 2배 = 2680×848.
물건은 전부 뒷벽에 붙어 있어 바닥(걷는 곳)보다 위에 있다 → 가림 없음. 바닥 윗선 = 물건 밑(y335)보다 아래 y338(1x) = 676(2x).
문(1x, 격자 확대로 읽은 틀 바깥선): 종합대응팀 유리 이중문 47~135·y139~332, 엘리베이터 262~368·y138~332, 화장실(여) 794~882·y154~332, 휴게실 뿌연 유리문 1190~1278·y154~332.
출력: game-src/mapedit/f3/ (장면 id = f3, PAINTED 열쇠와 같아야 게임이 바꿔 쓴다) → python3 tools/mapedit/import.py game-src/mapedit/f3 f3"""
import json, shutil
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/hq_f3_v3_full_cut1340.png'
OUT = ROOT / 'game-src/mapedit/f3'; OUT.mkdir(parents=True, exist_ok=True)
K = 2
im = Image.open(SRC).convert('RGB'); im.save(OUT / 'hq_f3_strip.png')
W, H = im.width * K, im.height * K
FLOOR_Y = 338 * K
X0, X1 = 50 * K, (1340 - 6) * K  # 왼쪽 끝 = 구석 분리수거함(x0~49, 바닥까지 내려옴) 오른쪽부터, 오른쪽 끝 = 잘린 자리
def door(x0, x1, y0, y1, anim='none'): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': anim, 'behind': 'dark'}
doors = {
    'office': {'kind': 'glass', 'x': 91 * K, 'y': FLOOR_Y + 10, 'to': 'office', 'toDoor': 'out', 'label': '종합대응팀', 'door': door(47, 135, 139, 332)},
    'elev': {'kind': 'elevator', 'x': 315 * K, 'y': FLOOR_Y + 10, 'label': '엘리베이터', 'door': door(262, 368, 138, 332)},
    'wc': {'kind': 'door', 'x': 838 * K, 'y': FLOOR_Y + 10, 'to': 'wc3', 'toDoor': 'out', 'label': '화장실(여)', 'door': door(794, 882, 154, 332)},
    'lounge': {'kind': 'glass', 'x': 1234 * K, 'y': FLOOR_Y + 10, 'to': 'lounge', 'toDoor': 'out', 'label': '휴게실', 'door': door(1190, 1278, 154, 332)},
}
m = {'file': 'hq_f3_strip', 'bgScale': K, 'w': W, 'h': H, 'under': False,
     'floor': [[X0, FLOOR_Y], [X1, FLOOR_Y], [X1, H], [X0, H]], 'lane': [FLOOR_Y, H - 12],
     'blocks': [], 'doors': doors, 'lamps': [], 'spots': [], 'objects': []}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, list(doors))
