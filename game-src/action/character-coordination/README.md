# 캐릭터 제작 총괄 인계 · 2026-10-22

담당: 큐·비용·중복 관리와 최종 검수. 독립 브랜치 `codex/character-production-coordination`.
새 생성 0건, 새 차감 0. **실제 PixelLab 제작 재개는 인증 누락으로 차단**되어 있다. 기존 그림 검수를 새 그림 납품으로 취급하지 않는다.

## 인증과 계정 상태

이번 실행에서 MCP `tools/list`는 성공했지만 `get_balance`는 HTTP 200 안의 `isError: true`, `401 Missing Authorization header`를 반환했다. `evidence/account-check.json`에 보존했다. 환경의 `PIXELLAB_API_TOKEN`/`PIXELLAB_API_KEY` 존재 여부는 둘 다 false였고 환경 상태 도구의 secrets도 비어 있었다.

현재 잔액·실행 작업·계정 동시 한도는 **미확인(null)**. 인계에 있는 Tier 3/20개/17,000회는 과거 정보이며 현재 운영값으로 쓰지 않는다. 인증 연결 후 `get_balance`, `list_jobs(include_recent=true)`, 무료 `search_help`의 계정 한도 안내를 확인한다. 공개 요금과 실제 계정 차감을 구분한다. 인증이 없는 현재는 생성·취소·큐라스 회수 모두 실행하지 않았다.

## 담당과 큐 운영

- 큐라스 과금 2건의 회수 책임은 **큐라스 담당**이다. `queue.json`의 두 기존 ID만 조회·회수한다. 재생성하지 않는다. 담당 채팅 ID/수신 확인은 아직 없으며 메시지 발송 도구도 제공되지 않아 **원격 인계 패키지 게시 단계**다. 수신 완료라고 주장하지 않는다.
- 블라렛·살라딘 제작 소유자는 `codex/art-blaret-saladin-resume` 담당이다. `game-src/action/blaret_saladin/`와 공유 빌더는 그 담당만 수정한다. 총괄은 원본을 읽고 별도 폴더에 검수 결과만 썼다.
- 다른 캐릭터 제작은 해당 담당이 한다. 총괄이 같은 캐릭터를 동시에 생성하지 않는다. 쟈알디·에일린 등 수신자 채팅/브랜치는 미확인이므로 임의로 만들지 않았다.
- 담당당 제출 중 생성은 1건. 계정 한도가 확인되기 전 신규 제출 예약을 허용하지 않는다. **이 파일은 서버 잠금이 아니다.** 독립 환경에서는 로컬 flock이 중복을 막지 못하므로 제출 직전 총괄의 단일 큐에 캐릭터·클립·담당·입력/요청 해시·현재 견적을 기록하고 담당의 수신 확인까지 맞춘다.
- 전송 결과가 불명확하면 재제출하지 말고 계정 작업 목록과 요청 증거를 대조한다. 다른 세션의 작업은 취소하지 않는다.
- 완료 원본, 실패 응답, 작업 ID, 실제 usage를 보존한다. 추정 비용으로 actual_cost를 채우지 않는다. 계정 잔액 차이는 다른 담당 호출이 섞일 수 있으므로 개별 작업 비용으로 단정하지 않는다.
- 전투·이동 결함 → 원본 장별 검수 → 독립 HTML → 사용자 시각 승인 순서다. 생활·사교 양산은 뒤로 둔다.

## 준비 자료 선택 인계

원본 준비 커밋: `087dec121b9d65ad1c91fd3b1d5b1d669ba70fe4`.
아래 패치는 필요한 경로만 묶었다. 전체 브랜치 merge/cherry-pick을 하지 않는다. 적용 전에 담당 worktree에서 `git apply --check <패치>`를 실행한다. 기존 파일이 있으면 덮어쓰지 말고 비교한다.

