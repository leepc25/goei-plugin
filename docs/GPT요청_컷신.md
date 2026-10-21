# GPT 요청서 · 컷신 장소 배경 (2026-10-21 정정판)

주인: 「대사와 컷신」 스레드(Claude).

**컷신은 움직이는 도트씬이다(사용자 결정 2026-10-21).** 엔진이 도트화한 배경 위에서 쟈알디 등 기존 캐릭터 클립을 걷게·돌아보게·말하게 하고, 문·승강기 문 같은 물건은 따로 움직이고, 카메라·흔들림·빛·암전은 코드로 넣는다. 그래서 GPT는 **장소의 벽 칸·바닥·원경·물건 시트만** 그린다.

- **캐릭터·사람이 든 그림은 그리지 않는다.** 이전 판(한 장 그림·쟈알디 그림)으로 이미 만든 것은 버린다(쓰지 않는다).
- 규칙은 `docs/GPT요청_게임배경.md`와 똑같다: 공통 STYLE 문단, WALL BAY RULES, FLOOR / FAR / OBJECT SHEET RULES, 그리고 그 문서의 「정정 (16:15)」 CORRECTION 문단(적은 큰 모양, 굵은 외곽선, 정면 시점 물건, 투명 배경)을 모든 요청문 앞에 붙인다.
- 크기: 벽 칸·원경 1536×1024, 바닥 1024×1024, 물건 시트 1536×1024 (게임 배경과 같음).
- 도트화는 Claude가 「게임 타일과 배경」의 도구로 한다.

## GPT에게 (작업 방법)

- 저장: **`game-src/art/cutscene/raw/<장소>/<파일 이름>.png`** (아래 이름 그대로). 다 올린 뒤 `game-src/art/cutscene/raw/README.md`에 받은 파일 목록을 적고 main에 커밋한다. `docs/GPT_요청_목록.md`의 컷신 줄 상태를 「받음」으로 바꾼다.
- 목록을 쉬지 않고 순서대로 전부 만든다. 한 답변에 여러 장 만들어도 된다. 묻지 않는다. 한도에 걸리면 멈춘 번호부터 이어 한다.
- 장소마다 **시간과 빛이 다르다.** 아래 PLACE 문단의 시간·빛을 꼭 지킨다(게임 배경은 대부분 밤이다).

## 이미 있는 게임 배경을 쓰는 컷신 (GPT가 그리지 않음)

| 컷신 | 쓰는 게임 배경 (`game-src/art/bg/raw/`) |
| --- | --- |
| 첫 출근 뒷부분 (사무실) | `hq_office` |
| 첫 투입·첫 호명 (승강기 안 → 로비) | `el_car`, `lobby` |
| 삼 년째 승객 (엘리베이터 홀) | `el_hall` |
| 다락방 | `service` (`service_wall_4`) |
| 귀환 앞부분 (승강로 로프) | `service` (`service_far_tall`, 로프 물건) |

## 새로 그릴 장소 4곳 (각 장소 = GPT 대화 하나)

### 1. cs_street · 텅 빈 종로 거리 (첫 출근 앞부분) — 아침

```
PLACE: an empty street in Jongno, central Seoul, at 8:40 on a weekday morning, completely deserted (no people, no cars, no birds). Time and light: early morning, flat cool grey daylight under an overcast sky, long soft shadows, no lamps lit. The "wall" is the row of old 4-6 storey office buildings and shops facing the street (facades: weathered beige and grey tile, dark window glass; pillars: the building corners / thick concrete columns between shopfronts). The sidewalk is the floor.
1. cs_street_wall_1 — a shopfront with its metal roller shutter pulled down and a blank sign board above, windows of offices above.
2. cs_street_wall_2 — the glass entrance of an old office building with a revolving door opening shown as an empty dark hole, blank brass name plates beside it.
3. cs_street_wall_3 — a convenience-store-like shop with lights off behind the glass, a blank awning.
4. cs_street_wall_4 — a narrow dark alley opening between two buildings, with a drainpipe and an air-conditioner unit on the wall.
5. cs_street_floor — grey concrete sidewalk paving blocks with a yellow tactile strip, top-down.
6. cs_street_far — the wide empty six-lane road and the buildings on the far side of the street, traffic lights on green, hazy grey morning.
7. cs_street_objects — 1 street lamp post (unlit), 2 traffic light pole for pedestrians, 3 bus stop shelter with a blank panel, 4 public trash bin, 5 bench, 6 fire hydrant, 7 newspaper rack (empty), 8 tree in a sidewalk grate, 9 parked delivery scooter.
```

