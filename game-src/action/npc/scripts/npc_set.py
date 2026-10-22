# NPC 전체 클립 목록 조립: 사람마다 {클립: (동작 문장, [자세...])} (자세는 쟈알디 키 93 기준, 생성 때 키 비율로 줄임).
# 본부 4명 = 기본 8 + 고유 + 생활 116 (설계서 4장), 상인 5명 = 28 (5장), 민간인 18종 = 공포 17 / 핵심 8, 승객 2명 = npc_rig 그대로.
# 문장엔 몸 자세만 쓴다(물건·가구 이름 없음). 100자 제한.
import math,os,sys
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
sys.path.insert(0,os.path.join(HERE,'../../jyaldi-v5/scripts'))
import rig,npc_rig,npc_life
from rig import P,lerp,staged,sh,G,X,KNEE_FWD,KNEE_UP,ELB_DOWN,ELB_UP,ELB_OUT,anatomic
from npc_rig import stand,cyc,runner,gait,cower_walk,SIDE
from npc_life import restyle

def T(name): return rig.CLIPS[name][2]          # 쟈알디 뼈대
def RS(ps,st): return [restyle(p,st,i) for i,p in enumerate(ps)] if st else ps
def pick(id,*names): c=npc_rig.NPCS[id]['clips']; return {n:c[n] for n in names}

# ════════ 본부 4명 ════════
HQ=['jaemtri','gognija','dejure','konjyuce']
RUN={'jaemtri':('short quick mincing run on her toes, knees close together, near hand pressing her skirt down',dict(lean=8,stride=11,lift=6,arm=5,bob=1.5,hy=56)),
     'gognija':('wild noisy run, arms windmilling wide, coat flapping, huge bounding strides',dict(lean=14,stride=20,lift=12,arm=19,bob=3.5,hy=58)),
     'dejure': ('panicked flailing run, arms waving above her head, nearly tripping with every step',dict(lean=20,stride=13,lift=8,arm=15,bob=3,hy=59,armlift=10))}
BASIC={  # 4.1 줍기·마시기·먹기·피로 (잼트리, 고그니쟈, 데쥬레, 콘쥬스)
 'pickup':('bends her knees together, near hand smoothing her skirt, and picks up from the floor',
           'bends sharply at the waist and snatches up from the floor in one swoop',
           'squats down slowly and picks up from the floor carefully with both hands',
           'grabs from the floor with one quick hand without really bending her back'),
 'drink':('sips daintily with the little finger raised','tips his head far back and downs it in one go',
          'holds it in both hands, blows on it, then takes a tiny sip','gulps it down in big quick swallows'),
 'eat':('takes a tiny bite, far hand covering her mouth','takes a huge bite and chews grinning widely',
        'nibbles in tiny quick bites like a hamster','stuffs her cheeks full and chews happily'),
 'tired':('rubs her own shoulder with the far hand, polite smile kept on','stifles a huge yawn, shoulders drooping, still grinning',
          'droops and nods off standing, jerking awake','yawns wide and half stretches her arms'),
}
SIG={'jaemtri':['poke','shush','glare'],'gognija':['bellow','pill','welcome','present','steeple','tinker'],
     'dejure':['sorry','bloom','work','scan'],'konjyuce':['lift','wink','protest','deadpan','wonder']}
def hq(id):
    j=HQ.index(id); st=npc_life.STYLE[id]; out={}
    out.update(pick(id,'idle','walk'))
    out['run']=pick(id,'run')['run'] if id=='konjyuce' else (RUN[id][0],cyc(8,lambda t: runner(t,**RUN[id][1])))
    for n in ('pickup','drink','eat','tired'): out[n]=(BASIC[n][j],RS(T(n),st))
    out.update(pick(id,'talk'))
    out.update(pick(id,*SIG[id]))
    for n,(a,ps,tl) in npc_life.life_clips(id).items(): out[n]=(a,ps)
    out['handwash']=(('washes her hands neatly, palms then backs, then dabs them dry','scrubs his hands vigorously with big motions, then shakes them hard',
                      'washes her hands very carefully, finger by finger','rubs her palms together fast and splashy, then flicks her hands dry')[j],RS(T('handwash'),st))
    if id=='konjyuce':   # 욕실 대체 2클립: 옷 입은 채(설계서 4.4)
        out['bathin_k']=('fully clothed, humming happily, reaches forward, pushes, then slips quickly forward',RS(T('door'),st))
        out['bathout_k']=('fully clothed, walks out briskly rubbing her damp hair with both hands',RS(T('towel'),st))

    return out

