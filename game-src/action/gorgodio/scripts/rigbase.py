# 고르고디오 뼈대 공통 도구 (animate_with_skeleton_v3용). 쟈알디 rig.py의 수학(IK·anatomic)만 빌리고 몸 치수·자세는 새로 정함.
# 좌표 = 최종 캔버스 픽셀. 오른쪽(동쪽)을 봄. RIGHT = 그림상 가까운 쪽 = 앞손·앞발(식칼 든 손).
import math
from PIL import Image, ImageDraw
J=['NOSE','NECK','RIGHT SHOULDER','RIGHT ELBOW','RIGHT ARM','LEFT SHOULDER','LEFT ELBOW','LEFT ARM','RIGHT HIP','RIGHT KNEE','RIGHT LEG',
   'LEFT HIP','LEFT KNEE','LEFT LEG','RIGHT EYE','LEFT EYE','RIGHT EAR','LEFT EAR']
BONES=[('NECK','NOSE'),('NECK','RIGHT SHOULDER'),('RIGHT SHOULDER','RIGHT ELBOW'),('RIGHT ELBOW','RIGHT ARM'),('NECK','LEFT SHOULDER'),
       ('LEFT SHOULDER','LEFT ELBOW'),('LEFT ELBOW','LEFT ARM'),('NECK','RIGHT HIP'),('RIGHT HIP','RIGHT KNEE'),('RIGHT KNEE','RIGHT LEG'),
       ('NECK','LEFT HIP'),('LEFT HIP','LEFT KNEE'),('LEFT KNEE','LEFT LEG')]
def rot(v,deg):
    r=math.radians(deg); return (v[0]*math.cos(r)-v[1]*math.sin(r), v[0]*math.sin(r)+v[1]*math.cos(r))
def add(a,b): return (a[0]+b[0],a[1]+b[1])
def _ik(root,target,a,b,bend):
    dx,dy=target[0]-root[0],target[1]-root[1]; d=max(1e-3,min(math.hypot(dx,dy),a+b-0.01)); base=math.atan2(dy,dx)
    c=max(-1,min(1,(a*a+d*d-b*b)/(2*a*d))); ang=base+bend*math.acos(c)
    mid=(root[0]+a*math.cos(ang),root[1]+a*math.sin(ang))
    t=math.atan2(target[1]-mid[1],target[0]-mid[0]); return mid,(mid[0]+b*math.cos(t),mid[1]+b*math.sin(t))
def ik(root,target,a,b,pick): return max((_ik(root,target,a,b,1),_ik(root,target,a,b,-1)),key=lambda r:pick(r[0]))
KNEE_FWD=lambda m:m[0]
KNEE_UP=lambda m:-m[1]
ELB_DOWN=lambda m:m[1]-0.8*m[0]
ELB_UP=lambda m:-m[1]
ELB_OUT=lambda m:m[0]
def lerp(a,b,t): return {k:(a[k][0]+(b[k][0]-a[k][0])*t,a[k][1]+(b[k][1]-a[k][1])*t) for k in J}
def staged(a,b,t):
    """하체 먼저, 팔은 늦게 (디딤발 → 허리 → 어깨 → 팔)"""
    out={}
    for k in J:
        tt=min(1,t*1.5) if ('HIP' in k or 'KNEE' in k or 'LEG' in k) else t**1.6 if ('ELBOW' in k or k.endswith(' ARM')) else min(1,t*1.2)
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
    """팔꿈치는 앞쪽으로만, 무릎은 뒤쪽으로만 접힘(옆모습). 거꾸로면 선에 대해 뒤집음."""
    q=dict(p)
    for s in ('RIGHT','LEFT'):
        if _xs(q[f'{s} SHOULDER'],q[f'{s} ELBOW'],q[f'{s} ARM'])>0.12: q[f'{s} ELBOW']=_mirror(q[f'{s} ELBOW'],q[f'{s} SHOULDER'],q[f'{s} ARM'])
        if _xs(q[f'{s} HIP'],q[f'{s} KNEE'],q[f'{s} LEG'])<-0.12: q[f'{s} KNEE']=_mirror(q[f'{s} KNEE'],q[f'{s} HIP'],q[f'{s} LEG'])
    return q

