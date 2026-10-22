# 진나솔 뼈대. 설계: docs/캐릭터제작서/동작설계_백일몽.md (0장 규칙, 3장 표의 진나솔 칸)
# 키 92px → sc 0.99. 몸 꼿꼿, 동작은 손목·손가락만 크게(손가락 튕기기·낚싯대 캐스팅 스냅·공중 그네·하이힐 밀어차기). 실·손톱은 코드가 그림
import math,sys
import common as c
from common import P,lerp,handfirst,hipfirst,sh,tail,cyc,KNEE_FWD,KNEE_UP,ELB_UP
import life
c.setup(0.99,g=101,x=66)
X,G,Y=c.X,c.G,c.HIPY
S=life.build(life.Style(rest='cross',lean=0,tilt=-2,stride=9,lift=2,bob=0.3,swing=0,wlean=1,rstride=16,rlean=10,rswing=4,cross_legs=True,sitlean=-2,head=(6,-8)))
ST,walkf,runf,SIT,DEEP=S.ST,S.walkf,S.runf,S.SIT,S.DEEP
c.set_akp(ST())
def STN(d=0,b=0,**k):
    a=dict(lh=('r',24,6),rh=('r',18,10),le=('e',12,6),re=('e',8,10)); a.update(k)
    return P((X+d,Y+2+b),2,-0.3,-0.2,(X+10+d,G),(X-10+d,G),**a)   # 두 손 손가락 펼쳐 앞, 몸 옆선
S0=STN()
cl=c.clip
cl('idle','cold upright idle with arms crossed, tapping one long nail against her arm, bored irritated face',tail([ST(),ST(.3),ST(.5),ST(.3)],True))
TM=lambda u: ST(lh=('r',4,-12+u),le=('e',10,-1))
cl('temple','presses her temple with two fingertips, eyes shut tight from a migraine, then lowers the hand',tail([ST(),TM(0),TM(1),TM(0),TM(1),ST()],False))
cl('stance','upright side-on stance, both hands raised in front with long fingers spread, body still',tail([S0,STN(0,.3),STN(0,.5),STN(0,.3)],True))
FLK=lambda u: STN(lh=('r',18,10-6*u),le=('e',10,8))
cl('engage','uncrosses her arms and flicks both wrists once, fingers spreading, nails out',tail([ST(),lerp(ST(),S0,.5),S0,S0],False))
cl('walk','brisk straight-line walk in hard heels, upright, arms crossed, no wasted motion',tail(cyc(walkf),True))
def gl(t):
    cc=math.cos(2*math.pi*t)
    return P((X+4*t,Y+2),2,-0.3,-0.2,(X+10+4*t+4*cc,G),(X-10+4*t-4*cc,G),('r',24,6),('r',18,10),le=('e',12,6),re=('e',8,10))
cl('step','short smooth gliding approach, hands raised with fingers spread',tail(cyc(gl,6),True))
cl('run','fast upright run in heels, torso straight, arms tight, ponytail flying',tail(cyc(runf),True))
JP=P((X,Y-20),2,0,0,(X+10,G-24),(X-6,G-22),('r',10,-14),('r',6,-12),le=('e',10,-4),re=('e',8,-3),lk=KNEE_FWD,rk=KNEE_FWD)
cl('jump','high light jump, one arm reaching up as if pulled by a line, legs together',tail([S0,DEEP(0,-14),lerp(DEEP(0,-14),JP,.5),JP,JP,lerp(JP,DEEP(0,-14),.5),DEEP(0,-14),S0],False))
KR=lambda b=0: P((X,Y+20+b),4,0,0,(X+12,G),(X-16,G),('a',X+20,G-1),('r',14,14),le=('e',12,10),re=('e',6,12),lk=KNEE_FWD,rk=KNEE_UP)
cl('crouch','drops to one knee, one fingertip touching the floor, upper body upright',tail([S0,lerp(S0,KR(),.5),KR(),KR(.4)],False))
def kw(t):
    cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2*cc,Y+18+abs(sn)),10,0,0,(X+12+5*cc,G-2*max(0,-sn)),(X-14-5*cc,G),('r',18,14),('r',14,14),le=('e',10,10),re=('e',6,12),lk=KNEE_FWD,rk=KNEE_UP)