# ════════ 중림 상인 5명: 28클립 ════════
MER=['madeokhee','munhyeran','goyeonji','yunjia','shinyuri']
MST={'madeokhee':dict(lean=1,tilt=2,stance=0.8,arm=0.8,bounce=0),'munhyeran':dict(lean=-3,tilt=-4,stance=1.15,arm=1.25,bounce=0),
     'goyeonji':dict(lean=0,tilt=3,stance=0.9,arm=0.75,bounce=0),'yunjia':dict(lean=4,tilt=4,stance=0.85,arm=1.0,bounce=0.5),
     'shinyuri':dict(lean=0,tilt=0,stance=1.25,arm=0.85,bounce=0)}
WALK={'madeokhee':('gliding silent walk, tiny lift, one hand holding the other wrist in front',lambda t: gait(t,stride=10,lift=2,bob=0.3,lean=2,lh=(9,15),rh=(8,16))),
      'munhyeran':('easy swaggering walk, shoulders rolling, near hand in a trouser pocket',lambda t: gait(t,stride=13,lift=4,bob=1.5,lean=-3,arm=9,hipsway=0.35,lh=(3,22),tilt=-4)),
      'goyeonji':('slow precise even walk, both hands in her coat pockets, upper body still',lambda t: gait(t,stride=11,lift=3,bob=0.6,lean=2,lh=(3,22),rh=(1,22))),
      'yunjia':('light pattering little steps, hands loosely together in front',lambda t: gait(t,stride=9,lift=5,bob=1.6,lean=4,lh=(9,15),rh=(8,16),tilt=4)),
      'shinyuri':('firm heavy planted walk, each step set down hard, arms swinging little',lambda t: gait(t,stride=13,lift=4,bob=1.0,lean=0,arm=5,hipsway=0.1))}
