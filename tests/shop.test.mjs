// 상점 (2026-11-07): 표식 읽기·지우기, 응답 처리(한 방문 한 판·지난 표식 지움), 진열대·대화 응답 해석(쓰임·그림 칸), 흥정 값, 거래 끊음, 구입, 다음 턴 사건
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyShelf, applyTalk, cancelSell, closeSale, currentShop, findShopTag, inventoryText, markSold, parseShelf, parseTalk, readShop, sayToOwner, settleShop, shelfItems, shopEvents, shopSettings, shopVars, shortWon, startSell, stripShopTags, talkPrompt, shelfPrompt,
} from '../dist-test/core.mjs';

const chat = (last, extra = {}) => ({
  message: [{ role: 'user', data: '들어간다', chatId: 'u1' }, { role: 'char', data: '옛 응답\n[shop: 옛 가게|아무개]', chatId: 'c0' }, { role: 'user', data: '둘러본다', chatId: 'u2' }, { role: 'char', data: last, chatId: 'c1' }],
  scriptstate: { ...extra },
});
const SHELF = '<shop-identity>\nsells: 공구, 소모품\nnever: 음식\nprices: 싸다\nprice_range: 1000~50000\n</shop-identity>\n<owner>뭐 찾소.</owner>\n<shelf>\n손전등|18000|사용|flashlight|0.5|LED|비춘다\n부적|30000|소모3|talisman|0.5|종이|\n쇠파이프|9000|무기·사용|iron pipe|0.5||\n생수|1500|소모1|water bottle|0.5|500ml|\n</shelf>';

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
  const loaded = { ...st, loaded: true, items: [{ id: 'a', name: '손전등', desc: '', use: true, effect: '', price: 1 }], talk: [{ who: 'owner', text: '어서' }] };
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

test('진열대 응답: 정체 블록·주인 대사·물건 줄(쓰임·그림 칸). 값은 거르지 않음', () => {
  const r = parseShelf(SHELF, null);
  assert.equal(r.items[0].weight, 0.5, '무게 칸 (11-08)');
  assert.equal(r.identity.sells, '공구, 소모품');
  assert.equal(r.identity.prices, '싸다');
  assert.equal('min' in r.identity || 'max' in r.identity, false, '값대 숫자는 받지 않음(옛 응답에 price_range 줄이 있어도 무시)');
  assert.equal(r.items.length, 4);
  const st0 = readShop(settleShop(chat('x\n[shop: 철물점|주인]'), 3).vars);
  const st = applyShelf(st0, r, shopSettings({}));
  assert.deepEqual(shelfItems(st).map((x) => x.name), ['손전등', '부적', '쇠파이프', '생수']);
  const by = (n) => shelfItems(st).find((x) => x.name === n);
  assert.deepEqual([by('손전등').use, by('손전등').uses, by('손전등').equip, by('손전등').icon, by('손전등').desc, by('손전등').effect], [true, undefined, undefined, 'flashlight', 'LED', '비춘다']);
  assert.deepEqual([by('부적').use, by('부적').uses], [true, 3]);
  assert.deepEqual([by('쇠파이프').equip, by('쇠파이프').use], ['weapon', true]);
  assert.equal(st.talk[0].text, '뭐 찾소.');
  assert.throws(() => parseShelf('<shelf>\n이름만\n</shelf>', null), /물건 줄/);
  assert.throws(() => parseShelf('<owner>a</owner>\n<shelf>\n손전등|1000|사용||0.5||\n</shelf>', null), /shop-identity/);
  // 새로고침: 정체는 그대로, 지난 진열대는 prev 로
  const r2 = parseShelf('<owner></owner>\n<shelf>\n밧줄|5000|사용|rope|0.5||\n손전등|18000|사용||0.5||\n</shelf>', st.identity);
  const st2 = applyShelf(st, r2, shopSettings({}));
  assert.deepEqual(shelfItems(st2).map((x) => x.name), ['밧줄', '손전등']);
  assert.ok(st2.prev.includes('생수'));
});

