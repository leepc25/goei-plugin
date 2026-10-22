# 전 클립 생성: animate_with_skeleton_v3, 기준 그림 base/<캐릭터>.png(256×176) + base.json의 첫 장 관절.
# 사용: python3 gen.py <캐릭터> [클립...] [--redo]   결과 ../clips/<캐릭터>/<클립>/NN.png. 넣은 일감은 spend.log에 남아 다시 돌리면 이어받음.
import sys,os,time,json
sys.path.insert(0,'.')
from common import *
import bsrig
NOFX=', seen strictly from the side in profile facing right, character only, no background, no furniture, no other people, no visual effects, no light or glow'
BASE=json.load(open(os.path.join(ROOT,'base','base.json')))
def args_for(cn,n,seed=21):
    ch=bsrig.CHARS[cn]; act,prop,ps=ch['clips'][n]; b=BASE[cn]
    return {'description':(ch['desc']+(', '+prop if prop else '')+NOFX)[:1000],'action':act,'direction':'east',
            'first_frame_url':b64url(os.path.join(ROOT,'base',b['img'])),'first_frame_keypoints':b['kp'],
            'keypoints':[bsrig.kp(p,ch['scale']) for p in ps],'seed':seed}
def fetch(cn,n,j,nf):
    d=os.path.join(ROOT,'clips',cn,n); os.makedirs(d,exist_ok=True)
    for f in os.listdir(d): os.remove(os.path.join(d,f))
    for i in range(nf):
        r=None
        for k in range(6):
            try: r=mcp.tool('get_image',{'job_id':j,'index':i}); break
            except Exception: time.sleep(5)
        im=[x for x in (r or {}).get('result',{}).get('content',[]) if x.get('type')=='image']
        if im: open(os.path.join(d,f'{i:02d}.png'),'wb').write(base64.b64decode(im[0]['data']))
def run(cn,names,redo=False,maxpend=8):
    ch=bsrig.CHARS[cn]; names=names or list(ch['clips'])
    last={}
    if os.path.exists(os.path.join(ROOT,'spend.log')):
        for ln in open(os.path.join(ROOT,'spend.log')):
            m=re.search(rf'gen {cn}/(\S+) \d+f -> .*?job_id: ([0-9a-f-]{{36}})',ln)
            if m: last[m.group(1)]=m.group(2)
            m=re.search(rf'gen {cn}/(\S+) done',ln)
            if m and not redo: last[m.group(1)]='DONE'
    pend={}; queue=[]
    for n in names:
        if last.get(n)=='DONE' and not redo: continue
        if n in last and not redo: pend[n]=last[n]
        else: queue.append(n)
    print(cn,'queue',len(queue),'resume',len(pend),flush=True)
    while queue or pend:
        while queue and len(pend)<maxpend:
            n=queue.pop(0); nf=len(ch['clips'][n][2])
            for k in range(60):
                try: t=mcp.text(mcp.tool('animate_with_skeleton_v3',args_for(cn,n)))
                except Exception as e: t='EXC '+str(e); time.sleep(5); continue
                if 'rate limit' in t.lower() or 'too many' in t.lower() or 'concurrent' in t.lower(): time.sleep(30); continue
                break
            log('gen',f'{cn}/{n} {nf}f -> {t[:160]}'.replace('\n',' '))
            j=jobid(t)
            if j: pend[n]=j; print('sub',n,flush=True)
            else: print('SUBFAIL',n,t[:200],flush=True)
        time.sleep(15)
        for n,j in list(pend.items()):
            try: txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
            except Exception: continue
            lo=txt.lower()
            if 'complet' in lo:
                fetch(cn,n,j,len(ch['clips'][n][2])); del pend[n]; log('gen',f'{cn}/{n} done'); print('done',n,flush=True)
            elif 'fail' in lo or 'error' in lo:
                del pend[n]; log('gen',f'{cn}/{n} FAIL {txt[:150]}'); print('FAIL',n,txt[:200],flush=True)
if __name__=='__main__':
    a=[x for x in sys.argv[1:] if not x.startswith('--')]
    print('before',bal(),flush=True)
    run(a[0],a[1:],'--redo' in sys.argv)
    print('after',bal(),flush=True)
