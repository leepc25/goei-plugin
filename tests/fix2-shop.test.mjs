// 전수검사 11-13: 상점(core/shop.ts) 고침 — 이번 턴 것만 본편에, 다시 굴려도 대화·쫓겨남 유지, 값 칸·줄 읽기, 우주몰 문의 진실 칸, 표식 줄 넘김, <deal/> 오판, 납기 단위, 포인트 통화
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix2/shop';
await mkdir(dir, { recursive: true });
const file = `${dir}/shop-${process.pid}.mjs`;
await build({ stdin: { contents: `export * from './src/core/shop';`, resolveDir: process.cwd() }, outfile: file, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
const M = await import(pathToFileURL(file).href);

const SHELF = '<shop-identity>\nsells: 공구\nnever: 음식\nprices: 싸다\ncurrency: won\n</shop-identity>\n<owner>뭐 찾소.</owner>\n<shelf>\n손전등|18000|사용|flashlight|0.5|LED|비춘다\n생수|1500|소모1|water bottle|0.5|500ml|\n</shelf>';
const msgs = (n, tags) => {
  const out = [];
  for (let i = 1; i <= n; i++) out.push({ role: 'user', data: `u${i}`, chatId: `u${i}` }, { role: 'char', data: `r${i}${tags[i - 1] ? '\n[shop: 철물점|주인]' : ''}`, chatId: `c${i}` });
  return out;
};
const settle = (chat, idx) => {
  const r = M.settleShop(chat, idx);
  return r ? { ...chat, ...(r.message ? { message: r.message } : {}), scriptstate: { ...chat.scriptstate, ...r.vars } } : chat;
};

/** R1 에서 가게에 들어가 말하고 판 상태 */
function visit(closed = false) {
  let c = settle({ message: msgs(1, [true]), scriptstate: {} }, 1);
  let st = M.applyShelf(M.currentShop(c), M.parseShelf(SHELF, null), M.shopSettings({}));
  st = M.startSell(st, { itemId: 'i1', name: '낡은 칼', desc: '', effect: '', use: false });
  st = M.sayToOwner(st, '깎아줘');
  st = M.applyTalk(st, M.parseTalk(closed ? '<owner>나가!</owner>\n<closed/>' : '<owner>오천 주지.</owner>\n<offer>5000</offer>'));
  if (!closed) st = M.closeSale(st);
  return { ...c, scriptstate: { ...c.scriptstate, ...M.shopVars(st) } };
}

test('같은 가게에 머물러도 지난 턴의 판 것·대화는 다시 가지 않는다 (shop#2·mainreach#1)', () => {
  let c = visit();
  const t1 = M.shopEvents(c);
  assert.equal(t1.length, 2);
  assert.match(t1[0], /just sold 낡은 칼 \(5,000 won\)/);
  assert.match(t1[1], /talked with the owner of 철물점 — .*깎아줘/);
  // 응답 R2 도 같은 표식, 가게에서 아무것도 안 함
  c = settle({ ...c, message: [...c.message, ...msgs(2, [true, true]).slice(2)] }, 3);
  assert.equal(M.currentShop(c).talk.length, 3, '방문 대화는 화면용으로 남는다');
  assert.deepEqual(M.shopEvents(c), []);
  // R2 턴에 새로 말하면 그것만
  let st = M.currentShop(c);
  st = M.applyTalk(M.sayToOwner(st, '또 왔소'), M.parseTalk('<owner>그래.</owner>'));
  c = { ...c, scriptstate: { ...c.scriptstate, ...M.shopVars(st) } };
  const t2 = M.shopEvents(c);
  assert.equal(t2.length, 1);
  assert.doesNotMatch(t2[0], /깎아줘/);
  assert.match(t2[0], /또 왔소.*그래/);
});

test('다음 응답을 다시 굴려도 지난 턴 쫓겨남·대화가 간다 (shop#3)', () => {
  for (const tagged of [false, true]) {
    let c = visit(true);
    const before = M.shopEvents(c);
    assert.match(before[0], /refused service.*철물점 \("나가!"\)/);
    const r2 = settle({ ...c, message: [...c.message, ...msgs(2, [true, tagged]).slice(2)] }, 3);
    // 다시 굴리기: R2 가 빠지고 마지막 응답은 R1
    const rr = { ...r2, message: r2.message.slice(0, 3) };
    assert.deepEqual(M.shopEvents(rr), before, `R2 표식 ${tagged}`);
    // 새 R2' 가 붙고 또 다시 굴려도 사본은 R1 것 그대로
    const r2b = settle({ ...rr, message: [...rr.message, { role: 'char', data: `r2b${tagged ? '\n[shop: 철물점|주인]' : ''}`, chatId: 'c2b' }] }, 3);
    assert.deepEqual(M.shopEvents({ ...r2b, message: r2b.message.slice(0, 3) }), before);
    // 다음 턴으로 넘어가면 없음
    assert.deepEqual(M.shopEvents({ ...r2, message: [...r2.message, { role: 'user', data: 'u3', chatId: 'u3' }] }), []);
  }
  // 판 것은 다시 굴린 때 소지품 쪽이 넘기니 사본에서는 내지 않는다
  const c = visit();
  const r2 = settle({ ...c, message: [...c.message, ...msgs(2, [true, false]).slice(2)] }, 3);
  const ev = M.shopEvents({ ...r2, message: r2.message.slice(0, 3) });
  assert.equal(ev.length, 1);
  assert.match(ev[0], /talked with/);
  assert.equal(M.currentShop({ ...r2, message: r2.message.slice(0, 3) }), null, '지금 상점(카드·화면)은 그대로 없음');
});

test('값 칸: 원이 아닌 대가가 문의 요청에 (shop#5)', () => {
  const c = settle({ message: msgs(1, [true]), scriptstate: {} }, 1);
  const st = M.applyShelf(M.currentShop(c), M.parseShelf('<shop-identity>\nsells: x\n</shop-identity>\n<shelf>\n피의 부적|피 한 방울|소모1|talisman|0.01|종이|\n향|3000 + 머리카락|-|-|-||\n칼|5000|무기|knife|1||\n</shelf>', null), M.shopSettings({}));
  const user = M.talkPrompt({ st, refs: '', story: '', status: '', situation: '', identity: '', language: null }, M.shopSettings({})).at(-1).content;
  assert.match(user, /\n피의 부적\|피 한 방울\|/);
  assert.match(user, /\n향\|머리카락 \+ 3000\|/);
  assert.match(user, /\n칼\|5000\|/);
});

test('값 칸 꾸밈·머리 줄·구분선·번호 (shop#6·parse#3·parse#5)', () => {
  const eq = (cell, want) => assert.deepEqual(M.costOf(cell), want, cell);
  eq('15000 (깎음)', { price: 15000 });
  eq('15000원 (원래 18000)', { price: 15000 });
  eq('18000 won', { price: 18000 });
  eq('30,000 KRW', { price: 30000 });
  eq('약 3만원', { price: 30000 });
  eq('15,000원~', { price: 15000 });
  eq('18,000.', { price: 18000 });
  eq('-', null);
  // 그대로인 것
  eq('18000', { price: 18000 });
  eq('3만 원', { price: 30000 });
  eq('피 400ml', { price: 0, pay: '피 400ml' });
  eq('10000p', { price: 0, pay: '10000p' });
  eq('10년 수명', { price: 0, pay: '10년 수명' });
  eq('5000 + 어제 기억', { price: 5000, pay: '어제 기억' });
  eq('왼손 새끼손가락', { price: 0, pay: '왼손 새끼손가락' });
  assert.equal(M.pointPrice(M.costOf('900pt')).price, 900);
  assert.equal(M.pointPrice(M.costOf('900점')).price, 900);
  assert.equal(M.pointPrice(M.costOf('900p')).price, 900);
  const shelf = (body) => M.parseShelf(`<shelf>\n${body}\n</shelf>`, { sells: 'x', never: '', prices: '' }).items.map((x) => [x.name, x.price]);
  assert.deepEqual(shelf('이름|값|쓰임|그림|무게|설명|효과|구분\n---|---|---\n1. 붕대|2500|소모1|bandage|0.1||\n2) 손전등|12000|사용|-|0.5||\n1.5L 생수|1500|소모1|-|1.5||'), [['붕대', 2500], ['손전등', 12000], ['1.5L 생수', 1500]]);
  assert.deepEqual(shelf('| 이름 | 값 | 쓰임 |\n|---|:---:|---|\n| 붕대 | 2500 | 소모1 |'), [['붕대', 2500]]);
  // 끝 빈 칸(구분)은 그대로 읽는다
  assert.equal(M.parseShelf('<shelf>\n줄자|3000|사용||0.5|||특가:5000\n</shelf>', { sells: 'x', never: '', prices: '' }).items[0].was, 5000);
});

test('우주몰 문의 요청에 진실 칸·SHELF_SECRET (shop#7·guides#2)', () => {
  const st = { ...M.emptyShop({ raw: '', shop: '우주 쇼핑몰', owner: '운영자' }, ''), loaded: true, items: [{ id: 'a', name: '빛의 돌', price: 1200000, desc: '둥근 돌', effect: '어둠을 밝힌다', use: false, truth: '쥐면 주변 전등이 꺼진다' }] };
  const src = { st, refs: '', story: '', status: '', situation: '', identity: '', language: null, truthMode: 'mix' };
  const sys = M.talkPrompt(src, M.shopSettings({}), 'Cos')[0].content;
  assert.ok(sys.includes(M.SECRET_LINE), 'Cos 문의 줄 꼴은 진실 칸까지');
  const shopSys = M.talkPrompt(src, M.shopSettings({}), 'Shop')[0].content;
  assert.ok(!shopSys.includes(M.SECRET_LINE), '기본 상점은 8칸 그대로');
  assert.ok(sys.length > shopSys.length);
});

test('표식 닫는 괄호가 빠지면 다음 줄(상태창)을 먹지 않는다 (parse#7)', () => {
  const t = '그는 문을 밀고 들어갔다.\n[shop: 달빛 잡화점\n\n[▣|2025.03.14|21:40|🌧️|8°C|달빛 잡화점|이성해|김솔음]';
  assert.equal(M.findShopTag(t), null);
  assert.equal(M.stripShopTags(t), t);
  assert.equal(M.findShopTag('글\n[shop: 달빛 잡화점|\n[▣|a|b]'), null);
  assert.deepEqual(M.findShopTag('글\n[shop: 달빛 잡화점|주인]'), { raw: '[shop: 달빛 잡화점|주인]', shop: '달빛 잡화점', owner: '주인' });
});

test('<deal/>·<closed/> 은 대사·문장 속 언급이면 아님 (parse#10)', () => {
  const r = M.parseTalk('<owner>음, 아직 생각 중이야. 끝나면 <deal/> 을 붙이지. <closed/> 도 아님.</owner>\n<change mode="none"></change>\n<offer>3000</offer>\n6. agreed? no -> no <deal/>');
  assert.equal(r.deal, undefined);
  assert.equal(r.closed, false);
  assert.equal(M.parseTalk('<owner>거래 성립.</owner><offer>15000</offer><deal/>').deal, true);
  assert.equal(M.parseTalk('<owner>좋소.</owner>\n<change mode="none"></change>\n<deal/>').deal, true);
  assert.equal(M.parseTalk('<owner>나가쇼.</owner>\n<change mode="none"></change>\n<closed/>').closed, true);
});

test('맞춤 주문 납기 단위 (shop#11)', () => {
  const h = (cell) => M.parseOrderLine(`가림 내의|1200000|${cell}|장비|-|0.3|설명|효과|진실`)?.hours;
  assert.equal(h('36'), 36);
  assert.equal(h('3일'), 72);
  assert.equal(h('48시간 (2일)'), 48);
  assert.equal(h('72h'), 72);
  assert.equal(h('1주'), 168);
  assert.equal(h('1.5일'), 36);
  assert.equal(h(''), undefined);
});

test('맞춤 주문 납기 단위: 개월·달·분 (11-14 재검토 ①-6)', () => {
  const h = (cell) => M.parseOrderLine(`가림 내의|1200000|${cell}|장비|-|0.3|설명|효과|진실`)?.hours;
  assert.equal(h('1개월'), 720);
  assert.equal(h('1달'), 720);
  assert.equal(h('1 month'), 720);
  assert.equal(h('2개월'), 720, '위 한도 30일');
  assert.equal(h('30분'), 0.5);
  assert.equal(h('90 min'), 1.5);
  assert.equal(h('1분'), 0.1, '0시간이 되지 않는다');
  // 그대로여야 하는 것
  assert.equal(h('12시간'), 12);
  assert.equal(h('3일'), 72);
  assert.equal(h('2주'), 336);
});

test('currency 줄: 원으로 시작하면 원 가게 (shop#10)', () => {
  const id = (cur) => M.parseShelf(`<shop-identity>\nsells: x\ncurrency: ${cur}\n</shop-identity>\n<shelf>\n붕대|2500\n</shelf>`, null).identity.points === true;
  assert.equal(id('points'), true);
  assert.equal(id('Baekilmong welfare points'), true);
  assert.equal(id('won'), false);
  assert.equal(id('won (not points)'), false);
  assert.equal(id('won — Baekilmong points are not accepted'), false);
});
