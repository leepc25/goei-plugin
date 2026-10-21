"""GPT 컷신 프레임의 작은 설정 오류를 색만 바꿔 고친다: python3 tools/fix_cutscene_frames.py [--check]

원본은 game-src/art/cutscene/frames_orig/<컷신>/<컷>/ 에 한 번만 복사해 두고, 고칠 때마다 원본에서 다시 만든다.
고칠 것은 FIXES에 (컷신/컷, 종류, 상자) 로 적는다. 상자 밖과 다른 색은 건드리지 않는다.
- red_eyes / grey_eyes: 상자 안 어두운 갈색·회색 홍채 색을 붉은 눈(#d12b3a 계열)으로
- shirt: 상자 안 피부색을 흰 셔츠색으로 (셔츠 없이 맨살로 그려진 가슴)
- sky_light: 파란 하늘을 흰 빛으로
"""
import colorsys
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FR = ROOT / 'game-src/art/cutscene/frames'
ORIG = ROOT / 'game-src/art/cutscene/frames_orig'

FIXES = [
    ('first_entry/c6', 'red_eyes', [(120, 150, 260, 250), (390, 150, 520, 250)]),
    ('first_day/c4', 'grey_iris', [(284, 109, 299, 130)]),
    ('first_entry/c4', 'shirt', [(285, 58, 360, 130)]),
    ('first_call/c3', 'grey_eyes', [(222, 100, 258, 126), (292, 100, 330, 126)]),
    ('return/c3', 'sky_light', [(0, 0, 640, 360)]),
]


def hsv(c):
    return colorsys.rgb_to_hsv(*(q / 255 for q in c))


def rgb(h, s, v):
    return tuple(round(q * 255) for q in colorsys.hsv_to_rgb(h, s, v))


def red_eye(c):
    """어두운 붉은 갈색 홍채만 (주변 피부는 밝거나 채도가 낮다)"""
    h, s, v = hsv(c)
    hd = h * 360
    if not ((hd >= 300 or hd <= 40) and s >= 0.4 and 0.1 <= v <= 0.5):
        return None
    return rgb(355 / 360, max(s, 0.8), min(0.8, v * 1.9 + 0.08))


def grey_eye(c):
    """회색으로 그려진 홍채. 눈꺼풀 그림자(따뜻한 갈색)는 빼고 무채색·찬 회색만"""
    h, s, v = hsv(c)
    hd = h * 360
    if not (0.18 <= v <= 0.55 and (s < 0.08 or (s < 0.35 and 180 <= hd <= 360) or (s < 0.16 and hd <= 40))):
        return None
    return rgb(355 / 360, 0.78, min(0.8, v * 1.6 + 0.1))


def grey_iris(c):
    """상자를 홍채에 꼭 맞게 잡은 경우: 회색이면 다 칠한다"""
    h, s, v = hsv(c)
    if not (s < 0.35 and 0.18 <= v <= 0.5):
        return None
    return rgb(355 / 360, 0.78, min(0.8, v * 1.6 + 0.1))


def eye_white(c):
    h, s, v = hsv(c)
    return s < 0.14 and v > 0.85


def skin_to_shirt(c):
    h, s, v = hsv(c)
    hd = h * 360
    if not (10 <= hd <= 40 and 0.2 <= s <= 0.75 and v >= 0.45):
        return None
    # 따뜻한 조명 아래 흰 셔츠: 밝기는 조금 올리고 채도는 낮게
    return rgb(h, s * 0.28, min(0.95, v * 1.05 + 0.04))


def sky_to_light(c):
    """해치 너머 파란 하늘을 쏟아지는 흰 빛으로 (콘티: 흰 빛, 하늘 아님)"""
    h, s, v = hsv(c)
    hd = h * 360
    if not (180 <= hd <= 230 and (s >= 0.3 and v >= 0.55 or s >= 0.08 and v >= 0.75)):
        return None
    return rgb(45 / 360, 0.06, min(1.0, 0.9 + v * 0.1))


KIND = {'red_eyes': red_eye, 'grey_eyes': grey_eye, 'grey_iris': grey_iris, 'shirt': skin_to_shirt, 'sky_light': sky_to_light}


def main():
    check = '--check' in sys.argv
    for cut, kind, boxes in FIXES:
        src = ORIG / cut
        dst = FR / cut
        if not dst.exists():
            print(f'{cut}: 프레임 없음, 건너뜀')
            continue
        if not src.exists():
            shutil.copytree(dst, src)
        fn = KIND[kind]
        changed = 0
        for p in sorted(src.glob('*.png')):
            im = Image.open(p).convert('RGB')
            px = im.load()
            memo = {}
            for x0, y0, x1, y1 in boxes:
                if kind == 'grey_eyes':
                    # 눈을 감은 장(흰자 없음)은 건너뛰고, 흰자 둘레 몇 px 안만 칠한다
                    wh = [(x, y) for y in range(y0, y1) for x in range(x0, x1) if eye_white(px[x, y])]
                    if len(wh) < 4:
                        continue
                    x0, x1 = max(x0, min(x for x, _ in wh) - 4), min(x1, max(x for x, _ in wh) + 5)
                    y0, y1 = max(y0, min(y for _, y in wh) - 4), min(y1, max(y for _, y in wh) + 5)
                for y in range(max(0, y0), min(im.height, y1)):
                    for x in range(max(0, x0), min(im.width, x1)):
                        c = px[x, y]
                        if c not in memo:
                            memo[c] = fn(c)
                        n = memo[c]
                        if n:
                            px[x, y] = n
                            changed += 1
            if not check:
                im.save(dst / p.name, optimize=True)
        print(f'{cut} {kind}: {changed}픽셀')


main()
