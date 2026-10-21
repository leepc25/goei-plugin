# 쟈알디 전 동작 뼈대 (animate_with_skeleton_v3용). 사용자 2026-10-21 "계획안대로 전부 완성" 지시.
# 좌표는 skel.py와 같은 공간(기준표 A 패드 160×112, 발목 바닥선 y=100)에서 짓고, 내보낼 때 192×144 캔버스로 옮긴다(+2,+28).
# 오른쪽(동쪽)을 봄. RIGHT = 그림상 가까운 쪽 = 앞손·앞발(skel.py와 같은 약속). 홀스터는 가까운 쪽 허리.
# 근거: docs/캐릭터제작서/동작근거_쟈알디_무술.md (스탠스·잽·스트레이트·걸음·점프 킥·권총 5단계), 01_쟈알디.md 4장 행동표.
import math,json
from PIL import Image,ImageDraw
import skel
J=skel.J
THIGH,SHIN,UARM,FARM,TORSO=22.4,23.4,17,14,26
G=100               # 발목 바닥선
W,H=192,144; DX,DY=2,28
def rot(v,deg):
    r=math.radians(deg); return (v[0]*math.cos(r)-v[1]*math.sin(r), v[0]*math.sin(r)+v[1]*math.cos(r))
def add(a,b): return (a[0]+b[0],a[1]+b[1])
def _ik(root,target,a,b,bend):
    dx,dy=target[0]-root[0],target[1]-root[1]; d=max(1e-3,min(math.hypot(dx,dy),a+b-0.01)); base=math.atan2(dy,dx)
    c=max(-1,min(1,(a*a+d*d-b*b)/(2*a*d))); ang=base+bend*math.acos(c)
    mid=(root[0]+a*math.cos(ang),root[1]+a*math.sin(ang))
    t=math.atan2(target[1]-mid[1],target[0]-mid[0]); return mid,(mid[0]+b*math.cos(t),mid[1]+b*math.sin(t))
def ik(root,target,a,b,pick):
    return max((_ik(root,target,a,b,1),_ik(root,target,a,b,-1)),key=lambda r:pick(r[0]))
KNEE_FWD=lambda m:m[0]
KNEE_UP=lambda m:-m[1]
ELB_DOWN=lambda m:m[1]-0.8*m[0]
ELB_UP=lambda m:-m[1]
ELB_OUT=lambda m:m[0]
def P(hip,lean=4,s=0,h=0,lf=None,rf=None,lh='down',rh='down',head=(5,-7),tilt=0,lk=KNEE_FWD,rk=KNEE_FWD,le=ELB_DOWN,re=ELB_DOWN):
    """hip 골반 중심, lean 몸통 앞기울기(도, 음수=뒤로), s 어깨 회전(-1 앞손쪽 앞 ~ +1 뒷손쪽 앞), h 골반 회전,
    lf/rf 앞발·뒷발 발목 목표(절대), lh/rh 앞손·뒷손 목표: 'down' 'chin' 'out' 'hip' (dx,dy)=목 기준 ('a',x,y)=절대, tilt 고개 숙임(+)"""
    N=add(hip,rot((0,-TORSO),lean))
    p={'NECK':N}
    p['RIGHT SHOULDER']=add(N,rot((-6*s+1,4),lean)); p['LEFT SHOULDER']=add(N,rot((6*s-1,4),lean))
    p['RIGHT HIP']=add(hip,rot((-5*h,0),lean)); p['LEFT HIP']=add(hip,rot((5*h,0),lean))
    hv=rot(head,lean+tilt); nose=add(N,hv); p['NOSE']=nose
    for k,v in (('RIGHT EYE',(-3,-3)),('LEFT EYE',(0,-4)),('RIGHT EAR',(-8,-2)),('LEFT EAR',(-6,-3))): p[k]=add(nose,rot(v,lean+tilt))
    chin=add(nose,rot((1,4),lean+tilt))
    def hand(side,t,pick):
        sh=p[f'{side} SHOULDER']
        if t=='chin': tgt=chin if side=='LEFT' else add(chin,(4,-2))
        elif t=='out': tgt=(sh[0]+60,sh[1]-1)
        elif t=='down': tgt=add(sh,(2 if side=='RIGHT' else -1,29))
        elif t=='hip': tgt=add(hip,(-4,4))
        elif isinstance(t,tuple) and t[0]=='a': tgt=(t[1],t[2])
        else: tgt=add(N,t)
        e,w=ik(sh,tgt,UARM,FARM,pick); p[f'{side} ELBOW']=e; p[f'{side} ARM']=w
    hand('RIGHT',lh,le); hand('LEFT',rh,re)
    lf=lf or (hip[0]+8,G); rf=rf or (hip[0]-6,G)
    for side,an,pk in (('RIGHT',lf,lk),('LEFT',rf,rk)):
        k,a=ik(p[f'{side} HIP'],an,THIGH,SHIN,pk); p[f'{side} KNEE']=k; p[f'{side} LEG']=a
    return p
