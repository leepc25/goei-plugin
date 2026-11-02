"""중림 지상 첫 장 v5(사용자 10-31 「그래 한번 뽑아봐」). v4(1층만·높이 한계)는 위층이 사라지고 원근이 완만했지만 인도가 50px로 얕음(30% 안에 차도까지).
v1은 원근이 급함(바닥 38%+2층까지 → 광각). v5: v4 그대로 + 바닥 30%는 인도만, 연석·차도는 그 아래 아주 얇게 / 입구는 v1 문장 / 가이드 v3."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
d = json.load(open(D + 'jr_entry_p1_v4.json')); d['name'] = 'jr_entry_p1_v5'
d['floor_share'] = "the lower 30 percent, all sidewalk, with only a very thin curb and road line at the bottom edge"
T = {
 "right 30 percent: the front end of a freestanding arcade entrance on the sidewalk like a subway exit, apart from the buildings, the rest past the right edge, open end facing left, stairs going down left to right into darkness, waist-high railings, a glass canopy":
 "right 30 percent: only the front end of a freestanding arcade entrance on the sidewalk like a Seoul subway exit, the rest past the right edge, open end facing left, stairs going down to the right into darkness, waist-high railings on both sides, a glass canopy",
 "bottom edge: a curb and a thin asphalt strip, no cars": "bottom edge: a very thin curb and road line, no cars",
}
for i in d['items']: i['text'] = T.get(i['text'], i['text'])
d['brief']['user'].append("v4 인도 얕음 → 바닥 30%는 인도만, 차도는 그 아래 아주 얇게, 입구는 v1 문장(사용자 「그래 한번 뽑아봐」)")
d['review']['frame'] = "카메라·원근 문장 지하와 같음, 첫 줄 높이 한계(v4), 바닥 30% 인도만, 가이드 v3"
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
