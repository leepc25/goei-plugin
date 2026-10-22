# 블라렛·살라딘·소환체 전 동작 뼈대 (animate_with_skeleton_v3용). 설계: docs/캐릭터제작서/동작설계_블라렛_살라딘.md
# 쟈알디 rig.py의 뼈 길이·좌표계·P()·anatomic()을 그대로 쓰고(발목 바닥선 G=100), 내보낼 때 각자 캔버스로 옮긴다.
# 오른쪽(동쪽)을 봄. RIGHT = 그림상 가까운 쪽 = P의 lh/lf. 블라렛·살라딘 모두 가까운 손이 주무기 손(성검·언월도), 먼 손이 보조(총·소총).
# 옆모습 유지: 어깨 회전 s는 SIDE(-0.25) 근처. 뒤돌기·회전은 생성기가 못 그려서 넣지 않음(쟈알디 교훈) → 회전 기술은 앞뒤로 크게 휘두르기로.
import sys,os,math
J_=os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../jyaldi-v5/scripts')
sys.path.insert(0,J_)
import rig
from rig import P,lerp,staged,sh,anatomic,X,G,KNEE_FWD,KNEE_UP,ELB_DOWN,ELB_UP,ELB_OUT,J
SIDE=-0.25
R=lambda x,y:('r',x,y)      # 목 기준 손 목표(몸통 기울기 따라 돎)
E=lambda x,y:('e',x,y)      # 목 기준 팔꿈치 직접 지정
A=lambda x,y:('a',x,y)      # 절대 좌표
cyc=lambda t:(math.cos(2*math.pi*t),math.sin(2*math.pi*t))
def tail(ps,loop): return ps+[ps[0] if loop else ps[-1]]

# 캔버스: 둘 다 256×176. 쟈알디 공간(160×112 기준, rig DX=2,DY=28 → 192×144)에서 +39,+32 옮김 → 발목 y=160, 발바닥 y≈168, 몸 중심 x≈96.
CW,CH=256,176; OX,OY=rig.DX+39,rig.DY+32
LONG=[]
CHARS={}    # 이름: dict(desc, scale, clips{클립: (동작, 소품, [자세])}, base, base_kp)
def make(name,desc,scale=1.0):
    CHARS[name]=dict(desc=desc,scale=scale,clips={}); return CHARS[name]
def scaled(p,k):
    if k==1.0: return p
    return {n:(X+(v[0]-X)*k,G+(v[1]-G)*k) for n,v in p.items()}
def kp(p,k=1.0):
    q=scaled(p,k); out=[]
    for n in J:
        z=8 if n.startswith('RIGHT') else 2 if n.startswith('LEFT') else 5
        out.append({'label':n,'x':round((q[n][0]+OX)/CW,4),'y':round((q[n][1]+OY)/CH,4),'z_index':z})
    return out
def add(ch,name,action,poses,prop=''):
    assert 3<=len(poses)<=15,(name,len(poses))
    if len(action)>100: LONG.append((ch,name,len(action)))
    ch['clips'][name]=(action,prop,[anatomic(p) for p in poses])

# ════════ 블라렛 ════════
BL=make('blaret',
  'battle nun: black veil to the shoulders with a thin white forehead band, white collar, long fitted black habit with a high side slit, '
  'pale thigh with a black garter holster, ash-blonde straight hair with blunt bangs, green eyes, thick grey chain with a silver cross on the chest, '
  'wooden rosary on the wrist, black shoes')
GUNS='a silver pistol in each hand'
SWORD='a long white cross-shaped longsword held in both hands'
SWORD1='a long white cross-shaped longsword in the near hand'
STAKE='a short silver stake in the near hand'
HCROSS='a small wooden cross gripped like a hammer in the near hand'
EMPTY='empty hands'
BS=lambda b=0,lh=R(5,10),rh='down',le=E(-3,15),re=ELB_DOWN,tilt=0,head=(5,-7),lean=2,d=0,**k: P((X+d,55+b),lean,SIDE,0,(X+6+d,G),(X-4+d,G),lh,rh,head=head,tilt=tilt,le=le,re=re,**k)
add(BL,'idle','standing elegantly, hand resting on the chest cross, soft breathing, faint smile',tail([BS(0),BS(.5),BS(1),BS(.5),BS(0),BS(.5)],True))
def bwalk(t):
    c,s=cyc(t)
    return P((X+2,55+1.4*abs(c)),1,SIDE,0.35*c,(X+2+10*c,G-5*max(0,-s)),(X+2-10*c,G-5*max(0,s)),R(4-4*c,32),R(1+4*c,32),head=(5,-7))
add(BL,'walk','elegant duelist walk, toes first, hips swaying, arms loose',[bwalk(i/8) for i in range(8)])
def brun(t):
    c,s=cyc(t)
    return P((X+8,64+2*abs(s)),32,SIDE,0.3*c,(X+10+22*c,G-14*max(0,-s)-1),(X+10-22*c,G-14*max(0,s)-1),R(-4,34),R(-8,32),head=(6,-6),tilt=-12)
