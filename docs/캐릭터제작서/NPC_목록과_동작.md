# NPC 목록과 동작 설계

작성 2026-10-22 · 스레드 「본부 NPC 도트 제작」 · 상태: **사용자 승인 전 (생성 0회)**

사용자 지시(2026-10-22): "논 플레이어블 캐릭터 NPC도 만들어야 해", "캐릭마다 동작이 전부 똑같아서는 안 돼, 성격에 맞게", "제작 들어가기 전에 기획 명확하게, 캐릭터 시트 명확하게 학습하고, 저장소의 캐릭터 디폴트 이미지 확인하고".

## 0. 읽은 자료

- **캐릭터 시트**: 카드 원본 `card/원본_봇카드.jpeg` 안 `card.json`의 로어북 항목(잼트리·고그니쟈·데쥬레·콘쥬스·사장·이자헌·은하제·박민성·고연지·윤지아·마덕희·문혜란·신유리·블라렛·살라딘, 세력 「백일몽」「협회」, 「이빨 요정」). 아래 「근거」는 그 시트 문장을 옮긴 것이다.
- **기본 이미지**: `assets/agents/<영문명>_default.avif` (832×1216, 허벅지까지 나온 상반신 원화). 외형(머리·옷 색·체형)은 이 그림을 기준으로 하고, 시트와 다른 곳은 각 절에 적었다.
- **게임 쪽**: `docs/게임_기본기획서.md` 7.3·7.4·17장, `docs/본부_평면도.md`, `docs/스테이지설계서_차원승강기.md` 9장, `docs/스테이지설계서_명일아파트.md`, `src/game/action/hq/map.ts`(자리 주인 who), `src/game/action/story/scripts/*.ts`(대사 표정: smile 29·serious 11·surprise·hurt).
- **쟈알디 방식**: `game-src/action/jyaldi-v5/scripts/rig.py`·`gen_all.py`, `tools/build_jyaldi_full_demo.py`, 팀 메모리 character-art-rules·game-design-feedback·pixellab-prompt-no-objects·pixellab-usage-tips.

## 1. 범위: 누가 NPC인가

| 구분 | 누구 | 게임에서 | 이번에 만듦 |
| --- | --- | --- | --- |
| 본부 | 잼트리, 고그니쟈, 데쥬레, 콘쥬스 | 3F 사무실 잼트리 자리, B2 연구실·감정실, B1 정비·보급실 | O |
| 휴식방 상인 | 마덕희, 고연지, 윤지아, 신유리 | 다락방(휴식방)에 가끔 나와 매입·치료·대출 | O |
| 중림 알선 | 문혜란 | 중림 의뢰(기획서 5.1). 지금 지도엔 서 있을 자리가 없음 | O (자리 생기면 바로 씀) |
| 조우·동행 | 백일몽 D조 이자헌·은하제·박민성 | 협력하면 함께 싸우고, 쫓아내면 싸움(적 겸용) | O |
| 조우·동행 | 협회 프리랜서 1명 | 도와주면 다음 방에서 짧게 참전 | O |
| 구조 대상 | 생존자 남·여, 실종 회사원 | 따라오기·쓰러짐·면담실 | O |
| 떠도는 승객 | 삼 년째 승객, 보급 승객 | 정직/거짓 조우, 거짓이면 덮침 | O |
| 생물 | 이빨 요정 | B2 이빨 요정 격리실 철창 안 | O |
| 확장 단계 | 블라렛, 살라딘 | 기획서상 확장 단계 조우 | 선택 (6장) |
| 안 만듦 | 부장실 「부장」 | **부장은 쟈알디 본인**(시트: "Boo-jang (Team Leader)"). 이미 있는 쟈알디 도트를 앉힘 | X |
| 안 만듦 | 사장 | 게임 기획에 등장 장면이 없음 | X |
| 안 만듦 | 405호 노부부, 경비원, 「더는 사람이 아닌 것」, 가짜 관리국 | 적·수호자 몫(적 그림의뢰서) | X |
| 안 만듦 | 쉬는 플레이어블 요원 | 요원 7명 스레드가 만든 그림을 씀 | X |

