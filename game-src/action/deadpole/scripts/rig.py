# 데드폴 전 동작 뼈대 (animate_with_skeleton_v3용). 설계: docs/캐릭터제작서/동작설계_deadpole.md
# 좌표 공간은 쟈알디 rig.py와 같음(160×112 → 192×144 캔버스로 +2,+28, 발목 바닥선 G=100). 오른쪽을 봄, RIGHT = 앞손·앞발.
# 몸은 쟈알디의 0.88배(작은 체구). 자세는 전부 새로 씀(쟈알디 자세 복사 금지, check_copy.py가 검사).
# 교훈(쟈알디): 옆모습은 어깨 회전 s ≤ -0.25(SIDE)·h≈0. 손이 가슴·배 앞이면 팔꿈치를 ('e',x,y)로 몸 앞에 직접 지정.
# 손을 머리 뒤로 넘기지 않음(등을 돌려 그림). 반복 아닌 클립 끝엔 tail()로 버릴 장(생성기가 끝 장을 기준 그림으로 되돌림).
import math,json,sys,os
from PIL import Image,ImageDraw
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0,os.path.join(HERE,'../../jyaldi-v5/scripts'))
import skel
J=skel.J
K=0.88
THIGH,SHIN,UARM,FARM,TORSO=22.4*K,23.4*K,17*K,14*K,26*K
G=100
W,H=192,144; DX,DY=2,28
HY=60          # 선 자세 골반 높이(다리 길이 40.3)
X=55           # 기준 x (쟈알디와 같음 → 캔버스 x=57)
SIDE=-0.25
HEAD=(4.4,-6.2)
def rot(v,deg):
    r=math.radians(deg); return (v[0]*math.cos(r)-v[1]*math.sin(r), v[0]*math.sin(r)+v[1]*math.cos(r))
def add(a,b): return (a[0]+b[0],a[1]+b[1])
def _ik(root,target,a,b,bend):
    dx,dy=target[0]-root[0],target[1]-root[1]; d=max(1e-3,min(math.hypot(dx,dy),a+b-0.01)); base=math.atan2(dy,dx)
    c=max(-1,min(1,(a*a+d*d-b*b)/(2*a*d))); ang=base+bend*math.acos(c)
    mid=(root[0]+a*math.cos(ang),root[1]+a*math.sin(ang))
    t=math.atan2(target[1]-mid[1],target[0]-mid[0]); return mid,(mid[0]+b*math.cos(t),mid[1]+b*math.sin(t))
def ik(root,target,a,b,pick): return max((_ik(root,target,a,b,1),_ik(root,target,a,b,-1)),key=lambda r:pick(r[0]))
KNEE_FWD=lambda m:m[0]
KNEE_UP=lambda m:-m[1]
ELB_DOWN=lambda m:m[1]-0.8*m[0]
ELB_UP=lambda m:-m[1]
ELB_OUT=lambda m:m[0]
def P(hip,lean=2,s=0,h=0,lf=None,rf=None,lh='down',rh='down',head=HEAD,tilt=0,lk=KNEE_FWD,rk=KNEE_FWD,le=ELB_DOWN,re=ELB_DOWN):
    """쟈알디 rig.P와 같은 약속(크기만 0.88배). lh/rh: 'down' 'out' (dx,dy)=목 기준 ('r',x,y)=목 기준·몸통 따라 돎 ('a',x,y)=절대.
    le/re: IK 선택 함수 또는 ('e',x,y)=팔꿈치 직접(목 기준, 몸통 따라 돎)."""
    N=add(hip,rot((0,-TORSO),lean))
    p={'NECK':N}
    p['RIGHT SHOULDER']=add(N,rot((-5.3*s+1,3.5),lean)); p['LEFT SHOULDER']=add(N,rot((5.3*s-1,3.5),lean))
    p['RIGHT HIP']=add(hip,rot((-4.4*h,0),lean)); p['LEFT HIP']=add(hip,rot((4.4*h,0),lean))
    hv=rot(head,lean+tilt); nose=add(N,hv); p['NOSE']=nose
    for k,v in (('RIGHT EYE',(-2.6,-2.6)),('LEFT EYE',(0,-3.5)),('RIGHT EAR',(-7,-1.8)),('LEFT EAR',(-5.3,-2.6))): p[k]=add(nose,rot(v,lean+tilt))
    def hand(side,t,pick):
        sh_=p[f'{side} SHOULDER']
        if t=='out': tgt=(sh_[0]+52,sh_[1]-1)
        elif t=='down': tgt=add(sh_,(2 if side=='RIGHT' else -1,25))
        elif isinstance(t,tuple) and t[0]=='a': tgt=(t[1],t[2])
        elif isinstance(t,tuple) and t[0]=='r': tgt=add(N,rot((t[1],t[2]),lean))
        else: tgt=add(N,t)
        if isinstance(pick,tuple) and pick[0]=='e':
            p[f'{side} ELBOW']=add(N,rot((pick[1],pick[2]),lean)); p[f'{side} ARM']=tgt; return
        e,w=ik(sh_,tgt,UARM,FARM,pick); p[f'{side} ELBOW']=e; p[f'{side} ARM']=w
    hand('RIGHT',lh,le); hand('LEFT',rh,re)
    lf=lf or (hip[0]+5,G); rf=rf or (hip[0]-3,G)
    for side,an,pk in (('RIGHT',lf,lk),('LEFT',rf,rk)):
        k,a=ik(p[f'{side} HIP'],an,THIGH,SHIN,pk); p[f'{side} KNEE']=k; p[f'{side} LEG']=a
    return p
def lerp(a,b,t): return {k:(a[k][0]+(b[k][0]-a[k][0])*t,a[k][1]+(b[k][1]-a[k][1])*t) for k in J}
def staged(a,b,t):
    out={}
    for k in J:
        tt=min(1,t*1.5) if ('HIP' in k or 'KNEE' in k or 'LEG' in k) else t**1.6 if ('ELBOW' in k or k.endswith(' ARM')) else min(1,t*1.2)
        out[k]=(a[k][0]+(b[k][0]-a[k][0])*tt,a[k][1]+(b[k][1]-a[k][1])*tt)
    return out
def sh(p,dx,dy=0): return {k:(v[0]+dx,v[1]+dy) for k,v in p.items()}
def jit(p,dx,dy,keys): return {k:((v[0]+dx,v[1]+dy) if any(s in k for s in keys) else v) for k,v in p.items()}
def tail(ps,loop): return ps+[ps[0] if loop else ps[-1]]
def _xs(a,b,c):
    u=(b[0]-a[0],b[1]-a[1]); f=(c[0]-b[0],c[1]-b[1]); n=math.hypot(*u)*math.hypot(*f) or 1
    return (u[0]*f[1]-u[1]*f[0])/n
def _mirror(p,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]; L=dx*dx+dy*dy or 1; t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L
    q=(a[0]+t*dx,a[1]+t*dy); return (2*q[0]-p[0],2*q[1]-p[1])
def anatomic(p):
    q=dict(p)
    for s in ('RIGHT','LEFT'):
        if _xs(q[f'{s} SHOULDER'],q[f'{s} ELBOW'],q[f'{s} ARM'])>0.12: q[f'{s} ELBOW']=_mirror(q[f'{s} ELBOW'],q[f'{s} SHOULDER'],q[f'{s} ARM'])
        if _xs(q[f'{s} HIP'],q[f'{s} KNEE'],q[f'{s} LEG'])<-0.12: q[f'{s} KNEE']=_mirror(q[f'{s} KNEE'],q[f'{s} HIP'],q[f'{s} LEG'])
    for k,v in list(q.items()):   # 누운 장 팔꿈치·손이 바닥 아래로 가지 않게
        if ('ELBOW' in k or k.endswith(' ARM')) and v[1]>G+1: q[k]=(v[0],G+1)
    return q
CLIPS={}   # 이름: (동작 설명, 소품 설명, [자세...], 무리)
GROUP={}
_grp='전투·기본'
def group(g):
    global _grp; _grp=g
def clip(name,action,poses,prop=''):
    assert 3<=len(poses)<=15,(name,len(poses)); CLIPS[name]=(action,prop,[anatomic(p) for p in poses]); GROUP[name]=_grp
GUN='a small black pistol'
GUN2='gripping a small black pistol with both hands'

# ───────── 기본 자세 ─────────
# 기본 그림(assets/agents/Deadpole_default.avif): 두 손을 배 앞에서 맞잡고 고개를 살짝 숙여 기울임, 좁은 어깨
CLASP=dict(lh=('r',8,19),rh=('r',7,20),le=('e',0,14),re=('e',-1,14))
def STAND(b=0,tilt=6,**k): return P((X,HY+b),1,0,0,(X+5,G),(X-3,G),tilt=tilt,**{**CLASP,**k})
# 총 든 낮은 준비(Sul식 낮춤 아님, 두 손 가슴 앞 아래로 총구 앞아래): 무릎 굽힘, 발 어깨너비 평행에 가까움
TWO=lambda x=16,y=14,ex=7,ey=12: dict(lh=('r',x,y),rh=('r',x-2,y+1),le=('e',ex,ey),re=('e',ex-2,ey+1))
def READY(d=0,b=0,lean=8): return P((X+d,HY+3+b),lean,SIDE,-0.1,(X+9+d,G),(X-6+d,G),tilt=-2,**TWO())
# 이소슬리스 정조준: 두 팔 쭉, 어깨 수평, 상체 살짝 앞
def AIM(d=0,b=0,y=3): return P((X+2+d,HY+2+b),7,SIDE,-0.1,(X+11+d,G),(X-6+d,G),('r',30,y),('r',29,y+1),tilt=-3)
# 리텐션: 총을 가슴 옆에 붙이고 팔꿈치 뒤로, 장갑 낀 앞손은 얼굴 앞을 막음(손 바뀜 주의: 총 = 앞손 RIGHT)
def RET(d=0,lean=10): return P((X+2+d,HY+3),lean,SIDE,-0.1,(X+11+d,G),(X-7+d,G),('r',11,10),('r',13,-3),le=('e',-3,12),re=('e',9,6),tilt=-2)
# 빠른 무릎 쏴: 뒷무릎 바닥, 상체 세움, 두 손 조준
def KNEEL(b=0,y=4,lean=4): return P((X-1,HY+21+b),lean,SIDE,-0.1,(X+13,G),(X-15,G-1),('r',29,y),('r',28,y+1),tilt=-2)
def KNEELREADY(b=0): return P((X-1,HY+21+b),6,SIDE,-0.1,(X+13,G),(X-15,G-1),tilt=0,**TWO(15,14))

