# 스팡달 전 동작 뼈대 (animate_with_skeleton_v3용). 설계: docs/캐릭터제작서/동작설계_spangdal.md (5장 클립 표, 2장 동작 근거, 3장 성격 규칙)
# 좌표 공간은 쟈알디 rig.py와 같음(160×112, 내보낼 때 192×144로 +2,+28). 오른쪽(동쪽)을 봄, RIGHT = 가까운 쪽 = 앞손·앞발.
# 뼈 길이는 쟈알디 × 0.89(기준 그림 S0 키 83px / 쟈알디 93px). 발목선 G=101(낮은 굽이라 쟈알디보다 1px 위, 발바닥 y=136).
# 쟈알디와 다른 점: 주먹 없음(손끝을 편 빈 손), 발차기 없음, 상체·머리 고정, 손은 쉬면 배 앞에 포갬, 고개 기울이기, 어깨 회전 작게(옆모습).
import math,sys
from PIL import Image,ImageDraw
sys.path.insert(0,'../../jyaldi-v5/scripts'); import skel
J=skel.J
SC=0.89
THIGH,SHIN,UARM,FARM,TORSO=22.4*SC,23.4*SC,17*SC,14*SC,24
G=101
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
def P(hip,lean=2,s=0,h=0,lf=None,rf=None,lh='fold',rh='fold',head=(6,-8),tilt=0,lk=KNEE_FWD,rk=KNEE_FWD,le=None,re=None):
    """hip 골반, lean 몸통 앞기울기(도), s 어깨 회전(-앞손쪽 앞), h 골반 회전, lf/rf 앞발·뒷발 발목, lh/rh 앞손·뒷손:
    'fold'(배 앞 포갬, 기본) 'down' 'out' ('r',x,y)=목 기준(몸통 따라 돎) ('a',x,y)=절대 (x,y)=목 기준 고정. le/re 팔꿈치 ('e',x,y)=목 기준"""
    N=add(hip,rot((0,-TORSO),lean))
    p={'NECK':N}
    p['RIGHT SHOULDER']=add(N,rot((-5*s+1,3),lean)); p['LEFT SHOULDER']=add(N,rot((5*s-1,3),lean))
    p['RIGHT HIP']=add(hip,rot((-4*h+1,0),lean)); p['LEFT HIP']=add(hip,rot((4*h-1,0),lean))
    hv=rot(head,lean+tilt); nose=add(N,hv); p['NOSE']=nose
    for k,v in (('RIGHT EYE',(-3,-3)),('LEFT EYE',(0,-3)),('RIGHT EAR',(-7,-2)),('LEFT EAR',(-5,-3))): p[k]=add(nose,rot(v,lean+tilt))
    chin=add(nose,rot((1,4),lean+tilt))
    def hand(side,t,pick):
        sh_=p[f'{side} SHOULDER']; e=None
        if t=='fold':    # 배 앞에 포갬(기본 그림 자세): 앞손이 뒷손 위
            t=('r',8,21) if side=='RIGHT' else ('r',7,22); e=('e',3,13) if side=='RIGHT' else ('e',1,13)
        if t=='chin': tgt=chin if side=='LEFT' else add(chin,(3,-2))
        elif t=='out': tgt=(sh_[0]+52,sh_[1]-1)
        elif t=='down': tgt=add(sh_,(2 if side=='RIGHT' else -1,26))
        elif isinstance(t,tuple) and t[0]=='a': tgt=(t[1],t[2])
        elif isinstance(t,tuple) and t[0]=='r': tgt=add(N,rot((t[1],t[2]),lean))
        else: tgt=add(N,t)
        pk=pick if pick is not None else e
        if isinstance(pk,tuple) and pk[0]=='e':
            p[f'{side} ELBOW']=add(N,rot((pk[1],pk[2]),lean)); p[f'{side} ARM']=tgt; return
        el,w=ik(sh_,tgt,UARM,FARM,pk or ELB_DOWN); p[f'{side} ELBOW']=el; p[f'{side} ARM']=w
    hand('RIGHT',lh,le); hand('LEFT',rh,re)
    lf=lf or (hip[0]+5,G); rf=rf or (hip[0]-3,G)
    for side,an,pk in (('RIGHT',lf,lk),('LEFT',rf,rk)):
        k,a=ik(p[f'{side} HIP'],an,THIGH,SHIN,pk); p[f'{side} KNEE']=k; p[f'{side} LEG']=a
    return p
def lerp(a,b,t): return {k:(a[k][0]+(b[k][0]-a[k][0])*t,a[k][1]+(b[k][1]-a[k][1])*t) for k in J}
def handfirst(a,b,t):
    """찌르기(펜싱·관수 원칙): 손이 먼저, 몸·발은 늦게"""
    out={}
    for k in J:
        tt=min(1,t*1.6) if ('ELBOW' in k or k.endswith(' ARM')) else t**1.5
        out[k]=(a[k][0]+(b[k][0]-a[k][0])*tt,a[k][1]+(b[k][1]-a[k][1])*tt)
    return out
def hipfirst(a,b,t):
    """베기(칼리 아바니코): 허리 먼저, 팔은 채찍처럼 늦게"""
    out={}
    for k in J:
        tt=min(1,t*1.5) if ('HIP' in k or 'KNEE' in k or 'LEG' in k or 'SHOULDER' in k) else t**1.8 if ('ELBOW' in k or k.endswith(' ARM')) else t
        out[k]=(a[k][0]+(b[k][0]-a[k][0])*tt,a[k][1]+(b[k][1]-a[k][1])*tt)
    return out
def sh(p,dx,dy=0): return {k:(v[0]+dx,v[1]+dy) for k,v in p.items()}
def jit(p,dx,dy,keys): return {k:((v[0]+dx,v[1]+dy) if any(s in k for s in keys) else v) for k,v in p.items()}
def _xs(a,b,c):
    u=(b[0]-a[0],b[1]-a[1]); f=(c[0]-b[0],c[1]-b[1]); n=math.hypot(*u)*math.hypot(*f) or 1
    return (u[0]*f[1]-u[1]*f[0])/n
def _mirror(p,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]; L=dx*dx+dy*dy or 1; t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L
    q=(a[0]+t*dx,a[1]+t*dy); return (2*q[0]-p[0],2*q[1]-p[1])
def anatomic(p):
    """팔꿈치·무릎 역방향 자동 보정(쟈알디 rig.py와 같음). 검사: audit.py"""
    q=dict(p)
    for s in ('RIGHT','LEFT'):
        if _xs(q[f'{s} SHOULDER'],q[f'{s} ELBOW'],q[f'{s} ARM'])>0.12: q[f'{s} ELBOW']=_mirror(q[f'{s} ELBOW'],q[f'{s} SHOULDER'],q[f'{s} ARM'])
        if _xs(q[f'{s} HIP'],q[f'{s} KNEE'],q[f'{s} LEG'])<-0.12: q[f'{s} KNEE']=_mirror(q[f'{s} KNEE'],q[f'{s} HIP'],q[f'{s} LEG'])
    return q
CLIPS={}   # 이름: (동작 설명(100자 이내), 소품 설명, [자세...])
def clip(name,action,poses,prop=''):
    assert 3<=len(poses)<=15,(name,len(poses))
    if len(action)>100: print("LONG",name,len(action))
    CLIPS[name]=(action,prop,[anatomic(p) for p in poses])
def tail(ps,loop): return ps+[ps[0] if loop else ps[-1]]   # 생성기가 끝 장을 기준 그림으로 되돌리는 버릇 → 버릴 장 1개(빌더 auto_trim)
def cyc(f,n=8): return [f(i/n) for i in range(n)]

# ── 기본 자세 ──
X=66
STAND=lambda b=0,tilt=0,**k: P((X,62+b),1,0,0,(X+4,G),(X-3,G),tilt=tilt,**k)       # 손 포갬, 발 모음(기본 그림)
FOLD=dict(lh='fold',rh='fold')
# 칼잡이 낮은 자세(실랏·칼리): 무릎 굽혀 낮춤, 앞발 앞꿈치, 손끝이 앞을 향해 몸 앞 낮게(주먹 아님)
STANCE=lambda d=0,b=0,tilt=0: P((X+d,68+b),8,-0.2,-0.1,(X+16+d,G),(X-22+d,G-1),('r',17,17),('r',12,20),tilt=tilt,le=('e',9,11),re=('e',5,13))
S0=STANCE()
DEEP=lambda d=0,b=0: P((X+d,92+b),4,0,0,(X+12+d,G),(X-8+d,G),('r',8,14),('r',6,15),le=('e',4,11),re=('e',2,11),lk=KNEE_FWD,rk=KNEE_FWD)  # 수직 깊은 웅크림(그림자 가라앉기 끝)
CAT=lambda d=0,b=0: P((X-2+d,90+b),32,0,0,(X+10+d,G),(X-8+d,G),('a',X+24+d,G-1),('r',14,14),head=(7,-6),tilt=-26,le=('e',10,8),re=('e',6,12))   # 고양이 웅크림
REFP=S0

