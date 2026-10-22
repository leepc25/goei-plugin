# NPC 기준 그림 후보: 쟈알디 기준표(sheet7 pixen-a)와 같은 생성기·설정·설명 틀. 사람당 4장(시드만 다름), 96×96, 옆모습 동쪽.
# 사용: python3 base.py [id...]   결과 ../base/<id>-<n>.png, 기록 ../spend.log
import sys,os,time,re,base64
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0,os.path.join(HERE,'../../jyaldi-v5/scripts')); import mcp
OUT=os.path.join(HERE,'../base'); LOG=os.path.join(HERE,'../spend.log')
def log(s): open(LOG,'a').write(time.strftime('%m-%d %H:%M:%S')+' '+s+'\n')
NPC={
 'jaemtri':(90,'Adult woman in her late 20s, curvy office figure, long wavy brown hair falling past the shoulders in loose curls, soft green eyes, warm smile. Black fitted skirt suit jacket and knee-length black pencil skirt, white shirt, black necktie, black stockings, black high heels. Standing relaxed with weight on one hip, near hand resting on the hip.'),
 'gognija':(94,'Lanky man in his mid 40s, wild unkempt shock of white hair, round black goggles over the eyes, big grin. Long white lab coat reaching the knees worn open over a white shirt and black necktie, black trousers, black shoes. Standing with both hands clasped in front.'),
 'dejure':(80,'Petite young woman in her early 20s with a full chest, very long pink twin tails reaching the waist, pink eyes, nervous expression, hunched apologetic posture. Black fitted skirt suit jacket and short black skirt, white shirt, black necktie, black shoes. Fingertips pressed together at the chest.'),
 'konjyuce':(84,'Teenage high school girl, slim, shoulder-length black bob with straight bangs and one pink streak at the side, blue eyes, bright confident face. Navy school blazer with grey trim, white shirt, grey striped necktie, grey pleated skirt, black knee socks, black shoes. Hands clasped behind her back.'),
 'madeokhee':(88,'Lean sharp woman in her mid 30s, black inverted bob with bangs, half-lidded eyes, thin crooked smile. Burgundy suit jacket and burgundy trousers, black mock-neck top, black loafers, thin gold bracelet. One hand holding the other wrist in front.'),
 'munhyeran':(94,'Tall slender long-limbed woman in her late 30s, brown hair in a low ponytail, sharp upturned eyes, dark red lipstick, confident grin. Dark brown suit jacket open over a black collared shirt, dark brown trousers, black pointed heels, heavy gold wristwatch. Near hand in the trouser pocket.'),
 'goyeonji':(88,'Slim calm woman doctor in her early 30s, long straight black hair with bangs, pale skin, expressionless. Long white doctor coat worn open over a light blue shirt, black trousers, black shoes, stethoscope around the neck. Hands in the coat pockets.'),
 'yunjia':(80,'Small soft young woman clinic assistant in her early 20s, apricot orange hair tied in two round buns on top of a bare head, short bangs, large gentle brown eyes, kind smile. White short-sleeved collared tunic with pink trim at the collar and sleeves, white trousers, white shoes, small beige pouch on the hip belt. Hands clasped in front.'),
 'shinyuri':(89,'Solid square-shouldered woman in her early 30s, long black hair slicked back into a tight ponytail, narrow dark eyes, hard stare. Black leather jacket over a dark grey t-shirt, black fitted trousers, black laced steel-toed boots. Arms folded across the chest.'),
 'survivor_f':(88,'Frightened ordinary young woman civilian, messy shoulder-length brown hair, oversized grey hoodie, blue jeans, white sneakers, dirt smudges on the clothes. Arms wrapped around herself.'),
 'survivor_m':(92,'Frightened ordinary middle-aged man civilian, short thinning black hair, rumpled beige jacket over a pale shirt with open collar, dark slacks, brown shoes, sweaty face. Hands raised near the chest.'),
 'missing_worker':(90,'Dazed exhausted young office worker man, messy black hair, white dress shirt half untucked with sleeves rolled, loosened grey necktie, dark grey slacks, black shoes, no jacket. Arms hanging limp.'),
 'passenger_3y':(90,'Gaunt haggard man with hollow cheeks, unkempt greying hair and stubble, threadbare old dark brown suit too big for him, frayed tie, worn shoes. Slumped, hands trembling at the sides.'),
 'passenger_pack':(90,'Wary scavenger woman, short messy black hair, dirty olive windbreaker, khaki cargo trousers, boots, large hiking backpack on her back. Both hands gripping the backpack shoulder straps.'),
 'worker_f':(88,'Exhausted young office worker woman pulling an all-nighter, dark brown hair in a loose low bun with strands falling out, tired eyes, navy cardigan over a white blouse, grey slacks, black flats, company ID lanyard around the neck. Arms hugging herself.'),
 'grandma':(80,'Small elderly Korean grandmother, short tight grey permed hair, kind wrinkled face, slightly hunched back, maroon knitted cardigan over a flower-patterned blouse, loose dark brown trousers, grey slip-on shoes. Hands clasped low in front.'),
 'grandpa':(86,'Thin elderly Korean grandfather, white crew-cut hair, deep wrinkles, slightly stooped, grey flat cap, beige padded vest over a checked shirt, dark brown trousers, black shoes. Hands clasped behind his back.'),
 'student':(86,'Ordinary teenage high school boy, short messy black hair, scared face, dark navy school blazer, white shirt, loose striped necktie, grey trousers, white sneakers. Arms tight at the sides.'),
 'child':(60,'Small frightened child about eight years old, round face, short black bowl haircut, bright yellow raincoat with the hood down, blue shorts, red rain boots. Hands clutching the front of the raincoat.'),
 'courier':(90,'Delivery courier man in his 30s, short black hair, blue baseball cap, blue delivery company vest over a grey long-sleeve shirt, black work trousers, sturdy grey sneakers, work gloves. Standing tense.'),
 'repairman':(92,'Elevator repair technician man in his 40s, short black hair with grey at the temples, navy one-piece work coverall with many pockets, tool belt at the waist, black safety boots. Standing alert.'),
 'pajama':(86,'Startled apartment resident woman in her 40s, hair in a messy clip, striped pastel blue pajamas, beige knitted shawl over the shoulders, pink house slippers. Clutching the shawl at the chest.'),
 'clerk':(88,'Young convenience store part-timer man, dyed ash brown hair, thin build, green-and-white store uniform vest over a white t-shirt, black jeans, white sneakers, name tag on the chest. Nervous stance.'),
 'cleaner':(84,'Middle-aged building cleaning worker woman, short black permed hair under a cloth headscarf, pink work apron over a lavender long-sleeve top, dark loose trousers, yellow rubber gloves, white rubber shoes. Standing worried.'),
 'hiker':(90,'Sturdy middle-aged hiker man, tanned face, short grey hair, bright red mountain jacket, black hiking trousers, brown hiking boots, wide-brim khaki bucket hat. Standing stiffly.'),
 'rider':(90,'Food delivery motorbike rider man in his 20s, black hair flattened, open black puffer jacket over a mint team t-shirt, black jogger trousers, black sneakers, knee protectors. Standing restless.'),
 'collegian':(90,'University student woman, long straight dark hair, round glasses, oversized cream knit sweater, long brown pleated skirt, white sneakers, tote bag strap over one shoulder. Hands gripping the strap.'),
 'lady':(88,'Middle-aged businesswoman, neat short dark bob, pearl earrings, grey tailored skirt suit, white blouse, black low heels. Composed but pale, hands clasped at the waist.'),
 'cook':(90,'Restaurant cook man in his 30s, short black hair, white double-breasted cook jacket, black checked cook trousers, black apron at the waist, black non-slip shoes. Wiping hands nervously.'),
 'staff_m':(92,'Ordinary office clerk man in his 30s, short neat black hair, plain face, white long-sleeved dress shirt tucked in, no tie, dark grey slacks, black belt, black shoes. Standing relaxed, arms at the sides.'),
 'staff_f':(87,'Ordinary office clerk woman in her late 20s, dark brown hair tied in a low ponytail, plain face, white long-sleeved blouse tucked in, dark navy slacks, black flat shoes. Standing relaxed, arms at the sides.'),
 'squad_m':(95,'Fit tactical response team man in his 30s, short cropped black hair, stern face, dark navy long-sleeved tactical shirt, dark navy cargo trousers, black belt, black combat boots, black gloves. No vest, no helmet. Standing upright, arms at the sides.'),
 'squad_f':(89,'Fit tactical response team woman in her late 20s, black hair in a tight bun, stern face, dark navy long-sleeved tactical shirt, dark navy cargo trousers, black belt, black combat boots, black gloves. No vest, no helmet. Standing upright, arms at the sides.'),
}
CANVAS={'dejure':84,'yunjia':84,'konjyuce':88,'grandma':84,'child':64,'cleaner':88,'student':88,'grandpa':88,'pajama':88}   # 작은 사람은 작은 캔버스로(그림 크기 = 키)
def desc(h,look):
    return ("Side-view pixel art sprite for a 1990s arcade belt-scroll beat-em-up, one full-body standing idle pose facing right, in profile. "
            f"Realistic proportions about 6.5 heads tall, figure about {h} pixels tall with the feet at the bottom edge. {look} "
            "Crisp clean pixel clusters, medium shading, dark outline, transparent background.")
