# 에일린 제작 재개 · 큐/비용/검수 인계

2026-10-22. 작업 브랜치 `codex/art-eileen-resume`, 독립 worktree에서 작업.

## 이번 결과와 미완료

- **신규 PixelLab 그림 0장, 신규 유료 제출 0건, 신규 차감 0회.** 기존 납품의 패킹·시연·검수와 제출 안전장치를 실제 수정했다. 전투 그림 수정 완료로 보고하지 않는다.
- 기존 씻기 20장(탈의 7, 돌아서기 3, 샤워 6, 목욕 4)을 확인했다. 누락됐던 3클립 13장을 final/manifest와 독립 HTML에 반영했다. 최종 90→93클립. 원본 PNG는 한 장도 변경하지 않았다.
- 받은 GPT 원본에 PixelLab 효과 제거기를 적용하지 않도록 수정했다. 네 클립 모두 **원본 RGBA와 스트립 프레임의 바이트가 일치**한다. 이전 undress 스트립에서 제거됐던 픽셀/알파도 원본대로 보존된다.
- 샤워 00~01의 머리끈 풀기는 처음 한 번만, 이후에는 의뢰서대로 02~05를 반복한다. 그림을 새로 만들거나 기존 그림을 변형한 수정이 아니다.
- 생성 완료·회수 완료·기술 시험·사용자 시각 승인은 각각 별개다. 씻기 4클립의 `visualApproval`은 `pending`이다. 전투 그림의 알려진 결함은 남아 있다.

## 인증과 현재 계정 상태

첫 조회: 2026-10-22 19:15 한국 시간. 사용자 인증 재시도 요청 후 **19:24에 다시 조회**했다.

| 항목 | 실제 확인 |
| --- | --- |
| MCP 공개 도구 명세 | HTTP 200. 계정 인증 성공을 뜻하지 않음 |
| get_balance | MCP 서비스 응답 401: Missing Authorization header |
| list_jobs(include_recent=true) | 동일한 401 |
| search_help | 첫 조회 401 |
| 환경 상태 | 설정 revision 4, 네트워크 enforced, 등록된 secrets/runtime_variables 목록 비어 있음 |
| 현재 잔액·실행 중 작업·계정 한도 | **미확인(null)**. 과거 잔액·Tier 3/20건을 현재 값으로 사용하지 않음 |

원문은 `evidence/*auth-recheck.json`, 최초 실패는 `evidence/get_balance.json` 등이다. 실행 환경에 `PIXELLAB_API_TOKEN` 또는 `PIXELLAB_API_KEY`를 전달하면 에일린 전용 클라이언트가 Bearer 헤더로 사용한다. 값은 로그/요청 파일에 저장하지 않는다. 이 환경의 현재 주입 결과는 두 변수 모두 absent였다.

`job-ledger.json`: 저장소 각 캐릭터 spend.log에서 **고유 작업 ID 1,817개, 에일린 117개**를 취합했다. 작업 수를 과금 횟수로 취급하지 않는다. `cost=` 과거 기록은 `historical_reported_costs`에 따로 보존하며, 청구 증거가 없는 `actual_cost`는 null이다. 동시 제작의 잔액 차이를 특정 캐릭터 비용으로 배분하지 않는다. 인증 후 작업별 사용량 응답으로 보강해야 한다.

## 최신 원본 대조

| 기준 | fetch한 커밋 |
| --- | --- |
| 시스템 | `7f8fdfb0c5a6cef096d412d3d872aec6eae7de81` |
| 준비 자료 | `087dec121b9d65ad1c91fd3b1d5b1d669ba70fe4` |
| main | `317faad892a4c89f339f63b6960b751e22801bc1` |

위 3개와 Claude 에일린 브랜치 `origin/claude/project-thread-45iwer`의 clips/base/spend.log/기존 manifest가 모두 같다. `evidence/source-comparison.json`에 Git tree 해시와 파일 수를 보존했다. 최신 인계의 ‘씻기 미납품’ 목록은 현물보다 오래됐다. `inventory.json`은 파일별 SHA-256을 보존한다. 준비 브랜치 전체 병합이나 다른 캐릭터 그림 재활용은 하지 않았다.

## 프레임 검수

기존 전투·이동 9클립 63장 + 씻기 20장 = **83장**을 직접 연락표로 봤다. 각 장의 얼굴·체형·복식·손·접지·반복 상태와 RGBA 해시는 `frame-review.json`, 연락표는 `review/{combat,feet,washing}.png`다. 93클립 전체의 시각 합격을 뜻하지 않는다. 독립적인 두 번째 검수자의 승인도 아니다.

