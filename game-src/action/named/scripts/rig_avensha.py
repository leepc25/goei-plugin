# 아벤샤 뼈대. 설계: docs/캐릭터제작서/동작설계_avensha.md (클립 목록 ../plan.py AVENSHA와 이름이 같아야 함)
# 키 92 → sc 0.99. 캔버스 256×160, 발바닥 y=152(G+DY), 기준 x=96(X+DX). 몸은 거의 안 뜀: 걷기는 느긋, 주문은 손끝·손바닥 위주.
import math
import common as c
from common import P,lerp,handfirst,hipfirst,sh,tail,cyc,KNEE_FWD,KNEE_UP,ELB_UP
import life
c.setup(0.99,g=100,x=66,w=256,h=160,dx=30,dy=52)
X,G,Y=c.X,c.G,c.HIPY
S=life.build(life.Style(rest='down',lean=-1,tilt=-2,stride=8,lift=2,bob=0.4,swing=0,wlean=1,rstride=15,rlean=10,rswing=3,head=(6,-8)))
ST,walkf,runf,DEEP=S.ST,S.walkf,S.runf,S.DEEP
# 기본 그림 자세: 가까운 손 = 가슴 브로치, 먼 손 = 허리(팔꿈치 뒤로 벌림)
BRO=dict(lh=('r',6,8),le=('e',9,15),rh=('r',-3,24),re=('e',-9,14))
def IDLE(b=0,tilt=0,**k):
    a=dict(BRO); a.update(k); return ST(b,tilt,**a)
c.set_akp(IDLE())
cl=c.clip
NP=''
# 주문 대기: 몸 반쯤 열고 가까운 손을 가슴 앞 손바닥 위, 먼 손 허리
def CAST(b=0,lean=0,**k):
    a=dict(lh=('r',16,12),le=('e',10,14),rh=('r',-3,24),re=('e',-9,14),tilt=-2); a.update(k)
    return P((X,Y+b),lean,-0.15,0,(X+8,G),(X-6,G),**a)
C0=CAST()

# ── 이동·기본 ──
cl('idle','calm witch idle: near hand on the brooch at her chest, far hand on hip, gentle smile, breathing',tail([IDLE(0),IDLE(.4),IDLE(.7),IDLE(.4),IDLE(0),IDLE(.3)],True))
BACK=dict(lh='back',rh='back')
cl('stroll','leisurely stroll with both hands clasped behind her back, looking around with interest',tail([walkf(i/8,head=(6,-8),tilt=(-4 if i<4 else 2),**BACK) for i in range(8)],True))
cl('run','hurried short-stepped run holding the cloak closed at the chest with one hand, cloak flowing back',
   tail(cyc(lambda t: runf(t,lh=('r',6,8),le=('e',9,14))),True))
