# NPC 전 동작 뼈대 (animate_with_skeleton_v3용). 설계서 docs/캐릭터제작서/NPC_목록과_동작.md 4장 표 그대로.
# 쟈알디 rig.py의 P()·anatomic()·kp() 공간을 그대로 쓴다(발목 바닥선 G=100, 내보낼 때 192×144로 +2,+28).
# 자세는 쟈알디 키(약 93px)로 짓고, NPC 키 비율 k로 발 기준점(X,G)을 중심으로 통째로 줄이거나 키운다.
# 오른쪽(동쪽)을 봄. RIGHT = 가까운 쪽 팔다리(rig.py 약속). 손에 든 물건은 그리지 않으므로 action 문장에 물건 이름을 쓰지 않는다.
import sys,os,math
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0,os.path.join(HERE,'../../jyaldi-v5/scripts'))
import rig
from rig import P,lerp,staged,sh,jit,G,X,KNEE_FWD,KNEE_UP,ELB_DOWN,ELB_UP,ELB_OUT,anatomic

def scale(p,k):
    return {n:(X+(v[0]-X)*k,G+(v[1]-G)*k) for n,v in p.items()}
def cyc(n,f): return [f(i/n) for i in range(n)]
SIDE=-0.2   # 어깨 회전: 옆모습 유지(character-art-rules: s -0.25 이하로 넘기지 않음)

# ── 걸음 방식: 사람마다 발 놓는 방식부터 다름 ──
def gait(t,stride=11,lift=4,bob=1.2,lean=3,arm=7,hipsway=0.2,lh=None,rh=None,tilt=0,hy=56,armlift=0,dx=2):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+dx+stride*c, G-lift*max(0,-sn)); rf=(X+dx-stride*c, G-lift*max(0,sn))
    a=lh if lh is not None else (2-arm*c, 28-armlift*abs(c))
    b=rh if rh is not None else (-1+arm*c, 28-armlift*abs(c))
    return P((X+dx,hy+bob*abs(c)),lean,SIDE*0+0.12*c,hipsway*c,lf,rf,a,b,tilt=tilt)
def heels(t):     # 잼트리: 보폭 좁은 일자 걸음, 무릎 거의 펴고 발끝부터, 골반이 크게 흔들림, 상체 꼿꼿, 앞손 태블릿 쥔 모양 가슴 앞
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+2+8*c, G-2*max(0,-sn)); rf=(X+2-8*c, G-2*max(0,sn))
    return P((X+2,55+0.8*abs(sn)),1,0.1*c,0.55*c,lf,rf,(12,14),(-2+5*c,27),tilt=-3)
def bigstride(t): # 고그니쟈: 성큼성큼, 팔을 어깨높이까지 크게, 위아래로 크게 출렁
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+4+16*c, G-7*max(0,-sn)); rf=(X+4-16*c, G-7*max(0,sn))
    return P((X+4,57+3*abs(sn)),6,0.2*c,0.3*c,lf,rf,(6-15*c,20-6*abs(c)),(-2+15*c,20-6*abs(c)),le=ELB_DOWN,re=ELB_DOWN,tilt=-6)
def scurry(t):    # 데쥬레: 종종걸음, 보폭 아주 좁고 빠름, 등 굽고 두 손 가슴 앞에 고정
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+2+5*c, G-3*max(0,-sn)); rf=(X+2-5*c, G-3*max(0,sn))
    return P((X+2,59+1.0*abs(sn)),13,0.05*c,0.1*c,lf,rf,(9,10),(8,11),le=('e',4,16),re=('e',3,17),tilt=10)
def skip(t):      # 콘쥬스: 통통 튀는 걸음, 발 높이 들고 팔 앞뒤로 크게
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+2+12*c, G-9*max(0,-sn)); rf=(X+2-12*c, G-9*max(0,sn))
    return P((X+2,54+4*abs(sn)),4,0.15*c,0.2*c,lf,rf,(2-12*c,24),(-1+12*c,24),tilt=-4)
def march(t):     # 이자헌: 일정한 보폭, 상체 완전히 고정, 팔 거의 안 흔듦
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+2+12*c, G-4*max(0,-sn)); rf=(X+2-12*c, G-4*max(0,sn))
    return P((X+2,54+0.3*abs(c)),0,0,0.05*c,lf,rf,(2-2*c,29),(-1+2*c,29))
def slouch(t):    # 은하제: 힘 뺀 구부정 걸음, 고개 숙이고 뒷손은 주머니, 앞손만 조금
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+2+10*c, G-2.5*max(0,-sn)); rf=(X+2-10*c, G-2.5*max(0,sn))
    return P((X+2,57+1.2*abs(c)),7,0.1*c,0.25*c,lf,rf,(3-4*c,27),(-3,22),re=('e',-6,14),tilt=12)
def heavy(t):     # 박민성: 무겁게 쿵쿵, 몸이 좌우(골반)로 크게, 팔이 몸에서 떨어져 흔들림
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+2+11*c, G-3*max(0,-sn)); rf=(X+2-11*c, G-3*max(0,sn))
    return P((X+2,57+2.2*abs(c)),5,0.18*c,0.45*c,lf,rf,(5-9*c,26),(-3+9*c,26),le=ELB_OUT,tilt=4)
def cower_walk(t,hands):  # 생존자: 몸 웅크린 잰걸음
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+2+7*c, G-3*max(0,-sn)); rf=(X+2-7*c, G-3*max(0,sn))
    return P((X+2,60+1.2*abs(sn)),16,0.08*c,0.12*c,lf,rf,hands[0],hands[1],le=('e',5,15),re=('e',3,16),tilt=14)
def stagger(t):   # 실종 회사원: 비틀비틀, 걸음마다 상체가 앞뒤로 흔들리고 팔 축 늘어짐
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+2+8*c, G-2*max(0,-sn)); rf=(X+2-6*c, G-2*max(0,sn))
    return P((X+2+1.5*sn,58+1.5*abs(c)),8+6*sn,0.1*c,0.3*c,lf,rf,(4,30),(0,30),tilt=18+6*c)
def shuffle(t):   # 삼 년째 승객: 발 거의 안 들고 끄는 걸음
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+2+7*c, G-0.8*max(0,-sn)); rf=(X+2-7*c, G-0.8*max(0,sn))
    return P((X+2,57+0.5*abs(c)),9,0.06*c,0.1*c,lf,rf,(3-2*c,29),(0+2*c,29),tilt=16)
def runner(t,lean=16,stride=19,lift=12,arm=14,bob=2.5,hy=58,armlift=0):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    lf=(X+6+stride*c, G-lift*max(0,-sn)-1); rf=(X+6-stride*c, G-lift*max(0,sn)-1)
    return P((X+8,hy+bob*abs(sn)),lean,0.3*c,0.3*c,lf,rf,(8-arm*c,14+4*c-armlift),(2+arm*c,14-4*c-armlift))

# 서 있는 기본형(발 간격·무게 중심이 사람마다 다름)
def stand(hx=0,hy=55,lean=2,lf=(6,0),rf=(-4,0),lh='down',rh='down',tilt=0,h=0,s=0,**kw):
    return P((X+hx,hy),lean,s,h,(X+lf[0],G-lf[1]),(X+rf[0],G-rf[1]),lh,rh,tilt=tilt,**kw)

NPCS={}
def npc(id,name,k,desc):
    NPCS[id]={'name':name,'k':k,'desc':desc,'clips':{}}
    return NPCS[id]['clips']
def C(clips,name,action,poses):
    assert 3<=len(poses)<=15,(name,len(poses))
    clips[name]=(action,poses)

