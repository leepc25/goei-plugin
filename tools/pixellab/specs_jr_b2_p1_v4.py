"""중림 지하 2층 ① 영창 v4(사용자 10-31 「영창 다른거보다 작아 프롬프트 점검해」).
점검: ①만 첫 줄이 「Only the left side wall is visible…」(옆벽 문장)이라 방이 안쪽으로 깊어지며 뒷벽이 멀어짐 —
뒷벽 바닥선 y≈310(③ 325), 가게 높이 228(③ 237)·폭 56%(③ 58%). 뒷골목 ①②가 천장이 어긋났던 것과 같은 까닭, ⑦ v7b는 옆벽 문장 없이 맞춤.
v4: 첫 줄·금지 목록을 가운데 칸과 같게(옆벽 문장 없음), 왼쪽 막이는 ⑦ v7b처럼 왼쪽 10% 안에서 뒷벽에서 꺾여 나오는 셔터 벽으로."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
d = json.load(open(D + 'jr_b2_p1_v3.json')); d['name'] = 'jr_b2_p1_v4'
d['sides'] = 'none'; d['no'] = ['other doors', 'stairs', 'side walls']
for i in d['items']:
    if i['text'].startswith('far left 10 percent of the image: the left side wall'):
        i['text'] = "left 10 percent of the image: a rusty shutter wall turns out from the back wall toward the viewer and closes the walkway, seen almost edge-on, junk against it"
d['brief']['user'].append("v3 ① 다른 장보다 작음(사용자) → 옆벽 문장 빼고 첫 줄·금지 목록 가운데 칸과 같게, 왼쪽 막이는 ⑦ v7b처럼 10% 안에서 꺾여 나오는 셔터 벽")
d['review']['frame'] = "첫 줄·금지 목록·가게 줄 틀 모두 가운데 칸과 같음, 왼쪽 막이는 물건 줄(⑦ v7b 방식), 가이드 v8"
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
