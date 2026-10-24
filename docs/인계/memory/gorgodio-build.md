---
name: gorgodio-build
description: 고르고디오 도트 제작(2026-10-22) 설계서·스크립트 위치, 규칙 차이, 비용, GPT 씻기 클립 처리 원칙 — 고르고디오 작업 재개 시 먼저 읽기
metadata:
  type: project
  modified: 2026-10-22T02:11:52.639Z
---
스레드 「고르고디오 도트 제작」(2026-10-22 시작). 사용자 지시: 7명 + NPC 전부, 쟈알디와 같은 장면 전부, 동작·기본공격·스킬·필살기 규칙까지 캐릭터마다 달라야 함("모양만 다른 주먹질 금지"), 제작 전 캐릭터 시트·기본 이미지 숙지, 쟈알디와 톤 맞춤. 01:37 "일단 만들어봐" 승인, 상한 약 690회.
- 설계서 docs/캐릭터제작서/동작설계_gorgodio.md (0장 차이표, 3장 조작·시간표, 8장 엔진 새 기능 17개 → 「게임 마무리 한 곳에서」).
- 규격: 맨몸 224×176 발바닥 y169 x86(키 약 111px), 장갑 256×192 발 y184 x100. 기준판 full/ref.png, armor/ref.png(pbase 00).
- 스크립트 game-src/action/gorgodio/scripts: rig.py(136)·rig_armor.py(28)·gen.py·strip.py·gorgodio_fixes.py(코드 보정). 시연판 tools/build_gorgodio_full_demo.py + tools/gorgodio_full_template.html → release/demo/gorgodio-full.html.
- GPT 씻기 4클립(undress·showerturn·shower·bath): 의뢰서 보강판 8c68712. **사용자는 붙여넣기 줄을 받자마자 이미 GPT에 넣음 — 같은 의뢰의 붙여넣기 줄을 다시 보내지 말 것(2026-10-22 02:10 격노).** 받은 흠은 재의뢰 없이 코드로(gorgodio_fixes.gpt_normalize: 팔레트·키·발 기준선). 같은 씬 재의뢰는 사용자 승인 필요.
- PixelLab 동시 작업은 요원 스레드당 최대 2개(사용자 확정 2026-10-22 03:13). gen.py 기본 --par=2, 끊기면 `gen.py --resume`(spend.log에서 받지 못한 작업부터 받음).
- 2026-10-22 05:24 사용량 초과로 중단, GPT로 이관. 상태: 맨몸 76 + 장갑 28클립 완료(main 3e7bcdc), 생활 등 64클립 남음. 인수인계 /mnt/project-files/game/인수인계/고르고디오 도트 제작.md.
See [[jyaldi-full-build]], [[character-art-rules]], [[game-design-feedback]].
