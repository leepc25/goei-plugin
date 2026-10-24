---
name: pixellab-pricing
description: PixelLab 요금제·생성 단위 비용 실측(2026-10-20)과 추천 플랜; MCP 잔액은 generations 단위
metadata:
  type: reference
---
- 계정 상태 2026-10-20: 무료 체험(trial), generations 40 중 30 사용·10 남음, credits $0. MCP get_balance로 확인. MCP/API 호출은 구독의 월 generations 또는 달러 credits에서 차감.
- 요금제(https://www.pixellab.ai/pricing): Tier1 Pixel Apprentice $12/월(연속 할인 12→10→9.5→9) 2,000 gen/월, 이미지 320×320까지. Tier2 Pixel Artisan $24(24→23→22.5→22) 5,000 gen, 512×512, 우선 큐+동시 10작업, 실험 기능. Tier3 Architect $50, 10,000 gen, 동시 20. 연간 약 25% 할인. 이월 규정 미기재.
- 생성 단위 비용(https://www.pixellab.ai/pixellab-api, 추정치): animate-with-text-v3 128×128 16장=4, 256×256 8장=8 (실측 160×160: 4장=2, 6장=3, 8장=4). PixMiniMax(Tier1 이상, 베타) 256×256 8장=1, 40장=6 — 크기 무관, 시간 기준이라 매우 쌈, 품질 시험 필요. Pro Flash 생성/편집 128=6, 256=9; create_character_pro_flash 128=8, 256=17. 스켈레톤 v3 3장=2·8장=3·15장=4.
- 2026-10-20 사용자 반응: '한 달 넘게 만들겠다고?' — 월 결제 단위를 작업 기간처럼 말하지 말 것. 사용자는 속도를 원함 → Tier3로 바로 권함. 제시 일정: 첫 완주판 그림 1주, 전체 그 뒤 1주, 병목은 반려 횟수.
- 이전 추천(2026-10-20): Tier2 월결제. 요원당 약 200 gen, 첫 판(요원 2+적 8+보스+타일+컷인) 다시 뽑기 포함 2,000~3,000 gen 추정이라 Tier1(2,000)은 빠듯, Tier2(5,000)가 gen당 가장 쌈($0.0048). 컷인 512 크기·동시 10작업도 Tier2부터.
