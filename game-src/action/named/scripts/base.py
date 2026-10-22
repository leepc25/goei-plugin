# 아벤샤·브라우니·탐미주의 기준 그림 후보: 백일몽 base.py와 같은 생성기(pixen)·문장 틀로 쟈알디 A2 톤에 맞춤. 장당 1회. 결과 ../<id>/base/cand-<seed>.png
# 사용: python3 base.py [id...] [--seeds 1,2,3,4]
import sys,time,re,os
sys.path.insert(0,'../../jyaldi-v5/scripts'); import mcp
from sheet import poll
HEAD=("Side-view pixel art sprite for a 1990s arcade belt-scroll beat-em-up, one full-body standing pose facing right in strict side profile, "
      "we see only the side of the face and body. ")
CLEAN=" Crisp clean pixel clusters, single color black outline, transparent background."
C={
 'avensha':(100,("Curvy adult woman witch, realistic proportions about 7.5 heads tall, figure about 90 pixels tall including the hood. "
   "Long wavy dark teal-blue hair flowing out of the hood down over her chest, emerald green eyes, calm gentle smile. "
   "Dark purple plain old-fashioned hooded cloak, hood up, cloak hanging to the ankles, fastened at the chest with one large green emerald brooch, "
   "cloak open at the front showing a black pinstripe business suit jacket, white dress shirt, black necktie, black suit trousers, black shoes. "
   "Standing calmly upright, the near hand resting on the brooch at her chest, the far hand on her hip.")
   +" Black suit with blue-grey highlights so the body shape reads, the purple cloak muted and desaturated."+CLEAN),
 'brownie':(136,("Huge heavy man-shaped figure, realistic adult proportions, figure about 126 pixels tall, very broad shoulders and a thick chest. "
   "His head is an old boxy CRT television set with a dark brown wooden casing and a bulging back, the screen faces forward to the right, "
   "the screen is blank dark grey-green glass with nothing on it. "
   "Sharp brown three-piece suit with wide lapels and a buttoned vest, white dress shirt, dark necktie, white pocket square, "
   "black show-host gloves, black lace-up dress shoes. Standing upright and poised, both gloved hands in front of his chest adjusting a glove.")
   +" Muted brown suit with three shading steps, gloves dark blue-grey with highlights so they read against the outline."+CLEAN),
 'aestheticism':(116,("Tall slender woman-shaped store mannequin, realistic human proportions and volume about 7.5 heads tall, figure about 106 pixels tall: "
   "broad shoulders, ribcage, narrow waist, hips, full thighs and calves, long legs. "
   "Smooth matte off-white plaster mannequin body with visible ball-joint seams at the shoulders, elbows, wrists, waist and knees, "
   "sexless mannequin torso with no chest detail, mannequin feet shaped like high heels. "
   "Long messy bright red hair down to the waist covering the front of the body, glowing red eyes, freckles, crooked lopsided smile, "
   "a thick stitched scar across the neck. Arms hanging limp at the sides, head tilted to one side.")
   +" Plaster body shaded in three warm grey steps so the volume reads."+CLEAN),
}
SEEDS=[int(s) for s in (sys.argv[sys.argv.index('--seeds')+1].split(',') if '--seeds' in sys.argv else '921,922,923,924'.split(','))]
LOG='../spend.log'
def log(s): open(LOG,'a').write(time.strftime('%F %T')+' base '+s+'\n')
if __name__=='__main__':
    ids=[a for a in sys.argv[1:] if a in C] or list(C)
    b=mcp.text(mcp.tool('get_balance',{})).split('\n')[1]; print('before',b,flush=True); log('before '+b)
    jobs=[]; have={}
    for ln in open(LOG):
        m=re.search(r' base (\S+) s(\d+) -> id: ([0-9a-f-]{36})',ln)
        if m: have[(m.group(1),int(m.group(2)))]=m.group(3)
    for i in ids:
        W,d=C[i]; os.makedirs(f'../{i}/base',exist_ok=True)
        for s in SEEDS:
            a=dict(description=HEAD+d,width=W,height=W,no_background=True,view='side',direction='east',
                   outline='single color black outline',detail='medium detail',seed=s)
            if (i,s) in have:
                if not os.path.exists(f'../{i}/base/cand-{s}.png'): print('done',i,s,poll(have[(i,s)],f'../{i}/base/cand-{s}.png')[:60],flush=True)
                continue
            for k in range(600):   # 계정 동시 작업 20개 한도를 다른 스레드와 같이 씀 → 자리 날 때까지
                try: t=mcp.text(mcp.tool('create_image_pixen',a))
                except Exception as e: t='EXC '+str(e)
                if 'rate' in t.lower() or 'too many' in t.lower() or t.startswith('EXC'): time.sleep(20); continue
                break
            log(f'{i} s{s} -> {t[:100]}')
            m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); j=m.group(1) if m else None; print(i,s,t[:80].replace('\n',' '),flush=True)
            if j: print('done',i,s,poll(j,f'../{i}/base/cand-{s}.png')[:60].replace('\n',' | '),flush=True)   # 동시 작업 1개만(사용자 03:12): 받은 뒤 다음
    for i,s,j in jobs:
        if j and not os.path.exists(f'../{i}/base/cand-{s}.png'): print('done',i,s,poll(j,f'../{i}/base/cand-{s}.png')[:60].replace('\n',' | '),flush=True)
    b=mcp.text(mcp.tool('get_balance',{})).split('\n')[1]; print('after',b); log('after '+b)
