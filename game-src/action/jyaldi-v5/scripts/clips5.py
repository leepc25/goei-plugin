# 3차 동작 생성: animate_image(음영 유지) + 핀은 base64. 단계별 연쇄(앞 클립의 마지막 장이 다음 클립의 첫 장).
# 사용: PINS=<dir with S.png F.png W.png R.png> OUT=<dir> python3 clips5.py [stage names...]
import sys,json,time,base64,re,os
sys.path.insert(0,'.'); import mcp
PINS=os.environ.get('PINS','poses2'); OUT=os.environ.get('OUT','clips5'); os.makedirs(OUT,exist_ok=True)
SEED=int(os.environ.get('SEED','7'))
def b64(p): return base64.b64encode(open(p,'rb').read()).decode()
def pin(k):
    # 'S','F','W','R' = 핀 파일, 'clip:name:idx' = 이미 만든 클립의 장
    if k.startswith('clip:'):
        _,n,i=k.split(':'); return b64(f'{OUT}/{n}-{i}.png')
    return b64(f'{PINS}/{k}.png')
# name: (first, last|None, frames, action)
J={
 'fight':('F','F',4,'combat stance idle loop for a beat-em-up: weight shifts between the feet, shoulders bob, the raised left hand opens and closes slightly, hair sways, feet stay planted'),
 'walk':('W','W',8,'walk cycle facing right, one full stride that loops: right leg swings forward, passes, lands, then the left leg does the same; arms swing at the shoulders opposite to the legs; upper body steady; hair sways one beat behind; feet stay on the same ground line'),
 'run':('R','R',8,'hard combat sprint, one full stride that loops: upper body leaning forward, legs driving with long powerful strides, knees lifting high, arms bent and pumping strongly opposite to the legs, hair streaming straight behind, jacket flapping, feet on the same ground line'),
 'charge':('F','F',4,'charging loop: she sinks lower into a wide stance, right fist pulled back to the hip with the open left hand forward, a faint red glow gathers around the right hand, hair lifts as if in rising wind, body tense and trembling slightly'),
 'jump':('F',None,8,'powerful athletic jump straight up: deep fast crouch with arms swinging back, explosive push-off with legs fully extended and arms thrown up, then rises high with one knee pulled up and the other leg trailing, hair whipping downward, body angled forward, ends at the top of the jump with knees tucked'),
 'melee1':('F',None,8,'first hit of a combo, hard and heavy like a beat-em-up: steps forward with the whole body, upper body leaning in, shoulders rotating, and drives the open left palm straight ahead at chest height with full extension and a sharp smear, back foot pushing off, hair swinging a beat late, ends in the extended strike pose'),
 'dash':('R','F',8,'from a sprint she drops low and slams forward with her right shoulder in a shoulder charge, body bent far forward, hair whipping, then straightens up into the combat stance'),
 'draw':('F',None,8,'draws the pistol from the holster on her right thigh with her RIGHT hand, raises it in one motion to a one-handed level aim pointing to the right, left arm bent across the chest, ends in the aim pose'),
 'unique':('F','F',8,'special move: she twists her upper body and pulls her right fist back to the hip gathering a red glow for two frames, then lunges one big step forward and slams her open right palm forward with the whole body behind it; a round red burst erupts from the palm in front of her; she recoils slightly from the blast, hair blown back, then settles into the combat stance'),
 'guard':('F',None,4,'raises the left forearm up in front of the face and chest to block, elbow bent, body crouching slightly behind the arm, right fist stays near the hip, feet do not move, ends holding the block'),
 'evade':('F','F',8,'fast backward dash: pushes off hard, body leans back and low, both feet leave the ground briefly as she slides backward, hair whips forward over her face, lands and settles back into the combat stance'),
 'ult':('F','F',16,'ultimate move, dramatic: she tugs her right glove tight with the left hand, sinks into a deep stance as red energy gathers around the right hand, then explodes forward one big step and thrusts both open palms forward together; a huge red blast erupts in front of her and her hair and jacket are blown straight back; she holds the pose, then relaxes back into the combat stance'),
 'hit':('F','F',4,'takes a hard light hit to the face: head snaps back and the upper body jolts backward, one foot slides back, hair flies, then snaps back into the combat stance'),
 'down':('F',None,8,'takes a heavy hit and is blasted off her feet: upper body thrown back violently, feet leave the ground, she flies backward through the air with arms flung forward and hair streaming, falls and crashes onto her back, bounces once, ends lying flat on her back on the ground with hair spread out'),
}
STAGE2={
 'land':('clip:jump:8','F',4,'falling from a jump and landing hard on both feet: knees bend deep to absorb the impact, one hand touches the ground, hair falls down, then springs back up into the combat stance'),
 'air':('clip:jump:8',None,8,'from the top of a jump she twists her body and drives her open right palm straight downward with full weight behind it while falling, legs kicking back, hair whipping upward, ends at the bottom of the strike still in the air'),
 'melee2':('clip:melee1:8',None,8,'second hit of the combo: without stopping she steps forward again, hips and shoulders rotate the other way, and swings her right fist across in a short heavy hook at head height with a motion smear, upper body leaning into it, hair swinging, ends with the hook fully extended'),
 'fire':('clip:draw:8','clip:draw:8',4,'fires one pistol shot one-handed: bright muzzle flash at the barrel, the pistol and right forearm kick up sharply from recoil, shoulder rocks back, then returns to the same aim'),
 'reload':('clip:draw:8','clip:draw:8',8,'reloads the pistol: lowers the pistol to chest height, the left hand pulls out the empty magazine and slams in a new one, the left hand racks the slide, then raises the pistol back to the same one-handed aim'),
 'holster':('clip:draw:8','F',8,'lowers the pistol, slides it into the holster on her right thigh with the right hand, and returns to the combat stance'),
 'guardhit':('clip:guard:4','clip:guard:4',4,'while blocking with the left forearm raised, she takes a heavy hit on the forearm: the upper body is shoved back, the arm jolts, feet slide back a little, returns to the same block'),
 'downidle':('clip:down:8','clip:down:8',4,'lying on her back on the ground, hurt: chest heaves with heavy breathing, one hand twitches, head rolls slightly, hair spread on the floor'),
}
STAGE3={
 'melee3':('clip:melee2:8','F',16,'combo finisher, big and heavy: she lunges one long step forward with the whole body low, plants her open left hand on the chest of an unseen enemy in front of her, holds that pose for a beat with her body coiled, then a round red detonation bursts from the palm and she recoils from the blast with her upper body thrown back, hair blown up, then steps back into the combat stance'),
 'getup':('clip:down:8','F',8,'gets up from lying on her back: rolls to the side, pushes up with one hand on the floor, brings a knee under her, rises to her feet shaking her head once, ends in the combat stance'),
}
ALL={**J,**STAGE2,**STAGE3}
def submit(n):
    f,l,c,d=ALL[n]; a={'first_frame_base64':pin(f),'frame_count':c,'seed':SEED,'action':d}
    if l: a['last_frame_base64']=pin(l)
    r=mcp.tool('animate_image',a); t=mcp.text(r)
    open('spend.log','a').write(f"{time.strftime('%H:%M:%S')} clip5 {n} animate_image {c}f -> {t[:300]}\n")
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); print(n,'->',m.group(1) if m else t[:300].replace('\n',' | '),flush=True); return m.group(1) if m else None
def fetch(job,n,out):
    for _ in range(200):
        r=mcp.tool('get_image',{'job_id':job}); txt=mcp.text(r)
        if 'complet' in txt.lower(): break
        if 'fail' in txt.lower(): return 'FAIL '+txt[:400]
        time.sleep(10)
    else: return 'timeout'
    for i in range(n+1):
        r=mcp.tool('get_image',{'job_id':job,'index':i}); imgs=[c for c in r['result']['content'] if c.get('type')=='image']
        if imgs: open(f'{out}-{i}.png','wb').write(base64.b64decode(imgs[0]['data']))
    return txt[:120].replace('\n',' | ')
def run(names):
    jobs={n:submit(n) for n in names}
    for n,j in jobs.items():
        if j: print('done',n,fetch(j,ALL[n][2],f'{OUT}/{n}'),flush=True)
    json.dump({n:{'job':jobs[n],'first':ALL[n][0],'last':ALL[n][1],'frames':ALL[n][2],'action':ALL[n][3],'seed':SEED} for n in names},open(f'{OUT}/log-{int(time.time())}.json','w'),ensure_ascii=False,indent=1)
if __name__=='__main__':
    arg=sys.argv[1:]
    if not arg: run(list(J)); run(list(STAGE2)); run(list(STAGE3))
    elif arg==['stage1']: run(list(J))
    elif arg==['stage2']: run(list(STAGE2))
    elif arg==['stage3']: run(list(STAGE3))
    else: run(arg)
    print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
