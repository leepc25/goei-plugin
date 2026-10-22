# 게슈간 전 동작 뼈대 (animate_with_skeleton_v3). 설계 docs/캐릭터제작서/동작설계_geshugan.md, 클립 목록 ../plan.py.
# 기준 그림 base/G0.png = 쟈알디 옆모습 대기 장(jyaldi-v5 clips/idle/00)을 머리 → 옷 두 단계로 고친 것 → 자세·크기가 쟈알디 STAND(0)과 같음.
# 그래서 좌표 공간·뼈 길이·IK·관절 보정 함수는 쟈알디 rig에서 가져오고(J.P, J.anatomic …), 자세는 전부 새로 짓는다.
# 약속(쟈알디와 같음): 오른쪽을 봄, RIGHT = 그림상 가까운 팔다리(lh·lf), LEFT = 먼 팔다리(rh·rf). 손 목표 (dx,dy) = 목 기준,
# ('r',dx,dy) = 몸통 기울기 따라 도는 목 기준, ('a',x,y) = 절대. 팔꿈치 ('e',dx,dy) 직접 지정. 옆모습 유지: 어깨 회전 s는 0~-0.25.
import math,os,sys
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0,os.path.join(HERE,'../../jyaldi-v5/scripts'))
import rig as J
P,lerp,staged,sh,jit,anatomic=J.P,J.lerp,J.staged,J.sh,J.jit,J.anatomic
KNEE_UP,KNEE_FWD,ELB_UP,ELB_OUT,ELB_DOWN=J.KNEE_UP,J.KNEE_FWD,J.ELB_UP,J.ELB_OUT,J.ELB_DOWN
X,G=J.X,J.G
cos=lambda t: math.cos(2*math.pi*t); sin=lambda t: math.sin(2*math.pi*t)
CLIPS={}
def tail(ps,loop):
    """생성기가 끝 장을 기준 그림 쪽으로 되돌리는 버릇(쟈알디 실측) → 버릴 장 1개를 덧붙임. 빌더가 뺌."""
    return ps+[ps[0] if loop else ps[-1]]
def bones(p):
    """직접 지정한 팔꿈치('e')는 뼈 길이를 안 지킴 → 어깨·손 사이 IK 두 해 중 지정한 팔꿈치에 가까운 쪽으로 다시 놓음(의도 유지, 길이 정확)."""
    q=dict(p)
    for s in ('RIGHT','LEFT'):
        sh,e,w=q[f'{s} SHOULDER'],q[f'{s} ELBOW'],q[f'{s} ARM']
        lu,lf=math.dist(sh,e),math.dist(e,w)
        if abs(lu/J.UARM-1)<.15 and abs(lf/J.FARM-1)<.15: continue
        m,wr=min((J._ik(sh,w,J.UARM,J.FARM,b) for b in (1,-1)),key=lambda r: math.dist(r[0],e))
        q[f'{s} ELBOW']=m; q[f'{s} ARM']=wr
    return q
def clip(name,action,poses,loop=None):
    if loop is not None and len(poses)<8: poses=tail(poses,loop)
    assert 3<=len(poses)<=15,(name,len(poses)); CLIPS[name]=('side view in profile facing right: '+action,'',[anatomic(bones(p)) for p in poses])

# ── 기본 자세 ──
BASE=J.STAND(0)                       # 기준 그림 자세(첫 장 관절)
HC=dict(lh=('r',-3,20),le=('e',9,17)) # 반팔짱(기본 이미지): 가까운 팔이 허리 앞을 가로질러 먼 팔 팔꿈치를 쥠, 먼 팔은 늘어뜨림
def IDLE(b=0,tilt=6,dx=0,**k):        # 기본 대기: 무게 뒷다리, 고개 살짝 숙이고 눈은 앞
    a=dict(HC,tilt=tilt); a.update(k); return P((X-1+dx,55+b),3,0,0,(X+6,G),(X-5,G),**a)
def ST(b=0,d=0,**k):                  # 전투 대기: 레슬링·유도 자세, 낮게, 두 손 펴서 가슴 앞, 턱 당김
    a=dict(lh=(20,8),rh=(15,11),tilt=6); a.update(k); return P((X+d,64+b),12,-0.2,-0.1,(X+16+d,G),(X-14+d,G),**a)
S0=ST()
LOW=lambda b=0,d=0,**k: P((X+d,80+b),18,-0.2,-0.1,(X+18+d,G),(X-18+d,G),**({**dict(lh=(18,12),rh=(14,14),tilt=4),**k}))
STAND=lambda b=0,**k: P((X,55+b),2,0,0,(X+6,G),(X-4,G),**k)

# ── 전투 ──
clip('idle','calm watchful idle, one arm across the waist holding the other elbow, weight on the rear leg, breathing',[IDLE(0),IDLE(.5),IDLE(1),IDLE(.5)])
CS=lambda u: IDLE(0,tilt=14,lh=('r',14,10-4*u),le=('e',8,16))
clip('cubespin','raises the near hand palm up in front of the chest and watches it, then closes the hand',[IDLE(0),CS(0),CS(1),CS(1),CS(0),IDLE(0)],False)
clip('scan','body still, head snaps to look sharply at something, holds, then slowly turns back',[IDLE(0),IDLE(0,tilt=-4,head=(3,-8)),IDLE(0,tilt=-4,head=(3,-8)),IDLE(0,tilt=0,head=(4,-8)),IDLE(0)],False)
clip('stance','low wrestling stance, knees bent, both open hands forward at chest height, chin tucked',[ST(0),ST(1),ST(1.5),ST(1)])
clip('engage','unfolds her arms and drops into a low wrestling stance, lead foot forward, open hands forward',[IDLE(0),lerp(IDLE(0),S0,.35),lerp(IDLE(0),S0,.7),S0],False)
def gwalk(t,lh=None,rh=None,stride=14,lift=3,bob=1.6,lean=2):
    c,s=cos(t),sin(t)
    lh=lh or (2-4*c,28); rh=rh or (-1+4*c,28)
    return P((X+2,55+bob*abs(c)),lean,0.05*c,0.15*c,(X+2+stride*c,G-lift*max(0,-s)),(X+2-stride*c,G-lift*max(0,s)),lh,rh,tilt=4,head=(5,-7) if c>-0.5 else (4,-7))
clip('walk','long flat-footed strides, whole foot plants, arms barely swing, head turning to scan',[gwalk(i/8) for i in range(8)])
def shuf(ld,rd,ll=0):
    return P((X+(ld+rd)/2,64),12,-0.2,-0.1,(X+16+ld,G-ll),(X-14+rd,G),(20,8),(15,11),tilt=6)
clip('step','wrestling shuffle: lead foot slides forward flat, rear foot slides after, feet never cross, stays low',[shuf(5,0,1),shuf(11,0,1),shuf(16,0),shuf(16,6),shuf(16,12),shuf(16,16)])
def grun(t,lh=None,rh=None):
    c,s=cos(t),sin(t)
    lh=lh or (10-5*c,16+2*c); rh=rh or (6+5*c,16-2*c)
    return P((X+8,61+2*abs(s)),20,0.1*c,0.25*c,(X+6+16*c,G-9*max(0,-s)-1),(X+6-16*c,G-9*max(0,s)-1),lh,rh,tilt=0)
