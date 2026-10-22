# 데드폴 전 동작 생성: animate_with_skeleton_v3, 기준 그림 full/base.png(쟈알디 옆모습 대기를 편집·0.88배 = 같은 그림체).
# 사용: python3 gen.py [이름...] [--resume] [--seed=N]   결과 full/clips/<이름>/NN.png, 기록 spend.log
import sys,os,time,re,json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import pl,rig
sys.path.append(os.path.join(pl.HERE,'../../jyaldi-v5/scripts'))
import importlib.util
_cwd=os.getcwd(); os.chdir(os.path.join(pl.HERE,'../../jyaldi-v5/scripts'))
_s=importlib.util.spec_from_file_location('jrig','rig.py'); jr=importlib.util.module_from_spec(_s); _s.loader.exec_module(jr); os.chdir(_cwd)
OUT=os.path.join(pl.HERE,'../full/clips')
BASE=os.path.join(pl.HERE,'../full/base.png')
# 기준 그림 관절: 쟈알디 base-idle-side(= 쟈알디 STAND(0))를 0.88배로 옮긴 것(base.py 축소와 같은 변환)
_bb=(35,37)   # 쟈알디 옆모습 대기 bbox 왼쪽·위(캔버스)
def _base_pose():
    q=jr.anatomic(jr.STAND(0)); out={}
    for k,(x,y) in q.items():
        cx,cy=x+jr.DX,y+jr.DY
        nx=_bb[0]+2+(cx-_bb[0])*0.88; ny=49+(cy-_bb[1])*0.88
        out[k]=(nx-rig.DX+2.5,ny-rig.DY)
    return out
BASE_POSE=_base_pose()
DESC=('petite young adult woman agent, small slim body, long straight black hair hanging straight down the back to the hips, blunt straight-cut bangs over the forehead, '
      'pale skin with a faint blush, soft round brown eyes, gentle shy expression, very dark warm charcoal suit with no blue, open hip-length jacket, '
      'white shirt, black necktie, black gloves, black shoes, seen strictly from the side in profile facing right, character only, '
      'empty transparent background, no furniture, no visual effects, no muzzle flash, no sparks, no light or glow')
def args_for(n,seed):
    act,prop,ps=rig.CLIPS[n]
    return {'description':DESC+(', '+prop if prop else ''),'action':act[:100],'direction':'east','first_frame_url':pl.b64(BASE),
            'first_frame_keypoints':rig.kp(BASE_POSE),'keypoints':[rig.kp(p) for p in ps],'view':'side','seed':seed}
def fetch(n,j):
    # Preserve delivered originals; each paid job is recovered into its own folder.
    nf=len(rig.CLIPS[n][2]); d=f'{OUT}/../../resume/candidates/{n}/{j}'; os.makedirs(d,exist_ok=True)
    for i in range(nf):
        path=f'{d}/{i:02d}.png'
        if os.path.exists(path): continue
        result=pl.poll(j,path,index=i,tries=5)
        if result!='ok': raise RuntimeError(f'{n} {j} frame {i}: {result}; 원본 유지, 재생성 금지')
if __name__=='__main__':
    # The old generator encodes baked-in weapons and does not preserve requests/usage.
    # Keep importable helpers for comparison, but do not use it for new paid work.
    raise SystemExit('구 생성기 제출 중지: resume/README.md의 빈손·요청 해시·계정 큐 절차를 따르세요.')
    seed=11; MAXJ=1
    for a in sys.argv[1:]:
        if a.startswith('--seed='): seed=int(a[7:])
    names=[a for a in sys.argv[1:] if not a.startswith('--')] or list(rig.CLIPS)
    b0=pl.bal(); pl.log('gen before '+b0); print('before',b0,flush=True)
    pend={}
    if '--resume' in sys.argv:
        last={}
        for ln in open(pl.LOG):
            if 'gen RESET' in ln: last={}   # 기준 그림을 바꾼 뒤엔 그 전 작업을 이어받지 않음
            if 'gen DROP ' in ln: last.pop(ln.split('gen DROP ')[1].split()[0],None)   # 검수에서 버린 클립은 새로 생성
            m=re.search(r'gen (\S+) \d+f -> ([0-9a-f-]{36})',ln)
            if m: last[m.group(1)]=m.group(2)
        for n in list(names):
            if n in last and not os.path.exists(f'{OUT}/{n}/00.png'): pend[n]=last[n]; names.remove(n)
            elif os.path.exists(f'{OUT}/{n}/00.png'): names.remove(n)
    queue=list(names); spent=0
    while queue or pend:
        while queue and len(pend)<MAXJ:   # 칸이 없으면(rate limit) 기다리지 말고 끝난 작업부터 받음
            n=queue[0]; j,t=pl.submit('animate_with_skeleton_v3',args_for(n,seed),tries=1)
            if t.startswith('RATE') or t.startswith('EXC'): break
            queue.pop(0); pl.log(f'gen {n} {len(rig.CLIPS[n][2])}f -> {j} {t[:80]}')
            if j: pend[n]=j; print('sub',n,flush=True)
            else: print('SUBFAIL',n,t[:300],flush=True); pl.log(f'gen SUBFAIL {n} {t[:200]}')
        time.sleep(12)
        for n,j in list(pend.items()):
            try: txt=pl.mcp.text(pl.mcp.tool('get_image',{'job_id':j}))
            except Exception: continue
            lo=txt.lower()
            if 'complet' in lo:
                fetch(n,j); del pend[n]; print('done',n,flush=True); pl.log(f'gen {n} done')
            elif 'fail' in lo:
                del pend[n]; print('FAIL',n,txt[:200],flush=True); pl.log(f'gen {n} FAIL {txt[:200]}')
    b1=pl.bal(); pl.log('gen after '+b1); print('after',b1,flush=True)
