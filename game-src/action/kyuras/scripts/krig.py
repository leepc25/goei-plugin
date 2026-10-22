# 큐라스 전 동작 뼈대 (animate_with_skeleton_v3용). 설계: docs/캐릭터제작서/동작설계_kyuras.md (6장 클립 전체표, 5장 동작 근거).
# 좌표·관절 도구(P, ik, anatomic, kp)는 쟈알디 rig(jyaldi-v5/scripts/rig.py)와 같은 공간을 쓴다: 192×144 캔버스, 발목 바닥선 G=100(+28 → 128, 발바닥 136).
# 기준 그림은 쟈알디 옆모습 대기 장(idle/00, 뼈대 STAND(0))을 큐라스로 편집한 것이라 첫 장 관절 = 쟈알디 STAND(0).
# 자세는 전부 새로 짓는다. 쟈알디 클립과 같은 자세가 나오지 않게 audit.py가 같은 이름 클립의 관절 거리를 잰다.
# 오른쪽(동쪽)을 봄. RIGHT = 앞손·앞발(그림상 가까운 쪽). 옆모습: 어깨 회전 s는 ±0.25 안(넘으면 3/4 정면으로 그려짐).
# 가슴 앞 손은 팔꿈치를 ('e',x,y)로 몸 앞에 직접 지정(IK가 등 뒤로 보내면 정면으로 그려짐).
import math,sys,os
HERE=os.path.dirname(os.path.abspath(__file__))
JS=os.path.join(HERE,'..','..','jyaldi-v5','scripts'); sys.path.insert(0,JS)
import importlib.util
_spec=importlib.util.spec_from_file_location('jrig',os.path.join(JS,'rig.py')); R=importlib.util.module_from_spec(_spec); _spec.loader.exec_module(R)
P,lerp,staged,sh,jit,G,X=R.P,R.lerp,R.staged,R.sh,R.jit,R.G,R.X
KNEE_UP,KNEE_FWD,ELB_UP,ELB_DOWN,ELB_OUT=R.KNEE_UP,R.KNEE_FWD,R.ELB_UP,R.ELB_DOWN,R.ELB_OUT
kp,draw,anatomic=R.kp,R.draw,R.anatomic
BASE_KP=R.STAND(0)          # 기준 그림(쟈알디 idle/00 편집)의 관절
CLIPS={}
def clip(name,action,poses,prop=''):
    assert 3<=len(poses)<=15,(name,len(poses)); assert name not in CLIPS,name
    CLIPS[name]=(action,prop,[anatomic(p) for p in poses])
C=lambda t: math.cos(2*math.pi*t)
S_=lambda t: math.sin(2*math.pi*t)

# ── 손 위치 약속 ──
PF=('a',X+4,63); PR=('a',X-2,63)            # 주머니(앞손·뒷손): 엉덩이 옆
PKE=dict(le=('e',-3,15),re=('e',-6,14))     # 주머니 팔꿈치: 몸 옆 살짝 뒤
LOAD=(15,1); FIRE=(19,2)                    # 앞손 스냅 장전(엄지·중지 붙임, 손목 젖힘) / 해제(손목 튕김)
def ST(b=0,lh=PF,rh=PR,head=(5,-7),tilt=0,dx=0,lean=2,lf=6,rf=-4,**k):
    """서기. 기본은 두 손 주머니"""
    kk={**PKE} if (lh==PF and rh==PR) else {}
    if lh==PF and 'le' not in k: k.setdefault('le',PKE['le'])
    if rh==PR and 're' not in k: k.setdefault('re',PKE['re'])
    kk.update(k)
    return P((X+dx,55+b),lean,0,0,(X+dx+lf,G),(X+dx+rf,G),lh,rh,head=head,tilt=tilt,**kk)
def KG(d=0,b=0,fh=LOAD,rh='hip',lean=3,tilt=0,lfl=0,rfl=0,s=0.1,head=(5,-7),**k):
    """전투 대기: 펜싱 앙가르드(앞발 앞, 뒷발 뒤 90도, 무릎 굽힘, 상체 곧게) + 앞손 가슴~눈 높이 스냅 장전, 뒷손 허리"""
    return P((X+d,61+b),lean,s,0.1,(X+14+d,G-lfl),(X-12+d,G-1-rfl),fh,rh,head=head,tilt=tilt,**k)
def KGF(df,dr,lfl=0,rfl=0,fh=LOAD):
    """펜싱 걸음: 앞발 df·뒷발 dr만큼 옮김, 골반은 가운데"""
    return P((X+(df+dr)/2,61),3,0.1,0.1,(X+14+df,G-lfl),(X-12+dr,G-1-rfl),fh,'hip')

# ════════ 전투·기본 ════════
# 1 기본 대기: 두 손 주머니, 무게를 발 사이로 옮기며 고개로 주변을 훑음(위키 "늘 주변을 훑으며")
IDL=lambda dx,head,tilt,heel=0: P((X+dx,55+abs(dx)/3),2,0,0,(X+6,G),(X-4,G-heel),PF,PR,head=head,tilt=tilt,**PKE)
clip('idle','standing relaxed with both hands in trouser pockets, hips swaying from foot to foot, head scanning left and right, easy smile',
     [IDL(-2,(4,-8),-7),IDL(0,(5,-7),0,2),IDL(3,(6,-6),6),IDL(0,(5,-7),0,2)])
# 1+ 손가락 풀기: 깍지 껴 앞으로 쭉 → 풀고 앞손 들어 시험 스냅
FW=lambda r: ST(0,lh=('r',20+2*r,8),rh=('r',19+2*r,9),le=('e',10+r,10),re=('e',9+r,11),tilt=4)
clip('fingerwarm','interlaces his fingers and stretches both arms straight forward, then raises one hand and snaps his fingers once',
     [ST(0),FW(0),FW(1),ST(0,lh=LOAD,le=ELB_DOWN),ST(0,lh=FIRE,le=ELB_DOWN,tilt=-3)])
# 2 전투 대기: 발끝 바운스(위키 "몸놀림은 가볍고 빠르다")
clip('guard','light fencing-like side stance, bouncing on the balls of his feet, lead hand raised ready to snap, rear hand at the hip',
     [KG(0,0),KG(0,1.5,rfl=1),KG(0,2.5,rfl=2,lfl=1),KG(0,1.5,rfl=1)])
# 2+ 전투 진입: 주머니에서 손 빼며 어깨 한 번 털고 앞손 올림
clip('engage','pulls his hands out of his pockets, rolls his shoulders once and raises the lead hand ready to snap',
     [ST(0),jit(lerp(ST(0),KG(),.35),0,-2,['SHOULDER']),lerp(ST(0),KG(),.7),KG()])
# 3 걷기: 가볍고 빠른 걸음(보폭 크고 위아래 튐), 뒷손은 주머니, 앞손만 흔듦, 고개 좌우 훑기
def walkk(t,lh=None,rh=PR,stride=14,lean=-1,**k):
    c,s=C(t),S_(t)
    lh=lh if lh is not None else (3-8*c,27)
    kk=dict(re=PKE['re']) if rh==PR else {}
    kk.update(k)
    return P((X+2,55+1.8*abs(c)),lean,0,0,(X+2+stride*c,G-5*max(0,-s)),(X+2-stride*c,G-5*max(0,s)),lh,rh,
             tilt=-7*s,head=(5+s,-7),**kk)
clip('walk','brisk light walk with a bounce, rear hand in the pocket, front arm swinging, head turning to scan around',[walkk(i/8) for i in range(8)])
# 3b 펜싱 전진(앞발 먼저) / 후퇴(뒷발 먼저) — 근거: 펜싱 풋워크(동작설계 5장 2)
clip('advance','fencing advance: front foot steps forward first, rear foot follows the same distance, lead hand stays raised',
     [KGF(4,0,3),KGF(10,0,2),KGF(12,0,0),KGF(12,4,0,3),KGF(12,10,0,2),KGF(12,12)])
clip('retreat','fencing retreat: rear foot steps back first, front foot follows the same distance, lead hand stays raised',
     [KGF(0,-4,0,3),KGF(0,-10,0,2),KGF(0,-12),KGF(-4,-12,3,0),KGF(-10,-12,2,0),KGF(-12,-12)])
# 4 달리기: 가볍고 긴 보폭, 상체 덜 숙임, 앞손은 반쯤 앞(언제든 튕김), 뒷손만 크게 흔듦
def runk(t,lh=None,rh=None):
    c,s=C(t),S_(t)
    lh=lh if lh is not None else (13+2*c,6)
    rh=rh if rh is not None else (1+15*c,13-5*c)
    return P((X+8,57+3*abs(s)),9,0,0,(X+6+21*c,G-13*max(0,-s)-1),(X+6-21*c,G-13*max(0,s)-1),lh,rh,le=('e',9,9))
