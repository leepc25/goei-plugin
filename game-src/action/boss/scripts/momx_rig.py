# 208호 엄마 늘어난 모습(2·3단계). 기준 ../family/base/mom_x.png (키 약 235, 턱이 가슴까지 찢어짐, 긴 손톱).
import math,famcommon as F,brig as R
DESC=('horribly stretched tall thin monster mother with purple permed hair, jaw torn open hanging down to her chest with rows of teeth, long clawed fingers, '
      'beige cardigan, long plum skirt, slippers')
B=R.Body(thigh=56,shin=62,uarm=35,farm=40,torso=63,G=233,k=2.4,head=R.rot((26,-24),-17.5))
X=67
def defs(B,X,hy,ln,ft,hd,clip):
    P,lerp,staged,jit,sh=B.P,R.lerp,R.staged,R.jit,R.sh; G=B.G; KU=R.KNEE_UP
    I=lambda b=0,**k: P((X,115+b),17.5,0,0,(X-3,G),(X-4,G),**({**dict(lh=('r',26,70),rh=('r',20,72)),**k}))
    clip('idle','hunched stretched monster mother sways, torn jaw hanging and twitching, claws flexing',[I(0),I(2),I(3,tilt=4),I(2)])
    def wk(t):
        c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
        return P((X+6,116+3*abs(c)),24,0,0.15*c,(X+6+30*c,G-12*max(0,-sn)),(X+6-30*c,G-12*max(0,sn)),('r',30-16*c,66),('r',20+16*c,68),tilt=6)
    clip('walk','jerky lurching stalk, long legs, claws dragging, head bobbing',[wk(i/8) for i in range(8)])
    C0=P((X-4,124),10,0,0,(X+20,G),(X-24,G),('r',10,50),('r',4,52),tilt=-10)
    BT=P((X+30,130),46,0,0,(X+62,G),(X-10,G),('r',90,30),('r',84,40),tilt=-20)
    clip('bite','coils back then lunges far forward, head thrust out, torn jaw snapping shut on the victim',[I(0),staged(I(0),C0,.5),C0,staged(C0,BT,.5),BT,BT,jit(BT,4,3,['NOSE','EYE','EAR']),lerp(BT,I(0),.5),I(0)])
    CR=P((X+6,170),60,0,0,(X+30,G),(X-24,G),('r',60,60),('r',50,64),lk=KU,rk=KU,tilt=-20)
    AIR=P((X+30,110),50,0,0,(X+40,G-60),(X+4,G-50),('r',96,10),('r',90,20),lk=KU,rk=KU,tilt=-20)
    clip('pounce','drops onto all fours, then springs through the air claws first like an animal',[I(0),staged(I(0),CR,.5),CR,CR,AIR,AIR,lerp(AIR,CR,.5),CR,lerp(CR,I(0),.5)])
    SL=P((X+10,118),20,0,0,(X+20,G),(X-20,G),('r',-10,10),('r',60,70),le=R.ELB_UP)
    SS=P((X+18,124),36,0,0,(X+30,G),(X-20,G),('r',96,70),('r',50,74))
    clip('slash','raises one clawed hand high and rakes it down diagonally across the front',[I(0),staged(I(0),SL,.5),SL,SS,SS,lerp(SS,I(0),.5),I(0)])
    HL=P((X-10,114),2,0,0,(X+6,G),(X-14,G),('r',20,60),('r',10,64),tilt=-20)
    clip('hit','hit reaction: whole stretched body whips back, jaw flapping',[I(0),HL,lerp(HL,I(0),.5),I(0)])
    GR=lambda b: P((X+10,176+b),50,0,0,(X+30,G),(X-16,G),('r',60,70),('r',50,72),lk=KU,tilt=20)
    clip('groggy','stunned, folds down to her knees, long arms limp on the floor, head lolling',[I(0),lerp(I(0),GR(0),.5),GR(0),GR(3),GR(0),GR(3)])
    BR=lambda b: P((X+4,118+b),20,0,0,(X+4,G),(X-8,G),('r',30,4),('r',26,8),le=('e',30,40),re=('e',26,42),tilt=-30)
    clip('breath','holds her breath, rigid, both clawed hands clamped over the torn mouth, shaking',[I(0),BR(0),BR(1),BR(0),BR(1),BR(0)])
_m=F.mk('mom_x',B,X,115,17.5,None,None,defs,DESC); CLIPS=_m['CLIPS']; REF=_m['REF']; FIRST=_m['FIRST']
if __name__=='__main__': R.preview(B,CLIPS,REF,f'{F._D}/../family/preview-momx.png',FIRST); print(len(CLIPS))
