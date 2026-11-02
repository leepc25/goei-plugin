"""중림 지하 2층 ① 영창 v9 전면 개편(사용자 10-31 「프롬프트 전면개편해 아예 저 창고 모습부터 전부 다시」).
v1~v8 공통: 영창을 '창고(storage unit)·셔터'로 써서 가게가 아니라 차고·벽감처럼 그려지고, 안이 안 보이는 평평한 철판이라
모델이 깊이(벽감·막다른 구석)로 메우며 크기가 매번 흔들림. ②③④는 모두 '가운데 문 + 양옆 넓은 창, 안에 무엇이 보임'.
v9: 영창도 ②③④와 같은 모양 — 옛 가게 앞면을 사채 사무실로 쓰는 곳. 가운데 데드볼트 셋 철문(「창고 B-7」은 위키대로 문 위 판),
양옆 넓은 창은 안쪽에서 쇠창살·철판으로 막고 틈으로 차가운 흰 불빛과 금고·서류철이 보임. 셔터·벽감 낱말 없음.
왼쪽 끝은 v7처럼 가게 줄 뒤에 왼쪽 10% 안 막힌 계단. 소품 줄·순서는 ②③④와 같은 틀."""
import json, copy
D = 'game-src/art/pixellab-test-20261028/specs/'
d = json.load(open(D + 'jr_b2_p1_v7.json')); d['name'] = 'jr_b2_p1_v9'
SHOP = ("back wall, centered: a big loan office front filling the middle 80 percent of the width, standing on the walkway floor line, "
        "a heavy steel door with three deadbolts in the middle and wide barred windows on both sides of it, steel plates behind, "
        "cold white light, a safe and files through gaps; right above the opening, just under the ceiling strip, "
        "a steel plate reading \"창고 B-7\"")
new = [
 (SHOP, "위키 영창: 철문 「창고 B-7」·데드볼트 셋·금고·서류(화이트보드), ②③④와 같은 가게 틀"),
 ("clear empty floor in front of the steel door", "출입구 앞 비움"),
 ("left 10 percent of the image: a narrow stairwell, steps going down into darkness, a waist-high railing on its walkway edge", "사용자: 왼쪽 끝 막힌 계단(v7)"),
 ("on its railing: a chain and a plate reading \"출입금지\"", "계단 막힘"),
 ("left of the shop: a fire extinguisher box, a trash bag", "설계안 소화기함"),
 ("right of the shop: CCTV, a buzzer, crates", "사채업자 경계"),
 ("wall base: cardboard, bottles, cigarette butts, each a different shape", "쓰레기 제각각"),
 ("a torn blank notice", "벽 소품"),
 ("a bare bulb", "깜빡이는 조명(위키)"),
 ("dripping pipes", "설계안 배관·물 얼룩"),
 ("a green exit sign, no letters", "설계안 비상구 유도등"),
 ("right 10 percent of the image: only bare back wall and floor, no side wall", "이음매"),
]
old_full = {i['full'] for i in d['items']}
d['items'] = [dict(full=t, text=t, why=w, keep=[]) for t, w in new]
d['removed_by_user'] = [{"full": f, "by": "사용자 10-31 「프롬프트 전면개편해 아예 저 창고 모습부터 전부 다시」 — 창고·셔터 모습을 버리고 새로 씀"} for f in old_full if f not in {t for t, _ in new}]
d['brief']['items'] = [{"src": f"{k}번 줄 근거", "by": [k]} for k in range(len(d['items']))]
d['brief']['user'].append("v1~v8 창고·셔터라 차고·벽감처럼 나와 크기 흔들림 → 사용자 「전면개편」: ②③④와 같은 '가운데 문+양옆 창, 안이 보임' 모양의 사채 사무실")
d['review']['frame'] = "첫 줄·가게 줄 틀·가이드 v8은 ②③④와 같음, 금지 목록은 끝 칸(계단 허용), 계단 줄은 가게 줄 뒤"
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
