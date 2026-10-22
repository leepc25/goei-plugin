# 고르고디오(맨몸) 전 동작 뼈대. 설계 docs/캐릭터제작서/동작설계_gorgodio.md 5장. 자세 근거는 같은 문서 2장(칼리·스모·프로레슬링·레슬링).
# 캔버스 224×176, 발목선 G=160(발바닥 168), 골반 기준 x=86. RIGHT = 가까운 쪽 = 앞손(식칼)·앞발.
# 몸 치수는 기준 그림 full/base.png에서 잼(몸통 길고 다리 짧은 레슬러 체형).
import math,sys
sys.path.insert(0,'.')
from rigbase import *
B=Body(224,176,86,160,TORSO=37,THIGH=22.5,SHIN=23.5,UARM=21,FARM=18,head=(10,-7),shw=7,hipw=6)
P=B.P; clip=B.clip; X=B.X; G=B.G; HY=116
# 기준 그림(3/4, 전투 자세) 관절: 눈으로 맞춤. 가까운 어깨·다리가 그림 왼쪽(뒤)
BASE_KP={'NOSE':(93,72),'NECK':(84,80),'RIGHT SHOULDER':(67,82),'RIGHT ELBOW':(53,100),'RIGHT ARM':(70,106),
 'LEFT SHOULDER':(101,82),'LEFT ELBOW':(113,93),'LEFT ARM':(112,80),'RIGHT HIP':(82,120),'RIGHT KNEE':(68,137),'RIGHT LEG':(55,159),
 'LEFT HIP':(92,120),'LEFT KNEE':(103,137),'LEFT LEG':(108,157),'RIGHT EYE':(86,67),'LEFT EYE':(90,67),'RIGHT EAR':(79,69),'LEFT EAR':(82,68)}
# 몸만 설명(물건·장면 이름 금지). 식칼은 무기라 전투 클립 prop에 적음
DESC=('huge bald man, two meters tall, muscular wrestler build with a broad chest and thick arms, thick dark eyebrows, amber eyes, short dark goatee on the chin, '
      'black leather biker jacket with silver zipper and studs worn open, white shirt, black necktie, black trousers, black boots, bare hands')
KNIFE='holding a heavy cleaver-like kitchen knife with a wide rectangular blade in the near hand, blade pointing forward and down'
KNIFE_UP='holding a heavy cleaver-like kitchen knife with a wide rectangular blade in the near hand'

# ── 기본 자세 ──
AK_N=('a',X+5,111); AK_F=('a',X+1,112)              # 두 손 허리(원화 자세): 손은 골반 옆, 팔꿈치는 옆으로(옆모습에선 몸통선 뒤쪽 위)
def STAND(b=0,lh='down',rh='down',tilt=0,lean=2,le=ELB_DOWN,re=ELB_DOWN,fw=0,head=None):
    return P((X,HY+b),lean,0,0,(X+9+fw,G),(X-8-fw,G),lh,rh,tilt=tilt,le=le,re=re,head=head)
def AKIMBO(b=0,tilt=0,lean=1): return STAND(b,AK_N,AK_F,tilt,lean,('e',-7,19),('e',-9,18),fw=2)
def GUARD(d=0,b=0):      # 무릎 굽힌 넓은 자세, 앞손 식칼 허리 높이로 앞을 겨눔, 빈손 가슴 앞
    return P((X+d,121+b),8,0,0,(X+21+d,G),(X-19+d,G-2),(27,30),(18,12),le=ELB_DOWN,re=('e',6,18))
G0=GUARD()
def SUMO(b=0,lh=None,rh=None):   # 스모 쭈그려 앉기: 무릎 벌려 앞, 엉덩이 낮게, 손은 무릎
    return P((X-3,138+b),14,0,0,(X+11,G-1),(X+1,G-2),lh or ('a',X+18,134),rh or ('a',X+14,135),lk=KNEE_FWD,rk=KNEE_FWD,tilt=-6)
def KNEEL(lh='down',rh='down',tilt=0,lean=6):   # 한쪽 무릎 꿇기(뒷무릎 바닥)
    return P((X-2,135),lean,0,0,(X+16,G),(X-26,G-2),lh,rh,tilt=tilt)
def SEAT(b=0,lh=(14,26),rh=(10,28),lean=-4,tilt=0,legs=(26,20)):   # 의자(좌판 y≈128)에 다리 벌리고 앉음
    return P((X-6,126+b),lean,0,0,(X-6+legs[0],G),(X-6+legs[1],G),lh,rh,tilt=tilt,lk=KNEE_UP,rk=KNEE_UP)
def FLOOR(b=0,lh=('a',X+14,138),rh=('a',X+10,140),lean=-6,tilt=0):  # 바닥 책상다리(옆에서 보면 무릎 앞으로, 발 모음)
    return P((X-6,150+b),lean,0,0,(X+12,G-4),(X+8,G-2),lh,rh,tilt=tilt,lk=KNEE_UP,rk=KNEE_UP)
def LIE(b=0,lh=(10,4),rh=(6,8),dx=0):   # 반듯이 누움(머리 왼쪽)
    return P((X-4+dx,148),-90,0,0,(X+40+dx,152),(X+38+dx,154),lh,rh,re=ELB_UP,le=ELB_UP)

# 걷기 순환: 뒤꿈치 쿵 디딤(2px 침하), 어깨가 좌우로 구름, 팔은 몸통에서 떨어져 흔들림
def walkf(t,stride=13,lift=5,bob=2.4,lean=4,arm=9,lh=None,rh=None,hipdy=0):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+2+stride*c,G-lift*max(0,-sn)); rf=(X+2-stride*c,G-lift*max(0,sn))
    return P((X+2,HY+1+hipdy+bob*abs(c)),lean,0.12*c,0.2*c,lf,rf,lh or (6-arm*c,34),rh or (2+arm*c,34))
def runf(t,lh=None,rh=None,lean=10):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+6+18*c,G-10*max(0,-sn)); rf=(X+6-18*c,G-10*max(0,sn))
    return P((X+8,HY+2+3.5*abs(c)),lean,0.18*c,0.25*c,lf,rf,lh or (14-16*c,18+4*c),rh or (8+16*c,18-4*c))

# ═══ 5.1 전투·기본 ═══
clip('idle','side view in profile: standing with both fists on the hips, chest slowly swelling and settling, calm',[AKIMBO(0),AKIMBO(.6),AKIMBO(1.2),AKIMBO(.6)])
BRD=lambda y: STAND(0,(12,y),AK_F,tilt=-4,le=ELB_DOWN,re=('e',-9,18))
clip('beard','side view in profile: strokes his chin goatee downward with thumb and finger, thinking',[AKIMBO(0),BRD(4),BRD(6),BRD(9),AKIMBO(0)])
clip('guard','side view in profile: wide low fighting stance, near hand low forward, rear hand open at the chest, steady',[G0,GUARD(0,1),GUARD(0,1.6),GUARD(0,1)],KNIFE)
DRAWK=P((X+1,HY+1),3,0,0,(X+12,G),(X-10,G),(8,14),(14,16),re=('e',4,16))
clip('engage','side view in profile: drops his hands from the hips, pulls a knife from inside the jacket and sinks into a fighting stance',
     [AKIMBO(0),DRAWK,lerp(DRAWK,G0,.5),G0,G0],KNIFE_UP)
