# 로제몬 전 동작 뼈대 (animate_with_skeleton_v3용). 설계: docs/캐릭터제작서/동작설계_rojemon.md, 목록·장 수: tools/rojemon_defs.py
# 좌표는 192×144 캔버스 그대로(쟈알디 rig.py와 달리 오프셋 없음). 발목 바닥선 G=130, 발바닥 y=136, 서 있는 골반 (56,94).
# 오른쪽(동쪽)을 봄. RIGHT = 가까운 쪽 = 앞손·앞발. 기준 그림 base/A-pad.png 의 관절은 A_KP.
# 몸 길이는 기준 그림에서 잼: 허벅지 18, 정강이 18.5, 위팔 14, 아래팔 12, 몸통(골반→목) 30, 목→코 (7,-7). 쟈알디보다 다리가 짧고 작음.
# 동작 근거: 지휘법(준비 박·3박 도형·큐·다운비트), 마리오네트, 깜짝 반사, 펜슬 스커트 보행(보폭 짧게, 무릎 붙임).
import math,sys,os
from PIL import Image,ImageDraw
sys.path.insert(0,os.path.join(os.path.dirname(__file__),'..','..','..','..','tools'))
import rojemon_defs as D
J=['NOSE','NECK','RIGHT SHOULDER','RIGHT ELBOW','RIGHT ARM','LEFT SHOULDER','LEFT ELBOW','LEFT ARM','RIGHT HIP','RIGHT KNEE','RIGHT LEG','LEFT HIP','LEFT KNEE','LEFT LEG','RIGHT EYE','LEFT EYE','RIGHT EAR','LEFT EAR']
W,H=192,144
THIGH,SHIN,UARM,FARM,TORSO=18.5,18.5,14,12,30
G=130
X=56; HY=92.5
A_KP={'NOSE':(66,57),'NECK':(58,64),'RIGHT SHOULDER':(60,67),'RIGHT ELBOW':(66,80),'RIGHT ARM':(71,91),
      'LEFT SHOULDER':(55,67),'LEFT ELBOW':(50,80),'LEFT ARM':(47,91),
      'RIGHT HIP':(58,95),'RIGHT KNEE':(65,112),'RIGHT LEG':(68,130),'LEFT HIP':(54,95),'LEFT KNEE':(51,112),'LEFT LEG':(47,130),
      'RIGHT EYE':(63,54),'LEFT EYE':(66,53),'RIGHT EAR':(58,55),'LEFT EAR':(60,54)}

def rot(v,deg):
    r=math.radians(deg); return (v[0]*math.cos(r)-v[1]*math.sin(r), v[0]*math.sin(r)+v[1]*math.cos(r))
def add(a,b): return (a[0]+b[0],a[1]+b[1])
def _ik(root,target,a,b,bend):
    dx,dy=target[0]-root[0],target[1]-root[1]; d=max(1e-3,min(math.hypot(dx,dy),a+b-0.01)); base=math.atan2(dy,dx)
    c=max(-1,min(1,(a*a+d*d-b*b)/(2*a*d))); ang=base+bend*math.acos(c)
    mid=(root[0]+a*math.cos(ang),root[1]+a*math.sin(ang))
    t=math.atan2(target[1]-mid[1],target[0]-mid[0]); return mid,(mid[0]+b*math.cos(t),mid[1]+b*math.sin(t))
def ik(root,target,a,b,pick): return max((_ik(root,target,a,b,1),_ik(root,target,a,b,-1)),key=lambda r:pick(r[0]))
KF=lambda m:m[0]          # 무릎 앞
KU=lambda m:-m[1]
ED=lambda m:m[1]-0.8*m[0]  # 팔꿈치 아래·뒤
EU=lambda m:-m[1]
EO=lambda m:m[0]           # 팔꿈치 앞
EB=lambda m:-m[0]          # 팔꿈치 뒤

def P(hip,lean=2,s=0,h=0,lf=None,rf=None,lh='down',rh='down',head=(7,-7),tilt=0,lk=KF,rk=KF,le=ED,re=ED,torso=TORSO):
    """hip 골반, lean 몸통 앞기울기(도), s 어깨 회전(옆모습은 |s|<=0.25), h 골반 회전, lf/rf 앞발·뒷발 발목, lh/rh 앞손·뒷손 목표:
    'down' 'hip'(손을 허리에) ('a',x,y) 절대 ('r',dx,dy) 목 기준(몸통 기울기 따라 돎). le/re 팔꿈치 고르기 함수 또는 ('e',dx,dy) 직접."""
    N=add(hip,rot((0,-torso),lean)); p={'NECK':N}
    p['RIGHT SHOULDER']=add(N,rot((-5*s+1.5,3),lean)); p['LEFT SHOULDER']=add(N,rot((5*s-2.5,3),lean))
    p['RIGHT HIP']=add(hip,rot((2-4*h,0),lean)); p['LEFT HIP']=add(hip,rot((-2+4*h,0),lean))
    nose=add(N,rot(head,lean+tilt)); p['NOSE']=nose
    for k,v in (('RIGHT EYE',(-3,-3)),('LEFT EYE',(0,-4)),('RIGHT EAR',(-8,-2)),('LEFT EAR',(-6,-3))): p[k]=add(nose,rot(v,lean+tilt))
    def hand(side,t,pick):
        sh=p[f'{side} SHOULDER']
        if t=='down': tgt=add(sh,(1.5 if side=='RIGHT' else -1,24))
        elif t=='hip': tgt=add(hip,(0 if side=='RIGHT' else -3,-3))
        elif t[0]=='a': tgt=(t[1],t[2])
        elif t[0]=='r': tgt=add(N,rot((t[1],t[2]),lean))
        if isinstance(pick,tuple):
            p[f'{side} ELBOW']=add(N,rot((pick[1],pick[2]),lean)); p[f'{side} ARM']=tgt; return
        e,w=ik(sh,tgt,UARM,FARM,pick); p[f'{side} ELBOW']=e; p[f'{side} ARM']=w
    hand('RIGHT',lh,le); hand('LEFT',rh,re)
    lf=lf or (hip[0]+4,G); rf=rf or (hip[0]-3,G)
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
def _xs(a,b,c):
    u=(b[0]-a[0],b[1]-a[1]); f=(c[0]-b[0],c[1]-b[1]); n=math.hypot(*u)*math.hypot(*f) or 1
    return (u[0]*f[1]-u[1]*f[0])/n
def _mirror(p,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]; L=dx*dx+dy*dy or 1; t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L
    q=(a[0]+t*dx,a[1]+t*dy); return (2*q[0]-p[0],2*q[1]-p[1])
def anatomic(p):
    """팔꿈치는 앞으로만, 무릎은 뒤로만 접힘(오른쪽을 보는 옆모습). 거꾸로면 어깨-손목(골반-발목) 선에 대해 뒤집음."""
    q=dict(p)
    for s in ('RIGHT','LEFT'):
        if _xs(q[f'{s} SHOULDER'],q[f'{s} ELBOW'],q[f'{s} ARM'])>0.12: q[f'{s} ELBOW']=_mirror(q[f'{s} ELBOW'],q[f'{s} SHOULDER'],q[f'{s} ARM'])
        if _xs(q[f'{s} HIP'],q[f'{s} KNEE'],q[f'{s} LEG'])<-0.12: q[f'{s} KNEE']=_mirror(q[f'{s} KNEE'],q[f'{s} HIP'],q[f'{s} LEG'])
    return q
def path(keys,n):
    """핵심 자세 [(자세, 시각0~1)...]를 n장으로 (구간마다 직선 보간)"""
    out=[]
    for i in range(n):
        t=i/(n-1) if n>1 else 0
        for (a,ta),(b,tb) in zip(keys,keys[1:]):
            if ta<=t<=tb: out.append(lerp(a,b,(t-ta)/((tb-ta) or 1))); break
    return out

CLIPS={}   # 이름: (몸, [자세...])
def clip(name,poses,body='roje'):
    CLIPS[name]=(body,[anatomic(p) for p in poses])

