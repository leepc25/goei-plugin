"""중림 지하 2층 v3: ①② 다시(사용자 10-31 「1,2번이 문제야 2번은 너무 크고 1번은 너무 작아」).
v2 측정: ① 가게 폭 약 46%(왼쪽 옆벽 20% + 가이드 v8_left), ② 폭 약 66%·간판이 세로로 큼(위 끝 y58, ③은 y85).
① → 가운데 칸과 같은 가이드 v8·같은 폭 문구(가운데 80%), 왼쪽 옆벽은 왼쪽 10% 안에서만.
② → 간판을 ③과 같은 말(a ... sign)로: 큰 라이트박스 대신 간판판. 나머지 그대로."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
d = json.load(open(D + 'jr_b2_p1_v2.json')); d['name'] = 'jr_b2_p1_v3'
for i in d['items']:
    if i['text'].startswith('far left 20 percent: the left side wall'):
        i['text'] = i['text'].replace('far left 20 percent:', 'far left 10 percent of the image:')
    if i['text'].startswith('back wall, centered:'):
        i['text'] = i['text'].replace('spanning the wall from the left side wall to the right empty strip', 'filling the middle 80 percent of the width')
d['brief']['user'].append("v2 ① 너무 작음(사용자) → 가운데 칸과 같은 80% 문구·가이드 v8, 왼쪽 옆벽은 왼쪽 10% 안")
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
d = json.load(open(D + 'jr_b2_p2_v2.json')); d['name'] = 'jr_b2_p2_v3'
for i in d['items']:
    if i['text'].startswith('back wall, centered:'):
        a = 'a white light box with go stones and black letters reading'
        assert a in i['text']; i['text'] = i['text'].replace(a, 'a white sign with go stones and black letters reading')
d['brief']['user'].append("v2 ② 너무 큼(사용자): 간판 라이트박스가 세로로 커짐 → ③과 같은 'a ... sign'")
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
print('ok')
