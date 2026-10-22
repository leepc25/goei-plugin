# 가짜 관리국 125클립 뼈대. CLIPS[대상][클립] = (동작 설명, 소품 설명, [자세...]). 설계서 4장 표와 같은 이름·장 수.
import math
from rig import *
CLIPS={k:{} for k in BODY}
def clip(who,name,action,poses,prop=''):
    assert 3<=len(poses)<=15,(who,name,len(poses)); CLIPS[who][name]=(action,prop,[floor(anatomic(p)) for p in poses])
def floor(p): return {k:(v[0],min(v[1],G+5)) for k,v in p.items()}   # 누운 장에서 관절이 바닥 아래로 가지 않게
def hold(p,n): return [p]*n

# ── 공용 걸음 ──
def walkf(t,lh,rh,stride=11,lift=4,bob=1.2,lean=3,heavy=0):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+2+stride*c, G-lift*max(0,-sn)); rf=(X+2-stride*c, G-lift*max(0,sn))
    return P((X+2,56+bob*abs(c)+heavy*(1-abs(c))),lean,0.12*c,0.2*c,lf,rf,lh,rh)
def runf(t,lh,rh,lean=16,stride=19):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+6+stride*c, G-12*max(0,-sn)-1); rf=(X+6-stride*c, G-12*max(0,sn)-1)
    return P((X+8,58+2.5*abs(sn)),lean,0.25*c,0.3*c,lf,rf,lh,rh)
def swing(t,a=7): c=math.cos(2*math.pi*t); return (2-a*c,28),(-1+a*c,28)

# ── 공용 피격·다운 (쟈알디 down/getup 뼈대를 옮겨 씀) ──
def knock(lhA,rhA):
    K1=P((X-4,60),-25,-0.2,-0.3,(X+12,G),(X-14,G-2),(10,-10),(-4,-8),head=(3,-8))
    K2=P((X-12,62),-55,0,0,(X+12,G-14),(X+2,G-12),(4,-20),(-6,-16))
    K3=sh(P((X-18,84),-78,0,0,(X+16,G-32),(X+8,G-24),(2,-26),(-10,-14),lk=KNEE_UP,rk=KNEE_UP),8)
    K4=sh(P((X-14,94),-90,0,0,(X+28,G-4),(X+20,G),(16,2),(2,8),lk=KNEE_UP,rk=KNEE_UP,re=ELB_UP),14)
    K5=sh(P((X-12,96),-92,0,0,(X+32,G),(X+28,G),(18,3),(4,8),le=ELB_UP,re=ELB_UP),14)
    return K1,K2,K3,K4,K5
K1,K2,K3,K4,K5=knock(None,None)
U1=P((X+2,94),-55,0,0,(X+22,G),(X+12,G),(6,10),('a',X-14,G),lk=KNEE_UP,rk=KNEE_UP)
U2=P((X-6,86),-10,0,0,(X+16,G),(X-16,G-1),(14,14),('a',X-22,G),rk=KNEE_FWD)
KNEEL=lambda lh=(17,2),rh='chin',b=0: P((X,79+b),6,-0.2,-0.3,(X+16,G),(X-19,G-1),lh,rh)

# ════════════════════ 이도형 부장 ════════════════════
D='dohyeong'
SHE='long katana sheathed in a black scabbard at the left hip'
DRW='holding a long black-bladed katana, empty black scabbard at the left hip'
HILT=('r',8,27); SAYA=('r',3,30)                     # 칼집에 꽂힌 칼자루·칼집 입구(몸통 따라 돎)
DST=lambda b=0,lh='down',tilt=0: P((X,55+b),2,0,0,(X+6,G),(X-4,G),lh,SAYA,tilt=tilt)
IAI=lambda b=0: P((X-2,62+b),10,-0.2,-0.2,(X+14,G),(X-14,G-2),HILT,SAYA,tilt=4)
KAM=lambda d=0,b=0: P((X+d,60+b),6,-0.2,-0.2,(X+12+d,G),(X-12+d,G-2),(16,22),(11,24))   # 중단: 두 손 칼자루 배꼽 앞
clip(D,'idle','relaxed confident idle, thumb on the scabbard, grinning, slow breathing',[DST(0),DST(0.5),DST(1),DST(1),DST(0.5),DST(0)],SHE)
SMK=lambda t: DST(0,(6,0) if t else (12,14),tilt=-10*t)
clip(D,'smoke','smoking a cigarette with two fingers, raises it to the lips, tilts the head back and exhales',[SMK(0),SMK(1),SMK(1),SMK(1.3),SMK(0),SMK(0),SMK(1),SMK(0)],SHE+', a cigarette between two fingers')
FL1=DST(0,(8,8)); FL2=DST(0,(18,2)); FL3=DST(0,(16,6),tilt=-12); FL4=DST(0,'down',tilt=6)
clip(D,'flick','flicks a cigarette butt away with the middle finger, then jerks the chin forward as a go signal',[SMK(1),FL1,FL2,FL2,FL3,FL4,DST(0)],SHE)
clip(D,'walk','unhurried swaggering walk, big strides, shoulders loose, one hand on the scabbard',[walkf(i/8,swing(i/8,8)[0],SAYA,stride=13,lean=2) for i in range(8)],SHE)
clip(D,'stance','iaido ready stance: knees bent low, right hand over the sword hilt at the hip, left hand on the scabbard',[IAI(0),IAI(0.5),IAI(1),IAI(0.5)],SHE)
clip(D,'run','low fast sprint, torso bent forward, hand pressing the sword hilt down at the hip',[runf(i/8,HILT,SAYA,lean=22) for i in range(8)],SHE)
VA=P((X+6,66),24,-0.2,-0.2,(X+24,G),(X-12,G-3),HILT,SAYA,tilt=-4)
VB=P((X+16,70),40,-0.2,-0.2,(X+36,G),(X-8,G-6),HILT,('r',0,30),tilt=-10)
clip(D,'vanish','explodes forward from a low iaido stance into an impossibly low fast lunge',[IAI(0),IAI(2),VA,VB],SHE)
def RW(i,lh,rh,tilt=6): return P((X+2,56),4,0,0,(X+2+10*math.cos(i*0.8),G),(X+2-10*math.cos(i*0.8),G),lh,rh,tilt=tilt)
rw=[RW(0,(14,24),(17,23)),RW(1,(14,24),(20,25)),RW(2,(14,24),(24,27)),RW(3,(14,24),(28,29)),RW(4,(14,24),(31,31)),RW(5,(12,22),SAYA),
    RW(6,('r',14,24),('r',4,29)),RW(7,('r',10,25),('r',4,29)),RW(8,HILT,SAYA,0),DST(0)]
