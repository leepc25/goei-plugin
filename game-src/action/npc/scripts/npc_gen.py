# NPC 클립 일괄 생성 (animate_with_skeleton_v3). 기준 그림 = ../profile/<id>/<REF>.png(옆모습 대기), 관절 = 그 그림을 추정(0.1회, 한 번만).
# 키 비율 k = 기준 그림 키 / 93(쟈알디). 결과 ../clips/<id>/<클립>/NN.png, 일감 기록 ../clips/<id>/jobs.json(이어받기).
# 사용: python3 npc_gen.py id[:클립,클립] ...   환경 MAXPEND(동시 일감, 기본 12)
import sys,os,json,base64,time,re
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE); sys.path.insert(0,os.path.join(HERE,'../../jyaldi-v5/scripts'))
import mcp,rig,pl,npc_set,profile
from npc_rig import scale
from rig import anatomic
from base import NPC
from PIL import Image
PROF=os.path.join(HERE,'../profile'); OUT=os.path.join(HERE,'../clips')
REF={}   # 기준 장 번호(기본 0)
def ref(id):
    p=f'{PROF}/{id}/{REF.get(id,0):02d}.png'
    kp=p.replace('.png','.kp.json')
    if not os.path.exists(kp): profile.estimate(p)
    a=Image.open(p).convert('RGBA').split()[3].point(lambda v:255 if v>=128 else 0).getbbox()
    return p,json.load(open(kp)),(a[3]-a[1])/93
def desc(id): return NPC[id][1].rsplit('.',2)[0]+', side view in strict profile facing right, character only, empty transparent background'
def args(id,n,a,ps,cache):
    p,kp,k=cache
    return {'description':desc(id),'action':a[:100],'direction':'east',
            'first_frame_url':'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode(),
            'first_frame_keypoints':kp,'keypoints':[rig.kp(anatomic(scale(q,k))) for q in ps],'seed':11}
def fetch(id,n,j,nf):
    d=f'{OUT}/{id}/{n}'; got=pl.frames(j,nf,d); return got==nf
if __name__=='__main__':
    MAX=int(os.environ.get('MAXPEND','12'))
    todo=[]
    for a in sys.argv[1:]:
        id,_,ns=a.partition(':'); c=npc_set.clips(id)
        for n in (ns.split(',') if ns else c): todo.append((id,n,c[n]))
    caches={}; jobsf={}; pend={}
    def jobs(id):
        if id not in jobsf:
            f=f'{OUT}/{id}/jobs.json'; os.makedirs(f'{OUT}/{id}',exist_ok=True)
            jobsf[id]=json.load(open(f)) if os.path.exists(f) else {}
        return jobsf[id]
    def save(id): json.dump(jobsf[id],open(f'{OUT}/{id}/jobs.json','w'),indent=0)
    queue=[]
    for id,n,(a,ps) in todo:
        if os.path.exists(f'{OUT}/{id}/{n}/{len(ps)-1:02d}.png'): continue
        j=jobs(id).get(n)
        if j and j!='FAIL': pend[(id,n)]=(j,len(ps))
        else: queue.append((id,n,a,ps))
    print('todo',len(queue),'resume',len(pend),'credits≈',sum(npc_set.cost(len(ps)) for *_,ps in queue),flush=True)
    while queue or pend:
        while queue and len(pend)<MAX:
            id,n,a,ps=queue[0]
            if id not in caches: caches[id]=ref(id)
            try: t=mcp.text(mcp.tool('animate_with_skeleton_v3',args(id,n,a,ps,caches[id])))
            except Exception as e: t='EXC '+str(e)
            if 'rate limit' in t.lower() or t.startswith('EXC'): break     # 칸이 차면 받기부터
            queue.pop(0); m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); pl.log(f'clip {id}/{n} {len(ps)}f -> {m.group(1) if m else t[:160]}')
            if m: pend[(id,n)]=(m.group(1),len(ps)); jobs(id)[n]=m.group(1); save(id)
            else: print('SUBFAIL',id,n,t[:200],flush=True)
        time.sleep(10)
        for (id,n),(j,nf) in list(pend.items()):
            try: t=mcp.text(mcp.tool('get_image',{'job_id':j})).lower()
            except Exception: continue
            if 'complet' in t:
                ok=fetch(id,n,j,nf); del pend[(id,n)]; print('done' if ok else 'PARTIAL',id,n,flush=True)
            elif 'fail' in t:
                del pend[(id,n)]; jobs(id)[n]='FAIL'; save(id); pl.log(f'clip {id}/{n} FAIL {t[:150]}'); print('FAIL',id,n,t[:200],flush=True)
    print('end',flush=True)
