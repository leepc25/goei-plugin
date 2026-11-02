"""백일몽 17층 연구1팀 연구실 장면 원본 (2026-11-02 사용자 15:55 「양호하군. 오른쪽 문은 의무실이랑 연결」).
그림: by_lab_f17_ext1R_v2.png (p5 + 오른쪽 옆벽 잇기, 916×424). 배경 2배.
읽은 값(1x): 뒷벽 바닥선 y320(x 0~720), 오른쪽 옆벽 모서리 (720,320) → 밑선 (916,385) 비스듬,
옆벽 의무실 문 x745~830·y125~355(밑 비스듬). 나가는 곳 = 화면 아래(17층 복도 연구1팀 유리문).
출력: game-src/mapedit/by_lab/ → python3 tools/mapedit/import.py game-src/mapedit/by_lab by_lab"""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
K = 2
im = Image.open(ROOT / 'game-src/art/pixellab-baekilmong/by_lab_f17_ext1R_v2.png').convert('RGB'); W, H = im.width * K, im.height * K
FY = 320 * K
floor = [[0, FY], [720 * K, FY], [916 * K, 385 * K], [W, H], [0, H]]
# 실험대 L05 서향(사용자 15:55 「책상 용도 실험대 하나 왼쪽에, 서쪽 보게」): west.png(256) 2배 = 배경과 같은 배율.
# 그림 속 다리 밑 y213, 다리 폭 x93~173, 상판 높이 ≈ 70(1x) → 발판 높이 140 (올라설 수 있음)
BX, FOOT = 300, 770          # 다리 가운데 x·다리 밑 y (월드)
S2 = 1.25         # 2배는 상판이 어깨 높이 → 허리 높이로 줄임
ox, oy = round(BX - 133 * S2), round(FOOT - 213 * S2)
BENCH = {'id': 'bench_l05', 'file': 'L05_west.png', 'x': ox, 'y': oy, 'w': round(256 * S2), 'h': round(256 * S2), 'sortY': FOOT,
         'solid': [{'x0': round(ox + 93 * S2), 'x1': round(ox + 173 * S2), 'y0': FOOT - 24, 'y1': FOOT, 'h': 88}]}
out = ROOT / 'game-src/mapedit/by_lab'; out.mkdir(parents=True, exist_ok=True)
im.save(out / 'by_lab.png')
m = {'file': 'by_lab', 'bgScale': K, 'w': W, 'h': H, 'under': False, 'floor': floor, 'lane': [FY + 4, H - 12],
     'blocks': [], 'lamps': [], 'spots': [], 'objects': [BENCH],
     'doors': {
         'out': {'kind': 'exit', 'side': 'S', 'x': 300 * K, 'y': H - 8, 'label': '나가기'},
         'infirmary': {'kind': 'door', 'x': 770 * K, 'y': 352 * K, 'label': '의무실',
                       'door': {'x0': 745 * K, 'x1': 830 * K, 'y0': 125 * K, 'y1': 355 * K, 'anim': 'none', 'behind': 'dark'}},
     }}
(out / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1)); print('by_lab', W, H, list(m['doors']))