J0=DEEP(0,-6,**BRO); J1=P((X+2,Y-18),0,0,0,(X+6,G-24),(X-2,G-22),('r',8,6),('r',-6,10),le=('e',10,10),re=('e',-8,10),lk=KNEE_UP,rk=KNEE_UP)
cl('jump','light two-footed hop, knees together, cloak floating down slowly after her',tail([IDLE(),J0,lerp(J0,J1,.6),J1,J1,lerp(J1,J0,.6),J0,IDLE()],False))
SS=lambda u: P((X-2*u,Y+2*u),-2,-0.1,0,(X+8-4*u,G-3*math.sin(math.pi*u)),(X-6,G),('r',12-6*u,10),('r',-4,22),le=('e',10,13),re=('e',-9,13))
cl('sidestep','sweeps the cloak around her and takes one graceful step aside',tail([SS(0),SS(.4),SS(.8),SS(1),IDLE()],False))
SK=lambda u: P((X,Y+28*u),10+20*u,0,0,(X+10,G),(X-8,G),('r',10-2*u,10+10*u),('r',8,12+10*u),le=('e',6,12),re=('e',4,12),tilt=10+20*u,lk=KNEE_UP,rk=KNEE_UP)
cl('sink','wraps the cloak around herself and sinks down low, curling up and bowing her head into it',tail([IDLE(),SK(.25),SK(.5),SK(.75),SK(1),SK(1),SK(1),SK(1)],False))
EM=lambda u: P((X,Y+28*(1-u)),30-34*u,0,0,(X+10,G),(X-8,G),('r',8+16*u,20-14*u),('r',6-10*u,20-16*u),le=('e',6+6*u,12-8*u),re=('e',4-10*u,12-6*u),tilt=30-34*u,lk=KNEE_UP,rk=KNEE_UP)
cl('emerge','rises up from a low curled crouch, throwing her cloak wide open as she stands',tail([SK(1),EM(.2),EM(.4),EM(.6),EM(.8),EM(1),EM(1),IDLE()],False))
# ── 모래 주문 ──
FL=lambda u: CAST(lh=('r',18,14+6*u),le=('e',10,12))
cl('flick','without moving her head, casually flicks the fingers of one hand downward as if brushing off dust',tail([IDLE(),FL(0),FL(1),FL(1),IDLE()],False))
BU=lambda u: CAST(lh=('r',18+14*u,10-2*u),le=('e',12+4*u,10))
cl('bullet','holds one palm up in front of her, then flicks her thumb forward to shoot',tail([C0,BU(0),BU(0),BU(1),BU(1),C0],False))
BR=lambda t: CAST(lh=('r',22+10*math.cos(2*math.pi*t),10),rh=('r',20-10*math.cos(2*math.pi*t),12),le=('e',12,11),re=('e',10,12),lean=2)
cl('bullet_rapid','alternately flicks both hands forward again and again, body barely moving',tail(cyc(BR,8),True))
PI=lambda u: CAST(lh=('r',20,26-30*u),le=('e',12,18-14*u),lean=4-6*u,tilt=-6*u)
cl('pillar','palm held low facing down, then turns it over and lifts it up sharply to the sky',tail([C0,PI(0),PI(0),PI(.3),PI(.7),PI(1),PI(1),C0],False))
WL=lambda u: CAST(lh=('r',4+28*u,14-4*u),le=('e',6+10*u,10),lean=-2+4*u)
cl('wall','sweeps one arm out wide to the side in front of her to raise a wall',tail([C0,WL(0),WL(.5),WL(1),WL(1),C0],False))
def CR(t):
    a=2*math.pi*t
    return P((X,Y),0,-0.1,0,(X+8,G),(X-6,G),('r',16+6*math.cos(a),10+6*math.sin(a)),('r',12-6*math.cos(a),12-6*math.sin(a)),le=('e',10,13),re=('e',6,14),tilt=-4)
cl('cast','long incantation: both hands draw slow circles in front of her chest, lips moving',tail(cyc(CR,8),True))
SF=lambda u: P((X+2*u,Y),2+4*u,-0.1,0,(X+9,G),(X-6,G),('r',16+10*u,12-4*u),('r',14+10*u,13-4*u),le=('e',8+4*u,14-2*u),re=('e',6+4*u,15-2*u),tilt=-2)
cl('sandify','great spell: brings both hands together in front, clenches them, then throws all fingers wide open',
   tail([C0,SF(0),SF(0),SF(.2),SF(.2),SF(.6),SF(1),SF(1),SF(1),C0],False))
