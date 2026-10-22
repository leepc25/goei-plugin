# 은하제 뼈대. 설계: docs/캐릭터제작서/동작설계_백일몽.md (0장 규칙, 3장 표의 은하제 칸)
# 키 88px → sc 0.95. 처진 어깨, 한쪽 다리에 무게, 팔짱이 기본. 공격 = 경찰 체포술(손목 잡기 → 팔꿈치 눌러 숙이기 → 뒤로 꺾어 수갑)
import math,sys
import common as c
from common import P,lerp,handfirst,hipfirst,sh,tail,cyc,KNEE_FWD,KNEE_UP,ELB_UP
import life
c.setup(0.95,g=100,x=66)
X,G,Y=c.X,c.G,c.HIPY
S=life.build(life.Style(rest='cross',lean=-2,tilt=4,stride=9,lift=3,bob=0.5,swing=0,wlean=4,rstride=18,rlean=20,rswing=6,sitlean=-8,head=(6,-7),wide=1))
ST,walkf,runf,SIT,DEEP=S.ST,S.walkf,S.runf,S.SIT,S.DEEP
c.set_akp(ST())
STN=lambda d=0,b=0: P((X+d,Y+4+b),6,-0.2,-0.1,(X+14+d,G),(X-14+d,G),('r',20,10),('r',4,18),le=('e',10,8),re=('e',0,12))   # 앞손 펴서 앞, 뒷손 허리
S0=STN()
cl=c.clip
cl('idle','tired slouch with arms crossed, weight on one leg, cold flat face, slow breathing',tail([ST(),ST(.4),ST(.7),ST(.4)],True))
CG=lambda u: ST(lh=('r',10,4-8*u),rh='cross',le=('e',8,8-4*u))
cl('cigarette','takes a cigarette out, looks at it, weighs it in her fingers, then puts it back unlit',tail([ST(),CG(0),CG(1),CG(1),CG(0),ST()],False),'a single cigarette in her fingers')
cl('stance','arrest-ready stance: front open hand forward at chest height, rear hand at the hip, knees bent',tail([S0,STN(0,.4),STN(0,.7),STN(0,.4)],True))
cl('engage','uncrosses her arms with a long sigh and drops into a ready stance',tail([ST(),ST(1),lerp(ST(1),S0,.5),S0],False))
cl('walk','tired walk, shoulders slumped, arms crossed, slight slouch',tail(cyc(walkf),True))
def stepf(t):
    cc=math.cos(2*math.pi*t)
    return P((X+3*t,Y+4),6,-0.2,-0.1,(X+14+3*t+3*cc,G),(X-14+3*t-3*cc,G),('r',20,10),('r',4,18),le=('e',10,8),re=('e',0,12))
cl('step','wary sideways shuffle forward in a ready stance, eyes on the target',tail(cyc(stepf,6),True))
cl('run','runs with her head down and shoulders hunched, arms pumping',tail(cyc(runf),True))
JP=P((X,Y-16),6,0,0,(X+10,G-22),(X-8,G-18),('r',14,6),('r',-4,10),le=('e',8,8),re=('e',-4,10))
cl('jump','an ordinary jump, knees tucked, arms out for balance',tail([S0,DEEP(0,-8),lerp(DEEP(0,-8),JP,.5),JP,JP,lerp(JP,DEEP(0,-10),.5),DEEP(0,-10),S0],False))
SQ=lambda b=0: P((X-2,Y+28+b),26,0,0,(X+10,G),(X-6,G),('r',16,18),('r',12,20),le=('e',6,12),re=('e',4,13),lk=KNEE_UP,rk=KNEE_UP)
cl('crouch','squats down low on her heels, forearms resting on her knees',tail([S0,lerp(S0,SQ(),.5),SQ(),SQ(.5)],False))
def sqw(t):
    cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X-2,Y+28+abs(sn)),26,0,0,(X+10+5*cc,G-2*max(0,-sn)),(X-6-5*cc,G-2*max(0,sn)),('r',16,18),('r',12,20),le=('e',6,12),re=('e',4,13),lk=KNEE_UP,rk=KNEE_UP)
