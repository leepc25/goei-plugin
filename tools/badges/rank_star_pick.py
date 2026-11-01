# 랭크 별 확정안(PixelLab star_8 = 시트 9번)을 토큰 테두리 한가운데에 겹쳐 올린다. 금·은·동 × 랭크1(없음)·2(별1)·3(별2).
# 별 중심 = 그 x 자리 테두리(맨 위 불투명 ~ 안쪽 어두운 선)의 가운데. 금·동 별은 tint.py 그라디언트 맵.
# 사용: python3 tools/badges/rank_star_pick.py <출력 3배.png>
import sys
from PIL import Image
sys.path.insert(0, 'tools/badges'); from tint import tint, RAMPS
B = 'game-src/art/ui/badges/'
star = Image.open(B + 'star_8.png').convert('RGBA'); star = star.crop(star.getbbox())
stars = {'silver': star, 'gold': tint(star, RAMPS['gold']), 'bronze': tint(star, RAMPS['bronze'])}
toks = {k: Image.open(B + f'sheet1_완성{s}.png').convert('RGBA').crop((0, 0, 64, 64)) for k, s in (('gold', '_gold'), ('silver', ''), ('bronze', '_bronze'))}
PAD = 8
def rim_mid(t, x):
    ys = [y for y in range(64) if t.getpixel((x, y))[3]]; top = ys[0]
    y = top + 1
    while y < 40 and sum(t.getpixel((x, y))[:3]) / 3 > 100: y += 1  # 밝은 테 → 안쪽 어두운 선
    return (top + y) / 2
def badge(g, rank):
    t = toks['silver']; im = Image.new('RGBA', (64, 64 + PAD)); im.alpha_composite(toks[g], (0, PAD))
    if rank == 1: return im
    s = stars[g]; w, h = s.size
    xs = [32] if rank == 2 else [32 - w // 2 - 1, 32 + w // 2 + 1]
    for x in xs:
        cy = rim_mid(t, x); im.alpha_composite(s, (round(x - w / 2), round(PAD + cy - h / 2)))
    return im
C = 76
out = Image.new('RGBA', (3 * C, 3 * (C + 8)), (40, 44, 60, 255))
for gi, g in enumerate(('gold', 'silver', 'bronze')):
    for k in range(3):
        b = badge(g, k + 1); out.alpha_composite(b, (k * C + 6, gi * (C + 8) + 4))
        b.save(f'{B}rank_{g}_{k+1}.png')
out.resize((out.width * 3, out.height * 3), Image.NEAREST).save(sys.argv[1])
# 통합창용 별 그림(금·은·동 14x14)을 TS로 내보낸다: python3 tools/badges/rank_star_pick.py <png> --ts
if '--ts' in sys.argv:
    import base64, io
    def b64(im): bb = io.BytesIO(); im.save(bb, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(bb.getvalue()).decode()
    with open('src/game/action/ui/rankStarArt.ts', 'w') as f:
        f.write('// tools/badges/rank_star_pick.py --ts 가 만든다. 손으로 고치지 말 것\n')
        f.write('// 랭크 별(PixelLab star_8 = 64안 9번, 최종 확정 11-01). 64px 뱃지 기준 왼쪽 위 자리: 랭크2 = 별1, 랭크3 = 별2(테두리 선 가운데)\n')
        f.write('export const RANK_STAR = ' + repr({'일반': b64(stars['bronze']), '희귀': b64(stars['silver']), '특급': b64(stars['gold'])}).replace("'", '"') + ' as const;\n')
        f.write('export const RANK_STAR_POS: Record<2 | 3, [number, number][]> = {\n')

        w, h = stars['silver'].size
        for rank in (2, 3):
            xs = [32] if rank == 2 else [32 - w // 2 - 1, 32 + w // 2 + 1]
            ps = [(round(x - w / 2), round(PAD + rim_mid(toks['silver'], x) - h / 2) - PAD) for x in xs]
            f.write(f'  {rank}: {[list(p) for p in ps]},\n')
        f.write('};\n')