clip(D,'reappear','walks forward calmly, wiping the black blade clean by pinching it between the fingers of the left hand, then slowly slides it back into the scabbard',rw,DRW)
C1B=P((X+6,61),12,-0.2,-0.2,(X+22,G),(X-12,G-2),('r',14,24),('r',1,30))
C1C=P((X+12,60),10,-0.25,-0.2,(X+28,G),(X-10,G-2),(36,6),('r',-4,30))
C1D=P((X+12,60),8,-0.25,-0.2,(X+28,G),(X-10,G-2),(26,-2),('r',-4,30),head=(6,-6))
clip(D,'cut1','iaido quick-draw: steps in and draws the katana in one horizontal slash at chest height',[IAI(0),C1B,staged(C1B,C1C,.6),C1C,C1D,C1D],DRW)
C2A=P((X+10,63),14,-0.2,-0.2,(X+26,G),(X-10,G-2),(6,28),(4,26))
C2B=P((X+14,60),6,-0.2,-0.2,(X+30,G),(X-8,G-3),(28,12),(4,24))
C2C=P((X+16,57),-2,-0.2,-0.2,(X+32,G),(X-6,G-4),(30,-14),(4,22),le=ELB_UP)
C2D=P((X+16,57),-4,-0.2,-0.2,(X+32,G),(X-6,G-4),(18,-24),(4,22),le=ELB_UP)
clip(D,'cut2','turns the blade and slashes diagonally upward from low to high, grinning',[C1D,C2A,C2B,C2C,C2D,C2D],DRW)
C3A=P((X+16,58),-6,-0.2,-0.2,(X+32,G),(X-6,G-4),(8,-24),(4,-22),le=ELB_UP,re=ELB_UP)
C3B=P((X+22,62),14,-0.2,-0.2,(X+40,G),(X-2,G-3),(32,2),(28,4))
C3C=P((X+26,70),32,-0.2,-0.2,(X+46,G),(X-2,G-2),(34,28),(30,28))
clip(D,'cut3','both hands on the hilt, raises the katana overhead and brings it straight down all the way to the floor',[C2D,C3A,C3A,C3B,C3C,C3C,staged(C3C,KAM(26),.5),KAM(26)],DRW)
C4=[P((X+26,62),8,-0.2,-0.2,(X+42,G),(X+4,G-2),(-10,24),(-12,22)),
    P((X+24,58),-6,-0.2,-0.2,(X+38,G-4),(X+4,G-2),(-8,-14),(-10,-12),le=ELB_UP,re=ELB_UP),
    P((X+26,54),-8,-0.2,-0.2,(X+40,G-10),(X+8,G-12),(4,-26),(0,-24),le=ELB_UP,re=ELB_UP),
    P((X+30,54),0,-0.2,-0.2,(X+46,G-12),(X+12,G-14),(22,-22),(18,-20),le=ELB_UP,re=ELB_UP),
    P((X+34,60),18,-0.2,-0.2,(X+52,G-2),(X+14,G-6),(38,4),(34,6)),
    P((X+36,68),34,-0.2,-0.2,(X+56,G),(X+14,G-2),(36,26),(32,26)),
    P((X+36,70),36,-0.2,-0.2,(X+56,G),(X+14,G-2),(36,30),(32,30))]
