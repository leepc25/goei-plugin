# 208호 아빠 늘어난 모습(2·3단계). 기준 ../family/base/dad_x.png (키 약 195, 덩치, 턱 찢어짐, 큰 손).
import math,famcommon as F,brig as R
DESC=('huge stretched hulking monster father with a hard square face, jaw torn open hanging down to his chest with rows of teeth, huge bloody hands, '
      'open checked short-sleeve shirt over a torn white undershirt, grey slacks, slippers')
B=R.Body(thigh=45,shin=50,uarm=36,farm=40,torso=57,G=214,k=2.4,head=R.rot((26,-13),-9))
X=93
def defs(B,X,hy,ln,ft,hd,clip):
    P,lerp,staged,jit,sh=B.P,R.lerp,R.staged,R.jit,R.sh; G=B.G; KU=R.KNEE_UP
    I=lambda b=0,**k: P((X,115+b),9,0,0,(X-10,G),(X+2,G),**({**dict(lh=('r',16,72),rh=('r',-10,72)),**k}))
    clip('idle','hulking monster father stands heavy, huge hands hanging, torn jaw dripping, breathing',[I(0),I(2),I(3),I(2)])
    def wk(t):
        c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
        return P((X+4,116+3*abs(c)),14,0.1*c,0.15*c,(X+4+24*c,G-10*max(0,-sn)),(X+4-24*c,G-10*max(0,sn)),('r',16-14*c,70),('r',-6+14*c,70))
    clip('walk','heavy stomping walk, shoulders rolling, huge hands swinging',[wk(i/8) for i in range(8)])
    UP=P((X-4,122),0,0,0,(X+16,G),(X-18,G),('r',10,-40),('r',2,-42),le=R.ELB_UP,re=R.ELB_UP)
    DN=P((X+16,150),36,0,0,(X+40,G),(X-18,G),('r',80,80),('r',74,84),lk=KU)
    clip('smash','raises both huge fists together high overhead and hammers them down to the floor in front',[I(0),staged(I(0),UP,.5),UP,UP,staged(UP,DN,.6),DN,DN,lerp(DN,I(0),.5),I(0)])
    GB=P((X+14,120),24,0,0,(X+34,G),(X-14,G),('r',80,30),('r',74,36))
    TH=P((X-10,118),-14,0.8,0.4,(X+16,G),(X-24,G),('r',-50,-10),('r',-40,0),le=R.ELB_UP,re=R.ELB_UP,tilt=-10)
    clip('grabthrow','lunges and grabs with both huge hands, then twists and hurls the victim behind him',[I(0),staged(I(0),GB,.5),GB,GB,lerp(GB,TH,.5),TH,TH,lerp(TH,I(0),.5),I(0)])
    BL=lambda b: P((X,116+b),4,0,0,(X+16,G),(X-16,G),('r',60,-10),('r',-40,-6),le=R.ELB_OUT,re=R.ELB_OUT)
    clip('block','plants his feet wide and spreads his huge arms to block the way, snarling',[I(0),BL(0),BL(2),BL(0),BL(2),BL(0)])
    ST=P((X-10,114),-10,0.2,0,(X+2,G),(X-14,G),('r',20,56),('r',-6,60),tilt=-18)
    clip('stagger','staggers back from a gunshot, one step back, then shakes it off',[I(0),ST,sh(ST,-6),lerp(sh(ST,-6),I(0),.5),I(0)])
    GR=lambda b: P((X+8,160+b),30,0,0,(X+30,G),(X-14,G),('r',50,76),('r',40,78),lk=KU,tilt=18)
    clip('groggy','stunned, drops to one knee, huge hands on the floor, head hanging',[I(0),lerp(I(0),GR(0),.5),GR(0),GR(3),GR(0),GR(3)])
    BR=lambda b: P((X,116+b),10,0,0,(X-8,G),(X+2,G),('r',30,0),('r',26,4),le=('e',30,36),re=('e',26,38),tilt=-26)
    clip('breath','holds his breath, rigid, both huge hands clamped over his torn mouth, shaking with strain',[I(0),BR(0),BR(1),BR(0),BR(1),BR(0)])
_m=F.mk('dad_x',B,X,115,9,None,None,defs,DESC); CLIPS=_m['CLIPS']; REF=_m['REF']; FIRST=_m['FIRST']
if __name__=='__main__': R.preview(B,CLIPS,REF,f'{F._D}/../family/preview-dadx.png',FIRST); print(len(CLIPS))
