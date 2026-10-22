# 블라렛·살라딘 공용: 쟈알디 스크립트(mcp·poll)를 그대로 씀. 지출 기록은 ../spend.log
import sys,os,time,re,base64
J=os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../jyaldi-v5/scripts')
sys.path.insert(0,J)
import mcp
from sheet import poll
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.join(HERE,'..')
def log(tag,s): open(os.path.join(ROOT,'spend.log'),'a').write(time.strftime('%m-%d %H:%M:%S')+f' {tag} '+s+'\n')
def b64url(path): return 'data:image/png;base64,'+base64.b64encode(open(path,'rb').read()).decode()
def jobid(t):
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); return m.group(1) if m else None
def bal(): return mcp.text(mcp.tool('get_balance',{})).split('\n')[1]
def submit(tool,args,tag):
    for k in range(60):
        try: t=mcp.text(mcp.tool(tool,args))
        except Exception as e: t='EXC '+str(e); time.sleep(5); continue
        if 'rate limit' in t.lower() or 'too many' in t.lower(): time.sleep(30); continue   # 작업 칸을 다른 스레드와 같이 씀
        break
    log(tag,t[:160].replace('\n',' ')); return jobid(t),t
