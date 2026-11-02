"""백일몽 13층 남자 화장실 잇기 v2 이음 손질 (사용자 11-02 13:35 「여기 코드로 어떻게좀 해봐」, 이음 x≈295 아래 판넬 틀 어긋남).
결과 그림의 x240–340을 생성 창(_window.png) 그대로 붙여, 이음을 여자 문틀 바로 왼쪽(x340, 다시 그린 칸 끝)으로 옮긴다. 새로 그린 픽셀은 없다(합성만)."""
from PIL import Image
A = 'game-src/art/pixellab-baekilmong/'
w = Image.open(A + 'by_f13_hall_g4_ext2L_v2_window.png').convert('RGBA')
o = Image.open(A + 'by_f13_hall_g4_ext2L_v2.png').convert('RGBA')
o.paste(w.crop((240, 0, 340, 424)), (240, 0)); o.save(A + 'by_f13_hall_g4_ext2L_v2_fix.png')