# ── 기본 자세 ──
F=(X+4,G); R=(X-3,G)
STAND=lambda b=0,lh='down',rh='down',tilt=0,**k: P((X,HY+b),2,0,0,F,R,lh,rh,tilt=tilt,**k)
# 짝다리: 체중 뒷다리(곧게), 앞다리 무릎 살짝 앞으로, 골반이 뒤로 빠짐, 앞손 허리
HIPSHOT=lambda b=0,lh='hip',rh='down',tilt=0,lean=0,le=('e',-6,13),**k: P((X-2,HY+b),lean,0,0,(X+6,G-1),(X-3,G),lh,rh,tilt=tilt,le=le,**k)
CROSS=dict(lh=('r',6,13),rh=('r',4,14),le=('e',4,14),re=('e',-1,15))          # 팔짱
TEMPLE=('r',4,-6)                                                                # 관자놀이
READY=lambda d=0,b=0,**k: P((X-2+d,HY+1+b),-4,0.1,0,(X+5+d,G),(X-6+d,G),('r',16,9),TEMPLE,re=('e',-3,6),**k)   # 지휘 준비 박: 몸 뒤로 빠짐
SQUAT=lambda d=0,b=0,lh=('r',8,24),rh=('r',6,24),**k: P((X-3+d,121+b),10,0,0,(X+5+d,G),(X+0+d,G),lh,rh,lk=KF,rk=KF,**k)  # 무릎 모아 쪼그림
SEAT=lambda b=0,**k: P((X,108+b),-6,0,0,(X+16,G),(X+12,G),**k)                 # 의자(좌판 ~y110)
SEATX=lambda b=0,**k: P((X,108+b),-8,0,0,(X+20,123),(X+12,G),**k)              # 다리 꼬고 앉음(앞다리 들림)
FLOOR=lambda b=0,**k: P((X,126+b),-10,0,0,(X+16,124),(X+14,124),lk=KU,rk=KU,**k)   # 바닥에 앉아 무릎 세움(벽 등)
def LIE(b=0,lh=('a',40,108),rh=('a',38,112),tilt=0):
    """등 대고 누움(머리 왼쪽, 발 오른쪽), 몸통 가로"""
    return P((X+10,122+b),-90,0,0,(X+46,124),(X+45,125),lh,rh,head=(7,-2),tilt=tilt,lk=KU,rk=KU,le=EU,re=EU)

# ═════════ 전투 ═════════
# 1 기본 대기: 짝다리 + 앞손 허리(기본 이미지), 체중 옮기며 고개 까딱
clip('idle',[HIPSHOT(0),HIPSHOT(.5),HIPSHOT(1,tilt=4),HIPSHOT(.5)])
# 1+ 간식: 재킷 주머니(가슴 안쪽)에서 꺼내 한 입, 오물오물
sn=lambda t,b=0: HIPSHOT(b,lh=('r',4+3*t,8-12*t if t<1 else -3),le=('e',6,12))
clip('idle_snack',[HIPSHOT(0),sn(0),sn(.5),sn(1),sn(1,.6),sn(1,0)])
# 2+ 전투 진입: 허리 손을 떼고 두 손가락 관자놀이 → 준비 박
clip('engage',[HIPSHOT(0),P((X-2,HY),0,0,0,(X+6,G-1),(X-3,G),('r',8,10),('r',3,4)),P((X-2,HY+1),-2,0.05,0,(X+5,G),(X-5,G),('r',12,9),TEMPLE,re=('e',-3,6)),READY()])
# 2 전투 대기(지휘 준비 박): 앞손 가슴 높이 펼침, 손끝 미세 떨림
clip('guard',[READY(),READY(b=.5),READY(b=1),READY(b=.5)])
# 3 걷기: 팔짱, 보폭 6(쟈알디 11), 무릎 붙임, 어깨 들썩
def walkf(t,stride=6,lift=3,bob=1.2,arms=CROSS):
    c=math.cos(2*math.pi*t); sn_=math.sin(2*math.pi*t)
    lf=(X+2+stride*c,G-lift*max(0,-sn_)); rf=(X+2-stride*c,G-lift*max(0,sn_))
    return P((X+2,HY-.5+bob*abs(c)),1,0.1*c,0.15*c,lf,rf,tilt=2*c,**arms)
clip('walk',[walkf(i/8) for i in range(8)])
# 3+ 전투 걸음: 준비 박 유지, 종종 반 걸음 앞뒤
clip('step',[READY(0),READY(2,0.5),READY(4),READY(3,0.5),READY(1),READY(0)])
# 4 달리기: 보폭 10, 회전 빠름, 팔꿈치 붙이고 손만, 상체 꼿꼿
def runf(t,arms=None):
    c=math.cos(2*math.pi*t); sn_=math.sin(2*math.pi*t)
    lf=(X+4+10*c,G-6*max(0,-sn_)); rf=(X+4-10*c,G-6*max(0,sn_))
    a=arms or dict(lh=('r',7-4*c,17),rh=('r',3+4*c,17),le=('e',1,13),re=('e',-2,13))
    return P((X+4,HY-1+2*abs(sn_)),6,0.12*c,0.2*c,lf,rf,**a)
