# 에일린 작업 공용: 쟈알디 스크립트(mcp·poll·rig)를 그대로 씀. 지출 기록은 ../spend.log
import sys,os,time,re,base64
from pathlib import Path
J=os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../jyaldi-v5/scripts')
sys.path.insert(0,J)
import pixellab_client as mcp
from sheet import poll
HERE=os.path.dirname(os.path.abspath(__file__))
def log(tag,s): open(os.path.join(HERE,'../spend.log'),'a').write(time.strftime('%m-%d %H:%M:%S')+f' {tag} '+s+'\n')
def b64url(path): return 'data:image/png;base64,'+base64.b64encode(Path(path).read_bytes()).decode()
def jobid(t):
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); return m.group(1) if m else None
def bal(): return mcp.text(mcp.checked(mcp.tool('get_balance',{})))
