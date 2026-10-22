# 게슈간 제작 재개 · 총괄 대조 / 2차 검수

2026-10-22 한국 시간. 브랜치 `codex/art-geshugan-resume`.
시스템 기준 `7f8fdfb0c5a6cef096d412d3d872aec6eae7de81`, 준비 자료 기준 `087dec121b9d65ad1c91fd3b1d5b1d669ba70fe4`.
두 브랜치와 전체 원격 refs를 fetch한 독립 worktree에서 작업했다. 준비 브랜치는 병합하지 않았다.

**새 PixelLab 그림 수정은 미완료이며 사용자 시각 승인도 없다.** 아래 시연판은 기존 그림에 검수 기능·손 좌표 보정을 반영한 판이다. 새 그림 납품으로 취급하지 않는다.

## 실제 완료한 변경

- 다운 3~7장과 기상 0~1장의 몸 접지 이동량을 손 기준점에도 적용했다. 기존에는 몸만 위로 옮겨 손/소품 좌표가 어긋났다. 손은 여전히 뼈대 기반이며 실측 합격을 뜻하지 않는다.
- 최종 프레임별 `frameSources`에 실제 클립·장·이동량을 보존했다. 특히 jump는 fall 0·1을 합성한 기존 판이므로 jump 원본 1~4를 검사하면 안 된다. 합성·드롭 후에도 그림과 손 좌표가 같은 원본을 참조한다.
- 독립 HTML에 정지 장별 검수, 이전/다음 장, 원본 장 표시, 전투 시연 복귀를 넣었다. 창 전환 때 이동키가 붙는 문제와 휴대폰 조작부 가로 넘침·가로 화면 하단 잘림을 고쳤다.
- 게슈간 생성기는 명시한 한 클립만, 제출 중 1건만 허용한다. 응답 불명확/작업 ID 누락 때 자동 재제출하지 않는다. 제출 전에 요청문·입력 해시를 저장하고 전체 응답을 보존한다. 잔액 조회 오류면 제출 전에 중단한다. 로컬 잠금은 이 worktree만 보호하므로 **다른 환경과의 계정 큐 조율은 별도**다.

## 인증·비용·큐

`account-status.json` 및 `*-response.txt`가 이번 실제 조회 증거다. 공개 tools/list는 성공했으나 get_balance/list_jobs/search_help는 서비스 오류 `401 Missing Authorization header`였다(HTTP 운송 상태 200과 인증 성공을 혼동하지 않음).
사용자의 인증 완료 안내 뒤에도 잔액·큐를 재조회했으나 같은 401이었다(`*-reauth-response.txt`). 클라우드 리비전 4 및 5에서 등록된 비밀 변수·런타임 변수는 없었다.

현재 잔액, 실제 실행 중 작업 수, 계정 동시 한도는 **미확인**. 과거 계정 20칸·잔액을 현재 값으로 쓰지 않았다.
신규 유료 제출 0건, 신규 차감 0회. 기존 기록에서 작업 ID 1,817개(게슈간 72개)를 취합했다(`historical-job-ledger.json`). 이것은 계정의 현재/전체 작업 목록이 아니라 저장소에 남은 과거 ID 목록이다. 서버 usage가 없어 작업별 actual_cost는 null이다. 공유 계정의 전후 잔액 차이를 개별 작업 비용으로 배분하지 않았다.

`queue.json`: 큐라스 회수 두 작업의 소유자는 큐라스 담당이다. 이 작업에서는 조회·회수·재생성을 실행하지 않았다.
- idle_shotgun: `11826541-47d1-40de-9664-f05f1838bb23`
- run_shotgun: `9fe0e770-b992-4299-a4c1-90d6e591828a`

인증 성공 뒤: 무료 잔액·활성 작업·한도 확인 → 다른 게슈간 제출이 없는지 담당 조율 → 현재 견적 안내 → 기상 03 국소 수정 1건 → 결과 검수 순서다. 공개 현행 `edit_image_pixen` 설명은 1장 1회지만 아직 제출하지 않았다. 실패하면 같은 방식으로 반복하지 않는다.

## 담당별 준비 자료 인계

`tool-handoff.json`에 원본 고정 커밋 링크와 파일 SHA-256을 적었다.
- 큐라스: 읽기 전용 회수 도구·회수 중단/재개 시험·기존 검수 보고.
- 쟈알디: 걷기/달리기 뼈대 빌더·요청 초안·기존 검수 보고.
- 각 담당/총괄: 납품 검증 빌더·검수판 빌더/틀·기존 요원 대조·기존 큐.

인계 문서 준비와 실제 담당 수령은 구분한다. 현재 채팅 목록에서 새 캐릭터 담당을 식별하지 못했고 메시지 전송 도구도 없어 **수령 확인은 미완료**다. 타 캐릭터 파일이나 브랜치는 수정하지 않았다.

## 중복 확인