# 행: (쟈알디 뼈대 이름, 뒤집기?, 문장 5개: 마덕희, 문혜란, 고연지, 윤지아, 신유리)
MROW={
 'turn':('turn',0,('turns her eyes first, then her body follows slowly','spins around with a big swing','turns around slowly and evenly','turns around lightly','turns, checking behind her first')),
 'greet':(None,0,('raises her eyebrows and gives one small lazy nod','flings both arms wide open, delighted','gives one small nod, nothing else moves','waves the near hand and steps forward warmly','jerks her chin toward the side once')),
 'nod':('nod',0,('slow nod with half-closed eyes','big eager nods, several times','one precise nod','gentle kind nod','a tiny nod')),
 'headshake':('headshake',0,('smiling, wags the near index finger side to side','laughing, shakes her head no','one flat shake of the head','shakes her head apologetically','does not move her head, only her eyes')),
 'handover':('handover',0,('slides it forward with her fingertips','pushes it forward with a hearty swing','places it forward precisely','holds it out with both hands','tosses it forward casually')),
 'receive':('handover',1,('takes it and weighs it in her palm','snatches it and hugs it close','takes it, glances, pockets it','receives it politely with both hands','takes it without looking')),
 'count':('papers',0,('flicks through bills very fast','fans the bills out wide','counts like a machine, exact and even','counts slowly, lips moving','riffles the stack once with the thumb')),
 'point':('point',0,('flicks the back of her hand toward it','arm thrust out in a big gesture','points behind with the thumb','guides with an open palm','points with a jerk of the chin')),
 'armscross':('armscross',0,('holds her wrist, head tilted, listening','arms folded, leaning back, grinning','hands in pockets, only eyes move','hands clasped, nodding along','arms folded, staring straight ahead')),
 'think':('think',0,('fingertip to her lower lip, thinking','fiddles with her wristwatch, thinking','fingers twirling slowly, thinking','fingertip on her cheek, thinking','perfectly still, eyes narrowing')),
 'smile':('smile',0,('crooked one-sided smile','huge beaming grin','barely a smile at the mouth corners','bright warm smile','one corner of the mouth lifts')),
 'laugh':('laugh',0,('snorts a laugh behind the back of her hand','laughs loudly holding her belly','one short breath of a laugh','giggles behind her hand','one short snort through the nose')),
 'surprise':('surprise',0,('only her eyes widen, body still','throws herself back theatrically','barely reacts at all','covers her mouth with both hands','far hand drifts behind her back')),
 'annoyed':('annoyed',0,('sighs and inspects her nails','the grin drops flat','presses two fingers to her temple','puffs her cheeks slightly','rolls her neck with a grimace')),
 'angry':('angry',0,('goes rigid, smile frozen in place','taps her wrist once, eyes cold','jabs her thumb backward, cold','firmly waves her hand no','plants her fists and leans forward')),
 'shrug':('shrug',0,('palms up, a mocking shrug','huge exaggerated shrug','a tiny shrug','an apologetic shrug','a single small head tilt')),
 'bored':('bored',0,('looks at her nails','shuffles her hands restlessly','rubs her palms together slowly','fiddles with the strap at her hip','taps the small of her back')),
 'chairsit':('chairsit',0,('sits and crosses her legs','drops into the seat and leans back','sits down perfectly upright','sits down lightly, knees together','sits, angled to watch the door')),
 'seatrest':('seatrest',0,('seated, chin resting on her hand','seated, leaning far back','seated upright, hands on knees','seated, knees together, swaying','seated, leaning back, arms folded')),
 'seattalk':(None,0,('seated, tapping a fingertip in front of her while talking','seated, leaning forward with big gestures','seated, counting off on her fingers','seated, leaning in kindly while talking','seated, lowering one finger per beat')),
 'phone':('phone',0,('whispering, turning her body away','chatting loudly, laughing','one short answer, then lowers it','chatting with a bright smile','listening silently')),
}
SEAT=lambda a,lh: rig.SITF(6,0,lh=lh,le=ELB_DOWN)
SEATTALK=[SEAT(0,('r',16,10)),SEAT(0,('r',20,6)),SEAT(0,('r',18,12)),SEAT(0,('r',22,4)),SEAT(0,('r',16,10)),SEAT(0,('r',20,8))]
GREET={'madeokhee':'nod','munhyeran':None,'goyeonji':'nod','yunjia':'wave','shinyuri':'nod'}
MSIG={'madeokhee':['appraise','stamp','smirk'],'munhyeran':['backslap','watch','beckon'],'goyeonji':['glove','treat','refuse'],
      'yunjia':['candy','bandage','hand','beckon'],'shinyuri':['knife','lean','neck']}
def merchant(id):
    j=MER.index(id); st=MST[id]; out={}
    c=npc_rig.NPCS[id]['clips']
    out['idle']=c['idle']; out['walk']=(WALK[id][0],cyc(8,WALK[id][1]))
    for n,(tpl,rev,acts) in MROW.items():
        if n=='greet':
            g=GREET[id]
            ps=RS(T(g),st) if g else [stand(0,55,0,(8,0),(-6,0),(8,10),(6,12),0),stand(0,54,-4,(9,0),(-7,0),(22,-14),(-14,-12),-10,le=ELB_UP,re=ELB_UP),stand(0,54,-4,(9,0),(-7,0),(22,-14),(-14,-12),-10,le=ELB_UP,re=ELB_UP),stand(0,55,0,(8,0),(-6,0),(14,0),(10,2),-4),stand(0,55,0,(8,0),(-6,0),(8,10),(6,12),0),stand(0,55,0,(8,0),(-6,0),(8,10),(6,12),0)]
        elif n=='seattalk': ps=RS(SEATTALK,st)
        else:
            ps=RS(T(tpl),st)
            if rev: ps=ps[::-1]
        out[n]=(acts[j],ps)
        if n=='turn': out['talk']=c['talk']
    for n in MSIG[id]: out[n]=c[n]
    # 고유 4번째(설계서 5장 28행)
    if id=='madeokhee':
        SW=lambda x: stand(1,55,10,(6,0),(-4,0),(x,16),(8,16),8,le=ELB_DOWN)
        out['sweep']=('leans forward and sweeps the near hand slowly flat across at waist height, ring hand gliding',[SW(10),SW(14),SW(19),SW(24),SW(26),SW(12)])
    elif id=='munhyeran':
        HT=lambda a: stand(0,55,-6+8*a,(8,0),(-4,0),(14,8-6*a),(12,10-4*a),-14+10*a,le=ELB_DOWN,re=ELB_DOWN)
        HI=stand(1,55,-2,(8,0),(-4,0),(3,22),'down',-4,le=('e',-2,14),h=0.4)
        out['laughstop']=('laughing loudly with her head back, then stops dead, suddenly flat and cold',[HT(1),HT(0),HT(1),HT(0),HI,HI])
    elif id=='goyeonji':
        GE=lambda a: stand(0,55,3,(5,0),(-4,0),(14,8-2*a),(10,10+2*a),6,le=ELB_DOWN,re=ELB_DOWN)
        out['estimate']=('calculating: folds down fingers of the near hand one by one with the far hand, expressionless',[GE(0),GE(1),GE(0),GE(1),GE(0),GE(1)])
    elif id=='shinyuri':
        out['riffle']=('riffles through a stack once with the thumb, then pockets it without counting',RS(T('papers'),st))
    return out

