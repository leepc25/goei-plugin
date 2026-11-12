// 그림 대체 말 줄 단위 고치기 (core/aliasrows.ts): 저장 글 꼴은 옛 그대로, 기본 표와 같으면 비운다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(mkdtempSync(join(tmpdir(), 'alias-')), 'm.mjs');
buildSync({ entryPoints: ['src/core/aliasrows.ts'], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' });
const m = await import(pathToFileURL(out).href);
const im = join(mkdtempSync(join(tmpdir(), 'alias-')), 'i.mjs');
buildSync({ entryPoints: ['src/core/iconmatch.ts'], bundle: true, format: 'esm', outfile: im, logLevel: 'silent' });
const { ICON_ALIAS_DEFAULT, parseIconAliases } = await import(pathToFileURL(im).href);

test('저장값이 없으면 기본 표, 줄 수는 기본 글과 같다', () => {
  const rows = m.aliasShown('');
  assert.equal(rows.length, ICON_ALIAS_DEFAULT.split('\n').length);
  assert.deepEqual(rows[0], { a: '외투', b: '코트' });
  assert.equal(m.aliasText(rows), ICON_ALIAS_DEFAULT);
  assert.equal(m.aliasChanged(''), false);
});
test('칸 하나 고치면 옛 글 꼴로 전부 저장, 되돌리면 비운다', () => {
  const s = m.aliasEdit('', 'cell', '0:b=재킷');
  assert.equal(s.split('\n')[0], '외투 → 재킷');
  assert.equal(s.split('\n').length, ICON_ALIAS_DEFAULT.split('\n').length);
  assert.equal(m.aliasChanged(s), true);
  assert.equal(m.aliasEdit(s, 'cell', '0:b=코트'), '');
  assert.equal(m.aliasEdit('', 'cell', '0:b=코트'), null, '같은 값이면 바뀐 것 없음');
  assert.equal(parseIconAliases(s)['외투'], '재킷', '읽는 쪽이 그대로 읽는다');
});
test('가운데 표시·줄바꿈은 칸에 못 들어간다', () => {
  const s = m.aliasEdit('', 'cell', '0:a=외 → 투=x:y\nz');
  assert.equal(s.split('\n')[0], '외 투 x y z → 코트');
});
test('추가·지우기·기본값으로', () => {
  const n = ICON_ALIAS_DEFAULT.split('\n').length;
  const a = m.aliasEdit('', 'add');
  assert.equal(m.aliasShown(a).length, n + 1);
  assert.deepEqual(m.aliasShown(a).at(-1), { a: '', b: '' }, '빈 줄이 남는다');
  assert.equal(Object.keys(parseIconAliases(a)).length, Object.keys(parseIconAliases(ICON_ALIAS_DEFAULT)).length, '빈 줄은 읽는 쪽이 거른다');
  assert.equal(m.aliasEdit(a, 'del', String(n)), '', '지워서 기본 표와 같아지면 비운다');
  assert.equal(m.aliasEdit(a, 'reset'), '');
  assert.equal(m.aliasEdit('', 'reset'), null);
  assert.equal(m.aliasEdit('', 'del', '999'), null);
  let s = '';
  for (let i = n - 1; i >= 0; i--) s = m.aliasEdit(s, 'del', String(i)) ?? s;
  assert.equal(s, '', '다 지우면 기본 표');
});
test('붉은 글 조건 = 읽는 쪽이 버리는 줄', () => {
  assert.ok(m.aliasRowBad({ a: '', b: '코트' })); assert.ok(m.aliasRowBad({ a: '외투', b: '' })); assert.ok(m.aliasRowBad({ a: '코트', b: '코트' }));
  assert.equal(m.aliasRowBad({ a: '외투', b: '코트' }), '');
});
test('저장 글 상한을 넘기면 추가가 안 된다', () => {
  const big = Array.from({ length: 150 }, (_, i) => `가나다라마바${i} → 사아자차카타${i}`).join('\n').slice(0, 1999);
  assert.equal(m.aliasCanAdd(big), false);
  assert.equal(m.aliasEdit(big, 'add'), null);
});