# ── 5.1 전투·기본 ──
clip('idle','perfectly still standing idle with hands folded in front, only slow breathing',tail([STAND(0),STAND(.4),STAND(.7),STAND(.4)],True))
GR=lambda a: P((X,62),3,0,0,(X+4,G),(X-3,G),('r',15+a,-1),('r',14,4),tilt=-2,le=('e',10,6),re=('e',8,9))
clip('groom','raises one hand to eye level and strokes the fingertips with the other thumb, like filing nails',tail([STAND(0),GR(0),GR(1),GR(0),GR(1),STAND(0)],False))
clip('stance','low crouched ready stance, knees bent, empty hands low in front with fingers pointing forward',tail([S0,STANCE(0,.5),STANCE(0,.8),STANCE(0,.5)],True))
clip('engage','unfolds her hands and sinks into a low ready stance, head tilting to one side',tail([STAND(0),lerp(STAND(0),S0,.35),lerp(STAND(0),S0,.7),STANCE(tilt=-4)],False))
def walkf(t,stride=9,lift=3,bob=0.4,lean=2,**k):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+1,62+bob*abs(c)),lean,0.05*c,0.1*c,(X+1+stride*c,G-lift*max(0,-sn)),(X+1-stride*c,G-lift*max(0,sn)),**{**FOLD,**k})
clip('walk','silent catlike walk on the balls of her feet, upper body and head perfectly still, hands folded',tail(cyc(walkf),True))
def glide(ld,rd,ll=0,rl=0):
    return P((X+(ld+rd)/2,71),8,-0.2,-0.1,(X+17+ld,G-ll),(X-16+rd,G-1-rl),('r',17,17),('r',12,20),le=('e',9,11),re=('e',5,13))
clip('glide','low stance: front foot slides far forward smoothly, rear foot glides after, head stays level',tail([glide(6,0,1),glide(16,0,1),glide(22,0),glide(22,8,0,1),glide(22,17,0,1),glide(22,22)],False))
def runf(t,**k):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    a=dict(lh=('r',2-5*c,23),rh=('r',-2+5*c,22),le=('e',-2-3*c,13),re=('e',-4+3*c,13)); a.update(k)
    return P((X+8,68+1*abs(sn)),26,0.1*c,0.15*c,(X+6+20*c,G-9*max(0,-sn)),(X+6-20*c,G-9*max(0,sn)),**a)
clip('run','fast low sprint, torso bent far forward, arms held close with fingers down, head level, long strides',tail(cyc(runf),True))
JL=P((X,58),2,0,0,(X+20,G-26),(X-22,G-20),('r',14,4),('r',-6,8),lk=KNEE_FWD,rk=KNEE_FWD,le=('e',8,6),re=('e',-4,10))   # 제테: 다리 앞뒤로
jl=lambda t: lerp(DEEP(0,-14),JL,t)
clip('jump','light high leap: short dip, springs off the toes, legs split front and back, upper body upright',
     tail([STANCE(0,3),DEEP(0,-14),jl(.5),JL,sh(JL,0,-1),jl(.5),STANCE(0,4),S0],False))
clip('crouch','drops into a low catlike crouch, both feet flat, front fingertips touching the floor',tail([S0,lerp(S0,CAT(),.5),CAT(),CAT(0,1)],False))
def crawlc(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X-2+2*c,90+0.5*abs(sn)),32,0,0,(X+10+5*c,G-2*max(0,-sn)),(X-8-5*c,G-2*max(0,sn)),('a',X+24+6*c,G-1-2*max(0,sn)),('r',14+4*c,14),head=(7,-6),tilt=-26,le=('e',10,8),re=('e',6,12))
clip('crouchwalk','prowling forward low like a cat: front hand steps, then the feet follow, body close to the floor',tail(cyc(crawlc,7),True))
GS_=lambda t: P((X+2*t,90),32+14*t,0,0,(X+10,G),(X-8,G),('a',X+26+4*t,G-1-6*(1-t)*(t>0)),('r',14,14),head=(7,-6),tilt=-26,le=('e',12,8),re=('e',6,12))
clip('groundspike','from a low crouch slaps the open palm flat on the floor ahead, fingers spread',tail([CAT(),GS_(.3),GS_(1),GS_(1),GS_(1),CAT()],False))
RS=P((X+4,64),6,-0.2,0,(X+14,G),(X-8,G),('r',22,-26),('r',6,16),head=(6,-9),tilt=-6,le=('e',14,-6),re=('e',3,12))
clip('risestab','rises straight up out of a deep squat, thrusting the near fingertips upward high in front',tail([DEEP(),lerp(DEEP(),RS,.4),lerp(DEEP(),RS,.8),RS,RS,lerp(RS,S0,.5)],False))
# 3연타: 1타 앞손 관수(손 먼저, 앞발 반 걸음 2px) → 2타 뒷손 아바니코 베기(허리 먼저, 4px) → 3타 양손 X 런지(8px). 1·2타는 몸 이동 최소
STAB=P((X+2,71),9,-0.4,-0.1,(X+19+2,G),(X-16,G-1),('r',44,4),('r',12,20),le=('e',22,5),re=('e',5,13))
clip('stab1','spear-hand thrust: near hand straight forward with fingers together, hand first, then a half step',tail([S0,handfirst(S0,STAB,.5),STAB,STAB,lerp(STAB,STANCE(2),.5),STANCE(2)],False))
SL0=P((X+2,71),4,0.4,0.3,(X+19,G),(X-16,G-1),('r',14,16),('r',8,-14),le=('e',8,11),re=('e',10,-4))      # 뒷손을 귀 높이로 감아올림(검수 03:55: 1타와 같은 직선 뻗기 → 위→아래 사선으로 바꿈)
SL1=P((X+6,73),14,-0.2,-0.2,(X+23,G),(X-14,G-1),('r',16,12),('r',34,26),le=('e',8,10),re=('e',18,14))   # 손등으로 앞아래까지 사선 베기
clip('slash2','backhand slash: rear open hand starts high by her ear and slices diagonally down and forward',tail([STANCE(2),SL0,hipfirst(SL0,SL1,.5),SL1,SL1,lerp(SL1,STANCE(6),.5)],False))
LU=P((X+18,76),6,-0.3,-0.2,(X+48,G),(X-8,G),('r',46,2),('r',44,4),le=('e',22,3),re=('e',21,5))      # 펜싱 런지: 두 손 끝 모아 일직선
clip('pierce3','fencing lunge: both hands thrust forward fingertips first, front foot lunges far, rear leg straight',
     tail([STANCE(6),P((X+6,72),8,-0.2,-0.1,(X+24,G),(X-10,G-1),('r',10,12),('r',8,13),le=('e',6,10),re=('e',4,11)),handfirst(STANCE(6),LU,.45),LU,LU,LU,lerp(LU,STANCE(14),.5),STANCE(14)],False))
EX0=P((X+4,64),4,-0.1,0,(X+14,G),(X-6,G),('r',24,-12),('r',10,14),le=('e',12,-2),re=('e',4,12))
EX1=P((X+4,64),5,-0.1,0,(X+14,G),(X-6,G),('r',24,-12),('r',19,-2),le=('e',12,-2),re=('e',8,9))   # 찌르는 손은 쥔 손보다 짧고 아래(권투 가드처럼 두 손 나란히 → 금지)
clip('execute','near open hand grips high at head height, other hand rises from the hip in one short fingertip stab',
     tail([STANCE(4),EX0,EX0,EX1,EX1,EX1,lerp(EX1,STANCE(4),.5)],False))
PS0=P((X+8,76),30,-0.3,-0.2,(X+28,G),(X-22,G-2),('r',30,14),('r',4,18),le=('e',14,10),re=('e',0,13))
PS1=P((X+30,76),32,-0.3,-0.2,(X+50,G),(X+2,G-3),('r',36,12),('r',2,20),le=('e',18,8),re=('e',-1,13))
clip('passslash','dashes low past someone, near arm cutting straight out, stops beyond them still facing forward',
     tail([runf(0.25),PS0,lerp(PS0,PS1,.5),PS1,lerp(PS1,STANCE(36),.5),STANCE(36)],False))
