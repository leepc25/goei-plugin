// 전수검사 11-13 고침 확인: 지침 칸에 ##·### 줄을 쳐도 다른 절을 덮지 않는다(guides#1), 저장 중에 친 글이 남는다(guides#8),
// 머리 토큰 수는 입력이 멈춘 뒤 센다(guides#6·perf#3)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix2/editor';
await mkdir(dir, { recursive: true });

// 저장소(host/prefs)는 가짜로: 저장은 globalThis.__hold 가 풀릴 때까지 기다린다
const stubPrefs = {
  name: 'stub-prefs',
  setup(b) {
    b.onResolve({ filter: /host\/prefs$/ }, () => ({ path: 'prefs-stub', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: `export async function savePrefs(change) { if (globalThis.__hold) await globalThis.__hold; const p = change(globalThis.__prefs ?? {}); globalThis.__prefs = p; return p; }
export async function loadPrefs() { return globalThis.__prefs ?? {}; }
export async function saveVarDefaults() {}
export function loadVarDefaults() { return {}; }`,
      loader: 'js',
    }));
  },
};
await build({
  entryPoints: { guides: 'src/ui/editor/guides.ts', core: 'src/core/guides.ts' },
  outdir: dir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, loader: { '.txt': 'text' }, logLevel: 'silent', plugins: [stubPrefs],
});
const G = await import(pathToFileURL(resolve(join(dir, 'guides.mjs'))));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 화면 글칸처럼: 그린 때의 칸 순번과 본문 */
function draw(name) {
  const html = G.guidePage(name);
  const boxes = [...html.matchAll(/data-input="ed-guide-sec" data-key="([^"]+)"[^>]*>\n([\s\S]*?)<\/textarea>/g)].map((m) => ({ key: m[1], body: m[2].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&') }));
  return boxes;
}

test('지침 칸 본문에 ### 줄을 한 글자씩 쳐도 절이 불어나지 않고, 아래 칸이 다른 절을 덮지 않는다', () => {
  const name = 'RP';
  const before = G.guidePage(name) && draw(name);
  assert.ok(before.length >= 3, 'RP 는 절이 여럿');
  const start = before.map((b) => b.body);
  const add = '\n### My rule\n- be brief';
  let v = before[1].body;
  for (const ch of add) {
    v += ch;
    G.guideInput('ed-guide-sec', before[1].key, v);
  }
  // 아래 칸에 한 글자
  G.guideInput('ed-guide-sec', before[2].key, `${before[2].body}!`);
  const draft = G.guideUi.draft[name];
  assert.equal((draft.match(/### My rule/g) ?? []).length, 1, '친 제목은 한 번만');
  assert.ok(draft.includes(`${start[2]}!`), '아래 절 본문은 그대로에 「!」만 붙는다');
  for (const [i, b] of start.entries()) if (i !== 1 && i !== 2) assert.ok(draft.includes(b), `${i}번 절이 남는다`);
  // 다시 그리면 친 제목이 제 절이 된다
  const after = draw(name);
  assert.equal(after.length, before.length + 1);
});

test('지침 저장 중에 더 친 글은 지우지 않는다', async () => {
  const name = 'Tag';
  const boxes = draw(name);
  G.guideInput('ed-guide-sec', boxes[0].key, `${boxes[0].body}A`);
  let release;
  globalThis.__hold = new Promise((r) => { release = r; });
  const saving = G.guideAction('ed-guide-save', name);
  G.guideInput('ed-guide-sec', boxes[0].key, `${boxes[0].body}AB`);
  release();
  await saving;
  globalThis.__hold = undefined;
  assert.ok(G.guideUi.draft[name]?.includes(`${boxes[0].body}AB`), '더 친 글이 남아 다음 저장을 기다린다');
  await G.guideAction('ed-guide-save', name);
  assert.ok(globalThis.__prefs.guides[name].includes(`${boxes[0].body}AB`), '다음 저장이 넣는다');
  assert.equal(G.guideUi.draft[name], undefined);
});

test('머리 토큰 수는 입력이 멈추고 나서 센다', async () => {
  const name = 'RP';
  const boxes = draw(name);
  const tok = { textContent: '이전' };
  const root = { querySelector: (s) => (s === '.gw-head .gw-tokens' ? tok : s.startsWith('[data-key^="RP|"]') ? {} : null) };
  G.guideBarSync(root, name);
  G.guideBarSync(root, name);
  assert.equal(tok.textContent, '이전', '바로는 세지 않는다');
  await wait(400);
  assert.match(tok.textContent, /토큰$/);
  // 그새 다른 지침으로 옮겼으면 쓰지 않는다
  tok.textContent = '다른';
  G.guideBarSync({ querySelector: (s) => (s === '.gw-head .gw-tokens' ? tok : null) }, name);
  await wait(400);
  assert.equal(tok.textContent, '다른');
  void boxes;
});
