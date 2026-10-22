# 생성 없이 코드로 만드는 클립 (mobs_h.CODE_CLIPS)
#  lurker turn: 대기 → 고개 살짝 → 몸 전체 좌우 반전(돌아섬)
#  hanged rise: hang 장을 위로 끌어올림(위치 이동 그림)
#  crawler ceiling: walk 장을 상하 반전해 천장(y=6)에 붙임
import os,sys
from PIL import Image
sys.path.insert(0,os.path.dirname(__file__))
from mobrig import auto_kp,ROOT
def save(k,clip,ims):
    d=f'{ROOT}/{k}/clips/{clip}'; os.makedirs(d,exist_ok=True)
    for i,im in enumerate(ims): im.save(f'{d}/{i:02d}.png')
def lurker_turn():
    kp,_,top,bot=auto_kp('lurker'); ny=int(top+.165*(bot-top))
    src=Image.open(f'{ROOT}/lurker/clips/idle/00.png').convert('RGBA'); W,H=src.size
    head=src.crop((0,0,W,ny)); bb=list(head.getchannel('A').getbbox()); bb[0]=max(bb[0],bb[2]-16); bb=tuple(bb)
    def turned(frac):
        im=src.copy(); im.paste((0,0,0,0),(bb[0],0,bb[2],ny))
        h=head.crop(bb); 
        if frac>=1: h=h.transpose(Image.FLIP_LEFT_RIGHT)
        dx=-2 if 0<frac<1 else (-3 if frac>=1 else 0)
        im.alpha_composite(h,(bb[0]+dx,bb[1])); return im
    # 마지막 장: 목만 뒤집으면 머리 뒤가 잘려 보여서(검수 1022) 몸 전체를 제자리 좌우 반전 = 돌아섬
    a=src.getchannel('A').getbbox(); cx=(a[0]+a[2])//2
    full=src.transpose(Image.FLIP_LEFT_RIGHT); back=Image.new('RGBA',src.size); back.paste(full,(2*cx-W,0),full)
    save('lurker','turn',[src,turned(.5),back])
def hanged_rise():
    fs=[Image.open(f'{ROOT}/hanged/clips/hang/{i:02d}.png').convert('RGBA') for i in (0,1,2)]
    out=[]
    for f,dy in zip(fs,(20,50,90)):
        im=Image.new('RGBA',f.size); im.alpha_composite(f.crop((0,dy,f.width,f.height)),(0,0)); out.append(im)
    save('hanged','rise',out)
def crawler_ceiling():
    out=[]
    for i in range(4):
        p=f'{ROOT}/crawler/clips/walk/{i:02d}.png'
        if not os.path.exists(p): return
        f=Image.open(p).convert('RGBA').transpose(Image.FLIP_TOP_BOTTOM); bb=f.getchannel('A').getbbox()
        im=Image.new('RGBA',f.size); im.alpha_composite(f.crop(bb),(bb[0],6)); out.append(im)
    save('crawler','ceiling',out)
if __name__=='__main__':
    for fn in sys.argv[1:]: globals()[fn]()
