# 에일린 전 동작 뼈대 (animate_with_skeleton_v3용). 설계: docs/캐릭터제작서/동작설계_eileen.md
# 쟈알디 rig.py의 뼈 길이·좌표계·P()·anatomic()을 그대로 씀(같은 캔버스 192×144, 발목 바닥선 G=100 → 최종 발바닥 y=136).
# 오른쪽(동쪽)을 봄. RIGHT = 그림상 가까운 쪽. 에일린은 오른손잡이 → 가까운 손(RIGHT, P의 lh) = 방아쇠 손, 먼 손(LEFT, rh) = 총열 덮개를 받치는 손.
# 쟈알디 동작을 복사하지 않는다: 같은 이름의 장면이라도 자세·리듬을 에일린 성격(짧고 정확, 읽는 사람, 총 손질, 쉬지 않음)으로 새로 짬.
import sys,os,math
J_=os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../jyaldi-v5/scripts')
sys.path.insert(0,J_)
import rig
from rig import P,lerp,staged,sh,jit,anatomic,X,G,KNEE_FWD,KNEE_UP,ELB_DOWN,ELB_UP,ELB_OUT,kp,W,H,DX,DY,draw
SIDE=-0.25
R=lambda x,y:('r',x,y)      # 목 기준 손 목표(몸통 기울기 따라 돎)
E=lambda x,y:('e',x,y)      # 목 기준 팔꿈치 직접 지정
A=lambda x,y:('a',x,y)      # 절대 좌표
LONG=[]
CLIPS={}   # 이름: (동작 설명, 소품·무기 설명, 기준 그림 'H'|'F'|'R', [자세...])
# 에일린은 쟈알디보다 작다("체격은 작고 단단하다" [위키]): 쟈알디 뼈대 공간에서 자세를 짠 뒤 발 기준점(X,G)을 중심으로 0.92배(키 약 86px).
# 보폭·손 위치까지 같이 줄어 몸 비율이 유지됨. 기준 그림도 이 크기로 뽑은 옆모습 장을 씀(base_side.py).
SCALE=0.92
def small(p,k=SCALE): return {n:(X+(v[0]-X)*k,G+(v[1]-G)*k) for n,v in p.items()}
def clip(name,action,poses,base,prop=''):
    assert 3<=len(poses)<=15,(name,len(poses))
    action=action.replace('side view: ','').replace('side view, ','')   # 옆모습은 설명(DESC)에 따로 넣음
    if len(action)>100: LONG.append((name,len(action)))
    if isinstance(poses,TL): TAIL.add(name)
    CLIPS[name]=(action,prop,base,[small(anatomic(p)) for p in poses])
class TL(list): pass
TAIL=set()   # 끝에 버릴 장을 붙인 클립(빌더가 마지막 장을 뺌)
def tail(ps,loop): return TL(ps+[ps[0] if loop else ps[-1]])   # 생성기가 끝 장을 기준 그림으로 되돌리는 버릇 → 버릴 장(빌더 auto_trim)
cyc=lambda t:(math.cos(2*math.pi*t),math.sin(2*math.pi*t))

# ── 무기 설명(그림에 그림. 총구 불꽃·탄피·빛은 코드) ──
RIF='a compact black carbine rifle held in both hands'
RIF_LOW=RIF+', stock at the shoulder pocket, muzzle angled down at the floor ahead'
RIF_AIM=RIF+', stock tight in the shoulder, cheek on the stock, muzzle level forward'
RIF_PORT=RIF+', held diagonally across the chest, muzzle up and forward'
RIF_BACK='a compact black carbine slung diagonally across her back'
RIF_SLUNG='a compact black carbine hanging on its sling at her front'
PISTOL='a black pistol gripped in both hands'

# ── 기본 자세 ──
# 본부 대기: 쟈알디(반듯·정지)와 달리 무게중심 낮게(무릎 살짝), 발 간격 조금 넓게, 손은 반쯤 쥠
STAND=lambda b=0,lh=R(3,34),rh=R(1,34),tilt=0,head=(5,-7),**k: P((X,57+b),3,0,0,(X+7,G),(X-5,G),lh,rh,head=head,tilt=tilt,**k)
# 로우 레디: 몸 정면에 가깝게(조끼 판이 적 쪽) = 옆모습에선 두 발이 거의 나란히, 무릎 굽힘. 방아쇠 손은 가슴 아래, 받침손은 앞 아래
LR=dict(lh=R(9,15),rh=R(22,21),le=E(1,15),re=E(10,17))
LOW=lambda d=0,b=0,head=(5,-7),tilt=4: P((X+d,59+b),5,SIDE,-0.1,(X+8+d,G),(X-8+d,G-1),head=head,tilt=tilt,**LR)
# 견착 조준: 방아쇠 손 어깨 앞, 받침손 앞으로 뻗음, 뺨을 개머리에(고개 약간 숙임)
AM=dict(lh=R(9,8),rh=R(25,9),le=E(2,16),re=E(13,14))
AIM=lambda d=0,b=0,lean=8,tilt=8: P((X+d,59+b),lean,SIDE,-0.1,(X+9+d,G),(X-9+d,G-1),head=(6,-6),tilt=tilt,**AM)
# 무릎 쏴: 뒷무릎 바닥, 앞발 세움, 앞팔꿈치는 앞무릎 위
KN_=lambda d=0,b=0,lean=8,arms=AM,tilt=8: P((X+d,80+b),lean,SIDE,-0.1,(X+16+d,G),(X-17+d,G-1),head=(6,-6),tilt=tilt,**arms)
# 포트(달리기): 총을 가슴 앞 사선으로 당겨 안음
PT=dict(lh=R(8,14),rh=R(15,3),le=E(1,15),re=E(7,13))
# 권총 두 손 아이소셀리스: 두 팔을 앞으로 곧게, 몸 정면에 가깝게
PIS=dict(lh=R(27,6),rh=R(26,7),le=E(13,8),re=E(12,9))
L0=LOW()

# ════════ 5-1 전투 (R: 든 총 / F: 멘 총 / H: 본부) ════════
SC=lambda a: STAND(0,head=(5+1.5*a,-7))     # 머리만 좌우로 훑음(출구·표지 확인)
clip('idle','side view: standing still, knees soft, eyes scanning left and right, otherwise motionless',
     tail([SC(0),SC(1),SC(0),SC(-1)],True),'H')
PC=lambda a: P((X,59),6,SIDE,-0.1,(X+8,G),(X-8,G-1),R(12,9-2*a),R(20,12),le=E(3,15),re=E(10,15),tilt=14)
clip('presscheck','side view: tilts the rifle, pulls the charging handle back a little to check, lets it go, back to low ready',
     tail([L0,PC(0),PC(1),PC(1),PC(0),L0],False),'R',RIF_LOW)
clip('guard','side view: low ready stance, rifle held low in both hands, knees bent, very still, eyes up',
     tail([LOW(0,0),LOW(0,.5),LOW(0,1),LOW(0,.5)],True),'R',RIF_LOW)
EG1=STAND(0,lh=R(4,6),le=E(4,14)); EG2=P((X,58),4,SIDE,-0.1,(X+8,G),(X-7,G),R(10,10),R(14,12),le=E(2,15),re=E(6,15))
clip('engage','side view: pulls the slung rifle around from her back to the front and grips it, settles into low ready',
     tail([STAND(0),EG1,lerp(EG1,EG2,.5),EG2,lerp(EG2,L0,.5),L0],False),'R','a compact black carbine on a sling, swung from her back to her hands')
# 본부 걷기: 짧고 빠른 보폭, 팔 흔들림 작음(쟈알디: 넓은 보폭·침착)
def walkE(t,**k):
    c,s=cyc(t)
    k.setdefault('lh',R(2-5*c,34)); k.setdefault('rh',R(0+5*c,34))
    return P((X+2,57+1.0*abs(c)),5,0,0,(X+2+8*c,G-3*max(0,-s)),(X+2-8*c,G-3*max(0,s)),**k)
clip('walk','side view: brisk efficient walk, short quick steps, arms barely swing, ponytail bouncing',[walkE(i/8) for i in range(8)],'H')
# 전술 보행: 무릎 굽혀 낮게, 발뒤꿈치→발끝으로 굴림, 머리 높이 거의 고정, 총·상체 고정(포탑)
def tac(t,arms=LR,lean=6,hip=60):
    c,s=cyc(t)
    lf=(X+2+9*c,G-2*max(0,-s)); rf=(X+2-9*c,G-2*max(0,s))
    return P((X+2,hip+0.4*abs(c)),lean,SIDE,-0.1,lf,rf,tilt=4,**arms)
