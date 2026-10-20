# 2차 대표 자세: 고른 체형 asset 에서 Pro Flash 편집(자세) → animate_image 4장 first=last 로 음영 복원 → 가운데 장을 핀으로 저장.
# 사용: SRC=<asset id> SHEET=<sheet png> OUT=<dir> python3 poses2.py [fight walk run]
import sys,json,time,base64,re,os
sys.path.insert(0,'.'); import mcp
from sheet import poll
SRC=os.environ['SRC']; OUT=os.environ.get('OUT','poses2'); os.makedirs(OUT,exist_ok=True)
KEEP=("Same woman as the source sprite: identical face, red eyes, long straight black hair to the waist, black pant suit, white shirt collar, black necktie, black leather gloves, black shoes, pistol holster on the right thigh. Identical head size, athletic feminine body proportions, pixel style, shading and palette, same 160x160 canvas with the figure the same height, still facing right in the same near-profile three-quarter view, transparent background. Change ONLY the pose: ")
POSES={
 'fight': "combat ready stance like a beat-em-up fighter: knees bent, weight low on the balls of the feet, feet wide apart along the ground line, upper body leaning slightly forward, left gloved hand raised open in front of the chest, right fist pulled back near the hip, hair hanging, calm face.",
 'walk': "walking forward, the contact pose of a walk cycle: right leg extended forward with heel touching the ground, left leg back with toe on the ground, arms swinging at the shoulders (left arm forward), upper body upright, hair trailing slightly behind.",
 'run': "sprinting forward hard, the contact pose: body leaning well forward, right leg extended forward with foot about to land, left leg kicked back high, arms bent at the elbows and pumping hard (left arm forward), hair streaming straight behind her, jacket hem lifted.",
}
def submit_edit(name,seed=7):
    r=mcp.tool('edit_image_pro_flash',{"source_image_id":SRC,"method":"text","description":KEEP+POSES[name],"no_background":True,"seed":seed}); t=mcp.text(r)
    open('spend.log','a').write(f"{time.strftime('%H:%M:%S')} pose2 {name} edit_image_pro_flash -> {t[:300]}\n")
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); a=re.search(r'image_id["\s:]+([0-9a-f-]{36})',t)
    print(name,'edit ->',m.group(1) if m else t[:200],flush=True); return (m.group(1) if m else None, a.group(1) if a else None)
def b64(p): return base64.b64encode(open(p,'rb').read()).decode()
def submit_shade(name):
    p=f'{OUT}/{name}-flat.png'
    r=mcp.tool('animate_image',{'first_frame_base64':b64(p),'last_frame_base64':b64(p),'frame_count':4,'seed':7,'action':'holds the pose almost perfectly still, only breathing: chest rises and falls by one pixel, hair tips drift by one pixel, feet planted, nothing else moves'}); t=mcp.text(r)
    open('spend.log','a').write(f"{time.strftime('%H:%M:%S')} pose2 {name} shade animate_image -> {t[:300]}\n")
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); print(name,'shade ->',m.group(1) if m else t[:200],flush=True); return m.group(1) if m else None
def fetch_frames(job,n,prefix):
    for _ in range(150):
        r=mcp.tool('get_image',{'job_id':job}); txt=mcp.text(r)
        if 'complet' in txt.lower(): break
        if 'fail' in txt.lower(): return 'FAIL '+txt[:300]
        time.sleep(8)
    for i in range(n+1):
        r=mcp.tool('get_image',{'job_id':job,'index':i}); imgs=[c for c in r['result']['content'] if c.get('type')=='image']
        if imgs: open(f'{prefix}-{i}.png','wb').write(base64.b64decode(imgs[0]['data']))
    return txt[:120]
names=sys.argv[1:] or list(POSES)
ids={}
jobs=[(n,)+submit_edit(n) for n in names]
for n,j,a in jobs:
    if j: print('edit done',n,poll(j,f'{OUT}/{n}-flat.png')[:80].replace('\n',' | '),flush=True); ids[n]=a
jobs2={n:submit_shade(n) for n in names if os.path.exists(f'{OUT}/{n}-flat.png')}
for n,j in jobs2.items():
    if j: print('shade done',n,fetch_frames(j,4,f'{OUT}/{n}-sh'),flush=True)
json.dump(ids,open(f'{OUT}/ids.json','w'))
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
