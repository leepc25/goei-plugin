# 인물 그림 윤곽선 밖 회색·흰 점 지우기 (사용자 2026-11-08). 저장소 맨 위에서: python3 tools/charpack/clean_gray_specks.py <출력 폴더>
# 기준: 윤곽 경계 픽셀, 밝기>=70, 채도<=30, 보라 아님, 반경 2 이웃이 모두 어두움(<=60), 밝은 덩어리 <=12px -> 투명. 4회 반복. 결과 png와 report.json을 출력 폴더에 쓴다.
import json, os, sys
import numpy as np
from PIL import Image
THR,GAP,DARK,BIG,SAT=70,30,60,12,30
def shifts(r):
    return [(dy,dx) for dy in range(-r,r+1) for dx in range(-r,r+1) if dy or dx]
def shift(a,dy,dx,fill):
    H,W=a.shape; o=np.full_like(a,fill)
    ys=slice(max(dy,0),H+min(dy,0)); yd=slice(max(-dy,0),H+min(-dy,0))
    xs=slice(max(dx,0),W+min(dx,0)); xd=slice(max(-dx,0),W+min(-dx,0))
    o[yd,xd]=a[ys,xs]; return o
def frame_specks(fr):
    a=np.asarray(fr).astype(np.int32); A=a[...,3]>0
    r,g,b=a[...,0],a[...,1],a[...,2]
    L=(r*299+g*587+b*114)/1000.0
    sat=np.max(a[...,:3],axis=2)-np.min(a[...,:3],axis=2)
    purple=(r-g>=8)&(b-g>=8)
    tr=np.zeros_like(A)
    for dy,dx in shifts(1): tr|=~shift(A,dy,dx,False)
    B=A&tr
    cand=B&(L>=THR)&(sat<=SAT)&~purple
    if not cand.any(): return []
    M=np.where(A&~cand,L,-1.0); mx=np.full(L.shape,-1.0)
    for dy,dx in shifts(2): mx=np.maximum(mx,shift(M,dy,dx,-1.0))
    ok=cand&((mx<0)|(mx<=np.minimum(L-GAP,DARK)))
    light=A&(L>=THR); H,W=A.shape; out=[]
    for y,x in zip(*np.nonzero(ok)):
        seen={(y,x)}; q=[(y,x)]
        while q and len(seen)<=BIG:
            cy,cx=q.pop()
            for dy,dx in shifts(1):
                ny,nx=cy+dy,cx+dx
                if 0<=ny<H and 0<=nx<W and light[ny,nx] and (ny,nx) not in seen: seen.add((ny,nx)); q.append((ny,nx))
        if len(seen)<=BIG: out.append((int(x),int(y)))
    return out
def clean(path,cw,n):
    im=Image.open(path).convert('RGBA'); allp=[]
    for f in range(n):
        fr=im.crop((f*cw,0,(f+1)*cw,im.height))
        for _ in range(4):
            s=frame_specks(fr)
            if not s: break
            for x,y in s: fr.putpixel((x,y),(0,0,0,0))
            allp+=[(f*cw+x,y) for x,y in s]
        im.paste(fr,(f*cw,0))
    return im,allp
if __name__=='__main__':
    out=sys.argv[1]; os.makedirs(out,exist_ok=True); rep={}
    jobs=[]
    for d in sorted(os.listdir('game-src/looks')):
        j=json.load(open(f'game-src/looks/{d}/look.json')); jobs.append((d,'idle',j['name'],'대기',f'game-src/looks/{d}/{j["file"]}',j['cw'],j['n']))
    for d in sorted(os.listdir('game-pack')):
        if not d.startswith('char-'): continue
        j=json.load(open(f'game-pack/{d}/char.json'))
        for k,m in j['A'].items():
            if isinstance(m,dict) and 'file' in m:
                jobs.append((d,k,j.get('cfg',{}).get('name',''),m.get('name',''),f'game-pack/{d}/{m["file"]}',m['cw'],m['n']))
    for i,(d,k,nm,mn,path,cw,n) in enumerate(jobs):
        im,p=clean(path,cw,n)
        if p:
            os.makedirs(f'{out}/{d}',exist_ok=True); im.save(f'{out}/{d}/{os.path.basename(path)}.png')
            rep[f'{d}/{k}']={'char':d,'key':k,'name':nm,'motion':mn,'path':path,'cw':cw,'n':n,'px':p}
        if i%500==0: print(i,len(jobs),len(rep),flush=True)
    json.dump(rep,open(f'{out}/report.json','w'),ensure_ascii=False)
    print('done',len(jobs),len(rep),sum(len(v['px']) for v in rep.values()))