# ════════ 본부 ════════
c=npc('jaemtri','잼트리',90/93,'adult woman office worker in her late 20s, long wavy brown hair past the shoulders, soft green eyes, black skirt suit with fitted jacket, white shirt, black necktie, black stockings, black high heels')
JH=lambda b=0,tilt=0: stand(0,55+b,1,(7,0),(-3,0),(2,24),'down',tilt,h=0.5,le=('e',-7,14))       # 짝다리: 앞손 허리 짚음(팔꿈치 뒤로), 골반 앞쪽으로
C(c,'idle','relaxed idle with weight on one hip, near hand resting on the hip, gentle breathing',[JH(0),JH(.5),JH(1),JH(.5)])
C(c,'walk','graceful heel walk, narrow steps placed in a line, hips swaying, upper body upright, near hand held at the chest',cyc(8,heels))
JT=lambda a: stand(0,55,3,(6,0),(-4,0),(14+4*a,10-3*a),(11,14),3-4*a,le=ELB_DOWN,re=('e',4,15))
C(c,'talk','talking warmly, near hand making open palm gestures, head tilting, far hand at the chest',[JT(0),JT(.5),JT(1),JT(.5),JT(0),JT(.3)])
JW=lambda a: stand(0,55,0,(6,0),(-4,0),(14+3*math.sin(a),-18),'down',-10,le=('e',10,4))
C(c,'greet','friendly doorway greeting: tilts her head and gives a small wave with the near hand raised beside her face',[JH(0),stand(0,55,0,(6,0),(-4,0),(12,-8),'down',-6),JW(0),JW(2),JW(4),JW(0)])
JG=stand(0,55,-2,(6,0),(-4,0),(9,12),(6,11),12,le=('e',4,16),re=('e',1,16))
C(c,'glare','the smile drops: arms fold across the chest, chin lowers, cold stare, perfectly still',[JH(0),lerp(JH(0),JG,.5),JG,JG])
JS=stand(-1,55,-4,(6,0),(-4,0),(7,-2),'down',-6,le=('e',4,12))
C(c,'surprise','surprised: steps back slightly and covers her mouth with the back of the near hand',[JH(0),lerp(JH(0),JS,.6),JS,JS])
JB=lambda a: stand(0,55,4,(6,0),(-4,0),(13+2*a,13),(11,15),14,le=('e',4,15),re=('e',3,16))
C(c,'browse','looking down at a tablet held in both hands, the thumb swiping across it again and again',[JB(0),JB(1),JB(0),JB(1),JB(0),JB(1)])
JP=lambda a: stand(2+3*a,55,4+6*a,(8,0),(-4,0),(16+12*a,2-2*a),'down',0,le=ELB_DOWN)
C(c,'poke','playful poke: leans in and jabs forward with an extended fingertip, then pulls back with a smile',[JH(0),JP(.3),JP(1),JP(1),JP(.4),JH(0)])
JQ=stand(0,55,2,(6,0),(-4,0),(14,-6),'down',0,le=('e',8,8))
C(c,'shush','raises one index finger in front of her face: stop, say nothing',[JH(0),lerp(JH(0),JQ,.6),JQ,JQ])
SIT=lambda hx=0,hy=78,lean=4,lh=(18,16),rh=(16,18),tilt=6,**kw: P((X+hx,hy),lean,SIDE,0,(X+hx+22,G),(X+hx+18,G),lh,rh,tilt=tilt,lk=KNEE_UP,rk=KNEE_UP,**kw)
C(c,'type','sitting upright, typing quickly with both hands in front of her, eyes forward',[SIT(lh=(19,17),rh=(17,18)),SIT(lh=(20,16),rh=(16,19)),SIT(lh=(19,17),rh=(18,17)),SIT(lh=(21,17),rh=(16,18)),SIT(lh=(19,16),rh=(17,19)),SIT(lh=(20,17),rh=(17,17))])
JC=lambda a: stand(0,55,4,(6,0),(-4,0),(14+2*math.cos(a),12+1.5*math.sin(a)),(12,15),14,le=ELB_DOWN,re=('e',3,16))
C(c,'stir','stirring in small circles with the near hand, far hand steady at the chest, looking down contentedly',[JC(i*math.pi/3) for i in range(6)])

c=npc('gognija','고그니쟈',94/93,'lanky man in his mid 40s, wild unkempt shock of white hair, round black goggles over the eyes, long white lab coat over a white shirt and black necktie, black trousers, wristwatch')
GI=lambda b=0,a=0: stand(0,55+b,4,(8,0),(-6,0),(10+a,16),(9-a,17),-4,le=('e',4,16),re=('e',2,17))
C(c,'idle','restless idle: bouncing on his feet, rubbing his hands together in front of him, grinning',[GI(0,0),GI(1.5,1),GI(0,-1),GI(1.5,1)])
C(c,'walk','huge bouncy strides, arms swinging high and wide, lab coat flapping behind',cyc(8,bigstride))
GT=lambda a: stand(0,55,2-4*a,(8,0),(-6,0),(20+4*a,-10-8*a),(-12-4*a,-6-6*a),-8,le=ELB_UP,re=ELB_UP)
C(c,'talk','lecturing loudly with huge sweeping gestures, both arms flung open and high',[GT(0),GT(.5),GT(1),GT(.6),GT(.2),GT(.8)])
GL=lambda a: stand(-2,56+a,-12-4*a,(8,0),(-6,0),(8,20),(6,21),-22,le=('e',2,14),re=('e',0,15))
C(c,'laugh','booming laugh: throws his head back, hands on his belly, shoulders shaking',[GI(0),GL(0),GL(1.5),GL(0),GL(1.5),GL(.5)])
GB=lambda a: stand(4,57,14+4*a,(14,0),(-6,0),(8,-4),(7,-2),-6,le=('e',10,4),re=('e',8,6))
C(c,'bellow','bellowing across the room: steps forward, cups both hands around his mouth and leans in to shout',[GI(0),stand(2,56,6,(10,0),(-6,0),(10,4),(8,6),0),GB(0),GB(1),GB(1),GB(0)])
GP=lambda t: stand(0,55,-2,(8,0),(-6,0),(7,-3) if t else (12,14),(10,18),-12*t,le=('e',6,8) if t else ELB_DOWN)
C(c,'pill','tosses a pill into his mouth with the near hand, head tipping back, then chews with a grin',[GI(0),GP(.5),GP(1),stand(0,55,0,(8,0),(-6,0),(10,16),(9,17),-14),stand(0,55,0,(8,0),(-6,0),(10,16),(9,17),-10),GI(0)])
GW=stand(0,54,-4,(9,0),(-7,0),(22,-14),(-14,-12),-10,le=ELB_UP,re=ELB_UP)
C(c,'welcome','welcomes a newcomer with both arms flung wide open overhead',[GI(0),lerp(GI(0),GW,.5),GW,GW])
GS=lambda a: stand(2,56,6+10*a,(12,0),(-6,0),(10+20*a,10-12*a),(8,14),-4,le=ELB_DOWN)
C(c,'present','grand presenting gesture: near arm sweeps from the chest out to the front, palm up, proudly',[GI(0),GS(0),GS(.4),GS(.8),GS(1),GS(1)])
GQ=stand(0,55,6,(8,0),(-6,0),(12,6),(11,7),10,le=('e',4,14),re=('e',3,15))
C(c,'steeple','suddenly motionless: fingertips pressed together in front of the chest, head lowered',[GI(0),lerp(GI(0),GQ,.6),GQ,GQ])
GD=lambda t: stand(0,55,0,(8,0),(-6,0),(7,-3) if t>.5 else (10,10),(9,16),-10*t,le=('e',5,8) if t>.5 else ELB_DOWN)
C(c,'sip','takes a long happy sip with the near hand raised to his mouth, then lowers it',[GD(0),GD(.6),GD(1),GD(1),GD(.6),GD(0)])
GK=lambda a,b: stand(6,58,28,(16,0),(-4,0),(24+a,22+b),(22-a,23-b),18,le=ELB_DOWN,re=ELB_DOWN)
C(c,'tinker','leaning far forward, both hands working fast and nimbly in front of him at waist height',[GK(0,0),GK(3,-2),GK(-2,2),GK(4,1),GK(-3,-1),GK(1,2)])

