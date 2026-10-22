# 사람이 아닌 잡몹 클립: animate_image(v3, 글 동작). 받은 장 0 = 넣은 기준 그림 그대로, 1..n = 생성.
# 표 한 줄 = 작업 하나: (몹, 작업 이름, 동작 글, 장 수, {클립: [쓸 장 번호]}, 시작 그림(없으면 base.png))
# 사용: python3 anim.py [kind...]
import sys,time,base64,re,os
sys.path.insert(0,os.path.dirname(__file__)); import mcp
from defs import M
from PIL import Image
ROOT=os.path.join(os.path.dirname(__file__),'..')
J=[
 # 다리 많은 새끼 (천장 기기 = walk 상하 반전, 코드)
 ('crawler','walk','scuttling forward on its eight finger-tipped legs, legs moving in alternating waves, body level',8,{'walk':[2,4,6,8]},None),
 ('crawler','idle','legs twitching and fingers flexing in place, body stays still',4,{'idle':[1,3]},None),
 ('crawler','nip','rears up lifting its front legs high, then lunges forward and snaps its mouth down, then settles back',6,{'nip_tele':[1,2],'nip_hit':[3,4],'nip_rec':[5]},None),
 ('crawler','drop','drops from above, legs spread wide in the air, then lands flat and legs brace on the ground',4,{'drop':[2,4]},None),
 ('crawler','hurt','flinches, legs curl inward briefly',4,{'hurt':[1,2]},None),
 ('crawler','flip','flips over onto its back, legs curling and twitching in the air, dying',4,{'flip':[2,4]},None),
 # 모서리 조각
 ('edge','idle','slowly rotating in place in mid-air, faces turning to show different colored sides',4,{'idle':[1,2,3,4]},None),
 ('edge','spin','folds itself tighter, then flicks out sharply as a small shard flies off, then unfolds',4,{'spin_tele':[1,2],'spin_hit':[3],'spin_rec':[4]},None),
 ('edge','cut','turns its sharpest edge forward, then stretches its blade edge long and thin, then snaps back',4,{'cut_tele':[1],'cut_hit':[2,3],'cut_rec':[4]},None),
 ('edge','shatter','cracks apart and shatters into scattering fragments that fade',4,{'shatter':[1,2,4]},None),
 # 얼룩 손 (기준 그림 = 솟은 손 → 가라앉는 장면을 뽑아 거꾸로도 씀)
 ('shade','sink','the black hands clench into grasping fists, then sink down into the ground until gone',4,{'rise':[4,0,1,3]},None),
 # 먼지 생활용품
 ('dusty_table','walk','scuttling forward on its four human legs, dust shaking off',4,{'walk':[1,2,3,4]},None),
 ('dusty_table','idle','legs fidgeting in place',4,{'idle':[1,3]},None),
 ('dusty_table','bump','tilts back on its legs, then rams forward, then settles',4,{'bump_tele':[1],'bump_hit':[2],'bump_rec':[4]},None),
 ('dusty_table','break','cracks and collapses, legs curling up',4,{'hurt':[1],'break':[2,4]},None),
 ('dusty_chair','walk','scuttling forward on its four human legs, dust shaking off',4,{'walk':[1,2,3,4]},None),
 ('dusty_chair','idle','legs fidgeting in place',4,{'idle':[1,3]},None),
 ('dusty_chair','bump','tilts back on its legs, then rams forward, then settles',4,{'bump_tele':[1],'bump_hit':[2],'bump_rec':[4]},None),
 ('dusty_chair','break','cracks and collapses, legs curling up',4,{'hurt':[1],'break':[2,4]},None),
 # 문틈 손 (기준 그림 = 쭉 뻗은 팔)
 ('doorhand','retract','the arm slowly slides back to the left until only the fingertips remain at the left edge',8,{'clutch_rec':[3,6],'hidden':[8],'clutch_tele':[6,3]},None),
 ('doorhand','grab','the long fingers snap shut into a tight grabbing fist, then pull back slightly',4,{'clutch_hit':[1,2],'clutch_hold':[3],'hurt':[4]},None),
 # 벽 얼굴
 ('wallface','idle','eyes stay closed, lips twitch slightly',4,{'idle':[0,2]},None),
 ('wallface','bite','eyes snap open, mouth gapes wide, the face lunges forward and bites, then pulls back',6,{'bite_tele':[1],'bite_hit':[3],'bite_rec':[5],'hurt':[6]},None),
 ('wallface','die','the face melts and sinks back flat until it disappears',4,{'die':[2,4]},None),
 # 바닥 손
 ('floorhand','grab','the flat fingers curl upward off the floor and clench into a grabbing fist',4,{'flat':[0],'grab':[1,2,4],'release':[2,1]},None),
 # 402호의 것
 ('tv402','idle','coiled, the human head sways side to side slowly, body breathing',4,{'idle':[1,2,3,4]},None),
 ('tv402','crawl','slithers forward in S-shaped waves along the floor, head low',8,{'crawl':[1,2,3,5,6,7]},None),
 ('tv402','bite','pulls the head back, then the neck shoots far forward and bites, then recoils',6,{'bite_tele':[1,2],'bite_hit':[3,4],'bite_rec':[6]},None),
 ('tv402','coil','coils the body up high, then sweeps the long body forward along the ground',6,{'coil_tele':[1,2],'coil_hit':[3,4],'coil_rec':[6]},None),
 ('tv402','static','raises the head high and opens the mouth wide, the face distorts and glitches with horizontal lines',6,{'static_tele':[1,2],'static_hit':[3,4],'static_rec':[6]},None),
 ('tv402','die','flinches, then the body uncoils and goes limp flat on the floor',6,{'hurt':[1,2],'die':[3,5,6]},None),
 # 포식자
 ('predator','idle','breathing low and heavy, the huge mouth opening slightly and closing',4,{'idle':[1,2,3,4]},None),
 ('predator','walk','slow heavy walk forward on four short legs, body swaying',8,{'walk':[1,2,3,5,6,7]},None),
 ('predator','maw','rears its head back, opens its mouth as wide as its body, lunges forward to swallow, then closes',6,{'maw_tele':[1,2],'maw_hit':[3,4,5],'maw_open':[4],'maw_rec':[6]},None),
 ('predator','tail','twists its body and sweeps its long tail around forward low to the ground, then returns',6,{'tail_tele':[1,2],'tail_hit':[3,4],'tail_rec':[6]},None),
 ('predator','slam','lifts its front legs high, then slams them down hard on the ground, then settles',6,{'slam_tele':[1,2],'slam_hit':[3,4],'slam_rec':[6]},None),
 ('predator','die','flinches, then collapses onto its side and lies still',6,{'hurt':[1,2],'die':[3,5,6]},None),
 # 과학실 표본
 ('specimen_jar','idle','the specimen inside slowly turns its big eye, liquid sways',4,{'idle':[0,2]},None),
 ('specimen_jar','break','the glass cracks, then shatters, leaving only the broken base',4,{'break':[1,2,4]},None),
 ('specimen_frog','hop','hops forward in small jumps',4,{'idle':[0,4],'hop':[1,2,3,4]},None),
 ('specimen_frog','leap','crouches low, then leaps high forward with legs stretched, then lands',4,{'leap_tele':[1],'leap_hit':[2,3],'leap_rec':[4]},None),
 ('specimen_frog','die','flattens and goes limp',4,{'die':[2,4]},None),
 ('specimen_snake','slither','slithers forward in waves',4,{'idle':[0,2],'slither':[1,2,3,4]},None),
 ('specimen_snake','strike','raises its head into an S curve, then strikes forward and bites, then recoils',4,{'strike_tele':[1],'strike_hit':[2,3],'strike_rec':[4]},None),
 ('specimen_snake','die','twists and goes limp',4,{'die':[2,4]},None),
]
def b64(p): return 'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode()
def log(s): open(f'{ROOT}/spend.log','a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' anim '+s+'\n')
def clean(im):
    im=im.convert('RGBA'); px=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=px[x,y]; px[x,y]=(r,g,b,0 if a<128 else 255)
    return im
def submit(k,name,act,n,src):
    a={'first_frame_url':b64(src),'action':act,'frame_count':n,'no_background':True,'seed':31}
    for i in range(200):
        try: t=mcp.text(mcp.tool('animate_image',a))
        except Exception as e: t='EXC '+str(e)
        if 'rate limit' in t.lower() or 'concurren' in t.lower() or t.startswith('EXC'): time.sleep(20); continue
        break
    log(f'{k} {name} {n}f -> {t[:110]}')
    j=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); return (j.group(1) if j else None),t
