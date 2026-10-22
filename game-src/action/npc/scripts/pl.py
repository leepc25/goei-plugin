# PixelLab 호출 공통: 작업 칸(20개, 다른 스레드와 공유)이 차면 기다렸다 다시 넣음. 기록은 ../spend.log
import sys,os,time,re,base64
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0,os.path.join(HERE,'../../jyaldi-v5/scripts')); import mcp
LOG=os.path.join(HERE,'../spend.log')
def log(s): open(LOG,'a').write(time.strftime('%m-%d %H:%M:%S')+' '+s+'\n')
def balance():
    return float(mcp.text(mcp.tool('get_balance',{})).split('\n')[1].split(':')[1])
def submit(tool,args,tag,tries=200):
    t=''
    for _ in range(tries):
        try: t=mcp.text(mcp.tool(tool,args))
        except Exception as e: t='EXC '+str(e); time.sleep(5); continue
        if 'rate limit' in t.lower(): time.sleep(12); continue
        break
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); log(f'{tag} {tool} -> {m.group(1) if m else t[:160]}')
    return m.group(1) if m else None
def wait(j,timeout=900):
    t0=time.time()
    while time.time()-t0<timeout:
        try: txt=mcp.text(mcp.tool('get_image',{'job_id':j})).lower()
        except Exception: time.sleep(5); continue
        if 'complet' in txt: return True
        if 'fail' in txt: return False
        time.sleep(8)
    return False
def frames(j,n,outdir):
    os.makedirs(outdir,exist_ok=True); got=0
    for i in range(n):
        for k in range(5):
            try:
                r=mcp.tool('get_image',{'job_id':j,'index':i}); im=[x for x in r['result']['content'] if x.get('type')=='image']
                if im: open(f'{outdir}/{i:02d}.png','wb').write(base64.b64decode(im[0]['data'])); got+=1
                break
            except Exception: time.sleep(5)
    return got
