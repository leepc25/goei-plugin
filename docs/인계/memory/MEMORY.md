# 괴이봇 플러그인 개발

> **⚠ Claude 반성 · 2026-10-31 (사용자 지시로 문서마다 남김)**
> 2026-10-31 Claude는 다음 잘못을 저질렀다. 이 문서를 읽는 모든 Claude는 같은 짓을 하지 않는다.
> 1. **사용자 결정을 무시했다.** 콘쥬스는 사용자가 10-26에 20세로 정했고 인계서에도 적혀 있었는데, 옛 Claude 문장(teenage high school girl)을 근거로 화장실·샤워 그림을 거부하고, 사용자가 직접 뽑은 화장실 줄까지 팩에서 뺐다. 옷도 제복인데 교복이라고 단정했다.
> 2. **사용자 말에 토를 달고 같은 주장을 되풀이했다.** 사용자가 여러 번 지적했는데도 근거를 다시 확인하지 않아 몇 시간을 허비하게 했다.
> 3. **허락 없이 문서를 지웠다.** 「지침을 지우라」는 말만 듣고 목록을 보여 주지도 않고 96개를 지웠다가 되살렸다(결과물 삭제 금지 규칙 위반).
> 4. **문장을 덧대기만 하며 PixelLab을 낭비했다.** 이성해 점프 공격 5번 연속 실패, 이어폰 음악 120줄을 못 쓰게 만듦.
> 5. **답을 미루고 일을 멈춰 두었다.** 백그라운드로 돌릴 일을 돌리지 않고 대화만 했다.
>
> 지킬 것: 사용자 결정·위키가 근거다. 옛 Claude 자료는 근거가 아니다. 사용자 말에 토 달지 않는다. 무엇이든 지우기 전에 목록을 보여 주고 허락받는다. 실패하면 덧대지 말고 다시 쓰거나 바꾼다.

