"""휴게실 잇기5: 공유기 아래로 늘어져 허공에서 끝나는 파란 선을 벽색으로 지운다(사용자 11-02 05:20)."""
from PIL import Image
D='game-src/art/pixellab-hq-20261031/'
im=Image.open(D+'hq_lounge_p13s_extL5.png').convert('RGBA')
WALL=(0xc4,0xc2,0xc5,255)
px=im.load()
n=0
for y in range(138,145):          # 공유기 몸통 아래(바닥 줄 137까지는 그대로)
    for x in range(309,333):
        if px[x,y]!=WALL: px[x,y]=WALL; n+=1
im.save(D+'hq_lounge_p13s_extL5_fix.png')
print('changed',n)
