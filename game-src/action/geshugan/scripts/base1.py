# 기준 그림 1차: 쟈알디 옆모습 대기 장(clips/idle/00.png, 192×144, 발 y=136)을 edit_image_pixen으로 게슈간으로 고침.
# 크기·외곽선·음영 단계·광원을 쟈알디에서 그대로 물려받기 위함(사용자 2026-10-22 "쟈알디와 톤이 맞아야").
import sys,time,base64,re,os
sys.path.insert(0,os.path.dirname(__file__)); import mcp
SRC='../jyaldi-v5/full/clips/idle/00.png'
URL='data:image/png;base64,'+base64.b64encode(open(SRC,'rb').read()).decode()
CORE=('Change this woman into a different agent, same pose, same size, same pixel style, same dark outline and shading. '
 'Hair: snow-white chin-length bob with straight bangs, light grey shading, no long hair at all. Eyes pale icy blue. '
 'Outfit: no jacket; a loose white button shirt with the sleeves rolled up to the forearms, shirt tucked into high-waisted black slacks, '
 'loose black necktie, bare hands with no gloves, black flat shoes, no holster. Athletic build, broader shoulders, full chest.')
V=[('a',CORE,301),('b',CORE+' Calm blank expression.',302),('c',CORE.replace('loose black necktie','thin black necktie hanging loose at an open collar'),303),('d',CORE,304)]
def log(s): open('spend.log','a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' base1 '+s+'\n')
os.makedirs('base',exist_ok=True)
print('before',mcp.text(mcp.tool('get_balance',{})).split('\n')[1],flush=True)
jobs=[]
for n,d,seed in V:
    t=mcp.text(mcp.tool('edit_image_pixen',{'description':d[:500],'image_url':URL,'seed':seed}))
    m=re.search(r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',t); j=m.group(1) if m else None
    log(f'{n} -> {t[:120]}'); print(n,t[:200].replace('\n',' '),flush=True); jobs.append((n,j))
for n,j in jobs:
    for k in range(40):
        time.sleep(6)
        r=mcp.tool('get_image',{'job_id':j})
        im=[x for x in r.get('result',{}).get('content',[]) if x.get('type')=='image']
        if im: open(f'base/b1-{n}.png','wb').write(base64.b64decode(im[0]['data'])); print('got',n,flush=True); break
        tx=mcp.text(r).lower()
        if 'fail' in tx: print('FAIL',n,tx[:200]); break
print('after',mcp.text(mcp.tool('get_balance',{})).split('\n')[1],flush=True)