clip('step','side view: tactical rolling walk, knees bent low, heel to toe, upper body and rifle perfectly level',[tac(i/8) for i in range(8)],'R',RIF_LOW)
# 달리기: 총을 가슴 앞 사선으로 안고 짧고 빠른 보폭(쟈알디: 긴 보폭 질주, 팔 크게)
def runE(t,arms=PT):
    c,s=cyc(t); fl=abs(s)
    lf=(X+6+17*c-6*max(0,-s),G-12*max(0,-s)-3*fl); rf=(X+6-17*c-6*max(0,s),G-12*max(0,s)-3*fl)
    return P((X+8,59-3*fl),14,SIDE,-0.1,lf,rf,head=(6,-6),**arms)
clip('run','side view: running fast with quick short strides, rifle hugged diagonally across the chest, ponytail streaming',[runE(i/8) for i in range(8)],'R',RIF_PORT)
JA=lambda tuck,b=0: P((X,58+b),8,SIDE,-0.1,(X+9,G-2-tuck),(X-7,G-4-tuck*1.1),head=(6,-6),**PT)
clip('jump','side view: small practical jump, rifle hugged to the chest, knees tuck, deep knee bend on landing',
     [LOW(0,6),JA(0,-3),JA(8),JA(12),JA(7),JA(2,-1),LOW(0,8),L0],'R',RIF_PORT)
clip('crouch','side view: drops from standing into a kneeling firing position, rear knee on the floor, rifle shouldered',
     [L0,lerp(L0,KN_(),.45),lerp(L0,KN_(),.8),KN_()],'R',RIF_AIM)
def cw(t):
    c,s=cyc(t)
    return P((X+2,72+abs(s)),10,SIDE,-0.1,(X+8+7*c,G-3*max(0,-s)),(X-4-7*c,G-3*max(0,s)),tilt=4,lk=KNEE_FWD,rk=KNEE_FWD,**LR)
clip('crouchwalk','side view: deep crouch walk, short steps, rifle at low ready, head level',[cw(i/8) for i in range(8)],'R',RIF_LOW)
KR=lambda r: jit(KN_(),-2*r,-2*r,['RIGHT ARM','LEFT ARM','RIGHT ELBOW'])
clip('kneelfire','side view: kneeling, rifle shouldered, fires two quick shots, recoil only in the shoulder',[KN_(),KR(1),KN_(),KR(1),KN_()],'R',RIF_AIM)
REC=lambda p,r=1: jit(jit(p,-2*r,-2*r,['RIGHT ARM','LEFT ARM']),-1*r,-1*r,['RIGHT ELBOW','LEFT ELBOW','NOSE','RIGHT EYE','LEFT EYE','RIGHT EAR','LEFT EAR'])
A0=AIM()
clip('pair1','side view: raises the rifle from low ready into the shoulder and fires two quick shots',
     [L0,staged(L0,A0,.5),A0,REC(A0),A0,REC(A0)],'R',RIF_AIM)
A1=AIM(2,0,11)
clip('pair2','side view: already aiming, leans in slightly and fires two fast shots',[A0,A1,REC(A1),A1,REC(A1)],'R',RIF_AIM)
A3=AIM(0,0.5,9,12); A3R=REC(sh(AIM(-4,0.5,2,6),0),2.2)
clip('aimshot','side view: steadies her aim for a beat, fires one heavy shot, recoil pushes her back half a step, re-aims',
     [A1,A3,A3,A3R,lerp(A3R,A0,.5),A0],'R',RIF_AIM)
# 떼어내기 3단 — 총검술(FM 3-25.150)·해병 근접전 교범의 총구 찌르기·개머리판·밀어차기
MZ0=P((X-2,60),4,SIDE,-0.1,(X+8,G),(X-10,G-1),R(6,12),R(18,14),le=E(0,15),re=E(8,15))
MZ1=P((X+8,60),14,SIDE,-0.1,(X+20,G),(X-6,G-2),R(18,9),R(32,8),le=E(6,14),re=E(18,11))
clip('muzzle','side view: drives the rifle forward with both hands in a short muzzle thrust at chest height, rear foot pushing',
     [L0,MZ0,staged(MZ0,MZ1,.6),MZ1,lerp(MZ1,L0,.5)],'R',RIF)
BS0=P((X,60),2,0.3,0.2,(X+9,G),(X-9,G-1),R(-4,18),R(14,6),le=E(-4,13),re=E(8,10))
BS1=P((X+6,60),10,-0.9,-0.5,(X+14,G),(X-8,G-2),R(22,-2),R(10,10),le=E(14,6),re=E(6,12))
clip('buttstroke','side view: hips turn first, then the rear hand swings the rifle stock forward and up: a horizontal butt stroke',
     [L0,BS0,staged(BS0,BS1,.5),BS1,BS1,lerp(BS1,L0,.5)],'R',RIF)
PK0=P((X-2,58),-4,SIDE,-0.1,(X+12,G-36),(X-8,G),R(8,10),R(14,4),le=E(1,15),re=E(7,12),lk=KNEE_UP)
PK1=P((X-4,58),-12,SIDE,-0.1,(X+36,G-34),(X-8,G),R(8,10),R(14,4),le=E(1,15),re=E(7,12))
clip('pushkick','side view: rifle pulled to the chest, lifts the knee and pushes the heel straight forward, then steps back',
     [L0,PK0,PK1,PK1,lerp(PK1,LOW(-10),.5),LOW(-12),LOW(-12)],'R',RIF_PORT)
SL0=runE(.25); SL1=P((X+4,80),-20,SIDE,-0.1,(X+40,G-2),(X-6,G-10),head=(6,-6),rk=KNEE_UP,**PT)
SL2=P((X+18,86),-28,SIDE,-0.1,(X+54,G),(X+4,G-2),head=(6,-6),rk=KNEE_UP,**PT)
clip('slide','side view: running, drops into a feet-first slide along the floor, rifle on the chest, ends kneeling and aiming',
     [SL0,SL1,SL2,SL2,lerp(SL2,KN_(22),.5),KN_(22),KN_(22)],'R',RIF_PORT)
AS=lambda e: P((X,56),10+14*e,SIDE,-0.1,(X+6,G-16),(X-6,G-20),head=(6,-4),tilt=12+14*e,lh=R(9,9+2*e),rh=R(22,18+6*e),le=E(2,16),re=E(12,17))
clip('airshot','side view: mid-air, knees tucked, points the rifle down at 45 degrees ahead and fires one shot',[JA(10),AS(.6),AS(1),REC(AS(1)),JA(8)],'R',RIF)
TR1=P((X,59),4,SIDE,-0.1,(X+8,G),(X-8,G-1),A(X+4,62),R(12,22),le=E(-1,15),re=E(6,17))
TR2=P((X,59),4,SIDE,-0.1,(X+8,G),(X-8,G-1),R(12,14),R(14,14),le=E(2,15),re=E(6,15))
PI0=P((X,59),6,SIDE,-0.1,(X+8,G),(X-8,G-1),head=(6,-6),**PIS)
clip('transition','side view: lets the rifle drop on its sling, draws the pistol from the hip and aims it with both hands',
     [L0,lerp(L0,TR1,.6),TR1,TR2,lerp(TR2,PI0,.5),PI0],'R','a compact black carbine dropping onto its sling, then a black pistol in both hands')
PR=jit(PI0,-2,-4,['RIGHT ARM','LEFT ARM'])
clip('pistolfire','side view: two-handed pistol aim, fires, wrists flip up a little, back on target',[PI0,PR,lerp(PR,PI0,.5),PI0],'R',PISTOL+', '+RIF_SLUNG)
PL1=P((X,59),6,SIDE,-0.1,(X+8,G),(X-8,G-1),R(16,12),A(X+2,64),le=E(4,15),re=E(-2,16),tilt=12)
PL2=P((X,59),6,SIDE,-0.1,(X+8,G),(X-8,G-1),R(16,12),R(16,16),le=E(4,15),re=E(6,16),tilt=12)
clip('pistolreload','side view: pulls the pistol in close, drops the magazine, fetches a new one from the belt, slaps it in, aims',
     [PI0,PL2,PL1,PL2,lerp(PL2,PI0,.5),PI0],'R',PISTOL+', '+RIF_SLUNG)
