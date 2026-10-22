# 고르고디오 클립 생성: animate_with_skeleton_v3. 기준 그림 = 옆모습 기준판(full/ref.png, 뼈대 rig.REF_POSE).
# 사용: python3 gen.py [이름...] [--armor] [--fresh] [--seed=N]   /  python3 gen.py --pbase (base.png → 옆모습 기준판 3장)
import sys,time,base64,re,json,os
sys.path.insert(0,'.'); import mcp
ARM='--armor' in sys.argv
if ARM: import rig_armor as R
else: import rig as R
B=R.B
OUT='../full/clips' if not ARM else '../armor/clips'
def b64(p): return 'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode()
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' gen '+s+'\n')
def bal(): return mcp.text(mcp.tool('get_balance',{})).split('\n')[1]
SEED=int(([a.split('=')[1] for a in sys.argv if a.startswith('--seed=')] or ['11'])[0])
def submit(n,act,prop,ps,ref,refkp,seed=SEED):
    d=R.DESC+(', '+prop if prop else '')
    args={'description':d,'action':act[:100],'direction':'east','first_frame_url':ref,'first_frame_keypoints':B.kp(refkp),
          'keypoints':[B.kp(p) for p in ps],'seed':seed}
    for k in range(30):
        try: t=mcp.text(mcp.tool('animate_with_skeleton_v3',args))
        except Exception as e: t='EXC '+str(e)
        if 'rate limit' in t or t.startswith('EXC'): time.sleep(20); continue
        break
    log(f'{n} {len(ps)}f seed{seed} -> {t[:160]}')
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); return m.group(1) if m else None,t
def fetch(n,j,nf):
    os.makedirs(f'{OUT}/{n}',exist_ok=True)
    for i in range(nf):
        for k in range(6):
            try: r=mcp.tool('get_image',{'job_id':j,'index':i}); break
            except Exception: time.sleep(5)
        im=[x for x in r['result']['content'] if x.get('type')=='image']
        if im: open(f'{OUT}/{n}/{i:02d}.png','wb').write(base64.b64decode(im[0]['data']))
def run(items,par=16):
    pend={}; queue=list(items)
    while queue or pend:
        while queue and len(pend)<par:
            n,act,prop,ps,ref,refkp=queue.pop(0); j,t=submit(n,act,prop,ps,ref,refkp)
            if j: pend[n]=(j,len(ps)); print('sub',n,flush=True)
            else: print('SUBFAIL',n,t[:300],flush=True)
        time.sleep(15)
        for n,(j,nf) in list(pend.items()):
            try: txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
            except Exception: continue
            lo=txt.lower()
            if 'complet' in lo: fetch(n,j,nf); del pend[n]; print('done',n,flush=True); log(f'{n} done')
            elif 'fail' in lo: del pend[n]; print('FAIL',n,txt[:300],flush=True); log(f'{n} FAIL {txt[:200]}')
if __name__=='__main__':
    print('before',bal(),flush=True)
    if '--pbase' in sys.argv:
        run([('pbase','standing still, then a low fighting stance','',R.PBASE,b64('../full/base.png' if not ARM else '../armor/base.png'),R.BASE_KP)])
    else:
        names=[a for a in sys.argv[1:] if not a.startswith('--')] or list(B.CLIPS)
        ref=b64(R.REF_PNG)
        run([(n,*B.CLIPS[n],ref,R.REF_POSE) for n in names])
    print('after',bal(),flush=True)
