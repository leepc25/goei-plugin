---
name: goei-game-enemies
description: 게임 적·수호자 모듈(src/game/action/enemy/) 현황, 시험장 링크, 엔진 연결 약속 — 적·보스·스폰 작업 전에 읽기
metadata:
  type: project
  modified: 2026-10-21T14:53:05.149Z
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

- 2026-10-21 스레드 「적과 수호자」가 만듦. 브랜치 claude/project-thread-o4wtlv (첫 커밋 d308781), main에는 아직 안 합침 (통합은 「게임 전투와 조작」 스레드가 engine/modules.ts에서).
- 내용: 일반 적 20종(승강기 고유 8·재현 아파트 7·가짜 관리국 4·백일몽 1) + 미라 부하, 수호자 8종(경비원 로비, 시험 감독 시험, 다리 많은 것 추격, 그림자 어둠, 소리와 냄새 침묵, 불가능한 입체 도형 퍼즐, 405호 노부부 재현, 만지는 것들 B-12). 위협 예산 편성(spawn.ts), 드랍 표·훅(drops.ts). 설명 README.md.
- 엔진 약속: engine/contract.ts의 Body·Hit·WorldView 그대로. 엔진에 디버프(hit.debuff), 잡기 이어 받기, signalEnemies(E 입력), custom 이벤트 처리를 부탁해 둠.
- 시험장: release/demo/goei-enemy-arena.html (node scripts/build-enemy.mjs; build.mjs는 엔진 스레드 소유라 안 건드림). 시험 tests/enemy.test.mjs 25건, tests/enemy-browser.mjs.
- 아직 없음: 208호 가족·일어난 집, 이름 있는 가짜 관리국 간부, 수치 균형, 실기 확인.
See [[goei-observation-game]].

2026-10-21 16:00: all 22 stage kinds (incl. aliases elder/family208/nothuman/warmth/conductor, added to DEF_BY_KIND) run as real Enemy in goei-action-game.html. Standalone arena is dev-only now (docs/게임_통합_규격.md: no own screens, no user links from module threads; report to 「게임 통합 검수」 + 「게임 전투와 조작」). enemy/arenaStage.ts = engine stage 'arena' for ?start=arena (wiring requested from combat thread). Debuff text via enemy/debuff.ts; enemyDie emitted by world.ts on hit kills, by die() only for non-hit deaths.

2026-10-22: enemy thread stopped by user decision; all game fixes now go to the single thread 「게임 마무리 한 곳에서」. Last enemy state on main 92592b9: pixel-shaded procedural figures (enemy/look.ts, offscreen dot canvas + rim/shade/outline, per-tick cache), geometry scaled ×1.375 to PIXEL 2.75 (enemy/scale.ts), pixel speech bubbles (kit slot + GoeiPixel), no white flash on down/dead. Art request draft docs/적_그림의뢰서.md (for future PixelLab).
