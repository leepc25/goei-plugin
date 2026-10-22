# 공용 탐사원 몸 2종(남 grunt_m 94px / 여 grunt_f 88px) 뼈대 26클립. 머리·가면은 코드가 머리 점에 얹는다.
# 사용: GRUNT=m|f python3 gen.py ...  (환경 변수로 몸 선택)
import math,os
import common as c
from common import P,lerp,sh,tail,cyc,KNEE_FWD,KNEE_UP
import life
B=os.environ.get('GRUNT','m')
c.setup(1.01 if B=='m' else 0.95,g=100,x=66)
X,G,Y=c.X,c.G,c.HIPY
S=life.build(life.Style(rest='down',lean=2,stride=9,lift=3,bob=0.5,swing=5,wlean=3,rstride=18,rlean=16,rswing=7))
ST,walkf,runf,SIT,DEEP=S.ST,S.walkf,S.runf,S.SIT,S.DEEP
c.set_akp(ST())
STN=lambda d=0,b=0: P((X+d,Y+4+b),6,-0.2,-0.1,(X+12+d,G),(X-12+d,G),('r',16,8),('r',12,12),le=('e',10,8),re=('e',6,10))
S0=STN(); cl=c.clip; W='person' if B=='m' else 'woman'
cl('idle',f'masked agent {W} standing at ease, slight breathing',tail([ST(),ST(.4),ST(.7),ST(.4)],True))
cl('stance','guarded ready stance, fists up loosely, knees bent',tail([S0,STN(0,.4),STN(0,.7),STN(0,.4)],True))
cl('walk','ordinary walk, arms swinging',tail(cyc(walkf),True))
cl('run','ordinary run, arms pumping',tail(cyc(runf),True))
JP=P((X,Y-16),6,0,0,(X+10,G-22),(X-8,G-18),('r',14,6),('r',-4,10),le=('e',8,8),re=('e',-4,10))
cl('jump','an ordinary jump, knees tucked',tail([S0,DEEP(0,-8),lerp(DEEP(0,-8),JP,.5),JP,JP,lerp(JP,DEEP(0,-10),.5),DEEP(0,-10),S0],False))
J1=P((X+3,Y+4),8,-0.3,-0.1,(X+15,G),(X-11,G),('r',32,2),('r',12,12),le=('e',16,2),re=('e',6,10))
cl('jab','quick lead-hand jab, a half step in',tail([S0,J1,J1,STN(2)],False))
K1=P((X,Y+2),-6,0,0,(X+8,G-22),(X-10,G),('r',14,8),('r',8,10),le=('e',8,8),re=('e',4,10),lk=KNEE_UP)
K2=P((X+2,Y+2),-10,0,0,(X+30,G-36),(X-10,G),('r',14,8),('r',8,10),le=('e',8,8),re=('e',4,10),lk=KNEE_FWD)
K3=P((X+2,Y+2),-12,0,0,(X+32,G-24),(X-10,G),('r',14,8),('r',8,10),le=('e',8,8),re=('e',4,10),lk=KNEE_FWD)
cl('kick2','two quick front kicks in a row with the front leg, low then high',tail([S0,K1,K3,K1,K2,K2,S0],False))
TH=lambda u: P((X+4*u,Y+4),6+6*u,-0.3,0,(X+14,G),(X-12,G),('r',-8+38*u,0-14*u),('r',10,12),le=('e',-2+16*u,6-8*u),re=('e',6,10))
cl('throw','throws something small overhand',tail([S0,TH(0),TH(.5),TH(1),TH(1)],False))
SH_=lambda r: P((X-r,Y+3),4-2*r,-0.3,-0.2,(X+12,G),(X-10,G),('r',34,-2),('r',32,0),le=('e',16,0),re=('e',15,1))
cl('shoot','fires a pistol held out in both hands, small recoil',tail([SH_(0),SH_(1),SH_(.4),SH_(0)],False),'a black pistol')
HI=P((X-3,Y+1),-10,0,0,(X+4,G),(X-5,G),('r',10,14),('r',6,16),head=(5,-8),tilt=-10)
cl('hit','flinches back from a hit',tail([S0,HI,lerp(HI,S0,.5),S0],False))
cl('flee','turns and runs away in a panic, glancing back',tail(cyc(lambda t: runf(t,head=(2,-8))),True))
CRC=lambda b=0: P((X-2,Y+26+b),24,0,0,(X+10,G),(X-8,G),('r',16,18),('r',12,20),le=('e',6,12),re=('e',4,13),lk=KNEE_UP,rk=KNEE_UP)
cl('crouch','squats down low',tail([S0,lerp(S0,CRC(),.5),CRC(),CRC(.5)],False))
TEXT={'down':'knocked off their feet, falls on their back','getup':'gets back up from the floor','hide':'crouches in hiding, peeking forward',
 'pickup':'bends and picks something up','carry2_walk':'walks carrying a load in both arms','bow':'a short polite bow','wave':'waves one hand',
 'point':'points ahead','nod':'nods','headshake':'shakes the head','fear':'trembles, hands raised defensively','collapse':'collapses to the floor',
 'victory':'pumps a fist'}
life.register(S,TEXT,skip=[n for n in life.LIFE_NAMES if n not in TEXT])
if __name__=='__main__':
    print(B,len(c.CLIPS),'clips',sum(len(v[2]) for v in c.CLIPS.values()),'frames'); print('audit',c.audit()[:20])
