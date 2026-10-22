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


## 관리국 본부 3판 원본 · 2026-10-22

`docs/GPT요청_본부3판.md`의 29장 전부 내장 image_gen으로 신규 제작해 한 장마다 main에 커밋·푸시했다(기존 파일 0장). 벽 15장·바닥 6장·문/코어 시트 2장·집기 시트 5장·정면 외관 1장. 목욕탕 샤워 벽은 기본 타일에 맞춰 수정했고, 집기 시트 욕조는 첫 칸 크기로 줄여 수정했다.

벽·외관·시트는 1536×1024, 바닥은 1024×1024 PNG다. 시트 7장은 RGBA이며 실제 투명 픽셀을 전수 확인했다. 생성기가 다른 크기의 정사각형으로 출력한 바닥은 비율을 유지해 1024×1024로 저장했다. 각 PNG 옆 `.production.json`에 요청문과 생성 원본 경로·규격·해시가 있다.

| 파일 | 최종 그림 커밋 |
|---|---|
| [hq3_office/hq3_office_wall_1.png](hq3_office/hq3_office_wall_1.png) | `decc76fd` |
| [hq3_office/hq3_office_wall_2.png](hq3_office/hq3_office_wall_2.png) | `b071fffe` |
| [hq3_office/hq3_office_wall_3.png](hq3_office/hq3_office_wall_3.png) | `ff5e2e6e` |
| [hq3_office/hq3_office_floor.png](hq3_office/hq3_office_floor.png) | `b3c393f0` |
| [hq3_hall/hq3_hall_wall_1.png](hq3_hall/hq3_hall_wall_1.png) | `808edb09` |
| [hq3_hall/hq3_hall_wall_2.png](hq3_hall/hq3_hall_wall_2.png) | `00723560` |
| [hq3_hall/hq3_hall_floor.png](hq3_hall/hq3_hall_floor.png) | `c8bdd4f7` |
| [hq3_life/hq3_life_wall_1.png](hq3_life/hq3_life_wall_1.png) | `839ad5e2` |
| [hq3_life/hq3_life_wall_2.png](hq3_life/hq3_life_wall_2.png) | `bc9decc1` |
| [hq3_life/hq3_life_wall_3.png](hq3_life/hq3_life_wall_3.png) | `9a68ca02` |
| [hq3_life/hq3_life_floor.png](hq3_life/hq3_life_floor.png) | `23bd19f6` |
| [hq3_bath/hq3_bath_wall_1.png](hq3_bath/hq3_bath_wall_1.png) | `7169020f` |
| [hq3_bath/hq3_bath_wall_2.png](hq3_bath/hq3_bath_wall_2.png) | `2c4b0d9c` |
| [hq3_bath/hq3_bath_wall_3.png](hq3_bath/hq3_bath_wall_3.png) | `06d3c16e` |
| [hq3_bath/hq3_bath_floor.png](hq3_bath/hq3_bath_floor.png) | `34a0b3a1` |
| [hq3_lab/hq3_lab_wall_1.png](hq3_lab/hq3_lab_wall_1.png) | `eaee5948` |
| [hq3_lab/hq3_lab_wall_2.png](hq3_lab/hq3_lab_wall_2.png) | `6ab34eec` |
| [hq3_lab/hq3_lab_wall_3.png](hq3_lab/hq3_lab_wall_3.png) | `ff31023b` |
| [hq3_lab/hq3_lab_floor.png](hq3_lab/hq3_lab_floor.png) | `2207bbe8` |
| [hq3_labhall/hq3_labhall_wall_1.png](hq3_labhall/hq3_labhall_wall_1.png) | `b1057c27` |
| [hq3_labhall/hq3_labhall_floor.png](hq3_labhall/hq3_labhall_floor.png) | `eccf9e1a` |
| [hq3_doors/hq3_doors_objects.png](hq3_doors/hq3_doors_objects.png) | `0439c0b3` |
| [hq3_doors/hq3_doors_objects_2.png](hq3_doors/hq3_doors_objects_2.png) | `4151c5fd` |
| [hq3_office/hq3_office_objects.png](hq3_office/hq3_office_objects.png) | `4dc74876` |
| [hq3_life/hq3_life_objects.png](hq3_life/hq3_life_objects.png) | `63553ae2` |
| [hq3_bath/hq3_bath_objects.png](hq3_bath/hq3_bath_objects.png) | `1e47a8f4` |
| [hq3_lab/hq3_lab_objects.png](hq3_lab/hq3_lab_objects.png) | `92a5ea90` |
| [hq3_training/hq3_training_objects.png](hq3_training/hq3_training_objects.png) | `525b4dc0` |
| [hq3_facade/hq3_facade.png](hq3_facade/hq3_facade.png) | `375e6ccf` |