clip(D,'cut4','big finishing wheel cut: swings the katana from low behind in a full overhead circle and slams it down while hopping forward',[KAM(26),C4[0],C4[1],C4[2],C4[3],C4[4],C4[5],C4[6],C4[6],staged(C4[6],KAM(36),.5)],DRW)
TH0=P((X-2,62),4,-0.2,-0.2,(X+12,G),(X-14,G-2),('r',8,22),('r',4,24))
TH1=P((X+18,64),16,-0.25,-0.2,(X+38,G),(X-12,G-1),'out',('r',-6,28))
clip(D,'thrust','one-handed lunging thrust: pulls the hilt back to the hip then drives the katana straight forward with a long lunge',[KAM(),TH0,staged(TH0,TH1,.5),TH1,TH1,staged(TH1,KAM(16),.5)],DRW)
LA=P((X+4,70),20,-0.2,-0.2,(X+20,G),(X-14,G-1),(18,36),(14,34))
LB=P((X+10,56),-4,-0.2,-0.2,(X+24,G-2),(X-8,G-6),(26,-6),(22,-4),le=ELB_UP,re=ELB_UP)
LC=P((X+12,54),-8,-0.2,-0.2,(X+26,G-4),(X-6,G-8),(14,-26),(10,-24),le=ELB_UP,re=ELB_UP)
clip(D,'launcher','drops low and rips an upward cut from the floor to above the head, rising onto the toes',[KAM(),LA,LA,LB,LC,LC,staged(LC,KAM(12),.6)],DRW)
AIR=lambda tuck,lh=(-2,-14),rh=(-4,-12),b=0: P((X,58+b),6,-0.2,-0.2,(X+10,G-2-tuck),(X-8,G-4-tuck*1.2),lh,rh,le=ELB_UP,re=ELB_UP)
clip(D,'jump','crouches and springs high, katana held back over the shoulder in both hands, lands lightly',[KAM(0,7),P((X+2,54),8,-0.2,-0.2,(X+8,G-2),(X-8,G-3),(14,-4),(10,-2)),AIR(10),AIR(14),AIR(10),AIR(4,b=-1),KAM(0,7),KAM()],DRW)
clip(D,'aircut','mid-air X slash: cuts diagonally down, then back up across, knees tucked',[AIR(12),AIR(12,(18,-20),(14,-18)),AIR(12,(34,20),(30,20)),AIR(12,(30,24),(26,24)),AIR(12,(8,30),(6,28)),AIR(12,(32,-6),(28,-4)),AIR(12,(26,-18),(22,-16)),AIR(10)],DRW)
DC0=P((X+2,68),26,-0.2,-0.2,(X+18,G),(X-14,G-3),('r',-6,30),('r',-8,30))
DC1=P((X+22,72),40,-0.2,-0.2,(X+44,G),(X+2,G-6),('r',-8,30),('r',-10,30))
DC2=P((X+30,70),28,-0.25,-0.2,(X+48,G),(X+8,G-4),(38,8),('r',-6,30))
DC3=P((X+32,64),10,-0.2,-0.2,(X+48,G),(X+14,G-2),(30,30),('r',-4,30))
clip(D,'dashcut','crosses the screen in one low dashing slash, stops past the target and flicks the blood off the blade downward',[KAM(),DC0,DC1,DC2,DC3,DC3,staged(DC3,KAM(32),.4),KAM(32)],DRW)
KP=lambda b=0: P((X-2,62+b),10,-0.2,-0.2,(X+14,G),(X-14,G-2),('r',12,25),SAYA,tilt=2)
clip(D,'kanpa','perfectly still reading stance, blade drawn two finger widths from the scabbard, grin fixed',[KP(0),KP(0),KP(0.5),KP(0.5)],SHE)
CO1=P((X-8,64),-4,-0.2,-0.2,(X+6,G-2),(X-22,G),('r',12,25),SAYA,tilt=2)
CO2=P((X+4,62),10,-0.25,-0.2,(X+20,G),(X-14,G-2),(28,10),('r',-2,30))
CO3=P((X+8,58),2,-0.25,-0.2,(X+24,G),(X-12,G-3),(24,-14),('r',-2,30),le=ELB_UP)
clip(D,'counter','counterattack: slips half a step back out of the line, then draws and cuts up through the attacker',[KP(0),CO1,CO1,CO2,CO3,CO3,KAM(6)],DRW)
clip(D,'bulletcut','swats incoming bullets out of the air with two tiny fast flicks of the katana',[KAM(),P((X,60),6,-0.2,-0.2,(X+12,G),(X-12,G-2),(24,-6),(18,-2)),P((X,60),6,-0.2,-0.2,(X+12,G),(X-12,G-2),(28,14),(22,16)),P((X,60),6,-0.2,-0.2,(X+12,G),(X-12,G-2),(24,-6),(18,-2)),P((X,60),6,-0.2,-0.2,(X+12,G),(X-12,G-2),(26,10),(20,12)),KAM()],DRW)
HM=lambda t: P((X,56),-6*t,0,0,(X+8,G),(X-6,G),(8+14*t,12+2*t),SAYA,tilt=-6*t)
clip(D,'hamster','grabs the front of his suit jacket and throws it wide open toward the enemy, showing the jacket lining',[DST(0),HM(0),HM(.5),HM(1),HM(1),HM(.4)],SHE+', the inside lining of the jacket packed with rows of small brown bandaged bundles')
SS=P((X-6,66),-4,-0.2,-0.2,(X+8,G-6),(X-20,G),(16,22),(11,24))
clip(D,'sidestep','quick low sidestep, body ducks and slides, katana kept low in front',[KAM(),lerp(KAM(),SS,.6),SS,lerp(SS,KAM(),.5),KAM()],DRW)
GD=P((X,60),2,-0.2,-0.2,(X+12,G),(X-12,G-2),(20,-8),(10,-6),le=ELB_UP)
clip(D,'guard','raises the katana flat and slanted in front of the head to block, grin unchanged',[KAM(),lerp(KAM(),GD,.5),GD,GD],DRW)
KK=P((X-2,56),-12,-0.2,-0.2,(X+36,G-36),(X-10,G),(14,24),(10,26),lk=KNEE_UP)
clip(D,'kick','straight front push kick to shove the enemy away, katana held low',[KAM(),P((X,56),-4,-0.2,-0.2,(X+14,G-24),(X-10,G),(14,24),(10,26),lk=KNEE_UP),KK,KK,KAM()],DRW)
GRL=lambda lh: P((X+6,60),8,-0.2,-0.2,(X+20,G),(X-12,G-2),lh,('r',-2,30))
clip(D,'grab','reaches forward with the right hand, closes the fist and lifts the arm up high, katana low in the left hand',[KAM(),GRL((22,4)),GRL((30,0)),GRL((30,-6)),GRL((28,-14)),GRL((28,-16))],'holding a black katana low in the left hand, scabbard at the hip')
GS=P((X+16,70),36,-0.2,-0.2,(X+36,G),(X-6,G-2),(32,34),('r',-2,30))
clip(D,'grabslam','right fist raised high swings hard down to the front, body bending forward',[GRL((28,-16)),GRL((26,-20)),lerp(GRL((26,-20)),GS,.5),GS,GS,lerp(GS,KAM(10),.5),KAM(10)],'holding a black katana low in the left hand, scabbard at the hip')
LG=lambda t: P((X,59),6-14*t,-0.2,-0.2,(X+12,G),(X-12,G-2),(14,22+t),(10,24),tilt=-22*t)
clip(D,'laugh','throws the head back and laughs openly mid-fight, shoulders shaking, katana held loosely',[KAM(),LG(.5),LG(1),LG(.8),LG(1),LG(.4)],DRW)
NC=lambda tilt,lh: DST(0,lh,tilt)
clip(D,'namecall','lazily points with two fingers and jerks the chin, calling a subordinate by the wrong name',[DST(0),NC(0,(16,10)),NC(-4,(24,4)),NC(-10,(24,4)),NC(6,(22,6)),DST(0)],SHE)
def RLP(t,tilt): return P((X,56),4,0,0,(X+6,G),(X-4,G),(6,0) if t else (12,14),(5,1) if t else SAYA,tilt=tilt)
clip(D,'relight','puts a fresh cigarette in his mouth and cups both hands in front of it to light it, head bowed, then exhales',[DST(0),RLP(1,4),RLP(1,10),RLP(1,10),RLP(1,10),RLP(0,6),RLP(0,-8),RLP(0,-12),RLP(0,-4),DST(0)],SHE+', a cigarette in the mouth')
SR=lambda b=0: P((X-6,63+b),-4,-0.2,-0.2,(X+14,G),(X-22,G),(10,-4),(4,-2),le=ELB_UP,re=ELB_UP,tilt=-4)
clip(D,'super_ready','wide low stance, levels the katana horizontally at eye level pointing forward, both hands by the face, wide grin',[KAM(),lerp(KAM(),SR(),.5),SR(),SR(.5),SR(1),SR(.5)],DRW)
SC0=P((X-10,64),-8,-0.2,-0.2,(X+12,G),(X-26,G),('r',-16,22),('r',-14,24))
SC1=P((X+4,64),8,-0.25,-0.2,(X+24,G),(X-22,G),(20,16),(16,18))
SC2=P((X+12,63),14,-0.25,-0.2,(X+30,G),(X-18,G-2),(38,4),(34,6))
SC3=P((X+14,62),12,-0.25,-0.2,(X+32,G),(X-16,G-2),(30,-8),(26,-6))
clip(D,'super_cut','the building-splitting cut: coils the whole body far back, then sweeps the katana horizontally forward all the way through',[SR(),SC0,SC0,SC1,SC2,SC2,SC3,SC3,SC3,staged(SC3,KAM(14),.5)],DRW)
SE=[KAM(14),P((X+14,60),6,-0.2,-0.2,(X+28,G),(X+2,G-2),(30,30),('r',-2,30)),P((X+14,60),6,-0.2,-0.2,(X+28,G),(X+2,G-2),(30,30),('r',-2,30)),
    P((X+14,58),4,0,0,(X+26,G),(X+4,G),('r',16,24),('r',4,29)),P((X+14,57),3,0,0,(X+24,G),(X+6,G),('r',12,25),('r',4,29)),P((X+14,57),3,0,0,(X+24,G),(X+6,G),('r',9,26),('r',4,29)),
    P((X+14,56),2,0,0,(X+22,G),(X+8,G),HILT,SAYA),P((X+14,56),2,0,0,(X+22,G),(X+8,G),HILT,SAYA,tilt=-6),P((X+14,55),2,0,0,(X+20,G),(X+10,G),'down',SAYA,tilt=-6),P((X+14,55),2,0,0,(X+20,G),(X+10,G),'down',SAYA)]
