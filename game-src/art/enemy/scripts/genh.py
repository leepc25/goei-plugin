# 사람형 잡몹 클립 생성: animate_with_skeleton_v3, 기준 그림 = <kind>/base.png (resident 전투 장은 base_open.png).
# 묶음(Mob.jobs) 하나 = 생성 작업 하나 → 받은 장을 클립별로 나눠 <kind>/clips/<클립>/NN.png 로 저장.
# 사용: python3 genh.py <kind...> [--only=clip,clip] [--seed=N]
import sys,time,base64,re,os,json
sys.path.insert(0,os.path.dirname(__file__)); import mcp, mobs_h
from mobrig import ROOT,flipv
from PIL import Image
SEED=int(([a.split('=')[1] for a in sys.argv if a.startswith('--seed=')] or ['21'])[0])
ONLY=([a.split('=')[1].split(',') for a in sys.argv if a.startswith('--only=')] or [None])[0]
def b64(p): return 'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode()
def log(s): open(f'{ROOT}/spend.log','a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' genh '+s+'\n')
def clean(im):
    im=im.convert('RGBA'); px=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=px[x,y]; px[x,y]=(r,g,b,0 if a<128 else 255)
    return im
def submit(m,names,ref_png,ref_kp,desc):
    ps=[p for n in names for p in m.CLIPS[n]]
    args={'description':desc,'action':' then '.join(names)[:100],'direction':'east','view':'side','first_frame_url':b64(ref_png),
          'first_frame_keypoints':m.B.kp(ref_kp),'keypoints':[m.B.kp(p) for p in ps],'seed':SEED}
    for k in range(200):
        try: t=mcp.text(mcp.tool('animate_with_skeleton_v3',args))
        except Exception as e: t='EXC '+str(e)
        if 'rate limit' in t.lower() or 'concurren' in t.lower() or t.startswith('EXC'): time.sleep(20); continue
        break
    log(f'{m.k} [{",".join(names)}] {len(ps)}f seed{SEED} -> {t[:120]}')
    j=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); return (j.group(1) if j else None),t,len(ps)
def fetch(m,names,j):
    i=0
    for n in names:
        d=f'{ROOT}/{m.k}/clips/{n}'; os.makedirs(d,exist_ok=True)
        for f in range(len(m.CLIPS[n])):
            for k in range(8):
                try: r=mcp.tool('get_image',{'job_id':j,'index':i}); break
                except Exception: time.sleep(5)
            im=[x for x in r['result']['content'] if x.get('type')=='image']
            if im:
                p=f'{d}/{f:02d}.png'; open(p,'wb').write(base64.b64decode(im[0]['data'])); clean(Image.open(p)).save(p)
            i+=1
def run(kinds,par=6):
    queue=[]
    for k in kinds:
        m=mobs_h.BUILD[k]().final(); desc=mobs_h.DESC[k]
        ref=flipv(m.ref,*m.ref_tb) if m.flipped else m.ref
        for g in m.jobs():
            if ONLY and not set(g)&set(ONLY): continue
            if all(os.path.exists(f'{ROOT}/{k}/clips/{n}/00.png') for n in g) and not ONLY: continue
            png=f'{ROOT}/{k}/base.png'
            if k=='resident' and not set(g)&{'greet'} and os.path.exists(f'{ROOT}/{k}/base_open.png'): png=f'{ROOT}/{k}/base_open.png'
            queue.append((m,g,png,ref,desc))
    pend={}
    while queue or pend:
        while queue and len(pend)<par:
            m,g,png,ref,desc=queue.pop(0); j,t,nf=submit(m,g,png,ref,desc)
            if j: pend[j]=(m,g); print('sub',m.k,g,flush=True)
            else: print('SUBFAIL',m.k,g,t[:300],flush=True)
        time.sleep(15)
        for j,(m,g) in list(pend.items()):
            try: txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
            except Exception: continue
            lo=txt.lower()
            if 'complet' in lo: fetch(m,g,j); del pend[j]; print('done',m.k,g,flush=True); log(f'{m.k} [{",".join(g)}] done')
            elif 'fail' in lo: del pend[j]; print('FAIL',m.k,g,txt[:300],flush=True); log(f'{m.k} [{",".join(g)}] FAIL {txt[:200]}')
if __name__=='__main__':
    kinds=[a for a in sys.argv[1:] if not a.startswith('--')]
    run(kinds)
    print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
