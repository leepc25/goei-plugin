# 화면표시 제작 원본 · 2026-10-22

요청서 `docs/GPT요청_화면표시.md` 두 장 받음. 내장 image_gen 사용. 생성 전에 main을 새로 받고 한 장씩 개별 커밋·push했다.

| 파일 | 크기 | 내용 | 커밋 |
|---|---|---|---|
| [jyaldi_face_sheet.png](jyaldi_face_sheet.png) | 1024×1024 | 쟈알디 평소·피격·위급·필살 준비 2×2 얼굴 | `ada209d` |
| [ui_frame_sheet.png](ui_frame_sheet.png) | 1536×1024 | 메뉴·선택 행·초상화·체력바·아이템 칸 테두리 5종 | `9367c97` |

RGBA PNG. 얼굴 원본은 도구 출력 후 비율을 유지해 1024×1024로 내보냈다. 테두리의 초상화·체력바 내부는 alpha 0을 확인했다. 얼굴 표정별 세부 위치와 38×38 도트 판독성, 테두리 9-slice 기준점은 후속 담당의 도트화·UI 연결 과정에서 검수한다. 게임 시연판에는 아직 반영하지 않았다.

전체 생성 기본 요청문·커밋·파일 검사 기록: [제작 기록](../../bg/raw/ui-floor-reverse-20261022-production.json).


## 터치 단추·퀵슬롯·키 글자판 · 2026-10-22

`docs/GPT요청_터치버튼.md`의 세 장을 요청 순서대로 내장 image_gen으로 제작하고, 한 장씩 main에 커밋·push했다. 모두 **1536×1024 RGBA PNG**이며 투명 픽셀을 확인했다. PixelLab은 사용하지 않았다.

| 파일 | 격자·내용 | 개별 커밋 |
|---|---|---|
| [touch_buttons_sheet.png](touch_buttons_sheet.png) | 4×4, 터치 단추 16칸 | `090cbe2d` |
| [quickslot_icons_sheet.png](quickslot_icons_sheet.png) | 4×3, 퀵슬롯 아이콘 12칸 | `3b45ef96` |
| [keycaps_sheet.png](keycaps_sheet.png) | 5×4, 키 글자판 20칸 | `48864e51` |

키 글자판은 SPACE·SHIFT를 각 칸 안에 넣고 첫 줄 키의 위치를 수정한 최종본이다. 글자 순서: A S D Q W / E R C Z X / H 1 2 3 4 / ESC SPACE SHIFT 패드 A·B. 키를 가르는 행·열 경계에는 불투명한 키 그림이 없는 것을 확인했다.

원본 납품이다. `tools/ui_pixelize.py`로 도트화하고 `kit.gen.ts`와 터치·HUD·조작 안내에 연결하는 작업, 축소 후 판독성 검수는 후속 담당 범위다. 이번 커밋으로 게임 코드나 시연판을 바꾸지는 않았다.
