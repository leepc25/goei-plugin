// 백일몽 포인트 (2026-11-08): 따로 된 장부, 갱신기 포인트 거래 절·검사, 원화와 섞이지 않음
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-points-'));
await build({
  entryPoints: ['src/core/people/updater.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/prompt/index.ts', 'src/core/points.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/${n}.mjs`)));
const U = await mod('people/updater');
const T = await mod('people/types');
const St = await mod('people/settings');
const P = await mod('people/prompt/index');
const Pt = await mod('points');

const settings = () => St.peopleSettings({});
const names = [{ name: '쟈알디', aliases: [], titles: [] }];
const tag = (id) => `[▣|2025.03.02|09:10|맑음|5°C|본사|없음|없음|없음|${id}|140000]`;
const chat = (id) => ({
  scriptstate: {},
  message: [
    ['user', '출근', 'u1'], ['char', `${tag(id)}\n월급날이다.`, 'c1'], ['user', 'x', 'u2'],
    ['char', `${tag(id)}\n이번 달 복지 포인트 1,000p가 들어왔다. 복지몰에서 탈모약을 100포인트에 샀다. 편의점에서 3,000원을 냈다.`, 'c2'],
  ].map(([role, data, chatId]) => ({ role, data, chatId })),
});

test('켜짐: 신분이 백일몽이면, 아니면 지난 포인트 기록이 있을 때만', () => {
  assert.equal(Pt.lastIdentity(chat('백일몽/사원')), '백일몽/사원');
  assert.equal(Pt.pointsOn(chat('백일몽/사원')), true);
  assert.equal(Pt.pointsOn(chat('관리국/요원')), false);
  const c = chat('관리국/요원');
  c.scriptstate = Pt.pointsVars({ start: 0, log: [{ id: 'x', anchor: 'c1', amount: 10, memo: 'm', src: 'story', at: '' }] });
  assert.equal(Pt.pointsOn(c), true);
});

test('포인트 읽기·표기', () => {
  assert.equal(Pt.parsePoints('1,000p'), 1000);
  assert.equal(Pt.parsePoints('1만 포인트'), 10000);
  assert.equal(Pt.parsePoints('-500'), -500);
  assert.equal(Pt.parsePoints('abc'), null);
  assert.equal(Pt.formatPoints(-1200), '−1,200 p');
  assert.ok(Pt.mentionsPoints('복지 포인트 1,000p가'));
  assert.ok(Pt.mentionsPoints('100포인트에'));
  assert.ok(!Pt.mentionsPoints('3,000원을 냈다'));
});

test('갱신기: 포인트 절·자료, 원화 거래와 따로', () => {
  const s = settings();
  const store = T.emptyStore();
  const c = chat('백일몽/사원');
  const input = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names, wallet: 140000, points: 0 });
  assert.deepEqual(input.data.points_now, { balance: 0, unit: 'p' });
  assert.equal(input.points, true);
  assert.equal(input.data.want.point_transactions, true);
  const off = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names, wallet: 140000 });
  assert.equal(off.data.points_now, undefined);
  assert.equal(off.points, false);
  for (const text of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) {
    assert.ok(U.assemblePrompt(text, new Set(['points'])).includes('"point_transactions"'));
    assert.ok(!U.assemblePrompt(text, new Set(['wallet'])).includes('point_transactions'));
  }
  const r = {
    transactions: [{ amount: -3000, memo: '편의점', m: 'm4', quote: '편의점에서 3,000원을 냈다' }],
    point_transactions: [
      { amount: 1000, memo: '복지 포인트', m: 'm4', quote: '복지 포인트 1,000p가 들어왔다' },
      { amount: -100, memo: '탈모약', m: 'm4', quote: '탈모약을 100포인트에 샀다' },
      { amount: -100, memo: '탈모약', m: 'm4', quote: '탈모약을 100포인트에 샀다' },
      { amount: -5, memo: '없는 글', m: 'm4', quote: '원문에 없다' },
    ],
  };
  const rep = U.applyUpdate(store, c, input, r, { settings: s, wallet: true, points: true });
  assert.deepEqual(rep.points.map((e) => [e.amount, e.memo]), [[1000, '복지 포인트'], [-100, '탈모약']]);
  assert.deepEqual(rep.wallet.map((e) => e.amount), [-3000], '원화는 가계부로만');
  const offRep = U.applyUpdate(store, c, input, r, { settings: s, wallet: true, points: false });
  assert.equal(offRep.points.length, 0);
});
