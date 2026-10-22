# 보스 뼈대 클립 생성: python3 gen.py <보스> [클립...] [--seed=N] [--par=N] [--fresh]
# <보스>_rig.py 의 CLIPS·DESC·REF·FIRST(첫 장 관절)를 씀. 결과 ../<보스>/clips/<클립>/NN.png
import sys,os,time,re,json,importlib
import pl,mcp
boss=sys.argv[1]; R=importlib.import_module(f'{boss}_rig')
args=[a for a in sys.argv[2:] if not a.startswith('--')]
SEED=int(([a for a in sys.argv if a.startswith('--seed=')] or ['--seed=31'])[0][7:])
PAR=int(([a for a in sys.argv if a.startswith('--par=')] or ['--par=6'])[0][6:])
OUT=f'../{boss}/clips'; REF=pl.url(R.REF)
def done(n): return os.path.exists(f'{OUT}/{n}/{len(R.CLIPS[n][1])-1:02d}.png')
def submit(n):
    while os.path.exists('../PAUSE'): time.sleep(10)   # 동시 1개 규칙: 다른 작업이 끼어들 때 잠시 멈춤
    act,ps=R.CLIPS[n]
    a={'description':R.DESC,'action':act[:100],'direction':'east','first_frame_url':REF,'first_frame_keypoints':R.FIRST,
       'keypoints':[R.B.kp(p) for p in ps],'seed':SEED}
    return pl.job('animate_with_skeleton_v3',a,f'{boss}/{n} {len(ps)}f seed{SEED}')
names=args or list(R.CLIPS)
for n in names:
    for i,p in enumerate(R.CLIPS[n][1]):
        assert all(0<=x<=R.B.W and 0<=y<=R.B.H for x,y in p.values()),(n,i,'관절이 캔버스 밖')
queue=[n for n in names if '--fresh' in sys.argv or not done(n)]
b0=pl.bal(); print('before',b0,'clips',len(queue),flush=True)
pend={}
while queue or pend:
    while queue and len(pend)<PAR:
        n=queue.pop(0); j=submit(n)
        if j: pend[n]=j; print('sub',n,flush=True)
        else: print('SUBFAIL',n,flush=True)
    time.sleep(15)
    for n,j in list(pend.items()):
        try: txt=mcp.text(mcp.tool('get_image',{'job_id':j})).lower()
        except Exception: continue
        if 'complet' in txt or 'image' in txt and 'process' not in txt:
            if pl.wait(j,f'{OUT}/{n}',len(R.CLIPS[n][1]),tries=3,step=1): del pend[n]; json.dump([R.B.kp(p) for p in R.CLIPS[n][1]],open(f'{OUT}/{n}/kp.json','w')); print('done',n,flush=True); pl.log(f'{boss}/{n} done')
        elif 'fail' in txt: del pend[n]; print('FAIL',n,txt[:200],flush=True); pl.log(f'{boss}/{n} FAIL')
print('after',pl.bal(),flush=True)
