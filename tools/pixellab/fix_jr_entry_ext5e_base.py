"""지상 ext5e 이음 보정(사용자 10-31 「코드로 고쳐」「잘라서 올리라고」「정교하게」「여기 두줄된거 고쳐」).
측정(원본 ext5e): 처마 띠 y24·간판 띠 y134~176은 좌우 같음. 1층 밑은 왼쪽(새 부분)이 3px 아래 — 셔터 밑선 y294 vs 「제일수선」 291.
인도 뒤쪽 금(가로 줄)은 왼쪽 y308 vs 오른쪽 y307(1px).
1차 보정(가로 띠를 통째로 3px 올림)은 금이 305와 308 두 줄이 됨(사용자 지적) → 줄마다 옮길 양을 다르게:
 x 0~320에서  y180~291 ← 원본 183~294(3px 올림, 셔터 밑선 291)
              y292~306 ← 원본 295~307(13줄을 15줄로: 무늬 없는 인도 줄 303·305를 한 번씩 더)
              y307     ← 원본 308(금, 오른쪽과 같은 307)
              y308~329 ← 원본 309~330(1px 올림), y330 = 원본 330(무늬 없는 줄 한 번 더) — 그 아래(연석 등)는 그대로."""
from PIL import Image
import numpy as np
A = 'game-src/art/pixellab-test-20261028/'
X1 = 321
src = np.asarray(Image.open(A + 'jr_entry_v1_ext5e.png').convert('RGBA'))
a = src.copy()
rows = {}
for y in range(180, 292): rows[y] = y + 3
mid = list(range(295, 308)); mid = mid[:9] + [303] + mid[9:11] + [305] + mid[11:]   # 295..303,303,304,305,305,306,307 = 15줄
for i, y in enumerate(range(292, 307)): rows[y] = mid[i]
rows[307] = 308
for y in range(308, 330): rows[y] = y + 1
rows[330] = 330
assert len(mid) == 15
for y, s in rows.items(): a[y, :X1] = src[s, :X1]
Image.fromarray(a, 'RGBA').save(A + 'jr_entry_v1_ext5e_fix.png')
print('ok')