### 2. cs_entrance · 낡은 사무실 건물 앞 (출구 컷신, 관리국 차량) — 새벽

```
PLACE: the front of the old Korean office building that hides the dimensional elevator, at dawn. Time and light: just before sunrise, deep blue sky turning pale orange at the bottom, the building's lobby lights still on (warm) inside the glass, street lamps still lit. Wall: the building's ground-floor facade (dark grey granite cladding, pillars: square granite columns).
1. cs_entrance_wall_1 — the main glass entrance doors of the building (the door leaves are separate objects, draw the empty lit doorway), a small canopy above, blank address plate.
2. cs_entrance_wall_2 — plain granite facade with a ground-floor window showing the lit lobby inside (marble, a closed elevator with brass trim far inside).
3. cs_entrance_wall_3 — a side service door opening (dark), an electric meter box, a pipe.
4. cs_entrance_floor — dark wet asphalt and granite curb paving, top-down.
5. cs_entrance_far — the dawn sky over low city rooftops, a few lit windows, horizontally tileable.
6. cs_entrance_objects — 1 black government sedan seen from the side, engine running, headlights on, back door closed (front view rules do not apply: draw this one car exactly from the side), 2 glass entrance door leaf (left), 3 glass entrance door leaf (right), 4 street lamp (lit), 5 standing ashtray, 6 potted shrub, 7 bollard, 8 "no parking" cone, 9 newspaper bundle on the ground.
```

### 3. cs_medbay · 본부 의무실 (후송 컷신) — 낮, 형광등

```
PLACE: a small infirmary room in the team's headquarters. Time and light: daytime but no windows, bright flat fluorescent light, slightly cold and clinical, very clean. Wall: pale mint-green painted wall with a white lower wainscot, pillars: plain white columns.
1. cs_medbay_wall_1 — a wall-mounted cabinet with frosted glass doors and a hand sanitizer dispenser.
2. cs_medbay_wall_2 — a plain wall with a curtain rail on the ceiling and a light-green privacy curtain hanging from it (half open), an oxygen outlet panel.
3. cs_medbay_wall_3 — an empty doorway to the corridor, a wall clock without numbers, a light switch.
4. cs_medbay_wall_4 — a small frosted window (light coming in) and a blank first-aid poster frame.
5. cs_medbay_floor — pale grey linoleum floor with faint speckles.
6. cs_medbay_objects — 1 hospital bed with white sheets (empty, front view, long side facing the viewer), 2 bedside table, 3 IV drip stand, 4 folding privacy screen, 5 stool, 6 medicine cart, 7 paper cup of black coffee (small object, still make it fill its cell), 8 metal trash bin with pedal, 9 wheelchair (folded).
```

### 4. cs_pasta · 종로 근처 파스타집 (회식 컷신) — 저녁, 따뜻한 빛

```
PLACE: a small cozy neighborhood pasta restaurant near Jongno. Time and light: evening, warm yellow pendant lights, dark blue night visible through the window, cozy and safe (the warmest place in the game). Wall: exposed red-brown brick with dark wooden trim, pillars: dark wooden posts.
1. cs_pasta_wall_1 — a large front window with a dark blue evening street outside and a blank painted window sign.
2. cs_pasta_wall_2 — a brick wall with a blank chalkboard menu (no writing) and two framed blank pictures.
3. cs_pasta_wall_3 — the open kitchen pass-through window with warm light and pans hanging inside.
4. cs_pasta_wall_4 — wooden wall shelves with wine bottles and jars (few, large), a coat hook rail.
5. cs_pasta_floor — dark wooden plank floor.
6. cs_pasta_objects — 1 long dining table pushed together, covered with plates of pasta, glasses and a bottle (front view), 2 wooden chair, 3 small round table for two, 4 pendant lamp (lit, hanging), 5 counter with cash register (no text), 6 potted olive tree, 7 coat stand with a black suit jacket on it, 8 wine bottle crate, 9 restaurant door leaf (wood with glass).
```

## Claude가 받은 뒤 하는 일

1. 검수: 사람·글자가 없는지, 정면 시점, 큰 모양·굵은 외곽선, 장소의 시간·빛.
2. 도트화(게임 타일과 배경 도구), 물건 높이 맞추기, `cutscenes.ts`의 장면 이름(`street`, `exit_car`, `medbay`, `pasta`)에 연결.
3. 고칠 것은 이 문서 아래 「수정 요청」에 적고 GPT에 다시 맡긴다.