## 2. 공통 규격 (쟈알디와 같음)

- 생성: PixelLab `animate_with_skeleton_v3`. 기준 그림 한 장(옆모습, 오른쪽을 봄)에서 뼈대 좌표로 모든 클립을 뽑는다. 캔버스 192×144, 발바닥 y=136, 게임 표시 배율 2.75(엔진 PIXEL).
- 기준 그림: `create_image_pixen` 96×96 옆모습 후보 4장 → 기본 이미지와 나란히 비교해 고름 → 필요하면 `edit_image_pixen`으로 색·머리 고침 → 192×144로 옮김. **색 바꾼 쟈알디는 절대 쓰지 않는다.** 쟈알디 그림은 크기·화풍 대조용으로만 옆에 둔다.
- 그림엔 캐릭터만. 태블릿·컵·상자·사탕·담배·안경(손에 든 때)·장갑 상자 같은 든 물건과 책상·의자·카트는 빼고, 장마다 손 좌표(hands.json)를 남겨 게임이 그린다. 몸에 붙은 것(고글, 가면, 청진기, 허리 파우치, 칼집)은 그림에 둔다. 무기(쇠파이프, 블라렛 권총)는 사용자 규칙대로 그림에 둔다.
- 프롬프트엔 몸 자세와 움직임만. 장면·가구 이름을 쓰지 않는다.
- 말하기 입 모양은 쟈알디처럼 코드로 2px(대화창이 뜨는 동안). 말하기 클립은 **몸짓**만 담는다.
- 걷기는 사람마다 보폭·튐·몸 기울기·팔 흔들기·발 들기를 다르게 준다(4장 표의 걷기 행). 같은 걷기 함수를 수치만 바꿔 돌려쓰지 않고, 굽 높은 걸음·종종걸음·뛰듯 걷기·끌기처럼 발 놓는 방식부터 다르게 짠다.
- 품질 절차: 실제 동작 참고 → 뼈대 자동 검사(팔꿈치 방향, 발 바닥선, 옆모습 어깨 회전 s≥-0.25) → 뼈대 미리보기 → 생성 → 장 단위 검수(별도 검수 작업자) → 시연판. 결함 목록을 같이 낸다.
- 결과: `game-src/action/npc/<id>/` 원본, `game-src/action/npc/final/<id>/<클립>.png` 가로 스트립 + `manifest.json`(장 수·장 시간·반복·발 기준점) + `hands.json`. 시연판 `release/demo/goei-npc.html`.

### 체격 (쟈알디 키 약 93px 기준, 원본 픽셀)

| NPC | 키 | 체형 | 근거 |
| --- | --- | --- | --- |
| 잼트리 | 90 (굽 포함 93) | 굴곡 있는 사무직, 하이힐 | "only member of the team who commutes in high heels", "figure second only to Jyaldi's" |
| 고그니쟈 | 94 | 마른 연구자, 팔다리 김 | "a researcher's frame animated by mad energy" |
| 데쥬레 | 80 | 작고 가슴 큼, 늘 움츠림 | "Petite frame with a conspicuously full chest" |
| 콘쥬스 | 84 | 고등학생, 가는 몸 | "A teenager's frame that gives no warning" |
| 마덕희 | 88 | 마르고 날카로움 | "Lean and sharp" |
| 고연지 | 88 | 날씬함 | "Slim" |
| 윤지아 | 80 | 작고 동글 | "Small, soft and two or three years younger-looking" |
| 신유리 | 89 | 어깨 각진 단단한 몸 | "Solid, square-shouldered" |
| 문혜란 | 94 | 키 크고 팔다리 김 | "Tall, slender, long-limbed" |
| 이자헌 | 102 | 크고 무거움 | "Tall, heavy, conspicuous" |
| 은하제 | 88 | 마르고 군더더기 없음 | "Lean and economical" |
| 박민성 | 98 | 가슴·어깨 두꺼운 체육 전공 | "Big, broad, sports-major type" |
| 생존자 남·여 / 실종 회사원 / 승객 | 86~92 | 보통 | — |

## 3. NPC별 성격 → 동작 원칙