def poll(job,out):
    for _ in range(90):
        r=mcp.tool('get_image',{'job_id':job}); txt=mcp.text(r)
        imgs=[c for c in r.get('result',{}).get('content',[]) if c.get('type')=='image']
        if imgs: open(out,'wb').write(base64.b64decode(imgs[0]['data'])); return 'ok'
        if 'fail' in txt.lower(): return 'ERR '+txt[:200]
        time.sleep(6)
    return 'timeout'
if __name__=='__main__':
    os.makedirs(OUT,exist_ok=True)
    ids=sys.argv[1:] or list(NPC)
    b0=mcp.text(mcp.tool('get_balance',{})).split('\n')[1]; print('before',b0,flush=True)
    jobs=[]
    for id in ids:
        h,look=NPC[id]
        for n,seed in enumerate((711,721,731,741)):
            n=n+int(os.environ.get('NOFF','0'))
            cv=CANVAS.get(id,96); a=dict(description=desc(h,look),width=cv,height=cv,no_background=True,view='side',direction='east',
                   outline='single color black outline',detail='medium detail',seed=seed)
            if os.path.exists(f'{OUT}/{id}-{n}.png'): continue
            import pl; jobs.append((id,n,pl.submit('create_image_pixen',a,f'base {id}-{n}')))
    for id,n,j in jobs:
        if j: print(id,n,poll(j,f'{OUT}/{id}-{n}.png'),flush=True)
    b1=mcp.text(mcp.tool('get_balance',{})).split('\n')[1]; print('after',b1,flush=True); log(f'base batch {b0} -> {b1}')
