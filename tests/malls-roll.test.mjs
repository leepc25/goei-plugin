// 우주 쇼핑몰 진열 배정·시그니처 상품 (11-09 사용자: 하드코딩 금지 — 전부 설정에서). core/malls.ts 만 묶어서 본다
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export * from './src/core/malls'; export { appendItems, dropItemsNamed, emptyShop } from './src/core/shop';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

/** 정해진 수열을 내는 난수 (시험용) */
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

test('진열 배정: 기본값은 장르 20종·등급 5단계, 칸마다 다른 장르, 등급 구간이 글에 들어간다', () => {
  const r = M.cosRoll({});
  assert.equal(r.on, true);
  assert.equal(r.genres.length, 20);
  assert.equal(r.tiers.length, 5);
  assert.equal(r.useful, 'auto');
  const text = M.cosAssignment(5, true, r, seq(0.1, 0.5, 0.9, 0.3, 0.7));
  const lines = text.split('\n').filter((l) => l.startsWith('Item '));
  assert.equal(lines.length, 5);
  const genres = lines.map((l) => /GENRE: ([^|]+) \|/.exec(l)[1].trim());
  assert.equal(new Set(genres).size, 5, '장르가 겹치지 않는다');
  assert.ok(lines.every((l) => /VALUE TIER: \S+ \(.+\), price ₩[\d,]+-[\d,]+/.test(l)), '등급 이름·설명·구간');
  assert.ok(lines.some((l) => l.includes('ROLE: useful')), '컨텍스트 켬 → 상황용 칸');
  assert.ok(lines.some((l) => l.includes('ROLE: broad stock')));
});

test('진열 배정: 끄면 빈 글, 상황용 칸 수는 설정대로, 장르·등급은 글로 고친다', () => {
  assert.equal(M.cosAssignment(5, true, M.cosRoll({ $cos_roll_on: '0' })), '');
  const none = M.cosAssignment(5, true, M.cosRoll({ $cos_roll_useful: '0' }));
  assert.ok(!none.includes('ROLE:'), '상황용 없음이면 역할 칸이 없다');
  const two = M.cosAssignment(4, false, M.cosRoll({ $cos_roll_useful: '2' }));
  assert.equal((two.match(/ROLE: useful/g) ?? []).length, 2, '컨텍스트가 꺼져 있어도 설정이 2칸이면 2칸');
  const r = M.cosRoll({ $cos_roll_genres: '요리, 원예,요리', $cos_roll_tiers: '싼것|cheap|1000|2000\n비싼것|dear|5000|9000\n이상한줄\n거꾸로|x|9|1' });
  assert.deepEqual(r.genres, ['요리', '원예'], '쉼표로 나누고 중복은 뺀다');
  assert.deepEqual(r.tiers.map((t) => [t.name, t.lo, t.hi]), [['싼것', 1000, 2000], ['비싼것', 5000, 9000]], '이상한 줄·거꾸로 된 구간은 버린다');
  assert.equal(M.tiersText(M.parseTiers(M.tiersText(M.COS_TIERS_DEFAULT))), M.tiersText(M.COS_TIERS_DEFAULT), '글 ↔ 값 왕복');
  const t = M.cosAssignment(3, false, r, seq(0.2));
  assert.ok(t.includes('GENRE: 요리') && t.includes('GENRE: 원예'), '장르가 칸보다 적으면 돌려 쓴다');
  assert.ok(M.cosRollChanged({ $cos_roll_genres: 'a' }) && !M.cosRollChanged({}));
});

