# 고르고디오(장갑) 전투 동작 뼈대. 설계 docs/캐릭터제작서/동작설계_gorgodio.md 5.10. 캔버스 256×192, 발목선 G=176(발바닥 184), 골반 x=100.
# 맨몸보다 한 치수 큼. 움직임: 판금 무게(착지 무릎 깊게), 부스터 활강(발이 살짝 뜸, 상체 숙임). RIGHT = 가까운 쪽 = 앞손.
import math,sys
sys.path.insert(0,'.')
from rigbase import *
B=Body(256,192,100,176,TORSO=40,THIGH=25,SHIN=26,UARM=23,FARM=20,head=(9,-8),shw=8,hipw=7)
P=B.P; clip=B.clip; X=B.X; G=B.G; HY=127
DESC=('huge figure fully encased in near-future powered plate armor, dark blue-grey steel plates with black joints, thin glowing cyan lines, '
      'closed rounded helmet with a narrow cyan visor and no face, massive gauntlets, heavy armored boots, folded wing-shaped booster fins on the back')
BASE_KP={'NOSE':(114,77),'NECK':(106,84),'RIGHT SHOULDER':(86,86),'RIGHT ELBOW':(100,102),'RIGHT ARM':(112,94),
 'LEFT SHOULDER':(120,92),'LEFT ELBOW':(128,106),'LEFT ARM':(144,94),'RIGHT HIP':(94,122),'RIGHT KNEE':(80,150),'RIGHT LEG':(62,174),
 'LEFT HIP':(106,122),'LEFT KNEE':(128,144),'LEFT LEG':(130,172),'RIGHT EYE':(114,74),'LEFT EYE':(116,74),'RIGHT EAR':(102,74),'LEFT EAR':(104,74)}   # armor/base.png(후보 851 + 날개 부스터 편집 63)에 눈으로 맞춤
def STAND(b=0,lh=(16,32),rh=(10,34),tilt=0,lean=3,head=None): return P((X,HY+b),lean,0,0,(X+11,G),(X-9,G),lh,rh,tilt=tilt,head=head)
def GUARD(d=0,b=0): return P((X+d,132+b),10,0,0,(X+21+d,G),(X-19+d,G-1),(30,6),(22,10),le=('e',12,22),re=('e',8,22))
G0=GUARD()
def walkf(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,HY+2+3*abs(c)),6,0,0,(X+2+13*c,G-5*max(0,-sn)),(X+2-13*c,G-5*max(0,sn)),(26-6*c,10),(20+6*c,12),le=('e',12,22),re=('e',8,22))
def glide(t,lift=6):   # 부스터 활강: 상체 숙이고 무릎 굽혀 발이 바닥에서 살짝 뜸
    c=math.cos(2*math.pi*t)
    return P((X+4,HY+2-lift+c),24,0,0,(X+16,G-lift-2),(X-14,G-lift+2),(30,12),(20,18),le=('e',12,22),tilt=-14)

clip('a_arrive','armor assembles: lands in a deep crouch with knees bent, then rises heavily into a fighting stance',
     [P((X,150),24,0,0,(X+21,G),(X-19,G),(28,30),(20,32)),P((X,150),24,0,0,(X+21,G),(X-19,G),(28,30),(20,32)),P((X,142),16,0,0,(X+21,G),(X-19,G),(30,20),(22,22)),lerp(P((X,142),16,0,0,(X+21,G),(X-19,G),(30,20),(22,22)),G0,.5),G0])