def fetch(k,name,j,n,mp):
    raw=f'{ROOT}/{k}/raw/{name}'; os.makedirs(raw,exist_ok=True)
    for i in range(n+1):
        for t in range(8):
            try: r=mcp.tool('get_image',{'job_id':j,'index':i}); break
            except Exception: time.sleep(5)
        im=[x for x in r['result']['content'] if x.get('type')=='image']
        if im: open(f'{raw}/{i:02d}.png','wb').write(base64.b64decode(im[0]['data']))
    for clip,idx in mp.items():
        d=f'{ROOT}/{k}/clips/{clip}'; os.makedirs(d,exist_ok=True)
        for f,i in enumerate(idx):
            if os.path.exists(f'{raw}/{i:02d}.png'): clean(Image.open(f'{raw}/{i:02d}.png')).save(f'{d}/{f:02d}.png')
def run(kinds,par=6):
    q=[r for r in J if (not kinds or r[0] in kinds) and not os.path.exists(f'{ROOT}/{r[0]}/raw/{r[1]}/01.png') and os.path.exists(f'{ROOT}/{r[0]}/base.png')]
    pend={}
    while q or pend:
        while q and len(pend)<par:
            k,name,act,n,mp,src=q.pop(0); j,t=submit(k,name,act,n,src or f'{ROOT}/{k}/base.png')
            if j: pend[j]=(k,name,n,mp); print('sub',k,name,flush=True)
            else: print('SUBFAIL',k,name,t[:300],flush=True)
        time.sleep(15)
        for j,(k,name,n,mp) in list(pend.items()):
            try: txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
            except Exception: continue
            lo=txt.lower()
            if 'complet' in lo or 'frame' in lo and 'image' in lo: fetch(k,name,j,n,mp); del pend[j]; print('done',k,name,flush=True); log(f'{k} {name} done')
            elif 'fail' in lo: del pend[j]; print('FAIL',k,name,txt[:300],flush=True); log(f'{k} {name} FAIL {txt[:200]}')
if __name__=='__main__':
    run([a for a in sys.argv[1:] if not a.startswith('--')])
    print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
