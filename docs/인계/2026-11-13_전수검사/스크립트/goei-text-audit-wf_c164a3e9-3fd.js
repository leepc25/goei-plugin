export const meta = {
  name: 'goei-text-audit',
  description: '괴이봇 지침·로어북 전수검사: 모순·불일치·불합리·부적절·비효율·과토큰을 찾고, 찾은 것마다 따로 검증한다 (읽기 전용)',
  phases: [
    { title: 'Find', detail: '지침·로어북 갈래마다 문제 찾기' },
    { title: 'Verify', detail: '찾은 문제와 고칠 글을 반박 검증' },
  ],
}

const COMMON = `
You are auditing the PROMPT TEXTS of the RisuAI plugin "괴이봇" (Anomaly Sim / 괴이: ANOMALY, a Korean 괴담 role-play bot) in /home/user/goei-plugin. The owner ordered (verbatim): 「이번에 검사할것은 각종 기능 오류 등 뿐만 아니라 로어북 및 지침까지 봐서 고쳐야 한다. 지침간 모순, 불일치, 불합리, 부적절, 비효율, 과토큰 등등」 — i.e. audit and fix the guides (지침) and the lorebook: contradictions between guides, mismatches, unreasonable or inappropriate instructions, inefficiency, too many tokens.

WHERE THE TEXTS LIVE
 - Guides (instructions sent to models): src/data/guides/*.txt, split into named sections and assembled by src/core/guides.ts (DEFAULTS, GUIDE_NAMES, section markers, fillGuide/fillVars placeholders) and by the request builders (src/body.ts, src/core/gnetPrompt.ts, src/core/phonePrompt.ts, src/core/wiki.ts, src/core/shop.ts, src/core/malls.ts, src/core/homeshop.ts, src/core/bmdesk.ts, src/core/consult.ts, src/core/people/request.ts, src/core/people/prompt/*, src/core/people/director.ts, src/core/imgprompt.ts). tests/guide-out.test.mjs and tests/fixtures/guide-out-old.json pin the assembled output; tests/guide-out-calls.mjs and tests/reffn-prompts.mjs can render real requests.
 - Lorebook = world data: src/data/world/agents.json, anomalies.json, orgs.json, sites.json, appendices.json, relations.json (each record: keys / fields / extra …; one pretty-printed file per record is under /tmp/audit_1113/lore/world/<kind>/, index in _index.tsv), plus src/data/guides/_old/faction-original.txt and roster-original.txt (the always-on 📜Faction / 🙂Roster lorebooks), card/extra-lore/*.txt, first scenes in src/data/world/scenes.json and greetings.json. How records are chosen and rendered for a request: src/core/lore.ts, src/core/world/*.ts (virtual.ts, assemble.ts, directory.ts, registry.ts).
 - Ground truth for in-world facts: card/wiki-base.json (the owner's wiki; large — query it with python, do not cat it) and the ORIGINAL card lorebook in dist-test/real-module.json (JSON: module.lorebook[] with comment/content/key; shows what the original author wrote before any Claude "optimisation"). Text written by earlier Claude sessions is NOT authoritative.

STRICTLY READ-ONLY: do NOT edit, create, move or delete anything inside /home/user/goei-plugin; no npm run build, no git checkout/stash/commit, no browser tests. You MAY read/grep, run git log/diff/blame, run one unit test file with \`node --test tests/<name>.test.mjs\`, and write scratch probes ONLY under /tmp/audit_1113/ (e.g. a node script that bundles a request builder with /home/user/goei-plugin/node_modules/esbuild and counts tokens with /home/user/goei-plugin/node_modules/js-tiktoken). Probes under one minute.

WHAT COUNTS AS A FINDING
 1. contradiction — two instructions that cannot both be followed, in the same guide or in guides sent to the same model in the same request, or a guide that contradicts what the code does with the model's answer (tag/format/field the parser does not accept, a placeholder never filled, a limit the code overrides).
 2. mismatch — the same thing named or formatted differently across guides/lore (tag syntax, date/time format, names of people, teams, places, item kinds, currency), a section describing a feature that no longer exists or behaves differently (e.g. NPC photo sending was removed from 괴담톡), stale counts, wrong cross references.
 3. unreasonable — an instruction a model cannot carry out with the information it is given, or that asks the model to decide what the plugin decides in code (mechanics are programmed; the model only voices them), or that fights another feature.
 4. inappropriate — content that violates the owner's rules: any character presented as a minor or school pupil (ALL characters are adults; students are university students; 콘쥬스 is 20 and wears a uniform, not a school uniform), banned words (정부기관/government, 이면/이면세계), screen words 본편/퀵칸/퍽, dialogue EXAMPLES inside guides (the owner forbids example lines in guides), instructions that spell out what a capable model does by itself.
 5. inefficient / over-token — the same rule stated twice in one request, long passages that can be cut with NO change of meaning, sections sent to a model that cannot use them (feature off, wrong call), boilerplate repeated per item, lore fields duplicated between records or between a record and the always-on Faction/Roster text. Give the measured or estimated token saving.
 6. lore errors — facts in a record that contradict card/wiki-base.json or the original card (wrong team, rank, age, relationship, place, ability), a record contradicting another record, broken formatting or leftover template/CBS fragments, keys that can never match or that fire on common words, a person missing from the roster or present twice.

OWNER DECISIONS — do not report things that merely disagree with these, and never propose edits that undo them:
 - Guides stay MINIMAL: write only what the model would not do by itself; never pile on rules (「덕지덕지 붙여서는 안돼」「너무 강제하면 모델 지능이 저하돼」). So do not propose ADDING instructions unless a real contradiction cannot be fixed otherwise. The 갱신기 (updater) guides may be detailed. Default updater guide is the compact one.
 - No dialogue examples in guides. New guide text follows the structure of the existing ones.
 - Shop: SHOP_RULE in shop.txt is the single shared criteria text used by both the main model (MAIN_TAG {rule}) and the updater (<<SHOP_RULE>>); any change must apply to both sides at once. The common shop guide must not get mechanical dice / owner cards.
 - bmdesk.txt MANUAL and the 상담원 dice axes stay exactly as they are (「몰래 흘림」 = leaking company secrets, not the counsellor's own name).
 - 선톡 / 선쪽지 / 단톡 초대: never "always send"; four over-discouraging sentences were deliberately removed on 11-13.
 - 괴담톡: NPC [사진:이름] asset photos were removed on purpose; 괴담넷 photos, 연어 마켓 photos and user uploads stay.
 - Items (approved 11-13): 사용 = operate/apply/eat; 소모 = anything used up by use, MUST carry a count (sets count all), vanishes at 0; 장비 = only worn/strapped things; things merely carried are not gear; 무기 = held to fight. Weights to the gram. Item grade: nobody knows a grade until the item is taken to 본부; the 갱신기 only picks a picture, never assigns a grade, never infers it from adjectives or the source 괴이; the main model is not told to judge it.
 - Main request hand-over kinds: 이번에 일어날 일 / 이미 끝난 일 / 진행 중인 일 / 참고 기록.
 - Boards: 괴담넷 = insiders; 괴담갤 = civilian DC-style board; 세정게 = conspiracy/survivors. 망상홈쇼핑 viewers are mixed.
 - Teams: 종합대응팀 쟈알디(부장)·에일린·스팡달·잼트리(내근)·데드폴·게슈간·로제몬·콘쥬스; 진압팀 고르고디오·큐라스; 격리팀 고그니쟈·데쥬레. 관리국 종로, 백일몽 강남, 협회 영등포. Backgrounds are daytime.
 - 블라렛: the original has no "proud half-vampire" — known, already reported; do not re-report unless still present in current data (then it IS a finding).
 - faction-original.txt and roster-original.txt carry the original author's text: propose only corrections of real errors/duplication there, and mark needs_user_decision = true.
 - Compatibility with old chats/saves is of no concern.

FOR EVERY FINDING give: file, line, the exact current text (old_text: copy verbatim, enough to be unique in the file; for JSON records give the record id and field), the exact replacement (new_text; empty string = delete), why it is wrong (evidence: the conflicting passage with file:line, or the wiki/original source, or the token measurement), severity (high = the model is told something false/contradictory in ordinary play, or a big recurring token waste (>300 tokens per call); medium = a specific but plausible confusion, or 80–300 tokens per call; low = small), and needs_user_decision = true when the edit changes meaning the owner may care about, touches lore facts without a clear source, touches the original-author files, or is a judgement of taste rather than an error.
Edits must be MINIMAL and meaning-preserving unless the finding is itself that the meaning is wrong. Never reword for style. Keep the language of the passage (Korean stays Korean, English stays English). Do not break section markers or placeholders. Report at most 14 findings, most valuable first; in "dropped" say how many weaker candidates you left out and their gist. title_ko = one short plain-Korean sentence a non-programmer can follow.`

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title_ko: { type: 'string' },
          kind: { type: 'string', enum: ['contradiction', 'mismatch', 'unreasonable', 'inappropriate', 'over-token', 'lore-error', 'other'] },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          file: { type: 'string' },
          line: { type: 'integer' },
          record: { type: 'string' },
          old_text: { type: 'string' },
          new_text: { type: 'string' },
          evidence: { type: 'string' },
          token_saving: { type: 'integer' },
          also_change: { type: 'string' },
          needs_user_decision: { type: 'boolean' },
        },
        required: ['title_ko', 'kind', 'severity', 'file', 'line', 'old_text', 'new_text', 'evidence', 'needs_user_decision'],
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
    old_text_found_exactly: { type: 'boolean' },
    final_old_text: { type: 'string' },
    final_new_text: { type: 'string' },
    side_effects: { type: 'string' },
    needs_user_decision: { type: 'boolean' },
    decision_question_ko: { type: 'string' },
  },
  required: ['real', 'confidence', 'severity', 'reasoning', 'old_text_found_exactly', 'final_old_text', 'final_new_text', 'side_effects', 'needs_user_decision'],
}

