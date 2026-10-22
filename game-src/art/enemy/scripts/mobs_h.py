# 사람형 잡몹 11종의 클립 뼈대. 장면표: docs/GPT요청_잡몹_승강기·아파트·학교.md
# 자세 단위는 키 100px 기준(Mob.u로 늘이고 줄임). lh/rh = 앞손·뒷손 목 기준 (dx,dy), lean = 몸통 앞기울기(도), tilt = 고개 숙임(+).
import math
from mobrig import Mob,lerp,staged,sh,jit,flipv,ELB_UP,ELB_DOWN,ELB_OUT,KNEE_UP,KNEE_FWD
# 생성기에 주는 생김새(몸만, 장면·물건 이름 없음). 든 무기만 적는다.
DESC={
 'lurker':'pale tired office worker, grey dress shirt, loose navy necktie, dark grey trousers, black shoes, employee lanyard, slightly long neck, drooping shoulders, blank face',
 'hollow':'gaunt man in a worn beige zip jacket, faded blue jeans, dirty sneakers, abnormally long arms, blank faceless head with smooth skin',
 'shooter':'neat woman clerk in a white blouse, black arm sleeves on the forearms, dark knee-length skirt, low black shoes, hair tied back, holding a thin dark folder',
 'charger':'huge hulking bald brute, torn dark security vest over a grey undershirt, grey work trousers, boots, white target board with a black circle strapped on the back',
 'thief':'wiry man with a large overstuffed hiking backpack, baseball cap, olive windbreaker, towel around the neck, cargo trousers, hiking boots, holding a rusty steel pipe',
 'hum':'thin barefoot pale grey ghostly person with dithered holes in the silhouette, featureless face',
 'resident':'middle-aged man in a stretched white sleeveless undershirt, grey sweatpants, blue slide sandals, slight belly, short black hair',
 'thump':'upside-down high school boy standing on his head, navy uniform trousers, white short-sleeve shirt, arms pressed to the body, legs straight up',
 'mannequin':'anatomical model mannequin, near side smooth peach plastic skin, far half red muscle anatomy, screw joints, painted blue eyes, bare feet',
 'hanged':'ghost woman in an old long white dress, long black hair covering the face, bare feet, holding a rope noose in the near hand',
 'grinner':'huge hunched grey-white monster with an enormous bald head, tiny black eyes, a grin torn ear to ear, massive muscular body, long arms, huge hands, torn uniform trousers',
}
# 생성 뒤 코드로 만드는 클립(생성 0회): lurker turn(목 위 좌우 반전), hanged rise(hang 장을 위로 끌어올림)
CODE_CLIPS={'lurker':['turn'],'hanged':['rise']}

def lurker():
    m=Mob('lurker',lean0=4)
    m.basic(idle=[m.stand(b,tilt=12) for b in (0,.3,.6,.3)])
    T=m.P(-2,0,lean=-8,lh=(2,30),rh=(-2,30),tilt=-6,head=(m.B.head[0]*.4,m.B.head[1]))
    H=m.P(6,2,lean=24,lf=(16,0),rf=(-10,-1),lh=(10,28),rh=(2,30),head=(m.B.head[0]*2.2,m.B.head[1]*.4),tilt=10)
    m.attack('snap',T,H)
    T=m.P(-1,0,lean=-4,lh=(6,-22),rh=(-2,30),le=ELB_UP)
    H=m.P(6,3,lean=20,lf=(15,0),rf=(-10,-1),lh=(30,26),rh=(0,30))
    m.attack('claw',T,H)
    return m
def hollow():
    m=Mob('hollow',lean0=10)
    m.basic(idle=[m.stand(b,lean=10+b*2,tilt=8) for b in (0,.5,1,.5)],
            walk=[m.walk(i/6,stride=8,lift=2,lean=12,lh=(8-6*math.cos(2*math.pi*i/6),44),rh=(4+6*math.cos(2*math.pi*i/6),44)) for i in range(6)])
    T=m.P(-4,12,lean=30,lf=(14,0),rf=(-12,0),lh=(-6,40),rh=(-10,40))
    H=m.P(16,4,lean=48,lf=(30,0),rf=(-4,-6),lh=(44,6),rh=(40,10))
    m.attack('lunge',T,H)
    T=m.P(0,0,lean=-6,lh=(26,-6),rh=(22,-10),le=ELB_OUT,re=ELB_OUT)
    H=m.P(6,2,lean=10,lf=(14,0),rf=(-8,0),lh=(16,26),rh=(14,28))
    m.attack('hug',T,H)
    m.CLIPS['hug_hold']=[m.P(4,0,lean=-8,lf=(12,0),rf=(-10,0),lh=(14,24),rh=(12,26))]
    T=m.P(-2,2,lean=0,lh=(-22,20),rh=(-6,40))
    H=m.P(6,4,lean=22,lf=(16,0),rf=(-10,0),lh=(44,20),rh=(0,40))
    m.attack('swipe',T,H)
    return m
