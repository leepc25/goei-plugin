# 쟈알디 v5 생성 스크립트 (PixelLab MCP, JSON-RPC)

- `mcp.py`: https://api.pixellab.ai/mcp 호출 (프록시가 Bearer 주입). `python3 mcp.py schema <tool>`.
- `sheet.py` / `sheet2.py` / `sheet3.py`: 기준표 후보 생성(create_image_pro_flash, 160 캔버스, 6회/장). sheet3가 최신 설명(CPS2식·얼굴·상의·팔 길이).
- `body.py` / `body2.py`: 102를 편집해 체형만 바꾼 후보(201~204). **편집 경로는 음영을 깎아서 반려.**
- `poses2.py`: 고른 기준표 asset에서 Pro Flash 편집으로 자세(전투·걷기·달리기) → animate_image 4장 first=last로 음영 복원 → `*-sh-2.png`를 핀으로 쓴다. `SRC=<asset id> OUT=<dir>`.
- `shade.py`: 음영 복원 단계만.
- `clips5.py`: animate_image(음영 유지)로 동작 25종을 3단계 연쇄 생성. `PINS=<poses2 dir에 S/F/W/R.png 복사> OUT=<dir>`. 핀 이름: S=기준표, F=fight-sh-2, W=walk-sh-2, R=run-sh-2.
- 결과 0번 장은 입력 핀 그대로. 빌더(`tools/build_jyaldi_v5_demo.py`)가 반복 클립은 0번을 뺀다.

중요: PixMiniMax(1회/클립)와 Pro Flash 편집은 색을 12색 안팎으로 깎는다. animate_image(160×160 8장 = 4회)는 35색 안팎으로 음영을 살린다. 캐릭터 동작은 animate_image로 간다.