각 NPC는 「몸이 어떻게 서 있는가」(대기)와 「어떻게 움직이는가」(걷기)부터 다르게 잡고, 대사 표정 네 가지(smile·serious·surprise·hurt)는 그 사람다운 몸짓으로 바꾼다.

### 3.1 잼트리 · 참고 `assets/agents/Jaemtri_default.avif`

- 외형(그림): 긴 갈색 웨이브 머리, 초록 눈, 검은 치마 정장·검은 넥타이·흰 셔츠, 검은 스타킹, 하이힐. 그림은 한 손을 허리에 짚은 자세.
- 근거: "Warm, playful, faintly doting, self-designated as everyone's sister", "The smile switches off completely when it is no longer needed, revealing a venom-sharp glare", "neck and back pokes delivered fingertip-first", "pats Spangdal's lips shut", "Protocol enforcement mid-smile: 'Stop. Don't say your name.'", "recreational shopping-site browsing that is actually a patrol", "sole pantry authority; refuses coffee-making help because it is her joy".
- 동작 원칙: 늘 여유 있는 짝다리(한쪽 골반에 무게), 굽 소리 나는 일자 걸음. 친절할 땐 고개를 기울이고 손이 먼저 나가고, 차가워질 땐 **움직임이 딱 멈춘다**(그 대비가 이 사람의 핵심).

### 3.2 고그니쟈 · 참고 `assets/agents/Gognija_default.avif`

- 외형(그림): 산발 흰 머리, 둥근 검은 고글, 흰 실험복 안에 흰 셔츠·검은 넥타이·검은 바지, 손목시계. 그림은 두 손을 앞에 모으고 씩 웃음.
- 근거: "Gestures big, laughs bigger, moves through his lab like its nervous system", "Booming, archaic-jovial Hage-che at maximum volume. Bellows for his mandatory office beverage across the entire floor", "pill-chewing through work sessions", "naming lab equipment cheerfully", "answers dangerous questions directly without fully disclosing anything".
- 동작 원칙: 모든 동작이 크고 넓다. 팔을 어깨 위로 펼치고, 걸을 때 실험복 자락이 크게 흔들린다. 가만히 있을 때도 들썩인다. 딱 한 번, 진지할 땐 손끝을 모으고 완전히 정지(속을 알 수 없는 사람).

### 3.3 데쥬레 · 참고 `assets/agents/Dejure_default.avif`

- 외형(그림): 분홍 트윈테일(허리까지), 분홍 눈, 검은 치마 정장·검은 넥타이. 그림은 손끝을 모으고 움츠린 자세.
- 근거: "Scurries rather than walks, jumps when startled, which is constantly", "apologetic posture, nervous fingertips pressed together, trembling eyes that avoid contact", "'Ah, awawa...!'", "'I was wrong! I was wrong! I'm sorryyy...!'", "Blooms instantly under the smallest kindness", "handles active anomalous artifacts with steady, practiced hands once work begins", "laser-scans gift boxes", "makes the chief's mandatory sweet coffee".
- 동작 원칙: 어깨가 늘 올라가 있고 등이 굽음, 종종걸음. 놀라면 제자리에서 펄쩍(트윈테일이 뜀). **일할 때만** 등이 펴지고 손이 흔들리지 않는다.

### 3.4 콘쥬스 · 참고 `assets/agents/Konjyuce_default.avif`

- 외형(그림): 어깨 길이 검은 단발(앞머리 일자), 오른쪽에 분홍 브리지, 파란 눈, 남색 교복 블레이저·회색 줄무늬 넥타이·회색 주름치마. 그림은 두 손을 등 뒤로.
- 근거: "Bright, familiar, fast to attach", "winks when caught and treats detection as a compliment", "Deadpan logic audits: flags the flaw in one flat sentence, then waits", "'Hold on! I'm a proper member of this team too!'", "'Whoa! It's my first time seeing a real gun!'", "builds and clears barricades alone, hauls mountain-scale loads effortlessly, and outruns trained agents", "Cheer masks fresh grief".
- 동작 원칙: 뒤꿈치로 까딱거리는 가벼운 몸, 뛰듯 걷기. 무거운 걸 들 때 **힘쓰는 티가 전혀 없다**(한 손으로 번쩍). 따질 땐 팔짱 끼고 고개만 기울인 채 멈춤. 슬픔은 고개 숙이고 주먹 쥔 채 어깨만 떨림.

