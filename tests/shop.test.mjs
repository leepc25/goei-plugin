// 상점 (2026-11-07): 표식 읽기·지우기, 응답 처리(한 방문 한 판·지난 표식 지움), 진열대·대화 응답 해석, 정체 밖 버림, 흥정 값, 거래 끊음, 구입, 다음 턴 사건
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyShelf, applyTalk, currentShop, findShopTag, fitsIdentity, inventoryText, markSold, parseShelf, parseTalk, readShop, sayToOwner, settleShop, shelfItems, shopEvents, shopSettings, shopVars, shortWon, stripShopTags,
} from '../dist-test/core.mjs';

const chat = (last, extra = {}) => ({
  message: [{ role: 'user', data: '들어간다', chatId: 'u1' }, { role: 'char', data: '옛 응답\n[shop: 옛 가게|아무개]', chatId: 'c0' }, { role: 'user', data: '둘러본다', chatId: 'u2' }, { role: 'char', data: last, chatId: 'c1' }],
  scriptstate: { ...extra },
});
const SHELF = '<shop-identity>\nsells: tool, 소모품\nnever: 음식\nprices: 싸다\nprice_range: 1000~50000\n</shop-identity>\n<owner>뭐 찾소.</owner>\n<shelf>\n손전등|18000|tool|LED|비춘다\n부적|30000|charm|종이|\n금괴|9000000|valuable||\n생수|1500|consumable|500ml|\n</shelf>';

test('표식: 마지막 것, 주인 생략 가능, 지우면 줄째', () => {
  assert.deepEqual(findShopTag('글\n[shop: 을지로 철물점|백사헌]'), { raw: '[shop: 을지로 철물점|백사헌]', shop: '을지로 철물점', owner: '백사헌' });
  assert.equal(findShopTag('[shop:편의점]').owner, '');
  assert.equal(findShopTag('[shop: ]'), null);
  assert.equal(stripShopTags('본문\n[shop: 가게|주인]\n[▣|a|b]'), '본문\n[▣|a|b]');
});

test('응답 처리: 새 가게는 새 판, 같은 가게는 그대로, 표식 없으면 비움, 지난 응답 표식은 지움', () => {
  const c = chat('가게다\n[shop: 철물점|주인장]');
  const r = settleShop(c, 3);
  const st = readShop(r.vars);
  assert.equal(st.shop, '철물점');
  assert.equal(st.key, 'c1');
  assert.equal(st.loaded, false);
  assert.equal(r.message[1].data, '옛 응답');
  // 같은 가게: 진열대·대화 유지, 기준만 새 응답
  const loaded = { ...st, loaded: true, items: [{ id: 'a', name: '손전등', desc: '', kind: 'tool', effect: '', price: 1 }], talk: [{ who: 'owner', text: '어서' }] };
  const c2 = { ...c, message: [...c.message, { role: 'user', data: '더 본다', chatId: 'u3' }, { role: 'char', data: '또\n[shop: 철물점]', chatId: 'c2' }], scriptstate: shopVars(loaded) };
  const st2 = readShop(settleShop(c2, 5).vars);
  assert.equal(st2.key, 'c2');
  assert.equal(st2.items.length, 1);
  assert.equal(st2.owner, '주인장');
  // 표식이 없으면 비움
  const c3 = { ...c2, message: [...c2.message, { role: 'user', data: '나간다', chatId: 'u4' }, { role: 'char', data: '나왔다', chatId: 'c3' }] };
  assert.equal(settleShop(c3, 7).vars.$st_shop, '');
  // 마지막 응답의 표식만 현재 상점
  assert.equal(currentShop({ ...c2, scriptstate: shopVars(st2) }).shop, '철물점');
  assert.equal(currentShop({ ...c3, scriptstate: shopVars(st2) }), null);
});