AT=P((X,56),4,0,0,(X+10,G-24),(X-6,G-22),('r',12,8),('r',10,10),lk=KNEE_FWD,rk=KNEE_FWD,le=('e',6,9),re=('e',4,10))
AR=P((X,56),18,0,0,(X+12,G-20),(X-8,G-18),('r',26,30),('r',22,32),lk=KNEE_FWD,rk=KNEE_FWD,le=('e',12,14),re=('e',10,15))
clip('airrain','in mid air she curls up, then flings both open hands down and forward, legs tucked',tail([AT,lerp(AT,AR,.5),AR,AR,AT],False))
SU=P((X,70),6,-0.2,-0.1,(X+16,G),(X-15,G-1),('r',18,-10),('r',10,18),le=('e',13,7),re=('e',5,12))
clip('spineup','raises the near forearm upright in front of her eyes, fingers pointing up, low stance',tail([S0,lerp(S0,SU,.5),SU,SU,SU],False))
TH=P((X+1,70),9,-0.3,-0.1,(X+17,G),(X-15,G-1),('r',34,-4),('r',10,18),le=('e',20,1),re=('e',5,12))
clip('throw','quick dart throw: snaps the near forearm and wrist forward from upright, body still',tail([SU,TH,lerp(TH,SU,.5),SU],False))
FA0=P((X-1,71),4,0.5,0.4,(X+16,G),(X-15,G-1),('r',12,18),('r',-10,22),le=('e',6,12),re=('e',-6,13))   # 뒷손을 골반 뒤 낮게
FA1=P((X+2,71),8,-0.5,-0.4,(X+18,G),(X-14,G-1),('r',12,18),('r',34,-12),le=('e',6,12),re=('e',18,-3))   # 아래→위로 크게 뿌려 올림(2타의 위→아래와 반대)
clip('fan','twists the waist, swings the rear arm from low behind the hip up and forward, open fingers fling',tail([S0,FA0,FA0,hipfirst(FA0,FA1,.5),FA1,lerp(FA1,S0,.5)],False))
PL0=P((X,70),6,0,0,(X+16,G),(X-15,G-1),('r',18,8),('r',10,14),le=('e',10,10),re=('e',8,12))
PL1=P((X,70),6,0,0,(X+16,G),(X-15,G-1),('r',18,8),('r',22,-4),le=('e',10,10),re=('e',14,4))
clip('pluck','holds the near forearm out, the other hand slides along it and pulls something long out upward',tail([S0,PL0,lerp(PL0,PL1,.5),PL1,lerp(PL1,S0,.5)],False))
clip('sink','knees give way and she drops straight down into a deep squat, upper body upright, arms close',tail([S0,lerp(S0,DEEP(),.4),lerp(S0,DEEP(),.8),DEEP()],False))
def rise(t):   # 머리 → 어깨 → 골반 순으로 곧게 올라옴
    a,b=DEEP(),S0; out={}
    for k in J:
        tt=min(1,t*1.4) if k in ('NOSE','NECK','RIGHT EYE','LEFT EYE','RIGHT EAR','LEFT EAR') else min(1,t*1.2) if 'SHOULDER' in k or 'ELBOW' in k or k.endswith(' ARM') else t
        out[k]=(a[k][0]+(b[k][0]-a[k][0])*tt,a[k][1]+(b[k][1]-a[k][1])*tt)
    return out
clip('rise','rises straight up out of a deep squat, head first, into a low ready stance',tail([DEEP(),rise(.3),rise(.6),rise(.85),S0],False))
LC=lambda d: jit(P((X+1,70),6,-0.2,-0.1,(X+17,G),(X-15,G-1),('r',30,-2),('r',28,3),le=('e',16,4),re=('e',14,6)),d*.5,d*.3,['RIGHT ARM','LEFT ARM'])
clip('latticecharge','both arms reach forward with hands open and fingers spread wide, fingers slowly curling',tail([LC(0),LC(1),LC(0),LC(-1)],True))
LR=P((X-1,71),2,-0.1,-0.1,(X+17,G),(X-15,G-1),('r',12,10),('r',10,12),le=('e',4,13),re=('e',2,13))
clip('latticerelease','snaps both spread hands shut and yanks them back toward her chest',tail([LC(0),lerp(LC(0),LR,.6),LR,LR,lerp(LR,S0,.5)],False))
BG=P((X-1,71),4,-0.3,-0.1,(X+16,G),(X-15,G-1),('r',13,8),('r',11,10),le=('e',13,16),re=('e',11,17))
clip('spikeguard','turns her body narrow and crosses both forearms upright in front of her chest',tail([S0,lerp(S0,BG,.5),BG,BG],False))
PA=P((X-1,72),4,-0.3,-0.1,(X+16,G),(X-15,G-1),('r',20,-8),('r',10,14),le=('e',16,8),re=('e',5,12))
clip('parry','near forearm sweeps up and outward to deflect, knees already giving way to sink',tail([BG,PA,lerp(PA,DEEP(),.4),lerp(PA,DEEP(),.8)],False))
SSL=P((X+8,93),20,0,0,(X+22,G),(X-2,G),('r',10,16),('r',6,17),le=('e',4,12),re=('e',2,12))
clip('shadowstep','drops straight down into a deep squat, darts forward low, then rises straight up',tail([S0,lerp(S0,DEEP(),.6),DEEP(),SSL,lerp(DEEP(12),S0,.4),sh(S0,0)],False))
GA0=P((X+6,65),5,-0.2,0,(X+14,G),(X-4,G),('r',26,-8),('r',22,0),le=('e',14,0),re=('e',12,6))
GA1=P((X+10,64),4,-0.1,0,(X+18,G),(X+2,G),('r',24,-10),('r',24,-2),le=('e',13,-2),re=('e',13,4))
clip('reargrab','steps in close, near arm wraps high around a neck in front, the other hand clamps over a mouth',tail([S0,lerp(S0,GA0,.5),GA0,lerp(GA0,GA1,.5),GA1,GA1],False))
GT=P((X+10,64),6,-0.1,0,(X+18,G),(X+2,G),('r',24,-10),('r',20,14),le=('e',13,-2),re=('e',12,10))
GT0=P((X+10,64),3,-0.1,0,(X+18,G),(X+2,G),('r',24,-10),('r',10,8),le=('e',13,-2),re=('e',4,10))
clip('grabstab','holding someone from behind, pulls the free hand back and jabs the fingertips down short',tail([GA1,GT0,GT,lerp(GT,GA1,.5)],False))
PN1=P((X+10,78),20,-0.1,0,(X+24,G),(X+2,G-1),('r',26,8),('r',20,8),le=('e',13,6),re=('e',10,8))
PN2=P((X+10,90),30,0,0,(X+26,G),(X+0,G),('r',26,16),('r',12,4),le=('e',14,10),re=('e',6,6),rk=KNEE_FWD)
PN3=P((X+12,90),36,0,0,(X+26,G),(X+0,G),('r',26,16),('a',X+40,G-2),le=('e',14,10),re=('e',16,12))
clip('pin','pushes the held enemy down, kneels with them and drives the free fingertips down to the floor',tail([GA1,PN1,lerp(PN1,PN2,.5),PN2,PN2,PN3,PN3,PN3],False))
SX=P((X+2,70),4,0,0,(X+16,G),(X-14,G-1),('r',34,-14),('r',34,6),le=('e',16,-4),re=('e',16,6))   # 두 손 X 펼침
clip('super','tilts her head with a smile, sinks straight down, then rises with both arms flung open in an X',
     tail([S0,STANCE(tilt=-8),STANCE(tilt=-8),lerp(S0,DEEP(),.5),DEEP(),rise(.5),rise(.9),SX,SX],False))
