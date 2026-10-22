# 백일몽 기준 그림 후보: 쟈알디·스팡달 기준과 같은 생성기(pixen)·문장 틀로 톤을 맞춤. 장당 1회. 결과 ../base/<id>/cand-<n>.png
# 사용: python3 base.py [id...]
import sys,time,re,os
sys.path.insert(0,'../../jyaldi-v5/scripts'); import mcp
from sheet import poll
HEAD=("Side-view pixel art sprite for a 1990s arcade belt-scroll beat-em-up, one full-body standing pose facing right in strict side profile, "
      "we see only the side of the face and body. ")
TAIL=" Navy suit with blue-grey highlights so the body shape reads, crisp clean pixel clusters, single color black outline, transparent background."
C={
 'jaheon':(108,("Tall heavy adult man, realistic proportions about 7.5 heads tall, figure about 100 pixels tall, broad chest, perfectly upright rigid posture like a statue. "
   "Swept-back short white hair, strikingly handsome expressionless face, red-brown eye. "
   "No jacket: dark navy suit vest buttoned over a white dress shirt with sleeves rolled to the forearms, dark navy necktie, dark suit trousers, black dress shoes, "
   "white cotton work gloves on both hands. Arms hanging straight at his sides, empty hands.")),
 'jaheon2':(108,("Tall heavy young man in his early thirties, realistic proportions about 7.5 heads tall, figure about 100 pixels tall, broad chest, perfectly upright rigid posture like a statue. "
   "Swept-back short pure white hair on a young man, strikingly handsome smooth youthful face like a model, no wrinkles, expressionless, red eyes. "
   "No jacket: dark navy suit vest buttoned over a white dress shirt with sleeves rolled to the forearms, dark navy necktie, dark suit trousers, black dress shoes, "
   "white cotton work gloves on both hands. Arms hanging straight at his sides, empty hands.")),
 'haje':(92,("Lean adult woman, realistic proportions about 7 heads tall, figure about 88 pixels tall, tired slouched shoulders, weight on one leg. "
   "Chin-length straight dark navy blue bob with bangs, pale skin, sharp tired grey eyes, cold flat expression. "
   "Dark navy pantsuit: jacket, white shirt, dark navy necktie, straight trousers, black flat shoes, dark leather gloves. "
   "Arms loosely crossed in front of her chest.")),
 'minseong':(104,("Big broad adult man, sports-major build, realistic proportions about 7 heads tall, figure about 98 pixels tall, very thick chest and shoulders, slightly hunched nervous posture. "
   "Short messy brown hair, warm friendly face with an anxious smile, sweat drop on the temple. "
   "Dark navy suit stretched tight over muscle, white shirt, dark navy necktie, black shoes, employee ID badge clipped on the chest. "
   "Arms hanging at his sides, empty hands.")),
 'nasol':(96,("Tall slender adult woman, realistic proportions about 7.5 heads tall, figure about 92 pixels tall, upright cold posture. "
   "Glossy black hair tied in a neat high ponytail with straight blunt bangs, pale skin, sharp bored dark eyes, flat irritated expression. "
   "Fitted dark navy suit jacket and trousers, white shirt with an open deep collar, dark navy necktie, black hard heeled shoes, long pointed black nails. "
   "Arms crossed in front of her chest.")),
 'seonghae':(88,("Small slight adult woman, realistic proportions about 6.5 heads tall, figure about 82 pixels tall, light bouncy posture on her toes. "
   "Long wavy white hair tied low and draped forward over her near shoulder, straight bangs, pale skin, bright green eyes, wide cheerful closed-mouth smile. "
   "Dark navy pantsuit: jacket, white shirt, dark navy necktie, trousers, white cushioned running sneakers. "
   "Hands clasped behind her back.")),
 'grunt_m':(100,("Average adult man, realistic proportions about 7 heads tall, figure about 94 pixels tall, neutral posture. "
   "Very short cropped dark hair, plain neutral face. Dark navy suit, white shirt, dark navy necktie, black shoes, employee ID badge on the chest. "
   "Arms hanging at his sides, empty hands.")),
 'grunt_f':(92,("Average adult woman, realistic proportions about 7 heads tall, figure about 88 pixels tall, neutral posture. "
   "Short dark hair tucked behind the ears, plain neutral face. Dark navy pantsuit, white shirt, dark navy necktie, black flat shoes, employee ID badge on the chest. "
   "Arms hanging at her sides, empty hands.")),
}
SEEDS=[911,912,913,914]
def log(s): open('../spend.log','a').write(time.strftime('%F %T')+' base '+s+'\n')
if __name__=='__main__':
    ids=sys.argv[1:] or list(C)
    b=mcp.text(mcp.tool('get_balance',{})).split('\n')[1]; print('before',b,flush=True); log('before '+b)
    jobs=[]; have={}
    for ln in open('../spend.log'):
        m=re.search(r' base (\S+) s(\d+) -> id: ([0-9a-f-]{36})',ln)
        if m: have[(m.group(1),int(m.group(2)))]=m.group(3)
    for (i,s),j in have.items():
        if i in ids and not os.path.exists(f'../base/{i}/cand-{s}.png'): jobs.append((i,s,j))
    for i in ids:
        W,d=C[i]; os.makedirs(f'../base/{i}',exist_ok=True)
        for s in SEEDS:
            if (i,s) in have: continue
            a=dict(description=HEAD+d+TAIL,width=W,height=W,no_background=True,view='side',direction='east',
                   outline='single color black outline',detail='medium detail',seed=s)
            for k in range(20):
                t=mcp.text(mcp.tool('create_image_pixen',a))
                if 'rate' in t.lower() or 'too many' in t.lower(): time.sleep(20); continue
                break
            log(f'{i} s{s} -> {t[:100]}')
            m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append((i,s,m.group(1) if m else None)); print(i,s,t[:80].replace('\n',' '),flush=True)
    for i,s,j in jobs:
        if j: print('done',i,s,poll(j,f'../base/{i}/cand-{s}.png')[:60].replace('\n',' | '),flush=True)
    b=mcp.text(mcp.tool('get_balance',{})).split('\n')[1]; print('after',b); log('after '+b)