test('시그니처 상품: 기본값은 구버전 둘, 글로 저장·읽기, 확률대로 끼우고 모델이 낸 같은 이름은 버린다', () => {
  const def = M.cosFixed({});
  assert.deepEqual(def.map((f) => f.name), ['우리가 도움!', '착한 친구']);
  assert.equal(def[1].was, 44_444_444);
  assert.deepEqual(M.cosFixed({ $cos_fixed: '[]' }), [], '다 지우면 없음');
  assert.deepEqual(M.cosFixed({ $cos_fixed: 'broken' }).length, 2, '깨진 글이면 기본값');
  const mine = [{ ...M.newCosFixed(), name: '은화 뱀', price: 3_000_000, pct: 100 }, { ...def[0], pct: 0 }];
  const back = M.cosFixed(M.cosFixedVars(mine));
  assert.equal(back[0].name, '은화 뱀');
  assert.deepEqual(M.cosFixedRoll(back, () => 0.5).map((f) => f.name), ['은화 뱀'], '확률 100은 들어가고 0은 안 들어간다');
  assert.deepEqual(M.cosFixedRoll([{ ...mine[0], on: false }]), [], '끈 것은 안 들어간다');
  // 진열대에 붙이기: 모델이 낸 같은 이름은 빠지고, 이미 진열된 것은 다시 안 붙는다
  let st = M.emptyShop({ raw: '', shop: '우주 쇼핑몰', owner: '운영자' }, 'k');
  st = { ...st, loaded: true, items: [{ id: 'a', name: '은화뱀', desc: '', effect: '', use: false, price: 1 }, { id: 'b', name: '손전등', desc: '', effect: '', use: false, price: 2 }], prev: ['은화 뱀', '손전등'] };
  st = M.dropItemsNamed(st, ['은화 뱀']);
  assert.deepEqual(st.items.map((x) => x.name), ['손전등']);
  assert.deepEqual(st.prev, ['손전등'], '지난 목록에서도 뺀다 (모델이 「피할 이름」으로도 못 보게)');
  st = M.appendItems(st, [{ name: '은화 뱀', desc: '', effect: '', use: false, price: 3_000_000 }]);
  assert.deepEqual(st.items.map((x) => x.name), ['손전등', '은화 뱀']);
  const again = M.appendItems(st, [{ name: '은화 뱀', desc: '', effect: '', use: false, price: 3_000_000 }]);
  assert.equal(again.items.length, 2, '이미 있으면 또 안 붙는다');
});

test('추첨 방식: 장르 겹침·통일, 등급 가중치·골고루·통일, 가중치 0은 안 뽑힌다 (11-09 사용자: 추첨 방식도 설정에서)', () => {
  const base = { $cos_roll_genres: 'a,b,c', $cos_roll_tiers: 'L|low|1|2|1\nH|high|3|4|0' };
  const one = M.cosRoll({ ...base, $cos_roll_gmode: 'one', $cos_roll_tmode: 'same' });
  assert.equal(one.gmode, 'one'); assert.equal(one.tmode, 'same');
  const d1 = M.cosDraw(4, false, one);
  assert.equal(new Set(d1.map((s) => s.genre)).size, 1, '한 장르로');
  assert.ok(d1.every((s) => s.tier.name === 'L'), '가중치 0 등급은 안 뽑히고, 한 등급으로');
  const any = M.cosRoll({ ...base, $cos_roll_gmode: 'any' });
  assert.equal(M.cosDraw(3, false, any, seq(0.1, 0.1, 0.1, 0.1, 0.1, 0.1)).filter((s) => s.genre === 'a').length, 3, '겹쳐도 됨 → 같은 장르 셋');
  const even = M.cosRoll({ $cos_roll_tmode: 'even' });
  const d3 = M.cosDraw(5, false, even);
  assert.equal(new Set(d3.map((s) => s.tier.name)).size, 5, '골고루 → 5칸에 5등급 전부');
  assert.equal(M.cosRoll({}).gmode, 'uniq'); assert.equal(M.cosRoll({}).tmode, 'weight');
  assert.equal(M.parseTiers('x|y|1|2')[0].w, 1, '가중치 비우면 1');
  assert.ok(M.tiersText(M.COS_TIERS_DEFAULT).endsWith('|1'), '글에 가중치가 붙는다');
});
