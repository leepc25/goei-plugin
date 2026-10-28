# 에일린 3D 시험 (2026-10-28)

Tripo API V3로 만든 첫 시험. 사용 크레딧 115 (잔액 885).

| 단계 | 작업 id | 크레딧 |
| --- | --- | --- |
| 정면·옆·뒤 → 모델 (얼굴을 머리카락이 덮어 버림) | dcab6926-0ff3-491b-b879-83215c90389e | 30 |
| 정면·뒤 → 모델 (채택) `eileen_model.glb` | d45c0f57-aab0-48b2-8995-b268de4125ca | 30 |
| 뼈대 (v3.0, Mixamo 이름, 65뼈) | 98ebf953-0ea4-4c25-8871-cb66f2d67e88 | 25 |
| 동작 idle·walk·run (제자리) `eileen_rig_anim.glb` | bfad168d-6445-4efd-93ed-45de8a498b53 | 30 |

- 기준 그림: `ref/` (GPT, 사용자 제공). 옆모습을 넣으면 앞머리가 얼굴을 덮어서 정면·뒤 두 장만 썼다.
- 굽기: `tools/3d/bake.py` (Blender bpy, Cycles CPU) → 128×256 남동 시트. 앉기는 다리 뼈 회전으로 임시로 잡은 자세.
- `test_sofa.png`: 대박 알선 소파에 앉힌 시험 · 서기 · 걷기 · 오른쪽 둘은 기존 PixelLab 에일린(비교).
- 사용자 시각 승인 전.

## 텍스처 다시 입히기·카툰 렌더링 (같은 날)

- 텍스처 다시(v3.5, detailed, 정면·뒤 참고) `eileen_model_tex_detailed.glb`: aaccbfb5-757f-4eda-b65f-3b55678663b9, 20크레딧. 머리·옷 결은 또렷해졌지만 얼굴 피부가 회색으로 얼룩져 처음 텍스처(d45c0f57)가 낫다.
- `tools/3d/toon.py`: 텍스처 색 × 2단 명암 + 뒤집은 껍질 외곽선. `test_toon.png` 위 = 처음 텍스처, 아래 = 다시 입힌 텍스처.
- 남은 문제: 앞머리가 눈을 덮음(머리가 살짝 숙여짐), 얼굴 명암이 어두움.

## 고품질 다시 뽑기 (같은 날, 채택 후보)

- 정면 한 장 → image-to-model, v3.1, geometry_quality detailed, texture_quality detailed, PBR, 면 제한 없음: cddc6295-ffe7-431c-b26f-26f36d4f0863, 60크레딧.
- 결과 64MB(저장소에 넣지 않음, 작업 id로 다시 받는다). 앞머리가 눈 위로, 눈·얼굴이 살아 있다. `test_hq_body.png`, `test_hq_face.png`.
- 다음: Blender에서 줄이기(노멀 맵 굽기) → 뼈대 → 카툰 렌더링.
- 누적 사용 195크레딧, 잔액 805.
