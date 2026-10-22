# 사람형 잡몹 뼈대 (animate_with_skeleton_v3). 몸 치수는 기준 그림 실루엣에서 자동으로 잰다(auto_kp).
# 좌표 = 최종 캔버스 픽셀, 오른쪽을 봄. RIGHT = 가까운 쪽 = 앞손·앞발.
# 한 생성 작업에 여러 클립 장을 묶어(4~14장 = 3회) 비용을 줄이고, 받은 뒤 클립별로 나눈다(JOBS).
import math,os,sys
from PIL import Image
sys.path.insert(0,os.path.dirname(__file__))
from rigbase import *
from defs import M
ROOT=os.path.join(os.path.dirname(__file__),'..')

def rows(mask,W,H):
    out={}
    for y in range(H):
        xs=[x for x in range(W) if mask[x,y]]
        if xs: out[y]=xs
    return out
def auto_kp(k):
    """기준 그림(서 있는 옆모습) 실루엣에서 관절을 비율로 잡는다."""
    im=Image.open(f'{ROOT}/{k}/base.png').convert('RGBA'); W,H=im.size
    if M[k].get('flipv'):
        bb=im.getchannel('A').getbbox(); t0,b0=bb[1],bb[3]-1
        im=im.transpose(Image.FLIP_TOP_BOTTOM); im2=Image.new('RGBA',(W,H)); im2.alpha_composite(im.crop((0,H-1-b0,W,H-t0)),(0,t0)); im=im2
    a=im.getchannel('A').load(); wf=M[k].get('wrist',.5)
    m=type('m',(),{'__getitem__':lambda s,xy: a[xy[0],xy[1]]>0})()
    R=rows(m,W,H); top=min(R); bot=max(R); h=bot-top
    def cen(f):
        y=int(top+f*h); xs=R.get(y) or R[min(R,key=lambda v:abs(v-y))]; return ((min(xs)+max(xs))/2,y)
    def front(f):
        y=int(top+f*h); xs=R.get(y) or R[min(R,key=lambda v:abs(v-y))]; return (max(xs)-1,y)
    def legs(f):
        y=int(top+f*h); xs=R.get(y) or R[min(R,key=lambda v:abs(v-y))]
        runs=[]; s=xs[0]; p=xs[0]
        for x in xs[1:]:
            if x!=p+1: runs.append((s,p)); s=x
            p=x
        runs.append((s,p))
        if len(runs)>=2: return ((runs[-1][0]+runs[-1][1])/2,y),((runs[0][0]+runs[0][1])/2,y)
        c=(xs[0]+xs[-1])/2; w=(xs[-1]-xs[0])/4; return (c+w,y),(c-w,y)
    nose=front(.07); neck=cen(.16); sh=cen(.2); hip=cen(.5)
    kn_f,kn_b=legs(.74); an_f,an_b=legs(.97)
    kp={'NOSE':nose,'NECK':neck,'RIGHT SHOULDER':(sh[0]+1,sh[1]),'LEFT SHOULDER':(sh[0]-1,sh[1]),
        'RIGHT ELBOW':(sh[0]+1,top+(.2+wf)/2*h),'RIGHT ARM':(hip[0]+2,top+wf*h),'LEFT ELBOW':(sh[0]-2,top+(.2+wf)/2*h),'LEFT ARM':(hip[0]-2,top+wf*h),
        'RIGHT HIP':(hip[0]+1,hip[1]),'LEFT HIP':(hip[0]-1,hip[1]),'RIGHT KNEE':kn_f,'LEFT KNEE':kn_b,'RIGHT LEG':an_f,'LEFT LEG':an_b,
        'RIGHT EYE':(nose[0]-2,nose[1]-2),'LEFT EYE':(nose[0]-1,nose[1]-3),'RIGHT EAR':(neck[0]-2,nose[1]-1),'LEFT EAR':(neck[0]-1,nose[1]-2)}
    return kp,(W,H),top,bot

