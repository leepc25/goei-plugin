# 작업 줄 실행기(이어하기 가능): 상태 파일 jobs.json에 {키: {tool,args,cost,n,out,job,state}}. 작업 칸이 차면(20/20, 다른 스레드와 공유) 기다렸다 넣고, 끝난 것부터 받음.
import sys,os,json,time,re
sys.path.insert(0,os.path.dirname(__file__)); from common import *
STATE=os.path.join(ROOT,'jobs.json')
def load(): return json.load(open(STATE)) if os.path.exists(STATE) else {}
def save(s): json.dump(s,open(STATE+'.tmp','w'),ensure_ascii=False); os.replace(STATE+'.tmp',STATE)
def put(k,v):
    s=load(); s[k]=v; save(s)
def add(key,tool,args,cost,n,out):
    s=load()
    if key in s and s[key]['state'] in ('queued','running','done'): return
    s[key]=dict(tool=tool,args=args,cost=cost,n=n,out=out,job=None,state='queued',tries=s.get(key,{}).get('tries',0)); save(s)
def grab(j,n,out):
    if n==1:
        r=mcp.tool('get_image',{'job_id':j}); im=[x for x in r['result']['content'] if x.get('type')=='image']
        os.makedirs(os.path.dirname(out),exist_ok=True)
        if im: open(out,'wb').write(base64.b64decode(im[0]['data'])); return True
        return False
    fetch(j,n,out); return len([f for f in os.listdir(out) if f.endswith('.png')])>=n
def run(maxrun=8):
    while True:
        s=load(); q=[k for k,v in s.items() if v['state']=='queued']; r=[k for k,v in s.items() if v['state']=='running']
        if not q and not r: break
        for k in r:
            st=status(s[k]['job'])
            if 'complet' in st:
                ok=grab(s[k]['job'],s[k]['n'],os.path.join(ROOT,s[k]['out']))
                s[k]['state']='done' if ok else 'fetchfail'; log(f'{k} {s[k]["state"]}'); put(k,s[k]); print('done',k,flush=True)
            elif 'fail' in st or 'error' in st:
                s[k]['state']='failed'; log(f'{k} FAIL {st[:200]!r}'); put(k,s[k]); print('FAIL',k,st[:200],flush=True)
        s=load(); r=[k for k,v in s.items() if v['state']=='running']
        for k in q[:max(0,maxrun-len(r))]:
            v=s[k]
            if spent()+v['cost']>CAP: print('CAP stop',spent()); return
            try: t=mcp.text(mcp.tool(v['tool'],v['args']))
            except Exception as e: t='EXC '+str(e)
            if 'rate limit' in t.lower(): break
            m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t)
            if m: v['job']=m.group(1); v['state']='running'; v['tries']+=1; log(f'{k} {v["tool"]} job={v["job"]} cost={v["cost"]}'); print('sub',k,flush=True)
            else: log(f'{k} SUBERR {t[:200]!r}'); print('SUBERR',k,t[:200],flush=True); v['state']='suberr'
            put(k,v)
        time.sleep(12)
    print('all finished, spent',spent(),flush=True)
if __name__=='__main__':
    run(int(sys.argv[1]) if len(sys.argv)>1 else 8)
