"""여자 샤워실 물줄기 이펙트(코드) 미리보기 v2 — 사용자 2026-11-01 16:48 「직선 말고 완만하게 넓게 퍼지게, 밑에 샤워 동작 재생해 놓고 맞춰라」.
꼭지(헤드 아랫면, 새 그림 기준)에서 부채꼴 9가닥이 포물선으로 퍼져 떨어진다(중력). 사람은 SH_D(물 맞으며 쉬기)·SH_E(몸 씻기) 8장을 실제로 재생.
머리 감기 동작은 팩에 없음(SH_A 옷 벗기·SH_B 맨몸 걷기·SH_D·SH_E뿐). 게임(TS) 이식 때 같은 수치: NOZZLE, SPREAD, SPEED, G, 점선 4/2."""
import json, math, random, sys
import numpy as np
from PIL import Image, ImageDraw
A = 'game-src/art/pixellab-hq-20261031/'
BG = A + 'hq_bath_f_p5_extL1_heads.png'
NOZZLE = {2: (203, 140), 3: (244, 144), 4: (480, 137), 5: (504, 149), 6: (662, 150), 7: (690, 137)}  # 1x, 물 나오는 점
FOOT = {2: (268, 356, 'W'), 3: (296, 318, 'W'), 4: (527, 352, 'W'), 5: (554, 314, 'W'), 6: (610, 314, 'E'), 7: (637, 356, 'E')}  # 16:58~59 사용자가 찍은 여섯 자리(2배 그림의 점을 1배로): 앞줄 2·4·7, 뒷줄 3·5·6
OBJ = np.asarray(Image.open(A + 'hq_bath_f_floorobj_mask.png').convert('L')) > 0   # 바닥 물건(픽셀 마스크): 발 앞(아래)에 있으면 사람을 가린다
CH = {2: ('1.2', 'SH_D'), 3: ('1.10', 'SH_E'), 4: ('1.9', 'SH_D'), 5: ('1.4', 'SH_E'), 6: ('1.11', 'SH_D'), 7: ('1.1', 'SH_E')}
assert all(c != '1.12' for c, _ in CH.values())
SHRINK = 0.88
SPREAD, STREAMS, SPEED, G = 40, 7, 2.2, 0.03   # 16:52 사용자: 덜 촘촘하게, 더 밑으로   # 부채꼴 전체 각도(도), 가닥 수, 초속(px/걸음), 중력
C_DEEP, C_MID, C_HI = (120, 180, 230, 245), (160, 212, 245, 245), (235, 250, 255, 255)   # v15: 타일 위에서 보이게 더 진하게
def hgt(y): return 1.383 * (y - 196) * SHRINK
C_STEAM = (250, 253, 255)
# 헤드 물 나오는 면(1x): 그림의 헤드 타원 아래쪽 가장자리 양끝. 물은 이 선 전체에서 선에 수직(벽 반대쪽 아래)으로 나간다(17:23 사용자: 한 점 아님, 꺾임 없음).
FACE = {2: ((198, 146), (208, 138)), 3: ((240, 149), (249, 141)), 4: ((474, 144), (485, 135)), 5: ((500, 156), (510, 147)),
        6: ((650, 150), (660, 158)), 7: ((678, 138), (688, 146))}
SPEED, SPREAD_DEG, G = 3.6, 14, 0.035   # 초속(px/걸음: 클수록 곧게), 면 수직 기준 양쪽 퍼짐(도), 중력
def face_dir(n):
    (x0, y0), (x1, y1) = FACE[n]
    ex, ey = x1 - x0, y1 - y0; L = math.hypot(ex, ey)
    nx_, ny_ = -ey / L, ex / L                      # 수직 두 방향 중 아래(+y) 쪽
    if ny_ < 0: nx_, ny_ = -nx_, -ny_
    return nx_, ny_
