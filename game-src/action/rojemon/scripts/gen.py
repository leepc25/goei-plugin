# 로제몬·꼬마·마네킹 전 클립을 animate_with_skeleton_v3로 생성. 사용: python3 gen.py [클립...] [--fresh]
# 결과 ../clips/<클립>/NN.png, 기록 ../spend.log (일감 번호 포함 → 끊기면 이어받음)
import sys,time,base64,re,os
import mcp, rig_rojemon as R, rig_puppets as PP
ALL={**R.CLIPS,**PP.CLIPS}
import rojemon_defs as D
EN={r['clip']:r['en'] for r in D.ROWS if r['make']=='pl'}
BASE={'roje':('../base/A-pad.png',R.A_KP,192,144,
              'petite young woman agent, long wavy pale lavender hair below the waist with straight blunt bangs, purple eyes, '
              'black suit jacket fitted at the waist, white shirt, black necktie, black pencil skirt above the knee, bare legs, black low-heel pumps'),
      'kid':('../base/K-pad.png',PP.A_KP['kid'],96,96,'small handmade burlap rag doll with stitched cloth body, round head, one button eye, thick purple yarn hair tuft'),
      'man':('../base/M-pad.png',PP.A_KP['man'],192,144,'faceless wooden artist mannequin with ball joints, smooth light wood, adult size')}
URL={b:'data:image/png;base64,'+base64.b64encode(open(v[0],'rb').read()).decode() for b,v in BASE.items()}
OUT='../clips'
def log(s): open('../spend.log','a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' gen '+s+'\n')
def kp(p,w,h):
    return [{'label':k,'x':round(p[k][0]/w,4),'y':round(p[k][1]/h,4),'z_index':8 if k.startswith('RIGHT') else 2 if k.startswith('LEFT') else 5} for k in R.J]
def submit(n,seed=7):
    b,ps=ALL[n]; f,a,w,h,desc=BASE[b]
    args={'description':desc,'action':EN[n][:100],'direction':'east','first_frame_url':URL[b],'first_frame_keypoints':kp(a,w,h),
          'keypoints':[kp(p,w,h) for p in ps],'seed':seed}
    for k in range(4):
        try: t=mcp.text(mcp.tool('animate_with_skeleton_v3',args)); break
        except Exception as e: t='EXC '+str(e); time.sleep(8)
    log(f'{n} {len(ps)}f -> {t[:140]}')
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t) or re.search(r'id: ([0-9a-f-]{36})',t); return m.group(1) if m else None,t
def fetch(n,j):
    nf=len(ALL[n][1]); os.makedirs(f'{OUT}/{n}',exist_ok=True)
    for i in range(nf):
        for k in range(5):
            try: r=mcp.tool('get_image',{'job_id':j,'index':i}); break
            except Exception: time.sleep(5)
        im=[x for x in r['result']['content'] if x.get('type')=='image']
        if im: open(f'{OUT}/{n}/{i:02d}.png','wb').write(base64.b64decode(im[0]['data']))
if __name__=='__main__':
    names=[a for a in sys.argv[1:] if not a.startswith('--')] or list(ALL)
    names=[n for n in names if '--fresh' in sys.argv or not os.path.isdir(f'{OUT}/{n}')]
    print('before',mcp.text(mcp.tool('get_balance',{})).split('\n')[1],'todo',len(names),flush=True)
    last={}
    if os.path.exists('../spend.log'):
        for ln in open('../spend.log'):
            m=re.search(r' gen (\S+) \d+f -> .*?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',ln)
            if m: last[m.group(1)]=m.group(2)
    pend={}; queue=[]
    for n in names:
        if n in last and '--fresh' not in sys.argv: pend[n]=last[n]; print('resume',n,flush=True)
        else: queue.append(n)
    MAXP=int(os.environ.get('MAXP','8'))
    while queue or pend:
        while queue and len(pend)<MAXP:
            n=queue.pop(0); j,t=submit(n)
            if j: pend[n]=j; print('sub',n,flush=True)
            elif 'rate' in t.lower() or 'limit' in t.lower() or 'concurrent' in t.lower(): queue.insert(0,n); print('wait slot',flush=True); break
            else: print('SUBFAIL',n,t[:300],flush=True)
        time.sleep(15)
        for n,j in list(pend.items()):
            try: txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
            except Exception: continue
            lo=txt.lower()
            if 'complet' in lo or '"images"' in lo:
                fetch(n,j); del pend[n]; print('done',n,flush=True); log(f'{n} done')
            elif 'fail' in lo:
                del pend[n]; print('FAIL',n,txt[:300],flush=True); log(f'{n} FAIL {txt[:200]}')
    print('after',mcp.text(mcp.tool('get_balance',{})).split('\n')[1],flush=True)