clip('run','light fast run with long bounding strides, torso only slightly forward, lead hand held half forward, rear arm pumping',[runk(i/8) for i in range(8)])
# 5 점프: 높고 가벼움. 무릎을 가슴까지 접음, 뒷팔은 위로 균형
AIR=lambda tuck,b=0,fh=(14,-2): P((X,56+b),4,0,0,(X+10,G-2-tuck),(X-4,G-4-tuck*1.2),fh,(-8,-6),lk=KNEE_FWD,rk=KNEE_FWD,re=ELB_UP)
clip('jump','high light jump: quick dip, springs up, tucks both knees to the chest, rear arm up for balance, lands softly on the toes',
     [KG(0,4),P((X+1,52),2,0,0,(X+9,G-3),(X-7,G-6),(14,-6),(-8,-10),re=ELB_UP),AIR(14),AIR(22),AIR(16),AIR(5,-1),KG(0,5,rfl=2),KG(0,1)])
# 6 앉기: 발끝으로 깊이 쪼그려 앉기, 앞손 앞으로
CK=lambda d=0,b=0,fh=(18,8),rh=('r',8,22),lean=14,**k: P((X+d,80+b),lean,0,0,(X+12+d,G),(X-6+d,G-2),fh,rh,lk=KNEE_FWD,rk=KNEE_FWD,re=('e',3,15),**k)
clip('crouch','drops into a deep squat on the balls of his feet, lead hand forward ready',[KG(),lerp(KG(),CK(),.4),lerp(KG(),CK(),.8),CK()])
# 7 앉아 이동: 낮게 빠른 종종걸음, 뒷손이 바닥 가까이
def ckw(t):
    c,s=C(t),S_(t)
    return P((X+2,80+abs(c)),18,0,0,(X+12+6*c,G-3*max(0,-s)),(X-6-6*c,G-2-3*max(0,s)),(18,8),('r',10,26),lk=KNEE_FWD,rk=KNEE_FWD,re=('e',4,15))
clip('crouchwalk','scuttling forward low in a squat with quick short steps, rear hand low near the floor',[ckw(i/8) for i in range(8)])
# 8 하단: 앉은 채 손끝으로 바닥을 앞으로 쓸고 끝에서 튕김(불길은 코드)
LF=lambda t: P((X+5*t,84),36+6*t,0,0,(X+12,G),(X-6,G-2),('a',X+14+24*t,94-2*t),('r',6,20),lk=KNEE_FWD,rk=KNEE_FWD,re=('e',3,15),tilt=-20)
clip('lowflame','from a squat, sweeps the lead fingertips low along the floor forward and flicks them at the end',
     [CK(),LF(0),LF(.5),LF(1),sh(LF(1),0,-3),lerp(LF(1),CK(),.6)])
# 8+ 화염벽(앉아 D): 두 손을 바닥 앞에서 커튼 올리듯 들며 일어섬, 끝에서 양손 스냅
FWa=P((X+2,82),34,0,0,(X+12,G),(X-6,G-2),('a',X+24,94),('a',X+20,95),lk=KNEE_FWD,rk=KNEE_FWD,le=('e',12,14),re=('e',10,15))
FWb=P((X+2,70),16,0,0,(X+12,G),(X-8,G-1),('r',18,10),('r',16,12),le=('e',9,13),re=('e',8,14))
FWc=P((X+2,58),2,0,0,(X+12,G),(X-8,G-1),('r',18,-8),('r',15,-6),le=('e',12,4),re=('e',10,5),tilt=-6)
FWd=P((X+2,57),-2,0,0,(X+12,G),(X-8,G-1),('r',17,-16),('r',14,-14),le=('e',12,-2),re=('e',10,-1),tilt=-10)
clip('firewall','from a squat, raises both hands from the floor upward like lifting a curtain while standing up, both hands snap high at the end',
     [CK(),FWa,FWb,FWc,FWd,KG()])
# 9 1타 앞손 스냅: 손목만 튕김, 뒷발부터 반걸음 후퇴(6), 머리 갸웃
clip('snap1','lead-hand wrist snap of the fingers toward a point ahead while stepping half a step back, head tilts, hair flicks',
     [KG(0,0,(14,0)),KGF(0,-4,0,2),P((X-3,61),0,0.1,0.1,(X+14,G),(X-18,G-1),FIRE,'hip',tilt=-4),
      P((X-5,61),0,0.1,0.1,(X+10,G-2),(X-18,G-1),FIRE,'hip',tilt=-4),KG(-6)])
# 10 2타 뒷손 스냅: 뒷손이 귀 옆에서 앞으로 휙, 몸이 따라 돌며 한 걸음 후퇴(12)
S2a=P((X-2,61),2,0.2,0.2,(X+14,G),(X-18,G-1),(8,10),('r',-1,-6),le=('e',8,16),re=('e',-6,2))
S2b=P((X-6,62),6,0.25,0.25,(X+12,G),(X-24,G-1),(6,12),('r',20,-1),le=('e',4,16),re=('e',10,2),tilt=-3)
S2c=P((X-9,62),4,0.2,0.2,(X+4,G-2),(X-24,G-1),(8,10),('r',22,1),le=('e',4,16),re=('e',11,3),tilt=-4)
clip('snap2','rear hand whips forward from beside the ear and snaps, body turns with it while stepping a full step back',
     [KG(),S2a,staged(S2a,S2b,.5),S2b,S2c,KG(-12)])
# 11 3타 교차 스냅: 두 팔 가슴 앞 X자 → 양옆으로 펼치며 양손 동시 스냅, 뒷발 미끄러지며 크게 후퇴(20), 상체 뒤로
S3a=P((X-4,63),4,0,0,(X+14,G),(X-22,G-1),('r',11,8),('r',12,6),le=('e',4,13),re=('e',5,12),tilt=6)
S3b=P((X-10,62),-6,0,0,(X+10,G-1),(X-30,G-1),('r',24,-6),('r',-13,6),le=('e',13,1),re=('e',-7,10),tilt=-8)
S3c=P((X-14,62),-9,0,0,(X+2,G),(X-32,G-1),('r',24,-4),('r',-14,8),le=('e',13,2),re=('e',-7,11),tilt=-10)
clip('snap3','crosses both arms in an X before the chest, then flings them apart snapping both hands at once, rear foot slides far back, upper body leans back',
     [KG(),S3a,staged(S3a,S3b,.5),S3b,S3c,lerp(S3c,KG(-20),.5),KG(-20)])
# 12 달리며 A: 미끄러져 서며 앞손을 바닥 앞쪽으로 휙 쓸어 튕김(몸은 안 들어감)
SKa=P((X+10,66),-8,0,0,(X+32,G),(X-4,G-1),(-2,16),(-10,8),lk=KNEE_FWD,le=('e',2,16))
SKb=P((X+16,70),-10,0,0,(X+38,G),(X+2,G-1),(16,18),(-12,6),le=('e',8,15))
SKc=P((X+18,70),-6,0,0,(X+38,G),(X+4,G-1),(24,10),(-12,6),le=('e',12,12),tilt=-4)
clip('skid','sliding to a stop out of a run, leaning back, sweeps the lead hand low forward and snaps',[runk(.25),SKa,SKb,SKc,sh(SKc,0,-1),KG(20)])
# 13 공중: 앞 아래로 내리꽂아 스냅 → 반동으로 몸이 뒤로 젖혀짐
ASa=AIR(14,0,(8,-14)); ASb=P((X+2,56),10,0,0,(X+12,G-14),(X-2,G-18),(20,24),(-8,-6),re=ELB_UP,le=('e',12,12))
ASc=P((X-2,54),-14,0,0,(X+12,G-12),(X+2,G-16),(18,26),(-10,-4),re=ELB_UP,le=('e',10,14),tilt=-8)
clip('airsnap','in mid-air, thrusts the lead hand down at a point below ahead and snaps, recoil throws his body back',[AIR(14),ASa,ASb,ASc,sh(ASc,-2,-1),AIR(8)])
# 14 조준(수납 = 역재생): 앞팔을 곧게 뻗어 검지로 겨눔, 뒷손이 앞 손목을 받침, 고개 숙여 팔 따라 봄
AIM=P((X,61),4,0.1,0.1,(X+14,G),(X-12,G-1),(28,-2),('r',14,3),re=('e',6,10),tilt=6)
clip('aim','extends the lead arm straight forward and points along the index finger, rear hand supports the wrist, sighting along the arm',
     [KG(),lerp(KG(),AIM,.4),lerp(KG(),AIM,.8),AIM,jit(AIM,0,.5,['NECK','SHOULDER'])])
# 15 원거리 스냅: 뻗은 팔 끝 손목만 튕김, 앞머리 튐
AIMF=jit(AIM,1,-2,['RIGHT ARM'])
clip('fire','from the pointing pose, snaps the fingers at the end of the outstretched arm, only the wrist flicks, hair bounces',
     [AIM,AIMF,jit(AIMF,0,0,['NOSE']),AIM])
# 40 손가락 식히기(과열): 손끝을 입에 대고 후 → 손을 아래로 세게 턴다
COb=P((X,58),6,0,0,(X+8,G),(X-6,G),('r',7,-1),'hip',le=('e',11,8),tilt=-4)
COs=lambda a: P((X,59),10,0,0,(X+8,G),(X-6,G),('r',14+3*a,20-4*a),'hip',le=('e',8,12),tilt=8)
clip('cool','overheated fingers: blows on his fingertips, then shakes the hand hard downward to cool it, wincing grin',
     [KG(),COb,jit(COb,0,0,['NOSE']),COs(0),COs(1),COs(0)])