clip('run',[runf(i/8) for i in range(8)])
# 5 점프: 두 발 모아 깡총
jp=lambda tuck,b=0: P((X,HY-2+b),2,0,0,(X+3,G-tuck),(X,G-tuck),('r',8,18),('r',2,18),lk=KF,rk=KF)
clip('jump',[P((X-1,HY+7),8,0,0,(X+3,G),(X,G),('r',6,20),('r',0,20)),jp(4,-3),jp(10,-4),jp(8,-3),jp(3,0),P((X-1,HY+8),10,0,0,(X+4,G),(X,G),('r',14,14),('r',-4,12)),STAND(1)])
# 6 앉기: 뒤 치마 쓸며 쪼그림
clip('crouch',[STAND(0),P((X-2,HY+8),6,0,0,F,(X,G),'down',('r',-8,26)),P((X-3,HY+18),9,0,0,(X+5,G),(X,G),('r',8,22),('r',-6,24)),SQUAT()])
# 7 앉아 이동: 쪼그린 채 종종
clip('crouchwalk',[SQUAT(0),SQUAT(1.5,-1),SQUAT(3),SQUAT(4.5,-1),SQUAT(6),SQUAT(7.5,-1)])
# 8 하단: 쪼그려 바닥 톡
clip('lowcue',[SQUAT(),SQUAT(lh=('r',10,14)),SQUAT(lh=('r',22,30),le=EO),SQUAT(lh=('r',22,32),le=EO),SQUAT(lh=('r',16,26)),SQUAT()])
# 9 1타 「저기!」: 앞손 검지 큐 — 팔 곧게, 머리·상체 15도 따라감, 뒷발 고정
cue1a=P((X-1,HY+1),-2,0.05,0,(X+6,G),(X-6,G),('r',10,6),TEMPLE,re=('e',-3,6))
cue1b=P((X+2,HY+1),12,0,0,(X+8,G),(X-6,G),('r',29,4),('r',2,10),tilt=-4,le=EO)
clip('cue1',[READY(),cue1a,cue1b,cue1b,lerp(cue1b,READY(),.5)])
# 10 2타 「거기 말고!」: 뒷손 손등으로 가로질러 바깥으로(2박), 앞손은 가슴으로 돌아옴, 골반 따라 돎
c2a=P((X,HY+1),2,-0.15,-0.2,(X+7,G),(X-6,G),('r',6,12),('r',10,3),re=('e',4,8))
c2b=P((X+1,HY+1),6,0.2,0.3,(X+8,G),(X-6,G),('r',4,13),('r',26,10),re=EO)
c2c=P((X+1,HY+1),4,0.25,0.3,(X+8,G),(X-6,G),('r',4,13),('r',27,16),re=EO)
clip('cue2',[cue1b,c2a,c2b,c2c,c2c,lerp(c2c,READY(),.5)])
# 11 3타 「…당겨.」: 두 손으로 앞을 움켜쥐고 → 엉덩이 뒤로 빼며 체중으로 당김 → 뒤로 두 걸음 밀림
c3a=P((X+2,HY+2),14,0,0,(X+9,G),(X-5,G),('r',24,10),('r',22,12),re=EO,le=EO)
c3b=P((X-2,HY+5),-6,0,0,(X+9,G),(X-7,G),('r',18,12),('r',16,13),re=('e',6,14),le=('e',8,13))
c3c=P((X-7,HY+6),-16,0,0,(X+6,G),(X-12,G),('r',12,14),('r',10,15),re=('e',2,14),le=('e',4,13))
c3d=P((X-11,HY+5),-18,0,0,(X+0,G-3),(X-16,G),('r',10,14),('r',8,15),re=('e',1,14),le=('e',3,13))
c3e=P((X-12,HY+3),-10,0,0,(X-4,G),(X-17,G),('r',9,14),('r',7,15),re=('e',1,14),le=('e',3,13))
clip('cue3',[c2c,c3a,c3b,c3c,c3d,c3e,lerp(c3e,sh(READY(),-12),.5),sh(READY(),-12)])
# 12 돌진(달리며 A): 미끄러지며 멈춰 언더핸드 굴리기 — 뒷손이 뒤로 → 아래로 지나 앞으로 놓음
fl=lambda hand,lean,b=0,lf=(X+12,G),rf=(X-10,G): P((X+2,HY+4+b),lean,0,0,lf,rf,('r',2,14),hand,le=('e',2,13),re=ED)
clip('fling',[runf(0),fl(('r',-14,20),10),fl(('r',-10,26),18,3),fl(('r',10,30),24,4),fl(('r',24,22),20,3),fl(('r',22,14),10,1)])
# 13 공중: 두 손가락 아래로 찍기, 무릎 모음
ap=lambda hand,b=0: P((X,HY-6+b),4,0,0,(X+3,G-10),(X,G-11),hand,('r',2,10),lk=KF,rk=KF,le=EO)
clip('aircue',[ap(('r',10,-4)),ap(('r',14,-8)),ap(('r',18,24)),ap(('r',16,28)),ap(('r',12,20))])
# 14 원거리 준비 「눈 맞춰.」: 정지, 턱 당기고 머리 앞으로, 손바닥 얼굴 높이
st=lambda t: P((X,HY),4*t,0,0,F,R,('r',8+12*t,6-8*t),'down',head=(7+2*t,-7+1*t),tilt=8*t,le=EO)
clip('stare',[READY(),st(.4),st(.8),st(1)])
# 15 「돌아가.」: 손목 꺾어 검지로 적 뒤쪽 — 손이 위·바깥으로 툭
hy=P((X,HY),4,0,0,F,R,('r',26,-4),'down',head=(9,-6),tilt=8,le=EO)
clip('hypno',[st(1),lerp(st(1),hy,.5),hy,hy])
# 15+ 실패 반동: 눈 감싸고 반 걸음 휘청
hf=P((X-4,HY+2),-6,0,0,(X+2,G),(X-8,G),('r',6,-5),('r',-4,16),tilt=14,le=('e',6,6))
clip('hypnofail',[hy,lerp(hy,hf,.6),hf,lerp(hf,READY(),.4)])
# 16 실 걸기: 두 손가락 관자놀이에서 떼며 고개를 앞으로 홱
th=lambda tl,lean,hand=TEMPLE: P((X-1,HY+1),lean,0,0,(X+6,G),(X-6,G),('r',14,10),hand,tilt=tl,re=('e',-3,6))
clip('thread',[READY(),th(-14,-6),th(-18,-8),th(16,10,('r',8,-2)),th(20,12,('r',14,4)),th(6,2,('r',10,8))])
# 17 충전: 두 팔 머리 위로 벌려 듦, 손끝 떨림
cd=lambda b=0,w=0: P((X-1,HY+b),-4,0,0,F,(X-6,G),('r',12+w,-26),('r',-6-w,-25),le=EU,re=EU,tilt=-6)
clip('conduct',[cd(),cd(.5,1),cd(1),cd(.5,1)])
# 17+ 방출: 다운비트
db=P((X+2,HY+3),16,0,0,(X+8,G),(X-6,G),('r',22,22),('r',18,24),le=EO,re=EO,tilt=10)
clip('downbeat',[cd(),lerp(cd(),db,.4),db,db,lerp(db,READY(),.5)])
# 18 가드: 깜짝 반사 — 어깨 올림, 고개 숙임, 두 팔로 머리 감쌈, 앞무릎 듦
cw=lambda b=0: P((X-3,HY+4+b),14,0,0,(X+6,G-9),(X-5,G),('r',10,-8),('r',6,-10),tilt=22,le=('e',9,2),re=('e',6,0),head=(6,-5))
clip('cower',[READY(),lerp(READY(),cw(),.6),cw(),cw(.5)])
clip('cowerhit',[cw(),sh(cw(2),-3),sh(cw(1),-2),cw()])
# 20 회피(끌려가기): 머리 먼저 앞으로 끌림, 발끝 질질, 팔 뒤로 처짐, 착지 휘청
yk=lambda d,lean,lfy=G,rfy=G,b=0: P((X+d,HY-2+b),lean,0,0,(X+d-2,lfy),(X+d-10,rfy),('r',-6,18),('r',-10,16),head=(9,-6),le=EB,re=EB)
clip('yank',[READY(),yk(4,24,G,G),yk(14,34,G-3,G-1,-2),yk(24,30,G-2,G),P((X+28,HY+6),12,0,0,(X+36,G),(X+22,G),('r',14,14),('r',6,16)),P((X+28,HY+2),4,0,0,(X+33,G),(X+24,G),'down','down')])
# 21 잡기(E): 까치발로 한 손 멱살을 잡아 끌어내림
cl=lambda t: P((X+2,HY-1-2*t),6,0,0,(X+8,G-3*t),(X-4,G-3*t),('r',20,-2+10*t),('r',2,12),le=EO)
clip('collar',[READY(),cl(0),cl(.6),cl(1)])
# 22 노려보기: 얼굴을 들이밂
gl=lambda t: P((X+3+2*t,HY-3),8+6*t,0,0,(X+9,G-3),(X-3,G-3),('r',18,8),('r',2,12),head=(8+3*t,-6),le=EO)
clip('glare',[gl(0),gl(.6),gl(1),gl(.6)])
# 23 「돌아가.」 보내기: 멱살 놓고 손등으로 뒤쪽 휘저음, 턱 듦
so=P((X,HY),-4,0,0,F,R,('r',4,10),('r',22,0),tilt=-8,re=EO)
clip('sendoff',[gl(1),lerp(gl(1),so,.3),P((X+1,HY),0,0,0,F,R,('r',8,12),('r',14,10),tilt=-4,re=EO),so,so,HIPSHOT()])
# 24 앙상블: 두 팔 크게 벌려 올림 → 큰 원 → 가슴 앞으로 모아 내려침 → 펼친 채 고개 젖힘
s1=P((X,HY),-4,0,0,F,(X-6,G),('r',24,-14),('r',-16,-14),le=EU,re=EU,tilt=-4)
s2=P((X,HY-2),-8,0,0,F,(X-6,G),('r',12,-30),('r',-4,-30),le=EU,re=EU,tilt=-10)
s3=P((X+1,HY+2),6,0,0,(X+7,G),(X-6,G),('r',22,4),('r',16,6),le=EO,re=EO)
s4=P((X+2,HY+4),14,0,0,(X+8,G),(X-6,G),('r',12,16),('r',10,17),le=EO,re=EO,tilt=12)
s5=P((X,HY),-10,0,0,F,(X-6,G),('r',22,-6),('r',-14,-4),le=EU,re=EU,tilt=-18)
clip('super',[READY(),s1,s2,lerp(s2,s3,.5),s3,s4,s4,lerp(s4,s5,.5),s5,s5])
# 24+ 필살 뒤: 벽에 등 대고 미끄러져 주저앉아 간식
clip('superend',[STAND(0,tilt=-6),P((X-3,HY+8),-8,0,0,(X+5,G),(X-2,G)),P((X-4,HY+20),-10,0,0,(X+10,G),(X+6,G)),FLOOR(),FLOOR(lh=('r',8,8),le=('e',6,12)),FLOOR(lh=('r',8,-4),le=('e',6,10))])
# 25 줍기: 무릎 모아 옆으로 굽히고 뒷손 치마 누름, 손끝으로 집음
pk=lambda t: P((X-1,HY+18*t),10*t,0,0,(X+5,G),(X,G),('r',8+6*t,24),('r',-6,24),le=EO)
clip('pickup',[STAND(0),pk(.5),pk(1),pk(1),pk(.5),STAND(0)])
# 26 물건 던지기: 두 손 언더핸드 퍼 올림
ts=lambda h,lean,b=0: P((X,HY+b),lean,0,0,(X+6,G),(X-5,G),h,h,le=EO,re=EO)
clip('toss',[ts(('r',4,22),4),ts(('r',-2,28),10,3),ts(('r',10,30),8,2),ts(('r',24,6),-6),ts(('r',26,-4),-8,-1),STAND(0)])
# 27 마시기: 두 손으로 병, 고개 젖혀 홀짝 → 인상
dk=lambda t: P((X,HY),-3*t,0,0,F,R,('r',8,0-3*t),('r',7,2-3*t),tilt=-14*t,le=('e',7,12),re=('e',5,13))
clip('drink',[STAND(0),dk(0),dk(1),dk(1),dk(.4),P((X,HY),4,0,0,F,R,('r',6,10),('r',5,11),tilt=10)])
# 28 간식: 볼 터지게 넣고 오물오물
et=lambda t,tl=0: P((X,HY),2,0,0,F,R,('r',7+t,4-2*t),('r',5,12),tilt=tl,le=('e',7,12))
clip('eat',[STAND(0),et(0),et(2,-4),et(0,2),et(0,-2),et(0,2)])
# 29 붕대: 앞팔에 감다 이로 물어 끊음
bd=lambda t: P((X,HY),4,0,0,F,R,('r',10,12),('r',10+3*t,10-2*t),tilt=6+6*t,le=('e',8,14),re=('e',4,13))
clip('bandage',[STAND(0),bd(0),bd(1),bd(0),P((X,HY),8,0,0,F,R,('r',10,4),('r',8,6),tilt=10,le=('e',8,10),re=('e',4,11)),bd(.5)])
# 30 약 피격: 어깨 움츠리며 고개 옆으로
hit=P((X-4,HY+2),-8,0,0,(X+2,G),(X-8,G),('r',6,4),('r',-4,8),tilt=-16,le=('e',6,8))
clip('hit',[hit,sh(hit,-2),lerp(hit,READY(),.5),READY()])
# 31 강 피격·다운: 엉덩방아 → 벌러덩(다리 모음)
dn1=P((X-6,HY+4),-20,0,0,(X+2,G),(X-8,G),('r',4,-6),('r',-6,0),tilt=-14,le=EU)
dn2=P((X-12,118),-30,0,0,(X+6,G-6),(X+4,G-4),('r',-2,8),('r',-10,14),lk=KU,rk=KU)
dn3=P((X-14,126),-60,0,0,(X+10,G-14),(X+8,G-12),('r',-8,10),('r',-14,16),lk=KU,rk=KU,head=(7,-4))
dn4=LIE(lh=('a',30,118),rh=('a',28,121))
clip('down',[dn1,lerp(dn1,dn2,.5),dn2,dn3,lerp(dn3,dn4,.5),dn4,dn4,dn4])
# 32 기상: 팔꿈치 → 앉음 → 치마 정리 → 일어나 머리 털기
gu1=P((X-8,124),-70,0,0,(X+30,126),(X+28,127),('a',38,122),('a',36,124),lk=KU,rk=KU,head=(7,-4))
gu2=P((X-6,125),-20,0,0,(X+20,128),(X+18,128),('r',-2,24),('r',-8,22),lk=KU,rk=KU)
gu3=P((X-2,122),8,0,0,(X+6,G),(X+2,G),('r',12,22),('r',4,24))
clip('getup',[dn4,gu1,gu2,lerp(gu2,gu3,.5),gu3,P((X,HY+6),6,0,0,F,R,('r',10,20),('r',-6,24)),STAND(0,tilt=-8),HIPSHOT()])
# 34a 칭찬 두 번: 움찔 → 얼굴 감싸고 비틂 → 주먹 쥐고 한 발 쿵
pr1=P((X-1,HY+1),-4,0,0,F,R,('r',6,4),('r',4,6),tilt=-6,le=EO)
pr2=P((X-2,HY+2),8,0.2,0.2,(X+3,G),(X-5,G),('r',8,-4),('r',6,-5),tilt=18,le=('e',8,6),re=('e',5,6))
pr3=P((X+5,HY+1),6,0,0,(X+14,G),(X-2,G),('r',6,22),('r',-4,22),tilt=-6)
clip('praised',[HIPSHOT(),pr1,pr2,sh(pr2,-1),lerp(pr2,pr3,.5),pr3])
# 34b 인형극에 넋: 몸이 기운 채 멈춤 → 홱 돌아봄
pz=P((X+2,HY),8,0,0,F,R,'down','down',head=(9,-6),tilt=6)
clip('puppetshow',[pz,sh(pz,.5),pz,P((X,HY),0,0,0,F,R,('r',4,12),'down',head=(-2,-8))])
# 35 지원 등장: 뛰어 들어와 미끄러지며 멈춰 가리킴
clip('support',[runf(0),runf(.25),runf(.5),runf(.75),P((X+6,HY+5),-10,0,0,(X+16,G),(X-4,G),('r',8,14),('r',2,14)),cue1a,cue1b,cue1b])
# 36 눈 들여다보기: 두 손 얼굴 높이 앞, 까치발
pe=lambda t: P((X+2,HY-2*t),6+6*t,0,0,(X+8,G-3*t),(X-3,G-3*t),('r',20,-2),('r',18,0),head=(8+2*t,-6),le=EO,re=EO)
clip('peer',[STAND(0),pe(.3),pe(.7),pe(1),pe(1),pe(.6)])
# 37 인형 3체: 앞손 아래로, 뒷손 옆으로, 고개 셋째 박
t3=lambda a,b,tl: P((X-1,HY),-2,0.1,0,F,(X-6,G),('r',16,a),('r',10+b,4),tilt=tl,le=EO,re=EO)
clip('trio',[t3(-8,0,0),t3(4,8,6),t3(14,14,-4),t3(4,4,6),t3(-8,10,0),t3(4,16,-6),t3(14,4,4),t3(4,0,0)])
# 38 임시 둔기: 눈 감고 두 손 머리 위 → 내려침 → 무게에 끌려 고꾸라질 뻔
ws=lambda h,lean,d=0,b=0,lf=(X+6,G): P((X+d,HY+b),lean,0,0,lf,(X-5+d*.3,G),h,h,le=EU if h[2]<-10 else EO,re=EU if h[2]<-10 else EO,tilt=4)
clip('wswing',[ws(('r',6,10),2),ws(('r',2,-24),-12),ws(('r',14,-12),4),ws(('r',26,16),20,4,3,(X+14,G)),ws(('r',22,26),26,8,5,(X+18,G)),ws(('r',14,20),10,6,2,(X+16,G))])
# 39 임시 총: 두 팔 잠그고 고개 돌림, 반동 반 걸음
wf=lambda d,tl: P((X+d,HY),-4,0,0,(X+5+d,G),(X-6+d,G),('r',26,2),('r',25,3),le=EO,re=EO,head=(3,-8),tilt=tl)
clip('wfire',[wf(0,-10),wf(-3,-16),wf(-4,-14),wf(-2,-10),wf(0,-10)])
# 40 재장전: 허둥지둥
rl=lambda a,b,tl=10: P((X,HY),6,0,0,F,R,('r',10+a,14+b),('r',8,14),tilt=tl,le=('e',7,13),re=('e',4,13))
clip('reload',[rl(0,0),rl(-2,6),rl(2,12,16),rl(-1,4),rl(0,1),rl(0,0,6)])
# 41 피로: 무릎 짚고 헥헥
td=lambda b: P((X-2,HY+6+b),30,0,0,(X+6,G),(X-6,G),('r',12,30),('r',8,32),tilt=10)
clip('tired',[td(0),td(1),td(1.5),td(1)])
# 든 채: 둔기 품에 안기, 총 멀리 집어 듦
HUG=dict(lh=('r',8,12),rh=('r',7,13),le=('e',6,13),re=('e',3,14))
FAR=dict(lh=('r',16,22),le=EO)
clip('idle_weapon',[STAND(b,**HUG) for b in (0,.5,1,.5)])
clip('walk_weapon',[walkf(i/8,arms=HUG) for i in range(8)])
clip('run_weapon',[runf(i/8,arms=HUG) for i in range(8)])
clip('idle_gun',[STAND(b,**FAR) for b in (0,.5,1,.5)])
clip('walk_gun',[walkf(i/8,arms=dict(rh='down',**FAR)) for i in range(8)])
clip('run_gun',[runf(i/8,arms=dict(rh=('r',3,17),re=('e',-2,13),**FAR)) for i in range(8)])