TR=lambda u: P((X-2*u,Y+1),-4-6*u,0.1,0,(X+8,G),(X-8,G),('r',14-6*u,10-34*u),('r',6-8*u,12-34*u),le=('e',12-2*u,8-18*u),re=('e',2-4*u,8-18*u),tilt=-4-14*u)
cl('tsunami_ready','sweeps the cloak back and slowly raises both arms high above her head',tail([C0,TR(.1),TR(.25),TR(.4),TR(.55),TR(.7),TR(.85),TR(1),TR(1),TR(1)],False))
TS=lambda u: P((X+4*u,Y+2*u),-10+22*u,0.1,0,(X+10,G),(X-8,G),('r',8+22*u,-22+38*u),('r',2+22*u,-22+40*u),le=('e',10+6*u,-10+20*u),re=('e',-2+12*u,-10+22*u),tilt=-18+22*u)
cl('tsunami_send','brings both raised arms down and forward in a great sweeping wave',tail([TS(0),TS(.3),TS(.6),TS(.85),TS(1),TS(1)],False))
RD=lambda t: P((X+1*math.sin(2*math.pi*t),Y+3),6,-0.1,0,(X+12,G),(X-10,G),('r',12,14),('r',-8,10),le=('e',10,12),re=('e',-10,8),tilt=-2)
cl('storm_ride','rides standing on a whirling storm, knees soft, one arm out for balance, cloak streaming back',tail(cyc(RD,6),True))
PL=lambda u: P((X+2,Y+22*u),8+20*u,0,0,(X+14,G),(X-10,G),('r',14+6*u,14+18*u),('r',-4,22),le=('e',10,14),re=('e',-9,13),lk=KNEE_UP)
cl('plant','bends one knee and presses her palm flat to the floor for a moment',tail([IDLE(),PL(.5),PL(1),PL(1),PL(.5),IDLE()],False))
SR=lambda u: P((X,Y-2*u),-6*u,0,0,(X+8,G),(X-6,G),('r',10+16*u,10-16*u),('r',0-14*u,12-16*u),le=('e',10+6*u,12-8*u),re=('e',-4-6*u,12-8*u),tilt=-20*u)
cl('super_ready','spreads both arms wide and gazes up at the sky in rapture, cloak lifting',tail([IDLE(),SR(.2),SR(.4),SR(.6),SR(.8),SR(1),SR(1),SR(1)],False))
SC=lambda u,o: P((X,Y),-2+4*u,0,0,(X+8,G),(X-6,G),('r',12+(10 if o else 0),8+(-6 if o else 0)),('r',10+(-14 if o else 0),9+(-6 if o else 0)),le=('e',10,12),re=('e',8 if not o else -6,12),tilt=-6)
cl('super_cast','presses her palms together as if praying, then flings both hands wide apart to the sides',
   tail([SR(1),SC(0,0),SC(.5,0),SC(1,0),SC(1,0),SC(1,1),SC(1,1),SC(.5,1),SC(0,1),IDLE()],False))
# ── 방어·피격 ──
GD=lambda b: P((X-2,Y+2+b),-4,0.1,0,(X+8,G),(X-8,G),('r',12,4),('r',6,6),le=('e',8,8),re=('e',4,10),tilt=6)
cl('guard','wraps the cloak in front of her body with both arms to block',tail([GD(0),GD(.5),GD(.8),GD(.5)],True))
HT=P((X-3,Y+1),-10,0.1,0,(X+8,G),(X-8,G),('r',10,12),('r',-6,18),le=('e',9,14),re=('e',-9,12),tilt=-10)
cl('hit','upper body knocked back, then the smile returns at once',tail([IDLE(),HT,HT,IDLE()],False))
STG=lambda u: P((X-6*u,Y+2),-12*u,0.1,0,(X+8-2*u,G),(X-10*u-6,G),('r',4,-4),('r',-8,16),le=('e',10,2),re=('e',-10,10),tilt=-8*u)
cl('stagger','staggers back hard, one hand pressing down on her hood',tail([IDLE(),STG(.4),STG(.8),STG(1),STG(.6),IDLE()],False))
DN=[P((X-6,Y),-20,0.1,0,(X+6,G-6),(X-12,G-4),('r',12,-6),('r',4,-4),le=('e',12,0),re=('e',6,0)),
    P((X-18,Y+14),-50,0,0,(X+4,G-16),(X-6,G-14),('r',14,-10),('r',8,-8),lk=KNEE_UP,rk=KNEE_UP),
    P((X-26,94),-80,0,0,(X+4,G-6),(X+2,G-3),('r',10,-12),('r',6,-10),lk=KNEE_UP,rk=KNEE_UP)]
