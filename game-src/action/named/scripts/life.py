# 생활·지형·탐사·상태·사교·감정 장면의 기본 자세 묶음. 인물 rig가 스타일(S)과 장면별 설명(TEXT)을 넘기면 등록한다.
# 자세가 사람마다 달라야 하는 장면은 인물 rig에서 OVR로 덮어쓴다(설계서 3장 표).
import math
import common as c
from common import P,lerp,sh,tail,cyc,front,KNEE_FWD,KNEE_UP,ELB_UP
class Style:
    def __init__(s,**k):
        s.rest='down'; s.lean=1; s.tilt=0; s.head=(6,-8); s.stride=9; s.lift=3; s.bob=0.4; s.swing=0; s.wlean=2
        s.rstride=18; s.rlean=14; s.rswing=6; s.cross_legs=False; s.sitlean=2; s.knees=0; s.wide=0
        s.__dict__.update(k)
def build(S):
    X,G=c.X,c.G; Y=c.HIPY
    def ST(b=0,tilt=0,lean=None,**k):
        a=dict(lh=S.rest,rh=S.rest,head=S.head); a.update(k)
        return P((X,Y+b+S.knees),S.lean if lean is None else lean,0,0,(X+4+S.wide,G),(X-3-S.wide,G),tilt=S.tilt+tilt,**a)
    def walkf(t,stride=None,lift=None,bob=None,lean=None,swing=None,**k):
        st=S.stride if stride is None else stride; lf=S.lift if lift is None else lift; bb=S.bob if bob is None else bob
        sw=S.swing if swing is None else swing; ln=S.wlean if lean is None else lean
        cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
        a=dict(lh=S.rest,rh=S.rest)
        if sw: a=dict(lh=('r',2-sw*cc,23),rh=('r',-2+sw*cc,23),le=('e',-1-sw*0.4*cc,13),re=('e',-2+sw*0.4*cc,13))
        a['head']=S.head; a['tilt']=S.tilt; a.update(k)
        return P((X+1,Y+bb*abs(cc)+S.knees),ln,0.05*cc,0.1*cc,(X+1+st*cc,G-lf*max(0,-sn)),(X+1-st*cc,G-lf*max(0,sn)),**a)
    def runf(t,**k):
        cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t); sw=S.rswing
        a=dict(lh=('r',4-sw*cc,18),rh=('r',-2+sw*cc,18),le=('e',-3-sw*0.5*cc,11),re=('e',-5+sw*0.5*cc,11),head=S.head); a.update(k)
        return P((X+6,Y+5+1.5*abs(sn)),S.rlean,0.1*cc,0.15*cc,(X+6+S.rstride*cc,G-8*max(0,-sn)),(X+6-S.rstride*cc,G-8*max(0,sn)),**a)
    def SIT(lean=None,tilt=0,b=0,**k):
        a=dict(lh=('r',14,20),rh=('r',12,21),le=('e',5,14),re=('e',3,14)); a.update(k)
        ln=S.sitlean if lean is None else lean
        if S.cross_legs: return P((X-6,Y+19+b),ln,0,0,(X+14,G-10),(X+10,G),tilt=S.tilt+tilt,head=S.head,lk=KNEE_UP,rk=KNEE_UP,**a)
        return P((X-6,Y+19+b),ln,0,0,(X+12,G),(X+8,G),tilt=S.tilt+tilt,head=S.head,lk=KNEE_UP,rk=KNEE_UP,**a)
    def DEEP(d=0,b=0,**k):
        a=dict(lh=('r',8,14),rh=('r',6,15),le=('e',4,11),re=('e',2,11)); a.update(k)
        return P((X+d,Y+30+b),6,0,0,(X+12+d,G),(X-8+d,G),head=S.head,**a)
    S.ST,S.walkf,S.runf,S.SIT,S.DEEP=ST,walkf,runf,SIT,DEEP
    return S
