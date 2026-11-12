import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homeshop } from '../dist-test/core.mjs';
const { scheduleDues, newOrder, ordersVars, liveOrders, paidOf, callNow, homeshopBlock, withHomeshop, boxOrder, HS_AUD_VAR, parseShow, applyShow, readShow, showVars, emptyShow, moodMap, hsSettings, HS_KEY, HS_NUM, parseClipGroups, clipsOf, idleState, nextIdle, moodClip, cueMs, installments } = homeshop;

const meta = JSON.parse(readFileSync(new URL('../game-src/homeshop/homeshop.json', import.meta.url), 'utf8'));
const moods = moodMap(meta);
const RAW = `<shelf>
행운의 무전기|무이자 6회|사용|walkie talkie|0.4|건전지 없이도 누군가 받습니다.|누군가 받는다|
잠들지 않는 베개|무이자 3회|사용|pillow|0.8|아침까지 눈이 떠 있습니다.|잠이 오지 않는다|
</shelf>
<title>
금요 심야 특집
</title>
<cue>
#1
와이드|말하기|고객님들, 잘 오셨습니다.|-
상품|신남|행운의 무전기입니다!|가격 공개
바스트|다급|서두르세요!|남은 수량 -12
#2
전화|말하기|연결됐습니다.|전화 연결
바스트|없는표정|…끊지 마세요.|응시
</cue>
<chat>
ㅇㅇ|재입고 되나요
???|여기 안에 있어요
</chat>`;

test('망상홈쇼핑: 편성 응답을 상품·큐시트·채팅으로 읽는다', () => {
  const r = parseShow(RAW, moods);
  assert.equal(r.title, '금요 심야 특집');
  assert.deepEqual(r.items.map((i) => i.name), ['행운의 무전기', '잠들지 않는 베개']);
  assert.equal(installments(r.items[0]), 6);
  assert.deepEqual(r.cues.map((c) => c.length), [3, 2]);
  assert.deepEqual(r.cues[0].map((c) => c.cut), ['A', 'C', 'B']);
  assert.equal(r.cues[0][1].ev, 'price');
  assert.equal(r.cues[0][2].ev, 'left');
  assert.equal(r.cues[0][2].n, 12);
  assert.equal(r.cues[1][0].cut, 'D');
  assert.equal(r.cues[1][1].ev, 'look');
  assert.deepEqual(r.chat, [{ nick: 'ㅇㅇ', text: '재입고 되나요' }, { nick: '???', text: '여기 안에 있어요' }]);
});

test('망상홈쇼핑: 큐시트가 없거나 상품보다 모자라면 오류', () => {
  assert.throws(() => parseShow(RAW.replace(/<cue>[\s\S]*<\/cue>/, ''), moods), /<cue>/);
});

test('망상홈쇼핑: 편성은 저장했다 그대로 읽는다', () => {
  const st = applyShow(emptyShow(), parseShow(RAW, moods), 'k1');
  const back = readShow(showVars(st));
  assert.equal(back.loaded, true);
  assert.equal(back.at, 0);
  assert.deepEqual(back.parts.map((p) => p.item.name), st.parts.map((p) => p.item.name));
  assert.equal(back.parts[0].cues.length, 3);
  const next = applyShow(st, parseShow(RAW, moods), 'k2');
  assert.ok(next.prev.includes('행운의 무전기'), '지난 상품을 기억');
});

test('망상홈쇼핑: 설정은 기본값과 범위를 지킨다', () => {
  const d = hsSettings({});
  assert.equal(d.on, true);
  assert.deepEqual(d.cue, [HS_NUM.cueMin.def, HS_NUM.cueMax.def]);
  const s = hsSettings({ [HS_KEY.on]: '0', [HS_NUM.speed.key]: '99999', [HS_NUM.rareP.key]: '50' });
  assert.equal(s.on, false);
  assert.equal(s.speed, HS_NUM.speed.hi);
  assert.equal(s.rules.rareP, 0.5);
  assert.ok(cueMs({ text: '가나다라마' }, { speed: 10, hold: 1 }) === 1500);
});

