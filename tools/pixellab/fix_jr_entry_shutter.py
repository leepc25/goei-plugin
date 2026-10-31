"""지상 출입구 축소본(jr_entry_street_v2_entr) 이음 보정(사용자 10-31 코드로 고치기).
다시 그린 마스크 왼쪽 경계(x1205)가 「임대」 셔터 한가운데를 지나 아래쪽 셔터 살·밑선이 어긋남.
셔터 살은 가로로 같은 무늬라, x1205~1242 · y168~274(셔터+밑틀)를 왼쪽 원래 셔터 열(x1185~1204)을 되풀이해 채운다. 오른쪽 틀(x1243~)은 그대로."""
from PIL import Image
import numpy as np
A = 'game-src/art/pixellab-test-20261028/'
a = np.asarray(Image.open(A + 'jr_entry_street_v2_entr.png').convert('RGBA')).copy()
X0, X1, Y0, Y1, P0, P1 = 1205, 1243, 168, 275, 1185, 1205
per = P1 - P0
for x in range(X0, X1):
    a[Y0:Y1, x] = a[Y0:Y1, P0 + (x - P0) % per]
Image.fromarray(a, 'RGBA').save(A + 'jr_entry_street_v2_entr_fix.png')
print('ok')
