// 가계부 거래 (설계안 8절): 갱신기 자료·절·검사 — 금액이 적힌 거래만, 인용 필수, 끄면 절도 자료도 없음
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-wallet-'));
await build({
  entryPoints: ['src/core/people/updater.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/prompt/index.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const U = await mod('updater');
const T = await mod('types');
const St = await mod('settings');
const P = await mod('prompt/index');

const settings = (over = {}) => ({ ...St.peopleSettings({}), ...over });
const person = (name, faction = 'A00') => ({ name, faction, seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [] });
const names = [{ name: '쟈알디', aliases: [], titles: [] }];
const c = {
  scriptstate: { $st_faction: 'A00' },
  message: [
    ['user', '출근', 'u1'], ['char', '쟈알디가 커피를 사 왔다.', 'c1'], ['user', 'x', 'u2'],
    ['char', '택시비 15,000원을 카드로 냈다. 쟈알디가 "다음엔 내가 낼게" 하고 웃었다. 편의점에서 3만 원짜리 상품권을 받았다.', 'c2'],
  ].map(([role, data, chatId]) => ({ role, data, chatId })),
};

test('자료·절: 잔고가 있으면 wallet_now 와 거래 절, 없으면 둘 다 없음', () => {
  const s = settings();
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const on = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names, wallet: 1230000 });
  assert.deepEqual(on.data.wallet_now, { balance: 1230000, unit: 'KRW' });
  assert.equal(on.wallet, true);
  assert.equal(on.data.want.transactions, true);
  const off = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names });
  assert.equal(off.data.wallet_now, undefined);
  assert.equal(off.wallet, false);
  for (const [kind, text] of [['detailed', P.UPDATER_DETAILED], ['compact', P.UPDATER_COMPACT]]) {
    const withW = U.assemblePrompt(text, new Set(['wallet']));
    const without = U.assemblePrompt(text, new Set());
    assert.ok(withW.includes('"transactions"') && withW.includes('wallet_now'), `${kind}: 거래 절`);
    assert.ok(!without.includes('"transactions"'), `${kind}: 끄면 없음`);
  }
});

test('검사: 금액·인용·확정 구간, 같은 거래 중복, 한국어 금액', () => {
  const s = settings();
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const input = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names, wallet: 1230000 });
  const r = {
    transactions: [
      { amount: -15000, memo: '택시비', m: 'm4', quote: '택시비 15,000원을 카드로 냈다' },
      { amount: '-15000', memo: '택시비', m: 'm4', quote: '택시비 15,000원을 카드로 냈다' },
      { amount: 30000, memo: '상품권', m: 'm4', quote: '3만 원짜리 상품권을 받았다' },
      { amount: -4000, memo: '커피', m: 'm2', quote: '쟈알디가 커피를 사 왔다' },
      { amount: -5000, memo: '없는 글', m: 'm4', quote: '이 글은 원문에 없다' },
      { amount: 'approximately', memo: '못 읽음', m: 'm4', quote: '택시비 15,000원을' },
      { amount: 0, memo: '0원', m: 'm4', quote: '택시비 15,000원을' },
    ],
  };
  const rep = U.applyUpdate(store, c, input, r, { settings: s, wallet: true });
  assert.deepEqual(rep.wallet.map((e) => [e.anchor, e.amount, e.memo]), [['c2', -15000, '택시비'], ['c2', 30000, '상품권']]);
  assert.equal(rep.applied.transactions, 2);
  const reasons = rep.dropped.filter((d) => d.kind === 'wallet').map((d) => d.reason);
  assert.ok(reasons.includes('같은 거래 중복'));
  assert.ok(reasons.includes('인용이 원문에 없음'));
  assert.ok(reasons.includes('금액을 읽을 수 없음'));
  assert.ok(reasons.some((x) => /확정 구간|인용/.test(x)), '맥락 구간(m2)의 커피는 버림');
  const offRep = U.applyUpdate(store, c, input, r, { settings: s, wallet: false });
  assert.equal(offRep.wallet.length, 0, '끄면 아무것도 안 받음');
  const parsed = U.parseUpdate('```json\n{"transactions":[{"amount":-1,"m":"m4","quote":"q"}]}\n```');
  assert.equal(parsed.transactions.length, 1);
});