def shooter():
    m=Mob('shooter',lean0=2)
    m.basic()
    SIT=m.P(-4,20,lean=6,lf=(22,0),rf=(18,0),lh=(14,22),rh=(10,24),tilt=16,lk=KNEE_UP,rk=KNEE_UP)
    m.CLIPS['sit']=[SIT]
    m.CLIPS['standup']=[lerp(SIT,m.stand(0),.45),lerp(SIT,m.stand(0),.85)]
    T=m.P(-3,0,lean=-8,lf=(10,0),rf=(-12,0),lh=(-14,-18),rh=(16,6),le=ELB_UP)
    H=m.P(5,2,lean=16,lf=(16,0),rf=(-8,-2),lh=(46,0),rh=(-4,26))
    m.attack('toss',T,H)
    T=m.P(-2,4,lean=10,lf=(12,0),rf=(-10,0),lh=(0,26),rh=(8,20))
    H=m.P(8,4,lean=22,lf=(20,0),rf=(-8,-2),lh=(38,22),rh=(4,24))
    m.attack('jab',T,H)
    return m
def charger():
    m=Mob('charger',lean0=22)
    m.basic()
    T=m.P(-4,10,lean=50,lf=(14,0),rf=(-16,-4),lh=(12,30),rh=(6,32),tilt=10)
    def run(t):
        c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
        return m.P(4,8+2*abs(c),lean=52,lf=(6+16*c,-8*max(0,-sn)),rf=(6-16*c,-8*max(0,sn)),lh=(14-12*c,24),rh=(8+12*c,24),tilt=10)
    m.CLIPS['ram_tele']=[lerp(m.stand(0),T,.5),T]
    m.CLIPS['ram_hit']=[run(0),run(1/3),run(2/3)]
    m.CLIPS['ram_rec']=[m.P(2,4,lean=24,lf=(14,0),rf=(-10,0))]
    T=m.P(-3,0,lean=4,lh=(10,26),rh=(4,28),tilt=-24)
    H=m.P(6,6,lean=48,lf=(16,0),rf=(-12,0),lh=(14,30),rh=(8,30),tilt=24)
    m.attack('butt',T,H)
    m.CLIPS['dizzy']=[m.P(-2,2,lean=14,lh=(10,-4),rh=(6,-2),tilt=-14,le=ELB_UP,re=ELB_UP),m.P(2,2,lean=26,lh=(10,-2),rh=(6,-4),tilt=14,le=ELB_UP,re=ELB_UP)]
    return m
def thief():
    m=Mob('thief',lean0=10)
    m.basic()
    def run(t):
        c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
        return m.P(4,2+2.5*abs(c),lean=20,lf=(6+16*c,-9*max(0,-sn)),rf=(6-16*c,-9*max(0,sn)),lh=(12-14*c,18),rh=(6+14*c,18))
    m.CLIPS['flee']=[run(i/6) for i in range(6)]
    T=m.P(-3,3,lean=18,lf=(12,0),rf=(-10,0),lh=(10,18),rh=(6,20))
    H=m.P(7,2,lean=14,lf=(20,0),rf=(-8,-2),lh=(36,16),rh=(32,18))
    m.attack('shove',T,H)
    T=m.P(-2,0,lean=-6,lh=(4,-26),rh=(8,10),le=ELB_UP)
    H=m.P(7,4,lean=26,lf=(18,0),rf=(-10,-1),lh=(32,30),rh=(4,24))
    m.attack('pipe',T,H)
    return m
def hum():
    m=Mob('hum',lean0=2)
    m.CLIPS['reveal']=[m.stand(0,tilt=18),m.P(0,0,lean=-12,lh=(14,10),rh=(10,14),tilt=-28)]
    m.CLIPS['_pad']=[m.stand(0,tilt=10)]   # 3장 채우기(버림)
    return m
