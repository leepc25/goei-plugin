# 박민성 뼈대. 설계: docs/캐릭터제작서/동작설계_백일몽.md (0장 규칙, 3장 표의 박민성 칸)
# 키 98px → sc 1.05. 큰 몸, 겁먹어 살짝 웅크린 어깨, 동작 크게. 공격 = 장비 가방(럭비·운반·방패 밀기). 가방·업힌 사람은 코드가 그림(손 좌표)
import math,sys
import common as c
from common import P,lerp,handfirst,hipfirst,sh,tail,cyc,KNEE_FWD,KNEE_UP,ELB_UP
import life
c.setup(1.05,g=100,x=64)
X,G,Y=c.X,c.G,c.HIPY
S=life.build(life.Style(rest='down',lean=6,tilt=2,stride=10,lift=4,bob=1.0,swing=5,wlean=6,rstride=18,rlean=18,rswing=8,sitlean=6,head=(6,-7),wide=2,knees=1))
ST,walkf,runf,SIT,DEEP=S.ST,S.walkf,S.runf,S.SIT,S.DEEP
c.set_akp(ST())
BAG=dict(lh=('r',14,14),rh=('r',12,16),le=('e',8,12),re=('e',6,13))                    # 가방을 앞에 듦
STN=lambda d=0,b=0: P((X+d,Y+6+b),10,-0.1,-0.1,(X+14+d,G),(X-14+d,G),**BAG)
S0=STN()
cl=c.clip
PIG=dict(lh=('r',-6,22),rh=('r',-8,20),le=('e',-2,12),re=('e',-4,12))                 # 업은 사람 다리를 받치는 손
cl('idle','big man catching his breath, shoulders heaving a little, nervous smile, sweat on his temple',tail([ST(),ST(.6),ST(1),ST(.6)],True))
HS_=lambda u: ST(lh=('r',2,-12+2*u),le=('e',10,-2))
cl('headscratch','scratches the back of his head and lets out a big sigh',tail([ST(),HS_(0),HS_(1),HS_(0),HS_(1),ST()],False))
cl('stance','nervous ready stance holding something big in front of him like a shield, knees bent, trembling',tail([S0,STN(0,.6),STN(1,1),STN(0,.6)],True))
cl('engage','"oh come on" shoulders sag with a groan, then he hefts something up in front of him',tail([ST(),ST(2,4),lerp(ST(2),S0,.5),S0],False))
cl('walk','big heavy walk, arms swinging, slightly hunched and nervous',tail(cyc(walkf),True))
def stepf(t):
    cc=math.cos(2*math.pi*t)
    return P((X+3*t,Y+6),10,-0.1,-0.1,(X+14+3*t+3*cc,G),(X-14+3*t-3*cc,G),**BAG)
cl('step','edges forward carefully, holding something big in front of him, knees bent',tail(cyc(stepf,6),True))
cl('run','big thumping run, clutching his load, panicked face',tail(cyc(lambda t: runf(t,lh=('r',12,14),rh=('r',10,15),le=('e',6,12),re=('e',4,12))),True))
JP=P((X,Y-10),8,0,0,(X+8,G-16),(X-6,G-14),('r',16,6),('r',-6,8),le=('e',10,6),re=('e',-6,8))
cl('jump','low heavy jump with a grunt, arms flung out',tail([S0,DEEP(0,-6),lerp(DEEP(0,-6),JP,.5),JP,JP,lerp(JP,DEEP(0,-8),.5),DEEP(0,-8),S0],False))
CR=lambda b=0: P((X-6,Y+24+b),30,0,0,(X+10,G),(X-8,G),('r',18,16),('r',14,18),le=('e',8,12),re=('e',6,13),lk=KNEE_UP,rk=KNEE_UP)
cl('crouch','huddles down low behind something he holds in front, making his big body small',tail([S0,lerp(S0,CR(),.5),CR(),CR(.5)],False))
def crw(t):
    cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X-6+2*cc,Y+24+abs(sn)),30,0,0,(X+10+5*cc,G-2*max(0,-sn)),(X-8-5*cc,G-2*max(0,sn)),('r',22+3*cc,16),('r',18+3*cc,18),le=('e',10,12),re=('e',8,13),lk=KNEE_UP,rk=KNEE_UP)
