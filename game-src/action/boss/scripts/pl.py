# 보스 생성 공용: 작업 넣기·기다리기·받기·기록. 기록 ../spend.log
import sys,os,time,base64,re,json
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
import mcp
ROOT=os.path.join(HERE,'..')
def log(s): open(f'{ROOT}/spend.log','a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' '+s+'\n')
def bal():
    t=mcp.text(mcp.tool('get_balance',{})); m=re.search(r'generations_remaining: ([\d.]+)',t); return float(m.group(1)) if m else -1
def b64(path): return base64.b64encode(open(path,'rb').read()).decode()
def url(path): return 'data:image/png;base64,'+b64(path)
def job(tool,args,tag):
    t='?'
    for k in range(60):
        try:
            t=mcp.text(mcp.tool(tool,args))
            if re.search(r'[0-9a-f]{8}-[0-9a-f]{4}-',t): break
        except Exception as e: t='EXC '+str(e)
        time.sleep(20 if 'rate limit' in t else 8*min(k+1,4))
    log(f'{tag} {tool} -> {t[:160]}')
    m=re.search(r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',t)
    return m.group(1) if m else None
def wait(j,out,n=1,tries=80,step=6):
    """get_image로 n장 받기. out = 'dir/stem' → dir/stem.png 또는 dir/NN.png(n>1)"""
    for k in range(tries):
        time.sleep(step)
        try: r=mcp.tool('get_image',{'job_id':j})
        except Exception: continue
        ims=[x for x in r.get('result',{}).get('content',[]) if x.get('type')=='image']
        tx=mcp.text(r).lower()
        if ims:
            if n==1:
                os.makedirs(os.path.dirname(out),exist_ok=True); open(out,'wb').write(base64.b64decode(ims[0]['data'])); return True
            os.makedirs(out,exist_ok=True)
            for i in range(n):
                for kk in range(6):
                    try:
                        rr=mcp.tool('get_image',{'job_id':j,'index':i}); im=[x for x in rr['result']['content'] if x.get('type')=='image']
                        if im: open(f'{out}/{i:02d}.png','wb').write(base64.b64decode(im[0]['data'])); break
                    except Exception: pass
                    time.sleep(4)
            return True
        if 'fail' in tx and 'complet' not in tx: print('FAIL',tx[:300]); return False
    return False
