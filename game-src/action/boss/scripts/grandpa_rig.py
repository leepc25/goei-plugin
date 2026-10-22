# 405호 할아버지 (2단계, 256×256, 키 약 150). 기준 ../elder/base/grandpa.png. 키 크고 마른 노인, 팔을 벌린 채, 얼굴 거꾸로. 끌어안기(잡기)·발 구르기·문 막기.
import math,os,brig as R
_D=os.path.dirname(os.path.abspath(__file__))
REF=f'{_D}/../elder/base/grandpa.png'; FIRST=R.first_from(f'{_D}/../elder/base/grandpa.skel.json')
DESC=('tall thin elderly Korean grandfather with an upside-down face (eyes where the mouth should be, smiling mouth on the forehead), thin white hair, '
      'brown knitted vest over a pale shirt, grey slacks, brown shoes')
B=R.Body(thigh=33,shin=32,uarm=24,farm=24,torso=36,G=201,k=1.4,head=(16,-17))
P,lerp,staged,sh,jit=B.P,R.lerp,R.staged,R.sh,R.jit
KNEE_UP,ELB_UP,ELB_OUT=R.KNEE_UP,R.ELB_UP,R.ELB_OUT
X=105; G=B.G; CLIPS={}
def clip(n,a,ps): assert 3<=len(ps)<=15,(n,len(ps)); CLIPS[n]=('side view in profile facing right: '+a,[R.anatomic(p) for p in ps])
I=lambda b=0,**k: P((X,136+b),2,0,0,(X+2,G),(X-2,G),**({**dict(lh=('r',26,30),rh=('r',22,34)),**k}))
clip('idle','stands smiling with both arms held half open as if to hug, slight sway',[I(0),I(1),I(1,lh=('r',28,28)),I(0)])
def wk(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,137+abs(c)),6,0,0.1*c,(X+2+14*c,G-6*max(0,-sn)),(X+2-14*c,G-6*max(0,sn)),('r',30,28),('r',26,32))
clip('walk','stiff lurching walk with both arms held open wide in front, like coming in for a hug',[wk(i/8) for i in range(8)])
OP=P((X-2,136),-4,0,0,(X+8,G),(X-10,G),('r',40,0),('r',-10,4),le=ELB_OUT,tilt=-8)
CL=P((X+16,140),20,0,0,(X+30,G),(X-6,G),('r',30,24),('r',26,26))
clip('hug','throws both arms wide open, lunges forward and snaps them shut in a crushing hug',[I(0),staged(I(0),OP,.5),OP,OP,staged(OP,CL,.5),CL,CL,lerp(CL,I(0),.5),I(0)])
SQ=lambda a: P((X+6,138),10,0,0,(X+18,G),(X-6,G),('r',22-2*a,24),('r',18-2*a,26),tilt=-6*a)
clip('squeeze','holding someone tight in a hug, squeezing harder and harder, rocking',[SQ(0),SQ(1),SQ(2),SQ(1)])
ST=P((X,130),4,0,0,(X+16,G-44),(X-6,G),('r',26,10),('r',14,30),lk=KNEE_UP)
SD=P((X+6,144),10,0,0,(X+20,G),(X-8,G),('r',28,22),('r',22,28))
clip('stomp','raises his near knee high, then stamps down with tremendous force, the whole body jolting',[I(0),staged(I(0),ST,.5),ST,ST,SD,SD,lerp(SD,I(0),.5),I(0)])
BL=lambda b: P((X,138+b),0,0,0,(X+12,G),(X-12,G),('r',4,-30),('r',-4,-28),le=ELB_UP,re=ELB_UP)
clip('block','spreads both arms high and wide, blocking the way with his whole body, swaying',[I(0),BL(0),BL(1),BL(0),BL(1),BL(0)])
AR=lambda a: P((X-2,136),0,0.3,0.1,(X+6,G),(X-8,G),('r',-16+10*a,-6),('r',20,30),tilt=-12+6*a)
clip('argue','turns aside, shaking his finger angrily back at someone, arguing',[I(0),AR(0),AR(1),AR(0),AR(1),I(0)])
HL=P((X-6,134),-10,0.3,0.2,(X+6,G),(X-10,G),('r',14,26),('r',4,30),tilt=-14)
clip('hit','hit reaction: rocks back, head snaps back',[I(0),HL,lerp(HL,I(0),.5),I(0)])
FR=P((X-4,136),-2,0,0,(X+6,G),(X-8,G),('r',16,12),('r',12,14),tilt=-16)
clip('freeze','startled, freezes stiff with his hands up at his chest, staring toward the door',[I(0),lerp(I(0),FR,.5),FR,FR,jit(FR,0,-1,['NOSE']),FR])
GR=lambda b: P((X+4,164+b),30,0,0,(X+22,G),(X-6,G),('r',30,40),('r',26,42),tilt=12,lk=KNEE_UP)
clip('groggy','stunned, drops to one knee, arms hanging, head drooping',[I(0),lerp(I(0),GR(0),.5),GR(0),GR(2),GR(0),GR(2)])
SW=P((X-8,140),-20,0,0,(X+4,G),(X-16,G),('r',30,-10),('r',26,-4),tilt=-20,le=ELB_UP,re=ELB_UP)
clip('seized','is grabbed from the front and pulled forward, flailing his arms, leaning back in terror',[I(0),SW,sh(SW,6),sh(SW,12,2),sh(SW,20,4),sh(SW,30,6)])
if __name__=='__main__': R.preview(B,CLIPS,REF,f'{_D}/../elder/preview-grandpa.png',FIRST); print(len(CLIPS))
