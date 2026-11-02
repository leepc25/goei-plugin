"""협회 2층 창구: 창구 직원(사무의자 C01) + 창구 앞 대기 의자 C05 v5(뒷모습)에 세 명 앉히기 미리보기 (2026-11-02 사용자 핀 69%,93%).
의자는 그 자리에 고정, 사람만 옮긴다. 뒤 앉기 맞춤값(C01 north 기준)을 C05 각 좌석 가운데·바닥에 옮겨 씀."""
import sys, os, subprocess
from pathlib import Path
R = Path('/home/user/goei-plugin'); HERE = R/'game-src/action/testroom3'
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE/'qa')); sys.argv = sys.argv[:1]
import fit_chair as fc
from PIL import Image
import json
FIT = json.loads((R/'game-src/art/objects/chairs_office/fit_all.json').read_text())
SEATPT = {'north':(91,101)}
def person_pt(key, v):
    cfg, _ = fc.load(key); im = fc.last(cfg, '61'); q = FIT[key][v]
    bot = min(im.size[1]-4, im.getbbox()[3]); sx, sy = SEATPT[q['img']]
    return im, (q['dx'] - 100 + sx + im.size[0]/2, q['dy'] - 171 + sy + bot), q['img']
OUT = os.environ.get('OUT', '/mnt/project-files/sdra/sdra_counter_wait_v1_x2.png')
# 1) 창구 직원 판(FC 등은 환경변수로 그대로 넘김)
tmp = OUT + '.staff.png'
subprocess.run([sys.executable, str(R/'tools/objects/sdra_counter_sit_preview.py')], env={**os.environ, 'OUT': tmp}, check=True)
out = Image.open(tmp).convert('RGBA'); os.remove(tmp)
# 2) 대기 의자
BX, BY, BS = int(os.environ.get('BX', '1312')), int(os.environ.get('BY', '800')), float(os.environ.get('BS', '2.0'))  # 의자 가운데 x, 다리 바닥 y(2배 캔버스), 배율
bench = Image.open(R/'game-src/action/objects/C05v5_대기의자_뒷모습/unknown.png').convert('RGBA')
SEATS_X = [58.5, 125, 191]; BENCH_FLOOR = 130   # 좌석 등받이 가운데 x, 다리 바닥 y (1배)
C01_X, C01_FLOOR = 90.5, 172                    # C01 north 200 칸: 등받이 가운데 x, 바닥 y
PEOPLE = os.environ.get('WHO', '1.4_에일린,1.9_데드폴,1.12_콘쥬스').split(',')
bx0 = BX - bench.width*BS/2; by0 = BY - BENCH_FLOOR*BS
L = Image.new('RGBA', out.size, (0, 0, 0, 0))
SEAT_Y = BENCH_FLOOR - (172 - 101)   # 사무의자 north 좌석 점(91,101)은 바닥 위 71 → 대기의자도 바닥 위 71 (같은 좌석 높이로 뽑음)
for sx, key in zip(SEATS_X, PEOPLE):
    im, (px0, py0), img = person_pt(key, 'back')
    seat = (bx0 + sx*BS, by0 + SEAT_Y*BS)
    L.alpha_composite(im.resize((round(im.size[0]*BS), round(im.size[1]*BS)), Image.NEAREST), (round(seat[0]-px0*BS), round(seat[1]-py0*BS)))
L.alpha_composite(bench.resize((round(bench.width*BS), round(bench.height*BS)), Image.NEAREST), (round(bx0), round(by0)))
out.alpha_composite(L)
out.convert('RGB').save(OUT); print(OUT, out.size)