clip('run','low powerful run: torso leaning forward, short driving strides, arms tight to the body, head steady',[grun(i/8) for i in range(8)])
J0=P((X,74),30,0,0,(X+12,G),(X-10,G),(-12,22),(-14,24),tilt=-4)
J1=P((X+2,50),0,0,0,(X+6,G-4),(X-2,G-3),(8,-26),(4,-24),tilt=-6)
JA=lambda tuck: P((X+2,48),2,0,0,(X+10,G-8-tuck),(X-6,G-10-tuck),(10,-14+tuck/2),(6,-12+tuck/2),lk=KNEE_UP,rk=KNEE_UP)
JL=P((X,78),28,0,0,(X+14,G),(X-14,G),(16,14),(12,16))
clip('jump','two-footed athletic jump: swings both arms back and squats, explodes up throwing the arms high, tucks, lands in a deep squat',
     [J0,J1,JA(4),JA(14),JA(6),P((X+1,60),8,0,0,(X+10,G-2),(X-8,G-2),(14,4),(10,6)),JL,S0])
clip('crouch','drops into a deep wide wrestling crouch, hips low, torso upright, open hands in front of the knees',[S0,lerp(S0,LOW(),.4),lerp(S0,LOW(),.8),LOW()])
def lowsh(t):
    c,s=cos(t),sin(t)
    return P((X+2,80+abs(s)),18,-0.2,-0.1,(X+18+5*c,G-2*max(0,-s)),(X-16+5*c,G-2*max(0,s)),(18,12),(14,14),tilt=4)
clip('crouchwalk','low crouched shuffle, feet sliding without crossing, hands open in front',[lowsh(i/8) for i in range(8)])
LM=lambda lh,lean=18,tilt=20: LOW(lh=lh,tilt=tilt) if lean==18 else P((X,80),lean,-0.2,-0.1,(X+18,G),(X-18,G),lh,(14,14),tilt=tilt)
clip('lowmark','from a low crouch she stares at the floor ahead, lifts the near hand palm up and clenches it into a fist',
     [LOW(),LM((18,26)),LM((16,16),tilt=14),LM((12,4),lean=8,tilt=10),LM((12,4),lean=8,tilt=10),LOW()],False)
# A 연계 15장: 스냅다운 5 → 지정 4 → 내려찍기 6
SN1=P((X+4,62),10,-0.2,-0.1,(X+20,G),(X-14,G),(26,-2),(15,11),tilt=4)
SN2=P((X+4,64),16,-0.2,-0.1,(X+20,G),(X-14,G),(26,2),(15,12),tilt=6)
SN3=P((X+2,72),30,-0.2,-0.1,(X+20,G),(X-18,G),(22,24),(14,16),tilt=10)
MK1=P((X,58),4,0,0,(X+14,G),(X-12,G),(12,18),'down',head=(7,-6),tilt=-2)
MK2=P((X,58),4,0,0,(X+14,G),(X-12,G),(14,16),'down',head=(7,-6),tilt=-2)
MK3=P((X,59.5),6,0,0,(X+14,G),(X-12,G),(13,17),'down',head=(7,-6),tilt=2)
SL1=P((X,56),-6,0,0,(X+12,G-2),(X-12,G-3),(10,-30),'down',tilt=-8,le=ELB_UP)
SL2=P((X+2,64),10,0,0,(X+16,G),(X-14,G),(16,-4),(4,20),tilt=0)
SL3=P((X+2,78),24,0,0,(X+20,G),(X-18,G),(14,26),(6,24),tilt=10)
clip('chain3','grappling combo: hooks the enemy neck and yanks it down, then stands, stares and clenches a fist, then lifts the fist high and yanks it down into a deep squat',
     [S0,SN1,SN2,SN3,SN3,MK1,MK2,MK3,MK3,SL1,SL1,SL2,SL3,SL3,lerp(SL3,S0,.5)])
TK0=grun(0.25)
TK1=P((X+4,76),30,-0.1,0,(X+18,G),(X-14,G),(22,18),(18,20),tilt=-4)
TK2=P((X+12,84),40,-0.1,0,(X+30,G),(X-10,G),(30,20),(26,22),tilt=-6,rk=KNEE_FWD)
TK3=P((X+20,74),34,-0.1,0,(X+34,G),(X+2,G),(22,18),(18,20))
TK4=P((X+18,58),-6,0,0,(X+28,G),(X+8,G),(16,-10),(12,-8),tilt=-6)
TK5=P((X+24,72),40,0,0,(X+38,G),(X+8,G),(30,26),(26,28),tilt=8)
clip('tackle','running double-leg takedown: drops low, drives the near knee toward the floor, wraps both arms, stands lifting, then slams forward',
     [TK0,TK1,TK2,TK3,TK4,TK5,LOW(d=24),ST(d=24)])
