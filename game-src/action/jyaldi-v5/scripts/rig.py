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
        elif isinstance(t,tuple) and t[0]=='r': tgt=add(N,rot((t[1],t[2]),lean))   # 목 기준, 몸통 기울기 따라 돎
        else: tgt=add(N,t)
        if isinstance(pick,tuple) and pick[0]=='e':   # 팔꿈치 직접 지정(목 기준, 몸통 기울기 따라 돎). 가슴 앞 손에서 IK가 팔꿈치를 등 뒤로 보내는 것 방지
            p[f'{side} ELBOW']=add(N,rot((pick[1],pick[2]),lean)); p[f'{side} ARM']=tgt; return
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
def _xs(a,b,c):
    u=(b[0]-a[0],b[1]-a[1]); f=(c[0]-b[0],c[1]-b[1]); n=math.hypot(*u)*math.hypot(*f) or 1
    return (u[0]*f[1]-u[1]*f[0])/n
def _mirror(p,a,b):
    # 점 p를 직선 a-b에 대해 뒤집음(관절 길이 유지)
    dx,dy=b[0]-a[0],b[1]-a[1]; L=dx*dx+dy*dy or 1; t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L
    q=(a[0]+t*dx,a[1]+t*dy); return (2*q[0]-p[0],2*q[1]-p[1])
def anatomic(p):
    """사람 관절은 한쪽으로만 꺾임(오른쪽을 보는 옆모습). 팔꿈치: 아래팔은 위팔의 앞쪽으로 접힘(cross(위팔,아래팔)<=0).
    무릎: 정강이는 허벅지의 뒤쪽으로 접힘(cross>=0). 거꾸로면 팔꿈치·무릎을 어깨-손목(골반-발목) 선에 대해 뒤집음.
    IK 선택·직접 지정·lerp 중간 장 모두 여기서 한 번에 바로잡힘. 검사: audit_joints.py"""
    q=dict(p)
    for s in ('RIGHT','LEFT'):
        if _xs(q[f'{s} SHOULDER'],q[f'{s} ELBOW'],q[f'{s} ARM'])>0.12: q[f'{s} ELBOW']=_mirror(q[f'{s} ELBOW'],q[f'{s} SHOULDER'],q[f'{s} ARM'])
        if _xs(q[f'{s} HIP'],q[f'{s} KNEE'],q[f'{s} LEG'])<-0.12: q[f'{s} KNEE']=_mirror(q[f'{s} KNEE'],q[f'{s} HIP'],q[f'{s} LEG'])
    return q
def clip(name,action,poses,prop=''):
    assert 3<=len(poses)<=15,(name,len(poses)); CLIPS[name]=(action,prop,[anatomic(p) for p in poses])

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

# ── 수정 1차 (2026-10-21 사용자 검수) ──
# 걷기·달리기를 손 위치 고정판으로(물건 든 채)
def walkh(t,lh,rh,stride=11,lift=4,bob=1.2,lean=3):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,56+bob*abs(c)),lean,0.15*c,0.2*c,(X+2+stride*c,G-lift*max(0,-sn)),(X+2-stride*c,G-lift*max(0,sn)),lh,rh)
def runh(t,lh,rh):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+8,58+2.5*abs(sn)),14,0.3*c,0.3*c,(X+6+19*c,G-12*max(0,-sn)-1),(X+6-19*c,G-12*max(0,sn)-1),lh,rh)
def holdset(tag,lh,rh,prop,idle_b=(0,1,1.5,1)):
    clip(f'idle_{tag}',f'standing ready while holding {prop}',[P((X,57+b),4,-0.3,-0.2,(X+10,G),(X-9,G-1),lh,rh) for b in idle_b],'holding '+prop)
    clip(f'walk_{tag}',f'walking while holding {prop}',[walkh(i/8,lh,rh) for i in range(8)],'holding '+prop)
    clip(f'run_{tag}',f'running while holding {prop}',[runh(i/8,lh,rh) for i in range(8)],'holding '+prop)
# 쇠파이프: 두 손으로 비스듬히 세워 듦(야구 배트처럼 준비)
holdset('pipe',(10,10),(6,14),'a long steel pipe in both hands, angled upward over the shoulder')
# 산탄총: 낮춘 준비 자세(앞손 총열 덮개, 뒷손 손잡이), 총구 앞 아래
holdset('shotgun',(22,20),(8,16),'a black pump shotgun in both hands, muzzle pointing forward and down')
# 벽돌(던질 물건): 앞손 하나로 가슴 앞
holdset('brick',(12,12),'chin','a red brick in the near hand')
# 39 임시 총 사격(다시): 개머리판 어깨, 뒷손 손잡이(가슴), 앞손 총열 덮개 → 반동 → 펌프 당김·밀기
SA=P((X,60),6,0.2,0.1,(X+13,G),(X-12,G-1),(24,6),(8,6))
SR=P((X-3,60),0,0.2,0.1,(X+13,G),(X-12,G-1),(21,2),(5,3),head=(4,-7))
SP=P((X,60),6,0.2,0.1,(X+13,G),(X-12,G-1),(16,8),(8,6))
clip('shotgun2','firing a pump shotgun from the shoulder with both hands, strong recoil, then racks the pump',[SA,SR,lerp(SR,SA,.5),SP,SA,SA],'holding a black pump shotgun in both hands, stock against the shoulder')
# 38 쇠파이프 휘두르기(다시): 두 손으로 어깨 위에서 앞 아래로, 파이프는 모든 장에서 손에
PB=P((X-3,58),-6,0.8,0.4,(X+12,G),(X-12,G-1),(-4,-12),(-6,-8),le=ELB_DOWN,re=ELB_DOWN)
PF=P((X+8,62),18,-0.8,-0.5,(X+24,G),(X-10,G-2),(26,18),(22,20))
PI=P((X,57),4,-0.3,-0.2,(X+10,G),(X-9,G-1),(10,10),(6,14))
clip('pipe2','two-handed overhead swing of a steel pipe down and forward, the pipe stays in her hands the whole time',[PI,PB,lerp(PB,PF,.45),PF,lerp(PF,PI,.5),PI],'holding a long steel pipe in both hands')
# 8 하단 공격(다시) = 하단 킥: 무릎 앉은 자세에서 앞발을 바닥 따라 쓸듯 앞으로 뻗음
LK0=CROUCH()
LKC=P((X-2,80),0,-0.6,-0.4,(X+8,G-6),(X-19,G-1),(17,2),'chin')
LKE=P((X-4,82),-10,-0.6,-0.4,(X+40,G-2),(X-19,G-1),(15,0),'chin')
clip('lowkick','from a low crouch, sweeping low kick with the lead leg straight along the floor',[LK0,LKC,LKE,LKE,LKC,LK0])
# 18 가드(다시) = 전면 가드: 두 팔뚝을 세워 얼굴·가슴 앞을 막음, 팔꿈치 붙임
BF=P((X-1,61),2,-0.6,-0.4,(X+13,G),(X-13,G-2),(14,-4),(10,0))
clip('blockfront','raising both forearms in front of the face and chest in a tight front guard',[G0,lerp(G0,BF,.5),BF,BF])
# 7 앉아 이동(다시) = 쪼그려 걷기: 두 발 번갈아 짧은 보폭, 엉덩이 낮게(제자리 순환, 이동은 코드)
def duck(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,76+abs(sn)),12,-0.5,-0.3,(X+9+6*c,G-4*max(0,-sn)),(X-1-6*c,G-4*max(0,sn)),(17,4),'chin',rk=KNEE_FWD)
clip('duckwalk','squat walk: crouched low, small quick steps with both feet alternating, guard up',[duck(i/8) for i in range(8)])
# 22 잡기 타격(다시): 붙잡은 적(가까이)을 향해 뒷무릎을 앞으로 깊게
GR2=P((X+4,60),6,-1.2,-0.6,(X+16,G),(X-12,G-2),(24,2),'chin')
KN2=P((X+10,58),4,-1.0,-0.6,(X+16,G),(X+30,G-34),(22,4),(16,6),rk=KNEE_UP)
clip('grab2','grabbing an enemy close by the collar with the lead hand',[G0,staged(G0,GR2,.5),GR2,GR2])
clip('grabknee2','holding the collar of an enemy right in front, drives the rear knee forward and up into their stomach',[GR2,lerp(GR2,KN2,.5),KN2,lerp(KN2,GR2,.5)])

# 2 전투 대기 진입(해제 = 역재생): 반듯이 선 자세 → 스탠스
clip('engage','shifting from a relaxed stance into a boxing guard: steps the lead foot forward, raises both fists',[STAND(0),lerp(STAND(0),G0,.35),lerp(STAND(0),G0,.7),G0])
# 35 지원 요원 등장 전용: 걸어 들어와 멈춤 → 앞손 손바닥 내밀어 폭파 → 장갑 고쳐 끼기
clip('support','walks in, stops, thrusts the open palm forward to blast the area ahead, then calmly adjusts her glove',
     [walkf(0),walkf(.25),walkf(.5),STAND(0),PREP,PALM,PALM,lerp(PALM,STAND(0),.5),gl(0),gl(3),STAND(0)])

