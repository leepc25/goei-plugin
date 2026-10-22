# 데드폴 제작 재개 · 큐/비용/검수 인계

브랜치 `codex/art-deadpole-resume`, 독립 worktree `/workspace/art-deadpole-resume`.
시스템 기준 `7f8fdfb0c5a6cef096d412d3d872aec6eae7de81`, 준비 자료 기준 `087dec121b9d65ad1c91fd3b1d5b1d669ba70fe4`.
두 브랜치를 fetch하고 데드폴 원본·spend.log·manifest가 같은지 대조했다. 준비 브랜치를 병합하지 않았다.

**새 그림 생성은 아직 미완료.** 무료 계정 조회는 최초 및 사용자 인증 재연결 뒤에도 서비스 내부 401 `Missing Authorization header`다. HTTP 200은 MCP 운반 성공일 뿐 인증 성공이 아니다. 실행 환경 revision 5는 적용됐지만 secrets와 runtime_variables가 빈 목록이고, 새 셸에도 `PIXELLAB_API_TOKEN`이 없다. 현재 잔액·실행 중 작업·동시 한도는 모두 미확인이다. 과거 17,000회·Tier 3·20슬롯을 현황으로 사용하지 않는다.

이번 새 유료 호출 0건, 새 실제 차감 0회. 생성 완료·내부 검수·사용자 시각 승인은 모두 별개이며 신규 결과의 세 상태는 아직 미충족이다. 새 그림을 반영한 HTML도 아직 없다. 기존 HTML을 새 수정 시연판으로 전달하지 않는다.

## 비용·중복·담당 인계

- `historical-jobs.json`: 모든 담당의 spend.log에서 모은 작업 ID와 근거 줄. 데드폴 110개 ID. 영수증에 없는 작업별 실제 비용은 `null`이며, 계정 공용 잔액 차이로 대신 계산하지 않았다. 로그에 ID가 없는 과거 호출은 포함하지 못한다.
- `queue.json`: 현재 계정 필드는 `null`, 승인 이력 상한 475회·약 315회 사용은 과거 문서 추정치로만 보존한다. 정확한 잔여 승인량이라고 보고하지 않는다. 담당별 제출 중 작업은 1건.
- `bath-comparison.json`: 별도 씻기 브랜치 `565ccf963441c7d7e55c2d8f4d5a3d3be74054c0`의 원본 20장·연락표·제작 원장이 현재 기준과 22개 모두 같은 Git blob이다. 회수·재생성·덮어쓰기 불필요.
- `source-inventory.json`: 현재 원본과 manifest, 기존 spend.log의 SHA-256. 비교 시점 기록이다.
- `handoff.json`: 기존 검수 도구·뼈대·회수 도구를 담당별로 나눈 고정 커밋 인계 목록. 저장소에 제공했으며 다른 담당의 수신 확인이나 원격 배타 잠금이 완료됐다고 주장하지 않는다.

큐라스 과금 작업 `11826541-47d1-40de-9664-f05f1838bb23`(idle_shotgun), `9fe0e770-b992-4299-a4c1-90d6e591828a`(run_shotgun)은 **큐라스 담당 회수 전용**이다. 이 작업에서는 해당 ID로 조회·회수·재생성하지 않았다.

담당별 준비 자료 원본:

