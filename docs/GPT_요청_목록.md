# GPT 요청 목록

GPT가 이 저장소에 그림을 올리는 일감 목록. 한 줄에 한 요청. 끝나면 GPT가 상태를 「완료」로 바꾼다.

| 요청서 | 무엇을 몇 장 | 저장 경로 | 상태 |
|---|---|---|---|
| docs/공용그림_GPT요청서_2차.md | 공용 괴이 그림 2차: 새 장소 16곳 × 2장 = 32장 (영화관·백화점·식당·교회·목욕탕·편의점·노래방·도서관·주차장·옥상·다리·경찰서·군부대·화장실·버스·저수지) | assets/gpt/공용괴이_2차/<목록 이름>.png | 받음 32장(4b904ee) / 검수 완료, 카드 반영. 다시 그릴 것 2장: Restaurant 2, Church 1 (요청서 「받은 뒤 검수」) |
| docs/GPT요청_게임배경.md | 게임 배경·바닥·원경·물건: 12곳 약 80장 (게임 타일과 배경 스레드) | game-src/art/bg/raw/<장소>/<목록 이름>.png | 받음 75장(5b2575b) / 검수 완료. 다시 그릴 것 1장: hq_jaemtri_objects (요청서 「검수 결과」) |
| docs/GPT요청_본부배경.md | 본부 15장면(평면도) 벽·바닥·창밖·가구: 새로 53장 (기존 hq_office·hq_jaemtri·hq_pantry·hq_workshop·lobby·el_hall 재사용) | game-src/art/bg/raw/<장소>/<목록 이름>.png | 받음 59장 / 검수 통과, 도트화·15장면 연결 완료(27df0e0). 다시 그릴 것 없음 |
| docs/GPT요청_게임배경_층별.md | 층별 배경 28장: 자기 그림이 없는 침묵·어둠·퍼즐·심층 층(벽 4·바닥·물건 모음 각 6장) + 아파트 붉은 벽·빈집 벽 4장. 적·사람 없음 | game-src/art/bg/raw/<장소>/<목록 이름>.png | 받음 28장 / 검수 통과, 도트화·층 연결 완료(27df0e0). 다시 그릴 것 없음 |
| docs/캐릭터제작서/의뢰서_쟈알디_샤워·목욕·용변_GPT.md (8장) | 쟈알디 샤워 6장 + 목욕 4장을 2차분(탈의·돌아서기) 그림체로 다시. 탈의 7장·돌아서기 3장 26a5d17 채택, 용변 취소 | game-src/action/jyaldi-v5/full/clips/shower/NN.png · bath/NN.png | 받음 (8장: shower 6장·bath 4장 재제작, 192×144 투명 PNG·시연판 반영) |
| docs/캐릭터제작서/의뢰서_스팡달_샤워·목욕_GPT.md (20장) | 스팡달 탈의 7 + 돌아서기 3 + 샤워 6 + 목욕 4. 쟈알디와 다른 동작(손끝 머리 감기, 턱까지 담그기) | game-src/action/spangdal/full/clips/undress·showerturn·shower·bath/NN.png | 받음 |
| docs/GPT요청_컷신영상.md | 도트 애니메이션 10편(동영상 파일 아님): 오프닝(약 32초, 9컷) + 컷신 9개(첫 출근·첫 투입·첫 호명·다락방·삼 년째 승객·귀환·후송·출구·회식, 각 10~20초, 3~6컷). mp4 금지, 컷마다 640×360 PNG 프레임 0001.png… + timing.json(장별 ms), 팔레트 고정, 8~12fps, 글자 없음, 소리 sound.ogg(선택) | game-src/art/cutscene/frames/<컷신>/<컷>/0001.png…·timing.json | 받음 |
| docs/GPT요청_컷신영상.md 「다시 그리기」 절 | 컷신 다시 그리기 13컷(덮어쓰기): 그림 고침 3(evac/c3 붉은 눈, opening/c6·dinner/c4 흰 셔츠), 1초 반복 긴 컷 10개를 24~36장으로 늘려 실제 움직임 | game-src/art/cutscene/frames/<컷신>/<컷>/0001.png…·timing.json (옛 장 지우고 덮어씀, loop 없음) | 받음 |
| docs/GPT요청_아이템무기.md | 아이템·무기·든 물건·상인 물건 8장(각 9개, 1536×1024 투명): 임시 무기·요원 고유 무기(옆모습, 손잡이 왼쪽)·소모품·줍는 것·회수물·상인 물건·던지는/부수는 물건과 부서진 조각. 사람·캐릭터·적 없음 | game-src/art/items/raw/<목록 이름>.png | 받음 8장(9670fba) / 검수 통과, 마젠타 제거·도트화·grip 측정 완료, 게임 아이콘·든 무기 연결(27df0e0) |
| docs/GPT요청_컷신.md | (폐기 2026-10-21: 레이어 그림 방식 취소. 넘기지 않음) | — | 폐기 |
| docs/GPT요청_화면표시.md | HUD·메뉴: 쟈알디 HUD 얼굴 4표정 1장(2×2: 평소·맞음·위급·필살 준비) + 메뉴·HUD 테두리 모음 1장(메뉴 창 9칸 틀·고른 줄 판·얼굴 칸·체력 막대·아이템 칸) = 2장 | game-src/art/ui/raw/<목록 이름>.png | 받음 2장(9367c97) / 원본 완료, 도트화·UI 연결 대기 |
| docs/GPT요청_배경보강.md | 배경 보강 8장 (검수 12차 결함): 표지판 모음, 문 옆 명패(기호), 게시판·액자 모음, 엘리베이터 문 모음, 탕비실 바닥·거리 보도 다시, 낮은 단 자리 소품, 층 소품 추가. 글자·사람 없음 | game-src/art/bg/raw/<장소>/<목록 이름>.png (signs·plates·boards·props 새 폴더, el_hall_objects_2, hq_pantry_floor·hq_street_floor 덮어쓰기) | 받음 8장(신규 6장: 4f63ece2, 기존 바닥 2장 유지·건너뜀) / 원본 완료, 도트화·게임 연결 대기 |
| docs/GPT요청_터치버튼.md | 화면 표시: 터치 단추 16칸 1장(공격·사격·고유·가드·필살·조사·점프·회피·장전·지원·메뉴·지도 그림 + 빈 아이템 칸·보통·누름·필살 준비 판) + 퀵슬롯 아이콘 12칸 1장(회복약·붕대·정화제·소금·섬광탄·연막탄·부적·에너지 음료·각성제·모르는 물건·탄창·빈 칸) + 키 글자판 20칸 1장(A S D Q W E R C Z X H 1~4 ESC SPACE SHIFT 패드 A·B) = 3장, 각 1536×1024 투명 | game-src/art/ui/raw/touch_buttons_sheet.png · quickslot_icons_sheet.png · keycaps_sheet.png | 받음 |
| docs/GPT요청_본부NPC_씻기.md | 본부 NPC 성인 셋(잼트리·고그니쟈·데쥬레) 수건 차림 4클립씩: 탈의 7·돌아서기 3·머리 감기 6·앉아 쉬기 4 = 60장. 쟈알디 26a5d17 그림체, 캐릭터만, 콘쥬스 없음 | game-src/action/npc/clips/<id>/undress·showerturn·shower·bath/NN.png | 부분받음 43/60장 (잼트리19·고그니쟈20·데쥬레4). 잼트리 undress05·데쥬레 수건16장 미완료: 생성 안전 검사 차단. 시연판 release/demo/npc-bathing.html / 검수 기록 docs/검수_본부NPC_씻기_GPT_2026-10-22.md |
| docs/캐릭터제작서/의뢰서_로제몬_탈의·샤워·목욕_GPT.md | 로제몬 탈의 7 + 돌아서기 3 + 샤워 6 + 목욕 4 = 20장(192×144 투명 PNG, 로제몬 기준 그림·대기 장에 키·그림체 맞춤, 베이지 수건, 캐릭터만) + production.json·contact.png | game-src/action/rojemon/clips/<undress·showerturn·shower·bath>/NN.png | 부분 제작 13/20 — undress 04·06 및 bath 기본 자세 생성 차단, showerturn 00·bath 01~03 의존 보류. 손·미세좌표 검수 필요. production.json 참조 |
| docs/캐릭터제작서/의뢰서_게슈간_샤워·목욕_GPT.md | 게슈간 탈의 7장·샤워 앞 돌아서기 3장·샤워 6장·목욕 4장 = 20장 (192×144 투명, 기준 그림 game-src/action/geshugan/base/G0.png) | game-src/action/geshugan/clips/<클립>/NN.png | 받음 |
| docs/캐릭터제작서/의뢰서_데드폴_탈의·샤워·목욕_GPT.md | 데드폴 탈의 7 + 돌아서기 3 + 샤워 6 + 목욕 4 = 20장(192×144 투명, 수건 차림, 데드폴 키·그림체). **기준 그림 base.png·idle/00.png가 main에 올라온 뒤 시작** | game-src/action/deadpole/full/clips/<클립>/NN.png | 받음 |
| docs/캐릭터제작서/의뢰서_큐라스_샤워·목욕_GPT.md | 큐라스 탈의 7 + 샤워 앞 돌아서기 3 + 샤워 6 + 목욕 4 = 20장(192×144 투명, 기준 game-src/action/kyuras/base/A.png, 허리 수건) | game-src/action/kyuras/clips/undress·showerturn·shower·bath/NN.png | 받음 20장(탈의 7·돌아서기 3·샤워 6·목욕 4, 192×144 투명 PNG·장별 커밋, 68d60c3) / 별도 동작 시연판 포함, 게임 연결·최종 시각 검수 대기 |
| docs/캐릭터제작서/의뢰서_에일린_씻기_GPT.md | 에일린 탈의 7·돌아서기 3·샤워 6·목욕 4 = 20장(192×144 투명, 옆모습, 캐릭터만). 기준 그림 game-src/action/eileen/base/H-side.png | game-src/action/eileen/clips/undress·showerturn·shower·bath/NN.png | 받음 |
| docs/캐릭터제작서/의뢰서_고르고디오_샤워·목욕_GPT.md | 고르고디오 탈의 7·샤워 앞 돌아서기 3·샤워 6·목욕 4 = 20장 (224×176 투명, 수건 차림, 캐릭터만) | game-src/action/gorgodio/full/clips/<undress·showerturn·shower·bath>/NN.png | 받음 |
| docs/캐릭터제작서/의뢰서_쟈알디_샤워·목욕·용변_GPT.md 9절 | 쟈알디 탈의 사이 장 추가: 7장 → 10장(재킷 젖히기·소매 빼기·셔츠 벗기·수건 여미기) | game-src/action/jyaldi-v5/full/clips/undress/00~09.png | 받음(5e424c9, 시연판 반영) |
| docs/GPT요청_검수보강2.md | 통합 독립 검수(3dc57b5) 그림 결함 6장: 판 모음 1장(화이트보드·점검표·게시판 글줄을 회색 막대 대신 낙서 손글씨로, 감정실 투영기·라이트테이블, 빛무리 없는 경고등) + 격리 구역 벽 5장 덮어쓰기(경고등 붉은 빛무리 제거) | game-src/art/bg/raw/boards/boards_objects_2.png · hq_containment/hq_containment_wall_1~5.png (덮어씀) | 요청 |
| docs/GPT요청_본부3판.md | 관리국 본부 3판: 벽·바닥 타일 21장(hq3_office·hall·life·bath·lab·labhall), 문·코어 조각 2장, 집기 조각 5장(office·life·bath·lab·training), 건물 정면 외관 1장 = 29장. 세련된 첨단 기관, 글자 없음 | game-src/art/bg/raw/hq3_<묶음>/<이름>.png | 요청 |

