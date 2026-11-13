// 전수검사 11-13 고침 확인: 추가 규칙 저장 순서(guides#9), 호출 흐름 「지난 턴」 이름표(editor#8)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix2/editor2';
await mkdir(dir, { recursive: true });

// 저장소(host/prefs)는 가짜로: 저장된 목록을 globalThis 에 남긴다
const stubPrefs = {
  name: 'stub-prefs',
  setup(b) {
    b.onResolve({ filter: /host\/prefs$/ }, () => ({ path: 'prefs-stub', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: `export async function savePrefs(change) { const p = change(globalThis.__prefs ?? {}); globalThis.__prefs = p; return p; }
export async function loadPrefs() { return globalThis.__prefs ?? {}; }
export async function saveVarDefaults() {}
export function loadVarDefaults() { return {}; }`,
      loader: 'js',
    }));
  },
};
await build({
  entryPoints: { rules: 'src/ui/editor/rules.ts', progress: 'src/core/progress.ts' },
  outdir: dir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, loader: { '.txt': 'text' }, logLevel: 'silent', plugins: [stubPrefs],
});
const R = await import(pathToFileURL(resolve(join(dir, 'rules.mjs'))));
const P = await import(pathToFileURL(resolve(join(dir, 'progress.mjs'))));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('추가 규칙: 글을 친 직후 켜기·새 규칙을 눌러도 0.4초 뒤 되돌려지지 않는다', async () => {
  globalThis.__prefs = {};
  await R.ruleAction('ed-rule-new');
  const [r1] = globalThis.__prefs.rules;
  assert.equal(r1.on, true);
  R.ruleInput('ed-rule-text', r1.id, '한 번에 세 문장까지');
  await R.ruleAction('ed-rule-on', r1.id);
  await R.ruleAction('ed-rule-new');
  await wait(500);
  const saved = globalThis.__prefs.rules;
  assert.equal(saved.length, 2, '새 규칙이 남는다');
  assert.equal(saved[0].on, false, '끈 것이 남는다');
  assert.equal(saved[0].text, '한 번에 세 문장까지', '친 글도 남는다');
});

test('추가 규칙: 글만 치면 0.4초 뒤 저장된다', async () => {
  const id = globalThis.__prefs.rules[1].id;
  R.ruleInput('ed-rule-title', id, '대사 길이');
  await wait(500);
  assert.equal(globalThis.__prefs.rules[1].title, '대사 길이');
});

test('호출 흐름 지난 턴: 다시 묻기·다시 보기·통합 뒤 따로 꼬리를 뗀 이름으로 센다', () => {
  const b = P.baseLabel;
  assert.equal(b('갱신기 다시 묻기 1'), '갱신기');
  assert.equal(b('괴담톡 확인 다시 보기 2'), '괴담톡 확인');
  assert.equal(b('괴담톡+괴담넷 통합 다시 묻기'), '괴담톡+괴담넷 통합');
  assert.equal(b('괴담톡 (통합 뒤 따로)'), '괴담톡');
  assert.equal(b('라우터'), '라우터');
});
