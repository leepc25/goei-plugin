# 뼈대 자동 검사: 옆모습(어깨 벌어짐), 발 바닥선, 팔꿈치 등 뒤, 뼈 길이, 쟈알디 같은 이름 클립과 너무 비슷한지(복사 검사)
import sys,os,math
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import rig
sys.path.insert(0,os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../jyaldi-v5/scripts'))
import importlib.util
spec=importlib.util.spec_from_file_location('jrig',os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../jyaldi-v5/scripts/rig.py'))
cwd=os.getcwd(); os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../jyaldi-v5/scripts'))
jr=importlib.util.module_from_spec(spec); spec.loader.exec_module(jr); os.chdir(cwd)
def norm(p):
    # 목 기준, 키로 나눠 크기 차이 없앰
    n=p['NECK']; hip=((p['RIGHT HIP'][0]+p['LEFT HIP'][0])/2,(p['RIGHT HIP'][1]+p['LEFT HIP'][1])/2)
    L=math.hypot(n[0]-hip[0],n[1]-hip[1]) or 1
    return {k:((v[0]-n[0])/L,(v[1]-n[1])/L) for k,v in p.items()}
def dist(a,b): return sum(math.hypot(a[k][0]-b[k][0],a[k][1]-b[k][1]) for k in rig.J)/len(rig.J)
issues=0
for n,(act,_,ps) in rig.CLIPS.items():
    msg=[]
    for i,p in enumerate(ps):
        sp=abs(p['RIGHT SHOULDER'][0]-p['LEFT SHOULDER'][0])
        if sp>9 and n!='turn': msg.append(f'{i}:어깨벌어짐{sp:.0f}')
        for s in ('RIGHT','LEFT'):
            e=p[f'{s} ELBOW']; sh=p[f'{s} SHOULDER']; w=p[f'{s} ARM']
            if w[0]>sh[0]+4 and e[0]<sh[0]-7 and w[1]<sh[1]+20: msg.append(f'{i}:{s[0]}팔꿈치등뒤')
            ua=math.hypot(e[0]-sh[0],e[1]-sh[1]); fa=math.hypot(w[0]-e[0],w[1]-e[1])
            if ua>rig.UARM*1.25 or fa>rig.FARM*1.35: msg.append(f'{i}:{s[0]}팔길이{ua:.0f}/{fa:.0f}')
    if n in jr.CLIPS:
        jp=jr.CLIPS[n][2]
        m=min(len(ps),len(jp)); d=sum(dist(norm(ps[i]),norm(jp[i])) for i in range(m))/m
        if d<0.12: msg.append(f'쟈알디와비슷{d:.2f}')
    if msg: issues+=1; print(n,' '.join(dict.fromkeys(msg)))
print('issues',issues,'/',len(rig.CLIPS))
