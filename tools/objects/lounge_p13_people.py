"""휴게실 p13s 잇기5: 의자 12개(lounge_p13_chairs.py 자리 그대로)에 1.x 관리국 12명을 앉힘.
의자는 고정, 사람만 fit_all.json 맞춤값(dx,dy)×배율로 옮김. 배경 2배 고정, 배율은 자판기 기준 키 + 원근 0.5.
python3 lounge_p13_people.py <out.png>"""
import sys, os, json
from pathlib import Path
R=Path(__file__).resolve().parents[2]
os.environ['CHAIR_DIR']=str(R/'game-src/art/objects/chairs_shell/fit')
OUTP=sys.argv[1]; sys.argv=sys.argv[:1]
sys.path.insert(0,str(R/'game-src/action/testroom3')); sys.path.insert(0,str(R/'game-src/action/testroom3/qa'))
import fit_chair as fc
from PIL import Image
K=2; P=float(os.environ.get('PERSP','0.5'))
bg=Image.open(R/'game-src/art/pixellab-hq-20261031/hq_lounge_p13s_extL5_fix.png').convert('RGBA')
BG=bg.resize((bg.width*K,bg.height*K),Image.NEAREST)
FOOTV=301; ADULT=round(150*113/124); HZ=FOOTV-round(ADULT*0.93); A=ADULT/(FOOTV-HZ)
def scale(y):
    b=K*A*(FOOTV-HZ)/247; f=K*A*(y-HZ)/247; return b+(f-b)*P
def S(im,s): return im.resize((max(1,round(im.width*s)),max(1,round(im.height*s))),Image.NEAREST)
FIT=json.loads((R/'game-src/art/objects/chairs_shell/fit_all.json').read_text())
TD=R/'game-src/art/objects/lounge_tables'; TM=json.loads((TD/'tables.json').read_text())
TAB={'table1':(162,134,80,207),'table2':(462,434,381,508),'table3':(713,740,667,795)}   # lounge_p13_chairs.py 와 같음
FB,FF,FS=340,395,362
LID={'front':'60','side':'96','back':'61'}
layers=[]
def seat(key,view,X,fy,order,flip=False):
    """X = 의자 기준점 x(2배 화면 px), fy = 의자 발 y(1배). 의자는 이 점에 고정, 사람은 -dx,-dy."""
    s=scale(fy); p=FIT[key][view]; cfg,_=fc.load(key)
    pim=fc.last(cfg,LID[view]); cim=Image.open(fc.chair_png(p['img'])).convert('RGBA')
    dx,dy=p['dx'],p['dy']
    if flip: pim=pim.transpose(Image.FLIP_LEFT_RIGHT); cim=cim.transpose(Image.FLIP_LEFT_RIGHT); dx=-dx
    Y=fy*K; Fx,Fy=X-dx*s,Y-dy*s
    ps=S(pim,s); cs=S(cim,s)
    px,py=round(Fx-ps.width/2),round(Fy-(pim.height-4)*s)
    cx,cy=round(X-100*s),round(Y-171*s)
    if view=='back': layers.append((order,0,ps,px,py)); layers.append((order,1,cs,cx,cy))
    else: layers.append((order,0,cs,cx,cy)); layers.append((order,1,ps,px,py))
east=Image.open(R/'game-src/art/objects/chairs_shell/fit/east.png').convert('RGBA').crop((0,0,200,172)).getbbox()
WHO=['1.1_쟈알디','1.4_에일린','1.2_스팡달','1.3_잼트리','1.9_데드폴','1.10_게슈간','1.11_로제몬','1.12_콘쥬스',
     '1.7_고르고디오','1.6_큐라스','1.5_고그니쟈','1.8_데쥬레']
i=0
for n,(xb,xf,xl,xr) in TAB.items():
    seat(WHO[i],'front',xb*K,FB,0); i+=1                                   # 테이블 뒤, 정면
    s=scale(FS)
    seat(WHO[i],'side',xl*K-(east[2]-100)*s,FS,1); i+=1                    # 왼쪽, 테이블 쪽(오른쪽) 봄
    seat(WHO[i],'side',xr*K+(east[2]-100)*s,FS,1,flip=True); i+=1          # 오른쪽, 왼쪽 봄
    t=Image.open(TD/f'{n}.png').convert('RGBA'); layers.append((2,0,S(t,K),TM[n]['x']*K,TM[n]['y']*K))
    seat(WHO[i],'back',xf*K,FF,3); i+=1                                     # 테이블 앞, 등
out=BG.copy()
for o,o2,im,x,y in sorted(layers,key=lambda t:(t[0],t[1])):
    out.paste(im,(x,y),im)
out.convert('RGB').save(OUTP)
print('ADULT',ADULT,{y:round(scale(y),2) for y in (FB,FS,FF)})
