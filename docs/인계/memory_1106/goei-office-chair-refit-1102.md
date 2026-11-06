---
name: goei-office-chair-refit-1102
description: 사무의자 C01 앉기·이어지는 줄·73 전 캐릭터 맞춤 11-02 완료(09:26) — 브랜치 qgoupv 1798532c71, 필드 기능 스레드로 넘김
metadata:
  type: project
  modified: 2026-11-02T07:10:33.758Z
---
11-02 사용자 「쉘 맞추듯이 전부 다시 맞춰야해」 → 스레드 「사무의자 캐릭터별 앉기 다시 맞추기」 cmsg_01SMy6spzkHA3Ttz9fg54ZY86uFrXPvsw1yL3HfsrQ4kgu, 브랜치 claude/project-thread-qgoupv, 커밋 b73376b.
- **기준(사용자 「엉덩이랑 가랑이 기준」, 다리·무릎·허벅지 기준 금지, 쉘 값 재사용 금지 — 둘 다 거절당함):** 정면 = 가랑이 점, 옆 = 엉덩이 뒤 아래 점, 후면 = 엉덩이 밑(뒤에서 본 다리 사이 위 끝) + 등 가운데 x. 각 점을 앉기 끝 장에서 손으로 찍어(office_pick_grid.py MARK 로 확인) 의자 좌석 점 SEATPT 에 오게 dx,dy 계산. 의자는 안 움직임.
- **정면 가랑이는 좌판 한가운데가 아니라 좌판 앞 모서리에** (11-02 07:15 사용자: 한가운데에 두니 「너무 올라가고 등받이에 붙음」·걸터앉음 지적 다수). 몸이 남동을 보면 남동 의자(관리국남B). 일괄 이동 금지, 사람마다 눈으로.
- SEATPT: south(92,107) se(108,106) sw(76,106) east(83,97) north(91,101 = 등받이 가운데).
- 치마·코트·망토로 엉덩이가 안 보이면 치마 끝, 또는 바닥-58px(보통 캐릭터 평균)으로.
- 도구 tools/objects/office_fit_all.py (sheet/try/set/pick/apply), office_back_measure.py·office_side_measure.py·office_front_measure.py(자동 후보, 손 확인 필수). 값 game-src/art/objects/chairs_office/fit_all.json, 찍은 점 picks.json → apply 로 testroom3/chairs/<키>.json.
- 앉은 동작 줄(62~68·106·148·149·167·97~105·69~72): 사용자 「거기서 이어지는 모든 동작 다 맞춰야지」. act_cmp 로 비교 → 대부분 0~2px, 위로 뜬 11줄만 fit_all lines["front:149"] 등. 73 기대 쉬기 = lines["front:73"] {dx,dy,frame_dx}, 깊이 기대는 사람만 오른쪽으로(쉘 줄값-쉘 기본값 차이를 사무 기본에 더함 / 없으면 -12). apply 가 chairs/<키>.json 의 "73" 등 줄 키로 씀. 도구 office_act_overlay.py (NOOL=1 이면 빨간 윤곽 없음).
- 고연지(4.3) 정면 앉기 60: 원래 요청문·구절 바꾼 판 모두 비스듬+가운 판 뭉침 실패. 사용자 「고연지는 뽑아」(승인 16회, .pixellab_ok). 같은 요청문 재생성은 사용자 격노(「원래 요청문대로 뽑아?」) → 점검 = 요청문까지 고치기. 옆 96은 멀쩡했음(내 점검 그림 칸이 좁아 잘려 보임 — 칸 너비 그림마다 맞출 것).
- 브라우니(5.2) 제외.
- 결과 그림 /mnt/project-files/hq-office/chair_refit/office_chair_{front,side,back,lean73}_{A,B}_x2.png.
- 08:40 사용자 「전반적으로 엉덩이 조금 올려」→정면 기본·정면 줄 전부 +3, 뒤이어 핀 34개(대부분 왼쪽). 정면 기본을 옮기면 front: 줄 값·frame_dx 도 같은 만큼 옮김. 73 줄은 의자 방향을 줄마다 바꿀 수 있음(lines img: 남동/남서, 사용자 핀).
- 고연지 60 3차(무릎·발 정면·가운 옆 문장) 통과, 62~68·73·106 다시 뽑음(동작 칸 팔짱 구절도 교체해야 했음). 가운 뒷자락 회색은 「어쩔 수 없어」, 73 안 기댐 「그냥 둬」. 새 줄은 m3.py ok <키> 60 표시해야 대기열이 돎.
- 09:26 사용자 「마무리하고 닫고 필드 기능 스레드로 넘겨」→ 브랜치 claude/project-thread-qgoupv 1798532c71, main 머지 안 함(「릴리스해」 대기).
See [[goei-lounge-bg-1101]].
