// 세계 편집 모델: 덧쓰기 최소화, 기록 추가·지우기·되돌리기, 글로 가져오기, 칸 순서
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minimalOverride, putRecord, removeRecord, resetRecord, emptyRecord, overrideCount, parseImport, moveField, moveFieldTo, worldRecord, defaultRecord, fieldOrder } from '../dist-test/core.mjs';

test('덧쓰기 최소화: 기본과 다른 칸만, 같아지면 덧쓰기를 지운다', () => {
  const base = defaultRecord('agent', '쟈알디');
  const full = structuredClone(base);
  assert.equal(minimalOverride('agent', '쟈알디', full), undefined, '그대로면 덧쓰기 없음');
  full.fields.age = '40s';
  full.extra.push({ name: 'Mask', value: 'Cat', kind: 'line', sec: 'identity', at: 'role' });
  const m = minimalOverride('agent', '쟈알디', full);
  assert.deepEqual(Object.keys(m.fields), ['age']);
  assert.equal(m.extra.length, 1);
  assert.equal(m.order, undefined);
  let over = putRecord({}, 'agent', '쟈알디', full);
  assert.equal(over.agent['쟈알디'].fields.age, '40s');
  assert.equal(worldRecord('agent', '쟈알디', over).fields.age, '40s');
  assert.equal(worldRecord('agent', '쟈알디', over).fields.voice, base.fields.voice);
  over = putRecord(over, 'agent', '쟈알디', structuredClone(base));
  assert.deepEqual(over, {}, '기본으로 되돌리면 덧쓰기가 통째로 사라짐');
  over = putRecord({}, 'agent', '새사람', { fields: { age: '20s' }, extra: [] });
  assert.deepEqual(over.agent['새사람'], { fields: { age: '20s' }, extra: [] }, '기본에 없는 기록은 통째로');
  assert.equal(overrideCount(over), 1);
  over = removeRecord(over, 'agent', '새사람');
  assert.deepEqual(over, {}, '카드에만 있던 기록은 덧쓰기에서 뺌');
  over = removeRecord({}, 'anomaly', '소라 랜드');
  assert.deepEqual(over.anomaly['소라 랜드'], { deleted: true });
  assert.equal(worldRecord('anomaly', '소라 랜드', over), null);
  assert.deepEqual(resetRecord(over, 'anomaly', '소라 랜드'), {});
  assert.deepEqual(emptyRecord(), { fields: {}, extra: [] });
});

test('글로 가져오기: 제목 동의어로 칸 배정, 안 맞는 절은 추가 칸, 요원 Identity 줄은 한 줄 칸', () => {
  const r = parseImport('anomaly', '## Overview\n어떤 괴이\n\n## Entrance\n문을 연다\n\n## Escape route\n뒷문\n\n## Weather\n비');
  assert.equal(r.fields.identity, '어떤 괴이');
  assert.equal(r.fields.entry, '문을 연다', 'entrance → 입장');
  assert.equal(r.fields.survival, '뒷문');
  assert.deepEqual(r.extra, [{ name: 'Weather', value: '비', kind: 'block' }]);
  const a = parseImport('agent', '#### Identity\n- Age: 20s\n- Gender: Female\n- Blood type: O\n- Role: Hunter\n\n#### Personality\n- 밝다\n\n#### Speech\n- 반말');
  assert.equal(a.fields.age, '20s');
  assert.equal(a.fields.role, 'Hunter');
  assert.equal(a.fields.character, '- 밝다');
  assert.equal(a.fields.voice, '- 반말');
  assert.deepEqual(a.extra, [{ name: 'Blood type', value: 'O', kind: 'line', sec: 'identity', at: 'gender' }]);
  const plain = parseImport('org', '그냥 설명 한 덩어리');
  assert.equal(plain.fields.intro, '그냥 설명 한 덩어리');
});

test('칸 순서: 위·아래·끌어 놓기, 모르는 id 는 무시', () => {
  const rec = { fields: { identity: 'a', entry: 'b' }, extra: [{ name: 'X', value: 'x', kind: 'block' }] };
  const base = fieldOrder('anomaly', rec);
  assert.deepEqual(base.slice(0, 2), ['identity', 'entry']);
  assert.equal(base.at(-1), 'x:X');
  const up = moveField('anomaly', rec, 'entry', -1);
  assert.deepEqual(up.slice(0, 2), ['entry', 'identity']);
  const moved = moveFieldTo('anomaly', rec, 'x:X', 'identity');
  assert.deepEqual(moved.slice(0, 2), ['x:X', 'identity']);
  assert.deepEqual(moveField('anomaly', rec, 'identity', -1), base, '맨 위는 그대로');
});
