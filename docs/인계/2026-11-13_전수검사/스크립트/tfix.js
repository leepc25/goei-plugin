export const meta = {
  name: 'goei-testfix',
  description: '괴이봇 전수검사 마무리: 고친 코드에 맞게 단위 시험 손보기 (시험 파일 묶음 하나씩)',
  phases: [{ title: 'Tests', detail: '실패한 단위 시험' }],
}
const GROUPS = {
  guideout: { files: ['tests/guide-out.test.mjs', 'tests/fixtures/guide-out-old.json'], fails: ['#393 옮긴 절: 기본 지침의 글이 옛 소스 글자와 같다', '#395 기본 지침으로 만든 요청문 = 옮기기 전 코드가 만들던 요청문', '#397 절을 고치면 그 절이 들어가는 요청문이 바뀐다 (절마다)'] },
  prompts: { files: ['tests/gnet.test.mjs', 'tests/wiki.test.mjs', 'tests/phone.test.mjs', 'tests/fix3-text.test.mjs'], fails: ['gnet.test #390 prompts from the real card', 'wiki.test #932 wiki prompt from the real card', 'phone.test #717 reply prompt picks sections and carries the room packet', 'fix3-text #349 우주 쇼핑몰만 흥정 문장이 없다 (note: Bm now drops TALK sections entirely, approved 나-52, so Bm has no Haggling; assert Bm has no TALK section instead and Shop has Haggling, Cos lacks it)'] },
  items: { files: ['tests/items-truth.test.mjs', 'tests/items.test.mjs', 'tests/itemstate.test.mjs', 'tests/wallet.test.mjs', 'src/core/wallet.ts'], fails: ['items-truth #490 truth: 안 쓰는 턴엔 Really 없음', 'items.test #493 같은 이름이 또 들어오면 새 줄 없이 갱신 (store purchases are now separate rows, items#? fix: `if (found && e.from !== \'store\')`)', "itemstate #512 갈래 표 (approved: '도구 → 사용', '기기 → 사용')", 'ALSO (src): src/core/wallet.ts:157 field-trade helper calls addWalletEntry without the alive set; pass it through if the caller has one (items#7), keep behaviour otherwise'] },
  people: { files: ['tests/people-qual.test.mjs', 'tests/people-sexual.test.mjs', 'tests/people-updater.test.mjs'], fails: ['people-qual #645 갱신기: 정성 모드면 자료에 계기·단계·숫자가 없고', 'people-sexual #657 지침: 켜진 칸·발정모드에 따라 절이 조립되고', 'people-updater #672 문서·의심: 종류 검사, 꺼진 기능, 의심 해소는 접는다'] },
  world: { files: ['tests/world-data.test.mjs', 'tests/fix3-misc.test.mjs', 'tests/qc-settings-world-browser.mjs', 'tests/fix2-pipe.test.mjs'], fails: ['world-data #935 기본 세계: 카드 로어북에서 옮긴 기록 수와 칸 (an appendix record 관리국 · 하나의 건물 was added by an approved lore fix)', 'world-data #937 가상 로어북: 빈 카드에도 기본 세계가 폴더 항목으로 붙고', 'fix3-misc #327 실패 기록의 게시판 이름 (wording#1 now uses boardFailures().map((f) => fail(f.name, f)).join(\'\') and clearBoardFailures())', 'qc-settings-world-browser.mjs (do NOT run it, only edit): ed-delete now needs a second click on [data-action="ed-delete-yes"] (lines ~91,114,201); dir-base-del now uses data-value "ask|<name>" then "yes|<name>" (~300); dir-scene-del likewise ask|… then yes|…', 'fix2-pipe: add a small test that traceMain(msgs, [], [\'abc\']) sets main.added > 0 (pipeline#10), only if easy'] },
}
const g = GROUPS[args && args.group]
if (!g) throw new Error('unknown group')
const SCHEMA = { type: 'object', properties: { results: { type: 'array', items: { type: 'object', properties: {
  test: { type: 'string' }, status: { type: 'string', enum: ['test_updated', 'regression_reported', 'already_passing', 'skipped'] },
  why: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, src_fix_needed: { type: 'string' } }, required: ['test', 'status', 'why'] } } }, required: ['results'] }
const prompt = `RisuAI plugin "괴이봇" in /home/user/goei-plugin (branch claude/project-thread-kyw9bz). An audit changed source code and guide/lore text (all text edits were approved by the owner). Some unit tests now fail. Your job: make the failing tests in your group pass by bringing the TEST up to date where the source change was intended, and REPORT (not fix) real regressions.

How to decide: for each failing assertion, find which source change caused it (git diff HEAD~3 -- src/ and git diff -- src/ show recent changes; commits 1098abea4, 68b861121 and the uncommitted work are the audit fixes). Notes from the fixing agents about needed test edits (guide-out LATER pairs, fixture section bodies, expected counts) are in /tmp/audit_1113/fix/test_deferred.md — use the ones that concern your files. If the change was a deliberate audit fix (approved text, new section, changed count, new behaviour described in those notes or in the commit), update the test expectation to the new output, minimally, keeping the test's intent. If the new output looks like an accidental breakage (e.g. a missing section that should be there, a twin fallback not matching guide text, a crash), do not touch the test: status regression_reported with the exact src fix in src_fix_needed.
Unit tests import the built bundle in dist-test, which is current. Do NOT run the build (other agents read dist-test at the same time) — except the items group, which may run node scripts/build.mjs once after editing src/core/wallet.ts. Run only your test files: node --test <file>. tests/realcard.mjs gives the real card path.
Rules: never weaken a test to pass trivially (no deleting assertions wholesale, no skip); never touch sentences about minors (미성년/minor/미확인); never delete files; no git commit/checkout/stash/reset/restore; no release scripts; do not run browser tests.
FILE OWNERSHIP (strict, other agents run in parallel): edit ONLY ${g.files.join(', ')}.
FAILING TESTS IN YOUR GROUP:
- ${g.fails.join('\n- ')}`
const r = await agent(prompt, { label: `tests:${args.group}`, phase: 'Tests', schema: SCHEMA })
return { group: args.group, results: r ? r.results : null }