add(BL,'run','inhumanly fast sprint, torso almost level, both arms swept back',[brun(i/8) for i in range(8)])
BLK0=P((X,66),18,SIDE,0,(X+10,G),(X-10,G),R(-2,30),R(-6,29),tilt=-10)
BLK1=P((X+18,62),34,SIDE,0,(X+40,G-2),(X-2,G-4),R(-4,34),R(-8,32),head=(6,-6),tilt=-14)
add(BL,'blink','sinks low then bursts forward in one explosive step',[BS(0),BLK0,BLK1,sh(BLK1,10),sh(BLK1,14)])
GI=lambda b=0,d=0: P((X+d,57+b),4,SIDE,-0.1,(X+9+d,G),(X-7+d,G),R(10,6),R(8,8),le=E(2,15),re=E(0,16))
DR1=P((X,60),10,SIDE,0,(X+7,G),(X-5,G),A(X+6,68),A(X,70),le=E(4,14),re=E(-2,15),tilt=10)
DR2=P((X,58),4,SIDE,0,(X+8,G),(X-6,G),R(20,16),R(14,20))
add(BL,'draw','pulls two pistols from the thigh holsters at once and flips them up into a crossed hold',[BS(0),DR1,lerp(DR1,DR2,.5),DR2,lerp(DR2,GI(),.5),GI()],GUNS)
add(BL,'guns_idle','pistols crossed in front of the chest, muzzles up, light bounce',[GI(0),GI(.5),GI(1),GI(.5)],GUNS)
FN=lambda r=0: P((X+1,57),6,SIDE,-0.1,(X+10,G),(X-7,G),R(31-3*r,3-3*r),R(12,8),le=E(14,6),re=E(2,15))
FF=lambda r=0: P((X+1,57),6,SIDE,-0.1,(X+10,G),(X-7,G),R(12,7),R(30-3*r,4-3*r),le=E(3,14),re=E(13,7))
add(BL,'fire','alternating twin pistol shots, one arm snaps forward while the other pulls back',[FN(0),FN(1),lerp(FN(),FF(),.5),FF(0),FF(1),lerp(FF(),FN(),.5)],GUNS)
SP=lambda r=0: P((X,56),0,SIDE,0,(X+11,G),(X-10,G),R(31-2*r,2-2*r),R(-29+2*r,5-2*r),le=E(14,5),re=E(-12,8))
add(BL,'fire_split','arms flung wide forward and backward, firing both ways at once, head facing forward',[GI(),lerp(GI(),SP(),.5),SP(0),SP(1),SP(0),SP(1)],GUNS)
JA=lambda tuck,b=0,lh=R(10,6),rh=R(8,8): P((X,56+b),6,SIDE,-0.1,(X+9,G-3-tuck),(X-6,G-4-tuck*1.2),lh,rh)
add(BL,'jump','light crouch then a high graceful jump, habit fluttering',[GI(6),P((X+2,52),8,SIDE,-0.1,(X+8,G-2),(X-6,G-3),R(10,6),R(8,8)),JA(12),JA(16),JA(10),JA(3,-1),GI(6),GI(0)],GUNS)
AF=lambda r=0: P((X,52),-24,SIDE,0,(X+12,G-14),(X+2,G-18),A(X+22-2*r,56-r),A(X+19+2*r,58-r),le=E(12,8),re=E(10,10),head=(6,-6),tilt=24)
add(BL,'air_fire','mid-air, leaning back, both pistols pointed down ahead firing rapidly',[JA(14),lerp(JA(14),AF(),.5),AF(0),AF(1),AF(0),AF(1),AF(0),JA(8)],GUNS)
RL1=P((X,57),8,SIDE,0,(X+9,G),(X-7,G),R(16,14),R(12,16),tilt=14)
RL2=P((X,60),12,SIDE,0,(X+9,G),(X-7,G),A(X+6,68),R(12,16),le=E(4,14),tilt=16)
RL3=P((X,60),12,SIDE,0,(X+9,G),(X-7,G),R(14,12),A(X,70),re=E(-2,15),tilt=16)
add(BL,'reload','tilts both pistols, magazines drop, slaps each grip to the thigh to reload, back to crossed hold',[GI(),RL1,RL1,RL2,RL2,RL3,RL3,GI()],GUNS)
ST1=P((X,62),14,SIDE,0,(X+8,G),(X-6,G),A(X+4,82),R(6,26),le=E(4,14),tilt=14)
ST2=P((X-2,58),-4,SIDE,0,(X+10,G),(X-8,G),R(-16,10),R(10,18),le=E(-8,12))
ST3=P((X+10,58),10,SIDE,0,(X+26,G),(X-4,G-2),R(32,8),R(-8,22),le=E(16,8))
add(BL,'stake_throw','draws a silver stake from under the skirt and whips it forward sidearm',[BS(0),ST1,ST2,staged(ST2,ST3,.6),ST3,sh(ST3,2)],STAKE)
SF0=P((X+6,58),10,SIDE,0,(X+16,G-4),(X-4,G-6),R(6,-26),R(4,-24),le=E(4,-10),re=E(2,-8))
SF1=P((X+22,78),20,SIDE,0,(X+40,G),(X+4,G),R(8,-22),R(6,-20),le=E(6,-8),re=E(4,-6))
SF2=P((X+22,80),40,SIDE,0,(X+40,G),(X+4,G),A(X+40,92),A(X+38,92),le=E(14,10),re=E(12,12),tilt=20)
add(BL,'stake_finish','leaps onto a fallen foe, drops to one knee and drives the stake down with both hands',[BS(0),SF0,sh(SF0,10,-6),SF1,staged(SF1,SF2,.5),SF2,SF2,sh(SF2,0,-1)],STAKE)
EX1=P((X+4,60),20,SIDE,0,(X+16,G),(X-6,G),R(26,26),R(6,26),le=E(12,12),tilt=16)
EX2=P((X+2,56),0,SIDE,0,(X+12,G),(X-6,G),R(16,4),R(8,26),le=E(8,10))
EX3=P((X,55),-6,SIDE,0,(X+10,G),(X-6,G),R(6,-28),R(4,-24),le=E(6,-10),re=E(2,-8),tilt=-12)
SW=lambda b=0,d=0: P((X+d,58+b),4,SIDE,-0.1,(X+11+d,G),(X-9+d,G),R(8,8),R(6,10),le=E(2,15),re=E(0,16))
add(BL,'extract','reaches forward low, draws a long sword up overhead, then rests it on the shoulder',
    [BS(0),lerp(BS(0),EX1,.5),EX1,EX1,staged(EX1,EX2,.5),EX2,staged(EX2,EX3,.6),EX3,lerp(EX3,SW(),.5),SW()],SWORD1)
