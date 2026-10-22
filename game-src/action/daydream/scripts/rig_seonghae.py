# 이성해 뼈대. 설계: docs/캐릭터제작서/동작설계_백일몽.md (0장 규칙, 3장 표의 이성해 칸)
# 키 82px → sc 0.88. 가장 작고 가벼움, 발뒤꿈치 살짝 들고 통통, 웃음 고정. 공격 = 깊은 인사(오지기)로 피하기 → 손날 → 관절 꺾기(아이키도), 플라잉 니
import math,sys
import common as c
from common import P,lerp,handfirst,hipfirst,sh,tail,cyc,KNEE_FWD,KNEE_UP,ELB_UP
import life
c.setup(0.88,g=101,x=66)
X,G,Y=c.X,c.G,c.HIPY
S=life.build(life.Style(rest='back',lean=1,tilt=-4,stride=8,lift=5,bob=1.2,swing=5,wlean=3,rstride=18,rlean=14,rswing=9,sitlean=2,head=(6,-8)))
ST,walkf,runf,SIT,DEEP=S.ST,S.walkf,S.runf,S.SIT,S.DEEP
c.set_akp(ST())
def STN(d=0,b=0,**k):
    a=dict(lh=('r',18,10),rh=('r',12,14),le=('e',10,8),re=('e',6,12)); a.update(k)
    return P((X+d,Y+3+b),4,-0.2,-0.1,(X+12+d,G-1),(X-10+d,G-2),**a)
S0=STN()
def BOW(a,d=0,**k):     # 허리 굽혀 인사: a=0 선 자세 → 1 90도
    kk=dict(lh=('r',10,22),rh=('r',8,23),le=('e',4,13),re=('e',2,13)); kk.update(k)
    return P((X+d-2*a,Y+2*a),4+80*a,0,0,(X+6+d,G),(X-4+d,G),tilt=10*a,**kk)
cl=c.clip
cl('idle','cheerful idle bouncing lightly on her toes, hands clasped behind her back, bright smile',tail([ST(),ST(-.8),ST(-1.2),ST(-.8)],True))
SN=lambda u: ST(lh=('r',14,10-4*u),le=('e',8,10),tilt=-8)
cl('snack','pulls a little snack from her pocket, looks at it and smiles happily',tail([ST(),SN(0),SN(1),SN(1),SN(0),ST()],False),'a small wrapped snack')
cl('stance','light ready stance on the balls of her feet, open hands in front, smiling',tail([S0,STN(0,-.6),STN(0,-1),STN(0,-.6)],True))
cl('engage','a quick polite bow "excuse me!", then pops up into a light ready stance',tail([ST(),BOW(.4),BOW(.7),S0],False))
cl('walk','bouncy springy walk, arms swinging, smiling',tail(cyc(walkf),True))
def hop(t):
    cc=math.cos(2*math.pi*t)
    return STN(4*t,-1.5*abs(cc))
cl('step','quick little hopping steps forward on her toes',tail(cyc(hop,6),True))
cl('run','light fast run with big arm swings, white hair flying',tail(cyc(runf),True))
JP=P((X,Y-20),2,0,0,(X+6,G-28),(X-4,G-24),('r',14,6),('r',-6,8),le=('e',8,6),re=('e',-4,8),lk=KNEE_UP,rk=KNEE_UP)
cl('jump','light high jump with knees tucked up, arms up',tail([S0,DEEP(0,-12),lerp(DEEP(0,-12),JP,.5),JP,JP,lerp(JP,DEEP(0,-14),.5),DEEP(0,-14),S0],False))
SQ=lambda b=0: P((X-2,Y+24+b),20,0,0,(X+8,G),(X-6,G),('r',12,18),('r',10,19),le=('e',6,12),re=('e',4,12),lk=KNEE_UP,rk=KNEE_UP)
cl('crouch','squats down with hands on her knees, smiling',tail([S0,lerp(S0,SQ(),.5),SQ(),SQ(.4)],False))
def sqw(t):
    cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X-2,Y+24+abs(sn)),20,0,0,(X+8+4*cc,G-2*max(0,-sn)),(X-6-4*cc,G-2*max(0,sn)),('r',12,18),('r',10,19),le=('e',6,12),re=('e',4,12),lk=KNEE_UP,rk=KNEE_UP)
