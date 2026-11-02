"""종합대응팀 사무실 확정 배경(hq_office_final 1482x424) 책상 8개 배치 시안 v4 — 사용자 11-02 07:47 「총 8개, 남쪽4 북쪽4, 각각 2개씩 띄워서」.
묶음 2개: 묶음마다 남쪽 2(나란히) + 바로 뒤 북쪽 2. 남쪽은 D01v3 / D03 섞음(사용자 07:04). 북쪽 D02v2. 배율 v2와 같음(벽선 0.873, 변화율 2/3). 배경 2배 고정.
python3 tools/objects/office_desk_place_v4.py <out.png> [묶음1 왼쪽 x] [묶음2 왼쪽 x] [남쪽 발 y] [북쪽 발 y] [쟈알디 가운데 x] [쟈알디 발 y]"""
import sys
from pathlib import Path
from PIL import Image
R = Path(__file__).resolve().parents[2]; K = 2
bg = Image.open(R / 'game-src/art/pixellab-hq-20261031/hq_office_final_1482x424.png').convert('RGBA')
BG = bg.resize((bg.width * K, bg.height * K), Image.NEAREST)
O = R / 'game-src/action/objects'
SOUTH = [O / 'D01v3_사무책상_1배_8방향/south.png', O / 'D03_사무책상_옆면_1배/unknown.png']
NORTH = O / 'D02v2_사무책상_북쪽_1배/unknown.png'
WALL, HZ, S0, P = 302, 164, 62 / 71, 2 / 3
def scale(y): f = S0 * (y - HZ) / (WALL - HZ); return S0 + (f - S0) * P
def load(p, foot):
    im = Image.open(p).convert('RGBA'); im = im.crop(im.getbbox()); s = scale(foot) * K
    return im.resize((round(im.width * s), round(im.height * s)), Image.NEAREST)
a = sys.argv
G1, G2 = (int(a[2]) if len(a) > 2 else 40), (int(a[3]) if len(a) > 3 else 620)
SF, NF = (int(a[4]) if len(a) > 4 else 374), (int(a[5]) if len(a) > 5 else 345)
L = []
# 08:02 사용자 「딱 북쪽 책상이 남쪽 책상 뒤에서 이어지게 붙여」: 북쪽 상판 앞끝(넓은 나무색 마지막 줄) = 남쪽 상판 뒤끝(첫 줄). NF 인자는 안 씀.
import colorsys
def wood(im):
    w = im.width; rows = []
    for y in range(im.height):
        n = 0
        for x in range(w):
            r, g, b, al = im.getpixel((x, y))
            if al > 200:
                h, sa, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if 0.04 < h < 0.12 and sa > 0.3 and v > 0.55: n += 1
        rows.append(n)
    ys = [y for y in range(im.height) if rows[y] > w * 0.5]; return ys[0], ys[-1]
NYS = []
# 08:05 사용자 「공간 낭비, 책상은 4덩이로 분리」 → 덩이 = 남 1 + 북 1, 4덩이를 방 너비에 고르게. CLUSTERS=4 기본(2면 옛 v4 묶음)
import os
NCL = int(os.environ.get('CLUSTERS', '4'))
if NCL == 4:
    dw = load(SOUTH[0], SF).width / K; gap = (bg.width - 4 * dw) / 5
    DX = [60, 0, 60, 0]  # 덩이별 손 조정(1배 px). 08:06 사용자 「3번째·1번째를 오른쪽으로 조금 붙여」 +40, 08:07 「좀더 살짝」 +20
    GROUPS = [(round(gap + i * (dw + gap)) + DX[i], 1) for i in range(4)]
else:
    GROUPS = [(G1, 2), (G2, 2)]
for gi, (gx, cnt) in enumerate(GROUPS):
    x = gx * K
    for i in range(cnt):
        s = load(SOUTH[(gi * cnt + i) % 2], SF); sy = SF * K - s.height; st = sy + wood(s)[0]
        nf = SF - 8
        for _ in range(3):
            n = load(NORTH, nf); ny = st - wood(n)[1]; nf = (ny + n.height) / K
        NYS.append(nf)
        L.append((nf, n, x + (s.width - n.width) // 2, ny))
        L.append((SF, s, x, sy))
        x += s.width
NF = round(sum(NYS) / len(NYS)); print('north foot', [round(v, 1) for v in NYS])
# 쟈알디 책상 = 북쪽 책상(D02v2), 오른쪽 끝 (사용자 07:53 「쟈알디는 북쪽으로」, 핀 92%). JX=가운데 x, JF=발 y = 북쪽 줄과 같음(사용자 07:57)
JX, JF = (int(a[6]) if len(a) > 6 else 1364), (int(a[7]) if len(a) > 7 else NF)
# 08:04 사용자 「쟈알디껄 따로 빼지 말자」 → 기본 끔. 다시 보려면 JALDI=1
import os
if os.environ.get('JALDI') == '1':
    j = load(NORTH, JF); L.append((JF, j, JX * K - j.width // 2, JF * K - j.height))
# 바닥 그림자(코드, 책상 그림은 안 건드림, 사용자 07:53 「그림자가 없으니 이상」): 책상 발 둘레 바닥에 2단 반투명 띠, 2배 픽셀 단위
# 07:57 사용자 「각지고 흰줄」 → 상자 2단 폐기. 둥근 타원 마스크를 흐려 1배 격자로 맞춘 부드러운 그림자(가장자리 계단·밝은 줄 없음)
from PIL import ImageDraw, ImageFilter
SHC, SHA = (20, 26, 38), 120          # 색, 가운데 최대 알파
SD = int(a[8]) if len(a) > 8 else 14  # 그림자 깊이(1배 px)
def shadow(im, x, y):
    W, H = out.width // K, out.height // K
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    fy, l, r = (y + im.height) / K, x / K, (x + im.width) / K
    d.ellipse([l - 4, fy - SD, r + 4, fy + 4], fill=SHA)
    m = m.filter(ImageFilter.GaussianBlur(3)).resize(out.size, Image.NEAREST)
    lay = Image.new('RGBA', out.size, SHC + (0,)); lay.putalpha(m)
    out.alpha_composite(lay)
out = BG.copy()
for _, im, x, y in sorted(L, key=lambda t: t[0]): shadow(im, x, y); out.alpha_composite(im, (x, y))
out.convert('RGB').save(a[1]); print('south w', [t[1].width for t in L if t[0] == SF])
