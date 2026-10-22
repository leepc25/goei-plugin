# 꼬마 인형(96×96)·마네킹(192×144) 뼈대. 근거: 마리오네트 조종(머리 줄 → 어깨 줄 → 무릎 줄, 줄에 들린 걸음은 무릎이 들렸다 툭 떨어지고
# 발끝이 바닥을 스침, 줄이 끊기면 관절이 풀려 그 자리에 무너짐). 관절은 기준 그림(base/K-pad.png, base/M-pad.png)에서 잼.
import math,sys,os
sys.path.insert(0,os.path.dirname(__file__))
import rig_rojemon as R
from rig_rojemon import lerp,sh,KF,KU,ED,EU,EO,EB,anatomic

CLIPS={}
BODY={
  'kid':dict(W=96,H=96,THIGH=4.5,SHIN=4,UARM=5,FARM=4.5,TORSO=13,G=87,X=43,HY=80,head=(9,-8)),
  'man':dict(W=192,H=144,THIGH=19,SHIN=21,UARM=15,FARM=16,TORSO=30,G=128,X=55,HY=88,head=(5,-8)),
}
A_KP={
 'kid':{'NOSE':(53,59),'NECK':(44,67),'RIGHT SHOULDER':(46,69),'RIGHT ELBOW':(47,74),'RIGHT ARM':(48,78),'LEFT SHOULDER':(42,69),'LEFT ELBOW':(39,74),'LEFT ARM':(38,78),
        'RIGHT HIP':(45,80),'RIGHT KNEE':(45,84),'RIGHT LEG':(45,87),'LEFT HIP':(41,80),'LEFT KNEE':(40,84),'LEFT LEG':(40,87),
        'RIGHT EYE':(50,57),'LEFT EYE':(52,56),'RIGHT EAR':(42,57),'LEFT EAR':(44,56)},
 'man':{'NOSE':(61,50),'NECK':(56,58),'RIGHT SHOULDER':(57,62),'RIGHT ELBOW':(51,77),'RIGHT ARM':(52,95),'LEFT SHOULDER':(53,62),'LEFT ELBOW':(60,77),'LEFT ARM':(64,93),
        'RIGHT HIP':(57,88),'RIGHT KNEE':(60,107),'RIGHT LEG':(60,128),'LEFT HIP':(53,88),'LEFT KNEE':(52,107),'LEFT LEG':(48,128),
        'RIGHT EYE':(59,47),'LEFT EYE':(61,46),'RIGHT EAR':(53,48),'LEFT EAR':(55,47)},
}
def use(b):
    c=BODY[b]
    for k in ('THIGH','SHIN','UARM','FARM'): setattr(R,k,c[k])
    return c
def Pb(b,hip,lean=0,lf=None,rf=None,lh='down',rh='down',tilt=0,s=0,h=0,**k):
    c=use(b)
    return R.P(hip,lean,s,h,lf or (hip[0]+2,c['G']),rf or (hip[0]-2,c['G']),lh,rh,head=c['head'],tilt=tilt,torso=c['TORSO'],**k)
def clip(name,b,poses): CLIPS[name]=(b,[anatomic(p) for p in poses])

