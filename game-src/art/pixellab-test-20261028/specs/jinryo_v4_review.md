# 검토서 jinryo_v4

방 exam_room · 분위기 worn · 문 0 · 원근 one-point · 바닥 the lower 40 percent · 양옆 both · 채우기 packed

## 점검 결과

- WARN 설명이 김(21낱말): left: a grey steel desk facing camera, 75 pixels tall, a metre from the back wall, stethoscope and files on it
- WARN 설명이 김(19낱말): right: a padded examination bed, long side to camera, 167 by 62 pixels, paper roll, raised head, a step
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
- 사용자: 참고 그림 1(헐값매입) 빼고, 밑그림 없이, 채우기(packed)는 그대로 (v3에서 참고 그림 배치가 따라 들어옴)

## 설계안·위키 항목 대조

- 위키: 형광등이 쨍함 → 칸:walls fluorescent
- 위키: 무면허 의원(낡음) → 칸:place unlicensed
- 위키: 플라스틱 의자·오래된 잡지·접수 창구 → omit: 대기실 물건이고 의자는 사용자 결정으로 전부 뺌
- 위키: 수술실·이중 잠금 약품장·냉장고·장기·의수족·이식·오염 치료 → omit: 수술실 장면이 맡음(op_v4)
- 위키: 총상·자상·둔상 외상 진료 → 7번, 11번
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
| 0 | on the left a plain grey steel doctor's desk, 75 pixels tall and 106 pixels wide, its front face toward the camera, standing about one metre in front of the back wall so the doctor can stand behind it; on top a stethoscope, a stack of patient files and a pen cup | 결정 기록 진료실 2차: 왼쪽 책상(청진기·차트·펜꽂이). 의사가 뒤에 서야 해서 뒷벽에서 띄움 | desk, 75 pixels, metre, stethoscope, files | left: a grey steel desk facing camera, 75 pixels tall, a metre from the back wall, stethoscope and files on it | plain(grey steel로 충분); doctor(진료실 책상은 의사 것, 자리로 앎); wide(폭 숫자는 글자 수(2000자)); face(front to camera로 같은 뜻); toward(facing camera로 같은 뜻); one(a metre로 같은 뜻); can(뒤에 설 자리는 a metre from the back wall로 충분); stand(뒤에 설 자리는 a metre from the back wall로 충분); behind(a metre out from the back wall로 뒤 설 자리 충분); stack(files로 충분); patient(files로 충분(진료실 서류)); pen(펜꽂이는 작아서 안 보임, 글자 수); cup(펜꽂이는 작아서 안 보임, 글자 수) |
| 1 | on the corner of the desk a small grey cash box with its lid open and a receipt pad beside it | 위키: 「선불입니다」 돈이 먼저인 의원 | cash box, receipt | on the desk an open cash box, receipts | corner(책상 위 어디든 됨, 자리 세부); small(책상 위 소품은 원래 작음); grey(색은 팔레트가 맡음); lid(open으로 같은 뜻); pad(receipts로 같은 뜻) |
| 2 | on the back wall above the desk an X-ray light box glowing, showing a chest X-ray with a strange dark blot in one lung | 결정 기록 엑스레이 판 + 위키 「그 검은 조직은 뭔지 모르겠네요」 | X-ray light box, dark blot | above the desk a glowing X-ray light box: a chest X-ray with a dark blot in a lung | wall(above the desk(뒷벽)로 자리 충분); strange(dark blot이 이상함을 보여 줌); one(in a lung로 같은 뜻) |
| 3 | in the middle of the back wall a white medicine cabinet, 150 pixels tall, glass front over shelves of brown bottles, bandage rolls and boxes, solid panels below | 결정 기록 가운데 약장 | medicine cabinet, 150 pixels, bottles, bandages | on the back wall middle a white medicine cabinet, 150 pixels tall, bottles and bandages behind glass | shelves(bottles behind glass로 충분); brown(약병 색은 모델이 앎, 글자 수); rolls(bandages로 충분); boxes(bottles·bandage로 충분); solid(아래 칸 세부, 글자 수); panels(아래 칸 세부, 글자 수) |
| 4 | on the back wall right of the cabinet a small stainless steel sink with a soap bottle and a paper towel holder above it | 결정 기록 세면대, 진찰 전후 손 씻기 | sink, soap, paper towel | right of it a steel sink, soap, paper towels | wall(right of it(뒷벽 약장 옆)로 자리 충분); cabinet(right of it(약장)로 가리킴); small(세면대는 원래 작음); stainless(steel과 같은 뜻); bottle(soap로 충분); holder(paper towels로 충분) |
| 5 | on the right a padded examination bed, long side toward the camera, 167 pixels long and 62 pixels tall, white paper roll, raised head end, a small step stool in front of it | 결정 기록 오른쪽 진찰 침대+발판, 게임에서 눕는 자리 | examination bed, long side, 167 by 62, paper roll, step | right: a padded examination bed, long side to camera, 167 by 62 pixels, paper roll, raised head, a step | toward(to camera로 같은 뜻); tall(167 by 62 pixels 숫자가 높이 포함); white(종이 롤 색은 모델이 앎); end(raised head로 같은 뜻); small(발판은 원래 작음); stool(의자로 오해 막으려 step만) |
| 6 | left of the bed a folding three-panel privacy screen of pale green cloth, 130 pixels tall | 결정 기록 칸막이, 진찰 가림 | privacy screen, three-panel, 130 pixels | left of the bed a pale green three-panel privacy screen, 130 pixels tall | folding(three-panel이면 접이식); cloth(pale green 천은 그림으로 충분) |
| 7 | right of the desk a small steel trolley with an instrument tray, a suture kit, scissors, gauze, cotton balls and a brown iodine bottle | 결정 기록 기구 수레 + 위키 총상·자상 외상 봉합 | trolley, suture, gauze, iodine | right of the desk a steel trolley: suture kit, scissors, gauze, iodine | small(trolley는 원래 작음); instrument(suture kit·scissors가 기구); tray(trolley 윗판으로 충분); cotton(gauze와 겹침); balls(gauze와 겹침); brown(요오드 병 색은 모델이 앎); bottle(iodine으로 충분) |
| 8 | next to the trolley a small steel pedal bin | 결정 기록 페달 휴지통 | pedal bin | next to it a pedal bin | trolley(next to it(수레)로 가리킴); small(원래 작음); steel(재질 세부, 팔레트 steel) |
| 9 | on the back wall two faded old health posters about hand washing and blood pressure | 결정 기록 2차 포스터, 낡은 의원 분위기(글씨는 사용자 허락) | health posters | on the back wall two faded health posters | old(faded로 같은 뜻); hand(포스터 내용 세부, 작아서 안 읽힘); washing(포스터 내용 세부, 작아서 안 읽힘); blood(포스터 내용 세부, 작아서 안 읽힘); pressure(포스터 내용 세부, 작아서 안 읽힘) |
| 10 | on the right wall above the bed a wall-mounted blood pressure gauge with a coiled cuff | 진료실 쓰임(진찰), 환자가 눕는 침대 쪽 | blood pressure gauge | above the bed a blood pressure gauge with a cuff | wall(above the bed(침대가 오른벽에 붙음)로 자리 충분); wall-mounted(on the right wall로 같은 뜻); coiled(커프 세부) |
| 11 | on the left wall a narrow shelf of rolled bandages, boxes of latex gloves and a stack of folded towels | 위키 외상 진료·윤지아 붕대, 진료실 쓰임 | left wall, bandages, gloves | on the left wall a shelf of bandages, gloves and towels | narrow(벽 선반 폭 세부); rolled(bandages로 충분); boxes(gloves로 충분); latex(gloves로 충분); stack(folded towels로 충분); folded(towels로 충분) |
| 12 | on the back wall next to the sink a small yellow sharps disposal box | 진료실 쓰임(주사·봉합 바늘) | sharps | beside the sink a yellow sharps box | wall(beside the sink(뒷벽)로 자리 충분); small(원래 작은 상자); disposal(sharps box와 같은 뜻) |
| 13 | at the head of the bed a standing gooseneck examination lamp | 진료실 쓰임(상처 진찰 조명), 침대 머리맡 | gooseneck, lamp | beside the bed head a gooseneck exam lamp | examination(exam과 같은 뜻) |