c=npc('dejure','데쥬레',80/93,'petite young woman in her early 20s, very long pink twin tails, pink eyes, black skirt suit with fitted jacket, white shirt, black necktie, black shoes, nervous hunched posture')
DI=lambda a: stand(0,58,10,(5,0),(-4,0),(8,10),(7,11),10+4*a,le=('e',4,16),re=('e',3,17),head=(5+a,-7))
C(c,'idle','nervous idle, shoulders hunched, fingertips pressed together at the chest, eyes darting side to side',[DI(0),DI(1),DI(0),DI(-1)])
C(c,'walk','scurrying with tiny quick steps, back hunched, both hands clutched at the chest',cyc(8,scurry))
DT=lambda a: stand(0,58,10+6*a,(5,0),(-4,0),(9+2*a,9),(7,11),12+8*a,le=('e',4,16),re=('e',3,17))
C(c,'talk','stammering: small quick bobbing nods, fidgeting fingertips at the chest',[DT(0),DT(1),DT(0),DT(.7),DT(0),DT(1)])
DJ=lambda up: P((X,52-up),-4,SIDE,0,(X+6,G-up),(X-4,G-up*1.2),(8,-22),(4,-20),tilt=-10,le=ELB_UP,re=ELB_UP)
C(c,'startle','startled: jumps straight up with both hands flung above her head, then lands trembling',[DI(0),DJ(4),DJ(9),DJ(5),stand(0,59,8,(5,0),(-4,0),(9,2),(7,3),6),DI(0)])
DB=lambda a: stand(-2*a,58+2*a,10+40*a,(5,0),(-4,0),(4,20),(2,21),10,le=('e',2,14),re=('e',0,15))
C(c,'sorry','apologizing frantically: rapid deep bows, again and again',[DB(0),DB(1),DB(.3),DB(1),DB(.3),DB(1)])
DL=lambda b: stand(0,56-b,4,(5,b),(-4,b*0.8),(6,-4),(5,-3),-6,le=('e',4,8),re=('e',3,9))
C(c,'bloom','overjoyed: both hands pressed to her cheeks, bouncing on her toes',[DI(0),DL(0),DL(3),DL(0),DL(3),DL(1)])
DW=lambda a: stand(1,56,6,(6,0),(-4,0),(22+a,14),(20+a,15),6,le=ELB_DOWN,re=ELB_DOWN)
C(c,'work','calm and focused: back straight, both hands held steady in front of her working precisely',[DW(0),DW(.5),DW(1),DW(.5),DW(0),DW(.5)])
DS=lambda y: stand(1,56,6,(6,0),(-4,0),(22,10+y),(20,11+y),4+y/2,le=ELB_DOWN,re=ELB_DOWN)
C(c,'scan','slowly sweeping both hands held level together, up and down, steady and careful',[DS(-6),DS(-2),DS(2),DS(6),DS(2),DS(-2)])
DC=lambda a: stand(1,58,10,(5,0),(-4,0),(14+3*math.cos(a),12+2*math.sin(a)),(12,15),12,le=ELB_DOWN,re=('e',3,16))
C(c,'stir','stirring frantically in fast little circles with the near hand, flustered',[DC(i*math.pi/3) for i in range(6)])
DK=P((X-2,82),16,SIDE,0,(X+12,G),(X-10,G),(6,-8),(4,-10),tilt=20,lk=KNEE_UP,rk=KNEE_UP,le=ELB_UP,re=ELB_UP)
C(c,'cower','crouches down and covers her head with both arms, trembling',[DI(0),lerp(DI(0),DK,.5),DK,jit(DK,1,0,['NOSE','EYE','EAR','NECK'])])

c=npc('konjyuce','콘쥬스',84/93,'teenage high school girl, shoulder-length black bob with straight bangs and a pink streak on one side, blue eyes, navy school blazer, grey striped necktie, grey pleated skirt, black shoes')
KI=lambda a: stand(0,55-1.5*a,2,(6,1.5*a),(-4,1.5*a),(-6,22),(-8,22),-2,le=('e',-4,14),re=('e',-6,14))
C(c,'idle','cheerful idle, hands clasped behind her back, rocking up onto her toes and back',[KI(0),KI(.6),KI(1),KI(.6)])
C(c,'walk','bouncy springy walk, knees lifting high, arms swinging freely',cyc(8,skip))
C(c,'run','super fast sprint, leaning forward, legs a blur of long strides, arms pumping',cyc(8,lambda t: runner(t,lean=20,stride=21,lift=14,arm=15)))
KT=lambda a: stand(1,55,10,(7,0),(-4,0),(16+4*a,6-6*a),(12-2*a,10+2*a),-4,le=ELB_DOWN,re=ELB_DOWN)
C(c,'talk','chatting brightly, leaning forward, both hands moving animatedly',[KT(0),KT(1),KT(.3),KT(.8),KT(0),KT(.6)])
KW=lambda a: stand(0,52,-2,(6,3),(-4,3),(10+4*math.sin(a),-30),'down',-10,le=('e',8,-4))
C(c,'wave','up on tiptoe waving the near hand high above her head with big swings',[KI(0),stand(0,53,0,(6,2),(-4,2),(10,-20),'down',-6),KW(0),KW(2),KW(4),KW(1)])
KV=stand(0,55,0,(6,0),(-4,0),(6,-8),(-6,22),-12,le=('e',6,4),re=('e',-4,14))
C(c,'wink','playful wink: head tilts, near hand makes a peace sign beside her eye',[KI(0),lerp(KI(0),KV,.6),KV,KV])
KS=lambda up: stand(0,55,10,(8,up),(-4,0),(4,26),(1,27),2,lk=KNEE_UP if up else KNEE_FWD)
C(c,'protest','indignant protest: leans forward, fists clenched down at her sides, stomps one foot',[KI(0),KS(0),KS(10),KS(0),KS(8),KS(0)])
KD=stand(0,55,0,(6,0),(-4,0),(9,12),(6,11),10,le=('e',4,16),re=('e',1,16),head=(4,-7))
C(c,'deadpan','deadpan: arms folded, head tilted, flat unimpressed stare, waiting',[KI(0),lerp(KI(0),KD,.5),KD,KD])
KQ=P((X+2,78),14,SIDE,0,(X+16,G),(X-12,G),(22,32),(18,32),lk=KNEE_UP,rk=KNEE_FWD)
KU=stand(0,55,0,(6,0),(-4,0),(4,-30),(-2,24),-6,le=('e',6,-6))
C(c,'lift','squats, grabs low with both hands, then stands and effortlessly raises one arm straight overhead',[KI(0),KQ,lerp(KQ,stand(0,56,4,(6,0),(-4,0),(14,8),(12,10)),.5),stand(0,56,4,(6,0),(-4,0),(14,8),(12,10)),lerp(stand(0,56,4,(6,0),(-4,0),(14,8),(12,10)),KU,.5),KU,KU,KU])
C(c,'carry','bouncy walk with the near arm raised straight overhead as if carrying something huge, far arm swinging',cyc(8,lambda t: skip_h(t)))
def skip_h(t):
    c_=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+2,55+3*abs(sn)),3,0.1*c_,0.2*c_,(X+2+11*c_,G-7*max(0,-sn)),(X+2-11*c_,G-7*max(0,sn)),(4,-30),(-1+10*c_,24),le=('e',6,-6),tilt=-4)
c['carry']=(c['carry'][0],cyc(8,skip_h))
KO=stand(3,55,18,(10,0),(-4,0),(14,2),(12,4),-8,le=ELB_DOWN,re=ELB_DOWN)
C(c,'wonder','wide-eyed wonder: leans far forward toward something, hands raised near the chest',[KI(0),lerp(KI(0),KO,.6),KO,KO])
KG=lambda a: stand(0,56,6,(6,0),(-4,0),(3,27),(1,27),24+a,head=(5,-7+a*0.3))
C(c,'grief','head bowed low, fists clenched at her sides, shoulders trembling, holding back tears',[KG(0),KG(1),KG(0),KG(1)])

