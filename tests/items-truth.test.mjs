// 숨긴 진짜 효과가 소지품에 저장되고 본편 글에만 드러난다 (11-09 사용자)
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export * from './src/core/items';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false });
const I = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

test('truth: addItem 저장, itemLine 에 「truly」, updateItem 이 지우지 않는다', () => {
  let it = I.emptyItems ? I.emptyItems() : { list: [], log: [] };
  const alive = new Set(['a1']);
  it = I.addItem(it, alive, { name: '빛의 돌', desc: '둥근 돌', effect: '어둠을 밝힌다', truth: '쥐면 주변 전등이 전부 꺼진다', from: 'store', anchor: 'a1' });
  const e = it.list[0];
  assert.equal(e.truth, '쥐면 주변 전등이 전부 꺼진다');
  const line = I.itemLine(e, undefined, false);
  assert.ok(line.includes('truly: 쥐면 주변 전등이 전부 꺼진다') && line.includes('the label claims: 어둠을 밝힌다'), line);
  assert.ok(!I.itemLine(e, undefined, false, 'name').includes('truly'), '이름만 넘길 땐 없음');
  const plain = I.addItem(it, alive, { name: '손전등', effect: '밝다', from: 'store', anchor: 'a1' }).list[1];
  assert.equal(I.itemLine(plain, undefined, false), '- 손전등 (밝다)');
  const up = I.updateItem(it, e.id, { desc: '둥근 돌 (금이 감)' });
  assert.equal(up.list[0].truth, e.truth, '설명을 고쳐도 진짜 효과는 남는다');
});

test('truth ? : 본편 줄에 「unknown … decide then」', () => {
  const it = I.addItem({ list: [], log: [] }, new Set(['a1']), { name: '돌', effect: '???', truth: '?', from: 'store', anchor: 'a1' });
  assert.ok(I.itemLine(it.list[0], undefined, false).includes('truly: unknown'));
});
