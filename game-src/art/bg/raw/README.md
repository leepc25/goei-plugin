# 게임 배경 제작 원본

- 요청서: `docs/GPT요청_게임배경.md` (2026-10-21).
- 총 75 PNG: 벽 50, 바닥 10, 원경 5, 물건 시트 10.
- 내장 image_gen으로 개별 생성. PixelLab 미사용. 도트화 전 원본이며 게임 HTML에는 아직 반영하지 않음.
- 벽/가로 원경/물건: 1536×1024. 바닥: 1024×1024. `service_far_tall`: 1024×1536.
- 물건 시트는 실제 PNG alpha를 포함함. 2026-10-22 사용자 정정 이후 시트는 정면 평행 구도, 얇게 보이는 윗면, 칸별 크기 우선. 이전 본부 물건 중 사무실·정비실·탕비실 3장은 최초 요청 기준 유지.
- 2026-10-22 검수 재작업: `hq_jaemtri/hq_jaemtri_objects.png`를 같은 9개 물건의 정면 구도로 새로 생성해 교체. 1536×1024 RGBA, 3×3 배치, 큰 형태·굵은 윤곽선·평면 채색. 책상·상자·냉장고·프린터 받침대의 비스듬한 시점을 수정함. 생성 요청문은 `hq_jaemtri/redraw-20261022.json`. 도트화 및 게임 통합은 후속 작업이며 사용자 최종 시각 승인을 뜻하지 않음.
- 엘리베이터 홀/로비/추격 물건 시트는 정면 구도 및 구성 누락을 수정해 교체함.
- 도트화, 장소별 팔레트, 이음새/원근 보정, 물건 분리와 기준점, 게임 통합은 요청서에 따라 Claude 후속 작업. 타일 경계의 픽셀 일치나 게임 통합 완료를 뜻하지 않음.
- 생성 규격/프롬프트: `production-manifest.json`. 파일 크기/해시/alpha 검사: `validation.json`.

## 파일 목록

- `hq_office/hq_office_wall_1.png`
- `hq_office/hq_office_wall_2.png`
- `hq_office/hq_office_wall_3.png`
- `hq_office/hq_office_wall_4.png`
- `hq_office/hq_office_floor.png`
- `hq_office/hq_office_far.png`
- `hq_office/hq_office_objects.png`
- `hq_jaemtri/hq_jaemtri_wall_1.png`
- `hq_jaemtri/hq_jaemtri_wall_2.png`
- `hq_jaemtri/hq_jaemtri_wall_3.png`
- `hq_jaemtri/hq_jaemtri_wall_4.png`
- `hq_jaemtri/hq_jaemtri_objects.png`
- `hq_workshop/hq_workshop_wall_1.png`
- `hq_workshop/hq_workshop_wall_2.png`
- `hq_workshop/hq_workshop_wall_3.png`
- `hq_workshop/hq_workshop_wall_4.png`
- `hq_workshop/hq_workshop_floor.png`
- `hq_workshop/hq_workshop_objects.png`
- `hq_pantry/hq_pantry_wall_1.png`
- `hq_pantry/hq_pantry_wall_2.png`
- `hq_pantry/hq_pantry_wall_3.png`
- `hq_pantry/hq_pantry_wall_4.png`
- `hq_pantry/hq_pantry_floor.png`
- `hq_pantry/hq_pantry_objects.png`
- `el_hall/el_hall_wall_1.png`
- `el_hall/el_hall_wall_2.png`
- `el_hall/el_hall_wall_3.png`
- `el_hall/el_hall_wall_4.png`
- `el_hall/el_hall_floor.png`
- `el_hall/el_hall_objects.png`
- `el_car/el_car_wall_1.png`
- `el_car/el_car_wall_2.png`
- `el_car/el_car_wall_3.png`
- `el_car/el_car_wall_4.png`
- `el_car/el_car_floor.png`
- `lobby/lobby_wall_1.png`
- `lobby/lobby_wall_2.png`
- `lobby/lobby_wall_3.png`
- `lobby/lobby_wall_4.png`
- `lobby/lobby_floor.png`
- `lobby/lobby_far.png`
- `lobby/lobby_objects.png`
- `chase/chase_wall_1.png`
- `chase/chase_wall_2.png`
- `chase/chase_wall_3.png`
- `chase/chase_wall_4.png`
- `chase/chase_floor.png`
- `chase/chase_objects.png`
- `test/test_wall_1.png`
- `test/test_wall_2.png`
- `test/test_wall_3.png`
- `test/test_wall_4.png`
- `test/test_floor.png`
- `test/test_objects.png`
- `apt/apt_wall_1.png`
- `apt/apt_wall_2.png`
- `apt/apt_wall_3.png`
- `apt/apt_wall_4.png`
- `apt/apt_floor.png`
- `apt/apt_far.png`
- `apt/apt_objects.png`
- `service/service_wall_1.png`
- `service/service_wall_2.png`
- `service/service_wall_3.png`
- `service/service_wall_4.png`
- `service/service_floor.png`
- `service/service_far.png`
- `service/service_far_tall.png`
- `service/service_objects.png`
- `guardian/guardian_guard_wall.png`
- `guardian/guardian_guard_wall_2.png`
- `guardian/guardian_legs_wall.png`
- `guardian/guardian_legs_wall_2.png`
- `guardian/guardian_405_wall.png`
- `guardian/guardian_405_wall_2.png`