# 16 요격: 고개를 위로 홱, 앞손 위로 튕김 → 곧바로 앞으로 한 번 더(두 번 스냅)
INa=KG(-2,0,(12,-12),tilt=-12,le=('e',10,0)); INb=KG(-3,0,(15,-22),tilt=-16,le=('e',12,-6)); INc=KG(-3,0,(16,-6),tilt=-4)
INd=KG(-3,0,(22,2),lean=6)
clip('intercept','jerks his head up toward a threat and snaps the lead hand upward, then immediately snaps it forward again',[KG(),INa,INb,INc,INd,KG()])
# 17 지속 포격 충전(반복): 두 손 가슴 앞 모음, 손가락 떨림, 발끝 들썩
CHG=lambda j,b: P((X,61+b),4,0,0,(X+14,G),(X-12,G-1-b),('r',11+j,6),('r',12-j,7),le=('e',4,13),re=('e',5,12),tilt=4)
clip('charge','both hands held together before his chest, fingers trembling with built-up heat, bouncing slightly on his toes',[CHG(0,0),CHG(1,1),CHG(0,1.5),CHG(-1,1)])
# 17+ 지속 포격 방출: 두 손 번갈아 앞으로 빠르게 스냅
BRa=P((X,61),6,0,0,(X+14,G),(X-12,G-1),(20,0),('r',12,6),re=('e',5,12)); BRb=P((X,62),6,0,0,(X+14,G),(X-12,G-1),(12,6),('r',20,0),re=('e',9,6))
clip('barrage','rapid alternating finger snaps with both hands thrusting forward in turn, sustained barrage',[BRa,BRb,jit(BRa,0,-1,['NECK','SHOULDER','NOSE']),BRb,BRa,BRb])
# 18 요격 자세(가드): 앞손 손바닥 앞, 뒷손 귀 옆 장전, 무게 뒤
BLK=lambda b: P((X-2,61+b),-3,0,0,(X+14,G),(X-12,G-1),(18,-3),('r',1,-4),re=('e',-5,4),tilt=-2)
clip('block','interception stance: lead palm open forward at face height, rear hand cocked beside the ear, weight back',[BLK(0),BLK(1),BLK(1.5),BLK(1)])
# 20 회피: 두 발 모아 뒤로 홉, 앞손은 발 앞 바닥을 향해 튕김(연막은 코드)
EVa=P((X,66),8,0,0,(X+12,G),(X-10,G-1),(14,10),'hip')
EVb=P((X-12,56),2,0,0,(X-2,G-8),(X-14,G-10),(16,20),(-10,4),lk=KNEE_FWD,le=('e',8,14))
EVc=P((X-22,64),6,0,0,(X-8,G),(X-32,G-1),(18,18),'hip',le=('e',8,14))
clip('evade','hops backward with both feet together while flicking a snap down at the floor where he stood, lands lightly',[KG(),EVa,EVb,lerp(EVb,EVc,.5),EVc,KG(-24)])
# 21 밀쳐 떼기: 팔꿈치 편 손바닥으로 가슴 밀기, 뒷발 버팀(경찰 거리두기 밀어내기)
SHV=P((X+2,61),8,0,0,(X+14,G),(X-14,G-1),(26,6),'hip',le=('e',13,6))
clip('shove','stiff-arm shove: straight arm pushes the palm into an enemy chest, rear leg braced, keeping distance',[KG(),lerp(KG(),SHV,.5),SHV,jit(SHV,1,0,['RIGHT ARM','RIGHT ELBOW'])])
# 22 딱밤 스냅: 밀친 손을 거둬 얼굴 높이에서 짧게 튕김
FLa=P((X,61),4,0,0,(X+14,G),(X-12,G-1),(13,-2),'hip',tilt=-2); FLb=P((X,61),4,0,0,(X+14,G),(X-12,G-1),(20,-6),'hip',tilt=-4)
clip('flick','pulls the shoving hand back and flicks a snap right in front of the enemy face',[SHV,FLa,FLb,FLa])
# 23 발밑 폭발로 날림: 백스텝하며 앞손을 아래로 내리꽂아 스냅
LAa=P((X-4,61),2,0,0,(X+12,G),(X-20,G-1),(12,-10),'hip',le=('e',10,-2)); LAb=P((X-10,63),10,0,0,(X+8,G),(X-24,G-1),(22,20),'hip',le=('e',11,12))
clip('launch','steps back, raises the lead hand and drives it down to snap at the ground under the enemy',
     [SHV,lerp(SHV,LAa,.5),LAa,staged(LAa,LAb,.5),LAb,sh(LAb,-1,0),lerp(LAb,KG(-14),.5),KG(-14)])
# 24 필살기 지휘: 4/4 지휘 경로 아래(1)→안(2)→밖(3)→위(4), 익투스마다 스냅 → 두 손 올렸다 양손 스냅(근거: 지휘 교본)
CD=lambda fh,rh=('r',6,16),tilt=0,lean=2,re=('e',2,14),le=None: P((X,57),lean,0,0,(X+8,G),(X-8,G),fh,rh,tilt=tilt,re=re,**({'le':le} if le else {}))
clip('super','conducts an orchestra with the lead hand: down, in, out, up, snapping on each beat, then raises both hands and snaps both together, grin widening',
     [CD(('r',14,-16),le=('e',10,-4),tilt=-6),CD(('r',16,12),le=('e',10,6)),CD(('r',8,4),le=('e',8,10)),CD(('r',24,2),le=('e',13,4)),
      CD(('r',14,-18),le=('e',11,-4),tilt=-8),CD(('r',14,-20),('r',10,-18),-10,-4,('e',8,-4),('e',11,-4)),
      CD(('r',22,6),('r',18,8),2,8,('e',8,8),('e',12,6)),CD(('r',23,8),('r',19,10),4,8,('e',8,9),('e',12,7)),KG()])
# 36 숙련 3: 검지로 높이 다른 세 곳 톡톡 → 모은 손을 펴며 스냅
MK=lambda fh,le: KG(0,0,fh,le=le)
clip('mark3','taps three points in the air at different heights with the index finger, then gathers the hand and snaps',
     [KG(),MK((24,-12),('e',12,-4)),MK((26,2),('e',13,2)),MK((22,16),('e',11,10)),MK(('r',10,6),('e',4,12)),MK((22,-2),('e',12,1)),MK((22,-2),('e',12,1)),KG()])
# 37 숙련 6 드럼 솔로: 양손 번갈아 가속 스냅, 발끝으로 박자, 고개 까딱
DR=lambda a,b: P((X,61+b),4,0,0,(X+14,G),(X-12,G-1-b),(18,-2) if a else (12,6),('r',12,6) if a else ('r',18,-2),re=('e',6,10) if a else ('e',9,2),tilt=4 if a else -4)
clip('drum','drum-solo finger snapping: both hands alternate faster and faster, bouncing on his toes to the beat, head bobbing',
     [DR(1,0),DR(0,2),DR(1,0),DR(0,2),DR(1,1),DR(0,2.5),DR(1,1),DR(0,2.5)])
# 25 줍기: 허리만 빠르게 숙여 한 손으로 낚아챔, 고개는 앞
PKa=P((X-4,66),50,0,0,(X+8,G),(X-6,G),('a',X+20,90),PR,tilt=-30,re=PKE['re'])
PKb=P((X-4,70),60,0,0,(X+8,G),(X-6,G),('a',X+24,96),PR,tilt=-36,re=PKE['re'])
clip('pickup','bends quickly at the waist and snatches something off the floor with one hand, eyes still forward, straightens up',
     [ST(0),PKa,PKb,PKb,PKa,ST(0,lh=(10,14),le=('e',5,14))])
# 26 물건 던지기: 언더핸드로 높이 띄움 → 같은 손으로 스냅
TSa=P((X-2,60),0,0,0,(X+12,G),(X-10,G-1),(-10,26),'hip'); TSb=P((X+3,58),6,0,0,(X+16,G),(X-8,G-1),(20,-6),'hip',le=('e',12,4))
TSc=P((X+3,58),2,0,0,(X+16,G),(X-8,G-1),(16,-14),'hip',le=('e',11,-2),tilt=-10)
clip('toss','underhand lob tossing something high forward with a step, then snaps the same hand at it in the air',[KG(),TSa,staged(TSa,TSb,.5),TSb,TSc,KG()])
# 27 마시기: 컵 손 아래를 다른 손으로 튕겨 데움 → 후후 불고 한 모금
DKa=ST(0,lh=('r',10,8),rh=('r',8,14),le=('e',4,14),re=('e',2,15),tilt=10)
DKb=ST(0,lh=('r',7,-1),rh=PR,le=('e',7,10),tilt=2); DKc=ST(0,lh=('r',6,-2),rh=PR,le=('e',7,9),tilt=-16)
clip('drink','holds a cup at his chest, snaps his other hand under it to heat it, blows on it and takes a sip',
     [ST(0,lh=('r',10,8),le=('e',4,14)),DKa,jit(DKa,0,-1,['LEFT ARM']),DKb,DKc,DKc,ST(0,lh=('r',10,8),le=('e',4,14))])
