import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  parseCatalog, DEFAULT_SETTINGS, emptyWorld, bootstrap, applyOutput, reports, tick, expire,
  scanAnomalies, scanIncidents, scanMysticSites, scanAgents, scanStatus, cleanOutput, hasWorldTags,
  locName, uniqueRegion, POOL, SEALED_LOC, codesToNames, processOutput, startWorldVars, readWorld, WORLD_KEY,
  requestMission, cancelMission, activeEvents, endEvent, endedShown, LOCKED_STATES, agentLocked,
} from '../dist-test/core.mjs';

const worldBook = {
  괴이: [
    [true, '소라 랜드', '소라 랜드', 'Sora Land', []],
    [true, '명일 아파트', '명일 아파트', 'Myeongil Apartment', []],
    [false, '숨긴 괴이', '숨긴 괴이', 'Hidden', []],
  ],
  '미스틱 사이트': [[true, '달빛 서점', '달빛 서점', 'Moon Books', []]],
  랜드마크: [[true, '관리국 본부', '관리국', '관리국', 'Bureau HQ', '02', '종로구', 52.6, 44.6, []]],
};
const roster = {
  version: 2,
  refill: 2,
  characters: [
    { id: 'P001', name: '쟈알디', english: 'Jyaldi', lore: '쟈알디', aliases: [], affiliation: 'A00', rank: '팀장', department: '종합대응팀', roster_for: ['A00'], phone_tabs: [] },
    { id: 'P002', name: '스팡달', english: 'Spangdal', lore: '스팡달', aliases: [], affiliation: 'A00', rank: '요원', department: '종합대응팀', roster_for: ['A00'], phone_tabs: [] },
    { id: 'P003', name: '잼트리', english: 'Jaemtri', lore: '잼트리', aliases: [], affiliation: 'A00', rank: '요원', department: '종합대응팀', roster_for: ['A00'], phone_tabs: [] },
    { id: 'P010', name: '사장', english: 'Sajang', lore: '사장', aliases: [], affiliation: 'C00', rank: '', department: '', roster_for: ['C00'], phone_tabs: [] },
  ],
};
const lore = [
  { comment: 'World catalog', content: JSON.stringify(worldBook) },
  { comment: 'Agent roster', content: JSON.stringify(roster) },
];
const catalog = parseCatalog(lore);
const S = { ...DEFAULT_SETTINGS, agent_limit: 2 };

/** 순서대로 값을 돌려주는 가짜 난수 */
function seq(...values) {
  let i = 0;
  return () => values[i++ % values.length];
}
const always = () => 0;

test('catalog keeps only visible entries', () => {
  assert.deepEqual(catalog.anomalies.map((a) => a.name), ['소라 랜드', '명일 아파트']);
  assert.equal(catalog.mysticSites.length, 1);
  assert.equal(catalog.landmarks[0].gu, '종로구');
  assert.equal(catalog.refill, 2);
  assert.equal(catalog.people.length, 4);
});

test('real card catalog parses', { skip: !existsSync('/mnt/project-files/analysis/extracted/module.json') }, () => {
  const m = JSON.parse(readFileSync('/mnt/project-files/analysis/extracted/module.json', 'utf8'));
  const c = parseCatalog(m.lorebook ?? m.module?.lorebook);
  assert.ok(c.anomalies.length > 20, `anomalies ${c.anomalies.length}`);
  assert.ok(c.mysticSites.length > 0 && c.landmarks.length >= 5);
  assert.ok(c.people.some((p) => p.rosterFor.includes('A00')));
  assert.equal(c.factionDisplay.B00.A00, '가짜 관리국');
});

test('geo: names, unique region, sealed city', () => {
  assert.equal(locName('02-6'), '서울특별시 종로구');
  assert.equal(locName(SEALED_LOC), '세광특별시');
  assert.ok(!POOL.includes(SEALED_LOC));
  assert.equal(uniqueRegion('서울 종로구'), '02-6');
  assert.equal(uniqueRegion('중구'), null, '여러 도시에 있는 구는 정할 수 없음');
});

