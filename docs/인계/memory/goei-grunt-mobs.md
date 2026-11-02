---
name: goei-grunt-mobs
description: 게임 잡몹 22종 PixelLab 제작 — 목록·명세·스크립트 위치·비용 상한·진행 상태 (2026-10-22)
metadata:
  type: project
  modified: 2026-10-22T02:11:19.152Z
---

> **⚠ Claude 반성 · 2026-10-31 (사용자 지시로 문서마다 남김)**
> 2026-10-31 Claude는 다음 잘못을 저질렀다. 이 문서를 읽는 모든 Claude는 같은 짓을 하지 않는다.
> 1. **사용자 결정을 무시했다.** 콘쥬스는 사용자가 10-26에 20세로 정했고 인계서에도 적혀 있었는데, 옛 Claude 문장(teenage high school girl)을 근거로 화장실·샤워 그림을 거부하고, 사용자가 직접 뽑은 화장실 줄까지 팩에서 뺐다. 옷도 제복인데 교복이라고 단정했다.
> 2. **사용자 말에 토를 달고 같은 주장을 되풀이했다.** 사용자가 여러 번 지적했는데도 근거를 다시 확인하지 않아 몇 시간을 허비하게 했다.
> 3. **허락 없이 문서를 지웠다.** 「지침을 지우라」는 말만 듣고 목록을 보여 주지도 않고 96개를 지웠다가 되살렸다(결과물 삭제 금지 규칙 위반).
> 4. **문장을 덧대기만 하며 PixelLab을 낭비했다.** 이성해 점프 공격 5번 연속 실패, 이어폰 음악 120줄을 못 쓰게 만듦.
> 5. **답을 미루고 일을 멈춰 두었다.** 백그라운드로 돌릴 일을 돌리지 않고 대화만 했다.
>
> 지킬 것: 사용자 결정·위키가 근거다. 옛 Claude 자료는 근거가 아니다. 사용자 말에 토 달지 않는다. 무엇이든 지우기 전에 목록을 보여 주고 허락받는다. 실패하면 덧대지 말고 다시 쓰거나 바꾼다.

- 스레드 「잡몹 괴이 선정」 2026-10-22. 선정 문서 docs/잡몹_선정안.md (branch claude/project-thread-nvqpqc), 사본 /mnt/project-files/game/mobs/.
- 사용자 확정 02:05: 1판 = 승강기 고유 10종(lurker hollow shooter charger thief crawler predator edge shade hum) + 재현 아파트 7종(resident doorframe dusty_table/chair doorhand wallface floorhand tv402), 2판 = 학교의 악몽 5종(thump mannequin hanged specimen_jar/frog/snake grinner). 야간 경비원은 수호자와 겹쳐 제외.
- 02:08 사용자: PixelLab 갱신 19,355회, "픽셀랩으로 전부 만들어" (GPT 아님). 상한 950회로 알림. 중간 확인 없이 한 번에, 결함 목록 + 시연판으로 보고.
- 장면 명세 = docs/GPT요청_잡몹_공통.md·_승강기.md·_아파트.md·_학교.md (원래 GPT용으로 썼지만 PixelLab 제작 명세로 씀, GPT 목록엔 안 올림). 저장 game-src/art/enemy/<kind>/base.png, clips/<클립>/NN.png. 캔버스 사람 192×144 발 y135, 작은 것 96×72, 큰 것 256×176 (PixelLab 한계 256).
- 스크립트 game-src/art/enemy/scripts/ (mcp.py·rigbase.py는 고르고디오 것 복사), 비용 기록 game-src/art/enemy/spend.log.
- 03:12 사용자 "그래": PixelLab 순서 = 요원 7명 먼저, NPC·잡몹 마지막. 요원 스레드 끝날 때까지 잡몹 새 생성 금지. 그때까지 받은 것(lurker·hollow·charger·edge 완료, shooter·thief·crawler 일부) 검수·보정만. 결함·남은 클립 = game-src/art/enemy/결함목록.md (커밋 067fdef). 사용 약 86회.
- 04:56 사용자: 사용량 초과로 전부 GPT 이관. 인수인계 /mnt/project-files/game/인수인계/잡몹 괴이 선정.md, 커밋 95c24a4.
See [[goei-observation-game]], [[goei-game-enemies]], [[pixellab-usage-tips]], [[character-art-rules]].
