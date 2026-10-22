# rig_<id>.py 클립을 animate_with_skeleton_v3로 생성(백일몽 gen.py와 같은 방식). 결과 ../<id>/clips/<이름>/NN.png, 기록 ../spend.log
# 사용: python3 gen.py <id> [이름...] [--resume] [--seed N]
import sys,time,base64,re,os,importlib,json
sys.path.insert(0,'../../jyaldi-v5/scripts'); sys.path.insert(0,'.'); import mcp
CID=sys.argv[1]; rig=importlib.import_module('rig_'+CID)
import common as c
DESC={
 'avensha':'curvy woman witch, long wavy dark teal-blue hair out of the hood, emerald eyes, gentle smile, dark purple hooded cloak to the ankles with a big green emerald brooch at the chest, black pinstripe suit, white shirt, black necktie, black trousers and shoes',
 'brownie':'huge broad man with an old boxy CRT television for a head, dark brown wooden casing, blank dark grey-green screen with nothing on it, brown three-piece suit with vest, white shirt, dark necktie, white pocket square, black gloves, black dress shoes',
 'aestheticism':'tall woman-shaped store mannequin with human proportions and volume, smooth off-white plaster body with ball-joint seams, sexless torso with no chest detail, long messy bright red hair to the waist, red eyes, freckles, crooked smile, stitched scar across the neck, high heel feet',
}[CID]+(', seen strictly from the side in profile facing right, character only, no background, no furniture, '
        'no visual effects, no light or glow, empty hands')
OUT=f'../{CID}/clips'; LOG='../spend.log'
REFP=f'../{CID}/base/ref-pad.png'
REF='data:image/png;base64,'+base64.b64encode(open(REFP,'rb').read()).decode()
REF_KP=json.load(open(f'../{CID}/base/ref-kp.json'))
def log(s): open(LOG,'a').write(time.strftime('%F %T')+f' gen {CID} '+s+'\n')
def bal(): return mcp.text(mcp.tool('get_balance',{})).split('\n')[1]
SEED=int(sys.argv[sys.argv.index('--seed')+1]) if '--seed' in sys.argv else 11
def submit(n):
    act,prop,ps=c.CLIPS[n]
    args={'description':DESC,'action':act[:100],'direction':'east','first_frame_url':REF,
          'first_frame_keypoints':REF_KP,'keypoints':[c.kp(p) for p in ps],'seed':SEED}
    t=''
    for k in range(2000):   # 계정 동시 작업 20개를 다른 스레드와 같이 씀
        try: t=mcp.text(mcp.tool('animate_with_skeleton_v3',args))
        except Exception as e: t='EXC '+str(e); time.sleep(10); continue
        lo=t.lower()
        if 'rate limit' in lo or 'too many' in lo or 'concurrent' in lo or 'slots' in lo: time.sleep(20); continue
        break
    log(f'{n} {len(ps)}f -> {t[:160]}')
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); return m.group(1) if m else None,t
def fetch(n,j):
    nf=len(c.CLIPS[n][2]); d=f'{OUT}/{n}'; os.makedirs(d,exist_ok=True)
    for f in os.listdir(d): os.remove(f'{d}/{f}')
    for i in range(nf):
        r=None
        for k in range(5):
            try: r=mcp.tool('get_image',{'job_id':j,'index':i}); break
            except Exception: time.sleep(5)
        im=[x for x in (r or {}).get('result',{}).get('content',[]) if x.get('type')=='image']
        if im: open(f'{d}/{i:02d}.png','wb').write(base64.b64decode(im[0]['data']))
if __name__=='__main__':
    names=[a for a in sys.argv[2:] if not a.startswith('--') and not a.isdigit()] or list(c.CLIPS)
    b0=bal(); print('before',b0,flush=True); log('before '+b0)
    resume={}
    if '--resume' in sys.argv:
        for ln in open(LOG):
            m=re.search(rf' gen {CID} (\S+) \d+f -> id: ([0-9a-f-]{{36}})',ln)
            if m: resume[m.group(1)]=m.group(2)
            m=re.search(rf' gen {CID} (\S+) done',ln)
            if m: resume[m.group(1)]='DONE'
    pend={}; queue=[n for n in names if resume.get(n)!='DONE']
    MAXP=int(os.environ.get('MAXP','1'))   # 사용자 03:12: 요원 7명이 끝날 때까지 이 스레드는 동시 작업 1개
    while queue or pend:
        while queue and len(pend)<MAXP:
            n=queue.pop(0)
            if n in resume: pend[n]=resume[n]; continue
            j,t=submit(n)
            if j: pend[n]=j; print('sub',n,flush=True)
            else: print('SUBFAIL',n,t[:300],flush=True)
        time.sleep(15)
        for n,j in list(pend.items()):
            try: txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
            except Exception: continue
            lo=txt.lower()
            if 'complet' in lo: fetch(n,j); del pend[n]; print('done',n,flush=True); log(f'{n} done')
            elif 'fail' in lo: del pend[n]; print('FAIL',n,txt[:300],flush=True); log(f'{n} FAIL {txt[:200]}')
    b1=bal(); print('after',b1,flush=True); log('after '+b1)
