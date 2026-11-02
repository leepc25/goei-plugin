"""종합대응팀 사무실(p5) 책상 배치 시안 v2(한 개씩: 북·남·동). 게임처럼 배경 2배 고정, 책상은 깊이 y마다 따로 배율.
배율 기준(사용자 11-02 06:43 「원근 적용」, 여자 탈의실 방식: 변화율 그림의 2/3, 화면 맨 아래까지):
  p5 오른쪽 끝 벽 붙은 책상 상판 높이 62px(1x, 바닥선 y302) = 책상 오브젝트 D01v3 상판 71px → 벽선 배율 0.873.
  어른 ≈ 148px(책상 0.72m 기준) → 눈높이 지평선 HZ = 302 - 0.93*148 = 164.
배치: 뒤 줄 = 북쪽(모니터 뒷면, 사람은 책상 뒤에서 화면 쪽을 봄), 앞 줄 = 남쪽(사람은 등을 보임), 오른쪽 끝 쟈알디 = 동쪽 1개.
python3 tools/objects/office_desk_place_v1.py <out.png>"""
import sys
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[2]; K=2
bg=Image.open(R/'game-src/art/pixellab-hq-20261031/hq_office_p5_632x424.png').convert('RGBA')
BG=bg.resize((bg.width*K,bg.height*K),Image.NEAREST)
D=R/'game-src/action/objects/D01v3_사무책상_1배_8방향'
WALL,HZ,S0,P=302,164,62/71,2/3
def scale(y): f=S0*(y-HZ)/(WALL-HZ); return S0+(f-S0)*P
def desk(d,cx,foot):
    im=Image.open(D/f'{d}.png').convert('RGBA'); bb=im.getbbox(); im=im.crop(bb)
    s=scale(foot)*K; im=im.resize((round(im.width*s),round(im.height*s)),Image.NEAREST)
    return (foot,im,round(cx*K-im.width/2),round(foot*K-im.height))
L=[]
XS=[230]
L.append(desk('north',150,332))
L.append(desk('south',390,410))
L.append(desk('east',560,346))
out=BG.copy()
for _,im,x,y in sorted(L,key=lambda t:t[0]): out.alpha_composite(im,(x,y))
out.convert('RGB').save(sys.argv[1]); print({y:round(scale(y),3) for y in (302,332,346,356,424)})
