export const meta = {
  name: 'goei-full-audit',
  description: '괴이봇 플러그인 전수검사: 부분별·관점별로 문제를 찾고, 찾은 것마다 따로 검증한다 (읽기 전용)',
  phases: [
    { title: 'Find', detail: '부분·관점마다 문제 찾기' },
    { title: 'Verify', detail: '찾은 문제마다 반박 검증' },
  ],
}

const COMMON = `
You are auditing the RisuAI plugin "괴이봇" (Anomaly Sim / 괴이: ANOMALY) in /home/user/goei-plugin (branch claude/project-thread-kyw9bz). The owner asked for a ruthless whole-bot audit before release: turn every part inside out, find real problems.

SCOPE OF LIVE CODE: only files reachable from src/main.ts and src/body-entry.ts (src/body.ts, src/core, src/host, src/ui, src/loader, src/data). DEAD, OUT OF SCOPE (never report, never read at length): src/game/**, src/host/game/**, src/core/field*.ts, src/core/gamelink.ts, src/core/visit*.ts, src/ui/game.ts, src/host/vs.ts, game-src/, game-pack/, _old/, tests of the game.
(Note src/ui/field.ts IS live.)

STRICTLY READ-ONLY: do NOT edit, create, move or delete anything inside /home/user/goei-plugin; do NOT run npm run build, release scripts, git checkout/stash/commit, or browser tests (*-browser.mjs; another process is running them). Other agents share this working tree. You MAY: read/grep, run git log/diff/show/blame, run a single unit test file with \`node --test tests/<name>.test.mjs\`, and write scratch probes ONLY under /tmp/audit_1113/ (e.g. bundle a src module with the repo's esbuild: \`node -e\` / a script in /tmp/audit_1113/<your-key>/ importing /home/user/goei-plugin/node_modules/esbuild/lib/main.js, outfile under /tmp/audit_1113/). Keep any probe under one minute.

The last release is v0.21.11 = commit 782dca17c. Everything after it is UNRELEASED and has never run in real RisuAI: \`git diff 782dca17c..HEAD -- <files>\` shows it. Give those changes extra care, but audit the old code too.

WHAT COUNTS AS A FINDING (must have a concrete code path and failure scenario):
 1. Functional bugs: wrong result, crash/throw, lost or corrupted saved state, races, stuck UI, wrong counts/numbers, off-by-one, wrong condition, stale cache, missing await, listeners leaking, reroll/abort mishandled.
 2. Hollow settings (허당): a setting the user can change that no code reads, or is read under another key, or whose default differs between definition and reader, or that silently has no effect.
 3. Context plumbing: something the user sees or types inside a feature (posts, comments, DMs, shop talk, broadcast chat, purchases…) that should reach the main model (via the 「참고 기록」/event stages in src/body.ts) or the feature's own request but does not; or content leaking where it must not go (e.g. AI 상담 into context).
 4. Things missing from the summary surfaces: 호출 흐름 (src/ui/editor/flow.ts, flowpage.ts), 기본값 저장/불러오기 and PREF_VAR (src/core/settings.ts), AI 상담 catalog (src/ui/editor/catalog.ts), 호출 기록.
 5. UI defects provable from code/CSS: unreachable or overlapping controls, text cut off, PC-only layout applied on phone (390x844) or the reverse, wrong sizes vs the house spec (small controls height 34, close/back 36, no outer box-shadow, no inner shadow), focus/scroll loss.
 6. Guide/code contradictions: a guide (src/data/guides/*.txt, src/core/guides.ts) tells the model a tag/format/placeholder that the parser/code does not accept or never fills; a guide section that is never sent.
 7. Model-output parsing that breaks on plausible real outputs (extra whitespace, code fences, Korean punctuation, missing closing tag, partial stream).
 8. Security/robustness: model- or user-supplied text inserted as HTML without escaping, regex catastrophic backtracking on model text, unbounded growth of saved state.
 9. Performance with real impact (whole-state JSON rewrite per keystroke, repeated tokenizing of large text on the UI thread, O(n^2) over chat history).

NOT FINDINGS (do not report): style/naming/refactor wishes, missing comments or tests, old-save / old-chat compatibility, dead game code, hypothetical issues you cannot tie to a code path, or anything that merely disagrees with these OWNER DECISIONS:
 - Mechanics are programmed in the plugin; the model only voices them.
 - Guide WORDING is owner-approved: never propose rewording a prompt/guide. Only factual guide-vs-code contradictions count (kind 'guide').
 - No worry about compatibility with old saves/chats.
 - Screen words: never 「본편」(use 「메인 요청」), 「퀵칸」(use 「퀵슬롯」), 「퍽」(use 「능력」); banned words 정부기관/government, 이면/이면세계. Visible strings using them ARE findings (kind 'wording').
 - PC and phone layouts are deliberately different; phone bottom bar has at most 5 entries.
 - 호출 흐름 screen layout (tinted band, faint vertical lines, narrow 호출 column) is approved as is: report only wrong numbers/behaviour there, not layout taste.
 - Item pictures: the 갱신기 only picks a picture reflecting story context; it never assigns a grade and the main model is not told. Items: 사용 = operate/apply/eat; 소모 = used-up subset with required count, vanishes at 0; 무기 = held to fight; 장비 = worn only.
 - 선톡/선쪽지/단톡 초대 are never "always send".
 - 상시 로어북 is one picker ($gen_active_books) feeding every feature; do not propose per-feature lists.
 - 갱신기 and Director are never included in bulk buttons. AI 상담 uses the 보조 model and never enters any context.
 - The game/field/대전 was removed; its dead code and tests stay (deleting needs the owner's permission).
 - Model instructions belong in guide sections (src/core/guides.ts + src/data/guides/*.txt), not hardcoded in code. A hardcoded instruction sentence still sent to a model from code IS a finding (kind 'hardcode'), except itemsRule in src/core/items.ts (known).
 - User-visible mechanics should not be hardcoded magic numbers when a setting was clearly intended.

For every finding give: exact file and line, the code evidence, a concrete scenario (state/input -> wrong outcome), severity (high = breaks a feature, loses data, or sends wrong content to a model for ordinary users; medium = wrong in a specific but plausible case; low = minor/rare/cosmetic), a minimal fix sketch, and needs_user_decision = true when the fix would change guide wording, visible UI design/text, delete something, or touch an owner decision.
Quality over quantity: verify each candidate by reading the surrounding code and its callers before reporting; do not report what you have not traced. Report at most 14, most severe first, and put in "dropped" how many weaker candidates you left out and a one-line gist of them. title_ko = one short plain-Korean sentence a non-programmer can follow.`

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title_ko: { type: 'string' },
          kind: { type: 'string', enum: ['bug', 'hollow-setting', 'context', 'summary-missing', 'ui', 'guide', 'parse', 'security', 'perf', 'wording', 'hardcode', 'other'] },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          file: { type: 'string' },
          line: { type: 'integer' },
          other_files: { type: 'array', items: { type: 'string' } },
          evidence: { type: 'string' },
          scenario: { type: 'string' },
          fix_sketch: { type: 'string' },
          unreleased_change: { type: 'boolean' },
          needs_user_decision: { type: 'boolean' },
        },
        required: ['title_ko', 'kind', 'severity', 'file', 'line', 'evidence', 'scenario', 'fix_sketch', 'needs_user_decision'],
      },
    },
    covered: { type: 'string' },
    dropped: { type: 'string' },
  },
  required: ['findings', 'covered', 'dropped'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    real: { type: 'boolean' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    severity: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string' },
    proof: { type: 'string' },
    fix_plan: { type: 'string' },
    test_idea: { type: 'string' },
    needs_user_decision: { type: 'boolean' },
    decision_question_ko: { type: 'string' },
  },
  required: ['real', 'confidence', 'severity', 'reasoning', 'fix_plan', 'needs_user_decision'],
}