cl('crouchwalk','crouched low, pushes something along the floor ahead of him as he creeps',tail(cyc(crw,7),True))
STP=lambda u: P((X-2,Y+4),-4,0,0,(X+10+16*u,G-14+14*u),(X-10,G),**BAG,lk=KNEE_UP)
cl('stomp','lifts his front foot and shoves forward with the sole, pushing something down',tail([S0,STP(0),STP(.5),STP(1),STP(1),S0],False))
OP=lambda b=0: P((X-4,Y+30+b),40,0,0,(X+8,G),(X-10,G),('r',12,20),('r',10,22),head=(5,-5),tilt=10,le=('e',6,12),re=('e',4,12),lk=KNEE_UP,rk=KNEE_UP)
cl('objectpose','curls into a stiff lump and freezes like an object, trembling slightly, sweating',tail([S0,lerp(S0,OP(),.5),OP(),OP(.5),OP(),OP(.5)],False))
BS0=P((X+2,Y+6),6,0,0,(X+14,G),(X-14,G),('r',10,10),('r',8,12),le=('e',6,10),re=('e',4,11))
BS1=P((X+4,Y+6),14,-0.1,0,(X+16,G),(X-12,G),('r',26,12),('r',24,14),le=('e',14,10),re=('e',12,11))
cl('bagshove','shoves a big bag forward hard with both hands from his chest',tail([S0,BS0,BS1,BS1,STN(2)],False))
BW0=P((X+2,Y+6),4,0.5,0.4,(X+16,G),(X-12,G),('r',-6,12),('r',-8,14),le=('e',-4,10),re=('e',-6,11))
BW1=P((X+8,Y+7),12,-0.5,-0.4,(X+20,G),(X-10,G),('r',30,8),('r',26,10),le=('e',16,6),re=('e',14,8))
cl('bagswing','winds back and swings a heavy bag in a wide flat arc in front of him, hips turning first',tail([STN(2),BW0,BW0,hipfirst(BW0,BW1,.5),BW1,BW1,STN(8)],False))
BL0=P((X+6,Y+2),-6,0,0,(X+18,G),(X-10,G),('r',6,-24),('r',4,-23),le=('e',8,-10),re=('e',6,-10))
BL1=P((X+14,Y+12),26,0,0,(X+28,G),(X-6,G),('r',28,24),('r',26,25),le=('e',16,10),re=('e',14,11))
cl('bagslam','lifts a heavy bag high overhead with both hands and slams it straight down, dropping his whole weight',tail([STN(8),lerp(STN(8),BL0,.5),BL0,BL0,lerp(BL0,BL1,.6),BL1,BL1,STN(14)],False))
def bd(t):
    cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+4+12*t,Y+8+abs(sn)),-14,0.1,0,(X+16+12*t+8*cc,G-3*max(0,-sn)),(X-10+12*t-8*cc,G-3*max(0,sn)),('r',-6,10),('r',-8,12),le=('e',-2,10),re=('e',-4,10))