RL1=P((X,59),6,SIDE,-0.1,(X+8,G),(X-8,G-1),R(11,11),A(X+6,52),le=E(2,15),re=E(2,13),tilt=10)
RL2=P((X,59),6,SIDE,-0.1,(X+8,G),(X-8,G-1),R(11,11),R(16,19),le=E(2,15),re=E(6,16),tilt=14)
clip('reload','side view: tactical reload, takes a fresh magazine from the vest, swaps it under the rifle, eyes stay up',
     [A0,lerp(A0,L0,.6),RL1,RL2,RL2,lerp(RL2,L0,.5)],'R',RIF)
RE1=P((X,59),8,SIDE,-0.1,(X+8,G),(X-8,G-1),R(12,13),R(18,20),le=E(3,15),re=E(8,16),tilt=16)
RE2=P((X,59),8,SIDE,-0.1,(X+8,G),(X-8,G-1),R(12,13),A(X+6,52),le=E(3,15),re=E(2,13),tilt=12)
RE3=P((X,59),8,SIDE,-0.1,(X+8,G),(X-8,G-1),R(12,13),R(10,8),le=E(3,15),re=E(4,12),tilt=12)
clip('reload_empty','side view: empty reload: tilts the rifle, magazine drops, inserts a new one, pulls the charging handle',
     [A0,RE1,RE2,RE1,RE3,RE3,lerp(RE3,L0,.6),L0],'R',RIF)
RD=lambda a,b: P((X,59),4,SIDE,-0.1,(X+8,G),(X-8,G-1),R(9,15),R(20,22),le=E(1,15),re=E(10,17),head=(6,-7+b),tilt=-6+10*a)
RDP=P((X+2,59),6,SIDE,-0.1,(X+9,G),(X-8,G-1),R(9,15),R(36,-2),le=E(1,15),re=E(18,4),tilt=2)
clip('read','side view: lowers the muzzle, eyes narrowed, head moves down line by line reading, then points one finger',
     [L0,RD(0,0),RD(.5,0),RD(1,0),RD(.5,0),RDP,RDP],'R',RIF_LOW)
AH=lambda b: AIM(0,b,10,10)
clip('aim','side view: holding a precise aim, shoulders forward, breath held, body completely still',tail([AH(0),AH(.3),AH(0),AH(.3)],True),'R',RIF_AIM)
PRC=REC(sh(AIM(-6,0.5,0,4),0),3)
clip('precise','side view: fires one heavy precise shot, strong recoil shoves the shoulder back, rear foot slides, re-aims',
     [AH(0),PRC,lerp(PRC,AH(0),.4),lerp(PRC,AH(0),.75),AH(0)],'R',RIF_AIM)
BK=P((X-1,62),6,SIDE,-0.1,(X+8,G),(X-9,G-1),R(5,-8),R(19,-7),le=E(5,4),re=E(15,4),tilt=16)
clip('block','side view: raises the rifle horizontally in both hands in front of her face to block, chin tucked, knees bent',[L0,lerp(L0,BK,.5),BK,BK],'R',RIF+', held horizontally')
EV1=P((X-6,61),4,SIDE,-0.1,(X+2,G-3),(X-20,G),tilt=4,**LR); EV2=P((X-14,61),4,SIDE,-0.1,(X-6,G),(X-24,G-2),tilt=4,**LR)
clip('evade','side view: two quick shuffle steps backward, toe to heel, rifle stays pointed forward',[L0,EV1,lerp(EV1,EV2,.5),EV2,LOW(-16),LOW(-18)],'R',RIF_LOW)
GB=P((X+6,60),8,SIDE,-0.1,(X+16,G),(X-8,G-1),R(20,16),R(24,2),le=E(6,16),re=E(16,6))
clip('grab','side view: far hand grabs a collar and pulls, near hand jams the rifle muzzle up under their chin',
     [L0,staged(L0,GB,.5),GB,GB],'R','a compact black carbine held one-handed at the hip, muzzle up')
clip('grabshot','side view: holding the collar, fires one contact shot, short recoil',[GB,REC(GB,1.5),lerp(REC(GB,1.5),GB,.5),GB],'R','a compact black carbine held one-handed at the hip, muzzle up')
SV1=P((X-2,58),-6,SIDE,-0.1,(X+14,G-34),(X-8,G),R(8,10),R(14,4),le=E(1,15),re=E(7,12),lk=KNEE_UP)
SV2=P((X-6,58),-14,SIDE,-0.1,(X+34,G-26),(X-10,G),R(8,10),R(14,4),le=E(1,15),re=E(7,12))
clip('shove','side view: lets go of the collar and push-kicks the enemy down, steps back and returns to low ready',
     [GB,SV1,SV2,SV2,lerp(SV2,LOW(-12),.5),LOW(-14),LOW(-14)],'R',RIF_PORT)
SPm=P((X,80),8,SIDE,-0.1,(X+16,G),(X-17,G-1),R(11,11),A(X+6,74),le=E(2,15),re=E(2,13),head=(6,-6),tilt=12)
SPa=lambda r: REC(KN_(0,0,8,AM,8),0) if r==0 else REC(sh(KN_(),0),1)
SPt=lambda a: P((X,80),8,SIDE-0.15*a,-0.1,(X+16,G),(X-17,G-1),head=(6,-6+a),tilt=8,**AM)
clip('super','side view: drops to one knee, swaps the magazine fast, shoulders the rifle, fires single shots turning slightly',
     [L0,lerp(L0,KN_(),.6),SPm,SPm,KN_(),SPt(0),REC(SPt(0)),SPt(1),REC(SPt(1)),SPt(0)],'R',RIF_AIM)
PKu=P((X+2,76),20,SIDE,-0.1,(X+12,G),(X-14,G-1),R(7,16),A(X+24,G-2),le=E(1,15),re=E(12,14),tilt=18,lk=KNEE_UP)
clip('pickup','side view: rifle in the near hand muzzle down, bends the knees (not the waist) and picks up with the other hand',
     [L0,lerp(L0,PKu,.5),PKu,PKu,lerp(PKu,L0,.5),L0],'R','a compact black carbine held one-handed, muzzle down')
TS0=P((X,59),2,SIDE,-0.1,(X+8,G),(X-8,G-1),R(7,16),R(-6,24),le=E(1,15),re=E(-4,14))
TS1=P((X+2,59),8,SIDE,-0.1,(X+10,G),(X-8,G-1),R(7,16),R(26,4),le=E(1,15),re=E(14,8))
clip('toss','side view: rifle in the near hand, swings the other arm back and lobs underhand forward',[L0,TS0,lerp(TS0,TS1,.5),TS1,lerp(TS1,L0,.5),L0],'R','a compact black carbine held one-handed, muzzle down')
DRF=lambda t: P((X,57),3,0,0,(X+7,G),(X-5,G),R(7,-1+2*(1-t)),R(2,34),le=E(9,6),tilt=-10*t)
clip('drink','side view: one quick gulp from a bottle, eyes stay forward, done',tail([STAND(0,lh=R(10,14),le=E(4,15)),DRF(0),DRF(1),DRF(0),STAND(0,lh=R(10,14),le=E(4,15))],False),'F',RIF_BACK)
EAF=lambda t: P((X,57),4,0,0,(X+7,G),(X-5,G),R(7,1+2*t),R(2,34),le=E(9,6),head=(5+1.5*(t-.5)*2,-7))
clip('eat','side view: standing, eats in two or three fast bites while glancing around',tail([EAF(0),EAF(1),EAF(0),EAF(1),EAF(0)],True),'F',RIF_BACK)
BDF=lambda a: P((X,57),8,0,0,(X+7,G),(X-5,G),R(14+4*math.cos(a),14+3*math.sin(a)),R(16,14),le=E(6,15),re=E(6,16),tilt=16)
BDT=P((X,57),10,0,0,(X+7,G),(X-5,G),R(9,0),R(16,10),le=E(10,8),re=E(6,14),tilt=10)
clip('bandage','side view: wraps a bandage tight around her forearm, pulls the end with her teeth, then checks her rifle',
     [BDF(0),BDF(2),BDF(4),BDT,BDT,STAND(0)],'F','white bandage roll, '+RIF_BACK)
