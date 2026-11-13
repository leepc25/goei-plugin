// 전수검사 11-13: 두고 옴 말·벗음 말 겹침(items#10), 가게 「소모 3」 쓰임 글(parse#6)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix2/items2';
await mkdir(dir, { recursive: true });
await build({
  entryPoints: ['src/core/itemrules.ts', 'src/core/itemtraits.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const R = await import(pathToFileURL(join(dir, 'core/itemrules.mjs')));
const T = await import(pathToFileURL(join(dir, 'core/itemtraits.mjs')));

test('두고 옴 말: 벗음 말 「내려놓」 안의 「놓고」는 두고 옴으로 치지 않는다', () => {
  R.setItemRules(undefined);
  assert.equal(R.leftWordIn('배낭을 내려놓고 쉬었다'), '');
  assert.equal(R.offWordIn('배낭을 내려놓고 쉬었다'), '내려놓');
  assert.equal(R.leftWordIn('잠시 내려놓고 쉬는 중'), '');
  // 벗음 말 밖의 두고 옴 말은 그대로 잡는다
  assert.equal(R.leftWordIn('벗어 두고 왔다'), '두고');
  assert.equal(R.leftWordIn('집에 놓고 왔다'), '놓고');
  assert.equal(R.leftWordIn('경찰에 압수당함'), '압수');
  assert.equal(R.leftWordIn(undefined), '');
});

test('쓰임 글: 「소모 3」「소모3회」「소모(3)」「소모 x3」은 3회, 맨 「소모」는 1회', () => {
  for (const s of ['소모 3', '소모3회', '소모(3)', '소모 x3', '소모: 3', '의료 소모 3번', 'consumable 3', 'uses x3']) {
    const t = T.parseTraits(s);
    assert.equal(t.uses, 3, s);
    assert.equal(t.use, true, s);
  }
  assert.equal(T.parseTraits('소모').uses, 1);
  assert.equal(T.parseTraits('소모3').uses, 3);
  assert.deepEqual(T.parseTraits('장비·소모 2'), { use: true, equip: 'gear', uses: 2 });
  assert.deepEqual(T.parseTraits('무기'), { use: false, equip: 'weapon' });
  assert.deepEqual(T.parseTraits('사용'), { use: true });
});
