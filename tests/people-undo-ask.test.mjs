// 재검토 11-14 ①-2 (peopleui#12): 되돌리기 확인 줄은 물었던 그 채팅의 그 갱신에서만 보이고, 그 갱신만 되돌린다.
// ui/people.ts 를 묶어 돌린다 (Risu 는 흉내).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/goei-people-undo-ask';
await mkdir(dir, { recursive: true });
await build({ entryPoints: ['src/ui/people.ts'], outfile: join(dir, 'people.mjs'), bundle: true, platform: 'node', format: 'esm', loader: { '.txt': 'text' }, logLevel: 'silent' });
const { peopleUi, peopleListView, handlePeople, resetPeopleUi } = await import(pathToFileURL(join(dir, 'people.mjs')));

const KEY = 'goeiPeopleV1';
const person = (name) => ({ name, slots: {} });
const storeWith = (at, name) => ({ schema: 1, people: { [name]: person(name) }, lastRun: { at, entries: [], docs: [], changes: [], observations: [], newPeople: [name] } });
const mkChat = (first, at, name) => ({ message: [{ role: 'char', data: first, chatId: first }], scriptstate: {}, [KEY]: storeWith(at, name) });
const chats = [mkChat('첫 채팅', '2026-11-14T00:00:00.000Z', '갑'), mkChat('둘째 채팅', '2026-11-14T00:05:00.000Z', '을')];
globalThis.risuai = {
  getChatFromIndex: async (_c, i) => structuredClone(chats[i]),
  setChatToIndex: async (_c, i, chat) => { chats[i] = structuredClone(chat); },
};
const ctxOf = (i) => ({ charIndex: 0, chatIndex: i, char: { chaId: 'c', globalLore: [] }, chat: structuredClone(chats[i]) });
const env = { render() {}, refresh: async () => {} };
const asking = (ctx) => peopleListView(ctx).includes('data-action="pp-undo-run-yes"');

test('↶ 를 누르면 그 채팅에서 확인 줄이 뜬다', async () => {
  resetPeopleUi();
  const ctx = ctxOf(0);
  assert.equal(asking(ctx), false);
  await handlePeople('pp-undo-run', '', ctx, env);
  assert.equal(asking(ctx), true);
});

test('답하지 않고 다른 채팅으로 가면 거기서는 뜨지 않는다', () => {
  assert.equal(asking(ctxOf(1)), false);
  assert.equal(asking(ctxOf(0)), true, '원래 채팅에서는 그대로');
});

test('답하지 않은 사이 새 갱신이 오면 뜨지 않고, 「취소하기」가 와도 새 갱신을 지우지 않는다', async () => {
  chats[0][KEY] = { ...storeWith('2026-11-14T00:10:00.000Z', '병'), people: { 갑: person('갑'), 병: person('병') } };
  const ctx = ctxOf(0);
  assert.equal(asking(ctx), false);
  await handlePeople('pp-undo-run-yes', '', ctx, env);
  assert.ok(chats[0][KEY].people['병'], '새 갱신이 만든 인물이 남는다');
  assert.equal(chats[0][KEY].lastRun?.at, '2026-11-14T00:10:00.000Z');
  peopleUi.info = '';
});

test('화면을 옮기면(resetPeopleUi) 확인이 꺼진다', async () => {
  const ctx = ctxOf(1);
  await handlePeople('pp-undo-run', '', ctx, env);
  assert.equal(asking(ctx), true);
  resetPeopleUi();
  assert.equal(asking(ctx), false);
});

test('물은 그 갱신에 「취소하기」: 되돌린다', async () => {
  const ctx = ctxOf(1);
  await handlePeople('pp-undo-run', '', ctx, env);
  await handlePeople('pp-undo-run-yes', '', ctx, env);
  assert.equal(chats[1][KEY].people['을'], undefined);
  assert.equal(chats[1][KEY].lastRun, undefined);
  peopleUi.info = ''; // 알림(toast)은 화면(document)이 있어야 하니 그리기 전에 비운다
  assert.equal(asking(ctxOf(1)), false);
});

test('「그만」: 확인이 꺼진다', async () => {
  const ctx = ctxOf(0);
  await handlePeople('pp-undo-run', '', ctx, env);
  assert.equal(asking(ctx), true);
  await handlePeople('pp-undo-run-no', '', ctx, env);
  assert.equal(asking(ctx), false);
});
