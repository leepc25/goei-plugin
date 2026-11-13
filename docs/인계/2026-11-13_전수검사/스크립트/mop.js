export const meta = {
  name: 'goei-mopup',
  description: '괴이봇 전수검사 마무리: 앞 차례 일꾼들이 남긴 나머지 고침을 파일 묶음 하나씩 적용',
  phases: [{ title: 'Mop', detail: '남은 고침' }],
}
const GROUPS = [{"key": "host", "files": ["src/body.ts", "src/host/trace.ts", "src/host/install.ts", "src/ui/update.ts", "src/host/unsent.ts", "src/core/asset.ts", "src/host/asset.ts"], "ids": ["pipeline#11", "images#5", "images#8", "pipeline#10", "shell#6", "shell#7", "asyncl#10", "wiki#8", "gmain#9"]}, {"key": "core", "files": ["src/core/guides.ts", "src/core/bmdesk.ts", "src/data/guides/bmdesk.txt", "src/core/gnetPrompt.ts", "src/core/wiki.ts", "src/ui/wiki.ts", "src/core/people/sexual.ts", "src/core/people/director.ts", "src/core/world/statuscols.ts", "src/core/items.ts", "src/core/lore.ts", "src/core/advanced.ts"], "ids": ["shop#7", "wording#4", "shop#14", "wiki#7", "gcross#7", "gcross#10", "gcross#4", "gmain#6", "gmain#12", "lplumb#14", "pipeline#9"]}, {"key": "ui", "files": ["src/ui/editor/guides.ts", "src/ui/editor/manage.ts", "src/ui/editor/index.ts", "src/ui/editor/start.ts", "src/ui/editor/flow.ts", "src/ui/gnet.ts", "src/ui/famtable.ts", "src/core/setdef/gnet.ts", "src/core/setdef/people.ts", "src/core/setdef/homeshop.ts", "src/core/world/directory.ts", "src/core/world/draft.ts", "src/ui/setrow.ts", "src/ui/hsplayer.ts", "src/core/points.ts", "src/host/people.ts", "src/ui/malls.ts", "src/ui/shop.ts"], "ids": ["hardcode#4", "guides#3", "wording#1", "wording#8", "wording#9", "dirstatus#10", "dirstatus#11", "editor#13", "mainreach#3", "gnet#12", "hardcode#14", "wording#13", "wording#7", "editor#10", "css#2", "malls#11", "items#7"]}, {"key": "card", "files": ["card/extra-lore", "tools/build_lite_card.py", "src/data/world/scenes.json"], "ids": ["lplumb#8", "lscene#13", "wording#2"]}]
const g = GROUPS.find((x) => x.key === (args && args.group))
if (!g) throw new Error('unknown group')
const SCHEMA = { type: 'object', properties: { results: { type: 'array', items: { type: 'object', properties: {
  id: { type: 'string' }, status: { type: 'string', enum: ['fixed', 'skipped', 'deferred', 'already_fixed'] },
  what: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, deferred_change: { type: 'string' } }, required: ['id', 'status', 'what'] } } }, required: ['results'] }
const prompt = `You are finishing fixes in the RisuAI plugin "괴이봇" in /home/user/goei-plugin (branch claude/project-thread-kyw9bz, HEAD 68b861121). Earlier agents fixed audit findings but could only edit their own files; they wrote down the exact REMAINING CHANGE for files they did not own. Apply those remaining changes now.

For each id run: python3 /tmp/audit_1113/fix/show3.py <id>
It prints the finding and, under --REMAINING CHANGE, the exact change still to apply (and --BEFORE/AFTER for already approved text edits whose twin fallback in code must match). Re-read the current code first; if a change is already present, report already_fixed. Apply only the parts that lie in your files; anything else stays in deferred_change.

Rules: the owner already approved every text change named here (the code twins/fallbacks must now match the approved guide text exactly, byte for byte). Do not invent new wording, do not change anything beyond the remaining change. Never touch the sentences about minors (미성년/minor/미확인). Never delete files. Short Korean code comments ending with "(전수검사 11-13)".
FILE OWNERSHIP (strict, other agents run in parallel): you may edit ONLY ${g.files.join(', ')} (a folder means files inside it). Do NOT edit tests/ at all — a later agent fixes tests; write needed test edits into deferred_change.
FORBIDDEN: git commit/checkout/stash/reset/restore, npm run build, node scripts/build.mjs, release scripts, browser tests, running tools/build_lite_card.py.
CHECK: run npx tsc --noEmit once at the end (ignore errors in files you do not own); validate edited JSON.
ITEMS: ${g.ids.join(' ')}`
const r = await agent(prompt, { label: `mop:${g.key}`, phase: 'Mop', schema: SCHEMA })
return { group: g.key, results: r ? r.results : null }
