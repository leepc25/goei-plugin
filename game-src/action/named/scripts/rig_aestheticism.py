# 탐미주의 뼈대. 설계: docs/캐릭터제작서/동작설계_aestheticism.md (클립 목록 ../plan.py AESTHETICISM과 이름이 같아야 함)
# 키 108 → sc 1.16. 캔버스 256×160, 발바닥 y=152, 기준 x=100. 마네킹: 상체·머리 미동 없음, 팔은 몸 옆에 뻣뻣.
# 반대로 꺾이는 클립(fold·fold_run·unfold·crawl·jump·claw3 3타·getup)은 anatomic() 보정을 건너뛰고(raw) 무릎·팔꿈치를 일부러 반대로 둔다.
import math
import common as c
from common import P,lerp,handfirst,hipfirst,sh,tail,cyc,KNEE_FWD,KNEE_UP,ELB_UP
import life
c.setup(1.16,g=100,x=66,w=256,h=160,dx=34,dy=52)
X,G,Y=c.X,c.G,c.HIPY
k=lambda v: v*c.K
KNEE_BACK=lambda m:-m[0]          # 무릎이 뒤로(반대) 꺾임
ELB_FWD=lambda m:m[0]-0.8*m[1]    # 팔꿈치가 앞·아래로(반대)
S=life.build(life.Style(rest='down',lean=0,tilt=10,stride=10,lift=2,bob=0.2,swing=0,wlean=0,rstride=20,rlean=6,rswing=2,head=(6,-8)))
ST,walkf,runf,DEEP=S.ST,S.walkf,S.runf,S.DEEP
LIMP=dict(lh=('r',2,26),rh=('r',-2,26),le=('e',1,14),re=('e',-2,14))
def IDLE(b=0,tilt=0,**kw):
    a=dict(LIMP); a.update(kw); return ST(b,tilt,**a)
c.set_akp(IDLE())
cl=c.clip
def raw(name,action,poses):
    assert 3<=len(poses)<=16,(name,len(poses)); c.CLIPS[name]=(action[:100],'',poses)
# 일직선 하이힐 걸음: 발이 몸 가운데 선 위로 교차, 상체 고정
def stalkf(t,stride=10):
    cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+1,Y+0.3*abs(cc)),0,0,0,(X+1+k(stride)*cc,G-2*max(0,-sn)),(X+1-k(stride)*cc,G-2*max(0,sn)),**LIMP,tilt=10)
# ── 이동 ──
cl('idle','mannequin idle: arms hanging limp, head tilted to one side with a crooked smile, one shoulder higher',tail([IDLE(0),IDLE(.2),IDLE(.3),IDLE(.2),IDLE(0),IDLE(0)],True))
cl('stalk','high heel model walk, feet placed on one straight line, upper body and head perfectly still',tail(cyc(stalkf,8),True))
cl('run','sprints on high heels, stiff arms pressed to her sides, long strides',tail(cyc(lambda t: runf(t,lh=('r',2,24),rh=('r',-2,24),le=('e',1,13),re=('e',-2,13),tilt=6)),True))
# 접힌 자세: 무릎 뒤로 꺾고 손으로 바닥 짚는 네 발 자세
def FOLDP(t=0,d=0,cyc_=False):
    cc=math.cos(2*math.pi*t) if cyc_ else 0; sn=math.sin(2*math.pi*t) if cyc_ else 0
    hip=(X-k(6)+d,G-k(22)+abs(sn))
    return P(hip,80,0,0,(X-k(2)+d+k(8)*cc,G-k(3)*max(0,-sn)),(X-k(10)+d-k(8)*cc,G-k(3)*max(0,sn)),
             ('a',X+k(30)+d-k(8)*cc,G),('a',X+k(26)+d+k(8)*cc,G),head=(8,-2),tilt=-70,lk=KNEE_BACK,rk=KNEE_BACK,le=ELB_FWD,re=ELB_FWD)
