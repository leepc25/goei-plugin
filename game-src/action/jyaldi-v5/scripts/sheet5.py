# 5차 기준표: 사용자 GPT 일러스트 첫 판(gpt-ref-a, 팔·손 보통) + 다리 조금 짧게. 스타일 참고 생성 2장.
import sys,time,base64,re,io
sys.path.insert(0,'.'); import mcp
from sheet import poll
from PIL import Image
OUT='../sheet4'
ref=Image.open(f'{OUT}/gpt-ref-a.png').convert('RGB').crop((40,0,1000,1520))
CUT=650  # 대략 골반 아래. 그 아래(다리)만 세로 85%로 줄임
top=ref.crop((0,0,960,CUT)); leg=ref.crop((0,CUT,960,1520)); leg=leg.resize((960,int(leg.height*0.85)),Image.LANCZOS)
sq=Image.new('RGB',(960,CUT+leg.height),ref.getpixel((5,5))); sq.paste(top,(0,0)); sq.paste(leg,(0,CUT)); sq.save(f'{OUT}/gpt-ref-a-shortleg.png')
def small(im):
    s=im.resize((round(im.width*146/im.height),146),Image.LANCZOS); b=io.BytesIO(); s.save(b,'PNG'); return base64.b64encode(b.getvalue()).decode()
DESC=("Pixel art sprite of the exact character in the style image, same pose, same outfit: woman in a black pant suit, white shirt, black tie, black gloves, pistol holster on the right hip, long straight black hair, red eyes clearly visible, facing right in a fighting ready stance. "
 "Balanced proportions: legs a little shorter than in the style image (legs about half of the total height), arms reach mid-thigh, hands smaller than the head with fingers loosely curled. "
 "1990s Capcom CPS2 arcade belt-scroll sprite rendering: big clean color clusters, black suit shaded in 4 steps up to blue-grey highlights along arms and thighs, dark outline around the figure, transparent background, figure about 138 pixels tall.")
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' sheet5 '+s+'\n')
jobs=[]
for name,im,seed in [('a-short',sq,5),('a-text',ref,5)]:
    t=mcp.text(mcp.tool('create_image_pro_flash',dict(description=DESC,width=160,height=160,no_background=True,seed=seed,style_image=dict(base64=small(im),usage_description='This is the character to draw. Copy its pose, face and outfit.'))))
    log(f'{name} create_image_pro_flash(6) -> {t[:200]}'); m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append((name,m.group(1) if m else None)); print(name,t[:300],flush=True)
for n,j in jobs:
    if j: print('done',n,poll(j,f'{OUT}/cand-{n}.png')[:200].replace('\n',' | '),flush=True)
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
