"""본부 3층 ext2R 이음 자리(x903) 오른쪽이 2~3px 위로 틀어진 것을 코드로 맞춘다 (2026-11-01 사용자 「코드로 수정 가능한가」).
오른쪽(x>=903)을 줄 단위로 아래로 민다: y84~97은 3px, ~229는 2px, ~289는 1px, 그 아래는 그대로. 도트 그대로(보간 없음).
사용: python3 fix_hq_f3_ext2R_seam.py <입력> <출력>"""
import sys
from PIL import Image
SEAM = 903
def d(y):
    if y < 84: return 0
    if y < 98: return 3
    if y < 230: return 2
    if y < 290: return 1
    return 0
im = Image.open(sys.argv[1]).convert("RGBA")
out = im.copy()
w, h = im.size
for y in range(h):
    k = d(y)
    if k:
        out.paste(im.crop((SEAM, y - k, w, y - k + 1)), (SEAM, y))
out.save(sys.argv[2])