def lerp(a,b,t): return {k:(a[k][0]+(b[k][0]-a[k][0])*t,a[k][1]+(b[k][1]-a[k][1])*t) for k in J}
def staged(a,b,t):
    """하체 먼저, 팔은 늦게 (디딤발 → 허리 → 어깨 → 팔)"""
    out={}
    for k in J:
        tt=min(1,t*1.5) if ('HIP' in k or 'KNEE' in k or 'LEG' in k) else t**1.6 if ('ELBOW' in k or k.endswith(' ARM')) else min(1,t*1.2)
        out[k]=(a[k][0]+(b[k][0]-a[k][0])*tt,a[k][1]+(b[k][1]-a[k][1])*tt)
    return out
def sh(p,dx,dy=0): return {k:(v[0]+dx,v[1]+dy) for k,v in p.items()}
def jit(p,dx,dy,keys): return {k:((v[0]+dx,v[1]+dy) if any(s in k for s in keys) else v) for k,v in p.items()}

# ── 기본 자세 ──
O=-14   # 캔버스 안 기준 위치
X=69+O
GUARD=lambda d=0,b=0: P((X+d,60+b),5,-0.8,-0.5,(X+13+d,G),(X-13+d,G-2),(19,1),'chin')        # 전투 대기(스탠스, 두 손 얼굴 앞, 뒷발 뒤꿈치 듦)
STAND=lambda b=0,lh='down',rh='down',tilt=0: P((X,55+b),2,0,0,(X+6,G),(X-4,G),lh,rh,tilt=tilt)  # 기본 대기(반듯)
CROUCH=lambda d=0,b=0,lh=(17,2),rh='chin': P((X+d,79+b),6,-0.6,-0.4,(X+16+d,G),(X-19+d,G-1),lh,rh)  # 한쪽 무릎 세우고 앉음(뒷무릎 바닥)

CLIPS={}   # 이름: (설명 동작, 소품 설명, [자세...])
def clip(name,action,poses,prop=''):
    assert 3<=len(poses)<=15,(name,len(poses)); CLIPS[name]=(action,prop,poses)

# 1 기본 대기: 반듯이 섬, 아주 작은 호흡 (4)
clip('idle','calm standing idle, breathing',[STAND(0),STAND(0.5),STAND(1),STAND(0.5)])
# 1+ / 34 장갑 고쳐 끼기 (6): 뒷손(먼 손) 장갑 손목을 앞손이 당김
gl=lambda a: P((X,55),3,0.2,0,(X+6,G),(X-4,G),(9+a,14-a),(7,16),tilt=12)
clip('glove','adjusting the black glove at the wrist, looking down at the hands',[STAND(0),gl(0),gl(3),gl(0),gl(3),STAND(0)])
# 2 전투 대기 (4)
clip('guard','boxing guard stance idle, slight bounce',[GUARD(0,0),GUARD(0,1),GUARD(0,1.5),GUARD(0,1)])
# 3 걷기(탐사, 제자리 순환 8): 보폭 좁고 상체 고정, 팔은 작게 흔듦
def walkf(t,stride=11,lift=4,bob=1.2,lean=3,arm=7):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+2+stride*c, G-lift*max(0,-sn)); rf=(X+2-stride*c, G-lift*max(0,sn))
    return P((X+2,56+bob*abs(c)),lean,0.15*c,0.2*c,lf,rf,(2-arm*c,28),(-1+arm*c,28))
