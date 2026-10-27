// 상태 효과 규격 (src/game/combat/status.ts, docs/게임_성장_경제_설계.md 6장)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-status-'));
await build({ entryPoints: ['src/game/combat/status.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const S = await import(pathToFileURL(join(dir, 'game/combat/status.mjs')));

test('걸기·겹침·시간', () => {
  const s = new S.StatusSet();
  assert.equal(s.apply('bleed'), true);
  assert.equal(s.apply('bleed'), false);
  s.apply('bleed'); s.apply('bleed');
  assert.equal(s.stacks('bleed'), 3, '출혈 3겹이 상한');
  s.apply('slow', 2);
  s.step(2.1, { maxHp: 100 });
  assert.equal(s.has('slow'), false, '시간이 지나면 풀림');
});

test('디버프 동시 3개: 넷째가 오면 가장 짧은 것이 밀려남, 오염은 남음', () => {
  const s = new S.StatusSet();
  s.apply('taint'); s.apply('slow', 1); s.apply('headache', 9);
  s.apply('fear', 5);
  assert.deepEqual(s.list.map((x) => x.kind).sort(), ['fear', 'headache', 'taint']);
});

test('효과: 출혈 피해(달리면 배)·오염 최대 체력·두통 충전·공포 막기·침묵·혼란', () => {
  const s = new S.StatusSet();
  s.apply('bleed'); s.apply('bleed');
  assert.equal(Math.round(s.step(1, { maxHp: 200 })), 4);
  assert.equal(Math.round(s.step(1, { maxHp: 200, running: true })), 8);
  const t = new S.StatusSet();
  t.apply('taint'); t.apply('taint');
  assert.equal(t.maxHpRatio(), 0.6);
  t.cure('taint');
  assert.equal(t.stacks('taint'), 1, '정화제는 한 단계씩');
  const u = new S.StatusSet();
  u.apply('headache'); u.apply('fear'); u.apply('silence');
  assert.equal(u.spMul(), 0.5);
  assert.equal(u.canBlock(), false);
  assert.equal(u.canSkill(), false);
  assert.ok(u.speedMul() < 1);
  const c = new S.StatusSet();
  c.apply('confuse');
  assert.equal(c.flipped(), true);
  c.onHit();
  assert.equal(c.flipped(), false, '맞으면 혼란이 풀림');
});

test('출혈: 막기를 3초 이어 하면 멎음', () => {
  const s = new S.StatusSet();
  s.apply('bleed');
  for (let i = 0; i < 31; i++) s.step(0.1, { maxHp: 100, blocking: true });
  assert.equal(s.has('bleed'), false);
});
