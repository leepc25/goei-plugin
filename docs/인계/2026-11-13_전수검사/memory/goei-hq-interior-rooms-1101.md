---
name: goei-hq-interior-rooms-1101
description: 본부 내부 방 배경 요청문 규칙 2026-11-01 — 평평한 뒷벽·양옆 열림·어른 키 기준 문장 필수, 화장실·휴게실 설비/가구/자판기는 전부 오브젝트(배경에 금지)
metadata:
  type: feedback
  modified: 2026-11-01T10:33:35.724Z
---
2026-11-01 10:25 훈련장 1차(「training room」만, 3층 원본의 옆벽·크기 문장 뺌) → 소실점 상자 방·작은 크기·제멋대로 문, 사용자 「원근이 하나도 안 맞고」「문 안 만든대며」.
- 고친 문장(v2, `game-src/art/pixellab-hq-20261031/specs/hq_b1_training_p2_prompt.txt`): 「The back wall is one flat wall facing the viewer, about twice as tall as an adult.」+「no side walls at the left or right, both ends are open.」 → 평평한 뒷벽, 문 없음, 크기는 1.4배 정도(아직 조금 작음).
- 10:31 사용자: **화장실·휴게실의 대변기·소변기·테이블·의자·자판기는 배경에 그리지 말고 전부 오브젝트로.** 요청문엔 이 이름을 쓰지 않고 「The room is empty: all fixtures and furniture have been taken out, and the floor is completely clear.」로 막음(hq_restroom_p1_prompt.txt, hq_lounge_p1_prompt.txt).
- 방 배치: 2F 화장실(남), 3F 화장실(여)·휴게실, B1 훈련장·샤워실 남/여, B2 격리팀·격리시설.
**How to apply:** 내부 방 요청문은 v2 틀 + 위 문장. See [[goei-bg-prompt-banned-words]], [[goei-pixellab-bg-prompt-rule]].

**11:07 훈련장 확정**: `game-src/art/pixellab-hq-20261031/hq_b1_training_ext2R.png`(1277×424, p2 + 오른쪽 잇기 2번, 이음은 코드 손질). 오른쪽 끝 사격 부스(철망 칸막이·과녁)도 사용자 「그냥 이대로 쓴다 확정」. 아직 게임 탑재·가림 따기 전.

**12:05 남자 화장실 배경 확정**: `game-src/art/pixellab-hq-20261031/hq_restroom_m_final_984x424.png`(=ext3L_fix, p1+왼쪽 빈 벽 잇기3, 이음 두 곳만 코드 손질; 브랜치 claude/project-thread-a7a4q5). 다음: 대변기 칸 오브젝트 — 방법 후보 PixelLab `POST /v2/map-objects`(background_image+inpainting 네모 → 배경 화풍·원근 맞춘 투명 물체, 최대 400×400).
12:12 map-objects 배경+마스크 모드는 창 192×192(36,864px)까지만(422, 차감 없음) → 칸(140×245)은 못 들어감. 대안: inpaint-v3로 확정 배경에 그려 넣고 원본과 픽셀 비교로 오려 내기(사용자 답 대기).
12:23 create-1-direction-object 칸(10회, 256 최대): view=sidescroller라 납작한 평면 → 사용자 「입체감이 배경과 전혀 달라」. 이 기능 시점은 top-down/sidescroller뿐. 다음 후보: generate-image-v2 no_background + 화풍=확정 배경 + 배경 시점 문장 그대로.
12:37 대변기 칸 오브젝트 완성(코드): game-src/art/objects/restroom/stall_body.png + stall_door_0..5.png(0 닫힘→5 열림, 같은 캔버스 230x256), tools/bg_fix/stall_build.py·stall_place_preview.py(배치 FOOT368 RIGHT413 PITCH158, 몸통 오른쪽부터·문 나중). 원본 hq_restroom_m_stalls_v2.png(generate-image-v2 no_background 15회). 휴게실 요청문 specs/hq_lounge_p2_prompt.txt(p1 화장실 문장+장소만) 「뽑아」 대기 — 보낼 때 gen_bg 문장검사에 NO_FILL 필요. 스레드 첨부 24장 한도 참 → 새 스레드.
12:48 칸 발판 원본 픽셀 복원·줄 끝 원본 좁은 끝 기둥(stall_body_end/stall_endpost), 미리보기 v2g, 커밋 e17d8f757. 12:49 사용자 「닫아」로 화장실 스레드 닫음. 휴게실(specs/hq_lounge_p2_prompt.txt)은 여전히 「뽑아」 대기.
13:00 칸 손질(브랜치 claude/project-thread-xb9u41 0a4286d): 타일 지울 땐 변기 밑동 검은 테두리·솔(가운데 기둥 왼쪽)·기둥 테두리를 원본에서 되살림. 배치 RIGHT=398(사용자 「딱 이 경계에 맞춰」: 끝 기둥 오른쪽 끝 = 소변기 벽 경계선 x397). 요원 앉혀 보기 tools/bg_fix/stall_sit_preview.py(큐라스 102). 미리보기 v2i.
13:31 변기 새로: 사용자가 웹 8방향 물체로 직접 뽑음(물탱크 정남·좌석 살짝 남동, 화풍=큐라스 앉은 장, 128x256) → toilet8/toilet_user_1330.png. 요원과 같은 배율(2배 화면 334/234)이면 좌석 높이 = 앉은 엉덩이 높이. 옛 변기·밸브 지운 몸통 stall_body(_end)_notoilet.png, 미리보기 tools/bg_fix/stall_toilet_swap.py(변기 칸 캔버스 x120, 기둥은 요원 앞). 요청문 교훈: 빼는 물건 이름(lid·tank) 쓰지 말고, 방향·카메라 높이를 따로 단락으로 강조.
13:40 웹 변기(toilet_user_1330) 사용자 「못 쓰겠다」→ 원래 변기로 되돌림. 「높여」= 늘이지 말고 변기를 벽 밸브·배관과 통째로 위로 옮기기(14px, tools/bg_fix/stall_toilet_raise.py → stall_body_tall.png). 미리보기 에일린은 tools/mapedit/eileen_stand.png ×(334/234) — 픽셀 차이로 뽑은 에일린은 구멍 나서 금지.
13:46 화장실 손질 현황(브랜치 claude/project-thread-xb9u41): 배경 새 판 hq_restroom_m_final_v2_984x424.png(소변기 칸막이 P1 지움·P2·P3을 P4 모양, tools/bg_fix/urinal_partitions.py). 칸: 뒷벽을 캔버스 y210(배경 벽 밑 띠)에서 끊음, 옆판 사선, 솔 5px 올림, 맨 왼쪽 칸 닫힌 채 미사용, 가운데 칸 열고 큐라스. 미리보기 /mnt/project-files/hq-f3/now/화장실남_전체_v6.png. 스레드 cmsg_…UCvpD1wym3… 첨부 24 다 참.

**11-01 17:18 의자 오브젝트 규칙(사용자):** 새 의자는 반드시 「뒤가 전부 막힌」 통 등받이(어깨 높이, 좌석과 틈 없음). 낮은 등받이·좌판 드러나는 의자는 후면에서 좌판이 엉덩이 위로 올라와 못 씀. 생성은 C01과 같은 create-object-pro-flash + 같은 크기 문장(135px, seat 64). See [[goei-lounge-bg-1101]].