def draw_steam(layer, n, head_top, head_x, floor_y, frame, nframes):
    """김(17:24 사용자): 작고 많고 빠르게 말고, 큰 덩어리가 천천히 뭉게뭉게. 사람 머리·어깨 둘레에서 6덩어리, 지름 10→22px, 한 바퀴 nframes."""
    d = ImageDraw.Draw(layer)
    rnd = random.Random(n * 7 + 1)
    for k in range(6):
        bx = head_x + rnd.uniform(-16, 16); by = head_top + rnd.uniform(0, 40)
        t = ((frame + k * nframes / 6) % nframes) / nframes          # 0~1 올라가는 단계(덩어리마다 시차)
        y = by - t * 34; x = bx + math.sin(t * 6.28 + k) * 5
        alpha = int(150 * (1 - t) ** 1.2 * min(1, t * 4 + 0.3)); r = 5 + int(t * 6)
        for (ox, oy, rr) in ((0, 0, r), (-r * 0.6, r * 0.3, r * 0.7), (r * 0.6, r * 0.2, r * 0.75), (0, -r * 0.5, r * 0.6)):   # 뭉게구름 모양: 원 4개 겹침
            cx_, cy_ = x + ox, y + oy
            for dy in range(-int(rr), int(rr) + 1):
                for dx in range(-int(rr), int(rr) + 1):
                    if dx * dx + dy * dy <= rr * rr:
                        px_, py_ = round(cx_ + dx), round(cy_ + dy)
                        cur = layer.getpixel((px_, py_))[3] if 0 <= px_ < layer.width and 0 <= py_ < layer.height else 255
                        if cur < alpha: d.point((px_, py_), fill=C_STEAM + (alpha,))
def draw_water(layer, n, head_top, head_x, floor_y, frame, nframes=8):
    """v15: 헤드 면 전체에서 STREAMS 가닥, 면에 수직 ± SPREAD_DEG 로 곧게 나가며 중력으로만 완만히 휨(꺾임 없음).
    몸(머리 x ±10, 머리 위부터)에 닿으면 그 자리에서 몸을 타고 아래로 흘러 허벅지에서 끝. 안 닿으면 바닥까지."""
    draw_steam(layer, n, head_top, head_x, floor_y, frame, nframes)
    d = ImageDraw.Draw(layer)
    (fx0, fy0), (fx1, fy1) = FACE[n]; dxn, dyn = face_dir(n); rnd = random.Random(n * 100)
    base = math.atan2(dyn, dxn)
    for s in range(STREAMS):
        u = s / (STREAMS - 1)                        # 면 위 위치 0~1
        x, y = fx0 + (fx1 - fx0) * u, fy0 + (fy1 - fy0) * u
        th = base + math.radians((u - 0.5) * 2 * SPREAD_DEG)
        vx, vy = SPEED * math.cos(th), SPEED * math.sin(th)
        pts = []; on_body = False
        for i in range(400):
            pts.append((x, y))
            if not on_body and abs(x - head_x) < 10 and y >= head_top: on_body = True; vx, vy = 0.0, max(vy, 1.5)
            if on_body and y >= floor_y - 60 - abs(u - 0.5) * 50: break
            if y >= floor_y - 2: break
            x += vx; y += vy
            if not on_body: vy += G
        for i, (px, py) in enumerate(pts):
            if (i + frame * 2 + s * 2) % 9 < 7:   # 점선 7/2
                col = C_HI if i % 11 < 2 else (C_MID if 1 <= s <= STREAMS - 2 else C_DEEP)
                d.point((round(px), round(py)), fill=col)
                d.point((round(px) + 1, round(py)), fill=col)   # 2px 굵기
    for k in range(14):                     # 머리·어깨 물방울
        a = rnd.random() * math.pi; r = 5 + rnd.random() * 14 + ((frame + k) % 4)
        d.point((round(head_x + math.cos(a) * r), round(head_top + 4 - abs(math.sin(a)) * r * 0.5)), fill=C_HI if k % 3 == 0 else C_MID)
    fx = FOOT[n][0]
    for k in range(16):                     # 발밑 물튀김
        a = rnd.random() * math.pi * 2; r = 6 + rnd.random() * 16; ph = (k + frame) % 4
        d.point((round(fx + math.cos(a) * r), round(floor_y + math.sin(a) * r * 0.3 - ph)), fill=C_HI if ph == 0 else C_MID)
NF = 16
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
        draw_water(water, n, head_top, fx, fy, frame, NF)
    bg.alpha_composite(water)
    return bg.convert('RGB')
out = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/hq-f3/now/샤워실여_물줄기_코드_v15_2배.png'
frames = [render(f).resize((924 * 2, 424 * 2), Image.NEAREST) for f in range(NF)]
frames[0].save(out)
frames[0].save(out.replace('.png', '.gif'), save_all=True, append_images=frames[1:], duration=120, loop=0)
print('ok')
