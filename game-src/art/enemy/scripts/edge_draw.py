# 모서리 조각(edge)은 코드로 그림(생성 0회): 펜로즈 삼각형 한 모서리 = 세 면이 다른 색인 L자 막대.
# 생성기가 「도형」 대신 사람을 그려서(cand/edge/101) 직접 그린다. 회전·접기·늘이기·깨짐을 다각형 변환으로.
import math,os,random
from PIL import Image,ImageDraw
ROOT=os.path.join(os.path.dirname(__file__),'..')
W,H,CY,CX=96,72,36,40
C=[(63,127,122),(201,162,58),(122,74,120)]   # 청록·겨자·자주
DK=lambda c,f=.62: tuple(int(v*f) for v in c)
# L자 막대(펜로즈 모서리): 바깥 면 · 윗면 · 안쪽 면 (단위 좌표, 중심 0)
FACES=[[(-14,10),(14,10),(14,-14),(6,-14),(6,4),(-14,4)],          # 앞면
       [(-14,4),(6,4),(6,-14),(10,-18),(10,0),(-10,0)],             # 윗면(비스듬)
       [(14,-14),(6,-14),(10,-18),(18,-18),(18,6),(14,10)]]         # 옆면
def tf(pts,ang=0,sx=1,sy=1,dx=0,dy=0):
    a=math.radians(ang); out=[]
    for x,y in pts:
        x,y=x*sx,y*sy; out.append((CX+dx+x*math.cos(a)-y*math.sin(a),CY+dy+x*math.sin(a)+y*math.cos(a)))
    return out
def frame(ang=0,sx=1,sy=1,shift=0,parts=None):
    im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    for i,f in enumerate(FACES):
        col=C[(i+shift)%3]; off=(parts[i] if parts else (0,0))
        p=tf(f,ang,sx,sy,*off); d.polygon(p,fill=col,outline=(0,0,0,255))
        # 면 안 음영 한 단: 아래쪽 절반 어둡게
        q=tf([(x,y*.5+(max(v[1] for v in f)*.5)) for x,y in f],ang,sx,sy,*off); d.polygon(q,fill=DK(col,.8))
        d.polygon(p,outline=(0,0,0,255))
    return im
def save(clip,ims):
    d=f'{ROOT}/edge/clips/{clip}'; os.makedirs(d,exist_ok=True)
    for i,im in enumerate(ims): im.save(f'{d}/{i:02d}.png')
if __name__=='__main__':
    os.makedirs(f'{ROOT}/edge/props',exist_ok=True)
    frame().save(f'{ROOT}/edge/base.png')
    save('idle',[frame(a,shift=s) for a,s in ((0,0),(20,1),(40,2),(60,0))])
    save('spin_tele',[frame(0,.85,.85),frame(-10,.7,.7)])
    save('spin_hit',[frame(15,1.1,1.1,1)])
    save('spin_rec',[frame(5,.95,.95)])
    save('cut_tele',[frame(-45)])
    save('cut_hit',[frame(-45,1.6,.7),frame(-45,2.0,.55)])
    save('cut_rec',[frame(-30,1.2,.9)])
    random.seed(3)
    save('shatter',[frame(0,parts=[(-3*k,2*k),(2*k,-3*k),(4*k,2*k)]) for k in (1,3,5)])
    ch=Image.new('RGBA',(16,16),(0,0,0,0)); ImageDraw.Draw(ch).polygon([(2,12),(13,3),(10,13)],fill=C[0],outline=(0,0,0,255)); ch.save(f'{ROOT}/edge/props/chip.png')
    print('edge drawn')
