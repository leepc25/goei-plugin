import sys,json,time,base64,re,os
sys.path.insert(0,'.'); import mcp
from sheet import poll
SRC='13b5085c-0c3f-56a4-88be-134ed8813335'
KEEP=("Same woman as the source sprite: identical face, red eyes, long straight black hair to the waist, black pant suit, white shirt collar, black necktie, black leather gloves, black shoes, pistol holster on the right hip, same standing idle pose facing right in the same near-profile three-quarter view, transparent background, same 160x160 canvas, soles 8 pixels above the bottom edge. ")
D=KEEP+"Keep her feminine and athletic, NOT bulky: only slightly broader shoulders and slightly thicker arms and thighs than the source, hands and shoes a little larger, figure about 132 pixels tall. The main change is rendering: bold 3-tone shading per color with bright highlights on the jacket, trousers folds, hair and shoe tops so the body reads as solid volume like a Capcom CPS2 beat-em-up heroine, outlines in a dark hue of each color, about 20 colors."
V={203:7,204:11}
jobs=[]
for k,seed in V.items():
    r=mcp.tool('edit_image_pro_flash',{"source_image_id":SRC,"method":"text","description":D,"no_background":True,"seed":seed}); t=mcp.text(r)
    open('spend.log','a').write(f"{time.strftime('%H:%M:%S')} body {k} seed={seed} edit_image_pro_flash -> {t[:300]}\n")
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); a=re.search(r'image_id["\s:]+([0-9a-f-]{36})',t)
    print(k,'->',m.group(1) if m else t[:200],'asset',a.group(1) if a else None,flush=True); jobs.append((k,m.group(1) if m else None,a.group(1) if a else None))
ids=json.load(open('body/ids.json'))
for k,j,a in jobs:
    if j: print('done',k,poll(j,f'body/cand-{k}.png')[:100].replace('\n',' | '),flush=True); ids[str(k)]=a
json.dump(ids,open('body/ids.json','w'))
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