PK=P((X+2,86),10,0,0,(X+10,G),(X-2,G),('a',X+20,G-1),'fold',tilt=14,lk=KNEE_FWD,rk=KNEE_FWD,le=('e',10,14))
clip('pickup','bends both knees together and lowers straight down, back upright, picks up with two fingertips',tail([STAND(0),lerp(STAND(0),PK,.5),PK,PK,lerp(PK,STAND(0),.5),STAND(0)],False))
TB=P((X,62),0,0.1,0,(X+4,G),(X-3,G),('r',6,-6),'fold',le=('e',10,4))
TF=P((X+1,62),4,-0.2,0,(X+5,G),(X-3,G),('r',32,-4),'fold',le=('e',18,0))
clip('toss','light flick throw with only the forearm and wrist, like throwing a dart, body still',tail([STAND(0),TB,TF,TF,lerp(TF,STAND(0),.5),STAND(0)],False))
DR=lambda t: P((X,62),1,0,0,(X+4,G),(X-3,G),('r',9-1*t,-3-1*t),'fold',tilt=-2*t,le=('e',9,7))
clip('drink','holds a cup to her lips and sips, eyes staring straight ahead, head barely tilts',tail([STAND(0),DR(0),DR(1),DR(1),DR(1),DR(0),STAND(0)],False))
ET=lambda t: P((X,62),3,0,0,(X+4,G),(X-3,G),('r',9,-2+2*t),'fold',tilt=4,le=('e',9,7))
clip('eat','takes a small dainty bite, the other hand stays folded',tail([STAND(0),ET(1),ET(0),ET(1),ET(0),STAND(0)],False))
SN=lambda a: P((X,62),5,0,0,(X+4,G),(X-3,G),('r',14+3*math.cos(a),8+3*math.sin(a)),('r',16,12),tilt=14,le=('e',8,9),re=('e',6,12))
clip('stitch','holds the far forearm across in front and makes small precise sewing stitches over it',tail([SN(0),SN(1.6),SN(3.1),SN(4.7),SN(6.2),SN(7.8)],True))
HL=P((X-2,71),-10,-0.2,-0.1,(X+17,G),(X-16,G-1),('r',15,17),('r',10,20),head=(8,-6),le=('e',8,11),re=('e',4,13))
clip('hit','light hit: only the upper body bends back, head and feet stay in place, face unchanged',tail([S0,HL,lerp(HL,S0,.5),S0],False))
K1=P((X-4,68),-25,0,0,(X+12,G),(X-14,G-2),('r',10,-4),('r',2,4))
K2=P((X-14,64),-70,0,0,(X+12,G-18),(X+2,G-14),('r',8,-6),('r',2,0))
K3=P((X-22,84),20,0,0,(X-6,G-18),(X-14,G-14),('r',10,10),('r',8,12),lk=KNEE_UP,rk=KNEE_UP)     # 공중에서 웅크려 구름
PR=lambda b=0: P((X-12,96+b),88,0,0,(X-46,G),(X-48,G+1),('r',8,6),('r',6,8),head=(7,-5),tilt=-30)   # 엎드림(배를 바닥에)
clip('down','heavy hit: knocked back through the air, rolls over once and ends lying face down',tail([K1,K2,K3,lerp(K3,PR(),.5),PR(),PR(),PR()],False))
GU1=P((X-12,94),60,0,0,(X-44,G),(X-46,G),('r',8,10),('r',6,12),tilt=-20)
GU2=P((X-6,86),30,0,0,(X-24,G),(X-30,G),('r',10,14),('r',8,15),le=('e',4,11),re=('e',2,11))
clip('getup','from lying face down, the upper body lifts first without using the hands and she slides up to stand',tail([PR(),GU1,GU2,lerp(GU2,DEEP(-6),.6),rise(.4),rise(.8),S0],False))
BK=lambda c: P((X,62),1,0,0,(X+4,G),(X-3,G),('r',16,4),'fold',tilt=-4,le=('e',10,8),re=None) if c==0 else P((X,62),1,0,0,(X+4,G),(X-3,G),('r',14,2),'fold',tilt=-4,le=('e',10,8))
clip('beckon','stands still and slowly curls one finger, beckoning someone closer, head tilted',tail([STAND(0),BK(0),BK(1),BK(0),BK(1),BK(0)],True))
TP=lambda d: P((X+4,63),6,-0.1,0,(X+12,G),(X-4,G),('r',24,-6),('r',22+d,-2-d),tilt=-4+3*d,le=('e',13,2),re=('e',12,4))
clip('toothpull','one hand holds a jaw in front, the other fingertips work in with tiny precise twists, head bobbing',tail([STAND(0),TP(0),TP(1),TP(0),TP(1),TP(0),TP(2),lerp(TP(2),STAND(0),.5)],False))
PI0=P((X,70),6,-0.2,-0.1,(X+16,G),(X-15,G-1),('r',16,14),'fold',le=('e',8,11))
PI1=P((X+16,75),6,-0.3,-0.2,(X+44,G),(X-8,G),('r',46,4),('r',-14,10),le=('e',22,4),re=('e',-6,10))
PIPE='a long steel pipe held in one hand like a fencing sword, pointing forward'
clip('pipe','fencing thrust with a steel pipe held in one hand like a sword, rear arm back for balance',tail([PI0,handfirst(PI0,PI1,.5),PI1,PI1,lerp(PI1,PI0,.5),PI0],False),PIPE)
SG=P((X-3,64),-8,0,0,(X+8,G),(X-8,G),('r',34,8),('r',30,10),head=(4,-8),le=('e',17,6),re=('e',15,8))
SGR=jit(SG,-3,-2,['ARM','ELBOW'])
SHOT='a black pump shotgun held at arm length far from her body with both hands'
clip('shotgun','fires a shotgun held at arm length, leaning away from it with distaste, strong recoil',tail([SG,SGR,lerp(SGR,SG,.5),SG,SG],False),SHOT)
PIH=dict(lh=('r',8,26),le=('e',3,14))
PIPE2='a long steel pipe held in one hand hanging down, tip toward the floor like a blade'
clip('idle_pipe','standing still holding a steel pipe in one hand pointing down like a blade',tail([STAND(b,**PIH) for b in (0,.4,.7,.4)],True),PIPE2)
clip('walk_pipe','silent catlike walk holding a steel pipe hanging down in one hand',tail(cyc(lambda t: walkf(t,**PIH),8)[:7],True),PIPE2)
SGH=dict(lh=('r',22,22),le=('e',10,14),rh='fold')
SHOT2='a black pump shotgun dangling from one outstretched hand, muzzle down, held away from her body'
clip('idle_shotgun','standing holding a shotgun out away from her body with one hand, muzzle down, distaste',tail([STAND(b,**SGH) for b in (0,.4,.7,.4)],True),SHOT2)
clip('walk_shotgun','silent walk holding a shotgun out away from her body with one hand, muzzle down',tail(cyc(lambda t: walkf(t,**SGH),8)[:7],True),SHOT2)
clip('run_shotgun','low sprint holding a shotgun out away from her body in one hand, muzzle down',tail(cyc(lambda t: runf(t,lh=('r',24,20),le=('e',10,13))),True),SHOT2)
clip('tired','standing with hands folded, head slowly droops and lifts again, tired breathing',tail([STAND(0,tilt=6),STAND(1,tilt=16),STAND(1.5,tilt=20),STAND(1,tilt=12)],True))
clip('support','stands from a crouch, makes three quick fingertip stabs, a small wave, then sinks down',
     tail([rise(.8),S0,STAB,S0,STAB,lerp(STAB,S0,.5),P((X,70),4,0,0,(X+16,G),(X-15,G-1),('r',14,-4),'fold',le=('e',9,4)),lerp(S0,DEEP(),.6)],False))

# ── 5.2 기본 클립 (몸만) ──
def stepup(t):
    ph=(t*2)%1; lead=t<.5; a=(X+7,G-8); b0=(X-4,G); b1=(X+18,G-16)
    sw=(b0[0]+(b1[0]-b0[0])*ph,b0[1]+(b1[1]-b0[1])*ph-4*math.sin(math.pi*ph))
    hip=(X+3+11*ph,G-38-8*ph+0.5*math.sin(math.pi*ph)); lf,rf=((a,sw) if lead else (sw,a))
    return sh(P(hip,4,0,0,lf,rf,lk=KNEE_UP,rk=KNEE_UP,**FOLD),-11*ph,8*ph)
