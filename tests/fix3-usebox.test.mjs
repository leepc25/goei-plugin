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
      export { readItemUse, ITEM_USE_VAR, ITEM_USE_AT_VAR } from './src/core/items';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  outfile: join(dir, 'usebox.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
  loader: { '.css': 'text', '.txt': 'text', '.svg': 'text', '.html': 'text', '.png': 'dataurl', '.webp': 'dataurl' },
});
// 본 화면이 없는 것으로 둔다 (칩 그리기는 건너뛰고 상태만 본다)
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
