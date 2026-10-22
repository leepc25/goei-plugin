# 보스 뼈대 공용 (animate_with_skeleton_v3). 쟈알디 rig(P·ik·anatomic)와 같은 짜임을 보스 몸 치수로 옮긴 것.
# 좌표 = 캔버스 픽셀. 오른쪽(동쪽)을 봄. RIGHT = 그림상 가까운 팔다리, LEFT = 먼 팔다리.
# 손 목표: 'down' / (dx,dy)=목 기준 / ('r',dx,dy)=몸통 기울기 따라 도는 목 기준 / ('a',x,y)=절대.
import math
from PIL import Image,ImageDraw
J=['NOSE','NECK','RIGHT SHOULDER','RIGHT ELBOW','RIGHT ARM','LEFT SHOULDER','LEFT ELBOW','LEFT ARM','RIGHT HIP','RIGHT KNEE','RIGHT LEG','LEFT HIP','LEFT KNEE','LEFT LEG','RIGHT EYE','LEFT EYE','RIGHT EAR','LEFT EAR']
BONES=[('NECK','NOSE'),('NECK','RIGHT SHOULDER'),('RIGHT SHOULDER','RIGHT ELBOW'),('RIGHT ELBOW','RIGHT ARM'),('NECK','LEFT SHOULDER'),('LEFT SHOULDER','LEFT ELBOW'),('LEFT ELBOW','LEFT ARM'),
       ('NECK','RIGHT HIP'),('RIGHT HIP','RIGHT KNEE'),('RIGHT KNEE','RIGHT LEG'),('NECK','LEFT HIP'),('LEFT HIP','LEFT KNEE'),('LEFT KNEE','LEFT LEG')]
def rot(v,deg): r=math.radians(deg); return (v[0]*math.cos(r)-v[1]*math.sin(r), v[0]*math.sin(r)+v[1]*math.cos(r))
def add(a,b): return (a[0]+b[0],a[1]+b[1])
def _ik(root,target,a,b,bend):
    dx,dy=target[0]-root[0],target[1]-root[1]; d=max(1e-3,min(math.hypot(dx,dy),a+b-0.01)); base=math.atan2(dy,dx)
    c=max(-1,min(1,(a*a+d*d-b*b)/(2*a*d))); ang=base+bend*math.acos(c)
    mid=(root[0]+a*math.cos(ang),root[1]+a*math.sin(ang))
    t=math.atan2(target[1]-mid[1],target[0]-mid[0]); return mid,(mid[0]+b*math.cos(t),mid[1]+b*math.sin(t))
def ik(root,target,a,b,pick): return max((_ik(root,target,a,b,1),_ik(root,target,a,b,-1)),key=lambda r:pick(r[0]))
KNEE_FWD=lambda m:m[0]; KNEE_UP=lambda m:-m[1]; ELB_DOWN=lambda m:m[1]-0.8*m[0]; ELB_UP=lambda m:-m[1]; ELB_OUT=lambda m:m[0]
class Body:
    """thigh shin uarm farm torso: 뼈 길이. G: 발목 바닥선. k: 어깨·골반 폭 같은 작은 치수 배율(쟈알디=1). head: 목→코 기본 벡터. W,H 캔버스"""
    def __init__(s,thigh,shin,uarm,farm,torso,G,k,head,W=256,H=256): s.__dict__.update(locals()); del s.__dict__['s']
    def P(s,hip,lean=4,sr=0,h=0,lf=None,rf=None,lh='down',rh='down',head=None,tilt=0,lk=KNEE_FWD,rk=KNEE_FWD,le=ELB_DOWN,re=ELB_DOWN):
        k=s.k; N=add(hip,rot((0,-s.torso),lean)); p={'NECK':N}
        p['RIGHT SHOULDER']=add(N,rot(((-6*sr+1)*k,4*k),lean)); p['LEFT SHOULDER']=add(N,rot(((6*sr-1)*k,4*k),lean))
        p['RIGHT HIP']=add(hip,rot((-5*h*k,0),lean)); p['LEFT HIP']=add(hip,rot((5*h*k,0),lean))
        hv=rot(head or s.head,lean+tilt); nose=add(N,hv); p['NOSE']=nose
        for kk,v in (('RIGHT EYE',(-3,-3)),('LEFT EYE',(0,-4)),('RIGHT EAR',(-8,-2)),('LEFT EAR',(-6,-3))): p[kk]=add(nose,rot((v[0]*k,v[1]*k),lean+tilt))
        def hand(side,t,pick):
            sh=p[f'{side} SHOULDER']
            if t=='down': tgt=add(sh,((2 if side=='RIGHT' else -1)*k,(s.uarm+s.farm)*0.97))
            elif isinstance(t,tuple) and t[0]=='a': tgt=(t[1],t[2])
            elif isinstance(t,tuple) and t[0]=='r': tgt=add(N,rot((t[1],t[2]),lean))
            else: tgt=add(N,t)
            if isinstance(pick,tuple) and pick[0]=='e': p[f'{side} ELBOW']=add(N,rot((pick[1],pick[2]),lean)); p[f'{side} ARM']=tgt; return
            e,w=ik(sh,tgt,s.uarm,s.farm,pick); p[f'{side} ELBOW']=e; p[f'{side} ARM']=w
        hand('RIGHT',lh,le); hand('LEFT',rh,re)
        lf=lf or (hip[0]+8*k,s.G); rf=rf or (hip[0]-6*k,s.G)
        for side,an,pk in (('RIGHT',lf,lk),('LEFT',rf,rk)):
            kn,a=ik(p[f'{side} HIP'],an,s.thigh,s.shin,pk); p[f'{side} KNEE']=kn; p[f'{side} LEG']=a
        return anatomic(p)
    def kp(s,p):
        return [{'label':k,'x':round(p[k][0]/s.W,4),'y':round(p[k][1]/s.H,4),'z_index':8 if k.startswith('RIGHT') else 2 if k.startswith('LEFT') else 5} for k in J]
    def draw(s,p,base=None,sc=1):
        im=Image.new('RGBA',(s.W*sc,s.H*sc),(44,56,62,255))
        if base: im.alpha_composite(base.resize((s.W*sc,s.H*sc),Image.NEAREST))
        d=ImageDraw.Draw(im); q={k:(v[0]*sc,v[1]*sc) for k,v in p.items()}
        d.line([(0,s.G*sc),(s.W*sc,s.G*sc)],fill=(120,130,140,255))
        for a,b in BONES:
            c=(255,90,90,255) if 'RIGHT' in a+b else (90,170,255,255) if 'LEFT' in a+b else (240,240,240,255)
            d.line([q[a],q[b]],fill=c,width=max(1,sc))
        n=q['NOSE']; d.ellipse([n[0]-3,n[1]-3,n[0]+3,n[1]+3],fill=(255,230,80,255)); return im
