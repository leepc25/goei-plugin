# 스팡달 제작 재개 인계 · 2026-10-22

브랜치 `codex/art-spangdal-resume`. 시스템 기준 `7f8fdfb0c5a6cef096d412d3d872aec6eae7de81`의 독립 worktree에서 작업했다. 준비 브랜치 `087dec121b9d65ad1c91fd3b1d5b1d669ba70fe4` 전체를 합치지 않았다.

**실제 신규 PixelLab 그림은 아직 0장이다.** 무료 계정 조회가 인증 누락 401로 막혔다. 사용자가 클라우드 비밀 변수를 등록한 뒤 설정 리비전 4·5·6에서 재확인했지만, 관측된 secret binding은 빈 목록이고 프로세스에도 PixelLab 변수가 없다. 마지막 무료 조회 증거는 `evidence/get_balance-20261022T103239Z.json`과 `evidence/list_jobs-20261022T103240Z.json`. 현재 잔액·활성 작업·실제 계정 동시 한도는 **미확인**이다. 과거 잔액과 기록상 20칸을 현재 값으로 사용하지 않는다. 새로운 유료 제출·차감은 0이다.

## 이번에 실제 고친 것

- 빌더는 32클립 93장의 손 좌표를 그림 교체·수직 이동과 일치시키도록 수정했다. 예: toss 2·4가 3장의 그림이면 손도 3장의 좌표를 쓴다. stance를 1px 내리면 손도 1px 내린다. land 첫 장을 fall 끝 장으로 대체하면 fall의 손을 쓴다. `frameSources`에 원본 클립·장·수직 이동량을 남긴다.
- 이는 **기존 뼈대 메타데이터 불일치 수정**이다. 생성 그림의 실제 손에 뼈대가 정확히 들어맞는다는 시각 합격이 아니다. 전후 증거: `evidence/hand-metadata-diff.json`.
- 전용 시연판에 동작 선택·장 고정·이전/다음 장·끝↔처음 이동을 추가했다. 새 그림이 없음을 화면에 표시한다. 기존 전투 조작과 손 좌표 표시를 유지한다.
- `scripts/gen.py`: 명시한 스팡달 1클립만 다룸, 동시 1건, 제출 전 요청/입력 SHA-256/시각 보존, 전송 불명확 상태 선기록, 자동 유료 재시도 금지, 원본 삭제 금지. 결과는 `resume/candidates/<clip>/<revision>/`로 회수하고 자동 승격하지 않는다. 상태·응답·프레임 해시를 남긴다.
- 개별 손 편집 19장 후에도 손가락 모양이 실패했으므로 `hand_edit.py`의 같은 방식 재실행을 차단했다. 옛 소스는 파일에 보존했다. 문구만 바꾼 재시도를 하지 않는다.

PNG 원본 465장과 final 스트립 69개의 바이트는 변경하지 않았다. 따라서 이 시연판을 **새 그림이 반영된 완성판으로 취급하지 않는다.** 사용자 시각 승인은 별도다.

## 중복·비용 관리

`source-inventory.json`: main `317faad8`, 시스템 기준, 준비 브랜치의 스팡달 tree가 모두 `4b841dc0354f6baa215e3ca6387d0a366f2ffe04`다. 최신 손 수정 `a34358fe`가 이미 포함됐다. 동일 그림 누락을 이유로 재발주하지 않는다. 목욕·샤워·탈의 납품은 기존 결과이며 생활 72클립은 보류한다.

`historical-job-ledger.json`: action 아래 13개 제작 폴더의 로그에서 **작업 ID 증거 1,355건**을 취합했다. 스팡달은 115개다. `image_id`를 작업 ID로 세지 않는다. 각 행에 원본 로그 경로·행·원문을 붙였다. 개별 서버 사용량 영수증이 없으므로 `actual_cost=null`이다. 공유 계정 잔액 차이를 개인 작업 비용으로 추정하지 않는다. 과거 약 265회/상한 530은 과거 인계 추산이며 실제 비용 확정치가 아니다.

공개 도구 계약은 현재 skeleton v3 3장 2회 / 4~14장 3회 / 15장 4회, pixen 단장 편집 1회, pro edit 10~25회다. **이것은 단가 안내이며 이번 수정 발주 견적 확정이나 사용량이 아니다.** 인증 후 조회와 구체 요청의 현재 차감 견적을 사용자에게 먼저 알리고 기존 승인 범위에서 진행한다. pro edit은 192×144 원본을 다중 프레임으로 넣을 수 없다(128px 초과는 1장 제한). 작은 손 영역의 정수 좌표 crop/원위치 복원 방식 또는 새 손 기준+뼈대 방식 중 원인을 해결하는 방식을 선택해야 한다. 확대·축소로 픽셀 격자를 바꾸지 않는다.

## 우선 수정 큐

1. 1타·3타·처형 손끝: 검지 가리키기/나란한 주먹을 관수와 X 관통으로 교정. 단장 pixen 반복은 제외. 기존 공격 기준 그림의 손 자체가 검지형이므로 입력 기준부터 교정 필요.
2. 파이프·산탄총 7클립: 캐릭터에 무기가 그려져 있다. 공용 원칙은 빈손 파지+별도 무기다. 몸·손 자세와 참조 관절을 먼저 검수하고 빈손 결과를 만든다. 엔진 무기를 중복 덧그리지 않는다.
3. run 2~4, passslash 0·5, carry2_run 2 등의 다리 윤곽; jump 공중 자세. 지지/공중 구간을 구분해 접지와 반복 경계를 검수한다.
4. 생활·사교 72클립은 전투·이동 검수 통과 뒤.

