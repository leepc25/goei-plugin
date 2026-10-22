// 본부 규칙 시험 (src/game/action/hq/logic.ts). DOM 없음.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = async (entry) => {
  const out = await build({ entryPoints: [entry], bundle: true, format: 'esm', target: 'es2022', write: false, loader: { '.css': 'text' } });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};
const L = await bundle('src/game/action/hq/logic.ts');
const S = await bundle('src/game/action/hq/state.ts');
const C = await bundle('src/game/action/hq/contract.ts');
const fixed = (v) => () => v;
const result = (how, extra = {}) => ({ ...C.emptyResult(how), ...extra });

test('게시판 → 출동 정보: 칸·커피는 출동으로 넘어가고, 숙련 동작·능력치가 들어간다', () => {
  const s = S.newSave();
  const cards = L.missionBoard(s);
  assert.equal(cards[0].def.id, 'm1');
  assert.ok(cards.length >= 1 && cards.length <= 3);
  L.pickCoffee(s, 'mix');
  const l = L.launch(s, 'm1', 7);
  assert.equal(typeof l, 'object');
  assert.equal(l.items[0].id, 'medkit');
  assert.deepEqual(s.loadout, [null, null, null, null]);
  assert.equal(s.coffee, null);
  assert.equal(l.stats.hp, Math.round(220 * 1.1));
  assert.deepEqual(l.moves, []);
  assert.equal(L.launch(s, 'm1', 8), '이미 출동 중이에요.');
});

test('귀환 성공: 보상·현금 절반 환산·남은 아이템 돌려받기·회수물 감정 대기·피로', () => {
  const s = S.newSave();
  const l = L.launch(s, 'm1', 1);
  const lines = L.settle(s, l, result('return', { missionDone: true, depth: 2, floors: 2, cash: 100, teeth: 1, found: ['greet', 'lobby'], bag: [{ id: 'odd', name: '이상 물품', research: 2 }], itemsLeft: [{ id: 'medkit', n: 1 }, null, null, null] }), fixed(0.9));
  assert.ok(lines[0].startsWith('귀환'));
  assert.equal(s.currencies.budget, 200 + 50 + 100);
  assert.equal(s.currencies.teeth, 1 + 2);
  assert.deepEqual(s.rulebook, ['greet', 'lobby']);
  assert.deepEqual(s.missionsDone, ['m1']);
  assert.equal(s.loadout[0].n, 1);
  assert.equal(s.appraisal.length, 1);
  assert.equal(s.agents.jyaldi.fatigue, 1);
  assert.equal(s.day, 2);
  assert.ok(s.flags.firstRun && s.flags.firstRecovery);
  assert.equal(s.active, null);
  // 감정 → 연구 자료 → 연구실
  L.appraise(s);
  assert.equal(s.currencies.research, 2);
  assert.ok(L.placeOpen(s, 'lab'));
});

test('후송: 현금 0, 회수물·미송신 규칙 절반, 아이템 잃음, 영구 부상 판정, 송신한 규칙은 보존', () => {
  const s = S.newSave();
  const l = L.launch(s, 'm1', 1);
  L.settle(s, l, result('evac', { depth: 3, cash: 300, found: ['a', 'b', 'c', 'd'], sent: ['a'], bag: [{ id: 'x', name: 'x' }, { id: 'y', name: 'y' }], itemsLeft: [{ id: 'medkit', n: 2 }, null, null, null] }), fixed(0.01));
  assert.equal(s.currencies.budget, 200);
  assert.deepEqual(s.rulebook, ['a', 'b', 'd']);
  assert.equal(s.appraisal.length, 1);
  assert.deepEqual(s.loadout, [null, null, null, null]);
  assert.equal(s.agents.jyaldi.injured, 1);
  assert.equal(L.canDeploy(s, 'jyaldi').ok, false);
  // 이번 검증은 기존 쟈알디만 사용: 치료 후 재출동
  assert.match(L.treat(s, 'jyaldi'), /치료 완료/);
  const l2 = L.launch(s, 'm1', 2);
  L.settle(s, l2, result('withdraw', { depth: 1 }), fixed(0.9));
  assert.equal(s.agents.jyaldi.injured, 0);
  assert.equal(s.agents.jyaldi.fatigue, 2);
});

