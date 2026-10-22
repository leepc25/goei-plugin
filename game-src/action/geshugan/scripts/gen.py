# grig.py 클립을 animate_with_skeleton_v3로 생성. 기준 그림 base/G0.png(192×144, 발 y=136), 첫 장 관절 = 쟈알디 STAND(0)(기준 그림이 그 장을 고친 것).
# 사용: python3 gen.py [이름...] [--fresh] [--seed=N] [--par=N]. 결과 ../clips/<이름>/NN.png, 기록 ../spend.log
import sys,time,base64,re,json,os
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
import mcp,grig as R
J=R.J; ROOT=os.path.join(HERE,'..')
REF='data:image/png;base64,'+base64.b64encode(open(f'{ROOT}/base/G0.png','rb').read()).decode()
DESC=('athletic adult woman agent, snow-white chin-length bob haircut with bangs, pale icy blue eyes, blank expression, '
      'loose white button shirt with sleeves rolled up, loose black necktie, high-waisted black slacks with blue-grey highlights, bare hands, black flat shoes')
OUT=f'{ROOT}/clips'
def log(s): open(f'{ROOT}/spend.log','a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' gen '+s+'\n')
def bal(): return mcp.text(mcp.tool('get_balance',{})).split('\n')[1]
SEED=int(([a for a in sys.argv if a.startswith('--seed=')] or ['--seed=21'])[0][7:])
PAR=int(([a for a in sys.argv if a.startswith('--par=')] or ['--par=6'])[0][6:])
def short(a):
    """action은 100자 이름표(스키마). 넘으면 마지막 쉼표·콜론에서 자름."""
    if len(a)<=100: return a
    c=a[:100]; k=max(c.rfind(','),c.rfind(':')); return c[:k] if k>40 else c
def submit(n):
    act,_,ps=R.CLIPS[n]
    args={'description':DESC,'action':short(act),'direction':'east','first_frame_url':REF,'first_frame_keypoints':J.kp(J.anatomic(R.BASE)),
          'keypoints':[J.kp(p) for p in ps],'seed':SEED}
    t='?'
    for k in range(40):   # 계정 동시 작업 20개 한도(다른 스레드와 공유) → 자리 날 때까지 기다림
        try:
            t=mcp.text(mcp.tool('animate_with_skeleton_v3',args))
            if re.search(r'job_id',t): break
        except Exception as e: t='EXC '+str(e)
        time.sleep(20 if 'rate limit' in t else 10*(k%6+1))
    log(f'{n} {len(ps)}f seed{SEED} -> {t[:160]}')
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); return m.group(1) if m else None,t
def fetch(n,j):
    nf=len(R.CLIPS[n][2]); d=f'{OUT}/{n}'; os.makedirs(d,exist_ok=True)
    for i in range(nf):
        for k in range(6):
            try:
                r=mcp.tool('get_image',{'job_id':j,'index':i}); im=[x for x in r['result']['content'] if x.get('type')=='image']
                if im: open(f'{d}/{i:02d}.png','wb').write(base64.b64decode(im[0]['data'])); break
            except Exception: pass
            time.sleep(5)
if __name__=='__main__':
    names=[a for a in sys.argv[1:] if not a.startswith('--')] or list(R.CLIPS)
    print('before',bal(),flush=True); log('before '+bal())
    last={}
    if '--fresh' not in sys.argv:
        for ln in open(f'{ROOT}/spend.log'):
            m=re.search(r' gen (\S+) \d+f seed\d+ -> id: ([0-9a-f-]{36})',ln)
            if m: last[m.group(1)]=m.group(2)
            m=re.search(r' gen (\S+) done',ln)
            if m: last.pop(m.group(1),None); last[m.group(1)+'#done']=1
            m=re.search(r' gen (\S+) (rejected|FAIL)',ln)
            if m: last.pop(m.group(1),None); last.pop(m.group(1)+'#done',None)
    queue=[]; pend={}
    for n in names:
        if '--fresh' not in sys.argv and last.get(n+'#done'): continue
        if n in last: pend[n]=last[n]; print('resume',n,flush=True)
        else: queue.append(n)
    while queue or pend:
        while queue and len(pend)<PAR:
            n=queue.pop(0); j,t=submit(n)
            if j: pend[n]=j; print('sub',n,flush=True)
            else: print('SUBFAIL',n,t[:300],flush=True)
        time.sleep(15)
        for n,j in list(pend.items()):
            try: txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
            except Exception: continue
            lo=txt.lower()
            if 'complet' in lo: fetch(n,j); del pend[n]; print('done',n,flush=True); log(f'{n} done')
            elif 'fail' in lo: del pend[n]; print('FAIL',n,txt[:300],flush=True); log(f'{n} FAIL {txt[:200]}')
    print('after',bal(),flush=True); log('after '+bal())
