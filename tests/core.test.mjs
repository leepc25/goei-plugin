import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENARIOS, parseSeedManifest, buildSeed, applySeedLifetime, planStart, applyStart, readManifest,
  chatPhase, currentChoice, processRequest, StartError, MANIFEST_COMMENT, userTurns, unwrapScenes,
  parseDirective, destination, sceneDirective, validTeam, sceneRecord, readScene, stripSceneCard, renderSceneCards, DirectiveError,
} from '../dist-test/core.mjs';

const lore = [
  { comment: 'Start trigger', content: '# c\nA00-1:관리국|쟈알디|없는이름\nA00-2:관리국\nD00-6:\n' },
  { comment: '관리국', content: 'BUREAU' },
  { comment: '쟈알디', content: 'JYALDI' },
];
const DIRECTIVE = `===COMMON===
C

===OPENING===
OPEN

===CONTINUATION===
CONT

===CONTEXT===
Subject: [[DEST]]
Companions: [[PARTY]]

===FORMAT===
{"destination":{"name":"[[NAME]]","located":"[[LOCATION]] [[NAME]]"},
 "party":{"solo":"No additional companions selected; retain established companions.","group":"[[MEMBERS]] (in-person companions)",
 "support_one":"one support person (an extra, not on the roster)","support_many":"[[COUNT]] support personnel (extras, not on the roster)",
 "separator":", ","pair_separator":" and ","last_separator":", and "},
 "user_input":"Situation:\\n[[INPUT]]"}`;
const manifest = { schema: 1, plugin: 'goei-plugin', greetings: { 'A00-ko-1': 0, 'A00-en-1': 1, 'A00-ko-8': 2 } };

test('seed manifest parsing skips comments and empty lists', () => {
  const m = parseSeedManifest(lore[0].content);
  assert.deepEqual(m.get('A00-1'), ['관리국', '쟈알디', '없는이름']);
  assert.equal(m.has('D00-6'), false);
});

test('seed block collects lore by comment and reports missing names', () => {
  const r = buildSeed(lore, 'A00', 1);
  assert.equal(r.text, '%%SEED%%\nBUREAU\n\nJYALDI\n%%/SEED%%');
  assert.deepEqual(r.missing, ['없는이름']);
  assert.equal(buildSeed(lore, 'B00', 1).text, '');
});

test('duplicate lore copies are not injected twice', () => {
  const r = buildSeed([...lore, { comment: '관리국', content: 'BUREAU' }], 'A00', 2);
  assert.equal(r.text, '%%SEED%%\nBUREAU\n%%/SEED%%');
});

test('seed lifetime keeps body on first turn and drops it afterwards', () => {
  const text = 'pre\n%%SEED%%\nX\n%%/SEED%%\npost';
  assert.equal(applySeedLifetime(text, true), 'pre\nX\npost');
  assert.equal(applySeedLifetime(text, false), 'pre\npost');
});

test('request processing follows user turn count', () => {
  const msgs = [{ role: 'system', content: 'a %%SEED%%\nS\n%%/SEED%%\nb' }, { role: 'user', content: 'hi' }];
  const first = processRequest(msgs, { message: [{ role: 'user', data: 'hi' }] });
  assert.equal(first.messages[0].content, 'a S\nb');
  const second = processRequest(msgs, { message: [{ role: 'user', data: '1' }, { role: 'char', data: 'x' }, { role: 'user', data: '2' }] });
  assert.equal(second.messages[0].content, 'a b');
  assert.equal(processRequest([{ role: 'user', content: 'plain' }], { message: [] }).changed, false);
  // 지시문 + 덧붙인 글은 한 번의 전송
  assert.equal(userTurns({ message: [{ role: 'user', data: 'card' }, { role: 'user', data: 'more' }] }), 1);
  assert.equal(userTurns({ message: [{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }, { role: 'user', data: 'c' }, { role: 'user', data: 'd' }] }), 2);
});

