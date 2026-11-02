---
name: goei-bot-support-hq-pivot
description: 2026-10-22 GPT→Claude 재인수: 게임을 '봇 보조 본부 방문'으로 축소 전환, 전투·로그라이크 보류, 추가 이미지 생성 금지
metadata:
  type: project
  modified: 2026-10-22T14:43:30.133Z
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

2026-10-22 14:41 사용자가 GPT 인계 문서 2개를 넘김 (스레드 「GPT 인수인계 이어받기」).
- docs/CLAUDE_HANDOFF_2026-10-22.md (브랜치 codex/run-resume-fix 9802c5a2), docs/유저_페르소나_인계_2026-10-22.md (codex/persona-reference-handoff-20261022 5ba9e382). 두 브랜치 모두 main v0.16.41보다 3 뒤·33 앞, main과 충돌 없음(merge-tree). 서로 조상 관계 아님(persona는 641cfb80 기반).
- 새 목표: 유저가 자기 페르소나(남 검정 바지정장/여 검정 치마정장, 128×256, 1배 표시)로 본부 방문 → 요원과 실제 모델 대화 → 기록이 본편 컨텍스트(goeiHqVisitV1 + 로어북 「본부 방문 대화 기록」)에 남음. 요원 위치는 봇 상태 태그로.
- 메트로배니아·전투·로그라이크·파밍 확대 = 보류(삭제 아님). 이 결정이 이전 메모리의 차원 승강기/본부 3판 계획보다 우선.
- 추가 이미지 생성(PixelLab 등) 금지, 사용자 허락 전까지. 달리기는 나중에 필요.
- 컷씬: 정지 장면 + 일부 레이어만 움직이는 고전 방식.
- 알려진 버그: Risu 플러그인 iframe에 allow-forms 없음 → src/game/visit.ts form submit을 button click + Enter(isComposing 제외)로 바꿔야 함.
See [[goei-npc-free-talk]], [[goei-game-hq]].

**2026-10-22 15:40 진행 (branch claude/project-thread-qilshh a60d1a5):** 두 GPT 브랜치를 main 위에 합침. 시험판 설치 URL https://raw.githubusercontent.com/leepc25/goei-plugin/claude/project-thread-qilshh/release/visit-preview/goei-plugin.js (0.16.41-visit.2, GOEI_GAME_BUTTON=1로 상황판 게임 버튼 늘 표시). 공식 Risu 로컬 실행으로 종단 시험 통과(모델은 가짜 OpenAI 호환 응답 — 실제 유료 모델은 사용자 몫). GPT판은 실제 Risu에서 본부가 검은 화면이었음: iframe CSP connect-src 'none'(blob fetch 막힘)·allow-same-origin 없음(localStorage SecurityError). 요원 배치 = game-pack/visit-agents(기존 idle 클립만). 시험 스크립트는 세션 scratchpad라 사라짐; 방법은 [[risu-plugin-pitfalls]].

**2026-10-22 16:04 user feedback on v0.16.43 visit chat:** wants RPG-style talk — speech bubbles over heads, lines only (no narration), no separate window. Wants to see/control what prompt, lorebooks and context go in. Bug: chat started as an agent (쟈알디) but visit used {{user}}/persona → visitor must be the status-board player. Visit talk was ignored by the next main reply → put it into the main chat as a real-time **interlude right after the last reply** (no story progress during visit). Plan doc: https://claude.ai/artifact/QKV7rEhoGi6z93e2nxLHeC (6 steps; 4 open choices: reply length, model default, record-card timing, multi-agent later).

**2026-10-22 16:14 work split (user):** Claude = dialogue tech (model call, context, bubbles, main-chat record). GPT = HQ environment + characters (player sprite still fixed to 쟈알디, persona 1x, per-room agent seats, head height `head` in visit-agents frames.json, quarters room). Handoff: docs/GPT_인계_본부환경_캐릭터_2026-10-22.md (main 9a3ad97f). User 16:14: "지침으로 될 문제 아님" — visitor identity must use the same mechanism as main (playerBlock/applyPlayer), not prompt sentences; "plan precisely before implementing". Plan v2: https://claude.ai/artifact/RF6vmeA9gwk5NvCcAottrq — reuse 괴담톡 collectRefs; record inserted at request time after anchor message chatId (NOT a chat message: Risu reroll pops trailing char messages). Uncommitted step-1 code (visitor=player) sits in working tree of claude/project-thread-qilshh.
**2026-10-22 23:40 decisions:** visit instructions go in a card lorebook 「Visit」 (@@SECTION like Phone, incl. MAIN_CONTEXT) for consistency with other features; plugin holds detailed settings only. Record method = request-time insertion at anchor (checked in plan v2).
**2026-10-22 23:57 user requests:** RPG-style name tags over every character's head (bubble above the tag); pixel-style font for all game text (plan: Galmuri OFL bundled in a game pack, FontFace from bytes; plugin window unchanged unless asked). Steps 2-3 committed d7ea296f (card Visit lorebook from card/visit-guide.txt).
**2026-10-23 00:17 user rule: EVERYTHING inside the game is pixel art** — font, speech bubbles, dialogue/input boxes, every small system window. Also: E opens only a small input (no full panel), typing indicator = small bubble with moving dots over the head. Step 5 code: src/game/talk.ts (commit 79d4454a); kit pixel frames in src/game/action/ui/kit.ts.
**2026-10-23 00:45 user feedback, done in aa97bbdf:** the HQ talk settings get their own page under 설정 → 기능별 설정 「본부 대화」, like 괴담넷·괴담톡·위키. They are not inside the main settings page. Name tags are small text only: no box, muted color. Input bar buttons have a pixel frame. Step 7 is done: nearby agents in the same room can chime in. One call returns {"lines":[...]}, with at most 2 bystanders. Card Visit sections INTERJECT and OUTPUT_GROUP were added; old cards fall back to a single reply.
**2026-10-23 04:05 naming (user):** the walkable game is called 「필드」. It is used for the settings feature button and the 「필드 설정」 page, the status-board game button, and the start-screen title. Places will grow beyond HQ: home, vehicles, and faction-only bases (관리국 본부, 백일몽, 협회, 중림 지하상가), so do not name things 「본부 ~」 in the UI.
**2026-10-23 05:28 user feedback, done in 30ba3882:**
- The field is a nav tab ('field') that runs inside the window content area. It is never fullscreen. On PC it sits in the side nav; on mobile it is a header button.
- Esc opens the pause menu (계속·설정·조작법·필드 나가기 → status board).
- Every Risu alert must sit above the plugin. host/container.ts lowers our iframe to z-index 49, below Risu alerts at z-50, and the floating button goes to 45.
- Feature settings open inside the settings tab.
- The interlude lists turns in time order, with (행동) and (끼어듦) marks. *action* input is supported.
- The user asked about movement, following, and Sims-like routines. Plan: the model picks an action from a fixed list and the game code moves the agent. Routines run in code, with no model calls. This is blocked on walk sprites (GPT side / needs permission).
**2026-10-23 05:53 decision (user):** entering the field while deployed in the main story is allowed for now (option B). Each request sends `mainScene` (status place, objective, time, protagonist status), and agents notice when the protagonist has turned up from elsewhere. Later, when development is done, the entry point will be set automatically from the current main-story location. Option A (block entry) was rejected as too simplistic.