cl('crouchwalk','moves low and smooth on bent knees, hands in front',tail(cyc(kw,7),True))
FLN=lambda u: P((X+2,Y+20),10,0,0,(X+12,G),(X-16,G),('a',X+20+18*u,G-2),('r',14,14),le=('e',12+6*u,12),re=('e',6,12),lk=KNEE_FWD,rk=KNEE_UP)
cl('floorline','from one knee, sweeps her hand flat along the floor out in front, fingers trailing',tail([KR(),FLN(0),FLN(.5),FLN(1),FLN(1),KR()],False))
MO=lambda u: P((X,Y+20),4,0,0,(X+12,G),(X-16,G),('r',4,-8+4*(1-u)),('r',14,14),le=('e',10,2),re=('e',6,12),lk=KNEE_FWD,rk=KNEE_UP)
cl('monocle','with one quick hand flick, sets a monocle on her eye and stares',tail([KR(),MO(0),MO(1),MO(1),MO(1),MO(1)],False))
FK0=P((X+1,Y+2),2,-0.3,-0.2,(X+10,G),(X-10,G),('r',14,2),('r',18,10),le=('e',10,4),re=('e',8,10))
FK1=P((X+2,Y+2),4,-0.3,-0.2,(X+12,G),(X-10,G),('r',36,0),('r',18,10),le=('e',18,2),re=('e',8,10))
cl('flick','near hand snaps forward from the wrist, fingers flicking open like cracking a whip, body still',tail([S0,FK0,FK1,FK1,STN(2)],False))
WR0=P((X+2,Y+2),2,0.3,0.2,(X+12,G),(X-10,G),('r',24,6),('r',8,0),le=('e',12,6),re=('e',8,4))
WR1=P((X+4,Y+3),6,-0.3,-0.2,(X+14,G),(X-8,G),('r',24,6),('r',34,8),le=('e',12,6),re=('e',16,6))
cl('wrap','rear hand whips around in a quick circle from the wrist and lashes out flat',tail([STN(2),WR0,WR0,hipfirst(WR0,WR1,.5),WR1,STN(4)],False))
PC0=P((X+6,Y+3),6,-0.3,-0.2,(X+16,G),(X-8,G),('r',34,4),('r',32,6),le=('e',16,4),re=('e',14,6))
PC1=P((X-2,Y+3),-6,-0.2,-0.2,(X+14,G),(X-12,G),('r',10,8),('r',4,10),le=('e',6,6),re=('e',2,8))
cl('pullcut','both hands reach out, close into fists, and yank sharply back to her chest, leaning back',tail([STN(4),PC0,PC0,PC0,lerp(PC0,PC1,.6),PC1,PC1,STN(0)],False))
ZK0=P((X+10,Y+2),8,-0.3,0,(X+20,G),(X-4,G),('r',36,-6),('r',16,10),le=('e',18,-2),re=('e',8,10))
ZK1=P((X+28,Y-10),-14,0,0,(X+50,G-30),(X+20,G-18),('r',24,-14),('r',10,6),le=('e',12,-6),re=('e',4,10),lk=KNEE_FWD,rk=KNEE_UP)
cl('zipkick','shoots one arm forward, is yanked off her feet and flies in with a straight heel kick',tail([runf(.25),ZK0,lerp(ZK0,ZK1,.5),ZK1,ZK1,STN(32)],False))
def aw(t):
    a=t*360; v=(math.cos(math.radians(a))*22,math.sin(math.radians(a))*10)
    return P((X,Y-16),4,0,0,(X+6,G-20),(X-4,G-18),('r',12+v[0],2+v[1]),('r',4,6),le=('e',8+v[0]*.4,4+v[1]*.4),re=('e',2,8),lk=KNEE_FWD,rk=KNEE_FWD)