test('망상홈쇼핑: 대기 동작은 기본을 돌리다 정해진 횟수마다 다른 동작을 끼운다', () => {
  const clips = clipsOf(meta.cuts.B, 'B', {});
  const rules = { fill: [3, 3], fillCool: 8, rareP: 0, rareCool: 20 };
  const st = idleState();
  const seq = Array.from({ length: 40 }, () => nextIdle(clips, st, rules, () => 0.3));
  const others = seq.filter((c) => c.group !== 'base');
  assert.ok(others.length >= 5 && others.length <= 10, '3번 돌고 1번 자리에서만');
  assert.ok(seq.slice(0, 3).every((c) => c.group === 'base'), '처음 3번은 기본');
  assert.ok(others.every((c) => c.group === 'filler'), '드물게 0% 면 가끔 동작만');
  const st2 = idleState();
  const rare = Array.from({ length: 40 }, () => nextIdle(clips, st2, { ...rules, rareP: 1 }, () => 0.3)).filter((c) => c.group === 'rare');
  assert.ok(rare.length >= 1 && rare.length <= 2, '드물게 동작은 쉬는 횟수를 지킴');
});

test('망상홈쇼핑: 동작 분류는 설정 글로 고친다', () => {
  const some = meta.cuts.B.clips.find((c) => c.group === 'filler');
  const over = parseClipGroups(`B:${some.ko}=안씀\nA : talk = 기본\n엉터리 줄`);
  assert.equal(Object.keys(over).length, 2);
  const clips = clipsOf(meta.cuts.B, 'B', over);
  assert.ok(clips.filter((c) => c.name === some.name).every((c) => c.group === 'off'));
  assert.ok(moodClip(clips, '없는동작', idleState()), '모르는 표정은 말하기·기본으로');
});

const chatOf = (turns, vars = {}) => ({ message: Array.from({ length: turns * 2 }, (_, i) => ({ role: i % 2 ? 'char' : 'user', data: `m${i}`, chatId: `c${i}` })), scriptstate: vars });
const ITEM = { id: 'x1', name: '행운의 무전기', desc: '광고', effect: '', use: true, price: 0, pay: '무이자 3회' };

test('망상홈쇼핑: 호출 턴은 간격 안에서 뽑고 다른 주문과 겹치지 않는다', () => {
  const d = scheduleDues([8, 9], 2, 3, [6, 6], () => 0);
  assert.deepEqual(d, [10, 16, 22], '8·9 는 차 있어 10 으로 밀림');
  assert.deepEqual(scheduleDues([], 5, 0, [6, 12]), [], '맞교환은 호출 없음');
});

test('망상홈쇼핑: 할부 장부는 턴 수로 납부를 세고, 호출 턴에만 본편에 한 번 넣는다', () => {
  const c2 = chatOf(2);
  const o = { ...newOrder(c2, ITEM, { call: [3, 3] }, '', () => 0), boxId: 'box1' };
  assert.equal(o.n, 3);
  assert.deepEqual(o.dues, [5, 8, 11]);
  const vars = ordersVars([o]);
  // 4턴: 아직. 요청 때는 새 유저 메시지가 붙어 있다
  const at = (turns) => ({ ...chatOf(turns), message: [...chatOf(turns - 1).message, { role: 'user', data: 'go', chatId: 'u' }], scriptstate: vars });
  assert.equal(homeshopBlock(at(4)), '');
  const b5 = homeshopBlock(at(5));
  assert.ok(b5.startsWith('[망상홈쇼핑]') && b5.includes('행운의 무전기') && b5.includes('appearance 1 of 3'), b5);
  assert.equal(homeshopBlock(at(6)), '', '지나면 다시 안 보냄');
  assert.equal(callNow(at(8)).nth, 2);
  assert.equal(paidOf(o, 4), 0);
  assert.equal(paidOf(o, 8), 2);
  assert.equal(paidOf(o, 99), 3);
  const msgs = withHomeshop([{ role: 'system', content: 'S' }, { role: 'user', content: 'go' }], at(5));
  assert.equal(msgs.length, 3);
  assert.equal(msgs[1].role, 'system');
  assert.equal(withHomeshop(msgs, at(5)).length, 3, '두 번 넣지 않음');
  // 주문한 응답이 지워지면 장부도 없던 일
  const gone = { message: c2.message.slice(0, 2), scriptstate: vars };
  assert.equal(liveOrders(gone.scriptstate, new Set(gone.message.map((m) => m.chatId))).length <= 1, true);
  assert.equal(boxOrder(vars, 'box1', new Set([o.anchor])).id, o.id);
  assert.equal(boxOrder(vars, 'nope', new Set([o.anchor])), null);
});

