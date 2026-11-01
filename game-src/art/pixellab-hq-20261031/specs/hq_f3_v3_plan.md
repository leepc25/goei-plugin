# 본부 3층 v3 계획 (이어 그리기, 미생성)
사용자 10-31: 한 장에 다 넣지 말고 이어 뽑기. 엘리베이터 = 뒷벽 가운데 기준점, 양옆으로 확장, 이어 그리기 3번.

| 순서 | 기능 | 창 | 새로 그림 | 내용 | 비용 |
|---|---|---|---|---|---|
| ① 첫 판 | generate-image-v2 632×424, 에일린 style, 가이드 없음 | – | 632 | 엘리베이터(뒷벽 가운데) | 25 |
| ② 왼쪽 | inpaint-v3 512창 | 남김 162(겹침 60 포함) | 350 | 종합대응팀 유리 이중문 | 25 |
| ③ 오른쪽 | inpaint-v3 512창 | 남김 162(겹침 60) | 350 | 화장실(여) 나무문 | 25 |
| ④ 오른쪽 | inpaint-v3 512창 | 남김 162(겹침 60) | 350 | 휴게실 나무문 | 25 |

전체 폭 632+350×3 = 1,682. 합계 100 gens.
- 확장 한 번에 문 하나, 새 영역 가운데. 잘리는 선은 방과 방 사이 벽.
- 마스크는 위가 넓고 아래가 좁게(지상 교훈). 이음매 양쪽 띠·바닥선 측정.
- extend_right.py에 겹침·위쪽 마스크 옵션 추가 필요(돈 안 듦).

## ① 첫 판 요청문
Pixel art side-scrolling game background: the third floor elevator hall of a modern government agency office in Seoul, daytime. Seen from the front at standing eye height, slightly from above; the walkable floor fills the lower third of the image. Elevator doors in the center of the back wall, closed, a little taller than an adult, clear floor in front of them. The back wall, floor and ceiling run straight on past the left and right edges of the image. Pack the whole image with detail everywhere, walls, floor, ceiling and corners, nothing left empty: a busy, lived-in modern office floor with real depth. Everything else is up to you. Rich lighting with clear shadows. Dense, highly detailed pixel art, crisp pixel clusters, selective dark outline, rich shading, no dithering, no blur. No people, no chairs, no sofas, no benches, no other doors, no text, no letters, no numbers.