### 3.5 마덕희 · 참고 `assets/agents/Ma Deok-hee_default.avif`

- 외형(그림): 검은 일자 단발(앞머리), 버건디 정장 재킷·바지, 검은 목폴라, 반지. 그림은 팔짱 비슷하게 한 손으로 다른 손목을 잡음.
- 근거: "flat half-lidded brown eyes cycling item → hands → door", "reading glasses hooked at the chest pocket that only go on when she wants a seller to feel examined", "Light, nasal, falsely sweet", "'Eighty. That was the conversation. Tray's open.'", "left-cheek dimple appears with the crooked smile".
- 동작 원칙: 몸은 거의 안 움직이고 **시선(고개)만** 물건→손→문으로 돈다. 감정할 땐 안경을 걸치고 몸을 숙여 들여다봄. 값을 부를 땐 손가락으로 한 번 톡.

### 3.6 고연지 · 참고 `assets/agents/Go Yeon-ji_default.avif`

- 외형(그림): 긴 검은 생머리(앞머리), 흰 의사 가운, 하늘색 셔츠, 검은 바지, 목에 청진기, 가운 주머니에 손. **시트는 "medium straight hair behind her ears, navy scrubs"이지만 그림은 긴 머리·하늘색 셔츠라 그림을 따른다.**
- 근거: "unhurried movements; rushing leaves instruments inside patients", "calm dark-brown eyes with unnerving, heatless contact", "lists damage, repair and price like a mechanic", "'Payment first.'", "'Your attitude is a complication I don't operate around. Door's behind you.'".
- 동작 원칙: 느리고 정확함, 군더더기 0. 표정·자세 변화가 가장 적은 NPC. 말할 땐 손가락을 하나씩 접어 항목을 셈.

### 3.7 윤지아 · 참고 `assets/agents/Yun Ji-a_default.avif`

- 외형(그림): 살구색 머리 양쪽 똥머리, 갈색 눈, 흰 반팔 간호복(분홍 테두리)·흰 바지, 허리에 베이지 파우치, 왼손목 검은 머리끈. 그림은 손을 앞에 모음.
- 근거: "moves lightly, hands busy with gauze, pen caps or pouch straps", "Instinctively gives hungry people free, unlogged candy", "'Sit down first, have you eaten anything today?'", "'Squeeze my hand if you need to, that's what it's for.'".
- 동작 원칙: 가볍고 다정함, 손이 늘 바쁨. 먼저 다가가 손을 내민다(마덕희·고연지와 정반대).

### 3.8 신유리 · 참고 `assets/agents/Shin Yuri_default.avif`

- 외형(그림): 뒤로 묶은 긴 검은 머리, 검은 가죽 재킷·짙은 회색 티·검은 바지, 팔짱. 시트: 철제 앞코 부츠, 허리 뒤 단검(칼집째 그림에 둠).
- 근거: "narrow dark eyes never break contact first", "Never stops scanning", "Slows to counted syllables for intimidation: 'Ten. Percent. Weekly.'", "knife, sheathed, reachable without standing up", "'Cry outside. Tears rust the desk.'".
- 동작 원칙: 정면 응시하며 꼼짝 않음. 말은 손가락을 한 박자씩 내림. 위협은 손이 허리 뒤로 천천히 가는 것만으로.

### 3.9 문혜란 · 참고 `assets/agents/Mun Hye-ran_default.avif`

- 외형(그림): 갈색 머리 낮게 묶음, 갈색 정장 재킷·검은 셔츠, 금색 손목시계.
- 근거: "loose swaggering ease that is exactly as calculated", "Loud, theatrically friendly, rhetorical questions and backslaps", "Laughs through refusals", "taps exactly once when she wants the room to hear its own clock", "'Sit, sit. You eat yet? Doesn't matter, sign first'".
- 동작 원칙: 크게 웃고 등 두드리는 넉살, 그러나 시계 톡 한 번에 분위기를 끊음.

