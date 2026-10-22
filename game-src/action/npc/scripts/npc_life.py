# 본부 넷 생활 동작 42~157행 (설계서 4.3). 뼈대 = 쟈알디 rig.CLIPS의 같은 클립(가구 높이·손 자리가 엔진과 이미 맞춰져 있음)을
# 사람마다 자세 변환(몸 기울기·고개·발 간격·팔 크기·튐)하고, 동작 문장은 사람마다 따로 쓴다(설계서 표의 그 사람 방식).
# 문장엔 몸 자세만(물건·가구 이름 없음, 손전등만 예외: 사용자 규칙 "손전등은 그림에"). 100자 제한(API).
import math,os,sys
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0,os.path.join(HERE,'../../jyaldi-v5/scripts'))
import rig
from rig import G,X,UARM,FARM,ik,anatomic

# ── 사람별 자세 변환 ──
STYLE={
 'jaemtri': dict(lean=-1,tilt=-3,stance=0.75,arm=0.95,bounce=0),     # 꼿꼿, 턱 살짝 듦, 굽이라 발 간격 좁음
 'gognija': dict(lean=3,tilt=-6,stance=1.3,arm=1.3,bounce=0),        # 크게, 넓게, 고개 젖힘
 'dejure':  dict(lean=9,tilt=10,stance=0.7,arm=0.7,bounce=0,crouch=2),# 움츠림, 팔 몸에 붙임
 'konjyuce':dict(lean=2,tilt=-4,stance=1.0,arm=1.12,bounce=1.5),     # 가볍게 튐
}
UPPER=['NECK','RIGHT SHOULDER','LEFT SHOULDER','RIGHT ELBOW','LEFT ELBOW','RIGHT ARM','LEFT ARM','NOSE','RIGHT EYE','LEFT EYE','RIGHT EAR','LEFT EAR']
HEAD=['NOSE','RIGHT EYE','LEFT EYE','RIGHT EAR','LEFT EAR']
def _rot(p,c,deg):
    r=math.radians(deg); dx,dy=p[0]-c[0],p[1]-c[1]
    return (c[0]+dx*math.cos(r)-dy*math.sin(r), c[1]+dx*math.sin(r)+dy*math.cos(r))
def restyle(p,st,i=0):
    q=dict(p)
    hip=((q['RIGHT HIP'][0]+q['LEFT HIP'][0])/2,(q['RIGHT HIP'][1]+q['LEFT HIP'][1])/2)
    upright=q['NECK'][1]<hip[1]-15            # 서 있거나 앉은 장만(누운 장은 그대로)
    standing=upright and q['RIGHT LEG'][1]>G-3 and q['LEFT LEG'][1]>G-3
    if upright:
        for k in UPPER: q[k]=_rot(q[k],hip,st['lean'])
        for k in HEAD: q[k]=_rot(q[k],q['NECK'],st['tilt'])
        # 팔 크기: 어깨→손목 거리를 늘이거나 줄이고 팔꿈치는 IK(원래 팔꿈치 쪽)
        for s in ('RIGHT','LEFT'):
            sh,el,w=q[f'{s} SHOULDER'],q[f'{s} ELBOW'],q[f'{s} ARM']
            v=(w[0]-sh[0],w[1]-sh[1]); d=math.hypot(*v) or 1
            rest=(sh[0]+1,sh[1]+29)       # 차렷 손 자리 기준으로 크기 조절
            nw=(rest[0]+(w[0]-rest[0])*st['arm'],rest[1]+(w[1]-rest[1])*st['arm'])
            L=math.hypot(nw[0]-sh[0],nw[1]-sh[1]); m=0.97*(UARM+FARM)
            if L>m: nw=(sh[0]+(nw[0]-sh[0])*m/L,sh[1]+(nw[1]-sh[1])*m/L)
            e,ww=ik(sh,nw,UARM,FARM,lambda e_:-math.hypot(e_[0]-el[0],e_[1]-el[1]))
            q[f'{s} ELBOW']=e; q[f'{s} ARM']=ww
    if standing:
        for s in ('RIGHT','LEFT'):
            a=q[f'{s} LEG']; q[f'{s} LEG']=(hip[0]+(a[0]-hip[0])*st['stance'],a[1])
        dy=st.get('crouch',0)+(st['bounce'] if i%2 else 0)
        if dy:
            for k in q:
                if 'LEG' not in k: q[k]=(q[k][0],q[k][1]+(st.get('crouch',0) if 'KNEE' not in k else st.get('crouch',0)*0.5)+(-st['bounce'] if i%2 else 0))
        # 무릎을 새 발 자리에 맞춰 다시
        for s in ('RIGHT','LEFT'):
            kn=q[f'{s} KNEE']; k2,a2=ik(q[f'{s} HIP'],q[f'{s} LEG'],rig.THIGH,rig.SHIN,lambda m_:-math.hypot(m_[0]-kn[0],m_[1]-kn[1]))
            q[f'{s} KNEE']=k2; q[f'{s} LEG']=a2
    return anatomic(q)

