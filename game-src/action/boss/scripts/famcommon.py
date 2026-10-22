# 208호 가족 뼈대 공용: 사람 모습(대화)과 늘어난 모습. 몸 치수는 각 기준 그림 estimate-skeleton 실측.
import math,os,brig as R
_D=os.path.dirname(os.path.abspath(__file__))
def mk(name,body,X,hipy,lean,feet,hands,clipdefs,desc):
    B=body; CL={}
    def clip(n,a,ps): assert 3<=len(ps)<=15,(n,len(ps)); CL[n]=('side view in profile facing right: '+a,[R.anatomic(p) for p in ps])
    clipdefs(B,X,hipy,lean,feet,hands,clip)
    return dict(B=B,CLIPS=CL,REF=f'{_D}/../family/base/{name}.png',FIRST=R.first_from(f'{_D}/../family/base/{name}.skel.json'),DESC=desc)