## 스팡달 납품 기록 · 2026-10-22

- 지정 경로의 undress 7장·showerturn 3장·shower 6장·bath 4장, 총 20개 PNG를 main에 반영했다. 각 프레임을 개별 커밋으로 반영했고 원격 blob SHA와 검증본의 일치를 확인했다. `받음`은 파일 수령 상태이며 시각 승인 또는 시연판 반영 완료를 뜻하지 않는다.
- 팔레트·알파 추가 지시 시점에 main에 있던 `undress/00.png`, `01.png`는 「이미 있는 파일은 건너뛰기」 지시에 따라 유지했다. **이 2장은 팔레트 밖 색·반투명 픽셀이 있으며 맨 아래 불투명 행도 신규 규격과 다르다. 새 규격 보정은 미적용**이다.
- 그 뒤 추가한 18장은 192×144 RGBA, 지정 팔레트 밖 RGB 0개, 반투명 알파 0개, 검정 1px 외곽 경계로 처리했다. 새 서기 장의 마지막 불투명 행은 y=135이다. 자세에 따라 높이를 달리하여 웅크림과 머리 위 손끝을 보존했다.
- **의뢰서와 다른 점: bath 4장은 검정 원피스 수영복을 착용한다.** 수건 없는 신체 표현이 이미지 생성 도구에서 차단되어, 몸통·골반을 불투명 수영복으로 가린 대체본으로 납품했다. 원안 그대로의 목욕 4장으로 승인한 것이 아니다. 욕조·물은 넣지 않았다.
- 같은 자세의 연결 장은 동일 이미지를 사용했다: showerturn/00 = undress/06, shower/03 = shower/01, shower/05 = shower/00. 각 경로는 별도 커밋했다.
- 생성: 내장 ImageGen. 프롬프트 기준은 의뢰서 2·3장의 캐릭터·방향·손동작 표이며, bath는 위 수영복 변경을 적용했다. 생성 후 최근접 축소, 지정 색 매핑, 알파 이진화와 검정 외곽 경계 처리를 했다. 시연판·게임 연결은 이번 자산 납품 범위에 포함하지 않았다.