def register(S,TEXT,OVR=None,skip=()):
    """TEXT[이름]=동작 설명. OVR[이름]=자세 목록 또는 (설명, 자세 목록). skip=등록 안 할 이름"""
    X,G=c.X,c.G; Y=c.HIPY; ST,walkf,runf,SIT,DEEP=S.ST,S.walkf,S.runf,S.SIT,S.DEEP
    OVR=OVR or {}; D={}
    # ── 기본 클립 ──
    def stepup(t):
        cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t); r=6*t
        return P((X+1,Y-r+0.5*abs(cc)),S.wlean+2,0,0,(X+1+8*cc,G-r-6*max(0,-sn)),(X+1-8*cc,G-r-6*max(0,sn)),lh=S.rest,rh=S.rest,head=S.head,lk=KNEE_UP,rk=KNEE_UP)
    D['stepup']=tail(cyc(stepup,7),True)
    SO1=P((X+4,Y),4,0,0,(X+16,G-20),(X-3,G),S.rest,S.rest,lk=KNEE_UP,head=S.head)
    SO2=P((X+18,Y-2),2,0,0,(X+22,G),(X+12,G-20),S.rest,S.rest,rk=KNEE_UP,head=S.head)
    D['stepover']=tail([ST(),SO1,lerp(SO1,SO2,.5),SO2,sh(ST(),18),sh(ST(),18)],False)
    LY=P((X-6,94),-90,0,0,(X+34,G-4),(X+33,G-3),('r',4,22),('r',3,24),le=('e',1,12),re=('e',0,12))
    LS=P((X-6,94),-2,0,0,(X+34,G-4),(X+33,G-3),('r',14,20),('r',12,21),le=('e',5,13),re=('e',3,13))
    D['liesit']=tail([LY,lerp(LY,LS,.35),lerp(LY,LS,.7),LS,LS],False)
    HW=lambda d: ST(0,14,lh=('r',18+d,18),rh=('r',16-d,19),le=('e',8,12),re=('e',6,13))
    D['handswork']=tail([HW(0),HW(1),HW(-1),HW(1)],True)
    HH=lambda d: ST(0,8,lh=('r',4+d,-12),rh=('r',-1-d,-11),le=('e',10,-2),re=('e',7,-1))
    D['handshead']=tail([ST(),HH(0),HH(2),HH(0),HH(2),HH(0)],True)
    SM=lambda u: SIT(4,4,lh=('r',9,-2) if u else ('r',12,10),le=('e',9,7) if u else ('e',8,10))
    D['seatmouth']=tail([SM(1),SM(0),SM(1),SM(0)],True)
    D['seathold']=tail([SIT(4,16,b=bb,lh=('r',15,8),le=('e',8,12)) for bb in (0,.4,.7,.4)],True)
    HLK=lambda b: ST(b,16,lh=('r',15,6),rh=('r',8,14),le=('e',8,12),re=('e',4,13))
    D['holdlook']=tail([HLK(0),HLK(.4),HLK(.7),HLK(.4)],True)
    HE=lambda t: ST(0,t,lh=('r',-1,-8),le=('e',9,4))
    D['handear']=tail([HE(-4),HE(-6),HE(-4),HE(-2)],True)
    def sweepf(d):
        Hd=(X+30+d,G+3); T=(X+2+0.3*d,40); at=lambda t:('a',Hd[0]+(T[0]-Hd[0])*t,Hd[1]+(T[1]-Hd[1])*t)
        return P((X+1+0.2*d,Y+1),6,0,0,(X+8,G),(X-4,G),at(.45),at(.75),head=S.head)
    D['sweep']=tail([sweepf(0),sweepf(4),sweepf(7),sweepf(3),sweepf(-3),sweepf(-6)],True)
    LSD=lambda b: P((X-6,94),-86,0,0,(X+22,G-8),(X+18,G-4),('r',12,-6+b),('r',8,12),head=(6,-5),tilt=10,lk=KNEE_UP,rk=KNEE_UP,le=('e',8,4))
    D['liehold']=tail([LSD(0),LSD(1),LSD(1),LSD(0)],True)
    C2=dict(lh=('r',11,12),rh=('r',9,11),le=('e',4,14),re=('e',2,13))
    D['carry2_idle']=tail([ST(b,**C2) for b in (0,.4,.7,.4)],True)
    D['carry2_walk']=tail(cyc(lambda t: walkf(t,swing=0,**C2)),True)
    D['carry2_run']=tail(cyc(lambda t: runf(t,**C2)),True)
    C1=dict(lh=('r',16,10),le=('e',8,12))
    D['carry1_idle']=tail([ST(b,**C1) for b in (0,.4,.7,.4)],True)
    D['carry1_walk']=tail(cyc(lambda t: walkf(t,swing=0,**C1)),True)
    D['carry1_run']=tail(cyc(lambda t: runf(t,lh=('r',18,8),le=('e',8,11))),True)
    # ── 지형·이동 ──
    FR=front(ST()); HT=dict(ST()); HT.update({k:FR[k] for k in ('NOSE','RIGHT EYE','LEFT EYE','RIGHT EAR','LEFT EAR')})
    D['turn']=tail([ST(),HT,FR],False)
    FA=lambda b=0: P((X,Y-4+b),2,0,0,(X+6,G-12),(X-2,G-10),('r',12,4+b),('r',-4,6),le=('e',8,0),re=('e',-6,4),head=S.head)
    D['fall']=tail([FA(0),FA(1),FA(2)],True)
    LD=P((X,Y+22),14,0,0,(X+12,G),(X-8,G),('r',14,14),('r',12,15),le=('e',6,11),re=('e',4,12),head=S.head)
    D['land']=tail([FA(0),LD,lerp(LD,ST(),.5)],False)
    def lad(t):
        cc=math.cos(2*math.pi*t)
        return P((X+2,Y+2),2,0,0,(X+13,92-7*cc),(X+11,92+7*cc-7),('a',X+16,22+7*cc),('a',X+16,29-7*cc),lk=KNEE_UP,rk=KNEE_UP,le=('e',10,4),re=('e',9,6))
    D['ladder']=tail(cyc(lad),True)
    MA=P((X,Y+2),16,0,0,(X+6,G),(X-5,G),('a',X+16,64),('a',X+14,64),le=('e',10,10),re=('e',8,11))
    MJ=P((X+8,46),20,0,0,(X+4,74),(X-2,76),('a',X+18,64),('a',X+16,64),lk=KNEE_UP,rk=KNEE_UP)
    MC=P((X+16,40),20,0,0,(X+24,64),(X+16,64),('r',12,14),('r',10,15),lk=KNEE_FWD,rk=KNEE_FWD,le=('e',5,11),re=('e',3,11))
    MS=P((X+18,64-(G-Y)),2,0,0,(X+22,64),(X+15,64),S.rest,S.rest,head=S.head)
    D['mantle']=tail([ST(),MA,MJ,MC,MS],False)
    VA=P((X+6,Y+4),20,0,0,(X+14,G),(X-4,G-2),('a',X+22,66),('r',8,18),le=('e',12,10))
    VB=P((X+22,48),14,0,0,(X+30,62),(X+26,63),('a',X+22,66),('r',10,16),lk=KNEE_UP,rk=KNEE_UP,le=('e',-2,14))
    VC=P((X+38,Y+8),8,0,0,(X+46,G),(X+40,G),('r',14,16),('r',12,17),le=('e',6,11),re=('e',4,12))
    D['vault']=tail([walkf(0),VA,VB,VC,sh(ST(),40)],False)
    def crawlx(t):
        cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
        return P((X-6,82),70,0,0,(X-30+5*cc,G),(X-30-5*cc,G-1),('a',X+18+6*cc,G-1-3*max(0,sn)),('a',X+12-6*cc,G-1-3*max(0,-sn)),head=(6,-5),tilt=-30)
    D['crawl']=tail(cyc(crawlx,7),True)
    def sneak(t):
        cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
        return P((X+2,Y+10+0.3*abs(cc)),16,0.05*cc,0.1*cc,(X+2+9*cc,G-2*max(0,-sn)),(X+2-9*cc,G-2*max(0,sn)),('r',16,14),('r',12,16),le=('e',8,12),re=('e',5,13),head=S.head)
    D['sneak']=tail(cyc(sneak),True)
    LT=dict(lh=('r',14,14),le=('e',6,13))
    D['idle_light']=tail([ST(b,**LT) for b in (0,.4,.7,.4)],True)
    D['walk_light']=tail(cyc(lambda t: walkf(t,swing=0,**LT)),True)
    D['run_light']=tail(cyc(lambda t: runf(t,lh=('r',14,12),le=('e',6,12))),True)
    LB=lambda a: ST(head=(S.head[0]-12*a,S.head[1]))
    D['lookback']=tail([LB(0),LB(.4),LB(.8),LB(.8),LB(.8),LB(.4),LB(0)],False)
    HDX=lambda b=0: P((X-4,Y+26+b),18,0,0,(X+10,G),(X-12,G-1),('r',7,-3),('r',10,18),head=(6,-6),lk=KNEE_UP,le=('e',8,6),re=('e',3,13))
    D['hide']=tail([ST(),lerp(ST(),HDX(),.5),HDX(0),HDX(.5),HDX(0)],False)
    # ── 탐사 ──
    DO=lambda r: P((X+2*r,Y),3+3*r,0,0,(X+4+4*r,G),(X-3,G),('a',X+20+6*r,58),S.rest,le=('e',12+3*r,10),head=S.head)
    D['door']=tail([ST(),DO(0),DO(.3),DO(.6),DO(1),walkf(.25),walkf(.5)],False)
    def DC(t,r):
        cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
        return P((X+2,Y),2,0,0,(X+2+9*cc,G-3*max(0,-sn)),(X+2-9*cc,G-3*max(0,sn)),('a',X-26+8*r,56),S.rest,head=(5,-8),le=('e',-10,12))
    D['doorclose']=tail([walkf(0),DC(.125,0),DC(.25,.5),DC(.375,1),walkf(.5),walkf(.625)],False)
    KN=lambda r: ST(lh=('a',X+19+2*r,44),le=('e',12,4))
    D['knock']=tail([ST(),KN(0),KN(1),KN(0),KN(1),KN(0)],False)
    def pushf(t):
        cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
        return P((X,Y+2),22,0,0,(X+4+8*cc,G-2*max(0,-sn)),(X+4-8*cc,G-2*max(0,sn)),('a',X+26,60),('a',X+24,62),le=('e',14,8),re=('e',12,9))
    D['push']=tail(cyc(pushf,6),True)
    IS=lambda r: P((X+1,Y+24),12,0,0,(X+10,G),(X-2,G),('a',X+20+3*r,G-2),S.rest,tilt=18,lk=KNEE_FWD,rk=KNEE_FWD,le=('e',10,14))
    D['inspect']=tail([ST(),lerp(ST(),IS(0),.5),IS(0),IS(1),IS(0),IS(1)],False)
    def leadx(t):
        cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
        return P((X+3,Y+0.4*abs(cc)),4,0,0,(X+3+9*cc,G-3*max(0,-sn)),(X+3-9*cc,G-3*max(0,sn)),('r',-26,20),S.rest,head=(5,-8),le=('e',-12,12))
    D['leadhand']=tail(cyc(leadx),True)
    D['bow']=tail([ST(),ST(0,0,S.lean+10),ST(0,4,S.lean+18),ST(0,0,S.lean+10),ST()],False)
    D['elevwait']=tail([ST(),ST(.3),ST(.5),ST(.3)],True)
    FSD=lambda b=0: P((X-8,96),-2+b,0,0,(X+10,G),(X+6,G-1),('r',14,24),('r',12,24),lk=KNEE_UP,rk=KNEE_UP,le=('e',6,13),re=('e',4,13),head=S.head)
    D['floorsit']=tail([ST(),lerp(ST(),DEEP(),.6),DEEP(),lerp(DEEP(),FSD(),.5),FSD()],False)
    D['floorrest']=tail([FSD(0),FSD(.5),FSD(1),FSD(.5)],True)
    # ── 상태·결과 ──
    D['hurtidle']=tail([ST(b,4) for b in (0,1,1.5,1)],True)
    def limpx(t):
        cc=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t); dip=3*max(0,-cc)
        return P((X+2,Y+1+dip),6,0,0,(X+2+9*cc,G-4*max(0,-sn)),(X+2-6*cc,G),S.rest,S.rest,tilt=4,rk=KNEE_UP,head=S.head)
    D['limp']=tail(cyc(limpx,7),True)
    FE=lambda d: ST(lh=('r',11+d*.5,10),rh=('r',10-d*.5,11),le=('e',4,12),re=('e',2,12))
    D['fear']=tail([FE(0),FE(1),FE(-1),FE(1)],True)
    NS=lambda a: ST(head=(S.head[0]-6*a,S.head[1]),tilt=6*a,lh=('r',8,-3),le=('e',10,5))
    D['nausea']=tail([ST(),NS(0),NS(1),NS(1),NS(0)],False)
    CL1=P((X,Y+22),6,0,0,(X+10,G),(X-6,G),('r',10,18),('r',8,19),le=('e',4,12),re=('e',2,12))
    CLD=P((X-14,96),-80,0,0,(X+16,G-4),(X+12,G-2),('r',8,16),('r',6,18),head=(5,-6),tilt=30,lk=KNEE_UP,rk=KNEE_UP)
    D['collapse']=tail([ST(),lerp(ST(),CL1,.6),CL1,DEEP(),lerp(DEEP(),CLD,.5),CLD,CLD,CLD],False)
    BL=lambda b=0: P((X-6,94),-90,0,0,(X+34,G-4),(X+33,G-3),('r',7,20+b),('r',6,21),le=('e',2,12),re=('e',1,12))
    D['bedlie']=tail([BL(0),BL(1),BL(1),BL(0)],True)
    VI=lambda u: ST(lh=('r',14,-14+6*u),le=('e',10,0))
    D['victory']=tail([ST(),VI(0),VI(1),VI(0),VI(1),ST(),ST()],False)
    # ── 본부 업무 ──
    D['chairsit']=tail([ST(),lerp(ST(),SIT(12),.5),SIT(12),SIT(),SIT()],False)
    TY=lambda r: SIT(10,12,lh=('r',20,12-2*r),rh=('r',17,12-2*(1-r)),le=('e',8,14),re=('e',6,15))
    D['typing']=tail([TY(0),TY(1),TY(0),TY(1)],True)
    GC=lambda r: ST(0,14,lh=('r',15,6),rh=('r',13+r,4-r),le=('e',8,10),re=('e',7,9))
    D['gearcheck']=tail([ST(),GC(0),GC(1),GC(2),GC(3),ST()],False)
    TI=lambda r: ST(0,6,lh=('r',5,4+4*r),le=('e',9,10))
    D['tie']=tail([ST(),TI(0),TI(.4),TI(.8),TI(1),TI(.5),TI(0),ST()],False)
    # ── 생활·여가 ──
    D['seatrest']=tail([SIT(-2,b=bb) for bb in (0,.4,.7,.4)],True)
    TKS=dict(lh=('r',8,0),le=('e',9,10))
    D['seatthink']=tail([SIT(6,-4,b=bb,**TKS) for bb in (0,.4,.7,.4)],True)
    D['doze']=tail([SIT(0,0),SIT(0,10),SIT(0,18),SIT(0,20)],False)
    YA=lambda a: ST(0,-4*a,lh=('r',8,-3),le=('e',10,5)) if a else ST()
    D['yawn']=tail([ST(),YA(1),YA(1),ST()],False)
    STR=lambda u: P((X,Y-2*u),S.lean,0,0,(X+4,G),(X-3,G),('r',8+6*u,-4-22*u),('r',6+6*u,-3-22*u),le=('e',10,-2-8*u),re=('e',8,-1-8*u),head=S.head,tilt=-8*u)
    D['stretch']=tail([ST(),STR(.4),STR(.8),STR(1),STR(1),STR(.6),STR(.2),ST()],False)
    HF=lambda a: ST(0,2,lh=('r',4-6*a,-10),le=('e',9,0))
    D['hairflip']=tail([ST(),HF(0),HF(.5),HF(1),HF(.5),ST()],False)
    BRU=lambda d: ST(0,2,lh=('r',8+d,-2),rh=('r',10,12),le=('e',10,6),re=('e',4,12))
    D['brushteeth']=tail([BRU(0),BRU(1.5),BRU(0),BRU(1.5)],True)
    # ── 사교 ──
    GE=lambda d: ST(lh=('r',16+d,4-d),le=('e',9,8))
    D['gesture']=tail([GE(0),GE(2),GE(1),GE(-1)],True)
    D['armscross']=tail([ST(0,-4,lh='cross',rh='cross'),ST(.4,-5,lh='cross',rh='cross'),ST(.7,-5,lh='cross',rh='cross'),ST(.4,-5,lh='cross',rh='cross')],True)
    D['nod']=tail([ST(),ST(0,5),ST(0,10),ST(0,5),ST()],False)
    HSK=lambda a: ST(head=(S.head[0]-3*a,S.head[1]))
    D['headshake']=tail([ST(),HSK(1),HSK(-1),HSK(1),HSK(-1),ST()],False)
    WV=lambda d: ST(lh=('r',10,-14+d),le=('e',12,-2))
    D['wave']=tail([ST(),WV(0),WV(3),WV(0),WV(3),WV(0),WV(3),ST()],False)
    HS=lambda d: P((X+5,Y),5,0,0,(X+10,G),(X+1,G),('r',22,16+d),S.rest,le=('e',10,12),head=S.head)
    D['handshake']=tail([ST(),HS(0),HS(1),HS(0),HS(1),ST()],False)
    PT=lambda d: P((X+5,Y),6,0,0,(X+10,G),(X+1,G),('r',20,-2+d),S.rest,le=('e',11,6),head=S.head)
    D['pat']=tail([ST(),PT(0),PT(1),PT(0),PT(1),ST()],False)
    PO=P((X+1,Y),3,-0.2,0,(X+5,G),(X-3,G),('r',34,-4),S.rest,le=('e',16,2),head=S.head)
    D['point']=tail([ST(),lerp(ST(),PO,.5),PO,PO],False)
    SR=lambda a: P((X,Y-a),S.lean,0,0,(X+4,G),(X-3,G),('r',14,12-2*a),('r',12,13-2*a),tilt=-8*a,le=('e',6,12),re=('e',4,12),head=S.head)
    D['shrug']=tail([ST(),SR(.5),SR(1),SR(1),SR(.5),ST()],False)
    HG=lambda a: P((X+5,Y),4,0,0,(X+10,G),(X+1,G),('r',18+3*a,6),('r',16+3*a,8),tilt=4,le=('e',12,4),re=('e',10,6),head=S.head)
    D['hug']=tail([ST(),HG(1),HG(0),HG(.3),HG(0)],False)
    # ── 감정 ──
    LG=lambda b: ST(b,4)
    D['laugh']=tail([ST(),LG(0),LG(1),LG(0),LG(1),LG(0)],False)
    GL=lambda d: ST(lh=('r',12+d,8),rh=('r',11,9),le=('e',4,12),re=('e',3,12))
    D['glad']=tail([ST(),GL(0),GL(1),GL(0)],False)
    CY=lambda d: ST(0,10,lh=('r',10+d*.5,14),rh=('r',9-d*.5,15),le=('e',3,12),re=('e',2,12))
    D['cry']=tail([ST(),CY(0),CY(1),CY(-1),CY(1)],True)
    WCX=lambda b: P((X+4,Y+b),12,0,0,(X+6,G),(X-3,G),'down','down',head=(7,-7),tilt=14)
    D['wallcry']=tail([WCX(0),WCX(1),WCX(0),WCX(1)],True)
    KC=lambda b: P((X-2,G-c.THIGH*0.55+b),4,0,0,(X-2-c.SHIN,G),(X-4-c.SHIN,G),('r',14,22),('r',12,22),tilt=22,lk=KNEE_FWD,rk=KNEE_FWD,le=('e',5,13),re=('e',3,13))
    D['kneelcry']=tail([KC(0),KC(1),KC(0),KC(1)],True)
    D['sad']=tail([ST(.5,16),ST(1,20),ST(1.2,20),ST(1,18)],True)
    SHT=lambda a: P((X+4*a,Y),S.lean+10*a,0,0,(X+4+6*a,G),(X-3+2*a,G),('r',14+6*a,2),S.rest,le=('e',10,6),head=S.head,tilt=-6*a)
    D['shout']=tail([ST(),SHT(.6),SHT(1),SHT(1),ST()],False)
    DS1=lambda a: P((X+2,Y+2*a),8+8*a,0,0,(X+6,G),(X-3,G),('a',X+22,48+18*a),S.rest,tilt=6,le=('e',12,6+6*a),head=S.head)
    D['deskslam']=tail([ST(),DS1(0),DS1(1),DS1(1),lerp(DS1(1),ST(),.5)],False)
    D['surprise']=tail([ST(),sh(ST(0,-8),-3),sh(ST(0,-8),-3),ST(0,-4)],False)
    SF=P((X-10,Y+28),10,0,0,(X+2,G),(X-18,G),('a',X+6,G-1),('r',10,16),tilt=-6,le=('e',10,10),re=('e',4,12))
    D['startlefall']=tail([ST(),sh(ST(),-6),lerp(ST(),SF,.6),SF,SF],False)
    PD=P((X-8,96),-4,0,0,(X+16,G),(X+12,G),('r',14,22),('r',12,22),tilt=10,lk=KNEE_UP,rk=KNEE_UP,le=('e',6,13),re=('e',4,13))
    D['plopdown']=tail([ST(),lerp(ST(),DEEP(),.5),DEEP(),lerp(DEEP(),PD,.5),PD],False)
    EMB=lambda d,a: ST(lh=('r',10+d*.5,12),rh=('r',9-d*.5,13),head=(S.head[0]-6*a,S.head[1]),le=('e',3,12),re=('e',2,12))
    D['embarrassed']=tail([ST(),EMB(0,.3),EMB(1,.6),EMB(-1,.6),EMB(1,.6),EMB(0,.3)],False)
    AY=lambda d: ST(0,-2,lh=('r',4,-11+d),le=('e',10,-1))
    D['annoyed']=tail([ST(),AY(0),AY(1),AY(0),AY(1),AY(0),ST()],False)
    TK=lambda b: ST(b,-4,lh=('r',8,-4),le=('e',10,4))
    D['think']=tail([TK(0),TK(.4),TK(.7),TK(.4)],True)
    D['bored']=tail([ST(b,6) for b in (0,.5,.8,.5)],True)
    # ── 전투 공통(아이템·피격 등) ──
    PU=lambda u: P((X+2,Y+24*u),10+20*u,0,0,(X+10,G),(X-6,G),('a',X+18,G-2-20*(1-u)),S.rest,le=('e',10,12),head=S.head)
    D['pickup']=tail([ST(),PU(.5),PU(1),PU(1),PU(.5),ST()],False)
    TS=lambda u: P((X+2,Y),4,0,0,(X+8,G),(X-6,G),('r',-8+30*u,6-6*u),S.rest,le=('e',-2+12*u,10),head=S.head)
    D['toss']=tail([ST(),TS(0),TS(.5),TS(1),TS(1),ST()],False)
    DR=lambda u: ST(0,-10*u,lh=('r',8,-2-2*u),le=('e',10,6))
    D['drink']=tail([ST(),DR(0),DR(1),DR(1),DR(1),DR(0),ST()],False)
    EA=lambda u: ST(0,4,lh=('r',8,-2) if u else ('r',14,10),le=('e',10,6) if u else ('e',8,11))
    D['eat']=tail([ST(),EA(0),EA(1),EA(0),EA(1),ST()],False)
    BA=lambda d: ST(0,14,lh=('r',14,14+d),rh=('r',16,12-d),le=('e',8,12),re=('e',8,12))
    D['bandage']=tail([ST(),BA(0),BA(2),BA(0),BA(2),ST()],False)
    HI=P((X-3,Y+1),-10,0,0,(X+4,G),(X-5,G),('r',10,14),('r',6,16),head=(5,-8),tilt=-10)
    D['hit']=tail([ST(),HI,lerp(HI,ST(),.5),ST()],False)
    DN1=P((X-8,Y+6),-24,0,0,(X+2,G-8),(X-10,G-4),('r',14,4),('r',4,8),head=(5,-8),tilt=-20)
    DN2=P((X-14,84),-60,0,0,(X+4,G-14),(X-6,G-10),('r',16,6),('r',8,6),head=(5,-7),tilt=-20,lk=KNEE_UP,rk=KNEE_UP)
    DN3=P((X-18,96),-88,0,0,(X+8,G-3),(X+4,G-2),('r',6,20),('r',4,22),head=(5,-6),tilt=-10)
    D['down']=tail([ST(),DN1,DN2,lerp(DN2,DN3,.5),DN3,DN3,DN3],False)
    GU1=P((X-18,94),-60,0,0,(X+4,G-3),(X,G-2),('a',X-22,G-1),('r',4,22),head=(5,-6),lk=KNEE_UP,rk=KNEE_UP)
    GU2=P((X-20,Y+30),10,0,0,(X-8,G),(X-26,G),('a',X-26,G-1),('r',8,16),lk=KNEE_UP)
    D['getup']=tail([DN3,GU1,lerp(GU1,GU2,.5),GU2,lerp(GU2,ST(),.5),ST(),ST()],False)
    D['tired']=tail([ST(b,8,S.lean+6) for b in (1,2,2.5,2)],True)
    PI=dict(lh=('r',12,6),le=('e',8,12))
    D['idle_pipe']=tail([ST(b,**PI) for b in (0,.4,.7,.4)],True)
    D['walk_pipe']=tail(cyc(lambda t: walkf(t,swing=0,**PI),7),True)
    SG=dict(lh=('r',22,6),rh=('r',10,10),le=('e',10,10),re=('e',4,12))
    D['idle_shotgun']=tail([ST(b,**SG) for b in (0,.4,.7,.4)],True)
    D['walk_shotgun']=tail(cyc(lambda t: walkf(t,swing=0,**SG),7),True)
    D['run_shotgun']=tail(cyc(lambda t: runf(t,lh=('r',22,8),rh=('r',10,10),le=('e',10,10),re=('e',4,12))),True)
    PW=lambda u: P((X+4*u,Y+2),6+6*u,-0.2,0,(X+12,G),(X-10,G),('r',4+24*u,-14+26*u),('r',2+22*u,-12+26*u),le=('e',6+8*u,0+6*u),re=('e',4+8*u,1+6*u),head=S.head)
    D['pipe']=tail([ST(**PI),PW(0),PW(.5),PW(1),PW(1),lerp(PW(1),ST(**PI),.5)],False)
    SGF=lambda r: P((X-r,Y+1),2-4*r,-0.2,0,(X+8,G),(X-8,G),('r',24,4-2*r),('r',12,8),le=('e',12,6),re=('e',5,10),head=S.head)
    D['shotgun']=tail([SGF(0),SGF(1),SGF(.5),SGF(0)],False)
    for n,v in OVR.items():
        D[n]=v[1] if isinstance(v,tuple) else v
        if isinstance(v,tuple): TEXT[n]=v[0]
    for n,ps in D.items():
        if n in skip: continue
        if n not in TEXT: print('NOTEXT',n); continue
        c.clip(n,TEXT[n],ps)
    return D
LIFE_NAMES=['stepup','stepover','liesit','handswork','handshead','seatmouth','seathold','holdlook','handear','sweep','liehold',
 'carry2_idle','carry2_walk','carry2_run','carry1_idle','carry1_walk','carry1_run',
 'turn','fall','land','ladder','mantle','vault','crawl','sneak','idle_light','walk_light','run_light','lookback','hide',
 'door','doorclose','knock','push','inspect','leadhand','bow','elevwait','floorsit','floorrest',
 'hurtidle','limp','fear','nausea','collapse','bedlie','victory','chairsit','typing','gearcheck','tie',
 'seatrest','seatthink','doze','yawn','stretch','hairflip','brushteeth',
 'gesture','armscross','nod','headshake','wave','handshake','pat','point','shrug','hug',
 'laugh','glad','cry','wallcry','kneelcry','sad','shout','deskslam','surprise','startlefall','plopdown','embarrassed','annoyed','think','bored',
 'pickup','toss','drink','eat','bandage','hit','down','getup','tired','idle_pipe','walk_pipe','idle_shotgun','walk_shotgun','run_shotgun','pipe','shotgun']