class Body:
    """몸 치수 한 벌(맨몸·장갑). P(...)로 자세를 만든다."""
    def __init__(s,W,H,X,G,TORSO,THIGH,SHIN,UARM,FARM,head,shw=6,hipw=5):
        s.W,s.H,s.X,s.G=W,H,X,G; s.TORSO,s.THIGH,s.SHIN,s.UARM,s.FARM=TORSO,THIGH,SHIN,UARM,FARM; s.head=head; s.shw=shw; s.hipw=hipw
        s.CLIPS={}
    def P(s,hip,lean=4,sr=0,h=0,lf=None,rf=None,lh='down',rh='down',head=None,tilt=0,lk=KNEE_FWD,rk=KNEE_FWD,le=ELB_DOWN,re=ELB_DOWN):
        """hip 골반, lean 몸통 앞기울기(도), sr 어깨 회전(옆모습 유지: |sr|<=0.25 권장), h 골반 회전, lf/rf 앞발·뒷발 발목(절대),
        lh/rh 앞손·뒷손: 'down' 'out' 'hip' (dx,dy)=목 기준 ('a',x,y)=절대 ('r',dx,dy)=목 기준·몸통 따라 돎, tilt 고개 숙임(+)
        le/re: IK 고르기 함수 또는 ('e',dx,dy) 팔꿈치 직접(목 기준, 몸통 따라 돎)"""
        head=head or s.head; G=s.G
        N=add(hip,rot((0,-s.TORSO),lean)); p={'NECK':N}
        p['RIGHT SHOULDER']=add(N,rot((-s.shw*sr+1,4),lean)); p['LEFT SHOULDER']=add(N,rot((s.shw*sr-1,4),lean))
        p['RIGHT HIP']=add(hip,rot((-s.hipw*h,0),lean)); p['LEFT HIP']=add(hip,rot((s.hipw*h,0),lean))
        hv=rot(head,lean+tilt); nose=add(N,hv); p['NOSE']=nose
        k=s.TORSO/26
        for kk,v in (('RIGHT EYE',(-3,-3)),('LEFT EYE',(0,-4)),('RIGHT EAR',(-8,-2)),('LEFT EAR',(-6,-3))): p[kk]=add(nose,rot((v[0]*k,v[1]*k),lean+tilt))
        def hand(side,t,pick):
            shd=p[f'{side} SHOULDER']
            if t=='out': tgt=(shd[0]+70,shd[1]-1)
            elif t=='down': tgt=add(shd,(2 if side=='RIGHT' else -1,s.UARM+s.FARM-2))
            elif t=='hip': tgt=add(hip,(-4,4))
            elif isinstance(t,tuple) and t[0]=='a': tgt=(t[1],t[2])
            elif isinstance(t,tuple) and t[0]=='r': tgt=add(N,rot((t[1],t[2]),lean))
            else: tgt=add(N,t)
            if isinstance(pick,tuple) and pick[0]=='e':
                p[f'{side} ELBOW']=add(N,rot((pick[1],pick[2]),lean)); p[f'{side} ARM']=tgt; return
            e,w=ik(shd,tgt,s.UARM,s.FARM,pick); p[f'{side} ELBOW']=e; p[f'{side} ARM']=w
        hand('RIGHT',lh,le); hand('LEFT',rh,re)
        lf=lf or (hip[0]+9,G); rf=rf or (hip[0]-7,G)
        for side,an,pk in (('RIGHT',lf,lk),('LEFT',rf,rk)):
            kn,a=ik(p[f'{side} HIP'],an,s.THIGH,s.SHIN,pk); p[f'{side} KNEE']=kn; p[f'{side} LEG']=a
        return p
    def clip(s,name,action,poses,prop=''):
        action=action.replace('side view in profile: ','').replace('side view: ','')
        assert 3<=len(poses)<=15,(name,len(poses)); 
        if len(action)>100: print('LONG',name,len(action),action)
        fl=s.G+6   # 바닥 아래로 내려간 팔꿈치·무릎(누운 자세)을 바닥선 위로
        s.CLIPS[name]=(action,prop,[{k:((v[0],min(v[1],fl)) if ('ELBOW' in k or 'KNEE' in k) else v) for k,v in anatomic(p).items()} for p in poses])
    def kp(s,p):
        return [{'label':k,'x':round(p[k][0]/s.W,4),'y':round(p[k][1]/s.H,4),'z_index':8 if k.startswith('RIGHT') else 2 if k.startswith('LEFT') else 5} for k in J]
    def draw(s,p,base=None,sc=2):
        im=Image.new('RGBA',(s.W*sc,s.H*sc),(44,56,62,255))
        if base: im.alpha_composite(base.resize((s.W*sc,s.H*sc),Image.NEAREST))
        d=ImageDraw.Draw(im); d.line([(0,(s.G+8)*sc),(s.W*sc,(s.G+8)*sc)],fill=(120,130,140,255))
        q={k:(v[0]*sc,v[1]*sc) for k,v in p.items()}
        for a,b in BONES:
            c=(255,90,90,255) if 'RIGHT' in a+b else (90,170,255,255) if 'LEFT' in a+b else (240,240,240,255)
            d.line([q[a],q[b]],fill=c,width=sc)
        d.ellipse([q['NOSE'][0]-3,q['NOSE'][1]-3,q['NOSE'][0]+3,q['NOSE'][1]+3],fill=(255,230,80,255))
        return im
    def audit(s):
        """자동 검사: 캔버스 밖, 팔꿈치(손이 어깨보다 높을 때 팔꿈치가 등 뒤로), 서 있는 장 발 높이"""
        bad=[]
        for n,(a,_,ps) in s.CLIPS.items():
            for i,p in enumerate(ps):
                for k,v in p.items():
                    if not(0.02<v[0]/s.W<0.98 and 0.02<v[1]/s.H<0.98): bad.append((n,i,'밖',k))
                for sd in ('RIGHT','LEFT'):
                    sh_,e,w=p[f'{sd} SHOULDER'],p[f'{sd} ELBOW'],p[f'{sd} ARM']
                    if w[1]<sh_[1]+2 and e[0]<sh_[0]-6: bad.append((n,i,'팔꿈치 뒤',sd))
        return bad
    def sheet(s,names,out,base=None,sc=2):
        rows=[]
        for n in names:
            _,_,ps=s.CLIPS[n]
            row=Image.new('RGBA',(s.W*sc*(len(ps)+1),s.H*sc),(30,34,40,255))
            if base is not None: row.alpha_composite(base.resize((s.W*sc,s.H*sc),Image.NEAREST),(0,0))
            for i,p in enumerate(ps): row.alpha_composite(s.draw(p,None,sc),((i+1)*s.W*sc,0))
            ImageDraw.Draw(row).text((4,4),n,fill=(255,255,0,255)); rows.append(row)
        wmax=max(r.width for r in rows); im=Image.new('RGBA',(wmax,sum(r.height for r in rows)),(20,20,24,255)); y=0
        for r in rows: im.alpha_composite(r,(0,y)); y+=r.height
        im.resize((im.width//2,im.height//2)).save(out)