const AREAS = {
  pipeline: { title: 'Main request pipeline and model calls', files: 'src/body.ts src/core/request.ts src/core/dispatch.ts src/core/budget.ts src/core/tokenizer.ts src/core/cbs.ts src/core/sanitize.ts src/core/statusctx.ts src/core/refs.ts src/core/reffn.ts src/core/lorebooks.ts src/core/lore.ts src/host/llm.ts src/host/hooks.ts src/host/risu.ts src/host/send.ts src/host/trace.ts src/host/joint.ts src/core/netjoint.ts src/host/waiting.ts src/host/unsent.ts src/core/attach.ts src/host/prefs.ts src/host/user.ts', focus: 'How the main request is assembled (stages, 참고 기록, events of the 4 kinds: 이번에 일어날 일 / 이미 끝난 일 / 진행 중인 일 / 참고 기록), token budgets, lorebook selection ($gen_active_books and the per-function counts), reroll handling, the joint call (괴담넷+괴담톡), concurrency limit ($gen_concurrent), retries, trace storage (400k char cap), what happens when a stage throws.' },
  guides: { title: 'Guides (prompt sections) and their wiring', files: 'src/core/guides.ts src/core/deftext.ts src/data/guides/*.txt src/ui/editor/guides.ts src/ui/editor/rules.ts src/core/people/prompt/*.ts tests/guide-out.test.mjs', focus: 'Unreleased change moved 95 hardcoded instruction texts into guide sections (new guides: 메인 요청에 붙는 글, 요청 공통, 갱신기(덧붙임·정리), 이미지 태그 넣기). For EVERY guide section id: is it actually read and sent by some request builder; are placeholders ({{...}}, ${...}, %s etc.) all filled; when a user has an edited (saved) guide, does the code fall back correctly for new sections; does resetting/editing a guide in the 지침 tab hit the right key; menu grouping lists every guide exactly once; long group names (인물 기록) not cut. Also tags/formats the guides promise vs. what the parsers accept.' },
  mainreach: { title: 'LENS: does everything the user does inside features reach the main model', files: '(whole live tree; start at src/body.ts and grep for the event/record stages, src/core/hslog.ts, src/core/shopctx.ts, src/core/gnet.ts, src/core/phone.ts, src/core/malls.ts, src/core/shop.ts, src/core/wiki.ts, src/core/items.ts, src/core/wallet.ts, src/core/points.ts)', focus: 'For each feature (괴담넷 and its 4 boards incl. 연어 마켓, DMs/쪽지, 괴담톡 incl. group rooms and view-only rooms, 위키, 상점/암시장 desk, 우주 쇼핑몰, 백일몽 포인트몰, 망상홈쇼핑 broadcast + viewer chat + my chat + purchases, 소지품 use/consume/equip/delete, 가계부, 포인트): list what the user can see or type, then trace whether and how it is handed to the main request (and to the 갱신기), under which setting, and whether the setting really gates it. Report gaps, double sends, things sent although switched off, things sent to the wrong kind (끝난 일 vs 진행 중), and token limits that are not applied.' },
  settings: { title: 'Settings definitions, storage and settings UI', files: 'src/core/settings.ts src/core/setdef/*.ts src/core/advanced.ts src/ui/settings.ts src/ui/setrow.ts src/ui/advanced.ts src/ui/famtable.ts src/ui/fngrid.ts src/core/shopfn.ts src/core/shopctx.ts src/ui/defaults.ts src/ui/controls.ts src/core/journal/settings.ts src/core/people/settings.ts', focus: 'Row definitions vs rendered rows (rows defined but never rendered and the reverse), number boxes clamp/min/max/step, the 가게 표/기능 표/양 표 tables (인터넷, 괴담톡, 상점, 망상홈쇼핑) write the keys the readers read, defaults = previous behaviour, 기본값 저장/불러오기 covers every key (PREF_VAR), disabled/greyed rows when parent switch is off, values surviving window reopen.' },
  editor: { title: 'Settings/editor window: 호출 흐름, 관리, 기록, AI 상담', files: 'src/ui/editor/index.ts src/ui/editor/flow.ts src/ui/editor/flowpage.ts src/ui/editor/manage.ts src/ui/editor/record.ts src/ui/editor/relations.ts src/ui/editor/start.ts src/ui/editor/trace.ts src/ui/editor/catalog.ts src/ui/editor/consult.ts src/core/consult.ts src/ui/editor/style.css', focus: '호출 흐름 is the single most important screen for the owner: check that every call site of a model in the plugin appears there with the right count/condition/model and that 예상 and 지난 턴 token numbers are computed from the real request builders (메인 + 보조 = 합), that token counting does not freeze the UI, and that every control on it writes the same key the feature reads. AI 상담: applies changes to the right keys, 10-change cap, never leaks into context, catalog covers settings. 기록/호출 기록 pages: paging, delete, edit, save.' },
  setwire: { title: 'LENS: every setting key traced from UI to reader', files: '(whole live tree)', focus: 'Enumerate every scriptstate/pref key (grep "\\$[a-z]+_[a-z_0-9]+" in src/core/settings.ts, src/core/setdef, src/core/people/settings.ts, src/core/journal/settings.ts, src/core/advanced.ts and usages across src). For each key build: where defined (default), where the UI writes it, where it is read. Report keys that are written but never read, read but never writable, read with a different default than defined, parsed with a different type (number vs string vs list), missing from PREF_VAR / defaults save, or missing from the AI 상담 catalog while similar keys are present. Use scripted grep under /tmp/audit_1113/setwire/ to do this exhaustively rather than sampling, then manually confirm each suspect.' },
  gnet: { title: '인터넷: 괴담넷, 괴담갤, 세정게, 연어 마켓, 쪽지', files: 'src/core/gnet.ts src/core/gnetPrompt.ts src/core/boards.ts src/ui/gnet.ts src/ui/browser.ts src/core/setdef/gnet.ts src/core/sitepics.ts src/data/guides/gnet.txt src/core/netjoint.ts', focus: 'Refresh/auto refresh per board, writing posts, comments, DMs (선쪽지), 연어 마켓 trades, per-board and per-function 「넘길 내용」 tables (src/core/reffn.ts) really applied to each request, auto refresh of one board not disturbing another board UI, parsing of model output into posts/comments, reroll keeping/dropping generated content, paging, deletion, unread marks.' },
  phone: { title: '괴담톡 (메신저)', files: 'src/core/phone.ts src/core/phonePrompt.ts src/core/phoneView.ts src/ui/phone.ts src/core/setdef/phone.ts src/host/photo.ts src/core/pictures.ts src/core/sharedpics.ts src/ui/attach.ts src/data/guides/phone.txt', focus: 'Reply, 새 메시지 확인, 보기 전용 방, group rooms and invites, 선톡, photos/attachments ([사진:...] NPC asset photos were removed in the unreleased batch; user uploads stay), per-function tables, parsing of model output into bubbles, unread counts, room list ordering, delete, reroll, phone drawer on mobile.' },
  wording: { title: 'LENS: visible wording and banned words', files: '(whole live tree: every string that reaches the screen or a model in src/ui, src/host, src/core, src/data/guides)', focus: 'Grep exhaustively for: 본편, 퀵칸, 퍽, 정부기관, government, 이면, 이면세계, 채팅 (as a UI label for the main chat), 참고 자료, and English leftovers / developer words shown to users (undefined, NaN, null, [object Object], TODO, debug keys, raw $variable names) and for mixed terms naming the same thing differently on different screens (e.g. 갱신기 vs 업데이터, 보조 모델 names, 괴담톡 vs 폰). Distinguish visible strings from comments/identifiers: only visible strings and model-facing text count. Also toasts/errors that blame the wrong feature (e.g. every error labelled 괴담넷).' },
  wiki: { title: '위키', files: 'src/core/wiki.ts src/ui/wiki.ts src/core/setdef/wiki.ts src/data/guides/wiki.txt card/wiki-titles.json', focus: 'Lookup/generation of pages, base pages vs generated, links, side list position, search, the wiki request builder and lorebook use, parsing, caching and invalidation, phone layout.' },
  journal: { title: '기록 (journal, chronicle, report cards)', files: 'src/core/journal/*.ts src/ui/records.ts src/ui/reportcard.ts src/ui/reportpng.ts src/ui/more.ts src/core/paging.ts', focus: 'Record building per turn, mining, chronicle, notify, 「더 보기」 30 rows paging, PNG report export, store size bounds, deletion and edits persisting, records tied to the right message on reroll/delete.' },
  shop: { title: '상점 (기본 상점, 암시장 desk, 맞춤 주문, 판정)', files: 'src/core/shop.ts src/ui/shop.ts src/core/bmdesk.ts src/core/craft.ts src/core/orders.ts src/host/shopcard.ts src/core/shopfn.ts src/core/shopctx.ts src/data/guides/shop.txt src/data/guides/bmdesk.txt', focus: 'Stock generation (진열), 문의, 1:1 상담, haggling/judge, buying and selling (money and item both applied exactly once), custom orders lifecycle and ready notice, 「참조 로어북」 count now really limiting, 가게 표 × 기능 표 both must be on for content to be sent, shop events handed to the main request, reroll not duplicating purchases.' },
  malls: { title: '우주 쇼핑몰, 백일몽 포인트몰, 망상홈쇼핑', files: 'src/core/malls.ts src/ui/malls.ts src/core/homeshop.ts src/core/hslog.ts src/ui/homeshop.ts src/ui/hsplayer.ts src/host/homeshop.ts src/core/setdef/homeshop.ts src/core/points.ts', focus: 'Mall catalogue rolls, login gate of 포인트몰, cart/buy/sell, points ledger double counting (fixed in unreleased batch via dropDoubleSync: check the fix and its healing of old pairs is correct and cannot delete legitimate rows), 망상홈쇼핑 programme schedule, player, viewer chat, 채팅 반응 (say), purchases, the new settings window rows ($hs_* keys) each read by code, hslog handing 방송 내용/시청자 채팅/내 채팅 to main request under $hs_main* settings.' },
  items: { title: '소지품, 장착, 사용, 가계부', files: 'src/core/items.ts src/core/itemrules.ts src/core/itemtraits.ts src/core/iconmatch.ts src/core/startitems.ts src/ui/items.ts src/ui/itemIcons.ts src/host/itemicons.ts src/host/usebox.ts src/core/wallet.ts src/ui/wallet.ts src/data/guides/updater-extra.txt', focus: 'Add/merge/split/delete (new red 삭제 button purges list+log without record), counts and 소모 vanishing at 0, equip slots (8-slot band), 사용 bar / 다음 메시지에 사용, weights shown to 10g, $it_scope and $it_skip really changing the request, icon matching (exact name wins), state pictures, wallet rows with story time and coloured day totals, money never applied twice, reroll.' },
  asyncl: { title: 'LENS: async, races, re-entrancy, error paths', files: '(whole live tree: src/body.ts, src/host/*.ts, src/core/*.ts request/refresh functions, src/ui handlers that await)', focus: 'Find: awaits whose result is applied to state that may have changed meanwhile (chat switched, message rerolled/deleted, window closed); double-click / double-submit starting two requests; flags (busy/loading) not reset on throw; promise rejections swallowed leaving spinners; $gen_concurrent slot handling (a known old bug: concurrent=1 deadlocked a joint call - check it is really fixed); timers/intervals/listeners not cleared when the panel closes or the chat changes; state saved to the wrong chat after an await; abort/cancel not honoured.' },
  peoplecore: { title: '인물 기록 갱신기 · Director · 라우터', files: 'src/core/people/*.ts src/host/people.ts src/data/guides/updater-compact.txt src/data/guides/updater-detailed.txt src/data/guides/updater-extra.txt src/data/guides/director-extra.txt src/data/guides/directive.txt', focus: 'Updater request building and output parsing (items, points, wallet, affinity axes, speech, identity, sexual, rhythm), consolidation, router (코드가 고름 / 모델이 고름), Director, injection of people records into the main request, retries on format error, default prompt = compact, entries applied exactly once per turn (points re-sync), reroll undoing the previous application, hypa memory link.' },
  peopleui: { title: '인물 화면, 요원, 외형, 세력', files: 'src/ui/people.ts src/ui/agents.ts src/ui/looks.ts src/core/looks.ts src/host/looks.ts src/core/player.ts src/core/factions.ts src/core/aliasrows.ts src/core/pairrows.ts src/ui/lorecheck.ts', focus: 'People list/detail, approval of pending updates, manual edits saved to the right person, alias rows, relations, looks pack selection, faction switch effects, phone vs PC layouts, long names.' },
  parse: { title: 'LENS: parsing of model output, escaping, regex safety', files: '(whole live tree: grep for innerHTML, insertAdjacentHTML, .html(, template strings building markup; regexes applied to model text; JSON.parse of model text)', focus: 'For every parser of model text (posts, comments, bubbles, wiki pages, shop stock, updater blocks, tags like [사진:], image tags, status tags): try plausible malformed outputs (code fences, missing closers, CRLF, full-width brackets/colons, nested tags, extra prose before/after, duplicated blocks, very long lines) and report where it throws, silently drops everything, or swallows following content. For every HTML sink: is model/user/lorebook text escaped (src/core/sanitize.ts) — report unescaped paths with the exact tainted source. For every regex on model text: catastrophic backtracking candidates.' },
  world: { title: '세계 엔진: 상황판, 명부, 임무, 달력, 태그', files: 'src/core/world/*.ts src/core/scenes.ts src/core/scenarios.ts src/core/seed.ts src/core/start.ts src/core/statusctx.ts src/data/scenarios.json', focus: 'Status tag parsing and output, registry/directory assembly, virtual roster, calendar/date math (month ends, year change, weekday), drafts, records, missions, catalog, faction logic, start scenarios and start items, schema validation of edited world data.' },
  dirstatus: { title: '명부·상황판·지도·시작 화면 UI', files: 'src/ui/directory.ts src/ui/status.ts src/host/statusview.ts src/ui/field.ts src/ui/mapzoom.ts src/ui/landing.ts src/ui/evcard.ts src/ui/evpic.ts src/host/openinghint.ts src/ui/clouds.ts src/ui/cctvfx.ts src/ui/editor/start.ts src/ui/editor/relations.ts', focus: 'Directory edit/save, status board 1280x950 sizing, map pins and label declutter, zoom/pan on touch, landing/start screen (faction start images exactly 5), event cards, opening hint, effects that keep running after close.' },
  hardcode: { title: 'LENS: hardcoded model instructions and magic numbers', files: '(whole live tree)', focus: 'Find every string literal in src/**/*.ts (live code) that is sent to a model as instruction text (English or Korean sentences in request builders, joined prompt fragments, "You are", "Write", "Do not", "반드시", "하지 마" etc.) and is NOT loaded from a guide section — the unreleased batch claims 95 were moved; find the ones still left (exclude itemsRule in src/core/items.ts, and purely structural labels/headers). Also find hard caps and magic numbers that control user-visible mechanics with no setting (e.g. the 10-change cap of AI 상담, list lengths, retry counts fixed at 1 in host/people.ts, timeouts) — report these as needs_user_decision = true with kind hardcode, low/medium.' },
  shell: { title: '창 뼈대: app, overlay, 진행 창, 제스처, 테마', files: 'src/ui/app.ts src/host/overlay.ts src/host/progwin.ts src/core/progress.ts src/core/progplan.ts src/ui/popwin.ts src/ui/drawer.ts src/ui/gesture.ts src/ui/swipeback.ts src/ui/morph.ts src/ui/mbar.ts src/ui/more.ts src/ui/frame.ts src/ui/theme.ts src/ui/toast.ts src/ui/panels.ts src/core/navhist.ts src/core/focus.ts src/host/container.ts src/host/chatclicks.ts src/ui/uprightInput.ts src/ui/needfill.ts src/ui/copy.ts', focus: 'Navigation and back stack, tab switching keeping state, popup windows (closing on right-click was a known bug), mouse gestures (a known open bug: reverse-ㄱ gesture broken; gestures Windows-only), swipe back on phone, morph re-render keeping scroll/inputs, progress window steps matching real calls, the mobile bottom bar (<=5), keyboard handling, leaks on close.' },
  images: { title: '이미지·에셋·그림 요청문', files: 'src/core/asset.ts src/host/asset.ts src/host/assets.ts src/core/imgprompt.ts src/core/imgtag.ts src/ui/images.ts src/ui/imgprompt.ts src/host/picpack.ts src/data/guides/asset.txt src/data/guides/tag.txt src/core/sharedpics.ts src/core/pictures.ts', focus: 'Image tag insertion by main vs 보조 model (이미지(메인 모델)/이미지(보조 모델)), asset name matching, fallback text (그림 대체 말), image prompt building, picture packs download/caching, missing-asset behaviour.' },
  loader: { title: '시작기·본체 받기·설치·업데이트·빌드', files: 'src/main.ts src/body-entry.ts src/loader/*.ts src/core/update.ts src/core/datapack.ts src/core/fetchparts.ts src/host/datapack.ts src/host/datapanel.ts src/host/install.ts src/core/install.ts src/ui/update.ts src/ui/editor/install.ts scripts/build.mjs scripts/data-pack.mjs scripts/release-prep.mjs tools/build_lite_card.py .github/workflows/release.yml', focus: 'Loader fetching body parts (hash/length checks, timeouts, cache of raw.githubusercontent, partial download), version gating (minPlugin), card update merge (lorebook/regex replace by name, user entries kept, Directory protected), data packs, offline panel, build producing consistent hashes, release-prep steps and what a release must contain (release/ files), failure modes that would brick the plugin for users after this release.' },
  css: { title: 'CSS: 화면 규격, PC·폰, 잘림·겹침', files: 'src/ui/style.css src/ui/editor/style.css (and the TS files that emit the class names)', focus: 'House spec: small buttons/chips/selects/segments/steppers height 34, radius 8, font 13 (phone too); close/back 36; no outer box-shadow, no inner shadow on cards; selected cards mint 2px via ::after. Find rules that violate it or later rules overriding earlier ones by specificity (known example: a back button forced to 34), class names used in TS with no CSS and the reverse for recently added screens (망상홈쇼핑 settings, famtable/fngrid tables, flowpage band, 지침 menu groups, 소지품 band, wallet day totals), phone media queries missing for new tables (overflow at 390px), text truncation (menu names must never be cut), z-index conflicts between popups/drawers/toasts, fixed widths exceeding 390px.' },
  tests: { title: 'LENS: test and tooling health', files: 'tests/*.test.mjs package.json scripts/*.mjs tests/qc-settings-harness.mjs tests/*-browser.mjs (plugin ones only, not game)', focus: 'Unit tests that can never fail (assert on constants, try/catch swallowing, skipped), tests asserting behaviour that contradicts current code or owner decisions, tests reading stale fixtures, important unreleased logic with zero coverage (reffn tables, shopfn, hslog, dropDoubleSync, guides fallback, trace cap, item delete) — report coverage gaps only where the logic is intricate and a bug is plausible, and point to the suspicious logic. package.json scripts that point to removed files (tests/browser-suite.json was deliberately discarded: report as needs_user_decision). Browser tests whose selectors no longer exist in src (they would fail or silently pass).' },
  perf: { title: 'LENS: performance and saved-state growth', files: '(whole live tree)', focus: 'Saved state: what is stored per chat (scriptstate/chat vars/plugin storage), how big it can grow per turn (trace now keeps full text up to 400k chars; journals; gnet posts; phone rooms; hslog), whether there is pruning, and whether whole blobs are JSON-serialised on hot paths (every keystroke, every display hook, every scroll). Display hooks that re-run heavy work for every message. Tokenizer use on the UI thread. Event listeners accumulating across re-renders. Report only with a concrete growth/cost estimate.' },
}

