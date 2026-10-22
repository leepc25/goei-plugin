# 일반 요원 얼굴 변형(생성 0회): 장마다 뼈대의 코·귀·눈 좌표로 머리 기준틀을 잡고, 머리색 바꾸기 + 작은 덧그림(콧수염·반창고·흉터·꽁지머리 등).
# 출력 final/<타입>/v<n>/<클립>.png, final/<타입>/variants.json. 사용: python3 variants.py 타입...
import sys,os,json,math,colorsys
from PIL import Image
from rig import BODY,to_canvas
from clips import CLIPS
ROOT=os.path.join(os.path.dirname(__file__),'..')
HAIR={'brown':[(58,40,30),(84,60,42),(112,82,58)],'grey':[(88,90,94),(128,130,134),(168,170,174)],'white':[(150,152,156),(196,198,200),(232,232,234)],
      'redbrown':[(70,34,26),(104,52,36),(138,74,50)],'blond':[(120,96,48),(170,140,70),(214,186,104)]}
OUT=(0,0,0)
V={'sword':{'1':('brown',['moustache']),'2':('grey',['bandage']),'3':(None,['beard','scar']),'4':('white',['ponytail','scar','scar2'])},
   'riot': {'1':('brown',['beard']),'2':('grey',['moustache','scar']),'3':('blond',['bandage'])},
   'burn': {'1':('redbrown',['toothpick']),'2':('grey',['beard']),'3':(None,['bandage','scar'])}}
NAMES={'brown':'갈색 머리','grey':'반백','white':'흰 머리','redbrown':'적갈색 머리','blond':'탈색 머리',None:'검은 머리',
       'moustache':'콧수염','bandage':'뺨 반창고','beard':'짧은 수염','scar':'뺨 흉터','scar2':'흉터 둘','ponytail':'꽁지머리','toothpick':'이쑤시개'}
def frame_axes(c):
    """머리 기준틀: 원점 코, u = 귀→코(앞), v = u를 시계 90도(아래)."""
    n=c['NOSE']; e=c['RIGHT EAR']; ux,uy=n[0]-e[0],n[1]-e[1]; L=math.hypot(ux,uy) or 1; ux,uy=ux/L,uy/L
    return n,(ux,uy),(-uy,ux),L
def P(c,a,b):
    n,u,v,_=frame_axes(c); return (round(n[0]+u[0]*a+v[0]*b),round(n[1]+u[1]*a+v[1]*b))
def lum(p): return colorsys.rgb_to_hsv(*[q/255 for q in p[:3]])[2]
def recolor_hair(im,c,ramp):
    px=im.load(); n,u,v,L=frame_axes(c)
    for dy in range(-16,10):
        for dx in range(-16,16):
            x,y=round(n[0])+dx,round(n[1])+dy
            if not(0<=x<im.width and 0<=y<im.height): continue
            p=px[x,y]
            if p[3]<=128: continue
            a=(x-n[0])*u[0]+(y-n[1])*u[1]; b=(x-n[0])*v[0]+(y-n[1])*v[1]
            # 머리카락 자리: 눈높이(b≈-3)보다 위 또는 귀 뒤(a<-L-1)이면서 턱보다 위. 머리 둘레 안(코에서 13px).
            if math.hypot(a+L*0.6,b+3)>11.5: continue
            if not (b<-4.5 or (a<-L-1.5 and b<3)): continue
            vv=lum(p)
            if vv>0.42 or p[:3]==OUT: continue
            px[x,y]=ramp[0 if vv<0.12 else 1 if vv<0.24 else 2]+(255,)
def dot(im,pt,col):
    if 0<=pt[0]<im.width and 0<=pt[1]<im.height and im.getpixel(pt)[3]>128: im.putpixel(pt,col+(255,))
def dotany(im,pt,col):
    if 0<=pt[0]<im.width and 0<=pt[1]<im.height: im.putpixel(pt,col+(255,))
def stamp(im,c,k,ramp):
    if k=='moustache':
        for a in (-2,-1,0): dot(im,P(c,a,2),(30,22,18))
    elif k=='beard':
        for a,b in ((-3,4),(-1,4),(-2,5),(0,5),(-4,3),(-3,6)): dot(im,P(c,a,b),(52,44,40))
    elif k=='bandage':
        for a in (-5,-4,-3):
            for b in (1,2): dot(im,P(c,a,b),(236,226,204))
        dot(im,P(c,-4,1),(206,190,166))
    elif k=='scar':
        for i in range(3): dot(im,P(c,-6+i,0+i),(176,92,82))
    elif k=='scar2':
        for i in range(3): dot(im,P(c,-7+i,2+i),(176,92,82))
    elif k=='toothpick':
        for i in range(3): dotany(im,P(c,1+i,4-i*0.3),(214,196,150))
    elif k=='ponytail':
        r=ramp or HAIR['white']
        for a,b in ((-12,-1),(-13,-1),(-13,0),(-14,0),(-14,1),(-15,1),(-15,2),(-13,1),(-14,2)): dotany(im,P(c,a,b),r[1])
        for a,b in ((-12,-2),(-14,-1),(-16,1),(-16,2),(-15,3),(-14,3)): dotany(im,P(c,a,b),OUT)
def make(t):
    d=f'{ROOT}/final/{t}'; man=json.load(open(d+'/manifest.json')); W,H,_,_=BODY[t]; names={}
    from build import FIX
    for vk,(hair,props) in V[t].items():
        os.makedirs(f'{d}/v{vk}',exist_ok=True); ramp=HAIR.get(hair) if hair else None
        names[vk]=' · '.join([NAMES[hair]]+[NAMES[p] for p in props]) if t!='sword' or vk!='4' else '이도형 미끼(흰 꽁지머리·흉터)'
        for n,(act,prop,ps) in CLIPS[t].items():
            if n not in man['clips']: continue
            strip=Image.open(f'{d}/{n}.png').convert('RGBA'); order=FIX.get(f'{t}:{n}',{}).get('order',list(range(len(ps))))
            out=strip.copy()
            for j,i in enumerate(order):
                fr=strip.crop((j*W,0,j*W+W,H)); c=to_canvas(ps[i],t)
                if ramp: recolor_hair(fr,c,ramp)
                for k in props: stamp(fr,c,k,ramp)
                out.paste(fr,(j*W,0))
            out.save(f'{d}/v{vk}/{n}.png')
    json.dump(names,open(d+'/variants.json','w'),ensure_ascii=False)
    return names
if __name__=='__main__':
    for t in sys.argv[1:] or ['sword','riot','burn']: print(t,make(t))
