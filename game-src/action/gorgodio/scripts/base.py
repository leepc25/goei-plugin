# 고르고디오 맨몸 기준 그림 후보: 쟈알디 기준표 A(sheet7 pixen-a)와 같은 생성기·같은 설명 틀·같은 외곽선으로 톤을 맞춤 (2026-10-22 사용자 "쟈알디와 톤이 맞아야")
# pixen 4장 + pixflux 4장(쟈알디 A2 색 + 피부·눈 색을 강제 팔레트로). 장당 1회.
import sys,time,re,os,base64
sys.path.insert(0,'.'); import mcp
from PIL import Image
OUT='../base'; os.makedirs(OUT,exist_ok=True)
D=("Side-view pixel art sprite for a 1990s arcade belt-scroll beat-em-up, one full-body standing ready pose facing right in profile. "
 "Huge adult man two meters tall, realistic proportions about 7 heads tall, figure about 100 pixels tall, massive wrestler build with a very broad chest, thick neck, thick arms held slightly away from the body, narrower waist. "
 "Completely bald head, thick dark eyebrows, amber eyes, short dark goatee on the chin and light stubble, confident faint smile. "
 "Black leather biker jacket with an asymmetric zipper and silver studs on the collar, worn open over a white dress shirt and black necktie, black trousers, black boots, feet apart. "
 "Black clothing with blue-grey highlights so the body shape reads, crisp clean pixel clusters, dark outline, transparent background.")
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' base '+s+'\n')
def pal_png():
    a=Image.open('../../jyaldi-v5/full/A2.png').convert('RGBA')
    cols={c for c in a.getdata() if c[3]>0}
    extra=[(0xf0,0xc8,0xa0),(0xd9,0xa4,0x7c),(0xb0,0x7a,0x56),(0x7a,0x4e,0x34),(0x4a,0x30,0x22),(0xd0,0x8a,0x2a),(0xc8,0xcc,0xd0)]
    cols=sorted({c[:3] for c in cols}|set(extra))
    im=Image.new('RGB',(len(cols),1)); im.putdata(cols); p='../base/palette.png'; im.save(p)
    return 'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode()
def poll(job,out):
    for _ in range(90):
        r=mcp.tool('get_image',{'job_id':job}); txt=mcp.text(r)
        imgs=[c for c in r.get('result',{}).get('content',[]) if c.get('type')=='image']
        if imgs: open(out,'wb').write(base64.b64decode(imgs[0]['data'])); return 'ok'
        if 'fail' in txt.lower(): return 'ERR '+txt[:300]
        time.sleep(6)
    return 'timeout'
if __name__=='__main__':
    PAL=pal_png()
    specs=[(f'pixen-{s}','create_image_pixen',dict(outline='single color black outline',detail='medium detail',seed=s)) for s in (801,802,803,804)]
    specs+=[(f'flux-{s}','create_image_pixflux',dict(outline='single color black outline',shading='medium shading',detail='medium detail',seed=s,color_image_url=PAL)) for s in (811,812,813,814)]
    jobs=[]
    for n,tool,extra in specs:
        a=dict(description=D,width=112,height=112,no_background=True,view='side',direction='east'); a.update(extra)
        t=mcp.text(mcp.tool(tool,a)); log(f'{n} {tool} -> {t[:120]}')
        m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append((n,m.group(1) if m else None)); print(n,t[:120].replace('\n',' '),flush=True)
    for n,j in jobs:
        if j: print('done',n,poll(j,f'{OUT}/cand-{n}.png'),flush=True)
    print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
