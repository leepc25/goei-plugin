# 이자헌 뼈대. 설계: docs/캐릭터제작서/동작설계_백일몽.md (0장 규칙, 3장 표의 이자헌 칸)
# 키 100px(쟈알디 93) → sc 1.075. 꼿꼿, 표정 0, 머리 높이 고정, 팔 안 흔듦. 공격 = 해머피스트·잡아뜯기·두 손 내리찍기(철거 작업·유도 끌기)
import math,sys
import common as c
from common import P,lerp,handfirst,hipfirst,sh,tail,cyc,KNEE_FWD,KNEE_UP,ELB_UP
import life
c.setup(1.075,g=100,x=64)
X,G,Y=c.X,c.G,c.HIPY
S=life.build(life.Style(rest='back',lean=0,stride=11,lift=3,bob=0.2,swing=0,wlean=0,rstride=17,rlean=8,rswing=4,sitlean=0,head=(6,-8)))
ST,walkf,runf,SIT,DEEP=S.ST,S.walkf,S.runf,S.SIT,S.DEEP
c.set_akp(ST())
# 전투 자세: 정자세 그대로, 장갑 손만 앞으로 내림
STN=lambda d=0,b=0: P((X+d,Y+2+b),2,-0.2,-0.1,(X+12+d,G),(X-10+d,G),('r',16,16),('r',12,18),le=('e',8,12),re=('e',5,13))
S0=STN()
cl=c.clip
cl('idle','rigid upright idle like a statue, hands clasped behind his back, expressionless, only breathing',tail([ST(),ST(.3),ST(.5),ST(.3)],True))
GV=lambda d: ST(lh=('r',14,10),rh=('r',12+d,9-d),le=('e',8,12),re=('e',6,12))
cl('gloves','pulls each fingertip of his white work gloves tight one by one, face expressionless',tail([ST(),GV(0),GV(1),GV(2),GV(1),ST()],False))
cl('stance','upright ready stance, knees barely bent, gloved hands lowered in front, completely calm',tail([S0,STN(0,.3),STN(0,.5),STN(0,.3)],True))
TIE=ST(lh=('r',5,2),le=('e',9,9))
cl('engage','tugs his necktie once, then lowers both gloved hands in front and closes them',tail([ST(),TIE,lerp(TIE,S0,.5),S0],False))
cl('walk','long heavy stride, upper body rigid and upright, hands clasped behind, no arm swing',tail(cyc(walkf),True))
cl('step','walks straight in at the same steady pace with gloved hands lowered in front, no hesitation',tail(cyc(lambda t: walkf(t,stride=10,lh=('r',16,16),rh=('r',12,18),le=('e',8,12),re=('e',5,13)),6),True))
cl('run','heavy upright run, small arm movement, head level, big body',tail(cyc(runf),True))
JP=P((X,Y-14),2,0,0,(X+8,G-20),(X-6,G-18),('r',12,10),('r',8,12),le=('e',6,12),re=('e',4,12),lk=KNEE_FWD,rk=KNEE_FWD)
cl('jump','low heavy jump off both feet, body stays upright, lands flat',tail([S0,DEEP(0,-12),lerp(DEEP(0,-12),JP,.5),JP,JP,lerp(JP,DEEP(0,-14),.5),DEEP(0,-14),S0],False))
KN=P((X,Y+18),0,0,0,(X+14,G),(X-18,G),('r',14,18),('r',10,20),le=('e',6,12),re=('e',4,12),lk=KNEE_FWD,rk=KNEE_UP)
cl('crouch','drops to one knee with his upper body perfectly upright',tail([S0,lerp(S0,KN,.5),KN,KN],False))
def kw(t):
    cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+1,Y+18+abs(sn)),0,0,0,(X+14+5*cc,G-2*max(0,-sn)),(X-18-5*cc,G),('r',14,18),('r',10,20),le=('e',6,12),re=('e',4,12),lk=KNEE_FWD,rk=KNEE_UP)