`origin/art/geshugan-bath-20261022-final` (`7b2cb8aeac261e564f8c0a7d4bb85c7af7b5bb79`)의 undress 7 / showerturn 3 / shower 6 / bath 4 원본 전부 현 기준과 blob 일치. `bathing-comparison.json`에 20장 증거를 남겼다. 이미 final에도 있으므로 발주 제외. 전투·이동 최신 수정 a6baa058도 기준에 들어 있으며 게슈간 경로에 HEAD 밖의 후속 커밋은 없었다.

## 검수 범위와 남은 결함

`sheets/page-00..12.png`의 49클립 288장을 프레임별로 열람했다. 얼굴·체형·복식·손·접지·반복 첫/끝 장을 비교했다. `frame-inventory.json`에 RGBA 해시와 현재 출처를 기록했다. 씻기 20장은 이번에는 중복 해시 대조만 했고 새 시각 합격 판정은 하지 않았다. 연계 분할 snap/mark/slam은 동일 chain3 그림이며 중복 장수로 세지 않았다. lookback은 기존 코드 합성으로 별도 그림 검수에서 제외했다.

| 검수판 | 장별 판단 |
| --- | --- |
| 00 idle/cubespin/scan/stance | 얼굴·체형·복식 큰 튐 없음. scan의 정면 전환은 기존 채택 의도. 반팔짱의 손은 허리처럼 읽히는 기존 한계. 넥타이 유지 결정 존중. |
| 01 engage/walk/step/run | 얼굴·복식 유지. walk 0→7은 보행 자세 차이가 있으며 반복은 정지판만으로 최종 접지 합격 아님. run 0~7에서 팔·다리 교대 확인, 발 고정은 이동량과 함께 추가 검수 필요. |
| 02 jump/crouch/crouchwalk/lowmark | jump의 동일 fall 장 반복 확인(새 생성 아님). crouch 1~3 턱·깃 경계 회색이 남음. 무릎 걸음은 기존 채택. lowmark 1~4 손이 바닥 방향에서 위로 이동하므로 첫 판의 턱 고정 문제는 개선됨. |
| 03 chain3/tackle/airstomp | chain3에 타인 없음. chain3 12·13, tackle 1·3, airstomp 3·4의 턱 아래 경계는 수정 대상. tackle의 삭제된 raw4가 다시 들어오지 않았음. |
| 04 airmark/designate/clench/hold | 작은 손 신호는 설계 의도. 얼굴·복식 큰 변화 없음. airmark는 공중 자세여서 지상 접지 적용 대상 아님. |
| 05 holdloop/fling/parry/parryfail | parry 최신 판에서 이전 세 팔 실루엣은 두드러지지 않음. fling 1의 머리 앞 손은 의도된 이동 경로. 손가락 실측/소품 고정은 미완료. |
| 06 tkleap/grab/grabreap/grabcrush | 낮은 염동 도약은 설계 의도. grabreap 4·5 턱 경계는 남음. 잡기는 두 손이 앞에 모이며 타인 그림 없음. |
| 07 super/chain2/support | support raw2·3 제외 확인. chain2 손 동작 작음은 설계 의도, 턱 경계 추가 국소 검수 필요. super 마지막 자세는 대기로 복귀하는 단발이라 루프 이음 합격과 구분. |
| 08 focus/tkswing/gunclench/pickup | 빈손 유지. pickup 1~3 허리·무릎 굽힘 확인, 이전 대기 자세 문제는 개선됨. 띄운 무기 연결은 손 실측을 아직 통과하지 않음. |
| 09 toss/drink/eat/bandage | drink 2~4/eat 입 근처 손 확인. bandage는 raw2~5 팔 문지르기만 있고 실제 감기는 동작 미충족. 생활 재생성은 후순위. |
| 10 hit/down/getup/talk | getup raw3 얼굴 화면 쪽 전환 남음, 국소 수정 우선. down/getup 이미지 접지 보정은 기존에 있었으나 손 좌표 누락은 이번 수정. |
| 11 tired/stepup/stepover/liesit | stepover 분리 회색 점 제거판 유지. stepup 높이 상승은 지형용, 제자리 접지 실패로 단정하지 않음. liesit은 침대 높이 기준이라 지상 누움으로 쓸 수 없음. |
| 12 turn/fall/land | turn 정면 전환은 의도. fall raw2, land raw2·3 제외 유지. land 1의 낮게 숙임에서 머리·손 경계는 추가 정밀 검수 대상. |

최종 판정: **조건부 검수·그림 수정 대기**, 생성 완료/납품 완료/사용자 승인 아님.

## 재현

```sh
python3 tools/build_geshugan_demo.py
python3 game-src/action/geshugan/resume/test_resume.py
python3 game-src/action/geshugan/resume/browser_check.py
```

단위 검사 6개는 손 좌표·합성 출처·중복 대조·불명확 유료 응답의 재제출 방지·인증 오류 중단을 확인한다. 브라우저 검사는 PC/폰 가로/세로에서 장 이동·정지·출처·포커스 해제·터치 취소·가로 넘침을 확인한다. 실계정 생성 성공을 검증한 시험은 아니다.
