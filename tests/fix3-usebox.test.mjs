// 재검토 11-14 B-9 (사용자 결정 (가)): 「보내는 중」인 칩은 ×를 숨기고 눌러도 빠지지 않는다. 요청이 실패(기다림이 늦게 끝남)하면 다시 뺄 수 있다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1114/fix3/usebox';
mkdirSync(dir, { recursive: true });
await build({
  stdin: {
    contents: `
      export { useBoxCss, markUseSent, sentUseIds, sentOut, sentReroll, dropUseUnlessSent, useLocked, holdUseSettle, setUseLockAt, setUseBlind, useBlind, freeUseLock } from './src/host/usebox';
      export { setWaiting, isWaiting, setWaitingProbe, WAIT_MS, WAIT_AGAIN_MS } from './src/host/waiting';
      export { readItemUse, ITEM_USE_VAR, ITEM_USE_AT_VAR, ITEM_USE_PREV_VAR, readUsePrev, mergeUse, addItem, itemsVars, readItems, liveItems, lastUserKey, settleItemUse, itemLeft, usesToSend, inventoryText } from './src/core/items';
      export { dropFromUse, itemsAction, itemsTab, itemsUi } from './src/ui/items';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  outfile: join(dir, 'usebox.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
  loader: { '.css': 'text', '.txt': 'text', '.svg': 'text', '.html': 'text', '.png': 'dataurl', '.webp': 'dataurl' },
});
// 본 화면이 없는 것으로 둔다 (칩 그리기는 건너뛰고 상태만 본다)
globalThis.matchMedia ??= () => ({ matches: false }); // PC 크기로 본다 (ui/media.ts)
globalThis.risuai = { getRootDocument: async () => null, getChatFromIndex: async () => null };
const U = await import(pathToFileURL(join(dir, 'usebox.mjs')));

const chatWith = (use, extra = {}) => ({
  message: [{ role: 'char', data: '안녕' }, { role: 'user', data: '붕대를 감는다' }],
  scriptstate: { [U.ITEM_USE_VAR]: JSON.stringify(use), ...extra },
});

test('칩 CSS: 보내는 중에는 ×를 숨기고, 아닐 때는 그대로 보인다 (이름표 글은 그대로)', () => {
  const idle = U.useBoxCss([{ label: '붕대' }], false);
  const sending = U.useBoxCss([{ label: '붕대' }], true);
  assert.match(idle, /content: "다음 메시지에 사용"/);
  assert.match(sending, /content: "보내는 중"/);
  assert.doesNotMatch(idle, /\[data-gu-x\] \{ display: none; \}/);
  assert.match(sending, /\[data-gu-x\] \{ display: none; \}/);
  // 숨김 줄이 × 를 그리는 줄보다 뒤에 온다 (같은 세기라 뒤가 이긴다)
  assert.ok(sending.lastIndexOf('[data-gu-x] { display: none; }') > sending.indexOf('[data-gu-x]::before'));
});

test('보내기 전: ×를 누르면 빠진다', () => {
  const chat = chatWith([{ id: 'a', n: 1 }, { id: 'b', n: 2 }]);
  const next = U.dropUseUnlessSent(chat, 0, 0, 'a');
  assert.deepEqual(U.readItemUse(next.scriptstate).map((u) => u.id), ['b']);
});

test('보내는 중: 실려 나간 것은 눌러도 그대로, 그 뒤 새로 놓은 것은 빠진다. 실패하면 다시 빠진다', async () => {
  // 보낸 표시는 요청에 실제로 실린 것(살아 있고 쓸 수 있는 물건)에만 붙는다 → 진짜 물건 둘을 둔다
  let items = { list: [], log: [] };
  for (const name of ['붕대', '진통제']) items = U.addItem(items, new Set(), { name, desc: '', effect: '', use: true, uses: 3, from: 'manual', anchor: '' });
  const [a, b] = items.list.map((x) => x.id);
  const chat = chatWith([{ id: a, n: 1 }], U.itemsVars(items));
  U.setWaiting(true);
  U.setUseLockAt({ charIndex: 0, chatIndex: 0 });
  // 보낸 표시가 붙기 전(요청 조립 중)에도 빠지지 않는다 (11-14 재검토: 그 틈에 빼면 요청엔 실리고 기록은 안 남았다)
  assert.equal(U.sentUseIds(chat, 0, 0), null);
  assert.equal(U.dropUseUnlessSent(chat, 0, 0, a), null);
  await U.markUseSent(0, 0, chat);
  assert.deepEqual([...U.sentUseIds(chat, 0, 0)], [a]);
  assert.equal(U.dropUseUnlessSent(chat, 0, 0, a), null);
  // 기다리는 중에는 이 채팅의 어떤 칩도 빠지지 않는다
  const more = chatWith([{ id: a, n: 1 }, { id: b, n: 1 }], U.itemsVars(items));
  assert.equal(U.dropUseUnlessSent(more, 0, 0, a), null);
  assert.equal(U.dropUseUnlessSent(more, 0, 0, b), null);
  // 다른 채팅은 막지 않는다
  assert.ok(U.dropUseUnlessSent(chat, 0, 1, a));
  // 응답 알림 없이 기다림이 끝났다(요청 실패) → 다시 뺄 수 있다
  U.setWaiting(false, true);
  assert.equal(U.sentUseIds(chat, 0, 0), null);
  assert.deepEqual(U.readItemUse(U.dropUseUnlessSent(chat, 0, 0, a).scriptstate), []);
});

// ── 소지품 창 (물음 3 사용자 답): 보내는 중에는 「사용 취소」를 숨기고 눌러도 무시, 버리기·삭제·해제(넣기)에도 보낸 사용은 사용 목록에 남긴다 ──
const alive = new Set();
/** 붕대(쓰는 물건) 하나를 가진 채팅을 가짜 Risu 저장소에 넣는다. 마지막이 유저 메시지 (요청이 나간 뒤, 답이 오기 전) */
function seed(chatIndex) {
  const items = U.addItem({ list: [], log: [] }, alive, { name: '붕대', desc: '', effect: '', use: true, uses: 3, from: 'manual', anchor: '' });
  const id = items.list[0].id;
  const chat = {
    message: [{ role: 'char', data: '안녕' }, { role: 'user', data: '붕대를 감는다' }],
    scriptstate: { ...U.itemsVars(items), [U.ITEM_USE_VAR]: JSON.stringify([{ id, n: 1 }]) },
  };
  const store = { chat };
  globalThis.risuai.getChatFromIndex = async (c, i) => (i === chatIndex ? structuredClone(store.chat) : null);
  globalThis.risuai.setChatToIndex = async (c, i, next) => { store.chat = structuredClone(next); };
  const ctx = () => ({ charIndex: 0, chatIndex, chat: structuredClone(store.chat), character: {} });
  const env = { render() {}, refresh: async () => {} };
  const queue = () => U.readItemUse(store.chat.scriptstate).map((u) => u.id);
  const has = () => U.liveItems(U.readItems(store.chat.scriptstate), alive).some((x) => x.id === id);
  return { id, store, ctx, env, queue, has };
}
const popupHtml = (t) => {
  U.itemsUi.sub = 'items';
  U.itemsUi.view = 'grid';
  U.itemsUi.mode = 'view';
  U.itemsUi.open = t.id;
  U.itemsUi.info = ''; // 잠깐 뜨는 안내(시계)를 띄우지 않는다
  return U.itemsTab(t.ctx());
};

test('소지품 창, 보내기 전: 「사용 취소」가 보이고 누르면 빠진다', async () => {
  const t = seed(5);
  assert.match(popupHtml(t), /data-action="items-unuse"/);
  U.itemsUi.info = '';
  await U.itemsAction('items-unuse', t.id, t.ctx(), t.env);
  assert.deepEqual(t.queue(), []);
  assert.equal(U.itemsUi.info, '사용을 취소했어요.');
});

test('소지품 창, 보내는 중: 「사용 취소」를 숨기고 눌러도 무시한다. 실패해 풀리면 전과 같다', async () => {
  const t = seed(6);
  U.setWaiting(true);
  await U.markUseSent(0, 6, t.store.chat);
  assert.doesNotMatch(popupHtml(t), /data-action="items-unuse"/);
  U.itemsUi.info = '';
  await U.itemsAction('items-unuse', t.id, t.ctx(), t.env);
  assert.deepEqual(t.queue(), [t.id]);
  assert.equal(U.itemsUi.info, '답을 기다리는 중이라 지금은 사용을 취소할 수 없어요. 답이 온 뒤에 해 주세요.', '취소했다는 말 대신 까닭을 알린다');
  assert.equal(await U.dropFromUse({ charIndex: 0, chatIndex: 6 }, t.id), false);
  // 요청 실패 → 다시 보이고 빠진다
  U.setWaiting(false, true);
  assert.match(popupHtml(t), /data-action="items-unuse"/);
  await U.itemsAction('items-unuse', t.id, t.ctx(), t.env);
  assert.deepEqual(t.queue(), []);
});

for (const [action, label] of [['items-drop', '버리기'], ['items-purge', '삭제']]) {
  test(`소지품 창, 보내는 중 ${label}: 물건은 처리하고 보낸 사용은 사용 목록에 남긴다`, async () => {
    const t = seed(action === 'items-drop' ? 7 : 8);
    U.setWaiting(true);
    await U.markUseSent(0, action === 'items-drop' ? 7 : 8, t.store.chat);
    await U.itemsAction(action, t.id, t.ctx(), t.env);
    assert.equal(t.has(), false, '물건 처리는 그대로');
    assert.deepEqual(t.queue(), [t.id], '보낸 사용은 남는다');
    U.setWaiting(false, true);
  });
}

test('소지품 창, 보내기 전 버리기: 사용 목록에서도 빠진다 (전과 같다)', async () => {
  const t = seed(9);
  await U.itemsAction('items-drop', t.id, t.ctx(), t.env);
  assert.equal(t.has(), false);
  assert.deepEqual(t.queue(), []);
});

// ── 보내는 중 「한 번 더」(11-14 사용자): 보낸 사용 횟수를 못 늘린다. 실패해 풀리면 전과 같다 ──
const nOf = (t) => U.readItemUse(t.store.chat.scriptstate).find((u) => u.id === t.id)?.n ?? 0;
test('소지품 창, 보내기 전: 「한 번 더」를 누르면 ×2', async () => {
  const t = seed(10);
  assert.match(popupHtml(t), /한 번 더 \(×2\)/);
  await U.itemsAction('items-use', t.id, t.ctx(), t.env);
  assert.equal(nOf(t), 2);
});
test('소지품 창, 보내는 중: 「한 번 더」가 없고 눌러도 횟수는 그대로. 실패해 풀리면 다시 늘릴 수 있다', async () => {
  const t = seed(11);
  U.setWaiting(true);
  await U.markUseSent(0, 11, t.store.chat);
  const html = popupHtml(t);
  assert.doesNotMatch(html, /한 번 더/);
  // 단추는 켜 둔다: 꺼 두면 답이 온 뒤에도 죽어 있다. 누르면 안내만 뜬다 (11-14 재검토)
  assert.doesNotMatch(html, /data-action="items-use"[^>]*disabled/);
  U.itemsUi.info = '';
  await U.itemsAction('items-use', t.id, t.ctx(), t.env);
  assert.equal(nOf(t), 1, '보낸 횟수 그대로');
  assert.equal(U.itemsUi.info, WAIT);
  U.itemsUi.info = '';
  // 끌어 놓기로도 늘지 않는다
  await U.itemsAction('items-dnd', `${t.id}|use`, t.ctx(), t.env);
  assert.equal(nOf(t), 1);
  U.setWaiting(false, true);
  await U.itemsAction('items-use', t.id, t.ctx(), t.env);
  assert.equal(nOf(t), 2);
});

// ── 답을 기다리는 중에는 「사용」에 아무것도 못 넣는다 (11-14 사용자): 요청에 없던 물건이 쓴 것으로 적히고 횟수가 깎이던 것 ──
const WAIT = '답을 기다리는 중이라 지금은 사용에 넣을 수 없어요. 답이 온 뒤에 넣어 주세요.';
/** 쓰는 물건 하나를 더 넣는다 (사용 자리에는 안 넣는다) → id */
function addOther(t, name = '진통제') {
  const items = U.addItem(U.readItems(t.store.chat.scriptstate), alive, { name, desc: '', effect: '', use: true, uses: 2, from: 'manual', anchor: '' });
  t.store.chat.scriptstate = { ...t.store.chat.scriptstate, ...U.itemsVars(items) };
  return items.list.find((x) => x.name === name).id;
}
/** 화면을 다시 그렸는지 센다 */
const spyEnv = () => { const e = { renders: 0, render() { e.renders++; }, refresh: async () => { e.renders++; } }; return e; };
const rawUse = (t) => t.store.chat.scriptstate[U.ITEM_USE_VAR];
/** 답이 붙었다: 응답 메시지를 붙이고 body.ts onOutput 처럼 기다림을 끄고 사용을 정리한다 */
function reply(t, chatId) {
  const done = U.holdUseSettle();
  U.setWaiting(false);
  t.store.chat.message.push({ role: 'char', data: '감았다', ...(chatId ? { chatId } : {}) });
  // body.ts 처럼 요청에 실려 나간 것(sentOut)을 같이 넘긴다
  // 손대지 못하고 보낸 요청의 답이면 정리를 건너뛴다 (useBlind)
  const vars = U.useBlind() ? null : U.settleItemUse(t.store.chat, t.store.chat.message.length - 1, U.sentOut(0, t.ctx().chatIndex, t.store.chat), U.sentReroll(0, t.ctx().chatIndex, t.store.chat));
  if (vars) t.store.chat.scriptstate = { ...t.store.chat.scriptstate, ...vars };
  done();
}
/** 이어 쓰기가 끝났다: 새 메시지 없이 마지막 응답에 덧붙고, 같은 자리로 정리가 온다 (body.ts onOutput 처럼 두 번 불러도 같아야 한다) */
function continued(t) {
  const done = U.holdUseSettle();
  U.setWaiting(false);
  const at = t.store.chat.message.length - 1;
  t.store.chat.message[at].data += ' 이어서';
  for (let k = 0; k < 2; k++) {
    const vars = U.settleItemUse(t.store.chat, at, U.sentOut(0, t.ctx().chatIndex, t.store.chat), U.sentReroll(0, t.ctx().chatIndex, t.store.chat));
    if (vars) t.store.chat.scriptstate = { ...t.store.chat.scriptstate, ...vars };
  }
  done();
}
/** 본편 요청이 나갔다 (body.ts onBeforeRequest 처럼): 기다림을 켜고 이 채팅을 잠그고 실린 사용을 적는다 */
async function send(t) {
  U.setWaiting(true);
  U.setUseLockAt(null);
  U.setUseLockAt({ charIndex: 0, chatIndex: t.ctx().chatIndex });
  await U.markUseSent(0, t.ctx().chatIndex, t.store.chat);
}
const leftOf = (t, id = t.id) => {
  const its = U.readItems(t.store.chat.scriptstate);
  return U.itemLeft(its, its.list.find((x) => x.id === id), new Set(its.log.map((l) => l.anchor)));
};
const usedLog = (t) => U.readItems(t.store.chat.scriptstate).log.filter((l) => l.what === 'use').map((l) => `${l.name}×${l.n ?? 1}`);

for (const [how, label] of [['button', '사용 단추'], ['use', '사용 상자에 끌어 놓기'], ['auto', '아바타 쪽에 끌어 놓기']]) {
  test(`기다리는 중, 다른 물건 ${label}: 사용 목록은 그대로이고 안내가 뜬다. 답이 오면 보낸 것만 적히고 다시 넣을 수 있다`, async () => {
    const t = seed(how === 'button' ? 20 : how === 'use' ? 21 : 22);
    const other = addOther(t);
    U.setWaiting(true);
    await U.markUseSent(0, t.ctx().chatIndex, t.store.chat);
    const before = rawUse(t);
    const env = spyEnv();
    U.itemsUi.info = '';
    if (how === 'button') await U.itemsAction('items-use', other, t.ctx(), env);
    else await U.itemsAction('items-dnd', `${other}|${how}`, t.ctx(), env);
    assert.equal(rawUse(t), before, '사용 목록 그대로');
    assert.equal(U.itemsUi.info, WAIT);
    assert.ok(env.renders > 0, '안내가 보이게 다시 그린다');
    // 답이 붙으면 보낸 붕대만 쓴 것으로 적힌다
    reply(t);
    assert.deepEqual(usedLog(t), ['붕대×1']);
    // 답이 온 뒤에는 넣을 수 있다 (지난 턴 자리는 비우고 새로)
    U.itemsUi.info = '';
    if (how === 'button') await U.itemsAction('items-use', other, t.ctx(), env);
    else await U.itemsAction('items-dnd', `${other}|${how}`, t.ctx(), env);
    assert.deepEqual(t.queue(), [other]);
    assert.notEqual(U.itemsUi.info, WAIT);
  });
}

test('기다리는 중, 사용 목록이 비어 있어도 넣을 수 없다 (단추는 켜 두고 누르면 안내). 답이 와도 아무것도 깎이지 않는다', async () => {
  const t = seed(23);
  t.store.chat.scriptstate[U.ITEM_USE_VAR] = '';
  U.setWaiting(true);
  await U.markUseSent(0, 23, t.store.chat);
  // 기다리는 중에 그린 창의 단추도 켜져 있다: 답이 온 뒤 다시 그리지 않아도 눌린다 (폰은 이 단추가 유일한 길)
  assert.doesNotMatch(popupHtml(t), /data-action="items-use"[^>]*disabled/);
  assert.doesNotMatch(popupHtml(t), /답이 온 뒤에 쓸 수 있어요/);
  for (const run of [() => U.itemsAction('items-use', t.id, t.ctx(), t.env), () => U.itemsAction('items-dnd', `${t.id}|use`, t.ctx(), t.env), () => U.itemsAction('items-dnd', `${t.id}|auto`, t.ctx(), t.env)]) {
    U.itemsUi.info = '';
    await run();
    assert.deepEqual(t.queue(), []);
    assert.equal(U.itemsUi.info, WAIT);
  }
  reply(t);
  assert.deepEqual(usedLog(t), []);
  assert.doesNotMatch(popupHtml(t), /data-action="items-use"[^>]*disabled/);
  await U.itemsAction('items-use', t.id, t.ctx(), t.env);
  assert.deepEqual(t.queue(), [t.id]);
});

test('다시 굴리는 중: 보낸 사용 목록이 지워지지 않고, 빼기도 안 된다. 답이 오면 보낸 것만 적힌다', async () => {
  const t = seed(24);
  const other = addOther(t);
  // 이 턴은 이미 한 번 보냈고(at = 유저 키), 옛 응답을 지우고 다시 굴리는 중
  const userKey = U.lastUserKey(t.store.chat);
  t.store.chat.scriptstate[U.ITEM_USE_AT_VAR] = userKey;
  U.setWaiting(true);
  await U.markUseSent(0, 24, t.store.chat);
  const before = rawUse(t);
  assert.doesNotMatch(popupHtml({ ...t, id: other }), /data-action="items-use"[^>]*disabled/);
  for (const run of [() => U.itemsAction('items-use', other, t.ctx(), t.env), () => U.itemsAction('items-use', t.id, t.ctx(), t.env), () => U.itemsAction('items-dnd', `${other}|use`, t.ctx(), t.env), () => U.itemsAction('items-dnd', `${other}|auto`, t.ctx(), t.env)]) {
    U.itemsUi.info = '';
    await run();
    assert.equal(rawUse(t), before, '보낸 목록 그대로');
    assert.equal(t.store.chat.scriptstate[U.ITEM_USE_AT_VAR], userKey, '보낸 턴 표시도 그대로');
    assert.equal(U.itemsUi.info, WAIT);
  }
  await U.itemsAction('items-unuse', t.id, t.ctx(), t.env);
  await U.dropFromUse({ charIndex: 0, chatIndex: 24 }, t.id);
  assert.equal(rawUse(t), before);
  reply(t);
  assert.deepEqual(usedLog(t), ['붕대×1']);
  // 붕대는 한 번만(3 → 2), 진통제는 그대로(2)
  const its = U.readItems(t.store.chat.scriptstate);
  const live = new Set(its.log.map((l) => l.anchor));
  assert.equal(U.itemLeft(its, its.list.find((x) => x.id === t.id), live), 2);
  assert.equal(U.itemLeft(its, its.list.find((x) => x.id === other), live), 2);
});

test('답이 붙고 사용 정리가 끝나기 전에도 못 넣는다 (정리 뒤에 풀린다)', async () => {
  const t = seed(25);
  const other = addOther(t);
  U.setWaiting(true);
  await U.markUseSent(0, 25, t.store.chat);
  const done = U.holdUseSettle();
  U.setWaiting(false);
  assert.equal(U.useLocked(), true);
  U.itemsUi.info = '';
  await U.itemsAction('items-use', other, t.ctx(), t.env);
  assert.deepEqual(t.queue(), [t.id]);
  assert.equal(U.itemsUi.info, WAIT);
  done();
  done(); // 두 번 불러도 한 번만 푼다
  assert.equal(U.useLocked(), false);
});

test('요청이 실패해 기다림이 늦게 끝나면 다시 넣을 수 있다 (안 보낸 것과 같이 다음 메시지에 나간다)', async () => {
  const t = seed(26);
  const other = addOther(t);
  U.setWaiting(true);
  await U.markUseSent(0, 26, t.store.chat);
  await U.itemsAction('items-use', other, t.ctx(), t.env);
  assert.deepEqual(t.queue(), [t.id]);
  U.setWaiting(false, true);
  U.itemsUi.info = '';
  await U.itemsAction('items-dnd', `${other}|use`, t.ctx(), t.env);
  assert.deepEqual(t.queue(), [t.id, other]);
  assert.notEqual(U.itemsUi.info, WAIT);
});

// ── 11-14 재검토: 빼기도 잠근다 · 잠금은 보낸 채팅에만 · 중지·실패 뒤 바로 풀린다 ──
test('요청 조립 중(보낸 표시 전): 사용 취소·버리기로 사용 목록에서 빠지지 않는다. 답이 오면 쓴 것으로 적힌다', async () => {
  const t = seed(30);
  U.setWaiting(true);
  U.setUseLockAt({ charIndex: 0, chatIndex: 30 });
  // markUseSent 전: 보낸 표시는 아직 없다
  U.itemsUi.info = '';
  await U.itemsAction('items-unuse', t.id, t.ctx(), t.env);
  assert.deepEqual(t.queue(), [t.id]);
  assert.match(U.itemsUi.info, /사용을 취소할 수 없어요/);
  assert.equal(await U.dropFromUse({ charIndex: 0, chatIndex: 30 }, t.id), false);
  assert.deepEqual(t.queue(), [t.id]);
  reply(t);
  assert.deepEqual(usedLog(t), ['붕대×1']);
});

test('잠금은 요청을 보낸 채팅에만: 다른 채팅에서는 넣고 뺄 수 있다', async () => {
  const t = seed(31);
  U.setWaiting(true);
  U.setUseLockAt({ charIndex: 0, chatIndex: 99 });
  assert.equal(U.useLocked(0, 99), true);
  assert.equal(U.useLocked(0, 31), false);
  assert.equal(U.useLocked(), true, '자리를 모르면 잠긴 것으로');
  U.itemsUi.info = '';
  await U.itemsAction('items-use', t.id, t.ctx(), t.env);
  assert.equal(nOf(t), 2);
  await U.itemsAction('items-unuse', t.id, t.ctx(), t.env);
  assert.deepEqual(t.queue(), []);
  // 어느 채팅인지 읽기 전(null)에는 전부 잠근다
  U.setUseLockAt(null);
  assert.equal(U.useLocked(0, 31), true);
  U.setWaiting(false);
  assert.equal(U.useLocked(0, 99), false);
});

/** 리수 본 화면 흉내: 입력창에 보내기 단추(idle) 또는 멈춤 단추(만드는 중) */
function fakeScreen(kind) {
  const el = (found) => (found ? { querySelector: async () => null } : null);
  const screen = { querySelector: async (q) => el(q === '.loadmove' ? kind === 'busy' : q === '.button-icon-send' ? kind === 'idle' : false) };
  globalThis.risuai.getRootDocument = async () => (kind === 'none' ? null : { querySelector: async (q) => (q === 'body' ? el(true) : q === '.default-chat-screen' ? screen : null) });
}
test('중지·실패 뒤: 리수에 보내기 단추가 돌아와 있으면 바로 풀려 사용에 넣을 수 있다. 만드는 중이거나 화면을 못 읽으면 그대로 잠근다', async () => {
  const t = seed(32);
  const other = addOther(t);
  try {
    for (const kind of ['busy', 'none']) {
      fakeScreen(kind);
      U.setWaiting(true);
      U.setUseLockAt({ charIndex: 0, chatIndex: 32 });
      U.itemsUi.info = '';
      await U.itemsAction('items-use', other, t.ctx(), t.env);
      assert.equal(U.itemsUi.info, WAIT, kind);
      assert.deepEqual(t.queue(), [t.id], kind);
      assert.equal(U.isWaiting(), true, kind);
    }
    // 멈춤을 눌러 보내기 단추가 돌아왔다 (응답 알림은 오지 않았다)
    fakeScreen('idle');
    await U.freeUseLock();
    assert.equal(U.isWaiting(), false);
    globalThis.risuai.getRootDocument = async () => null; // 칩 그리기는 건너뛴다
    U.itemsUi.info = '';
    await U.itemsAction('items-use', other, t.ctx(), t.env);
    assert.deepEqual(t.queue(), [t.id, other]);
    assert.notEqual(U.itemsUi.info, WAIT);
    // 답 정리 중인 잠금은 화면을 봐도 풀지 않는다
    const done = U.holdUseSettle();
    await U.freeUseLock();
    assert.equal(U.useLocked(0, 32), true);
    done();
  } finally {
    U.setWaiting(false);
    globalThis.risuai.getRootDocument = async () => null;
  }
});

// ── 11-14 재검토: 남은 틈 ──
test('답이 온 뒤 같은 물건을 다시 넣고 유저 메시지 없이 다음 답을 받는다: 요청에 실리고, 적히고, 횟수가 준다', async () => {
  const t = seed(30);
  await send(t);
  reply(t);
  assert.equal(leftOf(t), 2);
  // 같은 물건을 다시 「사용」에 (지난 자리는 비우고 새로)
  await U.itemsAction('items-use', t.id, t.ctx(), t.env);
  assert.deepEqual(t.queue(), [t.id]);
  assert.equal(t.store.chat.scriptstate[U.ITEM_USE_AT_VAR], '');
  // 빈 입력으로 보냄: 유저 메시지는 그대로, 옛 응답도 살아 있다
  assert.match(U.inventoryText(t.store.chat), /This turn: uses 붕대 \(1 left after this\)/);
  await send(t);
  assert.deepEqual([...U.sentUseIds(t.store.chat, 0, 30)], [t.id]);
  reply(t);
  assert.deepEqual(usedLog(t), ['붕대×1', '붕대×1']);
  assert.equal(leftOf(t), 1);
  // 넘어온 자리로 또 이어 받으면 다시 보내지도 적지도 않는다
  assert.doesNotMatch(U.inventoryText(t.store.chat), /uses 붕대/);
  await send(t);
  assert.equal(U.sentUseIds(t.store.chat, 0, 30), null, '실린 게 없으면 보내는 중 표시도 없다');
  reply(t);
  assert.equal(leftOf(t), 1);
});

test('보내는 중에 버린 물건: 답이 붙으면 쓴 것으로 적힌다 (다시 주우면 횟수가 맞다). 삭제한 물건은 건너뛴다', async () => {
  const t = seed(31);
  await send(t);
  await U.itemsAction('items-drop', t.id, t.ctx(), t.env);
  assert.equal(t.has(), false);
  reply(t);
  assert.deepEqual(usedLog(t), ['붕대×1']);
  assert.equal(leftOf(t), 2);
  const p = seed(32);
  await send(p);
  await U.itemsAction('items-purge', p.id, p.ctx(), p.env);
  reply(p);
  assert.deepEqual(usedLog(p), []);
});

test('기다림이 늦게 꺼진 틈에 넣은 물건: 요청에 없었으니 답이 붙어도 적히지 않는다', async () => {
  const t = seed(33);
  const other = addOther(t);
  await send(t);
  U.setWaiting(false, true);
  await U.itemsAction('items-use', other, t.ctx(), t.env);
  assert.deepEqual(t.queue(), [t.id, other]);
  reply(t);
  assert.deepEqual(usedLog(t), ['붕대×1']);
  assert.equal(leftOf(t, other), 2);
});

// ── 11-14 재검토: 합치기·다시 굴리기에서 사용이 사라지던 것 ──
const WAIT_MERGE = '사용에 넣은 물건은 답이 온 뒤에 합칠 수 있어요.';
/** 리수처럼 메시지마다 고유 id 를 준다 (다시 굴린 응답은 새 id) */
const withIds = (t) => { t.store.chat.message.forEach((m, i) => { m.chatId = `m${i}`; }); return t; };
/** 살아 있는 응답만으로 센 남은 횟수 (지워진 응답의 사용 기록은 뺀다) */
const leftNow = (t, id = t.id) => {
  const its = U.readItems(t.store.chat.scriptstate);
  return U.itemLeft(its, its.list.find((x) => x.id === id), new Set(t.store.chat.message.map((m) => m.chatId)));
};
const merge = async (t, keep, other, env = t.env) => {
  U.itemsUi.open = keep;
  U.itemsUi.info = '';
  await U.itemsAction('items-merge-to', other, t.ctx(), env);
};

test('기다리는 중 합치기: 사용에 넣은 줄은 합쳐지지 않고 안내가 뜬다. 답이 오면 쓴 것으로 적힌다', async () => {
  const t = seed(50);
  const other = addOther(t, '붕대 묶음');
  await send(t);
  const env = spyEnv();
  // 보낸 줄을 다른 줄에 합치기, 보낸 줄에 다른 줄을 합치기 모두 막는다
  for (const [keep, gone] of [[other, t.id], [t.id, other]]) {
    await merge(t, keep, gone, env);
    assert.equal(U.itemsUi.info, WAIT_MERGE);
    assert.equal(U.readItems(t.store.chat.scriptstate).list.length, 2, '두 줄 그대로');
  }
  assert.ok(env.renders > 0);
  reply(t);
  assert.deepEqual(usedLog(t), ['붕대×1']);
  assert.equal(leftOf(t), 2);
  // 답이 온 뒤에는 합칠 수 있다: 남은 2 + 2
  await merge(t, other, t.id);
  assert.equal(U.itemsUi.info, '합쳤어요.');
  assert.equal(leftOf(t, other), 4);
});

test('보내기 전 합치기: 빠지는 줄에 넣어 둔 사용은 남는 줄로 옮겨져 요청에 실린다', async () => {
  const t = seed(51);
  const other = addOther(t, '붕대 묶음');
  await merge(t, other, t.id);
  assert.deepEqual(U.readItemUse(t.store.chat.scriptstate), [{ id: other, n: 1 }]);
  assert.match(U.inventoryText(t.store.chat), /This turn: uses 붕대 묶음 \(4 left after this\)/);
  await send(t);
  reply(t);
  assert.deepEqual(usedLog(t), ['붕대 묶음×1']);
  assert.equal(leftOf(t, other), 4);
  // 둘 다 넣어 둔 것은 횟수를 더한다
  assert.deepEqual(U.mergeUse([{ id: 'a', n: 2 }, { id: 'x', n: 1 }, { id: 'b', n: 1 }], 'b', 'a'), [{ id: 'x', n: 1 }, { id: 'b', n: 3 }]);
  assert.deepEqual(U.mergeUse([{ id: 'x', n: 1 }], 'b', 'a'), [{ id: 'x', n: 1 }]);
});

test('같은 턴에 같은 물건을 한 번 더 쓴 응답을 다시 굴린다: 그 사용이 다시 실리고 적힌다', async () => {
  const t = withIds(seed(52));
  await send(t);
  reply(t, 'r1');
  await U.itemsAction('items-use', t.id, t.ctx(), t.env);
  await send(t);
  reply(t, 'r2');
  assert.equal(leftNow(t), 1);
  // 다시 굴리기: 리수가 마지막 응답만 지운다 (첫 응답의 기록은 살아 있다)
  t.store.chat.message.pop();
  assert.equal(leftNow(t), 2);
  assert.match(U.inventoryText(t.store.chat), /This turn: uses 붕대 \(1 left after this\)/);
  await send(t);
  reply(t, 'r2b');
  assert.equal(leftNow(t), 1);
  // 그 뒤 유저 메시지 없이 이어 받으면 또 보내지 않는다
  assert.doesNotMatch(U.inventoryText(t.store.chat), /uses 붕대/);
  await send(t);
  reply(t, 'r3');
  assert.equal(leftNow(t), 1);
});

test('답이 온 뒤 다른 물건을 넣고 그 답을 다시 굴린다: 지난 사용이 다시 나가고, 새 물건은 다음 메시지까지 남는다', async () => {
  const t = withIds(seed(53));
  const other = addOther(t);
  await send(t);
  reply(t, 'r1');
  await U.itemsAction('items-use', other, t.ctx(), t.env);
  assert.deepEqual(t.queue(), [other]);
  assert.deepEqual(U.readUsePrev(t.store.chat.scriptstate), { at: 'm1', from: 'r1', q: [{ id: t.id, n: 1 }] });
  // 다시 굴리기: 옛 응답이 지워져 붕대가 돌아온다
  t.store.chat.message.pop();
  assert.equal(leftNow(t), 3);
  const inv = U.inventoryText(t.store.chat);
  assert.match(inv, /This turn: uses 붕대 \(2 left after this\)/);
  assert.doesNotMatch(inv, /uses[^\n]*진통제/);
  await send(t);
  reply(t, 'r1b');
  assert.equal(leftNow(t), 2);
  assert.equal(leftNow(t, other), 2, '새 물건은 안 깎인다');
  assert.deepEqual(t.queue(), [other], '새 물건은 자리에 그대로');
  assert.equal(t.store.chat.scriptstate[U.ITEM_USE_AT_VAR] || '', '');
  // 또 굴려도 같다
  t.store.chat.message.pop();
  assert.match(U.inventoryText(t.store.chat), /This turn: uses 붕대 \(2 left after this\)/);
  await send(t);
  reply(t, 'r1c');
  assert.equal(leftNow(t), 2);
  // 답이 온 뒤에는 붕대를 다시 넣을 수 있다 (보내는 중 표시가 남지 않는다)
  await U.itemsAction('items-use', t.id, t.ctx(), t.env);
  assert.deepEqual(t.queue(), [other, t.id]);
  await U.itemsAction('items-unuse', t.id, t.ctx(), t.env);
  // 다음 유저 메시지에 새 물건이 나간다
  t.store.chat.message.push({ role: 'user', data: '약을 먹는다', chatId: 'u2' });
  assert.match(U.inventoryText(t.store.chat), /This turn: uses 진통제 \(1 left after this\)/);
  await send(t);
  reply(t, 'r2');
  assert.equal(leftNow(t, other), 1);
  assert.equal(leftNow(t), 2);
  assert.equal(U.readUsePrev(t.store.chat.scriptstate), null, '지난 턴 사본은 지운다');
});

test('답을 지운 뒤 다른 물건을 넣으면 자리를 비우지 않고 이어 넣는다 (둘 다 다시 나간다)', async () => {
  const t = withIds(seed(54));
  const other = addOther(t);
  await send(t);
  reply(t, 'r1');
  t.store.chat.message.pop();
  await U.itemsAction('items-use', other, t.ctx(), t.env);
  assert.deepEqual(t.queue(), [t.id, other]);
  const inv = U.inventoryText(t.store.chat);
  assert.match(inv, /uses 붕대/);
  assert.match(inv, /진통제/);
  await send(t);
  reply(t, 'r1b');
  assert.equal(leftNow(t), 2);
  assert.equal(leftNow(t, other), 1);
});

test('답이 3분보다 늦어도 리수가 아직 만드는 중이면 기다림(사용 잠금)이 꺼지지 않는다. 멈췄으면 꺼진다', async (tt) => {
  tt.mock.timers.enable({ apis: ['setTimeout'] });
  const flush = () => new Promise((r) => setImmediate(r));
  let busy = true;
  let asked = 0;
  U.setWaitingProbe(async () => { asked++; return busy; });
  try {
    U.setWaiting(true);
    U.setUseLockAt({ charIndex: 0, chatIndex: 40 });
    tt.mock.timers.tick(U.WAIT_MS);
    await flush();
    assert.equal(asked, 1);
    assert.equal(U.isWaiting(), true, '아직 만드는 중');
    assert.equal(U.useLocked(0, 40), true);
    tt.mock.timers.tick(U.WAIT_AGAIN_MS);
    await flush();
    assert.equal(U.isWaiting(), true);
    // 묻는 사이 답이 왔다가 새 요청이 나갔으면 그 요청의 기다림을 끄지 않는다
    busy = false;
    tt.mock.timers.tick(U.WAIT_AGAIN_MS - 1);
    U.setWaiting(false);
    U.setWaiting(true);
    tt.mock.timers.tick(1);
    await flush();
    assert.equal(U.isWaiting(), true);
    // 리수가 멈춰 있으면(실패·중지) 시간이 다 되면 꺼진다
    tt.mock.timers.tick(U.WAIT_MS);
    await flush();
    assert.equal(U.isWaiting(), false);
    // 물을 수 없으면(던짐) 전처럼 끈다
    U.setWaitingProbe(async () => { throw new Error('화면 없음'); });
    U.setWaiting(true);
    tt.mock.timers.tick(U.WAIT_MS);
    await flush();
    assert.equal(U.isWaiting(), false);
  } finally {
    U.setWaiting(false);
    U.setWaitingProbe(null);
  }
});

// ── 11-14 재검토 (v0.21.16 전): 이어 쓰기 · 다른 봇의 요청 ──
test('답이 온 뒤 다른 물건을 넣고 이어 쓰기: 새 물건이 그 응답에 적히고 깎인다. 다음 메시지에 또 나가지 않고, 다시 굴리면 둘 다 다시 나간다', async () => {
  const t = withIds(seed(60));
  const other = addOther(t);
  await send(t);
  reply(t, 'r1');
  await U.itemsAction('items-use', other, t.ctx(), t.env);
  // 이어 쓰기 요청: 새 물건만 나간다
  const inv = U.inventoryText(t.store.chat);
  assert.match(inv, /This turn: uses 진통제 \(1 left after this\)/);
  assert.doesNotMatch(inv, /uses[^\n]*붕대/);
  await send(t);
  assert.equal(U.sentReroll(0, 60, t.store.chat), false);
  continued(t);
  assert.deepEqual(usedLog(t), ['붕대×1', '진통제×1']);
  assert.equal(leftNow(t, other), 1);
  assert.equal(leftNow(t), 2);
  assert.equal(t.store.chat.scriptstate[U.ITEM_USE_AT_VAR], 'm1', '보낸 자리로 적힌다 (칩이 남지 않는다)');
  assert.equal(U.readUsePrev(t.store.chat.scriptstate), null);
  // 또 이어 쓰거나 유저 메시지 없이 다음 응답을 받아도 다시 안 나간다
  assert.doesNotMatch(U.inventoryText(t.store.chat), /This turn: uses/);
  await send(t);
  continued(t);
  assert.deepEqual(usedLog(t), ['붕대×1', '진통제×1']);
  // 다시 굴리기: 그 응답이 쓴 둘 다 다시 나가고 새 응답에 적힌다
  t.store.chat.message.pop();
  assert.match(U.inventoryText(t.store.chat), /This turn: uses 붕대[^\n]*진통제/);
  await send(t);
  reply(t, 'r1b');
  assert.equal(leftNow(t), 2);
  assert.equal(leftNow(t, other), 1);
  // 다음 유저 메시지에는 안 나가고 자리가 비워진다
  t.store.chat.message.push({ role: 'user', data: '다음', chatId: 'u2' });
  assert.doesNotMatch(U.inventoryText(t.store.chat), /This turn: uses/);
  await send(t);
  reply(t, 'r2');
  assert.deepEqual(t.queue(), []);
  assert.equal(leftNow(t, other), 1);
});

test('답이 온 뒤 같은 물건을 다시 넣고 이어 쓰기: 그 응답의 기록에 횟수가 더해진다 (보낸 만큼 깎인다)', async () => {
  const t = withIds(seed(61));
  await send(t);
  reply(t, 'r1');
  await U.itemsAction('items-use', t.id, t.ctx(), t.env);
  assert.match(U.inventoryText(t.store.chat), /This turn: uses 붕대 \(1 left after this\)/);
  await send(t);
  continued(t);
  assert.deepEqual(usedLog(t), ['붕대×2']);
  assert.equal(leftNow(t), 1);
  assert.doesNotMatch(U.inventoryText(t.store.chat), /This turn: uses/);
  // 다시 굴리면 두 번 쓴 것으로 다시 나간다
  t.store.chat.message.pop();
  assert.match(U.inventoryText(t.store.chat), /This turn: uses 붕대 ×2 \(1 left after this\)/);
  await send(t);
  reply(t, 'r1b');
  assert.equal(leftNow(t), 1);
});

test('다른 봇의 요청을 기다리는 동안: 이 봇 채팅의 「사용」은 잠기지 않는다', async () => {
  const t = seed(62);
  // body.ts onBeforeRequest: 이 봇이 아니면(liteNow 꺼짐) 없는 자리를 적는다
  const src = (await import('node:fs')).readFileSync('src/body.ts', 'utf8');
  assert.match(src, /setUseLockAt\(null\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*if \(!liteNow\) setUseLockAt\(\{ charIndex: -1, chatIndex: -1 \}\);/);
  U.setWaiting(true);
  U.setUseLockAt(null);
  assert.equal(U.useLocked(0, 62), true, '어느 채팅인지 모르면 전부');
  U.setUseLockAt({ charIndex: -1, chatIndex: -1 });
  try {
    assert.equal(U.useLocked(0, 62), false);
    assert.equal(U.sentOut(0, 62, t.store.chat), null, '지난 요청에 실린 것은 잊은 채다');
    U.itemsUi.info = '';
    await U.itemsAction('items-use', t.id, t.ctx(), t.env);
    assert.equal(nOf(t), 2);
    assert.notEqual(U.itemsUi.info, WAIT);
    assert.equal(await U.dropFromUse({ charIndex: 0, chatIndex: 62 }, t.id), true);
    assert.deepEqual(t.queue(), []);
  } finally {
    U.setWaiting(false);
  }
});

test('이 봇 판정이 늦어 손대지 못하고 보낸 요청: 기다리는 동안 넣은 것은 그 답에 적히지 않고 다음 메시지에 나간다', async () => {
  const t = seed(63);
  // body.ts: 손대지 못한 요청이면 적어 두고(onBeforeRequest), 그 답에서는 사용 정리를 건너뛴다(onOutput)
  const src = (await import('node:fs')).readFileSync('src/body.ts', 'utf8');
  assert.match(src, /if \(!liteNow\) setUseBlind\(\);/);
  assert.match(src, /if \(ctx\) setUseLockAt\(ctx\);[^\n]*\n\s*else setUseBlind\(\);/);
  assert.match(src, /if \(!useBlind\(\) && settleItemUse\(/);
  // 요청: liteNow 가 꺼져 있어 [Inventory] 도 보낸 표시도 없다
  U.setWaiting(true);
  U.setUseLockAt(null);
  U.setUseLockAt({ charIndex: -1, chatIndex: -1 });
  U.setUseBlind();
  assert.equal(U.useBlind(), true);
  // 답을 기다리는 동안 넣는다 (잠기지 않는다)
  await U.itemsAction('items-use', t.id, t.ctx(), t.env);
  const n = nOf(t);
  assert.equal(n, 2, '넣어 둔 하나에 하나 더');
  const left = leftOf(t);
  reply(t, 'r1');
  assert.deepEqual(usedLog(t), [], '모델이 못 받은 사용은 적지 않는다');
  assert.equal(leftOf(t), left);
  assert.equal(nOf(t), n);
  assert.ok(!t.store.chat.scriptstate[U.ITEM_USE_AT_VAR], '자리는 아직 안 보낸 채');
  // 다음 요청은 제대로 나간다: 실리고, 그 답에 적힌다
  t.store.chat.message.push({ role: 'user', data: '다음', chatId: 'u2' });
  await send(t);
  assert.equal(U.useBlind(), false, '새 요청에서 꺼진다');
  assert.ok(U.sentOut(0, 63, t.store.chat)?.has(t.id));
  reply(t, 'r2');
  assert.deepEqual(usedLog(t), ['붕대×2']);
  assert.equal(leftOf(t), left - n);
});
