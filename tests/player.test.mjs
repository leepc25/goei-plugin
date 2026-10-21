import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { applyPlayer, playerBlock, playerAgent, playableAgents, PLAYER_HEAD, migrateLore, parseCatalog, rosterFor, emptyWorld, lore as L } from '../dist-test/core.mjs';

const REAL = '/mnt/project-files/analysis/extracted/module.json';
const books = existsSync(REAL) ? (() => { const m = JSON.parse(readFileSync(REAL, 'utf8')); return migrateLore(m.lorebook ?? m.module?.lorebook); })() : null;

test('applyPlayer: 페르소나 설명 자리를 주인공 글로, 페르소나 이름은 요원 이름으로', () => {
  const persona = '평범한 신입 요원. 25살 남자.';
  const msgs = [{ role: 'system', content: `규칙\n${persona}\n끝` }, { role: 'user', content: '민수가 문을 연다.' }];
  const out = applyPlayer(msgs, `${PLAYER_HEAD}\nX`, persona, '민수', '쟈알디');
  assert.equal(out[0].content, `규칙\n${PLAYER_HEAD}\nX\n끝`);
  assert.equal(out[1].content, '쟈알디가 문을 연다.');
});

test('applyPlayer: 페르소나가 비면 첫 시스템 메시지 뒤에 넣고, 영문 이름은 낱말 경계로만', () => {
  const msgs = [{ role: 'system', content: 'main' }, { role: 'user', content: 'Kim smiled. Kimchi.' }];
  const out = applyPlayer(msgs, `${PLAYER_HEAD}\nX`, '', 'Kim', 'Jyaldi');
  assert.equal(out.length, 3);
  assert.equal(out[1].content, `${PLAYER_HEAD}\nX`);
  assert.equal(out[2].content, 'Jyaldi smiled. Kimchi.');
  assert.equal(applyPlayer(out, `${PLAYER_HEAD}\nX`, '', '', 'Jyaldi').length, 3, '이미 있으면 다시 넣지 않음');
});

test('캐릭터로 플레이: 고를 수 있는 요원, 주인공 글, 명단·로어북 고르기에서 빠짐', { skip: !books }, () => {
  const people = playableAgents(books, 'A00');
  assert.ok(people.length > 5);
  const a = people[0];
  const state = { $st_player: a.id };
  assert.equal(playerAgent(books, state)?.lore, a.lore);
  const block = playerBlock(books, a, { vars: {}, char: 'x', user: '주인공' });
  assert.ok(block.startsWith(PLAYER_HEAD) && block.includes(a.name) && block.includes('### Character') && !block.includes('@@dont_activate'));
  const c = parseCatalog(books);
  const w = emptyWorld();
  assert.ok(rosterFor(w, c, 'A00', 99).some((p) => p.id === a.id));
  w.player = a.id;
  assert.ok(!rosterFor(w, c, 'A00', 99).some((p) => p.id === a.id));
  const r = L.computeLore(books, { message: [{ role: 'char', data: `${a.name}가 말했다.` }], scriptstate: {} }, { mode: 'plugin', depth: 10, budget: 0, env: { vars: {} }, exclude: [a.lore] });
  assert.ok(!r || !r.picks.some((p) => p.entry.name === a.lore));
});

test('캐릭터로 플레이: 괴담톡 연락처에서 자기 빼기', { skip: !books }, async () => {
  const { phone } = await import('../dist-test/core.mjs');
  const a = playableAgents(books, 'A00')[0];
  const base = { $st_faction: 'A00', $lb_cfg_ph_all_contacts: '1' };
  const all = phone.directory(books, { message: [], scriptstate: base });
  const mine = phone.directory(books, { message: [], scriptstate: { ...base, $st_player: a.id } });
  assert.ok(![...mine.contacts].some((c) => c.agentId === a.id));
  assert.ok(mine.contacts.length <= all.contacts.length);
});