cl('backdoor','turns his broad back and barges forward backside first, pushing with his back and shoulders',tail([runf(.25),bd(0),bd(.25),bd(.5),bd(.75),STN(14)],False))
BD=lambda u: P((X,Y-12+20*u),8+30*u,0,0,(X+8,G-18+18*u),(X-6,G-16+16*u),('r',16,18),('r',14,19),le=('e',8,12),re=('e',6,13),lk=KNEE_UP,rk=KNEE_UP)
cl('bagdrop','in the air, tucks his body and drops heavily, landing seated on his bag',tail([BD(0),BD(.3),BD(.6),BD(1),BD(1)],False))
BO=lambda u: P((X+2,Y+10+8*u),20+16*u,0,0,(X+12,G),(X-10,G),('r',22,20+4*u),('r',18,22+4*u),le=('e',10,13),re=('e',8,13),lk=KNEE_UP)
cl('bagopen','sets a bag down in front, crouches and rummages inside with both hands',tail([S0,BO(0),BO(1),BO(.6),BO(1)],False))
GT=lambda u: P((X+4*u,Y+5),6+6*u,-0.3,0,(X+14,G),(X-12,G),('r',-8+38*u,0-14*u),('r',10,14),le=('e',-2+16*u,6-8*u),re=('e',6,12))
cl('gearthrow','throws something overhand with a big wind-up, whole body behind it',tail([STN(),GT(0),GT(.5),GT(1),GT(1)],False))
RPK=lambda u: P((X+2,Y+12),24,0,0,(X+12,G),(X-10,G),('r',24-4*u,18+6*u),('r',20+4*u,20-4*u),le=('e',12,13),re=('e',10,13),lk=KNEE_UP)
cl('repack','crouched over a bag, stuffs things back in and yanks the zip shut',tail([BO(1),RPK(0),RPK(1),RPK(0),RPK(1),S0],False))
MW=lambda u: ST(lh=('r',4+4*u,-12+6*u),rh=('r',-4+2*u,-10+6*u),le=('e',10,-2+4*u),re=('e',4,-1+4*u))
cl('mufflerwrap','throws a long cloth over his head and wraps it around his shoulders, nervous',tail([ST(),MW(0),MW(.5),MW(1)],False),'a long woven cloth')
DI=lambda b: ST(b,6,lh=('r',8,14),rh=('r',6,15),le=('e',3,12),re=('e',2,12))
cl('disguisedidle','stands stiffly trying to blend in, trembling, sweat dripping, eyes darting',tail([DI(0),DI(.6),DI(0),DI(.6)],True))
cl('bagblock','braces behind a big bag held up in front of his chest and face, shoulders hunched',tail([P((X,Y+8+b),12,-0.1,0,(X+12,G),(X-14,G),('r',14,0),('r',12,2),le=('e',10,8),re=('e',8,9)) for b in (0,.4,.6,.4)]+[P((X,Y+8),12,-0.1,0,(X+12,G),(X-14,G),('r',14,0),('r',12,2),le=('e',10,8),re=('e',8,9))],False))
FL=lambda u: P((X-2*u,Y+6+16*u),14+16*u,0,0,(X+10,G),(X-12,G),('r',6,-4+8*u),('r',2,-2+8*u),head=(5,-6),tilt=10*u,le=('e',8,4),re=('e',4,5),lk=KNEE_UP)
cl('flinch','flinches in place, ducking his head and hunching his huge body small, arms over his head',tail([S0,FL(.6),FL(1),FL(1),FL(.5),S0],False))
PW0=P((X+6,Y+6),20,0,0,(X+18,G),(X-10,G),('r',22,8),('r',20,10),le=('e',12,8),re=('e',10,9))
PW1=P((X+10,Y+8),28,0,0,(X+26,G),(X-6,G),('r',24,10),('r',22,12),le=('e',12,8),re=('e',10,9))
cl('pinwall','grabs someone in a bear hold and drives forward, shoving them back with his legs',tail([S0,PW0,lerp(PW0,PW1,.5),PW1,PW1,PW1],False))
BB=lambda u: P((X+10,Y+8),28-10*u,0,0,(X+26,G),(X-6,G),('r',24,10),('r',10+10*u,-12+14*u),le=('e',12,8),re=('e',6,-4+8*u))
cl('bagbonk','holding someone with one arm, bonks them with a bag in the other hand',tail([BB(0),BB(.5),BB(1),BB(0)],False))
SA0=P((X+6,Y+8),10,0,0,(X+20,G),(X-8,G),('r',16,12),('r',14,13),le=('e',8,12),re=('e',6,12))
SA1=P((X+14,Y+6),22,0,0,(X+28,G),(X-4,G),('r',34,6),('r',32,8),le=('e',16,4),re=('e',14,6))
cl('shoveaway','shoves someone away hard with both arms, sending them tumbling',tail([PW1,SA0,lerp(SA0,SA1,.5),SA1,SA1,SA1,lerp(SA1,STN(10),.5),STN(10)],False))
SU=P((X-4,Y+26),30,0,0,(X+10,G),(X-10,G),('r',-4,20),('r',-6,18),le=('e',-2,12),re=('e',-4,12),lk=KNEE_UP,rk=KNEE_UP)
def pig(t,run=False):
    cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t); st,ln,lf=(18,24,8) if run else (9,16,3)
    return P((X+2,Y+6+abs(cc)),ln,0.05*cc,0.1*cc,(X+2+st*cc,G-lf*max(0,-sn)),(X+2-st*cc,G-lf*max(0,sn)),**PIG)