HT=jit(LOW(-3),-2,0,['NECK','RIGHT SHOULDER','LEFT SHOULDER','NOSE','RIGHT EYE','LEFT EYE','RIGHT EAR','LEFT EAR'])
clip('hit','side view: light hit, body jolts back but the rifle muzzle stays pointed forward',[L0,HT,lerp(HT,L0,.5),L0],'R',RIF_LOW)
D1=P((X-4,62),-20,SIDE,-0.1,(X+10,G),(X-12,G-2),head=(4,-8),**PT)
D2=P((X-12,72),-50,0,0,(X+10,G-10),(X,G-8),head=(4,-8),**PT)
D3=P((X-16,92),-80,0,0,(X+18,G-12),(X+10,G-6),head=(5,-6),lk=KNEE_UP,rk=KNEE_UP,**PT)
D4=P((X-14,94),-88,0,0,(X+28,G-6),(X+22,G-2),head=(5,-6),lk=KNEE_UP,rk=KNEE_UP,**PT)
clip('down','side view: knocked off her feet backward, lands on her back hugging the rifle, never lets go',
     [D1,D2,D3,D4,D4,D4,D4],'R',RIF_PORT)
GU1=P((X-8,90),-40,0,0,(X+20,G),(X+8,G-2),head=(5,-6),lk=KNEE_UP,rk=KNEE_UP,**PT)
clip('getup','side view: rolls up to one knee into a kneeling aim, then stands into low ready',
     [D4,GU1,lerp(GU1,KN_(),.5),KN_(),lerp(KN_(),L0,.5),L0,L0],'R',RIF_PORT)
clip('talk','side view: standing still, only the mouth moves, eyes lowered',[STAND(0,tilt=6),STAND(0,tilt=6)]+[STAND(0,tilt=6)],'H')
SW=lambda a: P((X,61),10,SIDE,-0.1,(X+8,G),(X-8,G-1),R(9,10),R(23,18+4*a),le=E(2,16),re=E(12,16),head=(6,-5),tilt=14+4*a)
clip('suppress','side view: muzzle lowered to floor level, sweeps the aim across the ground while firing steadily',
     [A0,SW(0),REC(SW(0)),SW(.5),REC(SW(.5)),SW(1),REC(SW(1)),A0],'R',RIF+', muzzle aimed at the floor ahead')
CV0=P((X-8,72),4,SIDE,-0.1,(X+2,G),(X-18,G-1),R(8,14),R(12,4),le=E(1,15),re=E(6,12),tilt=0)
CV1=P((X+2,74),18,SIDE,-0.1,(X+12,G),(X-16,G-1),head=(6,-6),tilt=10,**AM)
clip('cover','side view: crouched tight with rifle upright, leans the upper body out, fires twice, ducks back',
     [CV0,lerp(CV0,CV1,.5),CV1,REC(CV1),CV1,REC(CV1),lerp(CV1,CV0,.5),CV0],'R',RIF)
# 임시 무기(쟈알디: 크게 휘두름 / 에일린: 경봉처럼 짧게 내려침)
PBI=dict(lh=R(10,10),rh=R(14,8),le=E(2,15),re=E(6,14))
PBU=P((X,59),4,SIDE,-0.1,(X+9,G),(X-8,G-1),R(6,-6),R(9,-8),le=E(4,6),re=E(6,5))
PBD=P((X+4,61),14,SIDE,-0.1,(X+12,G),(X-8,G-1),R(24,12),R(20,13),le=E(10,12),re=E(9,13))
PIDL=lambda b=0: P((X,59+b),4,SIDE,-0.1,(X+9,G),(X-8,G-1),**PBI)
PIPE='a short steel pipe gripped in both hands like a police baton, held upright in front of her'
clip('pipe','side view: short chopping strike with a pipe held in both hands, small backswing, snaps down, recovers',
     [PIDL(),PBU,lerp(PBU,PBD,.5),PBD,lerp(PBD,PIDL(),.5),PIDL()],'F',PIPE+', '+RIF_BACK)
clip('idle_pipe','side view: standing ready, pipe held upright in both hands in front of her chest',tail([PIDL(b) for b in (0,.5,1,.5)],True),'F',PIPE+', '+RIF_BACK)
clip('walk_pipe','side view: tactical rolling walk holding a pipe upright in both hands',[tac(i/8,PBI) for i in range(8)],'F',PIPE+', '+RIF_BACK)
SGW=dict(lh=R(9,9),rh=R(24,11),le=E(2,16),re=E(12,15))
SGP=dict(lh=R(9,9),rh=R(16,12),le=E(2,16),re=E(8,15))
SG0=AIM(0,0,12,8); SG0=P((X,59),12,SIDE,-0.1,(X+12,G),(X-9,G-1),head=(6,-6),tilt=8,**SGW)
SGr=REC(SG0,2.5); SGk=P((X,59),12,SIDE,-0.1,(X+12,G),(X-9,G-1),head=(6,-6),tilt=8,**SGP)
SHOT='a black pump shotgun held in both hands, stock in the shoulder'
clip('shotgun','side view: leans into a pump shotgun, fires, rides the recoil forward, racks the pump',[SG0,SGr,SGk,SG0,SG0],'F',SHOT+', '+RIF_BACK)
clip('idle_shotgun','side view: standing at low ready with a pump shotgun, knees bent',tail([P((X,60+b),5,SIDE,-0.1,(X+8,G),(X-8,G-1),tilt=4,**LR) for b in (0,.5,1,.5)],True),'F','a black pump shotgun held low in both hands, '+RIF_BACK)
clip('walk_shotgun','side view: tactical rolling walk with a pump shotgun at low ready',[tac(i/8) for i in range(8)],'F','a black pump shotgun held low in both hands, '+RIF_BACK)
clip('run_shotgun','side view: running with short quick strides, pump shotgun hugged across the chest',[runE(i/8) for i in range(8)],'F','a black pump shotgun held across the chest, '+RIF_BACK)
TD=lambda b,m: P((X,60+b),9,SIDE,-0.1,(X+8,G),(X-8,G-1),R(9,15+m),R(21+m,22+m),le=E(1,15),re=E(10,17),tilt=6+4*m)
clip('tired','side view: exhausted, breathing hard, muzzle sags, then she forces it back up',tail([TD(0,0),TD(1.5,1),TD(2,2),TD(1,1),TD(0,0)],True),'R',RIF_LOW)
clip('support','side view: slides in low to a kneeling aim, fires one precise shot, stands and slings the rifle',
     [runE(0),SL1,SL2,KN_(20),REC(KN_(20),2),KN_(20),lerp(KN_(20),STAND(0),.5),STAND(0,lh=R(6,6),le=E(4,14)),STAND(0)],'R',RIF)
GUv=P((X,57),6,0,0,(X+7,G),(X-5,G),R(6,6),R(4,8),le=E(8,13),re=E(6,13),tilt=14)
GUh=P((X,57),4,0,0,(X+7,G),(X-5,G),A(X+4,60),R(2,34),le=E(0,15),tilt=16)
GUs=P((X,57),2,0,0,(X+7,G),(X-5,G),R(4,4),R(2,34),le=E(5,12),tilt=-4)
clip('gearup','side view: tugs the vest straps tight, touches the holster, pulls the rifle sling, checks the chamber',
     [STAND(0),GUv,GUv,GUh,GUs,lerp(GUs,EG2,.6),EG2,PC(1)],'F','dark olive plate carrier, '+RIF_BACK)
GCS=lambda a: P((X-6,77),12,0,0,(X+16,G),(X+12,G),R(18+2*a,16-2*a),R(16-2*a,18),tilt=20,lk=KNEE_UP,rk=KNEE_UP,le=E(8,15),re=E(6,16))
clip('gunclean','side view, seated pose with nothing under her: small precise hand movements at desk height, cleaning parts',
     tail([GCS(0),GCS(1),GCS(-1),GCS(1)],True),'H')

# ════════ 5-2 기본 클립(몸만, 장면은 엔진) ════════
def SITE(lean=2,tilt=0,b=0,**k):   # 의자 앞 끝에 걸터앉음: 골반이 쟈알디보다 앞(+4), 등 곧게
    k.setdefault('lh',R(15,20)); k.setdefault('rh',R(13,22)); k.setdefault('le',E(5,16)); k.setdefault('re',E(3,16))
    return P((X-2,77+b),lean,0,0,(X+18,G),(X+14,G),tilt=tilt,lk=KNEE_UP,rk=KNEE_UP,**k)