### 3.10 백일몽 D조 (동행·적 겸용)

세력 시트: "Field Exploration Team members wear animal masks on all external operations". 현장에선 **가면을 쓴 모습**으로 만든다(가면은 그림에 둠).

- **이자헌** · 참고 `assets/agents/Lee Ja-heon_default.avif` · 흰 도마뱀 가면. 그림: 흰 머리, 남색 조끼·흰 셔츠 소매·남색 넥타이(시트는 검은 정장, 작업 장갑). 근거: "sits like carved stone in perfect upright posture", "Feels no fear", "Flat and uninflected. Extremely terse... 'Yes.' 'Get down.'", "snaps a steel door handle off with one punch, tears nooses out of the air", "Force is his only tool". 동작 원칙: 꼿꼿함, 예비동작 거의 없이 바로 나가는 무거운 주먹, 맞아도 거의 안 흔들림.
- **은하제** · 참고 `assets/agents/Eun Ha-je_default.avif` · 송골매 가면. 그림: 남색 단발, 남색 정장·남색 넥타이, 팔짱. 근거: "reaching for a cigarette, weighing it, and putting it back unsmoked is her single most repeated action", "Long sighs, a clicked tongue, a shoulder-pat instead of a speech", "sits down hard, sprawls when tired", "Combat: Agent-standard". 동작 원칙: 힘 뺀 구부정한 몸, 짧고 실속 있는 발차기·팔꿈치. 담배는 손 좌표로 게임이 그림.
- **박민성** · 참고 `assets/agents/Park Min-seong_default.avif` · 오소리 가면. 그림: 갈색 머리, 남색 정장, 팔짱, 넓은 어깨. 근거: "visibly terrified and sweating during operations, then grinning anyway. Scratches his head when caught out", "stretching, groaning, sighing, resigning himself out loud, and then doing the job", "the Jo's carrier and door-opener", "Better at surviving than at winning". 동작 원칙: 무서워 들썩이다가도 몸으로 들이받는 어깨 돌진. 맞으면 크게 휘청.

### 3.11 협회 프리랜서

- 시트(「협회」): 협회에 등록된 독립 계약자, 등급제, 수수료에 시달림. 고유 인물이 아니므로 **관리국과 겹치지 않는 차림**(카키 야상, 후드, 배낭끈, 야구모자)으로 1명 디자인. Claude 창작이라 사용자 확인 대상.
- 동작 원칙: 돈 받은 만큼만 하는 실용형. 쇠파이프 대신 공구형 둔기(그림에 둠) 한 방.

### 3.12 구조 대상·승객 (스테이지설계서 9장, 기획서 7.3)

- **생존자 여**: 자기 몸 끌어안고 떪. **생존자 남**: 머리 감싸고 두리번. 둘 다 따라오다 맞으면 쓰러짐.
- **실종 회사원**(임무 「부모를 찾으러 간 가족」류 구조 대상): 넋 나간 회사원, 넥타이 풀림. 구출되면 털썩 안도.
- **삼 년째 승객**: "낡은 양복, 수척". 정직이면 짧게 문을 가리키고, 거짓이면 **사연이 지나치게 길다**(규칙 8) → 손짓이 과장되게 길어지는 별도 클립. 정체 드러낼 때 "손이 등 뒤로 간다"(field.ts).
- **보급 승객**: 배낭. 거짓이면 "손에 쇠파이프가 들려 있다"(field.ts) → 휘두르기.

### 3.13 이빨 요정 · 시트 「이빨 요정」

- "forearm-sized creatures, each with a lamprey-like head, an earthworm-shaped body, two thin human-like arms, and dragonfly-like wings", "the largest individual produces a neatly wrapped box". 사람 뼈대가 없으므로 `animate_image`(글 설명)로 만든다. 상자는 게임이 그림.

## 4. 클립 표 (사람 131클립 + 이빨 요정 3)

장 수 기준: 대기 4, 걷기·달리기 8, 말하기 6, 짧은 반응 4, 활동 6~8. **같은 이름의 칸이라도 몸짓이 다르다**(괄호 안이 그 사람만의 모양).

