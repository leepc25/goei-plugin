"""여자 샤워실 p5 왼쪽 잇기: 이음 자리 전기함·배선 덩어리를 코드로 지우고 옆 타일(주기 27px)로 채운다 (사용자 2026-11-01 15:42 「한번 손 봐바」).
바닥 바구니·손잡이 막대·온도계·세로 배관(x380~)은 그대로 둔다."""
import numpy as np, sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGBA')).copy()
H, W = im.shape[:2]
er = np.zeros((H, W), bool)
er[78:126, 316:380] = True          # 위 상자(왼쪽 테두리까지)·전선
er[126:280, 324:380] = True         # 전선·전기함·스위치
er[240:254, 324:345] = False        # 손잡이 막대 원래 부분은 남김
er[280:299, 359:369] = True         # 바닥까지 내려간 전선관
obj = np.zeros((H, W), bool)        # 원본에서 가져오면 안 되는 물건
for x0, y0, x1, y1 in [(276,172,327,235),(272,226,327,243),(268,240,346,255),(250,190,277,253),(318,268,358,307),(276,282,308,307)]:
    obj[y0:y1, x0:x1] = True
bad = er | obj
src_im = im.copy()
ys, xs = np.nonzero(er)
miss = []
for y, x in zip(ys, xs):
    if 170 <= y < 256: miss.append((y, x)); continue  # 거울·수건 높이: 옆엔 깨끗한 타일이 없어 아래에서 세로로
    if y >= 280:  # 바닥 띠: 오른쪽 옆 걸레받이에서
        im[y, x] = src_im[y, x + 10]; continue
    for k in range(1, 6):
        sx = x - 27 * k
        if sx >= 0 and not bad[y, sx]:
            im[y, x] = src_im[y, sx]; break
    else: miss.append((y, x))
# 가로로 못 가져온 줄(막대 높이 등)은 이미 채운 위쪽 타일에서 세로 주기 14px로
left = []
done = set()
ms = set(miss)
for y, x in sorted(miss):
    for k in (2, 3, 4, 1):
        sy = y - 14 * k
        if not (obj[sy, x] and not er[sy, x]) and ((sy, x) not in ms or (sy, x) in done):
            done.add((y, x))
            im[y, x] = im[sy, x]; break
    else: left.append((y, x))
miss = left
Image.fromarray(im).save(out)
print(sorted(set(y for y,x in miss)), sorted(set(x for y,x in miss)))
print('erased', int(er.sum()), 'miss', len(miss), 'bbox x322-379 y78-298')