SU_=lambda lf,rf,hip,lean=6,lh=R(2,34),rh=R(2,34),**k: P(hip,lean,0,0,lf,rf,lh,rh,**k)
clip('stepup','side view: quick short step up to a higher level, pushes up, rear foot joins fast, near hand stays by the hip',
     tail([STAND(0),SU_((X+11,G-16),(X-5,G),(X+2,57),8,lk=KNEE_UP,lh=A(X+4,60)),SU_((X+13,G-16),(X-2,G-6),(X+10,46),8,lk=KNEE_UP,lh=A(X+12,50)),
           SU_((X+13,G-16),(X+7,G-16),(X+11,41),3,lh=A(X+13,46)),SU_((X+13,G-16),(X+7,G-16),(X+11,41),3)],False),'F',RIF_BACK)
clip('stepover','side view: steps precisely over a knee-high edge one leg at a time without using her hands',
     tail([STAND(0),SU_((X+10,G-30),(X-5,G),(X+1,57),2,lk=KNEE_UP),SU_((X+24,G),(X-5,G),(X+10,58),4),
           SU_((X+24,G),(X+12,G-30),(X+18,57),2,rk=KNEE_UP),SU_((X+24,G),(X+16,G),(X+20,57),2)],False),'H')
LIE=lambda lean,b=0,lh=R(6,18),rh=R(4,20),le=E(2,12),re=E(0,12): P((X-6,74+b),lean,0,0,(X+39,75),(X+38,76),lh,rh,le=le,re=re)
clip('liesit','side view: lying flat on her back, sits straight up in one firm motion, legs stay straight',
     tail([LIE(-90),LIE(-45,lh=R(12,20),rh=R(10,22),le=E(5,14),re=E(3,14)),LIE(-6,lh=R(16,24),rh=R(14,26),le=E(6,15),re=E(4,15)),
           LIE(-2,lh=R(16,24),rh=R(14,26),le=E(6,15),re=E(4,15))],False),'H')
HWE=lambda d: P((X+1,57),6,0,0,(X+8,G),(X-5,G),R(16+2*d,22-d),R(15-2*d,23+d),tilt=14,le=E(7,16),re=E(5,17))
clip('handswork','side view: standing upright, small quick precise hand movements at waist height in front',tail([HWE(0),HWE(1),HWE(-1),HWE(1)],True),'H')
HHE=lambda d: P((X,57),2,0,0,(X+7,G),(X-5,G),R(-4+d,-14),R(-6-d,-12),tilt=6,le=E(10,-4),re=E(8,-3))
clip('handshead','side view: both hands go up behind her head to her ponytail, pulling and tightening it',
     tail([STAND(0),lerp(STAND(0),HHE(0),.5),HHE(0),HHE(2),HHE(-1),HHE(2)],False),'H')
SME=lambda t: SITE(6,4,lh=R(14-7*t,20-22*t),le=E(6+6*t,16-6*t))
clip('seatmouth','side view, seated upright on the front edge, near hand brings food to her mouth quickly, eyes ahead',tail([SME(0),SME(1),SME(0),SME(1)],True),'H')
HDE=dict(lh=R(15,8),rh=R(13,10),le=E(8,14),re=E(6,15))
clip('seathold','side view, seated upright, both hands hold something up at chest height, eyes narrowed, reading',tail([SITE(4,10,**HDE),SITE(4,12,**HDE),SITE(4,10,b=.5,**HDE),SITE(4,12,**HDE)],True),'H')
HLE=lambda t: P((X,57),3,0,0,(X+7,G),(X-5,G),R(15,8),R(17,6+t),le=E(8,14),re=E(9,12),tilt=10+2*t)
clip('holdlook','side view: standing, holds something at chest height, eyes narrowed, the other finger traces the lines',tail([HLE(0),HLE(1),HLE(2),HLE(1)],True),'H')
HEE=lambda t: P((X,57),2,0,0,(X+7,G),(X-5,G),R(-5,-10),A(X+4,60),tilt=t,le=E(9,2),re=E(0,15))
clip('handear','side view: near hand held to her ear, the other hand rests by the hip holster, one short nod',tail([HEE(0),HEE(4),HEE(0),HEE(0)],True),'H')
def swpE(d):
    Hh=(X+36+d,106); T=(X+3+0.3*d,32)
    at=lambda t:('a',Hh[0]+(T[0]-Hh[0])*t,Hh[1]+(T[1]-Hh[1])*t)
    return P((X+1+0.3*d,58),8,0,0,(X+9,G),(X-6,G),at(.45),at(.78))
clip('sweep','side view: both fists held one above the other on a diagonal line, short fast strokes forward and back',tail([swpE(0),swpE(8),swpE(0),swpE(-6)],True),'H')
LHE=lambda b: P((X-6,74),-90,0,0,(X+39,75),(X+38,76),R(24,-6+b),R(23,-4+b),le=E(12,4),re=E(11,5))
clip('liehold','side view: lying flat on her back, arms straight up holding something over her face, eyes narrowed',tail([LHE(0),LHE(1),LHE(0),LHE(1)],True),'H')
C2E=dict(lh=R(15,13),rh=R(13,15),le=E(3,15),re=E(1,16))
C1E=dict(lh=R(10,12),le=E(3,16))
def runEh(t,**k):
    c,s=cyc(t); fl=abs(s)
    return P((X+8,59-3*fl),14,0,0,(X+6+17*c-6*max(0,-s),G-12*max(0,-s)-3*fl),(X+6-17*c-6*max(0,s),G-12*max(0,s)-3*fl),head=(6,-6),**k)
for tag,k,txt in (('carry2',C2E,'both forearms level, held tight against the chest, elbows in'),
                  ('carry1',C1E,'near hand in a loose fist at chest height, other hand free by the hip')):
    kk={**k,**({'rh':A(X+4,62),'re':E(0,15)} if tag=='carry1' else {})}
    clip(f'{tag}_idle',f'side view: standing still, {txt}',tail([STAND(b,**kk) for b in (0,.5,1,.5)],True),'H')
    clip(f'{tag}_walk',f'side view: brisk short-step walk, {txt}',[walkE(i/8,**kk) for i in range(8)],'H')
    clip(f'{tag}_run',f'side view: running, short quick strides, {txt}',[runEh(i/8,**kk) for i in range(8)],'H')

# ════════ 5-3 지형·이동 ════════
TU=rig.front(STAND(0))
TUm=P((X,59),5,0.4,0,(X+8,G),(X-8,G-1),R(9,15),R(18,22),le=E(1,15),re=E(8,17),tilt=4)
clip('turn','side view: rifle muzzle swings around first and the body follows, turning toward the viewer',[L0,TUm,rig.front(L0)],'R',RIF_LOW)
FA=lambda b: P((X,52+b),2,SIDE,-0.1,(X+6,G-18),(X-4,G-14),lk=KNEE_FWD,head=(5,-7),**PT)
clip('fall','side view: falling, rifle hugged to the chest, knees together and bent, braced',tail([FA(0),FA(1),FA(2)],True),'R',RIF_PORT)
LDE=P((X,82),16,SIDE,-0.1,(X+14,G),(X-12,G),lk=KNEE_UP,rk=KNEE_UP,**PT)
clip('land','side view: lands from a height into a deep knee bend, rifle on the chest, rises straight into low ready',[FA(0),LDE,lerp(LDE,L0,.5),L0],'R',RIF_PORT)
def ladE(t):
    c=math.cos(2*math.pi*t)
    return P((X+2,58),2,0,0,(X+14,92-7*c),(X+12,92+7*c-8),A(X+18,14+6*c),A(X+18,22-6*c),lk=KNEE_UP,rk=KNEE_UP,le=ELB_OUT,re=ELB_OUT)
clip('ladder','side view: climbing motion, short quick alternating hands and feet, body close, ladder not drawn',tail([ladE(i/8) for i in range(8)],True),'F',RIF_BACK)
MAe=P((X+4,58),20,0,0,(X+8,G),(X-6,G),A(X+18,60),A(X+16,60))
MJe=P((X+8,40),34,0,0,(X+4,70),(X-2,74),A(X+20,58),A(X+18,58),lk=KNEE_UP,rk=KNEE_UP,le=ELB_OUT,re=ELB_OUT)
MKe=P((X+14,28),30,0,0,(X+22,58),(X+6,64),A(X+24,60),A(X+22,60),lk=KNEE_UP,rk=KNEE_UP)
MSe=P((X+22,17),3,0,0,(X+28,60),(X+18,60))
clip('mantle','side view: springs up onto a waist-high ledge, hooks the elbows, tucks the knees small and stands on top',[STAND(0),MAe,MJe,MKe,MSe],'F',RIF_BACK)
VAe=P((X+8,60),20,0,0,(X+18,G),(X-4,G-2),A(X+26,62),R(2,34))
VBe=P((X+26,46),10,0.6,0.3,(X+42,62),(X+34,58),A(X+26,62),R(-6,10),lk=KNEE_UP,rk=KNEE_UP)
VCe=P((X+44,60),6,0,0,(X+52,G-2),(X+38,G-6))
clip('vault','side view: speed vault, one hand on a waist-high obstacle, swings both legs over to the side, lands running',[walkE(0),VAe,VBe,VCe,P((X+48,58),4,0,0,(X+56,G),(X+42,G))],'F',RIF_BACK)
def crawlE(t):
    c,s=cyc(t)
    return P((X-14,90),78,0,0,(X-38+5*c,G),(X-40-5*c,G-1),A(X+18+5*c,G-2),A(X+12-5*c,G-1),head=(7,-3),tilt=-38,le=E(2,22),re=E(0,22))
