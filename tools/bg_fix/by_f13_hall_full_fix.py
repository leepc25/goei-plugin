"""백일몽 13층 복도 전체판 손질 (사용자 11-02 13:43~13:44 핀).
1) 여자 문 왼쪽 새 기둥 머리 오른쪽 끝(x≈347, 「이렇게 만들라고」= 남자 문 옆 기둥 머리처럼): 같은 기둥 머리 왼쪽 끝(x289–303, y32–53)을 좌우로 뒤집어 오른쪽 끝(x340–354)에 붙인다. 기둥 몸통 왼쪽 선 x296 ↔ 오른쪽 선 x347 대칭.
2) 「까만 점선 제대로 선으로」: 엘리베이터 양옆 기둥의 점선 세로줄 x939·x1173을 반대쪽 선(x950·x1184)과 같은 y13–255 구간에서 이은 선(그 줄의 어두운 색 중간값)으로 채운다.
새로 그린 물건 없음(같은 그림 안 복사·뒤집기·선 잇기만)."""
from PIL import Image, ImageOps
import numpy as np
A = 'game-src/art/pixellab-baekilmong/'
im = Image.open(A + 'by_f13_hall_g4_full.png').convert('RGBA')
end = ImageOps.mirror(im.crop((289, 32, 304, 54)))
im.paste(end, (340, 32))
a = np.array(im)
for x in (939, 1173):
    col = a[13:256, x]; dk = col[col[:, :3].astype(int).sum(1) < 60]
    a[13:256, x] = np.median(dk, axis=0).astype(np.uint8)
Image.fromarray(a).save(A + 'by_f13_hall_g4_full_fix.png')