- **GPT art style = reference image, NO procedures (user 2026-10-23 20:08, supersedes 19:48):** GPT cannot pixel-convert, resize, run code, or draw true pixel art however explained. Never put conversion/downscale/palette/pixel steps in GPT guides. Instead: "match the style of the attached 쟈알디 room image" (user attaches it), keep sizes. Ceiling: not drawn separately, only molding/lights in top 40px.
- [Field bg: GPT fails long images + cross-image style (2026-10-24), options pending](goei-bg-consistency-problem.md)
- **Field bg via PixelLab parts (2026-10-24, thread 필드 남은 작업 이어가기 cmsg_01SMy6spzkHA3Ttz9fg54ZY8AxFavXcX43PuMsNQkXhSxC):** lobby test OK (style matched, ~130 gens). User cost rule: one shared floor for all 관리국, only a few wall types, 가짜 관리국 reuses 관리국 parts. Full ~120 scenes est. 22k–43k gens before reuse. v0.16.56 released 2026-10-24.
- **Claude's current job = field FEATURE DESIGN, not art placement (user 2026-10-23 16:08):** design how systems work (org routing, entry check, neutral zones, travel, E-interaction/affinity, follow, NPC AI). v0.16.54 shipped field logic steps 1–9; v0.16.55 wiki label fix. Guides/skills now owned by thread 「봇 수정」 (cmsg_01SMy6spzkHA3Ttz9fg54ZY8EM5y1GhcXckYzHDhEHaXVT).
- **No unrequested work (user 2026-10-23 07:55):** threads answer and propose only; start building/generating only when the user explicitly says to. When the user says 「기다려봐」, stop and wait. Exception (17:40): once the user says 「계속 가」 for a plan, finish it end to end, logging special cases.
- **Images are GPT's job, not Claude's (user 2026-10-23 07:56):** Claude does not make or pixelize images.
- **Field is a belt-scroll (DNF-style) view (user 2026-10-23 11:53):** PixelLab camera = low top-down. Character creation = humanoid v3 with GPT front ref.
- **ONE field art guide (2026-10-23 15:40):** docs/필드_그림_통합_지침.md + docs/필드_거점_설계안.md (~120 scenes) + docs/GPT_컷인_이펙트_지침.md + docs/요원_기술안.md. Never split guides further. Give docs so the user can open them in-app (attach/artifact), not only GitHub links.
- **Agent sprite spec:** 128×256 canvas, low top-down, 8 directions registered, game uses south-east only (left = mirror), 1.5x front / 0.85x back, body-proportion rule (no long legs). Background: 700px tall, wall line y420, walk y420–669, 1m=142px.
- **Field scale:** non-integer scaling fine. Backgrounds: HQ mood (above-ground navy/walnut/glass; basement white/teal). Status bar now 8 columns (동행, 투입); backup branch backup/before-status-columns.
- **Game UI is ALL pixel-art (user 2026-10-23 00:17):** Galmuri font, pixel bubbles/dialogue/windows, name tags, E = small input box.
- **Division of labor (user 2026-10-22 16:14):** Claude = technical side (model linking, prompts, plugin). GPT = environment + characters art.
- **2026-10-22 방향 전환:** Game = bot-support HQ/field (persona visits, real model talk). No new image generation without permission.
- Owner: YoungZ. Private project. Language: Korean.
- **Pending decisions (user 2026-10-22 02:18):** when a thread posts a plan/approval request, post it in project chat that turn with notify (skip if the user is actively chatting in that thread). If a thread is slow to answer a direct question, answer it yourself in chat.
- **New thread asks:** if the user says 「새 스레드」 without a topic, ask the topic; don't guess.
- **Playable demo first:** after every new main build, give the link right away labeled 「검수 전」 with known defects.
- [PixelLab web UI as user saw it](pixellab-web-ui-2026-10-23.md) — trust over doc claims
- 괴이봇 = Anomaly Sim 2.4 (괴이봇 2탄), RisuAI 괴담 롤플레이 봇.
- 선택지용사.charx + selection-hero-plugin.js are a different bot, reference only.
- Repo: public GitHub leepc25/goei-plugin. Releases by GitHub Actions on version push. Plugin self-updates via //@update-url (repo release/ folder); card updates from 설정 → 업데이트. No feature may depend on fetching repo content permanently.
- Release flow: bump package.json, npm run build, tools/build_lite_card.py, cp dist/goei-plugin.js + dist/goei-body.json + dist/goei-body.*.txt to release/, npm test + tests/browser.mjs, push branch + HEAD:main, sync /mnt/project-files/goei-plugin + README changelog. release/game/ refreshed from dist/game every release.
- Releases: batch on branches, release once when the user says to. Always report release done the moment GitHub Actions finishes.
- Refinements go in NEW threads, one per topic.
- **Quality review:** independent harsh image-by-image worker review of per-screen screenshots for every game build.
- **Always read the original settings (wiki card/wiki-base.json, lorebook sheets) before designing anything.**
- **Team roster:** 종합대응팀 = 쟈알디(부장)·에일린·스팡달·잼트리(내근)·데드폴·게슈간·로제몬·콘쥬스. 진압팀 = 고르고디오·큐라스. 격리팀 = 고그니쟈·데쥬레.
- **GPT outsourcing:** paste line must ALWAYS name repo leepc25/goei-plugin (main) and full URL.
- Architecture: v0.16.29 loader split. Lorebook folders are the skeleton (🚧괴이, 🎁파밍, 🙂요원).
- Naming: 「괴이 ː ANOMALY」; title screen restored in v0.16.56.
- Open field items after v0.16.56: 16/17 HQ scenes placeholder, no cut-in/fx art, agents idle-only, no enemies/combat, no touch super button, browser test not run.
- **Never generate** minors' (콘쥬스) bathing/undress scenes.
- **Sprite rule:** own weapons drawn in sprite; pickup weapons on hold. PixelLab Tier 3, balance ~10,950 (2026-10-24).
- [Skill kits for all 55 characters + cut-ins](goei-skill-kits.md)- [PixelLab text-v3 prompts for all skills/supers (2026-10-24)](pixellab-text-prompts.md) — /mnt/project-files/pixellab_text/
- [Jyaldi test room artifact + findings (2026-10-24)](jyaldi-test-room.md)