# ════════ 민간인 18종: 공포 동작 ════════
# 서 있는 겁먹은 자세들(쟈알디 체격 기준). 바닥 G=100.
def KN(lean=4,tilt=0,lh='down',rh='down',hx=0,**kw):   # 두 무릎 꿇기: 무릎은 바닥, 발등은 뒤
    return P((X+hx,76),lean,SIDE,0,(X+hx-20,G),(X+hx-24,G),lh,rh,tilt=tilt,lk=KNEE_FWD,rk=KNEE_FWD,**kw)
def cover(i):   # 쪼그려 두 손으로 머리 감쌈
    j=(-1)**i*0.6
    return P((X,84+abs(j)),34,SIDE,0,(X+10,G),(X-8,G),(9,-3+j),(7,-2+j),tilt=34,lk=KNEE_UP,rk=KNEE_UP,le=('e',16,-2),re=('e',14,-1))
REC=[stand(0,55,2,(6,0),(-4,0),'down','down',0),
     stand(-3,56,-10,(4,0),(-8,0),(14,-8),(12,-6),-12,le=ELB_DOWN,re=ELB_DOWN),
     stand(-7,56,-14,(-2,3),(-12,0),(16,-12),(14,-10),-16,le=ELB_DOWN,re=ELB_DOWN),
     stand(-11,57,-14,(-12,0),(-16,0),(16,-10),(14,-8),-14,le=ELB_DOWN,re=ELB_DOWN),
     stand(-15,57,-12,(-12,0),(-24,3),(15,-12),(13,-10),-16,le=ELB_DOWN,re=ELB_DOWN),
     stand(-17,57,-12,(-14,0),(-24,0),(16,-11),(14,-9),-14,le=ELB_DOWN,re=ELB_DOWN)]
FLEE=lambda t: runner(t,lean=12,stride=17,lift=10,arm=17,bob=3,hy=58,armlift=9)
TRIP=[FLEE(0),FLEE(.25),P((X+4,62),34,0,0,(X+16,G-8),(X-6,G),(20,4),(18,6),tilt=10)]+T('collapse')[5:8]
def crawl(t):   # 엎드려 두 팔로 바닥을 끌며 앞으로 기어감, 한쪽 무릎이 번갈아 굽음
    c=math.cos(2*math.pi*t); d=2*t*4
    hx=X-6+d
    return P((hx,93),84,0,0,(hx-40+6*max(0,c),G-6*max(0,c)),(hx-42+6*max(0,-c),G-6*max(0,-c)),
             ('a',hx+44+8*c,G-1),('a',hx+44-8*c,G-1),tilt=-30,lk=KNEE_UP,rk=KNEE_UP,le=ELB_UP,re=ELB_UP)