# 28 먹기: 한 손으로 먹으며 다른 손으로 손짓(말하며 먹음)
ETa=ST(0,lh=('r',7,-1),rh=('r',16,6),le=('e',7,10),re=('e',8,10),tilt=2); ETb=ST(0,lh=('r',10,10),rh=('r',18,0),le=('e',4,14),re=('e',9,6),tilt=-2)
clip('eat','eats with one hand while gesturing with the other, talking with his mouth half full, cheerful',[ST(0),ETa,ETb,ETa,ETb,ST(0)])
# 29 자기 치료: 앞팔을 앞으로, 뒷손 손끝을 대고 튕겨 지짐 → 움찔 → 다시 미소
BDa=ST(0,lh=('r',16,10),rh=('r',14,10),le=('e',8,13),re=('e',6,12),tilt=10)
BDb=ST(0,lh=('r',15,11),rh=('r',13,8),le=('e',8,13),re=('e',6,11),tilt=-6,lean=-4)
clip('bandage','holds the injured forearm forward, touches the wound with a fingertip and snaps to cauterize it, flinches, then grins again',
     [ST(0),BDa,jit(BDa,0,-1,['LEFT ARM']),BDb,BDa,ST(0)])
# 30 약 피격: 가볍게 튕겨 밀리며 한 발 뒤, 미소 유지
HT=P((X-5,60),-8,0,0,(X+12,G),(X-16,G-1),(12,2),(-2,14),tilt=-6)
clip('hit','light hit: bounced back a step, head knocked back, still smiling',[KG(),HT,lerp(HT,KG(-6),.5),KG(-6)])
# 31 강 피격·다운: 가벼운 몸이 날아가 등으로 떨어지며 두 팔로 바닥 침(뒤낙법), 한 번 튐
DNa=P((X-8,56),-24,0,0,(X+8,G-6),(X-4,G-10),(14,-4),(6,-8),tilt=-12,le=ELB_UP,re=ELB_UP)
DNb=P((X-16,66),-58,0,0,(X+10,G-24),(X+2,G-30),(12,-20),(4,-18),tilt=16,lk=KNEE_UP,rk=KNEE_UP)
DNc=P((X-16,92),-86,0,0,(X+16,G-14),(X+10,G-10),('a',X-26,G+2),('a',X-34,G+2),tilt=30,lk=KNEE_UP,rk=KNEE_UP)
DNd=P((X-16,88),-82,0,0,(X+18,G-10),(X+12,G-8),('a',X-24,G-2),('a',X-32,G-2),tilt=28,lk=KNEE_UP,rk=KNEE_UP)
DNe=P((X-16,94),-88,0,0,(X+20,G),(X+14,G),('a',X-24,G+2),('a',X-32,G+2),tilt=32,lk=KNEE_UP,rk=KNEE_UP)
clip('down','heavy hit: his light body is thrown back through the air, lands on his back slapping the floor with both arms, bounces once',
     [KG(),DNa,DNb,DNc,DNd,DNe,DNe])
# 32 기상: 무릎을 가슴으로 당겨 뒤로 구르듯 → 한쪽 무릎 → 일어서며 손가락 튕겨 먼지 털기
GUa=P((X-18,94),-70,0,0,(X-30,G-36),(X-34,G-30),('a',X-30,G),('a',X-36,G),tilt=34,lk=KNEE_UP,rk=KNEE_UP)
GUb=P((X-30,86),-10,0,0,(X-18,G),(X-40,G-1),(14,12),('a',X-44,G-1),lk=KNEE_FWD,rk=KNEE_UP)
GUc=P((X-34,74),8,0,0,(X-22,G),(X-46,G-2),(14,8),'hip')
GUd=P((X-34,58),2,0,0,(X-26,G),(X-42,G),('r',9,16),('r',6,20),le=('e',3,14),re=('e',2,15),tilt=10)
clip('getup','rolls backward over his shoulder to put distance, comes up on one knee, stands and snaps the dust off his jacket',
     [DNe,GUa,GUb,GUc,GUd,jit(GUd,1,-2,['RIGHT ARM']),sh(KG(),-34,0)])
# 33 말하기: 손짓 많음, 입 계속(입은 생성 설명)
TK=lambda fh,le,tilt: ST(0,lh=fh,le=le,tilt=tilt)
clip('talk','talking cheerfully nonstop, lead hand gesturing a lot, rear hand in the pocket, mouth moving',
     [TK((14,6),('e',8,12),0),TK((18,-2),('e',11,6),-3),TK((12,10),('e',6,14),2),TK((20,2),('e',12,8),-2)])
# 41 피로 대기: 두 손 무릎 짚고 헐떡이며 고개 들어 웃음
TI=lambda b: P((X-2,62+b),40,0,0,(X+10,G),(X-8,G),('a',X+12,80),('a',X+8,82),tilt=-26,le=('e',8,12),re=('e',6,13))
clip('tired','out of breath with both hands on his knees, panting, but lifts his head and grins',[TI(0),TI(1.5),TI(2.5),TI(1.5)])
# 35 지원 등장: 옆에서 내려서듯 착지 → 뒤·앞·위 세 번 스냅 → 두 손가락 경례
SUa=P((X-20,52),4,0,0,(X-12,G-14),(X-26,G-10),(12,-6),(-8,-4),lk=KNEE_FWD,re=ELB_UP)
SUb=P((X-10,70),12,0,0,(X+2,G),(X-22,G-1),(14,6),('r',-4,20))
SAL=lambda a: ST(0,lh=('r',6+8*a,-11-a),le=('e',13,0),rh=PR)
clip('support','hops down as if off a motorbike, snaps behind, ahead and above in quick turns, then gives a two-finger salute',
     [SUa,SUb,KG(-6),KG(-6,0,LOAD,('r',-18,2),re=('e',-9,8)),KG(-6,0,(22,0)),KG(-6,0,(14,-18),le=('e',12,-4),tilt=-10),ST(0),SAL(0),SAL(1),ST(0)])
# 38 둔기: 어깨 위 둔기를 손목으로 휙 던짐 → 바로 스냅(던진 둔기는 엔진이 손 좌표에서 날림, 그림은 빈 손)
PPa=ST(0,lh=('r',3,-1),le=('e',9,10)); PPb=P((X-2,56),-4,0,0,(X+6,G),(X-6,G),('r',-2,-5),PR,le=('e',8,4),re=PKE['re'])
PPc=P((X+3,56),8,0,0,(X+12,G),(X-6,G),(20,-10),PR,le=('e',12,-2),re=PKE['re']); PPd=P((X+3,56),4,0,0,(X+12,G),(X-6,G),(18,-14),PR,le=('e',12,-4),re=PKE['re'],tilt=-10)
clip('pipe','flicks something resting on his shoulder forward with one hand like a throw, then snaps at it, empty hand',[PPa,PPb,PPc,PPd,jit(PPd,1,-1,['RIGHT ARM']),ST(0)])
PIPE='a long steel pipe resting on his shoulder held by one hand'
clip('idle_pipe','standing relaxed with a steel pipe resting on his shoulder in one hand, other hand in the pocket',[ST(b,lh=('r',3,-1),le=('e',9,10)) for b in (0,.5,1,.5)],PIPE)
clip('walk_pipe','walking lightly with a steel pipe resting on his shoulder, other hand in the pocket',[walkk(i/8,lh=('r',3,-1),le=('e',9,10)) for i in range(8)],PIPE)
# 39 서툰 산탄총: 허리 높이 한 손 사격, 반동에 팔이 튀고 얼굴 찡그림, 반 발 휘청
SGa=ST(0,lh=('r',14,24),le=('e',4,16),lf=10,rf=-8); SGb=P((X-3,55),-8,0,0,(X+10,G),(X-10,G),('r',16,10),PR,le=('e',8,12),re=PKE['re'],tilt=-8)
clip('shotgun','fires a shotgun awkwardly one-handed from the hip, recoil jerks the arm up, winces and stumbles half a step',
     [SGa,SGb,lerp(SGb,SGa,.5),SGa,SGa],'an awkwardly held black pump shotgun in one hand at hip height')
