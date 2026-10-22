# 브라우니 뼈대. 설계: docs/캐릭터제작서/동작설계_brownie.md (클립 목록 ../plan.py BROWNIE와 이름이 같아야 함)
# 평소 키 128 → sc 1.38. 캔버스 256×176, 발바닥 y=168, 기준 x=104. 큰 몸: 무릎을 거의 안 굽히고, 정지 자세는 완전히 멈춤.
# 손 좌표 ('r',x,y)는 목 기준이고 K(=1.38)로 늘어남. 골반·발 x 이동은 절대값이라 k()로 늘림.
import math
import common as c
from common import P,lerp,handfirst,hipfirst,sh,tail,cyc,KNEE_FWD,KNEE_UP,ELB_UP
import life
c.setup(1.38,g=100,x=66,w=256,h=176,dx=38,dy=68)
X,G,Y=c.X,c.G,c.HIPY
k=lambda v: v*c.K
S=life.build(life.Style(rest='down',lean=0,tilt=0,stride=11,lift=3,bob=0.6,swing=4,wlean=1,rstride=20,rlean=10,rswing=5,head=(6,-8),wide=2))
ST,walkf,runf,DEEP=S.ST,S.walkf,S.runf,S.DEEP
# 기본 그림: 두 손을 가슴 앞에 모아 장갑을 고쳐 낌
GLV=lambda u=0: ST(lh=('r',10,14+u),le=('e',6,15),rh=('r',8,12-u),re=('e',3,14))
c.set_akp(GLV())
cl=c.clip
def STD(b=0,lean=0,tilt=0,**kw):
    a=dict(lh='down',rh='down'); a.update(kw)
    return P((X,Y+b),lean,0,0,(X+k(6),G),(X-k(4),G),tilt=tilt,**a)
# ── 진행 ──
cl('idle','poised showman idle: adjusts a black glove in front of his chest, then stands perfectly still',tail([GLV(0),GLV(1),GLV(-1),GLV(1),GLV(0),GLV(0)],True))
HI=lambda b=0: STD(b,lh=('r',9,17),le=('e',5,14),rh=('r',8,16),re=('e',3,14))
cl('host_idle','host stance: fingertips touching in front of his belly, chest out, utterly still',tail([HI(0),HI(.3),HI(.5),HI(.3)],True))
cl('walk','big stage walk with long flat-footed strides, one arm opened halfway toward the audience',
   tail(cyc(lambda t: walkf(t,lh=('r',14,12),le=('e',10,12))),True))
def ent(t):
    cc=math.cos(2*math.pi*t)
    return walkf(t,stride=9,lift=6,lh=('r',6,-24-3*cc),le=('e',10,-8),tilt=-4)