[29개 파일 전수 검사·전체 해시·후속 작업](hq3-production-20261022.json). 도트화·조각 분리·실제 W/D/H와 기준점 맞춤·문짝 연결·게임 통합은 후속 작업이다. 타일 경계의 픽셀 일치는 검증하지 않았으며, 일부 집기의 사선 원근·추가 의자와 치수 비례는 후속 보정이 필요하다. 원본 수령 기록이며 전체 시각 규격 합격이나 게임 반영 완료를 의미하지 않는다.


## 절차 생성 방 타일 원본 · 2026-10-22

`docs/GPT요청_방타일.md`의 35장을 순서대로 내장 image_gen으로 제작하고 **한 장마다 별도 커밋으로 main에 반영**했다. 시작 시 대상 경로가 모두 없어 신규 35장, 건너뜀 0장이다.

- 벽 조각 11장: 1536×1024, 6×2 배치.
- 바닥 타일 11장: 1024×1024, 2×2 배치.
- 앞 가림막 11장: 1536×1024 RGBA, 3×2 배치.
- 공통 물건 2장: 1536×1024 RGBA, 3×3 배치.
- PNG 해독·캔버스 크기·투명 픽셀과 원격 35개 파일의 Git blob 해시를 확인했다. 정사각형 생성 출력은 지정 캔버스 치수로 정규화했다.
- `apt_red`·`apt_vacant`는 별도 기존 바닥이 없어 `apt_floor`의 팔각 장판 재질을 기준으로 붉은 조명·먼지 색조를 적용했다.
- 원본의 실제 셀 경계·발선·물건 여백에는 생성 오차가 남아 있다. 고정 격자로 잘라 쓰기 전 정렬 보정이 필요하며, 이음새 픽셀 정합을 보장하지 않는다. 도트화·이음새 보정·게임 통합은 후속 작업이다.