SGH='a black pump shotgun dangling awkwardly in one hand at his side, held away from his body'
clip('idle_shotgun','standing with a shotgun dangling awkwardly in one hand away from his body, other hand in the pocket',[ST(b,lh=(6,28)) for b in (0,.5,1,.5)],SGH)
clip('walk_shotgun','walking holding a shotgun dangling awkwardly at his side in one hand',[walkk(i/8,lh=(6,28)) for i in range(8)],SGH)
clip('run_shotgun','running holding a shotgun at his side in one hand',[runk(i/8,lh=(8,24)) for i in range(8)],SGH)
# 34a 영입 멘트: 상대를 가리킴 → 팔 활짝 → 엄지로 자기 가슴
RCa=ST(0,lh=(24,-2),le=('e',12,2),tilt=-2); RCb=ST(0,lh=(22,-6),rh=('r',-14,-2),le=('e',12,0),re=('e',-8,6),lean=-4,tilt=-6)
RCc=ST(0,lh=('r',5,10),le=('e',8,14),tilt=4)
clip('recruit','recruiting pitch: points at the listener, throws his arms wide open, then jabs a thumb at his own chest, big grin',[ST(0),RCa,RCb,RCb,RCc,ST(0)])
# 두 손가락 경례
clip('salute','casual two-finger salute: index and middle finger touch his brow and flick forward, grin',[ST(0),SAL(0),SAL(0),SAL(1),ST(0)])

# ════════ 생활·지형·감정 (쟈알디 재설계 기본 클립과 같은 장면, 큐라스 방식) ════════
XA=dict(lh=('r',8,12),rh=('r',9,10),le=('e',6,17),re=('e',8,15))
def SITK(lean=2,tilt=0,b=0,lf=(X+16,G),rf=(X+12,G),**k):
    k.setdefault('lh',('r',14,20)); k.setdefault('rh',('r',12,22)); k.setdefault('le',('e',5,16)); k.setdefault('re',('e',3,16))
    return P((X-6,77+b),lean,0,0,lf,rf,tilt=tilt,lk=KNEE_UP,rk=KNEE_UP,**k)
LIE=lambda b=0,**k: P((X-6,94),-90,0,0,(X+34,G-2),(X+30,G),**{'lh':(10,6+b),'rh':(4,10),'re':ELB_UP,**k})
# 계단·턱 오르기: 두 칸씩 성큼, 몸이 튀어 오름
def stepk(t):
    ph=t; up=(16*ph,-16*ph)
    a=(X+10,G-16); b0=(X-6,G); hip=(X+4+16*ph,G-46-16*ph+3*math.sin(math.pi*ph))
    sw=(b0[0]+(X+26-b0[0])*ph,b0[1]+((G-32)-b0[1])*ph-8*math.sin(math.pi*ph))
    p=P(hip,10,0,0,a,sw,(4-6*C(ph),26),PR,lk=KNEE_UP,rk=KNEE_UP,re=PKE['re'])
    return sh(p,-up[0],-up[1])
clip('stepup','bounding up steps two at a time, light springy knees, rear hand in the pocket',[stepk(i/7) for i in range(7)])
SOa=P((X+4,58),8,0,0,(X+12,G),(X-4,G),(10,16),PR,re=PKE['re']); SOb=P((X+10,52),4,0,0,(X+12,G),(X+30,G-26),(14,6),(-8,8),rk=KNEE_UP)
SOc=P((X+24,58),2,0,0,(X+40,G),(X+16,G-20),(12,10),(-6,10),rk=KNEE_UP)
clip('stepover','swings one leg high over a waist-high edge in one big step, then the other, arms out for balance',[ST(0),SOa,SOb,lerp(SOb,SOc,.5),SOc,P((X+30,56),2,0,0,(X+38,G),(X+24,G),(8,22),(4,24))])
# 눕기 → 반동으로 휙 일어나 앉음
LSa=P((X-6,88),-50,0,0,(X+34,G-2),(X+30,G),(16,8),(10,12),tilt=10); LSb=P((X-4,86),4,0,0,(X+34,G-2),(X+30,G),('r',14,18),('r',12,20),le=('e',5,15),re=('e',3,16))
clip('liesit','lying on his back, swings his arms and pops up to sitting in one quick motion',[LIE(),LSa,lerp(LSa,LSb,.5),LSb,LSb])
# 서서 손 작업: 손이 빠르고 손가락을 많이 씀, 고개는 옆(수다)
HW=lambda a: ST(0,lh=('r',20,14+5*a),rh=('r',15,19-5*a),le=('e',8,12),re=('e',5,15),lean=6,tilt=-6,head=(4,-8))
clip('handswork','quick busy hands working at waist height in front of him, fingers moving fast, glancing aside while chatting',[HW(0),HW(1),HW(0),HW(1)])
HH=lambda a: ST(0,lh=('r',4-6*a,-14),rh=('r',2-6*a,-12),le=('e',11,-2),re=('e',9,-1),tilt=4)
clip('handshead','combs both hands back through his short hair with spread fingers, elbows forward',[ST(0),HH(0),HH(.5),HH(1),HH(.5),ST(0)])
SM=lambda a: SITK(8,4,lh=('r',7,-1) if a else ('r',18,4),rh=('r',16,14),le=('e',7,10) if a else ('e',10,8),re=('e',6,14))
clip('seatmouth','seated, eats with one hand and leans forward gesturing while talking',[SM(1),SM(0),SM(1),SM(0)])
SH=lambda b: SITK(-8,6,b=b,lh=('r',13,0),rh=('r',11,2+b),le=('e',9,10),re=('e',8,11),lf=(X+20,G-6),rf=(X+12,G-2*b))
clip('seathold','seated leaning back with legs crossed, holds something up near his face in both hands, thumbs flicking, foot jiggling',[SH(0),SH(1),SH(0),SH(1)])
HL=lambda a: ST(0,lh=('r',18,-2),rh=('r',6,-6+a),le=('e',12,4),re=('e',10,6),tilt=-4,lean=-3)
clip('holdlook','holds something up at arm length to read it, tapping his chin with a finger of the other hand',[HL(0),HL(2),HL(0),HL(2)])
HE=lambda a: ST(0,lh=('r',-1,-8),rh=('r',16+2*a,4-6*a),le=('e',11,5),re=('e',8,8),tilt=-3*a)
clip('handear','holding something to his ear with one hand, the other hand gesturing big while talking, body swaying',[HE(0),HE(1),HE(0),HE(1)])
SW=lambda a: P((X,58),12,0,0,(X+10,G),(X-8,G),('r',18+8*a,22),('r',10+8*a,18),le=('e',6,14),re=('e',4,14),tilt=8)
clip('sweep','sweeping the floor with a quick rhythmic back and forth, empty hands closed as if on a handle',[SW(0),SW(.5),SW(1),SW(.5),SW(0),SW(.5)])
LHk=lambda a: P((X-6,94),-90,0,0,(X+34,G-2),(X+20,G-8),(16+a,-6),(4,10),re=ELB_UP,le=('e',8,0),rk=KNEE_UP)
clip('liehold','lying on his back with legs crossed, holding something up above his face with one hand',[LHk(0),LHk(1),LHk(0),LHk(1)])
# 두 손 들고(큰 물건): 한쪽 엉덩이에 걸쳐 들고 가볍게 / 한 손 들고(작은 물건): 손을 흔들며 경쾌하게
C2=dict(lh=('r',10,28),rh=('r',6,30),le=('e',6,16),re=('e',3,17))      # 큰 물건을 엉덩이에 걸침
C1=dict(lh=('r',9,-3),le=('e',11,7))                                       # 작은 물건을 어깨 높이로 들어 올림(웨이터처럼 경쾌하게)
for tag,k,txt in (('carry2',C2,'both hands low at the front of his hip as if carrying a box propped on the hip, leaning back to balance it'),
                  ('carry1',C1,'near hand raised at shoulder height holding something up like a waiter, other hand in the pocket')):
    rh=k.get('rh',PR); kk={kk:v for kk,v in k.items() if kk not in ('lh','rh')}
    ln=-6 if tag=='carry2' else 2
    clip(f'{tag}_idle',f'side view: standing, {txt}',[ST(b,lh=k['lh'],rh=rh,lean=ln,dx=d,**kk) for b,d in ((0,0),(.5,1),(1,2),(.5,1))])
    clip(f'{tag}_walk',f'side view: walking briskly, {txt}',[walkk(i/8,lh=k['lh'],rh=rh,lean=ln,**kk) for i in range(8)])
    clip(f'{tag}_run',f'side view: running lightly, {txt}',[runk(i/8,lh=k['lh'],rh=rh) for i in range(8)])
# 지형
def TFRk():
    q=R.front(ST(0,lh='down',rh='down')); N=q['NECK']
    q['RIGHT ELBOW']=(N[0]-14,N[1]+19); q['LEFT ELBOW']=(N[0]+14,N[1]+19); q['RIGHT ARM']=(N[0]-8,N[1]+29); q['LEFT ARM']=(N[0]+8,N[1]+29)
    q['LEFT LEG']=(q['LEFT LEG'][0]+2,G-5); q['LEFT KNEE']=(q['LEFT KNEE'][0]+3,q['LEFT KNEE'][1]-3); return q
