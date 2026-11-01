"""중림 뒷골목 v2 명세(사용자 10-31). v1은 고정 문장을 새로 써서(좁은 골목·형광등 없음·배관 천장·바닥 40%) 원근·크기가 망가짐.
v2: 구조 문장은 앞골목 ④(jr_b1_p4_v1)에서 그대로 가져오고, 고쳐도 되는 것(색·빛 상태·벽 표면·바닥 더러움·명암 위치)만 바꾼다.
가게 내용·간판·소품 줄은 v1과 같고, 양끝 막다른 곳은 바닥부터 천장까지 막는 셔터(①)·철망(⑦)."""
import json, copy, sys
D = 'game-src/art/pixellab-test-20261028/specs/'
base = json.load(open(D + 'jr_b1_p4_v1.json'))
KEEP = ['room', 'mood', 'mode', 'view', 'floor_share', 'sides', 'density', 'place', 'time', 'light']   # 구조: 앞골목과 글자 그대로
ALLOW = dict(   # 고쳐도 되는 것만
    palette="dark cold blue-grey, amber lamp light accents",
    walls="grimy concrete, peeling paint, exposed brick, rust streaks, mold, cracks; ceiling strip, tangled cables, fluorescent tubes, most dead, one flickering",
    floor="smooth dark poured concrete like one wet sheet, mottled grime, oil stains, many puddles, wet stains, varied litter all over the walkway, light pool, shadows under objects",
    shadow="strong contrast, amber lamp pools, dark patches, black shadow under objects")
keys = sys.argv[1:]
for k in keys:
    v1 = json.load(open(D + f'jr_alley_{k}_v1.json'))
    d = {x: copy.deepcopy(base[x]) for x in KEEP}
    d.update(ALLOW)
    for x in ('doors', 'no', 'sized', 'must', 'brief', 'review'): d[x] = copy.deepcopy(v1[x])
    d['name'] = f'jr_alley_{k}_v2'
    d['items'] = copy.deepcopy(v1['items'])
    for it in d['items']:
        t = it['text']
        if t.startswith('far left 20 percent'):
            it['text'] = "far left 20 percent of the image: the corridor closed off from floor to ceiling by a lowered rusty shutter, military equipment cases and boxes piled in front of it"
        if t.startswith('far right 20 percent'):
            it['text'] = "far right 20 percent of the image: the corridor closed off from floor to ceiling by a rusty chain-link fence with a chained, padlocked gate, military cases and an overflowing trash can piled in front of it"
    d['brief']['user'] = d['brief']['user'] + ["v1 망침(사용자: 원근·크기 제각각, 천장 보, 오른쪽 끝 뚫림) → 구조 문장은 앞골목 ④ 그대로, 색·빛 상태·벽 표면·바닥 더러움만 바꿈(사용자 「고쳐도 될게 있고 안될게 있지」), 끝은 바닥부터 천장까지 셔터·철망으로 막음"]
    d['review']['frame'] = "구조 문장(장소·원근·바닥 몫 30%·옆벽·천장 띠·형광등 줄)은 앞골목 ④와 같음, 색·빛 상태·벽 표면·바닥 더러움만 다름, 가이드 v6"
    json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
    print(d['name'])