clip('walk','calm walk cycle, small steps, arms swing a little',[walkf(i/8) for i in range(8)])
# 3b 전투 걸음(밀고 끌기 6): 앞발 먼저, 뒷발 따라옴. 그림 안에서 14px 전진, 끝에서 코드가 위치 이동
def shuffle(ld,rd,ll,rl): return P((X+(ld+rd)/2,60),5,-0.8,-0.5,(X+13+ld,G-ll),(X-13+rd,G-2-rl),(19,1),'chin')
clip('step','boxing footwork: lead foot steps forward, rear foot slides after, guard up',[shuffle(5,0,3,0),shuffle(11,0,2,0),shuffle(14,0,0,0),shuffle(14,5,0,3),shuffle(14,11,0,2),shuffle(14,14,0,0)])
# 4 달리기(전투 질주 8, 제자리 순환): 상체 15도, 무릎 높이, 팔 꺾어 크게
def runf(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+6+19*c, G-12*max(0,-sn)-1); rf=(X+6-19*c, G-12*max(0,sn)-1)
    return P((X+8,58+2.5*abs(sn)),16,0.35*c,0.3*c,lf,rf,(8-14*c,14+4*c),(2+14*c,14-4*c),le=ELB_DOWN,re=ELB_DOWN)
clip('run','fast combat sprint, torso leaning forward, arms pumping hard, long hair streaming back',[runf(i/8) for i in range(8)])
# 5 점프 (8): 낮고 짧게. 높이는 코드가 더함. 0 웅크림 1 도약 2 상승(무릎 접음) 3 정점 4 하강 5 착지 직전 6 착지 웅크림 7 대기
air=lambda tuck,b=0: P((X,58+b),6,-0.6,-0.4,(X+10,G-2-tuck),(X-8,G-4-tuck*1.2),(17,0),'chin',lk=KNEE_FWD,rk=KNEE_FWD)
clip('jump','short low jump: crouch, spring up, tuck knees, land softly in guard',
     [GUARD(0,7),P((X+2,54),8,-0.6,-0.4,(X+8,G-2),(X-8,G-3),(14,-4),'chin'),air(10),air(14),air(9),air(3,-1),GUARD(0,7),GUARD(0,1)])
# 6 앉기 (4): 대기 → 한쪽 무릎 세우고 앉음(사격 자세)
clip('crouch','dropping into a one-knee kneel, upper body straight, guard up',[GUARD(0,0),lerp(GUARD(0,0),CROUCH(),.4),lerp(GUARD(0,0),CROUCH(),.8),CROUCH()])
# 7 앉아 이동 (6): 무릎 세운 채 앞발 내딛고 뒷무릎 끌기
cm=lambda d,ld: P((X+d,79),6,-0.6,-0.4,(X+16+ld,G-(2 if ld!=d else 0)),(X-19+d,G-1),(17,2),'chin')
clip('crouchwalk','kneeling shuffle forward on one knee, slow',[cm(0,0),cm(0,5),cm(2,9),cm(5,9),cm(8,9),cm(9,9)])
# 8 하단 공격 (6): 앉은 채 앞손 손바닥으로 앞 바닥을 짚음(폭발은 코드)
low=lambda t: P((X+3*t,79+t),6+22*t,-0.6-0.6*t,-0.4,(X+16,G),(X-19,G-1),('a',X+30+8*t,74+26*t),'chin')
clip('lowstrike','from a kneel, slams the lead palm flat onto the floor in front',[CROUCH(),low(.3),low(.8),low(1),low(1),lerp(low(1),CROUCH(),.6)])
# 9·10·11 3연타 (15장 한 번에): 잽(앞손, 예비동작 없음) → 스트레이트(뒷손) → 강한 스트레이트(앞손). 전진 6/10/20, 끝 장에서 코드 이동
G0=GUARD(0);G1=GUARD(6);G2=GUARD(16);G3=GUARD(36)
JAB=P((X+4,60),8,-1.2,-0.6,(X+19,G),(X-13,G-2),'out','chin')
CROSS=P((X+17,61),12,1.3,1.0,(X+23+6,G),(X-11+6,G-4),'chin','out',head=(6,-6))
POWER=P((X+15+16,64),15,-1.4,-0.9,(X+33+16,G),(X-11+16,G-2),'out','chin',head=(6,-6))
def slide(imp,g,t):
    m=lerp(imp,g,t); m['RIGHT LEG']=g['RIGHT LEG']; lift=4*(1-abs(2*t-1)); m['LEFT LEG']=(m['LEFT LEG'][0],m['LEFT LEG'][1]-lift); return m
