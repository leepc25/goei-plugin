// 상점 판단 (11-09 사용자): 메인 모델/갱신기 고르기, 판단 기준은 한 곳(SHOP_RULE)을 양쪽이 같이, 고유 상점 표(인터넷 접속 → 그 사이트)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { settleShop, readShop, shopGuide, shopRule, shopJudgeBy, ownShops, ownShopOf, webSiteOfOwner, SHOP_OWN_VAR, findShopTag } from '../dist-test/core.mjs';

const dir = await mkdtemp(join(tmpdir(), 'goei-shop-judge-'));
await build({
  entryPoints: ['src/core/people/store.ts', 'src/core/people/updater.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/prompt/index.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const U = await mod('updater');
const T = await mod('types');
const St = await mod('settings');
const P = await mod('prompt/index');
const { messageHash } = await mod('store');

test('누가 판단하나: 자동은 갱신기가 매 턴 돌면 갱신기, 갱신기를 골랐는데 안 돌면 메인이 대신', () => {
  assert.deepEqual(shopJudgeBy({}), { pick: 'auto', by: 'updater', fallback: false });
  assert.equal(shopJudgeBy({ $pp_when: 'manual' }).by, 'main');
  assert.equal(shopJudgeBy({ $pp_on: '0' }).by, 'main');
  assert.deepEqual(shopJudgeBy({ $sh_judge: 'updater', $pp_on: '0' }), { pick: 'updater', by: 'main', fallback: true });
  assert.equal(shopJudgeBy({ $sh_judge: 'main' }).by, 'main');
  // 본편 표식 지침은 메인이 판단할 때만, 그 안에 공용 기준이 그대로
  assert.equal(shopGuide({}), '');
  const g = shopGuide({ $sh_judge: 'main' });
  assert.ok(g.includes(shopRule({ $sh_judge: 'main' })), '본편 지침 = 공용 기준을 품음');
  assert.ok(/own shop, or one they work at/.test(shopRule({})));
});

test('공용 기준에 켜진 고유 상점만 들어가고, 다른 이름·여는 방식이 붙는다', () => {
  const r = shopRule({});
  assert.ok(r.includes('우주 쇼핑몰 — online or in person'));
  assert.ok(r.includes('백일몽 포인트몰 (also 포인트몰, 복지몰) — online only'));
  assert.ok(/name in talk, a rumour, an ad/.test(r), '언급만으로는 안 연다');
  const none = shopRule({ [SHOP_OWN_VAR]: '[]' });
  assert.ok(!none.includes('Shops with their own screen'));
  const off = ownShops({ [SHOP_OWN_VAR]: JSON.stringify([{ id: 'x', on: false, name: '망상홈쇼핑', alias: '', web: '', visit: 'shop' }]) });
  assert.equal(off[0].name, '망상홈쇼핑');
  assert.equal(ownShopOf({}, '복지몰').id, 'bm');
});

test('고유 상점 표식: 인터넷 접속이면 사이트 표식으로 바꾸고 방문은 열지 않음, 직접 가면 창 설정대로', () => {
  const chat = (tag, vars = {}) => ({ message: [{ role: 'user', data: 'x', chatId: 'u1' }, { role: 'char', data: `본문\n${tag}`, chatId: 'c1' }], scriptstate: vars });
  const web = settleShop(chat('[shop: 우주쇼핑몰|@web]'), 1);
  assert.equal(findShopTag(web.message[1].data).owner, '@web:cos');
  assert.equal(webSiteOfOwner('@web:cos'), 'cos');
  assert.equal(readShop(web.vars)?.shop ?? '', '', '기본 상점 방문은 열지 않음');
  // 직접 간 팝업스토어 = 기본 상점창
  assert.equal(readShop(settleShop(chat('[shop: 우주 쇼핑몰|]'), 1).vars).shop, '우주 쇼핑몰');
  // 포인트몰은 직접 가면 열지 않음, 표에 없는 사이트 접속도 지움
  for (const t of ['[shop: 백일몽 포인트몰|]', '[shop: 아무 몰|@web]']) {
    const r = settleShop(chat(t), 1);
    assert.ok(!r?.message?.[1]?.data.includes('[shop:'), t);
  }
  // 편의점은 표와 상관없이 그대로
  assert.equal(readShop(settleShop(chat('[shop: 편의점|]'), 1).vars).shop, '편의점');
  // 같은 표식을 다시 정리해도 바뀌지 않는다
  assert.equal(settleShop({ ...chat('x'), message: web.message, scriptstate: web.vars }, 1), null);
});

test('읽음 해시는 상점 표식을 보지 않는다 (지난 응답 표식을 지워도·갱신기가 붙여도 「안 읽음」이 안 생김)', () => {
  assert.equal(messageHash({ role: 'char', data: '본문' }), messageHash({ role: 'char', data: '본문\n[shop: 편의점|]' }));
});

test('갱신기: 맡긴 응답에만 shop_check, 지침에 상점 절, 결과는 가게 하나 또는 없음', () => {
  const s = { ...St.peopleSettings({}) };
  const store = T.emptyStore();
  const c = { scriptstate: {}, message: [['user', '들어간다', 'u1'], ['char', '편의점 문을 열고 들어갔다. 점원이 인사했다.', 'c1']].map(([role, data, chatId]) => ({ role, data, chatId })) };
  const input = U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names: [], shop: { at: 1, self: ['마덕희', ''] } });
  assert.deepEqual(input.data.shop_check, { m: 'm2', protagonist: ['마덕희'] });
  assert.equal(input.data.want.shop, true);
  assert.deepEqual(input.shop, { m: 'm2' });
  const off = U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names: [] });
  assert.equal(off.data.shop_check, undefined);
  assert.equal(off.shop, null);
  for (const text of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) {
    const on = U.assemblePrompt(text, new Set(['shop']));
    assert.ok(on.includes('<<SHOP_RULE>>') && on.includes('<<SHOP_JUDGE>>') && on.includes('"shop"'));
    assert.ok(!U.assemblePrompt(text, new Set()).includes('"shop"'));
  }
  const yes = U.applyUpdate(store, c, input, { shop: { name: '편의점', owner: '', m: 'm2' } }, { settings: s });
  assert.deepEqual(yes.shop, { index: 1, name: '편의점', owner: '' });
  const no = U.applyUpdate(store, c, input, { shop: null }, { settings: s });
  assert.equal(no.shop, null);
  const notAsked = U.applyUpdate(store, c, off, { shop: { name: '편의점', m: 'm2' } }, { settings: s });
  assert.equal(notAsked.shop, undefined);
});
