# GPT 요청서 · 검수 보강 2 (2026-10-22, 통합 독립 검수 3dc57b5 불합격분)

담당: 「게임 마무리 한 곳에서」 스레드(Claude). 독립 검수에서 그림 탓으로 떨어진 것은 네 가지입니다.
- 화이트보드와 점검표 판의 글줄이 **회색 막대**로만 그려져 있어 비어 있는 틀처럼 보입니다.
- 감정실 투영기의 빛 원뿔이 **납작한 도형**으로 보입니다.
- 감정실 라이트테이블 상판이 **흰 사각형**으로 보입니다.
- 격리 구역(B2) 벽에서 문 위 경고등 둘레에 **붉은 빛무리 원판**이 번져 있습니다.

그 부분만 다시 그립니다. 규칙은 `docs/GPT요청_게임배경.md`를 그대로 따릅니다. 공통 STYLE, FLOOR RULES, OBJECT SHEET RULES, 그리고 「정정」 절의 CORRECTION이 모두 적용됩니다. **사람·적·괴이·피는 그리지 않고, 읽을 수 있는 글자·숫자도 넣지 않습니다.**

## GPT에게 (작업 방법)

- 저장 경로는 아래에 적힌 그대로 씁니다. 한 장을 끝낼 때마다 main에 커밋합니다.
- 목록은 순서대로 전부 만들고, 중간에 묻지 않습니다. main을 새로 받았는데 그 파일이 이미 있으면 건너뜁니다. 단, 2번(격리 구역 벽 5장)은 **기존 파일을 덮어씁니다**.
- 다 올린 뒤에는 `docs/GPT_요청_목록.md`의 이 줄 상태를 「받음 N장(커밋)」으로 바꿉니다.

## 붙여 넣을 공통 머리말 (장마다 맨 앞에)

```
Use exactly the STYLE, FLOOR RULES and OBJECT SHEET RULES from docs/GPT요청_게임배경.md, plus its CORRECTION: few large simple shapes, bold dark outlines, flat colors with 2-3 tone steps, no fine texture or blur, no soft gradients, no glow halos. NO readable letters or numbers anywhere: handwriting is drawn as dark wavy scribble lines of varied length that look like Korean handwriting from far away but cannot be read. NO people, NO monsters, NO blood.
```

## 목록 (모두 6장)

### 1. 판 다시 그리기 — `boards/boards_objects_2.png` (1536×1024, 투명 바탕, 3×3 칸, 칸 순서는 왼쪽 위부터 1~9)
```
PLACE: boards and appraisal-room equipment, front view, every one fully detailed inside. Plain straight grey bars as "text" are FORBIDDEN: use dark-ink wavy scribble handwriting of varied lengths, little doodles, arrows, circled marks.
1 office whiteboard on a wall (wide 2:1), crowded: hand-drawn marker diagrams (boxes joined by arrows, a circled spot, a crossed-out area), several lines of blue and red scribble handwriting, 5 colored sticky notes each with a scribble, two round magnets, a marker tray with markers at the bottom edge.
2 inspection checklist board on a metal A-stand (tall): clipboard paper with 5 rows, each row = a square tick box (3 green ticks, 1 red cross, 1 empty) + a line of dark scribble handwriting + a small round red stamp at the bottom, a pen hanging on a string.
3 cork notice board (wide 3:2) crowded with paper notes of different sizes and colors, each with scribble handwriting and small doodles, colored pins, one photo of an empty corridor, a red string linking two notes.
4 evidence hologram projector for a lab: a dark metal pedestal box with a round lens on top; above it a pale cyan light shape made of STEPPED pixel bands (3 hard-edged tone steps, no smooth gradient) showing the outline of a small antique key floating inside.
5 appraisal light table (wide, waist high, metal legs): the glass top glows pale blue-white with a visible grid, and on it lie a magnifier, tweezers, an old pocket watch and two small paper evidence tags with scribbles.
6 wall-mounted red warning lamp in a metal cage, UNLIT-looking dark red glass with one small highlight, NO glow around it (the game adds light by itself).
7 small whiteboard on wheels (portable), same scribble rules as 1.
8 clipboard hanging on a nail with a checklist page (same rules as 2).
9 framed floor plan of the basement with hand-drawn red marks and scribbles.
```

### 2. 격리 구역 벽 5장 다시 그리기 (덮어쓰기) — `hq_containment/hq_containment_wall_1.png` … `hq_containment_wall_5.png`
현재 그림(같은 경로)을 열어 **구도·문·창·배관은 그대로** 따라 그리고, 바꾸는 것은 하나입니다. 문 위와 옆 경고등 둘레의 붉은 빛무리(부드러운 붉은 원)를 없앱니다. 경고등은 어두운 붉은 유리에 하이라이트 한 점만 둡니다. 문틀의 노랑·검정(또는 붉은) 사선 줄무늬는 그대로 둡니다. 크기와 비율도 기존 파일과 같게 합니다.
```
Redraw this exact wall (same composition, door, windows, pipes, panel seams, same size) from the existing file at this path. ONLY change: remove every soft red glow halo around the wall lamps; lamps become dark red glass in a metal cage with one small highlight, no halo, no gradient. Keep the hazard stripes on door frames.
```

## 받은 뒤 (Claude)
- 1번 칸 1 → 사무실 화이트보드(`paste_boards`의 board 6 자리), 칸 2 → 서 있는 점검표(signs 5 대신), 칸 3 → 게시판 대역, 칸 4 → 감정실 hologram, 칸 5 → 감정실 appraisal_bench로 바꿔 붙입니다.
- 2번은 `tools/bg_pixelize.py hq_containment`로 다시 도트화합니다.
