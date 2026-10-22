# 405호 거대 할머니 (3단계, 256×256, 키 약 210 굽은 몸). 기준 ../elder/base/giant.png. 몸통이 거의 수평, 긴 팔이 바닥에 닿음(네 발 짐승처럼).
import math,os,brig as R
_D=os.path.dirname(os.path.abspath(__file__))
REF=f'{_D}/../elder/base/giant.png'; FIRST=R.first_from(f'{_D}/../elder/base/giant.skel.json')
DESC=('grotesque giant swollen elderly Korean grandmother with an upside-down face and a gaping mouth, bloated huge stomach, very long thick arms, '
      'torn flower-pattern momppe trousers, ripped stained apron, grey permed hair, bare feet')
B=R.Body(thigh=67,shin=62,uarm=55,farm=66,torso=71,G=213,k=3,head=R.rot((31,12),-90))
P,lerp,staged,sh,jit=B.P,R.lerp,R.staged,R.sh,R.jit
KNEE_UP,ELB_UP,ELB_OUT,KNEE_FWD=R.KNEE_UP,R.ELB_UP,R.ELB_OUT,R.KNEE_FWD
X=70; G=B.G; CLIPS={}
def clip(n,a,ps): assert 3<=len(ps)<=15,(n,len(ps)); CLIPS[n]=('side view in profile facing right: '+a,[R.anatomic(p) for p in ps])
I=lambda b=0,**k: P((X,85+b),90,0,0,(80,G),(64,G),**({**dict(lh=('a',164,205),rh=('a',142,206)),**k}))
clip('idle','hunched on all fours, heaving bloated breaths, swaying',[I(0),I(2),I(4),I(2)])
def cr(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+4,86+2*abs(c)),88,0,0,(84+16*c,G-8*max(0,-sn)),(68-16*c,G-8*max(0,sn)),('a',156-18*c,205-10*max(0,sn)),('a',150+18*c,206-10*max(0,-sn)))
clip('crawl','lurching four-limbed crawl, long arms planting on the floor like front legs',[cr(i/8) for i in range(8)])
RU=P((X+10,124),10,0,0,(X+30,G),(X-6,G),('r',30,-44),('r',20,-46),le=ELB_UP,re=ELB_UP,head=(26,-20))
SL=P((X+20,90),95,0,0,(X+36,G),(X+4,G),('a',220,210),('a',206,212))
clip('slam','rears up onto her hind legs with both huge arms raised high, then crashes them down onto the floor in front',[I(0),staged(I(0),RU,.4),staged(I(0),RU,.8),RU,RU,staged(RU,SL,.6),SL,SL,lerp(SL,I(0),.5),I(0)])
SW1=P((X,88),80,0,0,(80,G),(64,G),('a',96,200),('a',142,206))
SW2=P((X+6,88),92,0,0,(80,G),(64,G),('a',240,196),('a',142,206))
clip('sweep','drags one long arm back then sweeps it in a huge arc across the floor in front',[I(0),SW1,SW1,lerp(SW1,SW2,.5),SW2,SW2,lerp(SW2,I(0),.5),I(0)])
SU=lambda a: P((X-4,88),80,0,0,(78,G),(62,G),('a',150,205),('a',136,206),head=(18+2*a,-34))
clip('suck','thrusts her head forward and opens her mouth impossibly wide, inhaling hard',[I(0),SU(0),SU(1),SU(2),SU(1),SU(2),SU(1),I(0)])
def ch(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+10,90+3*abs(c)),96,0,0,(90+26*c,G-14*max(0,-sn)),(74-26*c,G-14*max(0,sn)),('a',176-30*c,205-16*max(0,sn)),('a',170+30*c,206-16*max(0,-sn)))
clip('charge','galloping four-limbed charge, very fast, head low',[ch(i/6) for i in range(6)])
TB=P((X-2,118),-6,0,0,(X+16,G),(X-20,G),('r',-10,-45),('r',-20,-40),le=ELB_UP,re=ELB_UP,head=(26,-20))
TF=P((X+20,110),40,0,0,(X+40,G),(X-6,G),('r',110,-20),('r',100,-10))
clip('hurl','rears up, hauls something huge back over her head with both arms and hurls it forward',[I(0),staged(I(0),TB,.5),TB,TB,staged(TB,TF,.5),TF,TF,lerp(TF,I(0),.5),I(0)])
HL=P((X-6,86),80,0,0,(78,G),(60,G),('a',150,200),('a',136,204),head=(10,-34))
clip('hit','hit reaction: head and shoulders recoil upward and back',[I(0),HL,lerp(HL,I(0),.5),I(0)])
GR=lambda b: P((X+40,170+b),92,0,0,(X-50,206),(X-64,208),('a',180,212),('a',166,212),head=(34,10-b))
clip('groggy','collapses onto her belly, arms splayed, head rolling dizzily',[I(0),lerp(I(0),GR(0),.5),GR(0),GR(3),GR(0),GR(3)])
D1=P((X+4,100),70,0,0,(84,G),(66,G),('r',30,-40),('r',20,-50),le=ELB_UP,re=ELB_UP,head=(10,-36))
D2=P((X+40,186),92,0,0,(X-50,208),(X-64,210),('a',240,212),('a',226,212),head=(36,14))
clip('death','rears up screaming with arms thrown up, then crashes down flat on her belly and goes still',[I(0),staged(I(0),D1,.5),D1,D1,lerp(D1,D2,.4),lerp(D1,D2,.75),D2,D2,D2])
if __name__=='__main__': R.preview(B,CLIPS,REF,f'{_D}/../elder/preview-giant.png',FIRST); print(len(CLIPS))