# ───────── 전투·기본 ─────────
group('전투·기본')
clip('idle','calm standing idle, hands clasped in front of her stomach, head tilted slightly, gentle breathing',[STAND(0),STAND(.5),STAND(.8),STAND(.5)])
TD=lambda a: P((X,HY),3,0,0,(X+5,G),(X-3,G),('r',9+2*a,24-2*a),('r',8,25),le=('e',1,15),re=('e',0,15),tilt=10)
TH=lambda a: P((X,HY),2,0,0,(X+5,G),(X-3,G),('r',9,-6+a),('r',7,20),le=('e',9,4),re=('e',-1,14),tilt=12)
clip('tidy','tidying herself: pulls the hem of her jacket straight with both hands, then smooths her bangs with her fingertips',
     tail([STAND(0),TD(0),TD(1),TD(0),TH(0),TH(1),STAND(0)],False))
DR1=P((X,HY+1),4,SIDE*.6,0,(X+7,G),(X-4,G),('r',-2,22),('r',8,14),le=('e',-5,13),re=('e',3,13),tilt=0)
clip('draw','lightning-fast pistol draw: grips the hip holster, body drops low, both hands meet and extend into a two-handed aim, eyes narrow',
     tail([STAND(0),DR1,AIM()],False),GUN2)
HL1=P((X,HY+1),4,SIDE*.5,0,(X+7,G),(X-4,G),('r',-1,21),('r',8,18),le=('e',-4,13),re=('e',1,14),tilt=10)
clip('holster','slowly holsters the pistol at her hip, brings her hands together in front, and gives a small bow of the head',
     tail([READY(),lerp(READY(),HL1,.5),HL1,STAND(0,tilt=14),STAND(0,tilt=8)],False))
clip('ready','low ready stance: knees bent, both hands holding the pistol in front pointed slightly down, alert',[READY(0,0),READY(0,.6),READY(0,1),READY(0,.6)],GUN2)
def walkf(t,stride=8,lift=3,bob=.8,tilt=6,look=0):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+1,HY+bob*abs(c)),2,0,0,(X+1+stride*c,G-lift*max(0,-sn)),(X+1-stride*c,G-lift*max(0,sn)),tilt=tilt+look*math.sin(2*math.pi*t),**CLASP)
clip('walk','careful small-step walk, hands kept clasped in front, head glancing slightly up and down',[walkf(i/8,look=4) for i in range(8)])
def stepf(t):
    # 뒤꿈치-발끝 굴려 걷기: 앞발 뒤꿈치 먼저, 무릎 굽혀 상체·총 높이 고정
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,HY+3),7,SIDE,-0.1,(X+2+8*c,G-2*max(0,-sn)),(X+2-8*c,G-2*max(0,sn)),('r',30,4),('r',29,5),tilt=-3)
clip('step','tactical heel-to-toe walk with knees bent, two-handed pistol aim held perfectly steady',[stepf(i/8) for i in range(8)],GUN2)
def runf(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+6,HY+2+2*abs(sn)),14,SIDE,0.2*c,(X+5+15*c,G-10*max(0,-sn)-1),(X+5-15*c,G-10*max(0,sn)-1),tilt=-4,**TWO(15,12,6,11))
clip('run','fast short-stepped sprint, both hands holding the pistol low in front of the chest, long hair streaming back',[runf(i/8) for i in range(8)],GUN2)
JT=lambda tuck,b=0: P((X,HY-2+b),4,SIDE,0,(X+8,G-3-tuck),(X-4,G-5-tuck*1.2),lk=KNEE_FWD,rk=KNEE_FWD,tilt=0,**TWO(13,10,5,10))
clip('jump','light hop: small crouch, springs up, pulls both knees to the chest, hair floats up, lands softly',
     [READY(0,4),P((X+1,HY-4),6,SIDE,0,(X+7,G-2),(X-5,G-3),**TWO(14,10,5,10)),JT(10),JT(16),JT(12),JT(4),READY(0,4),READY()],GUN2)
clip('kneel','drops quickly to one knee, upper body upright, two-handed pistol aim',[READY(),lerp(READY(),KNEEL(),.45),lerp(READY(),KNEEL(),.8),KNEEL()],GUN2)
def kwalk(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+1,HY+14+abs(sn)),14,SIDE,0,(X+6+6*c,G-3*max(0,-sn)),(X-4-6*c,G-3*max(0,sn)),lk=KNEE_FWD,rk=KNEE_FWD,**TWO(15,13,6,11))
clip('kneelwalk','low crouched shuffle with small quick steps, staying low, pistol held in both hands',[kwalk(i/8) for i in range(8)],GUN2)
KS=lambda r: P((X,HY+21),10,SIDE,-0.1,(X+13,G),(X-15,G-1),('r',28,14-r),('r',27,15-r),tilt=8)
clip('kneelshot','from one knee, angles the pistol down at the floor ahead and fires, small wrist recoil',tail([KNEEL(),KS(0),KS(3),KS(0),KS(0)],False),GUN2)
SN=lambda d: P((X-6,HY+22),62,0,0,(X-22,G),(X-26,G),('a',X+18,G),('a',X+12,G),head=(5,-4),tilt=-28+3*d,lk=KNEE_UP,rk=KNEE_UP,le=ELB_OUT,re=ELB_OUT)
clip('sniffground','down on hands and knees, nose close to the floor, eyes closed, head sweeping slightly side to side, short sniffs',
     [STAND(0),lerp(STAND(0),SN(0),.5),SN(0),SN(1),SN(-1),SN(0)])
# 근접 사격 3연타 15장: ① 리텐션 1발 ② 앞발 내디뎌 두 손 쭉 2발 ③ 붙어 3발(장마다 고개 까딱) → 앞손바닥으로 밀고 뒷발로 물러섬
R0=RET(0); R1=jit(RET(0),-1,-2,['RIGHT ARM'])
A2=AIM(9,1,2); A2r=jit(A2,-2,-2,['ARM'])
C3=P((X+14,HY+3),12,SIDE,-0.1,(X+24,G),(X+2,G),('r',16,6),('r',13,-2),le=('e',4,11),re=('e',9,5),tilt=10)
C3b=jit(C3,-1,-2,['RIGHT ARM']); C3c=P((X+14,HY+3),12,SIDE,-0.1,(X+24,G),(X+2,G),('r',16,6),('r',13,-2),le=('e',4,11),re=('e',9,5),tilt=18)
PSH=P((X+6,HY+2),2,SIDE,-0.1,(X+18,G),(X-8,G),('r',8,10),('r',26,4),le=('e',-3,12),tilt=0)
clip('cq','close-quarters pistol combo: fires from the chest with elbow tucked, steps in with a two-handed double tap, then apologetically fires three point-blank shots and shoves with the open palm, stepping back',
     [READY(),R0,R1,lerp(R1,R0,.5),staged(R0,A2,.5),A2,A2r,A2,staged(A2,C3,.5),C3,C3b,C3c,C3b,PSH,lerp(PSH,READY(-2),.5)],GUN2)
SL0=runf(.25)
SL1=P((X+10,HY+18),-20,SIDE,0,(X+44,G-2),(X+2,G-4),('r',24,-6),('r',22,-5),lk=KNEE_FWD,rk=KNEE_UP,tilt=-8)
SL2=P((X+20,HY+28),-38,0,0,(X+60,G),(X+16,G-2),('r',26,-10),('r',25,-9),lk=KNEE_FWD,rk=KNEE_UP,tilt=-14)
SL3=jit(SL2,-2,-3,['ARM'])
clip('slide','running baseball slide feet-first: front leg straight, rear leg tucked, leans back on the hip and fires upward ahead with both hands, then pops up to one knee',
     tail([SL0,SL1,SL2,SL3,sh(SL2,4),lerp(sh(SL2,6),KNEEL(),.5),sh(KNEEL(),10)],False),GUN2)
AS=lambda r: P((X,HY-6),4,SIDE,0,(X+8,G-16),(X-4,G-18),('r',26,14-r),('r',25,15-r),tilt=8)
clip('airshot','in mid-air with knees tucked, points the pistol down and forward at 45 degrees and fires twice, recoil lifts her slightly',
     [JT(14),AS(0),sh(AS(3),-1,-2),AS(0),sh(AS(3),-1,-3),JT(12)],GUN2)
FR1=jit(AIM(),-2,-3,['ARM']); FR1=jit(FR1,-1,-1,['ELBOW'])
clip('fire','firing a pistol two-handed in an isosceles stance, arms straight, small recoil of the wrists',[AIM(),FR1,lerp(FR1,AIM(),.5),AIM()],GUN2)
RL1=P((X+2,HY+3),8,SIDE,-0.1,(X+11,G),(X-6,G),('r',14,10),('r',8,14),le=('e',5,10),re=('e',0,13),tilt=10)
RL2=P((X+2,HY+3),8,SIDE,-0.1,(X+11,G),(X-6,G),('r',14,10),('r',-2,21),le=('e',5,10),re=('e',-4,13),tilt=10)
RL3=P((X+2,HY+3),8,SIDE,-0.1,(X+11,G),(X-6,G),('r',14,10),('r',12,16),le=('e',5,10),re=('e',3,13),tilt=10)
RL4=P((X+2,HY+3),8,SIDE,-0.1,(X+11,G),(X-6,G),('r',14,9),('r',18,8),le=('e',5,10),re=('e',8,8),tilt=4)
clip('reload','speed reload: pulls the pistol to her chest, drops the empty magazine, rear hand fetches a new one from the belt, slaps it in, racks the slide, aims again',
     tail([AIM(),RL1,RL2,RL3,RL4,AIM()],False),GUN)