test('말하기 응답: 변경 없음 / 일부(추가·값·빼기) / 전체, 거래 끊음은 설정대로', () => {
  const st0 = applyShelf(readShop(settleShop(chat('x\n[shop: 철물점|주인]'), 3).vars), parseShelf(SHELF, null), shopSettings({}));
  const none = parseTalk('<owner>그건 없소.</owner>\n<change mode="none">\n</change>');
  assert.equal(none.mode, 'none');
  const part = parseTalk('<owner>천 원 빼 주지. 밧줄도 있고.</owner>\n<change mode="partial">\n~ 손전등|17000\n+ 밧줄|5000|사용|rope|0.5|10m|\n- 생수\n- 부적\n- 쇠파이프\n</change>');
  const st1 = applyTalk(sayToOwner(st0, '깎아 줘'), part);
  const fl = shelfItems(st1).find((x) => x.name === '손전등');
  assert.equal(fl.price, 17000);
  assert.equal(fl.orig, 18000);
  assert.deepEqual(shelfItems(st1).map((x) => x.name), ['손전등', '밧줄']);
  assert.equal(st1.talk.at(-2).who, 'me');
  const all = parseTalk('<owner>싹 바꿨소.</owner>\n<change mode="all">\n망치|12000|무기·사용|hammer|0.5||\n</change>');
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
  assert.equal(shelfItems(st).length, 3);
  assert.equal(markSold(st, id), st);
  const c = chat('x\n[shop: 철물점|주인]', shopVars({ ...st, closed: true, talk: [...st.talk, { who: 'me', text: '야' }, { who: 'owner', text: '나가' }] }));
  assert.match(shopEvents(c)[0], /refused service.*철물점/);
  assert.match(inventoryText(c), /\[shop: 가게 이름\|주인 이름\]/);
  assert.equal(shopEvents(chat('x', shopVars(st))).length, 0);
  assert.equal(shortWon(1538000), '1,538,000');
  assert.equal(shortWon(120000000), '1.2억');
  assert.equal(shortWon(0), '0');
});

test('팔기: 제안 읽기(offer·~줄), 값대 넘어도 그대로, 흥정하면 처음 값 남음, 거절, 확정·그만, 다음 턴 사건, 요청문에 팔 물건', () => {
  const st0 = applyShelf(readShop(settleShop(chat('x\n[shop: 철물점|주인]'), 3).vars), parseShelf(SHELF, null), shopSettings({}));
  const mine = { itemId: 'i_1', name: '낡은 손전등', desc: '흠집', use: true, effect: '', paid: 18000 };
  let st = sayToOwner(startSell(st0, mine), '[판매: 낡은 손전등]');
  assert.equal(st.sell.price, undefined);
  assert.match(talkPrompt({ st, refs: '', story: '', status: '', situation: '', identity: '', language: null }, shopSettings({})).at(-1).content, /팔려는 물건[\s\S]*낡은 손전등\|사용/);
  // 새로고침 요청에도 이번 방문 대화 전부
  { const re = shelfPrompt({ st: { ...st, loaded: true }, refs: '', story: '', status: '', situation: '', identity: '', language: null }, shopSettings({})).at(-1).content;
    assert.match(re, /\[이번 방문 대화\][\s\S]*\[주인공\] \[판매: 낡은 손전등\]/); }
  // 값은 모델 판단: 물건 가치를 종합해 적정 값을 정하라는 지시
  { const sys = talkPrompt({ st, refs: '', story: '', status: '', situation: '', identity: '', language: null }, shopSettings({})).map((m) => m.content).join('\n');
    assert.match(sys, /real worth as a whole/); assert.match(sys, /No program checks the figure/); }
  const r1 = parseTalk('<owner>만 이천 주지.</owner>\n<change mode="none"></change>\n<offer>12,000원</offer>');
  assert.equal(r1.offer, 12000);
  st = applyTalk(st, r1);
  assert.equal(st.sell.price, 12000);
  assert.equal(st.sell.first, undefined);
  // 흥정: ~ 줄로도 받는다. 처음 값이 남는다
  st = applyTalk(sayToOwner(st, '[판매: 낡은 손전등] 만오천은 줘야지'), parseTalk('<owner>만 사천.</owner>\n<change mode="partial">\n~ 낡은 손전등|14000\n</change>'));
  assert.equal(st.sell.price, 14000);
  assert.equal(st.sell.first, 12000);
  // 값대를 크게 넘어도 모델이 부른 값 그대로 (사용자 11-07: 프로그램이 거르지 않음)
  assert.equal(applyTalk(st, parseTalk('<owner>백만.</owner>\n<change mode="none"></change>\n<offer>1000000</offer>')).sell.price, 1000000);
  assert.equal(parseTalk('<owner>안 사.</owner>\n<change mode="none"></change>\n<offer>none</offer>').offer, null);
  assert.equal(parseTalk('<owner>응.</owner>\n<change mode="none"></change>').offer, undefined);
  // 확정 → 판 것 목록, 팔기 비움. 값 없으면 못 함
  assert.equal(closeSale(cancelSell(st)), null);
  const done = closeSale(st);
  assert.deepEqual(done.sales, [{ name: '낡은 손전등', price: 14000 }]);
  assert.equal(done.sell, null);
  assert.match(shopEvents(chat('x\n[shop: 철물점|주인]', shopVars(done)))[0], /just sold 낡은 손전등 \(14,000 won\)/);
  // 거래 끊기면 팔기도 비움
  assert.equal(applyTalk(st, parseTalk('<owner>나가.</owner>\n<change mode="none"></change>\n<closed/>')).sell, null);
});

