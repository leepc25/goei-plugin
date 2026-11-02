"""중림 지하 2층 v2(사용자 10-31). v1이 장마다 제각각 나온 이유(내 잘못): ②③④ 금지 문장에서 stairs·side walls를 뺌,
가게 줄을 장마다 '문 하나+깊이 들어간 방'으로 새로 써서 좁은 입구로 나옴, 가이드 네모(60%)와 글(80%)이 달랐음.
v2: 금지 목록은 앞골목과 같게(가운데 칸 ④, 끝 칸 ①은 왼쪽 옆벽만 허용, ⑤는 앞골목 ⑦과 같게),
가게 줄은 5장 모두 같은 틀 「a big X front <폭>, standing on the walkway floor line, <문> in the middle and wide <창> on both sides of it, <안>; 간판 자리, <간판>」,
가이드 v8(가운데 80%, 끝 칸은 옆벽·계단 쪽 20% 뺀 폭). 청운기원은 무엇 하는 곳인지 보이게(사용자 「뭐하는덴지 전혀 알수가 없잖아」)."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
SIGN = "right above the opening, just under the ceiling strip"
MID = "filling the middle 80 percent of the width"
SHOP = {
 'p1': ("a big storage unit front spanning the wall from the left side wall to the right empty strip, standing on the walkway floor line, a full-height steel door with three deadbolts in the middle and wide steel shutters on both sides of it, a bare bulb; " + SIGN + ", a steel plate reading \"창고 B-7\"", ['other doors', 'stairs']),
 'p2': ("a big baduk club front " + MID + ", standing on the walkway floor line, a glass door in the middle and wide windows on both sides of it, half covered with newspaper, through the gaps felt tables with hwatu cards, cash and ashtrays, a go board, red light, smoke; " + SIGN + ", a white light box with go stones and black letters reading \"청운기원\"", ['other doors', 'stairs', 'side walls']),
 'p3': ("a big pawnshop front " + MID + ", standing on the walkway floor line, a barred glass door in the middle and wide steel-barred lit showcase windows on both sides of it, crammed with watches, gold rings, cameras and an old guitar; " + SIGN + ", a yellow sign with red letters reading \"제일전당포\"", ['other doors', 'stairs', 'side walls']),
 'p4': ("a big shaman's shrine front " + MID + ", standing on the walkway floor line, an open lattice door in the middle and wide red-lit lattice windows on both sides of it, five-color cloth strips, red candles, paper talismans and a small altar inside; " + SIGN + ", a plain red-and-white cloth flag and a board reading \"천수보살\"", ['other doors', 'stairs', 'side walls']),
 'p5': ("a big adult gambling arcade front spanning the wall from the left empty strip to the stairwell, standing on the walkway floor line, a half-open dark door in the middle and wide black windows on both sides of it, slot machine rows inside, a barred cash window with cash stacks; " + SIGN + ", a gold neon sign reading \"황금오락실\"", ['other doors', 'side walls']),
}
TRIM = {   # 2차 문장 군말 줄임(물건은 그대로)
 'p1': {"far left 20 percent: the left side wall, angled from the back wall corner to the front edge, closes the walkway floor to ceiling, a lowered rusty shutter in it, junk piled against it":
        "far left 20 percent: the left side wall, angled from the back wall corner to the front edge, closes the walkway floor to ceiling, a lowered shutter in it, junk against it",
        "wall base: cardboard, broken bottles, cigarette butts, each a different shape": "wall base: cardboard, bottles, cigarette butts, each a different shape",
        "a green exit sign light box, no letters": "a green exit sign, no letters"},
 'p2': {"left of the shop: stacked beer crates, a can full of cigarette butts": "left of the shop: beer crates, a can of cigarette butts",
        "a caged wall lamp with a dim red bulb": "a caged red wall lamp"},
 'p3': {"a green exit sign light box, no letters": "a green exit sign, no letters"},
 'p4': {"a caged wall lamp with a dim red bulb": "a caged red wall lamp"},
 'p5': {"far right 20 percent of the image: a stairwell at the right edge, steps going up to the back toward faint light, a waist-high railing on its walkway edge":
        "far right 20 percent of the image: a stairwell, steps going up toward faint light, a waist-high railing on its walkway edge",
        "right of the shop: a CCTV camera, an air conditioner unit": "right of the shop: a CCTV camera, an air conditioner",
        "clear empty floor in front of the glass door": "clear empty floor in front of the door",
        "left of the shop: a trash can, a burst trash bag": "left of the shop: a trash can, a trash bag"},
}
for k, (shop, no) in SHOP.items():
    d = json.load(open(D + f'jr_b2_{k}_v1.json'))
    d['name'] = f'jr_b2_{k}_v2'; d['no'] = no
    d['palette'] = "near-black grey-green, green and red accents"   # 군말 줄임(글자 수)
    d['walls'] = "raw concrete, water stains, soot, graffiti; ceiling strip, tangled cables, fluorescent tubes, nearly all dead, one flickering"
    d['floor'] = "smooth dark poured concrete like one wet sheet, grime, oil stains, dark puddles, varied litter all over the walkway"
    d['shadow'] = "very dark, black shadows under objects, small light pools"
    for i in d['items']:
        i['text'] = TRIM.get(k, {}).get(i['text'], i['text'])
    it = next(i for i in d['items'] if i['text'].startswith('back wall, centered:'))
    it['text'] = 'back wall, centered: ' + shop   # full(1차)은 v1 그대로 두고 2차 문장만 공통 틀로
    for i in d['items']:
        if i['text'].startswith('clear empty floor in front of the'): pass
    d['brief']['user'] += ["v1 제각각(사용자 「전부 그림이 다르냐」) → 금지 목록 앞골목과 같게, 가게 줄 5장 같은 틀, 가이드 v8 80%(사용자 「80%로 해」)",
                           "청운기원: 무엇 하는 곳인지 보이게 — 신문지는 반만, 틈으로 화투 탁자·돈·재떨이·바둑판, 간판에 바둑돌(사용자)",
                           "천수보살 v1 간판에 태극기 → 무늬 없는 붉은·흰 천 깃발로", "영창 v1 철문이 에일린보다 작음 → full-height", "황금오락실: 그냥 오락실로 보임(사용자 「뭐가 위험한덴데」) → 불법 성인 도박 오락실, 검은 선팅, 쇠창살 환전 창구·돈다발"]
    d['review']['frame'] = "구조 문장·금지 목록은 앞골목과 같음(① 왼쪽 옆벽, ⑤ 계단만 허용), 가게 줄 5장 같은 틀, 가이드 v8"
    json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
    print(d['name'])
