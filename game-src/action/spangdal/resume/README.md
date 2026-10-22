# 스팡달 실제 제작 재개 결과 · 2026-10-22 Local
이 절이 현재 상태다. 아래의 과거 Cloud 기록(401·신규 그림 0장)은 당시 증거로만 보존한다.

- 독립 worktree `art-spangdal-resume`, 브랜치 `codex/art-spangdal-resume`. 출발 `986d160287a9b6c4c98a5434d86d12507c38f50d`.
- fetch한 시스템 `59a2a883c6aca00f8c0e1e5fc2c421a6da770528` 및 준비 브랜치 `6b8000ea3f51a9ac9cc437995c5a2edc0e77b2eb`와 원본/로그/manifest 대조. 기존 손 수정 포함 확인. 준비 브랜치 전체 병합 없음.
- Local PixelLab MCP 인증 성공. 마지막 무료 조회는 `production/balance-final.json`, `jobs-final.json`: 잔액 **13,984.30 generations**, $0, 활성 작업 **0건**. 관측 시각은 파일에 UTC로 보존. Tier 3 Pixel Architect 2x, 문서상 pending+processing 한도20. 동시 제출은 스팡달 1건씩 유지.
- 유료 **8건 완료, 실제 합계59 generations**. 작업별 서버 charged 영수증은 `production/ledger.json`, 각 revision의 `submission.json/result.json`, `spend.log`. 공유 계정 잔액 차이는 비용으로 쓰지 않았다. 무료 exact 수정은0.
- 큐라스 이미 과금된2건은 총괄/큐라스 담당 소유이며 호출하지 않았다. 총괄 채팅에 제출 ID·예상/실제 비용을 전달했다. 준비 도구 인계는 `codex/character-production-control`의 `game-src/action/character-resume/handoff-index.json`와 아래 경로표 사용.

## 실제 반영
독립 `release/demo/spangdal-full.html`에 **15클립,69개 override 슬롯**을 연결했다. 이 수는 신규 AI 생성 장수와 다르다(부분 편집·무료 픽셀 정리·원본과 같은 슬롯 포함).
- stab1 1~4: 관수 손 후보. 넓은 마스크에서 회수 손목이 잘린 후보는 제외하고 전체 프레임 inpaint 후 무료 guarded patch로 교정.
- pierce3: 새 뼈대의 X 교차 공격8장. 준비2·회수6 손끝은 후속 수정 대상.
- jump: 새 앞뒤 다리 분리 점프8장. 공중2~5, 준비0~1, 착지6~7. 사용자 시각 승인 대기.
- pipe/idle_pipe/walk_pipe/shotgun/idle_shotgun/walk_shotgun/run_shotgun: 그림의 무기를 제거한 파지 후보, 독립 데모에서 기존 무기 소품을 별도 표시. 체크박스로 빈손/무기 표시 비교 가능. 손·얼굴 보존. 제거 부위의 소매 실루엣은 추가 시각 검수 필요.
- run/passslash/carry2_run/stepup/sneak: 다리 회색·보라색 이중 윤곽 정리. 알파/발 위치 보존이며 이동 속도·발 고정 문제 전체 해결을 의미하지 않는다.
- 원본 `full/clips`는 수정하지 않았다. 수정본은 `resume/corrected`, 새 회수 원본/요청/입력 해시/영수증은 `resume/production`. 엔진·본부·스테이지·공용 atlas·통합 게임 HTML 변경 없음.

## 반려 및 남은 결함
**생성 완료는 품질 합격이나 사용자 승인과 다르다. 전체 전투·이동 품질 검수는 아직 불합격/수정 필요다.**
- execute 새8장: 높은 손 위치는 안정됐지만 검지/낮은 손 형태 결함. 전부 반영 제외하고 원본/실패 이유 보존. 같은 기준+뼈대 방식 재시도 금지.
- stab1-sequence-r1 frame4: crop 문맥 부족/마스크 경계에서 팔 잘림. 반영 제외. 전체 프레임 방식으로 전환.
- free pipe-exact-r1:1024px 한도 초과. 유료 차감 없이3열576px로 변경.
- 기존 execute/spineup/throw/toss/grabstab/super의 손, slash2 손 번갈이와 잡기 겹침은 후속 수정 필요. grabstab2의 팔 중복도 유지되는 결함이다.
- 생활·사교72클립 양산 보류. `user_visual_approval=false` 유지.

## 비용 확정표
| revision | job ID | 실제 generations |
|---|---|---:|
| hand-inpaint-r1 | 6aa5567e-0ffc-45df-a3a3-702ca373d66c | 10 |
| stab1-sequence-r1 | 4af04357-fbfe-49e9-8ebb-b10a1765e7a2 | 10 |
| stab1-recovery-r2 | 3000e1b3-fee3-478b-a0ce-00b276a8f0c3 | 10 |
| pierce3-cross-r1 | a3743d39-b041-4287-96ad-c62228b484b3 | 3 |
| shotgun-empty-r1 | aa4b5980-880c-4ee9-8171-3f47dd2d994f | 10 |
| shotgun-stocks-r1 | 1175b029-993f-4179-90f7-b362c6358ad7 | 10 |
| execute-stable-hands-r1 | c40aab31-b7a6-4d05-aeaf-907041ed603c | 3 |
| jump-split-r1 | 896b959c-f221-462b-a84f-c37c117c8377 | 3 |

## 검증과 재현
`test_resume.py`7개 통과. `check_browser.py`: PC1440×1000, 폰844×390/390×844, 이미지72개 로드, JS오류0, 수평 넘침0, 장넘김/반복 경계 통과.
`check_candidates.py`: 신규 그림 연결, 무기 토글 픽셀 변화, 원본 불변, 비용 영수증8건 완료 확인.
`build_audit.py`: 현재 렌더26클립165장, 해시/접지 bbox/개별 검수 메모. `review/candidate-demo.png`는 새 후보의 실제 독립 HTML 화면이다.

빌드는 `python tools/build_spangdal_full_demo.py`. PixelLab 재제출 없이 `resume/corrected`에서 재현된다.
`prepare_*.py/exact_*.py`는 보존된 제작 요청 작성 스크립트이며 자동 배치 발주기가 아니다. 각 revision에 submission이 없으면 미제출 초안이다. 이미 완료된 revision을 다시 제출하거나 회수 스크립트로 최신 override를 덮어쓰지 않는다.

---
# 과거 Cloud 인계 (현재 인증/제작 상태가 아님)

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