test('tag scanners read from the tail and normalise', () => {
  const t = scanAnomalies('본문 [AN|3|서울 종로구|배치: 종로 지하상가|활성|위협등급: b|P001]');
  assert.deepEqual(t, [{ region: '서울 종로구', name: '종로 지하상가', state: '활성', grade: 'B', deploy: 'P001', situation: '' }]);
  // 상황 칸 (2026-10-21): 슬롯 번호가 있어도, 없어도 꼬리 칸이 상황
  assert.equal(scanAnomalies('[AN|서울 종로구|x|활성|C|P001|승강장에 안개가 차오름]')[0].situation, '승강장에 안개가 차오름');
  assert.deepEqual(scanAnomalies('[AN|2|서울 종로구|x|활성|C|P001|안개]')[0], { region: '서울 종로구', name: 'x', state: '활성', grade: 'C', deploy: 'P001', situation: '안개' });
  assert.deepEqual(scanMysticSites('[MS|부산 중구|달빛 서점|출현|프리랜서|책장이 저절로 넘어감]')[0], { region: '부산 중구', name: '달빛 서점', state: '출현', visitors: '프리랜서', situation: '책장이 저절로 넘어감' });
  assert.equal(scanMysticSites('[MS|1|부산 중구|달빛 서점|출현|없음]')[0].region, '부산 중구');
  assert.equal(scanAnomalies('[AN|서울 종로구|x|cleared|C|없음]')[0].state, '클리어');
  assert.deepEqual(scanIncidents('[IN|서울 종로구|관리국 본부|진행|정전]')[0], { region: '서울 종로구', name: '관리국 본부', state: '진행', deploy: '', situation: '정전' });
  // 배치 칸이 붙은 새 태그 (2026-10-21)
  assert.deepEqual(scanIncidents('[IN|서울 종로구|관리국 본부|진행|P001, 교황청|정전]')[0], { region: '서울 종로구', name: '관리국 본부', state: '진행', deploy: 'P001, 교황청', situation: '정전' });
  assert.equal(scanIncidents('[IN|서울|x|이상함|y]').length, 0);
  assert.equal(scanMysticSites('[MS|부산 중구|달빛 서점|출현|없음]')[0].visitors, '없음');
  assert.deepEqual(scanAgents('[AG|P-001|injured|병원]'), [{ who: 'P-001', state: '부상', situation: '병원' }]);
  // 지침 글을 베끼거나 띄어 쓴 상태 (2026-10-21 점검)
  for (const [v, st] of [['작전 투입', '작전투입'], ['휴게 (On-duty break)', '휴게'], ['외근 중', '외근'], ['사망.', '사망'], ['대기 중', '휴게']]) assert.equal(scanAgents(`[AG|P001|${v}|x]`)[0]?.state, st, v);
  assert.equal(scanMysticSites('[MS|부산 중구|달빛 서점|출현 (Appeared)|없음|조용]')[0].state, '출현');
  assert.deepEqual(scanIncidents('[IN|서울 종로구|관리국 본부|진행|P001]')[0].deploy, 'P001', '상황을 빼먹은 새 태그는 배치로');
  const st = scanStatus('[▣|2025.01.01|12:30 AM|☀️|4°C|서울|소라 랜드]');
  assert.equal(st.target, '소라 랜드');
  assert.equal(scanStatus('[▣|2025.01.01|01:30 AM|☀️|4°C|서울|없음]').minute - st.minute, 60);
});

test('AG tags find agents by code inside text, Korean name or English name', () => {
  const w = started();
  const p1 = catalog.people[0];
  const p2 = catalog.people[1];
  const { world } = applyOutput(w, catalog, noSpawn, 'A00', `[AG|${p1.name}(${p1.id})|부상|병원]\n[AG|${p2.name}|작전 투입|현장]`, always);
  assert.equal(world.agents[p1.id].st, '부상');
  assert.equal(world.agents[p2.id].st, '작전투입');
});