AS0=P((X,56),6,0,0,(X+10,G-24),(X-8,G-26),(12,0),(8,2),lk=KNEE_UP,rk=KNEE_UP)
AS1=P((X,52),0,0,0,(X+4,G-6),(X-2,G-6),(6,-20),(2,-18),tilt=14,le=ELB_UP)
AS2=P((X,54),2,0,0,(X+4,G-4),(X-2,G-4),(12,20),(8,22),tilt=16)
AS3=P((X,80),22,0,0,(X+18,G),(X-18,G),(14,24),(10,24),tilt=10)
clip('airstomp','in mid-air she tucks her knees, then drives both feet straight down while clenching her fists, lands heavily in a deep squat',[AS0,AS1,AS2,AS3,AS3,S0])
AM=lambda lh: P((X,56),8,0,0,(X+10,G-22),(X-8,G-24),lh,(8,4),tilt=20,lk=KNEE_UP,rk=KNEE_UP)
clip('airmark','in mid-air with knees tucked she looks down, half-opens the near hand downward, then clenches it',[AM((18,22)),AM((18,22)),AM((16,20)),AM((15,20))],False)
DG=lambda j=0,b=0: P((X,58+b),4,0,0,(X+12,G),(X-12,G),(14+j,16),'down',head=(7,-6),tilt=-2)
clip('designate','standing rooted, chin forward, eyes fixed ahead, near hand half open in front of the waist, very still',[DG(0),DG(.5),DG(0),DG(-.5)])
DC=P((X,59.5),5,0,0,(X+12,G),(X-12,G),(13,17),'down',head=(7,-6),tilt=2)
clip('clench','standing rooted, she clenches the near hand into a hard fist, shoulders drop slightly',[DG(0),DC,DC,lerp(DC,DG(0),.5)],False)
HO=lambda y,lean=-2: P((X,58),lean,0,0,(X+12,G),(X-12,G),(16+abs(y)/6,y),(4,20),tilt=-2,head=(7,-6))
clip('hold','slowly lifts the near hand palm up from waist to shoulder height, as if raising something heavy',[DG(0),HO(26),HO(16),HO(6),HO(-2,-4),HO(-4,-4)],False)
HL=lambda j: P((X,58),-4,0,0,(X+12,G),(X-12,G),(26+j,-2-j),(4,20),tilt=-2,head=(7,-6))
clip('holdloop','near arm held out at shoulder height with a clenched trembling fist, far hand fisted at the waist',[HL(0),HL(1),HL(0),HL(-1)])
FL1=P((X-2,58),-8,0,0,(X+12,G),(X-12,G),(-4,-8),(4,20),tilt=-4,le=ELB_UP)
FL2=P((X+4,62),14,-0.2,-0.1,(X+18,G),(X-12,G),(26,10),(4,20),tilt=4)
FL3=P((X+6,64),20,-0.2,-0.1,(X+20,G),(X-12,G),(18,26),(4,20),tilt=8)
clip('fling','pulls the raised fist back over the shoulder, then whips the arm forward and down, opening the hand, body following',[HL(0),FL1,FL2,FL3,lerp(FL3,S0,.5),S0],False)
PA1=ST(lh=(6,0),head=(7,-6),tilt=-2)
PA2=ST(lh=(26,-2),head=(7,-6),tilt=-2)
clip('parry','sharp glance forward and a quick backhand flick of the near hand outward, body stays low and still',[S0,PA1,PA2,PA2,S0],False)
PF=lambda d,lean: P((X-d,64),lean,-0.2,-0.1,(X+16-d,G),(X-14-d,G),(8,2),(6,4),tilt=14)
clip('parryfail','rolls the near shoulder in and tucks the chin, absorbing a hit, pushed back half a step',[S0,PF(0,18),PF(5,10),PF(3,14)],False)
KL1=P((X,80),24,0,0,(X+16,G),(X-16,G),(-6,22),(-8,24),tilt=0)
KL2=P((X+16,66),40,0,0,(X+28,G-18),(X-12,G-12),(26,10),(22,12),rk=KNEE_FWD)
KL3=P((X+26,64),46,0,0,(X+40,G-14),(X+2,G-10),(28,12),(24,14))
KL4=P((X+32,76),20,0,0,(X+42,G),(X+8,G-2),(18,12),(14,14))
clip('tkleap','squats deep then springs low and flat forward with feet off the floor, lands on one foot sliding into a low stance',[S0,KL1,KL2,KL3,KL4,ST(d=34)],False)
GR=P((X+6,62),10,-0.2,-0.1,(X+22,G),(X-12,G),(26,2),(24,14),tilt=4)
clip('grab','reaches with both hands to grip an enemy collar and sleeve, elbows down, low stance',[S0,staged(S0,GR,.5),GR,GR],False)
RE1=P((X+4,60),-6,-0.1,0,(X+26,G),(X-12,G),(16,4),(14,12),tilt=0)
RE2=P((X+8,60),24,-0.1,0,(X+26,G),(X+30,G-30),(22,10),(18,14),tilt=6,rk=KNEE_FWD)
RE3=P((X+10,64),50,-0.1,0,(X+26,G),(X-12,G-34),(30,26),(26,28),tilt=12)
RE4=P((X+10,68),45,-0.1,0,(X+26,G),(X-10,G-6),(28,34),(24,34),tilt=14)
clip('grabreap','judo outer reap: pulls the enemy, steps beside, swings the far leg high forward, sweeps it back hard while driving the torso down',
     [GR,RE1,RE2,RE3,RE4,RE4,lerp(RE4,S0,.5),S0])
CR=lambda g,b=0,lean=6,tilt=4: P((X-6,62+b),lean,0,0,(X+10,G),(X-18,G),('r',18,4+g),('r',18,16-g),tilt=tilt,le=('e',10,14),re=('e',8,16))
clip('grabcrush','lets go, steps back, holds both open hands apart in front, slowly closes them, then snaps them shut into fists',
     [GR,CR(0),CR(2),CR(4),CR(6,1,8,6),CR(6,1,8,6),lerp(CR(6,1,8,6),S0,.5),S0])
UP=lambda y1,y2,tilt=0,b=0: P((X,66+b),2,0,0,(X+16,G),(X-16,G),(14,y1),(10,y2),tilt=tilt,le=ELB_UP if y1<0 else ELB_DOWN,re=ELB_UP if y2<0 else ELB_DOWN)
SU7=P((X,80),20,0,0,(X+18,G),(X-18,G),(14,26),(10,26),tilt=10)
clip('super','wide stance, raises both arms slowly from low palms up to high overhead, clenches both fists high, then yanks them down into a deep squat',
     [S0,UP(22,24),UP(8,10,-6),UP(-8,-6,-10),UP(-28,-26,-16),UP(-28,-26,-16),UP(0,2,-4),SU7,SU7,S0])
C2=lambda lh,tilt,head=(7,-6): P((X,58),4,0,0,(X+12,G),(X-12,G),lh,'down',head=head,tilt=tilt)
clip('chain2','head snaps to a low near spot and clenches the fist, then snaps to a far high spot and clenches again',
     [S0,C2((16,18),14),C2((15,19),16),C2((16,14),-8,(8,-7)),C2((15,15),-6,(8,-7)),C2((15,15),-6,(8,-7)),lerp(C2((15,15),-6),S0,.5),S0])
WB=lambda t: gwalk(t,rh=('r',-20,18))
clip('support','walks in without looking, flicks two fingers of the far hand backward, stops, stares ahead and clenches a fist, walks on',
     [gwalk(0),gwalk(.25),WB(.5),WB(.75),DG(0),DC,DC,gwalk(0),gwalk(.25),gwalk(.5)])
FO=lambda b,j=0: P((X,55+b),2,0,0,(X+6,G),(X-5,G),('r',10+j,14),'down',tilt=10,le=('e',7,16))
clip('focus','standing still, near hand at the chest, thumb turning something small, slow deep breaths, eyes half closed',[FO(0),FO(.8,1),FO(1.5),FO(.8,-1),FO(0),FO(.8,1)])
clip('tkswing','sweeps the open near arm in a big diagonal arc like conducting, from high back to low forward, hand never closes',
     [S0,ST(lh=(6,-24),le=ELB_UP,tilt=-4),ST(lh=(26,0)),ST(lh=(24,24),d=2,tilt=8),ST(lh=(16,28),d=2,tilt=10),S0],False)