clip('stepup','stepping up stairs on her toes without a sound, head rising smoothly, hands folded',tail(cyc(stepup,7),True))
SO1=P((X+4,62),4,0,0,(X+16,G-20),(X-3,G),'fold','fold',lk=KNEE_UP)
SO2=P((X+18,60),2,0,0,(X+22,G),(X+12,G-20),'fold','fold',rk=KNEE_UP)
clip('stepover','steps over a low edge: lifts the front knee high with legs close together, then the back leg',tail([STAND(0),SO1,lerp(SO1,SO2,.5),SO2,P((X+18,62),1,0,0,(X+22,G),(X+15,G)),P((X+18,62),1,0,0,(X+22,G),(X+15,G))],False))
LY=P((X-6,94),-90,0,0,(X+34,G-4),(X+33,G-3),('r',4,22),('r',3,24),le=('e',1,12),re=('e',0,12))
LS=P((X-6,94),-2,0,0,(X+34,G-4),(X+33,G-3),('r',14,20),('r',12,21),le=('e',5,13),re=('e',3,13))
clip('liesit','lying on her back, sits up smoothly with a straight back and straight legs, no bounce',tail([LY,lerp(LY,LS,.35),lerp(LY,LS,.7),LS,LS],False))
HW=lambda d: P((X+1,63),8,0,0,(X+5,G),(X-3,G),('r',18+d,18),('r',16-d,19),tilt=14,le=('e',8,12),re=('e',6,13))
clip('handswork','standing, small precise hand work at waist height in front, elbows close to the body',tail([HW(0),HW(1),HW(-1),HW(1)],True))
HH=lambda d: P((X,62),2,0,0,(X+4,G),(X-3,G),('r',4+d,-12),('r',-1-d,-11),tilt=8,le=('e',10,-2),re=('e',7,-1))
clip('handshead','both hands combing through short hair at the top of her head with fingertips',tail([STAND(0),HH(0),HH(2),HH(0),HH(2),HH(0)],True))
def SITC(lean=2,tilt=0,b=0,**k):   # 다리 꼬고 앉음(앞무릎이 높음)
    a=dict(lh=('r',14,20),rh=('r',12,21),le=('e',5,14),re=('e',3,14)); a.update(k)
    return P((X-6,81+b),lean,0,0,(X+14,G-10),(X+10,G),tilt=tilt,lk=KNEE_UP,rk=KNEE_UP,**a)
clip('seatmouth','seated with legs crossed, lifts a hand to her lips for small bites, the other hand in her lap',tail([SITC(4,4,lh=('r',9,-2),le=('e',9,7)),SITC(4,4,lh=('r',12,10),le=('e',8,10)),SITC(4,4,lh=('r',9,-2),le=('e',9,7)),SITC(4,4,lh=('r',12,10),le=('e',8,10))],True))
SH1=dict(lh=('r',15,8),le=('e',8,12))
clip('seathold','seated with legs crossed, holding something up in one hand at chest height, looking at it',tail([SITC(4,16,**SH1),SITC(4,16,b=.4,**SH1),SITC(4,16,b=.7,**SH1),SITC(4,16,b=.4,**SH1)],True))
HLK=lambda b: P((X,62+b),2,0,0,(X+4,G),(X-3,G),('r',15,6),('r',8,14),tilt=16,le=('e',8,12),re=('e',4,13))
clip('holdlook','standing, one hand holds something up at chest height, the other hand supports that elbow',tail([HLK(0),HLK(.4),HLK(.7),HLK(.4)],True))
HE=lambda t: P((X,62),1,0,0,(X+4,G),(X-3,G),('r',-1,-8),'fold',tilt=t,le=('e',9,4))
clip('handear','holds a hand to her near ear, head tilted toward it, the other hand folded at her waist',tail([HE(-4),HE(-6),HE(-4),HE(-2)],True))
def sweepf(d):
    Hd=(X+30+d,G+3); T=(X+2+0.3*d,40); at=lambda t:('a',Hd[0]+(T[0]-Hd[0])*t,Hd[1]+(T[1]-Hd[1])*t)
    return P((X+1+0.2*d,63),6,0,0,(X+8,G),(X-4,G),at(.45),at(.75))
clip('sweep','small precise sweeping strokes back and forth, both hands on one handle, upper body still',tail([sweepf(0),sweepf(4),sweepf(7),sweepf(3),sweepf(-3),sweepf(-6)],True))
LSD=lambda b: P((X-6,94),-86,0,0,(X+22,G-8),(X+18,G-4),('r',12,-6+b),('r',8,12),head=(6,-5),tilt=10,lk=KNEE_UP,rk=KNEE_UP,le=('e',8,4))
clip('liehold','lying on her side, holding something up in one hand in front of her face',tail([LSD(0),LSD(1),LSD(1),LSD(0)],True))
C2=dict(lh=('r',11,12),rh=('r',9,11),le=('e',4,14),re=('e',2,13))
clip('carry2_idle','standing still, both arms holding something against her chest, elbows close',tail([STAND(b,**C2) for b in (0,.4,.7,.4)],True))
clip('carry2_walk','silent catlike walk, both arms holding something against her chest, head level',tail(cyc(lambda t: walkf(t,**C2)),True))
clip('carry2_run','low fast run, both arms holding something against her chest',tail(cyc(lambda t: runf(t,lh=('r',11,12),rh=('r',9,11),le=('e',4,14),re=('e',2,13))),True))
C1=dict(lh=('r',16,10),le=('e',8,12))
clip('carry1_idle','standing still, holding something small up lightly in one hand, other hand folded',tail([STAND(b,**C1) for b in (0,.4,.7,.4)],True))
clip('carry1_walk','silent catlike walk, holding something small up lightly in one hand',tail(cyc(lambda t: walkf(t,**C1)),True))
clip('carry1_run','low fast run, holding something small up in one hand',tail(cyc(lambda t: runf(t,lh=('r',18,8),le=('e',8,11))),True))

# ── 5.3 지형·이동 ──
def front(p):
    q=dict(p); N=q['NECK']; hip=((q['RIGHT HIP'][0]+q['LEFT HIP'][0])/2,(q['RIGHT HIP'][1]+q['LEFT HIP'][1])/2)
    q['RIGHT SHOULDER']=(N[0]-8,N[1]+3); q['LEFT SHOULDER']=(N[0]+8,N[1]+3)
    q['RIGHT HIP']=(hip[0]-4,hip[1]); q['LEFT HIP']=(hip[0]+4,hip[1])
    q['RIGHT ELBOW']=(N[0]-5,N[1]+14); q['LEFT ELBOW']=(N[0]+5,N[1]+14)
    q['RIGHT ARM']=(N[0]-2,N[1]+21); q['LEFT ARM']=(N[0]+2,N[1]+22)
    q['RIGHT KNEE']=(hip[0]-4,hip[1]+19); q['LEFT KNEE']=(hip[0]+4,hip[1]+19)
    q['RIGHT LEG']=(hip[0]-4,G); q['LEFT LEG']=(hip[0]+4,G)
    no=(N[0],N[1]-8); q['NOSE']=no
    q['RIGHT EYE']=(no[0]-3,no[1]-3); q['LEFT EYE']=(no[0]+3,no[1]-3); q['RIGHT EAR']=(no[0]-6,no[1]-1); q['LEFT EAR']=(no[0]+6,no[1]-1)
    return q
FR=front(STAND(0)); HTURN=dict(STAND(0)); HTURN.update({k:FR[k] for k in ('NOSE','RIGHT EYE','LEFT EYE','RIGHT EAR','LEFT EAR')})
clip('turn','turns to face the viewer: the head turns first, the body follows, hands folded',tail([STAND(0),HTURN,FR],False))
FA=lambda b=0: P((X,58+b),2,0,0,(X+6,G-12),(X-2,G-10),('r',12,14+b),('r',10,15),le=('e',6,10),re=('e',4,11))
clip('fall','falling with arms and legs held close and composed, only the hair and skirt lift',tail([FA(0),FA(1),FA(2)],True))
LD=P((X,86),14,0,0,(X+12,G),(X-8,G),('r',14,14),('r',12,15),le=('e',6,11),re=('e',4,12))
clip('land','soundless landing: absorbs the drop deep in the knees on her toes, no hands, rises smoothly',tail([FA(0),LD,lerp(LD,S0,.5)],False))
def lad(t):
    c=math.cos(2*math.pi*t)
    return P((X+2,64),2,0,0,(X+13,92-7*c),(X+11,92+7*c-7),('a',X+16,22+7*c),('a',X+16,29-7*c),lk=KNEE_UP,rk=KNEE_UP,le=('e',10,4),re=('e',9,6))