add(BL,'sword_idle','two-handed sword resting on the shoulder, wide stance, light bounce',[SW(0),SW(.5),SW(1),SW(.5)],SWORD)
C1W=P((X-2,59),2,SIDE,0,(X+12,G),(X-9,G),R(-10,8),R(-8,10),le=E(-6,16),re=E(-6,16))
C1S=P((X+10,61),14,SIDE,-0.1,(X+26,G),(X-6,G-2),A(X+46,41),A(X+44,43),le=E(16,6),re=E(15,7))
C1F=P((X+12,62),16,SIDE,0,(X+26,G),(X-4,G-2),R(18,24),R(16,25),le=E(10,14),re=E(9,15))
add(BL,'cut1','horizontal two-handed sword slash: front foot, hips, then arms',[SW(),C1W,staged(C1W,C1S,.5),C1S,C1F,lerp(C1F,SW(12),.6)],SWORD)
C2S=P((X+16,58),4,SIDE,0,(X+30,G),(X+2,G-3),R(22,-20),R(20,-18),le=E(14,-4),re=E(13,-3),tilt=-8)
add(BL,'cut2','reverses into a rising diagonal two-handed slash',[C1F,staged(C1F,C2S,.4),staged(C1F,C2S,.75),C2S,sh(C2S,1),lerp(C2S,SW(16),.6)],SWORD)
C3U=P((X,54),-8,SIDE,0,(X+12,G-4),(X-8,G),R(2,-28),R(0,-26),le=E(4,-10),re=E(2,-9),tilt=-12)
C3D=P((X+16,70),32,SIDE,0,(X+34,G),(X-6,G-2),R(30,26),R(28,27),le=E(18,10),re=E(17,11),tilt=16)
add(BL,'cut3','raises the sword high overhead, steps in and smashes it straight down to the floor',[SW(),lerp(SW(),C3U,.5),C3U,staged(C3U,C3D,.35),staged(C3U,C3D,.7),C3D,C3D,lerp(C3D,SW(16),.5)],SWORD)
LU=P((X+18,66),14,SIDE,0,(X+42,G),(X-6,G-1),R(34,8),R(-22,14),le=E(18,4),re=E(-12,10))
add(BL,'lunge','fencing lunge: glides low and thrusts the sword straight out one-handed, rear arm back',[SW(),staged(SW(),LU,.3),staged(SW(),LU,.65),LU,sh(LU,3),lerp(LU,SW(14),.5),SW(14)],SWORD1)
RI0=P((X+4,70),24,SIDE,0,(X+18,G),(X-10,G),R(24,30),R(22,30),le=E(12,16),re=E(11,17),tilt=12)
RI1=P((X+8,46),-6,SIDE,0,(X+14,G-14),(X+2,G-20),R(14,-26),R(12,-24),le=E(10,-10),re=E(8,-9),tilt=-12)
add(BL,'rise','from a low crouch swings the sword upward and rises into the air with it',[SW(),lerp(SW(),RI0,.6),RI0,staged(RI0,RI1,.4),staged(RI0,RI1,.75),RI1,sh(RI1,0,-2),sh(RI1,0,-3)],SWORD)
PL0=P((X,50),-4,SIDE,0,(X+10,G-16),(X-2,G-20),R(6,-22),R(4,-20),le=E(6,-8),re=E(4,-7))
PL1=P((X+14,78),26,SIDE,0,(X+30,G),(X-4,G),A(X+28,G),A(X+26,G),le=E(14,14),re=E(13,15),tilt=18)
add(BL,'plunge','in mid-air flips the sword point-down and drives it into the floor, landing on one knee',[JA(14,0,R(6,-22),R(4,-20)),PL0,sh(PL0,6,4),staged(PL0,PL1,.5),PL1,PL1,sh(PL1,0,-1),lerp(PL1,SW(14),.5)],SWORD)
SB=lambda a: P((X,57),6,SIDE,0,(X+8,G),(X-6,G),R(14+2*a,10-2*a),R(10,14),le=E(6,12),tilt=14)
add(BL,'sword_break','the sword is gone: shakes out the empty hands and glances at a palm',[SW(),SB(0),SB(1),SB(0),SB(1)],EMPTY)
PM0=P((X-2,58),4,SIDE,0,(X+10,G),(X-8,G),R(2,22),R(8,22),le=E(-4,14))
PM1=P((X+8,58),10,SIDE,0,(X+22,G),(X-4,G-1),R(32,2),R(6,22),le=E(16,4))
add(BL,'palm','pulls a hand back to the hip, then thrusts the open palm forward',[BS(0),PM0,staged(PM0,PM1,.5),PM1,sh(PM1,1),lerp(PM1,BS(4),.5)],EMPTY)
WV0=P((X-2,58),2,SIDE,0,(X+10,G),(X-8,G),R(12,10),R(11,11),le=E(4,15),re=E(3,15))
WV1=P((X+12,62),16,SIDE,0,(X+30,G),(X-4,G-2),R(31,4),R(30,8),le=E(16,6),re=E(15,8))
add(BL,'wave','presses both palms together at the chest, then shoves both palms forward with a big step',[BS(0),lerp(BS(0),WV0,.5),WV0,WV0,staged(WV0,WV1,.5),WV1,sh(WV1,2),lerp(WV1,BS(10),.5)],EMPTY)
CK=lambda a: P((X,55),2,SIDE,0,(X+7,G),(X-4,G),R(10,-5-a),'down',le=E(10,6),head=(5,-7),tilt=-8)
add(BL,'click','tilts her head with a teasing smile, brings two fingers up beside her eye and snaps them',[BS(0),BS(0,tilt=-8),lerp(BS(0,tilt=-8),CK(0),.5),CK(0),CK(1),CK(0),CK(0),CK(1)],EMPTY)
GD=lambda b=0: P((X-1,59+b),4,-0.45,-0.2,(X+9,G),(X-8,G),R(12,-2),'down',le=E(11,8),tilt=8)
add(BL,'guard','raises the rosary forearm in front of her face, body half turned, braced',[GD(0),GD(.5),GD(1),GD(.5)],EMPTY)
HK0=P((X-2,56),-6,SIDE,0,(X+16,G-30),(X-6,G),R(8,10),R(-8,12),lk=KNEE_UP)
HK1=P((X-6,56),-22,SIDE,0,(X+40,30),(X-6,G),R(6,6),R(-14,10),lk=KNEE_UP,head=(5,-7),tilt=10)
add(BL,'high_kick','counter: snaps the near leg up through the skirt slit in a high kick, then sets it down',[BS(0),HK0,HK1,HK1,HK0,BS(0)],EMPTY)
SS=lambda d,b: P((X+d,58+b),-6,SIDE,0,(X+8+d,G-b),(X-8+d,G-b),R(10,14),R(-8,16))
add(BL,'sidestep','quick light sidestep, body leaning away, skirt swinging',[BS(0),SS(-2,2),SS(-4,4),SS(-4,2),BS(0)],EMPTY)
BF=lambda lean,hip,tuck: P((X-6,hip),lean,SIDE,0,(X+6,G-tuck),(X-4,G-tuck-2),R(-6,-24),R(-8,-22),le=E(-2,-10),re=E(-4,-9),lk=KNEE_UP,rk=KNEE_UP)
add(BL,'backflip','crouches and springs into a back flip, knees tucked, lands lightly with a smile',
    [P((X,66),14,SIDE,0,(X+10,G),(X-8,G),R(-4,22),R(-6,20)),BF(-20,48,10),BF(-60,40,26),BF(-100,40,34),BF(-60,46,22),P((X-12,64),10,SIDE,0,(X-2,G),(X-18,G),R(12,14),R(-10,16)),BS(0,d=-12),BS(0,d=-12)],EMPTY)
KN=lambda lh,rh,tilt=10,lean=6,**k: P((X,78),lean,SIDE,0,(X+16,G),(X-17,G-1),lh,rh,tilt=tilt,**k)
CA2=P((X,53),-6,SIDE,0,(X+8,G),(X-6,G),R(22,-22),R(-18,-18),le=E(12,-6),re=E(-10,-6),tilt=-10)
add(BL,'cathedral','kneels and lifts the chest cross in both hands in prayer, then rises and flings both arms wide',
    [BS(0),KN(R(8,10),R(6,10)),KN(R(10,-4),R(8,-2),-6,le=E(8,8),re=E(6,9)),KN(R(10,-6),R(8,-4),-10,le=E(8,7),re=E(6,8)),KN(R(10,-6),R(8,-4),-10,le=E(8,7),re=E(6,8)),
     lerp(KN(R(10,-6),R(8,-4),-10),CA2,.4),lerp(KN(R(10,-6),R(8,-4),-10),CA2,.75),CA2,CA2,sh(CA2,0,1)],EMPTY)
CM=lambda: P((X+4,57),6,SIDE,0,(X+16,G),(X-6,G),R(34,-6),'hip',le=E(16,0),tilt=-4)
add(BL,'command','points the sword forward and calls the advance',[SW(),lerp(SW(),CM(),.5),CM(),sh(CM(),1),CM(),sh(CM(),1)],SWORD1)
SR=lambda a=0: P((X,54-a),-10,SIDE,0,(X+10,G),(X-8,G),R(4,-30-a),R(2,-29-a),le=E(4,-12),re=E(2,-11),tilt=-16)
add(BL,'super_ready','reaches both arms straight up as if seizing something huge from the sky',[BS(0),lerp(BS(0),SR(),.4),lerp(BS(0),SR(),.75),SR(0),SR(1),SR(2),SR(1),SR(2)],EMPTY)
SC1=P((X+16,74),38,SIDE,0,(X+36,G),(X-8,G-1),R(30,30),R(29,31),le=E(18,12),re=E(17,13),tilt=18)
add(BL,'super_cut','brings both raised hands all the way down in one colossal overhead chop, whole body following',
    [SR(2),sh(SR(2),-2,-2),staged(SR(2),SC1,.25),staged(SR(2),SC1,.5),staged(SR(2),SC1,.75),SC1,SC1,sh(SC1,0,1),lerp(SC1,BS(14),.4),lerp(SC1,BS(14),.75)],SWORD)
HT=P((X-4,56),-14,SIDE,0,(X+6,G),(X-10,G),R(10,18),R(-6,22),head=(4,-7),tilt=-14)
add(BL,'hit','upper body snaps back from a blow, veil swinging',[BS(0),HT,sh(HT,-1),lerp(HT,BS(0),.6)],EMPTY)
SG=P((X-10,60),-10,SIDE,0,(X,G),(X-18,G),R(8,-12),R(-8,20),le=E(8,4),tilt=10)
add(BL,'stagger','reels back two steps holding her veil, catches herself',[HT,lerp(HT,SG,.5),SG,sh(SG,-2),lerp(SG,BS(0,d=-10),.5),BS(0,d=-10)],EMPTY)
LIE=P((X-10,92),-88,SIDE,0,(X+12,G),(X+16,G-2),R(4,30),R(-4,30),head=(6,-6))
add(BL,'down','knocked off her feet, flies back and lands flat on her back',[HT,P((X-10,52),-40,SIDE,0,(X+6,G-16),(X+2,G-20),R(10,24),R(-6,24)),P((X-20,70),-70,SIDE,0,(X,G-10),(X+2,G-14),R(8,28),R(-6,28)),
    sh(LIE,-6,-2),LIE,sh(LIE,0,-1),LIE],EMPTY)
