# 에일린 클립 생성(animate_with_skeleton_v3). 기준 그림은 클립마다 erig.CLIPS[이름][2] = H(본부)·F(현장 멘 총)·R(현장 든 총).
# 사용: python3 gen.py [--boot] [--resume] 이름...   결과 ../clips/<이름>/NN.png
#  --boot: 옆모습 기준 장이 아직 없을 때. 쟈알디 A2를 에일린으로 바꾼 그림(H-pad·F-pad, 자세 = 쟈알디 A 뼈대)에서 뽑음
import sys,os,time,json,shutil,hashlib
from pathlib import Path
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from common import *
import erig,rig
OUT=os.path.join(HERE,'../clips'); BASE=os.path.join(HERE,'../base')
DESC=('short compact adult woman agent, faded cream platinum blonde hair in a high ponytail with a black hair tie, blunt bangs, '
      'long side locks, dull grey-blue eyes, expressionless, black suit with a hip-length jacket and blue-grey highlights, '
      'white shirt, black necktie, bare hands, black shoes, pistol holster on the hip')
VEST=', dark olive bulletproof plate carrier vest worn over the suit jacket'
TAILD=(', seen strictly from the side in profile facing right, character only, empty transparent background, '
       'no furniture, no visual effects, no muzzle flash, no light or glow')
def ref(base,boot):
    if boot:
        return b64url(f'{BASE}/{"H" if base=="H" else "F"}-pad.png'),rig.kp(rig.A_KP)
    meta=json.loads(Path(f'{BASE}/side.json').read_text())[base]
    return b64url(f'{BASE}/{base}-side.png'),meta['kp']