RW=lambda u: P((X,HY-1.5*u),0,0,0,(X+5,G-1.5*u),(X-3,G-1.5*u),('r',6,10),('r',7,20),le=('e',-2,12),re=('e',-1,14),tilt=-4*u)
clip('rewind','places her near hand on her chest and closes her eyes, hair and jacket hem drift upward as if in reverse, body rises slightly, then settles',
     tail([STAND(0),RW(0),RW(.6),RW(1.3),RW(1),RW(.4),STAND(0)],False))
SF=lambda u: P((X,HY),1,0,0,(X+5,G),(X-3,G),tilt=-10-2*u,lh=('r',9,14),rh=('r',8,16),le=('e',1,12),re=('e',0,13))
clip('sniff','standing with eyes closed and chin raised, sniffing the air in short breaths, shoulders lifting slightly',[SF(0),jit(SF(1),0,-0.8,['SHOULDER','NECK','NOSE','EYE','EAR']),SF(0),jit(SF(1),0,-0.8,['SHOULDER','NECK','NOSE','EYE','EAR'])])
CV=lambda b: P((X+1,HY+3+b),2,0,0,(X+11,G),(X-8,G),('r',14,2),('r',-12,2),le=('e',8,0),re=('e',-6,0),tilt=-6)
clip('cover','shielding stance: both arms spread wide to the sides, feet braced, chin tucked, eyes open, standing her ground',[CV(0),CV(.6),CV(1),CV(.6)])
CT1=P((X+4,HY+2),6,SIDE,-0.1,(X+14,G),(X-8,G),('r',18,10),('r',28,-2),le=('e',5,10),re=('e',12,2),tilt=-2)
CT2=P((X-2,HY+3),4,SIDE,-0.1,(X+12,G),(X-12,G),('r',16,10),('r',26,2),le=('e',4,10),re=('e',12,4),tilt=-2)
CT3=P((X-2,HY+3),6,SIDE,-0.1,(X+12,G),(X-12,G),('r',22,14),('r',24,2),le=('e',8,10),re=('e',11,4),tilt=0)
clip('catch','catches an attacking blade: the gloved lead hand snaps forward and grips, body slips half a step aside off the line, then points the pistol at the attacker point-blank',
     tail([READY(),CT1,CT2,CT2,CT3,CT3],False),'gripping a small black pistol in the rear hand, the front gloved hand open and gripping')
def rollp(a):
    # 앞구르기 낙법(뒤집힌 장 없이): 0 숙여 손 짚음 → 1 머리 숙여 어깨로 말림(공처럼) → 2 등으로 굴러 무릎 당김 → 3 무릎 쏴로 일어남
    if a==0: return P((X+6,HY+12),56,0,0,(X+16,G),(X-6,G),('a',X+30,G),('a',X+26,G),head=(5,-4),tilt=24)
    if a==1: return P((X+18,HY+18),118,0,0,(X+8,G-6),(X+4,G-2),('a',X+32,G),('a',X+28,G),head=(4,-3),tilt=50,lk=KNEE_UP,rk=KNEE_UP)
    if a==2: return P((X+30,HY+34),-50,0,0,(X+40,G-24),(X+36,G-20),('r',16,10),('r',14,12),le=('e',8,8),re=('e',7,9),tilt=40,lk=KNEE_UP,rk=KNEE_UP)
    if a==3: return P((X+36,HY+24),20,0,0,(X+48,G),(X+28,G-2),('r',18,16),('r',16,18),le=('e',7,12),re=('e',6,13),tilt=20,lk=KNEE_UP)
    return sh(KNEE_POSE(),44)
KNEE_POSE=KNEELREADY
clip('roll','forward combat roll: dives forward onto the outside of the near shoulder, rolls across the back, comes up onto one knee with the pistol ready',
     tail([READY(),rollp(0),rollp(1),rollp(2),rollp(3),rollp(4),sh(KNEEL(),44)],False),GUN2)
CL=lambda d=0: P((X+8+d,HY+2),6,SIDE,-0.1,(X+18+d,G),(X-2+d,G),('r',12,12),('r',20,-4),le=('e',4,12),re=('e',10,2),tilt=-10)
clip('collar','lunges in close and grips forward at chest height with the gloved lead hand clenched, pulling, looking up',[READY(),staged(READY(),CL(),.5),CL(),CL(.5)],GUN)
CN=lambda r: P((X+8,HY+2),6,SIDE,-0.1,(X+18,G),(X-2,G),('r',18,14-r),('r',20,-4),le=('e',6,12),re=('e',10,2),tilt=-10+4*r)
clip('contact','holding the collar, presses the pistol muzzle against the enemy and fires point-blank, the elbow folds from the recoil',tail([CL(),CN(0),CN(2),CN(0),CL()],False),GUN)
TM1=P((X+4,HY+10),30,SIDE,0,(X+16,G),(X-4,G),('r',24,4),('r',22,6),tilt=-6)
TM2=P((X-4,HY+28),-30,0,0,(X+12,G),(X-10,G),('r',22,-6),('r',20,-4),lk=KNEE_UP,rk=KNEE_UP,tilt=-10)
TM3=P((X-8,HY+36),-80,0,0,(X+18,G-30),(X+6,G-2),('r',10,-20),('r',8,-18),lk=KNEE_UP,rk=KNEE_UP,tilt=-20)
TM4=P((X-8,HY+37),-90,0,0,(X+4,G-46),(X+8,G-2),('r',-4,-24),('r',-6,-22),lk=KNEE_UP,rk=KNEE_UP,tilt=-20,le=ELB_UP,re=ELB_UP)
TM5=P((X-8,HY+37),-92,0,0,(X-10,G-36),(X+8,G-2),('r',-14,-14),('r',-12,-12),lk=KNEE_UP,rk=KNEE_UP,tilt=-24,le=ELB_UP,re=ELB_UP)
TM6=P((X-8,HY+38),-92,0,0,(X+26,G-6),(X+20,G-4),('r',4,14),('r',2,16),lk=KNEE_UP,rk=KNEE_UP,tilt=-24)
clip('tomoe','judo sacrifice throw: grips the collar, pulls forward while dropping onto her back, plants a foot up high and kicks it up over her head with both hands following through, ends lying on her back',
     [CL(),TM1,TM2,TM3,TM4,TM5,TM6,TM6,TM6,TM6])
SW=lambda t: walkf(t,stride=8,tilt=10)
SOPEN=lambda u: P((X+10,HY),1,0,0,(X+15,G),(X+6,G),('r',6+8*u,20-14*u),('r',-4-6*u,20-14*u),le=('e',2+6*u,14-8*u),re=('e',-3-3*u,14-8*u),tilt=14-12*u)
clip('super','lowers both hands, walks three steps forward, then slowly spreads both arms wide open, one arm reaching forward and the other back, chest exposed, head bowed in apology, stands still',
     tail([READY(),sh(SW(0),2),sh(SW(.25),4),sh(SW(.5),7),SOPEN(0),SOPEN(.5),SOPEN(1)],False))
# 필살 되감기 부활: 누운 자세(die 끝)에서 거꾸로 일으켜 세워짐
LIEDEAD=P((X-6,HY+37),-90,0,0,(X+30,G),(X+28,G),('r',6,22),('r',4,24),le=('e',1,12),re=('e',0,12),tilt=20)
RISE=lambda u: P((X-6+6*u,HY+37-37*u),-90+91*u,0,0,(X+30-25*u,G-6*math.sin(math.pi*u)),(X+28-31*u,G-4*math.sin(math.pi*u)),('r',-6+14*u,10+9*u),('r',-8+15*u,12+8*u),tilt=20-14*u,lk=KNEE_UP,rk=KNEE_UP)
clip('superrise','rewinding back to life: rises from lying flat as if pulled upright by time in reverse, hair floating up, lands on both feet with narrowed eyes',
     tail([LIEDEAD,RISE(.2),RISE(.4),RISE(.6),RISE(.8),RISE(1),READY()],False))
PKA=P((X,HY+18),18,0,0,(X+10,G),(X+2,G),('r',22,18),('r',20,20),le=('e',8,12),re=('e',6,13),lk=KNEE_UP,rk=KNEE_UP,tilt=18)
PKB=P((X,HY+18),12,0,0,(X+10,G),(X+2,G),('r',10,12),('r',9,13),le=('e',2,12),re=('e',1,13),lk=KNEE_UP,rk=KNEE_UP,tilt=10)
clip('pickup','squats down with knees together, picks something up with both hands, hugs it to her chest and stands',
     tail([STAND(0),lerp(STAND(0),PKA,.5),PKA,PKB,lerp(PKB,STAND(0,lh=('r',10,12),rh=('r',9,13),le=('e',2,12),re=('e',1,13)),.5),STAND(0,lh=('r',10,12),rh=('r',9,13),le=('e',2,12),re=('e',1,13))],False))