test('철수는 성공 보상이 없고, 피로는 연속 출동에서 쌓여 시작 체력을 줄인다', () => {
  const s = S.newSave();
  for (let i = 0; i < 4; i++) {
    const l = L.launch(s, 'm1', i);
    L.settle(s, l, result('withdraw', { depth: 1 }), fixed(0.9));
  }
  assert.equal(s.agents.jyaldi.fatigue, 3);
  assert.deepEqual(s.missionsDone, []);
  assert.equal(L.statsFor(s, 'jyaldi').hp, Math.round(220 * 0.82));
});

test('숙련: 1~10단계, 새 동작은 3·6에서만', () => {
  assert.equal(L.masteryLevel(0), 1);
  assert.equal(L.masteryLevel(200), 3);
  assert.equal(L.masteryLevel(99999), 10);
  const moves = [];
  for (let lv = 1; lv <= 10; lv++) for (const id of L.unlocksAt(lv)) if (!moves.includes(id)) moves.push(id);
  assert.deepEqual(moves, ['pool', 'unique_a', 'ult2', 'unique_b', 'relic_own', 'palette']);
  assert.deepEqual(L.unlocksAt(6).filter((x) => x.startsWith('unique')), ['unique_a', 'unique_b']);
});

test('보급·장착·연구·이빨 상자·위험 단계', () => {
  const s = S.newSave();
  s.currencies.budget = 2000;
  assert.match(L.buy(s, 'charm'), /살 수 없는/);
  L.buy(s, 'medkit');
  assert.equal(s.stash.medkit, 2);
  L.equip(s, 2, 'medkit');
  assert.deepEqual(s.loadout[2], { id: 'medkit', n: 1 });
  L.unequip(s, 2);
  assert.equal(s.stash.medkit, 2);
  s.currencies.research = 30;
  L.doResearch(s, 'rs_supply');
  assert.match(L.buy(s, 'charm'), /구입/);
  L.doResearch(s, 'rs_relic1');
  assert.ok(s.relicsOwned.includes('first_guard'));
  L.equipRelic(s, 0, 'first_guard');
  assert.equal(s.relics[0], 'first_guard');
  assert.match(L.approveDanger(s), /연구/);
  L.doResearch(s, 'rs_danger');
  assert.match(L.approveDanger(s), /결재 완료/);
  s.currencies.teeth = 3;
  assert.match(L.openToothBox(s, fixed(0.9)), /선물 상자/);
  assert.equal(s.currencies.teeth, 0);
});

test('구조 요청 마감을 넘기면 실패로 남고, 저장 문자열은 왕복한다', () => {
  const s = S.newSave();
  s.missionsDone = ['m1', 'm2', 'm3'];
  const cards = L.missionBoard(s, ['차원 승강기']);
  L.noteDeadlines(s, cards);
  assert.ok(cards.some((c) => c.def.id === 'm4' && c.left === 2));
  assert.ok(cards[0].linked);
  for (let i = 0; i < 2; i++) L.settle(s, L.launch(s, 'm1', i), result('withdraw'), fixed(0.9));
  assert.ok(s.failedRescues.includes('m4'));
  assert.ok(!L.missionBoard(s).some((c) => c.def.id === 'm4'));
  const back = S.parseSave(S.saveText(s));
  assert.deepEqual(back, s);
  assert.equal(S.parseSave('{"schema":"other"}'), null);
  assert.equal(S.parseSave('깨진'), null);
});

test('보고서는 버튼용 글만 만든다', () => {
  const s = S.newSave();
  L.settle(s, L.launch(s, 'm1', 1), result('return', { missionDone: true, depth: 2, floors: 2, found: ['greet'] }), fixed(0.9));
  assert.match(L.reportText(s), /^\[관리국 출동 보고\] 쟈알디 · 차원 승강기 · 임무 「로비에서 규칙 2개 확인 후 로프로 귀환」 · 귀환/);
});

