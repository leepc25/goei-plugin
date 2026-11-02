"""백일몽 13층 복도 합치기 (사용자 11-02 13:38 「휴게실 합쳐」): 남자 화장실 잇기 손질판(ext2L_v2_fix, 1192) + 휴게실 오른쪽 잇기 v3(ext1R_v3, 1208).
둘 다 ext1L(952) 위에 이은 것이라, ext1L의 손대지 않은 가운데(x700)에서 휴게실 판을 붙인다(그 열은 두 그림이 같은 픽셀). 새로 그린 픽셀 없음."""
from PIL import Image
import numpy as np
A = 'game-src/art/pixellab-baekilmong/'
L = Image.open(A + 'by_f13_hall_g4_ext2L_v2_fix.png').convert('RGBA')
R = Image.open(A + 'by_f13_hall_g4_ext1R_v3.png').convert('RGBA')
off = L.width - 952
assert (np.asarray(L)[:, off + 600:off + 700] == np.asarray(R)[:, 600:700]).all()
out = Image.new('RGBA', (off + R.width, 424)); out.paste(L, (0, 0)); out.paste(R.crop((700, 0, R.width, 424)), (off + 700, 0))
out.save(A + 'by_f13_hall_g4_full.png'); print(out.size)
