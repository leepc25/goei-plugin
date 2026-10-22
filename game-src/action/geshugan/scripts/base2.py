# 기준 그림 2차: 한 번에 다 바꾸면 자세가 3/4로 돌고 음영이 납작해짐(1차) → 두 단계로 작게 고침.
# 1단계 머리·눈만, 2단계 옷만. 사용: python3 base2.py <src.png> <tag> <단계> seed...
import sys,time,base64,re,os
sys.path.insert(0,os.path.dirname(__file__)); import mcp
src,tag,step=sys.argv[1:4]; seeds=[int(s) for s in sys.argv[4:]]
D={'hair':('Only change the hair and eyes, keep everything else exactly: strict side profile facing right, same pose, same suit, same shading. '
           'Hair becomes a snow-white chin-length bob with straight bangs, pale grey shading, ending at the jaw; remove all long black hair. Eyes pale icy blue.'),
   'cloth':('Only change the clothes, keep the strict side profile, pose, face, white bob hair and the dark outline and shading style. '
            'Remove the suit jacket: a loose white button shirt with sleeves rolled up to the elbows, tucked into high-waisted black slacks shaded with blue-grey highlights like the old suit, '
            'loose black necktie, bare hands without gloves, no holster, black flat shoes. Athletic shoulders, full chest.')}
URL='data:image/png;base64,'+base64.b64encode(open(src,'rb').read()).decode()
def log(s): open('spend.log','a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' base2 '+s+'\n')
jobs=[]
for sd in seeds:
    t=mcp.text(mcp.tool('edit_image_pixen',{'description':D[step],'image_url':URL,'seed':sd}))
    m=re.search(r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',t); jobs.append((sd,m.group(1) if m else None)); log(f'{tag} {step} {sd} -> {t[:60]}')
for sd,j in jobs:
    for k in range(40):
        time.sleep(5)
        r=mcp.tool('get_image',{'job_id':j}); im=[x for x in r.get('result',{}).get('content',[]) if x.get('type')=='image']
        if im: open(f'base/{tag}-{sd}.png','wb').write(base64.b64decode(im[0]['data'])); print('got',tag,sd,flush=True); break
