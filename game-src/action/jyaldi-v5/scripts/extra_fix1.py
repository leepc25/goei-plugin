# 수정 1차 추가분: 말하기(animate_image, 입만), 필살기 컷인(A2 얼굴을 edit_image_pixen으로 확대 재작화)
import sys,time,re,base64,io,os
sys.path.insert(0,'.'); import mcp
from sheet import poll
from PIL import Image
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' extra_fix1 '+s+'\n')
def b64(im): b=io.BytesIO(); im.save(b,'PNG'); return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
jobs=[]
idle=Image.open('../full/clips/idle/00.png').convert('RGBA')
t=mcp.text(mcp.tool('animate_image',{'first_frame_url':b64(idle),'last_frame_url':b64(idle),'action':'talking calmly: only the mouth opens and closes, the body, head and hair stay still','frame_count':4}))
log('talk -> '+t[:160]); m=re.search(r'job_id["\\s:]+([0-9a-f-]{36})',t); jobs.append(('talk',m.group(1) if m else None,4))
a2=Image.open('../full/A2.png').convert('RGBA'); face=a2.crop((38,0,70,32)).resize((128,128),Image.NEAREST)
for seed in (51,52):
    t=mcp.text(mcp.tool('edit_image_pixen',{'image_url':b64(face),'width':192,'height':192,'seed':seed,
        'description':'Redraw as a detailed close-up pixel art portrait for a fighting game super move cut-in: same woman, same face, long straight black hair, glowing red eyes, expressionless, black suit collar, white shirt, black tie. Crisp clean pixels, dark outline.'}))
    log(f'cutin{seed} -> '+t[:160]); m=re.search(r'job_id["\\s:]+([0-9a-f-]{36})',t); jobs.append((f'cutin{seed}',m.group(1) if m else None,0))
os.makedirs('../full/clips/talk2',exist_ok=True)
for n,j,nf in jobs:
    if not j: print('nojob',n); continue
    if nf:
        for _ in range(60):
            txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
            if 'complet' in txt.lower() or 'fail' in txt.lower(): break
            time.sleep(8)
        for i in range(nf+1):
            r=mcp.tool('get_image',{'job_id':j,'index':i}); im=[x for x in r['result']['content'] if x.get('type')=='image']
            if im: open(f'../full/clips/talk2/{i:02d}.png','wb').write(base64.b64decode(im[0]['data']))
        print('done talk',txt[:100])
    else:
        print('done',n,poll(j,f'../full/{n}.png')[:80])
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