cl('crouchwalk','waddles forward in a squat with little steps',tail(cyc(sqw,7),True))
SW=lambda u: P((X-2,Y+24),16,0,0,(X+8+14*u,G),(X-6,G),('a',X+4,G-1),('r',10,19),le=('e',6,12),re=('e',4,12),lk=KNEE_UP,rk=KNEE_UP)
cl('legsweep','from a squat, one hand on the floor, sweeps her front leg out low in an arc',tail([SQ(),SW(0),SW(.5),SW(1),SW(1),SQ()],False))
PC=lambda u: P((X-2,Y+24),26,0,0,(X+8,G),(X-6,G),('a',X+20,G-6+2*u),('r',10,19),tilt=14,le=('e',10,12),re=('e',4,12),lk=KNEE_UP,rk=KNEE_UP)
cl('pulsecheck','squats and presses two fingers to the neck of someone on the floor, head tilted',tail([SQ(),PC(0),PC(1),PC(1),PC(1),PC(0)],False))
cl('bowstrike','a quick polite bow "sorry!" from the waist, upper body dipping low, then popping back up',tail([S0,BOW(.5),BOW(.9),BOW(.9),S0],False))
CH0=STN(2,lh=('r',6,-8),le=('e',10,-2),rh=('r',10,14))
CH1=P((X+4,Y+4),10,-0.3,-0.2,(X+16,G-1),(X-8,G-2),('r',30,6),('r',8,14),le=('e',14,2),re=('e',4,12))
cl('chop','near hand raised by her ear snaps down and out in a sharp knife-hand strike',tail([STN(2),CH0,handfirst(CH0,CH1,.5),CH1,CH1,STN(4)],False))
LK0=P((X+6,Y+3),6,0.2,0.1,(X+18,G-1),(X-6,G-2),('r',24,8),('r',22,10),le=('e',12,6),re=('e',10,8))
LK1=P((X+10,Y+12),26,-0.2,-0.1,(X+24,G),(X-4,G),('r',24,26),('r',20,22),le=('e',14,12),re=('e',12,10))
cl('lockdown','grips a wrist with both hands, turns it over and drops her weight, throwing someone down',tail([STN(4),LK0,LK0,hipfirst(LK0,LK1,.5),LK1,LK1,LK1,STN(10)],False))
FK0=P((X+10,Y-4),4,0,0,(X+20,G-6),(X-2,G-2),('r',-4,10),('r',-8,8),le=('e',-2,8),re=('e',-4,8),lk=KNEE_UP)
FK1=P((X+24,Y-20),-6,0,0,(X+40,G-40),(X+14,G-22),('r',16,4),('r',-8,6),le=('e',8,6),re=('e',-6,6),lk=KNEE_UP,rk=KNEE_FWD)
cl('flyknee','running leap, drives one knee up high and forward in a flying knee strike',tail([runf(.25),FK0,lerp(FK0,FK1,.5),FK1,FK1,STN(26)],False))
AC=lambda u: P((X,Y-16+12*u),6+14*u,0,0,(X+6,G-22+12*u),(X-4,G-18+10*u),('r',4+20*u,-14+28*u),('r',-4,8),le=('e',10,-4+10*u),re=('e',-4,8),lk=KNEE_UP,rk=KNEE_UP)
cl('airchop','dropping from the air, brings a knife-hand down from overhead',tail([AC(0),AC(.4),AC(.8),AC(1),AC(1)],False))
SO=lambda u: ST(lh=('r',14,8-6*u),le=('e',8,10))
cl('snackout','pulls a snack out of her pocket with a bright smile',tail([ST(),SO(0),SO(.5),SO(1),SO(1)],False),'a small wrapped snack')
TS=lambda u: P((X+2,Y+1),4+4*u,0,0,(X+8,G),(X-4,G),('r',2+20*u,2+6*u),('r',-6,20),le=('e',6+8*u,6),re=('e',-4,12))
cl('snacktoss','tosses a snack forward underhand with a cheerful little bounce',tail([TS(0),TS(.5),TS(1),TS(1)],False),'a small wrapped snack')
MN=lambda u: ST(lh=('r',14,8),rh=('r',12+3*u,7),le=('e',8,10),re=('e',6+2*u,10),tilt=12)
cl('manual','holds a small manual open and flips through the pages quickly, nodding',tail([ST(),MN(0),MN(1),MN(0),MN(1)],False),'a small booklet')
NM=lambda u: ST(lh=('r',30,-4),le=('e',16,0),tilt=-10*u)
cl('nominate','points one finger straight at someone and tilts her head with a big smile',tail([ST(),NM(0),NM(1),NM(1)],False))
cl('greet','holds a deep ninety-degree bow, perfectly still and polite',tail([BOW(.95),BOW(1),BOW(.95),BOW(1)],True))
cl('deepbow','drops instantly into a deep bow, ducking low, then holds it',tail([S0,BOW(1),BOW(1),BOW(.9)],False))
def ss(t):
    a=math.sin(math.pi*t*2)
    return STN(0,-2*abs(a),lh=('r',18,10),rh=('r',12,14))
