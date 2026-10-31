"""중림 지하 2층 ① 영창 v8(사용자 10-31 「더 가깝게 1장 뽑아」). v7: 바닥선 y315(③ 325), 문 160(③ 약 180), 폭 53%(③ 58%).
v8: 가게 줄에 'reaching up to the ceiling strip'(가게 앞면이 천장 띠까지)만 더함. 나머지는 v7 그대로."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
d = json.load(open(D + 'jr_b2_p1_v7.json')); d['name'] = 'jr_b2_p1_v8'
for i in d['items']:
    if i['text'].startswith('back wall, centered:'):
        a = 'standing on the walkway floor line, '
        assert a in i['text']; i['text'] = i['text'].replace(a, a + 'reaching up to the ceiling strip, ')
for i in d['items']:
    i['text'] = i['text'].replace('a narrow stairwell cut into the floor', 'a narrow stairwell in the floor')   # 군말 줄임(글자 수)
d['brief']['user'].append("v7 아직 작음(사용자 「더 가깝게」) → 가게 앞면이 천장 띠까지")
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
