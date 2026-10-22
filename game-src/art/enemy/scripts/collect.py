# 새 생성 없이, 이미 낸 작업만 받아 오기 (2026-10-22 사용자: 요원 7명 먼저, 잡몹은 마지막)
import sys,os,time,re
sys.path.insert(0,os.path.dirname(__file__)); import mcp, mobs_h, genh, anim
from base import known, poll, ROOT
from defs import M
# 기준 그림
jobs={}
for (k,s),j in known().items():
    out=f'{ROOT}/cand/{k}/{s}.png' if k in M else None
    if out and not os.path.exists(out): jobs[out]=j
print('base pending',len(jobs),flush=True)
# 클립 작업
pend=[]
done={re.search(r'\] done|\w+ done',l) and l for l in open(f'{ROOT}/spend.log')}
for l in open(f'{ROOT}/spend.log'):
    m=re.search(r' genh (\w+) \[([^\]]+)\] \d+f seed\d+ -> id: ([0-9a-f-]{36})',l)
    if m and not os.path.exists(f'{ROOT}/{m.group(1)}/clips/{m.group(2).split(",")[0]}/00.png'): pend.append(('h',m.group(1),m.group(2).split(','),m.group(3)))
    m=re.search(r' anim (\w+) (\w+) \d+f -> id: ([0-9a-f-]{36})',l)
    if m and not os.path.exists(f'{ROOT}/{m.group(1)}/raw/{m.group(2)}/01.png'): pend.append(('a',m.group(1),m.group(2),m.group(3)))
print('clip pending',[(p[1],p[2]) for p in pend],flush=True)
MOB={}
for i in range(120):
    if jobs: 
        from base import poll_once; poll_once(jobs)
    for p in list(pend):
        try: t=mcp.text(mcp.tool('get_image',{'job_id':p[3]})).lower()
        except Exception: continue
        if 'complet' in t:
            if p[0]=='h':
                m=MOB.get(p[1]) or mobs_h.BUILD[p[1]]().final(); MOB[p[1]]=m
                if all(n in m.CLIPS for n in p[2]): genh.fetch(m,p[2],p[3])
            else:
                r=[x for x in anim.J if x[0]==p[1] and x[1]==p[2]][0]; anim.fetch(p[1],p[2],p[3],r[3],r[4])
            pend.remove(p); print('got',p[1],p[2],flush=True)
        elif 'fail' in t: pend.remove(p); print('failed',p[1],p[2],flush=True)
    if not jobs and not pend: break
    time.sleep(15)
print('left',len(jobs),len(pend)); print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