def mixr(a,b,t): return lerp(a,b,t)
FD=[lerp(runf(0),FOLDP(),u) for u in (0,.2,.4,.6,.8)]+[FOLDP(),FOLDP(),FOLDP(.25,0,True),FOLDP(.5,0,True),FOLDP(.75,0,True)]
raw('fold','her running body folds: knees and elbows bend the wrong way as she drops onto all fours',tail(FD,False))
raw('fold_run','scuttles forward on all fours with backward-bent knees, head fixed forward, very fast',tail([FOLDP(i/8,0,True) for i in range(8)],True))
UF=[lerp(FOLDP(),IDLE(),u) for u in (0,.15,.3,.45,.6,.75,.9,1)]
raw('unfold','twists each joint back one by one and unfolds from all fours up to standing',tail(UF,False))
raw('crawl','slow creeping crawl on all fours, knees bent backward like a spider, head forward',tail([FOLDP(i/8,0,True) for i in range(8)],True))
JC=lambda u: P((X,Y+k(14)*u),0,0,0,(X+k(8),G),(X-k(6),G),**LIMP,tilt=10,lk=KNEE_BACK,rk=KNEE_BACK)
JA=P((X+k(4),Y-k(22)),-4,0,0,(X+k(2),G-k(30)),(X-k(10),G-k(26)),**LIMP,tilt=8,lk=KNEE_BACK,rk=KNEE_BACK)
raw('jump','crouches with knees bending backward, then springs up like a released spring',tail([IDLE(),JC(.5),JC(1),lerp(JC(1),JA,.5),JA,JA,lerp(JA,JC(.6),.5),IDLE()],False))
# ── 근접 ──
PY=lambda u: IDLE(lh=('r',10+12*u,6-2*u),le=('e',8+4*u,10),tilt=10)
cl('parry','backhand parry: flicks an attack aside with the back of one hand, face unchanged',tail([IDLE(),PY(0),PY(1),PY(1),IDLE()],False))
SL=lambda u: P((X+k(2)*u,Y),4*u,-0.1,0,(X+k(10),G),(X-k(6),G),('r',20-30*(1-u),-2+10*u),('r',-2,26),le=('e',10,4),re=('e',-2,14),tilt=10)
cl('slap','open palm slap swung hard across',tail([IDLE(),SL(0),SL(.5),SL(1),SL(1),IDLE()],False))
C1=lambda u: P((X+k(3),Y),6,-0.1,0,(X+k(12),G),(X-k(6),G),('r',14+16*u,-6+20*u),('r',-2,26),le=('e',12,4+6*u),re=('e',-2,14),tilt=8)
C2=lambda u: P((X+k(4),Y),8,-0.1,0,(X+k(12),G),(X-k(6),G),('r',8,26),('r',10+20*u,18-22*u),le=('e',2,14),re=('e',10,12-8*u),tilt=8)
C3=lambda u: P((X+k(2),Y),-6*u,-0.1,0,(X+k(12),G),(X-k(6),G),('r',-6-18*u,8),('r',-2,26),le=('e',8+6*u,10),re=('e',-2,14),tilt=10,le_=None) if False else \
             P((X+k(2),Y),-6*u,-0.1,0,(X+k(12),G),(X-k(6),G),('r',-6-18*u,8),('r',-2,26),le=('e',10+4*u,4),re=('e',-2,14),tilt=10)
raw('claw3','three hits: clawing swipe, backhand claw, then the elbow bends the wrong way to stab behind her',
    tail([c.anatomic(p) for p in (IDLE(),C1(0),C1(.6),C1(1),C2(0),C2(.6),C2(1))]+[C3(0),C3(.5),C3(1),C3(1),IDLE()],False))