KU1=P((X-12,86),-100,SIDE,0,(X-30,62),(X-26,58),A(X-30,96),A(X-28,96),lk=KNEE_UP,rk=KNEE_UP)
add(BL,'getup','kip-up: rocks the legs over, snaps them down and springs straight to her feet',[LIE,KU1,P((X-4,70),20,SIDE,0,(X+6,G-8),(X-8,G-10),R(10,20),R(4,22)),P((X,66),14,SIDE,0,(X+8,G),(X-8,G),R(8,16),R(4,18)),BS(4),BS(0)],EMPTY)
add(BL,'halfblood','her smile freezes for a beat, she stops dead and her head dips slightly',[BS(0),BS(0,tilt=4),BS(.5,tilt=10),BS(.5,tilt=12),BS(.5,tilt=12),BS(0,tilt=12)],EMPTY)
WR=lambda: P((X+8,56),4,SIDE,0,(X+18,G),(X+2,G),R(4,30),R(2,30),tilt=-4)
add(BL,'wrath','lifts her head with a blank cold face and takes one slow step forward',[BS(0,tilt=12),BS(0,tilt=4),lerp(BS(0),WR(),.4),lerp(BS(0),WR(),.75),WR(),WR()],EMPTY)
TA=lambda a: P((X+2,57),10,SIDE,0,(X+10,G),(X-5,G),R(14+6*a,8-2*a),R(10,10),le=E(6+4*a,12),tilt=-10)
add(BL,'taunt','mid-fight sales pitch: clasps her hands, tilts her head, holds one hand out invitingly',[BS(0),TA(0),TA(0),TA(1),TA(1),TA(0)],EMPTY)
IN=lambda a: P((X,55),4+10*a,SIDE,0,(X+7,G),(X-4,G),R(26,-4+6*a),R(5,10),le=E(14,2),tilt=4*a)
add(BL,'intro','stage introduction: hand on heart, the other arm sweeps out wide, a little bow',[BS(0),lerp(BS(0),IN(0),.5),IN(0),IN(.5),IN(1),IN(1),IN(.5),IN(0)],EMPTY)
PI=lambda a: P((X+2,57),12,SIDE,0,(X+9,G),(X-4,G),R(14,8),R(12,10),le=E(6,14),re=E(4,15),tilt=-6-4*a)
add(BL,'pitch','leans in with hands clasped and a playful wink, pitching a conversion',[BS(0),PI(0),PI(1),PI(0),PI(1),PI(0)],EMPTY)
SE=lambda a,t=0: P((X+2,56),6+4*t,SIDE,0,(X+9,G),(X-4,G),R(16+8*a,12),R(14+8*a,14),le=E(8,12),re=E(6,13),tilt=4+8*t)
add(BL,'sell','presents something in both hands, takes it back and nods',[BS(0),SE(.5),SE(1),SE(1),SE(.5),SE(0),SE(0,1),SE(0)],EMPTY)
SM0=P((X,54),-6,SIDE,0,(X+10,G),(X-6,G),R(4,-28),R(8,22),le=E(6,-10),tilt=-6)
SM1=P((X+8,62),24,SIDE,0,(X+20,G),(X-4,G),A(X+32,70),R(8,22),le=E(16,10),tilt=14)
add(BL,'smash','raises a small cross high and hammers it straight down in front of her',[BS(0),lerp(BS(0),SM0,.5),SM0,SM0,staged(SM0,SM1,.6),SM1,SM1,lerp(SM1,BS(0),.5)],HCROSS)
CD=lambda a: P((X+2,56),12-8*a,SIDE,0,(X+9,G),(X-4,G),R(22,8-4*a),R(20-14*a,10+16*a),le=E(10,10),tilt=6-12*a)
add(BL,'card','offers a business card politely with both hands, then flips it to one hand with a wink',[BS(0),CD(0),CD(0),CD(.5),CD(1),CD(1)],EMPTY)
AC=lambda b=0: P((X,55+b),0,SIDE,0,(X+8,G),(X-5,G),R(10,14),R(8,12),le=E(5,17),re=E(3,17),tilt=2)
add(BL,'arms_crossed','arms folded tight, flat cold stare, perfectly still',[AC(0),AC(.4),AC(.8),AC(.4)],EMPTY)
LA=lambda a: P((X,56+a),4+4*a,SIDE,0,(X+7,G),(X-4,G),R(9,-3),R(6,20),le=E(9,9),tilt=-4+6*a)
add(BL,'laugh','covers her mouth with the back of her hand and laughs, shoulders shaking',[BS(0),LA(0),LA(1),LA(0),LA(1),LA(0)],EMPTY)
SU=P((X-8,55),-8,SIDE,0,(X,G),(X-14,G),R(14,2),R(10,4),le=E(8,10),re=E(6,11),tilt=-8)
add(BL,'surprise','eyes wide, hops half a step back with hands raised',[BS(0),lerp(BS(0),SU,.6),SU,sh(SU,0,1)],EMPTY)
TE=lambda a: P((X,58+a),4,SIDE,0,(X+9,G),(X-6,G),A(X+6,70-a),R(6,10),le=E(4,14),re=E(-2,15),tilt=-2)
add(BL,'tense','smiling face but the hand drifts down to the thigh holster and hovers there',[BS(0),lerp(BS(0),TE(0),.5),TE(0),TE(1),TE(0),TE(1)],EMPTY)
HU0=P((X+6,64),40,SIDE,0,(X+18,G),(X-6,G),A(X+38,82),R(4,24),le=E(14,16),tilt=10)
HU1=P((X-2,57),2,SIDE,0,(X+10,G),(X-8,G),R(20,10),R(4,24),le=E(10,12))
add(BL,'help_up','bends down, reaches a hand to someone on the floor and hauls them up',[BS(0),lerp(BS(0),HU0,.5),HU0,HU0,staged(HU0,HU1,.5),HU1,HU1,BS(0)],EMPTY)
BLS=lambda tgt,e: P((X,55),4,SIDE,0,(X+7,G),(X-4,G),tgt,'down',le=e,tilt=6)
add(BL,'bless','makes the sign of the cross, then holds an open palm out in blessing',
    [BS(0),BLS(R(8,-8),E(9,4)),BLS(R(8,16),E(6,12)),BLS(R(3,9),E(4,14)),BLS(R(12,9),E(8,13)),BLS(R(26,0),E(14,4)),BLS(R(26,0),E(14,4)),BS(0)],EMPTY)
DF=lambda a: P((X,78+a),18,SIDE,0,(X+16,G),(X-17,G-1),A(X+16,80),R(4,26),le=E(8,14),tilt=16-4*a)
add(BL,'defeat','down on one knee, hand on the knee, catching her breath with a smile',[DF(0),DF(1),DF(0),DF(1),DF(0),DF(1)],EMPTY)
FL1=P((X,56),8,SIDE,0,(X+7,G),(X-4,G),A(X+6,66),A(X,68),le=E(4,14),re=E(-2,15),tilt=12)
FL2=P((X,55),0,SIDE,0,(X+7,G),(X-4,G),R(16,-24),'down',le=E(12,-6),tilt=-6)
add(BL,'flee','brushes off her skirt, waves with a wink, then springs back out of the fight',
    [BS(0),FL1,FL1,FL2,sh(FL2,0,0),FL2,P((X,66),14,SIDE,0,(X+10,G),(X-8,G),R(-4,22),R(-6,20)),BF(-30,46,12),BF(-50,42,20),BS(0,d=-16)],EMPTY)

