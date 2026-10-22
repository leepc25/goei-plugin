# 아벤샤·브라우니·탐미주의 뼈대 공통 도구. 백일몽 common.py를 큰 캔버스용으로 고침: 뼈대 좌표(발목 바닥선 G=100)는 같고, 캔버스(W,H)와 내보내는 이동(DX,DY)을 인물마다 setup()에서 정함.
# 오른쪽(동쪽)을 봄, RIGHT = 가까운 쪽 = 앞손·앞발. 인물 rig_<id>.py가 setup()으로 뼈 길이를 정한 뒤 clip()으로 클립을 등록한다.
# 손 모드: 'down' 'fold'(배 앞 포갬) 'back'(등 뒤 깍지) 'cross'(팔짱) 'pocket'(주머니) ('r',x,y)=목 기준(몸통 따라 돎) ('a',x,y)=절대
import math,sys
from PIL import Image,ImageDraw
sys.path.insert(0,'../../jyaldi-v5/scripts'); import skel
J=skel.J; BONES=skel.BONES
W,H=192,144; DX,DY=2,28
SC=1.0; THIGH,SHIN,UARM,FARM,TORSO=22.4,23.4,17,14,26; G=100; X=66; HIPY=62; K=1.0
def setup(sc,g=100,x=66,w=192,h=144,dx=2,dy=28):
    """sc = 키/93(쟈알디). 뼈 길이·서 있는 골반 높이, 캔버스 크기와 이동(캔버스 발바닥 y = g+dy-? 실측은 fitkp)"""
    global SC,THIGH,SHIN,UARM,FARM,TORSO,G,X,HIPY,K,W,H,DX,DY
    W,H,DX,DY=w,h,dx,dy
    SC=sc; THIGH,SHIN,UARM,FARM,TORSO=22.4*sc,23.4*sc,17*sc,14*sc,26*sc; G=g; X=x; K=sc
    HIPY=round(G-(THIGH+SHIN)*0.96)
def rot(v,deg):
    r=math.radians(deg); return (v[0]*math.cos(r)-v[1]*math.sin(r), v[0]*math.sin(r)+v[1]*math.cos(r))
def add(a,b): return (a[0]+b[0],a[1]+b[1])
def _ik(root,target,a,b,bend):
    dx,dy=target[0]-root[0],target[1]-root[1]; d=max(1e-3,min(math.hypot(dx,dy),a+b-0.01)); base=math.atan2(dy,dx)
    c=max(-1,min(1,(a*a+d*d-b*b)/(2*a*d))); ang=base+bend*math.acos(c)
    mid=(root[0]+a*math.cos(ang),root[1]+a*math.sin(ang))
    t=math.atan2(target[1]-mid[1],target[0]-mid[0]); return mid,(mid[0]+b*math.cos(t),mid[1]+b*math.sin(t))
def ik(root,target,a,b,pick):
    return max((_ik(root,target,a,b,1),_ik(root,target,a,b,-1)),key=lambda r:pick(r[0]))
KNEE_FWD=lambda m:m[0]
KNEE_UP=lambda m:-m[1]
ELB_DOWN=lambda m:m[1]-0.8*m[0]
ELB_UP=lambda m:-m[1]
ELB_OUT=lambda m:m[0]
# 손 모드 → (손 목표, 팔꿈치) 목 기준, K로 키에 맞춰 늘림
MODES={
 'fold':  {'RIGHT':((8,21),(3,13)),  'LEFT':((7,22),(1,13))},
 'back':  {'RIGHT':((-7,22),(-4,12)),'LEFT':((-8,21),(-6,12))},
 'cross': {'RIGHT':((4,14),(9,14)),  'LEFT':((11,12),(5,15))},
 'pocket':{'RIGHT':((3,25),(-1,13)), 'LEFT':((-2,25),(-4,13))},
}
def P(hip,lean=2,s=0,h=0,lf=None,rf=None,lh='down',rh='down',head=(6,-8),tilt=0,lk=KNEE_FWD,rk=KNEE_FWD,le=None,re=None):
    """hip 골반, lean 몸통 앞기울기(도), s 어깨 회전(-앞손쪽 앞, 옆모습은 -0.25 이하), h 골반 회전, lf/rf 앞발·뒷발 발목, lh/rh 앞손·뒷손, le/re 팔꿈치 ('e',x,y)=목 기준"""
    N=add(hip,rot((0,-TORSO),lean))
    p={'NECK':N}
    p['RIGHT SHOULDER']=add(N,rot((-5*s+1,3),lean)); p['LEFT SHOULDER']=add(N,rot((5*s-1,3),lean))
    p['RIGHT HIP']=add(hip,rot((-4*h+1,0),lean)); p['LEFT HIP']=add(hip,rot((4*h-1,0),lean))
    hd=(head[0]*K,head[1]*K)
    nose=add(N,rot(hd,lean+tilt)); p['NOSE']=nose
    for k,v in (('RIGHT EYE',(-3,-3)),('LEFT EYE',(0,-3)),('RIGHT EAR',(-7,-2)),('LEFT EAR',(-5,-3))): p[k]=add(nose,rot((v[0]*K,v[1]*K),lean+tilt))
    chin=add(nose,rot((1,4),lean+tilt))
    def hand(side,t,pick):
        sh_=p[f'{side} SHOULDER']
        if isinstance(t,str) and t in MODES:
            (hx,hy),(ex,ey)=MODES[t][side]; t=('r',hx,hy); pick=pick or ('e',ex,ey)
        if t=='chin': tgt=chin if side=='LEFT' else add(chin,(3,-2))
        elif t=='out': tgt=(sh_[0]+52*K,sh_[1]-1)
        elif t=='down': tgt=add(sh_,(2 if side=='RIGHT' else -1,26*K))
        elif isinstance(t,tuple) and t[0]=='a': tgt=(t[1],t[2])
        elif isinstance(t,tuple) and t[0]=='r': tgt=add(N,rot((t[1]*K,t[2]*K),lean))
        else: tgt=add(N,t)
        if isinstance(pick,tuple) and pick[0]=='e':
            el=add(N,rot((pick[1]*K,pick[2]*K),lean)); p[f'{side} ELBOW']=el; p[f'{side} ARM']=tgt; return
        el,w=ik(sh_,tgt,UARM,FARM,pick or ELB_DOWN); p[f'{side} ELBOW']=el; p[f'{side} ARM']=w
    hand('RIGHT',lh,le); hand('LEFT',rh,re)
    lf=lf or (hip[0]+5,G); rf=rf or (hip[0]-3,G)
    for side,an,pk in (('RIGHT',lf,lk),('LEFT',rf,rk)):
        k,a=ik(p[f'{side} HIP'],an,THIGH,SHIN,pk); p[f'{side} KNEE']=k; p[f'{side} LEG']=a
    return p