## 본부 배경 추가 · 2026-10-22 · 1층 로비

`docs/GPT요청_본부배경.md` 목록 기준 신규 원본 3장. 벽 1536×1024, 물건 모음 1536×1024 RGBA. 기존 `lobby/lobby_wall_1.png`, `lobby/lobby_floor.png` 재사용. 도트화·게임 반영은 후속 통합 작업.

- `hq_lobby/hq_lobby_wall_1.png`
- `hq_lobby/hq_lobby_wall_2.png`
- `hq_lobby/hq_lobby_objects.png`

## 본부 배경 추가 · 2026-10-22 · 3층 사무실

요청서 추가분 3장, 기존 사무실 원본과 함께 사용. 원본 제공이며 도트화·게임 반영은 후속 통합 작업.

- `hq_office/hq_office_wall_5.png`
- `hq_office/hq_office_wall_6.png`
- `hq_office/hq_office_objects_2.png`


## 본부 배경 추가 · 2026-10-22 · hq_street

요청서 신규 원본 7장. 벽·원경·물건 1536×1024, 바닥 1024×1024. 도트화·게임 반영은 후속 통합 작업.

- `hq_street/hq_street_wall_1.png`
- `hq_street/hq_street_wall_2.png`
- `hq_street/hq_street_wall_3.png`
- `hq_street/hq_street_wall_4.png`
- `hq_street/hq_street_floor.png`
- `hq_street/hq_street_far.png`
- `hq_street/hq_street_objects.png`



## 본부 배경 추가 · 2026-10-22 · hq_corridor

요청서 신규 원본 5장. 벽·원경·물건 1536×1024, 바닥 1024×1024. 도트화·게임 반영은 후속 통합 작업.

- `hq_corridor/hq_corridor_wall_1.png`
- `hq_corridor/hq_corridor_wall_2.png`
- `hq_corridor/hq_corridor_wall_3.png`
- `hq_corridor/hq_corridor_wall_4.png`
- `hq_corridor/hq_corridor_floor.png`



## 본부 배경 추가 · 2026-10-22 · hq_clinic

요청서 신규 원본 6장. 벽·원경·물건 1536×1024, 바닥 1024×1024. 도트화·게임 반영은 후속 통합 작업.

- `hq_clinic/hq_clinic_wall_1.png`
- `hq_clinic/hq_clinic_wall_2.png`
- `hq_clinic/hq_clinic_wall_3.png`
- `hq_clinic/hq_clinic_wall_4.png`
- `hq_clinic/hq_clinic_floor.png`
- `hq_clinic/hq_clinic_objects.png`



## 본부 배경 추가 · 2026-10-22 · hq_interview

요청서 신규 원본 3장. 벽·원경·물건 1536×1024, 바닥 1024×1024. 도트화·게임 반영은 후속 통합 작업.

- `hq_interview/hq_interview_wall_1.png`
- `hq_interview/hq_interview_wall_2.png`
- `hq_interview/hq_interview_objects.png`



## 본부 배경 추가 · 2026-10-22 · hq_chief

요청서 신규 원본 3장. 벽·원경·물건 1536×1024, 바닥 1024×1024. 도트화·게임 반영은 후속 통합 작업.

- `hq_chief/hq_chief_wall_1.png`
- `hq_chief/hq_chief_wall_2.png`
- `hq_chief/hq_chief_objects.png`



## 본부 배경 추가 · 2026-10-22 · hq_supply

요청서 신규 원본 3장. 벽·원경·물건 1536×1024, 바닥 1024×1024. 도트화·게임 반영은 후속 통합 작업.

