"""완성 배경을 게임 규격(세로 700, 벽·바닥 선 y420, 문 높이 300px)에 맞춘다.
문 높이로 배율을 정하고(1m = 142px), 벽선이 y420에 오도록 위를 자르고, 세로 700에 맞게 아래를 자른다.
사용: python3 fit_bg700.py <입력> <출력> <원본 벽선 y> <원본 문 높이>"""
import sys
from PIL import Image

src, dst, wall_y, door_h = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
im = Image.open(src).convert("RGB")
s = 300.0 / door_h
im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
top = round(wall_y * s) - 420
if top < 0:
    raise SystemExit(f"벽선이 너무 높음: 위 여백 {-top}px 부족")
if im.height - top < 700:
    raise SystemExit(f"바닥이 모자람: {700 - (im.height - top)}px 부족")
im.crop((0, top, im.width, top + 700)).save(dst)
print(dst, im.width, "x 700", f"배율 {s:.3f}", f"위 {top}px 자름")