def scoot(i):   # 주저앉아 두 손 뒤로 짚고 발로 밀며 뒤로
    d=-3*i; a=(-1)**i
    return P((X-2+d,90),-28,0,0,(X+20+d+3*a,G),(X+15+d-3*a,G),('a',X-16+d,G),('a',X-20+d,G),tilt=-14,lk=KNEE_UP,rk=KNEE_UP)
WAIL=[KN(6,8,(14,10),(12,12),le=ELB_DOWN,re=ELB_DOWN),KN(-6,-30,(8,26),(5,27)),KN(-10,-36,(6,28),(3,28)),
      KN(-4,-28,(10,-14),(8,-12),le=ELB_UP,re=ELB_UP),KN(-10,-36,(6,28),(3,28)),KN(-6,-30,(8,26),(5,27))]
CLU=lambda a: stand(0,56,6*a,(5,0),(-5,0),(4,-12),(2,-11),-16+10*a,le=('e',12,-6),re=('e',10,-5))
BEG=[KN(4,4,(16,6),(14,7)),KN(16,14,(18,8),(16,9)),KN(36,20,(16,12),(14,13)),KN(16,14,(18,8),(16,9)),KN(36,20,(16,12),(14,13)),KN(16,14,(18,8),(16,9))]
PND=lambda a,b: stand(3,56,12,(10,0),(-4,0),(22-4*a,-8+4*a),(20-4*b,-6+4*b),-8,le=('e',10,4),re=('e',8,6))
POUND=[PND(0,1),PND(1,0),PND(0,1),PND(1,0),PND(0,1),PND(1,1)]
SLIDE=[stand(-2,55,-6,(6,0),(-4,0),(2,24),(-2,24),-6),stand(-3,62,-6,(10,0),(0,0),(4,22),(-2,22),-4),
       P((X-4,72),-6,0,0,(X+16,G),(X+10,G),(4,22),('a',X-14,G-30),lk=KNEE_UP,rk=KNEE_UP),
       P((X-5,84),-8,0,0,(X+20,G),(X+14,G),(6,20),('a',X-16,G-16),lk=KNEE_UP,rk=KNEE_UP),
       P((X-6,91),-8,0,0,(X+20,G),(X+16,G),(12,16),(10,18),tilt=14,lk=KNEE_UP,rk=KNEE_UP),
       P((X-6,91),-6,0,0,(X+20,G),(X+16,G),(9,-2),(7,-1),tilt=24,lk=KNEE_UP,rk=KNEE_UP,le=('e',14,8),re=('e',12,9))]
def supported(ps):   # 절뚝 걸음 + 앞팔을 앞사람 어깨 위로 걸침(어깨 높이로 앞으로 뻗음)
    out=[]
    for p in ps:
        q=dict(p); s=q['RIGHT SHOULDER']; q['RIGHT ELBOW']=(s[0]+14,s[1]-4); q['RIGHT ARM']=(s[0]+27,s[1]-1); out.append(q)
    return out