- `hq_supply/hq_supply_wall_1.png`
- `hq_supply/hq_supply_wall_2.png`
- `hq_supply/hq_supply_objects.png`



## 본부 배경 추가 · 2026-10-22 · hq_training

요청서 신규 원본 6장. 벽·원경·물건 1536×1024, 바닥 1024×1024. 도트화·게임 반영은 후속 통합 작업.

- `hq_training/hq_training_wall_1.png`
- `hq_training/hq_training_wall_2.png`
- `hq_training/hq_training_wall_3.png`
- `hq_training/hq_training_wall_4.png`
- `hq_training/hq_training_floor.png`
- `hq_training/hq_training_objects.png`



## 본부 배경 추가 · 2026-10-22 · hq_containment

요청서 신규 원본 7장. 벽·원경·물건 1536×1024, 바닥 1024×1024. 도트화·게임 반영은 후속 통합 작업.

- `hq_containment/hq_containment_wall_1.png`
- `hq_containment/hq_containment_wall_2.png`
- `hq_containment/hq_containment_wall_3.png`
- `hq_containment/hq_containment_wall_4.png`
- `hq_containment/hq_containment_wall_5.png`
- `hq_containment/hq_containment_floor.png`
- `hq_containment/hq_containment_objects.png`



## 본부 배경 추가 · 2026-10-22 · hq_appraisal

요청서 신규 원본 3장. 벽·원경·물건 1536×1024, 바닥 1024×1024. 도트화·게임 반영은 후속 통합 작업.

- `hq_appraisal/hq_appraisal_wall_1.png`
- `hq_appraisal/hq_appraisal_wall_2.png`
- `hq_appraisal/hq_appraisal_objects.png`



## 본부 배경 추가 · 2026-10-22 · hq_lab

요청서 신규 원본 3장. 벽·원경·물건 1536×1024, 바닥 1024×1024. 도트화·게임 반영은 후속 통합 작업.

- `hq_lab/hq_lab_wall_1.png`
- `hq_lab/hq_lab_wall_2.png`
- `hq_lab/hq_lab_objects.png`



## 본부 배경 추가 · 2026-10-22 · hq_tooth

요청서 신규 원본 3장. 벽·원경·물건 1536×1024, 바닥 1024×1024. 도트화·게임 반영은 후속 통합 작업.

- `hq_tooth/hq_tooth_wall_1.png`
- `hq_tooth/hq_tooth_wall_2.png`
- `hq_tooth/hq_tooth_objects.png`



## 본부 배경 추가 · 2026-10-22 · hq_pasta

요청서 원본 (main 기존 파일 포함) 4장. 벽·원경·물건 1536×1024, 바닥 1024×1024. 도트화·게임 반영은 후속 통합 작업.

- `hq_pasta/hq_pasta_wall_1.png`
- `hq_pasta/hq_pasta_wall_2.png`
- `hq_pasta/hq_pasta_floor.png`
- `hq_pasta/hq_pasta_objects.png`


## 본부 배경 역순 작업 기록 · 2026-10-22

- 요청서에 실제 열거된 59개 파일 모두 존재하며 크기와 물건 시트 alpha를 확인함(요약의 53장과 차이).
- 매 생성 전 main을 새로 받아 `hq_pasta_objects`, `hq_pasta_floor`, `hq_pasta_wall_2` 순으로 각 한 장씩 별도 커밋. 나머지 56개는 main의 기존·동시 추가 파일을 유지함.
- `hq_pasta_wall_1`은 생성 중 다른 작업이 먼저 추가하여 해당 main 파일을 유지함.
- 내장 image_gen 사용. 전체 생성 요청문·커밋·파일 검사 기록: [hq-reverse-20261022-production.json](hq-reverse-20261022-production.json).

## 층별 추가 원본 (2026-10-22)

내장 image_gen으로 순서대로 제작. 각 이미지 옆 `.production.json`에 요청문·규격·해시를 기록. 도트화·게임 반영은 별도.

- `silent/silent_wall_1.png`
- `silent/silent_wall_2.png`
- `silent/silent_wall_3.png`
- `silent/silent_wall_4.png`
- `silent/silent_floor.png`
- `silent/silent_objects.png`
- `dark/dark_wall_1.png`
- `dark/dark_wall_2.png`
- `dark/dark_wall_3.png`
- `dark/dark_wall_4.png`
- `dark/dark_floor.png`
- `dark/dark_objects.png`
- `puzzle/puzzle_wall_1.png`
- `puzzle/puzzle_wall_2.png`
- `puzzle/puzzle_wall_3.png`
- `puzzle/puzzle_wall_4.png`