TS0=P((X,HY+3),8,0,0,(X+7,G),(X-4,G),('r',4,24),('r',3,25),le=('e',-2,14),re=('e',-3,14),tilt=8)
TS1=P((X+2,HY+1),-2,0,0,(X+8,G),(X-4,G),('r',20,0),('r',19,1),le=('e',10,6),re=('e',9,7),tilt=-4)
TS2=P((X,HY),2,0,0,(X+5,G),(X-3,G),('r',8,2),('r',7,3),le=('e',4,8),re=('e',3,9),tilt=4)
clip('toss','gentle two-handed underhand toss, then both hands go up to her mouth nervously',tail([STAND(0),TS0,lerp(TS0,TS1,.5),TS1,TS2,TS2],False))
DK=lambda t: P((X,HY),1,0,0,(X+5,G),(X-3,G),('r',7,-1+2*(1-t)),('r',6,0+2*(1-t)),le=('e',5,9),re=('e',4,10),tilt=-14*t)
clip('drink','both hands raised to her mouth cupped together, small sipping motions, then a little nod',tail([STAND(0),DK(0),DK(1),DK(.6),DK(1),DK(0),STAND(0,tilt=12)],False))
EOF_=P((X+2,HY),6,0,0,(X+7,G),(X-3,G),('r',20,10),('r',19,11),le=('e',8,8),re=('e',7,9),tilt=12)
ET=lambda t: P((X,HY),2,0,0,(X+5,G),(X-3,G),('r',7,1+2*t),('r',8,8),le=('e',5,9),re=('e',3,11),tilt=6)
clip('eat','first extends both cupped hands forward politely, then draws them back to her mouth for a small bite',tail([STAND(0),EOF_,EOF_,ET(0),ET(1),ET(0)],False))
BDG=lambda a: P((X,HY),4,0,0,(X+5,G),(X-3,G),('r',11+3*math.cos(a),14+3*math.sin(a)),('r',12,15),le=('e',4,11),re=('e',4,12),tilt=16)
clip('bandage','the near hand circles around her other forearm several times, then she looks up and gives a small grateful bow',tail([BDG(0),BDG(1.6),BDG(3.1),BDG(4.7),STAND(0,tilt=14),STAND(0,tilt=24)],False))
HT=P((X-4,HY+2),-14,SIDE,-0.1,(X+8,G),(X-10,G),('r',10,8),('r',8,10),le=('e',2,10),re=('e',1,11),head=(3.5,-6.8),tilt=8)
clip('hit','light hit: shoulders hunch, eyes squeeze shut, pushed back further than a heavier person',[READY(),HT,sh(HT,-3),lerp(sh(HT,-3),READY(-3),.5)],GUN2)
D1=P((X-4,HY),-25,0,0,(X+10,G),(X-12,G-2),('r',8,-8),('r',-4,-6))
D2=P((X-12,HY+2),-55,0,0,(X+10,G-12),(X+2,G-10),('r',4,-18),('r',-6,-14))
D3=sh(P((X-16,HY+24),-78,0,0,(X+14,G-28),(X+6,G-20),('r',2,-22),('r',-8,-12),lk=KNEE_UP,rk=KNEE_UP,tilt=25),8)
D4=sh(P((X-12,HY+35),-90,0,0,(X+26,G-2),(X+20,G),('r',12,0),('r',8,-4),tilt=35,le=ELB_UP,re=ELB_UP),16)
clip('down','heavy hit: small body thrown far backward through the air, lands on her back, long hair fanned out',tail([D1,D2,D3,D4,D4,D4,D4],False))
# 사망: 실신식 무너짐(무릎 → 엉덩이 → 옆구리 → 어깨), 힘 빠진 팔
DI1=P((X,HY+6),6,0,0,(X+5,G),(X-3,G),('r',4,24),('r',3,25),le=('e',0,14),re=('e',-1,14),tilt=20)
DI2=P((X-2,HY+16),10,0,0,(X+6,G),(X-2,G),('r',2,26),('r',1,26),tilt=28,lk=KNEE_FWD,rk=KNEE_FWD)
DI3=P((X-4,HY+30),-10,0,0,(X+16,G),(X+12,G),('r',-2,26),('a',X-14,G),tilt=30,lk=KNEE_UP,rk=KNEE_UP)
DI4=P((X-6,HY+35),-60,0,0,(X+24,G),(X+20,G),('r',6,22),('r',4,24),tilt=30,lk=KNEE_UP,rk=KNEE_UP)
clip('die','fainting collapse: her knees give way first, she sinks onto her hip, slumps onto her side and lies still with limp arms and closed eyes',
     tail([STAND(0),DI1,DI2,DI3,DI4,LIEDEAD,LIEDEAD],False))
GU1=P((X-4,HY+36),-60,0,0,(X+26,G),(X+22,G),('r',10,10),('a',X-14,G),tilt=20,lk=KNEE_UP,rk=KNEE_UP)
GU2=P((X-2,HY+24),-10,0,0,(X+12,G),(X-14,G),('r',12,14),('a',X-18,G),rk=KNEE_FWD)
clip('getup','quick recovery from her back: rolls to the side, pushes off one hand, pops up to one knee and stands ready',
     tail([D4,GU1,GU2,KNEELREADY(),lerp(KNEELREADY(),READY(),.5),READY()],False),GUN2)
RV1=P((X-6,HY+37),-90,0,0,(X+20,G-8),(X+16,G-4),('r',12,12),('r',10,14),le=('e',4,10),re=('e',3,11),tilt=30,lk=KNEE_UP,rk=KNEE_UP)
RV2=P((X-4,HY+34),-60,0,0,(X+22,G-2),(X+18,G),('r',12,14),('a',X-14,G),tilt=24,lk=KNEE_UP,rk=KNEE_UP)
RV3=P((X-6,HY+30),-8,0,0,(X+18,G),(X+14,G),('r',12,18),('a',X-16,G),tilt=20,lk=KNEE_UP,rk=KNEE_UP)
RV4=P((X-6,HY+30),-4,0,0,(X+18,G),(X+14,G),('r',10,-6),('r',8,16),le=('e',9,4),re=('e',3,12),tilt=12,lk=KNEE_UP,rk=KNEE_UP)
RV5=P((X-2,HY+20),8,0,0,(X+12,G),(X-12,G-1),('r',10,22),('r',9,23),le=('e',2,14),re=('e',1,14),tilt=8)
RV6=P((X,HY+8),4,0,0,(X+8,G),(X-6,G),('r',9,24),('r',8,25),le=('e',1,15),re=('e',0,15),tilt=6)
clip('revive','coming back to life: curls up groaning, rolls onto her side, pushes up to sit, smooths her bangs and jacket, rises to her feet, then a small bow',
     [LIEDEAD,RV1,RV1,RV2,RV3,RV4,RV4,RV5,RV6,STAND(0),STAND(0,tilt=20),STAND(0)])
PG=lambda d: jit(P((X,HY+1),4,0,0,(X+5,G),(X-3,G),('r',8,18),('r',7,19),le=('e',0,13),re=('e',-1,13),tilt=6+8*d),1.2*d,-0.8*abs(d),['NOSE','EYE','EAR','SHOULDER'])
PK=P((X,HY+21),16,0,0,(X-22,G-2),(X-26,G-3),('r',7,8),('r',6,9),le=('e',2,8),re=('e',1,9),tilt=26)
PF=P((X-6,HY+35),86,0,0,(X-42,G-2),(X-44,G),('a',X+16,G-2),('a',X+10,G-1),head=(6,-4),tilt=-30,le=ELB_UP,re=ELB_UP)
clip('purge','possessed by a parasite: shoulders and head twitch unnaturally, she sinks to her knees clutching her chest, then falls forward still',
     tail([STAND(0),PG(1),PG(-1),PK,lerp(PK,PF,.5),PF,PF],False))
RO=lambda u: P((X+2,HY+19),14,0,0,(X+16,G),(X-10,G-1),('r',24,12-2*u),('r',10,18),le=('e',10,8),re=('e',2,13),tilt=-6*u)
clip('rewindother','kneels on one knee, reaches her near hand forward at chest height with the palm open, eyes closed, hair drifting upward in reverse',
     tail([STAND(0),lerp(STAND(0),RO(0),.5),RO(0),RO(1),RO(1),RO(0)],False))
PIP=dict(lh=('r',10,8),rh=('r',8,10),le=('e',3,13),re=('e',2,14))
PW0=P((X,HY+1),4,SIDE,0,(X+8,G),(X-6,G),tilt=0,**PIP)
PW1=P((X-2,HY+1),-4,SIDE,0,(X+8,G),(X-8,G),('r',4,-4),('r',2,-2),le=('e',-2,6),re=('e',-3,8),tilt=-2)
PW2=P((X+6,HY+3),14,SIDE,0,(X+18,G),(X-4,G),('r',24,12),('r',22,14),tilt=6)
PW3=P((X+4,HY+3),20,SIDE,0,(X+18,G),(X-4,G),('r',20,22),('r',18,23),tilt=14)
clip('pipe','two-handed baseball-style swing with a steel pipe, wobbles from the weight, then hops back one step',
     tail([PW0,PW1,lerp(PW1,PW2,.5),PW2,PW3,sh(PW0,-8),sh(PW0,-8)],False),'gripping a long steel pipe at one end with both hands')
SG=P((X,HY+3),2,SIDE,0,(X+9,G),(X-7,G),('r',20,14),('r',8,18),le=('e',8,12),re=('e',-2,14),tilt=-2)
SGR=sh(jit(SG,-3,-3,['ARM','ELBOW']),-4)
clip('shotgun','hugging a heavy pump shotgun at waist height with both hands, fires twice, each recoil pushes her back a step',
     tail([SG,SGR,lerp(SGR,sh(SG,-4),.5),sh(SG,-4),sh(SGR,-4),sh(SG,-8)],False),'holding a long black pump shotgun with a wooden stock at waist height in both hands')
TR=lambda b: P((X,HY+2+b),6,0,0,(X+5,G),(X-3,G),('r',6,25),('r',5,26),le=('e',-1,15),re=('e',-2,15),tilt=14)
clip('tired','tired but smiling: clasped hands droop low, shoulders sag, shallow breathing',[TR(0),TR(.8),TR(1.4),TR(.8)])
SUPA=P((X+6,HY+3),2,0,0,(X+16,G),(X-6,G),('r',14,2),('r',-12,2),le=('e',8,0),re=('e',-6,0),tilt=-6)
SUPH=sh(jit(SUPA,-2,1,['NOSE','EYE','EAR','NECK','SHOULDER']),-3)
SUPL=P((X+3,HY),1,0,0,(X+8,G),(X-2,G),tilt=-4,head=(-2,-6.5),**CLASP)
clip('support','runs in, stops and plants her feet with both arms spread wide, flinches twice, then glances back over her shoulder with a reassuring smile',
     [runf(0),runf(.25),runf(.5),SUPA,SUPH,SUPA,SUPH,SUPA,SUPL,SUPL])
PIPE='a plain round grey steel pipe, a straight metal tube with no blade and no hand guard, held in front of her with both hands, pointing forward and up'
PPH=dict(lh=('r',17,12),rh=('r',14,14),le=('e',7,12),re=('e',5,13))
clip('idle_pipe','standing nervously, gripping a plain steel pipe in front of her with both hands, pointing it forward and up',
     [P((X,HY+b),3,0,0,(X+5,G),(X-3,G),tilt=8,**PPH) for b in (0,.5,.8,.5)],PIPE)
