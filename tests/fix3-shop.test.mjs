// 전수검사 11-13 · 상점 고침 점검: 다시 굴리면 산 것·판 것 되살림(shop#4), 같은 가게에 머물 때 지난 턴 사건 되풀이 없음(shop#2·mainreach#1),
// 원이 아닌 대가(gshop#1), 거래 끊기 끔이면 <closed/> 꼴 줄 없음(gshop#13), 머리말 지시를 지침 절로(wording#4)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix3/shop';
await mkdir(dir, { recursive: true });
await build({
  stdin: { contents: "export * from './shop'; export { setGuideOverride, guideDefault } from './guides';", resolveDir: resolve('src/core'), loader: 'ts' },
  outfile: join(dir, 'shop.mjs'), bundle: true, platform: 'node', format: 'esm', loader: { '.txt': 'text' }, logLevel: 'silent',
});
const S = await import(pathToFileURL(join(dir, 'shop.mjs')));

const SHELF = '<shop-identity>\nsells: 공구\nnever: 음식\nprices: 싸다\nprice_range: 1000~50000\n</shop-identity>\n<owner>뭐 찾소.</owner>\n<shelf>\n손전등|18000|사용|flashlight|0.5|LED|비춘다\n생수|1500|소모1|water bottle|0.5|500ml|\n</shelf>';
const msgs = (last) => [{ role: 'user', data: '들어간다', chatId: 'u1' }, { role: 'char', data: last, chatId: 'c1' }];
const src = (st) => ({ st, refs: '', story: '', status: '', situation: '', identity: '', language: null });

/** R1(상점 표식)에서 손전등을 사고 칼을 판 상태 */
function visit() {
  const c = { message: msgs('x\n[shop: 철물점|주인]'), scriptstate: {} };
  let st = S.applyShelf(S.readShop(S.settleShop(c, 1).vars), S.parseShelf(SHELF, null), S.shopSettings({}));
  const lamp = st.items.find((x) => x.name === '손전등');
  st = S.markSold(st, lamp.id, st.key);
  st = S.startSell(st, { itemId: 'i_9', name: '낡은 칼', desc: '', use: false, effect: '' });
  st = S.applyTalk(st, S.parseTalk('<owner>오천.</owner>\n<change mode="none"></change>\n<offer>5000</offer>'));
  st = S.closeSale(st, st.key);
  return { c: { ...c, scriptstate: S.shopVars(st) }, st };
}

test('shop#4: 산·판 응답을 다시 굴리면 진열대·판 것이 되살아난다', () => {
  const { c, st } = visit();
  assert.equal(st.sales[0].k, st.key);
  assert.equal(S.currentShop(c).items.find((x) => x.name === '손전등').sold, true);
  // R1 을 다시 굴림 → 같은 가게 표식의 새 응답 R1'
  const re = { message: [c.message[0], { role: 'char', data: 'y\n[shop: 철물점|주인]', chatId: 'c1b' }], scriptstate: c.scriptstate };
  const next = S.readShop(S.settleShop(re, 1).vars);
  assert.notEqual(next.key, st.key);
  assert.equal(next.items.find((x) => x.name === '손전등').sold, undefined);
  assert.deepEqual(next.sales, []);
  assert.deepEqual(S.shopEvents({ ...re, scriptstate: S.shopVars(next) }), []);
  // 키 없는 산 것(옛 저장분)은 그대로 산 것
  const old = { ...st, items: st.items.map((x) => (x.name === '생수' ? { ...x, sold: true } : x)) };
  assert.equal(S.reviveShop(old, new Set()).items.find((x) => x.name === '생수').sold, true);
});

test('shop#2·mainreach#1: 같은 가게에 머물러도 지난 턴의 판 것·대화는 다시 안 간다', () => {
  const { c } = visit();
  const st1 = S.readShop(c.scriptstate);
  const talked = S.applyTalk(S.sayToOwner(st1, '깎아 줘'), S.parseTalk('<owner>안 돼.</owner>\n<change mode="none"></change>'));
  const c1 = { ...c, scriptstate: S.shopVars(talked) };
  assert.equal(S.shopEvents(c1).length, 2);
  const c2m = [...c1.message, { role: 'user', data: '둘러본다', chatId: 'u2' }, { role: 'char', data: 'z\n[shop: 철물점|주인]', chatId: 'c2' }];
  const r = S.settleShop({ ...c1, message: c2m }, 3);
  assert.deepEqual(S.shopEvents({ message: c2m, scriptstate: { ...c1.scriptstate, ...r.vars } }), []);
});

test('gshop#1: 원이 아닌 대가는 주인 대화 요청에 그 말로 간다', () => {
  const st = { ...S.emptyShop({ raw: '', shop: '기억 가게', owner: '' }, 'k'), loaded: true, items: [{ id: 'a', name: '기억의 병', price: 0, pay: '기억 한 조각', use: true, desc: 'd', effect: 'e' }, { id: 'b', name: '혼합', price: 5000, pay: '피 한 방울', use: true, desc: 'd', effect: 'e' }] };
  const user = S.talkPrompt(src(st), S.shopSettings({})).at(-1).content;
  assert.match(user, /기억의 병\|기억 한 조각\|/);
  assert.match(user, /혼합\|피 한 방울 \+ 5000\|/);
});

test('gshop#13: 거래 끊기가 꺼져 있으면 출력 꼴에 <closed/> 줄이 없다', () => {
  const st = { ...S.emptyShop({ raw: '', shop: '가게', owner: '' }, 'k'), loaded: true };
  const sys = (kick) => S.talkPrompt(src(st), { ...S.shopSettings({}), kick }).map((m) => m.content).join('\n');
  assert.match(sys(true), /<closed\/> only if the owner ends the dealing\./);
  assert.doesNotMatch(sys(false), /<closed\/> only if the owner ends the dealing\./);
});

test('wording#4: 머리말 지시는 지침 절에서, 기본 글은 옛 글 그대로', () => {
  const st = { ...S.emptyShop({ raw: '', shop: '가게', owner: '' }, 'k'), loaded: true, notes: [{ id: 'n', title: '쪽지', price: 1, text: 't' }] };
  const s = { ...src(st), refs: 'R', assign: 'A', orders: 'O' };
  const user = () => S.talkPrompt(s, S.shopSettings({}), 'Cos').at(-1).content;
  const u = user();
  for (const h of ['[참고 자료 — 작중 인물에게 자동 공개되지 않음]\nR', '[이번 진열 배정 — 칸마다 그대로 따를 것]\nA', '[진행 중 맞춤 주문 — 이미 선납됨, 다시 견적 내지 말 것]\nO', '[이번 방문에 내민 정보 쪽지 — 다시 내밀지 말 것]\n']) assert.ok(u.includes(h), h);
  S.setGuideOverride('Cos', S.guideDefault('Cos').replace('[참고 자료 — 작중 인물에게 자동 공개되지 않음]', '[자료 고침]'));
  assert.ok(user().includes('[자료 고침]\nR'));
  // 절이 없으면 옛 글
  S.setGuideOverride('Cos', S.guideDefault('Cos').replace(/\n*@@SECTION HEAD_REFS\n[\s\S]*?\n@@END/, ''));
  assert.ok(user().includes('[참고 자료 — 작중 인물에게 자동 공개되지 않음]\nR'));
  S.setGuideOverride('Cos', null);
  // 홈쇼핑 머리말은 그대로
  assert.ok(S.broadcastMaterial(s, S.shopSettings({})).includes('[참고 자료 — 작중 인물에게 자동 공개되지 않음]\nR'));
});
