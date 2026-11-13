// 전수검사 11-13 · 3차 고침 점검: 기본값 불러오기(지우기), 가계부 정리, 그림 찾기 기억, 폰 「인터넷 접속」 줄바꿈, 실패 기록 사이트 이름.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix3/misc';
await mkdir(dir, { recursive: true });
await build({
  entryPoints: ['src/core/wallet.ts', 'src/core/iconmatch.ts', 'src/core/items.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const W = await import(pathToFileURL(join(dir, 'core/wallet.mjs')));
const I = await import(pathToFileURL(join(dir, 'core/iconmatch.mjs')));
const items = await import(pathToFileURL(join(dir, 'core/items.mjs')));
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), 'utf8');

test('기본값 불러오기: 저장값 없는 항목은 지운다 (setwire#1)', async () => {
  const settings = await read('src/ui/settings.ts');
  const defaults = await read('src/ui/defaults.ts');
  assert.doesNotMatch(settings, /loadVarDefaults\(/);
  assert.doesNotMatch(defaults, /loadVarDefaults\(/);
  assert.match(settings, /const r = varDefaultsToLoad\(ALL_PREFIXES, chat\.scriptstate\);/);
  assert.match(settings, /for \(const k of \[\.\.\.Object\.keys\(vars\), \.\.\.r\.drop\]\) before\[k\] = prev\?\.\[k\];/);
  assert.match(settings, /if \(r\.drop\.length\) chat\.scriptstate = base;/);
  assert.match(defaults, /for \(const k of r\.drop\) delete ss\[k\];/);
  // 빈 글이면 소지 칸·한도가 최솟값, 지우면 기본값
  assert.equal(items.itemSlots({ $it_slots: '' }) < items.itemSlots({}), true);
});

test('가계부 400줄 정리: 잔고가 그대로, 죽은 거래부터 (items#7)', () => {
  const alive = new Set(['a1', 'last']);
  let w = { start: 0, log: [] };
  w = W.addWalletEntry(w, { anchor: 'a1', amount: -100000, memo: '큰 지출', src: 'story' }, alive);
  for (let i = 0; i < 300; i++) w = W.addWalletEntry(w, { anchor: `dead${i}`, amount: 1000, memo: `d${i}`, src: 'story' }, alive);
  for (let i = 0; i < 150; i++) w = W.addWalletEntry(w, { anchor: '', amount: 10, memo: `m${i}`, src: 'manual', id: `m${i}` }, alive);
  const bal = (x) => W.walletBalance(x, alive);
  assert.equal(w.log.length, 400);
  assert.equal(bal(w), -100000 + 1500);
  assert.ok(w.log.some((e) => e.anchor === 'a1'), '살아 있는 큰 지출은 남는다');
  for (let i = 0; i < 300; i++) w = W.addWalletEntry(w, { anchor: 'last', amount: 1, memo: `l${i}`, src: 'story' }, alive);
  assert.equal(w.log.length, 400);
  assert.equal(bal(w), -100000 + 1500 + 300, '살아 있는 거래를 빼도 start 에 합쳐 잔고 그대로');
  assert.equal(w.log.at(-1).memo, 'l299', '방금 넣은 줄은 남는다');
  // alive 를 모르면 자르지 않는다
  const w2 = W.addWalletEntry(w, { anchor: 'last', amount: 5, memo: 'x', src: 'story' });
  assert.equal(w2.log.length, 401);
  // 읽을 때도 자르지 않는다
  assert.equal(W.readWallet(W.walletVars(w2)).log.length, 401);
});

test('그림 찾기 바뀜 횟수: 같은 대체 표·같은 분류 설정은 그대로 (perf#5)', async () => {
  const g0 = I.iconGen();
  I.setIconAliases('');
  I.setIconAliases(I.ICON_ALIAS_DEFAULT);
  I.setIconPool(true);
  assert.equal(I.iconGen(), g0);
  I.setIconAliases('외투 → 코트');
  assert.equal(I.iconGen(), g0 + 1);
  I.setIconAliases('외투 → 코트');
  assert.equal(I.iconGen(), g0 + 1);
  I.setIconPool(false);
  assert.equal(I.iconGen(), g0 + 2);
  I.clearIconMisses();
  assert.equal(I.iconGen(), g0 + 3);
  I.setIconPool(true);
  I.setIconAliases('');
  const src = await read('src/host/itemicons.ts');
  assert.match(src, /hitOf\(`i\\u0001\$\{name\}\\u0001\$\{icon \?\? ''\}\\u0001\$\{seed \?\? ''\}\\u0001\$\{more\?\.desc \?\? ''\}`/);
  assert.equal((src.match(/hits\.clear\(\);/g) ?? []).length, 4, '팩을 바꾸는 세 곳 + 바뀜 횟수');
});

test('폰 「인터넷 접속」 고르기는 넘치면 접힌다 (css#5)', async () => {
  const css = await read('src/ui/style.css');
  assert.match(css, /\.gw \.ms-fx \.ph-inline > \.gx-segs \{ flex-wrap: wrap; height: auto; max-height: none; max-width: 100%; \}/);
});

test('실패 기록의 게시판 이름은 보고 있는 사이트 (wording#1)', async () => {
  const src = await read('src/ui/editor/manage.ts');
  assert.doesNotMatch(src, /fail\('괴담넷', gnet\.failure\)/);
  assert.match(src, /fail\(BOARD_NAME\[boardSiteNow\(\)\], gnet\.failure\)/);
  assert.match(src, /\$\{BOARD_NAME\[boardSiteNow\(\)\]\}: \$\{gnet\.failure\.reason\}/);
});

test('기록 있는 홈쇼핑 탭으로 돌아오면 다시 그린다 (wiki#4)', async () => {
  const src = await read('src/ui/app.ts');
  assert.match(src, /applyNav\(s\);\n    siteOpened\(\);\n[^\n]*\n    if \(tab === 'net' && curTab\(\)\.site === 'hs'\) render\(\);/);
});