clip('ladder','side view: quick climbing motion, body close, hands and feet alternating, ladder not drawn',tail(cyc(lad),True))
MA=P((X,64),16,0,0,(X+6,G),(X-5,G),('a',X+16,64),('a',X+14,64),le=('e',10,10),re=('e',8,11))
MJ=P((X+8,46),20,0,0,(X+4,74),(X-2,76),('a',X+18,64),('a',X+16,64),lk=KNEE_UP,rk=KNEE_UP)
MC=P((X+16,40),20,0,0,(X+24,64),(X+16,64),('r',12,14),('r',10,15),lk=KNEE_FWD,rk=KNEE_FWD,le=('e',5,11),re=('e',3,11))
MS=P((X+18,25),2,0,0,(X+22,64),(X+15,64),'fold','fold')
clip('mantle','light climb onto a waist-high ledge: hands plant, one springy hop to a crouch on top, she rises',tail([STAND(0),MA,MJ,MC,MS],False))
VA=P((X+6,66),20,0,0,(X+14,G),(X-4,G-2),('a',X+22,66),('r',8,18),le=('e',12,10))
VB=P((X+22,48),14,0,0,(X+30,62),(X+26,63),('a',X+22,66),('r',10,16),lk=KNEE_UP,rk=KNEE_UP,le=('e',-2,14))
VC=P((X+38,70),8,0,0,(X+46,G),(X+40,G),('r',14,16),('r',12,17),le=('e',6,11),re=('e',4,12))
clip('vault','vaults a waist-high obstacle on one hand, legs held together swinging over, lands softly',tail([walkf(0),VA,VB,VC,sh(STAND(0),40)],False))
def crawlx(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X-6,82),70,0,0,(X-30+5*c,G),(X-30-5*c,G-1),('a',X+18+6*c,G-1-3*max(0,sn)),('a',X+12-6*c,G-1-3*max(0,-sn)),head=(6,-5),tilt=-30)
clip('crawl','crawling low and fast on hands and knees like a cat',tail(cyc(crawlx,7),True))
def sneak(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,72+0.3*abs(c)),16,0.05*c,0.1*c,(X+2+9*c,G-2*max(0,-sn)),(X+2-9*c,G-2*max(0,sn)),('r',20,18),('r',16,20),le=('e',10,12),re=('e',7,13),lk=KNEE_FWD,rk=KNEE_FWD)
clip('sneak','stalking low like a hunter: knees deep, fingertips dangling in front, soundless steps, head level',tail(cyc(sneak),True))
LT=dict(lh=('r',10,26),le=('e',4,14))
LIGHT='a small flashlight held low at her side pointing down at the floor'
clip('idle_light','standing still holding a small flashlight low at her side, pointed down',tail([STAND(b,**LT) for b in (0,.4,.7,.4)],True),LIGHT)
clip('walk_light','silent catlike walk holding a small flashlight low at her side, pointed down',tail(cyc(lambda t: walkf(t,**LT)),True),LIGHT)
clip('run_light','low fast run holding a small flashlight low in one hand',tail(cyc(lambda t: runf(t,lh=('r',6,24),le=('e',2,13))),True),LIGHT)
LB=lambda a: P((X,62),1,0,0,(X+4,G),(X-3,G),head=(6-12*a,-8),**FOLD)
clip('lookback','body stays still, only the head slowly turns back over her shoulder, then returns',tail([LB(0),LB(.4),LB(.8),LB(.8),LB(.8),LB(.4),LB(0)],False))
HDX=lambda b=0: P((X-4,88+b),18,0,0,(X+10,G),(X-12,G-1),('r',7,-3),('r',10,18),head=(6,-6),lk=KNEE_UP,le=('e',8,6),re=('e',3,13))
clip('hide','crouching in hiding, one finger raised to her smiling lips, peeking forward',tail([S0,lerp(S0,HDX(),.5),HDX(0),HDX(.5),HDX(0)],False))

# ── 5.4 탐사 ──
DO=lambda r: P((X+2*r,62),3+3*r,0,0,(X+4+4*r,G),(X-3,G),('a',X+20+6*r,58),'fold',le=('e',12+3*r,10))
clip('door','reaches out, slowly turns a handle with her fingertips and slips through sideways; door not drawn',tail([STAND(0),DO(0),DO(.3),DO(.6),DO(1),walkf(.25),walkf(.5)],False))
DC=lambda t,r: P((X+2,62),2,0,0,(X+2+9*math.cos(2*math.pi*t),G-3*max(0,-math.sin(2*math.pi*t))),(X+2-9*math.cos(2*math.pi*t),G-3*max(0,math.sin(2*math.pi*t))),('a',X-26+8*r,56),'fold',head=(5,-8),le=('e',-10,12))
clip('doorclose','walking forward, reaches straight back and silently eases something shut',tail([walkf(0),DC(.125,0),DC(.25,.5),DC(.375,1),walkf(.5),walkf(.625)],False))
KN=lambda r: P((X,62),2,0,0,(X+4,G),(X-3,G),('a',X+19+2*r,44),'fold',le=('e',12,4))
clip('knock','taps three times with one fingernail at head height, the other hand folded',tail([STAND(0),KN(0),KN(1),KN(0),KN(1),KN(0)],False))
def pushf(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X,64),22,0,0,(X+4+8*c,G-2*max(0,-sn)),(X+4-8*c,G-2*max(0,sn)),('a',X+26,60),'fold',le=('e',14,8))
clip('push','leans her weight into one flat palm pushing forward, small steps, other hand folded',tail(cyc(pushf,6),True))
IS=lambda r: P((X+1,86),12,0,0,(X+10,G),(X-2,G),('a',X+20+3*r,G-2),'fold',tilt=18,lk=KNEE_FWD,rk=KNEE_FWD,le=('e',10,14))
clip('inspect','lowers straight down with knees together and touches something on the floor with one fingertip',tail([STAND(0),lerp(STAND(0),IS(0),.5),IS(0),IS(1),IS(0),IS(1)],False))
def leadx(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+3,62+0.4*abs(c)),4,0,0,(X+3+9*c,G-3*max(0,-sn)),(X+3-9*c,G-3*max(0,sn)),('r',-26,20),'fold',head=(5,-8),le=('e',-12,12))
clip('leadhand','silent walk forward, near arm reaching straight back gripping someone by the wrist',tail(cyc(leadx),True))
BW=lambda t: STAND(0,tilt=t)
clip('bow','a small bow of only the head, eyes kept on the other person, hands folded',tail([BW(0),BW(8),BW(14),BW(8),BW(0)],False))
clip('elevwait','standing perfectly still with hands folded, staring straight ahead',tail([STAND(0),STAND(.3),STAND(.5),STAND(.3)],True))
FSD=lambda b=0: P((X-8,96),-2+b,0,0,(X+10,G),(X+6,G-1),('r',14,24),('r',12,24),lk=KNEE_UP,rk=KNEE_UP,le=('e',6,13),re=('e',4,13))
clip('floorsit','lowers herself to sit on the floor with knees together, hands resting on her knees',tail([STAND(0),lerp(STAND(0),DEEP(),.6),DEEP(),lerp(DEEP(),FSD(),.5),FSD()],False))
clip('floorrest','sitting on the floor, knees together, hands folded on them, only breathing',tail([FSD(0),FSD(.5),FSD(1),FSD(.5)],True))

# ── 5.5 상태·결과 ──
HU=lambda b: P((X,63+b),4,0,0,(X+5,G),(X-3,G),('r',8,20),('r',7,21),tilt=4,le=('e',3,13),re=('e',1,13))
clip('hurtidle','injured but standing upright, hands folded, breathing a little faster, smile frozen',tail([HU(0),HU(1),HU(1.5),HU(1)],True))
def limpx(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t); dip=3*max(0,-c)
    return P((X+2,63+dip),6,0,0,(X+2+9*c,G-4*max(0,-sn)),(X+2-6*c,G),('r',8,20),('r',7,21),tilt=4,le=('e',3,13),re=('e',1,13),rk=KNEE_UP)
