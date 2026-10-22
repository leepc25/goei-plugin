# 게슈간 뼈대 자동 검사 (생성 전, 비용 0). 쟈알디 교훈(character-art-rules)을 코드로:
# 1 관절 거꾸로 꺾임 2 손이 어깨 위인데 팔꿈치가 등 뒤(=정면으로 돌아감) 3 뼈 길이 ±40% 4 어깨 벌어짐(옆모습 유지) 5 발 접지(공중·누운·앉은 클립 제외)
import sys,math,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import grig as rig
def cross(a,b,c):
    u=(b[0]-a[0],b[1]-a[1]); f=(c[0]-b[0],c[1]-b[1]); n=math.hypot(*u)*math.hypot(*f) or 1
    return (u[0]*f[1]-u[1]*f[0])/n
L=lambda a,b: math.hypot(a[0]-b[0],a[1]-b[1])
NOM={('SHOULDER','ELBOW'):rig.J.UARM,('ELBOW','ARM'):rig.J.FARM,('HIP','KNEE'):rig.J.THIGH,('KNEE','LEG'):rig.J.SHIN}
AIR={'jump','airstomp','airmark','fall','tkleap','ladder','mantle','vault','stepup','stepover','land','tackle','grabreap','down','getup','collapse','startlefall','super','crawl'}
NOFLOOR=AIR|{'liesit','liehold','bedlie','seatrest','chairsit','typing','seatmouth','seathold','seatthink','doze'}
def check(n,i,p):
    out=[]
    for s in ('RIGHT','LEFT'):
        if cross(p[f'{s} SHOULDER'],p[f'{s} ELBOW'],p[f'{s} ARM'])>0.12: out.append(s[0]+'팔꿈치역')
        if cross(p[f'{s} HIP'],p[f'{s} KNEE'],p[f'{s} LEG'])<-0.12: out.append(s[0]+'무릎역')
        sh,e,w=p[f'{s} SHOULDER'],p[f'{s} ELBOW'],p[f'{s} ARM']
        if w[1]<sh[1]+2 and e[0]<sh[0]-3 and 'LIE' not in n: out.append(s[0]+'팔꿈치등뒤')
        for (a,b),nom in NOM.items():
            l=L(p[f'{s} {a}'],p[f'{s} {b}'])
            if not(0.6*nom<=l<=1.4*nom): out.append(f'{s[0]}{b}길이{l/nom:.2f}')
    if abs(p['RIGHT SHOULDER'][0]-p['LEFT SHOULDER'][0])>9 and n!='turn': out.append('어깨벌어짐')
    if n not in NOFLOOR and min(abs(p['RIGHT LEG'][1]-rig.G),abs(p['LEFT LEG'][1]-rig.G))>4: out.append('발뜸')
    return out
if __name__=='__main__':
    nb=0
    for n,(a,_,ps) in rig.CLIPS.items():
        rows=[(i,b) for i,p in enumerate(ps) if (b:=check(n,i,p))]
        if rows: nb+=1; print(n,' '.join(f'{i}:{",".join(b)}' for i,b in rows))
    print('문제 클립',nb,'/',len(rig.CLIPS))