clip('crawl','side view: low crawl on forearms and knees, body flat to the floor, head up',tail([crawlE(i/8) for i in range(8)],True),'F',RIF_BACK)
clip('sneak','side view: very low slow tactical walk on the balls of the feet, rifle at low ready, head level',
     [tac(i/8,LR,10,64) for i in range(8)],'R',RIF_LOW)
LKB=lambda a: P((X,59),5,SIDE+0.9*a,-0.1+0.3*a,(X+8,G),(X-8,G-1),R(9,15),R(22-4*a,21),le=E(1,15),re=E(10-3*a,17),head=(5-9*a,-7))
clip('lookback','side view: keeps the rifle forward, twists the shoulders to check behind, then faces front again',[LKB(0),LKB(.5),LKB(.9),LKB(.9),LKB(.5),LKB(0)],'R',RIF_LOW)
HDe=lambda b=0: P((X-6,80+b),10,0,0,(X+10,G),(X-16,G-1),R(6,6),R(8,-6),le=E(2,15),re=E(6,4),head=(6,-6),lk=KNEE_UP)
clip('hide','side view: crouched low, rifle held upright against her body, steadying her breathing, face visible',tail([L0,lerp(L0,HDe(),.5),HDe(0),HDe(1),HDe(0)],False),'R',RIF+', held upright against her body')
RWe=lambda b: P((X+3,57),10,0,0,(X+9,G),(X-5,G),R(18,-2+b),R(2,34),le=E(10,4),head=(6,-7),tilt=-4+b)
clip('readwall','side view: leans close, eyes narrowed, one finger tracing lines of small writing at eye level',tail([RWe(0),RWe(2),RWe(4),RWe(6)],True),'F',RIF_BACK)

# ════════ 5-4 탐사 ════════
DOe=lambda r: P((X+2*r,59),6+4*r,SIDE,-0.1,(X+8+3*r,G),(X-8,G-1),R(9,15),A(X+26+6*r,54),le=E(1,15),re=E(12,12),tilt=4)
clip('door','side view: rifle in the near hand, far hand reaches forward, turns and pushes, she steps through muzzle first',
     tail([L0,DOe(0),DOe(.5),DOe(1),tac(.25),tac(.5)],False),'R','a compact black carbine held one-handed at low ready')
DCe=lambda t,r: P((X+2,60),6,SIDE,-0.1,(X+2+9*math.cos(2*math.pi*t),G-2*max(0,-math.sin(2*math.pi*t))),(X+2-9*math.cos(2*math.pi*t),G),R(9,15),A(X-28+10*r,52),le=E(1,15),re=E(-12,14),head=(4,-8))
clip('doorclose','side view: moving forward, rifle in the near hand, far arm reaches straight back to push something shut',
     [tac(0),DCe(.125,0),DCe(.25,.5),DCe(.375,1),tac(.5),tac(.625)],'R','a compact black carbine held one-handed at low ready')
KKe=lambda r: P((X-4,57),2,0,0,(X+3,G),(X-9,G),A(X+18+2*r,40),R(2,34),le=E(8,6))
clip('knock','side view: standing off to one side, knocks twice with the knuckles, then steps back',tail([STAND(0),KKe(0),KKe(1),KKe(0),KKe(1),STAND(-0)],False),'F',RIF_BACK)
def pushE(t):
    c,s=cyc(t)
    return P((X+2,64),30,0.3,0,(X+6+9*c,G-2*max(0,-s)),(X+6-9*c,G-2*max(0,s)),A(X+28,56),A(X+26,62),le=E(10,10),re=E(8,12))
clip('push','side view: shoulder and both hands driving forward against something heavy, short driving steps',tail([pushE(i/8) for i in range(8)],True),'F',RIF_BACK)
ISe=lambda r: P((X,80),14,SIDE,-0.1,(X+16,G),(X-17,G-1),R(8,15),A(X+26+3*r,G-4),le=E(1,15),re=E(12,14),tilt=20)
clip('inspect','side view: drops to one knee, rifle in the near hand, studies the floor, then touches it once with a fingertip',
     tail([L0,lerp(L0,ISe(0),.5),ISe(0),ISe(0),ISe(1),ISe(0)],False),'R','a compact black carbine held one-handed, muzzle down')
def leadE(t):
    c,s=cyc(t)
    return P((X+3,60+0.4*abs(c)),6,SIDE,-0.1,(X+3+9*c,G-2*max(0,-s)),(X+3-9*c,G-2*max(0,s)),R(10,14),R(-28,18),le=E(2,15),re=E(-14,14),head=(4,-7),tilt=4)
clip('leadhand','side view: tactical walk, rifle in the near hand, far arm stretched back gripping someone by the wrist',[leadE(i/8) for i in range(8)],'R','a compact black carbine held one-handed at low ready')
clip('bow','side view: a brief nod of the head as a bow, back stays straight',tail([STAND(0),STAND(0,tilt=14),STAND(0,tilt=18),STAND(0,tilt=6)],False),'H')
EWe=lambda b: P((X,57+b),3,0,0,(X+7,G),(X-5,G),R(6,10),R(4,12),le=E(6,14),re=E(4,15),head=(5,-7),tilt=-4)
clip('elevwait','side view: standing still, hands clasped in front, eyes narrowed, reading something at eye level',tail([EWe(0),EWe(.5),EWe(1),EWe(.5)],True),'F',RIF_BACK)
FSe=lambda b=0: P((X-10,96),-6+b,0,0,(X+18,G),(X+6,G-1),R(16,14+b),R(14,16),head=(5,-7),tilt=-2,lk=KNEE_UP,rk=KNEE_UP,le=E(6,14),re=E(4,15))
FSq=P((X-4,80),12,0,0,(X+14,G),(X+2,G),R(12,14),R(10,16),lk=KNEE_UP,rk=KNEE_UP,le=E(4,14),re=E(2,15))
clip('floorsit','side view: sits down on the floor leaning back, one knee up, rifle laid across her lap',tail([L0,lerp(L0,FSq,.5),FSq,lerp(FSq,FSe(),.5),FSe()],False),'F','a compact black carbine laid across her lap')
clip('floorrest','side view: seated on the floor leaning back, eyes open watching ahead, hand on the rifle across her lap',tail([FSe(0),FSe(.5),FSe(1),FSe(.5)],True),'F','a compact black carbine laid across her lap')

# ════════ 5-5 상태·결과 ════════
HUe=lambda b: P((X,62+b),14,SIDE,-0.1,(X+8,G),(X-8,G-1),R(9,15),R(20,22),le=E(-2,13),re=E(10,17),tilt=8)
clip('hurtidle','side view: hurt, near elbow pressed to her side, still holding the rifle at low ready, heavy breathing',tail([HUe(0),HUe(1.5),HUe(2.5),HUe(1.5)],True),'R',RIF_LOW)
def limpE(t):
    c,s=cyc(t); dip=5*max(0,-c)
    return P((X+2,61+dip),10+3*max(0,-c),SIDE,-0.1,(X+2+9*c,G-4*max(0,-s)),(X+2-6*c,G),R(9,15),R(20,22),le=E(-2,13),re=E(10,17),tilt=6,rk=KNEE_UP)