- [공통 검수판·검수 도구](https://github.com/leepc25/goei-plugin/blob/087dec121b9d65ad1c91fd3b1d5b1d669ba70fe4/docs/character-resume/README.md)
- [쟈알디 새 걷기·달리기 뼈대](https://github.com/leepc25/goei-plugin/tree/087dec121b9d65ad1c91fd3b1d5b1d669ba70fe4/game-src/action/jyaldi-v5/resume)
- [큐라스 기과금 회수 도구](https://github.com/leepc25/goei-plugin/blob/087dec121b9d65ad1c91fd3b1d5b1d669ba70fe4/tools/recover_character_jobs.py)
- [다른 요원 장별 검수](https://github.com/leepc25/goei-plugin/blob/087dec121b9d65ad1c91fd3b1d5b1d669ba70fe4/docs/character-resume/other-agents-audit.md)

각 담당은 자기 경로만 `git restore --source=087dec121b9d65ad1c91fd3b1d5b1d669ba70fe4 -- <필요한 경로>`로 가져온다. 전체 브랜치 병합이나 다른 캐릭터 그림 복사는 하지 않는다.

## 원본 직접 검수

번호는 0부터. `review/`의 8개 확대 시트를 직접 열어 확인했다. 얼굴·체형·복식은 프레임 사이 대체로 이어지지만 아래 결함 때문에 해당 동작을 최종 합격시키지 않았다.

| 대상 | 확인한 결함·검수 한계 | 다음 방법 |
| --- | --- | --- |
| pipe 0~7 | 1은 왼쪽 끝에서 파이프가 잘림. 0·5~7은 손 앞 무기가 사라지거나 등 뒤 조각만 남음. 2~4에서 무기 방향·길이가 바뀜. 3~6 머리카락이 펴졌다 접힘 | 물체를 몸에 생성하지 않고 빈손 몸만. 손 좌표로 별도 동일 소품을 붙이는 단계는 신규 몸 회수 후 검수 |
| cq 0~3 | 0의 빈손에서 1에 총이 갑자기 나타남. 1~3 총이 얼굴 높이에 있고 위로 향함. 원본 효과도 존재 | 손을 가슴 아래로 낮춘 별도 리텐션 뼈대 4장. 수평 총구는 추후 소품 좌표에서 고정 |
| cq 8~14 | 9~12 높은 손이 얼굴을 가림. 13은 사격으로 보이고 14만 빈손처럼 보여 독립적인 손바닥 밀기가 약함 | 별도 6장 손바닥 밀기, 낮은 손과 높은 손 역할 구분. 뼈대만으로 손가락 표현 보장 불가 |
| catch 0~6 → contact 0 | 끝 자세와 contact 시작의 몸 위치·머리·팔 위치가 다름. catch 대부분이 앞 주먹 두 개로 읽힘 | contact 재사용 대신 전용 counter. catch 끝과 counter 첫 뼈대를 정확히 공유. 생성된 머리·손 연속성은 별도 검사 |
| shotgun 0~6 | 수평 총과 사격은 읽히나 다른 총기 클립과 형태·파지가 다름. 4 총구 효과 | 무기 제거 후 고정 소품 방식. 이번 첫 제출 대상에 포함하지 않음 |
| idle_shotgun 0~3 | 세로로 긴 총, 몸통 앞 양손. 작은 반복 변화 | 다른 총기 클립과 같은 무기 자산으로 통일해야 함 |
| walk_shotgun 0~7 | 총이 idle보다 작고 형태가 다름. 머리 길이·발 높이 변화 | 실제 지지발 궤적과 7→0 반복 경계 추가 검수 |
| run_shotgun 0~7 | 긴 산탄총 대신 짧은 권총 같은 물체. 머리카락 실루엣 변화가 큼 | 전용 빈손 달리기·소품. 공중 프레임까지 바닥에 강제 고정하지 않음 |

원본 시각 검수와 수정 뼈대의 수학적 연결 검사는 구분한다. 새 뼈대의 관절이 이어져도 생성된 얼굴·체형·복식·손·접지·반복 경계가 합격한 것은 아니다.

## 수정 도구·요청 준비

`scripts/production.py`가 새 경로다. 구 `gen.py` 유료 실행은 막고 비교용 함수만 남겼다. 이유: 구 경로는 무기를 프롬프트에 넣고 원본을 삭제하며, 제출 응답이 불명일 때 재시도할 수 있었다.

- 환경 변수 인증을 쓰는 데드폴 전용 전송. 다른 캐릭터의 인증 코드·그림을 수정하지 않는다.
- `view=side`, 캐릭터와 빈손만 요청. 기준 그림은 현재 데드폴 `full/base.png`만 읽는다. 과거 기준 그림 제작 경위(base2/base3/scale_base)는 보존했다. 이번에 다른 캐릭터 이미지를 참조하지 않았다.
- 요청문·기준 그림 해시·전체 요청 해시·예상 비용 저장. 기존 원본 경로가 아닌 작업별 후보 폴더로 회수한다.
- 계정 무료 조회가 성공하고 담당 간 큐를 조율한 뒤 한 건 제출. 전송 실패 시 결과 불명 상태를 남겨 자동 재제출을 막는다. 원격 작업자와의 조율은 로컬 파일 잠금만으로 대신할 수 없다.
- 실제 비용은 `/v2/background-jobs/<id>`의 `usage` 원문을 보존한다. 계정 잔액 차이는 개별 비용으로 기록하지 않는다.
- 기준 그림 관절은 기존 추정값이므로 실제 이미지와 대조한 뒤 제출한다. 생성된 손 좌표는 검수 뒤 확정하며, 요청 뼈대의 손 좌표를 완성 그림 측정치로 쓰지 않는다.

요청 초안 5건: pipe 8장, cq1 4장, cq3 6장, catch 6장, counter 5장. 공식 최신 가격표상 **각 3회**, 총 15회 견적이다. 이는 일괄 제출 지시가 아니다. 첫 pipe 1건을 회수·검수하고 다음 작업을 진행한다. 9~14장을 4회로 계산하던 구 뼈대 비용 함수를 현재 공식 기준 3회로 수정했다.

```sh
python3 game-src/action/deadpole/scripts/production.py inspect
python3 game-src/action/deadpole/scripts/production.py prepare
# 현재 잔액·한도·다른 담당 큐와 기준 그림 관절을 실제 확인한 담당만 실행:
python3 game-src/action/deadpole/scripts/production.py submit pipe_body --queue-reviewed --reference-reviewed
python3 game-src/action/deadpole/scripts/production.py recover pipe_body
python3 game-src/action/deadpole/scripts/test_resume.py
```

실제 회수 뒤 후보 장을 검수하고 별도 시연판에 반영해야 한다. 이번 검증: 인증 누락 시 네트워크/예약 금지, 유료 제출 무재시도, 현재 비용 계단, 잡기/맞쏘기 뼈대 경계 동일성, 공식 요청 스키마·18관절·좌표 범위, 기존 원본 보존 등 7개 오프라인 테스트 통과. API 실계정 생성·회수 성공 시험은 인증 문제로 아직 못 했다.
