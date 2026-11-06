---
name: goei-toilet-game-1101
description: 화장실 남(wc 2층)·여(wc3 3층) 게임 탑재 상태 2026-11-01 14:50 — 브랜치 claude/project-thread-1a103j(1h1kah 위), 칸 문 6장면, NPC·주인공 사용, 감지 함수 toiletUsers
metadata:
  type: project
  modified: 2026-11-01T14:43:19.937Z
---
스레드 「화장실 게임에 넣기」(cmsg_01SMy6spzkHA3Ttz9fg54ZY8H4XrfCZgMkpaLvdL9fEUnb), 브랜치 claude/project-thread-1a103j = 1h1kah + xb9u41(칸 그림) 합침. main/merge-1101엔 아직 없음.
- 장면 원본: tools/mapedit/author_hq_wc.py → game-src/mapedit/wc, wc3 → import.py(frames·toilets 지원 추가). 확인 그림 tools/mapedit/preview_wc.py.
- 층: 칸 몸통은 배경에 굽고, 앞 기둥 가림(sortY 736), 문 6장면(frames, 왼쪽 칸부터). 칸 앞 걷는 선 = 칸 그림 맨 아래 불투명 픽셀(픽셀 단위). 소변기 앞 여유 10px·서는 자리 +24, 세면대 +10·+28 (1x) — 사용자 14:16 「소변기·세면대 너무 바짝 따지 말고」.
- 남자: 오른쪽부터 stall0·stall1만 자리, 맨 왼쪽 칸 자리 없음(늘 닫힘). 여자 칸 4개 전부.
- 코드: world/toilets.ts(TOILET_LAP 사람별 허벅지선; 14:5x 사용자 「80이 괜찮은거 같은데」 → 변기·배관만 80%(stall_body_tall_s80, tools/bg_fix/stall_toilet_scale.py), 기준 LAP 173, 본부 16명 개별값(에일린 179, 고그니쟈·큐라스·고르고디오·데드폴·게슈간·관리국남A/B·여B 176, 나머지 173), 커밋 e296114045(1h1kah 합침). 14:59 2차: TOILET_SEAT[look]=[허벅지선, 좌우 dx도트] — 남동쪽으로 앉은 사람은 허리 가운데가 좌석 가운데에 오게 dx, 데드폴 165(다리 펴서 좌석 끝 걸침), 콘쥬스 181, 관리국남A·B 169, 여B 170·dx10 (82678827e2)), actors.ts(sexOf=MALE_LOOKS(100줄) 우선, sexOk로 다른 성별 화장실 안 감, 칸 open→in→leave, 볼일 뒤 세면대), hub.ts(주인공 E: 칸 101→102×4→103, 소변기 100×3, 세면대 104×2).
- 필드 스레드에 WorldSim.toiletUsers(scene) 모양 전달(침입 감지·대사는 그쪽 몫).
**How to apply:** 사용자 판정 전. 고칠 때 author_hq_wc.py 다시 돌리고 import.py. See [[goei-restroom-stalls-1101]], [[goei-shower-toilet-detect]].
**15:04 사용자 격노 「기준이 다리야 엉덩이야」 「전캐릭 내가 일일이 점검해야하냐」:** 앉는 기준 = 엉덩이 밑선이 좌석 윗면(80% 변기 칸 캔버스 y185 뒤~197 앞 입술)에 닿기 + 허리 가운데 = 좌석 가운데(남동쪽으로 튼 사람은 dx+). 허벅지 옆 테 보이기로 고르면 바지 내린 사람이 뜬다. 15:10 「모든 세력 돌려쓸건데」 → 102 있는 117명 전원 TOILET_SEAT 기입(이름·몹 look 키), 콘쥬스 187.
**15:19 표시등:** 칸 문 표시등 빈 칸 = 녹색만 켬, 사람 있음(NPC·주인공) = 빨간 불(busy 장면), 남자 맨 왼쪽 미사용 칸 = 녹색 그대로·상호작용 없음(사용자 15:34). d85bdc30b4.
