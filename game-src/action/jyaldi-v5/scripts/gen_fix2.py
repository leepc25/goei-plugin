# 수정 2차: 결함 목록 3·13~16·18 다시 생성. gen_all과 같은 animate_with_skeleton_v3이되 기준 그림을 옆모습 guard/00(뼈대 G0)로 바꿈.
# 사용: python3 gen_fix2.py 이름...   결과는 full/clips/<이름>/을 덮어씀(이전 장은 git 기록에 남음)
import sys,time,base64,re,os
sys.path.insert(0,'.'); import mcp,rig,gen_all
REF='data:image/png;base64,'+base64.b64encode(open('../full/clips/guard/00.png','rb').read()).decode()
REF_KP=rig.kp(rig.GUARD(0,0))
DESC=gen_all.DESC+', seen strictly from the side in profile facing right, jacket closed, character only, no background, no furniture, no visual effects, no explosions, no sparks, no light or glow'
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' gen_fix2 '+s+'\n')
def submit(n,seed=11):
    act,prop,ps=rig.CLIPS[n]
    args={'description':DESC+(', '+prop if prop else ''),'action':act[:100],'direction':'east','first_frame_url':REF,
          'first_frame_keypoints':REF_KP,'keypoints':[rig.kp(p) for p in ps],'seed':seed}
    for k in range(60):
        try: t=mcp.text(mcp.tool('animate_with_skeleton_v3',args))
        except Exception as e: t='EXC '+str(e); time.sleep(5); continue
        if 'rate limit' in t: time.sleep(30); continue   # 작업 칸(20개)을 다른 스레드와 같이 씀
        break
    log(f'{n} {len(ps)}f -> {t[:160]}')
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); return m.group(1) if m else None,t
if __name__=='__main__':
    names=sys.argv[1:]
    b0=gen_all.bal(); print('before',b0,flush=True); log('before '+b0)
    pend={}
    resume={}
    if '--resume' in names:   # 넣고 못 받은 일감(spend.log의 마지막 job id)만 받음
        names=[n for n in names if n!='--resume']
        for ln in open('../spend.log'):
            m=re.search(r'gen_fix2 (\S+) \d+f -> id: ([0-9a-f-]{36})',ln)
            if m: resume[m.group(1)]=m.group(2)
    for n in names:
        if n in resume: pend[n]=resume[n]; continue
        j,t=submit(n)
        if j: pend[n]=j; print('sub',n,flush=True)
        else: print('SUBFAIL',n,t[:300],flush=True)
    while pend:
        time.sleep(15)
        for n,j in list(pend.items()):
            try: txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
            except Exception: continue
            lo=txt.lower()
            if 'complet' in lo:
                os.makedirs(f'{gen_all.OUT}/{n}',exist_ok=True)
                for f in os.listdir(f'{gen_all.OUT}/{n}'): os.remove(f'{gen_all.OUT}/{n}/{f}')
                gen_all.fetch(n,j); del pend[n]; print('done',n,flush=True); log(f'{n} done')
            elif 'fail' in lo:
                del pend[n]; print('FAIL',n,txt[:300],flush=True); log(f'{n} FAIL {txt[:200]}')
    b1=gen_all.bal(); print('after',b1,flush=True); log('after '+b1)