cl('entrance','grand entrance: strutting showbiz steps while waving one hand high above his head',tail([ent(i/10) for i in range(10)],True))
PS=lambda u: STD(0,-2*u,lh=('r',6+18*u,14-10*u),le=('e',8+6*u,12-6*u),rh=('r',4-18*u,14-10*u),re=('e',2-8*u,12-6*u),tilt=-6*u)
cl('present','"Okay, friends!": throws both arms wide open to the sides and puffs out his chest',tail([HI(),PS(.4),PS(.8),PS(1),PS(1),PS(1)],False))
CU=lambda o: STD(0,-2,lh=('r',6 if o else 4,-24),le=('e',10,-8),rh=('r',2 if o else 4,-24),re=('e',-4,-8),tilt=-8)
cl('cue','applause cue: raises both hands high above his head and claps big, twice',tail([HI(),CU(1),CU(0),CU(1),CU(0),HI()],False))
CP=lambda o: STD(0,0,lh=('r',12 if o else 10,10),le=('e',8,12),rh=('r',8 if o else 10,10),re=('e',4,12))
cl('clap','claps his gloved hands in front of his chest',tail([CP(1),CP(0),CP(1),CP(0)],True))
DR=lambda t: STD(0,4,lh=('r',16,12+4*math.cos(2*math.pi*t)),le=('e',10,14),rh=('r',14,12-4*math.cos(2*math.pi*t)),re=('e',8,14),tilt=4)
cl('drumroll','vocal drumroll: both fists beat an invisible drum in front of him, fast alternating',tail(cyc(DR,8),True))
TH=lambda b: STD(b,2,lh=('r',4,0),le=('e',10,10),rh=('r',8,14),re=('e',4,14),tilt=8)
cl('think','thinking pose: one hand props the other elbow, index finger tapping under the screen',tail([HI(),TH(0),TH(.4),TH(0),TH(.4),TH(0)],False))
MR=lambda u: STD(0,4*u,lh=('r',2+28*u,-2+10*u),le=('e',10+6*u,4+4*u),rh='down',tilt=6-6*u)
cl('mindread','"let me guess": finger to the side of the screen, then points straight forward "correct!"',tail([HI(),MR(0),MR(0),MR(0),MR(.6),MR(1),MR(1),MR(1)],False))
SP=lambda u: STD(0,-2*u,lh=('r',6,-30*u+10*(1-u)),le=('e',8,-12*u+10*(1-u)),tilt=-10*u)
cl('spotlight','raises one arm straight up and points his finger at the ceiling',tail([HI(),SP(.4),SP(.8),SP(1),SP(1),HI()],False))
SN=lambda u: STD(0,0,lh=('r',14,4-2*u),le=('e',10,10),tilt=-2)
cl('snap','snaps his fingers at shoulder height',tail([HI(),SN(0),SN(1),SN(1),HI()],False))
TK=lambda u: STD(0,1,lh=('r',16+4*u,10-6*u),le=('e',10,12),rh=('r',8,16),re=('e',3,14),tilt=-2+4*u)
cl('talk','hosting gesture: one open hand waving toward the audience while he talks',tail([TK(0),TK(1),TK(0),TK(1),TK(.5),TK(0)],True))
LC=lambda u: STD(0,3,lh=('r',12,-6+3*u),le=('e',10,6),rh=('r',8,16),re=('e',3,14),tilt=4)
cl('lecture','raises one index finger and wags it slowly while lecturing',tail([HI(),LC(0),LC(1),LC(0),LC(1),LC(0),LC(1),HI()],False))
TR=lambda u: STD(-1*u,-2*u,lh=('r',4,2),le=('e',10,10),rh='down',tilt=6-8*u)
cl('throat','clears his throat: fist under the screen, shoulders lift once, then he stands taller',tail([HI(),TR(0),TR(0),TR(1),TR(1),HI()],False))
PZ=lambda u: P((X,Y),2,-0.1-0.2*u,0,(X+k(6),G),(X-k(4),G),('r',8+30*u,8),('r',4,16),le=('e',10+8*u,8),re=('e',2,14),tilt=-4)
cl('prize','turns slightly and sweeps one arm out long to the side: "and the prize is!"',tail([HI(),PZ(.3),PZ(.6),PZ(1),PZ(1),PZ(1),PZ(1),HI()],False))
TO=lambda u: STD(0,2,lh=('r',14,6),le=('e',8,12),rh=('r',10,8+2*u),re=('e',4,12),tilt=10+4*u)
cl('timeout','lifts his wrist and looks at an invisible watch, tilting the screen',tail([HI(),TO(0),TO(1),TO(1),TO(0),HI()],False))
PC=lambda u: STD(0,0,lh=('r',20+10*u,2),le=('e',12,8),tilt=-2)
cl('point_cam','finger gun at the viewer with a shrug of one shoulder',tail([HI(),PC(1),PC(1),PC(.6)],False))
# ── 방송 질서 ──
SW=lambda u: P((X+k(4)*u,Y+k(10)),16,-0.1,0,(X+k(16),G),(X-k(10),G),('r',4+30*u,30),('r',-4,20),le=('e',4+12*u,22),re=('e',-6,14),tilt=6)
cl('sweep','bends his knees deep and sweeps a huge flat palm low across the stage floor',tail([HI(),SW(0),SW(0),SW(.4),SW(.8),SW(1),SW(1),HI()],False))
LF=lambda h,dx=0: P((X+k(2),Y+k(6)),30-24*h,-0.1,0,(X+k(12),G),(X-k(8),G),('r',22+dx,34-30*h),('r',-2,20),le=('e',12+dx/3,22-16*h),re=('e',-4,14),tilt=20-16*h)
cl('lift','bends down, gently picks something up with one hand, lifts it and sets it down off to the side',
   tail([HI(),LF(0),LF(0),LF(.4),LF(.8),LF(1,4),LF(1,10),LF(.6,14),LF(.1,16),HI()],False))