GB=lambda h: P((X+k(2),Y),10-10*h,-0.1,0,(X+k(12),G),(X-k(6),G),('r',28,14-14*h),('r',24,16-14*h),le=('e',14,10-6*h),re=('e',12,12-6*h),tilt=6)
cl('grab','lunges a hand out, grabs something and hoists it up',tail([IDLE(),GB(0),GB(0),GB(.5),GB(1),GB(1)],False))
TW=lambda u: P((X,Y),10*u-6,0.1,0,(X+k(10),G),(X-k(6),G),('r',24-6*u+30*u,-2+10*u),('r',20+20*u,0+10*u),le=('e',12,4),re=('e',10,6),tilt=6)
cl('throw','hurls what she is holding out to the side',tail([GB(1),TW(0),TW(.5),TW(1),TW(1),IDLE()],False))
EX=P((X,Y),-2,0,0,(X+k(4),G),(X-k(3),G),('r',10,-24),('r',-4,24),le=('e',10,-8),re=('e',-2,13),tilt=-4)
AM=lambda u: lerp(EX,runf(.25),u)
cl('ambush','holds a statue pose, then her head snaps around first and her body lunges after it',tail([EX,EX,c.jit(EX,1,0,['NOSE','EYE','EAR']),c.jit(EX,3,0,['NOSE','EYE','EAR']),AM(.3),AM(.6),AM(.85),runf(.25)],False))
# ── 예술 ──
FK=lambda u: IDLE(lh=('r',22,6-4*u),le=('e',12,8),tilt=8)
cl('flick','from a distance, just flicks one finger',tail([IDLE(),FK(0),FK(1),FK(1),IDLE()],False))
DC=lambda t: IDLE(lh=('r',18+6*math.cos(2*math.pi*t),2+8*math.sin(2*math.pi*t)),le=('e',12,4),rh=('r',4,8),re=('e',8,14),tilt=-2)
cl('decree','recites without breathing: one hand on her chest, the other slowly conducting the air',tail(cyc(DC,6),True))
DE=lambda u: IDLE(lh=('r',22,0-4*u),le=('e',12,2),rh=('r',4,8),re=('e',8,14),tilt=-2)
cl('decree_end','the conducting hand stops dead in mid-air and the fingers close together',tail([DC(0),DE(0),DE(.5),DE(1),DE(1),DE(1)],False))
FR=lambda u: IDLE(lh=('r',12+6*u,-2),le=('e',10,6),rh=('r',10+6*u,-4),re=('e',6,6),tilt=8+6*u)
cl('frame','makes a picture frame with both thumbs and forefingers and peers through it at someone',tail([IDLE(),FR(0),FR(.5),FR(1),FR(1),FR(1)],False))
MP=lambda u: P((X+k(4)*u,Y),8*u,0,0,(X+k(10),G),(X-k(6),G),('r',14+12*u,-2),('r',12+12*u,0),le=('e',10+4*u,6),re=('e',8+4*u,7),tilt=6)
MB=lambda u: P((X+k(4)-k(10)*u,Y),8-10*u,0,0,(X+k(10)-k(8)*u,G),(X-k(6)-k(8)*u,G),('r',26-12*u,-2+20*u),('r',24-14*u,0+20*u),le=('e',14-4*u,6+6*u),re=('e',12-4*u,7+6*u),tilt=6+10*u)
cl('masterpiece','steps in and cups someone\'s face in both hands, then slowly steps back, tilting her head to admire',
   tail([IDLE(),MP(.3),MP(.6),MP(1),MP(1),MP(1),MP(1),MB(.2),MB(.4),MB(.6),MB(.8),MB(1),MB(1),MB(1)],False))
SW=lambda d: P((X,Y+k(10)),30,0,0,(X+k(10),G),(X-k(8),G),('r',22,26),('r',20,18+d),le=('e',10,16),re=('e',10,12+d/2),tilt=24)
cl('sew','bent over, one hand pressing something low in front, the other hand stitching up and down',tail([IDLE(),lerp(IDLE(),SW(0),.5),SW(0),SW(-8),SW(0),SW(-8),SW(0),SW(-8),SW(0),SW(-8)],False))
# ── 그릇 ──
VC=lambda u: P((X-k(2)*u,Y+k(30)*u),20*u,0,0,(X+k(4)+k(4)*u,G),(X-k(3)-k(4)*u,G),('r',2+6*u,26),('r',-2+6*u,26),le=('e',1,14),re=('e',-2,14),tilt=10+40*u,lk=KNEE_UP,rk=KNEE_UP)
cl('vacate','abandons the body: it goes limp and collapses in place, joints loosening, into an empty mannequin heap',tail([IDLE(),VC(.2),VC(.45),VC(.7),VC(1),VC(1)],False))
RG=P((X,Y),0,0,0,(X+k(4),G),(X-k(3),G),('r',6,20),('r',-4,22),le=('e',6,12),re=('e',-4,12),tilt=0)
PO=lambda u: lerp(RG,IDLE(),u)
cl('possess','an empty rigid mannequin wakes: the head jerks up first, then the fingers start to move',
   tail([RG,RG,c.jit(RG,0,-2,['NOSE','EYE','EAR']),PO(.2),PO(.4),PO(.6),PO(.8),IDLE()],False))
# ── 피격 ──
HT=c.jit(IDLE(),-3,1,['NOSE','EYE','EAR'])
cl('hit','barely moves: only the head snaps sideways and back',tail([IDLE(),HT,HT,IDLE()],False))
DL=lambda u: IDLE(lh=('r',6,30) if u<.5 else ('r',4,26),le=('e',6,20),rh=('r',4+10*u,10),re=('e',6,14),tilt=20)
cl('dislocate','an arm pops out and dangles, then she twists it back into its socket with her other hand',tail([IDLE(),DL(0),DL(0),DL(.3),DL(.6),DL(1),DL(1),IDLE()],False))
DN=[P((X-k(4),Y),-20,0,0,(X+k(4),G-4),(X-k(10),G-4),('r',10,-8),('r',2,-6)),
    P((X-k(14),Y+k(16)),-55,0,0,(X+k(4),G-k(14)),(X-k(4),G-k(10)),('r',16,-8),('r',8,-4),lk=KNEE_UP,rk=KNEE_UP),
    P((X-k(22),G-6),-86,0,0,(X+k(12),G-k(8)),(X+k(8),G-3),('r',8,-14),('r',14,4),lk=KNEE_UP,rk=KNEE_UP)]
