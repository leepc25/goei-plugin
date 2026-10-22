# grig.py 클립을 animate_with_skeleton_v3로 생성. 기준 그림 base/G0.png(192×144, 발 y=136), 첫 장 관절 = 쟈알디 STAND(0)(기준 그림이 그 장을 고친 것).
# 사용: python3 gen.py [이름...] [--fresh] [--seed=N] [--par=N]. 결과 ../clips/<이름>/NN.png, 기록 ../spend.log
import sys,time,base64,re,json,os,hashlib,uuid
import fcntl
from pathlib import Path
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
import mcp,grig as R
J=R.J; ROOT=os.path.join(HERE,'..')
REF='data:image/png;base64,'+base64.b64encode(open(f'{ROOT}/base/G0.png','rb').read()).decode()
DESC=('athletic adult woman agent, snow-white chin-length bob haircut with bangs, pale icy blue eyes, blank expression, '
      'loose white button shirt with sleeves rolled up, loose black necktie, high-waisted black slacks with blue-grey highlights, bare hands, black flat shoes')
OUT=f'{ROOT}/clips'
def log(s): open(f'{ROOT}/spend.log','a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' gen '+s+'\n')
def bal():
    response=mcp.tool('get_balance',{})
    if response.get('error') or response.get('result',{}).get('isError'):
        raise RuntimeError('무료 잔액 조회 실패: 인증·계정 확인 전 유료 제출 불가')
    return mcp.text(response)
SEED=int(([a for a in sys.argv if a.startswith('--seed=')] or ['--seed=21'])[0][7:])
PAR=int(([a for a in sys.argv if a.startswith('--par=')] or ['--par=1'])[0][6:])
if PAR != 1:
    raise SystemExit('담당별 제출 중 작업은 1건만 허용합니다. 계정 큐는 총괄 확인이 별도로 필요합니다.')
def short(a):
    """action은 100자 이름표(스키마). 넘으면 마지막 쉼표·콜론에서 자름."""
    if len(a)<=100: return a
    c=a[:100]; k=max(c.rfind(','),c.rfind(':')); return c[:k] if k>40 else c
def submit(n):
    act,_,ps=R.CLIPS[n]
    args={'description':DESC,'action':short(act),'direction':'east','first_frame_url':REF,'first_frame_keypoints':J.kp(J.anatomic(R.BASE)),
          'keypoints':[J.kp(p) for p in ps],'seed':SEED}
    evidence=Path(ROOT)/'resume'/'requests'/str(uuid.uuid4()); evidence.mkdir(parents=True)
    payload=json.dumps(args,ensure_ascii=False,sort_keys=True).encode()
    (evidence/'request.json').write_bytes(payload)
    meta={'clip':n,'state':'submitting','request_sha256':hashlib.sha256(payload).hexdigest(),
          'input_sha256':hashlib.sha256(Path(ROOT,'base','G0.png').read_bytes()).hexdigest(),
          'job_id':None,'actual_cost':None}
    (evidence/'status.json').write_text(json.dumps(meta,indent=2))
    try:
        response=mcp.tool('animate_with_skeleton_v3',args)
        (evidence/'response.json').write_text(json.dumps(response,ensure_ascii=False,indent=2))
        t=mcp.text(response)
    except Exception:
        meta['state']='submission_unknown_do_not_retry'
        (evidence/'status.json').write_text(json.dumps(meta,indent=2))
        raise RuntimeError('제출 응답 불명확. 유료 재제출 금지: 계정 작업 목록과 요청 증거를 대조하세요.') from None
    log(f'{n} {len(ps)}f seed{SEED} -> {t[:160]}')
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t)
    meta.update(job_id=m.group(1) if m else None,state='submitted' if m else 'response_requires_review')
    (evidence/'status.json').write_text(json.dumps(meta,indent=2))
    if not m:
        raise RuntimeError('작업 ID 미확인. 자동 재제출하지 않습니다. 저장한 응답을 조사하세요.')
    return m.group(1),t
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
    names=[a for a in sys.argv[1:] if not a.startswith('--')]
    if len(names)!=1 or names[0] not in R.CLIPS:
        raise SystemExit('현재 승인·계정 큐 확인을 마친 클립 이름 하나를 명시하세요. 일괄 생성은 금지합니다.')
    lock_path=Path(ROOT)/'resume'/'generation.lock'; lock_path.parent.mkdir(exist_ok=True)
    lock_file=lock_path.open('a')
    try: fcntl.flock(lock_file,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError: raise SystemExit('이 작업 공간에서 게슈간 생성이 실행 중입니다.')
    unknown=list((Path(ROOT)/'resume'/'requests').glob('*/status.json'))
    for path in unknown:
        if json.loads(path.read_text()).get('state') in ('submitting','submission_unknown_do_not_retry','response_requires_review'):
            raise SystemExit('이전 제출 미해결: '+str(path)+' — 총괄이 계정 작업 목록과 대조한 뒤 상태를 정리하세요.')
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
