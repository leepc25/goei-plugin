import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-fightlog-'));
await build({ entryPoints: ['src/game/world/fightlog.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const F = await import(pathToFileURL(join(dir, 'game/world/fightlog.mjs')));

test('싸움 한 건 = 한 줄: 먼저 친 쪽·상대 A·B·수단·결과, 살해는 따로, 쓰러지면 끝 줄', () => {
  const out = [];
  const log = new F.FightLog((l) => out.push(l));
  log.userHit('15:40', 's', 'p1', '행인', 'fists', false);
  log.userHit('15:40', 's', 'p2', '행인', 'fists', false);
  log.knockedOut('p1');
  log.fled('p2');
  log.tick(F.QUIET + 0.1, false);
  assert.equal(out[0].kind, 'provoke');
  assert.equal(out[0].text, '15:40 {user} attacked first: pedestrian A, B (fists). A knocked out; B fled.');
  log.killed('15:41', 's', 'p1', '행인', 'weapon');
  assert.equal(out[1].kind, 'kill');
  assert.equal(out[1].text, '15:41 {user} killed pedestrian A (with a weapon) while they were knocked out.');
  // 보고서용 한글 (기록 메뉴)
  assert.equal(out[0].ko, '15:40 {user} 먼저 공격: 행인 A, B (맨손). A 기절, B 도주');
  assert.equal(out[1].ko, '15:41 {user}: 기절해 있던 행인 A 살해 (무기)');
  // 출동한 경찰이 덤빔 → 하나 기절시키고 다른 하나에게 짐
  log.joined('15:42', 's', 'c1', '경찰', 'responding to a murder report');
  log.joined('15:42', 's', 'c2', '경찰', 'responding to a murder report');
  log.userHit('15:42', 's', 'c1', '경찰', 'weapon', true);
  log.knockedOut('c1');
  log.userDown(false, 'c2');
  assert.equal(out[2].kind, 'act');
  assert.equal(out[2].text, '15:42 Police officer A, B (responding to a murder report) attacked {user}; {user} fought back (weapon). A knocked out; police officer B knocked {user} out.');
  assert.equal(out[3].text, '{user} lost consciousness; the field visit ended here.');
});

test('필드 돈 정산: 가계부 한 줄로 묶음 (구입·판매·주움·뜯김)', async () => {
  const d = await mkdtemp(join(tmpdir(), 'goei-money-'));
  await build({ entryPoints: ['src/game/world/fieldmoney.ts'], outdir: d, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
  const M = await import(pathToFileURL(join(d, 'game/world/fieldmoney.mjs')));
  assert.equal(M.settleLine([]), null);
  const r = M.settleLine([{ amount: -1500, memo: '편의점 컵라면' }, { amount: -4500, memo: '편의점 담배' }, { amount: 3000, memo: '불량배가 떨어뜨린 돈' }, { amount: 2000, memo: '편의점에 라이터 팜' }, { amount: -32000, memo: '불량배에게 뜯김' }]);
  assert.equal(r.net, -33000);
  assert.equal(r.memo, '필드 정산: 구입 −6,000 · 주움 +3,000 · 판매 +2,000 · 뜯김 −32,000');
});