// 2026-11-07 사용자: 희귀는 단 하나·따로 화려한 칸, 특가는 원래 값에 줄 긋기, 분량은 최소·최대
test('구분: 희귀 단 하나(둘째부터 보통), 특가는 원래 값이 더 클 때만, 분량 최소·최대·옛 구간', () => {
  const raw = '<shop-identity>\nsells: tool\nnever: x\nprices: 싸다\nprice_range: 1000~50000\n</shop-identity>\n<owner>자.</owner>\n<shelf>\n황동 나침반|900000|사용|compass|0.5|괴이를 가리킨다||희귀\n은 손전등|200000|사용||0.5|||레어\n줄자|3000|사용||0.5|||특가:5000\n망치|9000|무기||0.5|||특가:8000\n끌|4000|-||0.5|||할인：6,000원\n</shelf>';
  const st0 = { key: 'k', shop: '가게', owner: '주인', raw: '', identity: { sells: '', never: '', prices: '' }, loaded: false, items: [], talk: [], prev: [], sales: [], closed: false, sell: null };
  const st = applyShelf(st0, parseShelf(raw, null), shopSettings({}));
  const by = (n) => st.items.find((x) => x.name === n);
  assert.equal(by('황동 나침반').tag, 'rare', '희귀는 값대 두 배를 넘어도 남는다');
  assert.equal(by('은 손전등').tag, undefined, '둘째 희귀는 보통 물건으로 남는다(값은 거르지 않음)');
  assert.deepEqual([by('줄자').tag, by('줄자').was], ['sale', 5000]);
  assert.equal(by('망치').tag, undefined, '원래 값이 더 싸면 특가 아님');
  assert.deepEqual([by('끌').tag, by('끌').was], ['sale', 6000]);
  // 대화로 더한 희귀: 이미 희귀가 있으면 보통으로
  const t = applyTalk(st, parseTalk('<owner>하나 더.</owner>\n<change mode="partial">\n+ 금빛 끌|9000|-||0.5|||희귀\n</change>'));
  assert.equal(t.items.filter((x) => x.tag === 'rare').length, 1);
  // 주인도 안다: 대화 요청의 진열대 줄에 구분이 실리고, 지침이 그 뜻을 알려 준다
  const talk = talkPrompt({ st, refs: '', story: '', status: '', situation: '', identity: '', language: null }, shopSettings({})).map((m) => m.content).join('\n');
  assert.match(talk, /황동 나침반\|900000\|사용\|compass\|0\.5\|[^\n]*\|희귀/);
  assert.match(talk, /줄자\|3000\|사용\|[^\n]*\|특가:5000/);
  assert.match(talk, /「희귀」 marks the one rare piece/);
  assert.doesNotMatch(talkPrompt({ st, refs: '', story: '', status: '', situation: '', identity: '', language: null }, shopSettings({ $sh_feature: '0' })).map((m) => m.content).join('\n'), /「희귀」 marks/);
  assert.deepEqual(shopSettings({}).size, [5, 8], '기본 5~8');
  assert.deepEqual(shopSettings({ $sh_count: '2' }).size, [8, 12], '옛 구간은 그대로 읽는다');
  assert.deepEqual(shopSettings({ $sh_count: '2', $sh_min: '4', $sh_max: '10' }).size, [4, 10]);
  assert.deepEqual(shopSettings({ $sh_min: '9', $sh_max: '3' }).size, [3, 9], '거꾸로 적혀도 작은 쪽이 최소');
  assert.equal(shopSettings({}).feature, true);
  assert.equal(shopSettings({ $sh_feature: '0' }).feature, false);
});

