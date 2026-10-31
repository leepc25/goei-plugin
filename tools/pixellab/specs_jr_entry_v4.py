"""중림 지상 첫 장 v4(사용자 10-31 「그래 그런거 빼고 낮춰봐 좀」). v1~v3 모두 거리가 작게(가게 문 100~115px < 뒤 에일린 140px).
요청문 점검: ① 첫 줄에 높이 한계 없음(지하는 'low ceiling right above the sign') ② 'street sidewalk'가 넓은 풍경을 부름
③ 높은 물건(전선 달린 전봇대·현수막)이 위층을 부름 ④ 바닥 38%(지하 30%) ⑤ 실내용 채우기 문장.
v4: 첫 줄 장소 = 1층 가게 앞면을 인도에서 가까이, 그림 위 끝은 간판 바로 위 / 바닥 30%(그 안 맨 아래 연석·얇은 차도 띠) /
전선 뺌(사용자), 전봇대는 위가 잘린 기둥만, 현수막은 셔터에 낮게 / 채우기 packed. 가이드 v2."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
d = json.load(open(D + 'jr_entry_p1_v3.json')); d['name'] = 'jr_entry_p1_v4'
d['place'] = "the ground floor shop fronts of a run-down 1990s Seoul shopping street, seen up close from the sidewalk, the image top right above the shop signs"
d['floor_share'] = "the lower 30 percent: sidewalk, a thin curb and road strip at the bottom"
d['density'] = 'packed'
T = {
 "a utility pole with tangled wires": "a utility pole cut off at the top",
 "a torn redevelopment banner": "a torn redevelopment banner on a shutter",
 "back: old shop buildings along the whole width, only their ground floor shop fronts, signs and awnings right under the top line, no upper floors": "back: old shop fronts along the whole width, signs right under the top edge, no upper floors",
 "bottom: a curb and an asphalt strip, no cars": "bottom edge: a curb and a thin asphalt strip, no cars",
}
T.update({
 "right 30 percent: the front end of a freestanding arcade entrance on the sidewalk, apart from the buildings, like a subway exit, the rest continuing past the right edge, its long side facing the viewer, open end facing left, stairs going down left to right into darkness, waist-high railings, a glass canopy over it":
 "right 30 percent: the front end of a freestanding arcade entrance on the sidewalk like a subway exit, apart from the buildings, the rest past the right edge, open end facing left, stairs going down left to right into darkness, waist-high railings, a glass canopy",
 "left 10 percent: building fronts and sidewalk continuing past the edge": "left 10 percent: shop fronts continuing past the edge",
 'on top of the canopy, right above the entrance: a sign board reading "중림지하상가"': 'on the canopy, right above the entrance: a sign board reading "중림지하상가"',
})
for i in d['items']: i['text'] = T.get(i['text'], i['text'])
d['walls'] = "grimy concrete and old tile, peeling paint, rust"   # 군말 줄임(글자 수)
d['removed_by_user'] = [{"full": "tangled wires", "by": "사용자 10-31 「그래 그런거 빼고 낮춰봐 좀」 — 전선은 위층을 불러 뺌"}]
d['brief']['user'].append("v3 작음 → 첫 줄에 높이 한계, 바닥 30%, 전선 뺌·현수막 낮춤(사용자 「그런거 빼고 낮춰봐」)")
d['review']['frame'] = "카메라 문장 지하와 같음, 첫 줄 장소에 높이 한계(간판 바로 위가 그림 위 끝), 바닥 30%, 원근 street, 양옆 open, 가이드 v2"
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
