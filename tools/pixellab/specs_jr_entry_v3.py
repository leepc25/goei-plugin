"""중림 지상 첫 장 v3(사용자 10-31 「그래」). v2: 1층만이라 해도 2층 위까지 그림(문 115px), 입구가 건물에 붙고 정면이 열려 건물 안으로 내려감.
v3: 가이드 v2(맨 위 선 = 가게 앞면 윗선, 그 위는 그림 밖). 건물 줄은 「간판·차양이 맨 위 선 바로 아래, 위층은 안 보임」.
입구는 「건물과 떨어져 인도 위에 따로 섬, 긴 옆면이 보는 쪽, 계단은 왼쪽에서 오른쪽으로 인도 밑으로」."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
d = json.load(open(D + 'jr_entry_p1_v2.json')); d['name'] = 'jr_entry_p1_v3'
for i in d['items']:
    if i['text'].startswith('back: old shop buildings'):
        i['text'] = "back: old shop buildings along the whole width, only their ground floor shop fronts, signs and awnings right under the top line, no upper floors"
    if i['text'].startswith('right 30 percent:'):
        i['text'] = ("right 30 percent: the front end of a freestanding arcade entrance on the sidewalk, apart from the buildings, like a subway exit, "
                     "the rest continuing past the right edge, its long side facing the viewer, open end facing left, stairs going down left to right into darkness, "
                     "waist-high railings, a glass canopy over it")
TRIM = {'left 10 percent: only building fronts and sidewalk, continuing past the edge': 'left 10 percent: building fronts and sidewalk continuing past the edge',
        'bottom 8 percent: a curb and an asphalt strip, no cars, no markings': 'bottom: a curb and an asphalt strip, no cars'}
for i in d['items']: i['text'] = TRIM.get(i['text'], i['text']).replace('a note reading "임대" on an empty window', 'a note reading "임대" on a window')
d["floor"] = "smooth grey concrete sidewalk like one sheet, litter"   # 군말 줄임(글자 수)
d['brief']['user'].append("v2 작음·입구가 건물에 붙음 → 가이드 맨 위 선(가게 앞면 윗선), 입구는 건물과 떨어져 인도 위(사용자 「그래」)")
d['review']['frame'] = "카메라 문장 지하와 같음, 원근 street, 양옆 open, 바닥 38%, 가이드 jr_street_guide_v2(맨 위 선 추가)"
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