test('진열대 응답: 정체 블록·주인 대사·물건 줄. 정체 밖(종류·값대)은 버린다', () => {
  const r = parseShelf(SHELF, null);
  assert.deepEqual(r.identity.sells, ['tool', 'consumable']);
  assert.equal(r.identity.min, 1000);
  assert.equal(r.identity.max, 50000);
  assert.equal(r.items.length, 4);
  const st0 = readShop(settleShop(chat('x\n[shop: 철물점|주인]'), 3).vars);
  const st = applyShelf(st0, r, shopSettings({}));
  assert.deepEqual(shelfItems(st).map((x) => x.name), ['손전등', '생수']);
  assert.equal(st.talk[0].text, '뭐 찾소.');
  assert.equal(fitsIdentity({ kind: 'tool', price: 100001 }, st.identity), false);
  assert.throws(() => parseShelf('<shelf>\n이름만\n</shelf>', null), /물건 줄/);
  assert.throws(() => parseShelf('<owner>a</owner>\n<shelf>\n손전등|1000|tool||\n</shelf>', null), /shop-identity/);
  // 새로고침: 정체는 그대로, 지난 진열대는 prev 로
  const r2 = parseShelf('<owner></owner>\n<shelf>\n밧줄|5000|tool||\n손전등|18000|tool||\n</shelf>', st.identity);
  const st2 = applyShelf(st, r2, shopSettings({}));
  assert.deepEqual(shelfItems(st2).map((x) => x.name), ['밧줄', '손전등']);
  assert.ok(st2.prev.includes('생수'));
});

test('말하기 응답: 변경 없음 / 일부(추가·값·빼기) / 전체, 거래 끊음은 설정대로', () => {
  const st0 = applyShelf(readShop(settleShop(chat('x\n[shop: 철물점|주인]'), 3).vars), parseShelf(SHELF, null), shopSettings({}));
  const none = parseTalk('<owner>그건 없소.</owner>\n<change mode="none">\n</change>');
  assert.equal(none.mode, 'none');
  const part = parseTalk('<owner>천 원 빼 주지. 밧줄도 있고.</owner>\n<change mode="partial">\n~ 손전등|17000\n+ 밧줄|5000|tool|10m|\n+ 라면|2000|food||\n- 생수\n</change>');
  const st1 = applyTalk(sayToOwner(st0, '깎아 줘'), part);
  const fl = shelfItems(st1).find((x) => x.name === '손전등');
  assert.equal(fl.price, 17000);
  assert.equal(fl.orig, 18000);
  assert.deepEqual(shelfItems(st1).map((x) => x.name), ['손전등', '밧줄']); // 라면(food)은 정체 밖, 생수는 뺌
  assert.equal(st1.talk.at(-2).who, 'me');
  const all = parseTalk('<owner>싹 바꿨소.</owner>\n<change mode="all">\n망치|12000|tool||\n</change>');
  assert.deepEqual(shelfItems(applyTalk(st1, all)).map((x) => x.name), ['망치']);
  const closed = parseTalk('<owner>나가쇼.</owner>\n<change mode="none"></change>\n<closed/>');
  assert.equal(applyTalk(st1, closed).closed, true);
  assert.equal(applyTalk(st1, closed, false).closed, false);
  assert.throws(() => parseTalk('<change mode="none"></change>'), /owner/);
});

test('구입·다음 턴 사건·값 표기', () => {
  let st = applyShelf(readShop(settleShop(chat('x\n[shop: 철물점|주인]'), 3).vars), parseShelf(SHELF, null), shopSettings({}));
  const id = shelfItems(st)[0].id;
  st = markSold(st, id);
  assert.equal(shelfItems(st).length, 1);
  assert.equal(markSold(st, id), st);
  const c = chat('x\n[shop: 철물점|주인]', shopVars({ ...st, closed: true, talk: [...st.talk, { who: 'me', text: '야' }, { who: 'owner', text: '나가' }] }));
  assert.match(shopEvents(c)[0], /refused service.*철물점/);
  assert.match(inventoryText(c), /\[shop: 가게 이름\|주인 이름\]/);
  assert.equal(shopEvents(chat('x', shopVars(st))).length, 0);
  assert.equal(shortWon(1538000), '1,538,000');
  assert.equal(shortWon(120000000), '1.2억');
  assert.equal(shortWon(0), '0');
});
