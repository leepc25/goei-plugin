# 검토서 songil_v7

방 waiting_room · 분위기 worn · 문 2 · 원근 one-point · 바닥 the lower half · 양옆 left · 채우기 normal

## 점검 결과

- WARN 설명이 김(28낱말): a reception counter at a right angle to the back wall, chest high (97 pixels), back end a metre in front of the back wall, staff behind it
- WARN 설명이 김(20낱말): a pale green exam room door, closed, facing the camera, 170 by 80 pixels, open floor in front of it
- WARN 설명이 김(19낱말): a white operating room door with a small window, the same size, closed, open floor in front of it
- WARN 바닥 칸에 빛·그림자 없음

## 근거

- 위키: 손길 의원: 중림동 지하 뒤쪽 계단 끝, 바랜 옛 병원 간판이 붙은 무면허 의원. 플라스틱 의자, 오래된 잡지, 접수 창구, 진료실 두 개, 그리고 형광등이 쨍한 진짜 수술실. 간호조무사 윤지아: 배고픈 환자에게 사탕을 몰래 쥐여 줌, 허리 파우치에 붕대와 사탕.
- 설계안: 설계안 jr_clinic: 쨍한 흰 형광등, 바닥 PVC 연한 녹색(낡음), 플라스틱 의자 열 C04 ×6, 잡지 꽂이, 접수 창구 K01(소) + 사탕 그릇, 진료실 문 DR1 ×2(연한 녹색), 포스터(빈 면) ×2, 시계, 손 소독제.
- 사용자: 의자 전부 빼기, 시계 빼기
- 사용자: 왼쪽 벽에 접수대: 뒷벽과 수직(| 자), 뒤 끝은 뒷벽에서 떨어져 직원이 뒤로 들어감, 왼쪽 벽 전체를 쓰지 않음
- 사용자: 뒷벽에 문 둘(진료실·수술실), 닫힌 채 정면, 접수대에서 떨어지게 오른쪽으로, 문 앞 빈 바닥
- 사용자: 오른쪽은 벽 없이 그림 끝에서 잘림
- 사용자: 엑스레이 판·링거대·산소통·폐기물 통은 대기실에 두지 않음
- 사용자: 혈압계·체중계 같은 손님 물건은 접수대 뒤에 두지 않음
- 사용자: 천장 누수·양동이 없음, 구급함은 하나
- 사용자: 포스터 글씨는 괜찮음
- 사용자: 바깥 복도로 나가는 길은 화면 아래 출구 표시(문 안 그림)
- 사용자: v6가 휑함 → 자리 묶음 문법으로 글자를 아껴 뺐던 물건을 되살림(사용자 10-30)
- 사용자: v6에서 접수대 뒤 뒷벽에 빈 출입구(서류 칸)가 생김 → 뒷벽은 막힌 벽

## 설계안·위키 항목 대조

- 위키: 바랜 옛 병원 간판 → 4번
- 위키·설계안: 플라스틱 의자(열 ×6) → omit: 사용자 결정으로 의자는 배경에 그리지 않고 의자 오브젝트로 따로 놓음
- 위키·설계안: 오래된 잡지·잡지 꽂이 → 13번
- 위키·설계안: 접수 창구 → 0번
- 위키·설계안: 사탕 그릇(윤지아) → 1번
- 위키: 진료실 두 개(같은 장면 하나를 같이 씀) → 10번
- 위키: 수술실 → 11번
- 설계안: 쨍한 흰 형광등 → 칸:walls fluorescent
- 설계안: 바닥 PVC 연한 녹색(낡음) → 칸:floor PVC
- 설계안: 진료실 문 연한 녹색 → 10번
- 설계안: 포스터 ×2 → 7번
- 설계안: 시계 → omit: 시계는 전역 금지(사용자 결정)
- 설계안: 손 소독제 → 12번
- 사용자: 오른쪽 벽 없음 → 칸:sides left
- 사용자: 바깥 출구는 화면 아래 → omit: 출구는 게임 화면 아래 화살표가 표시함, 발판 줄은 2000자 때문에 뺌