# ════════ 휴식방·알선 ════════
c=npc('madeokhee','마덕희',88/93,'lean sharp woman in her mid 30s, black inverted bob with bangs, half-lidded brown eyes, burgundy suit jacket and burgundy trousers, black mock-neck top, black loafers, thin gold bracelet and rings')
MI=lambda hx: stand(0,55,2,(5,0),(-4,0),(9,15),(8,16),2,le=('e',3,16),re=('e',2,17),head=(5+hx,-7))
C(c,'idle','cool idle, one hand holding the other wrist in front, still body, only her head and eyes turn slowly',[MI(0),MI(1.5),MI(0),MI(-1.5)])
MT=lambda a: stand(0,55,3,(5,0),(-4,0),(14+3*a,8-4*a),(8,16),-4+6*a,le=ELB_DOWN,re=('e',2,17))
C(c,'talk','talking in a falsely sweet manner, flicking the near wrist lazily, head tilting',[MT(0),MT(1),MT(.4),MT(.9),MT(0),MT(.6)])
MA=lambda a: stand(2,57,18+6*a,(10,0),(-4,0),(18+2*a,10),(16,12),18,le=ELB_DOWN,re=ELB_DOWN)
C(c,'appraise','puts on reading glasses with the near hand, then leans in close and turns something over in both hands, examining it',[MI(0),stand(0,55,2,(5,0),(-4,0),(8,-6),(8,16),0,le=('e',6,6)),stand(0,55,4,(5,0),(-4,0),(10,-4),(8,16),4,le=('e',6,6)),MA(0),MA(.5),MA(1),MA(.5),MA(0)])
MS=lambda d: stand(1,55,8,(6,0),(-4,0),(20,14+d),(8,16),6,le=ELB_DOWN,re=('e',2,17))
C(c,'stamp','names her price with one decisive tap of the index finger downward',[MI(0),MS(-4),MS(2),MS(0)])
MK=stand(0,55,0,(5,0),(-4,0),(7,-1),(8,16),-10,le=('e',4,10),re=('e',2,17))
C(c,'smirk','crooked smile: rests her fingers against her cheek and tilts her head',[MI(0),lerp(MI(0),MK,.6),MK,MK])

c=npc('goyeonji','고연지',88/93,'slim calm woman doctor in her early 30s, long straight black hair with bangs, pale skin, long white doctor coat open over a light blue shirt, black trousers, stethoscope around the neck')
YI=lambda b: stand(0,55+b,1,(5,0),(-4,0),(3,22),(-1,22),2,le=('e',-1,14),re=('e',-3,14))
C(c,'idle','calm idle, both hands in her coat pockets, almost motionless, steady gaze',[YI(0),YI(.3),YI(.6),YI(.3)])
YT=lambda a: stand(0,55,2,(5,0),(-4,0),(14,8),(12+a,6),2,le=('e',4,14),re=('e',3,14))
C(c,'talk','listing items calmly, counting them off one finger at a time with the other hand',[YT(0),YT(1),YT(2),YT(3),YT(2),YT(0)])
YG=lambda a: stand(0,55,4,(5,0),(-4,0),(14,10-2*a),(10-a,12+2*a),10,le=ELB_DOWN,re=ELB_DOWN)
C(c,'glove','pulls a surgical glove snugly onto the near hand with the far hand, then flexes the fingers',[YI(0),YG(0),YG(1),YG(2),YG(3),YG(0)])
YW=lambda a,b: stand(2,57,20,(10,0),(-4,0),(22+a,20+b),(20-a,22),20,le=ELB_DOWN,re=ELB_DOWN)
C(c,'treat','leans over and works with both hands, slow precise steady movements',[YI(0),YW(0,0),YW(1,0),YW(1,1),YW(0,1),YW(-1,0),YW(0,0),YI(0)])
YR=stand(0,55,0,(5,0),(-4,0),(-8,8),(-1,22),-2,le=('e',4,14),re=('e',-3,14))
C(c,'refuse','flatly refuses: points behind herself with the near thumb, expressionless',[YI(0),lerp(YI(0),YR,.6),YR,YR])

c=npc('yunjia','윤지아',80/93,'small soft young woman nurse in her early 20s, apricot hair in two buns, large gentle brown eyes, white short-sleeved nurse uniform with pink trim, white trousers, small beige hip pouch, black hair tie on the wrist')
WI=lambda a: stand(0,57,3,(5,0),(-4,0),(9,16),(8,17),2+2*a,le=('e',3,17),re=('e',2,18),h=0.1*a)
C(c,'idle','gentle idle, hands clasped in front, swaying softly with a kind smile',[WI(0),WI(1),WI(0),WI(-1)])
WT=lambda a: stand(0,57,6,(5,0),(-4,0),(14+3*a,10-2*a),(9,16),6+6*a,le=ELB_DOWN,re=('e',2,17))
C(c,'talk','talking warmly, nodding, near hand making soft encouraging gestures',[WT(0),WT(1),WT(.3),WT(.8),WT(0),WT(.5)])
WC=lambda t: stand(1,57,6,(6,0),(-4,0),(2,22) if t<.5 else (20,8),(9,16),8,le=('e',-1,14) if t<.5 else ELB_DOWN)
C(c,'candy','reaches into her hip pouch, takes something small and holds it out on an open palm with a smile',[WI(0),WC(0),WC(.3),WC(.6),WC(1),WC(1)])
WB=lambda a: stand(1,57,10,(6,0),(-4,0),(18+4*math.cos(a),14+3*math.sin(a)),(16,16),14,le=ELB_DOWN,re=ELB_DOWN)
C(c,'bandage','wrapping motion: near hand circles around and around something held in front, far hand steadying it',[WB(i*math.pi/4) for i in range(8)])
WH=stand(2,57,10,(8,0),(-4,0),(22,12),(9,16),4,le=ELB_DOWN,re=('e',2,17))
C(c,'hand','reaches out and offers her open hand forward, reassuring',[WI(0),lerp(WI(0),WH,.6),WH,WH])
WS=lambda a: stand(0,57,4,(5,0),(-4,0),(16+4*a,20+4*a),(9,16),4+6*a,le=ELB_DOWN,re=('e',2,17))
C(c,'beckon','gestures downward and forward with the near hand: please sit down',[WI(0),WS(0),WS(1),WS(.4)])

c=npc('shinyuri','신유리',89/93,'solid square-shouldered woman in her early 30s, long black hair slicked back into a tight ponytail, narrow dark eyes, black leather jacket over a dark grey t-shirt, black fitted trousers, laced steel-toed boots, sheathed short knife at the small of the back')
SI=lambda b: stand(0,55+b,0,(7,0),(-7,0),(9,12),(6,11),0,le=('e',4,16),re=('e',1,16))
C(c,'idle','arms folded, feet planted wide, completely still, staring straight ahead, breathing only',[SI(0),SI(.3),SI(.5),SI(.3)])
ST=lambda d: stand(0,55,2,(7,0),(-7,0),(16,6+d),(6,11),2,le=ELB_DOWN,re=('e',1,16))
C(c,'talk','blunt counted speech: lowers one finger in a slow beat, one, two, three',[ST(0),ST(6),ST(0),ST(6),ST(0),ST(6)])
SK=lambda t: stand(0,55,2,(7,0),(-7,0),(9,12),(-10,22) if t else (6,11),0,le=('e',4,16),re=('e',-6,12) if t else ('e',1,16))
C(c,'knife','slowly unfolds her arms and lets the far hand drift behind her to rest at the small of her back, eyes fixed',[SI(0),lerp(SK(0),SK(1),.5),SK(1),SK(1)])
SL=lambda a: stand(4,57,20+8*a,(12,0),(-6,0),(24,20),(22,22),10,le=ELB_DOWN,re=ELB_DOWN)
C(c,'lean','plants both palms forward at waist height and leans in close, intimidating',[SI(0),SL(0),SL(.6),SL(1),SL(1),SL(.6)])
SN=lambda a: stand(0,55,0,(7,0),(-7,0),(6,-6),(4,-4),-14*a+7*(1-a),le=('e',6,4),re=('e',4,6))
C(c,'neck','cracks her neck: tilts the head hard to one side then the other, then rolls her shoulders',[SI(0),SN(0),SN(1),SN(0),SN(1),SI(0)])