clip('combo','three-punch boxing combo stepping forward: jab, cross, lead power straight',
     [G0,staged(G0,JAB,.5),JAB,slide(JAB,G1,.5),G1,staged(G1,CROSS,.35),staged(G1,CROSS,.7),CROSS,slide(CROSS,G2,.5),G2,
      staged(G2,POWER,.3),staged(G2,POWER,.65),POWER,slide(POWER,G3,.5),G3])
# 12 돌진(어깨 박치기 6): 질주 자세 → 상체 숙이고 앞어깨로 들이받음, 뒷다리로 밀기
DASH0=runf(0.25)
DASHL=P((X+10,64),24,-1.3,-0.8,(X+26,G),(X-10,G-3),(12,14),(4,10))
DASHH=P((X+24,62),30,-1.6,-1.0,(X+38,G),(X-6,G-6),(16,14),(6,12),head=(6,-5))
clip('dash','running shoulder charge: lowers the lead shoulder and slams forward, rear leg driving',[DASH0,DASHL,DASHH,sh(DASHH,2),lerp(DASHH,GUARD(20),.5),GUARD(22)])
# 13 공중 공격(점프 킥 6): 공중, 뒷무릎 접고 앞발을 앞 아래 대각으로 뻗어 참
kick=lambda e: P((X-2*e,56),-6-8*e,-0.6,-0.4,(X+14+20*e,G-14+10*e),(X-6,G-20),(15,2),'chin',rk=KNEE_FWD)
clip('airkick','mid-air front kick angled down and forward, rear knee tucked, guard up',[air(12),kick(.4),kick(1),kick(1),kick(.5),air(10)])
# 14 권총 뽑기 (5): 잡기 → 위로 뽑기 → 돌려 갈비 옆(근접 유지) → 한 손 뻗어 조준. 뒷손은 가슴
HP=(X+2,58)
gunP=lambda lh,lean=6: P(HP,lean,0.2,0.1,(X+13,G),(X-12,G-1),lh,(10,12))
clip('draw','drawing a pistol from the hip holster with the near hand and aiming it one-handed',
     [GUARD(0),gunP('hip'),gunP(('a',X-1,52)),gunP((8,20)),gunP('out',4)],'holding a black pistol')
# 15 원거리 발사 (4): 한 손 사격, 반동 작게
aim=gunP('out',4); rec=jit(aim,-2,-3,['RIGHT ARM']); rec=jit(rec,-1,-1,['RIGHT ELBOW'])
clip('fire','firing a pistol one-handed, small recoil',[aim,rec,lerp(rec,aim,.5),aim],'holding a black pistol, muzzle forward')
# 40 재장전 (6): 총을 가슴 앞으로, 뒷손 허리 탄창 → 총 아래 → 다시 조준
clip('reload','reloading the pistol: pulls it to the chest, rear hand fetches a magazine from the belt and slaps it in, then aims again',
     [aim,gunP((10,16)),P(HP,6,0.2,0.1,(X+13,G),(X-12,G-1),(10,16),('a',X+2,64)),P(HP,6,0.2,0.1,(X+13,G),(X-12,G-1),(10,16),(10,20)),gunP((14,12)),aim],'holding a black pistol')
