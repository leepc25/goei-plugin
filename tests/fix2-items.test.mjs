// 전수검사 11-13: 소지품 — 다시 켬 오판(setwire#2·items#3), 이어 받은 응답의 이중 사용(items#5), 한도 정리(items#7),
// 다 쓴·판 같은 이름 직접 넣기(items#8), 남겨 두기의 다 씀(items#11), Recently 줄(items#12)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix2/items';
await mkdir(dir, { recursive: true });
await build({
  entryPoints: ['src/core/items.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, loader: { '.txt': 'text' }, logLevel: 'silent',
});
const I = await import(pathToFileURL(join(dir, 'core/items.mjs')));
const empty = { list: [], log: [] };
const msg = (role, chatId) => ({ role, data: chatId, chatId });

test('다시 켬: 변수가 없거나 빈 칸이면 새 채팅 첫 턴에 「꺼졌다 켜짐」을 붙이지 않는다', () => {
  const first = { message: [msg('user', 'u1')], scriptstate: {} };
  assert.equal(I.invJustResumed(first), false);
  assert.equal(I.invJustResumed({ ...first, scriptstate: { [I.ITEM_RESUMED_VAR]: '' } }), false);
  assert.doesNotMatch(I.inventoryText(first), /switched off/);
  // 진짜로 다시 켠 때(메시지 수가 적힘)는 그대로
  const chat = { message: [msg('user', 'u1'), msg('char', 'b1'), msg('user', 'u2')], scriptstate: { [I.ITEM_RESUMED_VAR]: '3' } };
  assert.equal(I.invJustResumed(chat), true);
});

test('사용: 유저 메시지 없이 이어 받은 응답은 같은 사용을 또 빼지 않고, 진짜 리롤은 새 응답에 다시 묶는다', () => {
  const it = I.addItem(empty, new Set(['b1']), { name: '진통제', uses: 3, from: 'story', anchor: 'b1' });
  const id = it.list[0].id;
  const chat = { message: [msg('user', 'u1'), msg('char', 'b1'), msg('user', 'u2'), msg('char', 'b2')], scriptstate: { ...I.itemsVars(it), ...I.itemUseVars([{ id, n: 1 }]) } };
  Object.assign(chat.scriptstate, I.settleItemUse(chat, 3));
  chat.message.push(msg('char', 'b3'));
  const v = I.settleItemUse(chat, 4);
  const after = v ? I.readItems({ ...chat.scriptstate, ...v }) : I.readItems(chat.scriptstate);
  assert.deepEqual(after.log.filter((l) => l.what === 'use').map((l) => l.anchor), ['b2']);
  assert.equal(I.itemLeft(after, after.list[0], new Set(['u1', 'b1', 'u2', 'b2', 'b3'])), 2);
  // 진짜 리롤: 옛 응답이 사라지고 새 응답이 그 자리에
  chat.message.pop();
  chat.message[3] = msg('char', 'b4');
  const again = I.readItems(I.settleItemUse(chat, 3));
  assert.deepEqual(again.log.filter((l) => l.what === 'use').map((l) => l.anchor), ['b2', 'b4']);
});

test('한도 정리: 시작 장비는 남고, 다 쓴 소모품은 기록이 넘쳐도 되살지 않는다', () => {
  let it = I.startItemsState([{ name: '제식 권총', equip: 'weapon' }, { name: '방검복', equip: 'gear' }]);
  const alive = new Set(['a0', 'a1']);
  for (let i = 0; i < 205; i++) it = I.addItem(it, alive, { name: `물건${i}`, from: 'story', anchor: i < 150 ? `dead${i}` : 'a1' });
  assert.ok(it.list.length <= 200);
  assert.deepEqual(I.liveItems(it, alive).filter((e) => e.anchor === '').map((e) => e.name), ['제식 권총', '방검복']);
  // 다 쓴 진통제 + 죽은 기록 400줄
  let u = I.addItem(empty, alive, { name: '진통제', uses: 3, from: 'manual', anchor: '' });
  const pid = u.list[0].id;
  u = I.addItemLog(u, { name: '진통제', item: pid, what: 'use', by: 'use', anchor: 'a0', n: 3 }, alive);
  for (let i = 0; i < 420; i++) u = I.addItemLog(u, { name: `x${i}`, what: 'get', by: 'story', anchor: `dead${i}` }, alive);
  assert.ok(u.log.length <= 400);
  assert.equal(I.liveItems(u, alive).length, 0, '다 쓴 진통제가 되살지 않는다');
  // 살아 있는 사용 기록만 넘쳐도 남은 횟수는 그대로 (처음 횟수에서 먼저 뺀다)
  let w = I.addItem(empty, alive, { name: '붕대', uses: 999, from: 'manual', anchor: '' });
  const bid = w.list[0].id;
  for (let i = 0; i < 450; i++) w = I.addItemLog(w, { name: '붕대', item: bid, what: 'use', by: 'use', anchor: 'a1' }, alive);
  assert.ok(w.log.length <= 400);
  assert.equal(I.itemLeft(w, w.list[0], alive), 999 - 450);
  // 읽을 때 자르지 않는다
  assert.equal(I.readItems(I.itemsVars(w)).log.length, w.log.length);
});

test('직접 넣기: 다 쓴·판 같은 이름이 남아 있어도 새로 들어간다. 본문은 같은 응답을 다시 읽어도 되살지 않는다', () => {
  const alive = new Set(['c1', 'c2']);
  let it = I.addItem(empty, alive, { name: '붕대', uses: 1, from: 'manual', anchor: '' });
  it = I.addItemLog(it, { name: '붕대', item: it.list[0].id, what: 'use', by: 'use', anchor: 'c1', n: 1 });
  assert.equal(I.liveItems(it, alive).length, 0);
  it = I.addItem(it, alive, { name: '붕대', uses: 3, from: 'manual', anchor: '' });
  assert.deepEqual(I.liveItems(it, alive).map((e) => [e.name, I.itemLeft(it, e, alive)]), [['붕대', 3]]);
  let g = I.addItem(empty, alive, { name: '권총', from: 'manual', anchor: '' });
  g = I.sellItem(g, g.list[0].id, 'c2', '철물점에 팖');
  g = I.addItem(g, alive, { name: '권총', from: 'manual', anchor: '' });
  assert.deepEqual(I.liveItems(g, alive).map((e) => e.name), ['권총']);
  let s = I.addItem(empty, alive, { name: '생수', uses: 1, from: 'story', anchor: 'c1' });
  s = I.addItemLog(s, { name: '생수', item: s.list[0].id, what: 'use', by: 'use', anchor: 'c2', n: 1 });
  assert.equal(I.addItem(s, alive, { name: '생수', uses: 1, from: 'story', anchor: 'c1' }), s);
});

test('남겨 두기: 본문이 다 썼다고 하면 「다 씀」(남은 0)으로 남고, 그 응답을 다시 굴리면 돌아온다', () => {
  const alive = new Set(['c1', 'c2']);
  let it = { ...I.addItem(empty, alive, { name: '생수', uses: 3, from: 'story', anchor: 'c1' }), keep: true };
  it = I.applyItemChanges(it, alive, [{ action: 'update', name: '생수', uses: 0, anchor: 'c2' }]);
  const row = it.list.find((e) => e.name === '생수');
  assert.equal(I.itemLeft(it, row, alive), 0);
  assert.equal(I.liveItems(it, alive).length, 1);
  assert.equal(I.itemLeft(it, row, new Set(['c1'])), 3);
  // 같은 응답을 다시 읽어도 또 빼지 않는다
  assert.equal(I.applyItemChanges(it, alive, [{ action: 'update', name: '생수', uses: 0, anchor: 'c2' }]).log.length, it.log.length);
});

test('Recently: 다 쓴 것은 used up, 상점 「메인 요청에 붙이는 것」을 끈 판 것은 넘기지 않는다', () => {
  const chat = { message: [msg('user', 'u1'), msg('char', 'c1'), msg('user', 'u2'), msg('char', 'c2')] };
  const alive = new Set(['u1', 'c1', 'u2', 'c2']);
  let it = I.addItem(empty, alive, { name: '붕대', uses: 1, from: 'manual', anchor: '' });
  it = I.applyItemChanges(it, alive, [{ action: 'update', name: '붕대', uses: 0, anchor: 'c1' }]);
  it = I.addItem(it, alive, { name: '코트', from: 'manual', anchor: '' });
  it = I.sellItem(it, it.list.find((e) => e.name === '코트').id, 'c2', '철물점에 팖');
  assert.deepEqual(I.recentItemLog(chat, it, 3, {}), ['used up 붕대', 'sold 코트']);
  assert.deepEqual(I.recentItemLog(chat, it, 3, { $sh_main_sell: '0' }), ['used up 붕대']);
});