| 수신 담당 | 선택 패치 | 내용 |
|---|---|---|
| 큐라스 | `handoffs/kyuras-recovery.patch` | 생성·취소 기능 없는 회수 도구, 오프라인 검사, 기존 큐라스 검수 기록 |
| 쟈알디 | `handoffs/jyaldi-skeleton.patch` | 걷기·달리기 뼈대/요청 초안/입력 참조/검증기, A/A2 후속 검수 기록. 제출·승인 자산 아님 |
| 총괄/각 담당 참고 | `handoffs/review-tools.patch` | 기존 검수판 빌더·템플릿·브라우저 검사와 다른 요원 감사 기록. 캐릭터별 경로/출력을 전용판으로 바꿔 사용 |

검수 빌더는 쟈알디·큐라스·에일린을 고정 참조한다. 블라렛·살라딘 담당은 기존 전용 `tools/build_blaret_saladin_demo.py`를 사용한다. 다른 캐릭터 그림을 가져와 자기 동작으로 쓰지 않는다. 통합 엔진/atlas 준비 패치는 이번 인계에 포함하지 않았다.

`handoffs/manifest.json`에 각 패치의 원본 커밋·경로·SHA-256을 기록했다. 실제 수신 확인과 적용 결과는 담당에게 받아야 한다.

## 대조와 비용 원장

`source-inventory.json`: fetch한 세 브랜치의 spend.log·manifest 78개 출처/해시.
`job-ledger.json`: 명시적 `job_id`/`background_job_id` 1,329개. 이미지 ID는 작업 ID로 집계하지 않는다. ID가 빠진 기록은 포함되지 않으므로 계정 전체 작업 수가 아니다.
`historical-cost-claims.json`: 비용·차감·usage 관련 원문 328줄. 중복 출처·견적·다른 생성기 기록도 있으므로 합산하지 않는다. 실제 비용 검증 전 단계다.
`review-inputs.json`: 이번 시각 검수 원본 39장의 해시.

재수집: 저장소 루트에서 `python3 game-src/action/character-coordination/collect.py`.
최신 시스템 `7f8fdfb0c5a6cef096d412d3d872aec6eae7de81`과 Claude `067f62a148788799373d304704bcf13ee8208484`의 블라렛·살라딘 제작 폴더·빌더·개별 인계 문서는 차이가 없다.

## 다음 실행

1. 비밀 변수 `PIXELLAB_API_TOKEN` 또는 인증된 MCP를 연결하고 계정 무료 조회부터 성공시킨다. 토큰은 채팅/저장소/명령 인수에 남기지 않는다.
2. 큐라스 담당에게 선택 패치와 두 ID를 전달하고 수신 확인을 받는다. 총괄은 회수에 중복 착수하지 않는다.
3. 블라렛·살라딘 담당은 `review.md`의 결함과 생성기 자동 재시도/동시 8건 설정을 먼저 수정한다. 큰 자세 변경은 수정된 뼈대와 첫 장 관절을 대조한다.
4. 호출별 현재 차감 견적을 고지하고 기존 승인 범위에서 1건 제출한다. 결과 원본·요청 해시·작업 ID·실제 비용을 총괄 큐에 취합한다.
5. 신규 그림이 실제 반영된 전용 HTML을 PC·모바일로 검수하고 전달한다. 이 패키지에는 신규 그림이나 신규 시연판이 없다.

## 인증 재확인 · 2026-10-22 19:24 KST

사용자의 인증 완료 알림 뒤 실제 `get_balance`를 다시 호출했으나 `401 Missing Authorization header`였다. 현재 환경 spec/observed revision 4, secrets 빈 목록, PIXELLAB_API_KEY와 PIXELLAB_API_TOKEN 모두 미전달. 네트워크는 enforced. PixelLab 플러그인 검색도 결과 없음. 증거: `evidence/auth-recheck-20261022T102423Z.json`. 설정 화면의 인증 정보가 이 실행 환경에 적용됐는지 확인이 필요하다. 유료 제출·회수 0건.

새 담당 브랜치 확인: 큐라스 `codex/art-kyuras-resume` (`ed5a83e2`), 쟈알디 `codex/art-jyaldi-resume` (`b00f414a`). 담당 작업에는 중복 착수하지 않았다. 브랜치 존재 확인은 이 인계 패키지의 수신 확인을 뜻하지 않는다.
