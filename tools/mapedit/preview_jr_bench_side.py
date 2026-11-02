"""손길 대기실 C06 3인 의자 옆모습(서향) 배치 + 세 명 옆으로 앉히기 (사용자 2026-11-02 13:46).
의자 그림 = C06_대기의자_돌리기/west.png (256, 뒷모습 판과 같은 배율). 의자 다리 받침 가운데(129,216)를 FX,FY에.
앉은 사람 = 옆 앉기 96 끝 장 좌우반전(서쪽 봄), 맞춤값 side(dx,dy)를 C01 옆 좌석점(83,97)/원점(100,171) 대신 C06 좌석점에.
가까운 좌석·등받이는 먼 자리 사람 앞에 그린다(손 다각형 NEAR).
사용: python3 tools/mapedit/preview_jr_bench_side.py FX FY 키1,키2,키3 out.png chair.png [큐라스x,y]
"""
import json, sys, os
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'game-src/action/testroom3')); sys.path.insert(0, str(ROOT/'game-src/action/testroom3/qa'))
a = sys.argv; sys.argv = a[:1]; import fit_chair as fc; sys.argv = a
sys.path.insert(0, str(ROOT/'tools/mapedit')); from preview_jr_chairs import persp, render
FX, FY = int(a[1]), int(a[2]); who = a[3].split(','); out = a[4]; chp = a[5]
men = [tuple(map(int, a[6].split(',')))] if len(a) > 6 else []
g = json.loads((ROOT/'game-src/mapedit/jr_songil/game.json').read_text())['scene']
render('jr_songil', men, out)
img = Image.open(out).convert('RGBA')
kp = persp(g, FY)*g['dotK']; kc = kp/1.07
ch = Image.open(chp).convert('RGBA'); W, H = ch.size
chs = ch.resize((round(W*kc), round(H*kc)), Image.NEAREST)
ANC = (129, 216)
ox, oy = round(FX-ANC[0]*kc), round(FY-ANC[1]*kc)
# 좌석점(엉덩이 뒤 아래 = 좌판 윗면이 등받이와 만나는 곳), 먼 자리부터
SEATS = [tuple(map(float, s.split(','))) for s in os.environ.get('SEATS', '128,99;140,122;151,146').split(';')]
# 이 자리 사람보다 앞(가까운) 의자 부분: 먼 자리 뒤 = 가운데+앞, 가운데 뒤 = 앞
NEAR = [[(60,109),(131,109),(137,62),(148,55),(200,55),(200,230),(60,230)],
        [(60,134),(142,134),(149,84),(162,78),(200,78),(200,230),(60,230)], None]
def part(poly):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(poly, fill=255)
    p = Image.new('RGBA', (W, H)); p.paste(ch, (0, 0), m)
    return p.resize(chs.size, Image.NEAREST)
img.alpha_composite(chs, (ox, oy))
for (sx, sy), key, near in zip(SEATS, who, NEAR):
    if key:
        cfg, _ = fc.load(key); ims, vals = fc.values(cfg); fit = vals['side']
        P = (ox+sx*kc, oy+sy*kc)
        O = (P[0]-17*kp, P[1]+74*kp)          # 서향(좌우반전) C01 원점
        bx, by = O[0]+fit['dx']*kp, O[1]-fit['dy']*kp
        im = fc.last(cfg, '96').transpose(Image.FLIP_LEFT_RIGHT); sb = fc.line_base(cfg, '96')
        s = im.resize((round(im.width*kp), round(im.height*kp)), Image.NEAREST)
        img.alpha_composite(s, (round(bx-s.width/2), round(by-sb*kp)))
        print(key, 'side', fit['dx'], fit['dy'], 'foot', round(bx), round(by))
    if near: img.alpha_composite(part(near), (ox, oy))
for o in g['objects']:
    if o.get('file') and o['sortY'] > FY and o['id'] not in os.environ.get('PREVIEW_SKIP', '').split(','):
        img.alpha_composite(Image.open(ROOT/f"game-pack/jr-field/{o['file']}.webp").convert('RGBA'), (o['x'], o['y']))
img.convert('RGB').save(out); print('kp', round(kp, 3), 'kc', round(kc, 3), 'chair', chs.size, 'at', ox, oy)
