# 2차 기준표: 캡콤 CPS2 렌더링 + 여성 운동선수 체형(수수깡 아님). create_image_pro_flash 160 canvas, seeds 401..
import sys,json,time,base64,re,os
sys.path.insert(0,'.'); import mcp
from sheet import poll
DESC=("Pixel art player character sprite in the style of a 1996 Capcom CPS2 arcade belt-scroll beat-em-up, one full-body ready stance, facing right in a near-profile three-quarter view. "
"Adult Korean woman in her thirties, athletic feminine figure with real volume: defined shoulders, narrow waist, rounded hips and full thighs, NOT a stick figure and NOT bulky, about 7 heads tall, figure about 130 pixels tall from top of head to soles. "
"Long straight black hair to the waist drawn as a few big solid masses, pale skin, red eyes with the near eye a clear red dot, calm face. Black fitted two-piece pant suit, white shirt collar, black necktie, black leather gloves, black dress shoes, pistol holster on the right thigh. "
"The black suit is shaded in 4 clear value steps from near-black up to light blue-grey highlights on the shoulders, chest, hip and thigh so the body reads as solid rounded volume; big simple clusters, no fine noise, no tiny wrinkles. "
"Dark colored outlines (not pure black) around the whole figure so it separates from any floor. Ready stance with the weight on the front foot, knees slightly bent, feet apart on one ground line, gloved hands open and slightly raised, body turned a little toward the viewer. "
"About 16 colors, light from the upper left, transparent background, whole figure inside the canvas with the soles 10 pixels above the bottom edge.")
PAL=["#0c0c12","#1a1b24","#2b2e3b","#4a5064","#7d879c","#e8e6e0","#c9c7c0","#f0d6c4","#d4b09a","#d12b3a","#8a2430","#6b4a3a","#111115","#3a3540","#b0b8c8","#f8f8f4"]
W=160
def submit(seed,pal):
    args={"description":DESC,"width":W,"height":W,"no_background":True,"seed":seed}
    if pal: args["palette"]=PAL; args["palette_name"]="jyaldi-cps2"
    r=mcp.tool('create_image_pro_flash',args); t=mcp.text(r)
    open('spend.log','a').write(f"{time.strftime('%H:%M:%S')} sheet2 seed={seed} pal={pal} create_image_pro_flash -> {t[:300]}\n")
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); a=re.search(r'image_id["\s:]+([0-9a-f-]{36})',t)
    print('seed',seed,'pal',pal,'->',m.group(1) if m else t[:200],'asset',a.group(1) if a else None,flush=True)
    return (m.group(1) if m else None, a.group(1) if a else None)
os.makedirs('sheet2',exist_ok=True)
specs=[(401,False),(402,False),(403,True),(404,True)]
jobs=[(s,p)+submit(s,p) for s,p in specs]
ids={}
for s,p,j,a in jobs:
    if j: print('done',s,poll(j,f'sheet2/cand-{s}.png')[:100].replace('\n',' | '),flush=True); ids[s]=a
json.dump(ids,open('sheet2/ids.json','w'))
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