# ── 빠진 장면 (2026-10-21 사용자 지적: 휴식·부상·후송·승리·패배·이동 지형·본부 일상) ──
# 42 휴식(다락방): 바닥에 앉아 벽에 등 기대고 무릎 세움, 팔은 무릎 위
FS=lambda b=0: P((X-10,96),-8+b,0,0,(X+14,G),(X+9,G),('a',X+8,78+b),('a',X+4,80+b),head=(5,-7),tilt=-4,lk=KNEE_UP,rk=KNEE_UP)
FSQ=P((X-4,80),14,0,0,(X+12,G),(X+4,G),(14,16),(10,18),lk=KNEE_UP,rk=KNEE_UP)
clip('floorsit','sitting down on the floor to rest, back against the wall, knees up',[STAND(0),lerp(STAND(0),FSQ,.5),FSQ,lerp(FSQ,FS(),.5),FS()])
clip('floorrest','resting on the floor, back against the wall, knees up, arms on knees, slow tired breathing',[FS(0),FS(1),FS(2),FS(1)])
# 43 송신 장치 조작: 선 채 두 손을 앞 탁자 높이 장치에
TR=lambda a: P((X,56),8,0,0,(X+6,G),(X-4,G),(16,14-2*a),(12,16-2*(1-a)),tilt=12)
clip('transmit','operating a small field radio transmitter on a table in front of her, pressing keys',[TR(0),TR(1),TR(0),TR(1)],'a small field radio transmitter')
# 44 출동 중 부상: 가드 유지하나 구부정, 뒷손 옆구리 / 절뚝 걷기(뒷다리 끌기)
HU=lambda b: P((X,63+b),12,-0.6,-0.3,(X+12,G),(X-12,G-1),(17,4),(2,20),tilt=10)
clip('hurtidle','side view: injured, hunched over, near hand clutching her stomach, no guard, heavy breathing',[HU(0),HU(1),HU(2),HU(1)])
def limp(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    dip=3*max(0,c)
    return P((X+2,58+dip),9,0.1*c,0.15*c,(X+2+10*c,G-4*max(0,-sn)),(X+2-10*c,G-1*max(0,sn)),(14,10),(2,20),tilt=8)
clip('limp','side view: limping walk, stiff rear leg dragging on the floor, hand clutching her stomach',[limp(i/8) for i in range(8)])
# 45 쓰러짐(체력 0): 비틀 → 무릎 → 앞으로 엎어짐
KNEEL=P((X,78),10,0,0,(X-32,G-2),(X-36,G-3),(10,22),(6,22),tilt=16)
FD=P((X-6,94),86,0,0,(X-48,G-2),(X-50,G),('a',X+26,G),('a',X+18,G),tilt=10)
clip('collapse','defeated: staggers, drops to her knees, then falls forward face down and stays still',[G0,HL,lerp(HL,KNEEL,.5),KNEEL,KNEEL,lerp(KNEEL,FD,.5),FD,FD])
# 46 후송: 의무실 침대(높이 22px, 코드가 그림)에 누움 → 일어나 앉음 → 침대 끝에 걸터앉음
BL=lambda b=0: P((X-6,74),-90,0,0,(X+34,74),(X+32,76),(10,6+b),(4,10),re=ELB_UP)
BS1=P((X-6,74),-45,0,0,(X+34,74),(X+32,76),(14,14),('a',X-20,76))
BS2=P((X-4,74),-4,0,0,(X+36,72),(X+34,74),(16,16),(10,18))
BED=P((X-2,76),2,0,0,(X+18,G),(X+12,G),(14,18),(10,20),lk=KNEE_UP,rk=KNEE_UP)
clip('bedlie','lying on her back in an infirmary bed, asleep, slow breathing',[BL(0),BL(1),BL(1),BL(0)])
clip('bedwake','waking up in an infirmary bed: sits up slowly, then swings her legs down to sit on the edge',[BL(0),BS1,BS2,lerp(BS2,BED,.5),BED,BED])
# 47 승리·귀환: 스탠스 풀고 장갑 고쳐 끼고 반듯이
clip('victory','side view: victory fist pump, thrusts the fist high above her head, then stands straight',[G0,lerp(G0,STAND(0),.5),STAND(0),gl(0),gl(3),gl(0),STAND(0,tilt=-4)])
# 48 귀환 로프 오르기(제자리 순환, 위로 이동은 코드): 로프 x=X+14
RP=lambda a: P((X+2,60),-4,0,0,('a',X+12,90-6*a) if 0 else (X+12,90-6*a),(X+4,96),('a',X+14,8-14*a),('a',X+14,22-14*(1-a)),lk=KNEE_UP,rk=KNEE_UP,le=ELB_OUT,re=ELB_OUT)
clip('rope','climbing a vertical rope hand over hand, legs gripping the rope',[RP(0),RP(.33),RP(.66),RP(1),RP(.66),RP(.33)],'a thick vertical rope')
# 49 사다리 오르기(제자리 순환): 손발 번갈아
def lad(t):
    c=math.cos(2*math.pi*t)
    return P((X+2,58),2,0,0,(X+14,92-8*c),(X+12,92+8*c-8),('a',X+18,12+8*c),('a',X+18,20-8*c),lk=KNEE_UP,rk=KNEE_UP,le=ELB_OUT,re=ELB_OUT)
clip('ladder','climbing a vertical ladder, hands and feet alternating on the rungs',[lad(i/8) for i in range(8)],'a metal ladder')
# 50 턱 오르기: 허리 높이 턱(위 y=60, 앞 x=X+16)을 손 짚고 올라섬. 끝에서 코드가 (22,-40) 이동
MA=P((X,60),18,0,0,(X+8,G),(X-6,G),('a',X+18,60),('a',X+16,60))
MJ=P((X+6,40),30,0,0,(X+2,74),(X-4,78),('a',X+20,60),('a',X+18,60),lk=KNEE_UP,rk=KNEE_UP)
MK=P((X+12,30),26,0,0,(X+26,60),(X+4,72),('a',X+24,60),('a',X+22,60),lk=KNEE_UP)
MR=P((X+20,22),8,0,0,(X+28,60),(X+18,60),'down','down')
MS=P((X+22,15),2,0,0,(X+28,60),(X+18,60))
clip('mantle','climbing up onto a waist-high ledge: plants both hands on it, hops up, puts a knee on it, stands up on top',[STAND(0),MA,MJ,MK,MR,MS])
# 51 덕트 기어가기(제자리 순환): 네 발
def crawl(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X-8,76),72,0,0,(X-30+6*c,G),(X-30-6*c,G-1),('a',X+20+6*c,G-1-3*max(0,sn)),('a',X+14-6*c,G-1-3*max(0,-sn)),head=(6,-5),tilt=-30)
clip('crawl','crawling on hands and knees through a low duct',[crawl(i/8) for i in range(8)])
# 52 승강기 인사 / 53 버튼 누르기
BW=P((X-2,55),32,0,0,(X+6,G),(X-4,G),'down','down',tilt=8)
clip('bow','a polite formal bow, then straightens up',[STAND(0),lerp(STAND(0),BW,.5),BW,BW,STAND(0)])
BT=lambda r: P((X,55),4,-0.5*r,0,(X+6,G),(X-4,G),('a',X+26+3*r,46),'down')
clip('button','pressing an elevator panel button with the near hand',[STAND(0),staged(STAND(0),BT(0),.6),BT(0),BT(1),BT(0),STAND(0)])
# 54 본부 일상: 의자(좌판 높이 23px, 배경이 그림)
SIT=lambda lean=2,lh=(14,18),rh=(10,20),tilt=0,b=0: P((X-6,77+b),lean,0,0,(X+16,G),(X+12,G),lh,rh,tilt=tilt,lk=KNEE_UP,rk=KNEE_UP)
CRS=((4,14),(2,12))   # 팔짱
clip('chairsit','sitting down on a chair',[STAND(0),lerp(STAND(0),SIT(14),.5),SIT(14),SIT()])
clip('seatrest','side view, seated pose with nothing under her, leaning back, arms folded, calm',[SIT(-8,*CRS),SIT(-8,*CRS,b=0.5),SIT(-8,*CRS,b=1),SIT(-8,*CRS,b=0.5)])
DK=lambda a: SIT(12,('a',X+22,62-6*a),('a',X+16,63),tilt=14)
clip('deskwork','seated at an office desk doing paperwork: signing papers and stamping approvals',[DK(0),DK(.5),DK(1),DK(0),DK(1),DK(0)],'a pen and a rubber stamp, papers on the desk')
clip('seatthink','seated, leaning back in the chair with eyes closed, thinking, arms crossed',[SIT(-14,*CRS,tilt=-8),SIT(-14,*CRS,tilt=-8,b=0.5),SIT(-14,*CRS,tilt=-8,b=1),SIT(-14,*CRS,tilt=-8,b=0.5)])
WL=lambda b=0: P((X-4,55+b),-5,0.3,0.2,(X+10,G),(X-2,G),*CRS,tilt=-2)
clip('walllean','leaning her back against a wall, arms crossed, relaxed',[WL(0),WL(.5),WL(1),WL(.5)])
STX=lambda b=0: P((X,55+b),2,0,0,(X+6,G),(X-4,G),*CRS)
clip('armscross','standing with arms crossed, listening to someone talk',[STX(0),STX(.5),STX(1),STX(.5)])
CF=P((X,55),6,-0.4,0,(X+6,G),(X-4,G),('a',X+28,48),'down')
CC=P((X,55),4,-0.4,0,(X+6,G),(X-4,G),('a',X+28,60),'down')
clip('coffee','making coffee at a machine: presses the button, waits, takes the paper cup and holds it at her chest',[STAND(0),CF,CF,CC,STAND(0,lh=(10,14)),STAND(0,lh=(10,14))],'a paper coffee cup')
PH=lambda t: P((X,55),2,0,0,(X+6,G),(X-4,G),(-1,-8),'down',tilt=t,le=ELB_DOWN)
clip('phone','standing and talking on a mobile phone held to her ear',[PH(0),PH(3),PH(0),PH(-2)],'a black smartphone')
GS=lambda a: P((X,55),2,-0.2,0,(X+6,G),(X-4,G),(16,8-4*a),'down')
clip('gesture','talking with a small open-hand gesture, calm',[GS(0),GS(1),GS(.5),GS(0)])

# ── 생활·감정·지형 전체 목록 (docs/캐릭터제작서/공통_생활동작목록.md, 2026-10-21) ──
def front(p):
    """정면을 향한 자세로 바꿈(돌아서기 중간 장): 어깨·골반 좌우로 벌리고 얼굴 정면"""
    q=dict(p); N=q['NECK']; hip=((q['RIGHT HIP'][0]+q['LEFT HIP'][0])/2,(q['RIGHT HIP'][1]+q['LEFT HIP'][1])/2)
    q['RIGHT SHOULDER']=(N[0]-9,N[1]+4); q['LEFT SHOULDER']=(N[0]+9,N[1]+4)
    q['RIGHT HIP']=(hip[0]-5,hip[1]); q['LEFT HIP']=(hip[0]+5,hip[1])
    q['RIGHT ELBOW']=(N[0]-11,N[1]+18); q['LEFT ELBOW']=(N[0]+11,N[1]+18)
    q['RIGHT ARM']=(N[0]-12,N[1]+31); q['LEFT ARM']=(N[0]+12,N[1]+31)
    q['RIGHT KNEE']=(hip[0]-6,hip[1]+22); q['LEFT KNEE']=(hip[0]+6,hip[1]+22)
    q['RIGHT LEG']=(hip[0]-6,G); q['LEFT LEG']=(hip[0]+6,G)
    no=(N[0],N[1]-8); q['NOSE']=no
    q['RIGHT EYE']=(no[0]-3,no[1]-3); q['LEFT EYE']=(no[0]+3,no[1]-3); q['RIGHT EAR']=(no[0]-7,no[1]-1); q['LEFT EAR']=(no[0]+7,no[1]-1)
    return q
