"""앉은 동작 줄 vs 앉기 끝 장(게임 바닥 기준) 비교 후보 목록. 자동 판정 아님: 눈으로 볼 후보만 뽑는다.
출력: key view line shift(dx,dy: 동작 첫 장을 앉기 끝 장에 맞추려면 옮길 양, 화면 px) bob(줄 안 장마다 바닥 기준 출렁임)"""
import sys,os,json
from pathlib import Path
ARGV=sys.argv[1:]
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit'); sys.argv=sys.argv[:1]
sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa'))
import fit_chair as fc, build
import numpy as np
from PIL import Image
ACTS={'front':['62','63','64','65','66','67','68','73','106','148','149','167'],'side':['97','98','99','105'],'back':['69','70','71','72']}
SIT={'front':'60','side':'96','back':'61'}
def frames(cfg,lid):
    an=cfg['anims'].get(lid)
    if not an: return []
    fs=sorted((build.src_dir(cfg,an)/an['folder']).glob('[0-9][0-9].png'))
    out=[Image.open(f).convert('RGBA') for f in fs]
    return [i.transpose(Image.FLIP_LEFT_RIGHT) for i in out] if an.get('mirror') else out
def placed(im):   # 게임처럼: 바닥 기준 = min(H-4, 그 장 가장 낮은 점) 을 0 에
    H=im.size[1]; b=min(H-4,im.getbbox()[3]); a=np.array(im)[:,:,3]>40
    return a,b
def best(a0,b0,a1,b1,R=24):
    # a1 을 (sx,sy) 옮겨 a0 에 겹칠 때 겹침 최대. 좌표는 각자 바닥 기준선 정렬 후
    off=b0-b1; best=(-1,0,0)
    ys0,xs0=np.where(a0)
    for sy in range(-R,R+1):
        for sx in range(-R,R+1):
            pass
    return None
def score(a0,a1,dy,dx):
    H,W=a0.shape
    s=np.zeros_like(a1)
    ys=slice(max(0,dy),H+min(0,dy)); yd=slice(max(0,-dy),H+min(0,-dy))
    xs=slice(max(0,dx),W+min(0,dx)); xd=slice(max(0,-dx),W+min(0,-dx))
    s[ys,xs]=a1[yd,xd]
    return (s&a0).sum()/max(1,(s|a0).sum())
if __name__=='__main__':
    J=json.load(open(ROOT/'game-src/art/objects/chairs_shell/fit_all.json'))
    for k in (ARGV or list(J)):
        c,_=fc.load(k)
        for v,ls in ACTS.items():
            s=fc.last(c,SIT[v])
            if s is None: continue
            a0,b0=placed(s)
            for l in ls:
                fr=frames(c,l)
                if not fr: continue
                bs=[min(f.size[1]-4,f.getbbox()[3]) for f in fr]
                a1,b1=placed(fr[0]); A0=a0
                W=max(a0.shape[1],a1.shape[1])+2
                pad=lambda a:np.pad(a,((0,0),((W-a.shape[1])//2,W-a.shape[1]-(W-a.shape[1])//2)))   # 게임처럼 가운데 맞춤
                if a1.shape[0]!=a0.shape[0]: print(k,v,l,'height',a1.shape,a0.shape); continue
                A0,a1=pad(a0),pad(a1)
                base=b0-b1   # 게임에서 줄 첫 장이 앉기 끝 장보다 아래로 내려가는 양
                bestv=(-1,0,0)
                for dy in range(-20,21):
                    for dx in range(-20,21,2):
                        sc=score(A0,a1,base+dy,dx)  # 게임 위치(base 이동) 에서 추가 dy,dx
                        if sc>bestv[0]: bestv=(sc,dx,dy)
                print(k,v,l,f'need dx={bestv[1]} dy={bestv[2]} iou={bestv[0]:.2f} bob={max(bs)-min(bs)}',flush=True)