class Mob:
    """한 몹의 몸 치수 + 표준 자세 묶음"""
    def __init__(s,k,lean0=3):
        s.k=k; s.d=M[k]; s.ref,(W,H),top,bot=auto_kp(k)
        r=s.ref; hip=((r['RIGHT HIP'][0]+r['LEFT HIP'][0])/2,r['RIGHT HIP'][1]); nk=r['NECK']
        torso=hip[1]-nk[1]; leg=(r['RIGHT LEG'][1]-hip[1]); arm=(r['RIGHT ARM'][1]-r['RIGHT SHOULDER'][1])*1.05
        s.B=Body(W,H,hip[0],max(r['RIGHT LEG'][1],r['LEFT LEG'][1]),TORSO=torso,THIGH=leg*.5,SHIN=leg*.5,UARM=arm*.52,FARM=arm*.52,
                 head=(r['NOSE'][0]-nk[0],r['NOSE'][1]-nk[1]),shw=3,hipw=3)
        s.ref_tb=(top,bot); s.flipped=False
        s.X,s.HY,s.G=hip[0],hip[1],s.B.G; s.h=bot-top; s.lean0=lean0; s.u=s.h/100   # u = 키 100px 기준 배율
        s.CLIPS={}   # 이름 → 자세 목록
    def P(s,dx=0,dy=0,lean=None,lf=None,rf=None,lh='down',rh='down',**k):
        u=s.u; X,HY,G=s.X,s.HY,s.G
        lf=lf if lf is None else (X+dx*u+lf[0]*u,G+lf[1]*u); rf=rf if rf is None else (X+dx*u+rf[0]*u,G+rf[1]*u)
        def H(t):
            if isinstance(t,tuple) and t[0] in ('a','r'): return t
            if isinstance(t,tuple): return (t[0]*u,t[1]*u)
            return t
        k={kk:(('e',v[1]*u,v[2]*u) if isinstance(v,tuple) and v[0]=='e' else v) for kk,v in k.items()}
        return s.B.P((X+dx*u,HY+dy*u),s.lean0 if lean is None else lean,0,0,lf or (X+dx*u+8*u,G),rf or (X+dx*u-7*u,G),H(lh),H(rh),**k)
    # ── 표준 자세 ──
    def stand(s,b=0,**k): return s.P(0,b,**k)
    def walk(s,t,stride=11,lift=5,**k):
        c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
        k.setdefault('lh',(6-8*c,30)); k.setdefault('rh',(2+8*c,30))
        return s.P(1,1.5*abs(c),lf=(1+stride*c,-lift*max(0,-sn)),rf=(1-stride*c,-lift*max(0,sn)),**k)
    def hurt_l(s,a): return s.P(-2*a,1*a,lean=s.lean0-12*a,lh=(4,30),rh=(-2,30),tilt=-14*a)
    def hurt_h(s,a): return s.P(-5*a,4*a,lean=s.lean0+28*a,lf=(6,0),rf=(-14*a-6,-2*a),lh=(10,34),rh=(4,36),tilt=10*a)
    def air(s,i):
        u=s.u
        if i==0: return s.P(4,-14,lean=-35,lf=(10,-24),rf=(0,-20),lh=(14,-6),rh=(10,-2),tilt=-20)
        if i==1: return s.P(10,-6,lean=-70,lf=(22,-30),rf=(12,-26),lh=(16,-10),rh=(12,-6),tilt=-20)
        return s.lie(4)
    def lie(s,dx=12):
        # 등을 대고 누움(머리 왼쪽), 몸통이 바닥줄 위
        return s.P(dx,(s.G-4-s.HY)/s.u,lean=-90,lf=(44,-4),rf=(42,-2),lh=(8,4),rh=(4,8),le=ELB_UP,re=ELB_UP)
    def getup(s,i):
        if i==0: return s.P(-6,30,lean=30,lf=(14,0),rf=(-20,0),lh=('a',s.X+18*s.u,s.G),rh=(10,30),tilt=-10)
        return s.P(-2,10,lean=16,lf=(10,0),rf=(-10,0),lh=(14,30),rh=(6,30))
    def basic(s,idle=None,walk=None):
        """기본 장면 20장"""
        s.CLIPS['idle']=idle or [s.stand(b) for b in (0,.6,1,.6)]
        s.CLIPS['walk']=walk or [s.walk(i/6) for i in range(6)]
        s.CLIPS['hurt_l']=[s.hurt_l(.6),s.hurt_l(1)]
        s.CLIPS['hurt_h']=[s.hurt_h(.6),s.hurt_h(1)]
        s.CLIPS['air']=[s.air(0),s.air(1),s.air(2)]
        s.CLIPS['lie']=[s.lie()]
        s.CLIPS['getup']=[s.getup(0),s.getup(1)]
    def attack(s,name,tele,hit,rec=None,nt=2,nh=2):
        """예비(마지막 장이 버티는 자세) → 공격 → 회복"""
        st=s.CLIPS['idle'][0]
        s.CLIPS[f'{name}_tele']=[lerp(st,tele,.55),tele] if nt==2 else [lerp(st,tele,.4),lerp(st,tele,.8),tele]
        s.CLIPS[f'{name}_hit']=[staged(tele,hit,.6),hit] if nh==2 else [staged(tele,hit,.5),hit,hit]
        s.CLIPS[f'{name}_rec']=[rec or lerp(hit,st,.55)]
    def jobs(s,groups=None):
        """묶음: 각 묶음 4~14장. 기본은 순서대로 14장 이하로 채움"""
        names=list(s.CLIPS); out=[]; cur=[]; n=0
        for nm in names:
            c=len(s.CLIPS[nm])
            if n+c>14: out.append(cur); cur=[]; n=0
            cur.append(nm); n+=c
        if cur: out.append(cur)
        # 3장 이하 묶음은 앞 묶음에 붙이거나 4장 채우기
        fixed=[]
        for g in out:
            if sum(len(s.CLIPS[x]) for x in g)<4 and fixed and sum(len(s.CLIPS[x]) for x in fixed[-1])+sum(len(s.CLIPS[x]) for x in g)<=15: fixed[-1]+=g
            else: fixed.append(g)
        return fixed
    def final(s):
        for n,ps in s.CLIPS.items(): s.CLIPS[n]=[{k:((v[0],min(v[1],s.G+6)) if ('ELBOW' in k or 'KNEE' in k) else v) for k,v in anatomic(p).items()} for p in ps]
        return s

def flipv(p,top,bot):
    return {k:(v[0],top+bot-v[1]) for k,v in p.items()}
