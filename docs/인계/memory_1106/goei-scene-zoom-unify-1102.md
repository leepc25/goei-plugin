---
name: goei-scene-zoom-unify-1102
description: 2026-11-02 필드 사람 크기·원근 통일 확정(15:23) — 기준 = 가장 큰 장면(사무실) 꽉 채움, sceneZoom≥1, 급한 장면 원근 뒤 −20%·앞 +12% (merge-1101 ab0936a)
metadata:
  type: project
  modified: 2026-11-02T15:06:47.995Z
---
2026-11-02 사용자 「화면마다 사람 크기가 막 들쑥날쑥」「좋은 방법 없을까」→ 추천안 「해」.
- 구현: `src/game/action/engine/view.ts` `sceneZoom`, `STD_DOTK=1.4292`, `STD_MID = STD_DOTK×(0.85+1)/2`, `perspOf()` 순수 함수. `hub.ts go()`에서 장면 lane 한가운데 원근 × dotK = mid, `sceneZoom = STD_MID/mid`. `game.ts` view.zoom에 inHub일 때 곱함. charMul = dotK/CHAR_K 그대로.
- 결과: 사무실·목욕탕 ≈0.8배(멀어짐), 휴게실·거리 1.1~1.3배(가까워짐). 앞뒤 원근 차이는 장면 그림대로 남음(맨 앞·뒤는 아직 조금 다름).
- 첫 시도(sceneZoom = STD_DOTK/dotK만)는 휴게실 sizes 표(앞 1.48) 때문에 사람이 두 배로 커져 폐기.
- 캡처 /mnt/project-files/field/scale_unify_1102.png (6장면, 도구 scratchpad shots.mjs = tests/field-harness openField+enterHub+stage.jump).
**How to apply:** 장면별 사람 크기를 다시 맞출 때 dotK를 만지지 말고 이 기준을 본다. 사용자 판정 대기 중. See [[goei-merge-1101]].

**15:12 2차 (사용자 「레터박스 키워서 화면 꽉 채우고 사람도 같이 키우고 다른 데를 전부 똑같이」):** 필드 zoom = 창세로/장면세로 × sceneZoom, sceneZoom = max(1, maxMid()/mid) (maxMid = 모든 PAINTED 장면의 dotK×줄가운데 원근 최댓값 = 사무실 ≈1.69). **10-27 PC 1배 고정 폐기(사용자 승인).** 검은 띠 없음, 복도 1.3배·거리 1.5배 가까워져 위쪽 잘림. merge-1101 a595291, 캡처 /mnt/project-files/field/scale_fill_1102.png.
**원근(사용자 「전부 제각각」「특정 맵은 너무 급격」):** 앞/뒤 비율 복도 1.18, 거리 1.12, 사무실·휴게실 1.55, 샤워 2.0~2.15, 목욕탕 2.25. 제안 A = 전부 복도 규칙(0.85→1)로 통일, 장면 원근표 폐기 / B = 1.4배 상한. 답 대기.
**15:15 원근 누르기 (사용자 「샤워장 같은 곳은 바깥쪽 커지는 폭 줄이고 안쪽은 최소한으로」):** view.ts `perspFlat`: 앞/뒤 비율 > FLAT_FROM 1.4인 장면(샤워·탈의실·목욕탕·사무실·휴게실)만 가운데 유지, 뒤 FLAT_BACK 0.8(15:18 「뒤쪽 원근 더 줄여야」= 뒤 사람을 더 작게! Claude가 거꾸로 읽어 0.98로 갔다가 15:21 「뒤에는 한참 줄여야」로 0.8)·앞 FLAT_FRONT 1.12로 지수 누름. merge-1101 ab0936a. 캡처 /mnt/project-files/field/persp_flat_1102.png. 사무실·휴게실 포함은 Claude 판단(사용자에게 뺄지 물어 둠). 폭 숫자(−5/+12)도 Claude 추정 → 사용자 판정 대기.
**장면 이름 주의:** shower_m/f = 탈의실, bath_m/f = 샤워실(물 나오는 곳).
**인계 대기(합치기는 사용자 승인 후):** 협회 창구 claude/project-thread-dgn08g 2fba159fa, 중림 가구 claude/project-thread-w2hjge 4f6f7500a (memory goei-merge-1101 끝 참조).
**15:23 사용자 「이정도로 하자」 → 확정** (뒤 0.8·앞 1.12, 사무실·휴게실 포함). 다음에 장면 사람 크기·원근 손댈 때 이 규칙을 깨지 않는다.
**15:24~15:33:** 사용자 「앞을 좀 줄이면?」→ +6%로 갔다가 곧 「앞을 줄이면 안 되지, 의자랑 맞아야」「의자에 앉았을 때를 기준으로」 → **앞 +12% 유지, 뒤 −20% (FLAT_FRONT 1.12 / FLAT_BACK 0.8)**. 의자 오브젝트는 spr(y)로 사람과 같이 배율되므로 의자-사람은 늘 맞고, 쟁점은 배경에 그려진 책상과의 크기. 사무실 앞줄 앉기 캡처 /mnt/project-files/field/office_sit_front_1102.png (도구 scratchpad sit.mjs: jump→player 자리 이동→E→'3' 그냥 있기). 뒷줄(desk4)은 E가 앞줄을 잡아 못 찍음.
**15:30 합치기 완료 (사용자 「다른데서 넘어온거 합쳐」):** w2hjge 4f6f750(중림 가구) + dgn08g 0621c4b(협회 창구·훈련장 그림 장면, 장비 없음) → merge-1101 3edcb65. 충돌: map.ts(타입 합집합·훈련장 room→floorHall·층 단추), painted.ts·prompt_diff.py·spend.log(둘 다), import.py(owner+who 둘 다), mapedit.gen.ts(--rebuild로 재생성). import.py: 글자값 chair → `chairObj`(HqSpot에 추가, 아직 안 씀).
