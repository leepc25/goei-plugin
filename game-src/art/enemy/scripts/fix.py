# 장 정리(생성 0회): 떨어져 떠 있는 작은 조각(생성기가 덧그린 공·먼지·효과) 지우기.
# 사용: python3 fix.py [kind...]   기록 → ../fixlog.txt
import sys,os,glob
from PIL import Image
sys.path.insert(0,os.path.dirname(__file__))
from defs import M
ROOT=os.path.join(os.path.dirname(__file__),'..')
def comps(im):
    W,H=im.size; a=im.getchannel('A').load(); seen=set(); out=[]
    for y in range(H):
        for x in range(W):
            if a[x,y] and (x,y) not in seen:
                st=[(x,y)]; seen.add((x,y)); c=[]
                while st:
                    p=st.pop(); c.append(p)
                    for dx in (-1,0,1):
                        for dy in (-1,0,1):
                            q=(p[0]+dx,p[1]+dy)
                            if 0<=q[0]<W and 0<=q[1]<H and a[q] and q not in seen: seen.add(q); st.append(q)
                out.append(c)
    return out
def clean(p,keep=0.08):
    im=Image.open(p).convert('RGBA'); cs=comps(im)
    if len(cs)<2: return 0
    big=max(len(c) for c in cs); px=im.load(); n=0
    for c in cs:
        if len(c)<big*keep:
            for q in c: px[q]=(0,0,0,0)
            n+=len(c)
    if n: im.save(p)
    return n
if __name__=='__main__':
    log=open(f'{ROOT}/fixlog.txt','a')
    for k in sys.argv[1:] or list(M):
        for f in sorted(glob.glob(f'{ROOT}/{k}/clips/*/[0-9][0-9].png')):
            n=clean(f)
            if n: log.write(f'{os.path.relpath(f,ROOT)} 떠 있는 조각 {n}px 지움\n'); print(os.path.relpath(f,ROOT),n)
