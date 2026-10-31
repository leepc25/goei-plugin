"""중림 지상 거리(jr_entry) 첫 장(맨 오른쪽) v1 명세(사용자 10-31).
- 낮 한 장(필드_그림_통합_지침 0절 1: 지상은 낮만, 불빛 굽지 않음). 설계안은 폐기(사용자) — 위키·사용자 결정만.
- 오른쪽에 지하철 출입구처럼 인도 위에 따로 선 지하상가 출입구(지하상가는 도로·인도 밑, 사용자), 간판은 입구 위(사용자).
- 차도는 맨 아래 띠로만, 걷지 않음(턱 오르내림 없음, 사용자 10-31). 인도 30% + 차도 띠 8% = 바닥 38%.
- 이 장에서 왼쪽으로 inpaint-v3 이어 그리기(사용자 「오른쪽에 … 뽑고 왼쪽으로 이어나가면」) → 왼쪽은 그림 밖으로 이어짐.
- 카메라 문장은 지하 통로와 같음(크기 맞춤), 원근 'street', 양옆 'open', 가이드 jr_street_guide_v1."""
import json
D = 'game-src/art/pixellab-test-20261028/specs/'
items = [
 ("right 30 percent: only the front end of a freestanding arcade entrance on the sidewalk like a Seoul subway exit, the rest continuing past the right edge, open end facing left, stairs going down to the right into darkness, waist-high railings on both sides, a glass canopy over it", "사용자: 오른쪽에 지하철 출입구 같은 지하상가 입구"),
 ("on top of the canopy, right above the entrance: a sign board reading \"중림지하상가\"", "사용자: 간판은 입구 위"),
 ("clear sidewalk at the entrance", "출입구 앞 비움"),
 ("back: old low-rise shop buildings along the whole width, ground floor and part of the second floor, tops cut off", "거리 뒤 건물"),
 ("on the building fronts: faded blank signs, closed shutters, a small open shop, a note reading \"임대\" on an empty window", "낡은 상가 거리"),
 ("against the buildings: a vending machine, a parked motorbike, potted plants, trash bags and boxes", "거리 소품(인도 뒤쪽, 걷는 길 비움)"),
 ("a utility pole with tangled wires", "전봇대·전선"),
 ("an old public phone", "공중전화"),
 ("a torn redevelopment banner, no letters", "재개발 현수막"),
 ("bottom 8 percent: a curb and an asphalt strip, no cars, no markings", "사용자: 차도는 맨 아래 띠, 걷지 않음"),
 ("left 10 percent: only building fronts and sidewalk, continuing past the edge", "왼쪽으로 이어 그리기 자리"),
]
d = {
 "name": "jr_entry_p1_v1", "room": "corridor", "mood": "worn", "mode": "loose", "view": "street", "sides": "open",
 "floor_share": "the lower 38 percent: sidewalk, a road strip at the very bottom", "density": "packed+",
 "place": "a run-down 1990s Seoul shopping street sidewalk", "time": "late morning daylight",
 "light": "plain daylight, no lamps lit",
 "floor": "smooth worn grey concrete sidewalk like one sheet, stains, scattered litter",
 "walls": "grimy concrete and old tile building fronts, peeling paint, rust streaks",
 "shadow": "soft daylight shadows under objects and the canopy, dark stairwell",
 "palette": "faded grey, beige, dull blue, rust, soft daylight",
 "doors": 0, "no": ["cars"], "sized": [],
 "items": [dict(full=t, text=t, why=w, keep=[]) for t, w in items],
 "must": [{"kw": "reading \"중림지하상가\"", "from": "간판"}, {"kw": "like one sheet", "from": "사용자 바닥 선 금지"}],
 "brief": {"wiki": "중림 지하상가(회색 시장)", "design": "설계안 폐기(사용자 10-31)",
           "user": ["사용자 10-31: 지상은 이어 붙이기·기둥 말고, 오른쪽 지하상가 입구 첫 장 + 왼쪽으로 이어 그리기",
                    "낮만(10-24 결정), 간판은 입구 위, 지하상가는 도로 밑이라 입구는 인도 위",
                    "차도는 맨 아래 띠로만, 캐릭터는 인도만(턱 오르내림 없음)"],
           "items": [{"src": f"{k}번 줄 근거", "by": [k]} for k in range(len(items))]},
 "review": {"fit": "낡은 상가 거리 낮, 사람·차 없음", "place": "입구 오른쪽, 소품은 건물 앞(인도 뒤쪽), 걷는 길·입구 앞 비움",
            "size": "크기 숫자 없음(느슨한 틀), 가이드로 입구 크기", "brief": "사용자 결정 모두 대응", "meaning": "1차=2차(느슨한 틀)",
            "over": "같은 물건 두 번 없음, packed+", "frame": "카메라 문장 지하와 같음, 원근 street, 양옆 open, 바닥 38%(인도 30+차도 8), 가이드 jr_street_guide_v1"},
}
json.dump(d, open(D + d['name'] + '.json', 'w'), ensure_ascii=False, indent=1)
print(d['name'])
