// 전수검사 11-13 · 세계(상황판) 고침 점검: 태그 한 줄 읽기, 자리표 NEW 줄, 태그 지운 자리, 상태창 날짜·시각,
// 「진행 중」 상태, 짧은 프리셋 이름, 이름 막기 정리, 가상 로어북 지문 캐시, 조직 이름 바꾸기 덧쓰기, 걸린 임무 거두기.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { worldPackText } from '../scripts/data-pack.mjs';

const dir = '/tmp/audit_1113/fix3/world';
await mkdir(dir, { recursive: true });
const src = (p) => JSON.stringify(resolve('src', p));
await writeFile(join(dir, 'entry.ts'), [
  `export * from ${src('core/world/tags.ts')};`,
  `export { findStatusTags } from ${src('core/world/status.ts')};`,
  `export { presetCanon } from ${src('core/world/catalog.ts')};`,
  `export { bootstrap, reports, applyOutput, tick, DEFAULT_SETTINGS, requestMission, serializeWorld, parseWorld } from ${src('core/world/engine.ts')};`,
  `export { renameOrgOverrides } from ${src('core/world/records.ts')};`,
  `export { withWorldLore } from ${src('core/world/virtual.ts')};`,
  `export { dropPendingVars } from ${src('core/world/output.ts')};`,
  `export { applyWorldPack } from ${src('core/datapack.ts')};`,
].join('\n'));
await build({ entryPoints: [join(dir, 'entry.ts')], outfile: join(dir, 'entry.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
const m = await import(pathToFileURL(join(dir, 'entry.mjs')));
m.applyWorldPack(worldPackText());

test('닫는 ]가 빠진 [AN| 줄은 다음 태그 줄과 합쳐지지 않는다 (parse#7)', () => {
  const t = '[AN|서울 종로구|괴이A|활성|B|없음|조용\n[AN|서울 중구|괴이B|활성|C|없음|시끄러움]';
  const got = m.scanAnomalies(t);
  assert.equal(got.length, 1);
  assert.equal(got[0].name, '괴이B');
});

test('NEW 줄의 자리표를 그대로 베끼면 등록하지 않고 칸은 빈 값 (world#8)', () => {
  assert.deepEqual(m.scanAnomalies('[AN|서울특별시 종로구|<발생지점>|활성|<등급>|<배치>|<상황>]'), []);
  assert.deepEqual(m.scanIncidents('[IN|서울 종로구|<발생지점>|진행|<배치>|<상황>]'), []);
  const ms = m.scanMysticSites('[MS|서울 중구|달빛 서점|출현|<방문자>|<상황>]');
  assert.equal(ms.length, 1);
  assert.equal(ms[0].visitors, '');
  assert.equal(ms[0].situation, '');
  const an = m.scanAnomalies('[AN|서울 종로구|괴이A|활성|B|<배치>|<상황>]');
  assert.equal(an[0].deploy, '');
  assert.equal(an[0].situation, '');
  // 요청 줄을 그대로 돌려줘도 상태에 「<」가 남지 않는다
  const c = { anomalies: [], landmarks: [], people: [], mysticSites: [{ name: '달빛 서점' }] };
  const s = { ...m.DEFAULT_SETTINGS, preset_cap: 0, incident_p: 100 };
  const rng = () => 0.3;
  const w = m.bootstrap(c, s, rng);
  const r = m.reports(w, c, s, '');
  const out = m.applyOutput(w, c, s, '', [r.an, r.in, r.ms].join('\n'), rng).world;
  const all = JSON.stringify([out.an, out.inc, out.ms]);
  assert.ok(!all.includes('<'), all);
});

test('태그를 지운 자리에 NEW·글머리표·빈 코드 상자가 남지 않는다 (world#9)', () => {
  assert.equal(m.cleanOutput('본문이다.\n\nNEW [AN|서울|괴이|활성|B|없음|x]\n- [AG|P001|휴게|x]'), '본문이다.');
  assert.equal(m.cleanOutput('본문이다.\n\n```\n[AN|서울|괴이|활성|B|없음|x]\n[AG|P001|휴게|x]\n```'), '본문이다.');
  assert.equal(m.cleanOutput('본문이다. [AC|B00]'), '본문이다.');
  // 진짜 코드 상자 둘은 그대로
  const code = '```\na\n```\n\n```\nb\n```';
  assert.equal(m.cleanOutput(`${code}\n[AG|P001|휴게|x]`), code);
  // 태그 없는 글의 NEW 는 그대로
  assert.equal(m.cleanOutput('NEW'), 'NEW');
  assert.equal(m.scanAffiliation('본문이다. [AC|B00]'), 'B00');
});

test('상태창 날짜의 영어 요일·시각의 초를 읽고, 시각을 못 읽으면 0시로 돌리지 않는다 (world#13)', () => {
  const a = m.findStatusTags('[▣|2025.01.01 (Wed)|02:47 AM|☀️|4°C|서울 종로구 거리|없음]')[0];
  assert.equal(a.date, '2025.01.01 (Wed)');
  assert.equal(a.place, '서울 종로구 거리');
  const b = m.findStatusTags('[▣|2025.01.01|02:47:10 AM|☀️|4°C|서울 종로구 거리|없음]')[0];
  assert.equal(b.time, '02:47:10 AM');
  assert.equal(b.place, '서울 종로구 거리');
  const st = m.scanStatus('[▣|2025.01.01|02:47:10 AM|☀️|4°C|서울 종로구 거리|없음]');
  assert.equal(st.minute % 1440, 2 * 60 + 47);
  assert.equal(m.scanStatus('[▣|2025.01.01|☀️|4°C|서울 종로구 거리|없음]').minute, null);
});

test('「진행 중」「종료됨」「출현 중」「상태: 휴게」도 읽는다 (world#12)', () => {
  assert.equal(m.scanIncidents('[IN|서울 종로구|광장시장 화재|진행 중|없음|불]')[0]?.state, '진행');
  assert.equal(m.scanIncidents('[IN|서울 종로구|광장시장 화재|종료됨|없음|불]')[0]?.state, '종료');
  assert.equal(m.scanMysticSites('[MS|서울 중구|달빛 서점|출현 중|없음|조용]')[0]?.state, '출현');
  assert.equal(m.scanAgents('[AG|P001|상태: 휴게|x]')[0]?.state, '휴게');
  assert.equal(m.scanAgents('[AG|P001|외근 중|x]')[0]?.state, '외근');
});

test('짧은 프리셋 이름은 통째로 같거나 그 이름 + 띄어쓰기·괄호일 때만 (world#11)', () => {
  const c = { anomalies: [{ name: '교회' }, { name: '미술관' }, { name: '소라 랜드' }, { name: '청악메리병원' }] };
  assert.equal(m.presetCanon(c, '망우동 교회'), null);
  assert.equal(m.presetCanon(c, '국립현대미술관'), null);
  assert.equal(m.presetCanon(c, '교회'), '교회');
  assert.equal(m.presetCanon(c, '교회 (괴이)'), '교회');
  assert.equal(m.presetCanon(c, '소라랜드'), '소라 랜드');
  assert.equal(m.presetCanon(c, '서울 청악메리병원 별관'), '청악메리병원');
});

test('지난 회차의 이름 막기는 tick 에서 지운다 (world#14)', () => {
  const c = { anomalies: [], landmarks: [], people: [], mysticSites: [] };
  const s = { ...m.DEFAULT_SETTINGS, preset_cap: 0 };
  const w = m.bootstrap(c, s, () => 0.3);
  w.blocks = { 'random:옛것': w.epoch - 1, 'random:지금': w.epoch + 1 };
  m.tick(w, c, s, () => 0.3);
  assert.equal('random:옛것' in w.blocks, false);
  assert.equal(w.blocks['random:지금'] >= w.epoch, true);
});

test('가상 로어북: 같은 내용이면 지난 조립을 쓰되 카드 항목은 이번 것, 내용이 바뀌면 다시 (world#10)', () => {
  const lore = [{ key: 'x', comment: '메모', content: '하나', mode: 'normal', insertorder: 1 }];
  const a = m.withWorldLore(lore);
  const copy = lore.map((e) => ({ ...e }));
  const b = m.withWorldLore(copy);
  assert.notEqual(a, b);
  assert.equal(b[0], copy[0], '카드 항목은 이번에 받은 것');
  assert.equal(b.length, a.length);
  assert.deepEqual(b.slice(1), a.slice(1));
  const c = m.withWorldLore([{ ...lore[0], insertorder: 2 }]);
  assert.equal(c[0].insertorder, 2);
});

test('조직 이름을 바꾸면 기록 칸·관계 쌍 덧쓰기도 옮긴다 (dirstatus#3)', () => {
  const over = { org: { 옛: { summary: 's' } }, relations: { pairs: { '옛>관리국': { stage: 'hostile' }, '관리국>옛': null, '관리국>백일몽': { stage: 'wary' } } } };
  const next = m.renameOrgOverrides(over, '옛', '새');
  assert.deepEqual(next.org, { 새: { summary: 's' } });
  assert.deepEqual(Object.keys(next.relations.pairs).sort(), ['관리국>백일몽', '관리국>새', '새>관리국'].sort());
  assert.equal(over.org.옛.summary, 's', '원본은 그대로');
});

test('안 보낸 임무 카드를 물리면 걸어 둔 임무를 거둔 변수 (dirstatus#4)', () => {
  const c = { anomalies: [], landmarks: [], people: [], mysticSites: [] };
  const s = { ...m.DEFAULT_SETTINGS };
  const w = m.bootstrap(c, s, () => 0.3);
  w.pending.an = '괴이A';
  const chat = { message: [], scriptstate: { $goei_world: m.serializeWorld(w), $st_anomaly_on: '1' } };
  const lore = [
    { comment: 'World catalog', content: JSON.stringify({ 랜드마크: [], '미스틱 사이트': [], 괴이: [] }) },
    { comment: 'Agent roster', content: JSON.stringify({ version: 2, refill: 2, characters: [] }) },
  ];
  assert.equal(m.dropPendingVars(chat, []), null, '카탈로그가 없으면 던지지 않고 null');
  const vars = m.dropPendingVars(chat, lore);
  assert.ok(vars);
  assert.equal(m.parseWorld(vars.$goei_world).pending.an, undefined);
  assert.ok(!String(vars.$an_report).includes('괴이A'));
  const none = { message: [], scriptstate: { $goei_world: m.serializeWorld(m.parseWorld(vars.$goei_world)), $st_anomaly_on: '1' } };
  assert.equal(m.dropPendingVars(none, lore), null);
});
