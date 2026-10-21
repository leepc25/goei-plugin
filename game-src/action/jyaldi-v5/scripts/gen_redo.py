# 결함 목록 재생성(생활 동작, rig.REDO). gen_all과 같은 방식(A2 + animate_with_skeleton_v3), 고친 뼈대로.
# 가구 없이 캐릭터만(2026-10-21 규칙: 가구는 게임이 따로 그림). 사용: python3 gen_redo.py [이름...]
import sys,time,base64,re,os,shutil
sys.path.insert(0,'.'); import mcp,rig,gen_all
OUT='../full/clips'
def log(s): open('../spend.log','a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' gen_redo '+s+'\n')
# 기준 그림: 옆모습 기본 대기 idle/00.png(뼈대 STAND(0)). A2는 3/4 각도라 생성기가 정면 쪽으로 따라감(전투 스레드 확인)
BASE='../full/base-idle-side.png'
REF='data:image/png;base64,'+base64.b64encode(open(BASE,'rb').read()).decode()
BASE_KP=rig.kp(rig.anatomic(rig.STAND(0)))
NOFURN=', character only, empty transparent background'
def submit(n,seed=11):
    act,prop,ps=rig.CLIPS[n]
    args={'description':gen_all.DESC+(', '+prop if prop else '')+NOFURN,'action':act[:100],'direction':'east','first_frame_url':REF,
          'first_frame_keypoints':BASE_KP,'keypoints':[rig.kp(p) for p in ps],'seed':seed}
    t=''
    for k in range(4):
        try: t=mcp.text(mcp.tool('animate_with_skeleton_v3',args)); break
        except Exception as e: t='EXC '+str(e); time.sleep(5)
    log(f'{n} {len(ps)}f -> {t[:160]}')
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); return m.group(1) if m else None,t
def fetch(n,j):
    d=f'{OUT}/{n}'; nf=len(rig.CLIPS[n][2]); tmp=d+'.new'; os.makedirs(tmp,exist_ok=True)
    for i in range(nf):
        r=None
        for k in range(5):
            try: r=mcp.tool('get_image',{'job_id':j,'index':i}); break
            except Exception: time.sleep(5)
        im=[x for x in r['result']['content'] if x.get('type')=='image']
        if im: open(f'{tmp}/{i:02d}.png','wb').write(base64.b64decode(im[0]['data']))
    shutil.rmtree(d,ignore_errors=True); os.rename(tmp,d)
if __name__=='__main__':
    names=sys.argv[1:] or rig.REDO
    print('before',gen_all.bal(),flush=True); log('before '+gen_all.bal())
    pend={}; queue=list(names)
    while queue or pend:
        while queue and len(pend)<16:
            n=queue.pop(0); j,t=submit(n)
            if j: pend[n]=j; print('sub',n,flush=True)
            else: print('SUBFAIL',n,t[:300],flush=True)
        time.sleep(15)
        for n,j in list(pend.items()):
            try: txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
            except Exception: continue
            lo=txt.lower()
            if 'complet' in lo: fetch(n,j); del pend[n]; print('done',n,flush=True); log(f'{n} done')
            elif 'fail' in lo: del pend[n]; print('FAIL',n,txt[:300],flush=True); log(f'{n} FAIL {txt[:200]}')
    b=gen_all.bal(); print('after',b,flush=True); log('after '+b)
