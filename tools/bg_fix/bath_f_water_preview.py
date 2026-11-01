"""여자 샤워실 물줄기 이펙트(코드) 미리보기 v2 — 사용자 2026-11-01 16:48 「직선 말고 완만하게 넓게 퍼지게, 밑에 샤워 동작 재생해 놓고 맞춰라」.
꼭지(헤드 아랫면, 새 그림 기준)에서 부채꼴 9가닥이 포물선으로 퍼져 떨어진다(중력). 사람은 SH_D(물 맞으며 쉬기)·SH_E(몸 씻기) 8장을 실제로 재생.
머리 감기 동작은 팩에 없음(SH_A 옷 벗기·SH_B 맨몸 걷기·SH_D·SH_E뿐). 게임(TS) 이식 때 같은 수치: NOZZLE, SPREAD, SPEED, G, 점선 4/2."""
import json, math, random, sys
from PIL import Image, ImageDraw
A = 'game-src/art/pixellab-hq-20261031/'
BG = A + 'hq_bath_f_p5_extL1_heads.png'
NOZZLE = {2: (203, 140), 3: (244, 144), 4: (480, 137), 5: (504, 149), 6: (662, 150), 7: (690, 137)}  # 1x, 물 나오는 점
FOOT = {2: (222, 340, 'W'), 3: (266, 312, 'W'), 4: (500, 338, 'W'), 5: (526, 305, 'W'), 6: (642, 316, 'E'), 7: (670, 348, 'E')}  # 꼭지 거의 바로 밑(옆으로 18~22px)
CH = {2: ('1.2', 'SH_D'), 3: ('1.10', 'SH_E'), 4: ('1.9', 'SH_D'), 6: ('1.1', 'SH_E')}
assert all(c != '1.12' for c, _ in CH.values())
SHRINK = 0.88
SPREAD, STREAMS, SPEED, G = 40, 13, 2.2, 0.03   # 부채꼴 전체 각도(도), 가닥 수, 초속(px/걸음), 중력
C_DEEP, C_MID, C_HI = (150, 205, 235, 225), (190, 230, 248, 235), (240, 252, 255, 255)
def hgt(y): return 1.383 * (y - 196) * SHRINK
def draw_water(layer, n, head_top, head_x, floor_y, frame):
    d = ImageDraw.Draw(layer)
    nx, ny = NOZZLE[n]
    rnd = random.Random(n * 100)
    # 기준 방향: 꼭지에서 머리 위 한 점으로(헤드 기울기대로 사람 쪽으로 완만하게)
    aim = math.atan2(head_x - nx, (head_top + 4) - ny)   # 수직 기준, 사람 쪽으로 기운 각
    for s in range(STREAMS):
        th = aim + math.radians((s - (STREAMS - 1) / 2) * SPREAD / (STREAMS - 1))
        vx, vy = SPEED * math.sin(th) * 0.6, SPEED * math.cos(th) * 0.9   # 주로 아래로, 옆은 조금 → 완만한 부채꼴
        x, y = float(nx), float(ny); i = 0
        end_y = head_top + 12 + abs(s - (STREAMS - 1) / 2) * 5     # 가운데는 머리에서 끝, 바깥 가닥은 어깨까지
        while y < end_y and i < 400 and (y < head_top - 6 or abs(x - head_x) < 26):
            if (i + frame * 2 + s) % 7 < 5:
                col = C_HI if s == (STREAMS - 1) // 2 and i % 8 < 3 else (C_MID if 1 <= s <= STREAMS - 2 else C_DEEP)
                d.point((round(x), round(y)), fill=col)
                if 1 <= s <= STREAMS - 2: d.point((round(x) + 1, round(y)), fill=col)
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
        head_top = py + round(a['top'][fi] * k)
        draw_water(water, n, head_top, fx, fy, frame)
    bg.alpha_composite(water)
    return bg.convert('RGB')
out = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/hq-f3/now/샤워실여_물줄기_코드_v2_2배.png'
frames = [render(f).resize((924 * 2, 424 * 2), Image.NEAREST) for f in range(8)]
frames[0].save(out)
frames[0].save(out.replace('.png', '.gif'), save_all=True, append_images=frames[1:], duration=140, loop=0)
print('ok')