def walkh(t,hold,stride=8,lean=2):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+1,HY+.8*abs(c)),lean,0,0,(X+1+stride*c,G-3*max(0,-sn)),(X+1-stride*c,G-3*max(0,sn)),tilt=8,**hold)
def runh(t,hold):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+5,HY+3+1.5*abs(sn)),6,0,0,(X+5+11*c,G-7*max(0,-sn)-1),(X+5-11*c,G-7*max(0,sn)-1),tilt=4,**hold)
clip('walk_pipe','walking carefully, gripping a plain steel pipe in front of her with both hands, pointing it forward and up',[walkh(i/8,PPH) for i in range(8)],PIPE)
SHG='a long black pump shotgun with a wooden stock hugged diagonally across her chest in both arms, heavy for her'
SGH=dict(lh=('r',14,10),rh=('r',4,16),le=('e',5,12),re=('e',-2,14))
clip('idle_shotgun','standing with a heavy shotgun hugged diagonally across her chest, leaning back slightly from the weight',
     [P((X,HY+b),-3,0,0,(X+6,G),(X-4,G),tilt=4,**SGH) for b in (0,.5,.8,.5)],SHG)
clip('walk_shotgun','walking while hugging a heavy shotgun across her chest, leaning back slightly',[walkh(i/8,SGH,lean=-3) for i in range(8)],SHG)
clip('run_shotgun','short-stepped running while hugging a heavy shotgun across her chest',[runh(i/8,SGH) for i in range(8)],SHG)

# ───────── 기본 클립 (몸만) ─────────
group('기본 클립 (몸만, 물건·장면은 엔진)')
SU_=lambda lf,rf,hip,lean=6,**k: P(hip,lean,0,0,lf,rf,**{**CLASP,**k})
RAIL=dict(lh=('r',14,6),le=('e',8,8))
clip('stepup','lifts the near knee high and steps upward one careful step at a time, rising, one hand reaching forward for balance, rear foot joins',
     tail([STAND(0),SU_((X+11,G-20),(X-3,G),(X+1,HY-2),8,lk=KNEE_UP,**RAIL),SU_((X+14,G-14),(X-3,G),(X+4,HY-4),10,lk=KNEE_UP,**RAIL),
           SU_((X+14,G-14),(X-1,G-6),(X+10,HY-12),8,lk=KNEE_UP,**RAIL),SU_((X+14,G-14),(X+8,G-20),(X+13,HY-15),4,rk=KNEE_UP,**RAIL),
           SU_((X+14,G-14),(X+10,G-14),(X+12,HY-15),2)],False))
EDGE=dict(lh=('r',18,24),rh=('r',16,25),le=('e',7,14),re=('e',6,15))
clip('stepover','bends forward with both hands low for balance, lifts one leg high and over, then the other leg',
     tail([STAND(0),SU_((X+3,G),(X-3,G),(X+1,HY+2),16,**EDGE),SU_((X+12,G-26),(X-3,G),(X+2,HY),12,lk=KNEE_UP,**EDGE),SU_((X+24,G),(X-3,G),(X+11,HY+2),10,**EDGE),
           SU_((X+24,G),(X+12,G-26),(X+19,HY),6,rk=KNEE_UP,**EDGE),SU_((X+24,G),(X+18,G),(X+21,HY),2)],False))
LIE=lambda lean,b=0,**k: P((X-6,HY+14+b),lean,0,0,(X+34,HY+15),(X+33,HY+16),**{**dict(lh=('r',6,16),rh=('r',4,18),le=('e',2,10),re=('e',0,11)),**k})
clip('liesit','lying flat on her back with knees together, pushes up on both hands and sits up slowly and neatly',
     tail([LIE(-90),LIE(-70,lh=('a',X-14,HY+16),rh=('a',X-16,HY+16)),LIE(-45,lh=('a',X-12,HY+16),rh=('a',X-14,HY+16)),LIE(-15,lh=('r',14,18),rh=('r',12,20)),LIE(-4,lh=('r',14,18),rh=('r',12,20))],False))
HW=lambda d: P((X+1,HY-2),4,0,0,(X+6,G-2),(X-3,G-2),('r',17+d,11),('r',15-d,12),le=('e',8,10),re=('e',6,11),tilt=10)
clip('handswork','up on her tiptoes because she is short, both hands working in front at chest height, fingertips busy, careful',tail([HW(0),HW(2),HW(-1),HW(2)],True))
HH=lambda d: P((X,HY),3,0,0,(X+5,G),(X-3,G),('r',5+d,-6),('r',3-d,-4),le=('e',9,-2),re=('e',7,0),tilt=10)
clip('handshead','gathers her long hair in both hands at the top of her head and smooths it',tail([STAND(0),HH(0),HH(2),HH(-2),HH(0),STAND(0)],False))
SIT=lambda lean=4,tilt=6,b=0,**k: P((X-5,HY+16+b),lean,0,0,(X+13,G),(X+11,G),tilt=tilt,lk=KNEE_UP,rk=KNEE_UP,**{**dict(lh=('r',13,17),rh=('r',12,18),le=('e',5,14),re=('e',4,15)),**k})
SM=lambda u: SIT(6,10-12*u,lh=('r',7,-1+12*(1-u)),rh=('r',6,0+12*(1-u)),le=('e',6,8),re=('e',5,9))
clip('seatmouth','sitting upright on the front edge of a seat with knees together, raises both hands to her mouth to eat or sip',tail([SM(0),SM(1),SM(.4),SM(1)],True))
SHD=lambda b: SIT(8,22,b=b,lh=('r',13,10),rh=('r',12,11),le=('e',6,12),re=('e',5,13))
clip('seathold','sitting upright, knees together, both hands held together above her lap, looking down at her hands',tail([SHD(0),SHD(.5),SHD(.8),SHD(.5)],True))
HL=lambda b: P((X,HY+1+b),6,0,0,(X+5,G),(X-3,G),('r',11,3),('r',10,4),le=('e',6,10),re=('e',5,11),tilt=24)
clip('holdlook','shoulders hunched shyly, both hands held close under her chin, peering down at her hands',tail([HL(0),HL(.5),HL(.8),HL(.5)],True))
HE=lambda t: P((X,HY),2,0,0,(X+5,G),(X-3,G),('r',-1,-7),('r',7,20),le=('e',9,4),re=('e',-1,14),tilt=t)
clip('handear','near hand held to her ear, other hand at her stomach, small polite nods',tail([HE(0),HE(8),HE(0),HE(8)],True))
def swp(d):
    Hd=(X+30+d,G); T=(X+2+0.3*d,HY-30)
    at=lambda t:('a',Hd[0]+(T[0]-Hd[0])*t,Hd[1]+(T[1]-Hd[1])*t)
    return P((X+1+0.3*d,HY+5),22,0,0,(X+9+0.4*d,G),(X-4+0.2*d,G),at(.5),at(.75),tilt=20,lk=KNEE_FWD)
clip('sweep','pushing and pulling both hands forward and back at waist height, one hand above the other, small steps, head down diligently',tail([swp(0),swp(5),swp(8),swp(3),swp(-3),swp(-6)],True))
clip('liehold','lying on her back, both hands raised above her face, looking up at them',tail([LIE(-90,lh=('r',6,-10),rh=('r',5,-9),le=ELB_UP,re=ELB_UP),LIE(-90,b=.5,lh=('r',6,-10),rh=('r',5,-9),le=ELB_UP,re=ELB_UP),LIE(-90,lh=('r',6,-11),rh=('r',5,-10),le=ELB_UP,re=ELB_UP),LIE(-90,b=.5,lh=('r',6,-10),rh=('r',5,-9),le=ELB_UP,re=ELB_UP)],True))
C2=dict(lh=('r',13,12),rh=('r',11,14),le=('e',5,12),re=('e',3,13))
clip('carry2_idle','standing, both arms wrapped in a wide circle in front of her chest, leaning back a little',[P((X,HY+b),-3,0,0,(X+6,G),(X-4,G),tilt=6,**C2) for b in (0,.5,.8,.5)])
clip('carry2_walk','short careful steps with both arms wrapped in a wide circle in front of her chest',[walkh(i/8,C2,lean=-3) for i in range(8)])
clip('carry2_run','short-stepped hurried run with both arms wrapped in a wide circle in front of her chest',[runh(i/8,C2) for i in range(8)])
C1=dict(lh=('r',12,12),rh=('r',11,15),le=('e',4,12),re=('e',3,14))
clip('carry1_idle','standing, near hand held out at waist height with the other hand cupped politely under it',[P((X,HY+b),2,0,0,(X+5,G),(X-3,G),tilt=10,**C1) for b in (0,.5,.8,.5)])
clip('carry1_walk','walking carefully, near hand held out at waist height with the other hand cupped under it',[walkh(i/8,C1) for i in range(8)])
clip('carry1_run','hurrying with short steps, both hands cupped together in front of her waist',[runh(i/8,C1) for i in range(8)])

# ───────── 지형·이동 ─────────
group('지형·이동')
def front(p):
    q=dict(p); N=q['NECK']; hip=((q['RIGHT HIP'][0]+q['LEFT HIP'][0])/2,(q['RIGHT HIP'][1]+q['LEFT HIP'][1])/2)
    q['RIGHT SHOULDER']=(N[0]-8,N[1]+3.5); q['LEFT SHOULDER']=(N[0]+8,N[1]+3.5)
    q['RIGHT HIP']=(hip[0]-4.4,hip[1]); q['LEFT HIP']=(hip[0]+4.4,hip[1])
    q['RIGHT ELBOW']=(N[0]-6,N[1]+16); q['LEFT ELBOW']=(N[0]+6,N[1]+16)
    q['RIGHT ARM']=(N[0]-1,N[1]+21); q['LEFT ARM']=(N[0]+1,N[1]+21)
    q['RIGHT KNEE']=(hip[0]-5,hip[1]+19.7); q['LEFT KNEE']=(hip[0]+5,hip[1]+19.7)
    q['RIGHT LEG']=(hip[0]-5,G); q['LEFT LEG']=(hip[0]+5,G)
    no=(N[0],N[1]-6); q['NOSE']=no
    q['RIGHT EYE']=(no[0]-2.6,no[1]-2.6); q['LEFT EYE']=(no[0]+2.6,no[1]-2.6); q['RIGHT EAR']=(no[0]-6,no[1]-1); q['LEFT EAR']=(no[0]+6,no[1]-1)
    return q