def _xs(a,b,c):
    u=(b[0]-a[0],b[1]-a[1]); f=(c[0]-b[0],c[1]-b[1]); n=math.hypot(*u)*math.hypot(*f) or 1
    return (u[0]*f[1]-u[1]*f[0])/n
def _mirror(pt,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]; L=dx*dx+dy*dy or 1; t=((pt[0]-a[0])*dx+(pt[1]-a[1])*dy)/L; fx,fy=a[0]+t*dx,a[1]+t*dy
    return (2*fx-pt[0],2*fy-pt[1])
def anatomic(p):
    q=dict(p)
    for sd in ('RIGHT','LEFT'):
        if _xs(q[f'{sd} SHOULDER'],q[f'{sd} ELBOW'],q[f'{sd} ARM'])>0.12: q[f'{sd} ELBOW']=_mirror(q[f'{sd} ELBOW'],q[f'{sd} SHOULDER'],q[f'{sd} ARM'])
        if _xs(q[f'{sd} HIP'],q[f'{sd} KNEE'],q[f'{sd} LEG'])<-0.12: q[f'{sd} KNEE']=_mirror(q[f'{sd} KNEE'],q[f'{sd} HIP'],q[f'{sd} LEG'])
    return q
def lerp(a,b,t): return {k:(a[k][0]+(b[k][0]-a[k][0])*t,a[k][1]+(b[k][1]-a[k][1])*t) for k in J}
def staged(a,b,t):
    out={}
    for k in J:
        tt=min(1,t*1.5) if ('HIP' in k or 'KNEE' in k or 'LEG' in k) else t**1.6 if ('ELBOW' in k or k.endswith(' ARM')) else min(1,t*1.2)
        out[k]=(a[k][0]+(b[k][0]-a[k][0])*tt,a[k][1]+(b[k][1]-a[k][1])*tt)
    return out
def sh(p,dx,dy=0): return {k:(v[0]+dx,v[1]+dy) for k,v in p.items()}
def jit(p,dx,dy,keys): return {k:((v[0]+dx,v[1]+dy) if any(s in k for s in keys) else v) for k,v in p.items()}
def first_from(path,swap=True):
    """estimate-skeleton 결과 → first_frame_keypoints. 측정기는 앞(가까운) 팔다리를 LEFT로 줄 때가 많아 swap으로 우리 약속(RIGHT=가까운)에 맞춤"""
    import json
    sw={'LEFT':'RIGHT','RIGHT':'LEFT'}; out=[]
    for k in json.load(open(path))['keypoints']:
        h=k['label'].split()[0]; lab=(sw[h]+k['label'][len(h):]) if swap and h in sw else k['label']
        out.append({'label':lab,'x':k['x'],'y':k['y'],'z_index':8 if lab.startswith('RIGHT') else 2 if lab.startswith('LEFT') else 5})
    return out
def preview(B,CLIPS,base_path,out_path,first=None):
    from PIL import Image,ImageDraw
    base=Image.open(base_path).convert('RGBA'); rows=[]
    fp=None
    if first: fp={k['label']:(k['x']*B.W,k['y']*B.H) for k in first}
    for n,(a,ps) in CLIPS.items():
        row=Image.new('RGBA',(128*(len(ps)+1),128),(30,34,40,255))
        row.alpha_composite(B.draw(fp,base,1).resize((128,128)) if fp else base.resize((128,128)),(0,0))
        for i,p in enumerate(ps): row.alpha_composite(B.draw(p).resize((128,128)),((i+1)*128,0))
        ImageDraw.Draw(row).text((2,2),n,fill=(255,255,0,255)); rows.append(row)
    w=max(r.width for r in rows); sheet=Image.new('RGBA',(w,128*len(rows)),(20,20,24,255))
    for j,r in enumerate(rows): sheet.alpha_composite(r,(0,j*128))
    sheet.save(out_path)
