"""관리국 B2 격리팀 사무실(연구실, 장면 id clinic) 장면 원본 (2026-11-02 사용자 18:21 「격리팀 사무실은 여전히 회색박스고」 → 게임 연결).
그림: hq_b2_lab_p20_1703x424.png (격리팀 연구실 스레드 p20, 1703×424). 배경 2배.
읽은 값(1x, 4배 확대 그림 ov_left/ov_right로 눈으로 확인):
 - 왼쪽 옆벽 밑선: (0,374) → 모서리 (240,303) 비스듬(기울기 0.3). 옆벽 문(지하 2층 복도) 틀 x95~170·y127~341(밑 비스듬).
 - 뒷벽 밑선: y303 (x240~1517). 벽에 붙은 장(캐비닛·랙)은 전부 뒷벽 → 밑선으로만 막음(가림 없음).
 - 오른쪽 옆벽: 모서리 (1517,303) → (1703,364). 옆벽 끝 문(의무실) x1657~1703·y150~350.
 - 바닥 가운데 물건: 유리 챔버 로봇팔 작업대·바퀴 카트·장비 상자 2 = x1222~1470·밑 y340~347 → 벽까지 한 덩어리로 막음(뒤에 설 틈 25px뿐, 가림 없음).
   오른쪽 벽 앞 조작 콘솔 x1463~1600·밑 y327~338 → 막음.
출력: game-src/mapedit/clinic/ → python3 tools/mapedit/import.py game-src/mapedit/clinic clinic"""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
K = 2
im = Image.open(ROOT / 'game-src/art/pixellab-hq-20261031/hq_b2_lab_p20_1703x424.png').convert('RGB'); W, H = im.width * K, im.height * K
FY = 303 * K
floor = [[0, 374 * K], [240 * K, FY], [1517 * K, FY], [1703 * K, 364 * K], [W, H], [0, H]]
blocks = [
    {'id': 'bench_cart', 'poly': [[1222 * K, FY], [1470 * K, FY], [1470 * K, 350 * K], [1222 * K, 350 * K]], 'h': 999},
    {'id': 'console', 'poly': [[1463 * K, FY], [1600 * K, FY], [1600 * K, 340 * K], [1463 * K, 340 * K]], 'h': 999},
]
out = ROOT / 'game-src/mapedit/clinic'; out.mkdir(parents=True, exist_ok=True)
im.save(out / 'clinic.png')
m = {'file': 'clinic', 'bgScale': K, 'w': W, 'h': H, 'under': False, 'floor': floor, 'lane': [FY + 4, H - 12],
     'blocks': [{'poly': b['poly'], 'h': b['h']} for b in blocks], 'lamps': [], 'spots': [], 'objects': [],
     'doors': {
         'out': {'kind': 'door', 'x': 132 * K, 'y': 345 * K, 'label': '나가기',
                 'door': {'x0': 95 * K, 'x1': 170 * K, 'y0': 127 * K, 'y1': 341 * K, 'anim': 'none', 'behind': 'dark'}},
         'infirmary': {'kind': 'door', 'x': 1680 * K, 'y': 372 * K, 'label': '의무실',
                       'door': {'x0': 1657 * K, 'x1': 1703 * K, 'y0': 150 * K, 'y1': 350 * K, 'anim': 'none', 'behind': 'dark'}},
     }}
(out / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1)); print('clinic', W, H, list(m['doors']))
