"""중림 지하 2층 ① 영창 v7(사용자 10-31 「다른거랑 프롬프트 비교해서 점검해」「뽑아」「더 가깝게」).
v6과 ②③④⑤ 비교: 바닥·벽·빛·설정값은 같음. 다른 것 셋 — 계단 줄이 가게 줄보다 먼저(⑤는 가게 먼저), 가게 폭 문구가 '계단부터'(가운데 80% 아님),
가이드 v8_left. v6 결과: 바닥선 y295(③ 325), 가게 50%.
v7: 가게 줄 문구·가이드를 ②③④와 같게(가운데 80%, v8), 계단은 가게 줄 뒤에 왼쪽 10% 안으로."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
d = json.load(open(D + 'jr_b2_p1_v6.json')); d['name'] = 'jr_b2_p1_v7'
items = d['items']
stair = next(i for i in items if 'stairwell cut into the floor' in i['text'])
chain = next(i for i in items if i['text'].startswith('a chain across the stairwell'))
shop = next(i for i in items if i['text'].startswith('back wall, centered:'))
stair['text'] = "left 10 percent of the image: a narrow stairwell cut into the floor, steps going down into darkness, a waist-high railing on its walkway edge"
shop['text'] = shop['text'].replace('spanning the wall from the stairwell to the right empty strip', 'filling the middle 80 percent of the width')
rest = [i for i in items if i not in (stair, chain, shop)]
d['items'] = [shop] + [rest[0]] + [stair, chain] + rest[1:]   # 가게 → 문 앞 비움 → 계단·쇠사슬 → 나머지(⑤ 순서)
d['brief']['items'] = [{"src": f"{k}번 줄 근거", "by": [k]} for k in range(len(d['items']))]
d['brief']['user'].append("v6 바닥선 y295·가게 50% → 가게 줄·가이드 ②③④와 같게(80%·v8), 계단은 가게 뒤 순서로 왼쪽 10% 안(사용자 「더 가깝게」)")
d['review']['frame'] = "첫 줄·가게 줄 문구·가이드 v8은 ②③④와 같음, 금지 목록은 끝 칸(계단 허용), 계단 줄은 가게 줄 뒤"
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