def suri(t):   # 스리아시: 허리 낮게, 발바닥을 끌며 앞발 → 뒷발
    a=min(1,t*2); b=max(0,t*2-1)
    return P((X+8*a+6*b,124),8,0,0,(X+21+14*a,G),(X-19+14*b,G-1),(27,30),(18,12),re=('e',6,18))
clip('step','side view in profile: sumo sliding footwork, hips low, lead foot slides forward then rear foot slides after',[suri(i/5) for i in range(6)],KNIFE)
clip('walk','side view in profile: heavy walk, heel lands hard, shoulders roll, thick arms swing away from the body',[walkf(i/8) for i in range(8)])
clip('run','side view in profile: heavy powerful run, upper body fairly upright, big strides, arms pumping, body drops on each step',[runf(i/8) for i in range(8)])
JC=P((X,132),14,0,0,(X+15,G),(X-15,G),(24,26),(16,16))
JA=lambda tk,b=0: P((X,112+b),6,0,0,(X+12,G-6-tk),(X-10,G-8-tk),(22,14),(14,10),lk=KNEE_FWD,rk=KNEE_FWD)
clip('jump','side view in profile: deep crouch, short heavy jump with knees tucked, lands hard into a deep crouch',[JC,lerp(JC,JA(0),.6),JA(8),JA(12),JA(7),JA(1,2),JC,lerp(JC,STAND(0),.5)])
clip('crouch','side view in profile: sinks into a deep sumo squat, knees wide and forward, hands on the knees',[STAND(0),lerp(STAND(0),SUMO(),.4),lerp(STAND(0),SUMO(),.8),SUMO()])
def cwalk(t):  # 낮은 천장: 상체 숙이고 손을 무릎에 짚고 엉거주춤
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,128+abs(sn)),42,0,0,(X+12+8*c,G-4*max(0,-sn)),(X-6-8*c,G-4*max(0,sn)),('a',X+22,134),('a',X+16,136),tilt=-30)
clip('crouchwalk','side view in profile: walking hunched over with both hands on the knees, slow small steps',[cwalk(i/6) for i in range(6)])
# 8 시코 밟기: 앞다리를 높이 들었다(무릎 바깥) 무릎 굽히며 쿵
SK1=P((X-4,118),-6,0,0,(X+16,G-30),(X-12,G),('a',X+14,112),('a',X+2,116),rk=KNEE_FWD,lk=KNEE_UP)
SK2=P((X-6,114),-10,0,0,(X+20,G-44),(X-12,G),('a',X+16,110),('a',X+2,114),lk=KNEE_UP)
SK3=P((X+2,134),10,0,0,(X+22,G),(X-16,G),('a',X+22,132),('a',X+8,134))
clip('stomp','side view in profile: sumo stomp, lifts the lead leg high with the knee bent, then stamps it down hard into a deep squat',[G0,SK1,SK2,lerp(SK2,SK3,.6),SK3,lerp(SK3,G0,.5)],KNIFE)
# 9·10·11 칼리 각도 1 → 2 → 두 손 내려찍기 (커밋형, 뒤로 갈수록 깊게)
C1A=P((X-2,120),0,0,0,(X+21,G),(X-19,G-1),(10,-16),(18,10),le=('e',-6,-4),re=('e',6,18))     # 칼을 가까운 어깨 위로
C1B=P((X+8,126),18,0,0,(X+33,G),(X-17,G-2),(36,38),(14,14),re=('e',6,18))                      # 앞발 디디며 사선 아래로 끝까지
clip('chop1','side view in profile: raises the knife over the near shoulder, chops diagonally down with a forward step, weight dropping',
     [G0,C1A,staged(C1A,C1B,.55),C1B,lerp(C1B,GUARD(8),.5)],KNIFE_UP)
C2B=P((X+14,124),12,0,0,(X+39,G),(X-9,G-3),(34,-12),(12,16),le=('e',18,4),re=('e',4,18))      # 아래에서 앞 위로 되돌려 올려벰, 뒷발 끌려옴
clip('chop2','side view in profile: from low, swings the knife back up diagonally in a rising backhand cut, rear foot slides in',
     [GUARD(8),lerp(GUARD(8),C2B,.35),staged(GUARD(8),C2B,.7),C2B,C2B,lerp(C2B,GUARD(14),.5)],KNIFE_UP)
CVA=P((X+10,116),-8,0,0,(X+37,G),(X-11,G-2),(8,-30),(12,-26),le=('e',4,-8),re=('e',8,-6))    # 두 손으로 머리 위로(앞쪽) 치켜듦
CVB=P((X+22,136),30,0,0,(X+49,G),(X-5,G-1),(34,30),(30,28),le=('e',16,14),re=('e',14,14))     # 무릎 굽혀 몸 전체로 내려찍음
clip('cleave','side view in profile: lifts the knife high in both hands, then hacks straight down with the whole body, knees bending',
     [GUARD(14),lerp(GUARD(14),CVA,.5),CVA,CVA,staged(CVA,CVB,.6),CVB,CVB],KNIFE_UP)
# 칼 없는 A: 쓰파리 — 손바닥 번갈아 3번, 스리아시로 전진
TPN=lambda d: P((X+d,124),10,0,0,(X+22+d,G),(X-16+d,G-1),(42,6),(14,10),re=('e',6,16))
TPF=lambda d: P((X+d,124),12,0,0,(X+22+d,G),(X-14+d,G-1),(14,10),(42,6),le=('e',6,16))
TP0=lambda d: P((X+d,124),8,0,0,(X+21+d,G),(X-18+d,G-1),(16,8),(14,10))
clip('tsuppari','side view in profile: sumo thrusting slaps: hips low, open palms shoot forward alternately at chest height, sliding in',
     [TP0(0),TPN(3),TP0(4),TPF(7),TPF(8),TP0(9),TPN(12),TPN(13)])
# 12 러닝 빅 부트
BB1=runf(.25); BB2=P((X+6,114),-6,0,0,(X+30,G-26),(X-2,G),(-4,20),(18,6),lk=KNEE_UP)
BB3=P((X+4,114),-18,0,0,(X+50,G-58),(X-4,G),(-10,18),(16,2))
clip('bigboot','side view in profile: running big boot: plants the rear foot, thrusts the lead sole forward at face height, leaning back',
     [BB1,BB2,BB3,BB3,lerp(BB3,STAND(0),.5),STAND(0)])
# 13 바디 프레스: 공중에서 몸을 펴 배로 덮침 → 엎드림 → 팔로 밀어 일어남
SP1=P((X+4,104),40,0,0,(X-8,G-30),(X-16,G-24),(30,20),(26,22))
SP2=P((X+6,112),80,0,0,(X-30,118),(X-34,122),(30,6),(26,10))
SP3=P((X+6,150),88,0,0,(X-34,154),(X-36,156),('a',X+46,158),('a',X+40,158),tilt=-20)
SP4=P((X+4,144),70,0,0,(X-30,G),(X-34,G),('a',X+38,158),('a',X+34,158),tilt=-30)
clip('splash','side view in profile: in the air spreads out flat and dives belly first, lands prone, then pushes himself up',
     [JA(10),SP1,SP2,SP3,SP3,SP4,KNEEL(),STAND(0)])
