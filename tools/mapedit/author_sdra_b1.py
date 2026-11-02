"""특수재난대응협회 지하 1층 복도 장면 원본 만들기 (2026-11-02 11:01 사용자 「지하는 저걸로 픽스」).
그림: game-src/art/pixellab-hq-20261031/sdra_b1_p3_ext2L_v3.png (1152×424 = p3 + 왼쪽 잇기 1(여자 문) + 왼쪽 잇기 2 v3(남자 문)). 배경 2배 = 2304×848.
방 안은 전부 관리국 그림을 그대로 쓴다(사용자 11:02 「협회 방 내부는 전부 관리국걸」): 탈의실·샤워실 남/여, 훈련장 → map.ts sdra_shower_*·sdra_bath_*·sdra_training.
문 문짝(1x, 8배 격자로 읽음): 탈의실(남) 82~157·y152~325, 탈의실(여) 240~314·y152~325, 훈련장 양문 539~663·y154~326(이음 601),
엘리베이터 779~896·y153~325(이음 835).
바닥 윗선 = 뒷벽에 붙은 물건 밑(왼쪽 상자 y340, 수레 바퀴 y340, 분리수거함 y334, 미끄럼 표지 y336)보다 아래 y342. 벽 붙은 물건은 가림 없음.
바닥 한가운데 물건 = 오른쪽 아래 앞 상자 2개(카메라 쪽): 8배 격자로 손으로 읽은 윤곽 → 가림(사람보다 앞), 발밑은 막힘(옆 여유 12px).
출력: game-src/mapedit/sdra_b1/ → python3 tools/mapedit/import.py game-src/mapedit/sdra_b1 sdra_b1"""
import json
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/art/pixellab-hq-20261031/sdra_b1_p3_ext2L_v3.png'
OUT = ROOT / 'game-src/mapedit/sdra_b1'; OUT.mkdir(parents=True, exist_ok=True)
K = 2
im = Image.open(SRC).convert('RGB'); im.save(OUT / 'sdra_b1.png')
W, H = im.width * K, im.height * K
FLOOR_Y = 342 * K
def door(x0, x1, y0, y1, **kw): return {'x0': x0 * K, 'x1': x1 * K, 'y0': y0 * K, 'y1': y1 * K, 'behind': 'dark', **kw}
doors = {
    'shower_m': {'kind': 'door', 'x': 120 * K, 'y': FLOOR_Y + 10, 'to': 'sdra_shower_m', 'toDoor': 'out', 'label': '탈의실(남)', 'door': door(82, 157, 152, 325, anim='none')},
    'shower_f': {'kind': 'door', 'x': 277 * K, 'y': FLOOR_Y + 10, 'to': 'sdra_shower_f', 'toDoor': 'out', 'label': '탈의실(여)', 'door': door(240, 314, 152, 325, anim='none')},
    'training': {'kind': 'steel', 'x': 601 * K, 'y': FLOOR_Y + 10, 'to': 'sdra_training', 'toDoor': 'out', 'label': '훈련장', 'door': door(539, 663, 154, 326, anim='none')},
    'elev': {'kind': 'elevator', 'x': 835 * K, 'y': FLOOR_Y + 10, 'label': '엘리베이터', 'door': door(779, 896, 153, 325, anim='slide2', seam=835 * K, behind='car')},
}
# 앞 상자 2개 윤곽(1x, 바깥 검은 선 포함): 앞 상자 윗선 y389 x1002~1087, 오른쪽 비스듬한 모서리 → (1101,398), 뒤 상자 왼쪽 선 x1102 y366~, 윗선 y366 → 오른쪽 끝
CRATES = [(1002, 424), (1002, 390), (1003, 389), (1088, 389), (1101, 398), (1102, 398), (1102, 367), (1103, 366), (1152, 366), (1152, 424)]
mk = Image.new('L', im.size, 0); ImageDraw.Draw(mk).polygon(CRATES, fill=255, outline=255)
bb = mk.getbbox(); cut = im.crop(bb).convert('RGBA'); cut.putalpha(mk.crop(bb))
cut = cut.resize((cut.width * K, cut.height * K), Image.NEAREST); cut.save(OUT / 'part_crates.png')
objects = [{'id': 'crates', 'file': 'part_crates', 'x': bb[0] * K, 'y': bb[1] * K, 'w': cut.width, 'h': cut.height, 'sortY': H - 12}]
# 발밑 막힘: 앞 상자 윗면 앞쪽(y395~) + 뒤 상자(y384~), 왼쪽 옆 여유 12px
blocks = [{'poly': [[x * K, y * K] for x, y in [(990, 430), (990, 395), (1090, 395), (1090, 384), (1152, 384), (1152, 430)]], 'h': 999}]
m = {'file': 'sdra_b1', 'bgScale': K, 'w': W, 'h': H, 'under': False,
     'floor': [[0, FLOOR_Y], [W, FLOOR_Y], [W, H], [0, H]], 'lane': [FLOOR_Y, H - 12],
     'blocks': blocks, 'doors': doors, 'lamps': [], 'spots': [], 'objects': objects}
(OUT / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
print(W, H, list(doors), bb)