# ═════════ 기본 클립 ═════════
rc=lambda t: P((X+t,HY-2*t/6),4+2*t,0,0,(X+5,G-2*t/6*1.5),(X-3,G-2*t/6*1.5),('r',10+t*2.5,8),'down',le=EO)
clip('reach',[STAND(0),rc(2),rc(4),rc(6),rc(6)])
pl_=lambda t: P((X-2*t,HY+3*t),6-14*t,0,0,(X+6,G),(X-5-3*t,G),('r',22-4*t,10),('r',20-4*t,11),le=EO,re=EO)
clip('pull',[pl_(0),pl_(.3),pl_(.7),pl_(1),pl_(.5)])
kn=lambda t: P((X,HY),4,0,0,F,R,('r',14+6*t,0+8*t),'down',le=('e',8,4),tilt=4)
clip('knock',[STAND(0),kn(0),kn(1),kn(0),kn(1)])
hw=lambda a: P((X,HY+1),8,0,0,F,R,('r',12+a,18),('r',10-a,19),le=('e',2,14),re=('e',-1,15),tilt=8)
clip('handswork',[hw(0),hw(1.5),hw(-1),hw(1.5)])
hh=lambda a: P((X,HY),4,0,0,F,R,('r',-2+a,-8),('r',-4-a,-6),le=EU,re=EU,tilt=10)
clip('handshead',[STAND(0),hh(0),hh(2),hh(-1),hh(2)])
mo=lambda a: P((X,HY),3,0,0,F,R,('r',8,2+a),('r',7,4+a),le=('e',6,12),re=('e',3,13),tilt=4)
clip('mouth',[mo(0),mo(-1),mo(0),mo(1)])
hl=lambda a: P((X,HY),6,0,0,F,R,('r',12,4+a),('r',10,5+a),le=('e',6,12),re=('e',3,13),tilt=10)
clip('holdlook',[hl(0),hl(.5),hl(1),hl(.5)])
he=lambda a: P((X,HY),2,0,0,F,R,('r',1,-6),'hip',le=('e',7,4),re=('e',-6,14),tilt=-10+a)
clip('handear',[he(0),he(3),he(0),he(-2)])
clip('chairsit',[STAND(0),P((X-2,HY+8),12,0,0,(X+8,G),(X+2,G)),P((X-1,104),-2,0,0,(X+14,G),(X+10,G)),SEAT(),SEATX()])
clip('seatrest',[SEATX(b,lean=-12,**CROSS) if False else P((X,108+b),-12,0,0,(X+20,123),(X+12,G),**CROSS) for b in (0,.4,.8,.4)])
sw=lambda a: P((X,108),10,0,0,(X+20,123),(X+12,G),('r',14+a,18),('r',12-a,19),le=EO,re=EO,tilt=10)
clip('seatwork',[sw(0),sw(1.5),sw(-1),sw(1.5)])
clip('seatmouth',[P((X,108),-4,0,0,(X+20,123),(X+12,G),('r',8,2+a),('r',4,18),le=('e',6,12),tilt=4) for a in (0,-1,0,1)])
clip('seathold',[P((X,108),-4,0,0,(X+12,112),(X+10,114),('r',12,4+a),('r',10,5+a),le=('e',6,12),re=('e',3,13),lk=KU,rk=KU,tilt=8) for a in (0,.5,1,.5)])
clip('floorsit',[STAND(0),P((X-3,HY+8),-6,0,0,(X+5,G),(X-1,G)),P((X-4,HY+18),-8,0,0,(X+9,G),(X+5,G)),P((X-2,120),-10,0,0,(X+14,G-2),(X+12,G-2)),FLOOR()])
clip('floorrest',[FLOOR(b,lh=('r',14,6),rh=('r',12,7),tilt=20) for b in (0,.5,1,.5)])
clip('lie',[LIE(b,lh=('a',40,104)) for b in (0,.5,1,.5)])
ls=lambda t: P((X+10-8*t,124-10*t),-90+80*t,0,0,(X+46-10*t,124+4*t),(X+45-10*t,125+4*t),('r',4,24),('r',-2,24) if t<1 else ('r',-2,-6),head=(7,-2-5*t),lk=KU,rk=KU,re=EU)
clip('liesit',[LIE(0),ls(.2),ls(.45),ls(.7),ls(.9),ls(1)])
clip('liehold',[LIE(b,lh=('a',72+b,96),rh=('a',70+b,97)) for b in (0,.5,0,.5)])
su=lambda t,d: P((X+d,HY-10*t),6,0.15,0.2,(X+6+d,G-12*t if t<1 else G-12),(X-2+d*0.5,G-12*max(0,t-.5)*2),('r',4,16),('r',-6,24),lk=KF)
clip('stepup',[STAND(0),su(.2,0),su(.5,2),su(.8,4),su(1,6),P((X+6,HY-12),3,0,0,(X+10,G-12),(X+3,G-12)),P((X+6,HY-12),2,0,0,(X+10,G-12),(X+3,G-12))])
so_=lambda hy,lean,lf,rf: P((X+4,hy),lean,0,0,lf,rf,('r',10,22),('r',-6,24),lk=KU,rk=KU)
clip('stepover',[STAND(0),so_(HY+6,-4,(X+10,G),(X+2,G)),so_(110,-8,(X+20,G-8),(X+16,G-8)),so_(110,-6,(X+26,G-4),(X+24,G-4)),so_(HY+4,4,(X+28,G),(X+22,G)),P((X+22,HY),2,0,0,(X+26,G),(X+19,G))])
cb=lambda t: P((X+2,HY-4+3*math.sin(t*math.pi*2)),-4,0,0,(X+6+3*math.cos(t*6.28),G-6-6*abs(math.sin(t*6.28))),(X+1-3*math.cos(t*6.28),G-6),('r',10,-24-6*math.sin(t*6.28)),('r',8,-22+6*math.sin(t*6.28)),le=EU,re=EU,lk=KF,rk=KF,tilt=-10)
clip('climb',[cb(i/8) for i in range(8)])
swp=lambda a: P((X-2,HY+1),-6,0,0,F,(X-6,G),('r',16+a,18),('r',10+a,10),le=EO,re=EO)
clip('sweep',[swp(0),swp(4),swp(8),swp(4),swp(0),swp(-3)])
BOX=dict(lh=('r',12,10),rh=('r',11,11),le=('e',8,12),re=('e',6,13))
clip('carry2_idle',[P((X,HY-2*t),0,0,0,(X+4,G-2*t),(X-3,G-2*t),head=(8,-7),tilt=-6,**BOX) for t in (1,1,.8,1)])
clip('carry2_walk',[walkf(i/8,stride=5,arms=BOX) for i in range(8)])
clip('carry2_run',[runf(i/8,arms=BOX) for i in range(8)])
ONE=dict(lh=('r',10,10),le=('e',6,13))
clip('carry1_idle',[HIPSHOT(b,rh='hip',**ONE) if False else P((X-2,HY+b),0,0,0,(X+6,G-1),(X-3,G),('r',10,10),'hip',le=('e',6,13),re=('e',-7,14)) for b in (0,.5,1,.5)])
clip('carry1_walk',[walkf(i/8,arms=dict(rh='down',**ONE)) for i in range(8)])
clip('carry1_run',[runf(i/8,arms=dict(rh=('r',3,17),re=('e',-2,13),**ONE)) for i in range(8)])

