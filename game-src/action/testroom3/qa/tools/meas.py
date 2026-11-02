import sys,json; sys.path.insert(0,'qa'); keys=sys.argv[1:]; sys.argv=sys.argv[:1]
import fit_chair as F, numpy as np
from PIL import Image
def bb(im):
    a=np.array(im)[:,:,3]>40; ys,xs=np.where(a); return xs.min(),xs.max(),ys.min(),ys.max(),a
def meas(k):
    cfg,_=F.load(k); ims,vals=F.values(cfg); im=ims['front']; p=vals['front']
    x0,x1,y0,y1,a=bb(im); H=y1-y0
    w=[(np.ptp(np.nonzero(r)[0]) if r.any() else 0) for r in a]; mw=max(w[y0:y0+int(H*.6)])
    sh=next(y for y in range(y0,y1) if w[y]>0.75*mw)
    c=Image.open(F.chair_png(p['img'])).convert('RGBA'); cx0,cx1,ct,cb,_=bb(c)
    # 의자 꼭대기(그림 좌표, 사람 그림 기준): base = im.h-4 ; chair y = base + dy - 171 + ct
    base=im.size[1]-4; ctop=base+p['dy']-171+ct
    # 몸통 가운데(어깨~허리 행들의 가운데)
    rows=[np.nonzero(a[y])[0] for y in range(sh,sh+int(H*.25)) if a[y].any()]
    tc=np.mean([(r.min()+r.max())/2 for r in rows])-im.size[0]/2
    chc=p['dx']-100+(cx0+cx1)/2
    return dict(k=k,ctop_minus_sh=int(ctop-sh),H=int(H),sh_from_top=int(sh-y0),chair_c_minus_torso=round(chc-tc,1),dx=p['dx'],dy=p['dy'],img=p['img'],sh=int(sh),ct=int(ct),base=base,tc=round(tc,1),ccx=(cx0+cx1)/2)
if __name__ == "__main__":
  for k in keys: print(json.dumps(meas(k),ensure_ascii=False))