cl('crouchwalk','shuffles forward on one knee, upper body upright and rigid',tail(cyc(kw,7),True))
FP=lambda u: P((X+2,Y+20),10+20*u,0,0,(X+14,G),(X-18,G),('r',20,-4+28*u),('r',10,20),le=('e',10,-8+18*u),re=('e',4,12),lk=KNEE_FWD,rk=KNEE_UP)
cl('floorpunch','from one knee, raises his fist high and hammers it straight down onto the floor in front',tail([KN,FP(0),FP(.5),FP(1),FP(1),KN],False))
HL=lambda a: P((X,Y+18),0,0,0,(X+14,G),(X-18,G),('r',14,18),('r',10,20),head=(6,-9),tilt=-6*a,le=('e',6,12),re=('e',4,12),lk=KNEE_FWD,rk=KNEE_UP)
cl('heatlook','kneeling, lifts his head and stares unblinking into the darkness ahead, perfectly still',tail([KN,HL(.5),HL(1),HL(1),HL(1),HL(.5)],False))
# 3연타: 1 앞손 해머피스트(내려침, 2px) → 2 뒷손 잡아뜯기(6px 전진·당김) → 3 두 손 깍지 내리찍기(12px)
HM0=P((X+1,Y+2),2,-0.2,-0.1,(X+13,G),(X-10,G),('r',14,-10),('r',12,18),le=('e',10,-4),re=('e',5,13))
HM1=P((X+3,Y+4),8,-0.2,-0.1,(X+15,G),(X-9,G),('r',30,16),('r',12,18),le=('e',16,4),re=('e',5,13))
cl('hammer','raises the near fist and hammers it straight down with the bottom of the fist, body weight dropping',tail([S0,HM0,lerp(HM0,HM1,.6),HM1,HM1,STN(2)],False))
RP0=P((X+6,Y+3),8,0.2,0.2,(X+18,G),(X-6,G),('r',14,16),('r',34,4),le=('e',8,12),re=('e',18,4))
RP1=P((X+4,Y+3),-2,-0.1,-0.1,(X+18,G),(X-6,G),('r',14,16),('r',8,10),le=('e',8,12),re=('e',4,14))
cl('rip','rear hand reaches far, grabs and rips backward hard toward his hip, upper body leaning back',tail([STN(2),RP0,RP0,hipfirst(RP0,RP1,.5),RP1,STN(6)],False))
SL0=P((X+6,Y),-4,0,0,(X+18,G),(X-6,G),('r',6,-20),('r',4,-19),le=('e',8,-8),re=('e',6,-8))
SL1=P((X+12,Y+8),24,0,0,(X+26,G),(X-4,G),('r',26,22),('r',24,23),le=('e',16,8),re=('e',14,9))
cl('slam2','clasps both fists overhead and smashes them straight down in front, whole body dropping into it',tail([STN(6),lerp(STN(6),SL0,.5),SL0,SL0,lerp(SL0,SL1,.6),SL1,SL1,STN(12)],False))
def sw(t):
    cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+8*t,Y+0.2*abs(cc)),2,0.05*cc,0.1*cc,(X+8*t+10*cc,G-3*max(0,-sn)),(X+8*t-10*cc,G-3*max(0,sn)),('r',22,4+8*t),('r',10,18),le=('e',12,6),re=('e',4,13))