cl('rescuerun','hauls everyone onto his back and sprints forward, head down, roaring',tail([SU,lerp(SU,pig(0,True),.5),pig(0,True),pig(.25,True),pig(.5,True),pig(.75,True),pig(0,True),pig(.25,True),pig(.5,True)],False))
MS=lambda u: ST(lh=('r',16+6*u,-4-4*u),rh=('r',10,10),le=('e',10,0),re=('e',4,12))
cl('mufflershare','pulls a cloth from his shoulders and drapes it over someone beside him',tail([ST(),MS(0),MS(.5),MS(1),MS(1),ST()],False),'a long woven cloth')
cl('carryrun','runs at full speed with someone on his back, arms hooked under their legs',tail(cyc(lambda t: pig(t,True)),True))
cl('support','jogs in, tosses a bag of supplies forward, gives a big thumbs-up "you got this!", jogs off',tail([walkf(0),walkf(.25),GT(0),GT(1),ST(lh=('r',14,0),le=('e',10,6)),ST(lh=('r',14,0),le=('e',10,6)),walkf(.5)],False))
cl('shoulderup','squats, hauls a person up onto his back and stands up under the weight',tail([ST(),DEEP(),SU,lerp(SU,pig(0),.4),lerp(SU,pig(0),.8),pig(0)],False))
cl('piggy_idle','standing with someone on his back, hands hooked under their legs, puffing',tail([pig(0),sh(pig(0),0,1),sh(pig(0),0,1.5),sh(pig(0),0,1)],True))
cl('piggy_walk','walks carrying someone on his back, bent forward under the weight',tail(cyc(pig),True))
cl('piggy_run','runs carrying someone on his back, bent forward, panting',tail(cyc(lambda t: pig(t,True)),True))
PK=lambda u: P((X,Y+6),12-10*u,0,0,(X+10+20*u,G-20*u+4*u),(X-8,G),**PIG,lk=KNEE_UP)
cl('piggy_kick','with someone on his back, kicks straight forward with his front foot',tail([pig(0),PK(.4),PK(1),PK(1),pig(0)],False))
def dw(t):
    cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+1,Y+2+0.6*abs(cc)),4,0.05*cc,0.1*cc,(X+1+6*cc,G-2*max(0,-sn)),(X+1-6*cc,G-2*max(0,sn)),('r',8,14),('r',6,15),le=('e',3,12),re=('e',2,12))
