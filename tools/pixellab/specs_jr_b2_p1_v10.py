"""중림 지하 2층 ① 영창 v10(사용자 10-31 「1」: 간판만 다른 장처럼 큰 판으로 시험). ① v1~v9 모두 작게 나옴,
②③④와 늘 다른 것 = 왼쪽 끝 처리와 작은 「창고 B-7」 철판 간판. 이번엔 간판만 큰 판으로 — 나머지는 v9 그대로."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
d = json.load(open(D + 'jr_b2_p1_v9.json')); d['name'] = 'jr_b2_p1_v10'
for i in d['items']:
    if i['text'].startswith('back wall, centered:'):
        a = 'a steel plate reading "창고 B-7"'
        assert a in i['text']; i['text'] = i['text'].replace(a, 'a big steel sign board reading "창고 B-7"')
for i in d['items']:   # 군말 줄임(글자 수)
    i['text'] = i['text'].replace('a narrow stairwell, steps going down into darkness', 'a narrow stairwell going down into darkness').replace('right of the shop: CCTV, a buzzer, crates', 'right of the shop: CCTV, buzzer, crates')
d['brief']['user'].append("v9 작음(사용자 「작아」) → 간판만 다른 장 같은 큰 판(사용자 「1」)")
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