## 3차 자가 검토

- 이 방에 안 맞는 물건이 2차 문장에 있나? 줄마다 확인한 결과
  - 14줄 모두 진료실 물건. room_items 진료실 금지(수술대·무영등·산소·흡인기·잡지 꽂이·정수기·접수대·사탕) 없음. 의자·시계·커튼 없음
- 손님 물건이 직원 쪽에 있거나, 캐릭터가 못 다가가는 자리에 꼭 필요한 것이 있나?
  - 손님·직원 구분 공간 없음(진료실은 의사와 환자 한 방). 책상을 뒷벽에서 1m 띄워 의사가 뒤에 섬. 침대 앞(발판)과 가운데 바닥은 비워 캐릭터가 침대·책상에 다가감
- 큰 가구·문 크기가 서 있는 사람 150px(에일린) 기준으로 맞나? 숫자로
  - 책상 높이 75(사람 150의 0.5배, 약 0.8m), 침대 167×62(약 1.9m×0.7m), 약장 150(사람 키와 같음, 1.7m), 칸막이 130(가슴 위) — 사람 150=1.7m 비율과 맞음
- 위키·설계안·사용자 결정 중 빠진 것이 있나? 있으면 왜 뺐나
  - 위키·결정 기록 항목 19개 모두 줄·칸에 대응. 뺀 것: 대기실 물건, 수술실 물건(op_v4가 맡음), 사탕(진료실 금지 목록), 문