## 1차 상세안 → 2차 정제

| # | 1차 (상세) | 근거 | 남길 낱말 | 2차 (실제) | 뺀 낱말(이유) |
|---|---|---|---|---|---|
| 0 | on the floor at the left, along the left wall, a long straight wooden reception counter at a right angle to the back wall, running from the back toward the camera, chest high (97 pixels), its long side facing right into the room, its back end about one metre in front of the back wall so staff can walk in behind it | 위키·설계안 접수 창구, 사용자 결정 | 자(뒷벽과 수직), 뒤 끝 띄움 | left wall, reception counter, right angle to the back wall, 97 pixels, chest high, in front of the back wall, behind | Floor, left, along the left wall: a reception counter at a right angle to the back wall, chest high (97 pixels), back end a metre in front of the back wall, staff behind it | straight(at a right angle(| 자)로 충분); wooden(재질은 모델이 정함); running(at a right angle to the back wall로 같은 뜻); toward(at a right angle로 같은 뜻); camera(at a right angle로 같은 뜻); one(a metre로 같은 뜻); can(staff space behind it으로 같은 뜻); walk(staff space behind it으로 같은 뜻) |
| 1 | on top of the counter a glass candy bowl, a desk bell and a clipboard | 설계안 사탕 그릇, 윤지아 사탕, 접수 | candy bowl, bell, clipboard | On the counter: a candy bowl, a bell, a clipboard | glass(그릇 재질 세부); desk(bell로 충분) |
| 2 | on the left wall behind the counter a shelf of colourful chart folders and a wall phone | 직원 쪽 물건(접수 업무), 접수대 뒤 | chart folders, wall phone | Left wall, behind the counter: chart folders and a wall phone | shelf(chart folders로 충분, 2000자); colourful(색은 팔레트) |
| 3 | on the left wall behind the counter a single white first-aid cabinet with a red cross, only one | 낡은 의원 대기실 손님·직원 물건 (대기실 v6에서 빼서 휑해짐, 되살림) | first-aid cabinet, one | Left wall, behind the counter: one first-aid cabinet | single(one으로 같은 뜻); white(색 세부, 2000자); red(구급함 표시는 모델이 앎); cross(구급함 표시는 모델이 앎); only(one으로 같은 뜻) |
| 4 | on the left wall above the counter a faded old clinic sign board with peeling letters | 위키: 바랜 옛 병원 간판 | faded, clinic sign | Left wall, above the counter: a faded old clinic sign | board(sign으로 충분); peeling(faded로 충분); letters(글씨는 그림이 정함) |
| 5 | high up on the left wall an old boxy TV on a wall bracket | 낡은 의원 대기실(환자 기다림), v6에서 빼서 휑해짐 | TV, high | Left wall, above the counter: an old TV, high | boxy(old TV로 충분); bracket(벽걸이 받침 세부, 2000자) |
| 6 | on the back wall between the counter and the exam room door, on the patient side, an eye chart | 손님(환자) 물건, 접수대 앞 손님 쪽 | eye chart | Back wall, left part, patient side: an eye chart | between(Back wall, left part(접수대 쪽 부분)로 자리 충분); counter(left part로 충분); exam(left part로 충분); door(left part로 충분, 문 낱말 수를 2개로 맞춤) |
| 7 | on the back wall left of the exam room door two faded health posters | 설계안 포스터 ×2 (글씨는 사용자 허락) | two faded health posters | Back wall, left part, patient side: two faded health posters | exam(left part로 자리 충분); door(left part로 충분, 문 낱말 수를 2개로 맞춤) |
| 8 | on the floor in front of the back wall below the eye chart a blood pressure machine on a stand and a weight scale with a height rod, on the patient side | 손님 물건(혈압계·체중계)은 손님 쪽, 사용자: 접수대 뒤 금지 | blood pressure machine, weight scale | Floor in front of the back wall, left part, patient side: a blood pressure machine and a weight scale | eye(묶음 at으로 자리 충분); chart(묶음 at으로 자리 충분); stand(받침 세부); height(키 막대 세부, 2000자); rod(키 막대 세부, 2000자) |
| 9 | on the floor in front of the back wall beside them a pair of wooden crutches and an umbrella stand | 낡은 의원 대기실 손님 물건, v6에서 빼서 휑해짐 | crutches, umbrella stand | Floor in front of the back wall, left part, patient side: crutches and an umbrella stand | them(묶음 at으로 자리 충분); pair(crutches로 충분); wooden(재질 세부) |
| 10 | on the back wall right of the middle, well away from the counter, a pale green exam room door, closed, facing the camera, 170 by 80 pixels, with open bare floor in front of it | 사용자: 뒷벽 진료실 문, 접수대에서 떨어지게 오른쪽, 문 앞 빈 바닥; 설계안 문 연한 녹색 | back wall, pale green exam room door, closed, facing the camera, 170 by 80, open floor, in front of, away from the counter | Back wall, right part, well away from the counter: a pale green exam room door, closed, facing the camera, 170 by 80 pixels, open floor in front of it | middle(right part로 같은 뜻); bare(open floor로 같은 뜻) |
| 11 | on the back wall at the right a white operating room door with a small square window, closed, facing the camera, 170 by 80 pixels, the same height as the exam room door, open floor in front of it | 사용자: 뒷벽 수술실 문, 진료실 문과 같은 크기(대기실 3차에 옆벽 문이 커짐) | white operating room door, small window, same size, closed, in front of | Back wall, right part, well away from the counter: a white operating room door with a small window, the same size, closed, open floor in front of it | square(small window로 충분); camera(앞 문과 같은 꼴); pixels(the same size가 맡음); height(same size로 같은 뜻); exam(same size(앞 문)로 가리킴) |
| 12 | on the back wall between the two doors a cork board of pinned notices and a wall-mounted hand sanitizer dispenser | 설계안 손 소독제, 대기실 공지 | between the two doors, cork board, hand sanitizer | Back wall, right part, well away from the counter: between the two doors a cork board and a hand sanitizer | pinned(notices로 충분); notices(cork board로 충분, 2000자); wall-mounted(묶음 at(back wall)로 같은 뜻); dispenser(hand sanitizer로 충분) |
| 13 | on the floor at the far right, right of the operating room door, a water cooler and a magazine rack of old magazines, cut off by the image edge | 위키 오래된 잡지, 설계안 잡지 꽂이, 손님 물건 | water cooler, magazine rack | Floor, far right: a water cooler and a magazine rack | operating(far right로 자리 충분); door(far right로 충분, 문 낱말 수를 2개로 맞춤); old(magazine rack으로 충분); cut(sides 칸(오른쪽이 그림 끝에서 잘림)이 맡음); off(sides 칸이 맡음); image(sides 칸이 맡음); edge(sides 칸이 맡음) |
| 14 | on the floor at the right front a plastic potted plant, a standing fan and a small trash bin | 낡은 대기실 손님 쪽 물건 | potted plant, standing fan, trash bin | Floor, right front: a potted plant, a standing fan and a trash bin | plastic(화분 재질 세부); small(원래 작음) |