# ── 동작 문장 (잼트리, 고그니쟈, 데쥬레, 콘쥬스) ──
A={
'turn':('turns around gracefully pivoting on her heels','spins around with a big swing of the coat','turns around in a flustered startled hurry','hops around to face the other way'),
'fall':('falling, both hands pressing the skirt down, knees together','falling with arms spread wide, grinning, coat flaring up','falling, arms and legs flailing in panic','falling calmly with knees tucked, enjoying it'),
'land':('lands softly with knees together, then smooths her hair','lands with a heavy thud, wobbles, then laughs','lands and nearly falls on her bottom, arms flailing','lands with one hand touching down, pops up instantly'),
'stairs':('climbs steps one at a time, upright, careful heel steps','climbs taking two steps at a time with huge strides','climbs in small quick hunched steps','bounds up two steps at a time'),
'ladder':('climbs carefully, one hand at a time, upright','climbs fast and clumsily, limbs everywhere','climbs trembling, hugging close, slow','climbs quickly using mostly her arms'),
'rope':('climbs slowly with legs wrapped, straining','climbs swinging and kicking, laughing','dangles and struggles, barely rising','pulls herself up hand over hand effortlessly'),
'mantle':('sits on the edge first and swings her legs up neatly','scrambles up knee first, flailing','tries twice, struggles, finally crawls up','plants one hand and hops straight up'),
'vault':('sits on top and swings both legs over primly','swings a long leg over in a big arc','climbs over slowly on hands and knees','vaults sideways in one light hop'),
'crawl':('crawls carefully, keeping low and neat','crawls fast and eagerly','crawls flat, trembling, slow','crawls fast and nimbly'),
'sneak':('tiptoes with heels raised, upright and silent','exaggerated cartoon tiptoe, knees high','creeps hunched low, holding her breath','sneaks with big playful tiptoe strides'),
'idle_light':('stands holding a small flashlight forward with a straight wrist','holds a small flashlight high overhead, excited','grips a small flashlight in both hands, trembling','idles twirling a small flashlight loosely in one hand'),
'walk_light':('heel walk holding a small flashlight forward','big strides, small flashlight swinging around','small hunched steps, small flashlight in both hands','bouncy walk, small flashlight in one hand'),
'run_light':('short quick steps, small flashlight forward','runs wildly, small flashlight waving','runs flailing, small flashlight clutched','sprints, small flashlight pointing ahead'),
'lookback':('glances back over her shoulder with a smile','whips his head around to look back','looks back fearfully, twice, then hurries','glances back quickly, tilting her head'),
'hide':('crouches calmly behind cover, back of hand over her mouth','crouches, shoulders shaking from holding in a laugh','curls up into a ball, trembling','squats with a finger to her lips'),
'door':('pushes forward elegantly and steps through','flings both arms forward and strides through','peeks, hesitates, then slips through','bumps forward with a shoulder and walks through'),
'doorclose':('reaches back lightly while walking on','swings an arm back hard while striding on','pushes back and leans, catching her breath','swats back with one hand while walking'),
'knock':('knocks twice lightly with her fingertips','pounds with the side of his fist','knocks once timidly, then hesitates','knocks in a quick playful rhythm'),
'push':('pushes with her back, straining, heels slipping','leans his whole body in, groaning','strains with both hands, barely moving','pushes forward easily with one hand'),
'idle_box':('stands still, both forearms level at the chest, hands open, upright','stands, both forearms level at the chest, grinning','stands wobbling, both forearms level at the chest','stands, both forearms level at the chest, bouncing lightly'),
'walk_box':('heel walk, both forearms level at the chest, hands open','big strides, both forearms level at the chest','wobbly small steps, both forearms level at the chest','bouncy walk, both forearms level at the chest, effortless'),
'run_box':('short quick steps, both forearms level at the chest','runs wildly, both forearms level at the chest','runs wobbling, both forearms level at the chest','fast bouncy sprint, both forearms level at the chest, effortless'),
'lever':('pulls down with both hands, leaning her weight back','hangs his weight to pull down','pulls down with eyes squeezed shut','yanks down with one hand'),
'inspect':('crouches knees together, tucks the skirt, then looks','bends down, nose almost to the floor','reaches out from far back with one fingertip','squats and pokes repeatedly'),
'readwall':('reads closely, comparing against something in her hand','presses close, muttering, nose near','stands on tiptoe to read','reads with her head tilted'),
'notebook':('writes neatly with a stylus motion in one hand','scribbles wildly fast','writes slowly and carefully','scribbles quickly and carelessly'),
'leadhand':('walks pulling someone gently, looking back kindly','strides pulling someone along hard','walks hunched, almost being pulled','marches ahead pulling energetically'),
'backpack':('kneels and takes things out neatly one by one','kneels and dumps everything out','kneels and checks each thing carefully','kneels and digs in headfirst'),
'bow':('polite bow with hands folded in front','exaggerated sweeping theatrical bow','deep ninety degree bows, again and again','quick short bob of a bow'),
'button':('presses delicately with one fingertip','presses rapidly over and over','presses carefully, holding it','taps with a knuckle'),
'elevwait':('stands looking down at hands held in front','bobs on his feet humming, looking up','presses into the corner, small','rocks heel to toe, looking up'),
'transmit':('operates quickly and skillfully with both hands','pounds keys and laughs','operates precisely, hands perfectly steady','presses things at random curiously'),
'floorsit':('sits down with legs folded to the side','drops down with legs straight out','sits and hugs her knees tight','plops down cross-legged'),
'floorrest':('sits legs to the side, smoothing her hair','sits legs out, rolling something in his fingers','sits with her face buried in her knees','sits cross-legged, nodding off'),
'hurtidle':('hunched but keeping a tight smile, hand on side','wobbling and laughing, hand on side','hunched, teary, hand on side','stands stubbornly, hand on side'),
'limp':('limps, dragging one heel','exaggerated limp, arms wide','limps sniffling','hops on one leg'),
'fear':('arms folded tight, holding herself together','leans forward curious, not afraid','hugs herself, trembling hard','fists clenched, holding her ground'),
'nausea':('covers her mouth and turns her head away','doubles over and reaches into a pocket','sinks straight down to her knees','gags, then wipes her mouth with the back of her hand'),
'collapse':('drops to her knees and topples sideways','falls straight back spread-eagled','faints and crumples at once','falls forward face down'),
'bedlie':('lying straight on her back, hands on her stomach','lying spread-eagled, mouth open','lying curled up small','lying sprawled, limbs everywhere'),
'bedwake':('sits up slowly, fixing her hair','bolts upright suddenly','jolts awake in a fright','sits up stretching her arms'),
'victory':('opens her arms wide in welcome','claps his hands loudly','sags with relief, nearly sitting down','runs forward and jumps for a high five'),
'chairsit':('sits smoothing her skirt and crosses her legs','drops down heavily and spins','perches on the very edge','hops into a seat, legs swinging'),
'deskwork':('seated, stamping briskly and cheerfully','seated, signing with huge scribbles','seated, checking each sheet carefully','seated, stamping hard'),
'typing':('seated, typing fast and lightly','seated, pecking keys hard with two fingers','seated, leaning in, typing fast and precise','seated, typing with two fingers'),
'phone':('hand to ear, talking warmly, free hand waving','holding the hand far from his ear and shouting','both hands at her ear, bowing repeatedly','hand at shoulder, chatting, fidgeting'),
'handover':('hands over with both hands and a smile','hands over with one quick flick','hands over with both hands, bowing','thrusts it out with one hand'),
'board':('pins up neatly at eye level','slaps up carelessly overhead','stretches up on tiptoe','jumps up to pin high'),
'brief':('points at a board calmly, then turns to the room','pounds a board and lectures loudly','points with a trembling finger','mimics a briefing playfully'),
'idle_folder':('stands hugging a folder to her chest','stands with a folder under his arm','stands clutching a folder with both arms','stands waving a folder overhead'),
'walk_folder':('heel walk hugging a folder','big strides, folder under the arm','small steps clutching a folder','bouncy walk waving a folder'),
'run_folder':('short quick steps hugging a folder','runs flapping, folder under the arm','runs flailing, clutching a folder','sprints waving a folder'),
'gearcheck':('looks down, wiping and checking something flat in her hands','takes off his goggles, wipes them, puts them back','takes out a hanging badge, looks, flinches, tucks it away','lifts something heavy with one hand up high'),
'tie':('straightens her necktie neatly','tugs his necktie loose','fumbles her necktie, getting tangled','yanks her school necktie roughly'),
'locker':('swings a jacket on and fixes the collar','swirls a long coat on dramatically','gets an arm stuck in a sleeve, flustered','tosses a blazer over her shoulder'),
'seatrest':('seated, legs crossed, relaxed','seated leaning far back, feet up','seated bolt upright, hands on knees','seated, rocking the seat back and forth'),
'seatthink':('seated, fingertip on her lips, eyes closed','seated, fingertips pressed together','seated, head tilted, muttering','seated, arms crossed, frowning'),
'doze':('dozing seated with her chin in her hand','dozing seated, head back, snoring','dozing seated, head drops, jerks awake','dozing slumped forward'),
'walllean':('leans back with one foot up behind','leans back with both arms spread','presses against behind, as if hiding','slides down behind her into a squat'),
'window':('stands still holding something at the chest, gazing','presses his face close, peering','peeks out from the side','rests her chin on her hands, gazing'),
'sofa':('lying on her side elegantly, looking at a phone','sprawled on his back','curled up small, looking at a phone','lying on her back, legs up high'),
'sleepside':('asleep on her side, head on her hand','asleep, snoring, mouth open','asleep curled into a ball','asleep, tossing and turning'),
'coffee':('stirs carefully in small circles, smiling contentedly','tears and pours several packets at once, beaming','stirs frantically, flustered','grabs several at once in both hands'),
'idle_cup':('stands holding a cup, pinky raised','stands holding a cup high, sloshing','stands holding a cup in both hands','stands swinging a cup in one hand'),
'walk_cup':('heel walk, near hand held daintily at the chest','big strides, near hand raised high','small steps, both hands together at the chest','bouncy walk, near hand swinging at the chest'),
'run_cup':('short quick steps, cup held steady','runs wildly, cup sloshing','runs flailing, cup in both hands','sprints, cup swinging'),
'seatdrink':('seated, taking a dainty sip','seated, gulping it down in one go','seated, blowing then sipping','seated, slurping it all down'),
'microwave':('presses lightly with a fingertip, waits','bends close to watch, impatient','presses and steps back nervously','taps her fingers waiting'),
'seatnoodle':('seated, eats tucking her hair back','seated, slurping loudly','seated, blowing, tiny bites','seated, wolfing it down'),
'feast':('seated, twirling neatly','seated, shoveling big mouthfuls','seated, small bites','seated, cheeks stuffed'),
'toast':('seated, raises a glass gently','seated, thrusts a glass high, shouting','seated, raises a glass late, timid','seated, raises a glass high, grinning'),
'giftbox':('kneels and unties it neatly','kneels and tears it open','kneels, sweeps a hand over it, opens carefully','kneels, shakes it, then opens'),
'phonelook':('stands scrolling a tablet with her thumb, smiling','stands holding a phone right up to his nose','stands holding a phone in both hands','stands scrolling fast, giggling'),
'seatphone':('seated, legs crossed, scrolling','seated, phone right at his nose','seated, phone in both hands','seated, legs swinging, scrolling'),
'seatread':('seated, legs crossed, reading','seated, book held high, muttering','seated, half hiding her face behind a book','seated, reading and snickering'),
'seatgame':('seated, playing lightly with her fingertips','seated, bouncing with his whole body','seated, leaning tensely into it','seated, completely absorbed'),
'music':('taps a finger to the beat','headbangs hard','hums softly, swaying a little','shoulder dances'),
'yawn':('yawns behind the back of her hand','yawns huge like a roar, arms out','yawns secretly and small','yawns big and openly'),
'stretch':('stretches her neck and lower back gracefully','stretches arms huge, cracking','stretches a tiny bit','stretches up big on tiptoe'),
'hairflip':('combs her fingers through long wavy hair','ruffles his wild hair messier','fiddles with a long twin tail','twirls a lock of hair at the side'),
'wash':('washes carefully, then pats her face','splashes water everywhere','washes timidly','splashes vigorously'),
'brushteeth':('brushes neatly','brushes big and loud','brushes long and carefully','brushes while looking around'),
'towel':('pats her hair dry gently','rubs his hair into a mess','dries carefully','rubs fast and hard'),
'dishes':('washes humming','washes sloppily','nearly drops one, flustered','washes fast'),
'mop':('mops minding her heels','swings the mop in big arcs','mops earnestly','mops back and forth fast'),
'water':('waters carefully','pours far too much','waters timidly','dumps it all at once'),
'pushup':('push-ups on her knees, a few','push-ups, then collapses laughing','struggles, cannot do one','push-ups with one hand, fast'),
'situp':('sit-ups slowly','sit-ups exaggerated','half sit-ups, struggling','sit-ups fast'),
'gesture':('talks with open palm gestures','talks with huge arm gestures','talks with fingertips together','talks with busy hands'),
'armscross':('listens with arms crossed, smiling','listens rubbing his hands, bouncing','listens with fingertips together, nodding','listens arms crossed, head tilted, deadpan'),
'nod':('nods warmly','nods big, several times','nods quickly many times','nods once firmly'),
'headshake':('wags a finger: no','shakes his head big','shakes her head small and fast','shakes her head firmly'),
'wave':('tilts her head and waves beside her face','waves both arms','waves small at her chest','waves high on tiptoe'),
'handshake':('shakes hands, wrapping with both hands','shakes hands pumping big up and down','shakes with fingertips only','grips and shakes hard'),
'pat':('pokes with a fingertip, then pats','slaps a shoulder hard','pats very lightly','gives a smack'),
'point':('guides with an open palm','points with arm fully out','points with a trembling finger','finger gun'),
'shrug':('shrugs with a smile','shrugs huge','shrinks into a shrug','shrugs indifferently'),
'sigh':('sighs, shoulders only','huffs big, then laughs','sighs long','puffs her cheeks'),
'hug':('hugs and pats the back','hugs and lifts up','clings tightly','runs in and hugs'),
'smile':('bright warm smile','wide grin','shy smile','big beaming smile'),
'laugh':('laughs behind the back of her hand','laughs with his head thrown back','giggles','laughs holding her stomach'),
'glad':('small claps','both arms up in a cheer','bounces on her toes','jumps with a peace sign'),
'cry':('turns away, wiping her eyes','lifts his goggles and rubs his eyes','sobs with the back of her hands','clenches her teeth, wiping tears'),
'wallcry':('leans back, hand over her eyes','leans back, goggles pushed up','leans back, tears streaming','leans, fist against the side'),
'kneelcry':('kneels knees together, face in hands','sits down hard, head hanging','lies face down crying','kneels, fists on the floor'),
'sad':('stands perfectly still, head low','stands still, head bowed','stands sniffling','fists clenched, shoulders trembling'),
'angry':('arms folded, cold venomous glare, still','smile drops, leans in low, still','puffs her cheeks, fists bouncing','stomps a foot'),
'shout':('says one cold low word, a finger raised','bellows, leaning forward','tries to shout, nothing comes out','shouts in protest, leaning in'),
'deskslam':('slaps a palm down sharply','slams both fists down','taps down weakly, then shakes her hand','slams a fist down hard'),
'surprise':('covers her mouth with the back of her hand','leans in, intrigued','jumps up with hands flung high','eyes wide, leaning forward'),
'startlefall':('falls back, holding her skirt','falls and rolls, laughing','falls flat on her back','stumbles back and catches herself'),
'plopdown':('sinks down, legs together','drops spread-eagled','crumples down','plops down, legs straight'),
'embarrassed':('flips her hair back with a laugh','fiddles with his goggles','waves her hands frantically','winks it off'),
'annoyed':('presses fingertips to her temple','scratches his head roughly','puffs out her cheeks','stomps a foot'),
'think':('fingertip on her lips','fingertips pressed together','finger at her mouth','arms crossed, head tilted'),
'bored':('looks at her nails','paces in place','fidgets with her fingertips','taps a foot'),
}
assert all(len(v)==4 for v in A.values()) and len(A)==116,len(A)
for k,v in A.items():
    for s in v: assert len(s)<=100,(k,s)
ORDER=['jaemtri','gognija','dejure','konjyuce']
def life_clips(id):
    """{클립: (문장, [자세...], tail여부)} 쟈알디 뼈대를 그 사람 자세로"""
    st=STYLE[id]; j=ORDER.index(id); out={}
    for n,acts in A.items():
        act,prop,ps=rig.CLIPS[n]
        tl=len(ps)>=2 and ps[-1]==ps[-2] or ps[-1]==ps[0] and len(ps)>3
        out[n]=(acts[j],[restyle(p,st,i) for i,p in enumerate(ps)],tl)
    return out
if __name__=='__main__':
    for id in ORDER: print(id,len(life_clips(id)))
