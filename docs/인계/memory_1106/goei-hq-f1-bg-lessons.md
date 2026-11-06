---
name: goei-hq-f1-bg-lessons
description: 본부 1층 배경 PixelLab 교훈 2026-11-01 — 첫 장 엘리베이터 금지(세 번 질책), 「lobby」 단어 금지, 현관은 왼쪽 옆벽, 잇기는 옆 162px만 따라함; 08:07 사용자가 이 스레드 중단·새 스레드 요구
metadata:
  type: project
  modified: 2026-11-01T08:02:43.814Z
---
2026-11-01 07:40~08:02 (스레드 본부 층별 배경 이어 그리기 2, 브랜치 claude/project-thread-wtc3am):
- 사용자 결정: **1층 현관은 왼쪽 옆벽**(뒷벽에 두면 안 됨). **1층 첫 장에는 엘리베이터 절대 없음**(07:52, 08:07 세 번째 질책) — 엘리베이터는 오른쪽 잇기에서만. Claude가 「오른쪽 벽에 엘리베이터」(07:55)를 첫 장에도 넣는 걸로 잘못 넓혀 p5를 뽑아 사용자 「때려쳐라」(08:05). 준비된 요청문 `specs/hq_f1_p6_prompt.txt`(엘베 없음·lobby 없음), 「뽑아」 대기. B2는 p21 바탕으로 왼쪽 잇기 1(복도) → 잇기 2(격리실 큰 문) = `hq_b2_v2_ext2L.png` 1206폭.
- **「lobby」 단어 금지**: building lobby라 쓰면 PixelLab이 높은 홀을 그려 천장만 크고 엘리베이터·데스크가 작다(사용자 08:02 「전혀 쓸 수가 없어」). 3층 p1f처럼 「elevator hall」로 쓴다. p5(`hq_f1_p5_632x424.png`)는 elevator hall로 뽑았더니 원근 복도가 나와 실패. 핵심 물건을 첫 장에 넣되 1층 첫 장은 엘베 금지.
- 잇기(inpaint)는 옆 162px만 보고 복사한다: 바탕 끝이 밋밋하면 밋밋하게 늘어나고, 「같은 높이의 문」 기준이 창 안에 없으면 크기가 제멋대로. 핵심 물건(문·엘리베이터)은 첫 장에 넣고 잇기는 복도만.
- 결과 파일: `hq_f1_p4_632x424.png`(현관 옆벽·엘베 없음), `hq_f1_v4_ext1R.png`(982, 실패: 밋밋·엘베 작음), `hq_f1_p2*/p3*`는 버린 판. 그림 사본 /mnt/project-files/hq-f3/v2/.
See [[goei-pixellab-one-per-scene]], [[goei-pixellab-bg-prompt-rule]].

**2026-11-01 08:07 스레드 중단**: 사용자 「너랑 작업 못하겠으니 때려치고 새 스레드 열어」. 새 스레드는 이 파일과 [[goei-pixellab-one-per-scene]]·[[goei-bg-attach-immediately]]를 먼저 읽을 것. 브랜치 claude/project-thread-wtc3am(최신 974bead93)에 전부 push됨. 현재 쓸 만한 것: 2층·3층(게임 탑재), B1 `hq_b1_ext3L.png`(1568), B2 `hq_b2_v2_ext2L.png`(1206, 이음선 x≈312 손질 필요). 1층은 전부 실패, 요청문 p6 준비만.


**2026-11-01 08:19 (새 스레드)**: 「No elevator」라고 쓰면 그 단어에 끌려 오히려 엘리베이터가 그려진다. 1층 첫 장 요청문엔 elevator·hall·lobby 단어를 아예 쓰지 않는다 → `specs/hq_f1_p7_prompt.txt`(「ground floor reception area」). 금지 물건은 부정문으로도 이름을 쓰지 말 것.

**2026-11-01 08:30 진행(브랜치 claude/project-thread-hjsvsg, fecec37ad)**: B1 `hq_b1_ext3L` 확정·탑재(tools/mapedit/author_hq_b1.py), B2 `hq_b2_v3_ext2L`(겹침 60px로 다시 이음) 확정·탑재(author_hq_b2.py), 본부 계단 전부 없앰. 1층 p7(`hq_f1_p7_632x424.png`, elevator 단어 없는 요청문) → 엘리베이터 없이 나옴, 사용자 판단 대기. 아직 main 아님.

**2026-11-01 08:50 1층 탑재(d004646eb, 브랜치 claude/project-thread-hjsvsg)**: 바탕 `hq_f1_p7_ext1R_fix4.png`(칸막이 없음) + 칸막이 조각 3개를 `fix3`에서 오려 위에 올림(tools/mapedit/author_hq_lobby.py). 가운데 조각은 PaintedObject.gate(다가가면 오른쪽으로 밀려 열림, hub.ts gateOpen). 사용자 지시 「가운데 부분 코드로 열리게 따」.

**08:58 정정**: 사용자 「칸막이 있는 걸로」 = **차단게이트 판** `hq_f1_p7_ext1R.png`(회색 칸막이 판 아님, 잘못 써서 격노). 1층 = 이 판, 게이트 유리 날개 2장만 오려 gate(다가가면 흐려져 열림), 날개 뒤는 x690~719 바닥 띠로 채움(author_hq_lobby.py, 4015cbd97). 직원 NPC는 막힘을 무시하고 게이트 통과(미해결).
**08:57 정정 2**: 열리는 건 **앞 게이트 두 기둥 사이 유리 한 장만**(사용자 「가운데 기둥 사이 저거 하나만」). 옆 유리 날개는 닫힌 그대로(56240662f).
