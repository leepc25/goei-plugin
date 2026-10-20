# 체형 비교 후보: 102(13b5085c)를 원본으로 두고 비율만 바꾼 편집. 결과는 body/cand-2xx.png
import sys,json,time,base64,re,os
sys.path.insert(0,'.'); import mcp
from sheet import poll
SRC='13b5085c-0c3f-56a4-88be-134ed8813335'
KEEP=("Same woman as the source sprite: identical face, red eyes, long straight black hair to the waist, black pant suit, white shirt collar, black necktie, black leather gloves, black shoes, pistol holster on the right hip, same standing idle pose facing right in the same near-profile three-quarter view, transparent background, same 160x160 canvas, soles 8 pixels above the bottom edge. ")
V={
 201:(7, KEEP+"Redraw her in classic Capcom CPS2 beat-em-up proportions: about 6 heads tall, figure about 128 pixels tall, noticeably broader shoulders, thicker upper arms and thighs, larger gloved hands and shoes, solid chunky silhouette, bold shading in 3 tones per color with bright highlights on the jacket folds, hair and shoe tops, outlines in a dark hue of each color. Keep the face feminine and calm."),
 202:(11, KEEP+"Redraw her in classic Capcom CPS2 beat-em-up proportions: about 6 heads tall, figure about 128 pixels tall, noticeably broader shoulders, thicker upper arms and thighs, larger gloved hands and shoes, solid chunky silhouette, bold shading in 3 tones per color with bright highlights on the jacket folds, hair and shoe tops, outlines in a dark hue of each color. Keep the face feminine and calm."),
 301:(7, KEEP+"Redraw her much smaller, figure exactly 96 pixels tall from top of head to soles, in classic Capcom CPS2 beat-em-up proportions: about 5.5 heads tall, broad shoulders, big gloved hands and shoes, thick thighs, chunky readable silhouette, 16 colors, bold 3-tone shading with highlights, outlines in a dark hue of each color, no thin one-pixel details, keep the face readable with the red near eye."),
}
jobs=[]
for k,(seed,desc) in V.items():
    r=mcp.tool('edit_image_pro_flash',{"source_image_id":SRC,"method":"text","description":desc,"no_background":True,"seed":seed}); t=mcp.text(r)
    open('spend.log','a').write(f"{time.strftime('%H:%M:%S')} body {k} seed={seed} edit_image_pro_flash -> {t[:300]}\n")
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); a=re.search(r'image_id["\s:]+([0-9a-f-]{36})',t)
    print(k,'->',m.group(1) if m else t[:200],'asset',a.group(1) if a else None,flush=True); jobs.append((k,m.group(1) if m else None,a.group(1) if a else None))
ids={}
for k,j,a in jobs:
    if j: t=poll(j,f'body/cand-{k}.png'); ids[k]=a; print('done',k,t[:150].replace('\n',' | '),flush=True)
json.dump(ids,open('body/ids.json','w'))
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
