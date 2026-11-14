// 11-14 재검토 loader#3: 카드 업데이트 「카드에 적용」은 사진을 받는 동안 생긴 채팅 변화를 옛 내용으로 덮지 않는다
// (사진을 다 받은 뒤 캐릭터를 다시 읽어 합친다). 화면 코드(src/ui/update.ts)를 그대로 묶어 가짜 risuai 로 돌린다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = join(tmpdir(), 'goei-update-apply-fresh');
await mkdir(dir, { recursive: true });
const outfile = join(dir, `bundle-${process.pid}.mjs`);
await build({
  stdin: { contents: "export * from './src/ui/update';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', target: 'es2022', charset: 'utf8',
  loader: { '.txt': 'text', '.css': 'text' }, outfile, logLevel: 'silent',
});
const { handleUpdate, updateUi } = await import(pathToFileURL(outfile));

const bytes = new Uint8Array([1, 2, 3, 4, 5]);
const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 12);
const manifest = (version, pictures) => ({ comment: 'Plugin manifest', content: JSON.stringify({ schema: 1, plugin: 'goei-plugin', version, greetings: {}, pictures }), key: '', mode: 'normal' });
const clone = (x) => JSON.parse(JSON.stringify(x));

function setup() {
  const stored = {
    name: '봇',
    characterVersion: '0.1.0',
    chats: [{ message: [{ role: 'user', data: '안녕' }] }],
    additionalAssets: [['Old_pic', 'assets/old.png', 'png'], ['MyOwn', 'assets/mine.png', 'png']],
    globalLore: [manifest('0.1.0', [['Old_pic', 'aaaaaaaaaaaa', 'png', 3]])],
    customscript: [],
  };
  const payload = {
    schema: 1, version: '0.2.0', minPlugin: '0',
    data: { characterVersion: '0.2.0', globalLore: [manifest('0.2.0', [['New_pic', hash, 'png', bytes.length]])], customscript: [] },
  };
  const state = { stored, writes: 0, during: () => {} };
  globalThis.risuai = {
    getCharacterFromIndex: async () => clone(state.stored),
    setCharacterToIndex: async (_i, c) => { state.writes++; state.stored = clone(c); },
    nativeFetch: async () => ({ ok: true, arrayBuffer: async () => bytes.buffer.slice(0) }),
    saveAsset: async () => { state.during(); return 'assets/new.png'; },
    pluginStorage: { getItem: async () => '', setItem: async () => {} },
  };
  Object.assign(updateUi, { busy: false, notice: '', payload, plan: null, pics: null, progress: '', done: '' });
  return state;
}
const env = { render() {}, refresh: async () => {} };

test('카드에 적용: 사진 받는 동안 온 응답·직접 넣은 사진이 남고, 카드 내용·사진은 새 판이 된다', async () => {
  const state = setup();
  // 사진을 저장하는 동안 응답이 도착하고(채팅에 한 줄), 사용자가 사진을 한 장 넣었다
  state.during = () => {
    state.stored.chats[0].message.push({ role: 'char', data: '받는 동안 온 응답' });
    state.stored.additionalAssets.push(['Added_meanwhile', 'assets/added.png', 'png']);
  };
  await handleUpdate('upd-apply', { charIndex: 0 }, env);
  assert.equal(updateUi.notice, '');
  assert.equal(state.writes, 1);
  const c = state.stored;
  assert.deepEqual(c.chats[0].message.map((m) => m.data), ['안녕', '받는 동안 온 응답'], '받는 동안 온 응답이 덮이지 않는다');
  assert.equal(c.characterVersion, '0.2.0');
  assert.match(c.globalLore.find((e) => e.comment === 'Plugin manifest').content, /"0\.2\.0"/);
  assert.deepEqual(c.additionalAssets, [['MyOwn', 'assets/mine.png', 'png'], ['Added_meanwhile', 'assets/added.png', 'png'], ['New_pic', 'assets/new.png', 'png']]);
  delete globalThis.risuai;
});

test('카드에 적용: 사진을 못 받으면 카드를 쓰지 않는다 (그대로)', async () => {
  const state = setup();
  globalThis.risuai.nativeFetch = async () => ({ ok: false });
  await handleUpdate('upd-apply', { charIndex: 0 }, env);
  assert.equal(state.writes, 0);
  assert.notEqual(updateUi.notice, '');
  assert.equal(updateUi.busy, false);
  delete globalThis.risuai;
});
