import sys,json,time,base64,re,os
sys.path.insert(0,'.'); import mcp
from sheet import poll
SRC='13b5085c-0c3f-56a4-88be-134ed8813335'  # cand-102 asset id
KEEP=("Same woman as the source sprite: identical face, red eyes, long straight black hair to the waist, black pant suit, white shirt collar, black necktie, black gloves, black shoes, pistol holster on the right hip. Identical head size, body proportions, pixel style, outline hue and palette, same 160x160 canvas with the figure the same height, still facing right in the same near-profile three-quarter view, transparent background. Change ONLY the pose: ")
POSES={
 'fight-idle': "combat ready stance, knees slightly bent, weight on the balls of the feet, feet apart along the ground line, left gloved hand raised open in front of the chest, right hand low near the holster, hair hanging straight, calm face.",
 'walk-contact': "walking forward, the contact pose of a calm walk cycle: right leg extended forward with heel touching the ground, left leg back with toe on the ground, arms swinging a little at the shoulders (left arm forward), upper body upright and steady, hair trailing slightly behind.",
 'run-contact': "running forward hard in a combat sprint, the contact pose: body leaning forward, right leg extended forward with foot about to land, left leg kicked back, arms bent at the elbows and pumping (left arm forward), hair streaming behind her, jacket hem lifted.",
 'jump-apex': "at the top of a jump, both feet off the ground tucked slightly under her, knees bent, arms slightly out for balance, hair floating upward, jacket hem lifted, figure centered on the canvas with clear air below the shoes.",
 'palm-strike': "first hit of a melee combo: she has stepped forward and thrust her open gloved left palm straight ahead at chest height, arm fully extended to the right, right hand kept back near the hip, shoulders turned into the strike, feet planted wide, hair swinging a beat behind.",
 'pistol-fire': "firing a pistol: right arm fully extended to the right holding a black pistol level at shoulder height, left hand relaxed at the side, feet shoulder width apart and planted, small muzzle flash at the barrel, upper body steady, calm face.",
}
def submit(name,seed=7):
    args={"source_image_id":SRC,"method":"text","description":KEEP+POSES[name],"no_background":True,"seed":seed}
    r=mcp.tool('edit_image_pro_flash',args); t=mcp.text(r)
    open('spend.log','a').write(f"{time.strftime('%H:%M:%S')} pose {name} seed={seed} edit_image_pro_flash -> {t[:300]}\n")
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); a=re.search(r'image_id["\s:]+([0-9a-f-]{36})',t)
    print(name,'->',(m.group(1) if m else t[:200]), 'asset', a.group(1) if a else None)
    return (m.group(1) if m else None, a.group(1) if a else None)
if __name__=='__main__':
    names=sys.argv[1:] or list(POSES)
    seed=int(os.environ.get('SEED','7'))
    jobs=[(n,)+submit(n,seed) for n in names]
    ids={}
    for n,j,a in jobs:
        if not j: continue
        t=poll(j,f'poses/{n}-s{seed}.png'); ids[n]=a; print('done',n,t[:120].replace('\n',' | '))
    json.dump(ids,open(f'poses/ids-s{seed}.json','w'))
    print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