FRONT=front(STAND(0))
clip('turn','turning around to face the viewer, a small bow of the head as she passes the front',[STAND(0),lerp(STAND(0),FRONT,.5),jit(FRONT,0,2,['NOSE','EYE','EAR'])])
FL=lambda b=0: P((X,HY-4+b),4,0,0,(X+8,G-14),(X-4,G-10),('r',4,-8),('r',2,-7),le=('e',8,-1),re=('e',7,0),tilt=16)
clip('fall','falling through the air, knees pulled up, both hands covering her head, hair flying upward',[FL(0),FL(1),FL(2)])
LD=P((X-2,HY+24),20,0,0,(X+13,G),(X-11,G),('r',18,24),('r',16,25),lk=KNEE_UP,rk=KNEE_UP,tilt=18)
clip('land','hard landing for her small body: knees buckle and she nearly sits down, catches herself, then lifts her hips and stands',[FL(0),LD,lerp(LD,STAND(0),.5)])
def lad(t):
    c=math.cos(2*math.pi*t)
    return P((X+3,HY-2),2,0,0,(X+12,G-6-7*c),(X+10,G-6+7*c-7),('a',X+15,HY-34+7*c),('a',X+15,HY-27-7*c),lk=KNEE_UP,rk=KNEE_UP,le=ELB_OUT,re=ELB_OUT,tilt=-8)
clip('ladder','climbing hand over hand and foot over foot, body pressed close, careful',tail([lad(i/7) for i in range(7)],True))
MA=P((X+4,HY-12),4,0,0,(X+10,G-14),(X+2,G-8),('a',X+16,HY-26),('a',X+15,HY-26),lk=KNEE_UP,rk=KNEE_UP,le=ELB_OUT,re=ELB_OUT,tilt=-10)
MB=P((X+6,HY-16),10,0,0,(X+4,G-22),(X+12,G-18),('a',X+18,HY-26),('a',X+17,HY-26),lk=KNEE_UP,rk=KNEE_UP,le=ELB_OUT,re=ELB_OUT,tilt=-6)
MC=P((X+14,HY-30),24,0,0,(X+22,HY-6),(X+6,G-24),('a',X+22,HY-26),('a',X+20,HY-26),lk=KNEE_UP,tilt=10)
MD=P((X+18,HY-40),4,0,0,(X+23,HY-6),(X+15,HY-6),tilt=6,**CLASP)
clip('mantle','hanging from a ledge by both hands, kicks her legs to scramble up, gets a knee on top, then stands',tail([STAND(0),MA,MB,MC,MD],False))
VA=P((X+6,HY+2),18,0,0,(X+14,G),(X-4,G),('a',X+22,HY+2),('a',X+20,HY+2))
VB=P((X+18,HY-14),4,0,0,(X+26,HY+4),(X+22,HY+6),('a',X+20,HY+3),('a',X+16,HY+3),lk=KNEE_UP,rk=KNEE_UP,tilt=8)
VC=P((X+32,HY+2),6,0,0,(X+38,G),(X+28,G-2),tilt=6,**CLASP)
clip('vault','sits down at waist height, swings both legs over together to the other side, slides down to standing',tail([walkf(0),VA,VB,VC],False))
def crawl(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X-8,HY+30),80,0,0,(X-28+5*c,G),(X-28-5*c,G-1),('a',X+14+5*c,G-1-2*max(0,sn)),('a',X+9-5*c,G-1-2*max(0,-sn)),head=(5,-3),tilt=-34,le=ELB_OUT,re=ELB_OUT)
clip('crawl','crawling low on knees and forearms, long hair trailing on the floor',tail([crawl(i/7) for i in range(7)],True))
def sneak(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+1,HY+4+abs(c)),6,0,0,(X+1+6*c,G-2*max(0,-sn)),(X+1-6*c,G-2*max(0,sn)),tilt=-12,lk=KNEE_UP,rk=KNEE_UP,**dict(lh=('r',10,14),rh=('r',9,15),le=('e',3,12),re=('e',2,13)))
clip('sneak','sneaking with eyes closed and chin raised, following a scent, soft careful steps, hands held in front',[sneak(i/8) for i in range(8)])
LT=dict(lh=('r',13,8),rh=('r',12,9),le=('e',5,11),re=('e',4,12))
LIGHT='a small flashlight clutched in both hands in front of her chest, pointing ahead'
clip('idle_light','standing nervously, a small flashlight clutched in both hands in front of her chest',[P((X,HY+b),3,0,0,(X+5,G),(X-3,G),tilt=2,**LT) for b in (0,.5,.8,.5)],LIGHT)
clip('walk_light','careful steps with a small flashlight clutched in both hands in front of her chest',[walkh(i/8,LT) for i in range(8)],LIGHT)
clip('run_light','hurried short steps with a small flashlight clutched in both hands in front of her chest',[runh(i/8,LT) for i in range(8)],LIGHT)
def LBK(a):
    p=STAND(0,tilt=4); n=p['NECK']
    p['NOSE']=(n[0]+4.4-8.8*a,n[1]-6.2)
    for k,v in (('RIGHT EYE',(-2.6,-2.6)),('LEFT EYE',(0,-3.5)),('RIGHT EAR',(-7,-1.8)),('LEFT EAR',(-5.3,-2.6))):
        p[k]=(p['NOSE'][0]+v[0]*(1-2*a),p['NOSE'][1]+v[1])
    return p
clip('lookback','glances back over her shoulder worriedly, then gives a small nod and faces forward',tail([LBK(0),LBK(.5),LBK(1),LBK(1),LBK(.5),STAND(0,tilt=12)],False))
HD=lambda b=0: P((X-4,HY+22+b),30,0,0,(X+10,G),(X-12,G-1),('r',5,-2),('r',4,-1),le=('e',9,6),re=('e',8,7),tilt=10,lk=KNEE_UP)
clip('hide','crouched small in hiding, both hands pressed over her mouth, eyes squeezed shut',tail([STAND(0),lerp(STAND(0),HD(),.5),HD(0),HD(1),HD(0)],True))

# ───────── 탐사 ─────────
group('탐사')
DO=lambda r: P((X+2*r,HY),4+8*r,0,0,(X+5+3*r,G),(X-3,G),('a',X+22+5*r,HY-6),('a',X+21+5*r,HY-5),le=('e',9,8),re=('e',8,9),tilt=-2)
clip('door','both hands reach forward at waist height and pull back gently, she leans her head forward to peek, then steps forward',tail([STAND(0),DO(0),DO(.5),DO(1),sh(walkf(.25),4),sh(walkf(.5),6)],False))
DCL=lambda r: P((X,HY),-2,0,0,(X+5,G),(X-3,G),('a',X-18+5*r,HY-6),('a',X-17+5*r,HY-5),head=(-3,-6.5),le=('e',-8,8),re=('e',-7,9),tilt=4)
clip('doorclose','turns her upper body back and gently pulls both hands back toward herself, careful not to make noise',tail([STAND(0),DCL(0),DCL(.5),DCL(1),STAND(0)],False))
KN=lambda r: P((X,HY),4,0,0,(X+5,G),(X-3,G),('a',X+20+2*r,HY-20),('r',7,20),le=('e',9,2),re=('e',-1,14),tilt=-2)
EARP=P((X+3,HY),12,0,0,(X+7,G),(X-3,G),('a',X+20,HY-14),('r',7,20),le=('e',9,4),re=('e',-1,14),head=(5,-5),tilt=6)
clip('knock','two small timid knocks with the knuckles, then leans in to listen',tail([STAND(0),KN(0),KN(1),KN(0),KN(1),EARP,EARP],False))
def pushb(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,HY+4),-16,0,0,(X-2+9*c,G-2*max(0,-sn)),(X-2-9*c,G-2*max(0,sn)),('a',X+14,HY-10),('a',X+13,HY-8),head=(-2,-6.5),tilt=-6,le=('e',6,4),re=('e',5,5))
clip('push','leans her back and shoulders hard backward, feet driving against the floor, straining with her body weight',tail([pushb(i/7) for i in range(7)],True))
IS=lambda r: P((X-2,HY+20),26,0,0,(X+10,G),(X-8,G),('r',12,14),('r',11,15),le=('e',4,12),re=('e',3,13),head=(5,-5),tilt=16+4*r,lk=KNEE_UP,rk=KNEE_UP)
clip('inspect','squats down with knees together and leans her face close to the floor, eyes closed, sniffing',tail([STAND(0),lerp(STAND(0),IS(0),.5),IS(0),IS(1),IS(0),IS(1)],True))
def lead(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+3,HY+abs(c)),6,0,0,(X+3+8*c,G-3*max(0,-sn)),(X+3-8*c,G-3*max(0,sn)),('r',-24,14),('r',8,18),head=(3.5 if c>0 else -3,-6.5),le=('e',-11,11),re=('e',1,14),tilt=4)
clip('leadhand','walks forward with her near arm stretched back low behind her as if holding a hand, often turning her head to look back',tail([lead(i/7) for i in range(7)],True))
BW=lambda a: P((X-1,HY),1+30*a,0,0,(X+5,G),(X-3,G),tilt=6+6*a,**CLASP)
clip('bow','a polite 30-degree bow with hands clasped at her stomach, then straightens',tail([STAND(0),BW(.5),BW(1),BW(1),BW(0)],False))
clip('elevwait','standing with hands clasped, looking up at the floor indicator, waiting patiently',[STAND(0,tilt=-14),STAND(.5,tilt=-14),STAND(.8,tilt=-12),STAND(.5,tilt=-14)])
FS=lambda b=0: P((X-4,HY+33+b),2,0,0,(X+14,G),(X+10,G),('r',12,24),('r',11,25),le=('e',4,15),re=('e',3,16),tilt=8,lk=KNEE_UP,rk=KNEE_UP)
FSQ=P((X-2,HY+20),16,0,0,(X+10,G),(X+2,G),('r',14,20),('r',13,21),le=('e',5,14),re=('e',4,15),lk=KNEE_UP,rk=KNEE_UP,tilt=10)
clip('floorsit','kneels and sits down neatly on the floor with her legs folded to one side',tail([STAND(0),lerp(STAND(0),FSQ,.5),FSQ,lerp(FSQ,FS(),.5),FS()],False))
FR=lambda b=0: P((X-6,HY+34),-4+b,0,0,(X+8,G),(X+5,G),('r',14,12),('r',13,13),le=('e',8,8),re=('e',7,9),tilt=18+2*b,lk=KNEE_UP,rk=KNEE_UP)
clip('floorrest','sitting on the floor hugging her knees, cheek resting on them, slow breathing',[FR(0),FR(.5),FR(1),FR(.5)])
AP=lambda a: P((X-1,HY),1+45*a,0,0,(X+5,G),(X-3,G),tilt=6+8*a,**CLASP)
clip('apology','three quick deep 45-degree apologetic bows in a row, hands clasped at her stomach',tail([STAND(0),AP(1),AP(.2),AP(1),AP(.2),AP(1),AP(0)],False))
def sniffwalk(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+1,HY+abs(c)),0,0,0,(X+1+6*c,G-2*max(0,-sn)),(X+1-6*c,G-2*max(0,sn)),tilt=-12+2*sn,lh=('r',9,14),rh=('r',8,16),le=('e',1,12),re=('e',0,13))
clip('sniffwalk','walking slowly with eyes closed and chin raised, sniffing in short breaths, leading the way by scent',[sniffwalk(i/8) for i in range(8)])