cl('disguisewalk','walks stiffly in small steps trying to blend in, trembling and sweating, cloth over his head',tail(cyc(dw),True))
TEXT={
 'stepup':'climbs stairs heavily, puffing, arms swinging','stepover':'steps over a low edge with a big awkward stride',
 'liesit':'lying on his back, sits up with a groan and a heave','handswork':'does hand work at waist height, tongue out in concentration',
 'handshead':'grabs his head with both hands, panicking','seatmouth':'seated, eats a big mouthful happily',
 'seathold':'seated, holds up a phone and smiles at it','holdlook':'holds a photo at chest height and looks at it fondly',
 'handear':'holds a phone to his ear, nodding eagerly','sweep':'sweeps the floor in big energetic strokes',
 'liehold':'lying on his side, holding a phone up in front of his face','carry2_idle':'stands holding a heavy load against his chest, knees bent',
 'carry2_walk':'walks carrying a heavy load in both arms, knees bent, using his legs','carry2_run':'runs carrying a heavy load in both arms',
 'carry1_idle':'stands holding something in one hand, the other arm swinging','carry1_walk':'walks holding something in one hand',
 'carry1_run':'runs holding something in one hand','turn':'turns around in a big movement to face the viewer',
 'fall':'falling, flailing with a scream','land':'lands heavily, nearly falling on his rear, catching himself',
 'ladder':'climbs slowly and heavily, puffing','mantle':'struggles to haul his big body onto a ledge',
 'vault':'rolls over a waist-high obstacle clumsily','crawl':'crawls, his big body squeezing through',
 'sneak':'tiptoes with exaggerated care, trembling','idle_light':'clutches a flashlight in both hands in front of him',
 'walk_light':'walks clutching a flashlight in both hands, scared','run_light':'runs clutching a flashlight',
 'lookback':'looks around nervously over each shoulder','hide':'crouches small with both hands over his mouth',
 'door':'pushes a door open with his back and shoulders','doorclose':'walking, bumps something shut behind him with his back',
 'knock':'knocks timidly with one knuckle','push':'pushes with his whole body, legs driving','inspect':'squats and pokes something on the floor with one finger, nervous',
 'leadhand':'walks with an arm around someone shoulders, guiding them','bow':'a big deep bow, very polite',
 'elevwait':'waits, shifting from foot to foot','floorsit':'flops down to sit on the floor','floorrest':'sits on the floor using a bag as a pillow, catching his breath',
 'hurtidle':'clutches a wound, wincing loudly','limp':'limps heavily, wincing','fear':'trembles all over, sweating, but stays in place',
 'nausea':'covers his mouth and crouches, about to be sick','collapse':'drops heavily onto the floor','bedlie':'lying on his back hugging a blanket',
 'victory':'throws both arms up, nearly crying with relief','chairsit':'sits heavily, the chair looking small under him','typing':'types slowly with two big fingers',
 'gearcheck':'checks items from a bag one by one','tie':'tugs at a tight necktie, half choking','seatrest':'stretches out in a chair',
 'seatthink':'seated, scratching his head, thinking hard','doze':'seated, head back, mouth open, asleep','yawn':'a huge long yawn',
 'stretch':'a full-body stretch with a groan','hairflip':'shakes his short hair out','brushteeth':'brushes his teeth with lots of foam',
 'gesture':'talks with big wide arm gestures','armscross':'listens with arms crossed, nodding','nod':'nods eagerly several times',
 'headshake':'waves a hand side to side, "no no"','wave':'waves both arms big and friendly','handshake':'grabs a hand with both hands and shakes it warmly',
 'pat':'claps someone on the back twice','point':'points with a shaky finger','shrug':'an exaggerated shrug','hug':'a big crushing bear hug, crying',
 'laugh':'laughs loudly, head back','glad':'throws both fists up happily','cry':'bawls openly, wiping his eyes','wallcry':'leans on a wall and sobs',
 'kneelcry':'on his knees, bent over crying','sad':'shoulders slumped, sighing','shout':'screams in panic, arms up','deskslam':'slams both fists on a surface',
 'surprise':'jumps in fright','startlefall':'jumps back and lands on his rear','plopdown':'drops to the floor with a thump',
 'embarrassed':'rubs his cheek shyly, smiling','annoyed':'a long sigh, head drooping','think':'scratches his head, thinking','bored':'rummages idly in a bag',
 'pickup':'squats down and picks something up with both hands','toss':'throws something big overhand','drink':'gulps a drink down',
 'eat':'takes a huge bite','bandage':'wraps a bandage around his arm, wincing','hit':'staggers back from a hit','down':'knocked down, rolls over',
 'getup':'gets up with a grunt, hands on knees','tired':'squats, panting hard','idle_pipe':'grips a bar tightly in both hands',
 'walk_pipe':'walks gripping a bar in both hands','idle_shotgun':'hugs a shotgun to his chest','walk_shotgun':'walks hugging a shotgun',
 'run_shotgun':'runs hugging a shotgun','pipe':'swings a bar like a baseball bat with both hands','shotgun':'fires a shotgun with his eyes squeezed shut',
}
life.register(S,TEXT)
if __name__=='__main__':
    print(len(c.CLIPS),'clips',sum(len(v[2]) for v in c.CLIPS.values()),'frames'); print('audit',c.audit()[:20])
