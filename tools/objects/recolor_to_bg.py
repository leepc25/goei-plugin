"""물건 색만 배경 색에 맞춘다(모양·픽셀 위치는 그대로). 배경 조각의 색을 48색 팔레트로 뽑고, 물건의 불투명 픽셀을 가장 가까운 팔레트 색으로 바꾼다.
사용: python3 recolor_to_bg.py <물건.png> <배경 조각.png> <출력.png>  (2026-11-02 격리팀 실험용 책상, 사용자 「둘다」)"""
import sys
import numpy as np
from PIL import Image
obj, ref, out = sys.argv[1:4]
pal = Image.open(ref).convert('RGB').quantize(48, method=Image.MEDIANCUT).convert('RGB')
P = np.unique(np.asarray(pal).reshape(-1, 3), axis=0).astype(np.int32)
a = np.asarray(Image.open(obj).convert('RGBA')).copy()
m = a[:, :, 3] > 0
px = a[m][:, :3].astype(np.int32)
d = ((px[:, None, :] - P[None, :, :]) ** 2).sum(2)
a[m, :3] = P[d.argmin(1)].astype(np.uint8)
Image.fromarray(a).save(out)