# ── 꼬마 (몸 작고 머리 큼: 사지 4~5px) ──
c=BODY['kid']; X,HY,G=c['X'],c['HY'],c['G']
K=lambda dx=0,dy=0,lean=0,lf=None,rf=None,lh='down',rh='down',tilt=0,**k: Pb('kid',(X+dx,HY+dy),lean,lf and (X+dx+lf[0],G+lf[1]),rf and (X+dx+rf[0],G+rf[1]),lh,rh,tilt,**k)
clip('kid_idle','kid',[K(0,-1,0,(2,-1),(-2,-1),tilt=14+a) for a in (0,3,0,-3)])
clip('kid_hop','kid',[K(0,0,4,(2,0),(-2,0)),K(1,1,6,(3,0),(-1,0)),K(2,-4,0,(3,-4),(0,-4),('r',2,4),('r',-2,4)),K(4,-6,-2,(4,-6),(2,-6),('r',1,2),('r',-3,2)),K(6,-2,2,(7,-1),(4,-1)),K(7,0,4,(9,0),(5,0))])
clip('kid_leap','kid',[K(0,1,10,(3,0),(-3,0),('r',2,8),('r',-2,8)),K(-1,3,20,(3,0),(-4,0),('r',-3,8),('r',-5,8)),K(8,-6,40,(4,-8),(-2,-5),('r',8,2),('r',7,3),le=EO,re=EO),K(18,-8,30,(14,-8),(10,-6),('r',10,-4),('r',9,-2),le=EU,re=EU),K(24,-6,20,(22,-4),(18,-4),('r',11,6),('r',10,8),le=EO,re=EO),K(26,-2,10,(28,0),(24,0),('r',8,8),('r',6,8))])
clip('kid_ankle','kid',[K(0,2,20,(3,0),(-3,0),('r',4,8),('r',2,8)),K(8,4,60,(2,0),(-2,0),('r',10,4),('r',9,6),le=EO,re=EO),K(16,2,75,(4,0),(1,0),('r',12,4),('r',11,5),le=EO,re=EO),K(16,5,60,(2,0),(-1,0),('r',8,6),('r',7,7),le=EO,re=EO),K(15,6,70,(1,0),(-2,0),('r',10,4),('r',9,5),le=EO,re=EO)])
clip('kid_bite','kid',[K(0,4,70,(-3,0),(-5,0),('r',6,10),('r',4,10)),K(3,5,80,(-1,0),(-4,0),('r',8,10),('r',5,10)),K(6,4,72,(2,0),(-2,0),('r',6,10),('r',3,10)),K(9,5,85,(4,0),(1,0),('r',10,9),('r',7,10),tilt=10),K(10,4,70,(5,0),(2,0),('r',7,10),('r',4,10))])
clip('kid_drop','kid',[K(0,-40,100,(-6,-40),(-7,-41),('r',10,2),('r',9,3),le=EO,re=EO),K(2,-36,150,(-4,-44),(-6,-44),('r',12,0),('r',11,1),le=EO,re=EO),K(3,-28,170,(-2,-40),(-3,-40),('r',12,0),('r',11,0),le=EO,re=EO),K(4,-18,170,(2,-30),(0,-30),('r',13,-2),('r',12,-1),le=EO,re=EO)])
rl=lambda a,d: K(d,-10,a,(1,-14),(-1,-14),('r',4,8),('r',3,8),tilt=40,lk=KU,rk=KU,le=EO,re=EO)
clip('kid_roll','kid',[rl(60*i,4*i) for i in range(6)])
clip('kid_block','kid',[K(0,0,0,(3,0),(-3,0),('r',4,-4),('r',-4,-4),le=EU,re=EU,tilt=-6+a) for a in (0,2,0,2)])
clip('kid_hit','kid',[K(-2,0,-20,(2,0),(-3,0),('r',-3,-2),('r',-5,0),tilt=-20),K(-4,1,-30,(1,0),(-4,0),('r',-5,-3),('r',-6,-1),tilt=-26),K(-3,0,-14,(2,0),(-3,0),('r',-2,4),('r',-4,5),tilt=-10),K(-2,0,0,(2,0),(-2,0),tilt=6)])
clip('kid_flop','kid',[K(0,0,0,(2,0),(-2,0),tilt=10),K(0,2,10,(3,0),(-1,0),('r',4,9),('r',-3,9),tilt=30),K(0,5,30,(6,-1),(4,-1),('r',6,10),('r',-1,11),lk=KU,rk=KU,tilt=50),K(1,6,45,(8,-1),(6,-1),('r',8,9),('r',2,11),lk=KU,rk=KU,tilt=35),K(2,6,50,(9,0),(7,0),('r',10,8),('r',4,10),lk=KU,rk=KU,tilt=40)])
clip('kid_rise','kid',[K(2,6,50,(9,0),(7,0),('r',10,8),('r',4,10),lk=KU,rk=KU,tilt=40),K(1,6,40,(7,0),(5,0),('r',6,10),('r',1,11),lk=KU,rk=KU,tilt=40),K(0,2,10,(4,-1),(1,-1),('r',4,10),('r',-2,10),tilt=30),K(0,-2,0,(2,-2),(-2,-2),tilt=20),K(0,-1,0,(2,-1),(-2,-1),tilt=12)])
clip('kid_ride','kid',[K(4,-16,-10,(-2,-14+a),(-4,-12-a),('r',8,-4-2*a),('r',6,2+2*a),le=EU,re=EO,lk=KF,rk=KF) for a in (0,2,-1,2)])

# ── 마네킹 (어른 크기, 나무, 얼굴 없음) ──
c=BODY['man']; X,HY,G=c['X'],c['HY'],c['G']
M=lambda dx=0,dy=0,lean=0,lf=(4,0),rf=(-4,0),lh='down',rh='down',tilt=0,**k: Pb('man',(X+dx,HY+dy),lean,(X+dx+lf[0],G+lf[1]),(X+dx+rf[0],G+rf[1]),lh,rh,tilt,**k)
HANG=lambda dy=-1,tl=16,sw=0: M(sw,dy,0,(4,dy),(-4,dy),('r',4+sw,30),('r',-2+sw,30),tl,le=ED,re=ED)
LIMP=M(4,34,70,(30,-2),(26,0),('r',30,40),('r',20,42),40,lk=KU,rk=KU,le=EO,re=EO)
clip('man_limp','man',[LIMP,sh(LIMP,0,.5),LIMP])
clip('man_rise','man',[LIMP,M(2,30,50,(24,0),(20,0),('r',14,34),('r',10,36),60,lk=KU,rk=KU),M(0,22,30,(14,0),(10,0),('r',8,32),('r',4,34),50,lk=KU,rk=KU),
                       M(0,12,14,(8,-1),(2,0),('r',6,32),('r',2,32),36),M(0,2,4,(5,-2),(-3,-1),('r',5,31),('r',-1,31),24),HANG()])
