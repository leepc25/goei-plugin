# L급·화면급 보스 부위 그림 (create_image_pixen, 1회씩). 엔진이 관절로 붙여 움직임. python3 parts.py <보스> [부위...]
# 결과 ../<보스>/parts/<부위>-s<seed>.png. 모두 옆모습 오른쪽 보기(승강로 얼굴만 정면), 투명 배경, 쟈알디와 같은 순검정 외곽선.
import sys,pl
ST=', detailed pixel art, single color black outline, dark muted horror palette, transparent background, isolated part only'
H='pale emaciated grey-white human skin'
PARTS={
 'legs':{
  'torso':(256,128,f'side view facing right, a long horizontal creature body shaped like a stretched human spine and ribcage, {H} pulled tight over vertebrae and ribs, eight raw sockets along the underside where legs attach, no legs, no head'),
  'torso_rear':(128,256,f'side view facing right, a long creature body shaped like a stretched human spine and ribcage standing upright vertically, {H} over vertebrae and ribs, raw sockets along the front, no legs, no head'),
  'head_idle':(96,96,f'side view facing right, a bald human-like head with sunken white eyes and a lipless mouth full of too many small teeth, {H}, neck stump'),
  'head_scream':(96,96,f'side view facing right, a bald human-like head screaming with its jaw unhinged impossibly wide, too many small teeth, white eyes, {H}, neck stump'),
  'head_bite':(96,96,f'side view facing right, a bald human-like head lunging to bite, lips pulled back over too many small teeth, {H}, neck stump'),
  'head_hurt':(96,96,f'side view facing right, a bald human-like head recoiling in pain, eyes squeezed shut, mouth twisted, {H}, neck stump'),
  'leg_upper':(160,48,f'a single long thin jointed limb segment lying horizontal, like an elongated human thigh bone covered in {H}, knobby joints at both ends'),
  'leg_lower':(160,48,f'a single long thin jointed limb segment lying horizontal, like an elongated human shin covered in {H}, tapering, knobby joint at the left end'),
  'claw':(64,48,f'a single hooked limb tip made of three fused long human fingers ending in a black curved nail, {H}, horizontal pointing right'),
 },
 'shadow':{
  'body_low':(256,128,'side view facing right, the head and shoulders of a black melting humanoid shadow rising out of a puddle of black ink, dripping, faint dark blue rim light, featureless'),
  'body_stand':(256,256,'side view facing right, a tall black half-melted humanoid shadow standing, body dissolving into dripping ink at the bottom, featureless dark head, faint dark blue rim light, long thin arms'),
  'body_huge':(256,256,'side view facing right, a huge black shadow mass looming forward with a featureless head and many thin dripping arms sprouting from its back, dissolving into ink, faint dark blue rim light'),
  'hand_open':(96,96,'a long-fingered black shadow hand reaching open, dripping ink, faint dark blue rim light'),
  'hand_grab':(96,96,'a long-fingered black shadow hand clenching into a claw, dripping ink, faint dark blue rim light'),
  'hand_point':(96,96,'a long-fingered black shadow hand pointing, dripping ink, faint dark blue rim light'),
  'face':(128,128,'a pale blank human face mask half sunk into black ink, empty black eye holes, open mouth, dripping'),
  'face_scream':(128,128,'a pale human face screaming half sunk into black ink, empty black eye holes, stretched mouth, dripping'),
  'puddle':(256,64,'side view of a flat black ink puddle stain on the floor with a few ripples and drips, faint dark blue sheen'),
 },
 'shaft':{
  'face_shut':(256,256,f'front view of an enormous ancient grey human face looking straight up out of darkness, eyes closed, lips sealed, wrinkled {H}, rust stains and grease, cables tangled in its thin hair'),
  'face_open':(256,256,f'front view of an enormous ancient grey human face looking straight up out of darkness, huge bloodshot eyes wide open, lips parted, wrinkled {H}, rust stains, cables in its hair'),
  'face_mouth':(256,256,f'front view of an enormous ancient grey human face looking straight up out of darkness, mouth gaping wide open into a black throat, eyes rolled back, wrinkled {H}, rust stains'),
  'hand_open':(256,256,f'an enormous long-fingered grey human hand reaching upward with fingers spread, long cracked yellow nails, wrinkled {H}, grease and rust stains, wrist at the bottom'),
  'hand_grip':(256,256,f'an enormous long-fingered grey human hand clenched into a gripping claw, long cracked yellow nails, wrinkled {H}, grease stains, wrist at the bottom'),
  'hand_flat':(256,256,f'an enormous long-fingered grey human hand slapping flat palm forward, long cracked yellow nails, wrinkled {H}, grease stains, wrist at the bottom'),
  'arm':(256,96,f'a single enormous long thin grey human forearm segment lying horizontal, wrinkled {H}, veins, grease stains, joint knobs at both ends'),
 },
 'noise':{
  'face_rot':(256,256,'a huge blurry translucent rotting human face emerging from darkness, sunken eye sockets, peeling grey-green skin, wisps of foul vapour, ghostly'),
  'face_scream':(256,256,'a huge blurry translucent rotting human face screaming with its mouth stretched open, sunken eye sockets, peeling grey-green skin, sound-wave vapour, ghostly'),
  'face_inhale':(256,256,'a huge blurry translucent rotting human face inhaling hard, cheeks hollow, mouth a dark hole sucking in vapour, peeling grey-green skin, ghostly'),
  'hand':(128,128,'a huge blurry translucent rotting grey-green hand pressing down with clawed fingers, foul vapour, ghostly'),
  'hand_claw':(128,128,'a huge blurry translucent rotting grey-green hand slashing with hooked fingers, motion smear, foul vapour, ghostly'),
 },
 'house':{
  'clock':(64,96,'an old wooden pendulum wall clock, its face replaced by a beating red human heart behind the glass, veins wrapping the case'),
  'clock_crack':(64,96,'an old wooden pendulum wall clock with cracked glass, a bleeding red heart inside, veins torn'),
  'clock_dead':(64,96,'a smashed old wooden pendulum wall clock, glass shattered, a grey shrivelled heart inside, stopped'),
  'table':(96,64,'side view of a low round Korean folding dining table, dusty wood, a few dirty bowls glued to it'),
  'chair':(64,96,'side view of an old wooden kitchen chair with a torn vinyl seat'),
  'tv':(96,96,'an old boxy CRT television set with static on the screen, wooden case, rabbit-ear antenna'),
  'drawer':(96,64,'side view of a wooden dresser drawer sliding out, clothes hanging out of it'),
  'kettle':(64,64,'an old dented aluminium kettle'),
  'fridge':(64,128,'an old dented white two-door refrigerator, rust spots, door slightly ajar, side view'),
  'frame':(64,80,'an old family photo frame with the faces scratched out'),
  'eye_window':(128,128,'an apartment window whose glass is a huge bloodshot human eye filling the window frame, curtains like eyelids'),
  'mouth_door':(128,160,'an apartment front door opening like a mouth, the doorway lined with rows of human teeth and a wet red tongue mat'),
 },
 'guard':{
  'baton':(96,32,'a single black rubber police baton lying horizontal, grip end with a worn handle on the left, scuffed, no hand'),
  'flashlight':(64,32,'a single old dented metal police flashlight lying horizontal, lens on the right end, no hand'),
  'arm_baton':(128,192,'a single extra long thin arm in a faded grey-navy uniform sleeve with brass cuff buttons, pale hand gripping a black police baton, torn shoulder seam at the top'),
  'arm_light':(128,192,'a single extra long thin arm in a faded grey-navy uniform sleeve with brass cuff buttons, pale hand gripping an old metal flashlight, torn shoulder seam at the top'),
 },
}
if __name__=='__main__':
    boss=sys.argv[1]; names=sys.argv[2:] or list(PARTS[boss]); seeds=(61,62)
    import os
    for n in names:
        w,h,d=PARTS[boss][n]
        for s in seeds:   # 동시 작업 1개(코디네이터 지시 2026-10-22): 하나 넣고 받은 뒤 다음
            out=f'../{boss}/parts/{n}-s{s}.png'
            if os.path.exists(out): continue
            j=pl.job('create_image_pixen',{'description':d+ST,'width':w,'height':h,'no_background':True,'outline':'single color black outline','detail':'highly detailed','seed':s},f'{boss}-part {n}')
            print(n,s,pl.wait(j,out,step=4),flush=True)
