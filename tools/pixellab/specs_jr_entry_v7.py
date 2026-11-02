"""중림 지상 첫 장 v7 = 'D'(사용자 10-31 「D로 뽑아」): v5 기준 + 간판 이름 + 자판기·공중전화 크기 + 입구 크게·간판 지붕 위.
v5의 바닥·벽·빛·팔레트·채우기 묘사는 그대로(깎지 않음). 왼쪽 10%는 v6처럼 간판 없는 맨 벽(이어 그리기 겹침, 사용자 10-31). 가이드 v4."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
d = json.load(open(D + 'jr_entry_p1_v5.json')); d['name'] = 'jr_entry_p1_v7'
T = {
 "right 30 percent: only the front end of a freestanding arcade entrance on the sidewalk like a Seoul subway exit, the rest past the right edge, open end facing left, stairs going down to the right into darkness, waist-high railings on both sides, a glass canopy":
 "right 35 percent: the front end of a big freestanding arcade entrance on the sidewalk like a subway exit, the rest past the right edge, open end facing left, stairs going down to the right into darkness, waist-high railings, a glass canopy as high as the shutters behind",
 'on the canopy, right above the entrance: a sign board reading "중림지하상가"': 'on top of the canopy: a sign board reading "중림지하상가"',
 'on the building fronts: faded blank signs, closed shutters, an open shop, a note reading "임대" on a window': 'on the building fronts: signs reading "중림슈퍼", "제일수선", "영진철물", closed shutters, an open shop, a note reading "임대" on a window',
 "against the buildings: a vending machine, a parked motorbike, potted plants, trash bags and boxes": "against the buildings: a vending machine nearly as tall as the shutters, a motorbike, potted plants, trash bags, boxes",
 "an old public phone": "an old phone booth nearly as tall as the shutters",
 "left 10 percent: shop fronts continuing past the edge": "left 10 percent: a bare wall, continuing past the edge",
}
T.update({"back: old shop fronts along the whole width, signs right under the top edge, no upper floors": "back: old shop fronts along the whole width, no upper floors",
 "bottom edge: a very thin curb and road line, no cars": "bottom edge: a very thin curb and road line",
 "a torn redevelopment banner on a shutter": "a torn banner on a shutter"})   # 소품 나열의 겹치는 말만 줄임(바닥·벽·빛 묘사는 v5 그대로)
for i in d['items']: i['text'] = T.get(i['text'], i['text'])
d['brief']['user'].append("사용자 「D로 뽑아」: v5 + 간판 이름(중림슈퍼·제일수선·영진철물) + 자판기·공중전화 셔터 높이 가깝게 + 입구 크게·간판 지붕 위, 묘사는 v5 그대로")
d['review']['size'] = "자판기·공중전화 셔터 높이 가깝게, 입구 지붕 = 뒤 셔터 높이, 가이드 v4"
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