STP=lambda u: P((X,Y),2+4*u,-0.1,0,(X+k(10),G-k(8)*(1-u)),(X-k(4),G),('r',8+22*u,12-6*u),('r',-2,20),le=('e',10+6*u,10),re=('e',-4,14),lk=KNEE_UP if u<1 else KNEE_FWD)
cl('stomp','lifts one knee and stamps the stage hard with his shoe, one arm thrown forward: "cue!"',tail([HI(),STP(0),STP(0),STP(1),STP(1),HI()],False))
CD=lambda t: STD(0,2,lh=('r',16+6*math.cos(2*math.pi*t),-4+10*math.sin(2*math.pi*t)),le=('e',12,4),rh=('r',4-6*math.cos(2*math.pi*t),-2-8*math.sin(2*math.pi*t)),re=('e',-6,4),tilt=-4)
cl('conduct','conducts a band with both arms in big sweeping strokes',tail(cyc(CD,8),True))
JD=lambda u,d=0: STD(0,0,lh=('r',10+20*u,16-16*u+d),le=('e',10+6*u,12-6*u+d/2),rh='down')
cl('judge','"broadcast accident": goes rigid, slowly raises one hand to point at someone, then flicks it down',
   tail([HI(),HI(),JD(.3),JD(.6),JD(1),JD(1),JD(1),JD(1,12),JD(1,18),STD()],False))
GR=lambda u: P((X,Y-k(4)*u),-4*u,0,0,(X+k(6),G-k(3)*u),(X-k(4),G-k(3)*u),('r',8+18*u,10-22*u),('r',4-18*u,10-22*u),le=('e',10+6*u,8-12*u),re=('e',-2-8*u,8-12*u),tilt=-12*u)
cl('grow','spreads both arms wide, chest out, rising up on his toes as if growing bigger',tail([HI()]+[GR(i/10) for i in range(1,11)]+[GR(1)],False))
BN=lambda u,o: STD(0,-4+10*u,lh=('r',6+(26*u if o else 4),-26+36*u if o else -26),le=('e',8,-8+14*u),rh=('r',4+(20*u if o else 2),-26+36*u if o else -26),re=('e',2,-8+14*u),tilt=-10+12*u)
cl('burn','special guest: raises both hands together high overhead, then flings them forward wide open',
   tail([HI(),BN(0,0),BN(0,0),BN(0,0),BN(.3,1),BN(.6,1),BN(1,1),BN(1,1),BN(1,1),HI()],False))
