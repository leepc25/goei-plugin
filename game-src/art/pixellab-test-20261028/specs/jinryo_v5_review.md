# 검토서 jinryo_v5

방 exam_room · 분위기 worn · 문 0 · 원근 one-point · 바닥 the lower 40 percent · 양옆 both · 채우기 packed

## 점검 결과

- WARN 설명이 김(28낱말): on the floor at left, in front of the back wall, a grey steel desk facing camera, waist high (75 pixels), doctor's side behind; stethoscope, files on it
- WARN 설명이 김(21낱말): on the back wall above the desk a glowing X-ray light box, chest X-ray with a dark blot in a lung
- WARN 설명이 김(21낱말): on the back wall middle a white medicine cabinet as tall as a person (150 pixels), bottles and bandages behind glass
- WARN 설명이 김(30낱말): on the floor at right, a padded examination bed parallel to the back wall, long side to camera, 167 by 62 pixels, paper roll, a step in front of it
- WARN 같은 낱말 4번: desk
- WARN 같은 낱말 4번: pixels

## 근거

- 위키: 손길 의원: 바랜 옛 병원 간판이 붙은 무면허 의원. 플라스틱 의자, 오래된 잡지, 접수 창구, 진료실 두 개, 그리고 형광등이 쨍한 진짜 수술실. 원장 고연지: 총상, 자상, 둔상 외상 수술부터 초능력 장비 이식, 이상 의수족, 장기 적출과 이식, 저중급 이상 오염 치료까지. 돈이 먼저다. 「갈비뼈 두 대, 폐 하나 주저앉았고, 그 검은 조직은 뭔지 모르겠네요. 셋 다 고칠 수 있어요. 선불입니다.」 간호조무사 윤지아: 허리 파우치에 붕대와 사탕과 비상 간식.
- 설계안: 설계안에 진료실 항목 없음. 결정 기록(10-30): 진료실 두 개는 같은 장면 하나를 같이 씀, 양쪽 벽 닫힘(작은 밀실), 문 없음(돌아가는 길은 아래 출구 표시). 진료실 2차: 왼쪽 책상(청진기·차트·펜꽂이), 기구 수레, 페달 휴지통, 엑스레이 판, 가운데 약장, 세면대, 칸막이, 오른쪽 진찰 침대+발판. 바닥이 PVC 대신 타일로 나옴.
- 사용자: 의자 전부 빼기
- 사용자: 문 없음(아래 출구)
- 사용자: 양쪽 벽 닫힘(작은 밀실)
- 사용자: 이 도구로 진료실 다시 뽑기
- 사용자: 밑그림은 배치가 게임에 꼭 필요할 때만
- 사용자: 참고 그림 1 빼고 밑그림 없이, 채우기 packed 유지(사용자 10-30)
- 사용자: 자리 말(벽·바닥)은 정제에서 못 뺌 — v3·v4에서 엑스레이가 왼벽, 주삿바늘 상자가 바닥으로 나옴

## 설계안·위키 항목 대조

- 위키: 형광등이 쨍함 → 칸:walls fluorescent
- 위키: 무면허 의원(낡음) → 칸:place unlicensed
- 위키: 플라스틱 의자·오래된 잡지·접수 창구 → omit: 대기실 물건이고 의자는 사용자 결정으로 전부 뺌
- 위키: 수술실·이중 잠금 약품장·냉장고·장기·의수족·이식·오염 치료 → omit: 수술실 장면이 맡음(op_v4)
- 위키: 총상·자상·둔상 외상 진료 → 7번, 10번
- 위키: 「그 검은 조직은 뭔지 모르겠네요」(진찰·엑스레이) → 2번
- 위키: 「선불입니다」(돈이 먼저) → 1번
- 위키: 간호조무사 윤지아의 붕대·사탕 → omit: 사탕은 진료실 금지(room_items exam_room), 붕대는 11번 선반이 맡음
- 결정 기록: 왼쪽 책상(청진기·차트·펜꽂이) → 0번
- 결정 기록: 기구 수레 → 7번
- 결정 기록: 페달 휴지통 → 8번
- 결정 기록: 엑스레이 판 → 2번
- 결정 기록: 가운데 약장 → 3번
- 결정 기록: 세면대 → 4번
- 결정 기록: 칸막이 → 6번
- 결정 기록: 오른쪽 진찰 침대+발판 → 5번
- 결정 기록: 바닥 PVC(2차는 타일로 나옴) → 칸:floor PVC
- 사용자: 양쪽 벽 닫힘 → 칸:sides both
- 사용자: 문 없음 → omit: 문은 그리지 않음 — no 칸에 doors, doorways