# ═════════ 생활 42~157 ═════════
clip('turn',[STAND(0),P((X,HY),0,0.6,0.5,(X+2,G),(X-1,G),head=(3,-8)),P((X,HY),0,1.0,0.9,(X+1,G),(X,G),head=(0,-8))])
fa=lambda a: P((X,HY-4),-4,0,0,(X+5,G-8),(X-3,G-4),('r',14+a,-14),('r',-12,-10+a),le=EU,re=EU,tilt=-8)
clip('fall',[fa(0),fa(3),fa(-2)])
clip('land',[P((X,HY+12),12,0,0,(X+5,G),(X-1,G),('r',16,6),('r',-10,6)),P((X-2,HY+20),14,0,0,(X+6,G),(X,G),('r',14,22),('r',-8,20)),P((X-1,HY+12),8,0,0,(X+6,G),(X-1,G),('r',14,18),('r',-6,18)),P((X,HY+2),4,0,0,(X+6,G-4),(X-2,G),('r',10,10),('r',-4,14)),P((X,HY+1),2,0,0,(X+5,G),(X-2,G-4),('r',10,12),('r',-4,14))])
mt=[P((X+4,HY-4),20,0,0,(X+6,G-2),(X-2,G),('r',16,-10),('r',14,-8),le=EU,re=EU),
    P((X+10,HY-18),70,0,0,(X+2,G-14),(X-4,G-10),('r',8,20),('r',6,22),lk=KU),
    P((X+14,HY-22),76,0,0,(X+4,G-18),(X-2,G-6),('r',6,24),('r',4,24),lk=KU),
    P((X+18,HY-24),30,0,0,(X+20,G-26),(X+6,G-22),('r',10,18),('r',4,20),lk=KU),
    P((X+20,HY-30),10,0,0,(X+26,G-30),(X+16,G-30),('r',8,18),('r',2,22)),
    P((X+22,HY-30),2,0,0,(X+26,G-30),(X+19,G-30))]
