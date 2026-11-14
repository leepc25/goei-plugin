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
      export { useBoxCss, markUseSent, sentUseIds, dropUseUnlessSent } from './src/host/usebox';
      export { setWaiting } from './src/host/waiting';
      export { readItemUse, ITEM_USE_VAR, ITEM_USE_AT_VAR, addItem, itemsVars, readItems, liveItems } from './src/core/items';
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
  const chat = chatWith([{ id: 'a', n: 1 }]);
  U.setWaiting(true);
  await U.markUseSent(0, 0, chat);
  assert.deepEqual([...U.sentUseIds(chat, 0, 0)], ['a']);
  assert.equal(U.dropUseUnlessSent(chat, 0, 0, 'a'), null);
  // 보낸 뒤 새로 놓은 것(b)은 아직 안 나갔으니 뺄 수 있다
  const more = chatWith([{ id: 'a', n: 1 }, { id: 'b', n: 1 }]);
  assert.equal(U.dropUseUnlessSent(more, 0, 0, 'a'), null);
  assert.deepEqual(U.readItemUse(U.dropUseUnlessSent(more, 0, 0, 'b').scriptstate).map((u) => u.id), ['a']);
  // 다른 채팅은 막지 않는다
  assert.ok(U.dropUseUnlessSent(chat, 0, 1, 'a'));
  // 응답 알림 없이 기다림이 끝났다(요청 실패) → 다시 뺄 수 있다
  U.setWaiting(false, true);
  assert.equal(U.sentUseIds(chat, 0, 0), null);
  assert.deepEqual(U.readItemUse(U.dropUseUnlessSent(chat, 0, 0, 'a').scriptstate), []);
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
  assert.equal(U.itemsUi.info, '', '취소했다는 말을 띄우지 않는다');
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
  assert.match(html, /data-action="items-use"[^>]*disabled/);
  await U.itemsAction('items-use', t.id, t.ctx(), t.env);
  assert.equal(nOf(t), 1, '보낸 횟수 그대로');
  U.itemsUi.info = '';
  // 끌어 놓기로도 늘지 않는다
  await U.itemsAction('items-dnd', `${t.id}|use`, t.ctx(), t.env);
  assert.equal(nOf(t), 1);
  U.setWaiting(false, true);
  await U.itemsAction('items-use', t.id, t.ctx(), t.env);
  assert.equal(nOf(t), 2);
});