clip(D,'super_end','flicks the blade, then slowly slides the katana home into the scabbard with a click and stands relaxed',SE,DRW)
HT=P((X-3,61),-12,-0.2,-0.2,(X+12,G),(X-13,G-2),(14,20),(10,22),head=(4,-8))
clip(D,'hit','light hit: upper body snaps back, the grin stays',[KAM(),HT,lerp(HT,KAM(),.5),KAM()],DRW)
STG=P((X-8,62),-20,-0.2,-0.2,(X+6,G-4),(X-20,G),(10,10),(4,16),head=(4,-8))
clip(D,'stagger','big stagger back two steps, then grins wider as if amused',[KAM(),HT,STG,lerp(STG,KAM(-4),.4),KAM(-4),KAM(-4)],DRW)
clip(D,'down','thrown backward through the air and lands on his back, katana still in hand',[K1,K2,K3,K4,K5,K5,K5],DRW)
GU1=P((X-4,80),-30,0,0,(X+20,G-14),(X+10,G-10),(10,8),(4,10),lk=KNEE_UP,rk=KNEE_UP)
clip(D,'getup','kips up from his back without using the hands, landing in a crouch and rising',[K5,U1,GU1,KNEEL((16,22),(11,24)),lerp(KNEEL((16,22),(11,24)),KAM(),.5),KAM()],DRW)
SK=P((X+2,60),6,-0.2,-0.2,(X+14,G),(X-12,G-2),(30,30),('r',-2,30))
clip(D,'shake','flicks the blood off the katana with a sharp downward snap, then sheathes it',[KAM(),P((X,60),2,-0.2,-0.2,(X+12,G),(X-12,G-2),(20,-6),('r',-2,30),le=ELB_UP),SK,SK,SE[4],SE[6]],DRW)
FLE=[SE[3],SE[5],SE[6],RLP(1,4),RLP(1,8),RLP(0,-8),DST(0,(6,-18)),DST(0,(4,-22)),DST(0,(6,-18)),DST(0)]
FLE[6]=P((X,55),2,0,0,(X+6,G),(X-4,G),(8,-16),SAYA,le=ELB_UP); FLE[7]=P((X,55),2,0,0,(X+6,G),(X-4,G),(4,-22),SAYA,le=ELB_UP); FLE[8]=FLE[6]
clip(D,'flee','loses interest: sheathes the katana, lights a cigarette and lazily raises one hand in a careless goodbye wave',FLE,SHE+', a cigarette in the mouth')
FH=KNEEL(('r',14,24),SAYA)
clip(D,'flee_hurt','wounded, drops to one knee with a hand on the hilt, grins, then explodes forward into a low dash',[KAM(),KNEEL((16,22),(11,24)),FH,FH,VA,VB],SHE)

# ════════════════════ 곽성주 과장 ════════════════════
S='seongju'
MG='holding one heavy rotary minigun in each hand at hip level, ammunition belts crossed over the armored chest, small loudspeaker horn on the shoulder plate'
GH=lambda d=0: ('r',12+d,27); GR2=lambda d=0: ('r',9+d,25)        # 앞·뒤 미니건 손(허리 앞)
SST=lambda b=0,lean=2,tilt=0: P((X,56+b),lean,0,0,(X+9,G),(X-7,G),'down','down',tilt=tilt)
SAM=lambda b=0,lean=4,d=0,tilt=0,dx=0: P((X+dx,59+b),lean,0,0,(X+13+dx,G),(X-11+dx,G),GH(d),GR2(d),tilt=tilt)
SBR=lambda b=0,j=0: jit(P((X-2,64+b),-4,0,0,(X+16,G),(X-18,G),GH(),GR2()),j,0,['ARM','ELBOW'])
def heavy(t,lh='down',rh='down',back=False):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t); c=-c if back else c
    lf=(X+2+10*c, G-3*max(0,-sn)); rf=(X+2-10*c, G-3*max(0,sn))
    return P((X+2,57+2*(1-abs(c))),3,0.08*c,0.15*c,lf,rf,lh,rh)