clip('mantle',mt)
cr=lambda t: P((X+2,116+1.5*math.sin(t*6.28)),78,0,0,(X-14+3*math.cos(t*6.28),G-2),(X-16-3*math.cos(t*6.28),G-2),('a',X+26+3*math.cos(t*6.28),126),('a',X+22-3*math.cos(t*6.28),126),lk=KU,rk=KU,le=('e',9,10),re=('e',7,11),head=(8,-2))
clip('crawl',[cr(i/8) for i in range(8)])
CLASP=dict(lh=('r',7,10),rh=('r',6,11),le=('e',4,13),re=('e',1,14))
def sneakf(t):
    c=math.cos(2*math.pi*t); sn_=math.sin(2*math.pi*t)
    return P((X+2,HY+3+abs(c)),8,0,0,(X+2+5*c,G-4*max(0,-sn_)),(X+2-5*c,G-4*max(0,sn_)),tilt=6,**CLASP)
clip('sneak',[sneakf(i/8) for i in range(8)])
lb=lambda t: P((X,HY),0,-0.6*t,-0.2*t,F,R,'hip',('r',-2,12),le=('e',-4,14),head=(7-12*t,-7),tilt=0)
clip('lookback',[HIPSHOT(),lb(.4),lb(.8),lb(1),lb(.5),HIPSHOT()])
hd_=lambda b: P((X-2,121+b),14,0,0,(X+5,G),(X+0,G),('r',9,-3),('r',8,-2),le=('e',7,6),re=('e',5,7),tilt=6)
clip('hide',[SQUAT(),hd_(0),hd_(.5),hd_(1),hd_(.5)])
ps_=lambda t: P((X+2*t,HY+4),-12,0,0,(X+10+2*t,G),(X+4+2*t,G),('r',-8,12),('r',-10,10),le=EB,re=EB,head=(6,-7),tilt=-6)
# 60 밀기: 팔을 곧게 잠그고 손바닥으로, 몸 전체를 40도로 기대 체중으로 밂, 까치발 종종(팔 힘 없음)
clip('push',[P((X+1.5*i,HY+3),34,0,0,(X-2+1.5*i+(4 if i%2 else 0),G-(3 if i%2 else 1)),(X-10+1.5*i-(4 if i%2 else 0),G-(1 if i%2 else 3)),('r',22,4),('r',21,6),le=EO,re=EO,tilt=-14) for i in range(8)])
clip('inspect',[STAND(0),pk(.6),SQUAT(lh=('r',22,30),le=EO),SQUAT(lh=('r',24,31),le=EO),SQUAT(lh=('r',14,20)),SQUAT(lh=('r',10,18),tilt=-8)])
clip('readwall',[P((X,HY),0,0,0,F,R,head=(7,-8),tilt=-8+b,**CROSS) for b in (0,1,2,1)])
def leadf(t):
    c=math.cos(2*math.pi*t); sn_=math.sin(2*math.pi*t)
    return P((X+4,HY-.5+abs(c)),8,0,0,(X+4+8*c,G-3*max(0,-sn_)),(X+4-8*c,G-3*max(0,sn_)),('r',6,16),('r',-22,16),re=EB)
clip('leadhand',[leadf(i/8) for i in range(8)])
clip('backpack',[SQUAT(),SQUAT(lh=('r',22,28),le=EO),SQUAT(lh=('r',24,32),le=EO),SQUAT(lh=('r',20,30),le=EO),SQUAT(lh=('r',23,33),le=EO),SQUAT(lh=('r',12,18))])
clip('bow',[HIPSHOT(),HIPSHOT(tilt=10),HIPSHOT(tilt=16),HIPSHOT(tilt=8),HIPSHOT(tilt=-4)])
WL=lambda b=0,tilt=0: P((X-2,HY+b),-4,0,0,(X+6,G),(X-1,G-14),tilt=tilt,rk=KF,**CROSS)
clip('elevwait',[WL(0,-10),WL(.5,-10),WL(1,-12),WL(.5,-10)])
clip('hurtidle',[P((X-1,HY+3+b),14,0,0,(X+4,G),(X-5,G),('r',4,22),('r',-12,14),tilt=10) for b in (0,1,1.5,1)])
def limpf(t):
    c=math.cos(2*math.pi*t); sn_=math.sin(2*math.pi*t)
    return P((X+2,HY+2+2*max(0,c)),12,0,0.2*c,(X+2+6*c,G-3*max(0,-sn_)),(X+2-6*c,G),('r',4,22),('r',-18,6),tilt=8,re=EB)
clip('limp',[limpf(i/8) for i in range(8)])
fr=lambda a: P((X-2,HY+2),6,0,0,(X+3,G),(X-4,G),('r',8,10+a),('r',6,12-a),le=('e',2,12),re=('e',-1,13),tilt=10)
clip('fear',[fr(0),fr(1),fr(-1),fr(1)])
nz=lambda t: P((X-1,HY+2+6*t),10+30*t,0,0,F,R,('r',10,-2),('r',22,6),le=('e',8,6),re=EO,tilt=10*t)
clip('nausea',[STAND(0),nz(.3),nz(.8),nz(1),nz(1),nz(.5)])
co1=P((X-2,HY+2),-6,0,0,(X+3,G),(X-6,G),('r',6,20),('r',-6,18),tilt=-10)
co2=P((X,112),6,0,0,(X+10,G-2),(X+4,G-4),('r',10,24),('r',4,24),lk=KF,rk=KF,tilt=10)
co3=P((X+4,122),40,0,0,(X+6,126),(X+2,127),('r',12,22),('r',6,24),lk=KU,rk=KU,tilt=20)
co4=P((X+10,126),80,0,0,(X-6,128),(X-8,128),('a',X+40,128),('a',X+30,129),lk=KU,rk=KU,head=(8,0))
clip('collapse',[co1,lerp(co1,co2,.5),co2,lerp(co2,co3,.5),co3,lerp(co3,co4,.5),co4,co4])
vc=[HIPSHOT(),P((X,HY),0,-0.3,0,F,R,'hip','down',head=(2,-8)),P((X-2,HY),0,0,0,(X+6,G-1),(X-3,G),'hip',('r',-4,6),le=('e',-4,14),tilt=-8),
    HIPSHOT(rh=('r',4,6)),HIPSHOT(rh=('r',6,0),tilt=4),HIPSHOT(rh=('r',7,-1),tilt=6),HIPSHOT(rh=('r',7,0),tilt=4)]