# 16 고유기 짧게 (8): 앞손 손바닥을 앞 2칸 지점으로 뻗음. 준비 짧고 회수 김(폭발은 코드)
PALM=P((X+6,60),10,-1.2,-0.6,(X+20,G),(X-12,G-2),'out','chin',head=(6,-6))
PREP=P((X-2,61),0,-0.4,-0.3,(X+13,G),(X-14,G-1),(8,4),'chin')
clip('blast','thrusts the open lead palm forward at a point ahead, then slowly lowers it',[G0,PREP,staged(PREP,PALM,.6),PALM,PALM,lerp(PALM,G0,.25),lerp(PALM,G0,.55),G0])
# 17 고유기 충전 (4 반복): 앞손 뻗은 채 뒷손이 손목을 잡고 떨림
ch=lambda d: jit(P((X+4,62),6,-1.0,-0.5,(X+20,G),(X-14,G-1),(30,2),(24,4)),d,-d,['RIGHT ARM','LEFT ARM'])
clip('charge','holding the lead hand out, rear hand gripping the wrist, the hand trembles with built-up power',[ch(0),ch(1),ch(0),ch(-1)])
# 18 가드 (4): 앞팔을 세워 팔뚝으로 막음, 발 그대로
BLK=P((X,61),2,-0.9,-0.5,(X+13,G),(X-13,G-2),(13,-14),'chin',le=ELB_DOWN)
clip('block','raising the lead forearm vertically to block in front of the face',[G0,lerp(G0,BLK,.5),BLK,BLK])
# 19 가드 피격 (4)
BH=sh(P((X-2,61),-3,-0.9,-0.5,(X+13,G),(X-13,G-2),(13,-14),'chin'),0)
clip('blockhit','blocking forearm takes a hit and the upper body is pushed back slightly',[BLK,BH,lerp(BH,BLK,.5),BLK])
# 20 회피 (6): 짧고 낮은 스텝(방향은 코드), 잔상은 코드
EV=P((X-6,66),-4,-0.6,-0.4,(X+8,G-6),(X-20,G),(16,4),'chin')
clip('evade','quick low evasive step, body ducks briefly',[G0,lerp(G0,EV,.6),EV,lerp(EV,G0,.4),lerp(EV,G0,.75),G0])
# 21 잡기 (4): 앞손으로 멱살(가슴 높이) 잡음
GR=P((X+6,60),8,-1.2,-0.6,(X+20,G),(X-12,G-2),(30,0),'chin')
clip('grab','reaching out and grabbing an enemy by the collar with the lead hand',[G0,staged(G0,GR,.5),GR,GR])
# 22 잡기 타격 (4): 잡은 채 뒷무릎 치기
KN=P((X+8,58),2,-1.2,-0.6,(X+20,G),(X+18,G-38),(28,0),(14,6),rk=KNEE_UP)
clip('grabknee','holding the collar, drives the rear knee up into the enemy',[GR,lerp(GR,KN,.5),KN,lerp(KN,GR,.5)])
# 23 잡기 폭파 (8): 잡은 손에 힘 → 그 자리에서 터뜨려 날림(뒤로 젖혀지는 반동)
GX=P((X+8,61),10,-1.4,-0.7,(X+20,G),(X-12,G-2),(34,-2),'chin')
GB=P((X+2,62),-8,-1.0,-0.6,(X+20,G),(X-14,G-1),(30,-6),(4,6))
clip('grabblast','gripping the enemy, the hand flares and blasts them away, she leans back from the recoil',[GR,GR,GX,GX,GB,GB,lerp(GB,G0,.5),G0])
# 24 필살기 (10): 장갑 고쳐 끼기 2 → 한 걸음 → 두 손을 앞으로 → 유지 → 회수
SP=P((X+16,62),12,0,0,(X+32,G),(X,G-3),'out','out',head=(6,-6))
clip('super','adjusts her glove, takes one step, then thrusts both open hands forward to unleash a huge blast',
     [STAND(0),gl(0),gl(3),GUARD(0),staged(GUARD(0),SP,.4),staged(GUARD(0),SP,.8),SP,SP,lerp(SP,GUARD(16),.5),GUARD(16)])
