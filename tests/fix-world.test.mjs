// 전수검사 11-13 세계 고침: 새 요원 코드, 기본 세력 호칭, 글로 가져오기, 상태창 빠진 칸, 종료 시각, 같은 구 새 괴이
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initTestData } from './data-init.mjs';

const dir = await mkdtemp(join(tmpdir(), 'goei-fixworld-'));
await build({ entryPoints: ['src/core/index.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, loader: { '.txt': 'text' }, logLevel: 'silent' });
const W = await import(pathToFileURL(join(dir, 'core/index.mjs')));
initTestData(W);

const always = () => 0;
const worldBook = {
  괴이: [[true, '소라 랜드', '소라 랜드', 'Sora Land', []]],
  '미스틱 사이트': [[true, '달빛 서점', '달빛 서점', 'Moon Books', []]],
  랜드마크: [[true, '관리국 본부', '관리국', '관리국', 'Bureau HQ', '02', '종로구', 52.6, 44.6, []]],
};
const roster = {
  version: 2,
  refill: 2,
  characters: [
    { id: 'P001', name: '쟈알디', english: 'Jyaldi', lore: '쟈알디', aliases: [], affiliation: 'A00', rank: '팀장', department: '', roster_for: ['A00'], phone_tabs: [] },
    { id: 'P39611', name: '새요원', english: '', lore: '새요원', aliases: [], affiliation: 'A00', rank: '요원', department: '', roster_for: ['A00'], phone_tabs: [] },
  ],
};
const catalog = W.parseCatalog([
  { comment: 'World catalog', content: JSON.stringify(worldBook) },
  { comment: 'Agent roster', content: JSON.stringify(roster) },
]);
const S = { ...W.DEFAULT_SETTINGS, agent_limit: 5, preset_p: 0, random_p: 0, incident_p: 0, mystic_p: 0 };

test('world#2: 숫자가 셋보다 긴 새 요원 코드도 AG 태그로 반영되고, 영문명이 없으면 빈 괄호를 안 보낸다', () => {
  const w = W.applyOutput(W.emptyWorld(), catalog, S, 'A00', '[AG|P39611|작전투입|종로 폐역 진입]\n[AG|쟈알디(P001)|외근|순찰]\n[AG|P999|휴게|x]', always).world;
  assert.equal(w.agents.P39611.st, '작전투입');
  assert.equal(w.agents.P001.st, '외근');
  assert.equal(w.agents.P999, undefined);
  const r = W.reports(w, catalog, S, 'A00');
  assert.doesNotMatch(r.ag, /NEW \[AG\|P39611/);
  assert.match(r.ag, /P001 쟈알디 \(Jyaldi\)/);
  assert.match(r.ag, /P39611 새요원(?! \()/);
  assert.doesNotMatch(r.ag, /\(\)/);
  const [inc] = W.scanIncidents('[IN|서울특별시 종로구|정전|진행|P39611, P001]');
  assert.equal(inc.deploy, 'P39611, P001');
  assert.equal(inc.situation, '');
});

test('world#3: 기본 세력의 「기본」 호칭을 바꿔도 조직이 갈라지지 않고 저장값이 남는다', () => {
  const F = (id, name) => ({ comment: name, key: `folder:${id}`, mode: 'folder', content: '' });
  const L = (name, folder) => ({ comment: name, key: name, content: `${name} 설정`, mode: 'normal', folder: `folder:${folder}` });
  const base = [F('a', '🚧괴이'), F('g', '🙂요원'), L('명일 아파트', 'a'), L('-----관리국-----', 'g'), L('쟈알디', 'g')];
  const data = W.directoryData(W.readDirectory(base));
  data.조직.백일몽 = { ...data.조직.백일몽, hidden: true, title: '백일몽(주)' };
  data.호칭 = { ...(data.호칭 ?? {}), none: { ...(data.호칭?.none ?? {}), C00: '백일몽 주식회사' } };
  const d = W.readDirectory(W.withDirectory(base, data));
  const c00 = d.orgs.filter((o) => o.faction === 'C00');
  assert.equal(c00.length, 1);
  assert.equal(c00[0].name, '백일몽', '기록·관계 열쇠는 기본 세계 이름');
  assert.equal(c00[0].spec.hidden, true);
  assert.equal(c00[0].spec.title, '백일몽(주)');
  assert.ok(!d.orgs.some((o) => !o.faction && o.name === '백일몽'), '코드 없는 같은 이름 조직이 생기지 않음');
  // 저장을 한 번 더 거쳐도 같은 줄
  const d2 = W.readDirectory(W.withDirectory(base, W.directoryData(d)));
  assert.deepEqual(d2.orgs.filter((o) => o.faction === 'C00').map((o) => o.name), ['백일몽']);
});

test('world#4: 조립 글을 가져오면 문서 제목은 건너뛰고 칸 안 소제목·[…] 줄은 본문으로 남는다', () => {
  const an = W.parseImport('anomaly', '### Sora Land\n\n#### Identity\n놀이공원\n\n#### Zones\n##### Main Plaza / Entrance Path\n광장\n##### Exit Ticketing Station / Riddle Room\n출구');
  assert.equal(an.fields.identity, '놀이공원', 'Identity 는 개체 칸이 아님');
  assert.equal(an.fields.entities, undefined);
  assert.match(an.fields.space, /##### Main Plaza \/ Entrance Path\n광장/);
  assert.match(an.fields.space, /##### Exit Ticketing Station/);
  assert.deepEqual(an.extra, []);
  assert.ok(!an.map.some(([t]) => t === 'Sora Land'));
  const org = W.parseImport('org', '### Bureau\n[Affiliation code: A00]\n\n#### Overview\n관리국');
  assert.equal(org.fields.intro, '관리국');
  assert.deepEqual(org.extra, []);
  const ag = W.parseImport('agent', '#### Identity\n- Age: 24\n- Language: Korean\n- Image color: red\n\n#### Personality\n밝다\n[Flaws]\n급하다');
  assert.equal(ag.fields.age, '24');
  assert.match(ag.fields.character, /\[Flaws\]\n급하다/);
  // # 제목 없는 글은 [..] 줄로 나눈다 (지금대로)
  const plain = W.parseImport('agent', '[Personality]\n밝다\n[Speech]\n반말');
  assert.equal(plain.fields.character, '밝다');
  assert.equal(plain.fields.voice, '반말');
});

test('world#5: 지금 구성보다 한 칸 빠진 상태창은 빠진 칸을 찾아 읽는다', () => {
  W.setStatusColumns({});
  try {
    const [miss] = W.findStatusTags('[▣|2025.01.01|02:47 AM|4°C|서울 종로구 거리|없음|없음|없음|관리국/신입|1230000]');
    assert.deepEqual([miss.weather, miss.temp, miss.place, miss.identity, miss.wallet], ['', '4°C', '서울 종로구 거리', '관리국/신입', '1230000']);
    const [dep] = W.findStatusTags('[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음|없음|관리국/신입|1230000]');
    assert.deepEqual([dep.weather, dep.temp, dep.place, dep.identity, dep.wallet], ['☀️', '4°C', '서울 종로구 거리', '관리국/신입', '1230000']);
    const [joined] = W.findStatusTags('[▣|2025.01.01|02:47 AM|☀️ 12°C|서울 종로구 거리|없음|없음|없음|관리국/신입|1230000]');
    assert.deepEqual([joined.weather, joined.temp, joined.place, joined.identity, joined.wallet], ['☀️', '12°C', '서울 종로구 거리', '관리국/신입', '1230000']);
    // 잔고가 없는 옛 9칸 줄은 지금처럼
    const [old] = W.findStatusTags('[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음|없음|없음|관리국/신입]');
    assert.deepEqual([old.weather, old.temp, old.identity, old.wallet], ['☀️', '4°C', '관리국/신입', '']);
    // 온전한 줄도 지금처럼
    const [full] = W.findStatusTags('[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음|없음|없음|관리국/신입|1230000]');
    assert.deepEqual([full.weather, full.temp, full.identity, full.wallet], ['☀️', '4°C', '관리국/신입', '1230000']);
  } finally {
    W.setStatusColumns(undefined);
  }
});

const H = 60;
test('world#6: 종료 시각을 안 적고 기한 지나 닫으면 기한 시각, 기한 전이면 지금', () => {
  const s = { ...S, incident_expire: 1, incident_ttl: 12 };
  const mk = (now) => {
    const w = W.emptyWorld();
    w.minute = now;
    w.inc.push({ loc: '02-6', name: '정전', state: '진행', situation: '', kind: 'random', origin: 'auto', since: 0, born: 0 });
    return w;
  };
  const late = W.applyOutput(mk(7 * 24 * H), catalog, s, 'A00', '[IN|서울특별시 종로구|정전|종료|없음|진화 완료]', always).world;
  assert.equal(late.closed[0].minute, 12 * H);
  const early = W.applyOutput(mk(5 * H), catalog, s, 'A00', '[IN|서울특별시 종로구|정전|종료|없음|진화 완료]', always).world;
  assert.equal(early.closed[0].minute, 5 * H);
  const off = W.applyOutput(mk(7 * 24 * H), catalog, { ...s, incident_expire: 0 }, 'A00', '[IN|서울특별시 종로구|정전|종료|없음|진화 완료]', always).world;
  assert.equal(off.closed[0].minute, 7 * 24 * H, '자동 종료가 꺼진 묶음은 지금');
});

test('world#7: 한 응답에 제 이름 줄이 있으면 같은 구의 다른 이름 태그가 덮거나 끝내지 못한다', () => {
  const mk = () => {
    const w = W.emptyWorld();
    w.minute = 0;
    w.an.push({ loc: '02-6', name: '종로 폐역', state: '활성', grade: 'C', deploy: 'P001', kind: 'random', origin: 'auto', presetName: '', since: 0, born: 0, exploring: true });
    return w;
  };
  for (const lines of [
    ['[AN|서울특별시 종로구|종로 폐역|활성|C|P001|진행]', '[AN|서울특별시 종로구|광화문 지하도|활성|D|없음|새 괴이]'],
    ['[AN|서울특별시 종로구|광화문 지하도|활성|D|없음|새 괴이]', '[AN|서울특별시 종로구|종로 폐역|활성|C|P001|진행]'],
    ['[AN|서울특별시 종로구|종로 폐역|활성|C|P001|진행]', '[AN|서울특별시 종로구|광화문 지하도|소멸|D|없음|끝]'],
  ]) {
    const w = W.applyOutput(mk(), catalog, S, 'A00', lines.join('\n'), always).world;
    assert.deepEqual(w.an.map((e) => [e.name, e.grade, e.state]), [['종로 폐역', 'C', '활성']], lines.join(' / '));
  }
  // 다른 이름 줄만 오면 이름을 따라간다 (지금대로)
  const w = W.applyOutput(mk(), catalog, S, 'A00', '[AN|서울특별시 종로구|종로3가 폐역|활성|C|P001|진행]', always).world;
  assert.equal(w.an[0].name, '종로3가 폐역');
});
