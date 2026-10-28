// 적: 적 몸·동작·드랍 표를 화면 없이 본다 (node scripts/build-enemy.mjs 먼저).
// 옛 적 시험장(층 유형 편성·수호자)은 차원 승강기와 같이 지웠다 (2026-10-28).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_DEFS, ROSTER, moveTiming, rollDrops, createEnemy } from '../dist-test/enemy.mjs';

test('모든 정의: 동작마다 장별 판정이 있고 유효 장 전에 예고가 있다', () => {
  assert.ok(ROSTER.length >= 5, '가짜 관리국·백일몽 5종');
  for (const d of ALL_DEFS) {
    for (const a of d.attacks) {
      const m = a.move;
      assert.ok(m.frames.length > 0, `${d.kind}.${m.id} frames`);
      for (const f of m.frames) assert.ok(Array.isArray(f.hit) && Array.isArray(f.hurt), `${d.kind}.${m.id} 장별 hit/hurt`);
      const t = moveTiming(m);
      const firstHit = m.frames.findIndex((f) => f.hit.length || f.fire);
      if (firstHit >= 0 && !['parry', 'rally'].some((x) => m.frames.some((f) => f.ev === x))) assert.ok(t.tele >= 8, `${d.kind}.${m.id} 예고 ${t.tele}틱 (8틱 이상)`);
      // 유효 장 밖에는 공격 상자가 없다
      m.frames.forEach((f, i) => f.tele && assert.equal(f.hit.length, 0, `${d.kind}.${m.id} 예고 장 ${i}에 공격 상자`));
    }
  }
});

test('드랍 표: 회복 조각·탄만, none은 비었다', () => {
  const r = () => 0.01;
  assert.ok(rollDrops('mid', r).some((d) => d.item === 'heal'));
  for (const t of ['common', 'bureau', 'daydream', 'mid', 'guardian']) for (const d of rollDrops(t, r)) assert.ok(['heal', 'ammo'].includes(d.item), `${t}: ${d.item}`);
  assert.equal(rollDrops('none', r).length, 0);
});

test('createEnemy: 엔진 Body 모양 (frame·step·applyHit·draw)', () => {
  for (const d of ALL_DEFS) {
    const e = createEnemy(d.kind, 600, 590, () => 0.3);
    assert.equal(e.team, 'enemy');
    assert.equal(typeof e.frame, 'function');
    assert.equal(typeof e.applyHit, 'function');
    assert.equal(typeof e.draw, 'function');
  }
});
