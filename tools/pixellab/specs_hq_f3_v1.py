"""관리국 본부 3F 복도 v1 명세(사용자 10-31). 결정: 본부 최소 구조, 층마다 복도 한 장(이어 그리기 없음), 현대적인 사무실(B2 빼고),
양 끝은 화면 밖으로 이어짐(한 층의 일부만 보임), 엘리베이터는 모든 층 오른쪽 끝 뒷벽 정면. 지킬 것: 문이 사람보다 조금 큰 크기, 걷는 바닥 깊이.
3F: 종합대응팀 사무실(유리 이중문) · 화장실(여) · 휴게실 · 엘리베이터. 글씨·숫자·로고 없이 그림 기호와 색 띠(본부 설계 규칙)."""
import json
D = 'game-src/art/pixellab-hq-20261031/specs/'
items = [
 ("back wall, left part: the wide glass double doors of the main response team office, frosted glass band, a dark navy stripe beside the door, closed", "종합대응팀 사무실 입구"),
 ("clear empty floor in front of the glass doors", "출입구 앞 비움"),
 ("back wall, middle: a plain wooden door to the women's restroom with a red women pictogram plate, no letters, closed", "화장실(여)"),
 ("back wall, middle right: a wooden door to the lounge with a coffee cup pictogram plate, no letters, closed", "휴게실"),
 ("back wall, right end: brushed steel elevator doors set flat in the back wall, a call button panel beside them, a small arrow light above, no numbers, closed", "엘리베이터(모든 층 같은 자리)"),
 ("clear empty floor in front of the elevator", "엘리베이터 앞 비움"),
 ("between the doors: tall potted plants, a water dispenser, a fire extinguisher cabinet", "복도 소품"),
 ("on the walls: framed abstract prints, a blank notice board, a hand sanitizer", "벽 소품"),
 ("along the wall base: recycling bins, a stack of document boxes", "복도 소품"),
 ("ceiling: flat white LED panel lights, a smoke detector, an air vent", "천장"),
]
d = {
 "name": "hq_f3_v1", "room": "corridor", "mood": "clean", "mode": "loose", "view": "corridor", "sides": "none",
 "floor_share": "the lower 30 percent", "density": "packed",
 "place": "the third floor corridor of a modern government office building in Seoul", "time": "daytime",
 "light": "even cool white office light",
 "floor": "smooth light grey polished floor like one sheet, faint reflections, shadows under objects",
 "walls": "clean light grey walls, warm wood panel accents, a thin dark baseboard; ceiling strip with flat LED panels",
 "shadow": "soft even light, darker corners and soft shadows under objects and in the door recesses",
 "palette": "bright white and light grey, warm wood, dark navy accents",
 "doors": 4, "no": ["other doors", "letters", "numbers"], "sized": [],
 "items": [dict(full=t, text=t, why=w, keep=[]) for t, w in items],
 "must": [{"kw": "like one sheet", "from": "바닥 줄 금지"}],
 "brief": {"wiki": "관리국 본부", "design": "본부 설계 2판 규칙: 글씨·숫자·로고 없이 기호·색 띠",
           "user": ["사용자 10-31: 본부 최소 구조, 3F = 종합대응팀·화장실(여)·휴게실·엘리베이터", "현대적인 사무실(B2 빼고)", "복도는 한 층의 일부, 양 끝은 이어짐", "엘리베이터 오른쪽 끝 뒷벽"],
           "items": [{"src": f"{k}번 줄 근거", "by": [k]} for k in range(len(items))]},
 "review": {"fit": "현대 사무 복도, 사람·의자·벤치 없음", "place": "문은 모두 뒷벽 정면, 엘리베이터 오른쪽 끝, 문 앞 비움",
            "size": "가이드 사각형으로 엘리베이터 크기(문 높이 기준)", "brief": "사용자 결정(3F 문 셋+엘리베이터, 현대 사무실, 양 끝 이어짐) 모두 넣음, 빠진 것 없음", "meaning": "1차=2차(느슨한 틀)",
            "over": "같은 물건 두 번 없음, packed", "frame": "카메라 문장은 중림과 같음, 뒷벽 곧게, 바닥 30%, 양 끝 이어짐, 가이드 hq_corridor_guide_v1"},
}
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
print(d['name'])
