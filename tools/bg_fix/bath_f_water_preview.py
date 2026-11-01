"""여자 샤워실 물줄기 이펙트(코드) 미리보기 v2 — 사용자 2026-11-01 16:48 「직선 말고 완만하게 넓게 퍼지게, 밑에 샤워 동작 재생해 놓고 맞춰라」.
꼭지(헤드 아랫면, 새 그림 기준)에서 부채꼴 9가닥이 포물선으로 퍼져 떨어진다(중력). 사람은 SH_D(물 맞으며 쉬기)·SH_E(몸 씻기) 8장을 실제로 재생.
머리 감기 동작은 팩에 없음(SH_A 옷 벗기·SH_B 맨몸 걷기·SH_D·SH_E뿐). 게임(TS) 이식 때 같은 수치: NOZZLE, SPREAD, SPEED, G, 점선 4/2."""
import json, math, random, sys
import numpy as np
from PIL import Image, ImageDraw
A = 'game-src/art/pixellab-hq-20261031/'
BG = A + 'hq_bath_f_p5_extL1_heads.png'
NOZZLE = {2: (203, 140), 3: (244, 144), 4: (480, 137), 5: (504, 149), 6: (662, 150), 7: (690, 137)}  # 1x, 물 나오는 점
FOOT = {2: (268, 356, 'W'), 3: (305, 314, 'W'), 4: (536, 352, 'W'), 5: (554, 314, 'W'), 6: (610, 314, 'E'), 7: (628, 352, 'E')}  # 16:58~59 사용자가 찍은 여섯 자리(2배 그림의 점을 1배로): 앞줄 2·4·7, 뒷줄 3·5·6
OBJ = np.asarray(Image.open(A + 'hq_bath_f_floorobj_mask.png').convert('L')) > 0   # 바닥 물건(픽셀 마스크): 발 앞(아래)에 있으면 사람을 가린다
CH = {2: ('1.2', 'SH_D'), 3: ('1.10', 'SH_E'), 4: ('1.9', 'SH_D'), 5: ('1.4', 'SH_E'), 6: ('1.11', 'SH_D'), 7: ('1.1', 'SH_E')}
assert all(c != '1.12' for c, _ in CH.values())
SHRINK = 0.88
SPREAD, STREAMS, SPEED, G = 40, 7, 2.2, 0.03   # 16:52 사용자: 덜 촘촘하게, 더 밑으로   # 부채꼴 전체 각도(도), 가닥 수, 초속(px/걸음), 중력
C_DEEP, C_MID, C_HI = (150, 205, 235, 225), (190, 230, 248, 235), (240, 252, 255, 255)
def hgt(y): return 1.383 * (y - 196) * SHRINK
C_STEAM = (250, 253, 255)
def draw_steam(layer, n, head_top, head_x, floor_y, frame):
    """뜨거운 물 김: 사람 주변(머리·어깨·꼭지)에서 반투명 흰 뭉치가 흔들리며 올라가다 옅어진다(16:52 사용자)."""
    d = ImageDraw.Draw(layer)
    rnd = random.Random(n * 7 + 1)
    nx, ny = NOZZLE[n]
    for k in range(18):
        bx = head_x + rnd.uniform(-22, 22); by = head_top + rnd.uniform(-10, 70)
        life = 48; t = (frame * 4 + k * 11) % life          # 0~life 로 올라가는 단계
        y = by - t * 1.3; x = bx + math.sin((t + k * 5) / 7.0) * 4
        alpha = int(170 * (1 - t / life) ** 0.8); r = 3 + t // 10    # 올라갈수록 커지고 옅어짐
        if y < ny - 40: continue
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx * dx + dy * dy <= r * r:
                    edge = dx * dx + dy * dy > (r - 1) * (r - 1)
                    d.point((round(x + dx), round(y + dy)), fill=C_STEAM + (alpha // 2 if edge else alpha,))
def draw_water(layer, n, head_top, head_x, floor_y, frame):
    draw_steam(layer, n, head_top, head_x, floor_y, frame)
    d = ImageDraw.Draw(layer)
    nx, ny = NOZZLE[n]
    rnd = random.Random(n * 100)
    # 기준 방향: 꼭지에서 머리 위 한 점으로(헤드 기울기대로 사람 쪽으로 완만하게)
    aim = math.atan2(head_x - nx, (head_top + 4) - ny)   # 수직 기준, 사람 쪽으로 기운 각
    for s in range(STREAMS):
        th = aim + math.radians((s - (STREAMS - 1) / 2) * SPREAD / (STREAMS - 1))
        vx, vy = SPEED * math.sin(th) * 0.6, SPEED * math.cos(th) * 0.9   # 주로 아래로, 옆은 조금 → 완만한 부채꼴
        x, y = float(nx), float(ny); i = 0
        end_y = floor_y - 60 - abs(s - (STREAMS - 1) / 2) * 12   # 가운데 가닥은 허벅지, 바깥은 허리쯤까지 흘러내림
        while y < end_y and i < 400 and (y < head_top - 6 or abs(x - head_x) < 30):
            if (i + frame * 2 + s * 2) % 9 < 6:   # 점선 6/3
                col = C_HI if s == (STREAMS - 1) // 2 and i % 8 < 3 else (C_MID if 1 <= s <= STREAMS - 2 else C_DEEP)
                d.point((round(x), round(y)), fill=col)
                if s == (STREAMS - 1) // 2: d.point((round(x) + 1, round(y)), fill=col)
            x += vx; y += vy; vy += G; i += 1
    for k in range(14):                     # 머리·어깨 물방울
        a = rnd.random() * math.pi; r = 5 + rnd.random() * 14 + ((frame + k) % 4)
        d.point((round(head_x + math.cos(a) * r), round(head_top + 4 - abs(math.sin(a)) * r * 0.5)), fill=C_HI if k % 3 == 0 else C_MID)
    fx = FOOT[n][0]
    for k in range(16):                     # 발밑 물튀김
        a = rnd.random() * math.pi * 2; r = 6 + rnd.random() * 16; ph = (k + frame) % 4
        d.point((round(fx + math.cos(a) * r), round(floor_y + math.sin(a) * r * 0.3 - ph)), fill=C_HI if ph == 0 else C_MID)
def render(frame):
    bg = Image.open(BG).convert('RGBA')
    water = Image.new('RGBA', bg.size, (0, 0, 0, 0))
    for n in sorted(CH, key=lambda n: FOOT[n][1]):
        fx, fy, face = FOOT[n]; cid, anim = CH[n]
        a = json.load(open(f'game-pack/char-{cid}/char.json'))['A'][anim]
        sheet = Image.open(f'game-pack/char-{cid}/{anim}.webp').convert('RGBA')
        fi = frame % a['n']
        fr = Image.new('RGBA', (a['w'], a['h'])); fr.alpha_composite(sheet.crop((fi * a['cw'], 0, (fi + 1) * a['cw'], a['ch'])), (a['ox'], a['oy']))
        k = hgt(fy) / 237
        fr = fr.resize((round(fr.width * k), round(fr.height * k)), Image.NEAREST)
        bb = fr.getbbox(); cx = (bb[0] + bb[2]) // 2
        if face == 'W': fr = fr.transpose(Image.FLIP_LEFT_RIGHT); cx = fr.width - cx
        px, py = fx - cx, fy - round(a['floor'] * k)
        bg.alpha_composite(fr, (px, py))
        # 가림: 발보다 앞(아래 끝이 발 y보다 큰) 물건 픽셀은 배경을 다시 덮는다
        sub = OBJ[py:py + fr.height, px:px + fr.width]
        if sub.any():
            cover = np.zeros_like(sub)
            ys, xs = np.nonzero(sub)
            # 덩어리 아래 끝으로 판단(간단히: 그 열에서 물건의 맨 아래 y)
            for x in set(xs):
                col = np.nonzero(OBJ[:, px + x])[0]; col = col[(col >= py) & (col < py + fr.height + 40)]
                if len(col) and col.max() > fy: cover[:, x] = sub[:, x]
            orig_bg = Image.open(BG).convert('RGBA').crop((px, py, px + fr.width, py + fr.height))
            mask = Image.fromarray((cover * 255).astype('uint8'))
            bg.paste(orig_bg, (px, py), mask)
        head_top = py + round(a['top'][fi] * k)
        draw_water(water, n, head_top, fx, fy, frame)
    bg.alpha_composite(water)
    return bg.convert('RGB')
out = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/hq-f3/now/샤워실여_물줄기_코드_v10_2배.png'
frames = [render(f).resize((924 * 2, 424 * 2), Image.NEAREST) for f in range(8)]
frames[0].save(out)
frames[0].save(out.replace('.png', '.gif'), save_all=True, append_images=frames[1:], duration=140, loop=0)
print('ok')
