# rig.py의 클립을 animate_with_skeleton_v3로 생성. 쟈알디 gen_all·gen_fix2와 같은 방식(옆모습 문장 + 일감 칸 대기).
# 사용: python3 gen.py [이름...] [--ref 경로 --refkp 클립:프레임] [--resume]   결과 ../full/clips/<이름>/NN.png
import sys,time,base64,re,os
sys.path.insert(0,'../../jyaldi-v5/scripts'); sys.path.insert(0,'.'); import mcp,rig
DESC=('slim adult woman agent, short wavy nearly black dark purple bob to the jaw, side bangs hiding the far eye, pale skin, one dull gold eye, '
      'faint closed-mouth half smile, black suit with a hip-length jacket and blue-grey highlights, white shirt, black necktie, '
      'knee-length black pencil skirt, black stockings, low black heels, empty hands, '
      'seen strictly from the side in profile facing right, character only, no background, no furniture, no weapon in hand, '
      'no visual effects, no explosions, no sparks, no light or glow')
OUT='../full/clips'
def arg(k,d=None):
    return sys.argv[sys.argv.index(k)+1] if k in sys.argv else d
REFP=arg('--ref','../base/S0-pad.png')
REF='data:image/png;base64,'+base64.b64encode(open(REFP,'rb').read()).decode()
if arg('--refkp'):
    c,f=arg('--refkp').split(':'); REF_KP=rig.kp(rig.CLIPS[c][2][int(f)])
else: REF_KP=rig.kp(rig.A_KP)
def log(s): open('../spend.log','a').write(time.strftime('%F %T')+' gen '+s+'\n')
def bal(): return mcp.text(mcp.tool('get_balance',{})).split('\n')[1]
def submit(n,seed=11):
    act,prop,ps=rig.CLIPS[n]
    args={'description':DESC+(', '+prop if prop else ''),'action':act[:100],'direction':'east','first_frame_url':REF,
          'first_frame_keypoints':REF_KP,'keypoints':[rig.kp(p) for p in ps],'seed':seed}
    for k in range(3):
        try: t=mcp.text(mcp.tool('animate_with_skeleton_v3',args))
        except Exception as e: t='EXC '+str(e); time.sleep(5); continue
        if 'rate limit' in t.lower() or 'too many' in t.lower(): return None,'RATE'   # 작업 칸이 차면 바로 돌아가 받기부터
        break
    log(f'{n} {len(ps)}f -> {t[:160]}')
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); return m.group(1) if m else None,t
def fetch(n,j):
    nf=len(rig.CLIPS[n][2]); d=f'{OUT}/{n}'; os.makedirs(d,exist_ok=True)
    for f in os.listdir(d): os.remove(f'{d}/{f}')
    for i in range(nf):
        r=None
        for k in range(5):
            try: r=mcp.tool('get_image',{'job_id':j,'index':i}); break
            except Exception: time.sleep(5)
        im=[x for x in (r or {}).get('result',{}).get('content',[]) if x.get('type')=='image']
        if im: open(f'{d}/{i:02d}.png','wb').write(base64.b64decode(im[0]['data']))
if __name__=='__main__':
    skip={'--ref','--refkp','--max'}
    names=[]; it=iter(sys.argv[1:])
    for a in it:
        if a in skip: next(it); continue
        if not a.startswith('--'): names.append(a)
    names=names or list(rig.CLIPS)
    b0=bal(); print('before',b0,flush=True); log('before '+b0+' ref '+REFP)
    resume={}
    if '--resume' in sys.argv:
        for ln in open('../spend.log'):
            m=re.search(r' gen (\S+) \d+f -> id: ([0-9a-f-]{36})',ln)
            if m: resume[m.group(1)]=m.group(2)
    pend={}; queue=list(names)
    while queue or pend:
        while queue and len(pend)<int(arg('--max','2')):
            n=queue.pop(0)
            if n in resume: pend[n]=resume[n]; continue
            j,t=submit(n)
            if t=='RATE': queue.insert(0,n); break
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