clip(S,'intro','stomps in with two heavy steps, halts, plants his feet and puffs out the chest to bellow',[heavy(0),heavy(.25),heavy(.5),heavy(.75),SST(1),SST(0,-2),SST(0,-6,-10),SST(0,-8,-14),SST(0,-8,-14),SST(0,-2)],MG)
clip(S,'idle','massive heavy idle, miniguns hanging at his sides, shoulders rising with breath',[SST(0),SST(0.5),SST(1),SST(1.5),SST(1),SST(0.5)],MG)
clip(S,'walk','very heavy slow walk, the whole body sinks on each step, miniguns swinging slightly',[heavy(i/8) for i in range(8)],MG)
TN=[P((X,57),2,s,0,(X+9,G),(X-7,G),'down','down') for s in (0,-0.4,-0.8,-1.2,-1.4,-1.4)]
clip(S,'turn','slow heavy turn of the whole body toward the viewer',TN,MG)
clip(S,'raise','lifts both miniguns from hanging to hip level, aiming forward',[SST(0),P((X,57),3,0,0,(X+11,G),(X-9,G),(8,30),(6,30)),P((X,58),3,0,0,(X+12,G),(X-10,G),(12,28),(9,27)),SAM(),SAM()],MG)
clip(S,'spinup','widens the stance and braces low, leaning into both miniguns as the barrels spin up',[SAM(),lerp(SAM(),SBR(),.4),SBR(),SBR(0.5),SBR(1),SBR(1)],MG)
clip(S,'fire','firing both miniguns, braced, shoulders and arms shaking with recoil',[SBR(0,0),SBR(1,-2),SBR(0,-1),SBR(1,-2),SBR(0,0),SBR(1,-1)],MG)
SW=lambda a: jit(P((X-2,64),-4+a*0.6,0,0,(X+16,G),(X-18,G),('r',12,27+a*0.3),('r',9,25+a*0.3)),0,a*0.4,['ARM','ELBOW'])
clip(S,'sweep','keeps firing while sweeping both miniguns up and down across the field, torso tilting',[SW(a) for a in (0,-6,-12,-14,-8,0,8,14,16,10,4,0)],MG)
OH=lambda b: P((X,62+b),20,0,0,(X+12,G),(X-10,G),(14,36),(10,36),tilt=18)
clip(S,'overheat','overheated: lowers both miniguns, hunches forward panting heavily',[SBR(),lerp(SBR(),OH(0),.5),OH(0),OH(1),OH(2),OH(1),OH(0),OH(1),OH(2),OH(0)],MG)
RLD=[SAM(),P((X,59),4,0,0,(X+13,G),(X-11,G),GH(),('r',-2,16)),P((X,59),6,0,0,(X+13,G),(X-11,G),(6,8),('r',-2,16)),P((X,59),8,0,0,(X+13,G),(X-11,G),(4,4),('r',-2,16),tilt=10),
     P((X,59),8,0,0,(X+13,G),(X-11,G),(8,10),('r',-2,16),tilt=10),P((X,59),8,0,0,(X+13,G),(X-11,G),(14,22),('r',-2,16),tilt=12),P((X,59),8,0,0,(X+13,G),(X-11,G),(16,24),('r',-2,16),tilt=12),
     P((X,59),6,0,0,(X+13,G),(X-11,G),(12,26),('r',-2,16),tilt=8),P((X,59),4,0,0,(X+13,G),(X-11,G),GH(),('r',0,18)),P((X,59),4,0,0,(X+13,G),(X-11,G),GH(),('r',4,22)),SAM(),SAM()]
clip(S,'reload','tucks one minigun under the arm, rips a fresh ammunition belt off his chest and feeds it in, then aims again',RLD,MG)
MP=lambda t: P((X,58),2-10*t,0,0,(X+11,G),(X-9,G),GH(),GR2(),head=(4,-6),tilt=-6-10*t)
clip(S,'megaphone','turns his face to the loudspeaker on his shoulder and bellows orders, chest heaving',[SAM(),MP(.3),MP(1),MP(1),MP(.8),MP(1),MP(1),MP(.2)],MG)
WL=lambda b=0: P((X-2,64+b),10,0,0,(X+18,G),(X-18,G),(18,8),(16,10))
clip(S,'wall','plants a very wide stance and holds both miniguns crossed upright in front of his body',[SAM(),lerp(SAM(),WL(),.5),WL(),WL(.5),WL(1),WL(.5)],MG)
ST1=P((X-2,56),-6,0,0,(X+14,G-30),(X-8,G),GH(),GR2(),lk=KNEE_UP)
ST2=P((X+2,64),8,0,0,(X+16,G),(X-10,G),GH(),GR2())
clip(S,'stomp','raises one massive leg high and stamps it down hard',[SAM(),lerp(SAM(),ST1,.5),ST1,ST1,ST2,SAM(0,6),SAM(0,4),SAM()],MG)
CH0=P((X+6,62),18,-0.2,-0.2,(X+22,G),(X-10,G-2),GH(),GR2())
CH1=P((X+20,64),30,-0.25,-0.2,(X+38,G),(X-2,G-6),('r',14,20),('r',10,18))
clip(S,'charge','lowers the armored shoulder and charges forward like a bulldozer, legs driving',[SAM(),CH0,runf(.25,GH(),GR2(),lean=24,stride=14),CH1,runf(.75,GH(),GR2(),lean=26,stride=14),CH1,lerp(CH1,SAM(0,0,0,0,14),.5),SAM(0,0,0,0,14)],MG)
SG0=P((X-4,60),-6,0,0,(X+12,G),(X-12,G-1),(-8,-12),GR2(),le=ELB_UP)
SG1=P((X+8,64),20,0,0,(X+24,G),(X-10,G-2),(32,22),GR2())
clip(S,'swing','swings one minigun like a club, from high behind down across the front',[SAM(),SG0,SG0,lerp(SG0,SG1,.5),SG1,SG1,lerp(SG1,SAM(),.5),SAM()],MG)
DS=lambda a,b: P((X+6,63),16,0,0,(X+22,G),(X-10,G-2),a,b,le=ELB_UP if a[1]<0 else ELB_DOWN,re=ELB_UP if b[1]<0 else ELB_DOWN)
clip(S,'doubleswing','smashes down with both miniguns in alternation, left, right, left, like hammers',[SAM(),DS((0,-16),GR2()),DS((30,26),(4,-14)),DS((28,28),(4,-14)),DS((4,-14),(28,26)),DS((2,-16),(30,28)),DS((30,26),(4,-14)),DS((30,28),(6,-10)),lerp(DS((30,28),(6,-10)),SAM(),.5),SAM()],MG)
PZ=[SAM(),P((X,59),4,0,0,(X+13,G),(X-11,G),GH(),('r',-8,6)),P((X,59),2,0,0,(X+13,G),(X-11,G),GH(),('r',-6,-6),re=ELB_UP),P((X,59),0,0,0,(X+13,G),(X-11,G),GH(),('r',0,-4),re=ELB_UP),
    P((X,59),-2,0,0,(X+13,G),(X-11,G),GH(),('r',4,0)),P((X,59),-2,0,0,(X+13,G),(X-11,G),GH(),('r',4,0)),P((X-4,59),-10,0,0,(X+13,G),(X-13,G),GH(),('r',4,0)),P((X-4,59),-8,0,0,(X+13,G),(X-13,G),GH(),('r',4,0)),
    P((X-2,59),-4,0,0,(X+13,G),(X-11,G),GH(),('r',4,0)),P((X,59),0,0,0,(X+13,G),(X-11,G),GH(),('r',-6,-6),re=ELB_UP),P((X,59),4,0,0,(X+13,G),(X-11,G),GH(),('r',-8,6)),SAM()]