cl('airwhip','in mid-air, spins her body and swings one arm around in a full circle',tail([aw(0),aw(.25),aw(.5),aw(.75),aw(1)],False))
AN=lambda u: STN(lh=('r',20+10*u,-2),le=('e',12+4*u,2))
cl('aimnail','raises one hand and points two long-nailed fingers forward, aiming, other hand ready',tail([S0,AN(.5),AN(1),AN(1),AN(1)],False))
NS0=STN(lh=('r',30,-2),le=('e',16,2)); NS1=STN(lh=('r',36,0),le=('e',18,2))
cl('nailshot','fires from the fingertips with a tiny snap of the wrist, body perfectly still',tail([NS0,NS1,NS0,NS0],False))
NW=lambda u: ST(lh=('r',14,8),rh=('r',12+2*u,6-2*u),le=('e',8,10),re=('e',6,8),tilt=10)
cl('nailswap','looks down and quickly presses new fake nails onto her fingertips one by one, irritated',tail([ST(),NW(0),NW(1),NW(0),NW(1),ST()],False))
CN=lambda u: P((X-2*u,Y+2),2-6*u,-0.3,-0.2,(X+10,G),(X-10,G),('r',24-10*u,6),('r',18-10*u,10),le=('e',12-4*u,6),re=('e',8-4*u,10))
cl('clench','both spread hands snap shut into fists and jerk back an inch',tail([S0,CN(.5),CN(1),CN(1)],False))
def sw(t):
    a=math.sin(2*math.pi*t)*24
    hip=(X+a*0.6,Y-24)
    return P(hip,-a*0.4,0,0,(hip[0]+6,G-30),(hip[0]+2,G-26),('a',X,0+12),('a',X-1,0+13),le=('e',2,-12),re=('e',1,-12),lk=KNEE_FWD,rk=KNEE_FWD)