def resident():
    m=Mob('resident',lean0=0)
    BK=dict(lh=(-6,30),rh=(-8,30))
    m.basic(idle=[m.stand(b,**BK) for b in (0,.5,1,.5)])
    m.CLIPS['greet']=[m.P(0,1,lean=22,tilt=18,**BK),m.P(0,0,lean=8,tilt=8,**BK)]
    m.CLIPS['jawopen']=[m.stand(0,tilt=-4,**BK),m.stand(1,tilt=-14,**BK)]
    T=m.P(-2,0,lean=-4,lh=(8,-10),rh=(-6,28),le=ELB_UP)
    H=m.P(6,3,lean=20,lf=(15,0),rf=(-10,-1),lh=(32,18),rh=(-4,30))
    m.attack('nail',T,H)
    T=m.P(-3,0,lean=-14,lh=(4,30),rh=(-4,30),tilt=-26)
    H=m.P(10,4,lean=30,lf=(20,0),rf=(-8,-2),lh=(20,24),rh=(14,26),tilt=14,head=(m.B.head[0]*1.6,m.B.head[1]*.6))
    m.attack('jaw',T,H)
    return m
def thump():
    m=Mob('thump',lean0=0)
    A=dict(lh=(2,32),rh=(-2,32))   # 팔은 몸통에 붙임
    m.basic(idle=[m.stand(0,lean=b,**A) for b in (0,2,0,-2)],
            walk=[m.P(0,d,**A) for d in (-8,6,0,-8,6,0)])   # 뒤집기 전 좌표: dy -는 아래(머리 쪽에서 뜀)
    T=m.P(-4,-10,lean=-14,**A); H=m.P(8,4,lean=40,lf=(10,0),rf=(-6,0),**A)
    m.attack('slam',T,H)
    T=m.P(0,0,lean=0,lf=(-10,-6),rf=(-16,-8),**A); H=m.P(2,0,lean=-4,lf=(30,-30),rf=(24,-24),**A)
    m.attack('kick',T,H)
    top,bot=m.ref_tb
    for n,ps in m.CLIPS.items(): m.CLIPS[n]=[flipv(p,top,bot) for p in ps]
    m.flipped=True
    return m
def mannequin():
    m=Mob('mannequin',lean0=0)
    S=[m.P(0,0,lh=(20,10),rh=(-4,30),lf=(10,0),rf=(-8,0)),m.P(2,0,lean=6,lh=(4,30),rh=(16,12),lf=(18,-10),rf=(-6,0),lk=KNEE_UP),
       m.P(3,0,lean=-6,lh=(-10,20),rh=(18,14),lf=(14,0),rf=(-12,0),tilt=24),m.P(4,1,lean=4,lh=(24,0),rh=(20,4),lf=(8,0),rf=(-14,-6)),
       m.P(5,0,lean=0,lh=(2,30),rh=(-2,30),lf=(16,0),rf=(-4,-12),rk=KNEE_UP,tilt=-20),m.P(6,0,lean=10,lh=(12,-14),rh=(-6,24),lf=(12,0),rf=(-12,0),le=ELB_UP)]
    m.basic(idle=[m.stand(0),m.stand(0,tilt=20),m.stand(0),m.stand(0,tilt=-14)],walk=S)
    m.CLIPS['jerk']=[m.P(0,0,lh=(20,4),rh=(-2,30)),m.P(0,0,tilt=40,lh=(2,30),rh=(-2,30)),m.P(0,0,lf=(18,-24),rf=(-6,0),lk=KNEE_UP),m.P(0,0,lh=(26,4),rh=(24,6))]
    T=m.P(0,0,lean=0,lh=(26,4),rh=(24,6)); H=m.P(10,2,lean=16,lf=(20,0),rf=(-6,0),lh=(30,14),rh=(28,16))
    m.attack('grab',T,H)
    T=m.P(0,0,lean=-4,lh=(4,-26),rh=(-2,30),le=ELB_UP); H=m.P(6,2,lean=14,lf=(16,0),rf=(-8,0),lh=(28,22),rh=(-2,30))
    m.attack('chop',T,H)
    return m
