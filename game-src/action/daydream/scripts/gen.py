# rig_<id>.py의 클립을 animate_with_skeleton_v3로 생성(스팡달 gen.py와 같은 방식). 결과 ../<id>/clips/<이름>/NN.png
# 사용: python3 gen.py <id> [이름...] [--resume] [--seed N]   (id: jaheon haje minseong nasol seonghae grunt_m grunt_f)
import sys,time,base64,re,os,importlib,json
sys.path.insert(0,'../../jyaldi-v5/scripts'); sys.path.insert(0,'.'); import mcp
CID=sys.argv[1]
if CID.startswith('grunt'): os.environ['GRUNT']=CID[-1]; rig=importlib.import_module('rig_grunt')
else: rig=importlib.import_module('rig_'+CID)
import common as c
DESC={
 'jaheon':'tall heavy man, swept-back short white hair, expressionless handsome face, navy suit vest over a white shirt with rolled sleeves, navy necktie, dark trousers, black shoes, white cotton work gloves',
 'haje':'lean woman, chin-length dark navy blue bob, tired cold face, navy pantsuit with jacket, white shirt, navy necktie, black flat shoes, dark gloves',
 'minseong':'big broad muscular man, short messy brown hair, anxious friendly face, tight navy suit, white shirt, navy necktie, black shoes, ID badge',
 'nasol':'tall slender woman, black high ponytail with blunt bangs, sharp bored face, fitted navy suit with trousers, white shirt, navy necktie, black heeled shoes, long black nails',
 'seonghae':'small slight woman, long wavy white hair tied low over one shoulder, green eyes, bright smile, navy pantsuit, white shirt, navy necktie, white sneakers',
 'grunt_m':'average man, very short dark hair, plain face, navy suit, white shirt, navy necktie, black shoes, ID badge',
 'grunt_f':'average woman, short dark hair, plain face, navy pantsuit, white shirt, navy necktie, black flat shoes, ID badge',
}[CID]+(', seen strictly from the side in profile facing right, character only, no background, no furniture, '
        'no visual effects, no light or glow')
NOPROP=', empty hands, no weapon in hand'
OUT=f'../{CID}/clips'; LOG='../spend.log'
REFP=f'../base/{CID}/ref-pad.png'
REF='data:image/png;base64,'+base64.b64encode(open(REFP,'rb').read()).decode()
REF_KP=json.load(open(f'../base/{CID}/ref-kp.json'))
def log(s): open(LOG,'a').write(time.strftime('%F %T')+f' gen {CID} '+s+'\n')
def bal(): return mcp.text(mcp.tool('get_balance',{})).split('\n')[1]
SEED=int(sys.argv[sys.argv.index('--seed')+1]) if '--seed' in sys.argv else 11
def submit(n):
    act,prop,ps=c.CLIPS[n]
    args={'description':DESC+(', '+prop if prop else NOPROP),'action':act[:100],'direction':'east','first_frame_url':REF,
          'first_frame_keypoints':REF_KP,'keypoints':[c.kp(p) for p in ps],'seed':SEED}
    t=''
    for k in range(200):
        try: t=mcp.text(mcp.tool('animate_with_skeleton_v3',args))
        except Exception as e: t='EXC '+str(e); time.sleep(10); continue
        lo=t.lower()
        if 'rate limit' in lo or 'too many' in lo or 'concurrent' in lo or 'slots' in lo: time.sleep(30); continue
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
    MAXP=int(os.environ.get('MAXP','8'))
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