clip('a_idle','heavy armored fighting stance, gauntlets raised in front, shoulders slowly rising and falling',[G0,GUARD(0,1),GUARD(0,1.5),GUARD(0,1)])
clip('a_walk','slow heavy armored walk, each step sinks into the knees, gauntlets held in front',[walkf(i/8) for i in range(8)])
clip('a_glide','hovering glide: leaning forward, knees bent, feet just above the ground, gauntlets forward',[glide(i/6) for i in range(6)])
JC=P((X,152),20,0,0,(X+19,G),(X-17,G),(30,24),(22,26))
JA=lambda h: P((X,118),4,0,0,(X+12,G-14-h),(X-10,G-10-h),(28,6),(22,10),lk=KNEE_FWD,rk=KNEE_FWD)
clip('a_jump','deep crouch, launches upward with a burst from the back, peak, then lands heavily into a deep crouch',[G0,JC,JA(4),JA(10),JA(8),JA(2),JC,lerp(JC,G0,.5)])
LD=P((X,154),22,0,0,(X+23,G),(X-21,G),(32,26),(-6,20))
clip('a_land','lands hard from a height in a deep crouch, one arm out, then rises',[LD,LD,lerp(LD,G0,.6)])
CR=P((X-2,152),28,0,0,(X+19,G),(X-27,G-2),('a',X+36,G),(18,22),tilt=-10)
clip('a_crouch','drops into a three-point stance: one knee down, one gauntlet fist planted on the ground',[G0,lerp(G0,CR,.4),lerp(G0,CR,.8),CR])
SW1=P((X-2,132),2,0,0,(X+21,G),(X-19,G-1),(-10,10),(22,10),re=('e',8,22))
SW2=P((X+6,134),16,0,0,(X+27,G),(X-17,G-2),(52,8),(20,12),re=('e',8,22))
clip('a_swat','armored backhand swat: the near arm sweeps wide from behind across the front at chest height',[G0,SW1,staged(SW1,SW2,.6),SW2,lerp(SW2,GUARD(4),.5),GUARD(4)])
HM1=P((X+2,130),0,0,0,(X+25,G),(X-17,G-1),(14,-34),(22,10),le=('e',8,-10),re=('e',8,22))
HM2=P((X+10,138),22,0,0,(X+31,G),(X-13,G-2),(38,32),(18,14))
clip('a_hammer','armored hammer fist: raises the gauntlet high and pounds straight down in front',[GUARD(4),HM1,HM1,staged(HM1,HM2,.6),HM2,lerp(HM2,GUARD(10),.5)])
AX1=P((X+8,128),-6,0,0,(X+33,G),(X-11,G-1),(12,-40),(10,-38),le=('e',8,-12),re=('e',6,-12))
AX2=P((X+18,150),32,0,0,(X+43,G),(X-7,G-1),(40,40),(36,40))
clip('a_axe','double axe handle: both gauntlets clasped high overhead, then slammed down with the whole body, knees bending',[GUARD(10),lerp(GUARD(10),AX1,.5),AX1,AX1,staged(AX1,AX2,.6),AX2,AX2,lerp(AX2,GUARD(18),.5)])
ST1=P((X-4,124),-6,0,0,(X+19,G-36),(X-13,G),(24,10),(14,16),lk=KNEE_UP); ST2=P((X+4,146),14,0,0,(X+27,G),(X-17,G),(30,20),(18,22))
clip('a_stomp','lifts the armored front leg high and stamps it down hard with a burst, knees bending',[G0,ST1,ST1,lerp(ST1,ST2,.6),ST2,lerp(ST2,G0,.5)])
LR=P((X+8,HY-2),20,0,0,(X+20,G-6),(X-16,G-4),'out',(16,20),tilt=-12)
clip('a_lariat','gliding lariat: the near arm thrown straight out to the side at neck height, sweeping through',[glide(0),lerp(glide(0),LR,.5),LR,LR,lerp(LR,G0,.5),G0])
DV1=P((X,112),-10,0,0,(X+16,G-30),(X-6,G-24),(26,-10),(20,-6)); DV2=P((X+14,124),-30,0,0,(X+40,G-6),(X+20,G-20),(10,-16),(4,-12))
clip('a_dive','in the air, tilts forward and dives down diagonally feet first in a stomping plunge',[JA(10),DV1,DV2,DV2,P((X+20,150),20,0,0,(X+41,G),(X+1,G),(36,24),(28,26)),lerp(P((X+20,150),20,0,0,(X+41,G),(X+1,G),(36,24),(28,26)),GUARD(20),.5)])
RB1=P((X+2,150),40,0,0,(X+21,G),(X-17,G),('a',X+38,G),('a',X+32,G),tilt=-20)
RB2=P((X,128),-4,0,0,(X+19,G),(X-17,G),(10,-40),(8,-38),le=('e',8,-12),re=('e',6,-12),tilt=-10)
RB3=P((X+10,132),18,0,0,(X+29,G),(X-11,G-2),(44,-12),(40,-10))
clip('a_rubble','bends down, rips up a heavy slab with both gauntlets, heaves it overhead and hurls it forward',[G0,RB1,RB1,lerp(RB1,RB2,.5),RB2,staged(RB2,RB3,.6),RB3,lerp(RB3,G0,.5)])
CH0=P((X-6,150),30,0,0,(X+15,G),(X-25,G),(24,24),(18,26))
CH1=P((X+10,140),50,0,0,(X+34,G-10),(X-22,G-14),'out',(14,26),tilt=-34)
CH2=P((X+12,142),60,0,0,(X+30,G-16),(X-24,G-20),'out',(12,28),tilt=-42)
CHB=P((X+8,140),-10,0,0,(X+31,G),(X-11,G),(30,10),(22,14))
clip('a_charge','crouches low, launches forward nearly horizontal, one gauntlet leading, then braces to a stop',[G0,CH0,CH1,CH2,CH2,CH1,CHB,G0])
VT=lambda b: P((X,HY+4+b),14,0,0,(X+11,G),(X-9,G),(20,30),(14,32),tilt=18)
clip('a_vent','stands with head bowed and arms lowered, shoulders heaving as the back vents open to cool',[VT(0),VT(1),VT(2),VT(1)])
GD=P((X-2,134),6,0,0,(X+21,G),(X-19,G-1),(22,-8),(18,-4),le=('e',16,14),re=('e',12,14),tilt=8)
clip('a_guard','both armored forearms brought together in front like a shield, head down behind them',[G0,lerp(G0,GD,.5),GD,GD])
def gw(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    q=dict(GD); return P((X+2,134+abs(c)),10,0,0,(X+21+6*c,G-4*max(0,-sn)),(X-17-6*c,G-4*max(0,sn)),(22,-8),(18,-4),le=('e',16,14),re=('e',12,14),tilt=8)
clip('a_guardwalk','advancing slowly behind both raised armored forearms like a shield, heavy steps',[gw(i/6) for i in range(6)])
BS=P((X-2,140),-4,0,0,(X+15,G-6),(X-25,G-4),(28,14),(22,16),tilt=-6)
clip('a_boost','a sudden sideways skid: body twists, knees bent, feet just off the ground, then settles',[G0,lerp(G0,BS,.6),BS,BS,lerp(BS,G0,.5),G0])
GB=P((X+4,128),-2,0,0,(X+23,G),(X-15,G),(40,-14),(20,14))
clip('a_grab','reaches out with one gauntlet and lifts something up by the neck at arm length',[G0,staged(G0,GB,.6),GB,jit(GB,0,-3,['RIGHT ARM','RIGHT ELBOW'])])
GH=P((X+6,130),8,0,0,(X+23,G),(X-13,G-2),(40,-16),(34,-8))
clip('a_grabhit','holding something up with one gauntlet, smashes the other gauntlet into it',[GB,P((X+2,128),-4,0,0,(X+23,G),(X-15,G),(40,-14),(2,14)),GH,lerp(GH,GB,.5)])
TH1=P((X-6,130),-14,0,0,(X+21,G),(X-19,G),(-16,-20),(16,14),le=('e',-8,-4)); TH2=P((X+12,136),28,0,0,(X+35,G),(X-11,G-3),(46,4),(10,22))
clip('a_throw','winds the held arm far back, twists the whole armored body and hurls forward, following through',[GB,lerp(GB,TH1,.5),TH1,TH1,staged(TH1,TH2,.6),TH2,TH2,lerp(TH2,G0,.5)])
SM=P((X+10,136),24,0,0,(X+31,G),(X-13,G-2),(30,0),(10,22),tilt=-10)
clip('a_smash','lowers the near shoulder and rams forward with a gauntlet punch to break through',[G0,lerp(G0,P((X-4,136),4,0,0,(X+19,G),(X-21,G),(8,20),(10,22)),.7),P((X-4,136),4,0,0,(X+19,G),(X-21,G),(8,20),(10,22)),staged(P((X-4,136),4,0,0,(X+19,G),(X-21,G),(8,20),(10,22)),SM,.6),SM,lerp(SM,G0,.5)])
PL1=P((X+4,136),10,0,0,(X+23,G),(X-17,G),(30,10),(28,14)); PL2=P((X,132),-10,0,0,(X+23,G),(X-17,G),(28,4),(26,8),tilt=-6)
clip('a_pillar','hugs a thick column in front with both arms, strains, twists and wrenches it, leaning back',[G0,PL1,PL1,PL2,jit(PL2,-2,0,['NECK','NOSE','EYE','EAR']),PL2,lerp(PL2,PL1,.5),G0])
def c2(t):
    c=math.cos(2*math.pi*t)
    return P((X+4,HY-4+c),18,0,0,(X+14,G-8),(X-12,G-4),(22,20),(18,22),tilt=-10)
clip('a_carry2','gliding forward with one person held in each arm against the chest, knees bent, feet off the ground',[c2(i/8) for i in range(8)])
SP1=P((X-6,152),30,0,0,(X+15,G),(X-25,G),(30,22),(24,24))
SP2=P((X+8,130),40,0,0,(X+28,G-14),(X-18,G-20),(36,8),(30,10),tilt=-30)
clip('a_super','crouches, clamps both arms around something in front, blasts forward and up, then lands heavily',[G0,SP1,SP1,SP2,SP2,SP2,JA(6),LD,lerp(LD,G0,.5)])
BK1=P((X-6,132),-18,0,0,(X+19,G),(X-17,G-2),(14,-4),(8,0),tilt=-14); BK2=P((X-4,150),30,0,0,(X+17,G),(X-23,G-2),('a',X+30,G),(14,26),tilt=16)
clip('a_break','armor critically damaged: staggers back, sways, then drops to one knee with a gauntlet on the ground',[BK1,lerp(BK1,BK2,.5),BK2,BK2])
SU1=P((X-10,112),-20,0,0,(X+2,G-34),(X-18,G-30),(20,-20),(-4,-14))
SU2=P((X+4,150),26,0,0,(X+25,G),(X-17,G),(40,24),(20,28))
SU3=P((X+10,140),20,0,0,(X+31,G),(X-11,G-2),(44,6),(18,22))
clip('a_support','flies in from above, lands in a crouch, shoves a gauntlet forward pinning something, then stands',[SU1,lerp(SU1,SU2,.5),SU2,SU2,SU3,SU3,SU3,lerp(SU3,G0,.5),G0,G0])

PBASE=[G0,GUARD(0,1),STAND(0)]
REF_POSE=G0
REF_PNG='../armor/ref.png'

if __name__=='__main__':
    bad=B.audit()
    for b in bad: print('AUDIT',*b)
    print(len(B.CLIPS),'clips',sum(len(v[2]) for v in B.CLIPS.values()),'frames, audit',len(bad))
