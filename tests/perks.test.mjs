import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
// 임시 퍽 (docs/설계_퍽_목록_3판.md): 출현 조건·방 보상 추첨·수치 합산. 사건 효과는 시험장(브라우저)에서 확인
const dir = await mkdtemp(join(tmpdir(), 'goei-perks-'));
await build({ entryPoints: ['src/game/perks/rules.ts', 'src/game/perks/runtime.ts', 'src/game/perks/defs.gen.ts', 'src/game/combat/status.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const imp = (n) => import(pathToFileURL(join(dir, `game/${n}.mjs`)));
const R = await imp('perks/rules'), RT = await imp('perks/runtime'), D = await imp('perks/defs.gen'), S = await imp('combat/status');

const kit = (o = {}) => ({ shot: true, thrown: false, hot: false, skill: true, charge: true, super: true, str: 5, ails: { skill: [], charge: [], super: [], any: [] }, ...o });
const own = (names = [], traits = []) => ({ ranks: new Map(names.map((n) => [n, 1])), traits: new Set(traits) });
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test('목록: 공용 139 + 특성 20, 아이템 보류 8개는 후보에 없다', () => {
  assert.equal(D.PERK_TEXT.length, 139);
  assert.equal(D.TRAIT_TEXT.length, 20);
  for (const n of ['약 잘 쓰는 손', '넉넉한 주머니', '아끼기', '한 모금', '퀵 드로우', '응급 자동 사용']) assert.equal(R.perkOk(n, kit(), own()), false);
});

test('출현 조건: 사격·투척·과열·힘', () => {
  assert.equal(R.perkOk('정조준', kit({ shot: false }), own()), false);
  assert.equal(R.perkOk('관통탄', kit({ thrown: true }), own()), false);
  assert.equal(R.perkOk('부메랑 투척', kit({ thrown: true }), own()), true);
  assert.equal(R.perkOk('과열 방출', kit(), own()), false);
  assert.equal(R.perkOk('과열 방출', kit({ hot: true }), own()), true);
  assert.equal(R.perkOk('무거운 한 방', kit({ str: 5 }), own()), false);
  assert.equal(R.perkOk('무거운 한 방', kit({ str: 6 }), own()), true);
});

test('조합 퍽: 그 상태를 거는 기술이나 퍽이 있어야 나온다', () => {
  assert.equal(R.perkOk('피 터뜨리기', kit(), own()), false);
  assert.equal(R.perkOk('피 터뜨리기', kit({ ails: { any: ['bleed'] } }), own()), true);
  assert.equal(R.perkOk('피 터뜨리기', kit(), own(['출혈 일격'])), true);
  assert.equal(R.perkOk('두통 울림', kit(), own([], ['저주받은 손'])), true);
  assert.equal(R.perkOk('상처 옮기기', kit(), own(['출혈 일격'])), false);
  assert.equal(R.perkOk('상처 옮기기', kit(), own(['출혈 일격', '혼쭐'])), true);
  // 이미 그 상태를 거는 기술이면 같은 상태를 더하는 퍽은 안 나옴
  assert.equal(R.perkOk('혼란 충전', kit({ ails: { charge: ['confuse'], any: ['confuse'] } }), own()), false);
});

test('쌍 퍽: 두 퍽을 다 가져야 나오고, 후보 3개 중 최대 1개', () => {
  assert.equal(R.perkOk('연쇄 폭파', kit(), own(['시체 폭발'])), false);
  assert.equal(R.perkOk('연쇄 폭파', kit(), own(['시체 폭발', '폭발탄'])), true);
  const o = own(['시체 폭발', '폭발탄', '내려찍기', '3단 점프', '탄 되받기', '무적 회피']);
  for (let i = 0; i < 40; i++) {
    const offers = R.draft(kit(), o, Math.random);
    assert.equal(offers.length, 3);
    assert.ok(offers.filter((f) => f.type === 'perk' && f.def.kind === '쌍').length <= 1);
    assert.equal(new Set(offers.map((f) => f.def.name)).size, offers.length);
  }
});

test('추첨: 랭크가 다 찬 퍽은 안 나오고, 탐욕이면 4개', () => {
  const full = new Map(D.PERK_TEXT.filter((p) => p.rank < 99).map((p) => [p.name, p.rank]));
  const offers = R.draft(kit(), { ranks: full, traits: new Set() }, seq(0.9, 0.9, 0.1, 0.5, 0.3));
  for (const f of offers) if (f.type === 'perk') assert.equal(f.def.name, '응급 치료');
  assert.equal(R.draft(kit(), own([], ['탐욕']), Math.random).length, 4);
});

test('수치 합산: 회피·점프·체력·받는 피해', () => {
  const k = new RT.PerkRun();
  k.add('연속 회피'); k.add('연속 회피'); k.add('회피 충전 단축'); k.add('3단 점프');
  assert.equal(k.dodgeMax(), 4);
  assert.ok(Math.abs(k.dodgeCd() - 0.65) < 1e-9);
  assert.equal(k.maxJumps(), 3);
  k.addTrait('무거운 장비');
  assert.equal(k.maxJumps(), 2);
  k.add('두꺼운 가죽'); k.addTrait('철벽');
  assert.ok(Math.abs(k.takenMul() - 0.95 * 0.75) < 1e-9);
  k.add('튼튼한 몸'); k.addTrait('유리 대포');
  assert.ok(Math.abs(k.hpMul() - 1.08 * 0.7) < 1e-9);
});

test('맞힘 보너스는 더한다: 단련된 주먹 3 + 그림자 습격 (등 뒤 3타째)', () => {
  const k = new RT.PerkRun();
  k.host = { P: { x: 0, face: 1 }, me: { hp: 1000, hpMax: 1000, baseHp: 1000 }, setHpMax() {}, foes: () => [{}, {}], isElite: () => false, isDown: () => false, isStunned: () => false, statusOf: () => null, bounds: () => [0, 1280] };
  for (let i = 0; i < 3; i++) k.add('단련된 주먹');
  k.add('그림자 습격');
  const c = { t: { x: 100, mark: 0, bindT: 0, z: 0 }, body: { hp: 500, hpMax: 1000, dir: 1 }, src: 'light', step: 3, last: true, kind: 'light', dmg: 100, critAdd: 0, forceCrit: false, critDmgAdd: 0, hpBefore: 500 };
  k.pre(c);
  // 0.24 + 0.24 + 0.15 = +63%
  assert.equal(Math.round(c.dmg), 163);
});

test('상태: 정신 방벽은 공포·혼란을 막고, 깊은 상처는 출혈 피해를 키운다', () => {
  const s = new S.StatusSet();
  s.immune = new Set(['fear', 'confuse']);
  assert.equal(s.apply('fear', 3), false);
  assert.equal(s.has('fear'), false);
  const a = new S.StatusSet(), b = new S.StatusSet();
  a.apply('bleed', 5); b.apply('bleed', 5, 1.6);
  const da = a.step(1, { maxHp: 1000 }), db = b.step(1, { maxHp: 1000 });
  assert.ok(Math.abs(db / da - 1.6) < 1e-9);
});

test('단식: 방을 깨면 잃은 체력의 절반, 출현 가능', () => {
  const k = new RT.PerkRun();
  const me = { hp: 400, hpMax: 1000, baseHp: 1000 };
  k.host = { me, setHpMax() {} };
  k.addTrait('단식');
  k.roomClear();
  assert.equal(me.hp, 700);
  assert.equal(R.traitOk(D.TRAIT_TEXT.find((t) => t.name === '단식'), kit()), true);
  assert.equal(R.traitOk(D.TRAIT_TEXT.find((t) => t.name === '맨몸'), kit()), false);
});