clip(S,'panzer','keeps one minigun at the hip, lifts a short tube onto his shoulder with the other hand, rocks back',PZ,MG+', a short olive launcher tube')
RG=lambda a,t: P((X,57),-4,0,0,(X+10,G),(X-8,G),a,(8,26),tilt=t)
clip(S,'rage','pounds his armored chest with the fist still gripping a minigun, head thrown back roaring',[SST(0),RG((6,8),-8),RG((10,16),-12),RG((6,8),-16),RG((10,16),-16),RG((6,8),-18),RG((10,16),-18),RG((6,8),-14),RG((12,20),-10),SST(0)],MG)
clip(S,'hit_front','takes a hit without moving at all, only the head nods slightly',[SAM(),SAM(0,4,0,4),SAM()],MG)
HB=P((X+4,60),16,0,0,(X+14,G),(X-8,G-2),GH(),GR2(),tilt=8)
clip(S,'hit_back','hit from behind: the huge body lurches forward a step',[SAM(),HB,P((X+6,61),18,0,0,(X+18,G),(X-6,G-3),GH(),GR2(),tilt=10),lerp(HB,SAM(0,0,0,0,4),.5),SAM(0,0,0,0,4)],MG)
KN=lambda b=0: P((X,80+b),14,0,0,(X+16,G),(X-19,G-1),('a',X+30,G-2),(12,20),tilt=10)
clip(S,'kneel','his knee buckles and drops heavily, one minigun planted barrel-down to prop himself up',[SAM(),HB,lerp(HB,KN(),.4),lerp(HB,KN(),.8),KN(2),KN(),KN(1),KN()],MG)
clip(S,'kneel_up','pushes himself up from one knee leaning on the minigun, back to full height',[KN(),KN(-2),lerp(KN(),SAM(),.3),lerp(KN(),SAM(),.6),lerp(KN(),SAM(),.85),SAM(),SAM()],MG)
clip(S,'down','toppled: falls backward like a tree and crashes flat on his back',[SAM(),K1,K2,sh(K3,4),sh(K4,8),sh(K5,8),sh(K5,8),sh(K5,8)],MG)
GT=[sh(K5,8),sh(K5,8),P((X+2,94),-55,0,0,(X+22,G),(X+12,G),(6,10),('a',X-14,G),lk=KNEE_UP,rk=KNEE_UP),P((X+2,90),-40,0,0,(X+22,G),(X+12,G),(6,10),('a',X-14,G),lk=KNEE_UP,rk=KNEE_UP),
    P((X-4,86),-10,0,0,(X+16,G),(X-16,G-1),(14,14),('a',X-22,G)),KN(),KN(-2),lerp(KN(),SAM(),.4),lerp(KN(),SAM(),.8),SAM()]
clip(S,'getup','gets up very slowly: sits up, rolls onto a knee, plants a minigun and heaves himself upright',GT,MG)
SV=lambda a: P((X+4,59),8,0,0,(X+16,G),(X-10,G),a,GR2())
clip(S,'shove','sweeps one huge arm outward to the side while walking forward',[SAM(),SV((10,10)),SV((24,6)),SV((30,2)),SV((24,-4)),SAM()],MG)
LGS=lambda t: SAM(0,4-12*t,0,-18*t)
clip(S,'laugh','throws the head back in a booming laugh, belly shaking',[SAM(),LGS(.6),LGS(1),LGS(.8),LGS(1),LGS(.5)],MG)
UP=lambda b=0: P((X,58+b),-6,0,0,(X+12,G),(X-10,G),(10,-22),(6,-20),le=ELB_UP,re=ELB_UP,tilt=-14)
clip(S,'super_ready','hoists both miniguns high overhead and roars',[SAM(),lerp(SAM(),UP(),.4),lerp(SAM(),UP(),.8),UP(),UP(1),UP(),UP(1),UP()],MG)
SF=[jit(sh(P((X-2,64),-4-i*0.4,0,0,(X+16,G),(X-18,G),GH(),GR2()),-i*0.6),(-2 if i%2 else 0),0,['ARM','ELBOW']) for i in range(14)]
clip(S,'super_fire','both miniguns held level, recoil shoving his huge body backward as he braces',SF,MG)
FB=[heavy(i/8,GH(),GR2(),back=True) for i in range(8)]+[SAM(),SAM(0,2,0,-8),SST(0,-2,-10),SST(0)]
clip(S,'flee','walks backward while firing from the hip, then lowers the guns and bellows',FB,MG)

# ════════════════════ 일반 요원 3타입 ════════════════════
MANW={'sword':'black katana sheathed in a black scabbard at the left hip',
      'riot':'holding a compact black submachine gun',
      'burn':'two metal gas tanks strapped on the back, a hose to a long unlit metal nozzle wand held in both hands, nothing coming out of the nozzle'}
