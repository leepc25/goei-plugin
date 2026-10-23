import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-field-'));
await build({ entryPoints: ['src/core/field.ts', 'src/core/interlude.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const { withFieldEvent, fieldRecord, currentFacts, MAX_EVENTS } = await import(pathToFileURL(join(dir, 'core/field.mjs')));
const { withInterludes, withFieldFacts, interludes, liveFacts, FACTS_HEAD, INTERLUDE_HEAD } = await import(pathToFileURL(join(dir, 'core/interlude.mjs')));

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

test('막간: 이동 사건이 있으면 그 기준 메시지 뒤에 사건 줄과 규칙이 들어간다', () => {
  const c = withFieldEvent(withFieldEvent(base(), ev('a', 1, 'c1', { text: '사무실 → 복도' })), ev('b', 2, 'c1', { text: '복도 → 휴게실' }));
  const out = withInterludes([{ role: 'assistant', content: '사무실이다.' }, { role: 'user', content: '다음' }], c, 'Nothing else happened in between and only a few minutes passed.', '주인공');
  assert.equal(out.length, 3);
  const text = out[1].content;
  assert.ok(text.startsWith(INTERLUDE_HEAD));
  assert.ok(text.indexOf('사무실 → 복도') < text.indexOf('복도 → 휴게실'));
  assert.ok(!text.includes('Nothing else happened'));
  assert.ok(text.includes('[Field facts]'));
});

test('막간: 이동 사건이 없으면 카드 규칙문이 그대로', () => {
  const c = { ...base(), goeiHqVisitV1: { turns: [{ id: 't', at: 1, agentId: 'a', name: '에일린', user: '안녕', reply: '네', anchor: 'c1' }] } };
  const out = withInterludes([{ role: 'assistant', content: '사무실이다.' }, { role: 'user', content: '다음' }], c, 'RULES Nothing else happened in between and only a few minutes passed.', '주인공');
  assert.ok(out[1].content.includes('Nothing else happened'));
});

test('확정 사실: 마지막 사용자 메시지 바로 앞에 한 번만', () => {
  const c = withFieldEvent(base(), ev('a', 1, 'c1', { fact: { key: '주인공 위치', value: '휴게실' } }));
  const req = [{ role: 'assistant', content: '사무실이다.' }, { role: 'user', content: '다음' }];
  const out = withFieldFacts(req, c);
  assert.equal(out.length, 3);
  assert.ok(out[1].content.startsWith(FACTS_HEAD));
  assert.ok(out[1].content.includes('주인공 위치: 휴게실'));
  assert.equal(out[2].content, '다음');
  assert.equal(withFieldFacts(out, c).length, 3);
});

test('기준 메시지가 사라진 사건은 막간과 확정 사실에서 빠진다 (다시 굴리기)', () => {
  const c = withFieldEvent(base(), ev('a', 1, 'gone', { fact: { key: '주인공 위치', value: '휴게실' } }));
  assert.equal(interludes(c).length, 0);
  assert.equal(liveFacts(c).length, 0);
  assert.equal(withFieldFacts([{ role: 'user', content: 'x' }], c).length, 1);
});

test('사건도 대화도 없으면 아무것도 바꾸지 않는다', () => {
  const req = [{ role: 'assistant', content: '사무실이다.' }, { role: 'user', content: '다음' }];
  assert.deepEqual(withInterludes(req, base(), null, '주인공'), req);
});