TMID=jit(lerp(ST(0),TFRk(),.5),0,-3,['LEFT LEG','LEFT KNEE'])
clip('turn','spins around on the ball of one foot with hands in his pockets to face the viewer, one heel kicked up',[ST(0),TMID,TFRk()])
FLk=lambda b=0: P((X,50+b),-2,0,0,(X+10,G-14),(X-6,G-18),[(18,-8),(6,-20),(-6,-12)][int(b)],[(-10,-8),(4,-18),(16,-6)][int(b)],re=ELB_UP,le=ELB_UP,tilt=-6)
clip('fall','falling with arms windmilling for balance, legs apart, surprised grin, hair blown up',[FLk(0),FLk(1),FLk(2)])
LDk=P((X,72),10,0,0,(X+12,G),(X-10,G-2),(16,4),(-8,2))
clip('land','lands lightly on the balls of his feet from a height, knees absorb it, arms out, springs straight up to stand',[FLk(0),LDk,sh(LDk,0,2),lerp(LDk,KG(),.5),KG()])
def ladk(t):
    # 두 손이 같이 한 칸 → 두 발을 같이 당겨 올림(토끼뜀식 빠른 오르기)
    a=(1-C(t))/2; b=(1-C(t-0.25))/2
    return P((X+4,60-6*b),4,0,0,(X+14,94-14*b),(X+10,96-14*b),('a',X+18,22-16*a),('a',X+16,24-16*a),lk=KNEE_UP,rk=KNEE_UP,le=ELB_OUT,re=ELB_OUT)
clip('ladder','fast sporty climbing: both hands reach up together, then both feet pull up together, ladder not drawn',[ladk(i/8) for i in range(8)])
MAk=P((X+2,60),16,0,0,(X+8,G),(X-6,G),('a',X+18,60),PR,re=PKE['re']); MBk=P((X+12,42),20,0,0,(X+22,64),(X+4,74),('a',X+20,60),(-8,4),lk=KNEE_UP,rk=KNEE_UP)
MCk=P((X+20,22),6,0,0,(X+28,60),(X+16,60),(12,14),(-6,10)); MDk=P((X+22,15),2,0,0,(X+28,60),(X+18,60),PF,PR,**PKE)
clip('mantle','plants one hand on a waist-high ledge and swings his body up sideways in one smooth move, stands on top',[ST(0),MAk,MBk,lerp(MBk,MCk,.5),MCk])
VAk=P((X+6,62),20,0,0,(X+16,G),(X-6,G-2),('a',X+26,62),(-6,6)); VBk=P((X+24,44),10,0,0,(X+36,58),(X+30,62),('a',X+26,62),(-10,0),lk=KNEE_UP,rk=KNEE_UP,re=ELB_UP)
VCk=P((X+44,62),8,0,0,(X+52,G-4),(X+40,G-6),(14,4),(-6,8))
clip('vault','speed vault: one hand on the obstacle, swings both legs over to the side, lands running',[walkk(0),VAk,VBk,VCk,P((X+48,57),4,0,0,(X+56,G),(X+42,G),(10,14),(4,18))])
def crawlk(t):
    c,s=C(t),S_(t)
    return P((X-8,82),80,0,0,(X-34+7*c,G),(X-34-7*c,G-1),('a',X+16+7*c,G-3-3*max(0,s)),('a',X+10-7*c,G-3-3*max(0,-s)),head=(6,-5),tilt=-34,le=ELB_DOWN,re=ELB_DOWN)
clip('crawl','crawling fast low on his elbows and knees through a low duct',[crawlk(i/8) for i in range(8)])
def sneakk(t):
    c,s=C(t),S_(t)
    return P((X+2,62+abs(c)),8,0,0,(X+4+10*c,G-3-6*max(0,-s)),(X+4-10*c,G-3-6*max(0,s)),('r',6,-6),('r',-10,14),tilt=2,
             lk=KNEE_UP,rk=KNEE_UP,le=('e',10,6),re=('e',-6,12))
clip('sneak','exaggerated tiptoe sneaking with high careful steps, index finger pressed to his lips, other arm out for balance',[sneakk(i/8) for i in range(8)])
LT=dict(lh=('r',10,-2),le=('e',10,8))   # 손전등을 거꾸로 쥐고 어깨 높이(앞손), 뒷손은 앞 장전
LTX='a small flashlight held reversed at shoulder height, beam pointing ahead'
clip('idle_light','standing ready, flashlight held reversed at shoulder height in the near hand, other hand raised ready to snap',
     [P((X,58+b),3,0,0,(X+10,G),(X-9,G-1),LT['lh'],(16,2),le=LT['le'],re=('e',8,8)) for b in (0,.5,1,.5)],LTX)
clip('walk_light','walking with a flashlight held reversed at shoulder height, other hand raised ready to snap',
     [walkk(i/8,lh=LT['lh'],rh=(16,2),le=LT['le'],re=('e',8,8)) for i in range(8)],LTX)
clip('run_light','running with a flashlight held reversed at shoulder height, other hand forward',[runk(i/8,lh=LT['lh'],rh=(14,4)) for i in range(8)],LTX)
LBk=lambda a: P((X,61),3,0.1,0.1,(X+14,G),(X-12,G-1),LOAD,'hip',head=(5-8*a,-7),tilt=-4*a)
clip('lookback','in a ready stance, snaps his head to glance over his shoulder with the lead hand still raised, then faces forward',[LBk(0),LBk(.6),LBk(1),LBk(1),LBk(.6),LBk(0),LBk(0),LBk(0)])
HDk=lambda b=0: P((X-4,82+b),16,0,0,(X+12,G),(X-14,G-1),('r',6,-3),(14,8),head=(6,-6),lk=KNEE_UP,le=('e',10,6),re=('e',8,10))
clip('hide','crouched hiding with a hand over his mouth, eyes still smiling, other hand raised ready to snap',[KG(),lerp(KG(),HDk(),.5),HDk(0),HDk(1),HDk(0)])
DRk=lambda r: P((X+3*r,57),6+8*r,0,0,(X+8+4*r,G),(X-4,G),('a',X+26,50) if r<.5 else ('r',6,10),PR,le=('e',12,6) if r<.5 else ('e',4,12),re=PKE['re'],tilt=-4)
clip('door','snaps his fingers at the latch instead of turning a handle, then shoulders forward through, door not drawn',[ST(0),DRk(0),jit(DRk(0),1,-1,['RIGHT ARM']),DRk(1),walkk(.25),walkk(.5)])
DCk=lambda t,r: P((X+2,57),8,0,0,(X+2+13*C(t),G-5*max(0,-S_(t))),(X+2-13*C(t),G-5*max(0,S_(t))),(4,22),('a',X-26+8*r,54),re=('e',-12,12),head=(4,-7))
clip('doorclose','running forward while flinging the rear arm back to slam something shut behind him',[runk(0),DCk(.125,0),DCk(.25,1),DCk(.375,1),runk(.5),runk(.625)])
KNk=lambda r: ST(0,lh=('a',X+20+3*r,56),le=('e',10,12),lean=12,tilt=6,head=(6,-6),lf=8)
clip('knock','leans in with his ear toward a door, knocking with the back of his knuckles at chest height in a quick drum rhythm',[ST(0),KNk(0),KNk(1),KNk(0),KNk(1),ST(0)])
def pushk(t):
    c,s=C(t),S_(t)
    return P((X+6,62),-20,0,0,(X-6+8*c,G-3*max(0,-s)),(X-6-8*c,G-3*max(0,s)),('a',X+12,64),('a',X+14,58),le=ELB_DOWN,re=ELB_DOWN,head=(3,-8))
clip('push','leans his back against something and pushes it with his legs, struggling, hands braced behind him',[pushk(i/6) for i in range(6)])
ISk=lambda r: P((X-2,82),24,0,0,(X+12,G),(X-8,G-2),('a',X+26+3*r,G-3),('r',8,20),tilt=8-6*r,lk=KNEE_FWD,rk=KNEE_FWD,re=('e',3,15))
clip('inspect','squats on his toes and pokes something on the floor with an index finger, tilting his head curiously',[ST(0),lerp(ST(0),ISk(0),.5),ISk(0),ISk(1),ISk(0),ISk(1)])
def leadk(t):
    c,s=C(t),S_(t)
    return P((X+4,57+1.5*abs(c)),6,0,0,(X+4+12*c,G-5*max(0,-s)),(X+4-12*c,G-5*max(0,s)),(14,4),('r',-24,20),head=(2,-8),re=('e',-10,12),le=('e',8,10))
clip('leadhand','walking forward pulling someone by the hand behind him, looking back and talking, lead hand raised ready to snap',[leadk(i/8) for i in range(8)])
BWk=ST(0,lean=14,tilt=10)
clip('bow','quick casual nod-bow, then a two-finger salute',[ST(0),BWk,ST(0),SAL(0),SAL(1)])
EWk=lambda b: ST(b,tilt=-14,lf=6,rf=-4) if b==0 else ST(0,tilt=-14,rf=-4)
EWk=lambda d,heel: jit(P((X+d,55),2,0,0,(X+6+d,G),(X-4+d,G-heel),PF,PR,tilt=-12,**PKE),2*d,0,['NOSE','EYE','EAR'])
clip('elevwait','waiting in an elevator, rocking heel to toe and swaying his head to a beat, hands in pockets, glancing up',
     [EWk(-1,0),EWk(0,3),EWk(1,0),EWk(0,3)])
