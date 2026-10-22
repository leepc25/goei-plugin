# 가짜 관리국 도트 공통: PixelLab 호출, 차감 기록(spend.log), 대기·받기. 다른 스레드와 작업 칸을 같이 쓰므로 rate limit이면 기다림.
import sys,time,re,base64,os,json
sys.path.insert(0,os.path.dirname(__file__)); import mcp
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
LOG=os.path.join(ROOT,'spend.log')
CAP=530
def log(s): open(LOG,'a').write(time.strftime('%m-%d %H:%M:%S')+' '+s+'\n')
def spent():
    t=0.0
    if os.path.exists(LOG):
        for ln in open(LOG):
            m=re.search(r' cost=([\d.]+)',ln)
            if m: t+=float(m.group(1))
    return t
def bal(): return mcp.text(mcp.tool('get_balance',{})).split('\n')[1]
def submit(tool,args,tag,cost):
    if spent()+cost>CAP: raise SystemExit(f'상한 {CAP} 초과 직전: 이미 {spent()} + {cost}')
    for k in range(120):
        try: t=mcp.text(mcp.tool(tool,args))
        except Exception as e: t='EXC '+str(e); time.sleep(5); continue
        if 'rate limit' in t.lower() or 'too many' in t.lower(): time.sleep(30); continue
        break
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t) or re.search(r'id: ([0-9a-f-]{36})',t)
    j=m.group(1) if m else None
    log(f'{tag} {tool} job={j} cost={cost if j else 0} -> {t[:120]!r}')
    return j,t
def status(j):
    try: return mcp.text(mcp.tool('get_image',{'job_id':j})).lower()
    except Exception: return ''
def fetch(j,n,outdir):
    os.makedirs(outdir,exist_ok=True)
    for i in range(n):
        r=None
        for k in range(6):
            try: r=mcp.tool('get_image',{'job_id':j,'index':i}); break
            except Exception: time.sleep(5)
        im=[x for x in (r or {}).get('result',{}).get('content',[]) if x.get('type')=='image']
        if im: open(f'{outdir}/{i:02d}.png','wb').write(base64.b64decode(im[0]['data']))
def wait_all(pend,on_done,on_fail=None,every=15):
    """pend: {key:(job,meta)}"""
    while pend:
        time.sleep(every)
        for k,(j,meta) in list(pend.items()):
            s=status(j)
            if 'complet' in s: on_done(k,j,meta); del pend[k]; log(f'{k} done')
            elif 'fail' in s or 'error' in s: del pend[k]; log(f'{k} FAIL {s[:160]}'); on_fail and on_fail(k,j,meta,s)
