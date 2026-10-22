# 큐라스 회수 인계 · 2026-10-22

담당 브랜치: `codex/art-kyuras-resume`. 총괄은 계정 큐·잔액·한도·실제 비용·최종 검수를 맡고, 이 담당은 큐라스의 기존 과금 결과만 먼저 회수한다. 새 유료 생성은 하지 않았다. 캐릭터별 제출 중인 생성은 1건 이하이며, 회수 뒤 신규 제작도 총괄의 현재 큐 확인·차감 견적 안내 뒤 진행한다.

## 실제 조회 결과

2026-10-22 19:15:26 한국 시각, 기존 `idle_shotgun` ID로 무료 `get_image`를 호출했다. HTTP는 200이지만 MCP 응답은 `isError: true`, 서비스 오류 **401 Missing Authorization header**다. HTTP 200을 인증 성공이나 생성 완료로 해석하지 않는다. `PIXELLAB_API_TOKEN`은 설정되지 않았다. 같은 원인으로 두 번째 작업 조회를 반복하지 않았다. 계정 전체 조회는 총괄 담당이라 여기서는 호출하지 않았다.

- `idle_shotgun`: `11826541-47d1-40de-9664-f05f1838bb23`, 기대 4장, 서버 상태 미확인.
- `run_shotgun`: `9fe0e770-b992-4299-a4c1-90d6e591828a`, 기대 8장, 서버 상태 미확인.
- 현재 원본 0장, manifest·hands 등록 없음. `final/`에 같은 이름의 파일은 있지만 `716205d1`의 옛 무기 포함 그림으로, 두 과금 작업의 회수물이 아니다.
- 개별 실제 과금액은 증거가 없어 `null`이다. 인계의 약 330회 사용·상한 600회와 과거 잔액은 현재 값이 아니다. 이번 신규 생성·차감은 0이다.
- 후속 샤워·목욕 4클립, `walk_shotgun` 8장은 이미 있다. 다시 발주하지 않는다.

조회 원문은 `probe-response.json`(원문 바이트의 base64·해시와 파싱한 응답), 판정은 `authentication-probe.json`, 원본·manifest·로그 해시와 출처 비교는 `inventory.json`에 보존했다. 기록된 입력 파일 해시는 현재 파일의 해시이며 과거 제출 시점 해시가 아니다. 과거 정확한 요청 전문과 입력 해시는 저장된 기록만으로 증명할 수 없다.

## 넘겨받은 도구와 실행

준비 브랜치 `087dec121b9d65ad1c91fd3b1d5b1d669ba70fe4`의 `tools/recover_character_jobs.py`와 회수 검사를 선택 반입해 큐라스 전용으로 만들었다. 전체 브랜치를 병합하지 않았다. `tools/recover_kyuras_jobs.py`는 두 고정 ID의 `get_image`와 작업별 REST 조회만 허용한다. 계정 전체 조회·생성·취소는 호출할 수 없다. 같은 머신의 다른 worktree도 공통 잠금을 쓴다. 별도 머신 담당은 총괄 배정으로 단일 소유권을 유지해야 한다.

환경 비밀 변수 `PIXELLAB_API_TOKEN` 또는 `PIXELLAB_API_KEY`를 지원한다. 둘 다 있으면 비어 있지 않은 `PIXELLAB_API_TOKEN`을 우선한다. 값은 프록시 대체값일 수도 있으므로 변수의 존재를 인증 성공으로 간주하지 않는다. 기존 프록시·CA 설정은 그대로 보존한다. 인증이 연결되고 총괄이 실제 API 응답으로 계정 상태를 확인한 뒤:

```sh
python3 tools/recover_kyuras_jobs.py inspect --clip idle_shotgun
python3 tools/recover_kyuras_jobs.py recover --clip idle_shotgun
python3 tools/recover_kyuras_jobs.py inspect --clip run_shotgun
python3 tools/recover_kyuras_jobs.py recover --clip run_shotgun
```

기존 `scripts/gen.py --resume`은 미등록 항목을 새로 제출하고 실패를 반복할 수 있으므로 회수에 쓰지 않는다. 회수 도구는 새 생성·취소·자동 승격을 하지 않으며 `recovered/<작업 ID>/`에 원본 PNG, 응답, 작업 ID·프레임 해시·usage를 저장한다. 이미 저장한 PNG는 receipt의 작업 ID·인덱스·해시가 맞을 때만 재사용한다. 검사:

```sh
python3 game-src/action/kyuras/resume/test_recovery.py
```

## 회수 후 검수와 후속 순서

회수된 4/8장 모두에서 얼굴·마른 체형·복식·맨손·손 좌표·접지·마지막→처음 반복 경계를 장별로 기록한다. 과거 시트와 새 프레임을 혼합하지 않는다. 서버 작업의 usage만 실제 비용으로 취합하고 공유 계정 잔액 변화로 역산하지 않는다. 정상 원본·작업 ID 증거·프레임별 검수가 확보된 뒤 큐라스 전용 빌더와 HTML에 반영한다. 생성 완료·담당 검수·사용자 시각 승인은 서로 다른 상태다.

이후 우선순위는 기본 공격 `snap1~3` → 나머지 무기 자세(`idle_pipe`, `walk_pipe`, `shotgun`)다. 공격의 수평으로 뻗는 팔이 펀치처럼 보이는 결함은 미해결이다. `scripts/krig_v4_snaps_unrun.py`의 굽힌 팔·머리 위 뒷손·앞위/뒤아래 양손 설계는 미생성 초안이며, 엄지·중지 장전/해제와 손 번갈이가 실제 2배 그림에서 보여야 한다. 문구만 바꿔 같은 수평팔을 반복 생성하지 않는다. 생활·사교 85클립은 후순위다.

새 그림을 회수하지 못했으므로 기존 HTML을 수정 결과로 다시 배포하지 않았다. 새 그림을 반영한 독립 HTML 전달과 사용자 시각 승인은 **미완료**다. 엔진·본부·스테이지·공용 atlas·통합 HTML은 변경하지 않았다.