FR=front(STAND(0))
clip('turn','turning around: from facing right to facing the viewer',[STAND(0),lerp(STAND(0),FR,.5),FR])
# 이동·지형
FALL=lambda b=0: P((X,50+b),2,-0.3,0,(X+10,G-16),(X-6,G-10),(14,-12+b),(-4,-10-b),lk=KNEE_FWD)
clip('fall','falling through the air, legs bent, arms up for balance, hair and jacket flying upward',[FALL(0),FALL(1),FALL(2)])
LND=P((X,80),22,-0.4,0,(X+16,G),(X-14,G),('a',X+26,G-1),(10,14),lk=KNEE_UP,rk=KNEE_UP)
clip('land','heavy landing from a high fall: deep crouch, one hand touches the floor, then rises to guard',[FALL(0),LND,LND,lerp(LND,G0,.5),G0])
def stairs(t):
    # 오른쪽 위로 오르는 계단(단 높이 8, 너비 12). 그림 안 드리프트를 빼서 제자리 순환
    ph=(t*2)%1; lead=t<.5
    up=(12*ph,-8*ph)
    a=(X+8,G-8); b0=(X-4,G); b1=(X+20,G-16)
    sw=(b0[0]+(b1[0]-b0[0])*ph,b0[1]+(b1[1]-b0[1])*ph-6*math.sin(math.pi*ph))
    pl,sv=(a,sw)
    hip=(X+4+12*ph,G-48-8*ph+1.5*math.sin(math.pi*ph))
    lf,rf=((pl,sv) if lead else (sv,pl))
    c=math.cos(2*math.pi*t)
    p=P(hip,8,0.15*c,0.2*c,lf,rf,(2-6*c,28),(-1+6*c,28),lk=KNEE_UP,rk=KNEE_UP)
    return sh(p,-up[0],-up[1])
clip('stairs','walking up a staircase, knees lifting onto each step',[stairs(i/8) for i in range(8)])
VA=P((X+6,62),24,0,0,(X+16,G),(X-6,G-2),('a',X+26,62),('a',X+24,62))
VB=P((X+24,40),20,0,0,(X+30,58),(X+20,60),('a',X+28,62),('a',X+26,62),lk=KNEE_UP,rk=KNEE_UP)
VC=P((X+42,60),10,0,0,(X+50,G-4),(X+38,G-8),(14,4),(8,8))
clip('vault','vaulting over a waist-high obstacle: plants both hands on it and swings the legs over, lands on the other side',[walkf(0),VA,VB,VC,P((X+46,58),4,0,0,(X+54,G),(X+40,G),(10,14),(6,16))])
def sneak(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,64+abs(c)),14,0.1*c,0.15*c,(X+2+8*c,G-3*max(0,-sn)),(X+2-8*c,G-3*max(0,sn)),(14,12),(10,14),tilt=6,lk=KNEE_UP,rk=KNEE_UP)
clip('sneak','sneaking silently: knees bent, careful soft steps, hands held in front',[sneak(i/8) for i in range(8)])
holdset('light',(20,6),'chin','a small flashlight held forward, beam pointing ahead')
holdset('box',(16,14),(14,16),'a cardboard box carried in both arms against the chest')
holdset('folder',(10,14),'down','a folder of documents held at her side')
holdset('cup',(10,12),'down','a paper coffee cup')
LB=lambda a: P((X,55),2,0.6*a,0.2*a,(X+6,G),(X-4,G),'down','down',head=(5-10*a,-7))
clip('lookback','glancing back over her shoulder warily, then facing forward again',[LB(0),LB(.5),LB(1),LB(1),LB(.5),LB(0)])
HD=lambda b=0: P((X-4,82+b),24,-0.3,0,(X+12,G),(X-16,G-1),(7,-4),(4,10),tilt=4,lk=KNEE_UP)
clip('hide','side view: crouching low in hiding, hands on knees, face visible, peeking forward warily',[G0,lerp(G0,HD(),.5),HD(0),HD(1),HD(0)])
DO=lambda r: P((X+2*r,55),4+6*r,-0.4*r,0,(X+6+4*r,G),(X-4,G),('a',X+24+8*r,52),'down')
clip('door','opening a door: grabs the handle, turns it and pushes the door open, steps through',[STAND(0),DO(0),DO(.5),DO(1),walkf(.25),walkf(.5)])
DC=lambda r: P((X,55),-2,0.6,0.2,(X+6,G),(X-4,G),'down',('a',X-20+6*r,52),head=(-4,-7))
clip('doorclose','side view: hurrying forward, near arm reaching straight back to push something shut',[STAND(0),DC(0),DC(1),STAND(0)])
KK=lambda r: P((X,55),4,-0.3,0,(X+6,G),(X-4,G),('a',X+22+3*r,40),'down')
clip('knock','knocking on a door with the knuckles',[STAND(0),KK(0),KK(1),KK(0),KK(1),STAND(0)])
def push(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X,64),28,0,0,(X+6+10*c,G-3*max(0,-sn)),(X+6-10*c,G-3*max(0,sn)),('a',X+30,58),('a',X+28,64))
clip('push','pushing a heavy crate forward with both hands and the shoulder, legs driving',[push(i/8) for i in range(8)],'a heavy wooden crate')
LV=lambda d: P((X+2,55+3*d),6+10*d,-0.4,0,(X+8,G),(X-4,G),('a',X+24,28+30*d),('a',X+22,32+28*d),le=ELB_DOWN)
clip('lever','reaching up and pulling a wall lever down with both hands',[STAND(0),LV(0),LV(.5),LV(1),STAND(0)])
IS=lambda r: P((X-2,80),26,-0.3,0,(X+12,G),(X-10,G),('a',X+24+4*r,G-3),(10,14),tilt=16,lk=KNEE_UP,rk=KNEE_UP)
clip('inspect','squatting down to inspect something on the floor, touching it with a gloved finger',[STAND(0),lerp(STAND(0),IS(0),.5),IS(0),IS(1),IS(0),IS(1)])
RW=lambda b: P((X+4,56),14,0,0,(X+10,G),(X-4,G),(6,0),(4,14),head=(6,-7),tilt=4+b)
clip('readwall','leaning close to read writing on a wall, hand on her chin',[RW(0),RW(1),RW(2),RW(1)])
NB=lambda r: P((X,55),4,0,0,(X+6,G),(X-4,G),(10,12),(12-2*r,9+r),tilt=16)
clip('notebook','writing notes in a small notebook held in one hand',[NB(0),NB(1),NB(0),NB(1)],'a small notebook and pen')
def lead(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,56+1.2*abs(c)),5,0.4,0.2*c,(X+2+11*c,G-4*max(0,-sn)),(X+2-11*c,G-4*max(0,sn)),(2-6*c,28),(-24,18),head=(3,-7))
clip('leadhand','side view: walking forward, near arm stretched straight back, pulling someone by the hand',[lead(i/8) for i in range(8)])
clip('elevwait','standing in an elevator, looking up at the floor indicator',[STAND(0,tilt=-14),STAND(.5,tilt=-14),STAND(1,tilt=-12),STAND(.5,tilt=-14)])
BP=lambda r: P((X,79),20,-0.4,-0.3,(X+16,G),(X-19,G-1),('a',X+28+3*r,G-8),('a',X+24-2*r,G-6),tilt=14)
clip('backpack','kneeling and rummaging through a backpack on the floor',[CROUCH(),BP(0),BP(1),BP(0),BP(1),CROUCH()],'a worn backpack on the floor')
# 상태
FE=lambda b: P((X-2,60+b),10,0,0,(X+8,G),(X-6,G),(4,10),(6,8),tilt=6)
clip('fear','frightened: hunched, arms wrapped around herself, trembling, eyes darting',[FE(0),FE(1),FE(0),FE(1)])
NS=lambda d: P((X,57+2*d),28+14*d,0,0,(X+8,G),(X-4,G),(7,-3),(4,22),tilt=10)
clip('nausea','sudden nausea: doubles over with a hand over her mouth, the other hand on her stomach',[STAND(0),NS(0),NS(1),NS(0),NS(1),STAND(0)])
# 회식·보상·출동 준비
clip('feast','seated at a dinner table eating pasta with a fork, calm',[SIT(10,(16,16),(6,-2)),SIT(10,(16,16),(14,12)),SIT(10,(16,16),(6,-2)),SIT(10,(16,16),(14,12))],'a fork')
clip('toast','seated, raising a glass for a toast',[SIT(4,(14,16),(10,18)),SIT(4,(16,-6),(10,18)),SIT(4,(18,-8),(10,18)),SIT(4,(16,-6),(10,18))],'a glass')
GB_=lambda r: P((X,79),16,-0.4,-0.3,(X+16,G),(X-19,G-1),('a',X+26,G-10-14*r),('a',X+30,G-10-14*r),tilt=12)
clip('giftbox','kneeling and opening a small gift box, lifting the lid',[CROUCH(),GB_(0),GB_(.5),GB_(1),GB_(1)],'a small gift box')
TI=lambda r: P((X,55),2,0,0,(X+6,G),(X-4,G),(6,2+r),(7,5-r),tilt=10)
clip('tie','straightening her black necktie at the collar',[STAND(0),TI(0),TI(2),TI(0),STAND(0)])
GC=lambda r: P((X,55),4,0,0,(X+6,G),(X-4,G),(12,12-r),(10,14),tilt=14)
clip('gearcheck','checking her pistol: pulls out the magazine, looks at it, slaps it back in',[STAND(0),GC(0),GC(2),GC(0),GC(2),STAND(0)],'a black pistol')
# 본부 업무
TY=lambda r: SIT(10,('a',X+22,64-2*r),('a',X+18,64-2*(1-r)),tilt=12)
clip('typing','seated at a desk typing on a computer keyboard',[TY(0),TY(1),TY(0),TY(1)])
HO=lambda r: P((X+2*r,55),4,-0.4*r,0,(X+6,G),(X-4,G),(12+12*r,12-2*r),'down')
clip('handover','handing documents to someone in front of her',[HO(0),HO(.5),HO(1),HO(1),HO(0)],'a few sheets of paper')
BD2=lambda r: P((X,55),4,-0.3,0,(X+6,G),(X-4,G),('a',X+24,34+2*r),('a',X+22,40),tilt=-8)
clip('board','pinning a paper to a notice board on the wall',[STAND(0),BD2(0),BD2(1),BD2(0),STAND(0)],'a sheet of paper')
BR=lambda a: P((X,55),2,-0.4,0,(X+6,G),(X-4,G),(30,-14) if a else (16,8),'down')
clip('brief','briefing: points at a board, then gestures toward the listeners',[STAND(0),BR(1),BR(1),BR(0),BR(0)])
# 욕구·여가
clip('doze','side view, seated pose with nothing under her, arms folded, dozing: head drops, then jerks up',[SIT(-6,*CRS,tilt=0),SIT(-6,*CRS,tilt=16),SIT(-6,*CRS,tilt=30),SIT(-6,*CRS,tilt=4)])
SO=lambda b=0: P((X-6,74),-90,0,0,(X+34,72),(X+30,74),(6,-12+b),(4,-10+b),re=ELB_UP,le=ELB_UP)
clip('sofa','lying on her back on a sofa, holding a phone above her face',[SO(0),SO(1),SO(0),SO(1)],'a black smartphone')
PS=lambda b=0: P((X,55+b),3,0,0,(X+6,G),(X-4,G),(10,10),(8,12),tilt=20)
clip('phonelook','standing and looking at her phone screen, scrolling with the thumb',[PS(0),PS(.5),PS(1),PS(.5)],'a black smartphone')
clip('seatphone','seated, looking down at her phone',[SIT(6,(12,10),(10,12),tilt=20),SIT(6,(12,10),(10,12),tilt=20,b=.5),SIT(6,(12,10),(10,12),tilt=20,b=1),SIT(6,(12,10),(10,12),tilt=20,b=.5)],'a black smartphone')
clip('seatread','seated, reading a book held in both hands, turning a page',[SIT(4,(14,10),(10,12),tilt=16),SIT(4,(14,10),(10,12),tilt=16),SIT(4,(14,8),(12,10),tilt=16),SIT(4,(14,10),(10,12),tilt=16)],'an open book')
YA=lambda a: P((X,55),-2*a,0,0,(X+6,G),(X-4,G),(7,-4) if a else 'down','down',tilt=-12*a)
clip('yawn','yawning, covering the mouth with a hand, head tipped back',[STAND(0),YA(1),YA(1),STAND(0)])
ST=lambda a: P((X,55-2*a),-4*a,0,0,(X+6,G),(X-4,G),(4,-30*a+28*(1-a)),(0,-30*a+28*(1-a)),tilt=-8*a,le=ELB_UP,re=ELB_UP)
clip('stretch','stretching both arms up over the head, then lowering them',[STAND(0),ST(.5),ST(1),ST(1),ST(.5),STAND(0)])
WS=lambda a: P((X+2,57),22,0,0,(X+8,G),(X-4,G),('a',X+24,58) if a<1 else (6,-4),('a',X+22,60) if a<1 else (5,-2),tilt=10)
clip('wash','washing her hands at a sink, then splashing water on her face',[STAND(0),WS(0),WS(.5),WS(1),WS(1),STAND(0)])
HF=lambda a: P((X,55),2,0,0,(X+6,G),(X-4,G),(4-10*a,-12),'down',tilt=-4*a)
clip('hairflip','running a hand through her long hair, pushing it back',[STAND(0),HF(0),HF(.5),HF(1),STAND(0)])
clip('seatdrink','seated, sipping coffee from a paper cup',[SIT(2,(12,14),(10,18)),SIT(2,(6,-2),(10,18),tilt=-14),SIT(2,(6,-2),(10,18),tilt=-14),SIT(2,(12,14),(10,18))],'a paper coffee cup')
WN=lambda b: P((X,55+b),0,0.2,0,(X+6,G),(X-4,G),(3,22),(1,22),tilt=-4)
clip('window','standing at a window looking outside, hands in her trouser pockets, still',[WN(0),WN(.5),WN(1),WN(.5)])
# 사교
NO=lambda t: STAND(0,tilt=t)
clip('nod','nodding once in agreement',[NO(0),NO(10),NO(2),NO(10),NO(0)])
SK=lambda d: P((X,55),2,0,0,(X+6,G),(X-4,G),'down','down',head=(5+3*d,-7))
clip('headshake','shaking her head slightly: no',[SK(0),SK(-1),SK(1),SK(-1),SK(0)])
WV=lambda d: P((X,55),2,0,0,(X+6,G),(X-4,G),(10+4*d,-16),'down',le=ELB_DOWN)
clip('wave','raising a hand and waving briefly',[STAND(0),WV(0),WV(1),WV(-1),WV(1),STAND(0)])
HS=lambda d: P((X+2,55),6,-0.4,0,(X+8,G),(X-4,G),(26,14+2*d),'down')
clip('handshake','shaking hands with someone in front of her',[STAND(0),HS(0),HS(1),HS(-1),HS(1),STAND(0)])
PT=lambda d: P((X+2,55),6,-0.4,0,(X+8,G),(X-4,G),(26,-2+3*d),'down')
clip('pat','patting someone on the shoulder',[STAND(0),PT(0),PT(1),PT(0),PT(1),STAND(0)])
clip('point','pointing ahead with the index finger',[STAND(0),P((X+2,55),4,-0.5,0,(X+8,G),(X-4,G),(34,-6),'down'),P((X+2,55),4,-0.5,0,(X+8,G),(X-4,G),(36,-6),'down'),STAND(0)])
SR_=lambda a: P((X,55-a),2,0,0,(X+6,G),(X-4,G),(16,14-2*a),(12,14-2*a),tilt=6*a,le=ELB_OUT,re=ELB_OUT)
clip('shrug','shrugging, palms turned up, head tilted',[STAND(0),SR_(1),SR_(1),STAND(0)])
SI=lambda a: P((X,55+a),2-2*a,0,0,(X+6,G),(X-4,G),'down','down',tilt=-6+20*a)
clip('sigh','a long sigh: shoulders drop and the head lowers',[SI(0),SI(.5),SI(1),SI(1),SI(.3)])
# 감정
clip('smile','a faint, rare smile, head tilted slightly down, eyes softening',[STAND(0),STAND(0,tilt=4),STAND(.5,tilt=6),STAND(.5,tilt=6)])
LG=lambda b: P((X,55+b),6,0,0,(X+6,G),(X-4,G),(7,-3),(4,16),tilt=8+2*b)
clip('laugh','laughing quietly behind her hand, shoulders shaking',[STAND(0),LG(0),LG(1.5),LG(0),LG(1.5),LG(0)])
CY=lambda b: P((X,56+b),6,0.6,0.2,(X+6,G),(X-4,G),(5,-8),'down',head=(3,-7),tilt=20)
clip('cry','crying silently: turns slightly away, head down, wipes her eyes with the back of the glove',[STAND(0),CY(0),CY(1),CY(0),CY(1),CY(0)])
AN=lambda b: P((X+2,55+b),6,-0.3,0,(X+8,G),(X-4,G),(3,30),(-2,29),tilt=-4)
clip('angry','angry: fists clenched at her sides, glaring, faint sparks at the glove tips',[STAND(0),AN(0),AN(.5),AN(0)])
SU=P((X-5,56),-8,0.2,0,(X+2,G),(X-10,G),(12,4),(8,6),head=(4,-8))
clip('surprise','startled: flinches back half a step, hands half raised',[STAND(0),SU,SU,lerp(SU,STAND(0),.5)])
EM=lambda a: P((X,55),2,0.3,0,(X+6,G),(X-4,G),(-2,-12+2*a),'down',head=(3,-6),tilt=10)
clip('embarrassed','embarrassed: looks away and touches the back of her head',[STAND(0),EM(0),EM(1),EM(0)])
clip('sad','sad: standing still with her head bowed, arms hanging limp',[STAND(1,tilt=18),STAND(1.5,tilt=22),STAND(2,tilt=22),STAND(1.5,tilt=20)])
AY=lambda b: P((X,55+b),4,0,0,(X+6,G),(X-4,G),(5,-12),'down',tilt=12)
clip('annoyed','annoyed: presses her fingers to her forehead and closes her eyes',[STAND(0),AY(0),AY(.5),AY(0)])
TK=lambda b: P((X,55+b),2,0,0,(X+6,G),(X-4,G),(7,-2),(5,14),tilt=6)
clip('think','thinking: one arm folded, the other hand at her chin',[TK(0),TK(.5),TK(1),TK(.5)])
BO=lambda u: P((X,55),2,0,0,(X+6,G-3*u),(X-4,G),*CRS)
clip('bored','bored: arms crossed, tapping the front foot',[BO(0),BO(1),BO(0),BO(1)])
GL_=lambda a: P((X,55),2,0,0,(X+6,G),(X-4,G),(12,8-6*a),'down',tilt=4)
clip('glad','quietly pleased: a small fist pump at chest height',[STAND(0),GL_(0),GL_(1),GL_(0)])

