"""중림 지하 2층 ① 영창 v5(사용자 10-31 「뽑아」). 진단: 가게 80% + 양끝 비움 10%씩 = 100%인데 'left/right of the shop' 소품을
가게 양옆 벽에 두라고 해서 모델이 가게를 줄여 자리를 만듦(5장 모두 55~62%), ①은 왼쪽 막이까지 있어 더 작아짐.
v5: 가게 양옆 벽 소품을 없애고 소품은 가게 앞면·가게 앞 바닥·천장으로. 나머지(첫 줄·금지 목록·가게 줄 틀·왼쪽 막이)는 v4 그대로."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
d = json.load(open(D + 'jr_b2_p1_v4.json')); d['name'] = 'jr_b2_p1_v5'
MAP = {
 "left of the shop: a fire extinguisher box, a burst trash bag": "on the shutters: a fire extinguisher box, a buzzer, a CCTV camera",
 "right of the shop: a CCTV camera, a buzzer, crates": "on the floor in front of the shop: a burst trash bag, crates",
 "wall base: cardboard, bottles, cigarette butts, each a different shape": "at the shutter base: cardboard, bottles, cigarette butts, each a different shape",
 "a torn blank notice": "a torn blank notice on a shutter",
  "a green exit sign, no letters": "a hanging green exit sign, no letters",
}
for i in d['items']:
    i['text'] = MAP.get(i['text'], i['text'])
d['brief']['user'].append("v4 ①이 여전히 작음(사용자 「근본적인 문제가 있어 프롬프트에」) → 가게 양옆 벽 소품을 없애 가게가 80%를 다 쓰게(소품은 가게 앞면·앞 바닥·천장)")
d['review']['place'] = "가게 양옆 벽 소품 없음, 소품은 가게 앞면·앞 바닥·천장, 문 앞 비움"
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