clip('victory',vc)
ty=lambda a: P((X,108),14,0,0,(X+20,123),(X+12,G),('r',16+a,14),('r',14-a,15),le=EO,re=EO,tilt=12)
clip('typing',[ty(0),ty(2),ty(0),ty(-2),ty(0),ty(2)])
clip('handover',[HIPSHOT(),P((X,HY),0,0,0,F,R,('r',14,10),'hip',le=EO,re=('e',-6,14),head=(2,-8)),P((X,HY),2,0,0,F,R,('r',24,6),'hip',le=EO,re=('e',-6,14),head=(2,-8)),P((X,HY),2,0,0,F,R,('r',25,6),'hip',le=EO,re=('e',-6,14),head=(1,-8)),HIPSHOT()])
clip('brief',[HIPSHOT(),P((X+2,HY),6,0,0,F,R,('r',24,-6),'hip',le=EO,re=('e',-6,14)),P((X+2,HY),8,0,0,F,R,('r',26,-4),'hip',le=EO,re=('e',-6,14)),P((X,HY),0,-0.2,0,F,R,('r',20,8),'hip',le=EO,re=('e',-6,14),head=(5,-8)),P((X,HY),0,-0.2,0,F,R,('r',22,8),'hip',le=EO,re=('e',-6,14),head=(5,-8))])
gc=lambda t: P((X,HY),2,0,0,F,R,('r',4+2*t,-6),'hip',le=('e',8,4),re=('e',-6,14),tilt=-8)
clip('gearcheck',[HIPSHOT(),gc(0),gc(1),gc(0),HIPSHOT()])
ti=lambda a: P((X,HY),2,0,0,F,R,('r',4,2+a),('r',3,3+a),le=('e',7,10),re=('e',5,11),tilt=12)
clip('tie',[STAND(0),ti(0),ti(-2),ti(2),P((X,HY),0,0,0,F,R,('r',6,8),('r',4,8),le=EO,tilt=-4)])
lk_=lambda a,b,tl=0: P((X,HY),2,0,0,F,R,a,b,tilt=tl,le=EO,re=EO)
clip('locker',[lk_(('r',18,0),'down'),lk_(('r',10,-4),('r',-6,8)),lk_(('r',-4,8),('r',-8,10),6),lk_(('r',2,10),('r',-10,8),8),lk_(('r',-2,-4),('r',-6,-6),-6),HIPSHOT()])
clip('seatthink',[P((X,108),-10,0,0,(X+20,123),(X+12,G),TEMPLE,('r',4,14),le=('e',6,4),re=('e',-1,15),tilt=-6+a) for a in (0,1,0,1)])
dz=lambda tl: P((X,108),-8,0,0,(X+20,123),(X+12,G),tilt=tl,**CROSS)
clip('doze',[dz(0),dz(16),dz(24),dz(-6)])
clip('walllean',[WL(b) for b in (0,.5,1,.5)])
clip('window',[P((X+3,HY+2),18,0,0,(X+7,G-(1 if a else 0)),(X-2,G),('r',14,-4),('r',12,-3),le=('e',12,8),re=('e',10,9),tilt=-12) for a in (0,1,0,1)])
clip('sleepside',[P((X+10,124+b),-90,0,0,(X+34,118),(X+32,120),('a',X+16,112),('a',X+14,114),lk=KF,rk=KF,head=(6,-2),le=('e',8,6),re=('e',6,7)) for b in (0,.5,1,.5)])
clip('toast',[P((X,108),-6,0,0,(X+20,123),(X+12,G),('r',8,14-6*t),('r',4,16),le=EO,head=(4-3*t,-8)) for t in (0,.5,1,1)])
clip('giftbox',[SQUAT(lh=('r',14,16),rh=('r',12,17)),SQUAT(lh=('r',15,12),rh=('r',13,13),tilt=6),SQUAT(lh=('r',13,12),rh=('r',11,13),tilt=6),SQUAT(lh=('r',16,20),rh=('r',8,8)),SQUAT(lh=('r',16,20),rh=('r',8,10),tilt=-6),SQUAT(lh=('r',14,18),rh=('r',12,18),tilt=6)])
clip('seatgame',[P((X,108),-6,a,0,(X+12,112),(X+10,114),('r',12,6),('r',10,7),le=('e',6,12),re=('e',3,13),lk=KU,rk=KU,tilt=8) for a in (0,.15,0,-.15)])
clip('music',[P((X,HY),-2,0,0,F,R,('r',12+a,4-a),'down',le=EO,tilt=-6+2*a) for a in (0,2,0,-2)])
clip('yawn',[STAND(0),P((X,HY),-4,0,0,F,R,tilt=-14),P((X,HY),-6,0,0,F,R,tilt=-18),P((X,HY),-4,0,0,F,R,('r',8,-2),'down',le=('e',8,8),tilt=-12),STAND(0)])
st_=lambda t: P((X,HY-2*t),-4*t,0,0,(X+4,G-3*t),(X-3,G-3*t),('r',4,-14-16*t),('r',2,-14-16*t),le=EU,re=EU,tilt=-10*t)
clip('stretch',[STAND(0),st_(.3),st_(.7),st_(1),st_(1),st_(.3)])
hf_=lambda t: HIPSHOT(rh=('r',2+4*t,-2-4*t),re=('e',-6,4),tilt=-6*t)
clip('hairflip',[HIPSHOT(),hf_(.3),hf_(.7),hf_(1),HIPSHOT(tilt=-4)])
pu=lambda t: P((X+4,122-5*t),82,0,0,(X-14,G-2),(X-16,G-2),('a',X+24,128),('a',X+22,128),lk=KU,rk=KU,le=EB,re=EB,head=(8,-2))
clip('pushup',[pu(1),pu(0),pu(.6),P((X+4,126),88,0,0,(X-14,G-2),(X-16,G-2),('a',X+26,129),('a',X+24,129),lk=KU,rk=KU,head=(8,0))])
sp=lambda t: P((X,126),-80+30*t,0,0,(X+14,118),(X+12,119),('r',-4,-6),('r',-6,-4),le=EU,re=EU,lk=KU,rk=KU,head=(7,-3))
clip('situp',[sp(0),sp(.5),sp(.3),sp(0)])
clip('gesture',[HIPSHOT(lh=('r',16,2+a),le=EO) for a in (0,-2,0,-2)])
clip('armscross',[P((X-2,HY+b),0,0,0,(X+6,G-(2 if b==1 else 1)),(X-3,G),tilt=-6,**CROSS) for b in (0,.5,1,.5)])
clip('nod',[HIPSHOT(),P((X-2,HY),0,0,0,(X+6,G-1),(X-3,G),'hip',le=('e',-4,14),head=(5,-8),tilt=14),HIPSHOT(tilt=2),HIPSHOT(tilt=0)])
hs=lambda a: P((X,HY),0,0,0,F,R,('r',16,-2),'down',le=EO,head=(7+a,-7),tilt=4)
clip('headshake',[HIPSHOT(),hs(0),hs(-3),hs(2),hs(-2)])
clip('wave',[HIPSHOT(),HIPSHOT(lh=('r',10,-2),le=EO),HIPSHOT(lh=('r',12,-3),le=EO,tilt=-4),HIPSHOT(lh=('r',10,-2),le=EO)])
pt=lambda t: P((X+2*t,HY),6*t,0,0,(X+6,G),(X-3,G),('r',14+12*t,6),'down',le=EO)
clip('pat',[STAND(0),pt(.5),pt(1),P((X-2,HY+2),-8,0,0,(X+5,G),(X-6,G),('r',10,10),'down',le=('e',6,12)),P((X-4,HY+2),-10,0,0,(X+3,G),(X-8,G),('r',4,10),'down',le=('e',4,13)),HIPSHOT()])
clip('shrug',[HIPSHOT(),P((X,HY-1),-4,0,0,F,R,('r',14,8),('r',-10,8),le=EO,re=EB,tilt=-8,head=(7,-8)),P((X,HY-2),-6,0,0,F,R,('r',15,6),('r',-11,6),le=EO,re=EB,tilt=-12,head=(7,-9)),P((X,HY-1),-4,0,0,F,R,('r',14,8),('r',-10,8),le=EO,re=EB,tilt=-8)])
clip('sigh',[STAND(0),STAND(-1,tilt=-8),STAND(0,tilt=-20),STAND(1.5,tilt=-16),STAND(1,tilt=-4)])
hg=lambda t: P((X+6*t,HY),8*t,0,0,(X+4+6*t,G),(X-3+4*t,G),('r',10+10*t,8-2*t),('r',8+10*t,9-2*t),le=EO,re=EO,head=(7+2*t,-6),tilt=14*t)
clip('hug',[STAND(0),hg(.4),hg(.8),hg(1),hg(1)])
clip('smile',[HIPSHOT(),HIPSHOT(tilt=8),P((X-2,HY),0,0,0,(X+6,G-1),(X-3,G),'hip',le=('e',-4,14),head=(3,-8),tilt=6),P((X-2,HY),0,0,0,(X+6,G-1),(X-3,G),'hip',le=('e',-4,14),head=(3,-8),tilt=8)])
clip('laugh',[STAND(0,tilt=-8),STAND(1,tilt=8),P((X,HY+1),6,0,0,F,R,('r',9,-1),'down',le=('e',7,8),tilt=8),P((X,HY+1),4,0,0,F,R,('r',9,-1),'down',le=('e',7,8),tilt=0,head=(7,-7)),P((X,HY),0,0,0,F,R,('r',9,-1),'down',le=('e',7,8),tilt=-4)])
gd=lambda a: P((X,HY-a),2,0,0,(X+4,G-a),(X-3,G-a),('r',8,8+a),('r',6,9+a),le=('e',6,12),re=('e',4,13))
clip('glad',[gd(0),gd(1.5),gd(0),P((X,HY),0,0,0,F,R,('r',8,8),('r',6,9),le=('e',6,12),re=('e',4,13),head=(3,-8))])
cy=lambda a: P((X,HY+1),8,0,0,F,R,('r',8,-4+a),'down',le=('e',8,6),tilt=14)
clip('cry',[cy(0),cy(1),cy(-1),cy(1),cy(0)])
clip('wallcry',[P((X+2,HY+1+b),16,0,0,(X+5,G),(X-4,G),('r',12,-2),('r',4,14),le=('e',10,6),tilt=10) for b in (0,1,.5,1)])
clip('kneelcry',[FLOOR(b,lh=('r',14,8),rh=('r',12,9),tilt=34) for b in (0,1,.5,1)])
clip('sad',[P((X,HY+1),4,0,0,F,R,tilt=22+b,**CROSS) for b in (0,1,2,1)])
clip('angry',[P((X,HY),4,0,0,(X+6,G-(5 if a else 0)),(X-3,G),('r',4,24),('r',-4,24),tilt=4) for a in (0,1,0,1)])
clip('shout',[STAND(0),P((X+2,HY-2),8,0,0,(X+6,G-3),(X-2,G-3),('r',6,26),('r',-6,26),tilt=-6),P((X+3,HY-3),12,0,0,(X+7,G-4),(X-1,G-4),('r',4,27),('r',-6,27),tilt=-10,head=(8,-6)),P((X+3,HY-3),12,0,0,(X+7,G-4),(X-1,G-4),('r',4,27),('r',-6,27),tilt=-10,head=(8,-6)),STAND(0)])
ds=lambda t: P((X+2,HY+2*t),14*t,0,0,(X+7,G),(X-3,G),('r',16,6+16*t),('r',14,6+16*t),le=EO,re=EO,tilt=6*t)
clip('deskslam',[STAND(0),ds(0),ds(1),P((X,HY),2,0,0,F,R,('r',10,10),('r',8,6),le=EO,re=EO,tilt=-6),P((X,HY),2,0,0,F,R,('r',11,8),('r',9,8),le=EO,re=EO,tilt=-4)])
clip('surprise',[STAND(0),P((X-2,HY-4),-8,0,0,(X+3,G-5),(X-4,G-5),('r',7,8),('r',6,9),le=('e',6,12),re=('e',4,13),tilt=-10),P((X-3,HY-1),-6,0,0,(X+2,G),(X-5,G),('r',7,8),('r',6,9),le=('e',6,12),re=('e',4,13),tilt=-8),P((X-3,HY),-4,0,0,(X+2,G),(X-5,G),('r',7,10),('r',6,11),le=('e',6,12),re=('e',4,13))])
clip('startlefall',[P((X-2,HY),-8,0,0,(X+3,G),(X-6,G),('r',8,8),('r',6,8),tilt=-10),P((X-8,HY+2),-14,0,0,(X-1,G-4),(X-12,G),('r',10,4),('r',-6,6)),P((X-14,116),-24,0,0,(X-2,G-6),(X-4,G-4),('r',10,6),('r',-10,14),lk=KU,rk=KU),P((X-16,126),-30,0,0,(X+2,124),(X,125),('r',-10,26),('r',-14,24),lk=KU,rk=KU),P((X-16,126),-26,0,0,(X+2,124),(X,125),('r',-10,26),('r',-14,24),lk=KU,rk=KU,tilt=-6)])
clip('embarrassed',[P((X,HY+1),8,0.1,0.1,(X+3,G),(X-4,G),('r',8,-4),('r',6,-5),le=('e',8,6),re=('e',5,6),tilt=14+a) for a in (0,2,0,2)])
clip('annoyed',[P((X-2,HY),-4,0,0,(X+6,G-1),(X-3,G),tilt=-14-a,**CROSS) for a in (0,3,6,3)])
clip('think',[HIPSHOT(lh=('r',8,0+a),le=('e',6,12),tilt=-10) for a in (0,1,0,1)])
bo=lambda c: P((X+c,HY+1),2,0,0.3*c,(X+4+c,G-(1 if c>0 else 0)),(X-3+c,G-(1 if c<0 else 0)),('r',-2,-6),('r',-4,12),le=EU,tilt=-4)
clip('bored',[bo(0),bo(1),bo(0),bo(-1)])

# ═════════ 꼬마 인형 (96×96 캔버스로 생성, 몸 약 34px) ═════════
# 꼬마는 별도 rig: 몸 비율이 크게 다름(큰 머리, 짧은 팔다리). 좌표 96×96, 발목 바닥선 KG=84.
# (rig_puppets.py 에서 정의)

if __name__=='__main__':
    pl={r['clip']:r for r in D.ROWS if r['make']=='pl' and r['body']=='roje'}
    miss=[c for c in pl if c not in CLIPS]; extra=[c for c in CLIPS if c not in pl]
    bad=[(c,len(CLIPS[c][1]),pl[c]['frames']) for c in pl if c in CLIPS and len(CLIPS[c][1])!=pl[c]['frames']]
    print('clips',len(CLIPS),'missing',miss,'extra',extra,'frame mismatch',bad)
    out=[]
    for n,(b,ps) in CLIPS.items():
        for i,p in enumerate(ps):
            for k,v in p.items():
                if not(2<v[0]<W-2 and 2<v[1]<H-2): out.append((n,i,k,[round(x) for x in v]))
    print('out of canvas',out[:20],len(out))