# ════════ 살라딘 ════════  (쟈알디 공간에서 짜고 발 기준점(X,G) 중심으로 SCALE배. 기준 그림 실측 뒤 base.json에서 정함)
SA=make('saladin',
  'huge bearded man, dark brown skin, short black beard, white wrapped turban, black suit, white shirt, black tie, black shoes, '
  'ammo pouches and explosive packs strapped across the chest, scimitar scabbard at the hip')
ARMS='a curved scimitar in the near hand and an assault rifle in the far hand'
RIFLE='an assault rifle in the far hand, scimitar sheathed at the hip'
SCIM='a curved scimitar held in both hands'
TUBE='a rocket launcher tube on the near shoulder held with both hands'
NONE='empty hands, scimitar sheathed, rifle slung on the back'
SS_=lambda b=0,lh=R(10,22),rh=R(9,22),le=E(2,16),re=E(1,16),tilt=0,lean=3,d=0,**k: P((X+d,56+b),lean,SIDE,0,(X+9+d,G),(X-7+d,G),lh,rh,le=le,re=re,tilt=tilt,**k)
add(SA,'idle','standing tall with hands clasped in front of the belly, deep slow breaths through the chest',tail([SS_(0),SS_(.6),SS_(1.2),SS_(.6),SS_(0),SS_(.6)],True),NONE)
AR=lambda b=0,d=0,lean=6: P((X+d,58+b),lean,SIDE,0,(X+11+d,G),(X-9+d,G),R(18,10),R(14,22),le=E(8,12),re=E(4,16))
DW1=P((X,57),8,SIDE,0,(X+10,G),(X-8,G),A(X-2,66),R(-6,-2),le=E(-4,14),re=E(-8,6))
add(SA,'draw','draws the scimitar from the hip with the near hand while the far hand swings the rifle off his back',[SS_(0),DW1,DW1,lerp(DW1,AR(),.35),lerp(DW1,AR(),.7),AR(),sh(AR(),0,1),AR()],ARMS)
add(SA,'armed_idle','feet planted wide, scimitar low and forward, rifle at the hip, heavy breathing',[AR(0),AR(.6),AR(1.2),AR(.6)],ARMS)
def swalk(t,lh=R(18,10),rh=R(14,22),le=E(8,12),re=E(4,16)):
    c,s=cyc(t)
    return P((X+2,57+2*abs(c)),6,SIDE+0.08*c,0.25*c,(X+2+12*c,G-4*max(0,-s)),(X+2-12*c,G-4*max(0,s)),lh,rh,le=le,re=re)
add(SA,'walk','relentless heavy advance, chest out, shoulders rolling with every stomping step',[swalk(i/8) for i in range(8)],ARMS)
def sfire(t):
    c,s=cyc(t); r=i%2 if False else 0
    return swalk(t,lh=R(20,2),rh=R(20-2*(round(4*t)%2),16),le=E(10,8),re=E(8,14))
add(SA,'advance_fire','marches forward firing the rifle from the hip, scimitar held up in front, recoil jolting',[sfire(i/8) for i in range(8)],ARMS)
def srun(t):
    c,s=cyc(t)
    return P((X+8,60+2*abs(s)),20,SIDE,0.25*c,(X+8+19*c,G-11*max(0,-s)-1),(X+8-19*c,G-11*max(0,s)-1),R(6,-26),R(4-10*c,20),le=E(6,-10),re=E(-2,15),head=(6,-6),tilt=-6)
add(SA,'run','charging run with the scimitar raised overhead, roaring',[srun(i/8) for i in range(8)],ARMS)
S1U=P((X-2,56),-4,SIDE,0,(X+10,G),(X-8,G),R(-2,-24),R(12,22),le=E(2,-10),re=E(4,16),tilt=-6)
S1D=P((X+10,62),20,SIDE,0,(X+26,G),(X-6,G-2),R(28,28),R(12,22),le=E(14,12),re=E(4,16),tilt=12)
add(SA,'slash1','heaves the scimitar up and back, then cuts diagonally down with full body weight',[AR(),S1U,staged(S1U,S1D,.4),staged(S1U,S1D,.75),S1D,lerp(S1D,AR(10),.5)],ARMS)
S2=P((X+16,60),8,SIDE,0,(X+30,G),(X,G-2),R(32,2),R(12,22),le=E(16,4),re=E(4,16))
add(SA,'slash2','reverses into a flat horizontal cut that carries all the way across',[S1D,staged(S1D,S2,.4),staged(S1D,S2,.75),S2,sh(S2,2),lerp(S2,AR(16),.5)],ARMS)
MX=lambda a,r: P((X+2,59),6,SIDE+0.1*a,0.2*a,(X+13,G),(X-10,G),R(32*a+(-24)*(1-a),6),R(20-2*r,18),le=E(16*a-12*(1-a),8),re=E(8,14))
add(SA,'mixer','sweeps the scimitar back and forth in huge arcs while firing the rifle from the hip',
    [AR(),MX(0,0),MX(.5,1),MX(1,0),MX(.5,1),MX(0,0),MX(.5,1),MX(1,0),MX(.5,1),MX(0,0),MX(.5,1),MX(1,0)],ARMS)
BU=lambda r: P((X,58),2-2*r,SIDE,0,(X+12,G),(X-10,G),R(4,30),R(26-2*r,10-r),le=E(0,16),re=E(12,10))
add(SA,'burst','stops and fires the rifle one-handed, recoil shoving the shoulder back',[AR(),BU(0),BU(1),BU(0),BU(1),BU(0)],ARMS)
SWP=lambda y: P((X,58),4,SIDE,0,(X+12,G),(X-10,G),R(4,30),R(26,y),le=E(0,16),re=E(12,8+y/3))
add(SA,'sweep','fires from the hip, sweeping the rifle up and down across the field',[SWP(4),SWP(10),SWP(16),SWP(22),SWP(26),SWP(20),SWP(12),SWP(6)],ARMS)
RE1=P((X,59),10,SIDE,0,(X+11,G),(X-9,G),R(8,16),R(12,18),le=E(4,15),re=E(4,15),tilt=14)
add(SA,'reload','scimitar still in hand, slaps a fresh magazine from the chest pouch into the rifle',[AR(),RE1,sh(RE1,0,0),P((X,59),10,SIDE,0,(X+11,G),(X-9,G),R(6,12),R(12,18),le=E(2,14),re=E(4,15),tilt=14),RE1,RE1,lerp(RE1,AR(),.5),AR()],ARMS)
RP1=P((X,57),6,SIDE,0,(X+10,G),(X-8,G),R(-2,-4),R(-6,-2),le=E(-4,8),re=E(-8,6),tilt=-4)
RP2=P((X,59),8,SIDE,0,(X+12,G),(X-10,G),R(10,4),R(18,8),le=E(2,12),re=E(10,12),tilt=6)
add(SA,'rpg_ready','pulls a launcher tube off his back and settles it on the near shoulder to aim',
    [SS_(0),lerp(SS_(0),RP1,.5),RP1,RP1,lerp(RP1,RP2,.35),lerp(RP1,RP2,.7),RP2,RP2,sh(RP2,0,1),RP2],TUBE)
