"""여자 샤워실(확정 hq_bath_f_p5_extL1) 샤워기 헤드+받침을 DY px 위로 올리고 받침 밑 호스만 늘인다 (v5, 2026-11-01 16:xx).
방법: 검은 윤곽(밝기<95)을 줄마다 읽어 [왼끝,오른끝] 구간 마스크(흐린 윤곽 줄은 양옆 줄로 잇고, 가장자리 흐린 픽셀 1칸 포함) → 헤드+받침을 통째로 DY 위로,
받침 바로 밑 호스 한 줄을 DY줄 반복해 잇고, 빈 자리는 같은 벽면의 타일 한 주기(면 19/18/17px 세로, 뒷벽 27px 가로) 떨어진 픽셀로 메운다. 자동 오려내기(차이 마스크) 없음.
사용: python3 tools/bg_fix/bath_f_raise_heads.py 20 <출력.png>"""
import sys, numpy as np
from PIL import Image
o=np.asarray(Image.open('game-src/art/pixellab-hq-20261031/hq_bath_f_p5_extL1.png').convert('RGB')).astype(int); L=o.mean(2)
dark=L<95
EDGE={243,500,664,665}
TOP=[((150,105),(243,150)),((440,105),(500,152)),((664,149),(720,105))]
def wtop(x):
    for (ax,ay),(bx,by) in TOP:
        if ax<=x<=bx: return ay+(by-ay)*(x-ax)/(bx-ax)
# 칸: x0,x1, 헤드 맨 위 줄 ytop, 받침 밑 줄 yk(호스 첫 줄)
BOX={2:(180,212,151,187),3:(224,252,159,193),4:(456,490,150,187),5:(486,514,164,194),6:(650,684,163,194),7:(679,711,150,187)}
def groups(xs,gap=4):
    g=[]; 
    for x in xs:
        if g and x-g[-1][1]<=gap: g[-1][1]=x
        else: g.append([x,x])
    return g
def spans(n):
    x0,x1,yt,yk=BOX[n]
    rows={}
    for y in range(yt,yk):
        xs=[x for x in range(x0,x1) if dark[y,x] and x not in EDGE and not (wtop(x) is not None and abs(y-wtop(x))<=1.5)]
        rows[y]=groups(xs)
    return rows
# 줄마다 [왼끝,오른끝] 하나. 병·옆 샤워기 픽셀은 x 범위로 뺀다
XLIM={4:(456,488),6:(650,684)}
def bounds(n):
    x0,x1,yt,yk=BOX[n]
    out={}
    for y in range(yt,yk):
        xs=[x for x in range(x0,x1) if dark[y,x] and x not in EDGE and not (wtop(x) is not None and abs(y-wtop(x))<=1.5)]
        if n==6 and y>=186: xs=[x for x in xs if x>=664]
        if n==4: xs=[x for x in xs if x<488]
        if xs: out[y]=[min(xs),max(xs)]
    ys=sorted(out)
    for _ in range(2):   # 흐린 윤곽 줄(양옆 줄보다 2px 이상 안으로 들어간 끝) → 양옆 줄 평균
        for i in range(1,len(ys)-1):
            a,b,c=out[ys[i-1]],out[ys[i]],out[ys[i+1]]
            if ys[i+1]-ys[i-1]!=2: continue
            if b[0]-a[0]>=2 and b[0]-c[0]>=2: b[0]=round((a[0]+c[0])/2)
            if a[1]-b[1]>=2 and c[1]-b[1]>=2: b[1]=round((a[1]+c[1])/2)
    return out
OVR={}   # (n,y): [l,r] 손 교정
def mask(n):
    b=bounds(n)
    for (nn,y),v in OVR.items():
        if nn==n: b[y]=v
    m=np.zeros(L.shape,bool)
    for y,(l,r) in b.items(): m[y,l:r+1]=True
    return m

DY=int(sys.argv[1]); OUT=sys.argv[2]
orig=np.asarray(Image.open('game-src/art/pixellab-hq-20261031/hq_bath_f_p5_extL1.png').convert('RGBA')).copy()
H,W=L.shape
FACES=[(150,243,19),(440,500,18),(664,720,17)]
KEEP=[(640,178,666,216),(515,178,534,216)]
def facep(x):
    for a,b,p in FACES:
        if a<=x<=b: return p
def region(y,x):
    t=wtop(x) if facep(x) else None
    if t is not None and y>t+1: return 'F'
    return 'B' if 118<=y<=290 else 'X'
def keep(y,x): return any(b<=y<e and a<=x<c for a,b,c,e in KEEP)
def fringe(m):
    """마스크 가장자리 1px: 윤곽과 타일 사이 흐린 픽셀(밝기<160이고 그 바깥 픽셀보다 20 이상 어두움)을 넣는다"""
    add=np.zeros_like(m)
    for y,x in zip(*np.nonzero(m)):
        for dy,dx in ((0,1),(0,-1),(1,0),(-1,0)):
            yy,xx=y+dy,x+dx; y2,x2=y+2*dy,x+2*dx
            if not m[yy,xx] and L[yy,xx]<160 and L[y2,x2]-L[yy,xx]>=20 and not m[y2,x2]: add[yy,xx]=True
        for dy in (-1,0,1):          # 8방향 이웃의 어두운(밝기<158) 픽셀도 윤곽에 붙은 것으로 본다
            for dx in (-1,0,1):
                yy,xx=y+dy,x+dx
                if not m[yy,xx] and L[yy,xx]<158 and xx not in EDGE: add[yy,xx]=True
    return m|add