# ───────── 상태·결과 ─────────
group('상태·결과')
HU=lambda u: P((X,HY+2),10-6*u,0,0,(X+5,G),(X-3,G),('r',4+3*u,22-2*u),('r',7,22) if u else ('r',2,18),le=('e',-1,14),re=('e',0,15) if u else ('e',-3,13),tilt=16-14*u)
clip('hurtidle','hiding her pain: presses a hand to her side, then quickly lets go and straightens with a forced smile',tail([HU(0),HU(0),HU(1),HU(1)],True))
FE=lambda b: P((X+1,HY+2+b),8,0,0,(X+7,G),(X-3,G),('r',6,10),('r',8,9),le=('e',7,12),re=('e',8,11),tilt=4)
clip('fear','frightened, arms wrapped around herself and trembling, yet takes a brave half step forward',[FE(0),sh(FE(1),.6),sh(FE(0),1),sh(FE(1),1.6)])
NS=lambda d: P((X,HY+2*d),28+12*d,0,0,(X+7,G),(X-3,G),('r',6,-3),('r',4,20),le=('e',9,4),re=('e',-1,14),tilt=10)
clip('nausea','sudden nausea: doubles over with a hand over her mouth and the other on her stomach',tail([STAND(0),NS(0),NS(1),NS(0),NS(1)],False))
clip('bedlie','lying flat on her back, legs straight, hands folded neatly on her stomach, asleep',tail([LIE(-90,lh=('r',10,20),rh=('r',9,21)),LIE(-90,b=.5,lh=('r',10,20),rh=('r',9,21)),LIE(-90,b=.8,lh=('r',10,20),rh=('r',9,21)),LIE(-90,b=.5,lh=('r',10,20),rh=('r',9,21))],True))
VI1=P((X,HY),2,0,0,(X+5,G),(X-3,G),('r',16,14),('r',7,20),le=('e',6,10),re=('e',-1,14),head=(-3,-6.5),tilt=8)
clip('victory','puts the pistol away at her hip, reaches one hand out gently with a worried look, then bows her head',
     tail([READY(),HL1,STAND(0),VI1,VI1,BW(1),STAND(0)],False))

# ───────── 본부 업무 ─────────
group('본부 업무')
clip('chairsit','smooths the back of her jacket and lowers herself into a neat seated pose with nothing under her, knees together, hands on her lap',
     tail([STAND(0),P((X,HY),2,0,0,(X+5,G),(X-3,G),('r',-4,24),('r',-5,25),le=('e',-3,14),re=('e',-4,14),tilt=6),lerp(STAND(0),SIT(14),.5),SIT(10),SIT()],False))
TY=lambda r: SIT(4,10,lh=('r',18,12-1.5*r),rh=('r',16,12-1.5*(1-r)),le=('e',7,14),re=('e',6,15))
clip('typing','seated very upright with nothing in front, typing quickly and lightly with all ten fingers at desk height',tail([TY(0),TY(1),TY(0),TY(1)],True))
GC=lambda r: P((X,HY),4,0,0,(X+5,G),(X-3,G),('r',12,10-r),('r',10,14),le=('e',4,11),re=('e',3,13),tilt=16)
clip('gearcheck','checks her pistol: pulls out the magazine, looks, slides it back in, then holds the pistol in both hands and looks at it for a moment',tail([STAND(0),GC(0),GC(2),GC(0),HL(0)],False),GUN)
TI=lambda r: P((X,HY),2,0,0,(X+5,G),(X-3,G),('r',5,3+r),('r',6,6-r),le=('e',8,8),re=('e',7,10),tilt=10)
clip('tie','gently tightens her necktie knot with both hands and smooths her shirt collar',tail([STAND(0),TI(0),TI(2),TI(0),TI(2),STAND(0)],False))
TE=lambda a: P((X+2,HY+2),24,0,0,(X+7,G),(X-3,G),('r',22,20) if a else ('r',9,20),('r',8,21),le=('e',8,12) if a else ('e',0,14),re=('e',-1,14),tilt=14)
clip('teach','leans down patiently, points down at a spot with one hand, waits with hands clasped, points again',tail([STAND(0),TE(1),TE(1),TE(0),TE(0),TE(1)],False))

# ───────── 생활·여가 ─────────
group('생활·여가')
clip('seatrest','sitting upright without leaning back, hands resting together on her lap, calm',tail([SIT(4),SIT(4,b=.5),SIT(4,b=.8),SIT(4,b=.5)],True))
clip('seatthink','seated, eyes closed, head tilted as if recalling a remembered scent',tail([SIT(2,-6),SIT(2,-6,.5),SIT(2,-8,.8),SIT(2,-6,.5)],True))
clip('doze','seated upright, dozing: head slowly tips to the side and down, then she jolts awake',tail([SIT(4,6),SIT(4,20),SIT(4,32),SIT(4,0)],True))
YW=lambda a: P((X,HY),1-2*a,0,0,(X+5,G),(X-3,G),('r',6,-3*a+20*(1-a)),('r',5,-2*a+21*(1-a)),le=('e',8*a,8+6*(1-a)),re=('e',7*a-1,9+5*(1-a)),tilt=6-10*a)
clip('yawn','a small yawn hidden behind both hands, head tipping back slightly',tail([STAND(0),YW(.6),YW(1),YW(1),YW(0)],False))
STR=lambda u: P((X,HY-2*u),1-8*u,0,0,(X+5,G-3*u),(X-3,G-3*u),('r',26-18*u,4-34*u),('r',25-18*u,5-34*u),le=ELB_UP if u>.5 else ELB_DOWN,re=ELB_UP if u>.5 else ELB_DOWN,tilt=-8*u)
clip('stretch','laces her fingers and pushes both arms straight forward, then up overhead, rising on her toes, then relaxes',tail([STAND(0),STR(0),STR(.5),STR(1),STR(1),lerp(STR(1),STAND(0),.5),STAND(0)],False))
HF=lambda a: P((X,HY),2,0,0,(X+5,G),(X-3,G),('r',-2,-5+2*a),('r',7,20),le=('e',8,0),re=('e',-1,14),tilt=10)
clip('hairflip','tucks a lock of her side hair behind her ear with her fingertips',tail([STAND(0),HF(0),HF(1),HF(1),STAND(0)],False))
OF=lambda a: P((X+2*a,HY),4+16*a,0,0,(X+5+2*a,G),(X-3,G),('r',10+12*a,16-6*a),('r',9+12*a,17-6*a),le=('e',3+5*a,12-2*a),re=('e',2+5*a,13-2*a),tilt=8+10*a)
clip('offer','extends both hands forward together, palms up, and bows her head politely',tail([STAND(0),OF(.5),OF(1),OF(1),OF(.5),STAND(0)],False))

# ───────── 씻기 ─────────
group('씻기·집안일·운동')
BR=lambda d: P((X,HY),4,0,0,(X+5,G),(X-3,G),('r',6+d,0),('r',7,4),le=('e',9,6),re=('e',8,9),tilt=6)
clip('brushteeth','small brushing motions with one fist at her mouth, the other hand cupped under her chin',tail([BR(0),BR(2),BR(0),BR(2)],True))

# ───────── 사교 ─────────
group('사교')
GS=lambda a: P((X,HY),3,0,0,(X+5,G),(X-3,G),('r',14,12-3*a),('r',7,20),le=('e',6,10),re=('e',-1,14),tilt=8+4*a)
clip('gesture','talking with a small, careful open-palm gesture, the hand drifting down as her words trail off',tail([GS(1),GS(.5),GS(0),GS(0)],True))
LS=lambda b: P((X+1,HY+b),8,0,0,(X+6,G),(X-3,G),tilt=12,**CLASP)
clip('armscross','listening attentively, hands clasped, leaning slightly toward the speaker',[LS(0),LS(.5),LS(.8),LS(.5)])
clip('nod','several quick small nods',tail([STAND(0),STAND(0,tilt=14),STAND(0,tilt=6),STAND(0,tilt=14),STAND(0,tilt=6)],False))
HSH=lambda d: P((X,HY),2,0,0,(X+5,G),(X-3,G),('r',14,8+3*d),('r',13,9-3*d),le=('e',8,6),re=('e',7,7),tilt=8)
clip('headshake','waving both open hands quickly in front of her chest as if saying no, not at all',tail([STAND(0),HSH(1),HSH(-1),HSH(1),HSH(-1),STAND(0)],False))
WV=lambda d: P((X,HY),2,0,0,(X+5,G),(X-3,G),('r',12+2*d,-4),('r',7,20),le=('e',10,4),re=('e',-1,14),tilt=6)
clip('wave','a small shy wave with the hand raised only to chest height',tail([STAND(0),WV(0),WV(1),WV(-1),WV(1),WV(-1),STAND(0)],False))
HS=lambda d: P((X+2,HY),14,0,0,(X+7,G),(X-3,G),('r',24,14+1.5*d),('r',14,15),le=('e',9,11),re=('e',8,12),tilt=14)
clip('handshake','extends her near hand forward at waist height and shakes it gently with a slight bow, the other hand supporting her own forearm',tail([STAND(0),HS(0),HS(1),HS(-1),HS(1),STAND(0)],False))
PT=lambda d: P((X+2,HY),6,0,0,(X+7,G),(X-3,G),('r',24,-2+2*d),('r',7,20),le=('e',10,4),re=('e',-1,14),tilt=6)
clip('pat','reaches her hand forward at shoulder height, hesitates halfway, then pats gently twice',tail([STAND(0),P((X+1,HY),4,0,0,(X+6,G),(X-3,G),('r',16,6),('r',7,20),le=('e',8,6),re=('e',-1,14),tilt=6),PT(0),PT(1),PT(0),PT(1)],False))
PO=P((X+2,HY),4,0,0,(X+7,G),(X-3,G),('r',30,6),('r',7,20),re=('e',-1,14),tilt=8)
clip('point','points politely with her whole open hand, palm up, instead of a finger',[STAND(0),lerp(STAND(0),PO,.5),PO,PO])
SR=lambda a: P((X,HY-a),2,0,0,(X+5,G),(X-3,G),('r',12,14-2*a),('r',11,15-2*a),le=('e',5,11),re=('e',4,12),tilt=6+8*a)
clip('shrug','a small apologetic shrug with a troubled smile, head tilting',tail([STAND(0),SR(1),SR(1),SR(.5),STAND(0)],False))
HG=lambda a: P((X+4,HY),6,0,0,(X+9,G),(X+1,G),('r',14+4*a,4),('r',16+4*a,2),tilt=10,le=ELB_OUT,re=ELB_OUT)
clip('hug','steps forward carefully, wraps both arms forward in a gentle embrace around empty air and pats twice',tail([STAND(0),HG(1),HG(0),jit(HG(0),0,-1,['ARM']),HG(0)],False))