# 14·15 식칼 던지기(오버핸드): 칼을 머리 옆 위로 들고 빈손으로 겨눔 → 눈높이에서 놓고 팔을 끝까지 따라 내림
KR=P((X-4,118),-4,0,0,(X+19,G),(X-21,G),(4,-22),(36,-2),le=('e',-2,-6))
clip('kready','side view in profile: raises the knife beside his head, other arm pointing forward to aim, weight on the rear foot',[G0,lerp(G0,KR,.5),KR,KR],KNIFE_UP)
KT1=P((X+6,120),14,0,0,(X+25,G),(X-15,G-3),(34,-4),(12,16),le=('e',16,-2))
KT2=P((X+10,124),28,0,0,(X+27,G),(X-9,G-6),(30,36),(6,20))
clip('kthrow','side view in profile: overhand throw: arm whips forward from beside the head, releases at eye level, follows through down',
     [KR,staged(KR,KT1,.6),KT1,KT2,lerp(KT2,STAND(0),.5)],'empty hands')
KP1=P((X+4,140),30,0,0,(X+20,G),(X-12,G-1),('a',X+34,158),('a',X+18,140),tilt=-10)
KP2=P((X+4,140),26,0,0,(X+20,G),(X-12,G-1),('a',X+32,152),('a',X+18,140),tilt=-10)
clip('kpull','side view in profile: squats, grips a handle low in front, twists and yanks it out, then rises into a fighting stance',
     [STAND(0),lerp(STAND(0),KP1,.6),KP1,KP2,lerp(KP2,G0,.5),G0],'holding a heavy cleaver-like kitchen knife by the handle')
# 16·17 승인 요청: 발 벌려 버티고 주먹을 하늘로(앞쪽 위), 가슴 펴고 외침
SM0=P((X-2,126),12,0,0,(X+19,G),(X-21,G),(16,14),(12,16),tilt=10)
SM1=P((X,118),-6,0,0,(X+19,G),(X-21,G),(16,-40),(10,18),le=('e',12,-12),tilt=-18,head=(10,-8))
clip('summon','side view in profile: plants his feet wide, gathers, then thrusts his near fist straight up and shouts, chest out',
     [STAND(0),SM0,SM0,staged(SM0,SM1,.5),SM1,jit(SM1,0,-1,['RIGHT ARM']),SM1,SM1])
clip('summonhold','side view in profile: holds the fist raised to the sky and keeps shouting, chest heaving',[SM1,jit(SM1,0,1,['NECK','NOSE','EYE','EAR']),SM1,jit(SM1,0,-1,['RIGHT ARM'])])
# 18 팔뚝 벽 가드 / 가드 반격(노도와)
BK=P((X-2,122),4,0,0,(X+19,G),(X-19,G-1),(18,-8),(14,-4),le=('e',14,12),re=('e',10,12),tilt=8)
clip('block','side view in profile: both forearms raised vertically like a wall in front of the face and chest, shoulders up, chin down',[G0,lerp(G0,BK,.5),BK,BK],KNIFE_UP)
SV=P((X+8,124),14,0,0,(X+27,G),(X-13,G-3),(16,-6),(44,4),le=('e',12,12))
clip('shove','side view in profile: from a high guard, shoves the rear palm forward into the throat, rear foot driving',[BK,staged(BK,SV,.6),SV,SV,lerp(SV,G0,.5)],KNIFE_UP)
BR=P((X-2,132),18,0,0,(X+23,G),(X-25,G),(20,6),(16,8),le=('e',14,16),re=('e',10,16),tilt=14)
clip('brace','side view in profile: braces for impact, drops low with feet wide, shoulders forward, forearms in front, chin tucked',[G0,lerp(G0,BR,.6),BR,BR,lerp(BR,G0,.5)],KNIFE_UP)
# 21~23 베어 허그 → 박치기 → 고릴라 프레스 / 수플렉스
BH0=P((X+4,122),12,0,0,(X+23,G),(X-15,G-1),(30,24),(28,26))
BH1=P((X+6,120),-8,0,0,(X+21,G),(X-13,G),(28,26),(26,28))
clip('bearhug','side view in profile: steps in, wraps both arms around a waist in front, hips forward, leans back to lift',[G0,BH0,BH1,BH1])
HB=P((X+8,120),18,0,0,(X+21,G),(X-13,G),(24,26),(22,28),tilt=10)
clip('headbutt','side view in profile: arms locked in a bear hug, stiffens the neck and drives the forehead forward with the legs',[BH1,jit(BH1,-2,0,['NOSE','EYE','EAR','NECK']),HB,lerp(HB,BH1,.5)])
PR1=P((X+2,130),6,0,0,(X+21,G),(X-17,G),(18,10),(16,12))
PR2=P((X+2,118),-4,0,0,(X+19,G),(X-17,G),(18,-44),(14,-44),le=('e',14,-14),re=('e',12,-14),tilt=-10)
PR3=P((X+12,120),22,0,0,(X+33,G),(X-9,G-3),(46,-14),(42,-12),tilt=0)
clip('press','side view in profile: presses both arms straight up overhead as if lifting a person, then steps and hurls forward',
     [BH1,PR1,lerp(PR1,PR2,.6),PR2,PR2,staged(PR2,PR3,.6),PR3,lerp(PR3,STAND(0),.5)])
SU1=P((X-2,124),-30,0,0,(X+21,G),(X-15,G),(26,22),(24,24))
SU2=P((X-10,130),-70,0,0,(X+19,G),(X-11,G),(24,10),(22,12))
SU3=LIE(0,(12,-6),(8,-4),dx=-6)
clip('suplex','side view in profile: in a bear hug he arches his back and throws backward over his head, landing on his back',
     [BH1,SU1,SU2,lerp(SU2,SU3,.5),SU3,SU3,lerp(SU3,KNEEL(),.5),KNEEL()])