MASKS={n:fringe(mask(n)) for n in BOX}
ALLOBJ=dark.copy()
for x in EDGE: ALLOBJ[:,x]=False
for x in range(W):
    t=wtop(x)
    if t is not None:
        for y in range(int(t)-2,int(t)+3): ALLOBJ[y,x]=False
for a,b,c,e in KEEP: ALLOBJ[b:e,a:c]=True
for m in MASKS.values(): ALLOBJ|=m
t=ALLOBJ.copy(); t[1:]|=ALLOBJ[:-1]; t[:-1]|=ALLOBJ[1:]; t[:,1:]|=ALLOBJ[:,:-1]; t[:,:-1]|=ALLOBJ[:,1:]; ALLOBJ=t
def plate_px(y,x):
    r=region(y,x); p=facep(x) if r=='F' else 27
    cands=[]
    if r=='B': cands+= [(y,x+k) for k in (27,-27,54,-54,81,-81)]
    cands+=[(y+k*p,x) for k in (-1,1,-2,2,-3,3)]
    for sy,sx in cands:
        if 0<=sy<H and 0<=sx<W and region(sy,sx)==r and not ALLOBJ[sy,sx] and not keep(sy,sx): return orig[sy,sx]
    raise SystemExit(f'no source for {y},{x}')
out=orig.copy(); CH=np.zeros((H,W),np.uint8)
for n,(x0,x1,yt,yk) in BOX.items():
    head=MASKS[n]
    # 호스 첫 줄(yk): 받침 가운데 ±8 안의 어두운 픽셀 min~max, 양옆 흐린 픽셀 1칸
    bx=np.nonzero(head[yk-1])[0]; bc=(bx.min()+bx.max())//2
    hx=[x for x in range(bc-8,bc+9) if dark[yk,x] and x not in EDGE]
    hl,hr=min(hx),max(hx)
    if L[yk,hl-1]<160: hl-=1
    if L[yk,hr+1]<160: hr+=1
    newhead=np.zeros((H,W),bool); newhead[:-DY]=head[DY:]
    band=np.zeros((H,W),bool); band[yk-DY:yk,hl:hr+1]=True
    for y,x in zip(*np.nonzero(head&~newhead&~band)): out[y,x]=plate_px(y,x); CH[y,x]=1
    for y,x in zip(*np.nonzero(newhead)): out[y,x]=orig[y+DY,x]; CH[y,x]=2
    for y in range(yk-DY,yk):
        for x in range(hl,hr+1):
            if not newhead[y,x]: out[y,x]=orig[yk,x]; CH[y,x]=3
    print(n,'hose band x',hl,hr,'rows',yk-DY,yk-1)
# 2차(사용자 16:36 「조금만 더 깔끔하게」 2·4·6·7번): 옛 헤드·받침이 벽에 드리운 그림자(회청색, 밝기<158)가 옛 자리에 남음.
# 그림자도 샤워기와 함께 위로 옮긴다(타일 한 주기 P만큼 → 격자가 어긋나지 않음). 옛 그림자 자리는 같은 열의 깨끗한 타일로,
# 받침 밑 띠(호스 옆 그림자 열)는 아래쪽 호스 그림자를 P만큼 위로 복사해 잇는다. 픽셀 하나씩 문턱으로 바꾸는 방식은 점이 생겨 쓰지 않음.
SHADOW={2:((176,188),(172,195,150,200)),4:((456,466),(452,476,150,200)),6:((666,677),(663,681,160,200)),7:((701,712),(695,719,150,200))}
SH_T=158
for n,((bl,br),(rx0,rx1,ry0,ry1)) in SHADOW.items():
    x0,x1,yt,yk=BOX[n]; head=MASKS[n]; P=facep(br)
    newhead=np.zeros((H,W),bool); newhead[:-DY]=head[DY:]
    sh=np.zeros((H,W),bool)
    for y in range(ry0,min(ry1,yk)):
        for x in range(rx0,rx1):
            if L[y,x]<SH_T and not dark[y,x] and not head[y,x] and x not in EDGE and not keep(y,x): sh[y,x]=True
    bad=ALLOBJ|sh
    for y,x in zip(*np.nonzero(sh)):          # 1) 옛 그림자 자리 비우기
        r=region(y,x); v=None
        for k in (-1,1,-2,2,-3,3,-4,4):
            sy=y+k*P
            if 0<=sy<H and region(sy,x)==r and not bad[sy,x] and L[sy,x]>=SH_T and CH[sy,x]==0: v=orig[sy,x]; break
        if v is not None: out[y,x]=v; CH[y,x]=4
    for y,x in zip(*np.nonzero(sh)):          # 2) 그림자를 P만큼 위로
        if not newhead[y-P,x]: out[y-P,x]=orig[y,x]; CH[y-P,x]=5
    for y,x in zip(*np.nonzero(newhead)): out[y,x]=orig[y+DY,x]   # 3) 헤드는 그림자 위에
    for y in range(yk-DY,yk):                 # 4) 받침 밑 띠: 호스 열은 그대로(CH 3), 그림자 열은 아래 호스 그림자를 P 위로
        for x in range(bl,br+1):
            if newhead[y,x] or CH[y,x]==3 or x in EDGE: continue
            out[y,x]=orig[y+P,x]; CH[y,x]=6
Image.fromarray(out).save(OUT); np.save(OUT+'.ch.npy',CH)
