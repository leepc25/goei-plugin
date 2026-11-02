"""중림 지하 2층 ① 영창 v6(사용자 10-31 「1번해봐」). v1~v5 공통: '왼쪽 끝을 벽으로 막아라'가 들어가면 매번 깊이 있는 막다른 구석이 그려져
뒷벽이 밀리고 가게가 작아짐(v5는 오른쪽에 샛길까지). 계단으로 끝나는 칸(앞골목 ①⑦, 지하 2층 ⑤)은 구도가 가운데 칸과 같음.
v6: 왼쪽 끝을 막는 벽 대신 내려가는 계단 입구(앞골목 ⑦ 계단 문장을 왼쪽으로) + 쇠사슬·「출입금지」. 게임에서는 못 들어감.
가게 줄은 ⑤처럼 계단부터 오른쪽 비움 띠까지(가이드 v8_left). 소품은 v4처럼 가게 양옆(v5 앞면 소품 진단은 틀림)."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
d = json.load(open(D + 'jr_b2_p1_v4.json')); d['name'] = 'jr_b2_p1_v6'
d['no'] = ['other doors', 'side walls']
old = None
for i in d['items']:
    if i['text'].startswith('left 10 percent of the image: a rusty shutter wall'):
        old = dict(i)
        i['full'] = i['text'] = "far left 20 percent of the image: a rectangular stairwell cut into the floor, steps going down into darkness, a waist-high railing on its walkway edge"
        i['why'] = "사용자 「1번해봐」: 왼쪽 끝은 벽 대신 내려가는 계단 입구(앞골목 ⑦ 계단 문장)"
    if i['text'].startswith('back wall, centered:'):
        i['text'] = i['text'].replace('filling the middle 80 percent of the width', 'spanning the wall from the stairwell to the right empty strip').replace('a full-height steel door with three deadbolts in the middle', 'a full-height steel door, three deadbolts, in the middle')
d['items'].insert(1, dict(full='a chain across the stairwell and a plate reading "출입금지"', text='a chain across the stairwell and a plate reading "출입금지"', why="계단은 막힘(게임에서 못 들어감)", keep=[]))
d['must'].append({"kw": 'reading "출입금지"', "from": "막힌 계단"})
d['removed_by_user'] = [{"full": old['full'], "by": "사용자 10-31 「1번해봐」 — 왼쪽 끝 막이 벽을 내려가는 계단 입구(쇠사슬·출입금지)로 바꿈"}]
d['brief']['items'] = [{"src": f"{k}번 줄 근거", "by": [k]} for k in range(len(d['items']))]
d['brief']['user'].append("v1~v5 ① 막이 벽이 매번 깊은 구석을 만듦 → 사용자 「1번해봐」: 왼쪽 끝은 계단 입구, 쇠사슬·출입금지")
d['review']['frame'] = "첫 줄·가게 줄 틀은 가운데 칸과 같음, 금지 목록은 ⑤와 같은 끝 칸(계단 허용), 가이드 v8_left"
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