PKP=P((X+2,120),55,0,0,(X+12,G),(X-6,G),('a',X+34,G-2),(16,26),tilt=-14)
clip('pickup','side view in profile: bends at the waist without kneeling and picks something up from the floor with one hand',[STAND(0),lerp(STAND(0),PKP,.5),PKP,PKP,lerp(PKP,STAND(0),.5),STAND(0)])
TS1=P((X-4,118),-6,0,0,(X+12,G),(X-8,G),(-16,16),(12,20)); TS2=P((X+4,118),10,0,0,(X+14,G),(X-6,G),(44,8),(10,22))
clip('toss','side view in profile: a big one-handed sidearm toss, swinging from behind the hip to far forward',[STAND(0),TS1,lerp(TS1,TS2,.5),TS2,lerp(TS2,STAND(0),.5),STAND(0)])
DRK=lambda t,y=-2: STAND(0,(8,y),AK_F,tilt=-28*t,re=('e',-9,18))
clip('drink','side view in profile: crushes a can in one hand while tipping his head back and downing it in one go',[AKIMBO(0),DRK(0,10),DRK(.5),DRK(1),DRK(1),DRK(0,10)],'holding a small drink can')
EAT=lambda t: STAND(0,(9,-1+3*t),AK_F,tilt=6,re=('e',-9,18))
clip('eat','side view in profile: takes one huge bite of food and chews hard',[AKIMBO(0),EAT(0),EAT(1),EAT(0),EAT(1),AKIMBO(0)],'holding a food bar')
BDG=lambda a: STAND(0,(16+4*math.cos(a),14+4*math.sin(a)),(22,16),tilt=14,lean=4)
clip('bandage','side view in profile: holds one end of a bandage in his teeth and roughly wraps it around his forearm',[BDG(0),BDG(1.6),BDG(3.1),BDG(4.7),BDG(6.2),BDG(7.8)],'white bandage roll')
HT=P((X-3,121),-6,0,0,(X+21,G),(X-21,G-2),(24,28),(16,12),head=(9,-8),tilt=-12)
clip('hit','side view in profile: only his head snaps back and he slides half a step, body stays solid',[G0,HT,lerp(HT,G0,.5),G0],KNIFE)
D1=P((X-4,118),-22,0,0,(X+19,G),(X-17,G-2),(14,-6),(4,-6))
D2=P((X-10,124),-55,0,0,(X+19,G-6),(X+5,G-6),(4,-18),(-6,-14))
D3=LIE(0,(14,0),(8,6),dx=-14); D3b=sh(D3,0,-3)
clip('down','side view in profile: knocked down, falls backward stiff like a toppled tree, bounces once and lies on his back',[D1,D2,lerp(D2,D3,.6),D3b,D3,D3,D3])
GU1=P((X-8,146),-40,0,0,(X+22,G),(X+10,G),(10,12),('a',X-26,G),lk=KNEE_UP,rk=KNEE_UP)
GU2=P((X-4,136),20,0,0,(X+16,G),(X-24,G-2),('a',X+18,132),(14,24),tilt=6)
clip('getup','side view in profile: rolls up, plants one knee, pushes his palm on the knee to stand, then rolls his neck side to side',
     [D3,GU1,GU2,lerp(GU2,STAND(0),.5),STAND(0),STAND(0,tilt=6),STAND(0,tilt=-6)])
# 38·39 임시 무기
PP1=P((X-2,118),-6,0,0,(X+19,G),(X-17,G),(6,-32),(14,14),le=('e',2,-10)); PP2=P((X+8,126),20,0,0,(X+29,G),(X-13,G-2),(34,30),(12,18))
clip('pipe','side view in profile: one-handed overhead hammer blow, swings a long bar down from above the head',[STAND(0),PP1,PP1,staged(PP1,PP2,.6),PP2,lerp(PP2,STAND(0),.5)],'holding a long steel pipe in the near hand')
SHP=lambda b=0,tilt=0: STAND(b,(10,-4),AK_F,tilt=tilt,le=('e',12,14),re=('e',-9,18))      # 앞손으로 어깨에 걸쳐 멤
clip('idle_pipe','side view in profile: standing relaxed with a long bar resting on his near shoulder, other fist on the hip',[SHP(0),SHP(.6),SHP(1.2),SHP(.6),SHP(0)],'a long steel pipe resting on the near shoulder')
clip('walk_pipe','side view in profile: heavy walk with a long bar resting on his near shoulder',[walkf(i/8,lh=(10,-4),rh=(4+8*math.cos(2*math.pi*i/8),34)) for i in range(8)],'a long steel pipe resting on the near shoulder')
SG0=STAND(0,(26,34),(12,36),lean=2); SG1=jit(SG0,-3,-1,['ARM','ELBOW'])
clip('shotgun','side view in profile: fires a shotgun from the hip, the recoil does not move his body at all',[SG0,SG1,lerp(SG1,SG0,.5),SG0,SG0],'holding a black pump shotgun at the hip, pointing forward')
SGS=lambda b=0: STAND(b,(8,-2),AK_F,le=('e',10,14),re=('e',-9,18))
clip('idle_shotgun','side view in profile: standing with a shotgun resting on his near shoulder like a toy, other fist on the hip',[SGS(0),SGS(.6),SGS(1.2),SGS(.6)],'a black pump shotgun resting on the near shoulder')
clip('walk_shotgun','side view in profile: heavy walk with a shotgun resting on his near shoulder',[walkf(i/8,lh=(8,-2),rh=(4+8*math.cos(2*math.pi*i/8),34)) for i in range(8)],'a black pump shotgun resting on the near shoulder')
clip('run_shotgun','side view in profile: heavy run gripping a shotgun in one hand at his side, other arm pumping',[runf(i/8,lh=(10,30)) for i in range(8)],'holding a black pump shotgun in the near hand at his side')
TR_=lambda b: P((X,124+b),42,0,0,(X+12,G),(X-8,G),('a',X+22,128),('a',X+18,130),tilt=-24)
clip('tired','side view in profile: bent forward with both hands on his knees, catching his breath heavily',[TR_(0),TR_(1),TR_(2),TR_(1)])

