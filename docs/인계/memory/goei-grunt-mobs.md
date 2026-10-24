---
name: goei-grunt-mobs
description: 게임 잡몹 22종 PixelLab 제작 — 목록·명세·스크립트 위치·비용 상한·진행 상태 (2026-10-22)
metadata:
  type: project
  modified: 2026-10-22T02:11:19.152Z
---
- 스레드 「잡몹 괴이 선정」 2026-10-22. 선정 문서 docs/잡몹_선정안.md (branch claude/project-thread-nvqpqc), 사본 /mnt/project-files/game/mobs/.
- 사용자 확정 02:05: 1판 = 승강기 고유 10종(lurker hollow shooter charger thief crawler predator edge shade hum) + 재현 아파트 7종(resident doorframe dusty_table/chair doorhand wallface floorhand tv402), 2판 = 학교의 악몽 5종(thump mannequin hanged specimen_jar/frog/snake grinner). 야간 경비원은 수호자와 겹쳐 제외.
- 02:08 사용자: PixelLab 갱신 19,355회, "픽셀랩으로 전부 만들어" (GPT 아님). 상한 950회로 알림. 중간 확인 없이 한 번에, 결함 목록 + 시연판으로 보고.
- 장면 명세 = docs/GPT요청_잡몹_공통.md·_승강기.md·_아파트.md·_학교.md (원래 GPT용으로 썼지만 PixelLab 제작 명세로 씀, GPT 목록엔 안 올림). 저장 game-src/art/enemy/<kind>/base.png, clips/<클립>/NN.png. 캔버스 사람 192×144 발 y135, 작은 것 96×72, 큰 것 256×176 (PixelLab 한계 256).
- 스크립트 game-src/art/enemy/scripts/ (mcp.py·rigbase.py는 고르고디오 것 복사), 비용 기록 game-src/art/enemy/spend.log.
- 03:12 사용자 "그래": PixelLab 순서 = 요원 7명 먼저, NPC·잡몹 마지막. 요원 스레드 끝날 때까지 잡몹 새 생성 금지. 그때까지 받은 것(lurker·hollow·charger·edge 완료, shooter·thief·crawler 일부) 검수·보정만. 결함·남은 클립 = game-src/art/enemy/결함목록.md (커밋 067fdef). 사용 약 86회.
- 04:56 사용자: 사용량 초과로 전부 GPT 이관. 인수인계 /mnt/project-files/game/인수인계/잡몹 괴이 선정.md, 커밋 95c24a4.
See [[goei-observation-game]], [[goei-game-enemies]], [[pixellab-usage-tips]], [[character-art-rules]].
