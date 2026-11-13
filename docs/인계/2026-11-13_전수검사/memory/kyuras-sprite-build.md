---
name: kyuras-sprite-build
description: 큐라스(kyuras) 도트 제작 상태 — 설계서 위치, 핵심 규칙(스냅·후퇴·발화 열·박자), 비용, 승인 여부
metadata:
  type: project
  modified: 2026-10-22T01:32:56.858Z
---
스레드 「큐라스 도트 제작」(2026-10-22 시작). 사용자 지시: 쟈알디와 같은 장면 전부, 동작·기본공격·스킬·필살기 전부 달라야 함, 모양만 다른 주먹질 금지, 캐릭터 시트와 기본 이미지(assets/agents/Kyuras_default.avif) 기준.
- 설계서 docs/캐릭터제작서/동작설계_kyuras.md (branch claude/project-thread-l2znog, 사본 /mnt/project-files/characters/). 52 전투 + 83 생활 클립 + GPT 4(알몸), PixelLab 약 555회(상한 600).
- 핵심: 주먹·발 없음, 모든 공격 = 손가락 스냅 지점 폭발, A 연타는 물러나며 폭발 지점이 멀어짐, 자원 = 발화 열 + 박자(정박/엇박), D = 요격, 앉아 D = 화염벽, 잡기 대신 밀쳐 떼기, 필살 = 지휘(4/4), 숙련6 = 드럼 솔로. 외형은 기본 이미지의 검은 정장(오토바이 재킷 뺌), 앞머리 한 가닥.
- 2026-10-22 01:35 계획·비용 보고, 사용자 승인 대기. 승인 전 PixelLab 생성 0.
See [[jyaldi-full-build]], [[character-art-rules]], [[pixellab-one-shot-delivery]].

- 2026-10-22 02:11: GPT is already drawing 큐라스 undress/shower/bath from the first request (user pasted it; got furious when a new paste line was sent). Do NOT send a new paste line or re-request; fix GPT delivery defects by code to the spec in 의뢰서 (palette, outline, foot line). Builder tools/build_kyuras_full_demo.py, template tools/kyuras_full_template.html, fixes tools/kyuras_fixes.py, sheet scripts/sheet.py.

- 2026-10-22 05:30 사용자 지시로 Claude 작업 중단·GPT 이관. 마지막 커밋 3bfb455(브랜치 claude/project-thread-l2znog, main 미합침). 인수인계 /mnt/project-files/game/인수인계/큐라스 도트 제작.md. 45/50 전투 클립, 무기 5클립 없음, 1~3타 주먹 읽힘 남음, 2차 검수 안 됨. PixelLab 약 330회.