FOLLOW=lambda hands: (lambda t: cower_walk(t,hands))
# 민간인: (등급 full/core, 자세 변환, 걸음 손 자리, 몸가짐 한 마디)
CIV={
 'missing_worker':('full',dict(lean=6,tilt=6,stance=0.9,arm=0.8,bounce=0),((4,24),(1,25)),'dazed and exhausted'),
 'worker_f':('full',dict(lean=4,tilt=4,stance=0.8,arm=0.9,bounce=0),((10,10),(8,8)),'frazzled and shaky'),
 'survivor_f':('full',dict(lean=6,tilt=6,stance=0.8,arm=0.9,bounce=0),((10,10),(8,8)),'terrified, trembling'),
 'survivor_m':('full',dict(lean=3,tilt=0,stance=1.1,arm=1.2,bounce=0),((4,-8),(2,-7)),'panicking clumsily'),
 'grandma':('full',dict(lean=12,tilt=8,stance=0.7,arm=0.7,bounce=0,crouch=3),((12,14),(10,15)),'frail and slow, elderly'),
 'student':('full',dict(lean=2,tilt=-2,stance=1.0,arm=1.15,bounce=0.5),((10,12),(8,14)),'jittery teenage boy'),
 'child':('full',dict(lean=0,tilt=-6,stance=0.9,arm=1.25,bounce=1),((8,6),(6,7)),'like a small scared child'),
 'courier':('full',dict(lean=0,tilt=0,stance=1.15,arm=1.1,bounce=0),((10,12),(6,16)),'tense and jumpy'),
 'repairman':('full',dict(lean=-2,tilt=0,stance=1.2,arm=1.0,bounce=0),((8,16),(4,20)),'gruff but shaken'),
 'pajama':('full',dict(lean=5,tilt=4,stance=0.75,arm=0.9,bounce=0),((10,4),(8,5)),'half asleep and frightened'),
 'grandpa':('core',dict(lean=10,tilt=6,stance=0.8,arm=0.7,bounce=0,crouch=2),((-6,20),(-8,20)),'stiff and slow, elderly'),
 'clerk':('core',dict(lean=4,tilt=6,stance=0.9,arm=1.0,bounce=0),((10,10),(8,8)),'nervous and twitchy'),
 'cleaner':('core',dict(lean=6,tilt=4,stance=0.9,arm=0.9,bounce=0),((12,12),(10,13)),'worried, sturdy'),
 'hiker':('core',dict(lean=0,tilt=-2,stance=1.25,arm=1.05,bounce=0),((8,14),(4,18)),'loud and stiff'),
 'rider':('core',dict(lean=2,tilt=0,stance=1.1,arm=1.2,bounce=0.5),((10,10),(6,12)),'restless and quick'),
 'collegian':('core',dict(lean=4,tilt=6,stance=0.8,arm=0.85,bounce=0),((10,8),(8,9)),'timid and quiet'),
 'lady':('core',dict(lean=-1,tilt=-2,stance=0.8,arm=0.8,bounce=0),((10,12),(8,13)),'composed but pale'),
 'cook':('core',dict(lean=3,tilt=2,stance=1.0,arm=1.05,bounce=0),((12,14),(10,15)),'flustered and sweaty'),
}
CORE=['tremble','cover','recoil','flee','crawl','wail','follow','hitfall']
FULL=['tremble','cover','recoil','flee','trip','crawl','scoot','wail','clutch','beg','pound','wallslide','limp','supported','hitfall','sob','follow']
CACT={
 'tremble':'stands hunched, arms wrapped around herself, trembling, eyes darting',
 'cover':'crouches low hiding, both hands clamped over the head, shaking',
 'recoil':'screams and stumbles backward, hands thrown up in front of the face',
 'flee':'flees in terror, arms flailing, glancing back over the shoulder',
 'trip':'running, trips and pitches forward, slamming flat on the front',
 'crawl':'fallen, crawls desperately forward on hands and knees, head low',
 'scoot':'sitting on the floor, pushes backward with heels and hands in terror',
 'wail':'on both knees, throws the head back and wails, arms hanging',
 'clutch':'grips the head with both hands and screams, rocking',
 'beg':'on both knees, hands clasped, bowing again and again, begging',
 'pound':'pounds frantically forward with both fists at head height, screaming',
 'wallslide':'back to the wall, slides down to the floor, then buries the face in the hands',
 'limp':'limping walk, dragging the rear leg, far hand clutching the side',
 'supported':'limping, near arm draped forward over a helper\'s shoulders, leaning on them',
 'hitfall':'struck, cries out, crumples to the knees and falls forward',
 'sob':'drops to sit on the floor in relief, sobbing into both hands',
 'follow':'follows with small hunched hurried steps, glancing around',
}
COVR={'child':{'wail':'on both knees, bawling with the mouth wide open, fists rubbing the eyes','tremble':'stands clutching the front of the coat, lip trembling, about to cry'},
      'grandma':{'wail':'on both knees, wailing and beating the chest with one hand','flee':'hobbles away as fast as she can, hunched, arms waving weakly'},
      'grandpa':{'flee':'shuffles away hurriedly, stooped, one arm thrown back'},
      'survivor_m':{'clutch':'clutches the head with both hands, yelling, spinning in place'},
      'repairman':{'pound':'hammers forward hard with the side of both fists, shouting angrily'},
      'pajama':{'tremble':'clutches the shawl closed at the chest with both hands, shivering'}}
