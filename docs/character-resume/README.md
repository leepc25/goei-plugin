# 캐릭터 제작 재개 · 2026-10-22

시스템 기준 `0a13285205b77fd6cf33b966cea246efa0d3082e`, 독립 브랜치 `codex/character-production-resume`. 사용자의 최신 재개 지시가 과거 동결보다 우선한다. **검수 도구·뼈대 설계·회수 준비까지 완료, PixelLab 회수와 신규 그림 제작은 인증 부재로 미완료**다.

## 실행판과 전달물

[독립 검수판 실행](https://rawcdn.githack.com/leepc25/goei-plugin/dd89bf03f557cdf45a34fab38a336c855466672f/release/demo/character-production-resume.html) · [HTML 소스](https://github.com/leepc25/goei-plugin/blob/dd89bf03f557cdf45a34fab38a336c855466672f/release/demo/character-production-resume.html). 수정 그림이 없는 기존 원본 검수판이다. PC·모바일 가로/세로 실행 검수는 통과했으며 실제 기기 사용자 시각 승인은 대기다.

- 단일 HTML: `release/demo/character-production-resume.html`. 최신 원본 89장 내장, 쟈알디 A/A2/가드 비교, 걷기·달리기 조작, 큐라스 기본 공격, 에일린 전투 자세, 장넘김·속도·반복 경계 검수. 네트워크 없이 열린다. 기존 그림의 결함은 남아 있다.
- 쟈알디 8장씩 새 뼈대/요청문: `game-src/action/jyaldi-v5/resume/`. **미제출**이다. 지지발 고정, 반대 팔·다리, 같은 뼈 길이, 가상 다음 0장 반복 경계 검사 포함. 가려진 참조 관절은 추정값이므로 최종 검수 대기다.
- 장별 시각 검사: [쟈알디](jyaldi-audit.md), [큐라스](kyuras-audit.md), [에일린·다른 요원](other-agents-audit.md). 생성 완료·내부 검수·사용자 시각 승인을 구분했다.
- 연결 준비 패키지: [엔진 연결 계약](engine-integration.md), `game-src/action/character-resume/delivery/manifest.json`. 기존 6클립의 비교 자료이며 신규 수정 그림/승인 자산이 아니다.
- [연결 준비 패치](engine-delivery-preparation.patch): 기준 `0a132852`에 `git apply --check` 통과. 빌더·검사·비교 패키지·뼈대/이동 계약을 추가한다. 엔진 코드에 새 그림을 연결하는 완성 패치가 아니다. 시스템 담당은 별도 브랜치에서 검토한다.
- 큐·비용 원장: `game-src/action/character-resume/queue.json`, `spend.jsonl`. 실제 새 유료 호출/차감 **0**. 기존 과금 작업의 개별 실제 비용은 아직 미확인이다.

## PixelLab 차단의 실제 증거

공식 MCP 도구 목록과 OpenAPI 조회는 성공했다. 현재 skeleton v3 8장당 **3회**, 걷기+달리기 **6회**를 사용자에게 사전 고지했다. `get_balance`, `list_jobs`, `get_image` 두 건과 `search_help`는 HTTP 200 안의 MCP 오류 **401 Missing Authorization header**를 반환했다. HTTP 성공을 작업 성공으로 취급하지 않았다. 응답은 `evidence/`에 보존했다.

현재 잔액·동시 실행 한도·실행 중 작업은 알 수 없다. 과거 잔액을 현재 값으로 쓰지 않았다. 다른 세션 작업 취소 0회. 연결 도구와 플러그인 디렉터리 PixelLab 검색도 결과가 없었다. 다른 생성기로 대체하지 않았다.

| 회수 대상 | 작업 ID | 현 상태 |
|---|---|---|
| idle_shotgun, 4장 | `11826541-47d1-40de-9664-f05f1838bb23` | 제출 기록 있음, 최신 원본 없음, 서버 조회 인증 차단 |
| run_shotgun, 8장 | `9fe0e770-b992-4299-a4c1-90d6e591828a` | 제출 기록 있음, 최신 원본 없음, 서버 조회 인증 차단 |

같은 이름의 final PNG는 과거 빌드 잔존물이다. 최신 manifest/hands에서 빠진 무기 5클립은 패키지에서 차단했다. 오래된 `gen.py --resume`은 일부 이름에서 새 생성으로 넘어갈 수 있으므로 회수에 사용하지 않는다.

## 연결 뒤 이어갈 순서

환경 비밀 변수 `PIXELLAB_API_TOKEN`을 등록한다. 키는 채팅·저장소·명령 인수에 남기지 않는다.

```bash
python3 tools/recover_character_jobs.py inspect
python3 tools/recover_character_jobs.py recover
```

회수 도구는 조회만 허용한다. 생성·취소 기능이 없으며 두 기존 ID만 취급한다. 프레임별 응답·원본 PNG·작업 ID·해시·서버 usage를 `game-src/action/kyuras/recovered/<job-id>/`에 보존한다. 중단 후 검증된 프레임은 다시 받지 않는다. PNG/증거 불일치 시 기존 파일을 덮지 않고 중단한다. 회수 원본은 자동으로 clips/final/엔진에 올리지 않는다. 실제 서비스 인증 후 회수는 아직 검증하지 못했다.

1. 회수 4+8장의 얼굴·체형·복식·무기 없는 파지·접지·반복 경계를 확인한다. 작업이 실패/만료됐어도 재생성하지 말고 상태·비용을 기록한다.
2. 쟈알디 reference-overlay의 가려진 관절과 걷기 8장 뼈대를 검수한다. 현재 가격·계정 여유를 재확인하고 승인 범위의 걷기 **한 건만** 제출한다. 먼저 요청/참조 해시를 큐에 예약하고 응답 작업 ID를 즉시 기록한다. 전송 결과가 불명확하면 재제출하지 않고 작업 목록에서 찾는다.
3. 원본/요청문/작업 ID/서버 usage를 보존하고 걷기 8장을 검수한 뒤 달리기를 진행한다. 실패 시 문구만 바꿔 재발주하지 않는다.
4. 큐라스 손가락 튕기기·무기 자세, 에일린 전환/얼굴 가림/접지 순으로 처리한다. 생활·사교 양산은 뒤로 둔다.
5. 수정 그림을 시연판에 넣고 PC·모바일 독립 시각 검수 후 전달한다. 현재 기술 검사를 새 그림 합격으로 쓰지 않는다.

## 브랜치·중복 대조

원격 전체 refs를 확보했다. 쟈알디 최신 걷기/달리기와 큐라스 Claude `3bfb4554`는 시스템 기준에 이미 들어 있다. 데드폴 별도 씻기 브랜치의 원본 20장+연락표+원장은 현재 파일과 Git blob이 같다. ancestry가 다르다는 이유로 다시 합치거나 만들지 않았다. 쟈알디 grabknee·탈의/샤워, 큐라스 walk_shotgun, 에일린·고르고디오 납품된 씻기도 중복 큐에서 제외했다.

## 재현 검사

```bash
python3 tests/character-recovery.test.py
python3 tests/character-delivery.test.py
python3 tools/build_character_delivery.py --check
python3 game-src/action/jyaldi-v5/resume/build_drafts.py
python3 tools/build_character_resume_demo.py
python3 tests/character-resume-browser.py
```

Python Pillow·Playwright·jsonschema와 Chromium을 사용한다. 회수 검사 5개는 오프라인 실패/재개/중복 방지 검사이며 실계정 회수 성공을 뜻하지 않는다. 납품 검사 10개는 구형 자산 유입·원본/메타 불일치를 거부한다. 브라우저 결과/스크린샷은 `review/character-resume/`에 있다. 엔진·본부·스테이지·통합 atlas·main/공용 통합 브랜치는 수정하지 않았다.
