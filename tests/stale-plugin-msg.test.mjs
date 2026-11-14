// 11-14 재검토 D-4 (사용자 답 (가)): 올라온 본체·자료가 이 플러그인보다 새 판이면 「잠시 뒤 다시 받아 주세요」가 아니라 플러그인 업데이트를 안내한다.
// 같은 판인데 아직 안 올라온 경우(올라온 것이 옛 판)는 지금 글 그대로. 먼저 npm run build (dist-test/core.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { oldPluginMessage } from '../dist-test/core.mjs';

const NEW = '플러그인이 옛 판(v0.21.11)이에요. 새 판 v0.21.14가 나왔어요. Risu 설정 → 플러그인에서 업데이트해 주세요.';

test('안내 글: 올라온 판이 더 새 판일 때만', () => {
  assert.equal(oldPluginMessage('0.21.11', '0.21.14'), NEW);
  assert.equal(oldPluginMessage('0.21.9', '0.21.10'), '플러그인이 옛 판(v0.21.9)이에요. 새 판 v0.21.10가 나왔어요. Risu 설정 → 플러그인에서 업데이트해 주세요.');
  assert.equal(oldPluginMessage('0.21.14', '0.21.14'), null, '같은 판');
  assert.equal(oldPluginMessage('0.21.14', '0.21.11'), null, '올라온 것이 옛 판');
  assert.equal(oldPluginMessage('0.21.10', '0.21.9'), null, '숫자로 비교');
  assert.equal(oldPluginMessage('0.21.14', undefined), null, '판을 모름');
  assert.equal(oldPluginMessage('0.21.14', '<b>9</b>'), null, '판 모양이 아님');
});

/** 소스 하나를 시험용으로 묶어 불러온다 (받기는 globalThis.risuai 를 쓴다) */
async function load(entry, define) {
  const out = await build({ entryPoints: [entry], bundle: true, format: 'esm', target: 'es2022', charset: 'utf8', write: false, loader: { '.txt': 'text', '.css': 'text' }, define });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}
/** 목록 파일만 돌려주는 가짜 Risu */
function serve(index) {
  globalThis.risuai = { nativeFetch: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(index) }) };
}

test('본체 받기(fetchBody): 올라온 본체가 새 판이면 업데이트 안내, 옛 판이면 지금 글', async () => {
  const { fetchBody } = await load('src/loader/body.ts', { __UPDATE_BASE__: '"https://example.invalid/release"' });
  serve({ version: '0.21.14', parts: ['goei-body.1.txt'], length: 1 });
  await assert.rejects(fetchBody('0.21.11'), { message: NEW });
  serve({ version: '0.21.11', parts: ['goei-body.1.txt'], length: 1 });
  await assert.rejects(fetchBody('0.21.14'), { message: '아직 이 판의 본체가 올라오지 않았어요. 잠시 뒤 다시 받아 주세요.' });
});

test('자료 받기(fetchPack): 올라온 자료가 새 판의 것이면 업데이트 안내, 아니면 지금 글', async () => {
  const { fetchPack } = await load('src/host/datapack.ts', { __UPDATE_BASE__: '"https://example.invalid/release"', __PLUGIN_VERSION__: '"0.21.11"' });
  const pack = { name: 'goei-data-world', label: '세계 자료', expect: { hash: 'aaaaaaaa', sha256: '', length: 1 } };
  serve({ name: pack.name, version: '0.21.14', parts: ['goei-data-world.1.txt'], hash: 'bbbbbbbb', length: 1 });
  await assert.rejects(fetchPack(pack), { message: NEW });
  const same = '아직 이 판의 세계 자료가 올라오지 않았어요. 잠시 뒤 다시 받아 주세요.';
  serve({ name: pack.name, version: '0.21.11', parts: ['goei-data-world.1.txt'], hash: 'bbbbbbbb', length: 1 });
  await assert.rejects(fetchPack(pack), { message: same }, '같은 판인데 지문이 다름');
  serve({ name: pack.name, version: '0.21.9', parts: ['goei-data-world.1.txt'], hash: 'bbbbbbbb', length: 1 });
  await assert.rejects(fetchPack(pack), { message: same }, '올라온 것이 옛 판');
  serve({ name: pack.name, parts: ['goei-data-world.1.txt'], hash: 'bbbbbbbb', length: 1 });
  await assert.rejects(fetchPack(pack), { message: same }, '목록에 판이 없음');
});
