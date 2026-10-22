# 생성 클립 자동 검사(눈 검수 전에 의심 장 추리기). 사용: python3 qa.py [이름...]  (기본 = 생성된 전부)
# 장마다: 덩어리 수(떨어진 불투명 덩어리 30px 이상 = 다른 사람·물건 의심), 가로 폭(기준 G0 대비, 넓으면 상대·가구 의심),
# 기준 팔레트에서 먼 색 비율(빨강·나무색 등 물건 의심), 발바닥 y(136 ± 3 밖이면 뜸·가라앉음, 공중 동작 제외),
# 끝 장이 첫 장으로 되돌아감(IoU), 머리 흰색 덩어리 크기(옆모습 → 3/4 돌아감 의심).
import os,sys,json
import numpy as np
from PIL import Image
from scipy import ndimage
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.join(HERE,'..')
sys.path.insert(0,ROOT); import plan
AIR={'jump','airstomp','airmark','tkleap','fall','down','tackle','super','land','startlefall','vault','grabreap','stepover','ladder','mantle'}
LYING={'down','getup','liesit','liehold','bedlie','crawl','collapse','floorsit','floorrest','plopdown','kneelcry','startlefall','land'}
g0=np.array(Image.open(f'{ROOT}/base/G0.png').convert('RGBA'))
pal=g0[g0[:,:,3]>0][:,:3].astype(int)
pal=np.unique(pal,axis=0)
def far_ratio(a):
    px=a[a[:,:,3]>0][:,:3].astype(int)
    if not len(px): return 0
    d=((px[:,None,:]-pal[None,:,:])**2).sum(-1).min(1)
    return float((d>40**2).mean())
def info(a):
    m=a[:,:,3]>0
    lab,n=ndimage.label(m)
    sizes=ndimage.sum(m,lab,range(1,n+1)) if n else []
    big=[s for s in sizes if s>=30]
    ys,xs=np.nonzero(m)
    hair=(a[:,:,0]>200)&(a[:,:,1]>200)&(a[:,:,2]>200)&m
    hy=np.nonzero(hair[:70])[0]
    return dict(blobs=len(big),w=int(xs.max()-xs.min()+1) if len(xs) else 0,foot=int(ys.max()) if len(ys) else 0,
                top=int(ys.min()) if len(ys) else 0,far=round(far_ratio(a),3),white=int(hair[:70].sum()),mask=m)
def iou(a,b): return (a&b).sum()/max(1,(a|b).sum())
def main():
    names=[a for a in sys.argv[1:]] or [r[0] for r in plan.P if os.path.isdir(f'{ROOT}/clips/{r[0]}')]
    base=info(g0); out={}
    for n in names:
        d=f'{ROOT}/clips/{n}'
        if not os.path.isdir(d): continue
        fs=sorted(f for f in os.listdir(d) if f.endswith('.png'))
        ims=[np.array(Image.open(f'{d}/{f}').convert('RGBA')) for f in fs]
        I=[info(a) for a in ims]; flags=[]
        for i,x in enumerate(I):
            f=[]
            if x['blobs']>1: f.append(f"덩어리{x['blobs']}")
            if x['w']>base['w']*2.6 and n not in LYING: f.append(f"폭{x['w']}")
            if x['far']>0.06: f.append(f"낯선색{x['far']}")
            if n not in AIR and n not in LYING and abs(x['foot']-136)>3: f.append(f"발{x['foot']}")
            if x['white']>base['white']*1.6: f.append(f"흰머리{x['white']}")
            if f: flags.append(f'{i}:'+','.join(f))
        if len(I)>3 and iou(I[-1]['mask'],I[0]['mask'])>0.9 and iou(I[-2]['mask'],I[0]['mask'])<0.8: flags.append('끝장되돌아감')
        out[n]=flags
        print(n,len(ims),'장 ',' '.join(flags) if flags else 'OK')
    json.dump(out,open(f'{ROOT}/qa_auto.json','w'),ensure_ascii=False,indent=1)
if __name__=='__main__': main()