const AREAS = {
  gmain: { title: 'Guides sent with the MAIN request', files: 'src/data/guides/main.txt common.txt rp.txt directive.txt tag.txt asset.txt (+ src/core/guides.ts, src/body.ts for how and when each section is sent)', focus: 'Read every section. Work out which sections travel together in one main request under default settings and under each feature toggle; look for contradictions and duplicated rules between them (and with the always-on faction-original/roster-original text), instructions about tags whose format differs from what src/core/imgtag.ts, src/core/world/tags.ts, src/core/world/status.ts and the shop/order tag parsers accept, and sections describing removed features.' },
  ggnet: { title: 'Guides for 인터넷 (괴담넷·괴담갤·세정게·연어 마켓·쪽지)', files: 'src/data/guides/gnet.txt (50KB) (+ src/core/gnetPrompt.ts, src/core/gnet.ts parsers, src/core/boards.ts, card/gnet-style.json)', focus: 'Every section of gnet.txt: per-board sections vs shared sections (contradictions, the same rule repeated per board), output format told to the model vs the parser in src/core/gnet.ts, sections sent for a function that cannot use them (refresh vs write vs comment vs DM), board character (who posts where) consistent with the owner definitions, token weight per call.' },
  gcross: { title: 'LENS: contradictions BETWEEN guides', files: 'all of src/data/guides/*.txt', focus: 'Build a table of every rule that appears in more than one guide: tag syntaxes ([shop: …], [사진: …], image tags, status tags, order/ready marks), item kinds and counts, money/points units and formats, date/time formats, how names and honorifics are written, language rules (Korean/English output), length limits, how the user persona may be voiced, what a model may invent. Report every pair that disagrees, quoting both passages. Also report rules that the same model receives twice in one request through two different guides.' },
  gphone: { title: 'Guides for 괴담톡', files: 'src/data/guides/phone.txt (46KB) (+ src/core/phonePrompt.ts, src/core/phone.ts parsers)', focus: 'Every section of phone.txt: reply vs 새 메시지 확인 vs 보기 전용 방 vs group rooms vs invites; output format vs parser; leftovers of the removed NPC photo feature; habit memo rules; 선톡 wording (must not be "always send" nor over-discouraging); duplicated rules across sections sent together; token weight.' },
  gshop: { title: 'Guides for 위키, 상점, 포인트몰 상담, AI 상담', files: 'src/data/guides/wiki.txt shop.txt bmdesk.txt consult.txt (+ src/core/wiki.ts, src/core/shop.ts, src/core/malls.ts, src/core/homeshop.ts, src/core/bmdesk.ts, src/core/consult.ts)', focus: 'Every section: output formats vs parsers, SHOP_RULE used identically on both sides, 우주 쇼핑몰 / 포인트몰 / 망상홈쇼핑 sections consistent with each other and with the item rules, wiki page format vs renderer, consult guide listing settings that exist. bmdesk MANUAL wording is frozen (see decisions) but format/parser mismatches there still count.' },
  gtoken: { title: 'LENS: measured token cost of guides per call', files: 'all guides + the request builders; probes: tests/guide-out-calls.mjs, tests/reffn-prompts.mjs, tests/guide-out.test.mjs (read them to learn how to render requests)', focus: 'MEASURE, do not guess: write a probe under /tmp/audit_1113/gtoken/ that bundles the builders (or reuses the test helpers) and renders, for default settings, each kind of request the plugin makes (main request additions, 괴담넷 refresh/write/comment/DM per board, 괴담톡 reply/check/view-only, 위키, 상점 진열/문의/상담, 우주 쇼핑몰, 포인트몰 + 상담, 망상홈쇼핑 편성/채팅 반응, 갱신기 compact and detailed, Director, 라우터, 이미지, AI 상담). Count tokens of the guide part of each with js-tiktoken (o200k). Report a table in "covered". Findings: the biggest avoidable costs — sections included in a call that cannot use them, the same block included twice, a compact guide that is not much smaller than the detailed one, per-turn calls carrying one-off setup text. For each give exact cut (old_text → new_text) or, when the fix is in code (a builder including a section needlessly), say so in also_change and set old_text to the section marker line.' },
  gupdc: { title: '갱신기 guide (compact, the default)', files: 'src/data/guides/updater-compact.txt (80KB) (+ src/core/people/updater.ts parser, src/core/people/request.ts, src/core/people/types.ts, src/core/items.ts applyItemChanges, src/core/points.ts, src/core/wallet.ts)', focus: 'Every section: output block formats vs the parser in updater.ts (field names, separators, allowed values), rules stated twice, rules contradicting the approved item definitions or grade rule, sections sent although their feature is off (check request.ts/people settings gating), anything telling the 갱신기 to decide what code decides. This is the DEFAULT guide and is 80KB: find real token waste (duplicated explanations, repeated format reminders) with exact cuts.' },
  gupdd: { title: '갱신기 guide (detailed)', files: 'src/data/guides/updater-detailed.txt (111KB) (+ the same parsers as the compact one)', focus: 'Same as the compact audit, for the detailed guide: formats vs parser, duplicates, contradictions inside the guide, sections describing things the code no longer supports.' },
  gupdp: { title: '갱신기 compact vs detailed, extras, Director', files: 'src/data/guides/updater-compact.txt updater-detailed.txt updater-extra.txt director-extra.txt directive.txt (+ src/core/people/director.ts, router.ts, consolidate.ts)', focus: 'Diff the compact and detailed guides section by section (script it): a rule present in one and absent or DIFFERENT in the other (formats, allowed values, limits, item/points/wallet rules) is a mismatch unless the difference is only verbosity. updater-extra (덧붙임·정리) and director-extra: consistent with both; consolidation format vs parser; Director/router output vs parser.' },
  lagA: { title: 'Lore: agents (first half) vs roster, wiki, original', files: '/tmp/audit_1113/lore/world/agents/ — the FIRST 28 files listed in _index.tsv; src/data/guides/_old/roster-original.txt; src/data/world/relations.json; card/wiki-base.json; dist-test/real-module.json', focus: 'For each agent record: compare with that person in roster-original.txt, relations.json, the wiki and the original card entry. Report wrong or contradictory facts (team, rank, age, appearance, abilities, relationships, speech), anything implying a minor, text softened or reversed versus the original, duplicated passages inside a record, fields repeating what the always-on roster already says (token waste — quantify), leftover template fragments, keys that fire on common words or can never match.' },
  lagB: { title: 'Lore: agents (second half) vs roster, wiki, original', files: '/tmp/audit_1113/lore/world/agents/ — the files from the 29th to the last in _index.tsv; src/data/guides/_old/roster-original.txt; src/data/world/relations.json; card/wiki-base.json; dist-test/real-module.json', focus: 'Same method as for the first half: per record compare with roster, relations, wiki, original card. Include 블라렛 (check whether "proud half-vampire" style wording is still in the current data).' },
  lorg: { title: 'Lore: organisations, sites, appendices, always-on Faction text', files: '/tmp/audit_1113/lore/world/orgs/ sites/ appendices/; src/data/guides/_old/faction-original.txt; card/extra-lore/*.txt; card/wiki-base.json; dist-test/real-module.json', focus: 'Per record compare with faction-original.txt, the wiki and the original card: locations (관리국 종로, 백일몽 강남, 협회 영등포), structures, department lists, variants, banned words, contradictions between an org record and the Faction text sent with it, duplication (token waste), extra-lore files consistent with the records, appendices attached to the right parent.' },
  lan1: { title: 'Lore: anomalies (first third)', files: '/tmp/audit_1113/lore/world/anomalies/ — files 1–21 of _index.tsv; card/wiki-base.json; dist-test/real-module.json', focus: 'Per anomaly record: internal contradictions (rules of the anomaly that conflict, grades/classes inconsistent between fields), facts differing from the wiki/original, references to agents/teams/places that are wrong per the team list, leftover template fragments, heavy duplication inside a record (the anomaly file is 560KB in total: quantify real waste), keys that misfire.' },
  lan2: { title: 'Lore: anomalies (second third)', files: '/tmp/audit_1113/lore/world/anomalies/ — files 22–42 of _index.tsv; card/wiki-base.json; dist-test/real-module.json', focus: 'Same method as the first third.' },
  lan3: { title: 'Lore: anomalies (last third)', files: '/tmp/audit_1113/lore/world/anomalies/ — files 43–63 of _index.tsv; card/wiki-base.json; dist-test/real-module.json', focus: 'Same method as the first third.' },
  lplumb: { title: 'LENS: how lore reaches the model (selection, keys, budget)', files: 'src/core/lore.ts src/core/world/virtual.ts assemble.ts directory.ts registry.ts faction.ts roster-v.ts src/core/refs.ts src/core/lorebooks.ts tools/build_lite_card.py tools/migrate_world.py card/*.json', focus: 'Trace how a record becomes text in a request: which fields are rendered, in what order, with what headers; whether the same record can be sent twice in one request (slot + 참조 로어북 + always-on roster), whether records exist that can never be selected (no keys, wrong kind), CONFIRM_KEYS still matching current record names, the 90% budget rule, whether editing src/data/world/*.json is the right place to fix lore (is it regenerated by any build step? if so, where must a fix go), appendices attach rules, virtual entries vs card lorebook entries the user added. Report plumbing defects and any systematic token waste in the rendering (repeated headers, empty fields rendered, both Korean and English copies sent).' },
  lscene: { title: 'First scenes and scenario data (mechanical check only)', files: 'src/data/world/scenes.json src/data/world/greetings.json src/data/scenarios.json src/data/install/greetings.json card/start-items.json card/carry.json', focus: 'Do NOT judge prose style. Check mechanically (script it): image tags (<img=Name_expr>) whose asset name does not exist in the card pictures list (src/data/install/pictures.json) or is misspelled; index entries pointing at wrong/missing texts; ko/en pairs missing; lore lists naming records that do not exist; banned words; characters stated as minors/pupils; faction start scenes count (owner rule: exactly 5 faction start images); start items naming item kinds that the item rules do not know. Report concrete broken references with the exact key.' },
}