clip('man_idle','man',[HANG(-1,16,0),HANG(-2,18,1),HANG(-1,16,0),HANG(-2,14,-1)])
def mwalk(t):
    c_=math.cos(2*math.pi*t); s_=math.sin(2*math.pi*t)
    lf=(4+10*c_,-14*max(0,-s_)); rf=(4-10*c_,-14*max(0,s_))       # 무릎 줄에 들려 높이 올라갔다 툭
    return M(4,-2+3*abs(s_),4+3*s_,lf,rf,('r',6+4*c_,28),('r',-2-4*c_,28),14+4*s_,lk=KU,rk=KU)
clip('man_walk','man',[mwalk(i/8) for i in range(8)])
ch=[HANG(),M(0,-2,-4,(4,-1),(-4,-1),('r',4,-30),'down',4,le=EU),M(0,-3,-6,(4,-1),(-4,-1),('r',8,-34),'down',2,le=EU),
    M(4,0,16,(12,0),(-4,0),('r',30,10),'down',20,le=EO),M(5,1,20,(13,0),(-4,0),('r',28,22),'down',24,le=EO),M(2,-1,8,(8,-1),(-4,-1),('r',12,28),'down',18)]
clip('man_chop','man',ch)
swp=[HANG(),M(0,-2,-6,(4,-1),(-4,-1),'down','down',10),M(-2,-1,-14,(18,-16),(-4,0),('r',-6,24),('r',8,22),8),M(-2,0,-20,(34,-10),(-4,0),('r',-10,22),('r',10,20),6,lk=KU),
     M(-1,0,-16,(36,-4),(-4,0),('r',-8,24),('r',8,22),6,lk=KU),M(0,-1,0,(10,-1),(-4,-1),'down','down',14)]
clip('man_sweep','man',swp)
sl=[HANG(),M(-4,2,-10,(2,0),(-8,0),('r',-6,24),('r',-8,22),0),M(10,-10,40,(16,-6),(-6,-14),('r',20,14),('r',16,16),10,le=EB,re=EB),
    M(24,-8,50,(20,-14),(6,-20),('r',8,24),('r',4,24),20),M(30,0,30,(36,0),(18,-6),('r',18,24),('r',12,26),20),M(28,0,10,(32,0),(22,0),('r',8,28),('r',2,28),18)]
clip('man_slam','man',sl)
bk=lambda a: M(0,0,4,(6,0),(-6,0),('r',12,6+a),('r',10,4-a),4,le=('e',8,14),re=('e',6,14))
clip('man_block','man',[bk(0),bk(1),bk(0),bk(1)])
clip('man_hit','man',[M(-4,0,-20,(2,0),(-6,0),('r',-10,24),('r',-14,22),-20),M(-6,1,-26,(1,0),(-8,0),('r',-14,20),('r',-16,20),-30),M(-3,0,-10,(3,0),(-5,0),('r',-4,26),('r',-6,26),-6),HANG()])
br=[HANG(),M(0,4,-6,(6,0),(-4,0),('r',-12,30),('r',8,32),30),M(0,14,10,(10,0),(-2,0),('r',-4,38),('r',14,36),40,lk=KU),M(2,24,30,(16,0),(4,0),('r',10,38),('r',18,40),50,lk=KU,rk=KU),
    M(3,30,50,(22,-1),(14,0),('r',22,40),('r',26,42),40,lk=KU,rk=KU),LIMP]
clip('man_break','man',br)
gr=lambda t: M(6*t,-1,10*t,(4+6*t,0),(-4,0),('r',14+10*t,16-4*t),('r',12+10*t,18-4*t),10,le=EO,re=EO)
clip('man_grab','man',[HANG(),gr(.5),gr(1),gr(1)])
th=[gr(1),M(4,0,0,(10,0),(-4,0),('r',16,6),('r',14,8),0,le=EO,re=EO),M(0,2,-20,(10,0),(-6,0),('r',6,-14),('r',4,-12),-20,le=EU,re=EU),M(-4,4,-40,(10,0),(-8,0),('r',-6,-24),('r',-8,-22),-30,le=EU,re=EU),
    M(-6,6,-55,(10,0),(-10,0),('r',-16,-14),('r',-18,-12),-40,le=EU,re=EU),M(-4,4,-30,(10,0),(-8,0),('r',-10,10),('r',-12,12),-20),M(0,0,-8,(6,0),(-4,0),'down','down',0),HANG()]
clip('man_throw','man',th)

if __name__=='__main__':
    import rojemon_defs as D
    pl={r['clip']:r for r in D.ROWS if r['make']=='pl' and r['body'] in ('kid','man')}
    print('missing',[c for c in pl if c not in CLIPS],'mismatch',[(c,len(CLIPS[c][1]),pl[c]['frames']) for c in pl if c in CLIPS and len(CLIPS[c][1])!=pl[c]['frames']])
    for n,(b,ps) in CLIPS.items():
        Wd,Hd=BODY[b]['W'],BODY[b]['H']
        for i,p in enumerate(ps):
            for k,v in p.items():
                if not(1<v[0]<Wd-1 and 1<v[1]<Hd-1): print('OUT',n,i,k,[round(x) for x in v])