test('망상홈쇼핑: 방청 신청은 바로 다음 턴에만 한 줄', () => {
  const c = chatOf(2);
  const key = (() => { const o = newOrder(c, ITEM, { call: [3, 3] }); return o.anchor; })();
  const vars = { [HS_AUD_VAR]: JSON.stringify({ anchor: key, no: '4821', name: '나' }) };
  const next = { message: [...c.message, { role: 'user', data: 'go', chatId: 'u' }], scriptstate: vars };
  assert.ok(homeshopBlock(next).includes('4821'));
  const later = { message: [...next.message, { role: 'char', data: 'r', chatId: 'r' }, { role: 'user', data: 'go2', chatId: 'u2' }], scriptstate: vars };
  assert.equal(homeshopBlock(later), '', '그다음 턴에는 저절로 풀림');
});

test('턴 열쇠: 응답을 다시 굴리면 같고 새 턴이면 달라진다 (자동 호출·편성 넘기기 공통)', async () => {
  const core = await import('../dist-test/core.mjs');
  const turnKey = core.turnKey ?? core.shop?.turnKey;
  const base = [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: '첫 답', chatId: 'c1' }];
  const k1 = turnKey({ message: base });
  // 다시 굴리기: 같은 자리의 응답이 새 chatId·새 글
  assert.equal(turnKey({ message: [base[0], { role: 'char', data: '다른 답', chatId: 'c1b' }] }), k1);
  // 새 턴
  assert.notEqual(turnKey({ message: [...base, { role: 'user', data: '계속', chatId: 'u2' }, { role: 'char', data: '둘째 답', chatId: 'c2' }] }), k1);
  assert.equal(turnKey({ message: [] }), '');
});

// ── 11-12: 상품마다 채팅 · 방송 전용 지침 ──
const core1112 = await import('../dist-test/core.mjs');

test('망상홈쇼핑: 채팅은 상품마다(#n) 읽고 그 부에 담는다. 머리 없는 줄은 공용', () => {
  const raw = RAW.replace(/<chat>[\s\S]*<\/chat>/, `<chat>
#1
ㅇㅇ|이거 뭐임
abc12|배송 며칠 걸려요
#2
감자|베개는 좀 끌리네
</chat>`);
  const r = parseShow(raw, moods);
  assert.deepEqual(r.chats.map((c) => c.length), [2, 1]);
  assert.deepEqual(r.chat, []);
  const st = applyShow(emptyShow(), r, 'k1');
  assert.deepEqual(st.parts.map((p) => p.chat?.length), [2, 1]);
  // 저장했다 읽어도 부마다 그대로
  const back = readShow(showVars(st));
  assert.deepEqual(back.parts[0].chat, [{ nick: 'ㅇㅇ', text: '이거 뭐임' }, { nick: 'abc12', text: '배송 며칠 걸려요' }]);
  assert.deepEqual(back.parts[1].chat, [{ nick: '감자', text: '베개는 좀 끌리네' }]);
  // 머리 없이 온 옛 꼴은 공용 줄로
  const old = applyShow(emptyShow(), parseShow(RAW, moods), 'k2');
  assert.equal(old.chat.length, 2);
  assert.equal(old.parts[0].chat, undefined);
});