test('엔진 기록(stage.*)으로 결과를 채우고 임무 달성은 본부가 판정한다', () => {
  const s = S.newSave();
  const l = L.launch(s, 'm1', 1);
  // 귀환했지만 규칙 1줄뿐 → 미달성
  L.settle(s, l, result('return', { missionDone: true, notes: { 'stage.found': ['greet'], 'stage.depth': 2 } }), fixed(0.9));
  assert.deepEqual(s.missionsDone, []);
  assert.deepEqual(s.rulebook, ['greet']);
  assert.equal(s.deepest, 2);
  const l2 = L.launch(s, 'm1', 2);
  L.settle(s, l2, result('return', { depth: 2, notes: { 'stage.found': ['greet', 'lobby'], 'stage.rescued': ['missing:5'] } }), fixed(0.9));
  assert.deepEqual(s.missionsDone, ['m1']);
  assert.deepEqual(s.rescued, ['worker']);
  assert.ok(L.placeOpen(s, 'interview'));
  // 진압은 수호자 처치 기록이 있어야
  const g = { id: 'm2', kind: '진압', title: '', depth: 3 };
  assert.equal(L.judgeMission(g, result('return', { depth: 3, notes: {} })), false);
  assert.equal(L.judgeMission(g, result('return', { depth: 3, notes: { bosses: ['guard'] } })), true);
  // 예전 저장의 임시 아이템 id는 옮겨진다
  const old = { ...S.newSave(), loadout: [{ id: 'heal', n: 2 }, null, null, null], stash: { torch: 1 } };
  const back = S.parseSave(JSON.stringify(old));
  assert.deepEqual(back.loadout[0], { id: 'medkit', n: 2 });
  assert.deepEqual(back.stash, { flash: 1 });
});

test('출동 id: 결과에 남고, 같은 출동은 두 번 정산하지 않는다', () => {
  const s = S.newSave();
  const l = L.launch(s, 'm1', 42);
  assert.ok(l.runId);
  const r = result('return', { runId: l.runId, cash: 100 });
  L.settle(s, l, r, fixed(0.9));
  const budget = s.currencies.budget;
  assert.equal(s.last.runId, l.runId);
  assert.equal(s.last.result.runId, l.runId);
  L.settle(s, l, r, fixed(0.9));
  assert.equal(s.currencies.budget, budget);
  assert.equal(s.day, 2);
});

test('임무 성공은 플래그 대신 깊이·고유 규칙·대상·실제 완료 기록으로 판단한다', () => {
  const goal = (id, kind, depth, extra = {}) => ({ id, kind, depth, title: '', ...extra });
  const cases = [
    [goal('m1', '조사', 2, { rules: 2 }), { missionDone: true, depth: 2 }, false],
    [goal('m1', '조사', 2, { rules: 2 }), { depth: 2, found: ['greet', 'greet'] }, false],
    [goal('m1', '조사', 2, { rules: 2 }), { depth: 1, found: ['greet', 'lobby'] }, false],
    [goal('m1', '조사', 2, { rules: 2 }), { depth: 2, found: ['greet', 'lobby'] }, true],
    [goal('m1', '조사', 2, { rules: 2 }), { depth: 2, sent: ['greet', 'lobby'] }, true],
    [goal('m2', '진압', 3), { depth: 3, notes: { boss: true, bosses: ['elder'] } }, false],
    [goal('m2', '진압', 3), { depth: 3, notes: { bosses: ['guard'] } }, true],
    [goal('m3', '조사', 5), { depth: 5, notes: { 'stage.visited': ['B-1 추격의 층'] } }, false],
    [goal('m3', '조사', 5), { depth: 5, notes: { 'stage.visited': ['B-1 추격의 층'], 'stage.clearedFloors': [5] } }, false],
    [goal('m3', '조사', 5), { depth: 5, notes: { 'stage.visited': ['B-1 추격의 층'], 'stage.clearedFloors': [4] } }, true],
    [goal('m4', '구조', 5, { rescue: 'worker' }), { depth: 5, rescued: ['child'] }, false],
    [goal('m4', '구조', 5, { rescue: 'worker' }), { depth: 5, rescued: ['missing:5'] }, true],
    [goal('m5', '조사', 5, { rules: 3 }), { depth: 5, found: ['greet', 'lobby', 'entry'], notes: { 'stage.visited': ['B-2 재현의 층'] } }, false],
    [goal('m5', '조사', 5, { rules: 3 }), { depth: 5, found: ['r_greet', 'r_quiet', 'r_meal'], notes: { 'stage.visited': ['B-2 재현의 층'] } }, true],
    [goal('m6', '진압', 5), { depth: 5, notes: { bosses: ['guard'] } }, false],
    [goal('m6', '진압', 5), { depth: 5, notes: { bosses: ['elder'] } }, true],
    [goal('m6', '진압', 5), { depth: 5, notes: { bosses: ['elder_f'] } }, false],
    [goal('m6', '진압', 5), { depth: 5, notes: { bosses: ['elder_f', 'elder_m'] } }, true],
    [goal('m7', '회수', 3, { recover: 'checklist' }), { depth: 3, notes: { 'stage.checklist': true } }, false],
    [goal('m7', '회수', 3, { recover: 'checklist' }), { depth: 3, bag: [{ id: 'checklist', name: '점검표' }] }, true],
    [goal('m8', '조사', 6), { depth: 6, missionDone: true }, false],
    [goal('m8', '조사', 6), { depth: 6, notes: { 'stage.trial': 'success' } }, true],
    [goal('m9', '기록', 8), { depth: 7, missionDone: true }, false],
    [goal('m9', '기록', 8), { depth: 8 }, true],
  ];
  for (const [g, data, expected] of cases) {
    assert.equal(L.judgeMission(g, result('return', data)), expected, JSON.stringify([g.id, data]));
    for (const how of ['withdraw', 'evac']) assert.equal(L.judgeMission(g, result(how, data)), false);
  }
});