# ───────── 감정 ─────────
group('감정')
LG=lambda b: P((X,HY+b),6,0,0,(X+5,G),(X-3,G),('r',6,-2),('r',7,18),le=('e',8,5),re=('e',-1,13),tilt=4+3*b)
clip('laugh','a genuine laugh: covers her mouth with the back of her hand, eyes closing, shoulders shaking',tail([STAND(0),LG(0),LG(1.2),LG(0),LG(1.2),LG(0)],True))
GL=lambda u: P((X,HY-1.5*u),2,0,0,(X+5,G-2*u),(X-3,G-2*u),('r',9,9),('r',8,10),le=('e',4,11),re=('e',3,12),tilt=2)
clip('glad','happy: hands clasped together at her chest, bouncing lightly on her toes',tail([GL(0),GL(1),GL(0),GL(1)],True))
CY=lambda b: P((X,HY+b),6,0,0,(X+5,G),(X-3,G),('r',6,-5),('r',7,20),le=('e',9,3),re=('e',-1,14),tilt=16)
clip('cry','trying to smile but tears come: wipes the corner of her eye with the back of her glove',tail([STAND(0),CY(0),CY(1),CY(0),CY(1)],False))
WCR=lambda u: P((X-6,HY+8+22*u),-6+14*u,0,0,(X+6+6*u,G),(X-4+10*u,G),('r',10,10),('r',9,12),le=('e',6,8),re=('e',5,9),tilt=16+10*u,lk=KNEE_UP,rk=KNEE_UP)
clip('wallcry','leaning back, she slides down slowly to sit and hides her face against her knees',tail([WCR(0),WCR(.5),WCR(1),WCR(1)],False))
KC=lambda b: P((X,HY+21+b),20,0,0,(X-22,G-2),(X-26,G-3),('r',6,-4),('r',5,-3),le=('e',8,4),re=('e',7,5),tilt=24)
clip('kneelcry','kneeling on the floor with her face in both hands, shoulders shaking',[KC(0),KC(1),KC(0),KC(1)])
clip('sad','sad: clasped hands squeeze tightly, head bowed low',[STAND(0,tilt=20),STAND(.5,tilt=24),STAND(.8,tilt=24),STAND(.5,tilt=22)])
SHT=lambda a: P((X+2,HY),4+10*a,0,0,(X+7,G),(X-3,G),('r',8,-2),('r',7,-1),le=('e',9,4),re=('e',8,5),head=(5,-5.5),tilt=-6*a)
clip('shout','calls out a loud warning with both hands cupped around her mouth, leaning forward',tail([STAND(0),SHT(1),SHT(1),SHT(.6),STAND(0)],False))
DSL=lambda a: P((X+2,HY+2*a),8+22*a,0,0,(X+7,G),(X-3,G),('a',X+20,HY-6+4*a),('a',X+18,HY-5+4*a),le=('e',8,10),re=('e',7,11),tilt=14+16*a)
clip('deskslam','blaming herself: braces both hands flat in front at waist height and hangs her head low',tail([STAND(0),DSL(.5),DSL(1),DSL(1)],False))
SUP=P((X-4,HY),-6,0,0,(X+2,G),(X-8,G),('r',8,8),('r',7,9),le=('e',5,10),re=('e',4,11),head=(4,-6.6),tilt=-4)
clip('surprise','startled: eyes go round, both hands fly to her chest, half a step back',[STAND(0),SUP,SUP,lerp(SUP,STAND(0),.5)])
SFL=P((X-12,HY+36),-24,0,0,(X+10,G-14),(X+8,G-12),('r',8,8),('r',7,9),le=('e',5,10),re=('e',4,11),lk=KNEE_UP,rk=KNEE_UP,tilt=-6)
clip('startlefall','so startled she plops back onto her bottom, knees pulled together up, both hands still clutched at her chest',tail([STAND(0),SUP,lerp(SUP,SFL,.5),SFL],False))
PDN=P((X-4,HY+33),4,0,0,(X+14,G),(X+10,G),('r',12,24),('r',11,25),le=('e',4,15),re=('e',3,16),tilt=24,lk=KNEE_UP,rk=KNEE_UP)
clip('plopdown','exhausted, sinks weakly to the floor with her legs folded to one side, head drooping',tail([STAND(0),lerp(STAND(0),PDN,.4),lerp(STAND(0),PDN,.8),PDN,PDN],False))
EMB=lambda a: P((X,HY),2,0,0,(X+5,G),(X-3,G),('r',6,-4),('r',5,-3),le=('e',9,4),re=('e',8,5),head=(4.4-3*a,-6.2),tilt=10)
clip('embarrassed','embarrassed: presses both hands to her cheeks and turns her face away',tail([STAND(0),EMB(0),EMB(1),EMB(1),EMB(.5),EMB(1)],False))
AN=lambda a: P((X,HY),3,0,0,(X+5,G),(X-3,G),('r',11,8),('r',10,9),le=('e',5,10),re=('e',4,11),head=(4.4-1.5*a,-6.2),tilt=12)
clip('annoyed','troubled rather than angry: lips pressed, touches her two index fingertips together, eyes avoiding',tail([STAND(0),AN(0),AN(1),AN(0),AN(1),AN(1),AN(0)],False))
TK=lambda b: P((X,HY+b),1,0,0,(X+5,G),(X-3,G),('r',6,-1),('r',7,12),le=('e',9,5),re=('e',3,12),tilt=-10)
clip('think','thinking: index finger on her lips, looking up',tail([TK(0),TK(.5),TK(.8),TK(.5)],True))
BO=lambda u: P((X,HY-1.5*u),1,0,0,(X+5,G-2*u),(X-3,G),tilt=6,**CLASP)
clip('bored','bored: hands clasped, rocking forward onto her toes and back',tail([BO(0),BO(1),BO(0),BO(1)],True))

# talk 은 쟈알디처럼 기본 대기 장 + 입 2px 코드 파생(생성 아님)

A_KP=None   # 기준 그림의 실제 관절(기준 그림 생성 후 estimate 또는 STAND(0))
def kp(p):
    out=[]
    for k in J:
        z=8 if k.startswith('RIGHT') else 2 if k.startswith('LEFT') else 5
        out.append({'label':k,'x':round((p[k][0]+DX)/W,4),'y':round((p[k][1]+DY)/H,4),'z_index':z})
    return out
BONES=skel.BONES
def draw(p,s=2):
    im=Image.new('RGBA',(W*s,H*s),(44,56,62,255))
    d=ImageDraw.Draw(im); d.line([(0,(G+DY+8)*s),(W*s,(G+DY+8)*s)],fill=(120,130,140,255))
    q={k:((v[0]+DX)*s,(v[1]+DY)*s) for k,v in p.items()}
    for a,b in BONES:
        c=(255,90,90,255) if 'RIGHT' in a+b else (90,170,255,255) if 'LEFT' in a+b else (240,240,240,255)
        d.line([q[a],q[b]],fill=c,width=s)
    d.ellipse([q['NOSE'][0]-3,q['NOSE'][1]-3,q['NOSE'][0]+3,q['NOSE'][1]+3],fill=(255,230,80,255))
    return im
def cost(n): return 2 if n<=3 else 3 if n<=8 else 4
if __name__=='__main__':
    names=sys.argv[1:] or list(CLIPS)
    out=os.path.join(HERE,'../plan'); os.makedirs(out,exist_ok=True)
    s=2; per=8
    for i in range(0,len(names),per):
        part=names[i:i+per]
        sheet=Image.new('RGBA',(W*s*15//2,H*s*len(part)//2),(30,34,40,255))
        for j,n in enumerate(part):
            for f,p in enumerate(CLIPS[n][2]):
                sheet.alpha_composite(draw(p,s).resize((W*s//2,H*s//2)),(f*W*s//2,j*H*s//2))
            ImageDraw.Draw(sheet).text((4,j*H*s//2+4),n,fill=(255,255,0,255))
        sheet.save(f'{out}/plan-{i//per:02d}.png')
    bad=0
    for n,(a,_,ps) in CLIPS.items():
        for p in ps:
            for k,v in p.items():
                x,y=(v[0]+DX)/W,(v[1]+DY)/H
                if not(0.02<x<0.98 and 0.02<y<0.98): print('OUT',n,k,round(x,2),round(y,2)); bad+=1
    tot=sum(cost(len(v[2])) for v in CLIPS.values())
    print(len(CLIPS),'clips',sum(len(v[2]) for v in CLIPS.values()),'frames','cost',tot,'out-of-canvas',bad)