test('망상홈쇼핑: 지침은 방송 전용 (상점 진열·주인 절을 빌리지 않고, 시청자 절·생각 단계가 있다)', () => {
  const g = core1112.guideDefault('Hs');
  const names = [...g.matchAll(/@@SECTION ([^\n]+)/g)].map((m) => m[1].trim());
  for (const n of ['COMMON', 'SHELF', 'BROADCAST', 'VIEWERS', 'THOUGHTS_PROGRAM', 'SAY', 'CALL', 'AUDIENCE']) assert.ok(names.includes(n), n);
  for (const n of ['FIRST', 'RESTOCK', 'THOUGHTS_SHELF', 'TALK', 'SELL', 'MAIN_TAG', 'SHOP_RULE']) assert.ok(!names.includes(n), `${n} 없어야`);
  const viewers = /@@SECTION VIEWERS\n([\s\S]*?)\n@@END/.exec(g)[1];
  assert.match(viewers, /without knowing what it is/);
  assert.match(viewers, /know what the channel really is/);
  assert.match(viewers, /Strange beings/);
  // 대화 예시를 박지 않는다 (11-12 사용자): 따옴표로 든 말·한글 예문 없음
  assert.doesNotMatch(viewers, /[「」"“”]|e\.g\.|[가-힣ㄱ-ㅎ]/);
});

test('망상홈쇼핑: 편성 요청문은 방송 꼴만 (가게 정체·주인 한마디·진열대 새로 짜기 없음), 채팅은 상품마다', () => {
  const st = { ...core1112.emptyShop({ raw: '', shop: '망상홈쇼핑', owner: '레드 프라이데이' }, ''), loaded: true, identity: { sells: '망상홈쇼핑', never: '', prices: '무이자 N회' }, prev: ['행운의 무전기'] };
  const src = { st, refs: '참고 글', story: '', status: '', situation: '', identity: '', language: null };
  const msgs = core1112.programPrompt(src, core1112.shopSettings({}), { cue: '6 to 10', chat: '12 to 18', cuts: '와이드, 바스트', moods: '말하기', moods_b: '-', events: '가격 공개' });
  const sys = msgs.find((m) => m.role === 'system').content;
  const user = msgs.at(-1).content;
  assert.match(sys, /live feed of 망상홈쇼핑/);
  assert.match(sys, /<chat>\n#1\nhandle\|message/);
  // 고르는 낱말·줄 꼴은 영어 (11-12 사용자), 진행자 절이 같이 간다
  assert.match(sys, /<cue>\n#1\ncut\|mood\|line\|event/);
  assert.match(sys, /# Host on air/);
  assert.match(sys, /12 to 18 lines of the live viewer chat while that item is on air/);
  assert.match(sys, /# Viewer chat/);
  assert.match(sys, /행운의 무전기/);
  assert.doesNotMatch(sys, /Re-stock|First visit|<owner>|shop-identity|\{[a-z_]+\}/);
  assert.match(user, /^\[채널\]\n망상홈쇼핑 \/ 진행자: 레드 프라이데이/);
  assert.match(user, /참고 글/);
  assert.match(user, /\[현재 작업\]\n오늘 편성/);
  assert.doesNotMatch(user, /가게 정체|진열대/);
});

test('남은 수량 저절로 줄기: 큐시트 끝에 끝 수에 닿고 0이 되지 않는다', () => {
  const { dropEnd, dropRest, nextDrop } = homeshop;
  const d0 = hsSettings({}).drop;
  assert.deepEqual(d0, { on: true, rate: HS_NUM.dropRate.def / 100, fast: HS_NUM.dropFast.def / 10, step: HS_NUM.dropStep.def, soon: HS_NUM.soonAt.def, end: [HS_NUM.endLo.def, HS_NUM.endHi.def] });
  assert.equal(hsSettings({ [HS_KEY.drop]: '0' }).drop.on, false);
  assert.deepEqual(hsSettings({ [HS_NUM.endLo.key]: '9', [HS_NUM.endHi.key]: '4' }).drop.end, [4, 9]);
  // 끝 수: 범위 안, 시작 값보다 작게, 1 이상
  assert.equal(dropEnd(30, d0, () => 0), d0.end[0]);
  assert.equal(dropEnd(30, d0, () => 0.999), d0.end[1]);
  assert.equal(dropEnd(3, d0, () => 0.999), 2);
  assert.equal(dropEnd(1, d0, () => 0.5), 1);
  // 남은 길이: 가격 공개 뒤는 배수만큼 길게, 매진 뒤는 안 친다, 큐시트가 뺄 수는 따로
  const s = { speed: 10, hold: 1, drop: d0 };
  const cue = (ev, n) => ({ cut: 'B', mood: '', text: '가나다라마가나다라마', ev, ...(n ? { n } : {}) });
  const cues = [cue(''), cue('left', 4), cue('price'), cue(''), cue('sold'), cue('')];
  assert.deepEqual(dropRest(cues, 0, 1000, false, s), { ms: 1000 + 2000 + 2000 * d0.fast * 2, planned: 4 });
  assert.deepEqual(dropRest(cues, 2, 500, true, s), { ms: 500 * d0.fast + 2000 * d0.fast, planned: 0 });
  // 꺼짐 · 줄일 것 없음 · 시간 없음
  assert.equal(nextDrop(30, 5, { ms: 10000, planned: 0 }, { ...d0, on: false }), null);
  assert.equal(nextDrop(5, 5, { ms: 10000, planned: 0 }, d0), null);
  assert.equal(nextDrop(9, 5, { ms: 10000, planned: 4 }, d0), null);
  assert.equal(nextDrop(30, 5, { ms: 0, planned: 0 }, d0), null);
  // 한 부를 처음부터 끝까지 흘려 본다 (33ms 씩): 끝에는 끝 수 근처, 그 아래로는 안 간다
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const start of [30, 200, 999, 8]) {
    const plain = Array.from({ length: 8 }, (_, i) => cue(i === 4 ? 'rush' : ''));
    const end = dropEnd(start, d0, rnd);
    let left = start, n = 0, wait = 0, fast = false, drops = 0;
    for (let i = 0; i < plain.length; i++) {
      if (plain[i].ev === 'rush') fast = true;
      for (let at = 0; at < 2000; at += 33) {
        if (!n) { const p = nextDrop(left, end, dropRest(plain, i, 2000 - at, fast, s), d0, rnd); if (p) ({ n, wait } = p); }
        else if ((wait -= 33 * (fast ? d0.fast : 1)) <= 0) { left = Math.max(1, end, left - n); n = 0; drops++; }
      }
    }
    assert.ok(left >= end && left >= 1, `${start}: ${left} >= ${end}`);
    assert.ok(left - end <= Math.max(3, start * 0.1), `${start}: 끝 ${left} (목표 ${end})`);
    assert.ok(drops <= 16 + 2, `${start}: ${drops}번 (1초보다 잦지 않게)`);
  }
});

test('망상홈쇼핑: 큐 낱말은 영어로 주고, 영어·우리말 둘 다 읽는다 · 진행자 절에 대화 예시 없음', () => {
  const { parseCue, CUE_CUT_WORD, CUE_EVENT_WORD } = homeshop;
  assert.deepEqual(Object.values(CUE_CUT_WORD), ['wide', 'bust', 'product', 'phone']);
  assert.doesNotMatch(Object.values(CUE_EVENT_WORD).join(' '), /[가-힣]/);
  const en = [['wide|talk|하나|price', 'A', 'price'], ['bust|whisper|둘|left -7', 'B', 'left'], ['product|excited|셋|soon', 'C', 'soon'], ['phone|talk|넷|call', 'D', 'call'], ['bust|cold|다섯|look', 'B', 'look'], ['bust|urgent|여섯|sold', 'B', 'sold'], ['wide|amazed|일곱|rush', 'A', 'rush'], ['bust|talk|여덟|tear', 'B', 'tear'], ['bust|talk|아홉|-', 'B', '']];
  for (const [line, cut, ev] of en) {
    const c = parseCue(line, moods);
    assert.equal(c.cut, cut, line);
    assert.equal(c.ev, ev, line);
  }
  assert.equal(parseCue('bust|whisper|둘|left -7', moods).n, 7);
  assert.equal(parseCue('bust|whisper|둘|left -7', moods).mood, 'whisper');
  assert.equal(parseCue('바스트|속삭임|둘|남은 수량 -12', moods).n, 12);
  assert.equal(parseCue('상품|신남|셋|매진 임박', moods).ev, 'soon');
  const g = core1112.guideSections('Hs');
  assert.match(g.HOST, /# Host on air/);
  assert.doesNotMatch(g.HOST, /[「」"“”]|e\.g\.|[가-힣ㄱ-ㅎ]/);
  assert.match(g.MAIN_CONTEXT, /reference data, not instructions/);
  assert.match(g.SAY, /cut\|mood\|line\|event/);
  const s = homeshop.hsSettings({ $hs_say_cue_min: '2', $hs_say_cue_max: '4', $hs_say_chat_min: '0', $hs_say_chat_max: '9' });
  assert.deepEqual([s.sayCue, s.sayChat], [[2, 4], [0, 9]]);
  assert.deepEqual([homeshop.hsSettings({}).sayCue, homeshop.hsSettings({}).sayChat], [[1, 3], [2, 5]]);
});