# ═══ 5.2 기본 클립 (몸만) ═══
SU_=lambda h: P((X+4,HY-h*0.5),6,0,0,(X+20,G-h),(X-8,G),(10,30),(4,32),lk=KNEE_UP)
clip('stepup','side view in profile: steps up onto a high step in one big stride without using hands',[STAND(0),SU_(10),SU_(22),P((X+14,HY-14),8,0,0,(X+22,G-22),(X+6,G-14),(10,30),(4,32)),P((X+18,HY-22),2,0,0,(X+26,G-22),(X+12,G-22),'down','down'),P((X+20,HY-22),2,0,0,(X+28,G-22),(X+14,G-22),'down','down')])
SO1=P((X+2,HY-2),-4,0,0,(X+24,G-30),(X-8,G),(14,22),(2,30),lk=KNEE_UP); SO2=P((X+14,HY),6,0,0,(X+36,G),(X-2,G-24),(14,24),(4,30),rk=KNEE_UP)
clip('stepover','side view in profile: lifts one leg high and steps straight over something waist high, then brings the other leg over',[STAND(0),SO1,lerp(SO1,SO2,.5),SO2,P((X+22,HY),2,0,0,(X+32,G),(X+14,G),'down','down')])
LS1=P((X-12,146),-55,0,0,(X+30,154),(X+28,156),(14,10),(10,14))
clip('liesit','side view in profile: lying on his back, tightens his stomach and sits up in one heave',[LIE(0),lerp(LIE(0),LS1,.5),LS1,P((X-10,148),-10,0,0,(X+28,154),(X+26,156),(18,24),(14,26)),P((X-10,148),-8,0,0,(X+28,154),(X+26,156),('a',X+18,146),('a',X+14,148))])
HW=lambda a: P((X,HY+2),34,0,0,(X+10,G),(X-8,G),(30+3*a,26),(26-3*a,28),tilt=-16)
clip('handswork','side view in profile: bends deeply at the waist and works with both hands low in front of him',[HW(0),HW(1),HW(0),HW(-1)])
HH=lambda a: STAND(0,(4+2*a,-16),(0-2*a,-14),tilt=10,le=('e',10,-2),re=('e',6,0))
clip('handshead','side view in profile: rubs both palms over his bald head and the back of his neck',[STAND(0),HH(0),HH(1),HH(-1),HH(1)])
SMH=lambda t: SEAT(0,(10,-2+6*t),('a',X+10,124),lean=12-4*t,tilt=8)
clip('seatmouth','side view in profile: sits with legs apart, leaning forward and shoveling food into his mouth with big motions',[SMH(1),SMH(0),SMH(1),SMH(0)])
SHL=lambda b: SEAT(b,(22,22),(18,24),lean=24,tilt=18)
clip('seathold','side view in profile: sits leaning forward with elbows on the knees, looking down at something in his hands',[SHL(0),SHL(.5),SHL(1),SHL(.5)])
HL_=lambda b: STAND(b,(30,12),(26,14),tilt=18)
clip('holdlook','side view in profile: standing, holds something out at arm length and looks down at it',[HL_(0),HL_(.5),HL_(1),HL_(.5)])
HE=lambda b: STAND(b,(-2,-6),AK_F,le=('e',8,8),re=('e',-9,18),tilt=-4)
clip('handear','side view in profile: presses one big hand to his ear, the other fist on the hip',[HE(0),HE(.5),HE(1),HE(.5)])
SW=lambda a: P((X+2*a,HY+2),14,0,0,(X+16,G),(X-12,G),(26+12*a,30),(14+10*a,24))
clip('sweep','side view in profile: pushes a long-handled floor tool far forward with both hands and pulls it back',[SW(-1),SW(-.3),SW(.5),SW(1),SW(.3),SW(-.5)])
clip('liehold','side view in profile: lying on his back holding something up above his face with both arms straight',[LIE(0,(14,-22),(12,-20)),LIE(.5,(14,-22),(12,-20)),LIE(1,(14,-21),(12,-19)),LIE(.5,(14,-22),(12,-20))])
C2=(24,30); C2b=(20,32)
clip('carry2_idle','side view in profile: standing holding something big at belly height in both arms, effortless',[STAND(b,C2,C2b) for b in (0,.6,1.2,.6)])
clip('carry2_walk','side view in profile: heavy walk holding something big at belly height in both arms',[walkf(i/8,lh=C2,rh=C2b) for i in range(8)])
clip('carry2_run','side view in profile: heavy run holding something big at belly height in both arms',[runf(i/8,lh=C2,rh=C2b) for i in range(8)])
C1=(10,-6)
clip('carry1_idle','side view in profile: standing with something balanced on his near shoulder held by one hand, other fist on the hip',[STAND(b,C1,AK_F,le=('e',12,12),re=('e',-9,18)) for b in (0,.6,1.2,.6)])
clip('carry1_walk','side view in profile: heavy walk with something on his near shoulder held by one hand',[walkf(i/8,lh=C1,rh=(4+8*math.cos(2*math.pi*i/8),34)) for i in range(8)])
clip('carry1_run','side view in profile: heavy run with something on his near shoulder held by one hand',[runf(i/8,lh=C1) for i in range(8)])

# ═══ 5.3 지형·이동 ═══
TN=P((X,HY),2,0,0,(X+4,G),(X-4,G),'down','down',head=(1,-9))
clip('turn','turning around heavily with the whole body: from facing right to facing the viewer',[STAND(0),lerp(STAND(0),TN,.5),TN])
FL=P((X,110),0,0,0,(X+14,G-14),(X-12,G-12),(30,-16),(-14,-16),le=ELB_UP,re=ELB_UP)
clip('fall','side view: falling with arms and legs spread wide, body straight',[FL,jit(FL,0,-2,['ARM']),FL])
LD=P((X,140),18,0,0,(X+19,G),(X-17,G),(34,8),(-10,10))
clip('land','side view in profile: lands hard on both feet from a height, knees bending deep, arms out for balance, then rises',[LD,LD,lerp(LD,STAND(0),.6)])
def lad(t):
    c=math.cos(2*math.pi*t)
    return P((X+2,112),2,0,0,(X+16,138-10*c),(X+14,128+10*c),('a',X+20,60+10*c),('a',X+20,72-10*c),lk=KNEE_UP,rk=KNEE_UP,le=ELB_OUT,re=ELB_OUT)
clip('ladder','side view in profile: climbing a vertical ladder, hauling himself up with the arms, the feet following late',[lad(i/8) for i in range(8)])
MT1=P((X+2,HY),4,0,0,(X+10,G),(X-6,G),('a',X+22,106),(10,30)); MT2=P((X+10,104),10,0,0,(X+18,G-18),(X+2,G-8),('a',X+24,108),(8,26),lk=KNEE_UP)
MT3=P((X+18,94),4,0,0,(X+24,G-44),(X+12,G-44),('a',X+28,114),(6,28),lk=KNEE_UP,rk=KNEE_UP)
clip('mantle','side view in profile: plants one hand on a high ledge and presses himself straight up onto it with the arm',[MT1,MT2,MT3,P((X+22,HY-44),2,0,0,(X+30,G-44),(X+16,G-44),'down','down'),P((X+24,HY-44),2,0,0,(X+32,G-44),(X+18,G-44),'down','down')])
VT1=P((X+6,HY-4),6,0,0,(X+26,G-34),(X-6,G),(14,24),(4,30),lk=KNEE_UP); VT2=P((X+20,HY-26),6,0,0,(X+28,G-34),(X+14,G-30),(16,24),(6,28),lk=KNEE_UP,rk=KNEE_UP)
clip('vault','side view in profile: steps up onto a waist-high obstacle with one foot and walks straight over it without using the hands',[STAND(0),VT1,VT2,lerp(VT2,P((X+40,HY),4,0,0,(X+50,G),(X+32,G),'down','down'),.5),P((X+40,HY),4,0,0,(X+50,G),(X+32,G),'down','down')])
def crawl(t):
    c=math.cos(2*math.pi*t)
    return P((X-6,150),84,0,0,(X-44,158),(X-46,156),('a',X+36+6*c,156),('a',X+30-6*c,156),tilt=-50,le=ELB_DOWN,re=ELB_DOWN)
clip('crawl','side view in profile: belly crawl through a tight space, dragging himself forward on his elbows, shoulders squeezed',[crawl(i/8) for i in range(8)])
def sneak(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,HY+4+abs(sn)),14,0,0,(X+2+10*c,G-2-5*max(0,-sn)),(X+2-10*c,G-2-5*max(0,sn)),(18,4),(14,6),tilt=8)
clip('sneak','side view in profile: tiptoeing awkwardly, huge body hunched, both arms raised in front, tiny careful steps',[sneak(i/8) for i in range(8)])
LT=(14,-10)   # 손전등을 머리 높이로 들고 아래로 비춤
clip('idle_light','side view in profile: standing holding a small light up at head height pointing it downward ahead, other fist on the hip',[STAND(b,LT,AK_F,le=('e',14,8),re=('e',-9,18)) for b in (0,.6,1.2,.6)],'holding a small flashlight')
clip('walk_light','side view in profile: heavy walk holding a small light up at head height pointing it downward ahead',[walkf(i/8,lh=LT,rh=(4+8*math.cos(2*math.pi*i/8),34)) for i in range(8)],'holding a small flashlight')
clip('run_light','side view in profile: heavy run holding a small light up at head height pointing ahead',[runf(i/8,lh=LT) for i in range(8)],'holding a small flashlight')
LB=STAND(0,'down','down',head=None) if False else P((X,HY),2,0.2,0.1,(X+9,G),(X-8,G),'down','down',head=(-2,-9))
clip('lookback','side view in profile: snaps a glance back over his shoulder with the whole upper body, then faces forward again',[STAND(0),lerp(STAND(0),LB,.5),LB,LB,lerp(LB,STAND(0),.5),STAND(0)])
HD=P((X-4,140),40,0,0,(X+12,G),(X-14,G),(16,18),(12,20),tilt=20)
clip('hide','side view in profile: crouches as small as he can behind cover, still too big, holding his breath with puffed cheeks',[STAND(0),lerp(STAND(0),HD,.5),HD,jit(HD,0,1,['NECK','NOSE']),HD])

