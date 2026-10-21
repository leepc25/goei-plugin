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

