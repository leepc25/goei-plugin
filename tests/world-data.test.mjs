// 세계 데이터(플러그인 기본 + 카드 덧쓰기)와 가상 로어북 (docs/설계안_세계편집.md 1·2장)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  worldRecords, worldRecord, mergeRecord, fieldOrder, worldRelations, withWorldLore, stripVirtual, isVirtual, hasVirtual, readDirectory, lore as L,
  assembleAgent, orgNameCbs, FIELDS, WORLD_KINDS,
} from '../dist-test/core.mjs';

test('기본 세계: 카드 로어북에서 옮긴 기록 수와 칸', () => {
  assert.equal(worldRecords('agent').size, 55);
  assert.equal(worldRecords('org').size, 17);
  assert.equal(worldRecords('anomaly').size, 63);
  assert.equal(worldRecords('site').size, 11);
  assert.equal(worldRecords('appendix').size, 4);
  const j = worldRecord('agent', '쟈알디');
  assert.equal(j.fields.age, '30s');
  assert.match(j.fields.intro, /^\(early 30s\/F, Boo-jang\)/);
  assert.equal(j.fields.organization, undefined, '관리국 요원의 소속 표기는 호칭 표로 만들므로 저장하지 않음');
  assert.equal(worldRecord('agent', '블라렛').fields.organization, 'The Vatican, Papal Court', '다른 표기는 그대로 보존');
  assert.deepEqual(worldRecord('agent', '사장').extra, [{ name: 'Name', value: 'Unknown. Addressed only as Sa-jang.', kind: 'line', sec: 'identity', at: '' }]);
  const sora = worldRecord('anomaly', '소라 랜드');
  assert.equal(sora.title, 'Sora Land Amusement Park (소라 랜드)');
  assert.match(sora.fields.identity, /^##### Park and Activation\n/, '칸 제목과 다른 절 제목은 ##### 로 글 안에');
  assert.ok(worldRecord('org', '민간인').summaryOnly, '세력 로어북이 없는 조직은 Faction 요약 전용');
  assert.deepEqual(worldRecord('org', '관리국').variants.B00 && Object.keys(worldRecord('org', '관리국').variants.B00), ['intro'], 'B00 시점 소개');
  for (const k of WORLD_KINDS) for (const r of worldRecords(k).values()) for (const id of Object.keys(r.fields)) assert.ok(FIELDS[k].some((f) => f.id === id), `${k} 모르는 칸 ${id}`);
});

test('덧쓰기: 칸만 덮고, 지우고, 새 기록을 더한다', () => {
  const base = worldRecord('agent', '쟈알디');
  const m = mergeRecord(base, { fields: { age: '40s', role: '' }, extra: [{ name: '키', value: '178cm', kind: 'line', sec: 'identity', at: 'age' }] });
  assert.equal(m.fields.age, '40s');
  assert.equal(m.fields.role, '', '빈 문자열도 덮음 (칸을 비운 것)');
  assert.equal(m.fields.voice, base.fields.voice, '건드리지 않은 칸은 기본');
  assert.equal(m.extra.length, 1);
  assert.equal(mergeRecord(base, { deleted: true }), null);
  const over = { agent: { 쟈알디: { deleted: true }, 새요원: { fields: { age: '20s' }, extra: [] } } };
  const recs = worldRecords('agent', over);
  assert.ok(!recs.has('쟈알디') && recs.get('새요원').fields.age === '20s');
  assert.deepEqual(fieldOrder('anomaly', { fields: { identity: 'a' }, extra: [{ name: 'X', value: 'x', kind: 'block' }], order: ['x:X', 'identity', '없는칸'] }).slice(0, 2), ['x:X', 'identity']);
  const rel = worldRelations({ relations: { pairs: { '관리국>가짜 관리국': null, '교황청>흡혈귀': { stage: 'hostile', memo: '피의 원수' } } } });
  assert.ok(!rel.pairs['관리국>가짜 관리국'] && rel.pairs['교황청>흡혈귀'].memo === '피의 원수');
  assert.equal(worldRelations().pairs['관리국>가짜 관리국'].stage, 'hostile');
});

const F = (id, name) => ({ comment: name, key: `folder:${id}`, mode: 'folder', content: '' });
const slots = ['Faction', 'Mystic', 'Anomaly', 'Agent'].map((n) => ({ comment: `📚Lore slot · ${n}`, key: '', alwaysActive: true, mode: 'normal', content: '' }));

test('가상 로어북: 빈 카드에도 기본 세계가 폴더 항목으로 붙고, 저장 때는 빠진다', () => {
  const out = withWorldLore([...slots]);
  const virt = out.filter((e) => isVirtual(e) && e.mode !== 'folder' && !e.alwaysActive);
  assert.equal(virt.length, 55 + 14 + 63 + 11 + 4, '요약 전용 조직 3개는 세력 로어를 만들지 않음');
  assert.equal(out.filter((e) => isVirtual(e) && e.mode === 'folder').length, 6, '다섯 폴더 + 🌐세계(상시 지침)');
  const j = virt.find((e) => e.comment === '쟈알디');
  assert.equal(j.key, 'Jyaldi, 쟈알디', '검색 키는 원문 그대로');
  assert.match(j.content, /^@@dont_activate\n### Character - Jyaldi\n\n#### Identity\n- Age: 30s\n- Gender: Female\n/);
  assert.match(j.content, /\n\n---$/);
  const d = readDirectory(out);
  assert.equal(d.agents.length, 55);
  assert.equal(d.anomalies.length, 63);
  assert.ok(d.agents.find((a) => a.lore === '쟈알디').english === 'Jyaldi');
  assert.equal(L.managedEntries(out).length, virt.length, '로어 고르기가 가상 항목을 그대로 다룬다');
  assert.equal(L.syncDecorators(out, 'risu'), null, '가상 항목은 장식 줄을 맞추지 않는다 (저장 대상이 아님)');
  assert.deepEqual(stripVirtual(out), slots);
  assert.equal(hasVirtual(out), true);
  assert.equal(withWorldLore(out).length, out.length, '이미 붙은 목록을 다시 넣어도 같다');
});

test('가상 로어북: 카드에 같은 이름의 진짜 항목이 있으면 카드가 이기고, 덧쓰기 deleted 는 기본 기록을 뺀다', () => {
  const mine = { comment: '쟈알디', key: 'Jyaldi', folder: 'folder:g', mode: 'normal', content: '@@dont_activate\n내가 고친 쟈알디' };
  const dir = { comment: 'Directory', key: '', mode: 'normal', content: JSON.stringify({ schema: 1, 요원: {}, 조직: {}, 괴이: {}, '미스틱 사이트': {}, 세계: { anomaly: { '소라 랜드': { deleted: true } }, agent: { 스팡달: { fields: { age: '99' } } } } }) };
  const out = withWorldLore([F('g', '🙂요원'), F('c', '⚙️설정'), mine, dir, ...slots]);
  assert.equal(out.filter((e) => e.comment === '쟈알디').length, 1);
  assert.equal(out.find((e) => e.comment === '쟈알디').content, mine.content);
  assert.ok(!out.some((e) => e.comment === '소라 랜드'));
  assert.match(out.find((e) => e.comment === '스팡달').content, /- Age: 99\n/);
  assert.equal(out.filter((e) => isVirtual(e) && e.mode === 'folder' && e.comment === '🙂요원').length, 0, '있는 폴더는 다시 만들지 않음');
  assert.equal(out.find((e) => e.comment === '스팡달').folder, 'folder:g');
});

test('조립: 소속 표기는 호칭 표에서 세력별 분기 CBS 로', () => {
  const out = withWorldLore([...slots, { comment: 'Directory', key: '', mode: 'normal', content: JSON.stringify({ schema: 1, 요원: { 쟈알디: { affiliation: 'A00', english: 'Jyaldi' } }, 조직: { 관리국: { code: 'A00', english: 'Management Bureau' }, '가짜 관리국': { code: 'B00', english: 'Fake Management Bureau' } }, 괴이: {}, '미스틱 사이트': {}, 호칭: { none: { A00: '관리국', B00: '가짜 관리국' }, B00: { A00: '가짜 관리국', B00: '관리국' } } }) }]);
  const dir = readDirectory(out);
  const org = dir.orgs.find((o) => o.name === '관리국');
  assert.equal(orgNameCbs(dir, org), '{{#if {{not_equal::{{getvar::st_faction}}::B00}}}}Management Bureau{{/if}}{{#if {{equal::{{getvar::st_faction}}::B00}}}}Fake Management Bureau{{/if}}');
  const text = assembleAgent(worldRecord('agent', '쟈알디'), dir.agents.find((a) => a.lore === '쟈알디'), dir);
  assert.match(text, /- Organization: \{\{#if .*Management Bureau\{\{\/if\}\}\n- Department: Comprehensive Response Team\n- Role: /);
});