def lerp(a,b,t): return {k:(a[k][0]+(b[k][0]-a[k][0])*t,a[k][1]+(b[k][1]-a[k][1])*t) for k in J}
def handfirst(a,b,t):
    out={}
    for k in J:
        tt=min(1,t*1.6) if ('ELBOW' in k or k.endswith(' ARM')) else t**1.5
        out[k]=(a[k][0]+(b[k][0]-a[k][0])*tt,a[k][1]+(b[k][1]-a[k][1])*tt)
    return out
def hipfirst(a,b,t):
    out={}
    for k in J:
        tt=min(1,t*1.5) if ('HIP' in k or 'KNEE' in k or 'LEG' in k or 'SHOULDER' in k) else t**1.8 if ('ELBOW' in k or k.endswith(' ARM')) else t
        out[k]=(a[k][0]+(b[k][0]-a[k][0])*tt,a[k][1]+(b[k][1]-a[k][1])*tt)
    return out
def sh(p,dx,dy=0): return {k:(v[0]+dx,v[1]+dy) for k,v in p.items()}
def jit(p,dx,dy,keys): return {k:((v[0]+dx,v[1]+dy) if any(s in k for s in keys) else v) for k,v in p.items()}
def _xs(a,b,c):
    u=(b[0]-a[0],b[1]-a[1]); f=(c[0]-b[0],c[1]-b[1]); n=math.hypot(*u)*math.hypot(*f) or 1
    return (u[0]*f[1]-u[1]*f[0])/n
def _mirror(p,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]; L=dx*dx+dy*dy or 1; t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L
    q=(a[0]+t*dx,a[1]+t*dy); return (2*q[0]-p[0],2*q[1]-p[1])
def anatomic(p):
    """팔꿈치 과신전·무릎 역방향 자동 보정(쟈알디 rig.py와 같음)"""
    q=dict(p)
    for s in ('RIGHT','LEFT'):
        if _xs(q[f'{s} SHOULDER'],q[f'{s} ELBOW'],q[f'{s} ARM'])>0.12: q[f'{s} ELBOW']=_mirror(q[f'{s} ELBOW'],q[f'{s} SHOULDER'],q[f'{s} ARM'])
        if _xs(q[f'{s} HIP'],q[f'{s} KNEE'],q[f'{s} LEG'])<-0.12: q[f'{s} KNEE']=_mirror(q[f'{s} KNEE'],q[f'{s} HIP'],q[f'{s} LEG'])
    return q
CLIPS={}   # 이름: (동작 설명(100자 이내), 소품 설명, [자세...])
def clip(name,action,poses,prop=''):
    assert 3<=len(poses)<=16,(name,len(poses))
    if len(action)>100: print("LONG",name,len(action))
    CLIPS[name]=(action[:100],prop,[anatomic(p) for p in poses])
