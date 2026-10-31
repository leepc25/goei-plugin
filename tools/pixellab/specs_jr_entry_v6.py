"""중림 지상 첫 장 v6(사용자 10-31 「소품 크기 고쳐야지」「지하상가 출입구 너무 작아 뒤에 셔터에 비해서」).
v5: 인도·가게 크기는 맞음, 자판기·공중전화 ≈100px(< 에일린 140), 입구가 셔터보다 낮고 간판이 지붕 앞에 걸림.
v6: v5 그대로 + 자판기·공중전화를 사람보다 크게(사람 기준 말), 입구는 크게(지붕이 뒤 셔터만큼 높게, 가이드 v4), 간판은 지붕 위(on top of)."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
d = json.load(open(D + 'jr_entry_p1_v5.json')); d['name'] = 'jr_entry_p1_v6'
T = {
 "right 30 percent: only the front end of a freestanding arcade entrance on the sidewalk like a Seoul subway exit, the rest past the right edge, open end facing left, stairs going down to the right into darkness, waist-high railings on both sides, a glass canopy":
 "right 35 percent: only the front end of a big freestanding arcade entrance on the sidewalk like a Seoul subway exit, the rest past the right edge, open end facing left, stairs going down to the right into darkness, waist-high railings, a glass canopy as high as the shutters behind",
 'on the canopy, right above the entrance: a sign board reading "중림지하상가"': 'on top of the canopy, above the entrance: a sign board reading "중림지하상가"',
 "against the buildings: a vending machine, a parked motorbike, potted plants, trash bags and boxes": "against the buildings: a vending machine nearly as tall as a shop door, a parked motorbike, potted plants, trash bags and boxes",
 "an old public phone": "an old phone booth as tall as a shop door",
 "a torn redevelopment banner on a shutter": "a torn banner on a shutter",
}
for i in d['items']: i['text'] = T.get(i['text'], i['text'])
d['brief']['user'].append("v5 소품 작음·입구가 셔터보다 작음(사용자) → 자판기·공중전화 가게 문 높이로, 입구 지붕 셔터 높이, 간판 지붕 위, 가이드 v4")
d['review']['size'] = "자판기·공중전화 '가게 문만큼'(문 기준 말), 입구 지붕 = 뒤 셔터 높이, 가이드 v4 사각형"
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