SS1=STN(-10,-2); SS2=STN(-20,-2)
cl('sidestep2','two quick light hops backward on her sneakers, staying in stance',tail([S0,STN(-5,-3),SS1,STN(-15,-3),SS2,STN(-20)],False))
HH=lambda u: P((X+4,Y+2),6,0,0,(X+14,G-1),(X-6,G-2),('r',24,14),('r',22,16),le=('e',12,10),re=('e',10,11))
cl('handhold','steps in and takes someone hand politely in both of hers, smiling',tail([S0,lerp(S0,HH(0),.5),HH(0),HH(0),HH(0),HH(0)],False))
TW=lambda u: P((X+4,Y+2+6*u),6+18*u,0.3*u,0.2*u,(X+14,G-1),(X-6,G-2),('r',24-4*u,14+10*u),('r',22-8*u,16+6*u),le=('e',12,10+4*u),re=('e',10,11+2*u))
cl('twist','still holding a hand in both of hers, twists it over and down sharply',tail([TW(0),TW(.5),TW(1),TW(1)],False))
IS0=P((X+8,Y+4),14,0,0,(X+20,G),(X-6,G-1),('r',30,10),('r',28,12),le=('e',16,8),re=('e',14,9))
IS1=P((X+6,Y+2),2,0,0,(X+16,G),(X-6,G-1),('r',22,-4),('r',-6,20),le=('e',12,2),re=('e',-4,12))
cl('isolate','shoves someone through a doorway with both hands, swings the door shut, and waves bye-bye',tail([S0,IS0,IS0,lerp(IS0,IS1,.5),IS1,IS1,ST(lh=('r',12,-12),le=('e',12,-2)),ST(lh=('r',12,-12),le=('e',12,-2))],False))
WV=lambda d: ST(lh=('r',12,-14+d),le=('e',12,-2))
cl('farewell','stands in front of a closing door smiling brightly and waving goodbye with her whole arm',tail([ST(),BOW(.3),ST(),WV(0),WV(4),WV(0),WV(4),WV(0),ST()],False))
FC=lambda b=0: P((X,Y+2+b),10,0,0,(X+6,G),(X-4,G),('r',-4,-4),('r',-6,-2),le=('e',4,4),re=('e',2,5))
def fcw(t):
    cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+1,Y+2+abs(cc)),12,0.05*cc,0.1*cc,(X+1+8*cc,G-3*max(0,-sn)),(X+1-8*cc,G-3*max(0,sn)),('r',-4,-4),('r',-6,-2),le=('e',4,4),re=('e',2,5))
