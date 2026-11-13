// 전수검사 11-13 · ui/app.ts 고침 점검: 앞뒤 기록 열쇠, 인터넷 창만, Esc, 「창을 열 때」, 배색, 입력 칸 지키기.
// app.ts 는 화면·Risu 에 묶여 있어 직접 불러오지 않는다: 기록 클래스는 묶어 돌리고 나머지는 소스로 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix2/app';
await mkdir(dir, { recursive: true });
await build({
  entryPoints: ['src/core/navhist.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const { NavHistory } = await import(pathToFileURL(join(dir, 'core/navhist.mjs')));
const src = await readFile(new URL('../src/ui/app.ts', import.meta.url), 'utf8');

// app.ts navState 의 위키 열쇠와 같은 모양 (검색 화면에서만 q)
const wikiKey = (w) => ({ tab: 'wiki', b: 'wk', bt: 1, w: { view: w.view, title: w.title, list: false, ...(w.view === 'find' ? { q: w.query } : {}) } });

test('위키 검색 뒤 뒤로: 대문에서 상황판까지 간다 (shell#1)', () => {
  assert.match(src, /list: wiki\.listOpen, \.\.\.\(wiki\.view === 'find' \? \{ q: wiki\.query \} : \{\}\)/);
  const h = new NavHistory();
  const wiki = { view: 'home', title: '', query: '' };
  h.record({ tab: 'board' });
  h.record(wikiKey(wiki));
  Object.assign(wiki, { view: 'find', query: '에일' });
  h.record(wikiKey(wiki));
  // 뒤로 → 대문 (applyNav 는 find 가 아니면 query 를 그대로 둔다)
  const s = h.go(-1);
  Object.assign(wiki, { view: s.w.view, title: s.w.title });
  h.record(wikiKey(wiki));
  assert.equal(h.can(1), true, '앞으로 기록이 남는다');
  assert.deepEqual(h.go(-1), { tab: 'board' });
});

test('전체 기록에 인터넷 탭 id, 탭 기록에는 넣지 않는다 (shell#8)', () => {
  assert.match(src, /bt\?: number;/);
  assert.match(src, /s\.bt = curTab\(\)\.id;/);
  assert.match(src, /br\.tabs\.findIndex\(\(t\) => t\.id === s\.bt\)/);
  assert.match(src, /const \{ bt: _bt, \.\.\.ts \} = navState\(\);\s*recordTab\(ts\);/);
});

test('인터넷 창만: 괴담넷·위키로 가도 그대로 (shell#9)', () => {
  assert.doesNotMatch(src, /netSolo && tab === 'net'/);
  assert.equal(src.match(/netSolo && inBrowser\(\)/g)?.length, 2);
});

test('Esc: 아바타 창·로그인 창은 상태로 닫는다 (shell#10, peopleui#9)', () => {
  const esc = src.slice(src.indexOf("if (ev.key !== 'Escape') return;"), src.indexOf('void close();\n  });'));
  const look = esc.indexOf("if (lookUi.open) return void handle('look-close');");
  const login = esc.indexOf("br.login) return void handle('br-login');");
  const pop = esc.indexOf("document.querySelector('.gx-agpop')");
  assert.ok(look > 0 && login > look && pop > login);
  assert.match(src, /if \(action === 'ed-open'\) \{\n.*\n\s*lookUi\.open = false;/);
});

test('「창을 열 때」: 기록 있는 탭·창 다시 열기에도 (shell#2)', () => {
  assert.match(src, /if \(s\) \{[^}]*applyNav\(s\);\s*siteOpened\(\);/);
  assert.match(src, /opts\.check !== false && v\.kind === 'started'/);
  assert.equal(src.match(/quietIfNotLite: true, check: false/g)?.length, 3);
});

test('불러오는 중·오류는 지금 배색 그대로 (shell#11)', () => {
  assert.match(src, /view\.kind === 'loading' \|\| view\.kind === 'error'\) return currentTheme\(\);/);
});

test('채팅을 바꾸면 인터넷 화면 탭을 지금 탭에 맞춘다 (shell#14)', () => {
  assert.match(src, /restoreTabs\([^\n]*\n[^\n]*tabsSaved = tabsJson\(\);[\s\S]{0,300}applyNavState\(s\);\s*else tab = siteTab\(curTab\(\)\.site\);/);
});

test('상태에 없는 입력 칸 값·커서를 지킨다 (shell#5)', () => {
  assert.match(src, /const DRAFT_SEL = '\[data-it-form\] \[name\], input\[name="wt-adj"\], input\[name="br-nick"\]';/);
  assert.match(src, /root\.dataset\.dk === dKey/);
  assert.match(src, /root\.dataset\.dk = dKey;/);
});