add(SA,'rpg_fire','fires the launcher, the blast shoves him back half a step',[RP2,sh(P((X,58),-2,SIDE,0,(X+12,G),(X-10,G),R(8,2),R(16,6),le=E(0,10),re=E(8,10),tilt=2),-4),sh(RP2,-6),sh(RP2,-6),sh(RP2,-5),sh(RP2,-5)],TUBE)
GR1=P((X,58),6,SIDE,0,(X+10,G),(X-8,G),R(6,14),R(14,22),le=E(2,15),re=E(4,16),tilt=10)
GR2=P((X-2,62),14,SIDE,0,(X+12,G),(X-10,G),R(-14,26),R(14,22),le=E(-6,16),re=E(4,16))
GR3=P((X+8,58),2,SIDE,0,(X+22,G),(X-6,G-2),R(28,0),R(14,22),le=E(14,6),re=E(4,16),tilt=-6)
add(SA,'grenade','rips an explosive pack off his chest, swings low and lobs it underhand',[RIF_:=SS_(0,lh=R(10,22),rh=R(14,22)),GR1,GR2,staged(GR2,GR3,.5),GR3,sh(GR3,1),lerp(GR3,AR(8),.5)],RIFLE)
LC0=P((X,68),16,SIDE,0,(X+12,G),(X-10,G),R(10,-20),R(8,-18),le=E(8,-6),re=E(6,-5))
LC1=P((X+12,46),-6,SIDE,0,(X+22,G-20),(X+4,G-22),R(2,-28),R(0,-26),le=E(4,-10),re=E(2,-9),tilt=-10)
LC2=P((X+30,74),30,SIDE,0,(X+46,G),(X+10,G),A(X+66,G-4),A(X+64,G-3),le=E(18,12),re=E(17,13),tilt=16)
add(SA,'leap_cleave','crouches, leaps high with the scimitar raised in both hands and hammers it down, landing on one knee',
    [AR(),LC0,LC1,sh(LC1,6,-2),staged(LC1,LC2,.4),staged(LC1,LC2,.75),LC2,LC2,sh(LC2,0,-1),lerp(LC2,AR(28),.5)],SCIM)
SJ=lambda tuck,b=0: P((X,57+b),6,SIDE,0,(X+11,G-3-tuck),(X-8,G-4-tuck),R(18,10),R(14,22),le=E(8,12),re=E(4,16))
add(SA,'jump','heavy jump: deep knee bend, launches, lands hard',[AR(8),P((X+2,54),8,SIDE,0,(X+10,G-2),(X-8,G-3),R(18,8),R(14,20)),SJ(8),SJ(12),SJ(8),SJ(2),AR(10),AR(0)],ARMS)
def sga(t):
    c,s=cyc(t)
    return P((X+2,58+1.5*abs(c)),8,SIDE,0.2*c,(X+2+9*c,G-3*max(0,-s)),(X+2-9*c,G-3*max(0,s)),R(20,-2),R(14,22),le=E(14,10),re=E(4,16),tilt=6)
add(SA,'guard_advance','scimitar blade held upright in front as a shield, pressing forward step by step',[sga(i/8) for i in range(8)],ARMS)
CHN=lambda a: P((X,55-a),-12,SIDE,0,(X+11,G),(X-9,G),R(8,-30-a),R(14,22),le=E(6,-12),re=E(4,16),tilt=-18)
add(SA,'chant','thrusts the scimitar to the sky, chest out, head back, bellowing a war cry',[AR(),lerp(AR(),CHN(0),.4),lerp(AR(),CHN(0),.75),CHN(0),CHN(1),CHN(2),CHN(1),CHN(2),CHN(1),lerp(CHN(0),AR(),.5)],ARMS)
SC_=lambda a: P((X+4,57),8,SIDE,0,(X+16,G),(X-8,G),R(34,-6-a),R(14,22),le=E(16,-1),re=E(4,16),tilt=-6)
add(SA,'summon_charge','levels the scimitar straight ahead and roars the charge',[AR(),lerp(AR(),SC_(0),.4),lerp(AR(),SC_(0),.75),SC_(0),SC_(1),SC_(0),SC_(1),SC_(0)],ARMS)
SRS=P((X+6,78),24,SIDE,0,(X+22,G),(X-12,G-1),A(X+34,G-2),R(14,22),le=E(14,14),re=E(4,16),tilt=14)
add(SA,'summon_rise','drops to one knee and drives the scimitar point into the floor',[AR(),lerp(AR(),SRS,.35),lerp(AR(),SRS,.7),SRS,SRS,sh(SRS,0,1),SRS,lerp(SRS,AR(),.5)],ARMS)
SN=lambda a: P((X+2,57),6,SIDE,0,(X+13,G),(X-9,G),R(-10+36*a,10-12*a),R(14,22),le=E(-6+20*a,12-8*a),re=E(4,16))
add(SA,'summon_send','sweeps the scimitar arm forward, sending something past him',[AR(),SN(0),SN(.4),SN(.8),SN(1),SN(1)],ARMS)
SUR=lambda a=0: P((X,55-a),-8,SIDE,0,(X+11,G),(X-9,G),R(20,-24-a),R(-16,-22-a),le=E(12,-8),re=E(-10,-8),tilt=-16)
add(SA,'super_ready','flings both arms wide and high and stares up at the sky',[AR(),lerp(AR(),SUR(),.35),lerp(AR(),SUR(),.7),SUR(0),SUR(1),SUR(2),SUR(1),SUR(2)],ARMS)
SJP=P((X+4,57),6,SIDE,0,(X+15,G),(X-9,G),R(34,-2),R(-6,22),le=E(16,0),re=E(-4,16),tilt=-2)
SJF=P((X+2,59),12,SIDE,0,(X+13,G),(X-9,G),R(14,24),R(-6,22),le=E(10,12),re=E(-4,16),tilt=10)
add(SA,'super_judge','points one finger at a single target, then slowly closes that hand into a fist and drags it down',
    [SUR(2),lerp(SUR(2),SJP,.4),lerp(SUR(2),SJP,.75),SJP,SJP,sh(SJP,0,1),SJP,staged(SJP,SJF,.25),staged(SJP,SJF,.5),staged(SJP,SJF,.75),SJF,SJF],EMPTY+', scimitar sheathed, rifle slung on the back')
SHT=P((X-3,57),-12,SIDE,0,(X+10,G),(X-9,G),R(16,14),R(12,22),le=E(8,12),re=E(4,16),tilt=-12)
add(SA,'hit','only the upper body jolts back, turban steady',[AR(),SHT,sh(SHT,-1),lerp(SHT,AR(),.6)],ARMS)
SSG=P((X-8,60),-6,SIDE,0,(X+2,G),(X-18,G),R(14,16),R(10,22),le=E(8,12),re=E(4,16),tilt=6)
add(SA,'stagger','staggers one step back, then plants his feet and grits his teeth',[SHT,lerp(SHT,SSG,.5),SSG,sh(SSG,0,1),lerp(SSG,AR(0,-8),.5),AR(0,-8)],ARMS)
SKN=lambda a: P((X,80+a),20,SIDE,0,(X+16,G),(X-17,G-1),A(X+24,G-2),R(10,24),le=E(12,14),re=E(4,16),tilt=14)
add(SA,'kneel','one knee buckles, he props himself up on the scimitar planted in the floor',[SHT,lerp(SHT,SKN(0),.35),lerp(SHT,SKN(0),.7),SKN(0),SKN(1),SKN(0),SKN(1),SKN(0)],ARMS)
add(SA,'kneel_up','pushes up off the planted scimitar and rises with a roar',[SKN(0),sh(SKN(0),0,-1),lerp(SKN(0),AR(),.3),lerp(SKN(0),AR(),.6),CHN(0),lerp(CHN(0),AR(),.5),AR()],ARMS)
SLIE=P((X-12,92),-88,SIDE,0,(X+12,G),(X+16,G-2),R(6,30),R(-4,30),head=(6,-6))
add(SA,'down','toppled backward, crashes onto his back',[SHT,P((X-8,54),-30,SIDE,0,(X+8,G-6),(X+2,G-10),R(14,20),R(4,24)),P((X-16,70),-60,SIDE,0,(X+6,G-6),(X+8,G-10),R(10,26),R(0,28)),
    sh(SLIE,-4,-3),SLIE,sh(SLIE,0,-2),SLIE,SLIE],ARMS)