# 씻기·집안일·운동 (2026-10-21 사용자 "샤워·목욕도", 나머지는 Claude가 채움). 노출 금지: 샤워는 부스 실루엣(코드), 목욕은 거품 위 어깨까지
TW=lambda d: P((X,55),4,0,0,(X+6,G),(X-4,G),(4+2*d,-14),(0-2*d,-12),tilt=10,le=ELB_UP,re=ELB_UP)
clip('towel','drying her damp long hair with a towel',[TW(0),TW(1),TW(-1),TW(1),TW(0)],'a white towel')
# 목욕(bath)은 사용자가 직접 생성(2026-10-21) — 여기서 빼 둠
BRU=lambda d: P((X,55),4,0,0,(X+6,G),(X-4,G),(7+d,-3),(10,16),tilt=6)
clip('brushteeth','brushing her teeth, the other hand holding a cup',[BRU(0),BRU(2),BRU(0),BRU(2)],'a toothbrush and a cup')
LK=lambda a: P((X,55),4,-0.3,0,(X+6,G),(X-4,G),('a',X+24,40) if a==0 else (14,6) if a==1 else (-12,8),(-10,10) if a==2 else 'down',tilt=4)
clip('locker','at a locker: takes out her suit jacket and swings it on, then straightens the collar',[STAND(0),LK(0),LK(1),LK(2),TI(0),STAND(0)],'a black suit jacket')
SL=lambda b: P((X-6,92),-86,0,0,(X+22,G-10),(X+18,G-6),(10,8+b),(8,12),head=(5,-5),tilt=20,lk=KNEE_UP,rk=KNEE_UP)
clip('sleepside','asleep lying on her side in bed, knees slightly drawn up, slow breathing',[SL(0),SL(1),SL(1),SL(0)])
MW=lambda a: P((X,55),4,-0.3,0,(X+6,G),(X-4,G),('a',X+24,48+4*a),('a',X+22,52) if a==1 else 'down')
clip('microwave','putting a cup noodle into a microwave, pressing the button, waiting',[STAND(0),MW(1),MW(0),MW(0),STAND(0)],'a cup noodle')
clip('seatnoodle','seated, eating noodles with chopsticks from a cup',[SIT(10,(14,14),(6,-2)),SIT(10,(14,14),(12,10)),SIT(10,(14,14),(6,-2)),SIT(10,(14,14),(12,10))],'chopsticks and a cup noodle')
DS=lambda d: P((X+2,57),18,0,0,(X+8,G),(X-4,G),('a',X+24+3*d,60),('a',X+22-3*d,62),tilt=10)
clip('dishes','washing dishes at a sink',[DS(0),DS(1),DS(-1),DS(1)],'a plate and a sponge')
MO=lambda d: P((X+2*d,57),10,0,0,(X+8,G),(X-4,G),('a',X+20+10*d,54),('a',X+14+10*d,66))
clip('mop','mopping the floor with a mop, pushing it back and forth',[MO(0),MO(1),MO(2),MO(1),MO(0),MO(-1)],'a mop')
WA=lambda a: P((X,55),6,-0.3,0,(X+6,G),(X-4,G),(16,14+4*a),(12,16),tilt=14)
clip('water','watering a potted plant with a small watering can',[STAND(0),WA(0),WA(1),WA(1),WA(0)],'a small watering can')
PU=lambda d: P((X-10,84+6*d),80,0,0,(X-44,G-1),(X-46,G),('a',X+16,G-1),('a',X+12,G),head=(6,-4),le=ELB_OUT,re=ELB_OUT)
clip('pushup','doing push-ups on the floor',[PU(0),PU(.5),PU(1),PU(.5)])
SU2=lambda a: P((X-6,96),-90+60*a,0,0,(X+14,G),(X+10,G),(2,-4),(0,-6),tilt=10*a,lk=KNEE_UP,rk=KNEE_UP,le=ELB_UP,re=ELB_UP)
clip('situp','doing sit-ups on the floor, hands behind her head, knees bent',[SU2(0),SU2(.5),SU2(1),SU2(.5)])
MU=lambda b: P((X,55+b),2,0,0,(X+6,G),(X-4,G),(-1,-8) if b==0 else 'down','down',tilt=4*b)
clip('music','listening to music on earphones, head nodding slightly to the beat',[MU(0),MU(1),MU(0.5),MU(1)],'white earphones')
clip('seatgame','seated, playing a handheld game console with both thumbs, absorbed',[SIT(8,(12,10),(10,10),tilt=18),SIT(8,(12,9),(10,11),tilt=18),SIT(8,(12,10),(10,10),tilt=20),SIT(8,(12,11),(10,9),tilt=18)],'a handheld game console')