c=npc('munhyeran','문혜란',94/93,'tall slender woman in her late 30s, brown hair in a low ponytail, sharp upturned eyes, dark brown single-breasted suit jacket, black collared shirt, dark brown trousers, black pointed heels, heavy gold wristwatch')
HI=lambda a: stand(1,55,-2,(8,0),(-4,0),(3,22),'down',-4+2*a,le=('e',-2,14),h=0.4)
C(c,'idle','swaggering easy idle, weight on one leg, near hand in a trouser pocket, head tilted with a grin',[HI(0),HI(1),HI(0),HI(-1)])
HT=lambda a: stand(0,55,-6+8*a,(8,0),(-4,0),(14,8-6*a),(12,10-4*a),-14+10*a,le=ELB_DOWN,re=ELB_DOWN)
C(c,'talk','loud laughing talk: claps her hands together, rocks back laughing, leans in again',[HT(1),HT(0),HT(1),HT(0),HT(.5),HT(1)])
HS=lambda a: stand(2,55,6,(10,0),(-4,0),(24,-2+10*a),'down',0,le=ELB_DOWN)
C(c,'backslap','friendly backslap: steps in and swings the near hand forward in a hearty pat, twice',[HI(0),HS(0),HS(1),HS(0),HS(1),HI(0)])
HW=lambda t: stand(0,55,2,(8,0),(-4,0),(12,12),(12,10) if t else (11,13),8,le=ELB_DOWN,re=ELB_DOWN)
C(c,'watch','raises the far wrist and taps the watch face exactly once with the near finger',[HI(0),HW(0),HW(1),HW(0)])
HB=lambda a: stand(0,55,2,(8,0),(-4,0),(16+2*a,18+4*a),'down',2+4*a,le=ELB_DOWN)
C(c,'beckon','waves someone down into a seat with quick downward hand motions: sit, sit',[HI(0),HB(0),HB(1),HB(0)])

# ════════ 백일몽 D조 · 프리랜서 (싸움 클립 포함) ════════
def fighter(c,idle,walkf,runkw,atk,hit,down,getup,extra):
    C(c,'idle',*idle); C(c,'walk',walkf[0],cyc(8,walkf[1])); C(c,'run',runkw[0],cyc(8,lambda t: runner(t,**runkw[1])))
    for n,(a,ps) in atk.items(): C(c,n,a,ps)
    C(c,'hit',*hit); C(c,'down',*down)
    if getup: C(c,'getup',*getup)
    for n,(a,ps) in extra.items(): C(c,n,a,ps)

c=npc('jaheon','이자헌',102/93,'very tall heavy man, white hair, wearing a white lizard mask with red slit eyes covering the face, navy waistcoat over a white shirt with sleeves, navy necktie, black trousers, black work gloves')
ZI=lambda b: stand(0,54+b,0,(5,0),(-5,0),'down','down',0)
ZP=P((X+6,56),4,SIDE,0,(X+16,G),(X-8,G),'out','down',head=(6,-7))
ZPw=P((X+2,55),2,SIDE,0,(X+10,G),(X-8,G),(14,10),'down')
ZH1=P((X,52),-6,SIDE,0,(X+8,G),(X-8,G),(6,-24),(4,-22),le=ELB_UP,re=ELB_UP)
ZH2=P((X+8,62),26,SIDE,0,(X+18,G),(X-10,G),(30,30),(28,30))
ZK=P((X-2,55),-6,SIDE,0,(X+5,G),(X-5,G),'down','down',head=(4,-7))
ZD=[P((X-4,56),-14,0,0,(X+5,G),(X-5,G),'down','down'),P((X-10,60),-40,0,0,(X+5,G),(X-1,G),(4,-10),(-2,-8)),
    sh(P((X-14,80),-70,0,0,(X+8,G-6),(X+4,G-4),(0,-20),(-6,-16)),6),sh(P((X-16,94),-90,0,0,(X+24,G-2),(X+22,G),(4,-26),(0,-24)),14),
    sh(P((X-16,96),-92,0,0,(X+30,G),(X+28,G),(16,4),(4,8),re=ELB_UP),14)]
ZD=ZD+[ZD[-1]]*3
ZU1=P((X+2,92),-40,0,0,(X+20,G),(X+12,G),(14,12),(10,14),lk=KNEE_UP,rk=KNEE_UP)
ZU2=P((X+0,76),2,0,0,(X+16,G),(X-6,G),(12,20),(8,22),lk=KNEE_UP)
fighter(c,('perfectly upright and motionless like carved stone, only slow breathing',[ZI(0),ZI(.3),ZI(.5),ZI(.3)]),
        ('steady marching walk, even steps, upper body completely rigid, arms barely moving',march),
        ('heavy upright sprint, torso straight, powerful long strides',dict(lean=8,stride=17,lift=10,arm=10,bob=1.5,hy=56)),
        {'punch':('instant straight punch with no wind-up, heavy and direct, then returns to stillness',[ZI(0),ZPw,ZP,ZP,lerp(ZP,ZI(0),.5),ZI(0)]),
         'smash':('raises both clasped fists high overhead and brings them crashing straight down',[ZI(0),lerp(ZI(0),ZH1,.5),ZH1,ZH1,staged(ZH1,ZH2,.6),ZH2,ZH2,lerp(ZH2,ZI(0),.5)])},
        ('takes a hit: only the head moves slightly back, body stays rooted',[ZI(0),ZK,ZK,ZI(0)]),
        ('knocked down: tips backward straight like a falling board and lands flat on the back',ZD),
        ('gets up from lying on the back in one smooth controlled motion without using the hands much',[ZD[-1],ZU1,ZU2,lerp(ZU2,ZI(0),.5),lerp(ZU2,ZI(0),.8),ZI(0)]),
        {'nod':('a single short formal nod, nothing else moves',[ZI(0),stand(0,54,1,(5,0),(-5,0),'down','down',14),stand(0,54,1,(5,0),(-5,0),'down','down',14),ZI(0)])})