const GROUPS = {
  W1: ['pipeline', 'guides', 'mainreach'],
  W2: ['settings', 'editor', 'setwire'],
  W3: ['gnet', 'phone', 'wording'],
  W4: ['wiki', 'journal', 'shop'],
  W5: ['malls', 'items', 'asyncl'],
  W6: ['peoplecore', 'peopleui', 'parse'],
  W7: ['world', 'dirstatus', 'hardcode'],
  W8: ['shell', 'images', 'loader'],
  W9: ['css', 'tests', 'perf'],
  // 11-13 사용량 한도로 못 돌린 것 (다음 계정이 돌림)
  MISS: ['loader'],
}

const group = (args && args.group) || 'W1'
const keys = GROUPS[group]
if (!keys) throw new Error('unknown group ' + group)

function finderPrompt(key) {
  const a = AREAS[key]
  return `${COMMON}

YOUR ASSIGNMENT (key "${key}"): ${a.title}
Files: ${a.files}
What to dig into: ${a.focus}

Method: read the listed files fully (they are your responsibility — do not sample), follow calls into other files as needed, look at the unreleased diff for these files, and trace each feature end to end: settings screen -> saved key -> reader (file:line) -> text sent to the model / screen / saved state. Scratch dir: /tmp/audit_1113/${key}/. In "covered" list the files you actually read in full and the features you traced.`
}

