"""백일몽 13층 남자 화장실 잇기 v2 이음 손질 (사용자 11-02 13:35 「여기 코드로 어떻게좀 해봐」, 13:38 x340 이음 아래 틀·가운데 띠·위 띠 세 곳 지적).
1) 결과 그림 x240–340을 생성 창(_window.png) 그대로 붙여 이음을 여자 문틀 쪽(x340)으로 옮긴다 
2) x340–346(새 기둥과 여자 문틀 사이 옛 좁은 띠, y30–330)은 새 기둥 오른쪽 7줄(x333–339)을 그대로 옮겨 채워 가운데 띠·아래 틀이 문틀까지 이어지게 한다.
새로 그린 픽셀은 없다(같은 그림 안 복사·붙이기만)."""
from PIL import Image
A = 'game-src/art/pixellab-baekilmong/'
w = Image.open(A + 'by_f13_hall_g4_ext2L_v2_window.png').convert('RGBA')
o = Image.open(A + 'by_f13_hall_g4_ext2L_v2.png').convert('RGBA')
f = o.copy()
f.paste(w.crop((240, 0, 340, 424)), (240, 0))
f.paste(f.crop((333, 30, 340, 331)), (340, 30))
f.save(A + 'by_f13_hall_g4_ext2L_v2_fix.png')