test('cleanOutput removes tags, age meta and [AC], keeps prose and moves status to the end', () => {
  const raw = [
    '[▣|2025.01.01|02:47 AM|☀️|4°C|서울|없음]',
    '그는 문을 열었다.',
    '',
    '[AN|서울 종로구|종로 지하상가|활성|B|P001] {1시간 5분 전}',
    '[IN|서울 종로구|관리국 본부|진행|정전]',
    '[AC|C00]',
  ].join('\n');
  assert.equal(cleanOutput(raw), '그는 문을 열었다.\n[▣|2025.01.01|02:47 AM|☀️|4°C|서울|없음]');
  assert.ok(hasWorldTags(raw));
  assert.ok(!hasWorldTags(cleanOutput(raw)));
});

test('bootstrap spawns one of each group with default settings', () => {
  const w = bootstrap(catalog, S, always);
  assert.equal(w.an.length, 2, 'preset 1 + random 1');
  assert.equal(w.an.filter((e) => e.kind === 'preset').length, 1);
  assert.equal(w.inc.length, 1);
  assert.equal(w.ms.length, 1);
  const locs = [...w.an, ...w.inc, ...w.ms].map((e) => e.loc);
  assert.equal(new Set(locs).size, locs.length, '같은 자리에 겹치지 않음');
  const r = reports(w, catalog, S, 'A00');
  assert.match(r.an, /^NEW \[AN\|.+\|소라 랜드\|활성\|<등급>\|<배치>\|<상황>\]/m);
  assert.match(r.an, /NEW \[AN\|.+\|<발생지점>\|활성/);
  assert.match(r.ms, /NEW \[MS\|.+\|달빛 서점\|출현\|<방문자>\|<상황>\]/);
  assert.equal(r.ag, 'NEW [AG|P001|<상태>|<상황>]\nNEW [AG|P002|<상태>|<상황>]\n\n- code: P001 쟈알디 (Jyaldi) | P002 스팡달 (Spangdal)');
});

test('caps: never more than the preset/random/incident/mystic caps from automatic spawns', () => {
  let w = emptyWorld();
  for (let i = 0; i < 10; i++) tick(w, catalog, S, Math.random);
  assert.ok(w.an.filter((e) => e.kind === 'preset' && e.origin === 'auto').length <= 2);
  assert.ok(w.an.filter((e) => e.kind === 'random' && e.origin === 'auto').length <= 1);
  assert.ok(w.inc.length <= 1 && w.ms.length <= 1);
});

function started() {
  const w = emptyWorld();
  w.an.push({ loc: '02-6', name: '', state: '발생대기', grade: '', deploy: '', kind: 'random', origin: 'auto', presetName: '', since: null, born: null, exploring: false });
  w.an.push({ loc: '07-0', name: '소라 랜드', state: '발생대기', grade: '', deploy: '', kind: 'preset', origin: 'auto', presetName: '소라 랜드', since: null, born: null, exploring: false });
  return w;
}
const noSpawn = { ...S, preset_p: 0, random_p: 0, incident_p: 0, mystic_p: 0 };

test('model tags fill pending anomalies by region and keep preset names fixed', () => {
  const text = [
    '본문',
    '[AN|서울특별시 종로구|종로 폐역|활성|B|P001]',
    '[AN|부산광역시 기장군|소라랜드 놀이공원|활성|A|관리국]',
    '[▣|2025.01.01|02:00 AM|☀️|4°C|서울|없음]',
  ].join('\n');
  const { world } = applyOutput(started(), catalog, noSpawn, 'A00', text, always);
  const [jongno, sora] = world.an;
  assert.equal(jongno.name, '종로 폐역');
  assert.equal(jongno.state, '활성');
  assert.equal(jongno.grade, 'B');
  assert.equal(jongno.since, world.minute);
  assert.equal(sora.name, '소라 랜드', '프리셋 괴이 이름은 모델이 바꿔 불러도 고정');
  const r = reports(world, catalog, noSpawn, 'A00');
  assert.match(r.an, /\[AN\|서울특별시 종로구\|종로 폐역\|활성\|B\|P001\|<상황>\] \{0시간 0분 전\}/);
});

test('terminal states end the entry and block it for the next draw', () => {
  const w0 = applyOutput(started(), catalog, noSpawn, 'A00', '[AN|부산 기장군|소라 랜드|활성|A|없음]', always).world;
  const { world } = applyOutput(w0, catalog, S, 'A00', '[AN|부산 기장군|소라 랜드|클리어|A|없음]', always);
  assert.ok(!world.an.some((e) => e.name === '소라 랜드' && e.loc === '07-0'));
  assert.ok(!world.an.some((e) => e.presetName === '소라 랜드'), '막 끝난 프리셋은 바로 다시 뽑히지 않음');
  assert.deepEqual(world.cleared, ['소라 랜드'], '클리어한 괴이는 위키 정답을 펼치려고 기억');
});

test('model-invented anomalies use the extra pool and need an unambiguous free region', () => {
  const w = emptyWorld();
  const a = applyOutput(w, catalog, noSpawn, 'A00', '[AN|강원특별자치도 춘천시|호수의 목소리|활성|C|없음]', always).world;
  assert.equal(a.an[0].origin, 'model');
  assert.equal(a.an[0].name, '호수의 목소리');
  const b = applyOutput(w, catalog, noSpawn, 'A00', '[AN|중구|모호한 괴이|활성|C|없음]', always).world;
  assert.equal(b.an.length, 0, '여러 곳에 있는 지역은 받지 않음');
  let c = w;
  for (const [i, gu] of ['춘천시', '강릉시', '원주시', '속초시'].entries()) {
    c = applyOutput(c, catalog, noSpawn, 'A00', `[AN|강원특별자치도 ${gu}|괴이${i}|활성|C|없음]`, always).world;
  }
  assert.equal(c.an.length, 3, '추가 여유분 3');
});

test('incidents: landmark by name, random pending gets its first name, 종료 ends', () => {
  const w = emptyWorld();
  w.inc.push({ loc: '11-7', name: '', state: '발생대기', situation: '', kind: 'random', origin: 'auto', since: null, born: null });
  const a = applyOutput(w, catalog, noSpawn, 'A00', '[IN|강원특별자치도 춘천시|춘천역 화재|진행|P002가 출동]\n[IN|서울 종로구|관리국 본부|진행|정전]', always).world;
  assert.equal(a.inc[0].name, '춘천역 화재');
  assert.equal(a.inc[0].situation, '스팡달가 출동', '요원 코드는 이름으로');
  assert.equal(a.inc[1].loc, '02-6');
  assert.equal(a.inc[1].origin, 'model');
  const d = applyOutput(a, catalog, noSpawn, 'A00', '[IN|서울 종로구|관리국 본부|진행|P001|진화 중]', always).world;
  assert.equal(d.inc[1].deploy, 'P001', '배치 칸');
  assert.equal(d.inc[1].situation, '진화 중');
  assert.match(reports(d, catalog, noSpawn, 'A00').in, /\[IN\|서울특별시 종로구\|관리국 본부\|진행\|P001\|진화 중\]/);
  const b = applyOutput(a, catalog, noSpawn, 'A00', '[IN|서울 종로구|관리국 본부|종료|복구]', always).world;
  assert.equal(b.inc.length, 1);
});

test('mystic sites: only catalog names, 소실 ends', () => {
  const w = emptyWorld();
  const a = applyOutput(w, catalog, noSpawn, 'A00', '[MS|부산광역시 기장군|달빛 서점|출현|쟈알디]\n[MS|부산광역시 금정구|없는 장소|출현|없음]', always).world;
  assert.deepEqual(a.ms.map((e) => e.name), ['달빛 서점']);
  assert.equal(a.ms[0].visitors, '쟈알디');
  const b = applyOutput(a, catalog, noSpawn, 'A00', '[MS|부산광역시 기장군|달빛 서점|소실|없음]', always).world;
  assert.equal(b.ms.length, 0);
});

test('agents: code or english name, unknown names ignored, death refill promotes the next person', () => {
  let w = applyOutput(emptyWorld(), catalog, noSpawn, 'A00', '[AG|P001|외근|종로 순찰]\n[AG|Spangdal|사망|A00 본부]\n[AG|P999|휴게|x]', always).world;
  assert.equal(w.agents.P001.st, '외근');
  assert.equal(w.agents.P002.situation, '관리국 본부');
  assert.equal(w.agents.P999, undefined);
  assert.equal(w.agents.P002.dead, 1);
  w = applyOutput(w, catalog, noSpawn, 'A00', '본문', always).world;
  assert.deepEqual(w.retired, ['P002']);
  assert.deepEqual(w.promoted, ['P003(잼트리)']);
  const r = reports(w, catalog, noSpawn, 'A00');
  assert.match(r.ag, /\[AG\|P001\|외근\|종로 순찰\]/);
  assert.match(r.ag, /NEW \[AG\|P003\|/);
  assert.doesNotMatch(r.ag, /P002/);
});

test('[AC] switches faction and roster', () => {
  const { faction, world } = applyOutput(emptyWorld(), catalog, noSpawn, 'A00', '[AC|C00]', always);
  assert.equal(faction, 'C00');
  assert.match(reports(world, catalog, noSpawn, 'C00').ag, /P010 사장 \(Sajang\)/);
});

test('expiry: TTL ends entries unless the user is exploring them', () => {
  const w = emptyWorld();
  w.minute = 0;
  w.an.push({ loc: '02-6', name: 'A', state: '활성', grade: 'C', deploy: '', kind: 'random', origin: 'auto', presetName: '', since: 0, born: 0, exploring: false });
  w.an.push({ loc: '02-7', name: 'B', state: '활성', grade: 'C', deploy: '', kind: 'random', origin: 'auto', presetName: '', since: 0, born: 0, exploring: true });
  w.minute = 48 * 60;
  expire(w, S);
  assert.deepEqual(w.an.map((e) => e.name), ['B']);
});

test('exploration follows the status line target', () => {
  const w = emptyWorld();
  w.an.push({ loc: '02-6', name: '종로 폐역', state: '활성', grade: 'C', deploy: '', kind: 'random', origin: 'auto', presetName: '', since: null, born: null, exploring: false });
  const a = applyOutput(w, catalog, noSpawn, 'A00', '[▣|2025.01.01|02:00 AM|☀️|4°C|서울|종로 폐역]', always).world;
  assert.equal(a.an[0].exploring, true);
  const b = applyOutput(a, catalog, noSpawn, 'A00', '[▣|2025.01.01|03:00 AM|☀️|4°C|서울|모르는 이름]', always).world;
  assert.equal(b.an[0].exploring, true, '이름이 안 맞으면 그대로');
  const c = applyOutput(b, catalog, noSpawn, 'A00', '[▣|2025.01.01|04:00 AM|☀️|4°C|서울|없음]', always).world;
  assert.equal(c.an[0].exploring, false);
});

test('codesToNames uses viewer faction display', () => {
  assert.equal(codesToNames('A00와 B00, P001', catalog, 'B00'), '가짜 관리국와 관리국, 쟈알디');
});

test('processOutput: cleans the stored message, updates vars, ignores repeats and chats with the system off', () => {
  const vars = startWorldVars(catalog, S, 'A00', always);
  const soraAt = locName(readWorld({ scriptstate: vars }).an.find((e) => e.presetName === '소라 랜드').loc);
  const chat = {
    message: [{ role: 'user', data: 'hi' }, { role: 'char', data: `본문\n[AN|${soraAt}|소라랜드 정문|활성|A|P001]\n[AC|C00]` }],
    scriptstate: { $st_faction: 'A00', ...vars },
  };
  const raw = chat.message[1].data;
  const next = processOutput(chat, 1, raw, catalog, S, always);
  assert.equal(next.message[1].data, '본문');
  assert.equal(next.scriptstate.$st_faction, 'C00');
  assert.equal(next.scriptstate.$ib_affiliation, '백일몽 주식회사');
  assert.match(next.scriptstate.$an_report, /소라 랜드\|활성\|A\|P001/);
  assert.equal(readWorld(next).an.find((e) => e.presetName === '소라 랜드').state, '활성');
  assert.equal(processOutput(next, 1, '본문', catalog, S, always), null, '같은 응답에 다시 불리면 아무것도 안 함');
  const off = { ...chat, scriptstate: { ...chat.scriptstate, $st_anomaly_on: '0' } };
  assert.equal(processOutput(off, 1, raw, catalog, S, always), null);
  assert.equal(typeof next.scriptstate[WORLD_KEY], 'string');
});

test('processOutput: a reroll replaces the previous response instead of stacking on it', () => {
  const vars = startWorldVars(catalog, S, 'A00', always);
  const base = { message: [{ role: 'user', data: 'hi' }], scriptstate: { $st_faction: 'A00', $st_pick: 'A00', $ib_affiliation: '관리국', ...vars } };
  const A = '본문 A\n[AG|P001|사망|소라 랜드]\n[AC|C00]';
  const B = '본문 B';
  const afterA = processOutput({ ...base, message: [...base.message, { role: 'char', data: A }] }, 1, A, catalog, S, always);
  assert.equal(afterA.scriptstate.$st_faction, 'C00');
  assert.equal(readWorld(afterA).agents.P001.st, '사망');
  const reroll = processOutput({ ...afterA, message: [afterA.message[0], { role: 'char', data: B }] }, 1, B, catalog, S, always);
  const fresh = processOutput({ ...base, message: [...base.message, { role: 'char', data: B }] }, 1, B, catalog, S, always);
  assert.deepEqual(readWorld(reroll), readWorld(fresh), '리롤은 이전 응답이 없었던 것처럼');
  assert.equal(reroll.scriptstate.$st_faction, 'A00', '이전 응답의 소속 변경도 되돌림');
  assert.equal(reroll.scriptstate.$ib_affiliation, '관리국');
  // 다음 턴은 리롤된 응답 위에 쌓인다
  const C = '본문 C';
  const next = processOutput({ ...reroll, message: [...reroll.message, { role: 'user', data: '다음' }, { role: 'char', data: C }] }, 3, C, catalog, S, always);
  assert.equal(readWorld(next).epoch, readWorld(reroll).epoch + 1);
});

test('custom mission: pending anomaly is briefed, registered from the model tag, and can be cancelled', () => {
  const w = emptyWorld();
  assert.equal(requestMission(w, catalog, noSpawn, 'an', '없는 괴이'), '목록에 없는 괴이예요.');
  assert.equal(requestMission(w, catalog, noSpawn, 'an', '명일 아파트'), null);
  assert.match(w.notice, /요청 대기: 명일 아파트/);
  assert.match(reports(w, catalog, noSpawn, 'A00').an, /NEW \[AN\|<발생 지역: 시도와 시군구>\|명일 아파트\|활성/);
  // 모델이 태그를 안 쓰면 계속 기다린다
  const a = applyOutput(w, catalog, noSpawn, 'A00', '본문', always).world;
  assert.equal(a.pending.an, '명일 아파트');
  assert.match(a.notice, /기다리는 중/);
  const b = applyOutput(a, catalog, noSpawn, 'A00', '[AN|서울 종로구|명일 아파트|활성|B|없음]', always).world;
  assert.equal(b.pending.an, undefined);
  assert.match(b.notice, /커스텀 임무 등록: 명일 아파트/);
  const e = b.an.find((x) => x.name === '명일 아파트');
  assert.equal(e.origin, 'manual');
  assert.equal(e.state, '활성');
  assert.equal(locName(e.loc), '서울특별시 종로구');
  assert.equal(requestMission(b, catalog, noSpawn, 'an', '명일 아파트'), '이미 발생 중인 괴이예요.');
  const c = emptyWorld();
  requestMission(c, catalog, noSpawn, 'an', '소라 랜드');
  cancelMission(c, 'an');
  assert.equal(c.pending.an, undefined);
  assert.doesNotMatch(reports(c, catalog, noSpawn, 'A00').an, /소라 랜드/);
});

test('custom mission: landmark becomes a manual incident, mystic site a manual site', () => {
  const w = emptyWorld();
  assert.equal(requestMission(w, catalog, noSpawn, 'lm', '관리국 본부'), null);
  assert.match(reports(w, catalog, noSpawn, 'A00').in, /NEW \[IN\|서울특별시 종로구\|관리국 본부\|진행/);
  assert.equal(requestMission(w, catalog, noSpawn, 'ms', '달빛 서점'), null);
  const a = applyOutput(w, catalog, noSpawn, 'A00', '[IN|서울 종로구|관리국 본부|진행|P001 출동]\n[MS|부산 해운대구|달빛 서점|출현|없음]', always).world;
  assert.equal(a.inc[0].origin, 'manual');
  assert.equal(a.inc[0].situation, '쟈알디 출동');
  assert.equal(a.ms[0].origin, 'manual');
  assert.ok(!a.pending.an && !a.pending.ms && !a.pending.in);
});

test('map events: only live entries, stable keys, ending one blocks it', () => {
  const w = emptyWorld();
  w.an.push({ loc: '02-6', name: '종로 폐역', state: '활성', grade: 'C', deploy: 'P001', kind: 'random', origin: 'auto', presetName: '', since: 0, born: 0, exploring: false });
  w.an.push({ loc: '02-7', name: '', state: '발생대기', grade: '', deploy: '', kind: 'random', origin: 'auto', presetName: '', since: null, born: 0, exploring: false });
  w.ms.push({ loc: '07-0', name: '달빛 서점', state: '출현', visitors: '없음', origin: 'auto', since: 0, born: 0 });
  const ev = activeEvents(w);
  assert.deepEqual(ev.map((e) => e.kind), ['an', 'ms']);
  assert.equal(endEvent(w, 'an|02-6|다른 이름|0'), false);
  assert.equal(endEvent(w, ev[0].key), true);
  assert.equal(w.an.length, 1);
  assert.equal(w.skip.an, '02-6');
  // 막 끝난 상황은 이름 막기와 같은 동안 남는다
  assert.deepEqual(endedShown(w).map((e) => e.loc), ['02-6']);
  tick(w, catalog, noSpawn, always);
  assert.equal(endedShown(w).length, 1, '다음 응답까지는 남는다');
  tick(w, catalog, noSpawn, always);
  assert.equal(endedShown(w).length, 0, '그다음 응답에서 사라진다');
  assert.ok(LOCKED_STATES.includes('작전투입'));
  assert.equal(agentLocked(undefined), false);
  assert.equal(agentLocked({ st: '미정', situation: '', since: null, dead: 0 }), false, '태그가 없던 요원은 편성 가능');
  assert.equal(agentLocked({ st: '미정', situation: '', since: null, dead: 0, tagged: true }), true);
  assert.equal(agentLocked({ st: '작전투입', situation: '', since: null, dead: 0 }), true);
  const t = applyOutput(emptyWorld(), catalog, noSpawn, 'A00', '[AG|P001|실종|]', always).world;
  assert.equal(agentLocked(t.agents.P001), true);
  assert.equal(t.agents.P001.tagged, true);
});

test('anomaly and mystic site situations are stored, reported and kept when the tag omits them', () => {
  let w = applyOutput(started(), catalog, noSpawn, 'A00', '[AN|부산 기장군|소라 랜드|활성|A|P001|회전목마가 혼자 돈다]', always).world;
  assert.equal(w.an.find((e) => e.name === '소라 랜드').situation, '회전목마가 혼자 돈다');
  assert.match(reports(w, catalog, S, 'A00').an, /\|A\|P001\|회전목마가 혼자 돈다\]/);
  assert.equal(activeEvents(w).find((e) => e.kind === 'an').report, '회전목마가 혼자 돈다');
  // 옛 다섯 칸 태그: 상황은 그대로
  w = applyOutput(w, catalog, noSpawn, 'A00', '[AN|부산 기장군|소라 랜드|활성|A|P001]', always).world;
  assert.equal(w.an.find((e) => e.name === '소라 랜드').situation, '회전목마가 혼자 돈다');
});