# ═══ 5.4 탐사 ═══
DR1=P((X+2,HY),4,0,0,(X+12,G),(X-6,G),(30,12),(4,32)); DR2=P((X+12,HY+4),26,0,0,(X+28,G),(X+2,G),(34,10),(4,30),tilt=16)
clip('door','side view in profile: pushes a handle, then ducks his head under a low frame as he walks through',[STAND(0),DR1,lerp(DR1,DR2,.5),DR2,walkf(.25,lean=24,hipdy=4),walkf(.5,lean=18,hipdy=3),STAND(0)])
DC=P((X+4,HY),6,0,0,(X+16,G),(X-6,G),(-26,20),(10,30))
clip('doorclose','side view in profile: walking forward, reaches back with one arm and slams something shut behind him',[walkf(0),lerp(walkf(0),DC,.5),DC,DC,lerp(DC,walkf(.5),.5),walkf(.5)])
KN_=lambda t: STAND(0,(26,-2+6*t),AK_F,le=('e',14,4),re=('e',-9,18),lean=3)
clip('knock','side view in profile: pounds three times with the side of his fist at head height',[AKIMBO(0),KN_(0),KN_(1),KN_(0),KN_(1),AKIMBO(0)])
def pushf(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+4,HY+4),18,0,0,(X+14+10*c,G-3*max(0,-sn)),(X-6-10*c,G-3*max(0,sn)),(38,14),AK_F,re=('e',-9,18))
clip('push','side view in profile: pushes forward with one straight arm, the other fist on the hip, legs driving',[pushf(i/6) for i in range(6)])
IN=lambda t: KNEEL((26,40-6*t),(14,30),tilt=14+6*t,lean=20)
clip('inspect','side view in profile: kneels on one knee and picks something up between finger and thumb to look at it closely',[STAND(0),lerp(STAND(0),IN(0),.5),IN(0),IN(1),IN(1),IN(0)])
def leadf(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+4,HY+2+2*abs(c)),8,0,0,(X+4+16*c,G-6*max(0,-sn)),(X+4-16*c,G-6*max(0,sn)),(8-8*c,32),(-30,20),head=(8,-8) if t<.5 else (2,-9))
clip('leadhand','side view in profile: striding forward pulling someone behind him by the wrist, glancing back',[leadf(i/8) for i in range(8)])
BW=lambda t: P((X-2*t,HY+2*t),2+50*t,0,0,(X+9,G),(X-8,G),(4+10*t,32),(0+8*t,32),tilt=10*t)
clip('bow','side view in profile: a big deep bow from the waist, then straightens up',[BW(0),BW(.5),BW(1),BW(.5),BW(0)])
ARMX=lambda b=0,tilt=0: STAND(b,(18,18),(16,20),tilt=tilt,le=('e',4,24),re=('e',2,24),fw=2)    # 팔짱
clip('elevwait','side view in profile: standing with arms crossed, head slightly bowed under a low ceiling, glancing up',[ARMX(0,8),ARMX(.6,8),ARMX(1,4),ARMX(.6,8)])
clip('floorsit','side view in profile: drops heavily to sit cross-legged on the floor',[STAND(0),lerp(STAND(0),FLOOR(),.4),lerp(STAND(0),FLOOR(),.8),FLOOR(1),FLOOR()])
clip('floorrest','side view in profile: sitting cross-legged, hands on the knees, head leaned back, eyes closed, slow breathing',[FLOOR(0,tilt=-14,lean=-10),FLOOR(.6,tilt=-14,lean=-10),FLOOR(1,tilt=-14,lean=-10),FLOOR(.6,tilt=-14,lean=-10)])

# ═══ 5.5 상태·결과 ═══
HI=lambda b: P((X,HY+3+b),6,0,0,(X+13,G),(X-11,G),(18,16),(4,24),tilt=4)
clip('hurtidle','side view in profile: injured but standing upright, one hand clutching his side, the other fist ready, heavy breathing',[HI(0),HI(1),HI(1.6),HI(1)])
def limpf(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,HY+2+3*max(0,c)),6,0,0,(X+2+14*c,G-5*max(0,-sn)),(X+2-14*c,G-1*max(0,sn)),(14,22),(4,24))
clip('limp','side view in profile: limping with big strides anyway, dragging the rear leg, hand on his side, not stopping',[limpf(i/8) for i in range(8)])
FR=lambda b: P((X-2,HY+4+b),4,0,0,(X+14,G),(X-14,G),(14,22),(10,24),tilt=6)
clip('fear','side view in profile: tense and wary, jaw clenched, fists tight at his sides, shoulders stiff, eyes darting',[FR(0),FR(.6),jit(FR(0),1,0,['NOSE']),FR(.6)])
NS=lambda t: P((X,HY+4),18+8*t,0,0,(X+10,G),(X-8,G),(12,-2),(20,8+4*t),tilt=16)
clip('nausea','side view in profile: covers his mouth with one hand and thumps his chest with the other fist, doubling over',[STAND(0),NS(0),NS(1),NS(0),NS(1)])
CK=KNEEL((14,32),('a',X+26,G-2),tilt=18,lean=24)
CF=P((X-8,152),88,0,0,(X-50,156),(X-52,158),('a',X+38,158),('a',X+32,158),tilt=10)
clip('collapse','side view in profile: staggers, drops to one knee, braces a hand on the floor fighting it, then falls forward face down',[HT,lerp(HT,CK,.5),CK,CK,jit(CK,0,2,['NECK','NOSE']),lerp(CK,CF,.5),CF,CF])
BLI=lambda b: P((X-4,128),-90,0,0,(X+40,130),(X+38,132),(18,2+b),(14,4+b),le=ELB_DOWN,re=ELB_DOWN)
clip('bedlie','side view in profile: lying flat on his back asleep, arms crossed on his chest, slow breathing',[BLI(0),BLI(1),BLI(1),BLI(0)])
VC1=STAND(0,(14,18),(10,22)); VC2=STAND(0,(10,6),AK_F,tilt=8,re=('e',-9,18))
clip('victory','side view in profile: tucks the knife into his jacket, cracks his neck side to side, brushes off his shoulder, grinning',[G0,VC1,STAND(0,tilt=10),STAND(0,tilt=-10),VC2,jit(VC2,0,2,['RIGHT ARM']),AKIMBO(0)])