# 25 상호작용·줍기 (6): 허리만 굽혀 앞 바닥에서 집음
PK=P((X+2,60),52,0,0,(X+10,G),(X-6,G),('a',X+28,G-2),(14,22),tilt=-10)
clip('pickup','bending at the waist to pick something up from the floor',[STAND(0),lerp(STAND(0),PK,.5),PK,PK,lerp(PK,STAND(0),.5),STAND(0)])
# 26 물건 던지기 (6): 한 손으로 툭
TB=P((X-2,56),-4,0.6,0.3,(X+8,G),(X-6,G),(-6,-6),(6,16))
TF=P((X+3,56),8,-0.8,-0.4,(X+10,G),(X-6,G),'out',(4,16))
clip('toss','casual one-handed toss of an object, little effort',[STAND(0),TB,lerp(TB,TF,.5),TF,lerp(TF,STAND(0),.5),STAND(0)],'holding a small object')
# 27 마시기 (6): 캔 커피 한 모금, 고개 젖힘
DR=lambda t: P((X,55),2,0,0,(X+6,G),(X-4,G),(6,-1),'down',tilt=-18*t)
clip('drink','taking one sip from a canned coffee, expressionless',[STAND(0,lh=(10,16)),DR(0),DR(1),DR(1),DR(0),STAND(0,lh=(10,16))],'holding a small coffee can')
# 28 먹기 (6): 작게 베어 묾
ET=lambda t: P((X,55),4,0,0,(X+6,G),(X-4,G),(7,0+2*t),'down',tilt=8)
clip('eat','taking small bites of a snack bar',[STAND(0,lh=(10,16)),ET(0),ET(1),ET(0),ET(1),STAND(0,lh=(10,16))],'holding a snack bar')
# 29 자기 치료 (6): 뒷팔을 앞에 들고 앞손으로 붕대를 감음
BD=lambda a: P((X,55),6,0.2,0,(X+6,G),(X-4,G),(14+4*math.cos(a),12+4*math.sin(a)),(16,12),tilt=14)
clip('bandage','wrapping a bandage around her forearm, gloves on',[BD(0),BD(1.6),BD(3.1),BD(4.7),BD(6.2),BD(7.8)],'white bandage roll')
# 30 약 피격 (4): 상체만 뒤로, 발 그대로
HL=P((X-3,61),-12,-0.8,-0.5,(X+13,G),(X-13,G-2),(15,4),(2,6),head=(4,-8))
clip('hit','light hit reaction: upper body snaps back, feet stay planted',[G0,HL,lerp(HL,G0,.5),G0])
# 31 강 피격·다운 (8): 날아가 등으로 떨어지고 한 손 짚음
K1=P((X-4,60),-25,-0.5,-0.3,(X+12,G),(X-14,G-2),(10,-10),(-4,-8),head=(3,-8))
K2=P((X-12,62),-55,0,0,(X+12,G-14),(X+2,G-12),(4,-20),(-6,-16))
K3=P((X-18,84),-78,0,0,(X+16,G-32),(X+8,G-24),(2,-26),(-10,-14),lk=KNEE_UP,rk=KNEE_UP)
K4=P((X-14,94),-90,0,0,(X+28,G-4),(X+20,G),(16,2),(2,8),lk=KNEE_UP,rk=KNEE_UP,re=ELB_UP)
K5=P((X-12,96),-92,0,0,(X+32,G),(X+28,G),(18,3),(4,8),re=ELB_UP)
K3,K4,K5=sh(K3,8),sh(K4,14),sh(K5,14)
clip('down','heavy hit: thrown backward through the air, lands on her back and braces one hand on the floor',[K1,K2,K3,K4,K5,K5,K5,K5])
# 32 기상 (6): 손 짚고 천천히
U1=P((X+2,94),-55,0,0,(X+22,G),(X+12,G),(6,10),('a',X-14,G),lk=KNEE_UP,rk=KNEE_UP)
U2=P((X-6,86),-10,0,0,(X+16,G),(X-16,G-1),(14,14),('a',X-22,G),rk=KNEE_FWD)
clip('getup','getting up from lying on her back, pushing off one hand, slowly, back to guard',[K5,U1,U2,CROUCH(),lerp(CROUCH(),G0,.5),G0])
# 34a 본부: 서류 검토 (6)
PA=lambda a: P((X,55),4,0.2,0,(X+6,G),(X-4,G),(12,14-2*a),(10,16),tilt=14)
clip('papers','standing and reading documents, turning a page',[PA(0),PA(0),PA(1),PA(2),PA(0),PA(0)],'holding a few sheets of paper')
# 34b 본부: 담배 (6)
SM=lambda t: P((X,55),2,0,0,(X+6,G),(X-4,G),(6,0) if t else (12,14),(10,16),tilt=-6*t)
clip('smoke','smoking a cigarette, exhaling, then stubbing it out in a pocket ashtray',[SM(0),SM(1),SM(1),SM(0),P((X,55),10,0,0,(X+6,G),(X-4,G),(16,18),(12,18),tilt=16),SM(0)],'holding a cigarette and a small pocket ashtray')
# 36 숙련 3 연쇄 폭파 (8): 손을 세 번 옮김(가까이·중간·멀리)
M3=lambda dy,dl: P((X+6,60),8+dl,-1.2,-0.6,(X+20,G),(X-12,G-2),(34,dy),'chin')
clip('chain','points the open palm at three spots in quick succession: near, middle, far',[G0,M3(8,0),M3(8,0),M3(0,2),M3(0,2),M3(-8,4),M3(-8,4),G0])
# 37 숙련 6 벽 통째로 (8): 낮게 버티고 두 손 크게 밀어냄
M6A=P((X-2,64),0,0,0,(X+16,G),(X-18,G),(10,6),(8,8))
M6=P((X+10,66),14,0,0,(X+26,G),(X-14,G),'out','out',head=(6,-6))
clip('wall','braces low with a wide stance and shoves both palms forward with full force',[G0,M6A,M6A,staged(M6A,M6,.6),M6,M6,lerp(M6,G0,.5),G0])
# 38 임시 둔기 휘두르기 (6): 쇠파이프를 어깨 위에서 앞 아래로
MB=P((X-2,58),-4,0.8,0.4,(X+12,G),(X-12,G-1),(-14,-10),(-10,-6),le=ELB_UP,re=ELB_UP)
MF=P((X+8,62),20,-0.8,-0.5,(X+22,G),(X-10,G-2),(28,22),(24,22))
clip('pipe','two-handed overhead swing of a steel pipe down and forward',[G0,MB,lerp(MB,MF,.5),MF,lerp(MF,G0,.5),G0],'holding a long steel pipe in both hands')
# 39 임시 총 사격 (4): 산탄총 두 손
SG=P((X,60),6,0.4,0.2,(X+13,G),(X-12,G-1),(28,8),(14,12))
SGR=jit(SG,-3,-2,['ARM','ELBOW'])
clip('shotgun','firing a pump shotgun held in both hands, strong recoil',[SG,SGR,lerp(SGR,SG,.5),SG],'holding a black pump shotgun in both hands')
# 41 피로·부상 대기 (4): 구부정, 고개 숙임, 뒷손 옆구리
FT=lambda b: P((X,57+b),10,0.3,0,(X+6,G),(X-4,G),(4,28),(2,18),tilt=20)
clip('tired','exhausted idle, slouched, head down, one hand pressed to her side, heavy breathing',[FT(0),FT(1),FT(2),FT(1)])