FSk=P((X-2,88),4,0,0,(X+16,G-2),(X+12,G),('r',16,24),('r',14,24),lk=KNEE_UP,rk=KNEE_UP,le=('e',5,16),re=('e',3,16))
clip('floorsit','plops down to sit cross-legged on the floor',[ST(0),lerp(ST(0),FSk,.5),sh(FSk,0,-2),FSk,FSk])
FRk=lambda a: P((X-2,88),2,0,0,(X+16,G-2),(X+12,G),('r',14+a,14),('r',13-a,15),lk=KNEE_UP,rk=KNEE_UP,le=('e',5,14),re=('e',3,14))
clip('floorrest','sitting cross-legged on the floor, stretching his fingers one by one',[FRk(0),FRk(1),FRk(0),FRk(1)])
# 상태·결과
HUk=lambda b: P((X,62+b),14,0,0,(X+12,G),(X-10,G-1),(16,2),('r',6,22),re=('e',1,15),tilt=6)
clip('hurtidle','injured: one hand clutching his side, but the lead hand stays raised ready to snap, forced grin',[HUk(0),HUk(1),HUk(2),HUk(1)])
def limpk(t):
    c,s=C(t),S_(t); dip=5*max(0,-c)
    return P((X+2,60+dip),12,0,0,(X+2+11*c,G-5*max(0,-s)),(X+2-7*c,G),(14+4*c,4),('r',6,22),re=('e',1,15),rk=KNEE_UP,tilt=6)
clip('limp','limping walk dragging the rear leg, hand on his side, lead arm out for balance',[limpk(i/8) for i in range(8)])
FRa=lambda b: P((X-4,57+b),-8,0,0,(X+10,G),(X-12,G-1),('r',14,-10),('r',11,-8),le=('e',12,2),re=('e',10,3),tilt=-6)
clip('fear','backing away with both hands raised in front, trying to keep smiling, pale',[FRa(0),FRa(1),sh(FRa(0),-2),sh(FRa(1),-2)])
NAa=P((X-2,58),8,0,0,(X+8,G),(X-6,G),('r',6,-2),PR,le=('e',10,8),re=PKE['re'],tilt=4); NAb=P((X-4,60),30,0,0,(X+8,G),(X-8,G),('r',7,-1),('r',10,22),le=('e',10,6),re=('e',3,15),tilt=20)
clip('nausea','claps a hand over his mouth and doubles over, turning away',[ST(0),NAa,NAb,NAb,NAa])
CLa=P((X,62),6,0,0,(X+10,G),(X-8,G),(12,14),(6,18)); CLb=P((X-2,80),10,0,0,(X-24,G-2),(X-28,G-3),(10,24),(6,24),tilt=14)
CLc=P((X-10,92),70,0,0,(X-46,G-2),(X-48,G),('a',X+18,G-1),('a',X+10,G),head=(7,-5),tilt=-30,le=ELB_UP,re=ELB_UP)
clip('collapse','knees buckle, he falls onto his side and front, his fingers twitch in a last tiny snap and go still',
     [KG(),CLa,lerp(CLa,CLb,.5),CLb,lerp(CLb,CLc,.5),CLc,jit(CLc,1,-1,['RIGHT ARM']),CLc])
clip('bedlie','lying sprawled on his back, arms flung wide, asleep with a smile, nothing under him',
     [LIE(0,lh=(14,2),rh=(-14,4),le=ELB_UP),LIE(1,lh=(14,2),rh=(-14,4),le=ELB_UP),LIE(1,lh=(14,3),rh=(-14,4),le=ELB_UP),LIE(0,lh=(14,2),rh=(-14,4),le=ELB_UP)])
clip('victory','two-finger salute with a big grin, then shoves both hands back in his pockets',[KG(),ST(0,lh='down',rh='down'),SAL(0),SAL(1),SAL(1),ST(0),ST(0,tilt=-4)])
# 본부 업무
CSa=SITK(4,0,lf=(X+18,G),rf=(X-8,G),lh=('r',14,10),rh=('r',13,11),le=('e',5,12),re=('e',4,12))
clip('chairsit','straddles a chair backwards, sitting with forearms folded on the backrest, chair not drawn',[ST(0),lerp(ST(0),CSa,.5),CSa,CSa,jit(CSa,0,1,['NECK','SHOULDER','NOSE','EYE','EAR'])])
TYk=lambda r: SITK(24,2,lh=('r',27,16-r),rh=('r',13,16-4*(1-r)),le=('e',12,14),re=('e',5,15),head=(6,-5))
clip('typing','seated, one hand flying over a keyboard and the other on a mouse, very fast hands like a pro gamer, desk not drawn',[TYk(0),TYk(1),TYk(0),TYk(1)])
GCk=lambda a: ST(0,lh=('r',12,10),rh=('r',13,9+a),le=('e',4,14),re=('e',6,13),tilt=10)
clip('gearcheck','cradles the fingers of one hand in the other, flexing them open and closed as if icing sore fingers',[ST(0),GCk(0),GCk(1),GCk(0),GCk(1)])
TIk=lambda a: ST(0,lh=('r',5,4+4*a),le=('e',10,10),tilt=-4)
clip('tie','loosens and re-tightens his black necktie with one hand while talking',[ST(0),TIk(0),TIk(1),TIk(1),TIk(0),TIk(0),TIk(1),ST(0)])
SRk=lambda b: SITK(-10,-4,b=b,lh=('r',-4,-10),rh=('r',-5,-9),le=('e',8,-6),re=('e',7,-5),lf=(X+20,G-6),rf=(X+12,G))
clip('seatrest','seated leaning back, hands laced behind his head with elbows forward, legs crossed',[SRk(0),SRk(.5),SRk(1),SRk(.5)])
TTk=lambda a: SITK(-6,-6,lh=('r',16,20-2*a),le=('e',5,16))
clip('seatthink','seated, eyes closed, tapping a finger on his knee to a beat while thinking',[TTk(0),TTk(1),TTk(0),TTk(1)])
DZk=lambda t,f: SITK(-4,t,**({'lh':('r',18,16),'le':('e',6,14)} if f else {}))
clip('doze','dozing in a chair: head drops, then he jerks awake with his fingers snapping by reflex',[DZk(0,0),DZk(16,0),DZk(30,0),DZk(-4,1)])
YWk=lambda a: ST(0,lh=('r',14-2*a,-20*a),rh=('r',-10*a,-14*a) if a else PR,le=('e',10,-2*a) if a else PKE['le'],tilt=-14*a,lean=2-6*a)
clip('yawn','a huge yawn with both arms stretched out and up, head tipped back',[ST(0),YWk(.5),YWk(1),YWk(.5)])
STk=lambda d: ST(0,lh=('r',6+4*d,-30),rh=('r',4+4*d,-28),le=('e',8,-12),re=('e',6,-11),lean=-4-4*abs(d),tilt=-10)
clip('stretch','interlaces his fingers and stretches both arms high overhead, leaning side to side',[ST(0),STk(0),STk(.5),STk(1),STk(.5),STk(0),STk(0),ST(0)])
HFk=lambda t: ST(0,lh=[('r',8,-12),('r',3,-14),('r',20,-14)][t],le=[('e',12,-2),('e',11,-4),('e',13,-4)][t],tilt=[-2,-6,-4][t])
clip('hairflip','flicks the loose strand of hair off his forehead with one finger, then flings the hand out with a snap, the strand falls back',[ST(0),HFk(0),HFk(1),HFk(2),HFk(2),ST(0)])
BTk=lambda a: ST(0,lh=('r',7,0+a),rh=('r',16+3*a,6),le=('e',10,8),re=('e',8,10))
clip('brushteeth','brushing his teeth fast while gesturing with the other hand',[BTk(0),BTk(1),BTk(0),BTk(1)])
# 사교
GSk=lambda a: ST(0,lh=('r',18+4*a,2-6*a),rh=('r',14-2*a,10+2*a),le=('e',11,6),re=('e',6,12),lean=4-6*a,tilt=-3*a)
clip('gesture','talking animatedly with both hands, body rocking forward and back',[GSk(0),GSk(1),GSk(.5),GSk(1)])
AXk=lambda a,b: P((X-2,56+b),-4,0,0,(X+12,G),(X+4,G),('r',8,10),('r',9+a,8-a),le=('e',7,15),re=('e',9,13),tilt=6*a,head=(5,-7))
clip('armscross','arms folded, standing with ankles crossed and weight on one leg, leaning back, nodding along',[AXk(0,0),AXk(1,.5),AXk(0,1),AXk(1,.5)])
NDk=lambda t,b: ST(b,lh=('r',14,4),le=('e',8,10),tilt=t)
clip('nod','three quick eager nods bobbing his whole body, thumbs-up held at the chest',[ST(0),NDk(12,1.5),NDk(0,0),NDk(12,1.5),NDk(0,0)])
HSk=lambda d: jit(ST(0,lh=('r',16,2-4*d),le=('e',10,6)),2*d,0,['NOSE','EYE','EAR'])
clip('headshake','laughing and shaking his head with a hand waving no in front of him',[ST(0),HSk(-1),HSk(1),HSk(-1),HSk(1),ST(0)])
WVk=lambda d,b: ST(b,lh=('r',8+8*d,-30),rh=('r',8-8*d,-29),le=('e',9,-12),re=('e',7,-11),tilt=-6,rf=-4)
clip('wave','waves both arms crossing back and forth high over his head, bouncing on his toes',[ST(0),WVk(0,0),WVk(1,-2),WVk(-1,0),WVk(1,-2),WVk(-1,0),WVk(0,-2),ST(0)])
HSh=lambda a: ST(0,lh=('r',22,10+2*a),rh=('r',20,9+2*a),le=('e',10,12),re=('e',9,11),lean=8,tilt=2)
clip('handshake','enthusiastic two-handed handshake, pumping it up and down, leaning in',[ST(0),HSh(0),HSh(1),HSh(0),HSh(1),ST(0)])
PTk=lambda a: ST(0,lh=('r',22,0) if a else ('r',20,-6+2*a),le=('e',12,2),lean=6)
clip('pat','pats a shoulder in front of him, then points at that person with a grin',[ST(0),PTk(0),sh(PTk(0),0,1),ST(0,lh=(24,-2),le=('e',12,2)),ST(0,lh=(24,-2),le=('e',12,2)),ST(0)])
PNk=lambda a: ST(0,lh=(26,-4+a),le=('e',13,0))
clip('point','finger-gun point straight ahead and a little snap of the wrist',[ST(0),PNk(0),PNk(-3),PNk(0)])
def SHRk(a):
    p=ST(0,lh=('r',14+8*a,12-4*a),rh=('r',-2-10*a,14-4*a),le=('e',6,14),re=('e',-4,14),tilt=8*a,lean=-5*a); return jit(p,0,-4*a,['SHOULDER','ELBOW',' ARM'])
