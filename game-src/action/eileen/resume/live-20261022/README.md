# 에일린 제작 재개 · 2026-10-22 후속 납품

브랜치 `codex/art-eileen-resume`, 독립 worktree. **부분 수정 납품이며 모든 결함 수정 완료는 아니다. 사용자 시각 승인 pending.** 이전 체크포인트 원장은 `checkpoint-e8bff21d.md`에 보존했다.

## 반영
- precise01/02: 무료 정확편집으로 개머리판/머리카락 경계19/18픽셀 수정. 얼굴·손·체형·알파 보존.
- 지지발10장: pushkick01~04 +2px, step02~04/06 -1px, limp03~04 -2px. 손·엉덩이·총구 기준점 동일 이동.
- 전환6→11장: 뼈대00/01 + 소총 정확편집02~05 + 기존 권총뽑기5장. 20fps, 역방향 지원. 정확편집v2는122/138/139/142픽셀, 총541픽셀. 피부·머리 픽셀 보호.
- 총괄 검수 후 등 뒤 총구/개머리판 방향을v2에서 정리했다. **03의 소총 가림, 05→06 얼굴·장비·몸통 윤곽 차이는 추가 보정 대상**이다. 기존 권총 원본의 허리 아래 사선 장비는 원본 그대로이며 별도 소총으로 확정하지 않았다.
- 수정5스트립, 나머지88개 PNG 유지. base/clips 원본 불변. 씻기20장 재생성0, RGBA·샤워05→02 반복 유지.
- `release/demo/eileen-full.html`: 새 그림 실제 내장. S 양방향전환, A 길게 눌렀다 떼기 정밀사격.
- `release/demo/eileen-resume-review.html`: 전후·느린재생·프레임선택·실패후보 비교.

## 비용·큐
인증 정상. 최초14160.30은 과거 관측값. 최신 조회시각/원문은 `account-final-v2.json`. Tier3 Pixel Architect2x, credits $0. 동시한도20은 무료 도움말의 답변이며 계정별 한도 endpoint는 제공되지 않았다. 담당 제출중 최대1건. 계정잔액 차이로 개인비용을 계산하지 않는다.

| 작업 | ID | 견적 | 실제 | 판정 |
|---|---|---:|---:|---|
| Pixen | ddafed99-d4d6-4b51-bbb4-c01ce660ef68 | 1 | 1 | 체형변화 반려 |
| 보간 | e92bce68-f025-4757-94b0-b16566cebe5d | 4 | 4 | 소총중복 반려 |
| 뼈대 | 5ce7b76d-7f1a-43e5-a28a-76f10b039fbd | 3 | 3 | 00~05만 정확보정 후 부분사용,06/07 제외 |
| 상체 Pro | 296587c6-95c3-4b93-92a7-d164ddb10506 | 15 | 10 | 몸 이동/다리 연결 틈 반려 |
| 소총 마스크 | ad4c134d-a12b-493f-996f-aa9fa2340811 | 10 | 10 | 소총불명확/마스크 밖1픽셀 변경 반려 |
| **유료5건 회수** | | **33** | **28 generations** | charged 응답으로 확정 |

무료 정확편집4회 비용0. 전환v1 `7ea4bb62-8747-43f3-8356-772426b3f358`는 보존하되 v2 `8acaabc7-e9a8-463b-8fd9-49e22aa019ea`로 대체. 과거332 보고와 이번실비28은 별도. 마스크 밖 변경은(22,192), RGBA137/128/109/255→투명. 실패 결과를 보존했으며 같은 유료 요청 재시도 없음.

## 검증·인계
- `ledger.json`: 작업ID, 실제비용, 입력/요청/출력해시, 실패/부분사용 상태.
- `transition-exact/request.json`: 실제541픽셀의 원래색/수정색·입력해시. v1 요청/결과도 보존.
- `delivery-frame-review.json`: 적용5클립39장의 얼굴·몸·복식·손·접지·경계 검수.
- `validation.json`: 변경5스트립, precise37픽셀, 지지발10장, 전환541픽셀 정확재현/끝5장불변/11anchor, PC·모바일 로딩/스크럽/양방향전환.
- `browser-compat/browser-check.json`: 93클립, 씻기20장, 반복경계, PC·모바일 가로/세로 실제조작.
- `source-comparison.json`: 시스템59a2a883/준비6b8000ea/기존에일린3ffba089 원본·spend·manifest 대조. 전체브랜치 병합 없음.
- 공용 엔진·본부·스테이지·atlas·통합HTML/다른캐릭터 수정 없음.
- 총괄 `01a1632e-358b-7931-b8ab-c3487b5b6095`에 ID/실비/도구/검수 전달. 큐라스2건 회수는 해당담당에게 남겼다. 도구인계 `../tool-handoff.json`, 총괄 `game-src/action/character-resume/handoff-index.json`.

얼굴 엄격한 측면, 전환 접속부, pair1 총/머리 겹침, buttstroke 얼굴가림, 걷기 미끄럼은 남아 있다. 생활·사교 양산 없음. 사용자 시각 승인 대기를 작업 중단 사유로 삼지 않았다.

재현: UTF-8 Python으로 `tools/build_eileen_demo.py`, 에일린 `scripts/build_resume_review.py`, `scripts/check_live_delivery.py`, `scripts/check_resume_demo.py`, `scripts/test_resume_safety.py`. `CHROMIUM_PATH`는 설치 Chrome. 회수도구는 이미 생성된 결과만 다운로드하며 생성호출 없음.
