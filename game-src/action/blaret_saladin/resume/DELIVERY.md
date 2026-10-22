# 블라렛·살라딘 제작 재개 납품 — 2026-10-22

브랜치: `codex/art-blaret-saladin-resume`. 독립 HTML: `release/demo/blaret-saladin-resume.html`.
생성 완료와 내부 검수, 사용자 시각 승인은 별개다. 현재 사용자 승인 0건.

## 결과

| 클립 | 결과 | 내부 판정 |
|---|---|---|
| 블라렛 guns_idle | 두 총·손 복구, 보호 영역 변화0, 0→1→2→1 반복 | 통과; 4칸/고유3장 |
| 블라렛 stake_finish | 쓰러진 타인 혼입 제거, 준비 1–3의 얼굴 일부 가림 잔존 | 보완 |
| 블라렛 super_ready | 팔을 벌려 얼굴 가림 수정 | 통과 |
| 살라딘 walk | 신규8장, 부츠 실측에 따른 1px 정렬과 주기48px | 통과 |
| 살라딘 run | 실패 두 구도 보존, 입력/낮은 자세 변경으로 얼굴 복구, 본인 소총 무료 복원 | 접지·반복 보완 |
| 살라딘 slash1 | 신규6장 내려베기, 1–2 얼굴/4–5 소총 가림 | 보완 |

표시6클립42칸, 고유41장. 기존 이름을 수정한 블라렛3클립과 신규 살라딘3클립이다.
유료 원본58프레임과 별도 inpaint sheet, 무료 보정 원본·결과 모두 보존.
전체 제작표 완료는 아니다. 미제작은 블라렛14개/살라딘41개이며 `remaining-work.json` 참조.
기존 살라딘 armed_idle은 무장 준비 가독성 불합격으로 후속 전투 수정 대상이다.

## 비용·큐

계정 조회: 2026-10-22 21:21 KST, 잔액13,958.30회, credit $0, 대기/실행0.
한도: 대기+실행20건, 최소 제출 간격2초. 이번 담당의 제출 중 유료 작업은 항상 최대1건.
다른 담당과 공유하는 잔액 차이로 이번 비용을 추정하지 않았다.
완료 영수증9건 실제34회; 무료 정밀편집2건 추가 차감0.
아래 ID별 비용은 `manifest.json`의 ledger와 각 `result.json`의 charged를 대조했다.

| 작업 | ID | 실제 차감 |
|---|---|---:|
| 총 대기 | f06a14de-204f-47b2-badd-dfd49796f148 | 3 |
| 말뚝 | 76884626-42e9-4626-980a-37663c8aac8f | 3 |
| 필살 준비 | 429ad77b-ed3b-4337-9524-075adf0a262c | 3 |
| 총 부분 수정 sheet | 6bce13df-7d64-47e5-ba79-650cdea00aa4 | 10 |
| 걷기 | 5d78c846-5658-40d0-b3a2-31c119818707 | 3 |
| 달리기 r1 불합격 | 4bf8106e-b076-4288-8a2d-913f41543755 | 3 |
| 첫 베기 | 74a230a4-772b-4f9e-b9fe-822807b18f80 | 3 |
| 달리기 r2 불합격 | 32193e13-5db2-47a6-9915-6724df241eee | 3 |
| 달리기 r3 | d5071dc4-6245-442f-a2f8-5fef10159f0c | 3 |

무료 작업: 총 정밀복원4805abeb-cc0b-4b96-affa-6f8f1c595317,
소총 정밀복원78721d2f-835f-4446-8969-de02180ed0ae.
과거171회는 인계의 보고값이며 이번 완료 비용이나 현재 잔액에 합쳐 확정하지 않았다.

## 재현·검증

저장소 루트에서 실행:

```text
python game-src/action/blaret_saladin/scripts/collect_run_repair.py
python game-src/action/blaret_saladin/scripts/build_resume_review.py
python -m unittest discover -s game-src/action/blaret_saladin/scripts -p test_resume.py
node game-src/action/blaret_saladin/scripts/check_resume_browser.cjs
```

Python Pillow/numpy, Node playwright 및 Edge 필요. 위 명령은 유료 제출하지 않는다.
완료 작업 회수는 `resume_collect.py`, 부분 수정 회수는 `collect_masked_repair.py`.
`resume_prepare.py`는 요청 준비만 하며 receipt가 있으면 같은 작업 재준비를 거부한다.

10개 검증 통과: 완료 ID/비용/요청 불일치 거부, 원본 해시 보존, 마스크 밖 픽셀 보호,
서버 정밀보정 PNG와 지시 일치, 9개 고유 ID/34회 원장, 승인 상태 분리.
Edge PC1280×900·모바일 가로844×390·세로390×844에서 각336개 그림 경계 검사,
프레임 넘김·이동/공격 버튼·반복 root 이동 확인. JS 오류/가로 넘침0.
실제 휴대전화 시험은 아니며 뷰포트 에뮬레이션이다.
가로 화면 단독 보기에서 팔/칼 끝 잘림을 발견해 높이에 따른 배율을 수정한 뒤 재검증했다.
이 자동 검증은 캐릭터 시각 승인을 대신하지 않는다.

## 범위와 후속

최신 system·preparation·claude 원본의 blob 비교는 `baseline-comparison.json`.
선택적으로 인계한 준비 도구/hash/담당은 `preparation-handoff.json`.
준비 브랜치 전체 병합 없음. 변경은 담당 폴더/전용 도구/독립 HTML에 한정.
로제몬·큐라스 생성/회수는 해당 담당에게 넘겼으며 이번 브랜치에서 제출하지 않았다.
공용 atlas, 엔진, 본부, 스테이지, 통합 HTML 변경 없음.

추가 양산보다 조건부3클립과 기존 armed_idle의 결함부터 처리한다.
자동 재시도/동시 다중 제출은 금지. 다음 유료 작업 전 최신 큐·잔액과 중앙 원장을 다시 확인한다.