function verifyPrompt(f, key, lens) {
  const lensText = lens === 'repro'
    ? 'Your lens: REPRODUCE. Try to actually demonstrate the failure with a tiny probe (bundle the module with esbuild into /tmp/audit_1113/verify/ and run it with node, or run the relevant unit test file) or, where a probe is impractical, walk the exact execution path line by line with concrete values. Put what you ran/observed in "proof".'
    : 'Your lens: REFUTE. Assume the reporter is wrong. Look for guards, normalisation, callers that never pass the bad value, a later overwrite, a unit test pinning the behaviour as intended, or an owner decision that makes it intended. Put the decisive code lines in "proof".'
  return `${COMMON}

YOU ARE A VERIFIER, not a finder. Another agent (area "${key}") reported the finding below. Decide independently whether it is REAL by reading the code yourself. ${lensText}
Set real=false when you cannot confirm it from the code, when it only concerns dead code, when it is taste, or when it contradicts an owner decision. If it is real but the reporter got severity or the fix wrong, correct them. fix_plan must be precise enough for another engineer to apply without rediscovering the problem (files, functions, what to change, what must NOT change) and test_idea should name a unit-test assertion that fails before and passes after. needs_user_decision=true when fixing means changing guide wording, visible UI design or text, deleting things, or an owner decision — then write decision_question_ko: a short plain-Korean question with the options and your recommendation.

FINDING:
${JSON.stringify(f, null, 1)}`
}

