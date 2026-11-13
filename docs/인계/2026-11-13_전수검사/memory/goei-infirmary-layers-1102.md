---
name: goei-infirmary-layers-1102
description: B2 의무실 p9_fix2 레이어(11-02) — 침대는 점프해서 올라서는 물건(발자국+높이), 사람이 들어갈 곳 막지 말 것; 도구·브랜치
metadata:
  type: project
---
- 11-02 12:10 사용자 「캐릭터가 침대 위에 올라갈 수 있어?」 = **점프해서 올라서기**였음(눕기로 좁혀 읽어 격노). 12:11 「난간만 따지 말고 방 전체 레이어」, 12:23 「침대에 접근 못 하게 하면」「레이어 정교하게 딸 생각은 안 하고」, 12:24 빨간 막힘 상자가 빈 바닥까지 막음 지적.
- 규칙: 가구(침대·탁자 등)는 바닥선으로 통째로 막지 말고 **발자국(다리 닿는 바닥)만 막고, 윤곽 가림 + 올라설 수 있으면 높이 h(<400 = 올라서기, 엔진 platforms·import.py 지원, 점프 최대 ≈185 world px)**. 막힘 상자에 둘레 여유 넣지 말 것.
- 브랜치 claude/project-thread-aonpel. tools/mapedit/author_hq_infirmary.py → game-src/mapedit/infirmary/map.json, 확인 그림 tools/mapedit/preview_hq_infirmary.py (인자 x,y 또는 x,y,1=침대 위, NOLIE=1).
- 침대 윤곽 = 5~6배 격자 보고 꼭짓점 손으로 찍음(BED_POLY), 발자국·높이 BED_FOOT. 앞줄 물건 7묶음 = 줄마다 손으로 읽은 가림. 배율 뒤 0.545(y263)·앞 0.65(y324).
See [[goei-hq-room-list-1031]], [[goei-mask-rules-1101]].
