# 에일린 로컬 제작 재개 · 2026-10-22

작업 브랜치 `codex/art-eileen-resume`. 기존 `3ffba089`를 독립 worktree에서 이어받았다. 생성 완료와 사용자 시각 승인은 구분한다. **전환·얼굴 방향 전체 수정은 미완료**다.

## 실제 반영한 수정

- 정밀 사격 `precise` 01·02의 개머리판/머리카락 경계만 PixelLab 무료 `pixelart_workbench`로 각각 19·18픽셀 수정. 몸·얼굴·복식·손·실루엣 알파는 원본 그대로다. 얼굴 방향 전면 수정으로 주장하지 않는다.
- 지지발 위치 10장: `pushkick` 01~04 +2px, `step` 02~04/06 -1px, `limp` 03~04 -2px. 원본 그림을 다시 그리거나 크기 변경하지 않았다. 패킹 시 전체 프레임과 손·엉덩이·총구 기준점을 같은 양만큼 이동한다. 발바닥 y136. 달리기 공중 프레임은 보정하지 않았다.
- 수정된 스트립은 precise/pushkick/step/limp 4개. 나머지 89개 스트립은 픽셀과 기존 PNG 인코딩을 유지한다.
- 씻기 20장(탈의7/돌아서기3/샤워6/목욕4) 재생성 0. 기존 원본 RGBA·샤워05→02 반복 유지. 시각 승인 pending.
- `release/demo/eileen-full.html`은 위 수정이 실제 내장된 단일 플레이 HTML. A 길게 눌렀다 떼기 = 정밀 사격, S = 무장 전환. **현재 무장 전환은 기존 결함이 남은 그림**이다.
- `release/demo/eileen-resume-review.html`은 전/후 프레임 비교, 느린 재생, 프레임 선택, 실패 후보 비교를 제공한다. 반려 후보는 플레이 그림에 섞지 않았다.

## 인증·큐·실제 비용

로컬 MCP 인증 성공. 최초 잔액 **14,160.30 generations**, credits $0.00, Tier3 Pixel Architect2x. 최초 활성0. 계정 동시 한도20은 현재 무료 `search_help` 답변이며 직접 계정 한도 endpoint는 없다는 답변을 받았다. 각 호출 직전 list_jobs로 타 담당 큐를 확인했고 에일린 제출중은 항상1건 이하. 계정 잔액은 다른 담당과 함께 변하므로 차이를 에일린 비용으로 계산하지 않았다. 마지막 조회 원문·시간은 `account-end.json`.

| 작업 | ID | 사전 견적 | 완료 응답 실제 차감 | 판정 |
|---|---|---:|---:|---|
| precise 단일 Pixen | ddafed99-d4d6-4b51-bbb4-c01ce660ef68 | 1 | 1 | 머리 top y47→39, 자세/체형 변화로 반려 |
| 전환 고정끝 보간 | e92bce68-f025-4757-94b0-b16566cebe5d | 4 | 4 | 02~04 앞·등에 소총 중복으로 반려 |
| 전환 팔 경로 뼈대 | 5ce7b76d-7f1a-43e5-a28a-76f10b039fbd | 3 | 3 | 무기 얇아짐/변형·07 앞손 복귀로 반려 |
| 전환 상체7장 Pro 보정 | 296587c6-95c3-4b93-92a7-d164ddb10506 | 15 | 10 | 몸 위치 변경·다리 연결 틈, 03 총 방향 변경으로 반려 |
| **합계** | 유료4건 | **23** | **18 generations** | 모두 회수, 유료 AI 후보 채택0 |

Pro의 제출 응답 `~10`은 근사치였고 완료 `charged: 10 generations`로 확정했다. 무료 정확 편집2건은 추가 차감0. 유료 출력25장 중 보간 첫장은 입력 복사이므로 신규 AI 출력은24장이다. 생성 장수를 품질 합격으로 세지 않는다. 과거 인계의332회는 과거 보고 수치이며 현재 원장의 실청구18회와 구분한다.

## 실패 후 방법 변경과 다음 과제

Pixen 재그림이 자세를 바꿔 무료 좌표 편집으로 전환했다. 전환의 끝장 보간은 무기가 중복되어 팔 경로를 직접 지정하는 뼈대로 변경했고, 뼈대 무기 변형은 80×80 상체 영역7장을 Pro로 보정했다. Pro는 crop 안의 몸 위치까지 바꾸어 다리 경계가 깨졌다. 모두 원본/요청/입력 해시/응답/PNG/판정을 보존했다. 같은 유료 요청 자동 재시도는 없다.

전환은 새 중간 핵심 자세의 단일 소총 구조와 두 손 접촉을 먼저 사람이 검수할 수 있게 확정해야 한다. 지금의 후보를 추가 보간해 양산하지 말 것. 2D 관절만으로 소총 형태·회전을 구속하지 못했고, 상체 crop 재그림은 경계를 보장하지 않았다. 얼굴 엄격한 측면, pair1의 총/머리 겹침, buttstroke 얼굴 가림, 절뚝임의 동작 강도·걷기 발 미끄럼은 남아 있다. 생활·사교49클립은 이번에 생성하지 않았다.

## 원본·도구·담당 인계

`source-comparison.json`에 fetch한 시스템 `59a2a883`와 준비 `6b8000ea`, 에일린 HEAD의 base/clips/spend/manifest Git 객체 해시를 대조했다. base/clips는 동일하며 기존 에일린 브랜치의 씻기 패킹·큐 안전장치를 이어받았다. 준비 브랜치 전체 병합 없음. 다른 캐릭터 그림 입력 없음. 공용 엔진·본부·스테이지·atlas·통합 HTML 변경 없음.

총괄 채팅 `01a1632e-358b-7931-b8ab-c3487b5b6095`에 예약/작업ID/실비/검수 결과를 전달했다. 총괄이 `codex/character-production-control` 원장과 담당 인계를 유지한다. 큐라스 기과금 두 작업의 조회·회수는 큐라스 담당에게 남겼으며 이 작업에서는 수행하지 않았다. 기존 도구 인덱스는 `../tool-handoff.json` 및 총괄 `game-src/action/character-resume/handoff-index.json`.

## 검증과 증거

- `ledger.json`: 작업별 입력 해시, 요청 해시, 실제 cost/단위, 출력별 SHA256, 실패 원인.
- `candidate-frame-review.json`: 25출력의 얼굴·몸·복식·손·접지·전환 판정.
- `delivery-frame-review.json`: 적용된4클립 전체28장의 변경 픽셀 수와 전/후 bbox·해시.
- `validation.json`: 정확37픽셀 범위, 알파 불변, 지지발10장, 손/총구 기준점 동시 이동, base/clips 원본 불변, PC/모바일 로딩·프레임 선택·재생·S 양방향 전환 검사.
- `browser-compat/browser-check.json`: 기존 씻기20장 동일,93클립 로딩,샤워반복,PC/모바일가로·세로 실제 이동 검사.
- 시각 검수는 본 담당과 총괄의 후보 검토이며 **사용자 시각 승인 아님**.

실행은 UTF-8 Python 환경에서 `tools/build_eileen_demo.py`, `scripts/build_resume_review.py`, `scripts/test_resume_safety.py`, `scripts/check_resume_demo.py`, `scripts/check_live_delivery.py`. 마지막 네 경로는 이 캐릭터의 `game-src/action/eileen/` 아래다. Windows 브라우저 검사는 `CHROMIUM_PATH`를 설치된 Chrome에 지정한다. 회수 도구는 이미 과금된 Eileen ID만 내려받으며 생성 호출이 없다.