const out = await pipeline(
  keys,
  (key) => agent(finderPrompt(key), { label: `find:${key}`, phase: 'Find', schema: FINDINGS_SCHEMA }),
  async (res, key) => {
    if (!res) { log(`find:${key} returned nothing`); return { key, covered: '', dropped: 'finder failed', items: [] } }
    log(`find:${key} -> ${res.findings.length} findings (dropped: ${res.dropped})`)
    const items = await parallel(res.findings.map((f, i) => async () => {
      const lenses = f.severity === 'high' ? ['refute', 'repro'] : ['refute']
      const verdicts = (await parallel(lenses.map((lens) => () =>
        agent(verifyPrompt(f, key, lens), { label: `verify:${key}#${i + 1}:${lens}`, phase: 'Verify', schema: VERDICT_SCHEMA })))).filter(Boolean)
      const yes = verdicts.filter((v) => v.real).length
      const status = verdicts.length === 0 ? 'unverified' : yes === verdicts.length ? 'confirmed' : yes === 0 ? 'rejected' : 'disputed'
      return { key, n: i + 1, status, finding: f, verdicts }
    }))
    return { key, covered: res.covered, dropped: res.dropped, items: items.filter(Boolean) }
  },
)

const all = out.filter(Boolean).flatMap((r) => r.items)
const slim = (x) => ({ key: x.key, n: x.n, title_ko: x.finding.title_ko, file: x.finding.file, line: x.finding.line, why: x.verdicts.map((v) => v.reasoning).join(' / ').slice(0, 400) })
return {
  group,
  coverage: out.filter(Boolean).map((r) => ({ key: r.key, covered: r.covered, dropped: r.dropped })),
  counts: { total: all.length, confirmed: all.filter((x) => x.status === 'confirmed').length, disputed: all.filter((x) => x.status === 'disputed').length, rejected: all.filter((x) => x.status === 'rejected').length, unverified: all.filter((x) => x.status === 'unverified').length },
  confirmed: all.filter((x) => x.status === 'confirmed'),
  disputed: all.filter((x) => x.status === 'disputed' || x.status === 'unverified'),
  rejected: all.filter((x) => x.status === 'rejected').map(slim),
}
