"""중림 뒷골목 7칸 명세(사용자 10-31 「한번에 전부 뽑아」). 고정 문장은 7칸 모두 같고(앞골목 ②③④에서 확인한 방식), 가게 내용·간판만 다르다.
가게 이름(사용자 확정): 헐값매입·대한안전·동방레저·(셔터+통로)·막잔·만물상회·진성약업사. 가이드는 앞골목과 같은 v6."""
import json, os
D = 'game-src/art/pixellab-test-20261028/specs/'
FIX = dict(room='corridor', mood='worn', mode='loose', view='corridor', floor_share='the lower 40 percent', sides='none', density='packed+',
           place="a narrow, dark back alley of a run-down 1990s Seoul underground arcade, low ceiling right above the sign",
           time="night", light="a few caged wall lamps and shop light",
           floor="smooth dark poured concrete like one wet sheet, mottled grime, many puddles, wet stains, varied litter all over the walkway, shadows under objects",
           walls="bare stained concrete and exposed old brick, peeling paint, mold, water marks; low ceiling strip, tangled pipes and cables, caged wall lamps, no fluorescent tubes",
           palette="dark cold blue-grey, amber lamp light accents",
           shadow="strong contrast, amber lamp pools, very dark patches, black shadow under objects", sized=[])
U = "사용자 10-31: 뒷골목 7칸 한번에, 앞골목과 같은 가이드 v6, 고정 문장 7칸 같게, 간판 모양·색 칸마다 다르게, 뒷골목은 더 어둡고(벽등·가게 불빛만) 차가운 푸른 회색, 맨 콘크리트·벽돌, 잠기고 숨기는 가게"
L = ("left 10 percent of the image: only bare back wall and floor, no side wall", "사용자 이음매: 앞 기둥 자리", ["left 10 percent"])
R = ("right 10 percent of the image: only bare back wall and floor, no side wall", "사용자 이음매: 앞 기둥 자리", ["right 10 percent"])
TR = lambda s: (f"wall base beside the shop: collapsed cardboard, burst trash bag, {s}, each a different shape", "사용자 쓰레기 제각각", ["burst trash bag", "each a different shape"])
LAMP = ("a caged wall lamp with a dim amber glow", "의뢰문: 형광등 대신 벽등", ["caged wall lamp"])
P = [
 ('p1', 1, ["other doors", "side walls"], "헐값매입", [
   ("far left 20 percent of the image: a dead-end wall with a lowered rusty shutter, military equipment cases and boxes piled in front of it", "의뢰문 ① 왼쪽 끝 셔터 막다른 벽·장비 케이스 더미", ["dead-end wall", "equipment cases"]),
   ("back wall, centered: a cramped pawn shop with a heavy old wooden door in the middle and a lit display window crammed with small jewelry, watches, porcelain and nameless odd objects, an old dark wooden board with carved gold letters reading \"헐값매입\"", "위키 헐값 매입(유리 진열장·보석·시계·도자기·이름표 없는 기묘한 물건), 간판 나무판·금색 새김 글씨, 게임 출입구 heolgap", ["pawn shop", "wooden door", "display window", "reading \"헐값매입\""]),
   ("clear empty floor in front of the wooden door", "게임 출입구 앞 비움", ["clear empty floor"]),
   TR("broken bottles"), ("a rusted trash can", "설계안 쓰레기통", ["trash can"]), LAMP,
   ("tangled cables hanging down the wall", "의뢰문 엉킨 전선", ["tangled cables"]),
   ("a small CCTV camera over the door", "암시장 경계", ["CCTV camera"]),
   ("a torn blank poster", "벽 종이 몇 군데만", ["blank poster"]), R]),
 ('p2', 0, ["doors", "stairs", "side walls"], "대한안전", [L,
   ("back wall, centered: a big safety supply shop recessed like a deep lit room, crammed with gas masks, hazmat suits, safety vests, helmets and equipment cases hung and stacked everywhere, a vertical yellow blade sign with black letters reading \"대한안전\"", "의뢰문 ② 장비 가게(방독면·방호복·전술 조끼·헬멧·장비 케이스), 사용자 이름 대한안전, 간판 노란 세로 돌출판", ["safety supply shop", "gas masks", "hazmat suits", "reading \"대한안전\""]),
   ("a wheeled cart jutting onto the walkway with a load under a yellow tarp and a military case on top", "의뢰문 바퀴 매대·노란 방수포·군용 케이스", ["wheeled cart", "yellow tarp"]),
   ("stacked equipment cases beside the cart", "의뢰문 장비 케이스", ["equipment cases"]),
   TR("crushed cans"), ("a dented metal trash can", "설계안 쓰레기통", ["trash can"]), LAMP,
   ("a rusty air conditioner unit, tangled cables", "설계안 공조", ["air conditioner"]),
   ("a torn blank poster", "벽 종이 몇 군데만", ["blank poster"]), R]),
 ('p3', 1, ["other doors", "stairs", "side walls"], "동방레저", [L,
   ("back wall, centered: a fishing and hiking goods shop front with fishing rods, reels, tackle boxes and backpacks in the window, and behind a wire mesh wall at the back hunting rifles and knives, a locked steel door with a barred window, raised rusty metal letters reading \"동방레저\" on a steel plate", "의뢰문 ③ 무기 가게(철망 벽의 총·칼, 굳게 닫힌 철문·쇠창살 창), 사용자 이름 동방레저(낚시·등산 겉모습), 간판 녹슨 철판 입체 글자", ["fishing rods", "wire mesh wall", "hunting rifles", "steel door", "reading \"동방레저\""]),
   ("low display crates jutting onto the walkway, full of fishing gear", "의뢰문 가게 앞 낮은 진열 상자", ["low display crates"]),
   ("clear empty floor in front of the steel door", "문 앞 비움", ["clear empty floor"]),
   TR("bottles"), ("a rusted trash can", "설계안 쓰레기통", ["trash can"]), LAMP,
   ("a small CCTV camera over the door", "암시장 경계", ["CCTV camera"]),
   ("tangled cables hanging down the wall", "의뢰문 엉킨 전선", ["tangled cables"]), R]),
 ('p4', 0, ["doors", "stairs", "side walls"], None, [L,
   ("back wall, centered, in the shop-sized space: on its left a closed vacant shop with a dented rusty rolling shutter, graffiti and an empty sign board with no letters; on its right a wide bright passage cut into the wall leading straight back to the brighter main corridor", "의뢰문 ④ 지하 1층으로 돌아가는 넓은 통로 입구, 앞골목 ⑤처럼 셔터와 한 장에, 게임 출입구 b1", ["rolling shutter", "no letters", "wide bright passage"]),
   ("a painted left arrow beside the passage", "의뢰문 왼쪽 화살표", ["left arrow"]),
   ("clear empty floor in front of the passage", "게임 출입구 앞 비움", ["clear empty floor"]),
   ("stacked boxes in front of the shutter", "의뢰문 쌓인 상자", ["stacked boxes"]),
   ("tangled cables down the wall", "의뢰문 엉킨 전선", ["tangled cables"]),
   TR("bottles"), LAMP, ("a faded fire extinguisher box", "설계안 소화기함", ["fire extinguisher box"]), R]),
 ('p5', 1, ["other doors", "stairs", "side walls"], "막잔", [L,
   ("back wall, centered: a tiny drinking bar with an old wooden door and a big steamed-up window showing shelves of liquor bottles and a drinks fridge, a small round hanging sign reading \"막잔\"", "의뢰문 ⑤ 작은 술집(낡은 나무 문·김 서린 창·술병 선반·냉장고), 간판 둥근 매달린 판", ["drinking bar", "wooden door", "steamed-up window", "reading \"막잔\""]),
   ("stacks of empty beer crates beside the door", "의뢰문 빈 맥주 상자 더미", ["beer crates"]),
   ("empty bottles on the floor", "의뢰문 빈 병", ["empty bottles"]),
   ("clear empty floor in front of the wooden door", "문 앞 비움", ["clear empty floor"]),
   TR("cigarette butts"), ("an overflowing metal trash can", "설계안 쓰레기통", ["trash can"]), LAMP,
   ("a rusty air conditioner unit", "설계안 공조", ["air conditioner"]), R]),
 ('p6', 0, ["doors", "stairs", "side walls"], "만물상회", [L,
   ("back wall, centered: a dark junk and curio shop recessed like a deep room, piles of old junk and glass cases each holding one strange small object: a small brass timepiece whose hands run backward, a cracked mask, a palm-sized black cube, a flickering pink neon sign reading \"만물상회\"", "의뢰문 ⑥ 정체불명 물건 가게(거꾸로 도는 탁상 시계(시계 낱말 금지라 timepiece)·금 간 가면·검은 정육면체), 사용자 이름 만물상회(고물상 겉모습), 간판 네온", ["junk and curio shop", "glass cases", "cracked mask", "black cube", "reading \"만물상회\""]),
   ("a low glass display table jutting onto the walkway", "의뢰문 가게 앞 낮은 유리 진열대", ["low glass display table"]),
   ("a locked military box beside it", "의뢰문 잠긴 군용 상자", ["locked military box"]),
   TR("crushed cans"), ("a dented metal trash can", "설계안 쓰레기통", ["trash can"]), LAMP,
   ("tangled cables hanging down the wall", "의뢰문 엉킨 전선", ["tangled cables"]),
   ("a torn blank poster", "벽 종이 몇 군데만", ["blank poster"]), R]),
 ('p7', 0, ["doors", "stairs"], "진성약업사", [L,
   ("back wall, centered: an herbal medicine shop with a half-raised rusty shutter and a plastic strip curtain, bundles of dried herbs hanging, shelves of small jars and glass bottles, an old scale, a torn striped awning with letters reading \"진성약업사\"", "의뢰문 ⑦ 약재 가게(반쯤 올린 셔터·비닐 커튼·말린 약초·단지·저울), 사용자 이름 진성약업사, 간판 찢긴 줄무늬 차양", ["herbal medicine shop", "dried herbs", "reading \"진성약업사\""]),
   ("herb sacks and boxes jutting onto the walkway", "의뢰문 약재 자루와 상자", ["herb sacks"]),
   ("far right 20 percent of the image: a dead end closed by a rusty chain-link fence, military cases and an overflowing trash can in front of it", "의뢰문 오른쪽 끝 녹슨 철망 담장·군용 케이스·넘친 쓰레기통", ["chain-link fence", "military cases", "overflowing trash can"]),
   TR("bottles"), LAMP,
   ("tangled cables hanging down the wall", "의뢰문 엉킨 전선", ["tangled cables"]),
   ("a rusty air conditioner unit", "설계안 공조", ["air conditioner"]),
   ("a torn blank poster", "벽 종이 몇 군데만", ["blank poster"]),
   ("a small CCTV camera", "암시장 경계", ["CCTV camera"])]),
]
for key, doors, no, sign, items in P:
    d = dict(FIX, name=f'jr_alley_{key}_v1', doors=doors, no=no,
             items=[{"full": t, "text": t, "why": w, "keep": k} for t, w, k in items],
             must=([{"kw": f'reading "{sign}"', "from": "사용자 확정 가게 이름"}] if sign else []) + [{"kw": "one wet sheet", "from": "사용자 바닥 선 금지"}],
             brief={"wiki": "중림 지하상가 뒷골목: 앞쪽보다 좁고 어둡고 조용, 장물·무기·정체불명 물건·이상한 약재", "design": "GPT 의뢰문 뒷골목 7칸(장면 구성 근거)", "user": [U],
                    "items": [{"src": f"{i}번 줄 근거", "by": [i]} for i in range(len(items))]},
             review={"fit": f"{len(items)}줄 모두 뒷골목 이 칸의 가게·소품, 의자·사람 없음", "place": "가게 가운데(가이드 v6), 문·통로 앞 비움, 이음 쪽 10% 비움, 양끝 칸은 막다른 곳 20%",
                     "size": "크기 숫자 없음(느슨한 틀)", "brief": "의뢰문 칸 내용 모두 대응, 빠진 것 없음", "meaning": "1차=2차(느슨한 틀)",
                     "over": "같은 물건 두 번 없음, packed+", "frame": "고정 문장 7칸 같음, 가이드 v6, 간판만 칸마다 다름"})
    json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
