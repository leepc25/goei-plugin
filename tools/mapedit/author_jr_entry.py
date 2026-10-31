"""중림 지상(jr_entry) 장면 원본 만들기 (사용자 10-31 「이걸로 픽스」「0.85로 하면 되겠네」).
그림: game-src/art/pixellab-test-20261028/jr_entry_street_v1_final.png (1418×424) → 배경 2배 2836×848(지하와 같은 배율).
사람 배율 dotK 0.85(그림 원래 크기의 0.85배, 앞 199px·뒤 169px): 뒷줄 「제일수선」 문짝 184px 기준(사용자).
걷는 바닥: 인도만(건물 밑선 앞 y600 ~ 연석 위 y700), 차도는 못 감. 왼쪽 끝은 버스 정류장 기둥 오른쪽까지(정류장 뒤로 안 감 → 가림 없음),
오른쪽 끝은 지하상가 입구 기둥 앞까지. 문: 지하상가 입구(지하 1층으로), 버스 정류장(임시로 원래 west 출구 대상).
출력: game-src/mapedit/jr_entry/ → python3 tools/mapedit/import.py game-src/mapedit/jr_entry jr_entry"""
import json, shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
A = ROOT / 'game-src/art/pixellab-test-20261028'
OUT = ROOT / 'game-src/mapedit/jr_entry'; OUT.mkdir(parents=True, exist_ok=True)
shutil.copy(A / 'jr_entry_street_v1_final.png', OUT / 'jr_entry_street.png')
K, W, H = 2, 1418 * 2, 424 * 2
Y0, Y1 = 600, 700
X0, X1 = 125 * K, 1195 * K
def door(x0, x1, y0, y1): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'anim': 'none', 'behind': 'dark'}
doors = {
    'west': {'kind': 'door', 'x': 140 * K, 'y': Y0 + 10, 'to': 'street', 'toDoor': 'jr', 'label': '버스 정류장', 'door': door(110, 170, 200, 300)},
    'down': {'kind': 'door', 'x': 1215 * K, 'y': Y0 + 10, 'to': 'jr_b1', 'toDoor': 'up', 'label': '지하상가로 내려가기', 'door': door(1195, 1235, 250, 345)},
}
m = {'file': 'jr_entry_street', 'bgScale': K, 'dotK': 0.85, 'w': W, 'h': H, 'under': True,
     'floor': [[X0, Y0], [X1, Y0], [X1, Y1 + 12], [X0, Y1 + 12]], 'lane': [Y0, Y1],
     'blocks': [], 'doors': doors, 'lamps': [], 'spots': [], 'objects': []}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, list(doors))
