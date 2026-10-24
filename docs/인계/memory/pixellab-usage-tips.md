---
name: pixellab-usage-tips
description: PixelLab 공식 문서·튜토리얼에서 확인한 큰 동작(내딛기·질주·공격) 만드는 법 — PixelLab 생성 계획 전에 읽기
metadata:
  type: reference
  modified: 2026-10-21T07:55:16.106Z
---
조사 2026-10-21 (공식: api.pixellab.ai/v2/openapi.json, /mcp/docs, pixellab.ai/docs; 비공식: github gfargo/pixelkiln 튜토리얼 요약). MCP `search_help` = PixelLab 도움말 에이전트, 무료.
- animate_image(v3)는 첫 장에서 크게 못 벗어남. 시작 장이 이미 동작의 시작처럼 보여야 함(대기 자세에서 큰 동작 X). last_frame 주면 보간 모드 = 핵심 자세 고정.
- 큰 동작은 단계로 쪼개 이어 붙임: 준비 → 타격 → 회수, 앞 클립 끝 장 = 다음 클립 첫 장. 동작이 클수록 장 수 많이(공격 연속 16장 권장).
- 프롬프트: 외모 말고 움직임을 한 문장으로(속도·힘·무엇이 먼저). enhance_prompt 옵션(+0.05) 있음. drift_threshold = 색 깜빡임 억제.
- 캔버스 여백: 뻗는 쪽에 빈 공간 충분히.
- 정확한 자세 = animate_with_skeleton_v3: 프레임마다 COCO-18 관절 좌표(0~1 비율, ARM=손목, LEG=발목, 동쪽 보면 RIGHT=앞쪽 팔다리) + first_frame_keypoints(현재 그림과 맞아야 색·투명 유지). 8장=3회. 관절 추정은 REST POST /v2/estimate-skeleton(MCP 도구 없음).
- edit_image_pixen·edit_image는 자세를 보존하는 도구 → 자세 바꾸기용 아님. 자세 변경 = character state, skeleton v3, Re-pose(Aseprite 전용).
- animate_character 템플릿(lead-jab, cross-punch, running-8-frames, flying-kick, taking-punch, getting-up 등)은 PixelLab 캐릭터 객체 필요, v3 참조는 정면(south) 그림 요구.
- PixMiniMax: 4~40장, 132×132가 128보다 싸다(내부 확대 규칙). 단 우리 실측상 색 37→12로 줄어 음영 소실.
See [[jyaldi-v5-cps2-redo]], [[game-design-feedback]].
- **기본 길 먼저** (2026-10-21 사용자 "보통 사람들은 이렇게 못 뽑을 리 없다", "니 좃대로 밀어붙인 이유"): create_character(v3, side 가능, 256까지; 참조는 정면 그림 + direction_images로 east=기준표) + animate_character 견본(lead-jab, cross-punch, running-8 등, skeleton-v3 2~4회/방향). 기본 이동은 견본, 요원 고유 공격만 뼈대로. 미시험, 사용자 지시 대기. docs/PixelLab_사용법.md 마지막 절.
- 기본 길 시험 결과 (2026-10-21, 14회): 캐릭터 c0968765-bb79-4596-a1a7-433e60b4f9f1(96, side). 견본 running-8/lead-jab/taking-punch 각 3회, 144 캔버스·몸 약 87px. 달리기 발 엇갈림·재킷 정상, 첫 시도에 쓸 만함. 결함: 맞기 마지막 장 회색 얼룩, 잽 3장뿐, 머리 보라빛. 시연 release/demo/jyaldi-template-test.html. 프레임 받기는 curl(?t= 포함), urllib은 403.
- 실수(2026-10-21): 등록 캐릭터가 기준표 A(sheet7 pixen-a)와 다름(새까만 정장·보라 머리·가는 몸) — 정면 그림을 설명만으로 새로 뽑고 A와 비교 안 함. 등록 시 direction_images east=A(재킷 길게 고친 판)로 고정하고, 정면은 A와 나란히 비교 후 사용자 확인.
- skeleton_v3 정면 돌아감 (2026-10-21 확인): 생성기는 기준 그림 각도를 따라감. A2(3/4, 셔츠 보임)로 뽑으면 클립마다 3/4·옆모습이 갈림 → 옆모습으로 나온 guard/00.png(뼈대 G0)를 기준으로 쓰면 전부 옆모습(scripts/gen_fix2.py). 손이 가슴 앞일 때 팔꿈치가 등 뒤로 가는 IK도 정면 원인(생활 스레드가 rig.py에서 팔꿈치 앞으로 고침). 작업 칸 20개를 스레드끼리 공유 → rate limit 시 대기 후 재시도.
- **Cost formulas (openapi 2026-10-23):** create-character-v3 = ceil(w*h*8/65536) (+1 from scratch); animate-with-text-v3 ≈ ceil(w*h*frames/65536); animate-with-skeleton-v3 is size-independent (3fr=2, 8fr=3, 15fr=4). Square canvas thresholds: 181→4, 202→5, 221→6, 239→7, 256→8. Body ≈65% of canvas height.
- **2026-10-23 user direction (field):** user says Claude/GPT can't use skeleton v3 well (backward elbows, front drift, many redos). Plan agreed in discussion: field motions = registered character (create_character v3 WITH reference image; front view checked vs side ref) + animate-character templates; non-template = animate-with-text v3 from a good first frame; skeleton only as last resort. interpolation-v2 max 128×128 (unusable for agent canvases).