## 1차 상세안 → 2차 정제

| # | 1차 (상세) | 근거 | 남길 낱말 | 2차 (실제) | 뺀 낱말(이유) |
|---|---|---|---|---|---|
| 0 | on the floor at the left, a plain grey steel doctor's desk standing free in front of the back wall, about one metre out, its front face toward the camera, waist high (75 pixels), so the doctor stands behind it; on top a stethoscope, patient files and a pen cup | 결정 기록 진료실 2차: 왼쪽 책상(청진기·차트·펜꽂이). 의사가 뒤에 서야 해서 뒷벽에서 띄움 | floor at left, in front of the back wall, desk, facing camera, 75 pixels, behind, stethoscope, files | on the floor at left, in front of the back wall, a grey steel desk facing camera, waist high (75 pixels), doctor's side behind; stethoscope, files on it | plain(grey steel로 충분); free(in front of the back wall로 벽에서 떨어짐을 말함); one(a metre로 같은 뜻); metre(남김); face(front to camera로 같은 뜻); toward(facing camera로 같은 뜻); stands(the doctor's side behind it으로 같은 뜻); patient(files로 충분(진료실 서류)); pen(펜꽂이는 작아서 안 보임, 글자 수); cup(펜꽂이는 작아서 안 보임, 글자 수) |
| 1 | on the desk a small grey cash box with its lid open and a receipt pad | 위키: 「선불입니다」 돈이 먼저인 의원 | cash box, receipt | on the desk an open cash box and receipts | small(책상 위 소품은 원래 작음); grey(색은 팔레트가 맡음); lid(open으로 같은 뜻); pad(receipts로 같은 뜻) |
| 2 | on the back wall above the desk an X-ray light box glowing, showing a chest X-ray with a strange dark blot in one lung | 결정 기록 엑스레이 판 + 위키 「그 검은 조직은 뭔지 모르겠네요」 | back wall, X-ray light box, dark blot | on the back wall above the desk a glowing X-ray light box, chest X-ray with a dark blot in a lung | strange(dark blot이 이상함을 보여 줌); one(in a lung로 같은 뜻) |
| 3 | in the middle of the back wall a white medicine cabinet as tall as a standing person (150 pixels), glass front over shelves of brown bottles, bandage rolls and boxes, solid panels below | 결정 기록 가운데 약장 | back wall, medicine cabinet, as tall as a person, bottles, bandages | on the back wall middle a white medicine cabinet as tall as a person (150 pixels), bottles and bandages behind glass | shelves(bottles behind glass로 충분); brown(약병 색은 모델이 앎, 글자 수); rolls(bandages로 충분); boxes(bottles·bandage로 충분); solid(아래 칸 세부, 글자 수); panels(아래 칸 세부, 글자 수) |
| 4 | on the back wall right of the cabinet a small stainless steel sink with a soap bottle and a paper towel holder above it | 결정 기록 세면대, 진찰 전후 손 씻기 | back wall, sink, soap, towels | on the back wall right of it a steel sink, soap, towels | cabinet(right of it(약장)로 가리킴); small(세면대는 원래 작음); stainless(steel과 같은 뜻); bottle(soap로 충분); paper(towels로 충분, 2000자); holder(paper towels로 충분) |
| 5 | on the floor at the right, a padded examination bed placed parallel to the back wall, long side toward the camera, 167 pixels long and 62 pixels tall, white paper roll, raised head end, a small step in front of it | 결정 기록 오른쪽 진찰 침대+발판, 게임에서 눕는 자리 | floor at right, examination bed, parallel to the back wall, long side, 167 by 62, paper roll, step | on the floor at right, a padded examination bed parallel to the back wall, long side to camera, 167 by 62 pixels, paper roll, a step in front of it | placed(parallel to로 충분); toward(to camera로 같은 뜻); tall(167 by 62 pixels 숫자가 높이 포함); white(종이 롤 색은 모델이 앎); raised(머리 쪽 올림은 세부, 2000자); head(머리 쪽 올림은 세부, 2000자); end(raised head로 같은 뜻); small(발판은 원래 작음) |
| 6 | left of the bed a folding three-panel privacy screen of pale green cloth, shoulder high (130 pixels) | 결정 기록 칸막이, 진찰 가림 | privacy screen, three-panel, shoulder high, 130 pixels | left of the bed a three-panel pale green privacy screen, shoulder high (130 pixels) | folding(three-panel이면 접이식); cloth(pale green 천은 그림으로 충분) |
| 7 | right of the desk a small steel trolley with an instrument tray, a suture kit, scissors, gauze, cotton balls and a brown iodine bottle | 결정 기록 기구 수레 + 위키 총상·자상 외상 봉합 | trolley, suture, gauze, iodine | right of the desk a steel trolley: suture kit, gauze, iodine | small(trolley는 원래 작음); instrument(suture kit·scissors가 기구); tray(trolley 윗판으로 충분); scissors(봉합 키트에 가위 포함, 2000자); cotton(gauze와 겹침); balls(gauze와 겹침); brown(요오드 병 색은 모델이 앎); bottle(iodine으로 충분) |
| 8 | next to the trolley a small steel pedal bin | 결정 기록 페달 휴지통 | pedal bin | next to it a pedal bin | trolley(next to it(수레)로 가리킴); small(원래 작음); steel(재질 세부, 팔레트 steel) |
| 9 | on the right wall above the bed a wall-mounted blood pressure gauge with a coiled cuff | 진료실 쓰임(진찰), 환자가 눕는 침대 쪽 | right wall, blood pressure gauge | on the right wall above the bed a blood pressure gauge with a cuff | wall-mounted(on the right wall로 같은 뜻); coiled(커프 세부) |
| 10 | on the left wall a narrow shelf of rolled bandages, boxes of latex gloves and a stack of folded towels | 위키 외상 진료·윤지아 붕대, 진료실 쓰임 | left wall, bandages, gloves | on the left wall a shelf of bandages and gloves | narrow(벽 선반 폭 세부); rolled(bandages로 충분); boxes(gloves로 충분); latex(gloves로 충분); stack(folded towels로 충분); folded(2000자); towels(2000자, 붕대·장갑이 진료 근거) |
| 11 | on the back wall next to the sink a small yellow sharps disposal box | 진료실 쓰임(주사·봉합 바늘) | back wall, sharps | on the back wall beside the sink a yellow sharps box | small(원래 작은 상자); disposal(sharps box와 같은 뜻) |

## 3차 자가 검토

- 이 방에 안 맞는 물건이 2차 문장에 있나? 줄마다 확인한 결과
  - 12줄 모두 진료실 물건. room_items 진료실 금지(수술대·무영등·산소·흡인기·잡지 꽂이·정수기·접수대·사탕) 없음. 의자·시계·커튼 없음
- 손님 물건이 직원 쪽에 있거나, 캐릭터가 못 다가가는 자리에 꼭 필요한 것이 있나?
  - 책상은 바닥 왼쪽, 뒷벽 앞에 1m 띄워 정면(의사가 뒤에 섬). 침대는 바닥 오른쪽, 뒷벽과 나란히, 앞에 발판. 벽 물건은 줄마다 어느 벽인지 적음(엑스레이·약장·세면대·주삿바늘 상자 = 뒷벽, 혈압계 = 오른벽, 선반 = 왼벽)
- 큰 가구·문 크기가 서 있는 사람 150px(에일린) 기준으로 맞나? 숫자로
  - 픽셀 숫자는 v3·v4에서 안 먹혀서 몸 기준 말을 같이 적음: 책상 허리 높이(75), 약장 사람 키(150), 칸막이 어깨 높이(130), 침대 167×62
- 위키·설계안·사용자 결정 중 빠진 것이 있나? 있으면 왜 뺐나
  - 위키·결정 기록 항목 19개 모두 줄·칸에 대응. 뺀 것: 대기실 물건, 수술실 물건(op_v4가 맡음), 사탕(진료실 금지 목록), 문
- 2차로 줄이며 1차 뜻이 바뀌거나 중요한 세부(기구·재질·잠금 등)가 빠졌나?
  - v4에서 빠졌던 자리 말(on the back wall, on the right wall, on the floor at left/right, in front of)을 1차와 같게 되살림. 뺀 낱말은 같은 뜻·작아서 안 보임·글자 수뿐, 줄마다 이유
- 이유 없는 채움 물건·같은 물건 두 번·쓸데없이 긴 설명이 있나?
  - 줄마다 근거 있음. 같은 물건 두 번 없음(붕대: 약장 안 보관 / 왼벽 선반 바로 쓰는 것). 자리 말을 되살리느라 2000자 넘어서 근거가 약한 포스터·진찰 등 줄을 뺌. 억지 채우기 없음
- 원근·바닥 몫·양옆 벽·문·채우기가 이 장면에 정한 대로인가?
  - one-point, 바닥 40%, 양옆 벽 닫힘(작은 밀실), 문 0, packed 유지(사용자: 빈 곳 채우기는 문제없음), 밑그림 없음, 참고 그림 1 없음(사용자 결정)

## 2차 요청문 (1994자)

```
Pixel art game background: a shabby exam room of an unlicensed clinic in a 1990s Seoul underground arcade, night, harsh fluorescent light.
Camera at standing eye height, about 20 degrees above the floor, looking slightly down. One-point perspective, side walls receding toward the middle. The floor fills the lower 40 percent of the image. Both side walls are visible, a closed room.
FLOOR: seamless worn pale green PVC sheet, no tiles, scuffs, dark shadows under furniture.
WALLS: yellowed peeling off-white plaster, pale green lower band; two fluorescent tubes.
PACKED WITH STUFF, every area filled, no empty wall, no empty floor corner. THINGS (a standing adult is 150 pixels tall): on the floor at left, in front of the back wall, a grey steel desk facing camera, waist high (75 pixels), doctor's side behind; stethoscope, files on it; on the desk an open cash box and receipts; on the back wall above the desk a glowing X-ray light box, chest X-ray with a dark blot in a lung; on the back wall middle a white medicine cabinet as tall as a person (150 pixels), bottles and bandages behind glass; on the back wall right of it a steel sink, soap, towels; on the floor at right, a padded examination bed parallel to the back wall, long side to camera, 167 by 62 pixels, paper roll, a step in front of it; left of the bed a three-panel pale green privacy screen, shoulder high (130 pixels); right of the desk a steel trolley: suture kit, gauze, iodine; next to it a pedal bin; on the right wall above the bed a blood pressure gauge with a cuff; on the left wall a shelf of bandages and gloves; on the back wall beside the sink a yellow sharps box.
LIGHT: bright bed and desk, deep shadows under furniture.
STYLE: dense, highly detailed pixel art, crisp pixel clusters, selective dark outline, rich medium-to-detailed shading, cold off-white, pale green, steel grey, grey-green shadows, yellow and red accents, no dithering, no blur. No people, chairs, sofas, benches, clocks, doors or doorways.
```