clip('limp','side view: limping, rear leg dragging stiffly, rifle still held at low ready, muzzle forward',[limpE(i/8) for i in range(8)],'R',RIF_LOW)
FRe=lambda b: P((X,60+b*.4),5,SIDE,-0.1,(X+8,G),(X-8,G-1),R(9,14),R(21,20),le=E(0,14),re=E(9,16),tilt=2)
clip('fear','side view: frozen still at low ready, gripping the rifle hard, fast shallow breathing, eyes fixed ahead',tail([FRe(0),FRe(1),FRe(0),FRe(1)],True),'R',RIF_LOW)
NSe=lambda d: P((X,57),4+4*d,0,0,(X+7,G),(X-5,G),A(X+4,60),R(2,34),le=E(0,15),head=(5-4*d,-7),tilt=8*d)
clip('nausea','side view: turns her head away and swallows hard, one hand on the holster, body stays upright',tail([STAND(0),NSe(.6),NSe(1),NSe(1),NSe(.4)],False),'F',RIF_BACK)
CLk=P((X,78),8,SIDE,-0.1,(X-30,G-2),(X-34,G-3),R(9,15),R(18,24),le=E(1,15),re=E(8,18),tilt=12)
CLr=P((X,78),4,SIDE,-0.1,(X-30,G-2),(X-34,G-3),R(9,10),R(20,12),le=E(1,15),re=E(10,14),tilt=4)
CLd=P((X+4,94),80,0,0,(X-36,G-2),(X-40,G),A(X+22,G),A(X+16,G),tilt=8)
clip('collapse','side view: drops to her knees, tries once to raise the rifle, then falls forward and stays still',
     [L0,lerp(L0,CLk,.5),CLk,CLr,CLk,lerp(CLk,CLd,.5),CLd,CLd],'R',RIF_LOW)
BLe=lambda b=0: P((X-6,74),-90,0,0,(X+39,75),(X+38,76),R(14,22+b),R(12,23+b),le=E(4,14),re=E(2,14))
clip('bedlie','side view: lying flat on her back in the air with nothing under her, hands folded on her stomach, asleep',tail([BLe(0),BLe(1),BLe(1),BLe(0)],True),'H')
VI1=P((X,59),4,SIDE,-0.1,(X+8,G),(X-8,G-1),R(9,15),R(18,24),le=E(1,15),re=E(8,18),tilt=6)
clip('victory','side view: lowers the muzzle, checks the chamber once, slings the rifle onto her back, stands easy',
     [L0,VI1,PC(0),PC(1),EG2,lerp(EG2,EG1,.5),EG1,STAND(0)],'R','a compact black carbine on a sling, swung onto her back at the end')

# ════════ 5-6 본부 업무 ════════
clip('chairsit','side view: sits down straight onto the front edge of a seat with nothing under her, back straight',tail([STAND(0),lerp(STAND(0),SITE(10),.5),SITE(8),SITE()],False),'H')
TYe=lambda r: SITE(4,10,lh=R(20,12-2*r),rh=R(17,12-2*(1-r)),le=E(8,15),re=E(6,16))
clip('typing','side view, seated upright on the front edge, typing fast at desk height, upper body still',tail([TYe(0),TYe(1),TYe(0),TYe(1)],True),'H')
GCe=lambda a: P((X,57),4,0,0,(X+7,G),(X-5,G),R(14,10-a),R(12+2*a,12),le=E(7,13),re=E(6,14),tilt=14)
clip('gearcheck','side view: pulls the pistol slide back a little to check, drops the magazine to look, slaps it in, holsters',
     tail([STAND(0),GCe(0),GCe(1),GCe(2),GCe(0),STAND(0)],False),'H','a black pistol')
TIe=lambda d: P((X,57),2,0,0,(X+7,G),(X-5,G),R(6,4+d),R(2,34),tilt=-4,le=E(11,13))
clip('tie','side view: one hand gives the necktie knot a single quick tug at the collar, done',tail([STAND(0),TIe(0),TIe(2),STAND(0)],False),'H')

# ════════ 5-7 생활·여가 ════════
SRe=lambda b=0,tilt=0: SITE(0,tilt,b)
clip('seatrest','side view, seated bolt upright on the front edge, hands on her knees, closes her eyes briefly',tail([SRe(0),SRe(.3),SRe(.3,4),SRe(0)],True),'H')
STh=lambda b=0: SITE(16,12,b,lh=R(14,2),rh=R(13,4),le=E(13,10),re=E(11,11))
clip('seatthink','side view, seated leaning forward, elbows forward, laced fingers before her mouth, eyes narrowed',tail([STh(0),STh(.3),STh(.6),STh(.3)],True),'H')
clip('doze','side view, seated upright: head slowly drops, jerks back up, then she looks down at her wrist',
     tail([SRe(0),SRe(0,14),SRe(.5,26),SRe(0,-2),SITE(4,16,lh=R(12,10),le=E(6,14))],False),'H')
YAe=lambda a: P((X,57),2,0,0,(X+7,G),(X-5,G),R(6,-3) if a else R(2,34),R(2,34),le=E(10,5),tilt=-4*a)
clip('yawn','side view: a suppressed yawn behind the back of her hand, mouth snaps shut fast',tail([STAND(0),YAe(1),YAe(1),STAND(0)],False),'H')
NR=lambda a: STAND(0,head=(5+3*math.cos(a),-7+2*math.sin(a)))
clip('stretch','side view: small neck roll and one shoulder roll, no big stretch',tail([STAND(0),NR(0),NR(1.6),NR(3.2),NR(4.7),STAND(0)],False),'H')
clip('ponytail','side view: both hands behind her head pull her ponytail tie tight with a quick yank',tail([STAND(0),HHE(0),HHE(-2),HHE(2),STAND(0)],False),'H')
BRe=lambda d: P((X,57),3,0,0,(X+7,G),(X-5,G),R(7+d,-3),R(10,16),le=E(10,4),re=E(5,15),tilt=4)
clip('brushteeth','side view: brushing her teeth fast and short, other hand at her waist',tail([BRe(0),BRe(3),BRe(0),BRe(3)],True),'H')

# ════════ 5-8 사교 ════════
GSe=lambda a: P((X,57),3,0,0,(X+7,G),(X-5,G),R(18,16+4*a),R(2,34),le=E(9,13),tilt=6)
clip('gesture','side view: barely gestures, one finger points down briefly as she speaks',tail([STAND(0),GSe(0),GSe(1),STAND(0)],False),'H')
XAe=dict(lh=R(9,13),rh=R(10,11),le=E(6,17),re=E(8,15))
clip('armscross','side view: arms folded tightly across the chest, head slightly lowered, listening',tail([STAND(b,tilt=8,**XAe) for b in (0,.3,.6,.3)],True),'H')
clip('nod','side view: one short nod',tail([STAND(0),STAND(0,tilt=12),STAND(0,tilt=2),STAND(0)],False),'H')
SKe=lambda d: STAND(0,head=(5+2*d,-7),tilt=4)
clip('headshake','side view: one small shake of the head, eyes closed, body still',tail([STAND(0),SKe(-1),SKe(1),SKe(0),STAND(0)],False),'H')
W2=lambda u: P((X,57),2,0,0,(X+7,G),(X-5,G),R(10,-10*u+10*(1-u)),R(2,34),le=E(9,6-10*u))
clip('wave','side view: raises two fingers briefly to head height, then lowers the hand, no waving',tail([STAND(0),W2(.5),W2(1),W2(1),W2(.5),STAND(0)],False),'H')
HSe=lambda d: P((X+2,57),4,0,0,(X+9,G),(X-5,G),R(24,14+2*d),R(2,34),le=E(10,14))
clip('handshake','side view: one short firm handshake',tail([STAND(0),HSe(0),HSe(1),HSe(0),STAND(0)],False),'H')
PTe=lambda d: P((X+2,57),4,0,0,(X+9,G),(X-5,G),R(24,-2+3*d),R(2,34),le=E(12,6))
clip('pat','side view: reaches forward and gives one brief pat at shoulder height',tail([STAND(0),PTe(0),PTe(1),STAND(0)],False),'H')
PNe=lambda u: P((X+2,57),4,0,0,(X+8,G),(X-5,G),R(18+14*u,6-6*u),R(2,34),le=E(10+6*u,6))
clip('point','side view: flat knife-hand signal pointing ahead, crisp and brief',tail([STAND(0),PNe(.6),PNe(1),PNe(1)],False),'H')
SHe=lambda a: P((X,57-a*.6),2,0,0,(X+7,G),(X-5,G),R(2,34),R(2,34),tilt=-3*a)
clip('shrug','side view: one shoulder lifts very slightly, barely a shrug',tail([STAND(0),SHe(1),SHe(1),STAND(0)],False),'H')
HGe=lambda a: P((X+4,57),4,0,0,(X+11,G),(X-3,G),R(18+2*a,2),R(2,34),le=E(12,4),tilt=4)
clip('hug','side view: a stiff, short one-armed hug of someone in front, the other arm stays down',tail([STAND(0),HGe(1),HGe(0),HGe(0)],False),'H')
SIe=lambda a: P((X,57+1.5*a),3,0,0,(X+7,G),(X-5,G),R(2,34),R(2,34),tilt=-2+2*a)
clip('sigh','side view: a quiet sigh, shoulders drop once and the eyes close, head stays level',tail([SIe(0),SIe(.5),SIe(1),SIe(1),SIe(.3)],False),'H')