GU=lambda lh,lean=-4: P((X-1,57),lean,0,0,(X+10,G),(X-8,G),lh,'down',head=(4,-7),tilt=-4)
clip('gunclench','reluctant stance, head turned slightly away, near hand clenches into a fist with a small flinch',[GU((18,12)),GU((17,13),-8),GU((17,13),-6),GU((18,12))],False)
PK=lambda lh,tilt=10: P((X,55),4,0,0,(X+6,G),(X-4,G),lh,'down',tilt=tilt)
clip('pickup','without bending, reaches the near hand down open, beckons with the fingers, then turns the palm up to catch',[IDLE(0),PK((16,26),14),PK((15,24),14),PK(('r',14,16),8),PK(('r',10,18),4)],False)
clip('toss','small flick of the near wrist forward, almost no body motion',[PK(('r',10,18),4),PK(('r',8,14),2),PK((22,10),0),PK((20,14),2),IDLE(0)],False)
clip('drink','arms stay folded at the waist, only the head tips back for a sip, then levels',[IDLE(0),IDLE(0,tilt=-6),IDLE(0,tilt=-16),IDLE(0,tilt=-16),IDLE(0,tilt=0)],False)
EA=lambda m: P((X,55),4,0,0,(X+6,G),(X-4,G),('r',6,-1) if m else ('r',10,12),'down',head=(4,-7),tilt=4,le=('e',10,6) if m else ('e',6,16))
clip('eat','three quick bites, near hand to mouth and down, eyes glancing aside',[EA(0),EA(1),EA(0),EA(1),EA(0),EA(1)])
BA=lambda a: P((X,55),6,0,0,(X+6,G),(X-4,G),('r',18+4*math.cos(a),8+4*math.sin(a)),('r',16,14),tilt=14,le=('e',10,12),re=('e',6,16))
clip('bandage','holds the far forearm out in front, near index finger circling around it',[BA(0),BA(1.6),BA(3.1),BA(4.7),BA(6.2),BA(7.8)])
HT=P((X-3,64),-8,-0.2,-0.1,(X+16,G),(X-14,G),(16,6),(12,10),head=(7,-6),tilt=8)
clip('hit','upper body knocked back but head and eyes stay locked forward, feet planted',[S0,HT,lerp(HT,S0,.5),S0],False)
D1=P((X-4,62),-25,0,0,(X+12,G),(X-14,G-2),(10,-8),(-2,-6),tilt=10)
D2=P((X-12,64),-58,0,0,(X+12,G-14),(X+2,G-12),(6,-16),(-2,-14),tilt=16)
D3=sh(P((X-18,84),-80,0,0,(X+16,G-30),(X+8,G-24),(4,-22),(-4,-18),lk=KNEE_UP,rk=KNEE_UP,tilt=20),8)
D4=sh(P((X-14,94),-90,0,0,(X+20,G-14),(X+14,G-10),('a',X-20,G),('a',X-22,G),lk=KNEE_UP,rk=KNEE_UP,tilt=22),14)
D5=sh(P((X-14,94),-90,0,0,(X+24,G-8),(X+18,G-6),('a',X-18,G),('a',X-20,G),lk=KNEE_UP,rk=KNEE_UP,tilt=18),14)
clip('down','thrown backward through the air, lands on her back with chin tucked and both arms slapping the floor in a breakfall',[D1,D2,D3,D4,D5,D5,D5,D5])
GU1=sh(P((X-12,92),-50,0,0,(X+16,G),(X+10,G),(10,14),('a',X-30,G),lk=KNEE_UP,rk=KNEE_UP,tilt=6),14)
GU2=sh(P((X-10,82),-30,0,0,(X+10,G),(X-6,G-6),(12,10),('a',X-30,G),lk=KNEE_UP,tilt=4),14)
GU3=sh(P((X-8,80),-10,0,0,(X+10,G),(X-28,G),(14,8),('a',X-28,G)),14)
GU4=sh(P((X-2,74),20,0,0,(X+14,G),(X-20,G),(18,10),(14,12)),14)
clip('getup','technical stand-up: sits up posting one hand behind, plants a foot, lifts the hips, swings the leg back under, rises facing forward',
     [D5,GU1,GU2,GU3,GU4,ST(d=12,b=4),ST(d=14),ST(d=14)])
clip('talk','barely moves while talking, arms folded at the waist, tiny head movement',[IDLE(0),IDLE(0,tilt=4),IDLE(0),IDLE(0,tilt=7)])
TI=lambda b: P((X,55+b),1,0,0,(X+8,G),(X-6,G),(3,27),(-1,27),tilt=-2)
clip('tired','standing upright breathing hard through the shoulders, head up, eyes forward',[TI(0),TI(1.5),TI(2.5),TI(1.5)])

# ── 몸만 기본 클립 ──
SU=lambda h,f1,f2,lh='down',lean=4,**k: P(h,lean,0,0,f1,f2,lh,'down',**k)
clip('stepup','takes one big stride up onto a higher level without using the hands, rear foot joins',
     [STAND(0),SU((X+2,54),(X+16,G-30),(X-4,G),lk=KNEE_UP),SU((X+8,50),(X+22,G-18),(X-4,G),lean=10),SU((X+16,42),(X+22,G-18),(X+2,G-6),lean=8),
      SU((X+20,38),(X+22,G-18),(X+20,G-34),lean=4,rk=KNEE_UP),SU((X+22,37),(X+28,G-18),(X+18,G-18)),SU((X+22,37),(X+28,G-18),(X+18,G-18))])
clip('stepover','hurdles a knee-high edge: lead leg kicks high and straight over, then the trail leg swings over with the knee out',
     [STAND(0),SU((X+4,54),(X+30,G-30),(X-4,G),lean=14),SU((X+18,54),(X+34,G),(X+2,G-4),lean=8),SU((X+24,54),(X+34,G),(X+16,G-28),lean=4,rk=KNEE_UP),
      SU((X+28,55),(X+34,G),(X+24,G)),SU((X+28,55),(X+34,G),(X+24,G))])
LIE=lambda lean,b=0,**k: P((X-6,74+b),lean,0,0,(X+39,75),(X+38,76),**({**dict(lh=('r',6,18),rh=('r',4,20),le=('e',2,12),re=('e',0,12)),**k}))
SIT_LS=dict(lh=('r',14,26),rh=('r',12,28),le=('e',4,16),re=('e',2,16))
clip('liesit','lying flat on her back, sits up in one quick motion with legs straight, then looks around warily',
     [LIE(-90),LIE(-40,**SIT_LS),LIE(-4,**SIT_LS),LIE(-4,head=(4,-7),**SIT_LS),LIE(-4,head=(6,-7),**SIT_LS),LIE(-4,**SIT_LS)],False)