# 이야기 연기용 (2026-10-21)
DS1=lambda a: P((X+2,56+2*a),10+10*a,-0.4,0,(X+8,G),(X-4,G),('a',X+24,40+22*a),'down',tilt=6)
clip('deskslam','angrily slamming her fist down on a desk',[STAND(0),DS1(0),DS1(1),DS1(1),lerp(DS1(1),STAND(0),.5)])
PL=P((X-8,96),-6,0,0,(X+16,G),(X+12,G),('a',X-18,G),('a',X+20,G-6),lk=KNEE_UP,rk=KNEE_UP,tilt=14)
clip('plopdown','exhausted, she drops heavily to sit on the floor, legs out, head hanging',[STAND(0),lerp(STAND(0),PL,.4),lerp(STAND(0),PL,.8),PL,PL])
HG=lambda a: P((X+4,56),6,0,0,(X+10,G),(X-2,G),(18+4*a,4),(16+4*a,6),tilt=8,le=ELB_OUT,re=ELB_OUT)
clip('hug','stepping forward and hugging someone in front of her tightly',[STAND(0),HG(1),HG(0),HG(0),HG(0)])
SH_=lambda a: P((X+2,56),10*a,-0.3,0,(X+8,G),(X-4,G),(4,30-6*a),(0,30-4*a),head=(6,-6),tilt=-10*a)
clip('shout','shouting angrily, leaning forward, fists clenched',[STAND(0),SH_(1),SH_(1),SH_(.6),STAND(0)])
SF=P((X-14,94),-30,0,0,(X+14,G-8),(X+8,G-4),('a',X-30,G),('a',X-26,G-1),lk=KNEE_UP,rk=KNEE_UP)
clip('startlefall','startled so badly she falls backward onto her bottom, catching herself with her hands',[STAND(0),SU,lerp(SU,SF,.5),SF,SF])
WC=lambda b: P((X-6,58+b),-6,0.6,0.2,(X+8,G),(X-6,G),(4,-8),(-12,10),head=(3,-6),tilt=22)
clip('wallcry','leaning her back against a wall and crying, one hand over her eyes',[WC(0),WC(1),WC(0),WC(1)])
KC=lambda b: P((X,78+b),24,0,0,(X-32,G-2),(X-36,G-3),(5,-8),(4,-6),tilt=26)
clip('kneelcry','collapsed on her knees, face buried in both hands, shoulders shaking',[KC(0),KC(1),KC(0),KC(1)])

# 158~167 bathroom: fixed canvas anchor, planted feet; user-approved nonsexual adult nudity.
BATH_BODY = ('unclothed adult woman, natural adult body anatomy at small game sprite resolution, '
             'nonsexual everyday hygiene, no towel or artificial censorship, no clothing or weapons')
SHOWER_PROP = BATH_BODY + ', open clear shower enclosure on right, metal shower head, water droplets'
BATH_PROP = BATH_BODY + ', ordinary white bathtub on right with clear bath water, no foam'
TOILET_PROP = ('adult woman wearing white shirt and black jacket, black trousers and underwear lowered to knees while seated, '
               'ordinary white toilet, nonsexual everyday bathroom routine, no censorship panel')
ENTRY = STAND(0, lh=(15,10))
REACH = STAND(0, lh=(26,0))
INSIDE = STAND(0, lh=(8,10), rh=(4,12))
STEP_OVER = P((X,53),8,0,0,(X+22,G-23),(X-4,G),('a',X+26,65),(8,15),lk=KNEE_UP)
SOAP = lambda t: STAND(0,lh=(1+t,-9),rh=(-3-t,-6),tilt=9)
clip('showerin','enter shower booth, reach for handle, step in, close clear door',
     [ENTRY,REACH,walkf(.0),walkf(.25),INSIDE,INSIDE], SHOWER_PROP)
clip('shower','wash hair with both hands, then rub shoulders under shower, gentle loop',
     [SOAP(0),SOAP(3),SOAP(0),STAND(0,lh=(8,9),rh=(1,12)),STAND(0,lh=(4,12),rh=(7,8)),SOAP(0)], SHOWER_PROP)
clip('showerout','turn off shower, open frosted door, step out and stand naturally',
     [REACH,ENTRY,walkf(.25),walkf(.5),INSIDE,STAND(0,lh=(5,12))],SHOWER_PROP)
BT = lambda b=0: P((X-6,82+b),-18,0,0,(X+27,92),(X+22,94),(17,17),(12,19),tilt=-9,lk=KNEE_UP,rk=KNEE_UP)
clip('bathin','hold tub rim, step one leg over rim, sit down and settle in bath',
     [ENTRY,REACH,STEP_OVER,lerp(STEP_OVER,BT(),.45),BT(),BT()],BATH_PROP)
clip('bath','rest in bathtub with head tilted back and eyes closed, slow breathing loop',
     [BT(0),BT(.5),BT(1),BT(.5)],BATH_PROP)
clip('bathout','hold tub rim, rise carefully, step over rim and stand naturally',
     [BT(),lerp(BT(),STEP_OVER,.45),STEP_OVER,ENTRY,INSIDE,INSIDE],BATH_PROP)
TS = lambda b=0: SIT(7,lh=(15,16),rh=(10,18),tilt=12,b=b)
clip('toiletin','open cubicle door, enter, shut privacy door and lower trousers and sit on toilet',
     [ENTRY,REACH,walkf(.25),ENTRY,lerp(ENTRY,TS(),.6),TS()],TOILET_PROP)
clip('toilet','sit quietly on toilet with trousers lowered, read smartphone, breathing loop',
     [TS(0),TS(.5),TS(1),TS(.5)],TOILET_PROP+', small black smartphone held in front')
clip('toiletout','stand and pull up trousers, press flush, open cubicle door and step out',
     [TS(),lerp(TS(),ENTRY,.6),STAND(0,lh=(8,23)),REACH,walkf(.25),STAND(0)],TOILET_PROP)
HW = lambda t: P((X,55),15,0,0,(X+6,G),(X-4,G),(20+t,20),(19-t,22),tilt=16)
clip('handwash','turn tap on, rub palms together, wash backs of hands, rinse, turn tap off',
     [REACH,HW(0),HW(3),HW(-3),HW(0),REACH],
     'black trouser suit, white shirt, black tie, bare hands without gloves, white sink and chrome tap on right, running water')

# Corrected bathroom paths: furniture-bearing reference required (see prepare_jyaldi_bathroom.py).
SHOWER_INSIDE=sh(INSIDE,55)
BATH_STEP=sh(STEP_OVER,25)
BATH_SEATED=P((X+39,63),-28,0,0,(X+80,82),(X+74,84),(20,16),(14,17),tilt=-9,lk=KNEE_UP,rk=KNEE_UP)
clip('showerin',CLIPS['showerin'][0],[ENTRY,REACH,sh(walkf(0),20),sh(walkf(.25),40),SHOWER_INSIDE,SHOWER_INSIDE],SHOWER_PROP)
clip('showerout','step out of shower booth, then dry hair with towel',list(reversed(CLIPS['showerin'][2])),SHOWER_PROP)
clip('bathin',CLIPS['bathin'][0],[ENTRY,REACH,BATH_STEP,lerp(BATH_STEP,BATH_SEATED,.5),BATH_SEATED,BATH_SEATED],BATH_PROP)
clip('bathout',CLIPS['bathout'][0],list(reversed(CLIPS['bathin'][2])),BATH_PROP)
clip('bath',CLIPS['bath'][0],[BATH_SEATED,jit(BATH_SEATED,0,.4,['NECK','SHOULDER','NOSE','EYE','EAR']),BATH_SEATED,jit(BATH_SEATED,0,.2,['NECK','SHOULDER','NOSE','EYE','EAR'])],BATH_PROP)

