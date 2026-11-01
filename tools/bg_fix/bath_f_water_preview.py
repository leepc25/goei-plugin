"""여자 샤워실 물줄기 이펙트(코드) 미리보기 — 사용자 2026-11-01 16:44 「코드로 만들어서 적용한 뒤 보여줘」.
샤워기 꼭지(새 그림 기준, 헤드 20px 위)에서 씻는 사람 머리 쪽으로 물줄기 여러 가닥(점선, 프레임마다 흐름), 머리·어깨에 튀는 물방울, 발밑 물튀김.
게임(TS)에 옮길 때 같은 수치: NOZZLE, 가닥 5, 퍼짐 ±7px, 점선 3칸/2칸, 색 3단계."""
import json, math, random, sys
from PIL import Image, ImageDraw
A = 'game-src/art/pixellab-hq-20261031/'
BG = A + 'hq_bath_f_p5_extL1_heads.png'
NOZZLE = {2: (203, 140), 3: (244, 144), 4: (480, 137), 5: (504, 149), 6: (662, 150), 7: (690, 137)}  # 1x, 꼭지(물 나오는 점)
FOOT = {2: (240, 340, 'W'), 3: (290, 312, 'W'), 4: (528, 338, 'W'), 5: (545, 305, 'W'), 6: (614, 316, 'E'), 7: (640, 348, 'E')}
CH = {2: '1.2', 3: '1.10', 4: '1.9', 6: '1.1'}
assert '1.12' not in CH.values()
SHRINK = 0.88
def hgt(y): return 1.383 * (y - 196) * SHRINK
C_DEEP, C_MID, C_HI = (150, 205, 235, 230), (190, 230, 248, 235), (240, 252, 255, 255)
def draw_water(layer, n, head_top, head_x, frame):
    d = ImageDraw.Draw(layer)
    nx, ny = NOZZLE[n]
    tx, ty = head_x, head_top + 6          # 머리 윗부분을 향함
    rnd = random.Random(n * 100)
    L = math.hypot(tx - nx, ty - ny)
    for s in range(7):                     # 가닥 7개, 끝에서 ±10px 퍼짐
        off = (s - 3) * 3.4
        ex, ey = tx + off, ty + abs(off) * 0.4
        steps = int(L)
        for i in range(steps):
            if (i + frame * 2 + s * 2) % 6 >= 4: continue   # 점선 4칸/2칸, 프레임마다 흘러내림
            t = i / steps
            x = nx + (ex - nx) * t; y = ny + (ey - ny) * t + 10 * t * t   # 살짝 처짐
            col = C_HI if s == 3 and i % 7 < 3 else (C_MID if s in (1, 2, 3, 4, 5) else C_DEEP)
            d.point((round(x), round(y)), fill=col)
            if s in (2, 3, 4): d.point((round(x) + 1, round(y)), fill=col)   # 가운데 가닥은 2px 굵게
    # 머리·어깨 튀는 물방울
    for k in range(14):
        a = rnd.random() * math.pi; r = 4 + rnd.random() * 12 + ((frame + k) % 4)
        d.point((round(tx + math.cos(a) * r), round(ty - 2 - abs(math.sin(a)) * r * 0.5)), fill=C_HI if k % 3 == 0 else C_MID)
    # 발밑 물튀김: 바닥에 작은 점·짧은 호
    fx, fy, _ = FOOT[n]
    for k in range(16):
        a = rnd.random() * math.pi * 2; r = 6 + rnd.random() * 16
        ph = (k + frame) % 4
        d.point((round(fx + math.cos(a) * r), round(fy + math.sin(a) * r * 0.3 - ph)), fill=C_HI if ph == 0 else C_MID)
def render(frame):
    bg = Image.open(BG).convert('RGBA')
    water = Image.new('RGBA', bg.size, (0, 0, 0, 0))
    for n in sorted(CH, key=lambda n: FOOT[n][1]):
        fx, fy, face = FOOT[n]
        dd = json.load(open(f'game-pack/char-{CH[n]}/char.json')); a = dd['A']['SH_E']
        sheet = Image.open(f'game-pack/char-{CH[n]}/SH_E.webp').convert('RGBA')
        fr = Image.new('RGBA', (a['w'], a['h'])); fr.alpha_composite(sheet.crop((0, 0, a['cw'], a['ch'])), (a['ox'], a['oy']))
        k = hgt(fy) / 237
        fr = fr.resize((round(fr.width * k), round(fr.height * k)), Image.NEAREST)
        bb = fr.getbbox(); cx = (bb[0] + bb[2]) // 2
        if face == 'W': fr = fr.transpose(Image.FLIP_LEFT_RIGHT); cx = fr.width - cx
        px, py = fx - cx, fy - round(a['floor'] * k)
        bg.alpha_composite(fr, (px, py))
        head_top = py + bb[1]; head_x = fx + (-(bb[2]-bb[0])//4 if face == 'W' else (bb[2]-bb[0])//4)
        draw_water(water, n, head_top, fx, frame)
    bg.alpha_composite(water)
    return bg.convert('RGB')
out = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/hq-f3/now/샤워실여_물줄기_코드_2배.png'
frames = [render(f).resize((924 * 2, 424 * 2), Image.NEAREST) for f in range(4)]
frames[0].save(out)
frames[0].save(out.replace('.png', '.gif'), save_all=True, append_images=frames[1:], duration=120, loop=0)
print('ok')