cl('swinghang','hanging from both hands overhead on a line, swinging back and forth, legs together',tail(cyc(sw,6),True))
NT=lambda b: P((X,Y+2+b),2,-0.3,-0.2,(X+10,G),(X-12,G),('r',26,-8),('r',26,10),le=('e',14,-2),re=('e',14,8))
cl('net','spreads both hands wide in front of her, one high one low, fingers splayed, holding',tail([S0,NT(0),NT(.3),NT(0)],True))
SM0=STN(lh=('r',10,2),le=('e',8,6))
SM1=P((X-18,Y+4),-4,0,0,(X-8,G),(X-30,G),('r',30,0),('r',16,10),le=('e',14,2),re=('e',8,10))
cl('smokestep','crushes something in her hand and flicks it down, hopping back two steps',tail([S0,SM0,P((X,Y+4),4,0,0,(X+10,G),(X-12,G),('r',22,14),('r',16,10),le=('e',12,10),re=('e',8,10)),lerp(S0,SM1,.5),SM1,STN(-18)],False))
LP0=STN(lh=('r',36,-2),le=('e',18,2))
LP1=P((X-4,Y+2),-6,0,0,(X+8,G),(X-12,G),('r',8,6),('r',18,10),le=('e',4,6),re=('e',8,10))
cl('lassopull','casts one hand forward, then reels it back hard to her hip, pulling something in',tail([S0,LP0,LP0,lerp(LP0,LP1,.5),LP1,LP1],False))
HP=lambda u: P((X-2,Y+2),-6+4*u,0,0,(X+10+18*u,G-24+10*u),(X-10,G),('r',14,4),('r',4,10),le=('e',8,6),re=('e',0,10),lk=KNEE_UP)
cl('heelpush','lifts her knee and shoves her heel straight forward into something close',tail([LP1,HP(0),HP(1),HP(1)],False))
WH=lambda u: P((X+2,Y+2),-2,0,0,(X+10,G),(X-10,G),('r',14+10*u,-14+4*u),('r',10+12*u,-10+4*u),le=('e',10+4*u,-4),re=('e',8+4*u,-3))
cl('wallhang','whirls both hands overhead winding something up, then snaps them up and forward',tail([S0,WH(0),WH(.5),WH(1),WH(1),WH(1),WH(1),STN(0)],False))
FN1=P((X,Y+2),2,0,0,(X+10,G),(X-10,G),('r',30,-12),('r',-20,-10),le=('e',14,-4),re=('e',-10,-2))
FN2=STN(lh=('r',12,4),le=('e',8,8))
WC=ST(lh=('r',10,6),rh=('r',12,8),le=('e',6,10),re=('e',6,10),tilt=12)
cl('finale','flings both arms wide, then raises one finger and flicks it once; looks at her wristwatch',tail([S0,FN1,FN1,FN2,FN2,lerp(FN2,WC,.5),WC,WC,WC],False))
AL=lambda u: STN(lh=('r',30,-6+12*u),le=('e',14,0+6*u))
cl('autoline','flicks a fingertip toward one point, then another, connecting them with a casual wrist motion',tail([S0,AL(0),AL(1),AL(0),AL(1),S0],False))
BR=lambda u: P((X,Y+2),-4,0,0,(X+10,G),(X-12,G),('r',4,-20-2*u),('r',2,-19-2*u),le=('e',8,-8),re=('e',6,-8))
cl('bridge','braces her feet and raises both hands overhead, holding a heavy line taut',tail([S0,BR(0),BR(1),BR(1),BR(0),BR(1),BR(1),S0],False))
cl('support','drops in from above on a line, flicks one fingertip, and is pulled back up',tail([sw(0),sw(.25),FK0,FK1,FK1,JP,JP],False))
cl('swing','swinging forward on a line held overhead with both hands, legs together',tail(cyc(sw,6),True))
SR=lambda u: P((X+20*u,Y-20-6*u),-10+10*u,0,0,(X+8+20*u,G-26),(X+2+20*u,G-22),('r',14-10*u,-18+10*u),('r',10-10*u,-17+10*u),le=('e',10,-8),re=('e',8,-8),lk=KNEE_FWD,rk=KNEE_UP)
cl('swingrelease','lets go of a line at the top of the swing and flies forward, then drops to land',tail([sw(.25),SR(0),SR(.5),SR(1),DEEP(20,-10)],False))
cl('watchcheck','turns her wrist up and checks her wristwatch with an irritated look',tail([ST(),WC,WC,WC,ST()],False))
MG=lambda b=0: P((X-2,Y+26+b),24,0,0,(X+10,G),(X-8,G),('r',4,-10),('r',0,-9),head=(5,-6),tilt=18,le=('e',10,-2),re=('e',6,-1),lk=KNEE_UP,rk=KNEE_UP)
cl('migraine','crouches down clutching her head with both hands, migraine at its worst',tail([ST(),lerp(ST(),MG(),.5),MG(0),MG(1),MG(0),MG(1)],False))
OV={
 'pickup':('crooks one finger and something flies up into her hand, she barely bends',tail([ST(),ST(lh=('r',20,14),le=('e',10,12)),ST(lh=('r',16,4),le=('e',10,8)),ST(lh=('r',14,0),le=('e',10,6)),ST()],False)),
}
TEXT={
 'stepup':'climbs stairs briskly in heels, upright, arms crossed','stepover':'steps over a low edge in one clean stride',
 'liesit':'lying on her back, sits up irritated, rubbing her temple','handswork':'precise fast fingertip work at waist height, bored face',
 'handshead':'reties her high ponytail with both hands','seatmouth':'seated, legs crossed, swallows a pill with a sip of water',
 'seathold':'seated, legs crossed, scrolling a phone held up in one hand','holdlook':'holds something at chest height and appraises its value',
 'handear':'holds a phone to her ear, arms tight, irritated','sweep':'sweeps fast and efficiently, upright',
 'liehold':'lying on her side, holding a phone up in front of her face','carry2_idle':'stands holding a box away from her body as if it were dirty',
 'carry2_walk':'walks briskly holding a box away from her body','carry2_run':'runs holding a box away from her body',
 'carry1_idle':'stands holding something dangling from her fingertips','carry1_walk':'walks holding something dangling from her fingertips',
 'carry1_run':'runs holding something from her fingertips','turn':'turns sharply to face the viewer, ponytail swinging',
 'fall':'falling with one hand reaching up as if to catch a line','land':'lands lightly on her heels, upright',
 'ladder':'climbs fast and light','mantle':'pulls herself up onto a ledge in one quick motion','vault':'vaults on one hand, legs together',
 'crawl':'crawls fast and low','sneak':'walks very softly on her toes, heels raised, hands ready',
 'idle_light':'holds a flashlight low at her side, pointed down','walk_light':'walks holding a flashlight low at her side',
 'run_light':'runs holding a flashlight low','lookback':'flicks only her eyes and head back, then forward',
 'hide':'presses up flat and still, hand raised, ready','door':'opens a door with a flick of the wrist from a distance and walks through',
 'doorclose':'walking, flicks a hand back without looking','knock':'taps once with the toe of her shoe instead of knocking',
 'push':'pushes with one hand, annoyed','inspect':'bends from the waist and examines something on the floor with a monocle',
 'leadhand':'walks briskly towing someone along by an invisible line from her hand','bow':'lifts her chin slightly instead of bowing',
 'elevwait':'stands checking her wristwatch over and over','floorsit':'sits on the floor with knees up, back straight',
 'floorrest':'sits on the floor, head in her hand, migraine','hurtidle':'holds her head, wincing from pain',
 'limp':'limps, one hand reaching out to steady herself','fear':'nails raised, wary, very still','nausea':'turns away with irritation, hand at mouth',
 'collapse':'drops to her knees clutching her head, then tips over','bedlie':'lying curled on her side, hand over her eyes',
 'victory':'checks her wristwatch, satisfied with the time','chairsit':'sits and crosses her legs crisply',
 'typing':'types fast, nails clicking','gearcheck':'checks a set of spare fake nails one by one','tie':'straightens her collar briskly',
 'seatrest':'seated, legs crossed, eyes closed, fingers on her temple','seatthink':'seated, chin in hand, irritated, calculating',
 'doze':'falls asleep slumped forward over her arms','yawn':'a small yawn hidden behind her hand','stretch':'rolls her shoulders back once',
 'hairflip':'pulls her ponytail tight again','brushteeth':'brushes her teeth quickly and efficiently',
 'gesture':'talks pointing with one long nail','armscross':'listens with arms crossed, tapping a nail','nod':'a tiny dip of the chin',
 'headshake':'closes her eyes and turns her head away','wave':'raises two fingers briefly','handshake':'touches a hand with her fingertips only',
 'pat':'pokes a shoulder with one nail','point':'points with one long nail','shrug':'raises one eyebrow only','hug':'pushes someone forward by the back instead of hugging',
 'laugh':'a short contemptuous exhale','glad':'clenches a fist, eyes glinting at a payout','cry':'turns her back, shoulders stiff',
 'wallcry':'punches a wall once and leans on it','kneelcry':'kneels clutching her head','sad':'looks away, jaw tight',
 'shout':'leans in and says it low and cold, not raising her voice','deskslam':'raps her nails on a surface once',
 'surprise':'one eyebrow lifts a few millimeters','startlefall':'staggers a step and catches herself','plopdown':'sits down crossing her legs',
 'embarrassed':'snaps her head away, arms crossed','annoyed':'presses her temple and clicks her tongue','think':'chin in hand, calculating',
 'bored':'examines her nails','toss':'flicks something away with her fingers','drink':'swallows a painkiller with water',
 'eat':'takes one reluctant bite','bandage':'wraps a bandage fast and irritated','hit':'staggers, hand to her head','down':'knocked down, slides sideways',
 'getup':'rises smoothly, as if pulled up by a line','tired':'holds her head in both hands, migraine','idle_pipe':'holds a bar by her fingertips, away from her',
 'walk_pipe':'walks holding a bar by her fingertips','idle_shotgun':'holds a shotgun far from her body, disgusted','walk_shotgun':'walks holding a shotgun far from her body',
 'run_shotgun':'runs holding a shotgun away from her','pipe':'swings a bar in a short flick from the wrist','shotgun':'fires a shotgun at arm length, leaning away',
}
life.register(S,TEXT,OV)
if __name__=='__main__':
    print(len(c.CLIPS),'clips',sum(len(v[2]) for v in c.CLIPS.values()),'frames'); print('audit',c.audit()[:20])