const GROUPS = {
  T1: ['gmain', 'ggnet', 'gcross'],
  T2: ['gphone', 'gshop', 'gtoken'],
  T3: ['gupdc', 'gupdd', 'gupdp'],
  T4: ['lagA', 'lagB', 'lorg'],
  T5: ['lan1', 'lan2', 'lan3'],
  // 11-13 사용량 한도로 못 돌린 것 (다음 계정이 돌림)
  MISS: ['gupdp', 'gtoken', 'lorg', 'lan3'],
  MISS1: ['gupdp', 'gtoken'],
  MISS2: ['lorg', 'lan3'],
  T6: ['lplumb', 'lscene'],
}

const group = (args && args.group) || 'T1'
const keys = GROUPS[group]
if (!keys) throw new Error('unknown group ' + group)

function finderPrompt(key) {
  const a = AREAS[key]
  return `${COMMON}

YOUR ASSIGNMENT (key "${key}"): ${a.title}
Files: ${a.files}
What to dig into: ${a.focus}

Method: read your files completely (no sampling — they are your responsibility), script what can be scripted (diffs, duplicate-passage detection, cross references, token counts) under /tmp/audit_1113/${key}/, and confirm every candidate against the code or the sources before reporting. In "covered" list what you read in full and what you measured.`
}