LIE=P((X-30,96),-88,0,0,(X+8,G-2),(X+6,G),('r',6,-14),('r',4,-12),le=('e',4,-6))
cl('down','knocked flying, lands on her side and the cloak falls over her',tail([HT]+DN+[LIE,LIE],False))
KN=P((X-6,Y+24),4,0,0,(X+12,G),(X-10,G-1),('r',14,18),('r',10,20),le=('e',6,13),re=('e',4,13),lk=KNEE_UP)
TIE=IDLE(lh=('r',4,4),le=('e',8,10),rh=('r',2,6),re=('e',4,10),tilt=8)
cl('getup','rises onto her knees without using her hands, stands and straightens her collar and tie',tail([LIE,lerp(LIE,KN,.5),KN,lerp(KN,IDLE(),.5),TIE,IDLE()],False))
HF=lambda u: P((X-4*u,Y+3*u),-6*u,0.1,0,(X+8-2*u,G),(X-8,G),('r',6,-2),('r',-6,18),le=('e',10,4),re=('e',-9,12),tilt=10*u)
cl('holy_fear','flinches from holy power, shoulders hunching, one arm raised to shield her face, half a step back',tail([IDLE(),HF(.5),HF(1),HF(1),HF(1),HF(.6)],False))
DF=lambda b: P((X-4,Y+22+b),12,0,0,(X+12,G),(X-10,G-1),('r',6,8),('r',10,20),le=('e',8,14),re=('e',4,13),tilt=6,lk=KNEE_UP)
cl('defeat','down on one knee, hand on her chest, catching her breath and still smiling',tail([DF(0),DF(.6),DF(1),DF(.6)],True))
# ── 채집·조사 ──
HV=lambda u: P((X+2,Y+30),24,0,0,(X+12,G),(X-8,G),('r',24+4*u,22-10*u),('r',8,22),le=('e',12,18),re=('e',4,15),tilt=18,lk=KNEE_UP,rk=KNEE_UP)
cl('harvest','squats beside something on the floor, reaches down, lifts something into her palm and smiles at it',
   tail([IDLE(),lerp(IDLE(),HV(0),.5),HV(0),HV(0),HV(.5),HV(1),HV(1),HV(1)],False))
BRN=lambda b: P((X-2,Y+24),20,0,0,(X+14,G),(X-10,G-1),('r',26,24+b),('r',2,18),le=('e',14,16),re=('e',-2,12),tilt=24,lk=KNEE_UP)
cl('brainread','kneels on one knee and holds two fingers toward something on the floor ahead, eyes closed',
   tail([IDLE(),lerp(IDLE(),BRN(0),.5),BRN(0),BRN(.5),BRN(1),BRN(.5),BRN(0),BRN(.5),BRN(1),BRN(0)],False))
