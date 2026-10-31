"""중림 지하 2층(jr_b2) v1 명세 5장(사용자 10-31 「전체 한번에 뽑아」).
구조 문장은 앞골목 ④(jr_b1_p4_v1) 그대로. 바꾸는 것은 색·빛 상태·벽 표면·바닥 더러움·명암 위치만(사용자: 더 어둑하고 위험하게).
순서(사용자): ① 영창 컨설팅(맨 왼쪽, 왼쪽 끝 옆벽으로 막음) ② 청운기원 ③ 제일전당포 ④ 천수보살 ⑤ 황금오락실 + 오른쪽 끝 B1로 올라가는 계단.
영창은 위키대로 간판 없이 철문에 「창고 B-7」, 데드볼트 셋."""
import json, copy
D = 'game-src/art/pixellab-test-20261028/specs/'
base = json.load(open(D + 'jr_b1_p4_v1.json'))
KEEP = ['room', 'mood', 'mode', 'view', 'floor_share', 'density', 'place', 'time', 'light']   # 구조: 앞골목과 글자 그대로
ALLOW = dict(   # 고쳐도 되는 것만: 더 어둡고 위험하게
    palette="near-black cold grey-green, sickly green and dim red accents",
    walls="raw concrete, water stains, mold, soot, graffiti; ceiling strip, tangled cables, fluorescent tubes, nearly all dead, one flickering",
    floor="smooth dark poured concrete like one wet sheet, grime, oil stains, dark puddles, varied litter all over the walkway, shadows under objects",
    shadow="very dark, black shadows in corners and under objects, small light pools")
