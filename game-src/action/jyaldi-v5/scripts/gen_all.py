# rig.py의 모든 클립을 animate_with_skeleton_v3로 생성 (기준 그림 = 재킷 고친 A2, 192×144). 사용: python3 gen_all.py [이름...]
import sys,time,base64,re,json,os
sys.path.insert(0,'.'); import mcp,rig
REF='data:image/png;base64,'+base64.b64encode(open('../full/A2-pad.png','rb').read()).decode()
DESC=('tall slim adult woman agent, long straight black hair to the waist, pale skin, red eyes, expressionless, '
      'black suit with a hip-length jacket and blue-grey highlights, white shirt, black necktie, black leather gloves, black shoes, pistol holster on the hip')
OUT='../full/clips'
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' gen_all '+s+'\n')
def bal(): return mcp.text(mcp.tool('get_balance',{})).split('\n')[1]
def submit(n,seed=11):
    act,prop,ps=rig.CLIPS[n]
    d=DESC+(', '+prop if prop else '')
    args={'description':d,'action':act[:100],'direction':'east','first_frame_url':REF,'first_frame_keypoints':rig.kp(rig.A_KP),
          'keypoints':[rig.kp(p) for p in ps],'seed':seed}
    for k in range(4):
        try:
            t=mcp.text(mcp.tool('animate_with_skeleton_v3',args)); break
        except Exception as e: t='EXC '+str(e); time.sleep(5)
    log(f'{n} {len(ps)}f -> {t[:160]}')
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); return m.group(1) if m else None,t
def fetch(n,j):
    nf=len(rig.CLIPS[n][2]); os.makedirs(f'{OUT}/{n}',exist_ok=True)
    for i in range(nf):
        r=mcp.tool('get_image',{'job_id':j,'index':i}); im=[x for x in r['result']['content'] if x.get('type')=='image']
        if im: open(f'{OUT}/{n}/{i:02d}.png','wb').write(base64.b64decode(im[0]['data']))
if __name__=='__main__':
    names=sys.argv[1:] or list(rig.CLIPS)
    print('before',bal(),flush=True)
    pend={}
    queue=list(names)
    while queue or pend:
        while queue and len(pend)<16:
            n=queue.pop(0); j,t=submit(n)
            if j: pend[n]=j; print('sub',n,flush=True)
            else: print('SUBFAIL',n,t[:300],flush=True)
        time.sleep(15)
        for n,j in list(pend.items()):
            try: txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
            except Exception as e: continue
            lo=txt.lower()
            if 'complet' in lo:
                fetch(n,j); del pend[n]; print('done',n,flush=True); log(f'{n} done')
            elif 'fail' in lo:
                del pend[n]; print('FAIL',n,txt[:300],flush=True); log(f'{n} FAIL {txt[:200]}')
    print('after',bal(),flush=True)
