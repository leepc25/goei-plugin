// 아이템과 무기 모듈 (src/game/action/items/) 시험. 스스로 묶어서 불러온다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'goei-items-'));
const out = await build({ entryPoints: ['src/game/action/items/index.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
writeFileSync(join(dir, 'items.mjs'), out.outputFiles[0].text);
const I = await import(join(dir, 'items.mjs'));

const me = { x: 300, y: 600, z: 0, dir: 1 };
const tick = (f, r, input = {}, targets = [], ctx) => I.stepField(f, r, me, input, targets, 1 / 30, ctx);

test('소모품 1~4칸: 같은 종류는 겹치고 최대를 넘지 않는다', () => {
  const r = I.createItemRun('jyaldi', [{ id: 'medkit', n: 2 }, null, null, null]);
  assert.equal(I.addItem(r, 'medkit', 3), 3, '넘친 것은 빈 칸으로');
  assert.deepEqual(r.loadout.slice(0, 2), [{ id: 'medkit', n: 3 }, { id: 'medkit', n: 2 }]);
  assert.equal(I.addItem(r, 'charm'), 1);
  assert.equal(I.addItem(r, 'charm'), 1, '부적은 칸 하나에 1개, 다음 빈 칸으로');
  assert.equal(I.addItem(r, 'flash'), 0, '네 칸이 다 찼다');
  assert.equal(I.canAddItem(r, 'medkit'), true, '회복약 칸 하나에 아직 자리');
});

test('효과 없는 회복약은 소비하지 않고, 소비 뒤 칸이 비면 null', () => {
  const r = I.createItemRun('jyaldi', [{ id: 'medkit', n: 1 }, null, null, null]);
  assert.equal(I.useItem(r, 0, { hp: 100, max: 100 }), null);
  const u = I.useItem(r, 0, { hp: 40, max: 100 });
  assert.equal(u.effect.type, 'heal');
  assert.equal(r.loadout[0], null);
});

test('부적은 피격 1회 무효', () => {
  const r = I.createItemRun('jyaldi', [{ id: 'charm', n: 1 }, null, null, null]);
  I.useItem(r, 0);
  assert.equal(I.consumeWard(r), true);
  assert.equal(I.consumeWard(r), false);
});

test('고유 권총 탄 제한: 8발 쏘면 자동 재장전, 예비가 다 떨어지면 탄 없음', () => {
  const f = I.createField(5),
    r = I.createItemRun('jyaldi');
  let shots = 0,
    dry = false;
  for (let i = 0; i < 30 * 30 && !dry; i++) {
    const ev = tick(f, r, { shoot: true });
    shots += ev.filter(e => e.t === 'shot').length;
    dry = ev.some(e => e.t === 'dry');
  }
  assert.equal(shots, 8 + 16, '장전 8 + 예비 16');
  assert.ok(dry);
  assert.equal(I.addAmmo(r), 8);
  assert.equal(I.startReload(r), true);
});

test('탄이 없는 요원에게는 탄이 안 떨어진다', () => {
  const f = I.createField(9),
    r = I.createItemRun('gorgodio');
  for (let i = 0; i < 50; i++) I.rollDrops(f, r, 'midboss', 500, 600);
  assert.ok(!f.ents.some(e => e.kind === 'ammo'));
});

test('드랍은 시드가 같으면 같다', () => {
  const run = () => {
    const f = I.createField(42),
      r = I.createItemRun('jyaldi');
    for (let i = 0; i < 20; i++) I.rollDrops(f, r, 'anomaly', 500, 600);
    return f.ents.map(e => e.kind + (e.ref ?? '') + e.amount).join(',');
  };
  assert.equal(run(), run());
});

test('바닥 회복 조각은 가까이 가면 자동으로 줍고, 무기는 E', () => {
  const f = I.createField(3),
    r = I.createItemRun('jyaldi');
  I.spawnPickup(f, 'heal', me.x + 10, me.y);
  I.spawnPickup(f, 'weapon', me.x, me.y, 'pipe');
  for (let i = 0; i < 60; i++) tick(f, r);
  assert.ok(!f.ents.some(e => e.type === 'pickup' && e.kind === 'heal'));
  assert.equal(r.held, null);
  const ev = tick(f, r, { interact: true });
  assert.ok(ev.some(e => e.t === 'equip' && e.weapon === 'pipe'));
  assert.equal(r.held.uses, 8);
});

test('한 손 근접 임시 무기: 휘두를 때마다 내구가 줄고 0이면 부러진다', () => {
  const f = I.createField(3),
    r = I.createItemRun('jyaldi');
  I.equip(r, 'chairleg');
  const target = [{ id: 1, x: me.x + 60, y: me.y, w: 60, h: 160 }];
  let hits = 0,
    broke = false;
  for (let i = 0; i < 6; i++) {
    const res = I.attack(f, r, me, target);
    hits += res.events.filter(e => e.t === 'hit').length;
    broke ||= res.events.some(e => e.t === 'weaponBreak');
  }
  assert.equal(hits, 6);
  assert.ok(broke);
  assert.equal(r.held, null);
  assert.equal(I.attack(f, r, me, target).handled, false, '맨손이면 고유 근접으로');
});

test('총 임시 무기: S가 그 총을 쏘고 고유 탄은 그대로', () => {
  const f = I.createField(3),
    r = I.createItemRun('jyaldi');
  I.equip(r, 'shotgun');
  const ev = I.shoot(f, r, me);
  assert.ok(ev.some(e => e.t === 'shot' && e.source === 'shotgun'));
  assert.equal(f.projs.length, 5, '산탄 5발');
  assert.equal(r.mag, 8);
  assert.equal(r.held.uses, 5);
});

test('다른 무기를 주우면 들던 무기는 바닥에 내려놓는다(교체 아님, 손에 하나)', () => {
  const f = I.createField(3),
    r = I.createItemRun('jyaldi');
  I.equip(r, 'pipe', 3);
  I.spawnPickup(f, 'weapon', me.x, me.y, 'smg');
  for (let i = 0; i < 30; i++) tick(f, r);
  const ev = tick(f, r, { interact: true });
  assert.ok(ev.some(e => e.t === 'equip' && e.dropped === 'pipe'));
  const left = f.ents.find(e => e.ref === 'pipe');
  assert.equal(left.uses, 3);
});

test('던질 물건: E로 들고 A로 던지면 적을 맞히고 넘어뜨린다', () => {
  const f = I.createField(3),
    r = I.createItemRun('jyaldi');
  I.placeProp(f, 'chair', me.x + 30, me.y);
  tick(f, r, { interact: true });
  assert.equal(r.carry.prop, 'chair');
  const target = [{ id: 7, x: me.x + 250, y: me.y, w: 70, h: 170 }];
  const ev = tick(f, r, { attack: true }, target);
  assert.ok(ev.some(e => e.t === 'throw'));
  let hit;
  for (let i = 0; i < 30 && !hit; i++) hit = tick(f, r, {}, target).find(e => e.t === 'hit');
  assert.ok(hit && hit.knockdown && hit.damage === 26);
});

test('부서지는 물건: 상자를 부수면 드랍, 드럼통은 터져서 주변 적과 물건을 친다', () => {
  const f = I.createField(11),
    r = I.createItemRun('jyaldi');
  I.placeProp(f, 'barrel', me.x + 60, me.y);
  I.placeProp(f, 'crate', me.x + 150, me.y);
  const target = [{ id: 3, x: me.x + 120, y: me.y, w: 70, h: 170 }];
  let ev = [];
  for (let i = 0; i < 3; i++) ev = ev.concat(I.attack(f, r, me, target, { damage: 12, reach: 110 }).events);
  assert.ok(ev.some(e => e.t === 'break' && e.prop === 'barrel'));
  assert.ok(ev.some(e => e.t === 'hit' && e.target === 3 && e.damage === 40));
  assert.ok(ev.some(e => e.t === 'break' && e.prop === 'crate'), '폭발 연쇄로 상자도 부서짐');
});

test('섬광탄은 던져서 떨어진 자리 주변 적을 기절시킨다', () => {
  const f = I.createField(3),
    r = I.createItemRun('jyaldi', [{ id: 'flash', n: 1 }, null, null, null]);
  const target = [{ id: 2, x: me.x + 120, y: me.y, w: 70, h: 170 }];
  let ev = tick(f, r, { use: 0 }, target);
  for (let i = 0; i < 60; i++) ev = ev.concat(tick(f, r, {}, target));
  assert.ok(ev.some(e => e.t === 'hit' && e.status === 'stun' && e.stun === 2));
});

test('소금 원 안에는 괴이가 못 들어온다(판정 함수)', () => {
  const f = I.createField(3),
    r = I.createItemRun('jyaldi', [{ id: 'salt', n: 1 }, null, null, null]);
  tick(f, r, { use: 0 });
  assert.ok(I.inSalt(f, me.x + 40, me.y));
  assert.ok(!I.inSalt(f, me.x + 400, me.y));
});

test('엔진 연결: 날아가는 물건이 Hit 상자로 나오고, hitProp으로 끝난다', () => {
  const f = I.createField(3),
    r = I.createItemRun('jyaldi');
  I.placeProp(f, 'tv', me.x + 30, me.y);
  tick(f, r, { interact: true });
  tick(f, r, { attack: true });
  const hits = I.projectileHits(f);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].react, 'down');
  const ev = I.hitProp(f, r, hits[0].projId, 9);
  assert.ok(ev.some(e => e.t === 'burst' && e.kind === 'shock'));
  assert.equal(I.projectileHits(f).length, 0);
  const w = (I.equip(r, 'katana'), I.weaponAttack(r, 'melee'));
  assert.equal(w.armorBreak, true);
  assert.equal(w.clip, 'pipe');
  const ge = I.toGameEvents([{ t: 'pickup', kind: 'cash', amount: 3, x: 1, y: 2 }, { t: 'dry' }], 0);
  assert.deepEqual(ge.map(e => e.type), ['pickup', 'empty']);
});