### 본부 4명 (44클립)

| 칸 | 잼트리 | 고그니쟈 | 데쥬레 | 콘쥬스 |
| --- | --- | --- | --- | --- |
| 대기 | 짝다리, 한 손 허리 (4) | 들썩들썩, 두 손 모아 비빔 (4) | 움츠려 손끝 꼼지락, 고개 두리번 (4) | 손 등 뒤, 뒤꿈치 까딱 (4) |
| 걷기 | 하이힐 일자 걸음, 골반 흔들림, 보폭 좁음 (8) | 성큼성큼, 팔 크게, 가운 자락 펄럭 (8) | 종종걸음, 등 굽고 손 가슴 앞 (8) | 통통 튀듯 걷기, 팔 크게 흔듦 (8) |
| 말하기 | 손바닥 펴고 다정한 손짓, 고개 갸웃 (6) | 두 팔 활짝 휘두르며 연설 (6) | 손끝 만지작, 고개 꾸벅꾸벅 (6) | 앞으로 몸 숙이고 손 바쁘게 (6) |
| smile | 문간 인사: 고개 기울이고 작게 손 흔듦 "어머, 후배 왔어?" (6) | 고개 젖히고 크게 웃음, 어깨 들썩 (6) | 칭찬받아 볼에 두 손, 제자리 콩콩 (6) | 까치발로 머리 위 크게 손 흔듦 "오빠, 안녕!" (6) |
| serious | 웃음 뚝, 팔짱 끼고 턱 당겨 노려봄, 마지막 장 유지 (4) | 손끝 모으고 완전 정지 (4) | 일 모드: 등 펴고 두 손 앞으로 고정 (6, 아래 활동과 공유) | 팔짱, 고개만 기울여 무표정 "아내는 사람 이름이 아니잖아요" (4) |
| surprise | 손등으로 입 가림 "어머" (4) | — (놀라지 않는 사람: 웃음으로 대체) | 펄쩍 뛰며 두 손 위로 "아와와" (6) | 눈 휘둥그레 몸 앞으로 쏠림 "우와 진짜 총!" (4) |
| hurt | — | — | 머리 감싸고 쪼그려 앉음 (4) | 고개 숙이고 주먹 쥔 채 어깨 떨림 (4) |
| 활동 1 | 태블릿 넘겨보기(쇼핑몰 순찰), 엄지 스와이프 (6) | 고함: 두 손 입가에 모아 상체 숙여 "데쥬레!!!" (6) | 연신 꾸벅 사과 "잘못했어요!" (6) | 상자 한 손으로 번쩍 머리 위로 (8) |
| 활동 2 | 손끝으로 목덜미 콕 찌르기 (6) | 알약 털어 넣고 씹기 (6) | 레이저 스캐너로 선물 상자 훑기, 두 손 수평 (6) | 머리 위로 든 채 걷기 (8) |
| 활동 3 | 검지 세워 "쉿, 이름 말하지 마" (4) | 팔 펼쳐 장비 소개 "비상 탈출 장치일세!" (6) | 믹스커피 허둥지둥 젓기 (6) | 빠르게 달리기 (8) |
| 활동 4 | 의자에 앉아 타자 (6) | 두 팔 활짝 환영 "어서 오게!" (4) | — | 발 구르며 항의 "나도 정식 팀원이거든!" (6) |
| 활동 5 | 연유 커피 젓기 (6) | 실험대에 숙여 빠르게 손 놀림 (6) | — | 윙크하며 눈가에 브이 (4) |
| 활동 6 | — | 달달한 커피 홀짝 (6) | — | — |
| **클립 수** | 11 | 11 | 10 | 12 |

### 휴식방·알선 5명 (26클립)