cl('shouldercarry','with someone slung over her shoulders, holds them with both hands and steps forward lightly',tail([FC(),fcw(.25),fcw(.5),fcw(.75),fcw(0),FC()],False))
VD0=P((X+6,Y+3),6,-0.2,0,(X+16,G-1),(X-6,G-2),('r',24,-2),('r',22,0),le=('e',12,2),re=('e',10,4))
VD1=P((X+6,Y+5),12,0.2,0.2,(X+16,G-1),(X-6,G-2),('r',20,6),('r',26,-4),le=('e',10,6),re=('e',12,0))
cl('verdict','grips something at head height with both hands and twists sharply once, smile unchanged, then bows',tail([S0,VD0,VD0,VD1,VD1,BOW(.4),BOW(.6),S0],False))
cl('support','pops in with a bow "excuse me!", one quick knife-hand, a little wave, and hops away',tail([BOW(.4),S0,CH0,CH1,CH1,WV(0),WV(4),walkf(0)],False))
cl('thanks','presses her hands together and gives a bright grateful bow "thank you!"',tail([ST(),ST(lh=('r',12,8),rh=('r',11,9),le=('e',4,12),re=('e',3,12)),BOW(.5,lh=('r',12,8),rh=('r',11,9),le=('e',4,12),re=('e',3,12)),BOW(.6,lh=('r',12,8),rh=('r',11,9),le=('e',4,12),re=('e',3,12)),ST()],False))
cl('headtilt','tilts her head far to one side, puzzled, still smiling',tail([ST(),ST(tilt=-10),ST(tilt=-16),ST(tilt=-16)],False))
TEXT={
 'stepup':'hops up stairs lightly, arms swinging','stepover':'hops over a low edge with a little jump',
 'liesit':'lying on her back, pops up to sitting with a bounce','handswork':'busy cheerful hand work at waist height, humming',
 'handshead':'fixes her long white hair with both hands','seatmouth':'seated, munching a snack happily',
 'seathold':'seated, holding up a snack and admiring it','holdlook':'holds something at chest height and looks at it curiously',
 'handear':'holds a phone to her ear, chatting brightly','sweep':'sweeps cheerfully in quick strokes, humming',
 'liehold':'lying on her side, holding a snack up in front of her face','carry2_idle':'stands hugging a box tight to her chest',
 'carry2_walk':'bounces along hugging a box tight to her chest','carry2_run':'runs hugging a box tight to her chest',
 'carry1_idle':'stands holding something in one hand, the other hand behind her back','carry1_walk':'bounces along holding something in one hand',
 'carry1_run':'runs holding something in one hand','turn':'spins around brightly to face the viewer',
 'fall':'falling, curled up small','land':'lands lightly on her toes with a bounce','ladder':'climbs quickly and lightly',
 'mantle':'springs up onto a ledge in one hop','vault':'vaults over on both hands with a jump','crawl':'crawls quickly on hands and knees',
 'sneak':'tiptoes silently in sneakers, smiling','idle_light':'holds a flashlight up near her forehead','walk_light':'walks holding a flashlight up near her forehead',
 'run_light':'runs holding a flashlight up','lookback':'looks back over her shoulder with a smile','hide':'squats down with a finger on her lips, smiling',
 'door':'knocks, calls "excuse me!", then opens the door and steps in','doorclose':'walking, bows slightly and closes something behind her',
 'knock':'knocks in a cheerful little rhythm','push':'pushes with both hands','inspect':'squats and looks at something on the floor, head tilted',
 'leadhand':'bounces along holding someone hand, swinging it','elevwait':'waits humming, rocking on her heels',
 'floorsit':'sits down on the floor with her knees together','floorrest':'sits on the floor munching a snack',
 'hurtidle':'injured but still smiling, breathing faster','limp':'hops along on one foot','fear':'smile freezes, holding still',
 'nausea':'covers her mouth with her hand','collapse':'sinks down softly and lies still','bedlie':'lying straight on her back, smiling in her sleep',
 'victory':'waves happily and bows','chairsit':'hops onto a chair, legs swinging','typing':'types happily and fast',
 'gearcheck':'checks a little manual and snacks one by one','tie':'reties her necktie neatly like a ribbon','seatrest':'seated, swinging her legs, smiling',
 'seatthink':'seated, finger on her chin, head tilted','doze':'seated, nods off with a little smile','yawn':'a little yawn behind her hand',
 'stretch':'stretches both arms high overhead','hairflip':'flips her long white hair forward over her shoulder','brushteeth':'brushes her teeth humming',
 'gesture':'talks with both hands open and bright','armscross':'listens with hands clasped behind her back','nod':'nods with a happy bounce',
 'headshake':'tilts her head and shakes it with a smile','wave':'waves her whole arm big and happy','handshake':'takes a hand in both of hers and shakes it warmly',
 'pat':'pats someone on the head gently','point':'points with a smile','shrug':'tilts her head with a puzzled smile','hug':'hugs someone tightly',
 'laugh':'giggles brightly','glad':'claps her hands once','cry':'smiling eyes with tears falling','wallcry':'leans her back against a wall',
 'kneelcry':'kneels with hands in her lap, still smiling','sad':'tilts her head, puzzled, "why?"','shout':'bows deeply and calls out "I am so sorry!"',
 'deskslam':'claps both hands down on a surface','surprise':'"oh my!" hands up to her cheeks','startlefall':'hops back lightly, staying upright',
 'plopdown':'plops down to sit with a little bounce','embarrassed':'waves both hands in front of her, "no no!"','annoyed':'keeps smiling, but presses her lips',
 'think':'finger on her lips, head tilted','bored':'unwraps a snack','pickup':'squats and picks something up with both hands',
 'toss':'tosses something with a cheerful underhand','drink':'drinks through a straw','eat':'nibbles a snack',
 'bandage':'wraps a bandage around her arm with a smile','hit':'knocked back but still smiling','down':'sent flying lightly, lands on her back',
 'getup':'springs back up to her feet','tired':'hands on knees, smiling and catching her breath','idle_pipe':'holds a bar hidden behind her back',
 'walk_pipe':'walks holding a bar behind her back','idle_shotgun':'holds a shotgun at her chest with both hands','walk_shotgun':'walks holding a shotgun at her chest',
 'run_shotgun':'runs holding a shotgun at her chest','pipe':'steps in on her toes and thrusts with a bar','shotgun':'fires a shotgun accurately, smiling',
}
TEXT['bow']='a deep ninety-degree polite bow, smiling'
life.register(S,TEXT)
if __name__=='__main__':
    print(len(c.CLIPS),'clips',sum(len(v[2]) for v in c.CLIPS.values()),'frames'); print('audit',c.audit()[:20])
