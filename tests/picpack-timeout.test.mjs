// 11-14 재검토 loader#4: 카드 사진 받기에 시간 제한이 있다. 응답이 영영 안 오는 요청 하나로
// 설치·업데이트가 「사진 받는 중」에서 굳지 않고, 이미 있는 실패 안내(PicError)로 끝난다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = join(tmpdir(), 'goei-picpack-timeout');
await mkdir(dir, { recursive: true });
const outfile = join(dir, `bundle-${process.pid}.mjs`);
await build({
  stdin: { contents: "export * from './src/host/picpack';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', target: 'es2022', charset: 'utf8',
  loader: { '.txt': 'text', '.css': 'text' }, outfile, logLevel: 'silent',
});
const { fetchPicture, fetchPictures, PicError, PIC_TIMEOUT_MS } = await import(pathToFileURL(outfile));

const bytes = new Uint8Array([1, 2, 3, 4, 5]);
const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 12);
const pic = ['New_pic', hash, 'png', bytes.length];
const never = () => new Promise(() => {});
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
/** 끝났는지 볼 수 있게 감싼다 */
const watch = (p) => {
  const s = { done: false, error: null, value: null };
  p.then((v) => { s.done = true; s.value = v; }, (e) => { s.done = true; s.error = e; });
  return s;
};

test('사진 받기: nativeFetch 가 응답 없이 멈추면 제한 시간 뒤 기존 실패 안내로 끝난다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.risuai = { nativeFetch: never };
  const s = watch(fetchPicture(pic));
  await flush();
  t.mock.timers.tick(PIC_TIMEOUT_MS - 1);
  await flush();
  assert.equal(s.done, false);
  t.mock.timers.tick(1);
  await flush();
  assert.equal(s.done, true);
  assert.ok(s.error instanceof PicError);
  assert.equal(s.error.message, '사진 「New_pic」을 받지 못했어요.');
});

test('사진 받기: 응답은 왔는데 내용(arrayBuffer)이 멈춰도 제한 시간 뒤 실패로 끝난다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.risuai = { nativeFetch: async () => ({ ok: true, arrayBuffer: never }) };
  const s = watch(fetchPicture(pic));
  await flush();
  t.mock.timers.tick(PIC_TIMEOUT_MS);
  await flush();
  assert.ok(s.error instanceof PicError);
});

test('사진 받기: risuFetch 가 멈추면 제한 시간 뒤 nativeFetch 로 넘어가 받는다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.risuai = { risuFetch: never, nativeFetch: async () => ({ ok: true, arrayBuffer: async () => bytes.buffer.slice(0) }) };
  const s = watch(fetchPicture(pic));
  await flush();
  assert.equal(s.done, false);
  t.mock.timers.tick(PIC_TIMEOUT_MS);
  for (let i = 0; i < 20000 && !s.done; i++) await new Promise((r) => setImmediate(r));
  assert.equal(s.error, null);
  assert.deepEqual([...s.value], [...bytes]);
});

test('사진 받기: 여러 장 중 한 장이 멈춰도 fetchPictures 가 실패로 끝나고 아무것도 저장하지 않는다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let saves = 0;
  globalThis.risuai = {
    nativeFetch: async (url) => (String(url).includes('stuck') ? never() : { ok: true, arrayBuffer: async () => bytes.buffer.slice(0) }),
    saveAsset: async () => { saves++; return 'assets/x.png'; },
  };
  const plan = { get: [pic, ['Stuck', 'stuck', 'png', 5], ['Other', hash, 'png', 5]], drop: [], replaced: 0, added: 3, bytes: 15 };
  const s = watch(fetchPictures([], plan, () => {}));
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
  assert.equal(s.done, false);
  t.mock.timers.tick(PIC_TIMEOUT_MS);
  for (let i = 0; i < 20000 && !s.done; i++) await new Promise((r) => setImmediate(r));
  assert.ok(s.error instanceof PicError);
  assert.equal(saves, 0);
});

test('사진 받기: 제때 오면 그대로 받는다', async () => {
  globalThis.risuai = { nativeFetch: async () => ({ ok: true, arrayBuffer: async () => bytes.buffer.slice(0) }) };
  assert.deepEqual([...(await fetchPicture(pic))], [...bytes]);
});