# ── 결함 목록 재생성 (docs/캐릭터제작서/쟈알디_결함목록_2026-10-21.md 4·12·25~30·34) ──
# 원인(실측): 손이 가슴 앞(팔짱·전화·서류철)이면 ELB_DOWN IK가 팔꿈치를 등 뒤(목보다 x 10px 뒤)로 보냄.
# 옆모습으로는 불가능한 관절이라 생성기가 몸을 정면으로 돌려 맞춤. 또 s>0(먼 어깨가 앞)이면 가슴이 화면 쪽으로 열림.
# 고침: 팔꿈치를 몸 앞에 직접 지정, 생활 자세는 s=h=0(옆모습).
XA=dict(lh=('r',8,12),rh=('r',9,10),le=('e',6,17),re=('e',8,15))      # 팔짱(옆모습): 두 팔꿈치 가슴 앞, 손은 가슴 앞
def SITX(lean,tilt=0,b=0): return P((X-6,77+b),lean,0,0,(X+16,G),(X+12,G),tilt=tilt,lk=KNEE_UP,rk=KNEE_UP,**XA)
clip('seatrest','side view, seated pose with nothing under her, leaning back, arms folded, calm',[SITX(-8),SITX(-8,b=.5),SITX(-8,b=1),SITX(-8,b=.5)])
clip('seatthink','side view, seated pose with nothing under her, leaning back with eyes closed, arms folded, thinking',[SITX(-14,-8),SITX(-14,-8,.5),SITX(-14,-8,1),SITX(-14,-8,.5)])
clip('doze','side view, seated pose with nothing under her, arms folded, dozing: head drops, then jerks up',[SITX(-6,0),SITX(-6,16),SITX(-6,30),SITX(-6,4)])
WLX=lambda b=0: P((X-4,55+b),-6,0,0,(X+10,G),(X-2,G),tilt=-2,**XA)
clip('walllean','side view: standing leaning slightly back, arms folded across the chest, relaxed',[WLX(0),WLX(.5),WLX(1),WLX(.5)])
STXX=lambda b=0,u=0: P((X,55+b),2,0,0,(X+6,G-3*u),(X-4,G),**XA)
clip('armscross','side view: standing with arms folded across the chest, listening',[STXX(0),STXX(.5),STXX(1),STXX(.5)])
clip('bored','side view: bored, arms folded, tapping the front foot on the floor',[STXX(0,0),STXX(0,1),STXX(0,0),STXX(0,1)])
# 윗몸일으키기: 등을 대고 누움 → 상체 60도. 손은 뒤통수, 팔꿈치는 무릎 쪽(몸 앞)
SU3=lambda a: P((X-6,96),-90+60*a,0,0,(X+14,G),(X+10,G),('r',-3,-9),('r',-2,-10),tilt=10*a,lk=KNEE_UP,rk=KNEE_UP,le=('e',9,-7),re=('e',8,-8))
clip('situp','side view: doing sit-ups on the floor, hands behind her head, elbows forward, knees bent',[SU3(0),SU3(.5),SU3(1),SU3(.5)])
# 벽 기대 울기: 가까운 손이 눈을 가림(팔꿈치 앞), 먼 손은 내림
WCX=lambda b: P((X-6,58+b),-6,0,0,(X+8,G),(X-6,G),('r',6,-10),'down',head=(4,-7),tilt=22,le=('e',13,4))
clip('wallcry','side view: standing leaning slightly back and crying, near hand covering her eyes, shoulders shaking',[WCX(0),WCX(1),WCX(0),WCX(1)])
# 전화: 가까운 손이 가까운 귀에, 팔꿈치는 앞 어깨 높이
PHX=lambda t: P((X,55),2,0,0,(X+6,G),(X-4,G),('r',-1,-8),'down',tilt=t,le=('e',11,5))
clip('phone','side view: standing and talking on a mobile phone held to her near ear, elbow forward',[PHX(0),PHX(3),PHX(0),PHX(-2)],'a black smartphone')
# 12 침대에서 일어나기: 가구는 게임이 따로 그림(2026-10-21 규칙) → 침대 없이 자세만. 침대 모양 불일치가 사라짐
BWS1=P((X-6,74),-45,0,0,(X+34,74),(X+32,76),('r',8,16),('a',X-20,76),le=('e',6,14))
BWS2=P((X-4,74),-4,0,0,(X+36,72),(X+34,74),('r',10,18),('r',8,20),le=('e',5,16),re=('e',3,16))
BWED=P((X-2,76),2,0,0,(X+18,G),(X+12,G),('r',12,20),('r',10,22),lk=KNEE_UP,rk=KNEE_UP,le=('e',5,16),re=('e',3,16))
clip('bedwake','side view: waking up from lying on her back, sits up slowly, then swings her legs down to sit',[BL(0),BWS1,BWS2,lerp(BWS2,BWED,.5),BWED,BWED])
# 25 부상 대기·절뚝 걷기: 구부정, 가까운 손은 배를 감쌈, 먼 손은 늘어뜨림. 가드 없음
HUX=lambda b: P((X,64+b),20,0,0,(X+10,G),(X-8,G),('r',7,22),('r',6,26),tilt=16,le=('e',3,15),re=('e',0,15))
clip('hurtidle','side view: injured, hunched over, near hand clutching her stomach, no guard, heavy breathing',[HUX(0),HUX(1.5),HUX(3),HUX(1.5)])
def limpx(t):
    # 앞발(성한 다리)은 빨리 내딛고 뒷발(다친 다리)은 바닥에 끌림(들지 않음). 다친 다리에 실릴 때 골반이 크게 꺼짐
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    dip=6*max(0,-c)
    return P((X+2,60+dip),16+4*max(0,-c),0,0,(X+2+11*c,G-6*max(0,-sn)),(X+2-7*c,G),('r',7,22),('r',6,26),tilt=12,le=('e',3,15),re=('e',0,15),rk=KNEE_UP)
clip('limp','side view: limping walk, stiff rear leg dragging on the floor, hand clutching her stomach',[limpx(i/8) for i in range(8)])
# 26 숨기: 웅크려 숨어 앞을 엿봄. 얼굴을 가리지 않음
HDX=lambda b=0: P((X-4,82+b),18,0,0,(X+12,G),(X-16,G-1),('r',12,16),('r',10,18),head=(6,-6),lk=KNEE_UP,le=('e',5,14),re=('e',3,14))
clip('hide','side view: crouching low in hiding, hands on knees, face visible, peeking forward warily',[G0,lerp(G0,HDX(),.5),HDX(0),HDX(1),HDX(0)])
# 27 뒤로 문 닫기: 앞으로 걸으며 가까운 팔을 뒤로 쭉 뻗어 문을 밀어 닫음
DCX=lambda t,r: P((X+2,56),6,0,0,(X+2+11*math.cos(2*math.pi*t),G-4*max(0,-math.sin(2*math.pi*t))),(X+2-11*math.cos(2*math.pi*t),G-4*max(0,math.sin(2*math.pi*t))),('a',X-30+10*r,50),(4,26),head=(3,-8),le=('e',-12,14))
clip('doorclose','side view: hurrying forward, near arm reaching straight back to push something shut',[walkf(0),DCX(.125,0),DCX(.25,0),DCX(.375,.6),DCX(.5,1),walkf(.625)])
# 28 손잡고 이끌기: 가까운 손을 뒤로 쭉 뻗어 누군가의 손을 잡고 걸음
def leadx(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+4,57+1.2*abs(c)),10,0,0,(X+4+11*c,G-4*max(0,-sn)),(X+4-11*c,G-4*max(0,sn)),('r',-30,16),(2+7*c,28),head=(4,-7),le=('e',-14,12))
clip('leadhand','side view: walking forward, near arm stretched straight back, pulling someone by the hand',[leadx(i/8) for i in range(8)])
# 29 승리: 가드 풀고 → 주먹 낮게 당김 → 머리 위로 크게 치켜듦 → 유지 → 내려 반듯이
VC0=P((X,57),8,0,0,(X+8,G),(X-6,G),('r',4,22),'down',le=('e',-2,14))
VUP=P((X,53),-6,0,0,(X+8,G),(X-6,G),('r',8,-34),'down',head=(5,-8),tilt=-10,le=('e',6,-14))
clip('victory','side view: victory fist pump, thrusts the fist high above her head, then stands straight',
     [G0,STAND(0),VC0,lerp(VC0,VUP,.5),VUP,sh(VUP,0,-1),lerp(VUP,STAND(0),.5),STAND(0)])
# 30 손 흔들기: 가까운 손을 머리 위로 높이 들고 손목을 앞뒤로 크게 흔듦
WVX=lambda d: P((X,55),2,0,0,(X+6,G),(X-4,G),('r',12+7*d,-30),'down',le=('e',10,-10))
clip('wave','side view: raising her near hand high above her head and waving it widely back and forth',[STAND(0),WVX(0),WVX(1),WVX(-1),WVX(1),WVX(-1),WVX(0),STAND(0)])
# 34 서류철 걷기: 대기·달리기처럼 가슴에 안음(두 팔꿈치 몸 앞)
FO=dict(le=('e',4,16),re=('e',2,14))
def walkfo(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,56+1.2*abs(c)),3,0,0,(X+2+11*c,G-4*max(0,-sn)),(X+2-11*c,G-4*max(0,sn)),('r',9,13),('r',8,10),**FO)
clip('walk_folder','side view: walking while hugging a folder of documents flat against her chest with both arms',[walkfo(i/8) for i in range(8)],'holding a folder of documents hugged against the chest')
# ── 가구 못 떼어 낸 클립, 가구 없이 다시 (2026-10-21, 쟈알디 결함 목록 정리 스레드 요청) ──
# 앉는 자세는 빈 공간에, 가구는 게임이 따로 그림. 생성기가 끝 장을 기준 그림으로 되돌리는 버릇이 있어 끝에 버릴 장 1개를 덧붙임
# (빌더 auto_trim이 뺌. 반복 클립은 첫 장, 아닌 것은 끝 장 복사).
def tail(ps,loop): return ps+[ps[0] if loop else ps[-1]]
LAP=dict(lh=('r',14,20),rh=('r',12,22),le=('e',5,16),re=('e',3,16))   # 앉아 무릎 위 손
SITF=lambda lean=2,tilt=0,b=0,**k: P((X-6,77+b),lean,0,0,(X+16,G),(X+12,G),tilt=tilt,lk=KNEE_UP,rk=KNEE_UP,**({**LAP,**k}))
clip('chairsit','side view: lowers herself into a seated pose with nothing under her, hands resting on her thighs',
     tail([STAND(0),lerp(STAND(0),SITF(14),.5),SITF(14),SITF()],False))
DKX=lambda a: SITF(12,14,lh=('r',20,10-5*a),rh=('r',16,12),le=('e',9,14),re=('e',7,15))
clip('deskwork','side view, seated pose with nothing in front: signing papers and stamping, hands at desk height',
     tail([DKX(0),DKX(.5),DKX(1),DKX(0),DKX(1),DKX(0)],True),'a pen and a rubber stamp in her hands')