HT=STD(-1,-6,lh=('r',10,14),le=('e',6,14),rh=('r',8,14),re=('e',3,14),tilt=-6)
cl('hit','barely moves, upper body rocks back half a beat',tail([HI(),HT,HT,HI()],False))
SG=lambda u: P((X-k(4)*u,Y+1),-8*u,0,0,(X+k(6)-k(2)*u,G),(X-k(4)-k(6)*u,G),('r',8,8),('r',6,10),le=('e',8,12),re=('e',4,12),tilt=-6*u)
cl('stagger','pushed back half a step, sways, then stands firm and tugs his jacket front straight',tail([HI(),SG(.6),SG(1),SG(.6),STD(lh=('r',8,18),rh=('r',6,18),le=('e',6,14),re=('e',4,14)),HI()],False))
TI=lambda d: STD(0,0,lh=('r',6,6+d),le=('e',10,10),rh=('r',4,5),re=('e',6,10),tilt=10)
cl('tie','grips the knot of his necktie and straightens it',tail([HI(),TI(0),TI(1),TI(-1),TI(0),HI()],False))
GL=lambda u: STD(0,-10*u,lh=('r',8,-4),le=('e',12,4),rh='down',tilt=-14*u)
cl('glitch','disgust: upper body jerks back and one hand grabs the side of the screen',tail([HI(),GL(1),GL(.8),GL(1),GL(.5),HI()],False))
# ── 친구·대화 ──
FP=lambda u: STD(0,8*u,lh=('r',6,-4),le=('e',10,6),rh='down',tilt=12*u)
cl('facepalm','presses a palm against the front of the screen and sighs, shoulders sagging',tail([HI(),FP(.5),FP(1),FP(1),FP(1),HI()],False))
SD=lambda d: STD(0,16,lh=('r',24,6+d),le=('e',12,10),rh=('r',-2,20),re=('e',-6,14),tilt=14)
cl('scold','leans down and wags his index finger: you skipped a meal, didn\'t you',tail([HI(),SD(0),SD(3),SD(-1),SD(3),SD(-1),SD(3),HI()],False))
SV=lambda u: P((X,Y+k(4)*u),10+10*u,0,0,(X+k(8),G),(X-k(6),G),('r',14+10*u,-4+26*u),('r',12+10*u,-4+26*u),le=('e',10,4+10*u),re=('e',6,4+10*u),tilt=10*u)
cl('serve','pulls something out of thin air above him and sets it down in front with both hands',tail([HI(),SV(0),SV(0),SV(.3),SV(.6),SV(1),SV(1),HI()],False))
HS=lambda d: STD(0,6,lh=('r',26,16+d),le=('e',14,14),rh='down',tilt=6)
cl('handshake','holds out his right hand, clasps, and pumps it up and down twice',tail([HI(),HS(0),HS(0),HS(-3),HS(3),HS(-3),HS(3),HS(0)],False))
LG=lambda u: STD(0,-10*u,lh=('r',8,18),le=('e',8,14),rh=('r',6,18),re=('e',4,14),tilt=-14*u)
cl('laugh','holds his belly and leans back laughing',tail([HI(),LG(.6),LG(1),LG(.7),LG(1),LG(.7)],False))
HR=lambda d: STD(0,2,lh=('r',8,10+d),le=('e',6,12),rh=('r',6,10+d),re=('e',4,12),tilt=-2)
cl('heart','clasps both hands together at his chest and sways slightly side to side',tail([sh(HR(0),-2),HR(1),sh(HR(0),2),HR(1)],True))
SA=lambda d: P((X,Y+1),6,0,0,(X+k(6),G),(X-k(4),G),('r',8+d,20),('r',6-d,20),le=('e',5,14),re=('e',3,14),tilt=14)
cl('sad','about to cry: shoulders drooping, rubbing his hands together in front of his belly',tail([SA(0),SA(1),SA(-1),SA(1)],True))
BW=lambda u: P((X-k(2)*u,Y),30*u,0,0,(X+k(6),G),(X-k(4),G),('r',6,8),('r',-6,20),le=('e',10,12),re=('e',-6,14),tilt=10*u)
cl('bow','sign-off: one hand on his chest, bows deeply from the waist',tail([HI(),BW(.3),BW(.7),BW(1),BW(1),BW(.7),BW(.3),HI()],False))
WA=lambda u: STD(0,-2,lh=('r',10+4*u,-20),le=('e',12,-6),tilt=-4)
cl('wave','waves one hand big and high: goodbye!',tail([HI(),WA(0),WA(1),WA(0),WA(1),HI()],False))
if __name__=='__main__':
    print(len(c.CLIPS),'clips',sum(len(v[2]) for v in c.CLIPS.values()),'frames'); print('audit',c.audit()[:20])
