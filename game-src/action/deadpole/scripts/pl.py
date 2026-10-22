# 데드폴 전용 전송: 환경 인증, 공용 계정 프록시·CA 유지. 유료 제출 자동 재시도 없음.
import sys,os,time,base64,re
HERE=os.path.dirname(os.path.abspath(__file__))
import mcp_client as mcp
LOG=os.path.join(HERE,'../spend.log')
def log(s): open(LOG,'a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' '+s+'\n')
def bal(): return mcp.text(mcp.tool('get_balance',{}))
def submit(tool,args,tries=1):
    # A timeout can occur after charging. Never blindly submit it again.
    t=mcp.text(mcp.tool(tool,args))
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t) or re.search(r'id: ([0-9a-f-]{36})',t)
    return (m.group(1) if m else None),t
def poll(job,out,index=None,tries=120):
    for _ in range(tries):
        a={'job_id':job}
        if index is not None: a['index']=index
        try: r=mcp.tool('get_image',a)
        except Exception: time.sleep(5); continue
        txt=mcp.text(r)
        imgs=[c for c in r.get('result',{}).get('content',[]) if c.get('type')=='image']
        if imgs: open(out,'wb').write(base64.b64decode(imgs[0]['data'])); return 'ok'
        if 'fail' in txt.lower(): return 'ERR '+txt[:300]
        time.sleep(8)
    return 'timeout'
def b64(path): return 'data:image/png;base64,'+base64.b64encode(open(path,'rb').read()).decode()
