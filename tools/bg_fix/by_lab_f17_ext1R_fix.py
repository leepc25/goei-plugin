"""백일몽 17층 연구실 오른쪽 잇기 이음 손질 (사용자 15:39 핀 「여기 잘렸는데」: 초록 화면 모니터·현미경이 이음에서 반쯤 잘림).
옛 그림(p5)의 모니터·현미경 칸 x440~494, y172~252만 잇기 결과에 되붙인다. 그 밖은 그대로."""
from PIL import Image
D = 'game-src/art/pixellab-baekilmong/'
old = Image.open(D + 'by_lab_f17_p5_632x424.png').convert('RGBA')
new = Image.open(D + 'by_lab_f17_ext1R.png').convert('RGBA')
boxes = [(440, 172, 494, 232), (440, 232, 487, 252)]   # 아래는 새 그림 파란 플라스크(x488~) 살리게 487까지
for box in boxes: new.paste(old.crop(box), box[:2])
new.save(D + 'by_lab_f17_ext1R_fix.png'); print('붙인 칸', boxes)
