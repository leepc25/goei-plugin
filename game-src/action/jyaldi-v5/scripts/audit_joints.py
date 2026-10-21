# 팔꿈치·무릎 꺾임 방향 검사 (오른쪽을 보는 옆모습 기준).
# 팔꿈치: 위팔 u(어깨→팔꿈치), 아래팔 f(팔꿈치→손목)에서 cross(u,f) = ux*fy-uy*fx 가 양수면 거꾸로 꺾임(과신전).
# 무릎: 허벅지 u(골반→무릎), 정강이 f(무릎→발목)에서 cross 가 음수면 거꾸로 꺾임.
# 쓰는 법: python3 audit_joints.py [이름...]  (거꾸로 꺾인 장만 출력)
import sys,math
sys.path.insert(0,'.'); import rig
def cross(a,b,c):
    u=(b[0]-a[0],b[1]-a[1]); f=(c[0]-b[0],c[1]-b[1])
    n=math.hypot(*u)*math.hypot(*f) or 1
    return (u[0]*f[1]-u[1]*f[0])/n      # 사인값(-1~1)
def bad(p,tol=0.12):
    out=[]
    for s in ('RIGHT','LEFT'):
        e=cross(p[f'{s} SHOULDER'],p[f'{s} ELBOW'],p[f'{s} ARM'])
        if e>tol: out.append(f'{s[0]}팔꿈치{e:+.2f}')
        k=cross(p[f'{s} HIP'],p[f'{s} KNEE'],p[f'{s} LEG'])
        if k<-tol: out.append(f'{s[0]}무릎{k:+.2f}')
    return out
if __name__=='__main__':
    names=sys.argv[1:] or list(rig.CLIPS)
    n_bad=0
    for n in names:
        rows=[(i,b) for i,p in enumerate(rig.CLIPS[n][2]) if (b:=bad(p))]
        if rows: n_bad+=1; print(n,' '.join(f'{i}:{",".join(b)}' for i,b in rows))
    print('거꾸로 꺾인 클립',n_bad,'/',len(names))