test('directive: lore sections, party clause and scene record round trip', () => {
  const d = parseDirective([{ comment: 'Directive', content: DIRECTIVE }]);
  assert.equal(destination(d, '소라 랜드'), '소라 랜드');
  assert.equal(destination(d, '소라 랜드', '서울 종로구'), '서울 종로구 소라 랜드');
  const solo = sceneDirective(d, 'X', [], 0, false);
  assert.equal(solo, 'C\n\nCONT\n\nSubject: X\nCompanions: No additional companions selected; retain established companions.');
  assert.match(sceneDirective(d, 'X', ['쟈알디'], 0, true), /^C\n\nOPEN\n\n.*Companions: 쟈알디 \(in-person companions\)$/s);
  assert.match(sceneDirective(d, 'X', ['A', 'B'], 1, false), /A, B, and one support person/);
  assert.match(sceneDirective(d, 'X', ['A'], 2, false), /A and 2 support personnel/);
  assert.equal(validTeam(2, 1), true);
  assert.equal(validTeam(2, 2), false);
  const rec = sceneRecord({ target: '소라 랜드', party: '나, 쟈알디' }, 'BODY\nLINE');
  assert.deepEqual(readScene(rec), { target: '소라 랜드', party: '나, 쟈알디' });
  assert.equal(stripSceneCard(rec), 'BODY\nLINE');
  assert.equal(renderSceneCards(`앞\n${rec}\n뒤`, (s) => `[${s.target}|${s.party}]`), '앞\n[소라 랜드|나, 쟈알디]\n뒤');
  assert.throws(() => parseDirective([]), DirectiveError);
  assert.throws(() => parseDirective([{ comment: 'Directive', content: DIRECTIVE.replace('===OPENING===', '===OPEN===') }]), /OPENING/);
});

test('scene records are unwrapped for the model and merged with the text typed after them', () => {
  const rec = sceneRecord({ target: 'T', party: 'P' }, 'BODY');
  const a = unwrapScenes([{ role: 'system', content: 's' }, { role: 'user', content: rec }, { role: 'user', content: ' 문을 연다 ' }]);
  assert.deepEqual(a.messages.map((m) => m.content), ['s', 'BODY\n\nSituation:\n문을 연다']);
  const b = unwrapScenes([{ role: 'user', content: rec }, { role: 'assistant', content: 'ok' }]);
  assert.deepEqual(b.messages.map((m) => m.content), ['BODY', 'ok']);
  assert.equal(unwrapScenes([{ role: 'user', content: 'plain' }]).changed, false);
});

test('planStart builds the same chat variables as the original START', () => {
  const plan = planStart({ faction: 'A00', lang: 'ko', fm: 1 }, manifest, lore, 3);
  assert.equal(plan.fmIndex, 0);
  assert.equal(plan.kind, 'opening');
  assert.equal(plan.scriptstate.$st_faction, 'A00');
  assert.equal(plan.scriptstate.$st_lang, 'ko');
  assert.equal(plan.scriptstate.$st_fm, '1');
  assert.equal(plan.scriptstate.$ib_affiliation, '관리국');
  assert.equal(plan.scriptstate.$st_anomaly_on, '0');
  assert.match(plan.scriptstate.$seed_lore, /^%%SEED%%/);
  const chat = applyStart({ message: [], scriptstate: { $other: 'keep' } }, plan);
  assert.equal(chat.fmIndex, 0);
  assert.equal(chat.scriptstate.$other, 'keep');
});

test('direct input start uses the shared empty greeting', () => {
  const plan = planStart({ faction: 'A00', lang: 'ko', fm: 8 }, manifest, lore, 3);
  assert.equal(plan.kind, 'direct');
  assert.equal(plan.fmIndex, 2);
});

test('custom mission start reuses the direct empty greeting', () => {
  const plan = planStart({ faction: 'A00', lang: 'ko', fm: 9 }, manifest, lore, 3);
  assert.equal(plan.kind, 'preset');
  assert.equal(plan.fmIndex, 2);
  assert.equal(plan.scriptstate.$st_fm, '9');
  assert.throws(() => planStart({ faction: 'A00', lang: 'en', fm: 9 }, manifest, lore, 3), /첫 장면이 없어요/);
});

test('planStart rejects missing greetings and bad input', () => {
  assert.throws(() => planStart({ faction: 'A00', lang: 'ko', fm: 2 }, manifest, lore, 3), /첫 장면이 없어요/);
  assert.throws(() => planStart({ faction: 'A00', lang: 'ko', fm: 1 }, manifest, lore, 0), /첫 장면이 없어요/);
  assert.throws(() => planStart({ faction: 'Z00', lang: 'ko', fm: 1 }, manifest, lore, 3), StartError);
  assert.throws(() => planStart({ faction: 'A00', lang: 'jp', fm: 1 }, manifest, lore, 3), StartError);
});