AP=lambda r: IDLE(lh=('r',14,2),le=('e',10,10),rh=('r',12+r,0),re=('e',6,10),tilt=6)
cl('appraise','holds a small object up close in one hand and turns it with the other hand, examining it',tail([IDLE(),AP(0),AP(2),AP(-1),AP(2),AP(0)],False),'')
TE=lambda u: IDLE(lh=('r',12,14),le=('e',8,14),rh=('r',8+2*u,6-12*u),re=('e',4,10-6*u),tilt=-4*u)
cl('tea','holds a saucer low in one hand and raises a teacup to her lips with the other, sips',tail([TE(0),TE(.5),TE(1),TE(1),TE(.5),TE(0)],True))
MX=lambda d: IDLE(lh=('r',14,10+d),le=('e',8,14),rh=('r',12,10-d),re=('e',6,14),tilt=10)
cl('mix','holds both hands together at chest height, shaking and swirling something between them',tail([MX(0),MX(2),MX(-2),MX(2),MX(-2),MX(0)],True))
SL=lambda u: IDLE(lh=('r',14+8*u,10),le=('e',10+4*u,12),rh=('r',12+8*u,11),re=('e',8+4*u,12),tilt=4)
cl('sell','offers something forward with both hands, then nods',tail([IDLE(),SL(.5),SL(1),SL(1),SL(1),IDLE(tilt=10),IDLE(tilt=4),IDLE()],False))
# ── 감정·대화 ──
IN=lambda u: P((X-2*u,Y+3*u),10*u,0,0,(X+8,G),(X-10-4*u,G),('r',8,6),('r',-10-6*u,16-4*u),le=('e',10,12),re=('e',-10,10),tilt=12*u)
cl('intro','courteous bow: lifts the edge of her cloak with one hand and draws one foot back, lowering her head',tail([IDLE(),IN(.3),IN(.7),IN(1),IN(1),IN(.6),IN(.2),IDLE()],False))
PR=lambda d: P((X-2,G-21),72,0,0,(X-24,G-1),(X-26,G),('a',X+40+d,G-2),('a',X+38-d,G-1),tilt=4,lk=KNEE_UP,rk=KNEE_UP)
KL=P((X-4,Y+28),16,0,0,(X+8,G),(X-12,G),('r',14,14),('r',10,15),lk=KNEE_UP,rk=KNEE_UP)
cl('prostrate','drops to her knees and bows flat to the floor, arms stretched out in front, wriggling humbly',tail([IDLE(),KL,lerp(KL,PR(0),.5),PR(0),PR(2),PR(-1),PR(2),PR(-1),PR(2),PR(0)],False))
RP=lambda u: P((X,Y-2*u),-4+4*math.sin(math.pi*2*u),0,0,(X+6,G-2*u),(X-4,G-2*u),('r',6,4),('r',4,5),le=('e',8,10),re=('e',6,10),tilt=-10)
cl('rapture','clasps her hands together, rises on her toes and twists with delight',tail([IDLE(),RP(.25),RP(.5),RP(.75),RP(1),RP(.5)],False))
cl('cold','keeps the exact same smile and only slowly tilts her head',tail([IDLE(),IDLE(tilt=6),IDLE(tilt=12),IDLE(tilt=14)],False))
LA=lambda u: IDLE(lh=('r',8,0),le=('e',10,8),tilt=-4-4*u)
cl('laugh','covers her mouth with the back of her hand and laughs',tail([IDLE(),LA(0),LA(1),LA(0),LA(1),LA(0)],False))
CW=lambda b: P((X-1,Y+1+b),2,0,0,(X+6,G),(X-4,G),('r',6,8),('r',5,9),le=('e',8,12),re=('e',6,12),tilt=10,head=(5,-7))
cl('cower','pulls the cloak closed at the front and looks away, falling quiet',tail([CW(0),CW(.4),CW(.6),CW(.4)],True))
cl('tense','smiling but tense, both hands hidden together under the cloak, feet turned toward the exit',tail([IDLE(lh=('r',8,14),le=('e',8,14),rh=('r',6,15),re=('e',4,14),tilt=-2,b=b) for b in (0,.4,.6,.4)],True))
GF=lambda u: P((X+2*u,Y+3*u),14*u,0,0,(X+8,G),(X-8,G),('r',14+6*u,10+2*u),('r',12+6*u,11+2*u),le=('e',8,12),re=('e',6,12),tilt=14*u)
cl('gift','bows slightly and presents something respectfully with both hands',tail([IDLE(),GF(.4),GF(.8),GF(1),GF(1),IDLE()],False))
TK=lambda u: IDLE(lh=('r',16+4*u,4-4*u),le=('e',10,10),tilt=-2+4*u)
cl('talk','explains elegantly with one open hand',tail([TK(0),TK(1),TK(0),TK(1),TK(.5),TK(0)],True))
WV=lambda u: IDLE(lh=('r',10,-8+2*u),le=('e',10,2),tilt=6)
cl('wave','waggles only her fingers goodbye with a wink',tail([IDLE(),WV(0),WV(1),WV(0),WV(1),IDLE()],False))
if __name__=='__main__':
    print(len(c.CLIPS),'clips',sum(len(v[2]) for v in c.CLIPS.values()),'frames'); print('audit',c.audit()[:20])