def hanged():
    m=Mob('hanged',lean0=0)
    TIP=dict(lf=(8,-3),rf=(-6,-3))
    m.CLIPS['hang']=[m.P(0,-30,lean=a,lf=(3,-34),rf=(-2,-35),lh=(4,32),rh=(-2,32),tilt=30) for a in (0,4,0,-4)]
    m.CLIPS['drop']=[m.P(0,-14,lf=(3,-16),rf=(-2,-17),tilt=30),m.P(0,4,lean=10,**TIP,tilt=24),m.P(0,0,**TIP,tilt=6)]
    m.basic(idle=[m.stand(0,tilt=t,**TIP) for t in (8,10,12,10)],
            walk=[m.P(2*i,0,lf=(8+4*math.cos(i),-3),rf=(-6-4*math.cos(i),-3),tilt=10) for i in range(6)])
    for n in ('air','lie','getup'): del m.CLIPS[n]
    T=m.P(0,0,lean=-6,lh=(6,-28),rh=(-2,30),le=ELB_UP,**TIP); H=m.P(6,0,lean=14,lh=(42,-2),rh=(-2,30),lf=(14,-3),rf=(-8,-3))
    m.attack('noose',T,H)
    m.CLIPS['noose_pull']=[m.P(0,0,lean=-10,lh=(10,-22),rh=(6,-14),le=ELB_UP,re=ELB_UP,**TIP),m.P(-2,0,lean=-16,lh=(8,-28),rh=(4,-20),le=ELB_UP,re=ELB_UP,**TIP)]
    return m
def grinner():
    m=Mob('grinner',lean0=24)
    m.CLIPS['peek']=[m.P(6,2,lean=34,lh=(10,30),rh=(4,32),tilt=t) for t in (10,16,22,16)]
    m.CLIPS['idle']=[m.P(0,b,lean=24,lh=(16,40),rh=(8,42),tilt=t) for b,t in ((0,-8),(1,0),(0,8),(1,0))]
    def walk(t):
        c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
        return m.P(2,6+2*abs(c),lean=46,lf=(4+10*c,-4*max(0,-sn)),rf=(4-10*c,-4*max(0,sn)),lh=('a',m.X+(30+14*c)*m.u,m.G),rh=('a',m.X+(26-14*c)*m.u,m.G),tilt=-10)
    m.CLIPS['walk']=[walk(i/6) for i in range(6)]
    m.CLIPS['freeze']=[m.P(2,4,lean=40,lf=(10,-14),rf=(-6,0),lh=(20,36),rh=(10,38),tilt=-6,lk=KNEE_UP)]
    T=m.P(-4,2,lean=10,lh=(-16,10),rh=(10,40)); H=m.P(10,6,lean=40,lf=(22,0),rf=(-8,0),lh=(44,30),rh=(12,40))
    m.attack('grab',T,H)
    m.CLIPS['grab_hold']=[m.P(0,0,lean=10,lh=(18,-4),rh=(8,40),tilt=-10,le=ELB_UP)]
    T=m.P(-2,-2,lean=-4,lh=(6,-30),rh=(4,-30),le=ELB_UP,re=ELB_UP); H=m.P(8,10,lean=52,lf=(20,0),rf=(-12,0),lh=(40,46),rh=(36,46))
    m.attack('smash',T,H)
    m.CLIPS['grin']=[m.P(4,4,lean=44,lh=(14,40),rh=(8,42),tilt=-20,head=(m.B.head[0]*1.6,m.B.head[1]*.6)),m.P(8,6,lean=50,lh=(14,40),rh=(8,42),tilt=-26,head=(m.B.head[0]*2,m.B.head[1]*.4))]
    m.CLIPS['hurt']=[m.hurt_l(.6),m.hurt_l(1)]
    m.CLIPS['groggy']=[m.P(-2,4,lean=16,lh=(12,40),rh=(6,40),tilt=-16),m.P(2,4,lean=30,lh=(16,40),rh=(10,40),tilt=16)]
    m.CLIPS['down']=[m.P(4,14,lean=60,lf=(14,0),rf=(-14,0),lh=(30,50),rh=(26,50)),m.P(6,30,lean=80,lf=(18,0),rf=(-16,0),lh=('a',m.X+40*m.u,m.G),rh=('a',m.X+34*m.u,m.G),tilt=20),
                     m.P(8,(m.G-14-m.HY)/m.u,lean=88,lf=(22,-2),rf=(-14,-2),lh=('a',m.X+46*m.u,m.G),rh=('a',m.X+40*m.u,m.G),tilt=30)]
    return m
BUILD={'lurker':lurker,'hollow':hollow,'shooter':shooter,'charger':charger,'thief':thief,'hum':hum,'resident':resident,
       'thump':thump,'mannequin':mannequin,'hanged':hanged,'grinner':grinner}
