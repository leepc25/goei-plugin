# 208호 아빠 사람 모습(대화). 기준 ../family/base/dad.png (키 약 170).
import math,famcommon as F,brig as R
DESC='stern stocky middle-aged Korean father with a hard square face, short black hair, sleeveless white undershirt under an open checked short-sleeve shirt, grey slacks, slippers'
B=R.Body(thigh=44,shin=37,uarm=21,farm=22,torso=41,G=205,k=1.6,head=(10,-20))
X=115
def defs(B,X,hy,ln,ft,hd,clip):
    P,lerp,jit=B.P,R.lerp,R.jit; G=B.G
    I=lambda b=0,**k: P((X,123+b),-8,0,0,(X+2,G),(X-8,G),**({**dict(lh=('r',18,20),rh=('r',10,22)),**k}))
    clip('idle','stern father, arms crossed, stares coldly, slight weight shift',[I(0),I(1),I(1),I(0)])
    AS=P((X+2,123),0,0,0,(X+6,G),(X-8,G),('r',40,4),('r',6,40),tilt=-4)
    clip('ask','points sharply forward, demanding where his child is',[I(0),lerp(I(0),AS,.5),AS,R.jit(AS,0,-3,['RIGHT ARM']),AS,I(0)])
    AN=P((X+2,125),10,0,0,(X+8,G),(X-8,G),('r',14,36),('r',8,38),tilt=8)
    clip('angry','uncrosses his arms, fists clenching, breathing hard, jaw working',[I(0),lerp(I(0),AN,.5),AN,R.jit(AN,1,-1,['NECK','NOSE']),AN,R.jit(AN,-1,1,['NECK','NOSE'])])
    HP=P((X,123),-4,0,0,(X+2,G),(X-8,G),('r',22,10),('r',18,12),tilt=4)
    clip('happy','his face softens, he nods slowly and holds out an open hand',[I(0),lerp(I(0),HP,.5),HP,HP,R.jit(HP,0,2,['NOSE']),HP])
_m=F.mk('dad',B,X,123,-8,None,None,defs,DESC); CLIPS=_m['CLIPS']; REF=_m['REF']; FIRST=_m['FIRST']
if __name__=='__main__': R.preview(B,CLIPS,REF,f'{F._D}/../family/preview-dad.png',FIRST); print(len(CLIPS))