c=npc('haje','은하제',88/93,'lean woman in her early 30s, chin-length dark navy blue bob, wearing a peregrine falcon mask covering the face, sharp navy suit, white shirt, navy necktie, black gloves')
HJ=lambda t: stand(0,56,4,(6,0),(-4,0),(9,2) if t else (2,22),(-3,22),8 if t else 12,le=('e',6,10) if t else ('e',-1,14),re=('e',-6,14))
fighter(c,('tired idle: takes something small out of a pocket, looks at it, weighs it in the hand, and puts it back with a sigh',[HJ(0),HJ(.5),HJ(1),HJ(1),HJ(.5),HJ(0)]),
        ('loose slouching walk, head low, far hand in a pocket, near arm swinging lazily',slouch),
        ('low swift sprint, compact and efficient',dict(lean=22,stride=18,lift=10,arm=12,bob=2.0,hy=60)),
        {'kick':('short sharp low kick with the near leg, snapping out and back, upper body barely moving',
                 [stand(0,56,4,(6,0),(-4,0),(10,10),(8,12),6),P((X-2,57),-6,SIDE,0.2,(X+14,G-8),(X-6,G),(10,10),(8,12),rk=KNEE_FWD),P((X-3,57),-10,SIDE,0.3,(X+28,G-10),(X-6,G),(8,10),(6,12)),P((X-3,57),-10,SIDE,0.3,(X+28,G-10),(X-6,G),(8,10),(6,12)),P((X-2,57),-4,SIDE,0.2,(X+12,G-6),(X-6,G),(10,10),(8,12)),stand(0,56,4,(6,0),(-4,0),(10,10),(8,12),6)]),
         'elbow':('steps in and drives a short sharp elbow forward at chest height',
                  [stand(0,56,4,(6,0),(-4,0),(10,10),(8,12),6),P((X+2,57),6,SIDE,0,(X+12,G),(X-6,G),(2,4),(8,12),le=('e',-4,4)),P((X+6,58),12,SIDE,0,(X+16,G),(X-6,G),(4,4),(8,12),le=('e',14,4)),P((X+6,58),12,SIDE,0,(X+16,G),(X-6,G),(4,4),(8,12),le=('e',14,4)),P((X+3,57),6,SIDE,0,(X+12,G),(X-6,G),(8,10),(8,12)),stand(0,56,4,(6,0),(-4,0),(10,10),(8,12),6)])},
        ('flinches briefly, shoulders hunch, recovers fast',[stand(0,56,4,(6,0),(-4,0),(10,10),(8,12),6),stand(-2,57,-6,(6,0),(-4,0),(8,4),(6,6),-6),stand(-1,56,0,(6,0),(-4,0),(9,8),(7,10),2),stand(0,56,4,(6,0),(-4,0),(10,10),(8,12),6)]),
        ('knocked down: spins and falls onto her side, rolling once',[stand(-2,57,-10,(6,0),(-4,0),(8,4),(6,6),-6),P((X-6,64),-30,0,0,(X+8,G-4),(X-2,G),(10,-6),(4,-2)),sh(P((X-10,80),-60,0,0,(X+10,G-10),(X+4,G-6),(14,-6),(4,-6)),4),sh(P((X-12,92),-80,0,0,(X+22,G-4),(X+16,G),(18,2),(10,4)),10),sh(P((X-12,95),-88,0,0,(X+28,G),(X+24,G),(18,6),(8,10)),12)]+[sh(P((X-12,95),-88,0,0,(X+28,G),(X+24,G),(18,6),(8,10)),12)]*3),
        ('pushes up off one hand grumbling, shakes it off and stands slouched',[sh(P((X-12,95),-88,0,0,(X+28,G),(X+24,G),(18,6),(8,10)),12),P((X,90),-40,0,0,(X+20,G),(X+10,G),(14,10),('a',X-12,G)),P((X-2,78),4,0,0,(X+16,G),(X-8,G),(12,20),('a',X-14,G)),P((X,64),8,0,0,(X+10,G),(X-6,G),(8,24),(4,26)),HJ(0),HJ(0)]),
        {'pat':('a short dry pat on someone\'s shoulder with the near hand instead of words',[HJ(0),stand(2,56,6,(10,0),(-4,0),(20,0),(-3,22),8,re=('e',-6,14)),stand(2,56,6,(10,0),(-4,0),(22,4),(-3,22),8,re=('e',-6,14)),stand(2,56,6,(10,0),(-4,0),(20,0),(-3,22),8,re=('e',-6,14)),stand(2,56,6,(10,0),(-4,0),(22,4),(-3,22),8,re=('e',-6,14)),HJ(0)]),
         'slump':('drops heavily to sit on the floor and sprawls back on both hands, exhausted',[HJ(0),P((X-4,80),0,0,0,(X+14,G),(X-8,G),(6,24),(2,24),lk=KNEE_UP),P((X-6,92),-30,0,0,(X+26,G),(X+18,G),('a',X-16,G),('a',X-20,G),lk=KNEE_UP,rk=KNEE_UP,tilt=-10),P((X-6,92),-30,0,0,(X+26,G),(X+18,G),('a',X-16,G),('a',X-20,G),lk=KNEE_UP,rk=KNEE_UP,tilt=-14)])})

c=npc('minseong','박민성',98/93,'big broad muscular man in his late 20s, short brown hair, wearing a badger mask covering the face, navy suit stretched over thick shoulders and chest, white shirt, navy necktie')
BI=lambda a: stand(0,56,4,(7,0),(-6,0),(8+a,-2) if a>0 else ELB_OUT and (6,26),(4,26),4,le=('e',8,6) if a>0 else ELB_OUT)
BJ=lambda b: stand(0,56+b,4,(7,0),(-6,0),(6,26),(3,26),4,le=ELB_OUT,re=ELB_OUT)
BW=stand(0,56,2,(7,0),(-6,0),(8,-6),(3,26),-4,le=('e',8,4),re=ELB_OUT)
BT1=P((X-2,62),14,SIDE,0,(X+10,G),(X-10,G),(4,10),(2,12),le=('e',0,14))
BT2=P((X+16,64),30,SIDE,0,(X+30,G),(X+2,G-4),(6,8),(4,10),le=('e',4,12),head=(6,-5))
fighter(c,('nervous idle: shifts his weight, wipes sweat from his brow with the back of the near hand, breathes heavily',[BJ(0),BJ(1.5),BW,BJ(1)]),
        ('heavy thudding walk, body swaying side to side, arms held out from the body',heavy),
        ('frantic heavy sprint, arms flailing wide, puffing',dict(lean=14,stride=17,lift=9,arm=17,bob=3.5,hy=59)),
        {'tackle':('lowers the near shoulder and charges forward, slamming into the target with his whole body weight',[BJ(0),BT1,BT1,staged(BT1,BT2,.5),BT2,BT2,lerp(BT2,BJ(0),.5),BJ(0)])},
        ('takes a hit and staggers back a big step, arms flung up, nearly losing balance',[BJ(0),stand(-6,58,-16,(2,0),(-12,0),(10,-12),(6,-10),-10,le=ELB_UP,re=ELB_UP),stand(-4,57,-6,(4,0),(-10,0),(8,10),(6,12),-2),BJ(0)]),
        ('knocked down: falls hard on his backside, then tips over onto his back',[stand(-4,58,-16,(4,0),(-10,0),(10,-12),(6,-10),-10,le=ELB_UP,re=ELB_UP),P((X-6,80),-10,0,0,(X+14,G),(X-4,G),(10,10),('a',X-14,G),lk=KNEE_UP),P((X-8,92),-30,0,0,(X+22,G-6),(X+14,G-4),(10,4),('a',X-18,G),lk=KNEE_UP,rk=KNEE_UP),sh(P((X-14,94),-80,0,0,(X+22,G-10),(X+18,G-6),(10,-10),(2,-6),lk=KNEE_UP,rk=KNEE_UP),8),sh(P((X-14,96),-90,0,0,(X+28,G),(X+26,G),(16,4),(4,8)),12)]+[sh(P((X-14,96),-90,0,0,(X+28,G),(X+26,G),(16,4),(4,8)),12)]*3),
        ('rolls onto his side, groans, pushes up on both hands and knees and heaves himself up',[sh(P((X-14,96),-90,0,0,(X+28,G),(X+26,G),(16,4),(4,8)),12),P((X+4,88),40,0,0,(X+10,G),(X-6,G),('a',X+24,G),('a',X+18,G),lk=KNEE_UP,rk=KNEE_UP),P((X+2,78),30,0,0,(X+16,G),(X-8,G),('a',X+26,G-2),(14,22),lk=KNEE_UP),P((X,66),14,0,0,(X+10,G),(X-6,G),(12,22),(8,24)),lerp(P((X,66),14,0,0,(X+10,G),(X-6,G),(12,22),(8,24)),BJ(0),.6),BJ(0)]),
        {'scratch':('scratches the back of his head with the near hand, laughing sheepishly, shoulders bouncing',[BJ(0),stand(0,56,0,(7,0),(-6,0),(-2,-8),(3,26),-6,le=('e',8,-4),re=ELB_OUT),stand(0,57,0,(7,0),(-6,0),(-3,-7),(3,26),-8,le=('e',8,-4),re=ELB_OUT),stand(0,56,0,(7,0),(-6,0),(-2,-8),(3,26),-6,le=('e',8,-4),re=ELB_OUT),stand(0,57,0,(7,0),(-6,0),(-3,-7),(3,26),-8,le=('e',8,-4),re=ELB_OUT),BJ(0)]),
         'fistpump':('clenches the near fist and pumps it down hard, psyching himself up',[BJ(0),stand(0,56,0,(8,0),(-6,0),(12,-10),(3,26),-6,le=('e',10,2)),stand(0,57,8,(8,0),(-6,0),(12,12),(3,26),6,le=ELB_DOWN),stand(0,57,8,(8,0),(-6,0),(12,12),(3,26),6,le=ELB_DOWN)])})

