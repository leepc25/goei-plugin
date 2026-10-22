# 고르고디오 클립 생성: animate_with_skeleton_v3. 기준 그림 = 옆모습 기준판(full/ref.png, 뼈대 rig.REF_POSE).
# 사용: python3 gen.py [이름...] [--armor] [--fresh] [--seed=N]   /  python3 gen.py --pbase (base.png → 옆모습 기준판 3장)
import sys,time,base64,re,json,os
from pathlib import Path
from submission_guard import submit_once, recovered
from PIL import Image
import io, fcntl, hashlib
RECORDS=Path(__file__).resolve().parents[1]/'resume'/'submissions'
sys.path.insert(0,'.'); import mcp
ARM='--armor' in sys.argv
if ARM: import rig_armor as R
else: import rig as R
B=R.B
OUT='../full/clips' if not ARM else '../armor/clips'
def b64(p): return 'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode()
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' gen '+s+'\n')
def bal(): return mcp.text(mcp.tool('get_balance',{}))
SEED=int(([a.split('=')[1] for a in sys.argv if a.startswith('--seed=')] or ['11'])[0])
def submit(n,act,prop,ps,ref,refkp,seed=SEED):
    d=R.DESC+(', '+prop if prop else '')
    args={'description':d,'action':act[:100],'direction':'east','first_frame_url':ref,'first_frame_keypoints':B.kp(refkp),
          'keypoints':[B.kp(p) for p in ps],'seed':seed}
    j,t=submit_once(lambda name,arguments:mcp.call('tools/call',{'name':name,'arguments':arguments}),args,RECORDS,n)
    log(f'{n} {len(ps)}f seed{seed} -> {t[:160]}')
    return j,t
def fetch(n,j,nf):
    target=RECORDS.parent/'results'/j
    target.mkdir(parents=True,exist_ok=True)
    frames=[]
    for i in range(nf):
        r=mcp.tool('get_image',{'job_id':j,'index':i})
        im=[x for x in r['result']['content'] if x.get('type')=='image']
        if len(im)!=1: raise RuntimeError('회수 프레임 없음: 생성 완료로 처리하지 않습니다')
        data=base64.b64decode(im[0]['data'],validate=True)
        with Image.open(io.BytesIO(data)) as png:
            png.load()
            if png.size!=(B.W,B.H): raise RuntimeError('회수 프레임 크기 불일치')
        path=target/f'{i:02d}.png'
        if path.exists() and path.read_bytes()!=data: raise RuntimeError('기존 회수 원본 불일치: 덮어쓰기 금지')
        path.write_bytes(data)
        frames.append({'index':i,'file':path.name,'sha256':hashlib.sha256(data).hexdigest()})
    (target/'manifest.json').write_text(json.dumps({'clip':n,'job_id':j,'frames':frames,
        'actual_cost':None,'user_visual_approval':False,'status':'recovered_pending_review'},indent=2)+'\n')
    recovered(RECORDS,j)
PAR=int(([a.split('=')[1] for a in sys.argv if a.startswith('--par=')] or ['1'])[0])
if PAR != 1: raise ValueError('몸·갑옷을 합쳐 제출 중 작업은 1건만 허용합니다')
def pending_from_log():
    """spend.log에서 제출됐지만 받지 않은 작업 {이름: (job, 장 수)}"""
    sub={}; done=set()
    for l in open('../spend.log'):
        m=re.match(r'\S+ gen (\S+) (\d+)f seed\d+ -> id: ([0-9a-f-]{36})',l)
        if m: sub[m.group(1)]=(m.group(3),int(m.group(2)))
        m=re.match(r'\S+ gen (\S+) (done|FAIL)',l)
        if m: done.add(m.group(1))
    return {k:v for k,v in sub.items() if k not in done}
def run(items,par=None,pend=None):
    par=par or PAR; pend=dict(pend or {}); queue=list(items)
    if par != 1 or len(queue)+len(pend)>1: raise ValueError('몸·갑옷 합계 한 건씩만 실행합니다')
    deadline=time.monotonic()+600
    while queue or pend:
        if time.monotonic()>deadline: raise TimeoutError('10분 조회 한도: 기록된 ID를 보존하고 새 생성 없이 조사합니다')
        while queue and len(pend)<par:
            n,act,prop,ps,ref,refkp=queue.pop(0); j,t=submit(n,act,prop,ps,ref,refkp)
            if j: pend[n]=(j,len(ps)); print('sub',n,flush=True)
            else: print('SUBFAIL',n,t[:300],flush=True)
        time.sleep(15)
        for n,(j,nf) in list(pend.items()):
            txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
            lo=txt.lower()
            if 'complet' in lo: fetch(n,j,nf); del pend[n]; print('done',n,flush=True); log(f'{n} done')
            elif 'fail' in lo: del pend[n]; print('FAIL',n,txt[:300],flush=True); log(f'{n} FAIL {txt[:200]}')
if __name__=='__main__':
    os.chdir(Path(__file__).resolve().parent)
    if '--resume' in sys.argv:
        raise SystemExit('기존 --resume은 새 생성으로 넘어갈 수 있어 차단했습니다. 제출 기록의 ID로 조회·회수하세요.')
    names=[a for a in sys.argv[1:] if not a.startswith('--')]
    if '--pbase' in sys.argv or len(names)!=1 or names[0] not in B.CLIPS:
        raise SystemExit('검수·비용 고지한 클립 이름 하나를 명시하세요. 일괄/기준표 재생성은 허용하지 않습니다.')
    RECORDS.mkdir(parents=True,exist_ok=True)
    lock=(RECORDS/'active.lock').open('w')
    fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    # Free reads must succeed before any paid call; never rely on old balances.
    print('before',bal(),flush=True)
    print('account jobs',mcp.text(mcp.tool('list_jobs',{})),flush=True)
    n=names[0]; nf=len(B.CLIPS[n][2]); estimate=2 if nf==3 else 4 if nf==15 else 3
    print(f'견적: {n} {nf}장, {estimate}회. 실제 비용은 서버 증빙으로 별도 기록.',flush=True)
    ref=b64(R.REF_PNG)
    run([(n,*B.CLIPS[n],ref,R.REF_POSE)])
    print('after',bal(),flush=True)