## 층별 배경 역순 추가 · 2026-10-22

요청서 28개 경로 모두 확인. 이번 역순 작업에서 12장을 내장 image_gen으로 신규 생성해 한 장마다 커밋·push했고, 최신 main에 존재한 16장은 건너뛰었다. 생성·확인 순서는 빈집 2→1, 붉은 벽 2→1, 심층 물건→바닥→벽 4→3→2→1, 퍼즐 물건→바닥→벽 4→3→2→1, 어둠 물건→바닥→벽 4→3→2→1, 침묵 물건→바닥→벽 4→3→2→1이다.

| 신규 원본 | 크기 | 개별 커밋 |
|---|---|---|
| [apt_vacant/apt_vacant_wall_2.png](apt_vacant/apt_vacant_wall_2.png) | 1536×1024 | `0a89c44` |
| [apt_vacant/apt_vacant_wall_1.png](apt_vacant/apt_vacant_wall_1.png) | 1536×1024 | `321e35e` |
| [apt_red/apt_red_wall_2.png](apt_red/apt_red_wall_2.png) | 1536×1024 | `61e1f8d` |
| [apt_red/apt_red_wall_1.png](apt_red/apt_red_wall_1.png) | 1536×1024 | `2bc6509` |
| [deep/deep_objects.png](deep/deep_objects.png) | 1536×1024 | `5afa493` |
| [deep/deep_floor.png](deep/deep_floor.png) | 1024×1024 | `16b58b3` |
| [deep/deep_wall_4.png](deep/deep_wall_4.png) | 1536×1024 | `990a6ab` |
| [deep/deep_wall_3.png](deep/deep_wall_3.png) | 1536×1024 | `b94a9b6` |
| [deep/deep_wall_2.png](deep/deep_wall_2.png) | 1536×1024 | `d8563b3` |
| [deep/deep_wall_1.png](deep/deep_wall_1.png) | 1536×1024 | `d5f47db` |
| [puzzle/puzzle_objects.png](puzzle/puzzle_objects.png) | 1536×1024 | `f30f2bc` |
| [puzzle/puzzle_floor.png](puzzle/puzzle_floor.png) | 1024×1024 | `6d965be` |

기존 파일 유지: `puzzle_wall_4..1` 4장, `dark` 6장, `silent` 6장. 물건 시트는 마젠타 배경 대체 방식이며 생성 색 편차를 고려한 배경 제거가 필요하다. 벽·바닥의 정밀 이음새, 도트화 및 게임 연결은 요청서의 후속 작업이다.

[전체 요청문·커밋·30개 파일 검사 기록](ui-floor-reverse-20261022-production.json). UI 두 장의 파일 목록은 [UI README](../../ui/raw/README.md)에 있다.


## 배경 보강 원본 · 2026-10-22

`docs/GPT요청_배경보강.md`의 8개 경로를 순서대로 확인했다. 사용자 지시에 따라 기존 파일은 건너뛰어 바닥 2장은 덮어쓰지 않았다. 나머지 6장은 내장 image_gen으로 새로 그리고 한 장마다 main에 커밋·push했다.

| 경로 | 처리 | 개별 커밋 |
|---|---|---|
| `signs/signs_objects.png` | 신규: 표지판 9종 | `8d44aa0f` |
| `plates/plates_objects.png` | 신규: 문 옆 명패 9종 | `763db8d3` |
| `boards/boards_objects.png` | 신규: 게시판·액자 9종 | `ad8f7006` |
| `el_hall/el_hall_objects_2.png` | 신규: 엘리베이터 문·제어판 9종 | `de159f44` |
| `hq_pantry/hq_pantry_floor.png` | 기존 파일 유지·건너뜀 | — |
| `hq_street/hq_street_floor.png` | 기존 파일 유지·건너뜀 | — |
| `props/props_objects.png` | 신규: 낮은 장애물 9종 | `db36a6b4` |
| `props/props_objects_2.png` | 신규: 층 소품 9종 | `4f63ece2` |

신규 6장은 1536×1024 RGBA PNG이며 투명 픽셀을 확인했다. 기존 바닥 2장은 1024×1024다. 원본 납품이며 도트화·물건별 자르기·이음새·게임 연결과 후속 시각 검수는 별도다. 기존 바닥의 재제작 요구는 이번 건너뛰기 지시로 수행하지 않았다.
