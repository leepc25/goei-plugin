import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-field-'));
await build({ entryPoints: ['src/core/field.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const { withFieldEvent, fieldRecord, currentFacts, MAX_EVENTS } = await import(pathToFileURL(join(dir, 'core/field.mjs')));

const ev = (id, at, anchor, extra = {}) => ({ id, at, anchor, kind: 'move', text: `이동 ${id}`, ...extra });
const base = () => ({ message: [{ role: 'user', data: '출근', chatId: 'u1' }, { role: 'char', data: '사무실이다.', chatId: 'c1' }] });

test('장부: 같은 id는 한 번만, 템플릿 기호는 막는다', () => {
  let c = withFieldEvent(base(), ev('a', 1, 'c1', { text: '{{user}} %%x%% 이동' }));
  c = withFieldEvent(c, ev('a', 2, 'c1'));
  const list = fieldRecord(c).events;
  assert.equal(list.length, 1);
  assert.ok(!list[0].text.includes('{{') && !list[0].text.includes('%%'));
});

test('장부: 최대 개수를 넘으면 오래된 것부터 버린다', () => {
  let c = base();
  for (let i = 0; i < MAX_EVENTS + 5; i++) c = withFieldEvent(c, ev(`e${i}`, i, 'c1'));
  const list = fieldRecord(c).events;
  assert.equal(list.length, MAX_EVENTS);
  assert.equal(list[0].id, 'e5');
});

test('확정 사실: 같은 key는 나중 것이 이긴다', () => {
  const facts = currentFacts([
    ev('a', 1, 'c1', { fact: { key: '주인공 위치', value: '사무실' } }),
    ev('b', 3, 'c1', { fact: { key: '주인공 위치', value: '휴게실' } }),
    ev('c', 2, 'c1', { fact: { key: '데드폴', value: '사망', permanent: true } }),
  ]);
  assert.deepEqual(facts.map((f) => [f.key, f.value]), [['주인공 위치', '휴게실'], ['데드폴', '사망']]);
});

test('장부 상한: 넘치면 작은 일부터 버리고 큰일·확정 사실은 남는다 (11-01 1-7)', () => {
  let c = base();
  for (let i = 0; i < MAX_EVENTS + 20; i++) {
    const big = i % 50 === 0;
    c = withFieldEvent(c, { ...ev(`e${i}`, i, 'c1'), ...(big ? { kind: 'kill', weight: 3 } : {}), ...(i === 3 ? { fact: { key: 'bag', value: 'lost' } } : {}) });
  }
  const list = fieldRecord(c).events;
  assert.equal(list.length, MAX_EVENTS);
  // 큰일 7건(0,50,…,300)과 사실 1건(3)은 전부 남는다
  for (const i of [0, 50, 100, 150, 200, 250, 300, 3]) assert.ok(list.some((e) => e.id === `e${i}`), `e${i} 남아야`);
  // 작은 일은 가장 오래된 것부터 빠진다 (e1, e2 는 없고 뒤쪽은 있다)
  assert.ok(!list.some((e) => e.id === 'e1'));
  assert.ok(list.some((e) => e.id === `e${MAX_EVENTS + 19}`));
  // 순서는 그대로
  const ats = list.map((e) => e.at);
  assert.deepEqual(ats, [...ats].sort((a, b) => a - b));
});