# ═══ 5.6 본부 업무 ═══
clip('chairsit','side view in profile: drops heavily into a chair with legs wide apart',[STAND(0),lerp(STAND(0),SEAT(),.4),lerp(STAND(0),SEAT(),.8),SEAT(2),SEAT()])
TY=lambda a: SEAT(0,(28,22-3*a),(24,24-3*(1-a)),lean=16,tilt=10)
clip('typing','side view in profile: seated, hunched forward, poking keys with two index fingers',[TY(0),TY(1),TY(0),TY(1)])
GC=lambda t: STAND(0,(20,14),(16+6*t,12),tilt=18,lean=4)
clip('gearcheck','side view in profile: runs his thumb along a knife blade to test it, then wipes the blade on his sleeve',[GC(0),GC(.5),GC(1),STAND(0,(16,12),(10,6),tilt=12),GC(0)],KNIFE_UP)
TI=lambda y,t: STAND(0,(8,y),(6,y+2),tilt=t)
clip('tie','side view in profile: yanks his necktie tight at the collar, then tugs it loose again because it is choking',[STAND(0),TI(4,8),TI(2,-6),TI(2,-6),TI(8,6),STAND(0)])

# ═══ 5.7 생활·여가 ═══
clip('seatrest','side view in profile: sitting leaned way back in a chair with arms crossed, relaxed',[SEAT(b,(16,18),(14,20),lean=-14,tilt=-4) for b in (0,.6,1,.6)])
clip('seatthink','side view in profile: seated, stroking his goatee with eyes closed, thinking',[SEAT(0,(12,4+a),(14,20),lean=-6,tilt=-2) for a in (0,2,4,2)])
clip('doze','side view in profile: dozing in a chair with arms crossed, head tipped back, mouth open',[SEAT(0,(16,18),(14,20),lean=-12,tilt=t) for t in (-4,-14,-20,-10)])
clip('yawn','side view in profile: a huge yawn without covering his mouth, one arm stretched up',[STAND(0),STAND(0,(12,-30),'down',tilt=-16,le=('e',10,-10)),STAND(0,(12,-34),'down',tilt=-22,le=('e',10,-12)),STAND(0)])
ST1=STAND(0,(6,2),(4,4),le=('e',10,4),re=('e',8,6),tilt=4); ST2=STAND(0,(14,-8),(10,-8),le=ELB_UP,re=ELB_UP,tilt=-6)
clip('stretch','side view in profile: rolls his big shoulders around and cracks his neck',[STAND(0),ST1,ST2,ST1,STAND(0,tilt=12),STAND(0,tilt=-8),ST2,STAND(0)])
HRB=lambda a: STAND(0,(4+2*a,-14),AK_F,tilt=12,le=('e',12,0),re=('e',-9,18))
clip('headrub','side view in profile: rubs the top of his bald head with his palm',[AKIMBO(0),HRB(0),HRB(1),HRB(-1),AKIMBO(0)])
BT=lambda a: STAND(0,(10+1.5*a,0),(14,14),tilt=4)
clip('brushteeth','side view in profile: brushing his teeth fast and hard, the other hand holding a cup',[BT(1),BT(-1),BT(1),BT(-1)],'holding a toothbrush and a cup')

# ═══ 5.8 사교·감정 ═══
GS=lambda a: STAND(0,(26+6*a,8),(16-6*a,14),lean=4)
clip('gesture','side view in profile: talking with big open arm gestures',[GS(0),GS(1),GS(-1),GS(1)])
clip('armscross','side view in profile: standing with thick arms crossed, feet wide, chin up, listening',[ARMX(b,-4) for b in (0,.6,1,.6)])
clip('nod','side view in profile: one big firm nod',[AKIMBO(0),AKIMBO(0,8),AKIMBO(0,18),AKIMBO(0,6),AKIMBO(0)])
HS=lambda h: P((X,HY),2,0,0,(X+11,G),(X-10,G),AK_N,AK_F,le=('e',-7,19),re=('e',-9,18),head=h)
clip('headshake','side view in profile: shakes his head slowly and heavily: no',[AKIMBO(0),HS((7,-8)),HS((11,-7)),HS((7,-8)),AKIMBO(0)])
WV=lambda a: STAND(0,(20+5*a,-30),AK_F,le=('e',14,-10),re=('e',-9,18))
clip('wave','side view in profile: raises his whole arm high and waves it in big arcs',[AKIMBO(0),WV(0),WV(1),WV(-1),WV(1),AKIMBO(0)])
HSK=lambda a: STAND(0,(34,18+3*a),(30,16+3*a),lean=6)
clip('handshake','side view in profile: grips a hand in front with both of his big hands and shakes it hard',[STAND(0),HSK(0),HSK(1),HSK(-1),HSK(1),STAND(0)])
PT=lambda a: STAND(0,(32,-4+6*a),AK_F,lean=4,re=('e',-9,18))
clip('pat','side view in profile: slaps someone hard on the shoulder twice',[AKIMBO(0),PT(-1),PT(1),PT(-1),PT(1),AKIMBO(0)])
PO=STAND(0,'out',AK_F,re=('e',-9,18),lean=4)
clip('point','side view in profile: thrusts his arm straight forward and points with the index finger',[AKIMBO(0),lerp(AKIMBO(0),PO,.5),PO,PO])
SR_=STAND(0,(16,14),(12,14),tilt=-6)
clip('shrug','side view in profile: a huge shrug, shoulders up, palms turned up',[STAND(0),SR_,jit(SR_,0,-3,['SHOULDER','NECK','NOSE','EYE','EAR']),SR_,STAND(0)])
HG=P((X+8,HY-2),-8,0,0,(X+19,G),(X-5,G),(28,10),(26,12))
clip('hug','side view in profile: steps forward and wraps someone in a crushing bear hug, leaning back to lift them off the ground',[STAND(0),walkf(.25),lerp(walkf(.25),HG,.6),HG,jit(HG,0,-2,['NECK','NOSE','EYE','EAR'])])
LG=lambda t: STAND(0,(14,22),(10,24),tilt=-20*t,lean=-6*t)
clip('laugh','side view in profile: laughs out loud with his head thrown back, holding his belly',[STAND(0),LG(.6),LG(1),LG(.7),LG(1),LG(.4)])
GL=STAND(0,(16,8),AK_F,re=('e',-9,18))
clip('glad','side view in profile: clenches a fist and pumps it once at chest height, pleased',[AKIMBO(0),lerp(AKIMBO(0),GL,.6),GL,jit(GL,0,3,['RIGHT ARM'])])
CR=lambda t: STAND(0,(10,-2+3*t),'down',tilt=14,le=('e',12,8))
clip('cry','side view in profile: holds it in, then wipes his eyes with the back of his hand, head lowered',[STAND(0,tilt=10),CR(0),CR(1),CR(0),STAND(0,tilt=14)])
WC=lambda b: P((X+6,HY),16,0,0,(X+14,G),(X-4,G),(28,-12),(10,26),tilt=24,le=('e',16,0))
clip('wallcry','side view in profile: leans his forearm and forehead against a wall in front of him, shoulders shaking',[WC(0),jit(WC(0),0,1,['SHOULDER','NECK']),WC(0),jit(WC(0),0,1,['SHOULDER','NECK'])])
KC=lambda b: KNEEL(('a',X+30,G),(14,28),tilt=30,lean=34)
clip('kneelcry','side view in profile: down on one knee, a fist pressed on the floor, head hanging, shoulders shaking',[KC(0),jit(KC(0),0,1,['NECK','NOSE']),KC(0),jit(KC(0),0,1,['NECK','NOSE'])])
clip('sad','side view in profile: shoulders slumped, head down, gripping his goatee with one hand',[STAND(b,(12,8),'down',tilt=16,lean=6) for b in (0,.6,1,.6)])
SHT=P((X+4,HY+2),14,0,0,(X+19,G),(X-11,G),(42,-6),(12,20),tilt=-6)
clip('shout','side view in profile: shouts a warning, leaning forward with one arm thrust out and the palm open to stop people',[STAND(0),lerp(STAND(0),SHT,.6),SHT,jit(SHT,1,0,['RIGHT ARM']),SHT])
DS1=STAND(0,(16,-12),'down',le=('e',12,-4),tilt=6); DS2=P((X+2,HY+4),20,0,0,(X+11,G),(X-8,G),(30,30),'down',tilt=14)
clip('deskslam','side view in profile: raises his palm and slams it flat down on a surface in front of him',[STAND(0),DS1,DS2,DS2])
SPZ=P((X-5,HY),-6,0,0,(X+5,G),(X-15,G),(12,24),(8,26),tilt=-6)
clip('surprise','side view in profile: startled, eyebrows shoot up and he takes half a step back, body barely moves',[STAND(0),SPZ,SPZ,lerp(SPZ,STAND(0),.5)])
SF=P((X-10,150),-30,0,0,(X+28,G),(X+22,G),('a',X-30,156),('a',X-26,156),lk=KNEE_UP,rk=KNEE_UP)
clip('startlefall','side view in profile: so startled he falls back heavily onto his bottom, catching himself on both hands',[STAND(0),SPZ,lerp(SPZ,SF,.5),SF])
PD=P((X-8,150),-14,0,0,(X+36,G),(X+30,G),('a',X-26,154),('a',X-22,154),tilt=14)
clip('plopdown','side view in profile: exhausted, drops heavily to sit on the floor with legs stretched out, leaning back on both hands',[STAND(0),lerp(STAND(0),PD,.4),lerp(STAND(0),PD,.8),PD,jit(PD,0,1,['NECK','NOSE'])])
EM=lambda a: STAND(0,(-4+2*a,-16),AK_F,tilt=-8,le=('e',8,-2),re=('e',-9,18),head=(8,-8))
clip('embarrassed','side view in profile: looks away and scratches the back of his bald head',[AKIMBO(0),EM(0),EM(1),EM(-1),EM(1),AKIMBO(0)])
AN=lambda t: STAND(0,(10,-6),AK_F,tilt=10+4*t,le=('e',12,2),re=('e',-9,18))
clip('annoyed','side view in profile: snorts and pinches the bridge of his nose between thumb and finger, eyes closed',[AKIMBO(0),AN(0),AN(1),AN(0),AN(1),AKIMBO(0)])
TH=lambda a: STAND(0,(12,4+2*a),(16,20),tilt=-4+6*a,re=('e',2,24))
clip('think','side view in profile: one arm folded, the other hand stroking his goatee, head tilting',[TH(0),TH(1),TH(0),TH(-1)])
BO=lambda a: STAND(0,(18,18),(16+2*a,18-2*a),tilt=-2,le=('e',4,24),re=('e',2,24),fw=2)
clip('bored','side view in profile: arms crossed, drumming his fingers on his thick forearm, bored',[BO(0),BO(1),BO(0),BO(1)])

