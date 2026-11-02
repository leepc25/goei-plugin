# 한 바퀴 월계관에서 위쪽 잎을 「잎 통째로」 지워 반 바퀴를 만든다(줄 긋기 자르기 아님).
# 밝은 잎 덩어리(어두운 윤곽선으로 나뉨)를 찾아 무게중심이 CUT보다 위인 잎만 지우고, 남은 잎에 붙은 윤곽선만 남긴다.
# 사용: python3 laurel_half.py <칸번호 0~7> <CUT y> <출력.png>
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
src = np.array(Image.open('laurel_0.png').convert('RGBA'))
k = int(sys.argv[1]); cut = int(sys.argv[2]); r, c = k // 4, k % 4
a = src[r*96:(r+1)*96, c*96:(c+1)*96].copy()
op = a[..., 3] > 8
lum = a[..., :3] @ np.array([.299, .587, .114])
bright = op & (lum > 120)
lab, n = ndimage.label(bright)
keep = np.zeros_like(bright)
for i in range(1, n + 1):
    ys, xs = np.nonzero(lab == i)
    if ys.mean() >= cut: keep |= lab == i
near = ndimage.binary_dilation(keep, iterations=2)
final = op & (keep | (near & ~bright))
a[~final] = 0
Image.fromarray(a).save(sys.argv[3])