| 칸 | 마덕희 | 고연지 | 윤지아 | 신유리 | 문혜란 |
| --- | --- | --- | --- | --- | --- |
| 대기 | 손목 잡고 서서 고개만 물건→손→문 (4) | 가운 주머니에 손, 미동 없음 (4) | 손 앞에 모으고 살랑 (4) | 팔짱, 정면 응시, 꼼짝 않음 (4) | 한 손 주머니, 건들건들 짝다리 (4) |
| 말하기 | 달콤한 척 손목 까딱 (6) | 손가락 하나씩 접으며 항목 셈 (6) | 고개 끄덕이며 다정한 손짓 (6) | 손가락 한 박자씩 내림 "십. 퍼센트." (6) | 크게 웃으며 손뼉 (6) |
| 고유 1 | 안경 걸치고 숙여 감정 (8) | 수술 장갑 당겨 끼기 (6) | 파우치에서 사탕 꺼내 내밂 (6) | 손이 천천히 허리 뒤 칼로 (4) | 등 두드리는 손짓 (6) |
| 고유 2 | 손가락 톡 "팔십." (4) | 두 손 앞으로 정확한 처치 (8) | 붕대 감기 (8) | 두 손 짚고 상체 숙여 압박 (6) | 손목시계 한 번 톡 (4) |
| 고유 3 | 볼에 손, 비뚤게 웃음 (4) | 엄지로 뒤를 가리킴 "문은 뒤에" (4) | 손 내밀어 꼭 잡아 줌 (4) | 목 꺾어 우두둑 (6) | "앉아, 앉아" 손짓 (4) |
| 고유 4 | — | — | 앉으라고 의자 가리키며 손짓 (4) | — | — |
| **클립 수** | 5 | 5 | 6 | 5 | 5 |

### 백일몽 D조 + 프리랜서 (34클립)

| 칸 | 이자헌 | 은하제 | 박민성 | 프리랜서 |
| --- | --- | --- | --- | --- |
| 대기 | 꼿꼿이 정지, 숨만 (4) | 담배 꺼내 만지작 → 다시 넣음 (6) | 들썩이며 땀 닦음 (4) | 배낭끈 고쳐 멤 (4) |
| 걷기 | 일정한 보폭, 상체 고정 행진 (8) | 힘 뺀 구부정 걸음 (8) | 무겁게 쿵쿵 (8) | 보통 걸음 (8) |
| 달리기 | 상체 세운 채 묵직한 질주 (8) | 낮게 날렵한 질주 (8) | 팔 크게 헐레벌떡 (8) | 보통 질주 (8) |
| 공격 1 | 예비동작 없는 직선 주먹 (6) | 짧은 로우킥 (6) | 어깨로 들이받기 (8) | 둔기 내려치기 (6) |
| 공격 2 | 두 손 모아 내려찍기 (8) | 팔꿈치 (6) | — | — |
| 피격 | 고개만 살짝 (4) | 짧게 움찔 (4) | 크게 휘청 (4) | 보통 (4) |
| 다운 | 뒤로 곧게 넘어짐 (8) | 옆으로 구르며 넘어짐 (8) | 엉덩방아 후 뒤로 (8) | 보통 (8) |
| 기상 | 반동 없이 곧게 일어섬 (6) | 손 짚고 투덜대며 (6) | 끙 소리 나게 굴러 일어남 (6) | — |
| 대화 | 고개 한 번 끄덕 "네." (4) | 어깨 툭 치기 (6) | 머리 긁으며 웃음 (6) | — |
| 고유 | — | 털썩 주저앉아 퍼짐(휴식) (4) | 주먹 불끈 "할 수 있다" (4) | — |
| **클립 수** | 9 | 10 | 9 | 6 |

### 구조 대상·승객 5명 (27클립)

| 칸 | 생존자 여 | 생존자 남 | 실종 회사원 | 삼 년째 승객 | 보급 승객 |
| --- | --- | --- | --- | --- | --- |
| 대기 | 자기 몸 끌어안고 떪 (4) | 머리 감싸고 두리번 (4) | 넋 나가 축 늘어짐 (4) | 손 떨며 경련 (4) | 배낭끈 쥐고 서 있음 (4) |
| 따라 걷기 | 몸 웅크린 잰걸음 (8) | 뒤 돌아보며 엉거주춤 (8) | 비틀비틀 (8) | 발 끌기 (8) | 보통 걸음 (8) |
| 도망 | 팔 휘저으며 (8) | 고개 숙이고 (8) | — | — | — |
| 쓰러짐 | 무릎부터 털썩 (8) | 앞으로 고꾸라짐 (8) | 옆으로 쓰러짐 (8) | — | — |
| 말하기 | 떨며 손짓 (6) | 다급한 손짓 (6) | 힘없이 고개 (6) | 문 쪽을 짧게 가리킴 (6) | 다락방 쪽 가리킴 (6) |
| 고유 | 주저앉아 숨 고르기 (4) | — | 털썩 주저앉아 안도 (4) | 거짓: 과장된 긴 손짓 (6) / 손이 등 뒤로 (4) | 배낭 받아 뒷걸음 (6) / 쇠파이프 휘두르기 (6) |
| **클립 수** | 6 | 5 | 5 | 5 | 6 |