LIE=P((X-k(24),G-5),-90,0,0,(X+k(18),G-3),(X+k(14),G-1),('r',14,-8),('r',18,6),le=('e',6,-8))
cl('down','falls backward like something breaking, limbs at odd angles',tail([HT]+DN+[LIE,LIE,LIE],False))
# 브리지: 배를 위로 들고 팔다리 반대로
BR=lambda u: P((X-k(10),G-k(26)*u-4),-90+20*u,0,0,(X+k(14),G),(X+k(8),G),('a',X-k(34),G),('a',X-k(30),G),head=(8,4),tilt=60,lk=KNEE_UP,rk=KNEE_UP,le=ELB_FWD,re=ELB_FWD)
GU=[LIE,BR(.3),BR(.6),BR(1),BR(1)]+[lerp(BR(1),IDLE(),u) for u in (.2,.4,.6,.8,1)]
raw('getup','bridge getup: arches her belly up with limbs bent the wrong way, then flips upright',tail(GU,False))
# ── 관객·대화 ──
AP=lambda o: IDLE(lh=('r',14 if o else 11,6),le=('e',8,12),rh=('r',10 if o else 12,6),re=('e',6,12),tilt=-4,b=-1 if o else 0)
cl('applaud','claps delightedly, bouncing on her toes',tail([AP(1),AP(0),AP(1),AP(0),AP(1),AP(0)],True))
SK=lambda u: IDLE(lh=('r',4,12),le=('e',10,13),rh=('r',8,11),re=('e',4,14),tilt=-4-6*u,head=(5,-8))
cl('sulk','sulks: crosses her arms and jerks her head away "...annoying"',tail([IDLE(),SK(0),SK(1),SK(1),SK(1),SK(.6)],False))
cl('tilt','interested: slowly tilts her head the other way',tail([IDLE(),IDLE(tilt=-6),IDLE(tilt=-16),IDLE(tilt=-20)],False))
IV=lambda u: P((X+k(4)*u,Y+k(4)*u),34*u,0,0,(X+k(10),G),(X-k(6),G),('r',8,22),('r',-6,20),le=('e',4,14),re=('e',-6,12),tilt=-20*u)
cl('interview','bends forward and pushes her face right up close: "what is your goal?"',tail([IDLE(),IV(.3),IV(.6),IV(1),IV(1),IV(1),IV(.6),IDLE()],False))
PR=lambda u: P((X,Y),-2,0,0,(X+k(4),G),(X-k(3),G),('r',10+20*u,10),('r',-6,20),le=('e',10+6*u,10),re=('e',-6,12),tilt=-2)
cl('present','curator greeting: one open hand presents the artwork beside her, the other hand behind her back',tail([IDLE(),PR(.3),PR(.6),PR(1),PR(1),PR(1),PR(1),IDLE()],False))
DT=lambda d: IDLE(lh=('r',22,10+d),le=('e',12,12),tilt=16)
cl('dote','strokes something tenderly with one hand, head tilted, smiling',tail([DT(0),DT(3),DT(6),DT(3),DT(0),DT(3)],True))
NT=lambda u: P((X+k(4)*u,Y+k(3)*u),10*u,0,0,(X+k(10),G),(X-k(6),G),('r',14+10*u,14+6*u),('r',-2,26),le=('e',10,14),re=('e',-2,14),tilt=10)
cl('note','steps close and slips something into a pocket at hip height',tail([IDLE(),NT(.4),NT(.8),NT(1),NT(1),IDLE()],False))
LG=lambda u: IDLE(tilt=-12-8*u,b=-.5*u)
cl('laugh','throws her head back laughing, shoulders shaking',tail([IDLE(),LG(.6),LG(1),LG(.6),LG(1),LG(.6)],False))
TK=lambda u: IDLE(lh=('r',16+2*u,8-4*u),le=('e',10,10),tilt=14-4*u)
cl('talk','gentle friendly hand gesture, head tilted',tail([TK(0),TK(1),TK(0),TK(1),TK(.5),TK(0)],True))
def lv(t):
    p=stalkf(t); return p
LV=[IDLE(),IDLE(lh=('r',2,-14),le=('e',4,-2))]+[stalkf(i/6) for i in range(6)]
cl('leave','"time to go": turns away, waves one hand over her shoulder and walks off on her heels',tail(LV,False))
if __name__=='__main__':
    print(len(c.CLIPS),'clips',sum(len(v[2]) for v in c.CLIPS.values()),'frames'); print('audit',c.audit()[:20])