clip('limp','limping, dragging the rear leg, hands still folded, trying to keep her head level',tail(cyc(limpx,7),True))
FE=lambda d: P((X,62),1,0,0,(X+4,G),(X-3,G),('r',11+d*.5,10),('r',10-d*.5,11),le=('e',4,12),re=('e',2,12))
clip('fear','frozen in place, hands together at her chest with fingers fidgeting, eyes wide, staring',tail([FE(0),FE(1),FE(-1),FE(1)],True))
NS=lambda a: P((X,62),2,0,0,(X+4,G),(X-3,G),('r',8,-3),'fold',head=(6-6*a,-8),tilt=6*a,le=('e',10,5))
clip('nausea','presses the back of her hand to her mouth and turns her head aside, body stays upright',tail([STAND(0),NS(0),NS(1),NS(1),NS(0)],False))
CL1=P((X,84),6,0,0,(X+10,G),(X-6,G),('r',10,18),('r',8,19),le=('e',4,12),re=('e',2,12))
CLD=P((X-14,96),-80,0,0,(X+16,G-4),(X+12,G-2),('r',8,16),('r',6,18),head=(5,-6),tilt=30,lk=KNEE_UP,rk=KNEE_UP)
clip('collapse','defeated: knees give way, she drops straight down, then tips over onto her side and lies still',tail([S0,lerp(S0,CL1,.6),CL1,DEEP(),lerp(DEEP(),CLD,.5),CLD,CLD,CLD],False))
BL=lambda b=0: P((X-6,94),-90,0,0,(X+34,G-4),(X+33,G-3),('r',7,20+b),('r',6,21),le=('e',2,12),re=('e',1,12))
clip('bedlie','lying flat on her back with hands folded on her stomach, asleep, slow breathing, nothing under her',tail([BL(0),BL(1),BL(1),BL(0)],True))
VI1=P((X,64),3,0,0,(X+5,G),(X-3,G),('r',16,6),'fold',le=('e',9,9))
VI2=P((X,64),3,0,0,(X+5,G),(X-3,G),('r',16,12),'fold',le=('e',9,10))
clip('victory','flicks her wrist once as if shaking off a needle, folds her hands, tilts her head with a smile',tail([S0,lerp(S0,STAND(0),.5),VI1,VI2,VI1,STAND(0),STAND(0,tilt=-6)],False))

# ── 5.6 본부 업무 ──
clip('chairsit','sits down without a sound and crosses her legs, hands in her lap, nothing under her',tail([STAND(0),lerp(STAND(0),SITC(12),.5),SITC(12),SITC(),SITC()],False))
TY=lambda r: SITC(10,12,lh=('r',20,12-2*r),rh=('r',17,12-2*(1-r)),le=('e',8,14),re=('e',6,15))
clip('typing','seated with crossed legs, fast precise fingertip typing at desk height, body still',tail([TY(0),TY(1),TY(0),TY(1)],True))
GC=lambda r: P((X,62),3,0,0,(X+4,G),(X-3,G),('r',15,6),('r',13+r,4-r),tilt=14,le=('e',8,10),re=('e',7,9))
clip('gearcheck','holds one hand up and touches each fingertip with the other, counting them carefully',tail([STAND(0),GC(0),GC(1),GC(2),GC(3),STAND(0)],False))
TI=lambda r: P((X,62),1,0,0,(X+4,G),(X-3,G),('r',5,4+4*r),'fold',tilt=6,le=('e',9,10))
clip('tie','smooths her necktie down from the collar with one hand, the other stays folded',tail([STAND(0),TI(0),TI(.4),TI(.8),TI(1),TI(.5),TI(0),STAND(0)],False))

# ── 5.7 생활·여가 ──
clip('seatrest','seated with legs crossed, hands folded in her lap, staring calmly ahead',tail([SITC(-2),SITC(-2,b=.4),SITC(-2,b=.7),SITC(-2,b=.4)],True))
TKS=dict(lh=('r',8,0),le=('e',9,10))
clip('seatthink','seated with legs crossed, chin resting on the back of her hand, head tilted, eyes open',tail([SITC(6,-4,**TKS),SITC(6,-4,b=.4,**TKS),SITC(6,-4,b=.7,**TKS),SITC(6,-4,b=.4,**TKS)],True))
clip('doze','seated with legs crossed, her head slowly tilts down and stays there, asleep',tail([SITC(0,0),SITC(0,10),SITC(0,18),SITC(0,20)],False))
YA=lambda a: P((X,62),1,0,0,(X+4,G),(X-3,G),('r',8,-3) if a else 'fold','fold',tilt=-4*a,le=('e',10,5) if a else None)
clip('yawn','a small yawn hidden behind the back of her hand, eyes stay open',tail([STAND(0),YA(1),YA(1),STAND(0)],False))
STR=lambda u: P((X-4*u,62+4*u),2+28*u,0,0,(X+4,G),(X-3,G),('r',16+16*u,14-14*u),('r',14+16*u,15-14*u),le=('e',8+6*u,12-8*u),re=('e',6+6*u,13-8*u))
clip('stretch','catlike stretch: fingers laced, arms pushed straight forward, hips back, then relaxes',tail([STAND(0),STR(.4),STR(.8),STR(1),STR(1),STR(.6),STR(.2),STAND(0)],False))
HF=lambda a: P((X,62),1,0,0,(X+4,G),(X-3,G),('r',4-6*a,-10),'fold',tilt=2,le=('e',9,0))
clip('hairflip','tucks her bangs behind her ear with fingertips, then they fall back over her eye',tail([STAND(0),HF(0),HF(.5),HF(1),HF(.5),STAND(0)],False))

# ── 5.8 씻기 (나머지 4개는 GPT) ──
BRU=lambda d: P((X,62),3,0,0,(X+4,G),(X-3,G),('r',8+d,-2),('r',10,12),tilt=2,le=('e',10,6),re=('e',4,12))
clip('brushteeth','small precise tooth brushing motion, staring straight ahead, other hand holds a cup low',tail([BRU(0),BRU(1.5),BRU(0),BRU(1.5)],True))

# ── 5.9 사교 ──
GE=lambda d: P((X,62),2,0,0,(X+4,G),(X-3,G),('r',16+d,4-d),'fold',le=('e',9,8))
clip('gesture','talking while drawing small shapes in the air with one index finger, other hand folded',tail([GE(0),GE(2),GE(1),GE(-1)],True))
clip('armscross','listening with hands folded in front and head tilted to one side',tail([STAND(0,tilt=-4),STAND(.4,tilt=-5),STAND(.7,tilt=-6),STAND(.4,tilt=-5)],True))
clip('nod','one slow nod, eyes never leaving the other person',tail([STAND(0),STAND(0,tilt=5),STAND(0,tilt=10),STAND(0,tilt=5),STAND(0)],False))
WG=lambda d: P((X,62),1,0,0,(X+4,G),(X-3,G),('r',14,-2+d),'fold',le=('e',10,6))
clip('headshake','instead of shaking her head she wags one raised index finger side to side',tail([STAND(0),WG(0),WG(1),WG(-1),WG(1),WG(0)],False))
WV=lambda d: P((X,62),1,0,0,(X+4,G),(X-3,G),('r',12,-4+d),'fold',le=('e',10,6))
clip('wave','raises a hand to shoulder height and waves only her fingers, folding and unfolding them',tail([STAND(0),WV(0),WV(1),WV(0),WV(1),WV(0),WV(1),STAND(0)],False))
HS=lambda d: P((X+5,62),5,0,0,(X+10,G),(X+1,G),('r',22,16+d),'fold',le=('e',10,12))
clip('handshake','steps in half a step too close, shakes a hand and holds on, then steps back',tail([STAND(0),HS(0),HS(1),HS(0),HS(1),STAND(0)],False))
PT=lambda d: P((X+5,62),10,0,0,(X+10,G),(X+1,G),('r',20,-2+d),'fold',head=(7,-7),le=('e',11,6))
clip('pat','leans in close and taps a shoulder lightly with her fingertips, mouth near an ear',tail([STAND(0),PT(0),PT(1),PT(0),PT(1),STAND(0)],False))
PO=P((X+1,62),3,-0.2,0,(X+5,G),(X-3,G),('r',34,-4),'fold',le=('e',16,2))
clip('point','points ahead with one long fingertip, other hand folded',tail([STAND(0),lerp(STAND(0),PO,.5),PO,PO],False))
SR=lambda a: P((X,62-a),1,0,0,(X+4,G),(X-3,G),('r',14,12-2*a),('r',12,13-2*a),tilt=-8*a,le=('e',6,12),re=('e',4,12))
clip('shrug','a tiny shrug with palms up, the head tilts far to one side',tail([STAND(0),SR(.5),SR(1),SR(1),SR(.5),STAND(0)],False))
HG=lambda a: P((X+5,62),4,0,0,(X+10,G),(X+1,G),('r',18+3*a,6),('r',16+3*a,8),tilt=4,le=('e',12,4),re=('e',10,6))
clip('hug','steps in close and wraps her arms around someone, fingers fidgeting behind their back',tail([STAND(0),HG(1),HG(0),HG(.3),HG(0)],False))