| 우선순위 | 남은 결함 / 다음 조치 |
| --- | --- |
| 1 | transition 00→01에서 손의 소총이 등에 순간 이동. 기존 holster 역재생 덧붙임으로 해결 안 됨. 소총 내리기/걸기 핵심 자세와 권총 뽑기를 분리 설계해야 함 |
| 2 | buttstroke 01~03 총·양손이 얼굴을 가림. 옛 개머리판 돌려치기로 되돌리지 않고 현재 ‘총몸 내려찍기’의 손·팔꿈치 높이 변경 필요 |
| 3 | precise 01~02, pair1 02~05의 개머리판·머리카락 겹침. 얼굴의 오른쪽 측면·소총 길이·두 손 파지를 함께 유지해야 함 |
| 4 | pushkick 01~04 지지발 2px 부유, step 02~04/06 바닥 아래 1px, limp 03~04 아래 2px. 달리기 공중 프레임과 구분하고 일괄 바닥 스냅하지 않음 |
| 보류 | undress 초기 6장/06의 색감 차이와 기준 H-side보다 가는 직립 실루엣. 씻기 원본의 기준 접지 y135와 전투 y136도 별도 검수 필요 |

`precise-01-request.draft.json`은 **아직 제출하지 않은** 단일 후보 요청이다. 현재 공개 `edit_image_pixen` 견적 **1회**를 보존했다. 자세는 유지하고 개머리판/머리카락 겹침만 수정한다. 무장 전환의 큰 자세 변경을 Pixen에 맡기는 요청이 아니다. 입력 PNG 해시·요청문을 저장했으며 실제 비용/작업 ID는 null. 인증 및 계정 큐 확인 뒤 현재 견적을 다시 알리고 한 건만 제출한다. 같은 방식 실패 시 재제출하지 않는다.

## 제출·회수 도구 변경

- `scripts/gen.py`: 한 호출에 한 클립, 동시 제출 1건. 같은 Git 공용 디렉터리의 실행 잠금. 이미 납품된 폴더의 재생성 차단. 다른 캐릭터 기반 boot 입력 금지.
- 80회 유료 자동 재시도 제거. 호출 **전** 요청 전체·요청 해시·입력 해시를 `resume/submissions/<hash>/`에 저장. 응답 유실은 미확인 상태로 남기고 동일 요청을 차단한다.
- 회수 장 수·PNG·192×144 검사가 끝나기 전 원본 승격 금지. 기존 원본을 삭제하지 않고 작업 ID별 임시 폴더에 보존한다. `--resume`은 회수만 하며 신규 제출하지 않는다.
- 현재 무료 잔액/큐 조회에 실패하면 제출하지 않는다. 계정 큐가 비어 있음을 인식하지 못해도 중단한다. 원격 다른 머신까지 잠그는 분산 잠금은 아니므로 담당별 1건과 계정 큐 조율은 총괄이 유지해야 한다. 다른 담당 작업 취소 기능은 없다.
- `scripts/pixellab_client.py`: 환경 인증, 기본 TLS/프록시 유지. 고정된 과거 CA 파일 의존을 제거했다.

## 담당별 준비 도구 인계

정확한 커밋·파일별 Git 객체·링크는 `tool-handoff.json`. 이 채팅에는 다른 채팅에 메시지를 보내는 도구가 없어 **저장소 인계 패키지만 전달**한다. 각 담당의 수신 확인을 했다고 주장하지 않는다.

- **큐라스 담당 전용**: 준비 브랜치의 `tools/recover_character_jobs.py`, `tests/character-recovery.test.py`, `docs/character-resume/kyuras-audit.md`. 기과금 `11826541-47d1-40de-9664-f05f1838bb23`(idle_shotgun), `9fe0e770-b992-4299-a4c1-90d6e591828a`(run_shotgun) 회수를 맡긴다. 이 작업에서는 조회·회수·재생성하지 않았다.
- **쟈알디 담당 전용**: `game-src/action/jyaldi-v5/resume/`의 walk/run 요청 초안과 뼈대, `docs/character-resume/jyaldi-audit.md`. 에일린 입력으로 사용하지 않는다.
- **검수·납품 담당**: `tools/build_character_delivery.py`, `tools/build_character_resume_demo.py`, `docs/character-resume/other-agents-audit.md`. 필요한 경로만 가져오고 전체 브랜치를 합치지 않는다.

## 실행·검증

저장소 루트에서:

```sh
python3 tools/build_eileen_demo.py
python3 game-src/action/eileen/scripts/test_resume_safety.py
python3 game-src/action/eileen/scripts/check_resume_demo.py
```

- 과금 안전 검사 5건 통과: 타임아웃 단발·같은 요청 차단, 불완전 회수 원본 보존, 정상 8장 회수, boot 차단, 서비스 오류 검출. 모두 가짜 API이며 유료 호출 없음.
- 브라우저 검사: PC 1280×800, 모바일 가로 844×390·세로 390×844. 모든 93클립 이미지 디코딩, 실제 키보드/터치 이동, 샤워 05→02 반복, 가로 넘침 없음, JS 오류 없음. 스크린샷 직접 확인. `review/browser-check.json`.
- HTML: `release/demo/eileen-full.html`. 기존 납품 20장 반영판이며 새 전투 그림 반영판은 아니다. 엔진·본부·스테이지·공용 atlas·통합 HTML은 변경하지 않았다.