def _he(id): return 'her' if id in ('worker_f','survivor_f','grandma','pajama','cleaner','collegian','lady') else 'his'
def civ_action(id,n):
    a=COVR.get(id,{}).get(n,CACT[n])
    if _he(id)=='his': a=a.replace('herself','himself').replace(' her ',' his ')
    m=CIV[id][3]; s=f'{a}, {m}'
    return s if len(s)<=100 else a[:100]
def civ_poses(id,n):
    st=CIV[id][1]; hands=CIV[id][2]
    if n=='tremble': return RS(T('fear'),st)
    if n=='cover': return [cover(i) for i in range(4)]
    if n=='recoil': return RS(REC,st)
    if n=='flee': return cyc(8,FLEE)
    if n=='trip': return TRIP
    if n=='crawl': return RS(T('crawl'),st)
    if n=='scoot': return [scoot(i) for i in range(6)]
    if n=='wail': return WAIL
    if n=='clutch': return RS([CLU(0),CLU(1),CLU(0),CLU(-1)],st)
    if n=='beg': return BEG
    if n=='pound': return RS(POUND,st)
    if n=='wallslide': return SLIDE
    if n=='limp': return RS(T('limp'),st)
    if n=='supported': return supported(RS(T('limp'),st))
    if n=='hitfall': return T('collapse')
    if n=='sob': return T('plopdown')
    if n=='follow': return RS(cyc(8,FOLLOW(hands)),st)
def civilian(id):
    names=FULL if CIV[id][0]=='full' else CORE
    return {n:(civ_action(id,n),civ_poses(id,n)) for n in names}

def passenger(id): return dict(npc_rig.NPCS[id]['clips'])

def fit(a):   # 100자 넘으면 마지막 쉼표 앞에서 자름
    while len(a)>100: a=a[:a.rfind(', ')] if ', ' in a else a[:100]
    return a
def _refl(a,j,c):   # 관절 j를 선분 a→c에 대해 접어 반대쪽으로(뼈 길이 그대로)
    dx,dy=c[0]-a[0],c[1]-a[1]; L=dx*dx+dy*dy or 1
    t=((j[0]-a[0])*dx+(j[1]-a[1])*dy)/L; f=(a[0]+t*dx,a[1]+t*dy)
    return (2*f[0]-j[0],2*f[1]-j[1])
def unflip(p):   # 거꾸로 꺾인 팔꿈치·무릎을 바로잡음(audit_joints와 같은 기준)
    import audit_joints as AJ
    q=dict(p)
    for s in ('RIGHT','LEFT'):
        if AJ.cross(q[f'{s} SHOULDER'],q[f'{s} ELBOW'],q[f'{s} ARM'])>0.12: q[f'{s} ELBOW']=_refl(q[f'{s} SHOULDER'],q[f'{s} ELBOW'],q[f'{s} ARM'])
        if AJ.cross(q[f'{s} HIP'],q[f'{s} KNEE'],q[f'{s} LEG'])<-0.12: q[f'{s} KNEE']=_refl(q[f'{s} HIP'],q[f'{s} KNEE'],q[f'{s} LEG'])
    return q
def clips(id):
    c=hq(id) if id in HQ else merchant(id) if id in MER else civilian(id) if id in CIV else passenger(id)
    return {n:(fit(a),[unflip(p) for p in ps]) for n,(a,ps) in c.items()}
ALL=HQ+MER+list(CIV)+['passenger_3y','passenger_pack']
def cost(nf): return 3 if nf<=8 else 4   # 실측 2026-10-22: 4장도 3회
if __name__=='__main__':
    tot={}
    for id in ALL:
        c=clips(id)
        for n,(a,ps) in c.items():
            assert len(a)<=100,(id,n,len(a),a); assert 3<=len(ps)<=15,(id,n,len(ps))
        cr=sum(cost(len(ps)) for a,ps in c.values()); tot[id]=(len(c),cr)
        print(f'{id:15s} {len(c):4d} clips {cr:5d} cr')
    g=lambda ids: (sum(tot[i][0] for i in ids),sum(tot[i][1] for i in ids))
    print('HQ',g(HQ),'MER',g(MER),'CIV',g(list(CIV)),'PAX',g(['passenger_3y','passenger_pack']))