HW=lambda a,tilt=8,head=(5,-7): P((X,55),8,0,0,(X+6,G),(X-4,G),('r',16+a,20),('r',14-a,21),le=('e',8,15),re=('e',6,16),tilt=tilt,head=head)
clip('handswork','standing, both hands working briefly together at waist height in front, glancing up and aside',[HW(0),HW(1),HW(-1),HW(0,-2,(4,-7)),HW(1)],True)
HH=lambda a: P((X,55),4,0,0,(X+6,G),(X-4,G),('r',4+a,-12),('r',2-a,-11),le=('e',12,-4),re=('e',10,-3),tilt=10)
clip('handshead','both hands on top of the head, briskly rubbing short hair, elbows forward',[HH(0),HH(2),HH(-2),HH(2),HH(-2),HH(0)])
SIT=lambda lean=8,tilt=0,b=0,**k: P((X-6,77+b),lean,0,0,(X+16,G),(X+12,G),tilt=tilt,lk=KNEE_UP,rk=KNEE_UP,**({**dict(lh=('r',14,20),rh=('r',12,22),le=('e',5,16),re=('e',3,16)),**k}))
SM=lambda m: SIT(10,2,head=(4,-7),lh=('r',6,-1) if m else ('r',12,16),le=('e',10,6) if m else ('e',6,15))
clip('seatmouth','seated leaning forward, eats fast: near hand rises to the mouth and back, eyes glancing aside',[SM(0),SM(1),SM(0),SM(1),SM(0)],True)
SHd=lambda tilt: SIT(10,tilt,lh=('r',16,18),rh=('r',14,19),le=('e',7,15),re=('e',5,16))
clip('seathold','seated, both hands low together in front, eyes down at the hands, glancing up now and then',[SHd(18),SHd(18),SHd(4),SHd(18),SHd(18)],True)
HLk=lambda tilt: P((X,55),4,0,0,(X+6,G),(X-4,G),('r',14,18),('r',12,19),le=('e',7,15),re=('e',5,16),tilt=tilt)
clip('holdlook','standing, both hands low together in front, eyes down at the hands, glancing up now and then',[HLk(18),HLk(18),HLk(4),HLk(18),HLk(18)],True)
HE=lambda t: P((X,55),2,0,0,(X+6,G),(X-4,G),('r',-1,-8),'down',tilt=t,le=('e',11,5))
clip('handear','standing, near hand held to the ear, elbow forward, almost no movement',[HE(4),HE(5),HE(4),HE(3),HE(4)],True)
SW=lambda t: P((X+4*t,60),10+8*t,0,0,(X+16,G),(X-16,G),(18+10*t,18+4*t),(6+10*t,6+4*t),tilt=8,le=('e',8+6*t,14),re=('e',2+6*t,10))
clip('sweep','wide stance, both fists one above the other on a diagonal line, short strong pushes forward and pulls back',[SW(0),SW(.5),SW(1),SW(1),SW(.5),SW(0),SW(-.3)])
LH=lambda j=0: LIE(-90,lh=('r',16,-2+j),rh=('r',2,-8),le=('e',10,6),re=('e',8,-6))
clip('liehold','lying on her back, near hand raised above the face looking at it, far hand behind the head',[LH(0),LH(.5),LH(0),LH(-.5),LH(0)],True)
C2H=dict(lh=('r',18,6),le=('e',9,14))
clip('carry2_idle','standing, near hand raised forward at chest height palm up as if guiding something floating, far arm down',[STAND(b,**C2H) for b in (0,.5,1,.5)])
clip('carry2_walk','walking, near hand raised forward at chest height palm up as if guiding something floating',[gwalk(i/8,lh=('r',18,6)) for i in range(8)])
clip('carry2_run','running, near hand raised forward at chest height palm up as if guiding something floating',[grun(i/8,lh=('r',18,6)) for i in range(8)])
C1H=dict(lh=('r',4,26),le=('e',2,15))
clip('carry1_idle','standing, near hand closed in a loose fist hanging at her side, other arm relaxed',[STAND(b,**C1H) for b in (0,.5,1,.5)])
clip('carry1_walk','walking, near hand closed in a loose fist hanging still at her side, other arm swinging a little',[gwalk(i/8,lh=('r',4,26)) for i in range(8)])
clip('carry1_run','running, near hand closed in a loose fist held low at her side',[grun(i/8,lh=('r',4,22)) for i in range(8)])

# ── 지형·탐사 ──
clip('turn','quick pivot: head turns first toward the viewer, body follows to face the viewer',[STAND(0),STAND(0,head=(2,-7)),P((X,55),2,-1.2,-0.8,(X+4,G),(X-4,G),'down','down',head=(0,-7))])
FA=lambda j: P((X,56),6,0,0,(X+8,G-16+j),(X-6,G-18+j),('r',10,10),('r',8,12),tilt=12,lk=KNEE_UP,rk=KNEE_UP,le=('e',6,14),re=('e',4,14))
clip('fall','falling, body compact, knees bent, fists close to the chest, eyes down',[FA(0),FA(1),FA(0)])
LD1=P((X+10,74),70,0,0,(X+14,G),(X-8,G-6),('a',X+30,G),('a',X+26,G),tilt=20)
LD2=P((X+20,82),100,0,0,(X+20,G-26),(X+14,G-24),('a',X+36,G-6),('a',X+32,G-6),lk=KNEE_UP,rk=KNEE_UP,tilt=30)
LD3=P((X+30,88),-20,0,0,(X+46,G),(X+40,G),(14,16),(10,18),lk=KNEE_UP,rk=KNEE_UP)
LD4=P((X+34,74),10,0,0,(X+48,G),(X+20,G),(16,12),(12,14))
clip('land','lands from a height and immediately rolls diagonally over the shoulder, comes up on one knee, rises',[LOW(),LD1,LD2,LD3,LD4,ST(d=36)],False)
def lad(t):
    c=cos(t)
    return P((X+2,58),2,0,0,(X+14,90-10*c),(X+12,90+10*c-8),('a',X+18,10+10*c),('a',X+18,20-10*c),lk=KNEE_UP,rk=KNEE_UP,le=ELB_OUT,re=ELB_OUT)
clip('ladder','climbing motion, quick big reaches, hands and feet alternating as if on rungs, nothing drawn',[lad(i/8) for i in range(8)])
MT1=P((X+2,64),20,0,0,(X+10,G),(X-6,G),('a',X+18,60),('a',X+16,60),tilt=-6)
MT2=P((X+8,46),10,0,0,(X+8,82),(X+2,84),('a',X+18,60),('a',X+16,60))
MT3=P((X+14,38),14,0,0,(X+12,74),(X+8,76),('a',X+18,60),('a',X+16,60),le=ELB_OUT,re=ELB_OUT)
MT4=P((X+18,28),18,0,0,(X+26,60),(X+8,70),('a',X+22,58),('a',X+20,58),lk=KNEE_UP)
clip('mantle','muscle-up onto a waist-high ledge: plants both hands, jumps and presses up on straight arms, steps a foot up, stands on top',
     [STAND(0),MT1,MT2,MT3,MT4,P((X+22,15),2,0,0,(X+28,60),(X+18,60))],False)
VA1=P((X+14,52),40,0,0,(X+10,G-30),(X+2,G-28),('a',X+18,62),(16,16),lk=KNEE_UP,rk=KNEE_UP)
VA2=P((X+22,48),30,0,0,(X+42,G-34),(X+38,G-38),('a',X+20,62),(20,10))
VA3=P((X+44,64),12,0,0,(X+52,G),(X+36,G-4),(16,14),(12,16))
clip('vault','speed vault: one hand planted, both legs swing up and over to the side, lands running',[grun(.25),VA1,VA2,VA3,sh(grun(.75),44)],False)
def acrawl(t):
    c=cos(t); s=sin(t)
    return P((X+4,92),84,0,0,(X-34+8*max(0,c),G-1),(X-34+8*max(0,-c),G),('a',X+40+5*c,G-1),('a',X+34-5*c,G-1),head=(6,-5),tilt=-34,lk=KNEE_UP,rk=KNEE_UP)
