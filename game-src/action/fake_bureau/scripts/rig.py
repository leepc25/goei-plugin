# 가짜 관리국 뼈대 (animate_with_skeleton_v3용). 쟈알디 rig.py와 같은 방식·같은 좌표 약속.
# 좌표는 쟈알디 로컬 공간(발목 바닥선 G=100, 몸 기준 X=55)에서 짓고, 내보낼 때 대상별 배율 k로 바닥 기준 확대해 캔버스로 옮긴다.
# 오른쪽(동쪽)을 봄. RIGHT = 그림상 가까운 쪽 = 앞손·앞발. lh = 앞손(RIGHT) 목표, rh = 뒷손(LEFT) 목표.
# 근거: docs/캐릭터제작서/동작설계_가짜관리국.md 4장. 검도·이아이도(발도→베기→치부리→납도), 미니건 반동 버티기, 화염방사기 허리 사격.
import math
J=['NOSE','NECK','RIGHT SHOULDER','RIGHT ELBOW','RIGHT ARM','LEFT SHOULDER','LEFT ELBOW','LEFT ARM','RIGHT HIP','RIGHT KNEE','RIGHT LEG','LEFT HIP','LEFT KNEE','LEFT LEG','RIGHT EYE','LEFT EYE','RIGHT EAR','LEFT EAR']
BONES=[('NECK','NOSE'),('NECK','RIGHT SHOULDER'),('RIGHT SHOULDER','RIGHT ELBOW'),('RIGHT ELBOW','RIGHT ARM'),('NECK','LEFT SHOULDER'),('LEFT SHOULDER','LEFT ELBOW'),('LEFT ELBOW','LEFT ARM'),
       ('NECK','RIGHT HIP'),('RIGHT HIP','RIGHT KNEE'),('RIGHT KNEE','RIGHT LEG'),('NECK','LEFT HIP'),('LEFT HIP','LEFT KNEE'),('LEFT KNEE','LEFT LEG')]
THIGH,SHIN,UARM,FARM,TORSO=22.4,23.4,17,14,26
G=100; X=55
# 대상별 캔버스: (폭, 높이, 캔버스 기준 x, 배율 k). 발목 바닥선은 캔버스 y=128(발바닥 136).
BODY={'dohyeong':(256,144,80,1.054),'seongju':(256,144,84,1.31),'sword':(192,144,62,1.0),'riot':(192,144,62,1.0),'burn':(192,144,62,0.925)}
GY=128
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
def P(hip,lean=4,s=0,h=0,lf=None,rf=None,lh='down',rh='down',head=(5,-7),tilt=0,lk=KNEE_FWD,rk=KNEE_FWD,le=ELB_DOWN,re=ELB_DOWN):
    """쟈알디 rig.P와 같음. hip 골반, lean 몸통 앞기울기(도), s 어깨 회전(옆모습 유지 위해 |s|<=0.3 권장), lf/rf 앞발·뒷발 발목, lh/rh 앞손·뒷손."""
    N=add(hip,rot((0,-TORSO),lean)); p={'NECK':N}
    p['RIGHT SHOULDER']=add(N,rot((-6*s+1,4),lean)); p['LEFT SHOULDER']=add(N,rot((6*s-1,4),lean))
    p['RIGHT HIP']=add(hip,rot((-5*h,0),lean)); p['LEFT HIP']=add(hip,rot((5*h,0),lean))
    nose=add(N,rot(head,lean+tilt)); p['NOSE']=nose
    for k,v in (('RIGHT EYE',(-3,-3)),('LEFT EYE',(0,-4)),('RIGHT EAR',(-8,-2)),('LEFT EAR',(-6,-3))): p[k]=add(nose,rot(v,lean+tilt))
    chin=add(nose,rot((1,4),lean+tilt))
    def hand(side,t,pick):
        sh=p[f'{side} SHOULDER']
        if t=='chin': tgt=chin if side=='LEFT' else add(chin,(4,-2))
        elif t=='out': tgt=(sh[0]+60,sh[1]-1)
        elif t=='down': tgt=add(sh,(2 if side=='RIGHT' else -1,29))
        elif t=='hip': tgt=add(hip,(-4,4))
        elif isinstance(t,tuple) and t[0]=='a': tgt=(t[1],t[2])
        elif isinstance(t,tuple) and t[0]=='r': tgt=add(N,rot((t[1],t[2]),lean))
        else: tgt=add(N,t)
        if isinstance(pick,tuple) and pick[0]=='e':
            p[f'{side} ELBOW']=add(N,rot((pick[1],pick[2]),lean)); p[f'{side} ARM']=tgt; return
        e,w=ik(sh,tgt,UARM,FARM,pick); p[f'{side} ELBOW']=e; p[f'{side} ARM']=w
    hand('RIGHT',lh,le); hand('LEFT',rh,re)
    lf=lf or (hip[0]+8,G); rf=rf or (hip[0]-6,G)
    for side,an,pk in (('RIGHT',lf,lk),('LEFT',rf,rk)):
        k,a=ik(p[f'{side} HIP'],an,THIGH,SHIN,pk); p[f'{side} KNEE']=k; p[f'{side} LEG']=a
    return p
def lerp(a,b,t): return {k:(a[k][0]+(b[k][0]-a[k][0])*t,a[k][1]+(b[k][1]-a[k][1])*t) for k in J}
def staged(a,b,t):
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
    q=dict(p)
    for s in ('RIGHT','LEFT'):
        if _xs(q[f'{s} SHOULDER'],q[f'{s} ELBOW'],q[f'{s} ARM'])>0.12: q[f'{s} ELBOW']=_mirror(q[f'{s} ELBOW'],q[f'{s} SHOULDER'],q[f'{s} ARM'])
        if _xs(q[f'{s} HIP'],q[f'{s} KNEE'],q[f'{s} LEG'])<-0.12: q[f'{s} KNEE']=_mirror(q[f'{s} KNEE'],q[f'{s} HIP'],q[f'{s} LEG'])
    return q
def to_canvas(p,who):
    W,H,AX,k=BODY[who]
    return {n:(AX+(v[0]-X)*k, GY-(G-v[1])*k) for n,v in p.items()}
def kp(p,who):
    W,H,_,_=BODY[who]; c=to_canvas(p,who); out=[]
    for n in J:
        z=8 if n.startswith('RIGHT') else 2 if n.startswith('LEFT') else 5
        out.append({'label':n,'x':round(c[n][0]/W,4),'y':round(c[n][1]/H,4),'z_index':z})
    return out
def seq(a,b,n,f=lerp): return [f(a,b,(i+1)/n) for i in range(n)]
