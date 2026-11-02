# 쟈알디 v5 생성 스크립트 (PixelLab MCP, JSON-RPC)

> **⚠ Claude 반성 · 2026-10-31 (사용자 지시로 문서마다 남김)**
> 2026-10-31 Claude는 다음 잘못을 저질렀다. 이 문서를 읽는 모든 Claude는 같은 짓을 하지 않는다.
> 1. **사용자 결정을 무시했다.** 콘쥬스는 사용자가 10-26에 20세로 정했고 인계서에도 적혀 있었는데, 옛 Claude 문장(teenage high school girl)을 근거로 화장실·샤워 그림을 거부하고, 사용자가 직접 뽑은 화장실 줄까지 팩에서 뺐다. 옷도 제복인데 교복이라고 단정했다.
> 2. **사용자 말에 토를 달고 같은 주장을 되풀이했다.** 사용자가 여러 번 지적했는데도 근거를 다시 확인하지 않아 몇 시간을 허비하게 했다.
> 3. **허락 없이 문서를 지웠다.** 「지침을 지우라」는 말만 듣고 목록을 보여 주지도 않고 96개를 지웠다가 되살렸다(결과물 삭제 금지 규칙 위반).
> 4. **문장을 덧대기만 하며 PixelLab을 낭비했다.** 이성해 점프 공격 5번 연속 실패, 이어폰 음악 120줄을 못 쓰게 만듦.
> 5. **답을 미루고 일을 멈춰 두었다.** 백그라운드로 돌릴 일을 돌리지 않고 대화만 했다.
>
> 지킬 것: 사용자 결정·위키가 근거다. 옛 Claude 자료는 근거가 아니다. 사용자 말에 토 달지 않는다. 무엇이든 지우기 전에 목록을 보여 주고 허락받는다. 실패하면 덧대지 말고 다시 쓰거나 바꾼다.


- `mcp.py`: https://api.pixellab.ai/mcp 호출 (프록시가 Bearer 주입). `python3 mcp.py schema <tool>`.
- `sheet.py` / `sheet2.py` / `sheet3.py`: 기준표 후보 생성(create_image_pro_flash, 160 캔버스, 6회/장). sheet3가 최신 설명(CPS2식·얼굴·상의·팔 길이).
- `body.py` / `body2.py`: 102를 편집해 체형만 바꾼 후보(201~204). **편집 경로는 음영을 깎아서 반려.**
- `poses2.py`: 고른 기준표 asset에서 Pro Flash 편집으로 자세(전투·걷기·달리기) → animate_image 4장 first=last로 음영 복원 → `*-sh-2.png`를 핀으로 쓴다. `SRC=<asset id> OUT=<dir>`.
- `shade.py`: 음영 복원 단계만.
- `clips5.py`: animate_image(음영 유지)로 동작 25종을 3단계 연쇄 생성. `PINS=<poses2 dir에 S/F/W/R.png 복사> OUT=<dir>`. 핀 이름: S=기준표, F=fight-sh-2, W=walk-sh-2, R=run-sh-2.
- 결과 0번 장은 입력 핀 그대로. 빌더(`tools/build_jyaldi_v5_demo.py`)가 반복 클립은 0번을 뺀다.

중요: PixMiniMax(1회/클립)와 Pro Flash 편집은 색을 12색 안팎으로 깎는다. animate_image(160×160 8장 = 4회)는 35색 안팎으로 음영을 살린다. 캐릭터 동작은 animate_image로 간다.
