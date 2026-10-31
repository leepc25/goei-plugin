"""중림 지상 첫 장 v6(사용자 10-31 「소품 크기 고쳐야지」「지하상가 출입구 너무 작아 뒤에 셔터에 비해서」).
v5: 인도·가게 크기는 맞음, 자판기·공중전화 ≈100px(< 에일린 140), 입구가 셔터보다 낮고 간판이 지붕 앞에 걸림.
v6: v5 그대로 + 자판기·공중전화를 사람보다 크게(사람 기준 말), 입구는 크게(지붕이 뒤 셔터만큼 높게, 가이드 v4), 간판은 지붕 위(on top of)."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
d = json.load(open(D + 'jr_entry_p1_v5.json')); d['name'] = 'jr_entry_p1_v6'
T = {
 "right 30 percent: only the front end of a freestanding arcade entrance on the sidewalk like a Seoul subway exit, the rest past the right edge, open end facing left, stairs going down to the right into darkness, waist-high railings on both sides, a glass canopy":
 "right 35 percent: the front end of a big freestanding arcade entrance on the sidewalk like a subway exit, the rest past the right edge, open end facing left, stairs going down to the right into darkness, waist-high railings, a glass canopy as high as the shutters behind",
 'on the canopy, right above the entrance: a sign board reading "중림지하상가"': 'on top of the canopy, above the entrance: a sign board reading "중림지하상가"',
 "against the buildings: a vending machine, a parked motorbike, potted plants, trash bags and boxes": "against the buildings: a vending machine nearly as tall as the shutters, a parked motorbike, potted plants, trash bags and boxes",
 "an old public phone": "an old phone booth nearly as tall as the shutters",
 'on the building fronts: faded blank signs, closed shutters, a small open shop, a note reading "임대" on a window': 'on the building fronts: signs reading "중림슈퍼", "제일수선", "영진철물", closed shutters, a small open shop, a note reading "임대" on a window',
 "a torn redevelopment banner on a shutter": "a torn banner on a shutter",
}
for i in d['items']: i['text'] = T.get(i['text'], i['text'])
T2 = {"back: old shop fronts along the whole width, signs right under the top edge, no upper floors": "back: old shop fronts along the whole width, no upper floors",
      "bottom edge: a very thin curb and road line, no cars": "bottom edge: a very thin curb and road line"}
for i in d['items']: i['text'] = T2.get(i['text'], i['text'])
d['floor_share'] = "the lower 30 percent, all sidewalk, a very thin curb line at the bottom"   # 군말 줄임(글자 수)
d['shadow'] = "soft shadows under objects and the canopy, dark stairwell"
d['brief']['user'].append("v5 간판 한글 엉망(사용자) → 정확한 이름 중림슈퍼·제일수선·영진철물(사용자 「네가 지정을 해주던가」)")
d['brief']['user'].append("v5 소품 작음·입구가 셔터보다 작음(사용자) → 자판기·공중전화 셔터 높이 가깝게, 입구 지붕 셔터 높이, 간판 지붕 위, 가이드 v4")
d['review']['size'] = "자판기·공중전화 '셔터 높이 가깝게'(셔터 기준 말), 입구 지붕 = 뒤 셔터 높이, 가이드 v4 사각형"
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