REST={'sword':('down',SAYA),'riot':(('r',14,26),('r',8,24)),'burn':(('r',16,28),('r',8,26))}
def common(t):
    lhR,rhR=REST[t]; W=MANW[t]
    st=lambda b=0,lh=lhR,rh=rhR,tilt=0: P((X,55+b),2,0,0,(X+6,G),(X-4,G),lh,rh,tilt=tilt)
    clip(t,'idle','standing at attention, breathing, identical posture',[st(0),st(.5),st(1),st(.5)],W)
    EAR=(-1,-8)
    clip(t,'alert','touches the earpiece with one hand, then points forward sharply',[st(),st(0,EAR,rhR),st(0,EAR,rhR,-4),P((X+2,57),6,0,0,(X+12,G),(X-6,G),(30,-2),rhR),P((X+2,57),6,0,0,(X+12,G),(X-6,G),(32,-3),rhR),st()],W)
    clip(t,'walk','plain uniform walk, same steps as everyone',[walkf(i/8,lhR if t!='sword' else swing(i/8)[0],rhR) for i in range(8)],W)
    clip(t,'run','running fast',[runf(i/8,lhR if t!='sword' else (8-14*math.cos(2*math.pi*i/8),14),rhR) for i in range(8)],W)
    rr=[runf(i/8,lhR if t!='sword' else (8,14),rhR) for i in range(4)]
    SKD=P((X+8,64),-6,0,0,(X+22,G),(X-8,G-2),lhR,rhR); RDY=P((X+4,62),8,0,0,(X+16,G),(X-12,G-2),lhR,rhR)
    clip(t,'burstin','runs in fast, skids to a stop with feet braced and drops into a ready stance',rr+[SKD,SKD,lerp(SKD,RDY,.5),RDY],W)
    clip(t,'chat','stands with one hand to the ear, talking and nodding',[st(0,EAR,rhR),st(0,EAR,rhR,4),st(0,EAR,rhR,8),st(0,EAR,rhR,2),st(0,EAR,rhR),st(0,EAR,rhR,6),st(0,EAR,rhR,2),st(0,EAR,rhR)],W)
    SAL=(4,-11)
    clip(t,'salute','snaps a sharp hand salute to the brow and shouts',[st(),st(0,(10,0),rhR),st(0,SAL,rhR,-4),st(0,SAL,rhR,-6),st(0,SAL,rhR,-4),st()],W)
    rdy=P((X,60),6,0,0,(X+12,G),(X-12,G-2),lhR,rhR)
    hh=P((X-3,61),-12,-0.2,-0.2,(X+12,G),(X-13,G-2),(10,16),(4,18),head=(4,-8))
    clip(t,'hit','hit reaction: upper body snaps back',[rdy,hh,lerp(hh,rdy,.5),rdy],W)
    sg=P((X-8,62),-20,-0.2,-0.2,(X+6,G-4),(X-20,G),(10,8),(2,14),head=(4,-8))
    clip(t,'stagger','staggers backward, arms flailing',[rdy,hh,sg,sg,lerp(sg,rdy,.5),rdy],W)
    clip(t,'down','knocked flying backward and lands on the back',[K1,K2,K3,K4,K5,K5,K5],W)
    clip(t,'getup','gets up from the back pushing off one hand',[K5,U1,U2,KNEEL(lhR,rhR),KNEEL(lhR,rhR),lerp(KNEEL(lhR,rhR),rdy,.5),rdy],W)
    gb=lambda k: P((X,49),2,0,0,(X+6+k,G-6),(X-4-k,G-8),(12,6),(10,8),tilt=-6)
    clip(t,'grabbed','feet dangling, legs kicking, both hands clawing up at his own throat',[gb(0),gb(4),gb(-3),gb(2)],W)
    clip(t,'die','killed: thrown back, crashes onto the back and lies motionless',[K1,K2,K3,K4,K5,K5,K5,K5],W)
for t in ('sword','riot','burn'): common(t)

# 검사부대
T='sword'; W=MANW[T]; WD='holding a black-bladed katana, empty black scabbard at the left hip'
KM=lambda d=0,b=0: P((X+d,60+b),6,-0.2,-0.2,(X+12+d,G),(X-12+d,G-2),(16,22),(11,24))
ZZ=lambda t: jit(runf(t,('r',8,27),SAYA,lean=26),0,3*math.sin(4*math.pi*t),['NOSE','EYE','EAR','NECK','SHOULDER','ELBOW','ARM'])
clip(T,'zigzag','very low weaving sprint, the body swaying side to side and bobbing, gaining speed with every sway, hand on the sword hilt',[ZZ(i/8) for i in range(8)],W)
GI=lambda b=0: P((X-2,62+b),10,-0.2,-0.2,(X+14,G),(X-14,G-2),('r',8,27),SAYA,tilt=4)
clip(T,'stance','iaido ready stance, hand on the hilt, knees bent',[GI(0),GI(.5),GI(1),GI(.5)],W)
clip(T,'iai','lunges forward low and draws the katana into one horizontal slash',[GI(),P((X+12,68),30,-0.2,-0.2,(X+32,G),(X-10,G-4),('r',8,27),SAYA),P((X+22,66),22,-0.25,-0.2,(X+42,G),(X-2,G-3),('r',14,24),('r',1,30)),P((X+26,62),12,-0.25,-0.2,(X+46,G),(X+2,G-2),(36,6),('r',-4,30)),
    P((X+26,62),10,-0.25,-0.2,(X+46,G),(X+2,G-2),(26,-2),('r',-4,30)),P((X+26,62),10,-0.25,-0.2,(X+46,G),(X+2,G-2),(26,-2),('r',-4,30)),lerp(P((X+26,62),10,-0.25,-0.2,(X+46,G),(X+2,G-2),(26,-2),('r',-4,30)),KM(26),.5),KM(26)],WD)
TC=lambda a,b,d,lean,ue=False: P((X+d,61),lean,-0.2,-0.2,(X+14+d,G),(X-12+d,G-2),a,b,le=ELB_UP if ue else ELB_DOWN,re=ELB_UP if ue else ELB_DOWN)
clip(T,'twocut','two quick cuts: a diagonal downward slash, then a rising return slash, stepping in',[KM(),TC((8,-20),(4,-18),2,0,True),TC((34,18),(30,20),8,18),TC((30,26),(26,26),8,20),TC((14,30),(10,30),10,14),TC((32,-8),(28,-6),12,4,True),TC((28,-14),(24,-12),12,2,True),KM(12)],WD)
clip(T,'deflect','two short quick flicks of the katana in front of the body',[KM(),TC((24,-6),(18,-2),0,6),TC((28,14),(22,16),0,6),TC((24,-6),(18,-2),0,6),KM()],WD)
clip(T,'parry','parries with the katana and answers with a quick cut',[KM(),TC((22,-8),(12,-6),-2,0,True),TC((22,-8),(12,-6),-2,0,True),TC((34,8),(30,10),8,14),TC((30,16),(26,18),8,14),KM(6)],WD)

