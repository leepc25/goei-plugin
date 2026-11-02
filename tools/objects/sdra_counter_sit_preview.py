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
    (int(os.environ.get('XS','914')), int(os.environ.get('FC', '555')), float(os.environ.get('SC', '1.0')), 'front', '4.2_서윤지', int(os.environ.get('OC', '456')), (580, 1040)),
    (1274, int(os.environ.get('FC', '555')), float(os.environ.get('SC', '1.0')), 'front', '4.1_차여진', int(os.environ.get('OC', '456')), (1065, 1480)),
    (1704, int(os.environ.get('FC', '555')), float(os.environ.get('SC', '1.0')), 'front', '6.28_협회여2', int(os.environ.get('OC', '456')), (1505, 1904)),
]
SEATS = [x for x in SEATS if not ('협회' in x[4] and x[1] < 500)]  # 12:19 뒷자리 협회 직원 빼기, 오른쪽 창구 돌림 자리는 둠
out = BG2.copy()
for x2, fy, s, v, key, oy, (xa, xb) in SEATS:
    cfg, _ = fc.load(key); ims, vals = fc.values(cfg)
    im = ims[v]; p = vals[v]
    TW, TH = 260, 300; base = TH - 10
    T = Image.new('RGBA', (TW, TH), (0, 0, 0, 0))
    ox, oy0 = TW//2 - im.size[0]//2, base - (im.size[1] - 4)
    cx, cy = round(TW/2 + p['dx'] - 100), round(base + p['dy'] - 171)
    c = Image.open(fc.chair_png(p.get('img', 'south'))).convert('RGBA')
    T.alpha_composite(c, (cx, cy)); T.alpha_composite(im, (ox, oy0))
    Ts = T.resize((round(TW*s), round(TH*s)), Image.NEAREST)
    px, py = round(x2 - TW/2*s), round(fy - base*s)
    L = Image.new('RGBA', out.size, (0, 0, 0, 0)); L.alpha_composite(Ts, (max(px, 0), py) if px >= 0 else (0, py))
    out.alpha_composite(L)
    # 가림: oy 아래, 이 자리 x 범위만 배경을 다시 얹음
    out.alpha_composite(BG2.crop((xa, oy, xb, BG2.height)), (xa, oy))
o = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/sdra/sdra_counter_sit_v1_x2.png'
out.convert('RGB').save(o); print(o, out.size)