LEFT10 = "left 10 percent of the image: only bare back wall and floor, no side wall"
RIGHT10 = "right 10 percent of the image: only bare back wall and floor, no side wall"
SIGN = "right above the opening, just under the ceiling strip"
P = {
 'p1': dict(sides='left', end='left', name_kw='reading "창고 B-7"', items=[
   ("far left 20 percent: the left side wall, angled from the back wall corner to the front edge, closes the walkway floor to ceiling, a lowered rusty shutter in it, junk piled against it", "사용자: 영창이 맨 왼쪽, 왼쪽 끝 막음(뒷골목 ① v5와 같은 문장)"),
   ("back wall, centered: a big storage unit front filling the middle 80 percent of the width, recessed like a deep lit room, a heavy steel door in the middle, three deadbolts, a bare bulb; " + SIGN + ", a steel plate reading \"창고 B-7\"", "위키 영창컨설팅: 간판 없음, 철문 「창고 B-7」, 데드볼트 셋, 깜빡이는 조명"),
   ("clear empty floor in front of the steel door", "게임 출입구 앞 비움"),
   ("left of the shop: a fire extinguisher box, a burst trash bag", "설계안 소화기함"),
   ("right of the shop: a CCTV camera, a buzzer, crates", "사채업자 경계"),
   ("wall base: cardboard, broken bottles, cigarette butts, each a different shape", "사용자 쓰레기 제각각"),
   ("a torn blank notice", "벽 소품"),
   ("dripping pipes", "설계안 배관·물 얼룩"),
   ("a green exit sign light box, no letters", "설계안 비상구 유도등"),
   (RIGHT10, "이음매: 앞 기둥 자리")]),
 'p2': dict(sides='none', end=None, name_kw='reading "청운기원"', items=[
   (LEFT10, "이음매"),
   ("back wall, centered: a big shady baduk club front filling the middle 80 percent of the width, recessed like a deep lit room, a glass door and windows covered with yellowed newspaper, red light and smoke seeping through the gaps; " + SIGN + ", an old white light box with black letters reading \"청운기원\"", "사용자 확정: 청운기원(바둑 기원 간판의 도박장)"),
   ("clear empty floor in front of the glass door", "출입구 앞 비움"),
   ("left of the shop: stacked beer crates, a can full of cigarette butts", "도박장 소품"),
   ("right of the shop: a CCTV camera, a door buzzer, a burst trash bag", "도박장 경계"),
   ("wall base: wet cardboard, bottles, losing lottery tickets, each a different shape", "쓰레기 제각각"),
   ("a torn blank poster", "벽 소품"),
   ("a fire extinguisher box", "설계안 소화기함"),
   ("a caged wall lamp with a dim red bulb", "어두운 벽 등"),
   (RIGHT10, "이음매")]),
 'p3': dict(sides='none', end=None, name_kw='reading "제일전당포"', items=[
   (LEFT10, "이음매"),
   ("back wall, centered: a big pawnshop front filling the middle 80 percent of the width, recessed like a deep lit room, a thick steel-barred counter window and a barred glass door, lit showcases with watches, gold rings, cameras and an old guitar; " + SIGN + ", a yellow sign with red letters reading \"제일전당포\"", "사용자 확정: 제일전당포(쇠창살 창구)"),
   ("clear empty floor in front of the barred door", "출입구 앞 비움"),
   ("left of the shop: a rusty air conditioner unit, tangled cables", "벽 소품"),
   ("right of the shop: a CCTV camera, stacked boxes, a trash can", "경계·소품"),
   ("wall base: wet cardboard, bottles, each a different shape", "쓰레기 제각각"),
   ("a torn blank poster", "벽 소품"),
   ("dripping pipes under the ceiling", "설계안 배관·물 얼룩"),
   ("a green exit sign light box, no letters", "설계안 비상구 유도등"),
   (RIGHT10, "이음매")]),
 'p4': dict(sides='none', end=None, name_kw='reading "천수보살"', items=[
   (LEFT10, "이음매"),
   ("back wall, centered: a big shaman's shrine front filling the middle 80 percent of the width, recessed like a deep lit room glowing red, a wooden lattice door hung with five-color cloth strips, red candles, paper talismans and a small altar inside; " + SIGN + ", a red-and-white shaman flag and a board reading \"천수보살\"", "사용자 확정: 천수보살(무당집, 괴이 게임)"),
   ("clear empty floor in front of the lattice door", "출입구 앞 비움"),
   ("left of the shop: a stone salt bowl, a bundle of dried straw, melted candle stubs", "무당집 소품"),
   ("right of the shop: paper talismans on the wall, a fire extinguisher box", "무당집·설계안 소화기함"),
   ("wall base: wet cardboard, bottles, each a different shape", "쓰레기 제각각"),
   ("a torn blank notice", "벽 소품"),
   ("dripping pipes under the ceiling", "설계안 배관·물 얼룩"),
   ("a caged wall lamp with a dim red bulb", "어두운 벽 등"),
   (RIGHT10, "이음매")]),
 'p5': dict(sides='none', end='right', name_kw='reading "황금오락실"', items=[
   (LEFT10, "이음매"),
   ("back wall, centered: a big arcade front spanning the wall from the left empty strip to the stairwell, standing on the walkway floor line, a half-open glass door, glowing slot machines inside; " + SIGN + ", a gold neon sign, half dead, reading \"황금오락실\"", "사용자 확정: 황금오락실(꺼진 네온)"),
   ("clear empty floor in front of the glass door", "출입구 앞 비움"),
   ("far right 20 percent of the image: a stairwell at the right edge, steps going up to the back toward faint light, a waist-high railing on its walkway edge", "사용자: 오른쪽 끝에 B1로 올라가는 계단(앞골목 ⑦ 계단과 같은 방식)"),
   ("above the stairwell: a plate reading \"B1\" with an up arrow, a green exit sign, no letters", "설계안 비상구 유도등"),
   ("clear floor before the first step", "계단 앞 비움"),
   ("left of the shop: a trash can, a burst trash bag", "소품"),
   ("right of the shop: a CCTV camera, an air conditioner unit", "소품"),
   ("wall base: cardboard, bottles, each a different shape", "쓰레기 제각각"),
   ("a torn blank poster", "벽 소품")]),
}
for k, p in P.items():
    d = {x: copy.deepcopy(base[x]) for x in KEEP}
    d.update(ALLOW)
    d['name'] = f'jr_b2_{k}_v1'
    d['sides'] = p['sides']; d['doors'] = 1; d['no'] = ['other doors']; d['sized'] = []
    d['items'] = [dict(full=t, text=t, why=w, keep=[]) for t, w in p['items']]
    d['must'] = [{"kw": p['name_kw'], "from": "가게 이름"}, {"kw": "one wet sheet", "from": "사용자 바닥 선 금지"}]
    d['brief'] = {"wiki": "영창컨설팅: 지하 2층, 깜빡이는 조명·물 얼룩진 콘크리트, 철문 「창고 B-7」, 데드볼트 셋, 간판 없음",
                  "design": "필드_거점_설계안 jr_b2: 짙은 회색, 물 얼룩, 배관, 깜빡이는 조명, 소화기함, 비상구 유도등",
                  "user": ["사용자 10-31: 지하 2층은 더 어둑하고 위험하게, 창고만 뽑지 말 것",
                           "사용자 10-31: 영창 컨설팅이 맨 왼쪽, 오른쪽 끝에 올라가는 계단",
                           "사용자 10-31: 「전체 한번에 뽑아」",
                           "구조 문장은 앞골목 ④ 그대로, 색·빛 상태·벽 표면·바닥 더러움·명암만 바꿈"],
                  "items": [{"src": f"{i}번 줄 근거", "by": [i]} for i in range(len(p['items']))]}
    d['review'] = {"fit": "지하 2층 이 칸의 가게·소품, 의자·사람 없음", "place": "가게 가운데, 소품은 가게 왼쪽·오른쪽, 문 앞 비움",
                   "size": "크기 숫자 없음(느슨한 틀)", "brief": "칸 내용 대응, 빠진 것 없음", "meaning": "1차=2차(느슨한 틀)",
                   "over": "같은 물건 두 번 없음, packed+", "frame": "구조 문장은 앞골목 ④와 같음(① 왼쪽 옆벽), 가이드 v6"}
    json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
    print(d['name'], p['end'] or '')