test('모든 종료 방식: 송신·미송신 규칙, 구조, 회수물, 보급품, 재화, 감정 및 재출동', () => {
  for (const how of ['return', 'withdraw', 'evac']) {
    const s = S.newSave(), l = L.launch(s, 'm1', 100);
    const r = result(how, {
      runId: l.runId, depth: 2, floors: 2, cash: 101, budget: 21, teeth: 5,
      found: ['a', 'a', 'b', 'c', 'd'], sent: ['sent-only'], rescued: ['missing:5', 'worker'],
      notes: { 'stage.found': ['e'], 'stage.sent': ['sent-only'] },
      bag: [{ id: 'x', name: 'x', research: 2 }, null, { id: 'y', name: 'y', research: 3 }, { id: 'z', name: 'z', research: 4 }],
      itemsLeft: [{ id: 'medkit', n: 1 }, { id: 'bandage', n: 0 }],
    });
    L.settle(s, l, r, fixed(0.9));
    assert.equal(s.last.how, how);
    assert.deepEqual(s.currencies, { budget: how === 'return' ? 371 : how === 'withdraw' ? 271 : 210, teeth: how === 'return' ? 7 : how === 'withdraw' ? 5 : 2, research: 0 });
    assert.deepEqual(s.rulebook, how === 'evac' ? ['sent-only', 'a', 'c', 'e'] : ['sent-only', 'a', 'b', 'c', 'd', 'e']);
    assert.deepEqual(s.rescued, ['worker']);
    assert.equal(s.appraisal.length, how === 'evac' ? 2 : 3);
    assert.deepEqual(s.loadout, [how === 'evac' ? null : { id: 'medkit', n: 1 }, null, null, null]);
    assert.equal(s.last.result.missionDone, how === 'return');
    r.bag[0].research = 999;
    assert.equal(s.appraisal[0].research, 2, '정산 기록은 엔진 결과와 참조를 공유하지 않는다');
    L.appraise(s);
    assert.equal(s.currencies.research, how === 'evac' ? 6 : 9);
    const next = L.launch(s, 'm1', 101);
    assert.equal(next.agent, 'jyaldi');
    assert.notEqual(next.runId, l.runId);
    assert.equal(next.items[0]?.n ?? 0, how === 'evac' ? 0 : 1);
  }
});

test('active만 한 번 정산: 오래된 재전달·id 불일치·불러오기 뒤 중복은 무변경', () => {
  let s = S.newSave();
  const first = L.launch(s, 'm1', 1);
  const r = result('return', { runId: first.runId, depth: 2, found: ['greet', 'lobby'], cash: 100 });
  const before = S.saveText(s);
  L.settle(s, first, { ...r, runId: 'wrong' }, fixed(0.9));
  assert.equal(S.saveText(s), before);
  L.settle(s, { ...first, goal: { ...first.goal, id: 'm9' } }, r, fixed(0.9));
  assert.equal(S.saveText(s), before);
  L.settle(s, first, r, fixed(0.9));
  s = S.parseSave(S.saveText(s));
  let snapshot = S.saveText(s);
  L.settle(s, first, r, fixed(0.9));
  assert.equal(S.saveText(s), snapshot);
  const second = L.launch(s, 'm1', 2);
  L.settle(s, second, result('withdraw'), fixed(0.9));
  snapshot = S.saveText(s);
  L.settle(s, first, r, fixed(0.9));
  assert.equal(S.saveText(s), snapshot);
  const third = L.launch(s, 'm1', 3);
  s = S.parseSave(S.saveText(s));
  snapshot = S.saveText(s);
  L.settle(s, first, r, fixed(0.9));
  assert.equal(S.saveText(s), snapshot);
  assert.equal(s.active.runId, third.runId);
  L.settle(s, third, result('withdraw'), fixed(0.9));
  assert.equal(s.runs, 3);
});