test('manifest detection and chat phases', () => {
  assert.equal(readManifest([{ comment: MANIFEST_COMMENT, content: JSON.stringify(manifest) }]).plugin, 'goei-plugin');
  assert.equal(readManifest([{ comment: MANIFEST_COMMENT, content: '{bad' }]), null);
  assert.equal(readManifest([]), null);
  assert.equal(chatPhase({ message: [] }), 'fresh');
  assert.equal(chatPhase({ message: [], scriptstate: { $st_faction: 'C00' } }), 'staged');
  assert.equal(chatPhase({ message: [{ role: 'user', data: 'x' }] }), 'started');
  assert.deepEqual(currentChoice({ message: [], scriptstate: { $st_faction: 'C00', $st_lang: 'en', $st_fm: '3' } }), { faction: 'C00', lang: 'en', fm: 3 });
});

test('scenario data covers every faction with a direct and a preset slot', () => {
  assert.equal(SCENARIOS.factions.length, 5);
  for (const f of SCENARIOS.factions) {
    assert.equal(f.scenarios.filter((s) => s.kind === 'direct').length, 1, f.code);
    assert.equal(f.scenarios.filter((s) => s.kind === 'preset').length, 1, f.code);
    assert.ok(f.scenarios.some((s) => s.fm === SCENARIOS.defaultScenario[f.code]), f.code);
  }
});

import { WatchState, inside, clampPos, dragTo, parsePos, DEFAULT_FAB_POS } from '../dist-test/core.mjs';

test('watcher: button only on the Lite chat screen, intro on every entry', () => {
  const w = new WatchState();
  const on = { charIndex: 0, chatIndex: 0, chatScreen: true };
  assert.equal(w.needsCharacterCheck(on), true);
  assert.deepEqual(w.update(on, true), { changed: true, fabVisible: true, intro: true });
  assert.equal(w.needsCharacterCheck(on), false);
  assert.deepEqual(w.update(on), { changed: false, fabVisible: true, intro: false });
  assert.deepEqual(w.update({ ...on, chatIndex: 1 }), { changed: false, fabVisible: true, intro: false }, 'Lite 안에서 채팅만 바꾸면 효과 없음');
  assert.deepEqual(w.update({ ...on, chatScreen: false }), { changed: true, fabVisible: false, intro: false }, '설정 화면으로 가면 숨김');
  assert.deepEqual(w.update(on), { changed: true, fabVisible: true, intro: true }, '돌아오면 다시 효과');
  assert.deepEqual(w.update({ charIndex: 1, chatIndex: 0, chatScreen: true }, false), { changed: true, fabVisible: false, intro: false });
  assert.deepEqual(w.update(on, true), { changed: true, fabVisible: true, intro: true }, '다른 봇에서 돌아와도 효과');
  assert.equal(w.update({ charIndex: -1, chatIndex: -1, chatScreen: false }, false).fabVisible, false);
});

test('fab geometry: hit test, clamping and drag', () => {
  const r = { left: 100, top: 100, width: 48, height: 48 };
  assert.equal(inside(r, 120, 120), true);
  assert.equal(inside(r, 99, 120), false);
  assert.equal(inside(null, 120, 120), false);
  assert.equal(inside(r, undefined, 120), false);
  assert.deepEqual(clampPos({ right: -50, bottom: 5000 }, 400, 800), { right: 8, bottom: 744 });
  assert.deepEqual(dragTo({ right: 16, bottom: 96 }, -100, -50, 1000, 800), { right: 116, bottom: 146 });
  assert.deepEqual(dragTo({ right: 16, bottom: 96 }, 500, 0, 1000, 800), { right: 8, bottom: 96 });
  assert.deepEqual(parsePos('{"right":30,"bottom":40}'), { right: 30, bottom: 40 });
  assert.deepEqual(parsePos('junk'), DEFAULT_FAB_POS);
  assert.deepEqual(parsePos(null), DEFAULT_FAB_POS);
});
