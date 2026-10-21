# GPT 요청 목록

GPT가 이 저장소에 그림을 올리는 일감 목록. 한 줄에 한 요청. 끝나면 GPT가 상태를 「완료」로 바꾼다.

| 요청서 | 무엇을 몇 장 | 저장 경로 | 상태 |
|---|---|---|---|
| docs/공용그림_GPT요청서_2차.md | 공용 괴이 그림 2차: 새 장소 16곳 × 2장 = 32장 (영화관·백화점·식당·교회·목욕탕·편의점·노래방·도서관·주차장·옥상·다리·경찰서·군부대·화장실·버스·저수지) | assets/gpt/공용괴이_2차/<목록 이름>.png | 받음 32장(4b904ee) / 검수 완료, 카드 반영. 다시 그릴 것 2장: Restaurant 2, Church 1 (요청서 「받은 뒤 검수」) |
| docs/GPT요청_게임배경.md | 게임 배경·바닥·원경·물건: 12곳 약 80장 (게임 타일과 배경 스레드) | game-src/art/bg/raw/<장소>/<목록 이름>.png | 받음 75장(5b2575b) / 검수 완료. 다시 그릴 것 1장: hq_jaemtri_objects (요청서 「검수 결과」) |
| docs/GPT요청_본부배경.md | 본부 15장면(평면도) 벽·바닥·창밖·가구: 새로 53장 (기존 hq_office·hq_jaemtri·hq_pantry·hq_workshop·lobby·el_hall 재사용) | game-src/art/bg/raw/<장소>/<목록 이름>.png | 대기 |
| docs/캐릭터제작서/의뢰서_쟈알디_샤워·목욕·용변_GPT.md (7장) | 쟈알디 탈의 다시 7장(옆모습, 벗은 옷 안 그림, 청회색 정장) + 샤워 앞 돌아서기 3장. 샤워·목욕 4b904ee 채택, 용변 취소 | game-src/action/jyaldi-v5/full/clips/undress/NN.png · showerturn/NN.png | 대기 (다시 그리기) |
| docs/GPT요청_컷신영상.md | 도트 애니메이션 10편(동영상 파일 아님): 오프닝(약 32초, 9컷) + 컷신 9개(첫 출근·첫 투입·첫 호명·다락방·삼 년째 승객·귀환·후송·출구·회식, 각 10~20초, 3~6컷). mp4 금지, 컷마다 640×360 PNG 프레임 0001.png… + timing.json(장별 ms), 팔레트 고정, 8~12fps, 글자 없음, 소리 sound.ogg(선택) | game-src/art/cutscene/frames/<컷신>/<컷>/0001.png…·timing.json | 제작 중: first_day, first_entry 받음 (2/10편) |
| docs/GPT요청_컷신.md | (폐기 2026-10-21: 레이어 그림 방식 취소. 넘기지 않음) | — | 폐기 |
| docs/GPT요청_화면표시.md | HUD·메뉴: 쟈알디 HUD 얼굴 4표정 1장(2×2: 평소·맞음·위급·필살 준비) + 메뉴·HUD 테두리 모음 1장(메뉴 창 9칸 틀·고른 줄 판·얼굴 칸·체력 막대·아이템 칸) = 2장 | game-src/art/ui/raw/<목록 이름>.png | 대기 |