- 2차로 줄이며 1차 뜻이 바뀌거나 중요한 세부(기구·재질·잠금 등)가 빠졌나?
  - 책상 위치(뒷벽에서 1m)·청진기·차트, 엑스레이 검은 얼룩, 봉합 키트·요오드, 침대 크기·종이 롤·머리 올림을 남김. 2000자 때문에 뺀 것: 펜꽂이, 책상 폭 숫자, 커프 감김 같은 작은 세부(줄마다 이유)
- 이유 없는 채움 물건·같은 물건 두 번·쓸데없이 긴 설명이 있나?
  - 줄마다 근거 있음. 같은 물건 두 번 없음(붕대는 약장 안 보관 / 왼벽 선반 바로 쓰는 것). 근거가 약한 의사 가운 줄은 2000자 때문에 뺌. 억지 채우기 없음
- 원근·바닥 몫·양옆 벽·문·채우기가 이 장면에 정한 대로인가?
  - one-point, 바닥 40%, 양옆 벽 닫힘(작은 밀실), 문 0, packed 유지(사용자: 빈 곳 채우기는 문제없음), 밑그림 없음, 참고 그림 1 없음(사용자 결정)

## 2차 요청문 (1996자)

```
Pixel art game background: a shabby exam room of an unlicensed clinic in a 1990s Seoul underground arcade, late night, harsh white fluorescent light.
Camera at standing eye height, about 20 degrees above the floor, looking slightly down. One-point perspective, side walls receding toward the middle. The floor fills the lower 40 percent of the image. Both side walls are visible, a closed room.
FLOOR: worn pale green PVC flooring, scuffs, light pools, dark shadows under furniture.
WALLS: yellowed peeling off-white plaster, pale green lower band, baseboard; two fluorescent tubes.
PACKED WITH STUFF, every area filled, no empty wall, no empty floor corner. THINGS (a standing adult is 150 pixels tall): left: a grey steel desk facing camera, 75 pixels tall, a metre from the back wall, stethoscope and files on it; on the desk an open cash box, receipts; above the desk a glowing X-ray light box: a chest X-ray with a dark blot in a lung; on the back wall middle a white medicine cabinet, 150 pixels tall, bottles and bandages behind glass; right of it a steel sink, soap, paper towels; right: a padded examination bed, long side to camera, 167 by 62 pixels, paper roll, raised head, a step; left of the bed a pale green three-panel privacy screen, 130 pixels tall; right of the desk a steel trolley: suture kit, scissors, gauze, iodine; next to it a pedal bin; on the back wall two faded health posters; above the bed a blood pressure gauge with a cuff; on the left wall a shelf of bandages, gloves and towels; beside the sink a yellow sharps box; beside the bed head a gooseneck exam lamp.
LIGHT: bright bed, desk and light box, dark corners, deep shadows under furniture.
STYLE: dense, highly detailed pixel art, crisp pixel clusters, selective dark outline, rich medium-to-detailed shading, cold off-white, pale green and steel grey with dark grey-green shadows and yellow, red accents, no dithering, no blur. No people, chairs, sofas, benches, clocks, text on the floor, doors or doorways.
```