def tail(ps,loop): return ps+[ps[0] if loop else ps[-1]]
def cyc(f,n=8): return [f(i/n) for i in range(n)]
def front(p):
    q=dict(p); N=q['NECK']; hip=((q['RIGHT HIP'][0]+q['LEFT HIP'][0])/2,(q['RIGHT HIP'][1]+q['LEFT HIP'][1])/2)
    q['RIGHT SHOULDER']=(N[0]-8*K,N[1]+3); q['LEFT SHOULDER']=(N[0]+8*K,N[1]+3)
    q['RIGHT HIP']=(hip[0]-4*K,hip[1]); q['LEFT HIP']=(hip[0]+4*K,hip[1])
    q['RIGHT ELBOW']=(N[0]-5*K,N[1]+14*K); q['LEFT ELBOW']=(N[0]+5*K,N[1]+14*K)
    q['RIGHT ARM']=(N[0]-2*K,N[1]+21*K); q['LEFT ARM']=(N[0]+2*K,N[1]+22*K)
    q['RIGHT KNEE']=(hip[0]-4*K,hip[1]+19*K); q['LEFT KNEE']=(hip[0]+4*K,hip[1]+19*K)
    q['RIGHT LEG']=(hip[0]-4*K,G); q['LEFT LEG']=(hip[0]+4*K,G)
    no=(N[0],N[1]-8*K); q['NOSE']=no
    q['RIGHT EYE']=(no[0]-3,no[1]-3); q['LEFT EYE']=(no[0]+3,no[1]-3); q['RIGHT EAR']=(no[0]-6,no[1]-1); q['LEFT EAR']=(no[0]+6,no[1]-1)
    return q
def kp(p):
    out=[]
    for k in J:
        z=8 if k.startswith('RIGHT') else 2 if k.startswith('LEFT') else 5
        out.append({'label':k,'x':round((p[k][0]+DX)/W,4),'y':round((p[k][1]+DY)/H,4),'z_index':z})
    return out
def draw(p,base=None,s=2):
    im=Image.new('RGBA',(W*s,H*s),(44,56,62,255))
    if base: im.alpha_composite(base.resize((W*s,H*s),Image.NEAREST))
    d=ImageDraw.Draw(im); d.line([(0,(G+DY)*s),(W*s,(G+DY)*s)],fill=(120,130,140,255))
    q={k:((v[0]+DX)*s,(v[1]+DY)*s) for k,v in p.items()}
    for a,b in BONES:
        c=(255,90,90,255) if 'RIGHT' in a+b else (90,170,255,255) if 'LEFT' in a+b else (240,240,240,255)
        d.line([q[a],q[b]],fill=c,width=s)
    d.ellipse([q['NOSE'][0]-3,q['NOSE'][1]-3,q['NOSE'][0]+3,q['NOSE'][1]+3],fill=(255,230,80,255))
    return im
def audit(clips=None):
    """팔꿈치·무릎 방향, 화면 밖, 발 바닥선 아래 검사. 문제 목록 반환"""
    bad=[]
    for n,(a,_,ps) in (clips or CLIPS).items():
        for i,p in enumerate(ps):
            for k,v in p.items():
                x,y=(v[0]+DX)/W,(v[1]+DY)/H
                if not(0.02<x<0.98 and 0.02<y<0.98): bad.append((n,i,'OUT',k,round(x,2),round(y,2)))
            for s in ('RIGHT','LEFT'):
                if _xs(p[f'{s} SHOULDER'],p[f'{s} ELBOW'],p[f'{s} ARM'])>0.2: bad.append((n,i,'ELBOW',s))
                if p[f'{s} LEG'][1]>G+3: bad.append((n,i,'BELOWFLOOR',s,round(p[f'{s} LEG'][1],1)))
    return bad
_AKP=[None]
def set_akp(p): _AKP[0]=p
def A_KP(): return _AKP[0]
def preview(out,names,base=None,S=2):
    """뼈대 미리보기: 클립마다 한 줄(첫 칸 = 기준 그림 + 기준 뼈대), 몸 둘레만 잘라 S배"""
    ys=[v[1]+DY for n in names for p in CLIPS[n][2] for v in p.values()]; xs=[v[0]+DX for n in names for p in CLIPS[n][2] for v in p.values()]
    x0,y0=max(0,int(min(xs))-24),max(0,int(min(ys))-30); x1,y1=min(W,int(max(xs))+24),min(H,int(max(ys))+10)
    CW,CH=x1-x0,y1-y0
    def cell(p,b=None): return draw(p,b,1).crop((x0,y0,x1,y1)).resize((CW*S,CH*S),Image.NEAREST)
    rows=[]
    for n in names:
        ps=CLIPS[n][2]; row=Image.new('RGBA',(CW*S*(len(ps)+1),CH*S),(30,34,40,255))
        if base: row.alpha_composite(cell(A_KP(),base),(0,0))
        for i,p in enumerate(ps): row.alpha_composite(cell(p),((i+1)*CW*S,0))
        ImageDraw.Draw(row).text((6,6),n,fill=(255,255,0,255)); rows.append(row)
    w=max(r.width for r in rows); sheet=Image.new('RGBA',(w,sum(r.height for r in rows)),(20,20,20,255)); y=0
    for r in rows: sheet.alpha_composite(r,(0,y)); y+=r.height
    sheet.save(out)