test('원이 아닌 값 (2026-11-08 사용자): 값 칸 글은 대가, 원과 섞으면 +, 흥정으로 다른 대가가 붙음, 다음 턴 「무엇으로 치르고 샀다」', async () => {
  const { costOf, boughtLine } = await import('../dist-test/core.mjs');
  assert.deepEqual(costOf('18000'), { price: 18000 });
  assert.deepEqual(costOf('3만 원'), { price: 30000 });
  assert.deepEqual(costOf('왼손 새끼손가락'), { price: 0, pay: '왼손 새끼손가락' });
  assert.deepEqual(costOf('피 400ml'), { price: 0, pay: '피 400ml' }, '숫자가 섞인 글은 원으로 읽지 않음');
  assert.deepEqual(costOf('5000 + 어제 기억'), { price: 5000, pay: '어제 기억' });
  const r = parseShelf('<shop-identity>\nsells: 아무거나\nnever: -\nprices: 신체 부위만\n</shop-identity>\n<owner>띵동!</owner>\n<shelf>\n그림자 가위|허벅지 살 100g|무기|scissors|날붙이||희귀\n컵라면|머리카락 한 줌|소모1|cup noodle|매운맛||특가:5000\n</shelf>', null);
  assert.equal(r.items[0].pay, '허벅지 살 100g');
  assert.equal(r.items[0].price, 0);
  assert.equal(r.items[1].tag, undefined, '원이 아닌 값에는 특가 딱지 없음');
  // 흥정: 원 값 → 다른 대가
  const st0 = applyShelf({ shop: '철물점', owner: '', key: 'c1', loaded: false, identity: { sells: '', never: '', prices: '' }, items: [], talk: [], closed: false, prev: [], sell: null, sales: [] }, parseShelf(SHELF, null), shopSettings({}));
  const t = parseTalk('<owner>돈 없으면 피라도 주쇼.</owner>\n<change mode="partial">\n~ 손전등|피 200ml\n</change>');
  assert.deepEqual(t.reprice, [{ name: '손전등', price: 0, pay: '피 200ml' }]);
  const st1 = applyTalk(st0, t);
  const fl = st1.items.find((x) => x.name === '손전등');
  assert.equal(fl.pay, '피 200ml');
  assert.equal(fl.price, 0);
  assert.equal(fl.orig, 18000, '흥정 표시');
  assert.equal(boughtLine({ name: '손전등', paidWith: '피 200ml', price: 0 }), '손전등 (paid with 피 200ml)');
  assert.equal(boughtLine({ name: '부적', paidWith: '어제 기억', price: 5000 }), '부적 (paid with 어제 기억 + 5,000 won)');
  assert.equal(boughtLine({ name: '생수', price: 1500 }), '생수');
});
