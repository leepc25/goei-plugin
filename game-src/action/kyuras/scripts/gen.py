# 큐라스 전 클립 생성: animate_with_skeleton_v3, 기준 그림 base/A.png(쟈알디 idle/00 편집 + 톤 맞춤), 첫 장 관절 = 쟈알디 STAND(0).
# 사용: python3 gen.py [이름...] [--resume] [--seed N]   결과 clips/<이름>/NN.png, 차감 기록 spend.log
import sys,time,base64,re,os,json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
sys.path.insert(0,HERE); import mcp,krig
REF='data:image/png;base64,'+base64.b64encode(open(os.path.join(ROOT,'base','A.png'),'rb').read()).decode()
REF_KP=krig.kp(krig.BASE_KP)
DESC=('thin adult man in his early thirties, gaunt face with hollow cheeks, short grey-green hair swept back with one loose strand over the forehead, '
      'green eye, friendly smile, black suit with a hip-length jacket, white shirt, black necktie, black trousers, black shoes, bare hands with long fingers, '
      'seen strictly from the side in profile facing right, character only, no background, no furniture, no visual effects, no explosions, no sparks, no fire, no smoke, no light or glow')
OUT=os.path.join(ROOT,'clips'); LOG=os.path.join(ROOT,'spend.log')
def log(s): open(LOG,'a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' gen '+s+'\n')
def bal():
    t=mcp.text(mcp.tool('get_balance',{})); m=re.search(r'generations_remaining: (\d+)',t); return m.group(1) if m else t[:80]
def submit(n,seed):
    act,prop,ps=krig.CLIPS[n]
    d=DESC+(', '+prop if prop else ', empty hands')
    args={'description':d,'action':act[:100],'direction':'east','first_frame_url':REF,'first_frame_keypoints':REF_KP,
          'keypoints':[krig.kp(p) for p in ps],'seed':seed}
    t=''
    for k in range(80):
        try: t=mcp.text(mcp.tool('animate_with_skeleton_v3',args))
        except Exception as e: t='EXC '+str(e); time.sleep(6); continue
        if 'rate limit' in t.lower() or 'concurren' in t.lower() or 'too many' in t.lower(): time.sleep(30); continue
        break
    log(f'{n} {len(ps)}f seed{seed} -> {t[:160]}')
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t) or re.search(r'id: ([0-9a-f-]{36})',t)
    return (m.group(1) if m else None),t
def fetch(n,j):
    nf=len(krig.CLIPS[n][2]); os.makedirs(f'{OUT}/{n}',exist_ok=True); got=0
    for i in range(nf):
        r=None
        for k in range(6):
            try: r=mcp.tool('get_image',{'job_id':j,'index':i}); break
            except Exception: time.sleep(5)
        im=[x for x in (r or {}).get('result',{}).get('content',[]) if x.get('type')=='image']
        if im: open(f'{OUT}/{n}/{i:02d}.png','wb').write(base64.b64decode(im[0]['data'])); got+=1
    return got
if __name__=='__main__':
    args=sys.argv[1:]; seed=11
    if '--seed' in args: i=args.index('--seed'); seed=int(args[i+1]); del args[i:i+2]
    resume='--resume' in args; names=[a for a in args if not a.startswith('--')] or list(krig.CLIPS)
    b0=bal(); print('before',b0,flush=True); log('before '+b0)
    last={}
    if resume and os.path.exists(LOG):
        for ln in open(LOG):
            m=re.search(r' gen (\S+) \d+f seed\d+ -> .*?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',ln)
            if m: last[m.group(1)]=m.group(2)
    pend={}; queue=[]
    for n in names:
        if resume and n in last and not os.path.exists(f'{OUT}/{n}/00.png'): pend[n]=last[n]
        elif resume and os.path.exists(f'{OUT}/{n}/00.png'): continue
        else: queue.append(n)
    MAXP=2   # 요원 스레드당 동시 작업 2칸(사용자 확정 2026-10-22 03:12)
    while queue or pend:
        while queue and len(pend)<MAXP:
            n=queue.pop(0); j,t=submit(n,seed)
            if j: pend[n]=j; print('sub',n,flush=True)
            else: print('SUBFAIL',n,t[:300],flush=True)
        time.sleep(12)
        for n,j in list(pend.items()):
            try: txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
            except Exception: continue
            lo=txt.lower()
            if 'complet' in lo:
                g=fetch(n,j); del pend[n]; print('done',n,g,flush=True); log(f'{n} done {g}')
            elif 'fail' in lo or 'error' in lo and 'processing' not in lo:
                del pend[n]; print('FAIL',n,txt[:300],flush=True); log(f'{n} FAIL {txt[:200]}')
    b1=bal(); print('after',b1,flush=True); log(f'after {b1}')
