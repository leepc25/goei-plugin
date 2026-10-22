# 생성 전 자동 검사(0회): ① 손이 어깨보다 위인데 팔꿈치가 등 뒤(정면으로 그려지는 원인) ② 옆모습(두 어깨 x 차 ≤ 8)
# ③ 쟈알디 같은 이름 클립과 자세가 거의 같은지(장별 관절 평균 거리 < 5px면 "복사" 의심). 사용: python3 audit.py
import sys,os,math
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import krig
J=krig.R
def d(a,b): return math.hypot(a[0]-b[0],a[1]-b[1])
issues=0
for n,(a,_,ps) in krig.CLIPS.items():
    msg=[]
    for i,p in enumerate(ps):
        for s in ('RIGHT','LEFT'):
            sh,e,w=p[f'{s} SHOULDER'],p[f'{s} ELBOW'],p[f'{s} ARM']
            if w[1]<sh[1]+2 and e[0]<sh[0]-3 and n not in ('snap2','support','doorclose','leadhand','fall','yawn','surprise','snap3','airsnap','jump','wallcry'): msg.append(f'{i}:{s[0]}팔꿈치뒤')
        if abs(p['RIGHT SHOULDER'][0]-p['LEFT SHOULDER'][0])>8 and n!='turn': msg.append(f'{i}:어깨벌어짐')
    if n in J.CLIPS:
        jp=J.CLIPS[n][2]; m=min(len(jp),len(ps))
        sim=sum(sum(d(ps[i][k],jp[i][k]) for k in ps[i])/len(ps[i]) for i in range(m))/m
        if sim<5: msg.append(f'쟈알디와 비슷 {sim:.1f}px')
    if msg: issues+=1; print(n,' '.join(msg))
print('문제 클립',issues,'/',len(krig.CLIPS))
