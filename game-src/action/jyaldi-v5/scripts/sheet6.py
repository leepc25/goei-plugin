# 6차 기준표: 설명만(일러스트 참고 없음). 128 캔버스(키 ~104) vs 160 캔버스(키 ~138), 팔레트 고정 유무.
import sys,time,re,os,json
sys.path.insert(0,'.'); import mcp
from sheet import poll
OUT='../sheet6'; os.makedirs(OUT,exist_ok=True)
def desc(h): return ("Pixel art player character sprite in the style of a 1996 Capcom CPS2 arcade belt-scroll beat-em-up, hand-pixeled look, crisp and high contrast, one full-body fighting ready stance, facing right in a near-profile three-quarter view. "
 "Adult Korean woman in her thirties, slim athletic feminine figure: narrow waist, rounded hips and thighs. Proportions like a Capcom arcade heroine: small head about one eighth of the height, legs about half of the height, arms reaching mid-thigh, hands smaller than the head with fingers loosely curled. "
 f"Figure about {h} pixels tall. Long straight black hair to the waist in a few big solid masses with one blue-grey highlight band, face open and simple: pale skin with one shadow tone, a sharp short eye line with a bright red eye, small eyebrow, no detailed nose or mouth, calm expressionless face. "
 "Black fitted pant suit with a hip-length jacket, crisp white shirt collar, black necktie, black leather gloves, black shoes, pistol holster on the right hip. "
 "The black suit is shaded in 4 clear value steps from near-black to light blue-grey, with long highlights along the outer arm, thigh and shin so the body shape reads; big clean clusters, no noise, no blur, no anti-aliasing. "
 "Solid dark outline around the whole figure. Weight on the front foot, knees bent, feet apart on one ground line, gloved hands raised in front. Transparent background.")
PAL=["#08080c","#15161e","#262836","#3c4156","#5f6a86","#97a4be","#f4f2ec","#c8c6c0","#f2d8c6","#d2a88e","#9a6e5c","#e0283a","#8c1c28","#2a1e22"]
specs=[('128',128,104,False,501),('128p',128,104,True,502),('160',160,138,False,503),('160p',160,138,True,504)]
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' sheet6 '+s+'\n')
jobs=[]
for n,W,h,pal,seed in specs:
    a=dict(description=desc(h),width=W,height=W,no_background=True,seed=seed)
    if pal: a.update(palette=PAL,palette_name='CPS2 black suit')
    t=mcp.text(mcp.tool('create_image_pro_flash',a)); log(f'{n} create_image_pro_flash -> {t[:160]}')
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); i=re.search(r'image_id["\s:]+([0-9a-f-]{36})',t)
    jobs.append((n,m.group(1) if m else None,i.group(1) if i else None)); print(n,t[:200].replace('\n',' '),flush=True)
for n,j,i in jobs:
    if j: print('done',n,poll(j,f'{OUT}/cand-{n}.png')[:120].replace('\n',' | '),flush=True)
json.dump({n:i for n,j,i in jobs},open(f'{OUT}/ids.json','w'))
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
