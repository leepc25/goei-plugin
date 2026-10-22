# 기준 그림 후보: 몹마다 pixen 4장(장당 1회). 사용: python3 base.py [kind...] [--props] [--seeds=1,2,3,4]
import sys,time,re,os,base64
sys.path.insert(0,os.path.dirname(__file__)); import mcp
from defs import M,PROPS,STYLE
ROOT=os.path.join(os.path.dirname(__file__),'..')
def log(s): open(f'{ROOT}/spend.log','a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' base '+s+'\n')
def submit(desc,w,h,seed):
    a=dict(description=desc,width=w,height=h,no_background=True,view='side',direction='east',
           outline='single color black outline',detail='medium detail',seed=seed)
    for k in range(300):
        try: t=mcp.text(mcp.tool('create_image_pixen',a))
        except Exception as e: t='EXC '+str(e)
        if 'rate limit' in t.lower() or t.startswith('EXC'): time.sleep(15); continue
        break
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); return (m.group(1) if m else None),t
def known():
    """spend.log에 이미 제출된 작업 (이름 시드 → job id) — 다시 내지 않음"""
    out={}
    for line in open(f'{ROOT}/spend.log'):
        m=re.search(r' base (?:prop )?(\S+) (\d+) -> id: ([0-9a-f-]{36})',line)
        if m: out[(m.group(1),int(m.group(2)))]=m.group(3)
    return out
def poll_once(left):
    for out,j in list(left.items()):
        try: r=mcp.tool('get_image',{'job_id':j})
        except Exception: continue
        imgs=[c for c in r.get('result',{}).get('content',[]) if c.get('type')=='image']
        if imgs: open(out,'wb').write(base64.b64decode(imgs[0]['data'])); del left[out]; print('ok',out,flush=True)
        elif 'fail' in mcp.text(r).lower(): del left[out]; print('FAIL',out,mcp.text(r)[:200],flush=True)
def poll(jobs):
    left=dict(jobs)
    for _ in range(400):
        for out,j in list(left.items()):
            try: r=mcp.tool('get_image',{'job_id':j})
            except Exception: continue
            imgs=[c for c in r.get('result',{}).get('content',[]) if c.get('type')=='image']
            if imgs: open(out,'wb').write(base64.b64decode(imgs[0]['data'])); del left[out]; print('ok',out,flush=True)
            elif 'fail' in mcp.text(r).lower(): del left[out]; print('FAIL',out,mcp.text(r)[:200],flush=True)
        if not left: break
        time.sleep(8)
if __name__=='__main__':
    seeds=[int(x) for x in ([a.split('=')[1] for a in sys.argv if a.startswith('--seeds=')] or ['101,102,103,104'])[0].split(',')]
    names=[a for a in sys.argv[1:] if not a.startswith('--')]
    jobs={}; KN=known()
    if '--props' in sys.argv:
        for k,((w,h),d) in PROPS.items():
            os.makedirs(f'{ROOT}/cand/props',exist_ok=True)
            for s in seeds[:2]:
                out=f'{ROOT}/cand/props/{k.replace("/","__")}-{s}.png'
                if os.path.exists(out): continue
                j,t=submit('Pixel art game item sprite, crisp pixels, single black outline, transparent background. '+d,w,h,s); log(f'prop {k} {s} -> {t[:90]}')
                if j: jobs[out]=j
    else:
        for k in names or list(M):
            d=M[k]; w,h=d['gen']; os.makedirs(f'{ROOT}/cand/{k}',exist_ok=True)
            for s in seeds:
                out=f'{ROOT}/cand/{k}/{s}.png'
                if os.path.exists(out): continue
                if (k,s) in KN: jobs[out]=KN[(k,s)]; continue
                j,t=submit(STYLE+d['desc'],w,h,s); log(f'{k} {s} -> {t[:90]}'); print('sub',k,s,(j or t[:150]),flush=True)
                if j: jobs[out]=j
                poll_once(jobs)
    poll(jobs)
    print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