## 3차 자가 검토

- 이 방에 안 맞는 물건이 2차 문장에 있나? 줄마다 확인한 결과
  - 15줄 모두 대기실 물건. room_items 대기실 금지(엑스레이·링거대·산소·폐기물·수술대·무영등·기구 수레·메스·진찰 침대·흡인기) 없음. 의자·시계·누수·커튼 없음. 구급함 하나
- 손님 물건이 직원 쪽에 있거나, 캐릭터가 못 다가가는 자리에 꼭 필요한 것이 있나?
  - 손님 물건(시력표·포스터·혈압계·체중계·목발·우산꽂이)은 'patient side' 묶음, 정수기·잡지·화분·선풍기는 오른쪽 바닥. 접수대 뒤 묶음에는 차트·전화·구급함(직원 것)만. 문 둘은 'well away from the counter' 묶음, 문 앞 빈 바닥. 뒷벽 접수대 뒤는 막힌 벽(v6에 빈 출입구가 생김)
- 큰 가구·문 크기가 서 있는 사람 150px(에일린) 기준으로 맞나? 숫자로
  - 접수대 가슴 높이 97(사람 150의 0.65배, 1.1m), 문 170×80(사람보다 조금 큼, 1.9m) — 대기실 3차에 오른쪽 옆벽 문이 1.8배로 커져서 둘 다 뒷벽, 같은 높이로 적음