clip('crawl','low army crawl flat on the belly, pulling forward on the forearms, knees drawing up in turn',[acrawl(i/8) for i in range(8)])
def snk(t):
    c,s=cos(t),sin(t)
    return P((X+2,64+abs(s)),10,0,0,(X+2+9*c,G-3*max(0,-s)),(X+2-9*c,G-3*max(0,s)),(10,22),(6,24),tilt=0,head=(5,-7) if c>0 else (4,-7))
clip('sneak','low quiet stalking walk, knees bent, rolling each foot down slowly, hands low and loose, head scanning',[snk(i/8) for i in range(8)])
HD=lambda b=0: P((X-4,80+b),30,0,0,(X+14,G),(X-14,G-1),('a',X+20,G),(14,16),head=(7,-5),tilt=-10,lk=KNEE_UP)
clip('hide','drops low onto one knee, one hand on the floor, ready to spring, eyes fixed ahead',[IDLE(0),lerp(IDLE(0),HD(),.5),HD(0),HD(.5),HD(0)],False)
DO=lambda lh,tilt=6: P((X,55),3,0,0,(X+6,G),(X-4,G),lh,'down',tilt=tilt)
clip('door','stops, looks at something ahead, small flick of the near fingers without touching, then walks on',[gwalk(.75),DO((14,12)),DO((20,6)),DO((20,4),2),gwalk(.25),gwalk(.5)],False)
DCF=lambda t,r: gwalk(t,rh=('r',-12-10*r,18))
clip('doorclose','walking forward without looking back, the far hand flicks backward behind her',[gwalk(0),DCF(.125,0),DCF(.25,1),gwalk(.375),gwalk(.5)],False)
KN=lambda x: P((X-2,55),-3,0,0,(X+6,G),(X-6,G),(x,-4),'down',tilt=0,le=('e',10,6))
clip('knock','standing slightly back, near hand raised, raps twice with the back of the knuckles',[STAND(0),KN(20),KN(25),KN(21),KN(25),KN(21)],False)
def pushc(t):
    c,s=cos(t),sin(t)
    return P((X+4,64),30,0,0,(X+10+10*c,G-3*max(0,-s)),(X+10-10*c,G-3*max(0,s)),('r',12,8),('r',10,10),le=('e',4,14),re=('e',2,14),tilt=-4)
clip('push','shoulder pressed forward against something heavy, arms tucked, legs driving step by step',[pushc(i/8) for i in range(8)])
SQ=lambda lh=('r',14,24),tilt=20: P((X,86),24,0,0,(X+12,G),(X-6,G),lh,('r',12,26),tilt=tilt,lk=KNEE_UP,rk=KNEE_UP,le=('e',6,18),re=('e',4,18))
clip('inspect','squats down and studies the floor ahead without touching, small flick of the near fingers, keeps squatting',[STAND(0),SQ(),SQ(tilt=26),SQ(('r',24,26),26),SQ(('r',22,24),26),SQ()],False)
def lead(t):
    c,s=cos(t),sin(t)
    return P((X+2,55+1.4*abs(c)),4,0,0,(X+2+13*c,G-3*max(0,-s)),(X+2-13*c,G-3*max(0,s)),('r',-18,26),'down',le=('e',-6,16),tilt=2)
clip('leadhand','walking forward, near arm held low and back behind her, palm open as if shielding someone following',[lead(i/8) for i in range(8)])
BW=P((X-1,55),12,0,0,(X+6,G),(X-4,G),'down','down',head=(6,-6),tilt=2)
clip('bow','a short stiff nod-bow, eyes staying on the other person, then straightens',[STAND(0),BW,BW,lerp(BW,STAND(0),.5),STAND(0)],False)
EW=lambda b: IDLE(b,tilt=2,dx=-2)
clip('elevwait','standing back against a wall, arm across the waist, still, watching ahead',[EW(0),EW(.5),EW(1),EW(.5)])
FS=lambda b=0: P((X-10,96),-8+b,0,0,(X+10,G),(X+24,G),('a',X+8,78+b),('r',2,24),tilt=0,lk=KNEE_UP,rk=KNEE_FWD)
FSQ=P((X-4,84),20,0,0,(X+12,G),(X+2,G),(14,18),(10,20),lk=KNEE_UP,rk=KNEE_UP)
clip('floorsit','sits down on the floor with her back to a wall, near knee up, far leg out, arm resting on the knee',[STAND(0),lerp(STAND(0),FSQ,.5),FSQ,lerp(FSQ,FS(),.5),FS()],False)
clip('floorrest','sitting on the floor against a wall, near knee up with the arm draped over it, far leg out, calm breathing',[FS(0),FS(1),FS(2),FS(1)])

# ── 상태·결과 ──
HU=lambda b: P((X,62+b),10,0,0,(X+14,G),(X-12,G),('r',2,22),(15,11),tilt=0,le=('e',4,15))
clip('hurtidle','injured but low and ready, near hand pressed to her side, eyes forward, heavy breathing',[HU(0),HU(1),HU(2),HU(1)])
def limpc(t):
    c,s=cos(t),sin(t)
    return P((X+2,57+4*max(0,-c)),4,0,0,(X+2+11*c,G-4*max(0,-s)),(X+2-7*c,G),('r',2,22),'down',tilt=0,le=('e',4,15),rk=KNEE_UP)
clip('limp','limping walk, stiff rear leg dragging, upper body kept upright, hand pressed to her side',[limpc(i/8) for i in range(8)])
FE=lambda j,hd: P((X,58),4,0,0,(X+8,G),(X-6,G),('r',10+j,8),('r',8-j,10),le=('e',6,16),re=('e',4,16),head=hd,tilt=4)
clip('fear','frozen stiff, both fists trembling in front of the chest, eyes darting',[FE(0,(5,-7)),FE(1,(6,-7)),FE(0,(4,-7)),FE(-1,(6,-7))])
NA=lambda tilt,b=0: P((X,56+b),6,0,0,(X+6,G),(X-4,G),('r',7,-2),'down',tilt=tilt,le=('e',10,8))
clip('nausea','presses the back of the near hand to her mouth, swallows hard, stays standing',[IDLE(0),NA(10),NA(14,1),NA(4),NA(-2),NA(6)],False)
KNL=P((X,78),12,0,0,(X+14,G),(X-18,G),('a',X+16,78),'down',tilt=14,lk=KNEE_UP)
KNS=P((X-4,84),-10,0,0,(X+16,G),(X-16,G),('r',8,26),'down',tilt=20,lk=KNEE_UP)
clip('collapse','drops to one knee, tries to push up from the knee, fails, sags back and falls onto her back',
     [S0,HT,KNL,sh(KNL,0,-3),KNS,P((X-12,92),-60,0,0,(X+16,G),(X+10,G-2),('a',X-24,G),'down',lk=KNEE_UP,rk=KNEE_UP,tilt=10),LIE(-90,8),LIE(-90,8)])