# ── 5.10 감정 ──
LG=lambda b: P((X,62+b),3,0,0,(X+4,G),(X-3,G),('r',8,-3),'fold',tilt=4,le=('e',10,5))
clip('laugh','quiet laugh behind the back of her hand, only the shoulders shake three times, eyes unchanged',tail([STAND(0),LG(0),LG(1),LG(0),LG(1),LG(0)],False))
GL=lambda d: P((X,62),1,0,0,(X+4,G),(X-3,G),('r',12+d,8),('r',11,9),le=('e',4,12),re=('e',3,12))
clip('glad','presses her palms together at her chest and taps her fingertips together',tail([STAND(0),GL(0),GL(1),GL(0)],False))
CY=lambda d: P((X,62),2,0,0,(X+4,G),(X-3,G),('r',10+d*.5,14),('r',9-d*.5,15),tilt=10,le=('e',3,12),re=('e',2,12))
clip('cry','standing still, head slightly lowered, fingers fidgeting together in front of her chest',tail([STAND(0),CY(0),CY(1),CY(-1),CY(1)],True))
WCX=lambda b: P((X+4,62+b),12,0,0,(X+6,G),(X-3,G),'down','down',head=(7,-7),tilt=14)
clip('wallcry','stands leaning forward with her forehead resting against something, arms limp, shoulders shaking',tail([WCX(0),WCX(1),WCX(0),WCX(1)],True))
KC=lambda b: P((X-2,90+b),4,0,0,(X-24,G),(X-26,G),('r',14,22),('r',12,22),tilt=22,lk=KNEE_FWD,rk=KNEE_FWD,le=('e',5,13),re=('e',3,13))
clip('kneelcry','kneeling sitting back on her heels, hands folded on her knees, head bowed, face not hidden',tail([KC(0),KC(1),KC(0),KC(1)],True))
clip('sad','standing with head bowed, hands folded, the half smile frozen on her face',tail([STAND(.5,tilt=16),STAND(1,tilt=20),STAND(1.2,tilt=20),STAND(1,tilt=18)],True))
SHT=lambda a: P((X+4*a,62),14*a,0,0,(X+4+6*a,G),(X-3+2*a,G),'fold','fold',head=(6+2*a,-8),tilt=-6*a)
clip('shout','instead of shouting she leans in very close and speaks low, hands folded',tail([STAND(0),SHT(.6),SHT(1),SHT(1),STAND(0)],False))
DS1=lambda a: P((X+2,62+2*a),8+8*a,0,0,(X+6,G),(X-3,G),('a',X+22,48+18*a),'fold',tilt=6,le=('e',12,6+6*a))
clip('deskslam','plants all five fingertips down hard on a surface in front of her, smile unchanged',tail([STAND(0),DS1(0),DS1(1),DS1(1),lerp(DS1(1),STAND(0),.5)],False))
clip('surprise','does not flinch: her head tilts sharply to one side and her eye widens',tail([STAND(0),STAND(0,tilt=-12),STAND(0,tilt=-12),STAND(0,tilt=-6)],False))
SF=P((X-10,90),10,0,0,(X+2,G),(X-18,G),('a',X+6,G-1),('r',10,16),tilt=-6,le=('e',10,10),re=('e',4,12))
clip('startlefall','startled, slides back a step and drops into a low crouch with one hand on the floor',tail([STAND(0),sh(STAND(0),-6),lerp(STAND(0),SF,.6),SF,SF],False))
PD=P((X-8,96),-4,0,0,(X+16,G),(X+12,G),('r',14,22),('r',12,22),tilt=10,lk=KNEE_UP,rk=KNEE_UP,le=('e',6,13),re=('e',4,13))
clip('plopdown','sinks straight down slowly until she is sitting on the floor, legs out, head lowered',tail([STAND(0),lerp(STAND(0),DEEP(),.5),DEEP(),lerp(DEEP(),PD,.5),PD],False))
EMB=lambda d,a: P((X,62),1,0,0,(X+4,G),(X-3,G),('r',10+d*.5,12),('r',9-d*.5,13),head=(6-6*a,-8),le=('e',3,12),re=('e',2,12))
clip('embarrassed','fingers fidget together in front of her chest while her head turns away to avoid eyes',tail([STAND(0),EMB(0,.3),EMB(1,.6),EMB(-1,.6),EMB(1,.6),EMB(0,.3)],False))
AY=lambda d: P((X,62),1,0,0,(X+4,G),(X-3,G),('r',4,-11+d),'fold',tilt=-2,le=('e',10,-1))
clip('annoyed','taps her temple with one fingertip a few times, smile kept',tail([STAND(0),AY(0),AY(1),AY(0),AY(1),AY(0),STAND(0)],False))
TK=lambda b: P((X,62+b),1,0,0,(X+4,G),(X-3,G),('r',8,-4),'fold',tilt=-4,le=('e',10,4))
clip('think','one index finger resting on her lips, head tilted, the other hand folded',tail([TK(0),TK(.4),TK(.7),TK(.4)],True))
clip('bored','bored: idly strokes her fingertips with her thumb as if filing nails, eyes half on them',tail([GR(0),GR(1),GR(0),GR(1)],True))

# ── 5.11 스팡달 전용 ──
WH=lambda a: P((X+6*a,62),18*a,0,0,(X+4+8*a,G),(X-3+4*a,G),'fold','fold',head=(6+2*a,-8+2*a),tilt=-8*a)
clip('whisper','steps half a step in and leans her upper body close, mouth near an ear, then draws back',tail([STAND(0),WH(.5),WH(1),WH(1),WH(.5),STAND(0)],False))
FG=lambda d,a: P((X,62),2,0,0,(X+4,G),(X-3,G),('r',11+d*.5,14),('r',10-d*.5,15),head=(6-3*a,-8),tilt=6,le=('e',3,12),re=('e',2,12))
clip('fidget','hands together in front, fingers fidgeting nervously, eyes sliding away',tail([FG(0,0),FG(1,.5),FG(-1,1),FG(1,1),FG(-1,.5),FG(0,0)],True))

A_KP={'NOSE':(82,38),'NECK':(72,48),'RIGHT SHOULDER':(74,50),'RIGHT ELBOW':(82,60),'RIGHT ARM':(84,69),
      'LEFT SHOULDER':(67,50),'LEFT ELBOW':(61,60),'LEFT ARM':(71,68),'RIGHT HIP':(73,73),'RIGHT KNEE':(90,86),'RIGHT LEG':(89,102),
      'LEFT HIP':(67,73),'LEFT KNEE':(58,90),'LEFT LEG':(50,102),'RIGHT EYE':(79,35),'LEFT EYE':(81,35),'RIGHT EAR':(72,36),'LEFT EAR':(74,35)}
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
    d=ImageDraw.Draw(im); d.line([(0,136*s),(W*s,136*s)],fill=(120,130,140,255))
    q={k:((v[0]+DX)*s,(v[1]+DY)*s) for k,v in p.items()}
    for a,b in BONES:
        c=(255,90,90,255) if 'RIGHT' in a+b else (90,170,255,255) if 'LEFT' in a+b else (240,240,240,255)
        d.line([q[a],q[b]],fill=c,width=s)
    d.ellipse([q['NOSE'][0]-3,q['NOSE'][1]-3,q['NOSE'][0]+3,q['NOSE'][1]+3],fill=(255,230,80,255))
    return im
if __name__=='__main__':
    base=Image.open('../base/S0-pad.png').convert('RGBA')
    names=sys.argv[1:] or list(CLIPS)
    s=2; rows=[]
    for n in names:
        _,_,ps=CLIPS[n]
        row=Image.new('RGBA',(W*s*16,H*s),(30,34,40,255)); row.alpha_composite(draw(A_KP,base,s),(0,0))
        for i,p in enumerate(ps): row.alpha_composite(draw(p,None,s),((i+1)*W*s,0))
        ImageDraw.Draw(row).text((4,4),n,fill=(255,255,0,255)); rows.append(row)
    import os; os.makedirs('../plan',exist_ok=True)
    for i in range(0,len(rows),6):
        sheet=Image.new('RGBA',(W*s*16,H*s*len(rows[i:i+6])))
        for j,r in enumerate(rows[i:i+6]): sheet.alpha_composite(r,(0,j*H*s))
        sheet.resize((sheet.width//2,sheet.height//2)).save(f'../plan/plan-{i//6:02d}.png')
    for n,(a,_,ps) in CLIPS.items():
        for p in ps:
            for k,v in p.items():
                x,y=(v[0]+DX)/W,(v[1]+DY)/H
                if not(0.02<x<0.98 and 0.02<y<0.98): print('OUT',n,k,round(x,2),round(y,2))
    print(len(CLIPS),'clips',sum(len(v[2]) for v in CLIPS.values()),'frames')