TYX=lambda r: SITF(10,12,lh=('r',20,12-2*r),rh=('r',17,12-2*(1-r)),le=('e',8,15),re=('e',6,16))
clip('typing','side view, seated pose with nothing in front: typing in the air at desk height, fingers moving',tail([TYX(0),TYX(1),TYX(0),TYX(1)],True))
TRX=lambda a: P((X,56),8,0,0,(X+6,G),(X-4,G),('r',17,15-2*a),('r',14,16-2*(1-a)),tilt=12,le=('e',8,14),re=('e',6,15))
clip('transmit','side view: standing, pressing keys on a small radio held at waist height in front of her',tail([TRX(0),TRX(1),TRX(0),TRX(1)],True),'a small black field radio in her hands')
clip('sofa','side view: lying on her back in the air with nothing under her, holding a phone above her face',tail([SO(0),SO(1),SO(0),SO(1)],True),'a black smartphone')
FEX=lambda u: SITF(10,6,lh=('r',18,14),rh=('r',6,-1) if u else ('r',16,12),le=('e',8,15),re=('e',10,6) if u else ('e',6,15))
clip('feast','side view, seated pose with nothing under or in front of her: eating pasta with a fork, calm',tail([FEX(1),FEX(0),FEX(1),FEX(0)],True),'a fork in her hand')
clip('ladder','side view: climbing motion, hands and feet alternating as if on ladder rungs, ladder not drawn',tail([lad(i/8) for i in range(8)],True))
DOX=lambda r: P((X+2*r,55),4+6*r,0,0,(X+6+4*r,G),(X-4,G),('a',X+24+8*r,52),'down',le=('e',10+4*r,10))
clip('door','side view: reaches forward, grips and turns a handle, pushes forward, then steps on; door not drawn',tail([STAND(0),DOX(0),DOX(.5),DOX(1),walkf(.25),walkf(.5)],False))
TPX=('jacket and white shirt on, black trousers pulled down to her knees while seated, ordinary everyday bathroom routine, '
     'no toilet or cubicle drawn')
TSX=lambda b=0,**k: SITF(7,12,b=b,**k)
clip('toiletin','side view: steps forward, lowers her trousers and sits down in a seated pose with nothing under her',
     tail([ENTRY,walkf(.25),STAND(0,lh=(8,23),rh=(6,23)),lerp(STAND(0,lh=(8,23),rh=(6,23)),TSX(),.6),TSX(),TSX()],False),TPX)
PHN=dict(lh=('r',16,8),rh=('r',14,10),le=('e',8,14),re=('e',6,15))
clip('toilet','side view, seated pose with nothing under her, trousers at her knees, reading a smartphone',
     tail([TSX(0,**PHN),TSX(.5,**PHN),TSX(1,**PHN),TSX(.5,**PHN)],True),TPX+', small black smartphone in her hands')
clip('toiletout','side view: stands up from a seated pose, pulls her trousers up, reaches forward, then walks on',
     tail([TSX(),lerp(TSX(),STAND(0,lh=(8,23),rh=(6,23)),.6),STAND(0,lh=(8,20),rh=(6,20)),REACH,walkf(.25),STAND(0)],False),TPX)
REDO2=['chairsit','deskwork','typing','transmit','sofa','feast','ladder','door','toiletin','toilet','toiletout']
# 후송(침대 눕기) 다시: 무릎 세워 다리가 마름모꼴 → 다리 쭉 펴고 반듯이, 가구 없이(사용자 지적 2026-10-21)
BLX=lambda b=0: P((X-6,74),-90,0,0,(X+39,75),(X+38,76),('r',4,22+b),('r',3,24),le=('e',1,12),re=('e',0,12))
clip('bedlie','side view: lying flat on her back in the air with nothing under her, legs straight, asleep, slow breathing',tail([BLX(0),BLX(1),BLX(1),BLX(0)],True))
# 짜증: 앞손 손바닥을 이마(얼굴 앞)에 대고 고개 숙여 한숨. 당황(뒷머리)과 겹치던 것 고침
AYX=lambda t: P((X,55),4,0,0,(X+6,G),(X-4,G),('r',10,-12+t),'down',tilt=12+8*t,le=('e',13,3))
clip('annoyed','side view: annoyed, presses her near palm to her forehead in front of her face, head bowed, sighs',
     tail([STAND(0),lerp(STAND(0),AYX(0),.5),AYX(0),AYX(1),AYX(1),AYX(0)],False))
# 설거지: 선 자세, 손은 조리대 높이(최종 캔버스 y≈80 = 뼈대 y≈52), 허리 살짝 숙임. 가구 없이
DSX=lambda d: P((X+2,56),8,0,0,(X+8,G),(X-4,G),('r',18+3*d,21),('r',16-3*d,22),tilt=14,le=('e',8,16),re=('e',6,17))
clip('dishes','side view: standing, scrubbing a plate with a sponge at counter height, counter not drawn',
     tail([DSX(0),DSX(1),DSX(-1),DSX(1)],True),'a white plate and a sponge in her hands')
# 밀대: 자루 한 직선 위에 두 손(앞손 아래, 먼 손 위), 밀대 머리는 바닥(뼈대 y=106 ≈ 최종 y 134)에 붙은 채 앞뒤로
def mopx(d):
    H=(X+40+d,106); T=(X+2+0.3*d,30)
    at=lambda t:('a',H[0]+(T[0]-H[0])*t,H[1]+(T[1]-H[1])*t)
    return P((X+1+0.3*d,57),10,0,0,(X+10,G),(X-6,G),at(.45),at(.78))
clip('mop','side view: pushing a mop back and forth, both hands on one straight handle, head on the floor',
     tail([mopx(0),mopx(6),mopx(10),mopx(4),mopx(-4),mopx(-8)],True),'a mop with a long straight handle held in both hands, mop head on the floor')
# 화분 물 주기: 앞손으로 물뿌리개 손잡이를 쥐고 주둥이를 앞 아래로 기울여 부음. 화분 없음
WTX=lambda a: P((X+1,56),8+6*a,0,0,(X+8,G),(X-4,G),('r',17+2*a,14-3*a),'down',tilt=12+4*a,le=('e',7,14))
clip('water','side view: tilting a watering can held by its handle, spout forward and down, pouring',
     tail([STAND(0),WTX(0),WTX(.6),WTX(1),WTX(1),WTX(.6),WTX(0)],False),'a green watering can held by its top handle in her near hand, long spout, water pouring from the spout')
# 기지개: 깍지 낀 두 팔을 머리 위로 쭉, 등 살짝 젖히고 발뒤꿈치 듦 → 멈춤 → 팔 내리며 숨 내쉼
STR=lambda u,b=0: P((X,55-3*u),2-10*u,0,0,(X+6,G-4*u),(X-4,G-4*u),('r',5+3*(1-u),-36*u+6*(1-u)),('r',4+3*(1-u),-35*u+7*(1-u)),
                    tilt=-10*u,le=('e',6+6*(1-u),-16*u+8*(1-u)),re=('e',4+6*(1-u),-15*u+8*(1-u)))
clip('stretch','side view: big stretch, fingers laced, arms straight up overhead, back arched, heels up, relaxes',
     tail([STAND(0),STR(0),STR(.6),STR(1),STR(1),lerp(STR(1),STAND(0),.5),STAND(0)],False))
REDO3=['bedlie','annoyed','dishes','mop','water','stretch']
# 쇠파이프 들고 대기·걷기·달리기: 가운데를 쥐고 수평으로 메던 것(여의봉) → 야구 방망이처럼 한쪽 끝을 두 손으로 쥐고
# 자루를 어깨에 걸쳐 뒤 위로 비스듬히. 휘두르기 첫 장(뒤로 치켜듦)과 이어짐(사용자 지적 2026-10-21)
PL=('r',9,15); PR=('r',7,12); PE=dict(le=('e',4,16),re=('e',2,15))
PIPE='a long steel pipe gripped at one end with both hands like a baseball bat, resting on her near shoulder, angled up and back'
clip('idle_pipe','side view: standing ready, holding a steel pipe like a bat resting on her shoulder',
     tail([P((X,57+b),4,0,0,(X+10,G),(X-9,G-1),PL,PR,**PE) for b in (0,1,1.5,1)],True),PIPE)
def walkp(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,56+1.2*abs(c)),4,0,0,(X+2+11*c,G-4*max(0,-sn)),(X+2-11*c,G-4*max(0,sn)),PL,PR,**PE)
clip('walk_pipe','side view: walking, steel pipe held like a bat resting on her shoulder',tail([walkp(i/8) for i in range(8)],True),PIPE)
def runp(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+8,58+2.5*abs(sn)),14,0,0,(X+6+19*c,G-12*max(0,-sn)-1),(X+6-19*c,G-12*max(0,sn)-1),PL,PR,**PE)
clip('run_pipe','side view: running, steel pipe held like a bat resting on her shoulder',tail([runp(i/8) for i in range(8)],True),PIPE)
REDO=['seatrest','seatthink','doze','walllean','armscross','bored','situp','wallcry','phone','bedwake','hurtidle','limp','hide','doorclose','leadhand','victory','wave','walk_folder']
# ── 수정 2차 (2026-10-21 결함 목록 3·13~16·18) ──
# 정면 돌아감의 실제 원인: 뼈대 폭이 아니라 기준 그림. A2는 셔츠·넥타이가 보이는 3/4 각도라, 생성기가 A2를 따라가면 3/4,
# 뼈대를 따라가면 옆모습이 나옴(같은 G0 뼈대인 guard·step은 옆모습, evade·grab2는 처음부터 끝까지 3/4).
# 그래서 다시 생성분은 옆모습으로 나온 guard/00.png(뼈대 = G0)를 기준 그림으로 씀(gen_fix2.py). 아래는 약했던 동작의 뼈대.
# 20 회피: 몸을 낮게 숙이며 뒷발로 크게 물러났다(그림 안 -18px) 다시 스탠스로
EVA=P((X-8,68),14,-0.9,-0.5,(X+4,G-7),(X-24,G),(16,6),'chin',tilt=10)
EVB=P((X-18,72),16,-0.9,-0.5,(X-6,G),(X-32,G-2),(16,8),'chin',tilt=12)
clip('evade','quick low evasive back-step: ducks low and hops back, then returns to the boxing guard',[G0,EVA,EVB,EVB,lerp(EVB,G0,.5),G0])
# 21 잡기: 앞손을 끝까지 뻗어 멱살을 잡고(팔 다 펴짐) 당겨 붙임 → 끝 자세 GR2(잡기 타격·폭파와 이어짐)
GRF=P((X+8,60),12,-1.3,-0.7,(X+24,G),(X-10,G-2),(44,2),'chin')
clip('grab2','lunging reach with the lead arm fully extended, grabs an enemy by the collar and pulls them close',[G0,staged(G0,GRF,.5),GRF,lerp(GRF,GR2,.6)])
clip('grab','lunging reach with the lead arm fully extended, grabs an enemy by the collar',[G0,staged(G0,GRF,.5),GRF,lerp(GRF,GR,.6)])
# 3b 전투 걸음: 앞발을 높이 들어 크게(20px) 내딛고 뒷발이 끌려옴. 끝에서 코드가 20px 이동(빌더 adv=20)
clip('step','boxing footwork: lead foot lifts and steps far forward, rear foot slides after, guard up',
     [shuffle(8,0,8,0),shuffle(16,0,7,0),shuffle(20,0,0,0),shuffle(20,7,0,7),shuffle(20,15,0,5),shuffle(20,20,0,0)])
