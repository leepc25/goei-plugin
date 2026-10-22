# 끊긴 작업 받기: spend.log에서 넣은 작업 중 done 기록이 없는 것을 get_image로 받아 둠(돈은 이미 나감).
import re,os,importlib,pl,mcp
lines=open('../spend.log').read().split('\n')
sub={}; done=set()
for ln in lines:
    m=re.search(r' (\w+)/(\w+) (\d+)f seed\d+ animate_with_skeleton_v3 -> id: ([0-9a-f-]{36})',ln)
    if m: sub[(m.group(1),m.group(2))]=(int(m.group(3)),m.group(4))
    m=re.search(r' (\w+)/(\w+) (done|FAIL)',ln)
    if m: done.add((m.group(1),m.group(2)))
for (b,n),(nf,j) in sub.items():
    if (b,n) in done: continue
    out=f'../{b}/clips/{n}'
    if os.path.exists(f'{out}/{nf-1:02d}.png'): continue
    ok=pl.wait(j,out,nf,tries=4,step=2); print(b,n,ok,flush=True)
    if ok: pl.log(f'{b}/{n} done (recovered)')
