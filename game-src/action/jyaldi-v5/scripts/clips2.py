import sys,json,time,base64,re,os
sys.path.insert(0,'.'); import mcp
RAW='https://raw.githubusercontent.com/leepc25/goei-plugin/main/game-src/action/jyaldi-v5/'
U={'S':RAW+'sheet/cand-102.png','F':RAW+'poses/fight-idle-s7.png','W':RAW+'poses/walk-contact-s7.png','R':RAW+'poses/run-contact-s7.png','J':RAW+'poses/jump-apex-s7.png','P':RAW+'poses/palm-strike-s7.png','G':RAW+'poses/pistol-fire-s7.png'}
J={
 'fight-idle':('F','F',4,'combat stance idle loop: tiny weight shift, breathing, left hand held open in front, right hand near the hip, feet planted, hair tips sway'),
 'run':('R','R',8,'hard combat sprint facing right, one full stride that loops: upper body leaning forward, legs driving with long steps, arms bent and pumping opposite to the legs, long hair streaming behind, jacket hem lifting, feet on the same ground line'),
 'jump':('S','S',8,'low short jump: quick knee bend, pushes off the ground, rises only a little with feet tucked, hangs briefly, lands on both feet with knees absorbing, upper body stays upright, returns to standing'),
 'melee1':('F','P',8,'first melee hit: steps half a step forward and pushes her open gloved left palm straight ahead at chest height, elbow angle barely changing, shoulders turning into the push, ends with the arm fully extended'),
 'melee2':('P','F',8,'second melee hit: from the extended left palm she swings her right hand across in a short backhand strike at head height, small body rotation, then pulls both hands back into the combat stance'),
 'melee3':('F','F',8,'third melee hit: steps in and places her open left hand forward at chest height as if resting it on an enemy chest, holds that pose for two frames, then a small round detonation bursts from the palm while she stays balanced, hair swings one beat late, returns to combat stance'),
 'dash-attack':('R','F',8,'from a full sprint she drops low and slams forward with her right shoulder in a shoulder charge, body bent forward, hair whipping, then straightens up into the combat stance'),
 'air-attack':('J','S',8,'from the top of a jump she slams her open right palm straight downward while falling, lands on both feet with a small burst of dust at the hands, then stands up straight'),
 'ranged-ready':('F','G',4,'draws the pistol from the holster on her right hip with her right hand and raises it to a level one-handed aim to the right'),
 'ranged-fire':('G','G',4,'fires one pistol shot: muzzle flash at the barrel, the pistol and forearm kick up slightly from recoil, shoulder steady, returns to the same aim'),
 'unique-short':('F','F',8,'extends her right hand forward with the palm open and a round explosion bursts two body-widths in front of her, her body barely moves, hair and jacket hem blown back by the blast, then the hand slowly lowers back to the combat stance'),
 'unique-charge':('F','F',4,'charging loop: right hand held out in front at chest height, gloved fingertips trembling, hair stirring as if in a faint wind, feet planted'),
 'guard':('F',None,4,'raises her left forearm up in front of her face and chest to block, elbow bent, right hand stays near the hip, feet do not move, ends holding the block'),
 'evade':('F','F',8,'quick short sidestep: pushes off and takes one fast short step back-left with a slight crouch and a lean, hair swinging across, then steps back into the combat stance; no roll'),
 'ult':('F','F',8,'ultimate move: she tugs her right glove tighter with her left hand over two frames, takes one step forward and thrusts both open hands forward together, hair blown straight back by a huge blast in front of her, then settles back into the combat stance'),
 'hit-light':('F','F',4,'takes a light hit: upper body jolts back slightly and the head tips, feet stay planted, snaps back to the combat stance'),
 'knockdown':('F',None,8,'takes a heavy hit: thrown backward off her feet, flies back and falls onto her back, catches herself with one hand on the floor, ends lying on the ground on her back with the hair spread'),
 'reload':('G','G',4,'reloads the pistol: lowers the pistol a little, the left hand swaps the magazine and racks the slide, raises back to the same one-handed aim'),
}
def submit(n):
    f,l,c,d=J[n]; a={'first_frame_url':U[f],'frame_count':c,'seed':7,'description':d}
    if l: a['last_frame_url']=U[l]
    r=mcp.tool('animate_image_pixminimax',a); t=mcp.text(r)
    open('spend.log','a').write(f"{time.strftime('%H:%M:%S')} clip {n} pixminimax -> {t[:300]}\n")
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); print(n,'->',m.group(1) if m else t[:300].replace('\n',' | '),flush=True); return m.group(1) if m else None
def fetch(job,n,out):
    for _ in range(150):
        r=mcp.tool('get_image',{'job_id':job}); txt=mcp.text(r)
        if 'complet' in txt.lower(): break
        if 'fail' in txt.lower() or 'error' in txt.lower(): return 'FAIL '+txt[:400]
        time.sleep(10)
    else: return 'timeout'
    for i in range(n+1):
        r=mcp.tool('get_image',{'job_id':job,'index':i}); imgs=[c for c in r['result']['content'] if c.get('type')=='image']
        if imgs: open(f'{out}-{i}.png','wb').write(base64.b64decode(imgs[0]['data']))
    m=re.search(r'charged[^|\n]*',txt); return m.group(0) if m else txt[:100]
if __name__=="__main__":
    names=sys.argv[1:] or list(J)
    jobs={n:submit(n) for n in names}
    res={}
    for n,j in jobs.items():
        res[n]=fetch(j,J[n][2],f'clips/{n}') if j else 'no job'; print('done',n,res[n],flush=True)
    json.dump({n:{'job':jobs[n],'result':res[n],'first':J[n][0],'last':J[n][1],'frames':J[n][2],'desc':J[n][3]} for n in names},open('clips/batch1.json','w'),ensure_ascii=False,indent=1)
    print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
