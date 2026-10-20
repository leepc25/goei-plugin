# 4차 기준표: 사용자 GPT 일러스트(팔 긴 판) → 도트. 방식 3가지 비교.
import sys,json,time,base64,re,io,os
sys.path.insert(0,'.'); import mcp
from sheet import poll
from PIL import Image
OUT='../sheet4'
src=Image.open(f'{OUT}/gpt-ref-longarm.png').convert('RGB').crop((40,0,1000,1520))
b=io.BytesIO(); src.save(b,'PNG'); SRC='data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
small=src.resize((92,146),Image.LANCZOS)
sb=io.BytesIO(); small.save(sb,'PNG'); SMALL=base64.b64encode(sb.getvalue()).decode()
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' sheet4 '+s+'\n')
def jid(t): m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); return m.group(1) if m else None
jobs=[]
for name,args in [
  ('i2p-f150',dict(image_url=SRC,output_width=92,output_height=146,faithful=True,init_image_strength=150,seed=1)),
  ('i2p-f250',dict(image_url=SRC,output_width=92,output_height=146,faithful=True,init_image_strength=250,seed=1)),
  ('i2p-free',dict(image_url=SRC,output_width=92,output_height=146,seed=1))]:
    t=mcp.text(mcp.tool('image_to_pixelart',args)); log(f'{name} image_to_pixelart(1) -> {t[:200]}'); jobs.append((name,jid(t)))
t=mcp.text(mcp.tool('image_to_pixelart_pro_flash',dict(image_url=SRC,description='1990s Capcom CPS2 arcade beat-em-up character sprite, clean pixel clusters, dark outline',max_colors=32,seed=1)))
log(f'pf-conv image_to_pixelart_pro_flash(6) -> {t[:200]}'); jobs.append(('pf-conv',jid(t)))
DESC=("Pixel art sprite of the exact character in the style image, same pose, same proportions, same outfit: tall woman in a black pant suit, white shirt, black tie, black gloves, pistol holster on the right hip, long straight black hair, red eyes, facing right in a fighting ready stance. "
 "1990s Capcom CPS2 arcade belt-scroll sprite rendering: big clean color clusters, black suit shaded in 4 steps up to blue-grey highlights along arms and thighs, dark outline, transparent background, figure about 142 pixels tall.")
t=mcp.text(mcp.tool('create_image_pro_flash',dict(description=DESC,width=160,height=160,no_background=True,seed=4,style_image=dict(base64=SMALL,usage_description='This is the character to draw. Copy its proportions, pose, face and outfit exactly.'))))
log(f'pf-style create_image_pro_flash(6) -> {t[:200]}'); jobs.append(('pf-style',jid(t)))
print(jobs,flush=True)
for n,j in jobs:
    if j: print('done',n,poll(j,f'{OUT}/cand-{n}.png')[:150].replace('\n',' | '),flush=True)
print(mcp.text(mcp.tool('get_balance',{})))
