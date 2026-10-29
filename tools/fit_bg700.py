"""완성 배경을 게임 규격(세로 700, 벽·바닥 선 y420, 문 높이 300px)에 맞춘다.
문 높이로 배율을 정하고(1m = 142px, 맨 뒤 사람 235px), 벽선이 y420에 오도록 위를 자르거나(모자라면 맨 윗줄을 늘려 덧댐),
세로 700에 맞게 아래를 자른다(모자라면 맨 아래 바닥 60px를 늘려 채움).
사용: python3 fit_bg700.py <입력> <출력> <원본 벽선 y> <원본 문 높이(맨 뒤 줄 기준)>"""
import sys
from PIL import Image


def fit(src, dst, wall_y, door_h):
    im = Image.open(src).convert("RGB")
    s = 300.0 / door_h
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    top = round(wall_y * s) - 420
    out = Image.new("RGB", (im.width, 700))
    if top >= 0:
        body = im.crop((0, top, im.width, im.height))
        out.paste(body, (0, 0))
    else:
        out.paste(im.crop((0, 0, im.width, 1)).resize((im.width, -top)), (0, 0))
        body = im
        out.paste(body, (0, -top))
    used = max(0, -top) + body.height
    need = 700 - used
    if need > 0:
        band = body.crop((0, body.height - 60, body.width, body.height)).resize((body.width, 60 + need), Image.LANCZOS)
        out.paste(band, (0, used - 60))
    out.save(dst)
    return im.width, s, top, max(need, 0)


if __name__ == "__main__":
    w, s, top, need = fit(sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]))
    print(sys.argv[2], f"{w}x700 배율 {s:.3f} 위 {top:+d}px 아래 보충 {need}px")