### 이빨 요정 (animate_image, 64×64)

날갯짓 맴돌기 (8), 이빨 먹기 (6), 상자 내놓기 (8). 3클립.

## 5. 생성 횟수

`animate_with_skeleton_v3` 비용: 8장 이하 클립 3회(쟈알디 실측 41클립 126회 ≈ 클립당 3). 기준 그림: 사람당 후보 4장 + 고침 2회 = 약 6회.

| 묶음 | 사람 | 클립 | 클립 비용 | 기준 그림 | 소계 |
| --- | --- | --- | --- | --- | --- |
| 본부 | 4 | 44 | 132 | 24 | 156 |
| 휴식방·알선 | 5 | 26 | 78 | 30 | 108 |
| D조 + 프리랜서 | 4 | 34 | 102 | 24 | 126 |
| 구조 대상·승객 | 5 | 27 | 81 | 30 | 111 |
| 이빨 요정 | — | 3 | 3 | 4 | 7 |
| **합계** | **18 + 생물 1** | **134** | **396** | **112** | **508** |
| 다시 뽑기 예비(클립의 약 25%) | | | | | 약 100 |
| **최대** | | | | | **약 610** |

- 잔액 약 8,698(2026-10-21 spend.log 마지막 줄) 중 7%. 요원 7명 스레드와 같은 계정을 쓰므로, 시작 전 잔액을 다시 재고 **610회를 넘으면 멈추고 보고**한다.
- 다시 뽑기는 같은 방식에 문구만 바꿔 되풀이하지 않는다(메모리 규칙). 두 번 실패한 클립은 결함 목록에 적고 넘어간다.

## 6. 선택: 블라렛·살라딘 (확장 단계)

- 블라렛: 수녀복 옆트임, 두 자루 은탄 권총(그림에 둠), 십자가로 성검 뽑기. 대기·걷기·달리기·쌍권총 사격·십자가 내려치기·성화 손바닥·피격·다운·기상·포교 손짓 = 10클립.
- 살라딘: 터번·검은 정장·언월도·AK. 원작 지침 "교전 금지, 발견 즉시 도주"라 게임에선 추격자. 대기·달리기·언월도 베기·연사·형제 춤(두 손 잡고 흔들기)·함성·피격·다운 = 8클립.
- 18클립 × 3 + 기준 그림 12 + 예비 15 = **약 80회**. 지금 게임 범위 밖이라 승인 때 넣을지 함께 고른다.

## 7. Claude가 정한 것 (확인 필요)

1. 프리랜서 차림(카키 야상·모자·배낭)은 원작에 없는 창작.
2. D조는 현장이라 가면 쓴 모습으로 만듦(세력 시트 근거). 맨얼굴판은 안 만듦.
3. 고연지는 시트 대신 기본 이미지(긴 머리·하늘색 셔츠)를 따름.
4. 고그니쟈는 "놀람·아픔" 칸이 없음(대사에도 없고, 시트상 위험한 질문에도 태연).
5. 부장실 자리는 쟈알디 본인이 앉는 것으로 보고 NPC를 만들지 않음.
6. 문혜란은 지금 지도에 설 자리가 없지만 기획서 17.2에 있어 같이 만듦.

## 8. 넘기기

완성 스트립·manifest·hands.json과 시연판을 스레드 「게임 마무리 한 곳에서」에 넘겨 hq/map.ts 자리(who)에 세우고, 현장 NPC는 조우·휴식방 대본에 붙이게 한다.