`review/frames.json`에 26클립 165장의 원본 대응·렌더 픽셀 해시·실측 bbox/아래 y·시각 검수 메모를 기록했다. `review/frames-<clip>.png`는 원본 비율 정수 2배 검수 시트다. 손가락과 무기 결함 때문에 현재 전투·이동 묶음은 **시각 불합격/수정 대기**다. 관측값만으로 얼굴·복식·손을 자동 합격시키지 않는다. 모든 프레임 사용자 승인 false다.

## 각 담당에게 넘길 준비 브랜치 자료

아래 경로는 모두 준비 브랜치 **087dec121b9d65ad1c91fd3b1d5b1d669ba70fe4**에 있다. 필요한 파일만 `git show <SHA>:<path>`로 읽거나 명시 경로를 선별한다. 전체 브랜치 병합 금지. 이 인계 패키지는 원격 브랜치로 전달하며, 개별 담당의 수신 확인은 아직 없다.

| 담당 | 넘길 자료 | 주의 |
|---|---|---|
| 큐라스 | `tools/recover_character_jobs.py`, `tests/character-recovery.test.py`, `docs/character-resume/kyuras-audit.md` | 이미 과금된 아래 두 ID 회수 전담. 우리 작업은 회수/재생성하지 않음 |
| 쟈알디 | `game-src/action/jyaldi-v5/resume/`, `docs/character-resume/jyaldi-audit.md` | walk/run 뼈대·요청 초안, 미제출. A/A2 후속 수정 대조 |
| 에일린 및 다른 요원 | `docs/character-resume/other-agents-audit.md` | 납품된 씻기 중복 금지, 전투·이동 우선 |
| 독립 검수 담당 | `tools/build_character_resume_demo.py`, `tools/character_resume_demo.html`, `tests/character-resume-browser.py` | 기존 그림 비교판. 새 그림 제작/승인으로 표시 금지 |
| 납품 검수 담당 | `tools/build_character_delivery.py`, `tests/character-delivery.test.py`, `docs/character-resume/engine-integration.md` | 공용 엔진/atlas 변경은 이 브랜치 범위 밖 |

큐라스 회수 전담 ID:
- idle_shotgun: `11826541-47d1-40de-9664-f05f1838bb23` (4장)
- run_shotgun: `9fe0e770-b992-4299-a4c1-90d6e591828a` (8장)

담당별 신규 제출은 1건. 다른 캐릭터에 동시 생성하지 않는다. 이 스팡달 도구의 로컬 잠금은 **다른 실행 환경을 잠그지 못한다**. 총괄이 원격 담당의 소유권·활성 작업을 확인하고 한 슬롯을 배정한 뒤 `--account-clear`를 사용한다. 계정이 비었는지/한도가 충분한지 자동 추정하지 않는다. 타 담당 작업 취소 금지.

## 인증 적용 뒤 실행

1. 현재 실행 환경에 `PIXELLAB_API_TOKEN` 비밀 바인딩을 적용하고 무료 `get_balance`/`list_jobs` 성공을 확인한다. 키를 로그·채팅·저장소에 기록하지 않는다.
2. 실패 원인에 맞춰 참조와 뼈대를 바꾸고 새로운 revision 요청 초안을 준비한다. 기존 rig 그대로 단순 재생성하지 않는다.
3. 현재 견적을 알리고 계정 슬롯을 조율한 뒤 한 번만 제출한다. 아래 명령은 절차 예시이며 **아직 실행한 유료 생성은 없다**.

```sh
python3 game-src/action/spangdal/scripts/gen.py CLIP --prepare --revision REV --ref PATH --refkp CLIP:FRAME
python3 game-src/action/spangdal/scripts/gen.py CLIP --revision REV --ref PATH --refkp CLIP:FRAME --account-clear
python3 game-src/action/spangdal/scripts/gen.py CLIP --revision REV --resume
```

`submission_unknown`이면 응답/계정 작업을 대조하기 전 새 revision으로 우회 재제출하지 않는다. 실패 시 원인 조사와 방법 변경을 기록한다. 새 PNG 회수 후 작업별 usage 영수증으로 실제 비용을 채운다. 생성 완료 → 내부 장별 검수 → 사용자 시각 승인을 따로 기록한다.

## 검증

```sh
python3 game-src/action/spangdal/resume/test_resume.py
python3 tools/build_spangdal_full_demo.py
python3 game-src/action/spangdal/resume/build_audit.py
python3 game-src/action/spangdal/resume/check_browser.py
```

유료 재제출 차단·회수 재개·해시 훼손 거부·손 좌표 회귀 및 독립 실행 7개 검사를 통과했다. 실제 서비스 유료 제출·회수는 인증 차단 때문에 미시험이다. PNG 불변 검사도 통과했다. PC 1440×1000·폰 가로 844×390·세로 390×844에서 70개 이미지 로드, 자바스크립트 오류 0, 수평 넘침 없음, 터치 장넘김·일시정지·반복 경계 검사를 통과했다. 브라우저 결과는 `review/browser-check.json`에서 확인한다. 실제 휴대폰 사용자 검수는 별도다.