| 파일 | 개별 커밋 |
|---|---|
| [lobby/lobby_mod.png](lobby/lobby_mod.png) | [`b4387ea5`](https://github.com/leepc25/goei-plugin/commit/b4387ea556bdee75b40d94657ab9838351ad500b) |
| [lobby/lobby_tiles.png](lobby/lobby_tiles.png) | [`71416846`](https://github.com/leepc25/goei-plugin/commit/714168466e64719c30ac9cc53ad3dd7a72fa1139) |
| [lobby/lobby_front.png](lobby/lobby_front.png) | [`41e6bf3d`](https://github.com/leepc25/goei-plugin/commit/41e6bf3dc0289f5e99939f8b928d7c5b4298a616) |
| [chase/chase_mod.png](chase/chase_mod.png) | [`6998c289`](https://github.com/leepc25/goei-plugin/commit/6998c289e006b88899442eacbed1c927f834ca02) |
| [chase/chase_tiles.png](chase/chase_tiles.png) | [`358a3ccd`](https://github.com/leepc25/goei-plugin/commit/358a3ccdadf2c67e325ef96ae964c6a1b5131158) |
| [chase/chase_front.png](chase/chase_front.png) | [`15fbe97c`](https://github.com/leepc25/goei-plugin/commit/15fbe97c8586b9d0db949340d14b1e130e785b43) |
| [test/test_mod.png](test/test_mod.png) | [`f41358e1`](https://github.com/leepc25/goei-plugin/commit/f41358e1a705b9395dd38386cab7e339617726b7) |
| [test/test_tiles.png](test/test_tiles.png) | [`42b94339`](https://github.com/leepc25/goei-plugin/commit/42b94339272783f5460d172a9cafd83357b6a4e3) |
| [test/test_front.png](test/test_front.png) | [`7952d59a`](https://github.com/leepc25/goei-plugin/commit/7952d59a04a8c343e6b556b72f0cf1f96cc6fb0f) |
| [apt/apt_mod.png](apt/apt_mod.png) | [`20e975f2`](https://github.com/leepc25/goei-plugin/commit/20e975f28bf4fc4c1f97eabaeaf17ba2a2fd880d) |
| [apt/apt_tiles.png](apt/apt_tiles.png) | [`b65bf74d`](https://github.com/leepc25/goei-plugin/commit/b65bf74d530a65f324f44035d96d0f1e6d8c37b9) |
| [apt/apt_front.png](apt/apt_front.png) | [`9ffe8644`](https://github.com/leepc25/goei-plugin/commit/9ffe8644f4eb2f5d1d11ac062e0e54786b8e80af) |
| [apt_red/apt_red_mod.png](apt_red/apt_red_mod.png) | [`00b804db`](https://github.com/leepc25/goei-plugin/commit/00b804db9100ec2e27c16c8bac09778a3f1dbf23) |
| [apt_red/apt_red_tiles.png](apt_red/apt_red_tiles.png) | [`d3f1ec8f`](https://github.com/leepc25/goei-plugin/commit/d3f1ec8fbd6413959b0aafbae1598458c48640aa) |
| [apt_red/apt_red_front.png](apt_red/apt_red_front.png) | [`bb83259c`](https://github.com/leepc25/goei-plugin/commit/bb83259c0a3d7fa2963f9c356995df9c1451e68a) |
| [apt_vacant/apt_vacant_mod.png](apt_vacant/apt_vacant_mod.png) | [`0db628c3`](https://github.com/leepc25/goei-plugin/commit/0db628c3c83041df4047b2aed71d6d6be0b847f6) |
| [apt_vacant/apt_vacant_tiles.png](apt_vacant/apt_vacant_tiles.png) | [`b3f02931`](https://github.com/leepc25/goei-plugin/commit/b3f02931ea47468387a922db6b87d8fe60ef51ee) |
| [apt_vacant/apt_vacant_front.png](apt_vacant/apt_vacant_front.png) | [`d2f77608`](https://github.com/leepc25/goei-plugin/commit/d2f7760881cf8b07dd2dfff241984df63bc27cae) |
| [silent/silent_mod.png](silent/silent_mod.png) | [`a5f96fa3`](https://github.com/leepc25/goei-plugin/commit/a5f96fa37f40917c9d2747c63d9bfa86ebc73fb7) |
| [silent/silent_tiles.png](silent/silent_tiles.png) | [`1f08b358`](https://github.com/leepc25/goei-plugin/commit/1f08b358d0b87753cb7eba5ed802b4564c598535) |
| [silent/silent_front.png](silent/silent_front.png) | [`5eaf6358`](https://github.com/leepc25/goei-plugin/commit/5eaf6358d7a707cd5e90a84bdca683917f166091) |
| [dark/dark_mod.png](dark/dark_mod.png) | [`e6854087`](https://github.com/leepc25/goei-plugin/commit/e6854087455607cb8f5feb828a56f4af0dcbeeb1) |
| [dark/dark_tiles.png](dark/dark_tiles.png) | [`891a5aa6`](https://github.com/leepc25/goei-plugin/commit/891a5aa6195059b9cdb845dd13c2c43d2727a509) |
| [dark/dark_front.png](dark/dark_front.png) | [`4805cd2c`](https://github.com/leepc25/goei-plugin/commit/4805cd2c46d037e64472967aac53ead9ec5c5470) |
| [puzzle/puzzle_mod.png](puzzle/puzzle_mod.png) | [`20b64cfe`](https://github.com/leepc25/goei-plugin/commit/20b64cfe66aa5ff21bb425daf8cbee828bafebc7) |
| [puzzle/puzzle_tiles.png](puzzle/puzzle_tiles.png) | [`fca56638`](https://github.com/leepc25/goei-plugin/commit/fca56638e5b4f37313ba537048c0638c1c37b1b0) |
| [puzzle/puzzle_front.png](puzzle/puzzle_front.png) | [`f39679f1`](https://github.com/leepc25/goei-plugin/commit/f39679f1bf1928f1d26ab16ca3b2a385d9d8a58d) |
| [deep/deep_mod.png](deep/deep_mod.png) | [`db50c1af`](https://github.com/leepc25/goei-plugin/commit/db50c1af5cbaafb22337970763413cb8e80eaac9) |
| [deep/deep_tiles.png](deep/deep_tiles.png) | [`67c70776`](https://github.com/leepc25/goei-plugin/commit/67c7077620ce711ae282f53c9828a83e18ea2954) |
| [deep/deep_front.png](deep/deep_front.png) | [`b133edab`](https://github.com/leepc25/goei-plugin/commit/b133edab2a5c74805dc0ca781d545de26e7947a1) |
| [service/service_mod.png](service/service_mod.png) | [`58a6b8ee`](https://github.com/leepc25/goei-plugin/commit/58a6b8eed51a24382482581699d7735ebfb4db00) |
| [service/service_tiles.png](service/service_tiles.png) | [`0ec4efda`](https://github.com/leepc25/goei-plugin/commit/0ec4efda28fa67ea375607f23ad4596a7ef2329f) |
| [service/service_front.png](service/service_front.png) | [`d3b3490d`](https://github.com/leepc25/goei-plugin/commit/d3b3490d547b37b35a5acc29e747da9e57fc326b) |
| [props/room_roles_1.png](props/room_roles_1.png) | [`5209698f`](https://github.com/leepc25/goei-plugin/commit/5209698f581ff29c02ca9de1079907675b58ca6e) |
| [props/room_roles_2.png](props/room_roles_2.png) | [`142014fb`](https://github.com/leepc25/goei-plugin/commit/142014fb2bc86b2626d0b7ce8b39decd0cccc30a) |

[생성 요청문·파일 규격·해시 기록](room-tiles-20261022-production.json)