# 12 돌진: 상체를 크게(35~45도) 숙이고 앞어깨를 내밀어 들이받음, 머리는 어깨 뒤
DSL=P((X+12,68),36,-1.8,-1.0,(X+30,G),(X-12,G-4),(10,16),(2,12),head=(6,-4),tilt=8)
DSH=P((X+26,70),46,-2.0,-1.1,(X+44,G),(X-8,G-8),(12,18),(4,14),head=(6,-4),tilt=8)
clip('dash','running shoulder charge: torso bent low and forward, lead shoulder driving into the enemy, rear leg pushing hard',[DASH0,DSL,DSH,sh(DSH,3),lerp(DSH,GUARD(20),.5),GUARD(22)])
# 13 점프 킥: 앞다리를 거의 수평으로 끝까지 폄, 뒷무릎은 가슴까지 접음, 상체는 뒤로
KK=lambda e: P((X-4*e,54),-6-6*e,-0.6,-0.4,(X+14+32*e,G-20-14*e),(X-2,G-36),(13,0),'chin',rk=KNEE_UP)
clip('airkick','mid-air flying side kick: lead leg fully extended straight forward, rear knee tucked to the chest',[air(12),KK(.45),KK(1),KK(1),KK(.5),air(10)])
# 18 전면 가드: 팔꿈치를 앞으로 모아 두 팔뚝을 세워 얼굴을 덮음, 고개 숙이고 몸을 웅크림
BF2=P((X-2,63),10,-0.7,-0.4,(X+13,G),(X-13,G-2),(15,-15),(12,-11),tilt=16,le=ELB_OUT,re=ELB_OUT)
clip('blockfront','covering up: both forearms raised vertically in front of the face, elbows together, chin tucked',[G0,lerp(G0,BF2,.5),BF2,BF2])

# ── 수정 3차 (2026-10-21 사용자: 달리기가 조깅 같음, 쇠파이프가 찌르기 방향) ──
# 4 달리기(전력 질주 8, 제자리 순환): 상체 22도, 보폭 ±24, 뒤로 찬 발 높이, 두 발 다 뜬 장(0.25·0.75), 팔 크게 엇갈림
def sprint(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t); fl=abs(sn)
    lf=(X+8+24*c-10*max(0,-sn), G-18*max(0,-sn)-5*fl); rf=(X+8-24*c-10*max(0,sn), G-18*max(0,sn)-5*fl)
    return P((X+10,60-5*fl),22,0.45*c,0.35*c,lf,rf,(10-20*c,12+5*c),(4+20*c,12-5*c),head=(6,-6),lk=KNEE_FWD,rk=KNEE_FWD)
clip('run','full-speed sprint: torso leaning well forward, long strides, knees driving high, both feet leave the ground, arms pumping hard, hair streaming back',[sprint(i/8) for i in range(8)])
# 38 쇠파이프 내려치기(7): 두 손 잡음 → 뒤 어깨 위로 치켜듦 → 머리 위 → 앞으로 크게 내려침(타격 3장) → 아래로 따라감 → 회수
PW1=P((X-3,58),-8,0.6,0.3,(X+12,G),(X-12,G-1),(-8,-14),(-6,-10),le=ELB_UP,re=ELB_UP)
PW2=P((X,58),-2,0.2,0.1,(X+13,G),(X-11,G-1),(4,-24),(2,-20),le=ELB_UP,re=ELB_UP)
PW3=P((X+8,61),16,-0.8,-0.5,(X+22,G),(X-10,G-2),(30,4),(24,6))
PW4=P((X+10,63),26,-1.0,-0.6,(X+23,G),(X-9,G-2),(24,28),(18,28))
clip('pipe2','two-handed overhead smash with a steel pipe: raises it high behind her shoulder, swings it over her head and smashes it down in front, follow-through low',
     [PI,PW1,PW2,PW3,PW4,lerp(PW4,PI,.5),PI],'gripping a long steel pipe with both hands, the whole pipe clearly visible in every frame')

# ── 기본 클립 재설계 (2026-10-21 사용자 승인, docs/캐릭터제작서/쟈알디_기본클립_재설계_2026-10-21.md 5장) — 전투 스레드 몫 13개 ──
# 몸만: 빈 손, 설명에 물건·장면 이름 없음. 물건은 게임이 손목 좌표에 따로 그림. 팔꿈치는 모두 직접 지정(몸 앞·옆).
C2=dict(lh=('r',17,15),rh=('r',15,17),le=('e',3,16),re=('e',1,17))      # 두 손: 아래팔 수평, 손은 가슴 앞에서 마주 봄
C1=dict(lh=('r',11,12),le=('e',3,16))                                   # 한 손: 앞손 주먹을 가슴 높이
def walkb(t,**k):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    k.setdefault('rh',(-1+7*c,28))
    return P((X+2,56+1.2*abs(c)),4,0,0,(X+2+11*c,G-4*max(0,-sn)),(X+2-11*c,G-4*max(0,sn)),**k)
def runb(t,**k):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    k.setdefault('rh',(2+14*c,14-4*c))
    return P((X+8,58+2.5*abs(sn)),14,0,0,(X+6+19*c,G-12*max(0,-sn)-1),(X+6-19*c,G-12*max(0,sn)-1),**k)
for tag,k,txt in (('carry2',C2,'both forearms held level in front of the chest, open hands facing each other, elbows bent at the sides'),
                  ('carry1',C1,'near hand closed in a loose fist held at chest height in front of her, elbow bent, other arm relaxed')):
    clip(f'{tag}_idle',f'side view: standing still, {txt}',[P((X,56+b),3,0,0,(X+8,G),(X-6,G),**{**k,**({'rh':'down'} if tag=='carry1' else {})}) for b in (0,.5,1,.5)])
    clip(f'{tag}_walk',f'side view: walking, {txt}',[walkb(i/8,**k) for i in range(8)])
    clip(f'{tag}_run',f'side view: running, {txt}',[runb(i/8,**k) for i in range(8)])
# 살금 걷기: 무릎을 앞으로 굽힌 채 발끝으로 천천히, 상체 살짝 숙임, 두 손은 허리 앞에서 균형
def sneakb(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,64+abs(c)),14,0,0,(X+4+10*c,G-2-5*max(0,-sn)),(X+4-10*c,G-2-5*max(0,sn)),('r',14,20),('r',10,22),tilt=8,
             lk=KNEE_UP,rk=KNEE_UP,le=('e',4,16),re=('e',2,17))
clip('sneak','side view: tiptoeing slowly, knees bent forward, upper body slightly lowered, hands held low in front for balance',[sneakb(i/8) for i in range(8)])
# 뒤돌아보기 시도(불합격: 생성기가 뒤가 아니라 화면 쪽으로 얼굴을 돌림 → 이전 lookback 유지, 결과는 커밋하지 않음)
def LBK(a):
    p=P((X,55),2,0.9*a,0.35*a,(X+6,G),(X-4,G),'down','down',head=(5-11*a,-7))
    n=p['NOSE']
    for k in ('RIGHT EYE','LEFT EYE','RIGHT EAR','LEFT EAR'):   # 얼굴이 뒤를 향하면 눈·귀도 코 뒤쪽 → 앞쪽으로 넘어감
        p[k]=(n[0]+(p[k][0]-n[0])*(1-2*a),p[k][1])
    return p
clip('lookback_try','side view: turns her shoulders and upper body back and looks behind over her shoulder, then faces forward again',[LBK(0),LBK(.5),LBK(.9),LBK(.9),LBK(.5),LBK(0)])
# 머리 넘기기: 앞손을 이마 앞에서 정수리 위를 지나 뒤로 쓸어 넘김, 팔꿈치는 앞·위
HFB=lambda a: P((X,55),2,0,0,(X+6,G),(X-4,G),('r',9-15*a,-15-3*a),'down',tilt=-6*a,le=('e',12-2*a,-2-6*a))
clip('hairflip','side view: sweeps her near hand from her forehead over the top of her head and pushes her long hair back, elbow raised in front',
     [STAND(0),HFB(0),HFB(.5),HFB(1),HFB(1),STAND(0)])
# 당황: 고개 숙이고 앞손으로 뒷머리를 긁음, 팔꿈치는 얼굴 옆 앞으로
EMB=lambda d: P((X,55),2,0,0,(X+6,G),(X-4,G),('r',-7+d,-11),'down',tilt=12,le=('e',11,-4))
clip('embarrassed','side view: embarrassed, head lowered, scratches the back of her head with her near hand, elbow pointing forward',
     [STAND(0),EMB(0),EMB(2),EMB(0),EMB(2),STAND(0)])
# 어깨 으쓱: 두 어깨를 올리고 팔꿈치를 옆구리에 붙인 채 아래팔을 앞으로, 손바닥 위
def SRB(a):
    p=P((X,55),2,0,0,(X+6,G),(X-4,G),('r',15,20),('r',13,21),tilt=6*a,le=('e',1,16),re=('e',0,16))
    return jit(p,0,-3*a,['SHOULDER','ELBOW',' ARM'])
clip('shrug','side view: shrugs, both shoulders raised, elbows at her sides, forearms forward with palms turned up, head tilted',[STAND(0),SRB(.5),SRB(1),SRB(1),SRB(.5),STAND(0)])
# 고개 젓기: 몸은 그대로, 머리만 좌우로 작게
def SKB(d):
    p=P((X,55),2,0,0,(X+6,G),(X-4,G),'down','down'); return jit(p,2*d,0,['NOSE','EYE','EAR'])
clip('headshake','side view: shakes her head slightly from side to side, body completely still',[SKB(0),SKB(-1),SKB(1),SKB(-1),SKB(1),SKB(0)])
# 손잡고 이끌기: 앞으로 걸으며 가까운 팔을 몸 뒤 아래로 쭉 뻗음(손은 엉덩이 뒤 아래), 고개 살짝 뒤로
def leadb(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+4,57+1.2*abs(c)),10,0,0,(X+4+11*c,G-4*max(0,-sn)),(X+4-11*c,G-4*max(0,sn)),('r',-24,24),(2+7*c,28),head=(4,-7),le=('e',-9,13))
clip('leadhand','side view: walking forward, near arm stretched straight back and down behind her body, hand open',[leadb(i/8) for i in range(8)])
BASE13=['carry2_idle','carry2_walk','carry2_run','carry1_idle','carry1_walk','carry1_run','sneak','leadhand','hairflip','embarrassed','shrug','headshake']

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