BL=lambda b=0: LIE(-90,lh=('r',3,18+b),rh=('r',-2,24),le=('e',-2,10),re=('e',-4,12))
clip('bedlie','lying on her back, near hand resting on the stomach, shallow breathing',[BL(0),BL(.5),BL(1),BL(.5)],True)
VI=lambda lh,tilt=4,b=0: P((X,55+b),2,0,0,(X+6,G),(X-4,G),lh,'down',tilt=tilt)
clip('victory','straightens up, slowly opens a clenched fist, one long exhale, a small nod',[S0,VI((6,22)),VI((7,20)),VI((7,20),6,1),VI((5,24),14,1),VI((5,24),4),STAND(0,tilt=4)])

# ── 본부 ──
SE=lambda b=0,lean=14,**k: P((X-2,77+b),lean,0,0,(X+18,G),(X+14,G),lk=KNEE_UP,rk=KNEE_UP,**({**dict(lh=('r',18,22),rh=('r',16,23),le=('e',10,16),re=('e',8,16),tilt=0),**k}))
clip('chairsit','sits down on the front edge of a seat with nothing under her, leaning forward, forearms on the thighs',[STAND(0),lerp(STAND(0),SE(),.5),SE(),SE(.5)],False)
TY=lambda r: SE(0,22,lh=('r',22,14-3*r),rh=('r',19,15-3*(1-r)),le=('e',10,14),re=('e',8,15),tilt=18)
clip('typing','seated hunched forward with nothing in front, pecking with two index fingers one at a time, peering down',[TY(0),TY(1),TY(0),TY(1),TY(0),TY(1)])
GC1=P((X,55),8,0,0,(X+6,G),(X-4,G),('r',6,26),('r',4,26),tilt=20,le=('e',3,14),re=('e',1,14))
GC2=P((X,86),40,0,0,(X+12,G),(X-6,G),('a',X+12,G-6),('a',X+10,G-4),tilt=20,lk=KNEE_UP,rk=KNEE_UP)
clip('gearcheck','checks a small pouch at her waist, then squats to tighten a shoelace',[STAND(0),GC1,sh(GC1,0,.5),GC2,sh(GC2,1,0),STAND(0)],False)
SV=lambda a: P((X,55),4,0,0,(X+6,G),(X-4,G),('r',8+a,14-a),('r',14,16),le=('e',6,16),re=('e',6,18),tilt=16)
clip('sleeves','folds and rolls the far shirt sleeve up past the elbow with the near hand, looking down',[STAND(0),SV(0),SV(2),SV(0),SV(2),SV(1)],False)
SR=lambda b=0: P((X-6,77+b),-6,0,0,(X+14,78),(X+12,G),('r',14,10),('r',10,22),tilt=8,lk=KNEE_UP,rk=KNEE_UP,le=('e',6,16),re=('e',4,16))
clip('seatrest','seated leaning back, near ankle crossed on the far knee, near hand palm up in front of the chest',[SR(0),SR(.5),SR(1),SR(.5)])
SITH=lambda tilt,b=0: SIT(0,tilt,b,**HC)
clip('seatthink','seated upright, arm across the waist, eyes half closed, listening',[SITH(4),SITH(4,.5),SITH(4,1),SITH(4,.5)])
clip('doze','seated with arms folded at the waist, head slowly drops, then the eyes snap open without the body moving',[SITH(4),SITH(16),SITH(24),SITH(2)])
YA=lambda t: P((X,55),0,0,0,(X+6,G),(X-4,G),('r',8,-2),'down',tilt=t,le=('e',12,6))
clip('yawn','short yawn covered with the back of the near wrist, head tipped back',[IDLE(0),YA(-8),YA(-14),YA(0)],False)
CB=lambda j=0: P((X,55),2,0,0,(X+6,G),(X-4,G),('r',-8+j,8),('r',6,8),le=('e',4,8),re=('e',8,14),tilt=0)
clip('stretch','athlete warm-up: rolls the neck, then pulls the near arm straight across the chest with the far hand',
     [STAND(0),STAND(0,tilt=14),STAND(0,tilt=-12,head=(4,-8)),STAND(0),CB(0),CB(-2),CB(0),STAND(0)])
HF=lambda a: P((X,55),2,0,0,(X+6,G),(X-4,G),('r',4+a,-12),'down',le=('e',12,-4),tilt=4)
clip('hairflip','near hand ruffles the short bob once on top of the head, quick shake',[STAND(0),HF(0),HF(3),HF(-2),STAND(0)],False)
BT=lambda a: P((X,55),4,0,0,(X+6,G),(X-4,G),('r',8,0+a),'down',le=('e',12,8),tilt=4)
clip('brushteeth','quick short brushing with the near fist at the mouth, other arm down',[BT(0),BT(1.5),BT(0),BT(1.5)])