def submit(n,boot=False,seed=11):
    if boot: raise ValueError('다른 캐릭터 기반 boot 생성은 재개 작업에서 금지합니다')
    act,prop,base,ps=erig.CLIPS[n]
    url,fkp=ref(base,boot)
    d=DESC+(VEST if base in 'FRPQB' else '')+(', '+prop if prop else '')+TAILD
    args={'description':d,'action':act,'direction':'east','first_frame_url':url,'first_frame_keypoints':fkp,
          'keypoints':[rig.kp(p) for p in ps],'seed':seed,'view':'side'}
    if len(act)>100 or not 3<=len(ps)<=15:
        raise ValueError('생성 전 규격 검사 실패: action<=100, 3~15장')
    estimate=2 if len(ps)==3 else 4 if len(ps)==15 else 3
    print(f'호출 전 견적: {n} {len(ps)}장, {estimate}회 차감 예상(실제 비용은 응답 확인)',flush=True)
    # 유료 호출 전 요청과 입력 해시를 보존. 응답 유실도 자동 재제출하지 않는다.
    request_bytes=json.dumps(args,sort_keys=True,separators=(',',':')).encode()
    request_hash=hashlib.sha256(request_bytes).hexdigest()
    journal=Path(HERE)/'../resume/submissions'/request_hash
    journal.mkdir(parents=True,exist_ok=False)
    (journal/'request.json').write_bytes(request_bytes)
    record={'clip':n,'request_sha256':request_hash,'state':'submitting',
            'input_sha256':hashlib.sha256(base64.b64decode(url.split(',',1)[1])).hexdigest(),
            'job_id':None,'estimated_generations':estimate,'actual_cost':None,'actual_cost_status':'unverified'}
    def save(): (journal/'record.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
    save()
    try:
        response=mcp.tool('animate_with_skeleton_v3',args)
        (journal/'response.json').write_text(json.dumps(response,ensure_ascii=False,indent=2)+'\n')
        t=mcp.text(mcp.checked(response))
        record.update(job_id=jobid(t),state='submitted' if jobid(t) else 'response_requires_review')
        save()
    except Exception as e:
        record.update(state='submission_requires_review',error_type=type(e).__name__); save()
        raise
    log('gen',f'{n} {len(ps)}f base={base}{"(boot)" if boot else ""} -> {t[:160]}')
    return jobid(t),t
def fetch(n,j):
    nf=len(erig.CLIPS[n][3]); d=f'{OUT}/{n}'; tmp=d+'.new-'+j; os.makedirs(tmp,exist_ok=True)
    for i in range(nf):
        r=None
        for k in range(6):
            try: r=mcp.tool('get_image',{'job_id':j,'index':i}); break
            except Exception: time.sleep(5)
        im=[x for x in r['result']['content'] if x.get('type')=='image'] if r else []
        if im: Path(f'{tmp}/{i:02d}.png').write_bytes(base64.b64decode(im[0]['data']))
    # 일부 장 회수 실패 때 기존 원본을 지우거나 불완전 폴더를 완료로 승격하지 않는다.
    from PIL import Image
    files=list(Path(tmp).glob('*.png'))
    if {p.name for p in files}!={f'{i:02d}.png' for i in range(nf)}:
        raise RuntimeError('회수 장 수/번호 불일치: 원본 보존, 재제출 금지')
    for p in files:
        with Image.open(p) as im:
            im.verify()
        with Image.open(p) as im:
            if im.size!=(192,144): raise RuntimeError('회수 규격 불일치')
    if os.path.exists(d): raise RuntimeError('기존 원본 덮어쓰기 금지: 후보 폴더에서 검수 필요')
    os.rename(tmp,d)
if __name__=='__main__':
    args=sys.argv[1:]; boot='--boot' in args; resume='--resume' in args
    names=[a for a in args if not a.startswith('--')]
    if len(names)!=1: raise SystemExit('에일린은 한 번에 한 클립만 제출/회수합니다')
    if not resume and os.path.isdir(f'{OUT}/{names[0]}'):
        raise SystemExit('이미 납품된 클립입니다. 중복 생성 금지. 수정 후보는 별도 요청으로 설계하세요')
    # 같은 저장소의 독립 worktree끼리도 1건만 실행. 별도 머신의 큐는 총괄과 조율.
    import fcntl,subprocess
    common_dir=subprocess.check_output(['git','rev-parse','--path-format=absolute','--git-common-dir'],text=True).strip()
    lock=open(Path(common_dir)/'eileen-production.lock','a')
    fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    if not resume:
        for p in (Path(HERE)/'../resume/submissions').glob('*/record.json'):
            if json.loads(p.read_text()).get('state')!='recovered':
                raise SystemExit('이전 제출의 회수/실패 확인이 필요합니다. 자동 재제출하지 않습니다')
    b0=bal(); print('before',b0,flush=True); log('gen','before '+b0)
    jobs=mcp.checked(mcp.tool('list_jobs',{}))
    log('queue',mcp.text(jobs))
    if not resume:
        # 계정에 다른 작업이 있으면 자동으로 빈 슬롯을 가정하지 않는다.
        job_text=mcp.text(jobs)
        if not re.search(r'no (?:active |background )?jobs|0 active jobs',job_text,re.I):
            raise SystemExit('계정 큐가 비어 있음을 확인하지 못했습니다. 총괄 큐와 응답을 대조하세요')
    pend={}; last={}
    if resume:
        for ln in open(os.path.join(HERE,'../spend.log')):
            m=re.search(r' gen (\S+) \d+f base=\S+ -> id: ([0-9a-f-]{36})',ln)
            if m: last[m.group(1)]=m.group(2)
    queue=[]
    for n in names:
        if resume and n in last and not os.path.isdir(f'{OUT}/{n}'): pend[n]=last[n]
        elif resume and os.path.isdir(f'{OUT}/{n}'): continue
        elif resume: raise SystemExit('회수할 작업 ID가 없습니다. --resume에서는 신규 제출하지 않습니다')
        else: queue.append(n)
    MAXP=1   # 사용자 최신 지시: 담당별 제출 중 1건
    while queue or pend:
        while queue and len(pend)<MAXP:
            n=queue.pop(0); j,t=submit(n,boot)
            if j: pend[n]=j; print('sub',n,flush=True)
            else: raise RuntimeError('작업 ID 미확인: 재제출 금지. 저장 응답과 계정 큐 확인')
        time.sleep(12)
        for n,j in list(pend.items()):
            try: txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
            except Exception: continue
            lo=txt.lower()
            if 'complet' in lo:
                fetch(n,j); del pend[n]; print('done',n,flush=True); log('gen',f'{n} done')
                for p in (Path(HERE)/'../resume/submissions').glob('*/record.json'):
                    record=json.loads(p.read_text())
                    if record.get('job_id')==j:
                        record['state']='recovered'; p.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
            elif 'fail' in lo:
                del pend[n]; print('FAIL',n,txt[:300],flush=True); log('gen',f'{n} FAIL {txt[:200]}')
    b1=bal(); print('after',b1,flush=True); log('gen','after '+b1)