# ═══ 5.9 전용 ═══
OB=STAND(0,(16,-24),AK_F,le=('e',14,-6),re=('e',-9,18),tilt=-4)
clip('objection','side view in profile: suddenly raises one hand with the index finger up: wait a minute',[AKIMBO(0),lerp(AKIMBO(0),OB,.6),OB,OB])
IT=lambda a: STAND(0,(20,24-2*a),(16,26-2*a),tilt=-14,lean=0)
clip('itch','side view in profile: looking up at something tall, flexing his hands, clenching and opening his fists, itching to smash',[IT(0),IT(1),IT(0),IT(1)])
LP1=P((X+4,HY+6),16,0,0,(X+19,G),(X-9,G),(30,18),(28,20)); LP2=P((X+2,HY),-6,0,0,(X+15,G),(X-9,G),(26,-4),(24,-2),le=('e',14,8),re=('e',12,8))
clip('liftput','side view in profile: grabs a person under the arms, lifts them up high, turns a step and sets them down',[STAND(0),LP1,LP2,sh(LP2,6),lerp(sh(LP2,6),sh(LP1,8),.6),STAND(0)])
FC=(4,0); FCb=(10,-4)   # 어깨에 사람을 메고(파이어맨 캐리) 앞손으로 다리·팔을 감아 쥠
clip('fcarry_idle','side view in profile: standing with a person slung over his near shoulder, one arm wrapped around them',[STAND(b,FC,AK_F,le=('e',10,14),re=('e',-9,18)) for b in (0,.6,1.2,.6)])
clip('fcarry_walk','side view in profile: heavy walk with a person slung over his near shoulder, one arm wrapped around them',[walkf(i/8,lh=FC,rh=(4+8*math.cos(2*math.pi*i/8),34),lean=6) for i in range(8)])
clip('fcarry_run','side view in profile: heavy run with a person slung over his near shoulder, one arm wrapped around them',[runf(i/8,lh=FC) for i in range(8)])
RD=lambda b: P((X-6,124+b),18,0,0,(X+18,140),(X+14,142),(34,14),(30,16),lk=KNEE_UP,rk=KNEE_UP,tilt=-4)
clip('ride','side view in profile: seated astride with knees up, leaning forward, both hands gripping handlebars in front',[RD(0),RD(.6),RD(1),RD(.6)])
DM1=P((X-4,124),10,0,0,(X+18,140),(X-12,G),(32,16),(28,18),lk=KNEE_UP); DM2=P((X+2,HY),0,0,0,(X+12,G),(X-10,G),(20,24),(4,30))
clip('dismount','side view in profile: swings a leg off from a seated straddle, stands up and looks up at something tall',[RD(0),DM1,DM2,STAND(0,tilt=-12),STAND(0,tilt=-16),AKIMBO(0,-12)])

PBASE=[STAND(0),STAND(.5),G0]   # 옆모습 기준판 뽑기(3장 = 2회): 0번을 모든 클립의 기준 그림으로
REF_POSE=STAND(0)

if __name__=='__main__':
    import json
    from PIL import Image
    bad=B.audit()
    for b in bad: print('AUDIT',*b)
    names=sys.argv[1:] or list(B.CLIPS)
    base=Image.open('../full/base.png').convert('RGBA')
    for i in range(0,len(names),10): B.sheet(names[i:i+10],f'../skel/plan-{i//10:02d}.png',base)
    print(len(B.CLIPS),'clips',sum(len(v[2]) for v in B.CLIPS.values()),'frames, audit',len(bad))
REF_PNG='../full/ref.png'