# 진압부대
T='riot'; W=MANW[T]+' at the shoulder'
AM=lambda b=0,j=0: jit(P((X,59+b),4,-0.15,-0.1,(X+12,G),(X-10,G),(24,6),(8,4)),j,0,['ARM','ELBOW'])
clip(T,'aim','raises the submachine gun to the shoulder and aims down the sights',[P((X,55),2,0,0,(X+6,G),(X-4,G),('r',14,26),('r',8,24)),P((X,57),3,0,0,(X+9,G),(X-7,G),(18,14),(8,14)),AM(),AM()],W)
clip(T,'burst','rifle to the shoulder, the gun kicking back three times',[AM(),AM(0,-2),AM(0,-1),AM(0,-2),AM()],W)
KF=lambda j=0: jit(P((X,79),4,-0.15,-0.1,(X+16,G),(X-19,G-1),(24,6),(8,4)),j,0,['ARM','ELBOW'])
clip(T,'kneelfire','drops to one knee, rifle shouldered, the gun kicking back steadily',[AM(),lerp(AM(),KF(),.5),KF(),KF(-2),KF(),KF(-2)],W)
FT0=P((X,59),4,0,0,(X+12,G),(X-10,G),('r',14,24),('r',-10,26))
FT1=P((X+4,60),10,0,0,(X+14,G),(X-10,G),('r',14,24),(22,18))
clip(T,'flash','lowers the gun to one hand and lobs a small canister underhand with the other',[AM(),P((X,59),4,0,0,(X+12,G),(X-10,G),('r',14,24),('r',4,26)),FT0,FT0,lerp(FT0,FT1,.5),FT1,AM()],'holding a compact black submachine gun in one hand, a small grey canister in the other')
BT0=P((X-2,59),-4,0,0,(X+12,G),(X-10,G),(14,10),(4,12))
BT1=P((X+10,61),14,0,0,(X+24,G),(X-8,G-2),(30,0),(18,4))
clip(T,'butt','steps in and rams the stock of the submachine gun forward into a face',[AM(),BT0,BT0,BT1,BT1,AM()],W)
RD=[AM(),P((X,58),4,0,0,(X+11,G),(X-9,G),(14,14),(10,16),tilt=10),P((X,58),4,0,0,(X+11,G),(X-9,G),(14,14),('r',2,26),tilt=12),P((X,58),4,0,0,(X+11,G),(X-9,G),(14,14),('r',2,26),tilt=12),
    P((X,58),4,0,0,(X+11,G),(X-9,G),(14,14),(12,20),tilt=12),P((X,58),4,0,0,(X+11,G),(X-9,G),(14,14),(12,16),tilt=10),P((X,58),4,0,0,(X+11,G),(X-9,G),(14,14),(8,12),tilt=8),AM()]
clip(T,'reload','tilts the submachine gun, drops the magazine, slaps a fresh one in from the belt and racks it',RD,W)

# 소각부대
T='burn'; W=MANW[T]
NZ=lambda b=0,j=0,lean=6,dy=0: jit(P((X,61+b),lean,0,0,(X+14,G),(X-12,G-1),(22,20+dy),(10,22+dy)),j,0,['ARM','ELBOW'])
clip(T,'aim','braces and points the nozzle wand forward at hip height',[P((X,55),2,0,0,(X+6,G),(X-4,G),('r',16,28),('r',8,26)),lerp(P((X,55),2,0,0,(X+6,G),(X-4,G),('r',16,28),('r',8,26)),NZ(),.5),NZ(),NZ()],W)
clip(T,'flame','braces against strong backward push, nozzle wand held forward at the hip',[NZ(0,0),NZ(1,-1),NZ(0,-2),NZ(1,-1),NZ(0,0),NZ(1,-2)],W)
clip(T,'sweep','slowly sweeps the nozzle wand from high to low, braced',[NZ(0,0,4,dy) for dy in (0,-6,-10,-12,-8,-2,4,10,12,6)],W)
TS0=P((X-4,58),-6,0.1,0,(X+12,G),(X-10,G),('r',16,28),(-8,-12),re=ELB_UP)
TS1=P((X+4,60),10,-0.1,0,(X+16,G),(X-8,G),('r',16,28),(28,4))
clip(T,'toss','holds the nozzle low in one hand and hurls a small bottle overhand with the other',[NZ(),P((X,58),2,0,0,(X+12,G),(X-10,G),('r',16,28),('r',2,24)),TS0,TS0,lerp(TS0,TS1,.5),TS1,NZ()],W+', a small glass bottle with a rag')
VT=[NZ(),P((X,58),8,0,0,(X+12,G),(X-10,G),(22,26),(14,26),tilt=10),P((X,58),8,0,0,(X+12,G),(X-10,G),(22,26),(18,24),tilt=10),P((X,58),4,0,0,(X+12,G),(X-10,G),(18,28),('r',-6,8),re=ELB_UP,tilt=-4),
    P((X,58),4,0,0,(X+12,G),(X-10,G),(18,28),('r',-8,6),re=ELB_UP,tilt=-4),P((X,58),4,0,0,(X+12,G),(X-10,G),(18,28),('r',-6,8),re=ELB_UP,tilt=-4),P((X,58),4,0,0,(X+12,G),(X-10,G),(18,28),('r',2,22)),NZ()]
clip(T,'vent','taps the nozzle, then reaches back over the shoulder to twist the valve on the back tanks',VT,W)
BD1=P((X+6,58),24,0,0,(X+18,G),(X-6,G-6),(18,20),(10,20),tilt=10)
BD2=P((X+16,66),50,0,0,(X+26,G-10),(X-2,G-20),(30,6),(20,4))
BD3=P((X+26,86),80,0,0,(X+20,G-6),(X-10,G-12),('a',X+66,G-12),('a',X+60,G-8),lk=KNEE_UP,rk=KNEE_UP)
BD4=P((X+30,94),90,0,0,(X+8,G-2),(X-14,G-4),('a',X+68,G-2),('a',X+62,G-1),lk=KNEE_FWD,rk=KNEE_FWD,le=ELB_UP,re=ELB_UP)
clip(T,'burst_die','blown forward off his feet and crashes face down, motionless',[NZ(),BD1,BD2,BD3,BD4,BD4,BD4,BD4],W)

if __name__=='__main__':
    for w,c in CLIPS.items(): print(w,len(c),'clips',sum(len(v[2]) for v in c.values()),'frames')
    print('total',sum(len(c) for c in CLIPS.values()))