SGU1=P((X-6,84),-30,SIDE,0,(X+10,G),(X+14,G),A(X-8,G-2),R(10,26),le=E(-6,14))
add(SA,'getup','rolls to his side, plants the scimitar and heaves himself up',[SLIE,lerp(SLIE,SGU1,.5),SGU1,SKN(0),lerp(SKN(0),AR(),.35),lerp(SKN(0),AR(),.7),AR(2),AR()],ARMS)
PU1=P((X+6,66),52,SIDE,0,(X+18,G),(X-8,G),A(X+32,90),A(X+28,90),le=E(16,14),re=E(14,15),tilt=14)
CAR=lambda b=0: P((X,57+b),8,SIDE,0,(X+11,G),(X-9,G),R(4,4),R(14,22),le=E(8,12),re=E(4,16))
add(SA,'pickup','bends down, scoops up a fallen comrade and heaves them over his near shoulder',[AR(),lerp(AR(),PU1,.5),PU1,PU1,lerp(PU1,CAR(),.35),lerp(PU1,CAR(),.7),CAR(1),CAR(0)],'empty near hand reaching down, rifle in the far hand')
def scar(t):
    c,s=cyc(t)
    return P((X+2,57+2*abs(c)),6,SIDE,0.2*c,(X+2+11*c,G-4*max(0,-s)),(X+2-11*c,G-4*max(0,s)),R(4,4),R(-22,12-2*(round(4*t)%2)),le=E(8,12),re=E(-12,10))
add(SA,'carry_fire','walks with someone over his near shoulder, firing the rifle backward one-handed',[scar(i/8) for i in range(8)],'near arm wrapped over the shoulder holding someone, assault rifle in the far hand pointed backward')
SHD=lambda b=0: P((X,58+b),-4,SIDE,0,(X+13,G),(X-11,G),R(24,0),R(-22,2),le=E(12,-2),re=E(-12,2),tilt=-6)
add(SA,'shield','steps in front and spreads both arms wide like a wall',[AR(),lerp(AR(),SHD(),.5),SHD(0),SHD(1),SHD(0),SHD(1)],EMPTY+', scimitar sheathed, rifle slung on the back')
TK=lambda a: P((X,57),4,SIDE,0,(X+10,G),(X-8,G),R(20+4*a,-4*a),R(10,22),le=E(12,4-2*a),tilt=-4*a)
add(SA,'talk','booming speech, one big open hand gesturing',[SS_(0),TK(0),TK(1),TK(0),TK(1),TK(0)],NONE)
AD=lambda d,y=10: P((X+d,57),10,SIDE,0,(X+12+d,G),(X-6+d,G),R(24,y),R(23,y+1),le=E(12,10),re=E(11,11),tilt=-6)
add(SA,'adopt','strides forward and grabs both hands in front of his chest, beaming',[SS_(0),AD(4,14),AD(8,10),AD(12,8),AD(12,10),AD(12,8),AD(12,10),AD(12,10)],NONE)
def sdance(t):
    c,s=cyc(t)
    return P((X+2*c,57+1.5*abs(s)),6*c,SIDE,0.2*c,(X+10,G-5*max(0,s)),(X-8,G-5*max(0,-s)),R(22,12+2*c),R(21,13+2*c),le=E(12,10),re=E(11,11),tilt=-6)
add(SA,'dance','holds both hands out front, sways side to side and stamps his feet in joy',[sdance(i/8) for i in range(8)],NONE)
LF0=P((X+2,62),20,SIDE,0,(X+12,G),(X-8,G),R(22,22),R(21,23),le=E(12,14),re=E(11,15))
LF1=P((X,55),-10,SIDE,0,(X+11,G),(X-9,G),R(10,-26),R(9,-25),le=E(10,-8),re=E(9,-7),tilt=-14)
add(SA,'lift','grabs someone in front and hoists them high overhead, then sets them down',[SS_(0),LF0,lerp(LF0,LF1,.5),LF1,sh(LF1,0,-1),LF1,lerp(LF1,LF0,.5),SS_(0)],NONE)
SL=lambda a: P((X,56+a),-12+4*a,SIDE,0,(X+10,G),(X-8,G),R(8,22),R(4,24),le=E(4,16),tilt=-20+4*a)
add(SA,'laugh','throws his head back in a huge laugh, hand on his belly',[SS_(0),SL(0),SL(1),SL(0),SL(1),SL(0)],NONE)
WP=lambda a: P((X,80+a),26,SIDE,0,(X+10,G),(X-14,G),R(12,-2+a),R(10,0+a),le=E(10,8),re=E(8,9),tilt=22,lk=KNEE_FWD,rk=KNEE_FWD)
add(SA,'weep','kneels on both knees, head bowed, face in his hands, shoulders heaving as he sobs',[SS_(0),lerp(SS_(0),WP(0),.5),WP(0),WP(1.5),WP(0),WP(1.5),WP(0),WP(1.5)],NONE)
RS1=P((X,80),18,SIDE,0,(X+10,G),(X-14,G),R(10,-4),'down',le=E(10,6),tilt=8)
add(SA,'resume','wipes his eyes with a sleeve, springs up and points ahead',[WP(0),RS1,RS1,lerp(RS1,SS_(0),.4),lerp(RS1,SS_(0),.75),P((X+2,56),4,SIDE,0,(X+12,G),(X-8,G),R(32,-4),'down',le=E(16,0)),P((X+2,56),4,SIDE,0,(X+12,G),(X-8,G),R(32,-5),'down',le=E(16,0)),SS_(0)],NONE)
STE=lambda a: P((X,59+a),6,SIDE,0,(X+11,G),(X-9,G),A(X-4,66),R(10,22),le=E(-2,15),re=E(4,16),tilt=4)
add(SA,'tense','grips the scimitar hilt at his hip, jaw clenched, glaring',[SS_(0),lerp(SS_(0),STE(0),.5),STE(0),STE(1),STE(0),STE(1)],NONE)
IV=P((X+8,57),2,SIDE,0,(X+20,G),(X-4,G),R(30,4),R(10,22),le=E(14,4),tilt=-6)
add(SA,'intervene','steps in and throws an arm out to block someone, shouting',[SS_(0),lerp(SS_(0),IV,.5),IV,sh(IV,1),IV,sh(IV,1)],NONE)
TR1=P((X,57),8,SIDE,0,(X+10,G),(X-8,G),R(6,14),R(8,16),le=E(2,15),re=E(2,15),tilt=12)
TR2=P((X+2,57),8,SIDE,0,(X+11,G),(X-7,G),R(24,10),R(23,11),le=E(12,10),re=E(11,11),tilt=2)
add(SA,'trade','pulls things from his chest pouches and hands them over in both hands',[SS_(0),TR1,TR1,lerp(TR1,TR2,.5),TR2,TR2,lerp(TR2,SS_(0),.5),SS_(0)],NONE)
RF=lambda a: P((X,57),2,SIDE,0,(X+10,G),(X-8,G),R(18,-2+4*a),'down',le=E(10,6),tilt=-2)
add(SA,'refuse','waves a big hand side to side, refusing payment with a laugh',[SS_(0),RF(0),RF(1),RF(0),RF(1),RF(0)],NONE)
BK=P((X+4,58),6,SIDE,0,(X+16,G),(X-8,G),R(32,0),R(14,22),le=E(16,2),re=E(4,16),tilt=-4)
add(SA,'break','rips the scimitar out and levels it at someone, roaring',[SS_(0),DW1,lerp(DW1,BK,.4),lerp(DW1,BK,.75),BK,sh(BK,1),BK,sh(BK,1)],ARMS)
BW=lambda lean: P((X,56),lean,SIDE,0,(X+9,G),(X-7,G),R(6,12),'down',le=E(2,15),tilt=lean/2)
add(SA,'bow','hand on his heart, bows with dignity, straightens and steps back',[SS_(0),BW(4),BW(18),BW(30),BW(30),BW(18),BW(4),sh(BW(4),-6),sh(BW(4),-12),sh(BW(4),-18)],NONE)
SSU=P((X-6,56),-10,SIDE,0,(X+4,G),(X-14,G),R(16,6),R(12,8),le=E(10,8),re=E(8,10),tilt=-10)
add(SA,'surprise','eyebrows shoot up, leans back with hands raised',[SS_(0),lerp(SS_(0),SSU,.6),SSU,sh(SSU,0,1)],NONE)