c=npc('freelancer','협회 프리랜서',90/93,'rugged adult man freelancer, khaki field jacket with a hood down, dark cargo trousers, worn boots, baseball cap, backpack straps over the shoulders, short heavy wrench-like club in the near hand')
FI=lambda b: stand(0,56+b,4,(7,0),(-5,0),(10,10),(4,24),2,le=ELB_DOWN,re=('e',-2,14))
FS=lambda a: P((X+a*4,57+a*2),8+12*a,SIDE,0,(X+12+a*6,G),(X-8,G),(6-6*a,-14+40*a) if a<1 else (26,26),(4,24),le=ELB_UP if a<.5 else ELB_DOWN)
fighter(c,('idle, adjusting a backpack strap with the far hand, glancing around',[FI(0),FI(.5),stand(0,56,4,(7,0),(-5,0),(10,10),(-2,8),2,re=('e',-4,12)),FI(.5)]),
        ('ordinary practical walk',lambda t: gait(t,stride=11,lift=4,bob=1.2,lean=4,arm=6,lh=(10,10))),
        ('ordinary sprint',dict(lean=16,stride=18,lift=11,arm=12,bob=2.2,hy=58)),
        {'strike':('raises the near arm overhead and brings it down hard in one practical blow',[FI(0),FS(0),FS(.3),FS(.7),FS(1),FI(0)])},
        ('takes a hit, upper body snaps back',[FI(0),stand(-3,57,-10,(7,0),(-5,0),(8,2),(2,10),-6),stand(-1,56,0,(7,0),(-5,0),(9,8),(3,20),0),FI(0)]),
        ('knocked down onto the back',[stand(-3,57,-14,(7,0),(-5,0),(8,2),(2,10),-6),P((X-8,62),-45,0,0,(X+10,G-8),(X,G-6),(6,-14),(-4,-12)),sh(P((X-14,84),-75,0,0,(X+14,G-20),(X+8,G-14),(2,-22),(-8,-14),lk=KNEE_UP,rk=KNEE_UP),8),sh(P((X-14,95),-90,0,0,(X+28,G-2),(X+24,G),(16,2),(4,8)),12),sh(P((X-14,96),-92,0,0,(X+30,G),(X+28,G),(18,4),(4,8)),12)]+[sh(P((X-14,96),-92,0,0,(X+30,G),(X+28,G),(18,4),(4,8)),12)]*3),
        None,{})

# ════════ 구조 대상 · 승객 ════════
def civ(c,idle,walk,flee,fall,talk,extra):
    C(c,'idle',*idle); C(c,'walk',walk[0],cyc(8,walk[1]))
    if flee: C(c,'flee',flee[0],cyc(8,flee[1]))
    if fall: C(c,'fall',*fall)
    C(c,'talk',*talk)
    for n,(a,ps) in extra.items(): C(c,n,a,ps)
FALLS=lambda: [P((X-2,62),20,0,0,(X+8,G),(X-6,G),(10,14),(8,16),tilt=20),P((X+2,76),30,0,0,(X+14,G),(X-10,G),(14,20),(12,22),lk=KNEE_UP),
               P((X+2,86),24,0,0,(X+16,G),(X-12,G),(18,26),(14,28),lk=KNEE_UP,rk=KNEE_UP),P((X+2,90),50,0,0,(X+18,G),(X-10,G),('a',X+30,G),('a',X+24,G),lk=KNEE_UP,rk=KNEE_UP)]
c=npc('survivor_f','생존자(여)',88/93,'frightened ordinary young woman civilian, messy shoulder-length brown hair, oversized grey hoodie, jeans, sneakers, dirt smudges')
VF=lambda a: stand(0,57,10,(4,0),(-4,0),(10,10),(8,8),14+a,le=('e',4,16),re=('e',3,15),head=(5+a*0.5,-7))
fs=FALLS()
civ(c,('hugging herself tightly, trembling, eyes darting around',[VF(0),VF(1),VF(0),VF(-1)]),
    ('following with small hunched quick steps, arms wrapped around herself',lambda t: cower_walk(t,((10,10),(8,8)))),
    ('panicked run, arms flailing',lambda t: runner(t,lean=12,stride=16,lift=9,arm=16,bob=3,hy=58,armlift=6)),
    ('collapses: knees buckle and she drops to the floor, catching herself on her hands',[VF(0)]+fs+[fs[-1]]*3),
    ('talking shakily, one hand gesturing weakly, the other still clutching her arm',[stand(0,57,8,(4,0),(-4,0),(14,8),(8,8),10,re=('e',3,15)),stand(0,57,8,(4,0),(-4,0),(16,4),(8,8),8,re=('e',3,15)),stand(0,57,8,(4,0),(-4,0),(14,8),(8,8),10,re=('e',3,15)),stand(0,57,8,(4,0),(-4,0),(16,6),(8,8),12,re=('e',3,15)),stand(0,57,8,(4,0),(-4,0),(14,8),(8,8),10,re=('e',3,15)),stand(0,57,8,(4,0),(-4,0),(16,4),(8,8),8,re=('e',3,15))]),
    {'rest':('sitting on the floor hugging her knees, catching her breath',[P((X-4,88),12,0,0,(X+14,G),(X+10,G),(16,18),(14,20),tilt=16,lk=KNEE_UP,rk=KNEE_UP),P((X-4,88),14,0,0,(X+14,G),(X+10,G),(16,18),(14,20),tilt=18,lk=KNEE_UP,rk=KNEE_UP),P((X-4,88),12,0,0,(X+14,G),(X+10,G),(16,18),(14,20),tilt=16,lk=KNEE_UP,rk=KNEE_UP),P((X-4,88),10,0,0,(X+14,G),(X+10,G),(16,18),(14,20),tilt=14,lk=KNEE_UP,rk=KNEE_UP)])})
c=npc('survivor_m','생존자(남)',92/93,'frightened ordinary middle-aged man civilian, thinning black hair, rumpled beige jacket, dark slacks, loose collar, sweating')
VM=lambda a: stand(0,56,6,(5,0),(-5,0),(0,-10),(-2,-9),6,le=('e',8,-2),re=('e',6,-1),head=(5+a,-7))
fs=[P((X+4,60),20,0,0,(X+12,G),(X-6,G),(16,10),(14,12),tilt=20),P((X+8,66),40,0,0,(X+18,G),(X-4,G-4),(24,20),(20,22)),sh(P((X+6,84),70,0,0,(X+12,G),(X-8,G-6),('a',X+36,G-4),('a',X+30,G),lk=KNEE_UP),4),sh(P((X+8,94),88,0,0,(X-8,G),(X-12,G),('a',X+40,G),('a',X+34,G)),6)]
civ(c,('holding his head in both hands, looking around in panic',[VM(0),VM(1.5),VM(0),VM(-1.5)]),
    ('following with an awkward half-crouched walk, glancing back over his shoulder',lambda t: cower_walk(t,((4,-8),(2,-7)))),
    ('running away head down, arms over his head',lambda t: P(*(lambda c_,sn: ((X+8,60+2*abs(sn)),20,0.2*c_,0.2*c_,(X+6+16*c_,G-9*max(0,-sn)-1),(X+6-16*c_,G-9*max(0,sn)-1),(4,-8),(2,-7)))(math.cos(2*math.pi*t),math.sin(2*math.pi*t)),le=('e',10,-2),re=('e',8,-1),tilt=20)),
    ('pitches forward and falls flat on his front',[VM(0)]+fs+[fs[-1]]*3),
    ('urgent pleading gestures with both hands',[stand(0,56,8,(5,0),(-5,0),(18,6),(16,8),4),stand(0,56,10,(5,0),(-5,0),(20,2),(18,4),2),stand(0,56,8,(5,0),(-5,0),(18,6),(16,8),4),stand(0,56,12,(5,0),(-5,0),(20,0),(18,2),0),stand(0,56,8,(5,0),(-5,0),(18,6),(16,8),4),stand(0,56,10,(5,0),(-5,0),(20,2),(18,4),2)]),{})
