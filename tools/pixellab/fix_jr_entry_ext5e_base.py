"""지상 ext5e 이음 보정(사용자 10-31 「코드로 고쳐」「잘라서 올리라고」「정교하게」).
측정: 처마 띠(y24)·간판 띠(y134~176)는 좌우 같음. 1층 밑은 왼쪽(새로 그린 부분)이 3px 아래 —
셔터 밑선 y294 vs 「제일수선」 문 밑선 y291, 벽돌 끝 줄 285 vs 282~283.
보정: x 0~320(「제일수선」 왼쪽 기둥까지), 간판 띠 바로 아래(y180)부터 인도 위쪽(y309)까지를 3px 위로 옮김.
간판 띠·처마·연석(y356)·차도는 그대로. 옮긴 띠 맨 아래 3줄은 원래 인도 줄(y307~309)로 채움."""
from PIL import Image
import numpy as np
A = 'game-src/art/pixellab-test-20261028/'
X1, Y0, Y1, D = 321, 180, 310, 3
a = np.asarray(Image.open(A + 'jr_entry_v1_ext5e.png').convert('RGBA')).copy()
src = a.copy()
a[Y0:Y1 - D, :X1] = src[Y0 + D:Y1, :X1]
Image.fromarray(a, 'RGBA').save(A + 'jr_entry_v1_ext5e_fix.png')
print('ok')