A_KP=skel.A
def kp(p):
    out=[]
    for k in J:
        z=8 if k.startswith('RIGHT') else 2 if k.startswith('LEFT') else 5
        out.append({'label':k,'x':round((p[k][0]+DX)/W,4),'y':round((p[k][1]+DY)/H,4),'z_index':z})
    return out
BONES=skel.BONES
def draw(p,base=None,s=2):
    im=Image.new('RGBA',(W*s,H*s),(44,56,62,255))
    if base: im.alpha_composite(base.resize((W*s,H*s),Image.NEAREST))
    d=ImageDraw.Draw(im); d.line([(0,(G+DY+8)*s),(W*s,(G+DY+8)*s)],fill=(120,130,140,255))
    q={k:((v[0]+DX)*s,(v[1]+DY)*s) for k,v in p.items()}
    for a,b in BONES:
        c=(255,90,90,255) if 'RIGHT' in a+b else (90,170,255,255) if 'LEFT' in a+b else (240,240,240,255)
        d.line([q[a],q[b]],fill=c,width=s)
    d.ellipse([q['NOSE'][0]-3,q['NOSE'][1]-3,q['NOSE'][0]+3,q['NOSE'][1]+3],fill=(255,230,80,255))
    return im
if __name__=='__main__':
    import sys
    base=Image.open('../full/A2-pad.png').convert('RGBA')
    names=sys.argv[1:] or list(CLIPS)
    s=2
    rows=[]
    for n in names:
        _,_,ps=CLIPS[n]
        row=Image.new('RGBA',(W*s*16,H*s),(30,34,40,255)); row.alpha_composite(draw(A_KP,base,s),(0,0))
        for i,p in enumerate(ps): row.alpha_composite(draw(p,None,s),((i+1)*W*s,0))
        ImageDraw.Draw(row).text((4,4),n,fill=(255,255,0,255)); rows.append(row)
    for i in range(0,len(rows),6):
        sheet=Image.new('RGBA',(W*s*16,H*s*len(rows[i:i+6])))
        for j,r in enumerate(rows[i:i+6]): sheet.alpha_composite(r,(0,j*H*s))
        sheet.resize((sheet.width//2,sheet.height//2)).save(f'../full/plan-{i//6}.png')
    for n,(a,_,ps) in CLIPS.items():
        for p in ps:
            for k,v in p.items():
                x,y=(v[0]+DX)/W,(v[1]+DY)/H
                if not(0.02<x<0.98 and 0.02<y<0.98): print('OUT',n,k,round(x,2),round(y,2))
    print(len(CLIPS),'clips',sum(len(v[2]) for v in CLIPS.values()),'frames')
