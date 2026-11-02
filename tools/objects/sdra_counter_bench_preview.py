"""창구 장면: 직원(사무의자) + 배경에서 그려 오린 대기의자(sdra_counter_bench_v1_cut.png)에 세 명 뒷모습 앉히기 (2026-11-02).
의자는 그려진 그 자리(1배 545,276) 고정, 사람만 옮긴다. 사람 = 사무의자 맞춤값(fit_all.json) 뒤 앉기, 사무의자 north 좌석 점(91,101) = 좌석 띠 윗면(98) 3 아래 → 이 의자도 좌석 띠 윗면(58) 3 아래."""
import sys, os, json, subprocess
from pathlib import Path
R = Path('/home/user/goei-plugin'); HERE = R/'game-src/action/testroom3'
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE/'qa')); sys.argv = sys.argv[:1]
import fit_chair as fc
from PIL import Image
OUT = os.environ.get('OUT', '/tmp/bench.png')
tmp = OUT + '.staff.png'
subprocess.run([sys.executable, str(R/'tools/objects/sdra_counter_sit_preview.py')], env={**os.environ, 'OUT': tmp}, check=True, stdout=subprocess.DEVNULL)
out = Image.open(tmp).convert('RGBA'); os.remove(tmp)
FIT = json.loads((R/'game-src/art/objects/chairs_office/fit_all.json').read_text())
bench = Image.open(R/'game-src/art/pixellab-hq-20261031/sdra_counter_bench_v1_cut.png').convert('RGBA')
OX, OY = 545*2, 276*2                      # 2배 캔버스 위치(배경 그대로)
SEATS_X = [40, 111.5, 183.5]; SEAT_PT_Y = 61  # 1배(잘라낸 판 기준)
BS = float(os.environ.get('BS', '2.14'))    # 사람 배율: 좌석 폭(62px×2) = 사무의자 등받이 폭(58)×BS
PEOPLE = os.environ.get('WHO', '1.4_에일린,1.9_데드폴,1.12_콘쥬스').split(',')
L = Image.new('RGBA', out.size, (0, 0, 0, 0))
for sx, key in zip(SEATS_X, PEOPLE):
    cfg, _ = fc.load(key); im = fc.last(cfg, '61'); q = FIT[key]['back']
    bot = min(im.size[1]-4, im.getbbox()[3])
    px, py = q['dx'] - 100 + 91 + im.size[0]/2, q['dy'] - 171 + 101 + bot   # 사람 그림 속 엉덩이 점
    seat = (OX + sx*2, OY + SEAT_PT_Y*2)
    L.alpha_composite(im.resize((round(im.size[0]*BS), round(im.size[1]*BS)), Image.NEAREST), (round(seat[0]-px*BS), round(seat[1]-py*BS)))
L.alpha_composite(bench.resize((bench.width*2, bench.height*2), Image.NEAREST), (OX, OY))
out.alpha_composite(L); out.convert('RGB').save(OUT); print(OUT)