function verifyPrompt(f, key) {
  return `${COMMON}

YOU ARE A VERIFIER, not a finder. Another agent (area "${key}") reported the finding below with a proposed edit. Check it independently and try to REFUTE it:
 - Open the file: is old_text really there verbatim (old_text_found_exactly)? If the passage exists but the quote is inexact, put the exact current text in final_old_text.
 - Is the claimed problem real? Read the other passage / parser / source it cites. For "contradiction": are both passages really sent to the same model in the same request? For "over-token": does the cut lose any instruction the model needs or any marker/placeholder the code needs (grep the code for strings from the passage)? For lore: does the wiki or original card really say what is claimed (query card/wiki-base.json / dist-test/real-module.json yourself)?
 - Does the proposed edit conflict with an owner decision, add rules, change style only, or change meaning beyond the stated problem? Then real=false, or fix the edit.
 - Would the edit break tests/guide-out.test.mjs or other tests that pin text? Name them in side_effects (that is acceptable, but must be known), together with any code or twin text (compact/detailed, both shop sides) that must change at the same time.
 Give the final edit you would stand behind in final_old_text / final_new_text (verbatim, minimal; empty final_new_text = delete). Set real=false when you cannot confirm the problem from the files. needs_user_decision=true when it is a judgement about lore facts without a clear source, about the original author's text, or about taste — then write decision_question_ko (short plain Korean, options, your recommendation).

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
      const v = await agent(verifyPrompt(f, key), { label: `verify:${key}#${i + 1}`, phase: 'Verify', schema: VERDICT_SCHEMA })
      const status = !v ? 'unverified' : v.real ? 'confirmed' : 'rejected'
      return { key, n: i + 1, status, finding: f, verdict: v }
    }))
    return { key, covered: res.covered, dropped: res.dropped, items: items.filter(Boolean) }
  },
)

const all = out.filter(Boolean).flatMap((r) => r.items)
return {
  group,
  coverage: out.filter(Boolean).map((r) => ({ key: r.key, covered: r.covered, dropped: r.dropped })),
  counts: { total: all.length, confirmed: all.filter((x) => x.status === 'confirmed').length, rejected: all.filter((x) => x.status === 'rejected').length, unverified: all.filter((x) => x.status === 'unverified').length },
  confirmed: all.filter((x) => x.status === 'confirmed'),
  unverified: all.filter((x) => x.status === 'unverified'),
  rejected: all.filter((x) => x.status === 'rejected').map((x) => ({ key: x.key, n: x.n, title_ko: x.finding.title_ko, file: x.finding.file, why: (x.verdict && x.verdict.reasoning || '').slice(0, 400) })),
}