- 위키·설계안·사용자 결정 중 빠진 것이 있나? 있으면 왜 뺐나
  - 위키·설계안·사용자 항목 모두 줄·칸에 대응. 뺀 것: 의자(오브젝트로 따로), 시계(전역 금지). v6에서 2000자 때문에 뺐던 TV·목발·우산꽂이·구급함·발판·선풍기를 자리 묶음 문법으로 글자를 아껴 되살림. 발판은 2000자 때문에 다시 뺌(출구는 게임 화살표가 보여 줌)
- 2차로 줄이며 1차 뜻이 바뀌거나 중요한 세부(기구·재질·잠금 등)가 빠졌나?
  - 접수대 | 자·뒤 끝 1m·가슴 높이, 문 둘 자리·닫힘·정면·같은 크기·문 앞 빈 바닥, 손님 쪽 묶음을 남김. 뺀 것은 재질·같은 뜻·묶음 머리가 맡는 자리뿐, 줄마다 이유
- 이유 없는 채움 물건·같은 물건 두 번·쓸데없이 긴 설명이 있나?
  - 같은 물건 두 번 없음. 줄마다 근거. 억지 채우기 없음. 문 앞을 비워야 해서 채우기는 normal, 대신 v6보다 물건 4줄 많음
- 원근·바닥 몫·양옆 벽·문·채우기가 이 장면에 정한 대로인가?
  - one-point, 바닥 아래 절반(대기실은 다니는 바닥이 넓어야 함), 왼쪽 벽만(오른쪽 열림, 사용자 결정), 문 2(뒷벽), 채우기 normal(문 앞 비움 때문). 밑그림·참고 그림 1 여부는 사용자가 정함

## 2차 요청문 (2000자)

```
Pixel art game background: an unlicensed clinic's waiting room in a run-down 1990s Seoul underground arcade, night, harsh fluorescent light.
Camera at standing eye height, about 20 degrees above the floor, looking slightly down. One-point perspective, side walls receding toward the middle. The floor fills the lower half of the image. Only the left side wall is visible; on the right the room continues past the image edge.
FLOOR: worn pale green PVC sheet, no tiles, scuffs.
WALLS: yellowed cracked plaster, pale green lower band; the back wall behind the counter is solid; two fluorescent tubes.
THINGS (a standing adult is 150 pixels tall): Floor, left, along the left wall: a reception counter at a right angle to the back wall, chest high (97 pixels), back end a metre in front of the back wall, staff behind it. On the counter: a candy bowl, a bell, a clipboard. Left wall, behind the counter: chart folders and a wall phone; one first-aid cabinet. Left wall, above the counter: a faded old clinic sign; an old TV, high. Back wall, left part, patient side: an eye chart; two faded health posters. Floor in front of the back wall, left part, patient side: a blood pressure machine and a weight scale; crutches and an umbrella stand. Back wall, right part, well away from the counter: a pale green exam room door, closed, facing the camera, 170 by 80 pixels, open floor in front of it; a white operating room door with a small window, the same size, closed, open floor in front of it; between the two doors a cork board and a hand sanitizer. Floor, far right: a water cooler and a magazine rack. Floor, right front: a potted plant, a standing fan and a trash bin.
LIGHT: bright middle floor, deep shadows under furniture.
STYLE: dense, highly detailed pixel art, crisp pixel clusters, selective dark outline, rich medium-to-detailed shading, cold off-white, pale green, steel grey, red and candy accents, no dithering, no blur. No people, chairs, sofas, benches, clocks, other doors or doorways.
```