c=npc('missing_worker','실종 회사원',90/93,'dazed young office worker man, messy black hair, white dress shirt half untucked, loosened grey necktie, dark slacks, no jacket, blank exhausted face')
MW=lambda b: stand(0,58+b,10,(5,0),(-4,0),(4,30),(1,30),22+b)
fs=[P((X-2,62),16,0,0.3,(X+6,G),(X-6,G),(4,30),(1,30),tilt=24),P((X-6,74),-10,0,0.4,(X+10,G),(X-2,G),(-2,24),(2,26),tilt=10),sh(P((X-10,90),-50,0,0,(X+20,G-4),(X+12,G),(-6,10),(0,14)),6),sh(P((X-12,95),-86,0,0,(X+28,G),(X+24,G),(10,2),(4,6)),10)]
civ(c,('dazed idle, shoulders slumped, arms hanging limp, head drooping, swaying slightly',[MW(0),MW(1),MW(1.5),MW(1)]),
    ('stumbling unsteady walk, upper body swaying, arms limp',stagger),None,
    ('legs give out and he crumples sideways to the floor',[MW(0)]+fs+[fs[-1]]*3),
    ('talks weakly, head barely lifting',[MW(0),stand(0,58,8,(5,0),(-4,0),(10,22),(1,30),14),stand(0,58,8,(5,0),(-4,0),(12,20),(1,30),12),stand(0,58,8,(5,0),(-4,0),(10,22),(1,30),14),MW(0),MW(0)]),
    {'relief':('drops to sit on the floor in relief, head falling back, arms loose',[MW(0),P((X-4,80),0,0,0,(X+14,G),(X-6,G),(6,26),(2,26),lk=KNEE_UP),P((X-6,92),-20,0,0,(X+24,G),(X+16,G),(10,30),('a',X-14,G),lk=KNEE_UP,rk=KNEE_UP,tilt=-18),P((X-6,92),-22,0,0,(X+24,G),(X+16,G),(10,30),('a',X-14,G),lk=KNEE_UP,rk=KNEE_UP,tilt=-22)])})
c=npc('passenger_3y','삼 년째 승객',90/93,'gaunt haggard man, hollow cheeks, unkempt greying hair, threadbare old dark suit too big for him, frayed tie, worn shoes')
PI=lambda a: stand(0,57,9,(5,0),(-4,0),(4,29),(1,29),16,head=(5+a,-7+abs(a)*0.4))
civ(c,('twitchy idle, slumped, hands trembling, head jerking slightly',[PI(0),PI(1),PI(-0.5),PI(0.8)]),
    ('shuffling walk, feet barely leaving the floor',shuffle),None,None,
    ('short and plain: lifts the near arm and points firmly to one side, once',[PI(0),stand(0,57,6,(5,0),(-4,0),(18,6),(1,29),8),stand(0,57,6,(5,0),(-4,0),(28,2),(1,29),6),stand(0,57,6,(5,0),(-4,0),(28,2),(1,29),6),stand(0,57,6,(5,0),(-4,0),(18,6),(1,29),8),PI(0)]),
    {'story':('long overblown storytelling: both arms gesture wide and dramatically, head shaking, leaning in close',[stand(0,57,4,(5,0),(-4,0),(18,-8),(-8,-6),-6,le=ELB_UP,re=ELB_UP),stand(2,57,14,(8,0),(-4,0),(22,4),(16,6),6),stand(0,57,0,(5,0),(-4,0),(10,-14),(4,-12),-10,le=ELB_UP,re=ELB_UP),stand(2,57,14,(8,0),(-4,0),(24,10),(20,12),10),stand(0,57,4,(5,0),(-4,0),(18,-8),(-8,-6),-6,le=ELB_UP,re=ELB_UP),stand(2,57,10,(8,0),(-4,0),(16,8),(12,10),4)]),
     'reach':('stops, and the far hand slides slowly behind his back while he keeps smiling',[PI(0),stand(0,57,6,(5,0),(-4,0),(4,29),(-6,20),4,re=('e',-6,12)),stand(0,57,4,(5,0),(-4,0),(4,29),(-10,22),2,re=('e',-7,12)),stand(0,57,4,(5,0),(-4,0),(4,29),(-10,22),2,re=('e',-7,12))])})
c=npc('passenger_pack','보급 승객',90/93,'wary scavenger woman, short messy black hair, dirty olive windbreaker, cargo trousers, boots, large hiking backpack on her back')
QI=lambda b: stand(0,56+b,6,(6,0),(-4,0),(4,6),(2,8),4,le=('e',-2,12),re=('e',-4,12))
QS=lambda a: P((X+a*6,57+a*2),6+16*a,SIDE,0,(X+12+a*8,G),(X-8,G),(2-4*a,-12+38*a) if a<1 else (26,24),(0,-10+36*a) if a<1 else (22,26),le=ELB_UP if a<.5 else ELB_DOWN,re=ELB_UP if a<.5 else ELB_DOWN)
civ(c,('wary idle, both hands gripping the shoulder straps tightly, eyes shifting',[QI(0),QI(.5),QI(1),QI(.5)]),
    ('cautious walk, hands on the shoulder straps',lambda t: gait(t,stride=10,lift=3,bob=1,lean=6,lh=(4,6),rh=(2,8))),None,None,
    ('points off to one side with the near hand, speaking quietly',[QI(0),stand(0,56,4,(6,0),(-4,0),(18,4),(2,8),4,re=('e',-4,12)),stand(0,56,4,(6,0),(-4,0),(26,0),(2,8),2,re=('e',-4,12)),stand(0,56,4,(6,0),(-4,0),(26,0),(2,8),2,re=('e',-4,12)),stand(0,56,4,(6,0),(-4,0),(18,4),(2,8),4,re=('e',-4,12)),QI(0)]),
    {'snatch':('grabs forward with both hands and backs away quickly, hugging the haul to her chest',[QI(0),stand(3,57,16,(10,0),(-4,0),(24,14),(22,16),8),stand(1,57,6,(7,0),(-6,0),(10,12),(8,13),2),stand(-4,57,-4,(2,0),(-10,0),(9,11),(7,12),-4),stand(-8,57,-6,(-2,0),(-14,0),(9,11),(7,12),-4),stand(-12,57,-6,(-6,0),(-18,0),(9,11),(7,12),-4)]),
     'swing':('two-handed overhead swing down at the target',[QS(0),QS(.25),QS(.5),QS(.8),QS(1),QI(0)])})

# ════════ 이빨 요정 (animate_image, 뼈대 없음) ════════
FAIRY={'desc':'tiny grotesque flying creature the size of a forearm: lamprey-like round sucker mouth head with rings of small teeth, pale pink earthworm-like segmented body, two thin human-like arms, two pairs of transparent dragonfly wings',
       'size':64,
       'clips':{'fly':('hovering in place, wings buzzing fast, body undulating like a worm',8),
                'eat':('hunches over and gnaws hungrily, sucker mouth pulsing, thin arms clutching',6),
                'present':('strains and holds out its thin arms forward proudly, wings fluttering',8)}}

if __name__=='__main__':
    for id,n in NPCS.items():
        k=n['k']
        for cn,(a,ps) in list(n['clips'].items()):
            n['clips'][cn]=(a,[anatomic(scale(p,k)) for p in ps])
    tot=sum(len(n['clips']) for n in NPCS.values())
    print(len(NPCS),'NPC',tot,'clips +',len(FAIRY['clips']),'fairy')
    for id,n in NPCS.items(): print(f"  {n['name']}: {len(n['clips'])} -> {', '.join(n['clips'])}")
