// 숨긴 진짜 효과: 소지품에 저장되고, 본편에는 쓰는 턴(또는 걸친 장비)에만 「Really」로 간다 (11-09 사용자)
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export * from './src/core/items';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false });
const I = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const alive = new Set(['a1']);
const base = { slots: 8, limit: '8 items' };

test('truth: 저장되고 updateItem 이 지우지 않으며, 줄(itemLine)에는 절대 안 나온다', () => {
  let it = I.addItem({ list: [], log: [] }, alive, { name: '빛의 돌', desc: '둥근 돌', effect: '어둠을 밝힌다', truth: '쥐면 주변 전등이 전부 꺼진다', from: 'store', anchor: 'a1' });
  const e = it.list[0];
  assert.equal(e.truth, '쥐면 주변 전등이 전부 꺼진다');
  assert.equal(I.itemLine(e, undefined, false), '- 빛의 돌 — 둥근 돌 (어둠을 밝힌다)', '평소엔 광고 문구만');
  assert.equal(I.updateItem(it, e.id, { desc: '금이 감' }).list[0].truth, e.truth);
});

test('truth: 안 쓰는 턴엔 Really 없음, 쓰는 턴엔 Really 에 진짜, ? 는 「decide now」', () => {
  let it = I.addItem({ list: [], log: [] }, alive, { name: '빛의 돌', effect: '어둠을 밝힌다', truth: '쥐면 주변 전등이 전부 꺼진다', use: true, from: 'store', anchor: 'a1' });
  it = I.addItem(it, alive, { name: '돌', effect: '???', truth: '?', use: true, from: 'store', anchor: 'a1' });
  const live = I.liveItems(it, alive);
  const quiet = I.itemsBlock(live, base);
  assert.ok(!quiet.includes('Really') && !quiet.includes('전등'), quiet);
  const used = I.itemsBlock(live, { ...base, use: [{ name: '빛의 돌', n: 1 }, { name: '돌', n: 1 }] });
  assert.ok(used.includes('Really') && used.includes('- 빛의 돌: 쥐면 주변 전등이 전부 꺼진다 (the label says 「어둠을 밝힌다」)'), used);
  assert.ok(used.includes('- 돌: not even its seller knows (the label says 「???」 and may be false) — decide what it really does now'), used);
  assert.ok(I.INVENTORY_NOTE.includes('Really'));
});