# ── 사교·감정 ──
clip('gesture','talking with no hand gestures, arm across the waist, small chin movements',[IDLE(0),IDLE(0,tilt=0,head=(7,-7)),IDLE(0),IDLE(0,tilt=2,head=(6,-7))])
clip('armscross','standing with one arm across the waist holding the other elbow, listening',[IDLE(0,tilt=2),IDLE(.5,tilt=2),IDLE(1,tilt=2),IDLE(.5,tilt=2)])
clip('nod','one very small nod',[IDLE(0,tilt=2),IDLE(0,tilt=10),IDLE(0,tilt=2),IDLE(0,tilt=2)])
clip('headshake','one very small head shake, body still',[IDLE(0,tilt=2),IDLE(0,tilt=2,head=(4,-7)),IDLE(0,tilt=2,head=(6,-7)),IDLE(0,tilt=2)])
WV=P((X,55),2,0,0,(X+6,G),(X-4,G),('r',10,0),'down',le=('e',8,14))
clip('wave','lifts the near hand to shoulder height with two fingers up for a moment, then lowers it',[STAND(0),WV,WV,lerp(WV,STAND(0),.5),STAND(0)],False)
HS=lambda j: P((X+4,56),6,0,0,(X+12,G),(X-2,G),(26,14+j),'down',tilt=0)
clip('handshake','steps in, firm short handshake with the near hand, eyes level, steps back',[STAND(0),HS(0),HS(1),HS(-1),HS(0),STAND(0)],False)
PT=lambda y: P((X+2,55),4,0,0,(X+8,G),(X-4,G),(26,y),'down',tilt=2)
clip('pat','one stiff awkward pat on a shoulder in front of her, quickly withdrawn',[STAND(0),PT(-2),PT(3),PT(-1),STAND(0)],False)
clip('point','instead of pointing, a short jut of the chin forward, arm stays across the waist',[IDLE(0),IDLE(0,tilt=-6,head=(8,-6)),IDLE(0,tilt=-6,head=(8,-6)),IDLE(0)],False)
SHG=lambda u: jit(STAND(0),0,-3*u,['RIGHT SHOULDER','RIGHT ELBOW','RIGHT ARM'])
clip('shrug','raises only the near shoulder once, then drops it',[STAND(0),SHG(1),SHG(1),STAND(0)],False)
HG=lambda j: jit(P((X+6,56),6,0,0,(X+14,G),(X,G),('r',24,6),('r',22,8),head=(7,-5),tilt=20,le=('e',14,10),re=('e',12,12)),0,j,['NECK','SHOULDER','NOSE','EYE','EAR'])
clip('hug','steps in and hugs someone tightly with both arms, face pressed into their shoulder, shoulders shaking',[STAND(0),lerp(STAND(0),HG(0),.5),HG(0),HG(1),HG(0),HG(1)])
LA=lambda j: jit(IDLE(0,tilt=4,head=(4,-7)),0,j,['NECK','SHOULDER','NOSE','EYE','EAR'])
clip('laugh','one short laugh through the nose, head turning aside, shoulders bob once',[IDLE(0),LA(0),LA(-1),LA(0),IDLE(0)],False)
GL=lambda u: P((X,55),2,0,0,(X+6,G),(X-4,G),('r',10,14-3*u),'down',le=('e',6,16),tilt=6)
clip('glad','near hand at the chest, thumb flicks something small upward once',[GL(0),GL(1),GL(0),GL(0)],False)
CY=lambda j: jit(P((X,56),4,0,0,(X+6,G),(X-4,G),(3,26),(-1,26),head=(3,-7),tilt=12),0,j,['RIGHT ARM','LEFT ARM'])
clip('cry','silent crying with jaw clenched, head turned away and down, fists trembling at her sides',[IDLE(0),CY(0),CY(1),CY(0),CY(1),CY(0)])
WC=lambda b: P((X-6,57+b),-10,0,0,(X+8,G),(X-6,G),('r',8,-8),'down',tilt=-16,le=('e',14,0))
clip('wallcry','back against a wall, head tipped back, back of the near hand pressed over the eyes',[WC(0),WC(1),WC(0),WC(1)])
KC=lambda j: P((X,80),30,0,0,(X+14,G),(X-18,G),('a',X+18,G),('a',X+14,G),tilt=24+j,lk=KNEE_UP)
clip('kneelcry','down on one knee, head bowed low, both fists pressed to the floor, shoulders shaking',[KC(0),KC(2),KC(0),KC(2)])
SA=lambda b: P((X,56+b),3,0,0,(X+6,G),(X-4,G),(3,28),(-1,28),tilt=18)
clip('sad','shoulders sink, eyes on the floor, arms hanging limp',[SA(0),SA(.5),SA(1),SA(.5)])
clip('glare','head lowered with eyes looking up hard, arm tight across the waist, completely still',[IDLE(0,tilt=14),IDLE(0,tilt=14),IDLE(.2,tilt=14),IDLE(0,tilt=14)])
DS=lambda j: P((X+2,57),10,0,0,(X+8,G),(X-4,G),('r',18,24),'down',tilt=10,le=('e',8,16))
clip('deskslam','near fist resting low in front of her slowly tightens, body tense, no slam',[STAND(0),DS(0),DS(0),DS(1),DS(0)],False)
clip('surprise','instead of flinching back she drops instantly into a low stance and snaps her head forward',[IDLE(0),ST(lh=(16,10),rh=(12,12),head=(7,-6)),ST(head=(7,-6)),ST(head=(7,-6),b=.5)],False)
SF1=P((X-8,80),10,0,0,(X+8,G),(X-10,G),(14,10),(10,12),lk=KNEE_UP,rk=KNEE_UP)
SF2=P((X-16,92),-60,0,0,(X+4,G-10),(X-2,G-8),(10,4),(6,6),lk=KNEE_UP,rk=KNEE_UP,tilt=20)
SF3=P((X-4,92),-90,0,0,(X-8,G-34),(X-12,G-30),('a',X-22,G),('a',X-24,G),lk=KNEE_UP,rk=KNEE_UP,tilt=24)
SF4=P((X-14,80),16,0,0,(X,G),(X-30,G),(16,10),(12,12),lk=KNEE_UP)
clip('startlefall','startled, she drops back into a backward roll and comes up on one knee, hands up ready',[IDLE(0),SF1,SF2,SF3,SF4,SF4],False)
PD=P((X-10,96),-10,0,0,(X+10,G),(X+24,G),('a',X+8,78),('r',2,24),tilt=10,lk=KNEE_UP,rk=KNEE_FWD)
clip('plopdown','tired, slides down a wall into a sitting slump, near knee up, far leg out, head hanging',[STAND(0),P((X-6,70),-6,0,0,(X+8,G),(X-2,G),'down','down'),P((X-8,84),-8,0,0,(X+10,G),(X+10,G),(4,26),(0,26),lk=KNEE_UP,rk=KNEE_UP),PD,PD],False)
EM=lambda j: P((X,55),2,0,0,(X+6,G),(X-4,G),('r',-4+j,-2),'down',le=('e',10,-2),head=(3,-7),tilt=-2)
clip('embarrassed','glares, then looks away and rubs the back of her neck with the near hand',[IDLE(0,tilt=14),IDLE(0,tilt=0,head=(3,-7)),EM(0),EM(2),EM(0)],False)
AN=lambda b: IDLE(b,tilt=-4,head=(4,-8),lh=('r',-4,18),le=('e',9,15))
clip('annoyed','sharp breath out through the nose, head tilted, arm tightening across the waist',[IDLE(0),AN(-.5),AN(.5),AN(0),IDLE(0)],False)
TH=lambda j: P((X,55),2,0,0,(X+6,G),(X-5,G),('r',10+j,12),'down',le=('e',7,16),tilt=6)
clip('think','near hand at the chest turning something small with the fingers, eyes narrowed',[TH(0),TH(1),TH(0),TH(-1)])
BO=lambda d: P((X+d,55),2,0,0,(X+6,G),(X-4,G),('r',8,16),'down',le=('e',6,16),tilt=4)
clip('bored','shifts weight from foot to foot, near hand rolling something small in the fingers',[BO(0),BO(-2),BO(0),BO(2)])

if __name__=='__main__':
    sys.path.insert(0,os.path.join(HERE,'..')); import plan
    want={p[0]:p[3] for p in plan.P if p[3]}
    bad=[]
    for n,f in want.items():
        if n not in CLIPS: bad.append(('없음',n)); continue
        got=len(CLIPS[n][2])
        if got!=f and got!=f+1: bad.append((n,f,got))
    extra=[n for n in CLIPS if n not in want]
    print(len(CLIPS),'clips',sum(len(v[2]) for v in CLIPS.values()),'frames; mismatch',bad,'extra',extra)
    for n,(a,_,ps) in CLIPS.items():
        if len(a)>100+len('side view in profile facing right: ') : pass
        for p in ps:
            for k,v in p.items():
                x,y=(v[0]+J.DX)/J.W,(v[1]+J.DY)/J.H
                if not(0.02<x<0.98 and 0.02<y<0.98): print('OUT',n,k,round(x,2),round(y,2))
