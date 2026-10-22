# 첫 출근 · 빈 본부 복도와 열리는 문

**미제출 프롬프트.** 캐릭터 동결. 이전 캐릭터·컷씬 PNG, HTML 내장 그림은 참조 입력으로 사용하지 않는다. 배경 규격은 기획 문서와 현행 `LOOKS.hall`의 텍스트 색상값만 근거로 한다.

## 신규 배경 (640×360, 불투명)

Empty headquarters corridor of a Korean administrative office on an overcast weekday morning. Locked side-on belt-scrolling game camera with shallow visible floor depth, horizontal architectural lines, no dramatic vanishing point. Native 640 by 360 pixel art, crisp single-pixel grid, chunky readable shapes, restrained two or three tone shading, dark selective outlines. Muted navy walls #1f2733 and #2a3544, walnut trim #4d3a2c, cool ceiling light #cfe4ff, grey floor #7f8994 and #76808b. A closed office door in the right half of the frame, hinges on its left, opening inward into an empty office. Reserve the rectangle x384 to511, y64 to319 for the complete door, its opening, light spill and shadow. Quiet empty floor on the left. No people, faces, hands, silhouettes, reflections of people, pets, portraits, text, lettering or logos. No blur, anti-aliasing, gradients, camera movement or photorealism.

문 위치는 새 배경을 받은 뒤 실제 픽셀 경계로 검수한다. 프롬프트 좌표 준수는 보장되지 않는다. 문·문틀·바닥 빛이 제안 영역을 벗어나면 이 크롭 방식은 불합격이며 반복 생성하지 않는다.

## 끝 키프레임 (신규 배경의 128×256 영역에만 적용하는 제안)

Open this office door inward to 85 degrees around its existing left hinge. Keep the doorframe, wall, floor grid, camera and palette unchanged. Reveal only an empty office and a restrained cool light wedge on the floor. Keep all changes inside the canvas. No people, hands, faces, silhouettes, text or new props.

`edit_image_pixen`은 문 회전 품질을 보장하지 않는다. 닫힘/열림 두 그림에서 힌지·문 폭·손잡이가 맞지 않으면 여기서 중단한다. 전체 화면을 256px로 축소하여 입력하지 않는다.

## 중간 동작 (시작·끝 고정, 16프레임 제안)

The office door opens inward once around its fixed left hinge, slowly at first, accelerating through the middle, then easing to rest at 85 degrees. The narrow light gap becomes a wider floor wedge. Keep the frame, corridor, floor lines and lighting steady. Fixed camera. Empty room, no people or hands, no new objects. No closing, bounce, loop, zoom or pan.

프레임 1/16은 닫힘/열림 기준. 5/9/13의 약 12°/45°/75°는 검수 목표이며 도구의 프레임별 강제 입력이 아니다. 나머지 11장은 실제로 달라지는 중간 프레임이어야 한다. 반복 복사·크로스페이드로 프레임 수를 채우지 않는다. `enhance_prompt`는 사용하지 않는다.

## 연결 후 무료 search_help 질문

Can animate_image animate a native 128x256 opaque door crop for 16 frames using first and last frame anchors, within a 524288 pixel budget? Confirm subscription generation charge (expected 8), API credit charge for this exact rectangle, whether endpoints count among the 16 output frames, and whether fixed doorframe/background preservation is supported. Also confirm create_image_pixen at 640x360 opaque (1 generation), edit_image_pixen at 128x256 (1 generation), and failure/refund rules. We need a 640x360 empty corridor, no characters, no rescaling or prior cutscene references. Is there a documented full-frame animation mode supporting native 640x360?