clip('shrug','big exaggerated shrug with palms up and a wide grin',[ST(0),SHRk(.5),SHRk(1),SHRk(1),SHRk(.5),ST(0)])
HGk=lambda a: P((X+4*a,56),10*a,0,0,(X+8+4*a,G),(X-2,G),('r',20,6+3*a),('r',18,4),le=('e',12,4),re=('e',11,3))
clip('hug','steps in and hugs someone, patting their back',[ST(0),HGk(.5),HGk(1),HGk(0.6),HGk(1)])
# 감정
LGk=lambda a: ST(0,lh=('r',18,24-4*a),rh=PR,le=('e',6,16),lean=-6*a,tilt=-16*a)
clip('laugh','throws his head back laughing loudly and slaps his knee',[ST(0),LGk(1),LGk(.4),LGk(1),LGk(.4),ST(0)])
GLk=lambda a: ST(0,lh=(22,-4-2*a),rh=('r',18,0-2*a),le=('e',12,0),re=('e',10,4),tilt=-4)
clip('glad','double finger-guns pointing forward with a snap and a grin',[ST(0),GLk(0),GLk(1),GLk(0)])
CRk=lambda a: ST(0,lh=('r',6,-6+a),le=('e',12,4),tilt=10)
clip('cry','wipes his eyes with his sleeve while still trying to smile',[ST(0),CRk(0),CRk(2),CRk(0),CRk(2)])
WCk=lambda b: P((X+4,58+b),18,0,0,(X+10,G),(X-6,G),('r',10,-4),('r',8,20),le=('e',12,4),re=('e',3,15),tilt=20)
clip('wallcry','forehead against a wall, shoulders shaking as he cries, wall not drawn',[WCk(0),WCk(1),WCk(0),WCk(1)])
KCk=lambda a: P((X,80),8,0,0,(X+14,G),(X-24,G-1),('r',8,14-4*a),('r',10,16),le=('e',4,14),re=('e',3,15),tilt=20,lk=KNEE_UP)
clip('kneelcry','on his knees, pounding his chest with a fist in regret, head bowed',[KCk(0),KCk(1),KCk(0),KCk(1)])
SDk=lambda a: P((X,57),10,0,0,(X+8+4*a,G-3*a),(X-4,G),PF,PR,tilt=26,**PKE)
clip('sad','hands in pockets, head hanging, scuffing the floor with the toe of his shoe',[SDk(0),SDk(1),SDk(0),SDk(1)])
SHk=lambda a: ST(0,lh=('r',8,-4),rh=('r',7,-3),le=('e',10,6),re=('e',9,7),lean=6*a,tilt=-8*a)
clip('shout','cups both hands around his mouth and shouts loudly ahead',[ST(0),SHk(.5),SHk(1),SHk(1),SHk(.5)])
DSk=lambda a: ST(0,lh=('r',20,22-4*a),rh=('r',18,23-4*(1-a)),le=('e',8,16),re=('e',6,16),lean=14,tilt=8)
clip('deskslam','bursts out laughing and slaps the desk with his palms, desk not drawn',[DSk(0),DSk(1),DSk(0),DSk(1)])
SUk=P((X-3,52),-6,0,0,(X+6,G-6),(X-8,G-4),(16,-8),(-6,-6),le=('e',11,0),re=ELB_UP,tilt=-8)
clip('surprise','jumps in surprise with both hands flying up, fingers snapping by reflex',[ST(0),SUk,sh(SUk,0,2),ST(0,lh='down',rh='down')])
SFk=P((X-14,90),-30,0,0,(X+10,G-6),(X+4,G-2),('r',14,-14),('r',10,-12),le=('e',10,-2),re=('e',8,-1),lk=KNEE_UP,rk=KNEE_UP,tilt=-6)
clip('startlefall','startled, falls back onto his bottom with both hands up in surrender',[ST(0),lerp(ST(0),SFk,.5),SFk,SFk])
PDk=P((X-14,94),-84,0,0,(X+22,G),(X+16,G),(-6,0),(-10,4),lk=KNEE_UP,rk=KNEE_UP,tilt=24)
clip('plopdown','exhausted, flops flat onto his back spread out on the floor',[ST(0),lerp(ST(0),SFk,.6),SFk,lerp(SFk,PDk,.5),PDk])
EMk=lambda d: ST(0,lh=('r',16,4-3*d),rh=('r',-4+d,-12),le=('e',9,8),re=('e',8,-4),tilt=-6,lean=-5)
clip('embarrassed','leans back laughing sheepishly, rear hand rubbing the back of his head, front hand waving no-no in front',[ST(0),EMk(0),EMk(2),EMk(0),EMk(2),ST(0)])
ANk=lambda a: ST(0,lh=('r',18-6*a,-2+4*a),le=('e',11,6),tilt=-6)
clip('annoyed','waves off a joke he has heard a hundred times, rolling his eyes but grinning',[ST(0),ANk(0),ANk(1),ANk(0),ANk(1),ANk(0),ST(0)])
THk=lambda a: ST(0,lh=('r',6,-10+a),rh=('r',8,12),le=('e',12,2),re=('e',6,16),tilt=-4)
clip('think','tapping his temple with an index finger to a beat, thinking',[THk(0),THk(2),THk(0),THk(2)])
BOk=lambda a: ST(0,lh=('r',14,6-2*a),le=('e',8,12),tilt=4)
clip('bored','bored, silently snapping his fingers to a beat',[BOk(0),BOk(1),BOk(0),BOk(1)])

if __name__=='__main__':
    from PIL import Image,ImageDraw
    W,H=R.W,R.H; s=2
    base=Image.open(os.path.join(HERE,'..','base','A.png')).convert('RGBA') if os.path.exists(os.path.join(HERE,'..','base','A.png')) else None
    names=sys.argv[1:] or list(CLIPS)
    rows=[]
    for n in names:
        _,_,ps=CLIPS[n]
        row=Image.new('RGBA',(W*s*16,H*s),(30,34,40,255)); row.alpha_composite(draw(BASE_KP,base,s),(0,0))
        for i,p in enumerate(ps): row.alpha_composite(draw(p,None,s),((i+1)*W*s,0))
        ImageDraw.Draw(row).text((4,4),n,fill=(255,255,0,255)); rows.append(row)
    out=os.path.join(HERE,'..','plan'); os.makedirs(out,exist_ok=True)
    for i in range(0,len(rows),8):
        sheet=Image.new('RGBA',(W*s*16,H*s*len(rows[i:i+8])))
        for j,r in enumerate(rows[i:i+8]): sheet.alpha_composite(r,(0,j*H*s))
        sheet.resize((sheet.width//2,sheet.height//2)).save(f'{out}/plan-{i//8:02d}.png')
    bad=0
    for n,(a,_,ps) in CLIPS.items():
        for p in ps:
            for k,v in p.items():
                x,y=(v[0]+R.DX)/W,(v[1]+R.DY)/H
                if not(0.02<x<0.98 and 0.02<y<0.98): print('OUT',n,k,round(x,2),round(y,2)); bad+=1
    cost=lambda n: 2 if n<=3 else 3 if n<=8 else 4
    print(len(CLIPS),'clips',sum(len(v[2]) for v in CLIPS.values()),'frames, est',sum(cost(len(v[2])) for v in CLIPS.values()),'gens, out',bad)
