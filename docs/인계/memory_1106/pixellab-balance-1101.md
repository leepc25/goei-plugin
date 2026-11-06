---
name: pixellab-balance-1101
description: PixelLab 잔액 2026-11-01 16:42 = 254회(07:57 1,679회에서 급감) (10-24 1만 회에서 급감) — 생성 계획 전에 /v2/balance로 다시 확인
metadata:
  type: project
  modified: 2026-11-01T07:58:42.514Z
---
2026-11-01 07:57 `GET https://api.pixellab.ai/v2/balance` → generations 1,678.9 남음 (Tier 3 Pixel Architect 5x, 이달 총 44,069). 10-24 메모(약 10,950)는 옛 값.
실측 단가: generate-ui-v2 96×96(4장)=10, 512×256(1장)=25; generate-image-v2 64×64(16안)=10.
**Why:** 배경·동작 작업으로 거의 다 썼다. 수백 장짜리 계획(퍽 300개 ≈ 3,000회)은 잔액을 넘는다.
**How to apply:** 생성 계획을 내기 전에 잔액을 다시 조회해 계획에 적고, 잔액 안에서 끊는 선을 보여 준다. 통합창 계획: docs/통합창_PixelLab_생성계획_1101.md (브랜치 claude/project-thread-86d9ym). See [[goei-pixellab-one-per-scene]], [[pixellab-concurrency]].
2026-11-01 16:53 잔액 204회 (휴게실 p2·p5·p6·p6s·p8s 각 25회). 배경 1장=25회 → 약 8장분.
