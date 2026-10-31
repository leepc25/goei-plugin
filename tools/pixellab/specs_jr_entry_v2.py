"""중림 지상 첫 장 v2(사용자 10-31 「1층만으로 다시 시도해 보자」). v1: 건물 1층+2층 일부를 넣느라 전체가 작게(셔터·공중전화 ≈100px < 뒤 에일린 140px).
v2: 건물은 1층 가게 앞면만, 간판 바로 위에서 그림 위 끝에 잘림. 현수막 글씨·차도는 그대로 둬도 됨(사용자). 나머지 v1 그대로."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
d = json.load(open(D + 'jr_entry_p1_v1.json')); d['name'] = 'jr_entry_p1_v2'
for i in d['items']:
    if i['text'].startswith('back: old low-rise shop buildings'):
        i['text'] = "back: old shop buildings along the whole width, only their ground floor shop fronts, cut off just above the shop signs"
for i in d['items']:   # 군말 줄임(글자 수): 현수막 글씨는 상관없음(사용자)
    i['text'] = i['text'].replace('a torn redevelopment banner, no letters', 'a torn redevelopment banner')
d['brief']['user'].append("v1 건물 2층까지 넣어 전체가 작아짐 → 1층 가게 앞면만(사용자)")
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