cl('shoulderwalk','does not run: keeps walking in and sweeps whatever is ahead aside with the back of his hand',tail([sw(0),sw(.2),sw(.4),sw(.6),sw(.8),STN(10)],False))
AH=lambda u: P((X,Y-14+6*u),6+16*u,0,0,(X+8,G-20+6*u),(X-6,G-18+6*u),('r',8+16*u,-18+38*u),('r',6+16*u,-17+38*u),le=('e',8+6*u,-8+16*u),re=('e',6+6*u,-7+16*u),lk=KNEE_FWD,rk=KNEE_FWD)
cl('airhammer','in the air, raises both clasped fists overhead and hammers them down below',tail([AH(0),AH(0),AH(.5),AH(1),AH(1)],False))
LF=lambda u: P((X-2*u,Y+1),-2*u,0,0,(X+8,G),(X-8,G),('r',8,10-26*u),('r',4,11-26*u),le=('e',8,6-14*u),re=('e',4,7-14*u))
cl('lift','lifts something heavy in both hands from chest height up over his head, upright',tail([S0,LF(.4),LF(.8),LF(1),LF(1)],False))
HV=lambda u: P((X+6*u,Y+1+2*u),-4+20*u,0,0,(X+14,G),(X-8,G),('r',4+26*u,-16+14*u),('r',0+26*u,-15+14*u),le=('e',4+10*u,-8+8*u),re=('e',2+10*u,-7+8*u))
cl('heave','throws something heavy from over his head forward with both hands, body following through',tail([HV(0),HV(.5),HV(1),HV(1)],False))
TR=lambda u: P((X+4,Y+2),8-10*u,0,0,(X+16,G),(X-8,G),('r',26-10*u,6+4*u),('r',22-10*u,8+4*u),le=('e',14-4*u,6),re=('e',12-4*u,7))
cl('tear','grips something fixed in front with both gloved hands and tears it off, leaning back once',tail([S0,TR(0),TR(0),TR(1),TR(1)],False))
KC0=P((X+2,Y+2),4,-0.2,0,(X+14,G),(X-8,G),('r',22,-10),('r',10,16),le=('e',12,-2),re=('e',5,13))
KC1=P((X+2,Y+4),6,-0.2,0,(X+14,G),(X-8,G),('r',22,18),('r',10,16),le=('e',12,8),re=('e',5,13))
cl('knifecut','draws a small knife and cuts one straight vertical slit in the air from head height down',tail([S0,KC0,lerp(KC0,KC1,.5),KC1,KC1],False),'a small butter knife in his near hand')
KW=lambda d: P((X+3,Y+3),8,-0.2,0,(X+14,G),(X-8,G),('r',24+d,6),('r',26-d,8),le=('e',12,6),re=('e',13,7))
cl('knifewide','both gloved hands pry apart something in front at chest height, steady force',tail([KW(0),KW(1.5),KW(0),KW(1.5)],True))
AG=lambda b: P((X,Y+2+b),2,-0.2,0,(X+12,G),(X-10,G),('r',12,-4),('r',10,0),le=('e',10,6),re=('e',8,8))
cl('armguard','raises both bare forearms upright in front of his face and chest, feet planted',tail([S0,AG(0),AG(.3),AG(0)],True))
SW1=P((X+14,Y+2),4,0,0,(X+26,G),(X+4,G),('r',20,4),('r',16,10),le=('e',10,8),re=('e',8,10))
cl('swapstep','takes one firm step forward and sideways, stepping in front of someone, arms out to shield',tail([S0,lerp(S0,SW1,.4),lerp(S0,SW1,.8),SW1,SW1,STN(14)],False))
GL0=P((X+4,Y+2),6,-0.2,0,(X+16,G),(X-8,G),('r',30,-6),('r',10,16),le=('e',14,0),re=('e',5,13))
GL1=P((X+2,Y+1),0,-0.2,0,(X+14,G),(X-8,G),('r',22,-14),('r',10,16),le=('e',12,-4),re=('e',5,13))
cl('headlift','reaches out and grips something at head height with one gloved hand, then lifts it up',tail([S0,GL0,GL0,GL1,GL1,GL1],False))
DM=lambda u: P((X+2,Y+1),0-4*u,0,0,(X+14,G),(X-8,G),('r',22,-14),('r',24-12*u,-4+10*u),le=('e',12,-4),re=('e',12-4*u,4+4*u))
cl('dismantle','holding something up in one hand, the other hand grips and rips a piece off with a short pull',tail([DM(0),DM(.5),DM(1),DM(1)],False))
GS1=P((X+8,Y+10),26,0,0,(X+22,G),(X-6,G),('r',30,26),('r',14,18),le=('e',16,12),re=('e',6,13))
cl('groundslam','slams what he holds overhead straight down onto the floor in front of him',tail([GL1,DM(0),lerp(GL1,GS1,.4),lerp(GL1,GS1,.8),GS1,GS1,GS1,STN(8)],False))
EXW=lambda t: walkf(t,stride=10,lh=('r',16,14),rh=('r',12,18),le=('e',8,12),re=('e',5,13))
EX1=P((X+4,Y+1),0,-0.2,0,(X+16,G),(X-8,G),('r',22,-14),('r',26,-6),le=('e',12,-4),re=('e',14,2))
EX2=P((X+4,Y+1),-4,-0.2,0,(X+16,G),(X-8,G),('r',22,-14),('r',12,8),le=('e',12,-4),re=('e',6,12))
cl('exorcise','walks straight in, seizes the head of something with one hand and tears it apart with the other',tail([EXW(0),EXW(.25),EXW(.5),GL0,EX1,EX2,EX1,EX2,STN(4)],False))
BH=lambda u: P((X,Y+2),2,0.2,0.2,(X+12,G),(X-10,G),('r',12,16),('r',-10-14*u,6-4*u),le=('e',8,12),re=('e',-6-6*u,8))
cl('backhand','without turning around, swings the back of his rear hand hard behind him',tail([S0,BH(.5),BH(1),BH(1),lerp(BH(1),S0,.5),S0],False))
DS=lambda u: P((X-2+16*u,Y+2+4*u),-6+30*u,0.3-0.6*u,0.2-0.4*u,(X+14,G),(X-10,G),('r',-6+34*u,-6+16*u),('r',-8+34*u,-4+16*u),le=('e',-2+18*u,4+6*u),re=('e',-4+18*u,6+6*u))
cl('doorswing','holding a huge slab in both hands, swings it in a wide horizontal arc in front of him',tail([S0,DS(0),DS(0),DS(.4),DS(.8),DS(1),DS(1),STN(6)],False))
SP0=P((X-6,Y+2),2,0,0,(X+6,G),(X-16,G),('r',22,6),('r',10,16),le=('e',12,6),re=('e',5,13))
cl('support','steps in through something torn open, delivers one hammer blow, then stands rigid',tail([SP0,lerp(SP0,S0,.5),S0,HM0,HM1,HM1,STN(2),ST()],False))
cl('shieldhold','holds a big flat slab upright in front of his body with both hands, braced',tail([P((X,Y+3),4,-0.2,0,(X+12,G),(X-10,G),('r',18,-2+b),('r',16,14+b),le=('e',10,6),re=('e',8,12)) for b in (0,.3,.5,.3)]+[P((X,Y+3),4,-0.2,0,(X+12,G),(X-10,G),('r',18,-2),('r',16,14),le=('e',10,6),re=('e',8,12))],False))
PT0=P((X+6,Y+4),10,-0.2,0,(X+18,G),(X-6,G),('r',32,4),('r',10,16),le=('e',16,4),re=('e',5,13))
PT1=P((X,Y+2),-4,0.2,0.1,(X+14,G),(X-8,G),('r',-4,14),('r',10,16),le=('e',2,10),re=('e',5,13))
cl('pullthrough','plunges one arm forward into a gap up to the elbow, grabs and yanks something out past his side',tail([S0,PT0,PT0,lerp(PT0,PT1,.5),PT1,PT1],False))
TEXT={
 'stepup':'climbs stairs with a heavy even step, upper body rigid, hands clasped behind',
 'stepover':'steps over a low edge with a long precise stride, upper body upright',
 'liesit':'lying on his back, sits straight up in one stiff motion like a hinge',
 'handswork':'standing upright, precise steady hand work at waist height, expressionless',
 'handshead':'runs both gloved hands back over his short white hair once, face blank',
 'seatmouth':'seated perfectly upright, lifts food to his mouth with exact even motions',
 'seathold':'seated upright, holds something up in one hand and reads it without expression',
 'holdlook':'standing rigid, holds something at chest height and examines it, face blank',
 'handear':'holds a phone to his ear, standing perfectly upright, the other hand behind his back',
 'sweep':'sweeps the floor with exact even strokes, upper body rigid',
 'liehold':'lying on his side, holding something up in front of his face, very still',
 'carry2_idle':'stands upright holding a heavy load against his chest with ease',
 'carry2_walk':'walks with a long even stride carrying a heavy load against his chest with ease',
 'carry2_run':'runs upright carrying a heavy load against his chest with ease',
 'carry1_idle':'stands holding a heavy thing in one hand as if it weighed nothing, other hand behind',
 'carry1_walk':'walks holding a heavy thing in one hand as if it weighed nothing',
 'carry1_run':'runs upright holding a heavy thing in one hand',
 'turn':'turns his whole rigid body at once to face the viewer, no head lead',
 'fall':'falling with his body kept stiff and upright, limbs barely moving',
 'land':'lands heavily flat on both feet without bending much, then stands upright',
 'ladder':'climbs hand over hand mostly with arm strength, body close',
 'mantle':'pulls himself onto a ledge in one strong arm movement and stands upright',
 'vault':'clears a waist-high obstacle by stepping up and over it with a long stride',
 'crawl':'crawls low and slow on elbows and knees, steady',
 'sneak':'does not sneak: walks forward normally but slowly, gloved hands lowered in front',
 'idle_light':'stands upright holding a flashlight straight ahead at chest height, unmoving',
 'walk_light':'walks with a long stride holding a flashlight straight ahead at chest height',
 'run_light':'runs upright holding a flashlight straight ahead',
 'lookback':'turns his whole upper body and head back to look behind, then faces front again',
 'hide':'does not hide: crouches only slightly and keeps staring forward, ready',
 'door':'grips a handle at waist height and wrenches it straight off, then walks through',
 'doorclose':'walking, reaches back and pushes something shut with one flat hand',
 'knock':'knocks exactly three times with a gloved knuckle at head height',
 'push':'pushes forward with one flat gloved hand, body barely leaning, steady steps',
 'inspect':'goes down on one knee and grips something on the floor to test it, face blank',
 'leadhand':'walks with a long stride, pulling someone behind him by the wrist',
 'bow':'an exact fifteen-degree bow from the waist, back straight, then upright',
 'elevwait':'stands perfectly rigid facing ahead, hands clasped behind, not moving at all',
 'floorsit':'lowers himself to sit on the floor cross-legged, back perfectly straight',
 'floorrest':'sits on the floor cross-legged with a perfectly straight back, only breathing',
 'hurtidle':'injured but standing rigidly upright, breathing slightly heavier, face blank',
 'limp':'limps dragging one leg while his upper body stays rigid and upright',
 'fear':'stands calmly staring ahead, completely unafraid, perfectly still',
 'nausea':'swallows once, otherwise completely still and upright',
 'collapse':'his knees finally give, he pitches forward stiffly and falls flat face down',
 'bedlie':'lying flat and straight on his back like a statue, hands at his sides',
 'victory':'peels off his work gloves one after the other, standing upright',
 'chairsit':'sits down slowly and exactly upright like a carved statue, hands on knees',
 'typing':'seated upright, typing slowly and precisely with two fingers',
 'gearcheck':'checks his gloves and a small knife one by one, exact and methodical',
 'tie':'adjusts his necktie exactly straight with both hands',
 'seatrest':'seated upright like a statue, hands on his knees, eyes open, unmoving',
 'seatthink':'seated upright, completely still for a long moment, thinking',
 'doze':'seated upright, his eyes simply close while his body stays exactly the same',
 'yawn':'blinks once slowly instead of yawning, standing rigid',
 'stretch':'rolls his neck slowly to each side, body otherwise still',
 'hairflip':'smooths his white hair back once with his palm',
 'brushteeth':'brushes his teeth with exact even strokes, standing upright',
 'gesture':'talks with one hand raised to point flatly, body completely still',
 'armscross':'listens with hands clasped behind his back, upright and still',
 'nod':'one single precise nod: "Yes."',
 'headshake':'one single precise head shake: "I refuse."',
 'wave':'raises one hand once at shoulder height and lowers it, no waving',
 'handshake':'steps forward, shakes a hand exactly three times, steps back',
 'pat':'rests one hand on a shoulder and leaves it there without patting',
 'point':'points straight ahead with a gloved hand, arm fully extended',
 'shrug':'tilts his head very slightly instead of shrugging',
 'hug':'puts his arms around someone stiffly, his body staying straight',
 'laugh':'switches on a perfect charming smile for a moment, then it vanishes instantly',
 'glad':'stands upright, his face relaxes by the smallest amount',
 'cry':'stands upright with no expression while tears run down',
 'wallcry':'stands with one hand resting flat on a wall, head barely lowered',
 'kneelcry':'kneels with his back straight, hands on his thighs, head slightly bowed',
 'sad':'stands upright, head lowered by a few degrees',
 'shout':'says "Get down." flatly, sweeping one hand downward, body still',
 'deskslam':'puts one hand down on a surface with small motion but crushing force',
 'surprise':'blinks once, otherwise does not react',
 'startlefall':'does not fall back: takes half a step forward instead, ready',
 'plopdown':'sits down slowly and exactly on the floor with a straight back',
 'embarrassed':'stands upright and states something plainly, completely unembarrassed',
 'annoyed':'stares straight ahead, perfectly still and upright',
 'think':'stands perfectly still for a long moment, thinking',
 'bored':'stands perfectly still and upright, waiting',
 'pickup':'bends his knees, not his back, and picks something up with one hand',
 'toss':'tosses something underhand with one flat motion',
 'drink':'drinks in one go, standing upright',
 'eat':'eats with exact even bites, standing upright',
 'bandage':'wraps a bandage tight around his forearm without any expression',
 'hit':'takes a hit and barely moves, only his head turns slightly',
 'down':'knocked off his feet, falls backward stiff as a board',
 'getup':'gets up from the floor in one smooth motion without using his hands much',
 'tired':'stands upright, only his eyes move slower',
 'idle_pipe':'stands upright holding a heavy bar resting over his shoulder',
 'walk_pipe':'walks upright with a heavy bar resting over his shoulder',
 'idle_shotgun':'stands upright holding a shotgun low in one hand',
 'walk_shotgun':'walks upright holding a shotgun low in one hand',
 'run_shotgun':'runs upright holding a shotgun in one hand',
 'pipe':'smashes a heavy bar straight down like a crowbar, from overhead to the floor',
 'shotgun':'fires a shotgun one-handed, ignoring the recoil',
}
life.register(S,TEXT)
if __name__=='__main__':
    print(len(c.CLIPS),'clips',sum(len(v[2]) for v in c.CLIPS.values()),'frames'); print('audit',c.audit()[:20])