# ════════ 5-9 감정 ════════
clip('laugh','side view: a short breath through the nose, turns her face slightly away, shoulders barely move',tail([STAND(0),STAND(0,head=(3,-7),tilt=4),STAND(.5,head=(3,-7),tilt=4),STAND(0)],False),'H')
clip('glad','side view: a tiny nod to herself, quietly satisfied',tail([STAND(0),STAND(0,tilt=8),STAND(0,tilt=2)],False),'H')
CYe=lambda b: P((X-2,57+b),4,0.5,0.2,(X+5,G),(X-6,G),R(5,-8),R(2,34),le=E(10,4),head=(2,-7),tilt=16)
clip('cry','side view: turns slightly away, pinches the bridge of her nose with two fingers, one breath, turns back',tail([STAND(0),CYe(0),CYe(1),CYe(0),STAND(0)],False),'H')
WCe=lambda b: P((X-6,57+b),-8,0,0,(X+8,G),(X-6,G),R(2,34),R(2,34),head=(4,-8),tilt=-14)
clip('wallcry','side view: standing leaning back, head tipped back, eyes shut, jaw clenched, arms down',tail([WCe(0),WCe(.6),WCe(0),WCe(.6)],True),'H')
KCe=lambda b: P((X,80+b),14,0,0,(X+16,G),(X-17,G-1),A(X+26,G),R(10,16),le=E(12,14),re=E(4,15),tilt=24)
clip('kneelcry','side view: down on one knee, fist pressed to the floor, head bowed, shoulders shaking',tail([KCe(0),KCe(1),KCe(0),KCe(1)],True),'H')
SDe=lambda b: P((X,57+b),4,0,0,(X+7,G),(X-5,G),R(6,6),R(2,34),le=E(8,14),tilt=12)
clip('sad','side view: grips the collar of her shirt with one hand, head lowered a little, still',tail([SDe(0),SDe(.5),SDe(1),SDe(.5)],True),'H')
SHT=lambda a: P((X+2,57),6*a,0,0,(X+9,G),(X-5,G),R(14+16*a,8-4*a),R(2,34),le=E(8+6*a,10))
clip('shout','side view: one-word command, chops the flat hand forward, leaning in slightly',tail([STAND(0),SHT(.5),SHT(1),SHT(1),STAND(0)],False),'H')
DSe=lambda a: P((X+2,58+a),8+8*a,0,0,(X+9,G),(X-5,G),A(X+24,44+18*a),R(2,34),le=E(12,10+4*a),tilt=6)
clip('deskslam','side view: slaps the flat palm down once hard at desk height',tail([STAND(0),DSe(0),DSe(1),DSe(1),STAND(0)],False),'H')
SUe=P((X,62),6,0,0,(X+9,G),(X-6,G),A(X+4,62),R(10,10),le=E(0,15),re=E(6,12),tilt=-2)
clip('surprise','side view: startled, does not step back, drops her stance and her hand snaps to the holster',tail([STAND(0),SUe,SUe,lerp(SUe,STAND(0),.5)],False),'H')
SFe=P((X,80),8,0,0,(X+16,G),(X-17,G-1),A(X+4,82),R(12,10),le=E(-2,15),re=E(6,12),tilt=-2)
clip('startlefall','side view: startled hard, drops onto one knee in a crouch, hand gripping the holster',tail([STAND(0),SUe,lerp(SUe,SFe,.5),SFe,SFe],False),'H')
PDe=P((X-10,96),-8,0,0,(X+16,G),(X+10,G),A(X+6,G-6),A(X+2,G-4),lk=KNEE_UP,rk=KNEE_UP,tilt=10)
clip('plopdown','side view: leaning back, slowly slides down to sit on the floor, knees up, head tipped back',
     tail([P((X-6,57),-6,0,0,(X+8,G),(X-6,G)),P((X-8,72),-6,0,0,(X+12,G),(X+2,G),lk=KNEE_UP,rk=KNEE_UP),P((X-9,86),-7,0,0,(X+14,G),(X+6,G),lk=KNEE_UP,rk=KNEE_UP),PDe,PDe],False),'H')
EMe=lambda a: P((X,57),3,0.3,0,(X+7,G),(X-5,G),R(-8,-4+4*a),R(2,34),le=E(6,6),head=(3,-7),tilt=6)
clip('embarrassed','side view: looks away and touches the end of her ponytail behind her',tail([STAND(0),EMe(0),EMe(1),EMe(0)],False),'H')
AYe=lambda t: P((X,57),4,0,0,(X+7,G),(X-5,G),R(7,-9+t),R(2,34),le=E(11,3),tilt=10+4*t)
clip('annoyed','side view: pinches the bridge of her nose with thumb and finger, eyes closed',tail([STAND(0),AYe(0),AYe(1),AYe(1),AYe(0)],False),'H')
TKe=lambda t: P((X,57),3,0,0,(X+7,G),(X-5,G),R(8,-3+t),R(10,12),le=E(10,5),re=E(6,15),tilt=6)
clip('think','side view: index finger taps her lips, eyes narrowed, other arm folded',tail([TKe(0),TKe(1),TKe(0),TKe(1)],True),'H')
BOe=lambda t: STAND(0,lh=A(X+4,60-1*t),le=E(0,15))
clip('bored','side view: standing still, fingers tapping on the holster at her hip',tail([BOe(0),BOe(1),BOe(0),BOe(1)],True),'H')
clip('smirk','side view: the faintest lift at one corner of her mouth, head tilted down slightly, otherwise still',tail([STAND(0),STAND(0,tilt=4),STAND(0,tilt=5)],False),'H')

clip('fstand','standing still, knees soft, arms relaxed, eyes scanning ahead',tail([SC(0),SC(.5),SC(0),SC(-.5)],True),'F',RIF_BACK)
BASES={'H':'../base/H-side.png','F':'../base/F-side.png','R':'../base/R-side.png'}

if __name__=='__main__':
    from PIL import Image,ImageDraw
    import collections
    names=sys.argv[1:] or list(CLIPS)
    # 자동 검사: 팔꿈치 등 뒤(손이 어깨 아래인데 팔꿈치가 어깨보다 3px 넘게 뒤), 캔버스 밖, 장 수
    bad=0
    for n in names:
        a,pr,b,ps=CLIPS[n]
        for i,p in enumerate(ps):
            for s in ('RIGHT','LEFT'):
                sh_,e,w=p[f'{s} SHOULDER'],p[f'{s} ELBOW'],p[f'{s} ARM']
                if w[1]>sh_[1]+2 and e[0]<sh_[0]-6 and w[0]>sh_[0]: print('ELB',n,i,s); bad+=1
            for k,v in p.items():
                x,y=(v[0]+DX)/W,(v[1]+DY)/H
                if not(0.01<x<0.99 and 0.01<y<0.99): print('OUT',n,i,k,round(x,2),round(y,2)); bad+=1
    s=2; rows=[]
    for n in names:
        _,_,b,ps=CLIPS[n]
        row=Image.new('RGBA',(W*s*16,H*s),(30,34,40,255))
        for i,p in enumerate(ps): row.alpha_composite(draw(p,None,s),(i*W*s,0))
        ImageDraw.Draw(row).text((4,4),f'{n} [{b}] {len(ps)}',fill=(255,255,0,255)); rows.append(row)
    os.makedirs('../plan',exist_ok=True)
    for i in range(0,len(rows),8):
        sheet=Image.new('RGBA',(W*s*16,H*s*len(rows[i:i+8])))
        for j,r in enumerate(rows[i:i+8]): sheet.alpha_composite(r,(0,j*H*s))
        sheet.resize((sheet.width//2,sheet.height//2)).save(f'../plan/plan-{i//8:02d}.png')
    cnt=collections.Counter(v[2] for v in CLIPS.values())
    cost=sum(2 if len(v[3])<=3 else 3 if len(v[3])<=8 else 4 for v in CLIPS.values())
    print(len(CLIPS),'clips',sum(len(v[3]) for v in CLIPS.values()),'frames',dict(cnt),'est gens',cost,'issues',bad)
