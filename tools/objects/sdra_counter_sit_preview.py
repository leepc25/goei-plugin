"""협회 2층 창구(sdra_counter_p7_ext1L_v2) 사무의자 C01 + 앉힌 인물 미리보기 (2026-11-02 사용자 핀).
배경 2배 캔버스 기준 자리: (x2, 바닥 y2, 배율, 보는 쪽, 키). 가림 = 앞 물체 줄(임시 가로선, 확정 때 손으로 다시 딴다)."""
import sys, os
from pathlib import Path
R = Path('/home/user/goei-plugin'); HERE = R/'game-src/action/testroom3'
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE/'qa')); sys.argv = sys.argv[:1]
import fit_chair as fc
from PIL import Image
BG = Image.open(R/'game-src/art/pixellab-hq-20261031/sdra_counter_p7_ext1L_v2.png').convert('RGBA')
BG2 = BG.resize((BG.width*2, BG.height*2), Image.NEAREST)
VIEW = {'front': 'front', 'side': 'side'}
SEATS = [  # x2, floor y2, scale, view, key, occl_y2(이 줄 아래는 배경이 앞), x-range
    (1352, 452, float(os.environ.get('SB', '0.6')), 'front', '6.25_협회남1', int(os.environ.get('OB', '386')), (1300, 1410)),
    (1110, 452, float(os.environ.get('SB', '0.6')), 'front', '6.27_협회여1', int(os.environ.get('OB', '386')), (1055, 1165)),
    (860, 456, float(os.environ.get('SB', '0.6')), 'side', '6.26_협회남2', int(os.environ.get('OE', '396')), (790, 930)),
    (int(os.environ.get('XS','914')), int(os.environ.get('FC', '555')), float(os.environ.get('SC', '1.2')), 'front', '4.2_서윤지', int(os.environ.get('OC', '456')), (580, 1040)),
    (1274, int(os.environ.get('FC', '555')), float(os.environ.get('SC', '1.2')), 'front', '4.1_차여진', int(os.environ.get('OC', '456')), (1065, 1480)),
    (1704, int(os.environ.get('FC', '555')), float(os.environ.get('SC', '1.2')), 'front', '6.28_협회여2', int(os.environ.get('OC', '456')), (1505, 1904)),
]
SEATS = [x for x in SEATS if not ('협회' in x[4] and x[1] < 500)]  # 12:19 뒷자리 협회 직원 빼기, 오른쪽 창구 돌림 자리는 둠
import json
FIT = json.loads((R/'game-src/art/objects/chairs_office/fit_all.json').read_text())   # 사무의자 C01 인물별 맞춤값(11-02 손으로 딴 값)
SEATPT = {'south':(92,107),'south-east':(108,106),'south-west':(76,106),'east':(83,97),'north':(91,101),'north-east':(97,101),'north-west':(88,101),'west':(104,95)}
LID = {'front':'60','side':'96','back':'61'}
def person_pt(key, v):
    """맞춤값 → 앉기 끝 장의 엉덩이·가랑이 점(1배)과 그 그림, 의자 방향"""
    cfg, _ = fc.load(key); im = fc.last(cfg, LID[v]); q = FIT[key][v]
    bot = min(im.size[1]-4, im.getbbox()[3]); sx, sy = SEATPT[q['img']]
    return im, (q['dx'] - 100 + sx + im.size[0]/2, q['dy'] - 171 + sy + bot), q['img']
out = BG2.copy()
for x2, fy, s, v, key, oy, (xa, xb) in SEATS:
    im, (px0, py0), img = person_pt(key, v)
    c = Image.open(fc.chair_png(img)).convert('RGBA')
    # 의자 200칸: 바닥(172) 가운데를 (x2, fy)에. 의자는 제자리, 사람은 맞춤 점을 좌석 점에
    chx, chy = x2 - 100*s, fy - 172*s
    seat = (chx + SEATPT[img][0]*s, chy + SEATPT[img][1]*s)
    L = Image.new('RGBA', out.size, (0, 0, 0, 0))
    L.alpha_composite(c.resize((round(200*s), round(200*s)), Image.NEAREST), (round(chx), round(chy)))
    L.alpha_composite(im.resize((round(im.size[0]*s), round(im.size[1]*s)), Image.NEAREST), (round(seat[0]-px0*s), round(seat[1]-py0*s)))
    out.alpha_composite(L)
    out.alpha_composite(BG2.crop((xa, oy, xb, BG2.height)), (xa, oy))
o = os.environ.get('OUT') or '/mnt/project-files/sdra/sdra_counter_sit_v1_x2.png'
out.convert('RGB').save(o); print(o, out.size)