# ════════ 소환체 ════════ (사람 몸 소환체는 쟈알디 대기 장을 바꾼 기준 그림, 같은 좌표계·배율 1)
KT=make('knight','armored holy knight in polished silver full plate armor and a closed great helm, white tabard with a red cross, a longsword and a kite shield')
KI=lambda b=0: P((X,57+b),4,SIDE,0,(X+10,G),(X-8,G),R(16,14),R(12,10),le=E(6,15),re=E(6,12))
add(KT,'idle','armored knight at attention, sword low, shield up, slight sway',[KI(0),KI(.5),KI(1),KI(.5)],'longsword in the near hand, kite shield on the far arm')
def kmarch(t):
    c,s=cyc(t)
    return P((X+2,57+1.2*abs(c)),4,SIDE,0,(X+2+11*c,G-5*max(0,-s)),(X+2-11*c,G-5*max(0,s)),R(16,14),R(12,10),le=E(6,15),re=E(6,12))
add(KT,'march','disciplined armored march, knees lifting high in step',[kmarch(i/8) for i in range(8)],'longsword in the near hand, kite shield on the far arm')
KS1=P((X,56),-4,SIDE,0,(X+10,G),(X-8,G),R(-2,-22),R(12,10),le=E(2,-8),re=E(6,12))
KS2=P((X+10,60),16,SIDE,0,(X+24,G),(X-6,G-2),R(28,22),R(14,10),le=E(14,10),re=E(8,12))
add(KT,'slash','raises the sword and cuts down hard behind the shield',[KI(),KS1,staged(KS1,KS2,.5),KS2,sh(KS2,1),lerp(KS2,KI(10),.5)],'longsword in the near hand, kite shield on the far arm')
CR=make('crusader','desert holy warrior: chainmail under a white robe, white turban with a pointed helmet, round shield and a curved sword')
add(CR,'march','warrior striding forward in formation, shield up',[kmarch(i/8) for i in range(8)],'curved sword in the near hand, round shield on the far arm')
add(CR,'slash','raises the curved sword and cuts down behind the shield',[KI(),KS1,staged(KS1,KS2,.5),KS2,sh(KS2,1),lerp(KS2,KI(10),.5)],'curved sword in the near hand, round shield on the far arm')
RZ=lambda d: P((X,55+d),2+d/2,SIDE,0,(X+8,G),(X-6,G),R(12,16-d/3),R(10,14-d/3),le=E(6,15),re=E(6,12))
add(CR,'rise','rises up out of the floor from a deep crouch to standing ready',[RZ(30),RZ(28),RZ(24),RZ(18),RZ(12),RZ(6),RZ(2),RZ(0)],'curved sword in the near hand, round shield on the far arm')
HM=make('highmamluk','elite mamluk warrior in lamellar armor and a spiked helmet, a bundle of explosive charges strapped to the chest')
def hrun(t):
    c,s=cyc(t)
    return P((X+8,60+2*abs(s)),20,SIDE,0.3*c,(X+8+19*c,G-12*max(0,-s)-1),(X+8-19*c,G-12*max(0,s)-1),R(10,2),R(8,4),le=E(8,10),re=E(6,11),head=(6,-6))
add(HM,'run','sprints forward clutching the charges to his chest, screaming',[hrun(i/8) for i in range(8)],'hands clutching the charges on the chest')
MS=make('modernspirit','modern soldier spirit in combat fatigues and a bomb vest, a rocket launcher tube on the shoulder')
MF=lambda r=0: P((X-r,58),6-4*r,SIDE,0,(X+12,G),(X-10,G),R(10,4),R(18,8),le=E(2,12),re=E(10,12),tilt=6-2*r)
add(MS,'fire','kneeling stance shoulders a rocket tube, fires, recoil rocks him back',[MF(0),MF(0),MF(2),MF(3),MF(2),MF(1)],'rocket launcher tube on the near shoulder held with both hands')
SUMMON_SRC={'knight':'blaret','crusader':'saladin','highmamluk':'saladin','modernspirit':'saladin'}

if __name__=='__main__':
    # 뼈대 미리보기(무료)와 관절 검사
    from PIL import Image,ImageDraw
    sys.path.insert(0,J_); import audit_joints
    OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'../plan'); os.makedirs(OUT,exist_ok=True)
    s=1; tot=0; bad=0
    for cn,ch in CHARS.items():
        rows=[]
        for n,(act,prop,ps) in ch['clips'].items():
            tot+=1
            b=[(i,x) for i,p in enumerate(ps) if (x:=audit_joints.bad(p))]
            if b: bad+=1; print('JOINT',cn,n,b)
            for i,p in enumerate(ps):
                for kk,v in p.items():
                    x,y=(v[0]+OX)/CW,(v[1]+OY)/CH
                    if not(0.01<x<0.99 and 0.01<y<0.99): print('OUT',cn,n,i,kk,round(x,2),round(y,2))
            row=Image.new('RGBA',(CW*16,CH),(30,34,40,255)); d=ImageDraw.Draw(row)
            for i,p in enumerate(ps):
                q={k:(v[0]+OX+i*CW,v[1]+OY) for k,v in p.items()}
                for a,b2 in rig.BONES:
                    c=(255,90,90,255) if 'RIGHT' in a+b2 else (90,170,255,255) if 'LEFT' in a+b2 else (240,240,240,255)
                    d.line([q[a],q[b2]],fill=c,width=2)
                d.ellipse([q['NOSE'][0]-3,q['NOSE'][1]-3,q['NOSE'][0]+3,q['NOSE'][1]+3],fill=(255,230,80,255))
                d.line([(i*CW,G+OY+8),(i*CW+CW,G+OY+8)],fill=(90,90,90,255))
            d.text((4,4),f'{cn}/{n}',fill=(255,255,0,255)); rows.append(row)
        for i in range(0,len(rows),8):
            sheet=Image.new('RGBA',(CW*16,CH*len(rows[i:i+8])))
            for j,r in enumerate(rows[i:i+8]): sheet.alpha_composite(r,(0,j*CH))
            sheet.resize((sheet.width//2,sheet.height//2)).save(f'{OUT}/{cn}-{i//8}.png')
    print(tot,'clips',bad,'with joint flags'); print('LONG',[(n,l) for _,n,l in LONG])
