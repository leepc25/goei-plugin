# 208호 엄마 사람 모습(대화). 기준 ../family/base/mom.png (키 약 108).
import math,famcommon as F,brig as R
DESC='gentle kind-faced middle-aged Korean mother with purple permed hair, beige home cardigan over a long plum skirt, house slippers'
B=R.Body(thigh=22,shin=20,uarm=14,farm=13,torso=28,G=192,k=1.1,head=(12,-13))
X=58
def defs(B,X,hy,ln,ft,hd,clip):
    P,lerp,jit=B.P,R.lerp,R.jit; G=B.G
    I=lambda b=0,**k: P((X,151+b),2,0,0,(X+3,G),(X-3,G),**({**dict(lh=('r',10,14),rh=('r',8,15)),**k}))
    clip('idle','worried mother, hands clasped at her chest, small anxious sway',[I(0),I(1),I(1,tilt=4),I(0)])
    AS=I(0,lh=('r',18,6),rh=('r',14,8),tilt=-6)
    clip('ask','steps closer pleading, hands reaching out, asking if you have seen her child',[I(0),lerp(I(0),AS,.5),AS,jit(AS,1,-2,['ARM']),AS,I(0)])
    AN=P((X+2,152),8,0,0,(X+6,G),(X-4,G),('r',8,22),('r',6,22),tilt=10)
    clip('angry','her smile freezes, shoulders shake, head lowers, fists clenched at her sides',[I(0),lerp(I(0),AN,.5),AN,jit(AN,1,0,['NECK','NOSE']),AN,jit(AN,-1,0,['NECK','NOSE'])])
    HP=P((X,150),-2,0,0,(X+3,G),(X-3,G),('r',12,10),('r',10,11),tilt=-8)
    clip('happy','overjoyed and relieved, clutches something to her chest and hugs it, smiling',[I(0),lerp(I(0),HP,.5),HP,jit(HP,0,1,['NOSE']),HP,HP])
CLIPS={}; REF=FIRST=None
_m=F.mk('mom',B,X,151,2,None,None,defs,DESC); CLIPS=_m['CLIPS']; REF=_m['REF']; FIRST=_m['FIRST']
if __name__=='__main__': R.preview(B,CLIPS,REF,f'{F._D}/../family/preview-mom.png',FIRST); print(len(CLIPS))