cl('crouchwalk','shuffles sideways in a low squat',tail(cyc(sqw,7),True))
AC=lambda u: P((X,Y+28),30+10*u,0,0,(X+10,G),(X-6,G),('a',X+26,G-6+4*u),('r',14,16),le=('e',12,12),re=('e',4,13),lk=KNEE_UP,rk=KNEE_UP)
cl('anklecuff','from a squat, reaches down to the floor in front and snaps something around an ankle',tail([SQ(),AC(0),AC(1),AC(1),AC(0),SQ()],False))
MD=lambda r: P((X-6,96),-6,0,0,(X+14,G),(X+10,G-1),('r',14,10),('r',10,12),tilt=24,le=('e',8,12),re=('e',6,12),lk=KNEE_UP,rk=KNEE_UP)
cl('mapdraw','sitting on the floor against a wall, head down, scribbling quickly in a small notebook',tail([SQ(),lerp(SQ(),MD(0),.5),MD(0),MD(1),MD(0),MD(1)],False),'a small notebook and pen')
WG0=P((X+3,Y+4),8,-0.3,-0.1,(X+17,G),(X-12,G),('r',36,6),('r',4,18),le=('e',18,4),re=('e',0,12))
WG1=P((X+1,Y+4),4,-0.2,-0.1,(X+16,G),(X-13,G),('r',26,10),('r',4,18),le=('e',12,8),re=('e',0,12))
cl('wristgrab','front hand shoots out and snatches a wrist, then pulls it in toward her hip',tail([S0,handfirst(S0,WG0,.6),WG0,WG1,WG1,STN(2)],False))
AB0=P((X+5,Y+5),12,0.2,0.1,(X+19,G),(X-10,G),('r',26,12),('r',22,2),le=('e',12,8),re=('e',12,4))
AB1=P((X+6,Y+8),24,0.2,0.1,(X+20,G),(X-10,G),('r',28,20),('r',26,16),le=('e',14,10),re=('e',14,10))
cl('armbar','holds a wrist with one hand and presses down on the elbow with the other, folding someone forward',tail([STN(2),AB0,lerp(AB0,AB1,.5),AB1,AB1,STN(5)],False))
CF0=P((X+8,Y+5),14,0,0,(X+22,G),(X-8,G),('r',22,18),('r',18,22),le=('e',10,12),re=('e',8,14))
CF1=P((X+10,Y+8),20,0,0,(X+24,G),(X-6,G),('r',26,22),('r',22,24),le=('e',12,12),re=('e',10,14))
cl('cuff','twists an arm behind someone and snaps handcuffs on with a quick downward motion',tail([STN(5),AB1,CF0,CF0,CF1,CF1,CF1,STN(10)],False),'metal handcuffs in her hand')
CT0=P((X+14,Y+4),14,0,0,(X+28,G),(X-4,G),('r',30,4),('r',28,8),le=('e',16,4),re=('e',14,6))
CT1=P((X+16,Y+4),-6,0.3,0.3,(X+26,G),(X+6,G),('r',-4,4),('r',-8,8),le=('e',2,4),re=('e',-2,6))
cl('collartwist','running in, grabs a collar with both hands and spins, flinging someone past her hip',tail([runf(.25),CT0,CT0,hipfirst(CT0,CT1,.5),CT1,STN(16)],False))
AW=lambda u: P((X,Y-14+8*u),8+20*u,0,0,(X+8,G-20+8*u),(X-6,G-18+8*u),('r',14+10*u,-6+30*u),('r',4,10),le=('e',10+4*u,0+12*u),re=('e',-2,10))
cl('aircuff','in the air, drives one hand down to slap a cuff onto something below as she lands',tail([AW(0),AW(.4),AW(.8),AW(1),AW(1)],False),'metal handcuffs in her hand')
RR=lambda u: ST(lh=('r',14,6),rh=('r',12-4*u,4-6*u),le=('e',8,10),re=('e',6,6-4*u))
cl('ringready','takes out a pair of handcuffs and twirls them once around a finger',tail([ST(),RR(0),RR(.5),RR(1),RR(1)],False),'metal handcuffs on her finger')
CT=lambda u: P((X+4*u,Y+3),6+4*u,-0.2,0,(X+14,G),(X-12,G),('r',4+30*u,-4+8*u),('r',4,18),le=('e',6+12*u,4),re=('e',0,12))
cl('cufftoss','flicks a pair of handcuffs forward underhand like a short throw',tail([CT(0),CT(.5),CT(1),CT(1)],False),'metal handcuffs')
CB=lambda u: P((X-2*u,Y+4),2-6*u,0,0,(X+12,G),(X-12,G),('r',30-20*u,8),('r',4,18),le=('e',14-8*u,8),re=('e',0,12))
cl('cuffback','yanks an invisible chain back toward herself with one hand and catches the cuffs',tail([CB(0),CB(.4),CB(.8),CB(1),CB(1)],False))
NB=lambda r: P((X-4,Y+2),-6,0,0,(X+6,G),(X-6,G),('r',14,8),('r',12,10+r),tilt=22,le=('e',8,12),re=('e',6,12))
cl('notebook','presses her back to a wall, opens a small notebook and reads it intently',tail([ST(),lerp(ST(),NB(0),.5),NB(0),NB(1)],False),'a small notebook and pen')
cl('notebookhold','back against a wall, writing fast in a small notebook, head down',tail([NB(0),NB(1),NB(0),NB(1)],True),'a small notebook and pen')
CV=lambda b: P((X-6,Y+6+b),-10,0,0,(X+6,G),(X-12,G),('r',8,14),('r',2,18),head=(7,-7),tilt=-6,le=('e',4,12),re=('e',-2,12))
cl('cover','flattens her back and side against cover, knees bent, peeking forward',tail([S0,CV(0),CV(.3),CV(0)],True))
PB0=P((X+4,Y+4),10,-0.2,0,(X+16,G),(X-12,G),('r',34,4),('r',30,8),le=('e',16,4),re=('e',14,6))
PB1=P((X-14,Y+6),-6,0,0,(X-2,G),(X-28,G),('r',18,10),('r',12,14),le=('e',10,8),re=('e',6,10))
cl('pushback','shoves hard with both palms and uses the rebound to hop back two steps',tail([S0,PB0,PB0,lerp(PB0,PB1,.5),PB1,STN(-14)],False))
KD0=P((X+6,Y+4),10,0,0,(X+18,G),(X-10,G),('r',30,8),('r',26,12),le=('e',14,6),re=('e',12,8))
KD1=P((X+4,Y+10),24,0,0,(X+16,G),(X-10,G),('r',22,22),('r',18,20),le=('e',12,12),re=('e',10,12))
cl('kneeldown','grabs an arm, twists it behind someone and pushes them down to their knees',tail([S0,KD0,KD0,lerp(KD0,KD1,.5),KD1,KD1],False))
CL=lambda u: P((X+4,Y+10),24,0,0,(X+16,G),(X-10,G),('r',22,22-4*u),('r',18+2*u,20+2*u),le=('e',12,12),re=('e',10,12))
cl('cufflock','holding someone kneeling, snaps cuffs onto their twisted wrists',tail([CL(0),CL(1),CL(0),CL(1)],False),'metal handcuffs')
PP=lambda u: P((X+6,Y+12+10*u),30+20*u,0,0,(X+18,G),(X-8,G),('r',24,24+6*u),('r',20,24+6*u),le=('e',12,14),re=('e',10,14),lk=KNEE_UP)
cl('pronepin','pushes someone face down onto the floor and pins them with a knee and both hands',tail([KD1,PP(.3),PP(.6),PP(1),PP(1),PP(1),PP(1),PP(1)],False))
PC=lambda u: ST(lh=('r',-2,-4),rh=('r',12,10),le=('e',8,4),re=('e',6,12),tilt=-4)
cl('phonecall','plugs a power bank into her phone, raises it to her ear and calls someone, terse',tail([ST(),ST(lh=('r',14,10),rh=('r',12,12),le=('e',8,12),re=('e',6,12)),ST(lh=('r',14,8),rh=('r',13,9),le=('e',8,11),re=('e',7,11)),PC(0),PC(0),PC(0),PC(0),ST(lh=('r',-2,-4),le=('e',8,4),rh='cross'),ST()],False),'a phone in her hand')
CC=lambda u: P((X+6*u,Y+3),6+6*u,-0.3,0,(X+16,G),(X-12,G),('r',6+30*u,-2+6*u),('r',4,18),le=('e',6+12*u,4),re=('e',0,12))
cl('chaincuff','whips a long invisible chain around in a quick loop and snaps it forward',tail([S0,CC(0),CC(.3),CC(.6),CC(1),CC(1)],False))
TP=lambda u: ST(lh=('r',14+10*u,8-2*u),rh=('r',12,10),le=('e',8+4*u,10),re=('e',6,12))
cl('expose','tears a page out of her notebook and holds it out firmly to someone',tail([ST(),TP(0),TP(0),TP(.5),TP(1),TP(1),TP(1),ST()],False),'a small notebook')
cl('support','walks in, flicks handcuffs onto something, gives a tired wave and walks off',tail([walkf(0),walkf(.25),CT(0),CT(1),CT(1),ST(lh=('r',10,-12),le=('e',10,-2)),ST()],False),'metal handcuffs')
SM=lambda u: ST(lh=('r',8,-3),rh='cross',le=('e',10,5),tilt=-6*u)
cl('smoke','actually lights the cigarette, takes one long drag and exhales, eyes closed for once',tail([ST(),CG(0),CG(1),SM(0),SM(1),SM(1),SM(0),ST(tilt=-6),ST()],False),'a lit cigarette')
cl('tearpage','rips a page out of a small notebook and hands it over without a word',tail([ST(),TP(0),TP(.5),TP(1),TP(1),ST()],False),'a small notebook')
TEXT={
 'stepup':'trudges up stairs, tired, arms crossed, slight slouch','stepover':'steps over a low edge carelessly, arms crossed',
 'liesit':'lying on her back, sits up with a groan, rubbing her neck','handswork':'tired, does hand work at waist height, slouched',
 'handshead':'rakes her blue bob back with both hands in exasperation','seatmouth':'slumped in a seat, eats or drinks absently',
 'seathold':'slumped in a seat, holding a page up and reading it critically','holdlook':'standing, holds a page at chest height and reads it skeptically',
 'handear':'holds a phone to her ear, slouched, other arm across her chest','sweep':'sweeps the floor in lazy uneven strokes',
 'liehold':'lying on her side, holding a notebook up in front of her face','carry2_idle':'stands holding a box at her side under one arm',
 'carry2_walk':'walks with a box tucked under one arm, slouched','carry2_run':'runs with a box tucked under one arm',
 'carry1_idle':'stands holding something small in one hand, other arm across her chest','carry1_walk':'walks holding something small in one hand, slouched',
 'carry1_run':'runs holding something small in one hand','turn':'turns to face the viewer, head first, shoulders following lazily',
 'fall':'falling with arms flailing','land':'lands with knees bending deep, a hand to steady herself','ladder':'climbs at an ordinary steady pace',
 'mantle':'hooks a leg over a ledge and hauls herself up with effort','vault':'sits on a waist-high obstacle and slides over it',
 'crawl':'crawls on her elbows, low','sneak':'moves along close to a wall, crouched, peeking ahead',
 'idle_light':'holds a flashlight police style over her shoulder, beam forward','walk_light':'walks holding a flashlight police style over her shoulder',
 'run_light':'runs holding a flashlight police style','lookback':'glances over her shoulder suspiciously, then forward again',
 'hide':'hides with her back flat to a wall, breathing quietly','door':'cracks a door open, peeks through the gap, then slips in',
 'doorclose':'walking, reaches back and pulls something shut behind her','knock':'knocks twice with the back of her hand',
 'push':'shoulders into something heavy and pushes','inspect':'squats with a notebook, examining something on the floor',
 'leadhand':'walks leading someone by a cuffed wrist, glancing back','bow':'a short nod of the head instead of a bow',
 'elevwait':'leans against a wall waiting, arms crossed, foot tapping','floorsit':'drops to sit on the floor against a wall, legs out',
 'floorrest':'sits against a wall, fiddling with an unlit cigarette','hurtidle':'presses a hand to a wound, cursing under her breath',
 'limp':'limps along a wall, one hand on it','fear':'freezes, clutching her notebook tight to her chest',
 'nausea':'turns her head away and covers her mouth','collapse':'slides down against a wall until she sits slumped',
 'bedlie':'lying on her back with one forearm over her eyes','victory':'takes out a cigarette, looks at it and puts it back',
 'chairsit':'drops into a chair and slumps against the backrest','typing':'types fast like a reporter on deadline',
 'gearcheck':'checks handcuffs and a power bank one by one','tie':'loosens her necktie with one finger',
 'seatrest':'slumped in a chair, arms crossed, eyes half closed','seatthink':'seated, chewing on a pen, thinking',
 'doze':'arms crossed, her head drops forward as she nods off','yawn':'a big tired yawn','stretch':'a big full-body stretch, arms up',
 'hairflip':'rakes her bob back in irritation','brushteeth':'brushes her teeth carelessly',
 'gesture':'talks while flicking the back of her hand','armscross':'listens with arms crossed, unimpressed',
 'nod':'a quick careless nod','headshake':'shakes her head with a click of the tongue','wave':'waves once over her shoulder without turning',
 'handshake':'a short firm handshake','pat':'gives a shoulder one pat instead of words','point':'points with a pen',
 'shrug':'a big tired shrug','hug':'a quick one-armed hug with a pat on the back',
 'laugh':'a short dry snort of a laugh','glad':'the corner of her mouth lifts slightly','cry':'turns her face away, shoulders tense',
 'wallcry':'rests her forehead against a wall','kneelcry':'squats down clutching a cigarette, head low',
 'sad':'a long sigh, shoulders dropping','shout':'swears and jabs a finger forward','deskslam':'slaps a palm flat on a surface',
 'surprise':'"what the" steps back half a step','startlefall':'stumbles backward and falls on her rear',
 'plopdown':'drops heavily to sit on the floor','embarrassed':'scratches the back of her head, looking away',
 'annoyed':'pinches the bridge of her nose','think':'taps a pen against her lips, thinking','bored':'fiddles with an unlit cigarette',
 'pickup':'grabs something off the floor with one hand without bending much','toss':'tosses something underhand carelessly',
 'drink':'drinks a can of coffee in one hand','eat':'eats standing up, quickly','bandage':'bites the bandage end and wraps her arm',
 'hit':'flinches from a hit','down':'knocked down sideways','getup':'gets up grumbling, one hand on the floor',
 'tired':'leans against a wall with a long sigh','idle_pipe':'holds a short bar hanging loosely at her side',
 'walk_pipe':'walks with a short bar hanging at her side','idle_shotgun':'holds a shotgun low with both hands, ready',
 'walk_shotgun':'walks holding a shotgun low with both hands','run_shotgun':'runs holding a shotgun with both hands',
 'pipe':'strikes short and fast with a bar like a police baton','shotgun':'fires a shotgun two-handed with proper form',
}
life.register(S,TEXT)
if __name__=='__main__':
    print(len(c.CLIPS),'clips',sum(len(v[2]) for v in c.CLIPS.values()),'frames'); print('audit',c.audit()[:20])
