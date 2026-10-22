# 에일린 클립 생성(animate_with_skeleton_v3). 기준 그림은 클립마다 erig.CLIPS[이름][2] = H(본부)·F(현장 멘 총)·R(현장 든 총).
# 사용: python3 gen.py [--boot] [--resume] 이름...   결과 ../clips/<이름>/NN.png
#  --boot: 옆모습 기준 장이 아직 없을 때. 쟈알디 A2를 에일린으로 바꾼 그림(H-pad·F-pad, 자세 = 쟈알디 A 뼈대)에서 뽑음
import sys,os,time,json,shutil
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from common import *
import erig,rig
OUT=os.path.join(HERE,'../clips'); BASE=os.path.join(HERE,'../base')
DESC=('short compact adult woman agent, faded cream platinum blonde hair in a high ponytail with a black hair tie, blunt bangs, '
      'long side locks, dull grey-blue eyes, expressionless, black suit with a hip-length jacket and blue-grey highlights, '
      'white shirt, black necktie, bare hands, black shoes, pistol holster on the hip')
VEST=', dark olive bulletproof plate carrier vest worn over the suit jacket'
TAILD=(', seen strictly from the side in profile facing right, character only, empty transparent background, '
       'no furniture, no visual effects, no muzzle flash, no light or glow')
def ref(base,boot):
    if boot:
        return b64url(f'{BASE}/{"H" if base=="H" else "F"}-pad.png'),rig.kp(rig.A_KP)
    meta=json.load(open(f'{BASE}/side.json'))[base]
    return b64url(f'{BASE}/{base}-side.png'),meta['kp']
def submit(n,boot=False,seed=11):
    act,prop,base,ps=erig.CLIPS[n]
    url,fkp=ref(base,boot)
    d=DESC+(VEST if base in 'FRPQB' else '')+(', '+prop if prop else '')+TAILD
    args={'description':d,'action':act,'direction':'east','first_frame_url':url,'first_frame_keypoints':fkp,
          'keypoints':[rig.kp(p) for p in ps],'seed':seed}
    t=''
    for k in range(80):
        try: t=mcp.text(mcp.tool('animate_with_skeleton_v3',args))
        except Exception as e: t='EXC '+str(e); time.sleep(5); continue
        if 'rate limit' in t.lower() or 'concurrent' in t.lower() or 'too many' in t.lower(): time.sleep(20); continue
        break
    log('gen',f'{n} {len(ps)}f base={base}{"(boot)" if boot else ""} -> {t[:160]}')
    return jobid(t),t
def fetch(n,j):
    nf=len(erig.CLIPS[n][3]); d=f'{OUT}/{n}'; tmp=d+'.new'; os.makedirs(tmp,exist_ok=True)
    for i in range(nf):
        r=None
        for k in range(6):
            try: r=mcp.tool('get_image',{'job_id':j,'index':i}); break
            except Exception: time.sleep(5)
        im=[x for x in r['result']['content'] if x.get('type')=='image'] if r else []
        if im: open(f'{tmp}/{i:02d}.png','wb').write(base64.b64decode(im[0]['data']))
    if os.path.isdir(d): shutil.rmtree(d)
    os.rename(tmp,d)
if __name__=='__main__':
    args=sys.argv[1:]; boot='--boot' in args; resume='--resume' in args
    names=[a for a in args if not a.startswith('--')]
    b0=bal(); print('before',b0,flush=True); log('gen','before '+b0)
    pend={}; last={}
    if resume:
        for ln in open(os.path.join(HERE,'../spend.log')):
            m=re.search(r' gen (\S+) \d+f base=\S+ -> id: ([0-9a-f-]{36})',ln)
            if m: last[m.group(1)]=m.group(2)
    queue=[]
    for n in names:
        if resume and n in last and not os.path.isdir(f'{OUT}/{n}'): pend[n]=last[n]
        elif resume and os.path.isdir(f'{OUT}/{n}'): continue
        else: queue.append(n)
    MAXP=int(os.environ.get('MAXP','2'))   # 요원 스레드당 동시 2개(사용자 2026-10-22)
    while queue or pend:
        while queue and len(pend)<MAXP:
            n=queue.pop(0); j,t=submit(n,boot)
            if j: pend[n]=j; print('sub',n,flush=True)
            else: print('SUBFAIL',n,t[:300],flush=True)
        time.sleep(12)
        for n,j in list(pend.items()):
            try: txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
            except Exception: continue
            lo=txt.lower()
            if 'complet' in lo:
                fetch(n,j); del pend[n]; print('done',n,flush=True); log('gen',f'{n} done')
            elif 'fail' in lo:
                del pend[n]; print('FAIL',n,txt[:300],flush=True); log('gen',f'{n} FAIL {txt[:200]}')
    b1=bal(); print('after',b1,flush=True); log('gen','after '+b1)
