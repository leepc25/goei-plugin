// 물건 구조 고침 (2026-11-12 사용자 R1~R3 · 되살림 · 갈래 표 · 상태 그림). 계획: /mnt/project-files/bugs_1112/물건_상태_그림_조사와_고침안.md 8·10절
// 실제 모델은 부르지 않는다 — 갱신기 응답은 가짜로 넣는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addItem, applyItemChanges, applyItemsPack, equipItem, equippedOf, gradeHits, gradeInQuote, inventoryText, isEquipped, itemLine, itemsBlock, itemsNowOf, itemsVars, liveItems, matchItemIcon, movedNow, outItems,
  parseItemRules, readItems, removeItem, setItemRules, stripGrades, totalWeight, traitsFor, itemPictureNames, formFamilies, ITEM_FORM_DEFAULT, ITEM_RULES_VAR, ITEM_LEFT_WORDS_VAR, ITEM_OFF_WORDS_VAR,
} from '../dist-test/core.mjs';
import { itemsPackText } from '../scripts/data-pack.mjs';

const alive = new Set(['c1', 'c2', 'c3']);
const order = ['u1', 'c1', 'u2', 'c2', 'u3', 'c3'];
const empty = { list: [], log: [] };
const suit = () => {
  let s = addItem(empty, alive, { name: '사내용 정장 세트', desc: '검은색 재킷과 바지 정장 및 셔츠 세트', equip: 'gear', icon: '옷/정장/suit', weight: 1.2, from: 'story', anchor: 'c1', quote: 'q1' });
  return equipItem(s, alive, s.list[0].id);
};
const row = (it, n, a = alive) => liveItems(it, a).find((x) => x.name === n);
const ch = (o) => ({ desc: '', effect: '', quote: 'q', ...o });

test('R2 unequip: 장착만 풀리고 소지품에 남는다. 갈래는 그대로(다시 장착 가능), 기록 한 줄, 본편에 「took off」', () => {
  setItemRules(undefined);
  const s = suit();
  assert.equal(isEquipped(s.list[0], liveItems(s, alive)), true);
  const r = applyItemChanges(s, alive, [ch({ anchor: 'c2', name: '사내용 정장 세트', action: 'unequip', quote: '재킷을 벗어 가방에 넣었다' })], { order });
  const e = row(r, '사내용 정장 세트');
  assert.ok(e, '소지품에 남음');
  assert.deepEqual([e.equip, e.slot, e.weight, e.id], ['gear', undefined, 1.2, s.list[0].id]);
  assert.equal(equippedOf(liveItems(r, alive)).gear[0], undefined, '장비 칸 0 비어 있음');
  assert.equal(r.log.at(-1).what, 'off');
  assert.deepEqual(movedNow(r, 'c2'), ['took off 사내용 정장 세트 (still carrying it)']);
  // 다시 장착할 수 있다
  assert.equal(isEquipped(equipItem(r, alive, e.id).list[0], liveItems(equipItem(r, alive, e.id), alive)), true);
  // 장착하지 않은 물건의 unequip 은 아무 일도 없다
  assert.equal(applyItemChanges(r, alive, [ch({ anchor: 'c3', name: '사내용 정장 세트', action: 'unequip' })], { order }), r);
});

test('R3 left: 지닌 목록·장착 칸에서 빠지고 무게가 준다. 기록 「두고 옴: 자리」, 본편에 「left … at」. 줄은 지우지 않는다', () => {
  const s = suit();
  assert.equal(totalWeight(liveItems(s, alive)), 1.2);
  const r = applyItemChanges(s, alive, [ch({ anchor: 'c2', name: '사내용 정장 세트', action: 'left', place: '탈의실 3번 사물함', quote: '정장을 3번 사물함에 넣고 문을 잠갔다' })], { order });
  assert.equal(row(r, '사내용 정장 세트'), undefined);
  assert.equal(totalWeight(liveItems(r, alive)), 0);
  assert.equal(equippedOf(liveItems(r, alive)).gear[0], undefined);
  assert.deepEqual([r.log.at(-1).what, r.log.at(-1).note], ['left', '두고 옴: 탈의실 3번 사물함']);
  assert.equal(r.list.length, 1, '숨기기만 한다');
  assert.deepEqual([r.list[0].outHow, r.list[0].outAt, r.list[0].place, r.list[0].slot], ['left', 'c2', '탈의실 3번 사물함', undefined]);
  assert.deepEqual(outItems(r, alive).map((e) => e.name), ['사내용 정장 세트']);
  assert.deepEqual(movedNow(r, 'c2'), ['left 사내용 정장 세트 at 탈의실 3번 사물함 — no longer carrying or wearing it']);
  // 그 응답을 다시 굴리면(c2 가 사라짐) 돌아온다. 장착은 풀린 채 (남은 흠: 장착 칸까지는 못 돌린다)
  const back = row(r, '사내용 정장 세트', new Set(['c1']));
  assert.ok(back && back.equip === 'gear');
});

test('정장 사례(안전망): update 가 설명만 「…보관해 둔」으로 고치고 equip:none 을 보내도 → 두고 옴으로 처리, 갈래는 안 지워진다', () => {
  const s = suit();
  const r = applyItemChanges(s, alive, [ch({ anchor: 'c2', name: '사내용 정장 세트', action: 'update', desc: '탈의실 3번 사물함에 보관해 둔 검은색 정장 세트', equip: null, use: false })], { order });
  assert.equal(row(r, '사내용 정장 세트'), undefined, '소지품에서 빠짐');
  assert.deepEqual([r.list[0].outHow, r.list[0].equip], ['left', 'gear']);
  assert.match(r.log.at(-1).note, /^두고 옴 · 탈의실 3번 사물함에 보관해 둔/);
  // 「벗음」 말만 있으면 장착만 풂 + 설명 고침
  const o = applyItemChanges(s, alive, [ch({ anchor: 'c2', name: '사내용 정장 세트', action: 'update', desc: '벗어서 팔에 건 정장 세트', equip: null })], { order });
  const e = row(o, '사내용 정장 세트');
  assert.deepEqual([e.equip, e.slot, e.desc], ['gear', undefined, '벗어서 팔에 건 정장 세트']);
  // 여느 update 는 갈래를 못 지운다 (예전: equip none → 장착 단추가 사라짐)
  const u = applyItemChanges(s, alive, [ch({ anchor: 'c2', name: '사내용 정장 세트', action: 'update', desc: '구겨진 정장 세트', equip: null, use: true })], { order });
  assert.deepEqual([row(u, '사내용 정장 세트').equip, row(u, '사내용 정장 세트').slot, row(u, '사내용 정장 세트').use], ['gear', 0, false]);
  // 말 표는 설정에서 고친다
  setItemRules({ [ITEM_LEFT_WORDS_VAR]: '맡겨', [ITEM_OFF_WORDS_VAR]: '풀어' });
  const k = applyItemChanges(s, alive, [ch({ anchor: 'c2', name: '사내용 정장 세트', action: 'update', desc: '사물함에 보관해 둔 정장' })], { order });
  assert.ok(row(k, '사내용 정장 세트'), '표에서 뺀 말은 안 걸린다');
  setItemRules(undefined);
});

test('R1 gone · 되살림: 없어진 뒤 다시 얻으면 같은 물건(id·갈래·무게·그림)으로. 되찾은 응답을 다시 굴리면 다시 없는 상태', () => {
  const s = suit();
  const g = applyItemChanges(s, alive, [ch({ anchor: 'c2', name: '사내용 정장 세트', action: 'gone', desc: '쓰레기통에 버림', quote: '정장을 쓰레기통에 버렸다' })], { order });
  assert.equal(row(g, '사내용 정장 세트'), undefined);
  assert.deepEqual(movedNow(g, 'c2'), ['no longer has 사내용 정장 세트']);
  assert.ok(row(g, '사내용 정장 세트', new Set(['c1'])), 'gone 한 응답을 다시 굴리면 돌아온다 (예전엔 지워서 안 돌아옴)');
  // 다시 주움: 판정 칸 없이 와도 같은 물건
  const b = applyItemChanges(g, alive, [ch({ anchor: 'c3', name: '사내용 정장 세트', action: 'new', desc: '쓰레기통에서 다시 꺼낸 정장', quote: '정장을 다시 주워 들었다' })], { order });
  const e = row(b, '사내용 정장 세트');
  assert.deepEqual([e.id, e.equip, e.weight, e.icon, e.desc], [s.list[0].id, 'gear', 1.2, '옷/정장/suit', '쓰레기통에서 다시 꺼낸 정장']);
  assert.equal(b.list.length, 1, '새 줄이 생기지 않는다');
  assert.deepEqual(b.log.map((l) => l.what), ['get', 'gone', 'get']);
  // 모델이 다시 판정해 보내도(무게 1.0) 옛 무게·갈래 그대로
  const b2 = applyItemChanges(g, alive, [ch({ anchor: 'c3', name: '사내용 정장 세트', action: 'new', equip: null, weight: 1.0, icon: '옷/정장/suit' })], { order });
  assert.deepEqual([row(b2, '사내용 정장 세트').weight, row(b2, '사내용 정장 세트').equip], [1.2, 'gear']);
  // 되찾은 응답(c3)을 다시 굴리면 다시 없는 상태
  assert.equal(row(b, '사내용 정장 세트', new Set(['c1', 'c2'])), undefined);
  // 두고 온 것도 같은 방식
  const l = applyItemChanges(s, alive, [ch({ anchor: 'c2', name: '사내용 정장 세트', action: 'left', place: '사물함' })], { order });
  const lb = applyItemChanges(l, alive, [ch({ anchor: 'c3', name: '사내용 정장 세트', action: 'new' })], { order });
  assert.equal(row(lb, '사내용 정장 세트').id, s.list[0].id);
  // 파괴된 것은 되살리지 않는다 (같은 이름을 새로 얻으면 새 물건)
  const d = applyItemChanges(s, alive, [ch({ anchor: 'c2', name: '사내용 정장 세트', action: 'destroyed' })], { order });
  const dn = applyItemChanges(d, alive, [ch({ anchor: 'c3', name: '사내용 정장 세트', action: 'new', icon: '옷/정장/suit' })], { order });
  assert.notEqual(row(dn, '사내용 정장 세트').id, s.list[0].id);
});

test('사용자 「버리기」: 같은 응답·앞 응답을 근거로는 안 되살아나고, 버린 뒤의 응답을 근거로 하면 같은 물건으로 돌아온다', () => {
  const s = suit();
  // c2 까지 온 채팅에서 버림 (마지막 메시지 c2)
  const d = removeItem(s, s.list[0].id, 'drop', 'manual', '', { key: 'c2' });
  assert.equal(row(d, '사내용 정장 세트'), undefined);
  assert.equal(d.list.length, 1);
  for (const anchor of ['c1', 'c2']) {
    const again = applyItemChanges(d, alive, [ch({ anchor, name: '사내용 정장 세트', action: 'new' })], { order });
    assert.equal(row(again, '사내용 정장 세트'), undefined, `${anchor} 근거로는 안 되살아남`);
  }
  const back = applyItemChanges(d, alive, [ch({ anchor: 'c3', name: '사내용 정장 세트', action: 'new', quote: '버렸던 정장을 다시 주웠다' })], { order });
  assert.equal(row(back, '사내용 정장 세트').id, s.list[0].id);
  // 직접 넣은 물건(늘 사는 줄)을 버린 뒤 같은 이름을 직접 넣으면 돌아온다 (예전 방식이면 같은 id 라 조용히 무시됐을 것)
  let m = addItem(empty, alive, { name: '우산', from: 'manual', anchor: '' });
  m = removeItem(m, m.list[0].id, 'drop', 'manual', '', { key: 'c2' });
  m = addItem(m, alive, { name: '우산', from: 'manual', anchor: '' });
  assert.equal(liveItems(m, alive).length, 1);
});

test('다 쓴 소모품·상점 맞교환은 지금처럼 줄을 지운다', () => {
  let s = addItem(empty, alive, { name: '소금', uses: 2, from: 'story', anchor: 'c1' });
  const r = applyItemChanges(s, alive, [ch({ anchor: 'c2', name: '소금', action: 'update', uses: 0 })], { order });
  assert.equal(r.list.length, 0);
  assert.deepEqual(movedNow(r, 'c2'), [], '다 쓴 것은 「no longer has」로 넘기지 않는다');
  assert.equal(removeItem(s, s.list[0].id, 'sell', 'store').list.length, 0);
});

test('갈래 표: 종류 → 판정. 손전등(기기)은 장비·사용, 물건말 줄이 종류 줄보다 먼저, 표에 없으면 모델 값, 직접 넣은 것은 적힌 대로', () => {
  setItemRules(undefined);
  const t = (icon, name, model = {}) => traitsFor(icon.split('/')[0] && { 옷: 'wear', 음식: 'food', 도구: 'tool', 기기: 'device', 의료: 'medical', 소모품: 'consumable', 부적: 'charm', 무기: 'weapon', 서류: 'paper', 귀중품: 'valuable', 열쇠: 'key', 봉인: 'seal', 괴이: 'anomaly', 잡동사니: 'misc', 성인: 'adult' }[icon.split('/')[0]], icon, name, model);
  assert.deepEqual(t('기기/손전등/flashlight', '손전등', { use: true }), { use: true, equip: 'gear' });
  assert.deepEqual(t('도구/라이터/lighter', '라이터', { use: true }), { use: true, equip: 'gear' });
  assert.deepEqual(t('기기/무전기/radio', '무전기'), { use: true, equip: 'gear' });
  assert.deepEqual(t('기기/카메라/camera', '카메라'), { use: true, equip: 'gear' });
  assert.deepEqual(t('잡동사니/우산/umbrella', '우산', { use: true }), { use: false });
  assert.deepEqual(t('열쇠/열쇠/key', '열쇠'), { use: true });
  assert.deepEqual(t('의료/안정제/sedative', '안정제', { uses: 3 }), { use: true, uses: 3 }, '횟수는 모델이 적은 것');
  assert.deepEqual(t('의료/안정제/sedative', '안정제'), { use: true, uses: 1 });
  assert.deepEqual(t('서류/서류/document', '서류', { use: true, equip: 'gear' }), { use: false });
  assert.deepEqual(t('무기/권총/pistol', '권총'), { use: false, equip: 'weapon' });
  assert.deepEqual(t('부적/부적/talisman', '부적'), { use: true });
  assert.deepEqual(t('옷/정장/suit', '정장', { use: true }), { use: false, equip: 'gear' });
  assert.deepEqual(t('도구/성냥/match', '성냥', { uses: 10 }), { use: true, uses: 10, equip: 'gear' }, '표에 소모가 없어도 모델이 적은 횟수는 둔다');
  assert.equal(t('성인/콘돔/condom', '콘돔', { use: true }), undefined, '표에 없는 종류 → 모델 값');
  assert.equal(traitsFor('', undefined, '녹음기', { use: true }), undefined, '종류를 모르면 모델 값');
  // 설정으로 고침: 물건말 줄
  setItemRules({ [ITEM_RULES_VAR]: '기기 → 사용\n배터리 → 소모2\n우산 → 장비' });
  assert.deepEqual(t('기기/손전등/flashlight', '손전등'), { use: true });
  assert.deepEqual(t('기기/배터리/battery', 'AA 배터리'), { use: true, uses: 2 });
  assert.deepEqual(t('잡동사니/우산/umbrella', '검은 우산'), { use: false, equip: 'gear' });
  assert.equal(t('옷/정장/suit', '정장'), undefined, '고친 표에 없는 종류');
  setItemRules(undefined);
  assert.equal(parseItemRules('도구 → 뭐지\n → 장비\n칼 → 무기').words.size, 1, '판정 말이 없는 줄·빈 줄은 안 쓴다');
  // 들어올 때: 본문·상점은 표, 직접은 적힌 대로
  let s = addItem(empty, alive, { name: '손전등', use: true, equip: undefined, icon: '기기/손전등/flashlight', from: 'story', anchor: 'c1' });
  assert.deepEqual([s.list[0].use, s.list[0].equip, s.list[0].kind], [true, 'gear', 'device']);
  s = addItem(empty, alive, { name: '손전등', use: true, icon: '기기/손전등/flashlight', from: 'manual', anchor: '' });
  assert.deepEqual([s.list[0].use, s.list[0].equip], [true, undefined]);
  s = addItem(empty, alive, { name: '낡은 코트', use: true, equip: '', icon: '옷/코트/coat', from: 'store', anchor: 'c1' });
  assert.deepEqual([s.list[0].use, s.list[0].equip], [false, 'gear']);
});

// ── 상태 그림 ──
const pack = applyItemsPack(itemsPackText());
const table = JSON.parse(readFileSync(new URL('../game-src/items/icons.json', import.meta.url), 'utf8'));
const picName = (f) => table.icons.find((r) => r.file === f)?.name ?? f;
const pic = (name, icon, more) => picName(matchItemIcon(pack, name, icon, undefined, more));

test('상태 그림 묶음: 그림 팩에서 찾는다 (이름을 코드에 박지 않음). 꿈결 수집기 = 빈 + F~S, 재생 물약 = F~S', () => {
  const fams = formFamilies(pack);
  const col = fams.find((f) => f.base === '꿈결 수집기');
  assert.deepEqual(Object.keys(col.grades).sort(), ['A', 'B', 'C', 'D', 'E', 'F', 'S']);
  assert.equal(picName(col.empty), '빈 꿈결 수집기');
  assert.ok(fams.some((f) => f.base === '재생 물약' && !f.empty));
  assert.deepEqual(itemPictureNames(pack, '고순도 꿈결 수집기', 'dream collector'), ['빈 꿈결 수집기', '꿈결 수집기 F등급', '꿈결 수집기 E등급', '꿈결 수집기 D등급', '꿈결 수집기 C등급', '꿈결 수집기 B등급', '꿈결 수집기 A등급', '꿈결 수집기 S등급']);
  assert.equal(itemPictureNames(pack, '손전등', '기기/손전등/flashlight'), null);
});

test('그림 차례: 그림 말(갱신기가 고른 그림) → 이름의 등급 → 「빈」이 적혔을 때만 빈 그림 → 그 밖은 임시 그림', () => {
  // ① 그림 말이 가리키는 그림 (F~S 전부, 빈)
  for (const g of ['F', 'E', 'D', 'C', 'B', 'A', 'S']) assert.equal(pic('빈 꿈결 수집기', `꿈결 수집기 ${g}등급`), `꿈결 수집기 ${g}등급`, `그림 말 ${g}`);
  assert.equal(pic('고순도 꿈결 수집기', '괴이/꿈결 수집기 A등급/dream collector'), '꿈결 수집기 A등급');
  assert.equal(pic('고순도 꿈결 수집기', '빈 꿈결 수집기'), '빈 꿈결 수집기', '비웠다고 그림 말을 바꾸면 빈 그림');
  // ② 이름에 등급
  assert.equal(pic('꿈결 수집기 B등급', 'dream collector'), '꿈결 수집기 B등급');
  assert.equal(pic('꿈결 수집기 (S급)', ''), '꿈결 수집기 S등급');
  // ③ 「빈」이 적혔을 때만 빈 그림
  assert.equal(pic('빈 꿈결 수집기', 'dream collector', { desc: '괴담을 빠져나오거나 끝내면 꿈결로 차는 주사기 모양 눈금 실린더' }), '빈 꿈결 수집기', '시작 소지품');
  assert.equal(pic('꿈결 수집기', '', { desc: '아직 빈 원통' }), '빈 꿈결 수집기');
  // ④ 사용자 예 (22:23): 등급이 글에 없다 → 빈 그림이 아니고, 낱말(고순도·고농도·어둠·어스름)로 등급을 고르지도 않는다 → 임시 그림
  const ex = pic('고순도 꿈결 수집기', 'dream collector', { desc: '스웨디시 어둠 현장에서 추출된 고농도의 붉은 꿈결 액체가 가득 찬 실린더' });
  assert.equal(ex, `꿈결 수집기 ${ITEM_FORM_DEFAULT}등급`);
  assert.notEqual(ex, '빈 꿈결 수집기');
  assert.equal(pic('꿈결 수집기', ''), `꿈결 수집기 ${ITEM_FORM_DEFAULT}등급`, '등급 없는 말 「꿈결 수집기」가 빈 그림으로 가던 것');
  // 묶음 물건이 아닌 것은 그대로
  assert.equal(pic('꿈결 수집기 보관함', ''), pic('꿈결 수집기 보관함', '', {}));
  assert.ok(pic('손전등', '기기/손전등/flashlight').startsWith('손전등'));
  assert.equal(pic('재생 물약 B등급', ''), '재생 물약 B등급');
});

test('갱신기가 그림을 다시 고른다: update 의 그림 말이 저장되고, 「빈 …」 이름은 「빈」이 떼인다. 새 이름으로 new 가 와도 빈 줄이 그 줄로 바뀐다 (둘 다 남지 않게)', () => {
  let s = addItem(empty, alive, { name: '빈 꿈결 수집기', desc: '괴담을 빠져나오면 꿈결로 차는 실린더', icon: 'dream collector', weight: 0.2, from: 'manual', anchor: '' });
  const id = s.list[0].id;
  const u = applyItemChanges(s, alive, [ch({ anchor: 'c2', name: '빈 꿈결 수집기', action: 'update', desc: '붉은 꿈결이 눈금 끝까지 찬 실린더', icon: '꿈결 수집기 A등급' })], { order });
  assert.deepEqual([u.list[0].name, u.list[0].icon, u.list[0].id], ['꿈결 수집기', '꿈결 수집기 a등급', id], '그림 말은 소문자로 저장된다 (cleanIcon)');
  assert.equal(pic(u.list[0].name, u.list[0].icon, { desc: u.list[0].desc }), '꿈결 수집기 A등급');
  assert.equal(u.list[0].grade, undefined, '등급을 물건의 사실로 저장하지 않는다');
  assert.equal(u.list[0].form, undefined);
  // 다음 턴에 본문이 등급을 적으면 갱신기가 그 그림으로 바꾼다 (본문이 이긴다)
  const u2 = applyItemChanges(u, alive, [ch({ anchor: 'c3', name: '꿈결 수집기', action: 'update', desc: 'B등급 판정을 받은 꿈결 수집기', icon: '꿈결 수집기 B등급', quote: '판정 결과는 B등급이었다' })], { order });
  assert.equal(pic(u2.list[0].name, u2.list[0].icon), '꿈결 수집기 B등급');
  // 비우면 빈 그림
  const u3 = applyItemChanges(u2, alive, [ch({ anchor: 'c3', name: '꿈결 수집기', action: 'update', desc: '꿈결을 납부해 빈 실린더', icon: '빈 꿈결 수집기' })], { order });
  assert.equal(pic(u3.list[0].name, u3.list[0].icon), '빈 꿈결 수집기');
  // 다른 물건의 그림 말로 바뀐 것이면 이름은 그대로
  const o = applyItemChanges(s, alive, [ch({ anchor: 'c2', name: '빈 꿈결 수집기', action: 'update', icon: '의료/주사기/syringe' })], { order });
  assert.equal(o.list[0].name, '빈 꿈결 수집기');
  // new 로 온 「고순도 꿈결 수집기」: 빈 줄을 바꾼다
  const n = applyItemChanges(s, alive, [ch({ anchor: 'c2', name: '고순도 꿈결 수집기', action: 'new', desc: '스웨디시 어둠 현장에서 추출된 고농도의 붉은 꿈결 액체가 가득 찬 실린더', icon: '괴이/꿈결 수집기 A등급/dream collector', quote: '눈금 끝까지 찰랑거리며 가득 차 있었다' })], { order });
  assert.equal(liveItems(n, alive).length, 1);
  assert.deepEqual([n.list[0].id, n.list[0].name, n.list[0].weight], [id, '고순도 꿈결 수집기', 0.2]);
  assert.equal(pic(n.list[0].name, n.list[0].icon, { desc: n.list[0].desc }), '꿈결 수집기 A등급');
});

test('그림 말은 본편 요청에 가지 않는다 (그림일 뿐): [Inventory] 글에 그림 말·등급 그림 이름이 없다', () => {
  let s = addItem(empty, alive, { name: '고순도 꿈결 수집기', desc: '붉은 꿈결이 가득 찬 실린더', icon: '괴이/꿈결 수집기 A등급/dream collector', from: 'story', anchor: 'c1' });
  const e = s.list[0];
  for (const detail of ['full', 'state', 'name']) assert.ok(!/A등급|dream collector|괴이\//.test(itemLine(e, undefined, false, detail)), detail);
  const block = itemsBlock(liveItems(s, alive), { slots: 16, limit: 'x', always: true });
  assert.ok(block.includes('고순도 꿈결 수집기') && !/A등급|dream collector/.test(block));
  const chat = { message: [{ role: 'user', data: 'a', chatId: 'u1' }, { role: 'char', data: 'b', chatId: 'c1' }], scriptstate: { ...itemsVars(s) } };
  const text = inventoryText(chat);
  assert.ok(text.includes('고순도 꿈결 수집기') && !/A등급|dream collector/.test(text), text);
  // 갱신기 자료에는 고를 수 있는 그림 이름이 간다 (그림 팩이 있을 때)
  const now = itemsNowOf(chat, (n, i) => itemPictureNames(pack, n, i));
  assert.equal(now[0].pictures.length, 8);
  assert.equal(itemsNowOf(chat)[0].pictures, undefined);
});

test('등급 말: 「B등급」「B급」·이름+「등급」만 등급. 「어둠 현장」「어둠 속」은 아님. 부정·견줌 꼴은 인정 안 함. 본문에 없는 등급 말은 이름·설명에서 뺀다', () => {
  const q = '예나의 고유 번호가 찍힌 플라스틱 실린더 안에는, 일반 어스름 등급에서는 결코 나올 수 없는 기괴할 정도로 검붉고 찬란한 고농도의 꿈결 액체가 눈금 끝까지 찰랑거리며 가득 차 있었다.';
  assert.deepEqual(gradeHits(q).map((h) => [h.g, h.not]), [['C', true]]);
  assert.equal(gradeInQuote(q, 'C'), false, '「어스름 등급에서는 … 나올 수 없는」은 어스름이 아니라는 말');
  assert.deepEqual(gradeHits('스웨디시 어둠 현장에서 추출된 고농도의 붉은 꿈결 액체가 가득 찬 실린더'), [], '어둠 현장 = 괴이를 가리키는 말, 등급 아님');
  assert.deepEqual(gradeHits('어둠 속에서 주운 것'), []);
  assert.equal(gradeInQuote('판정 결과는 B등급이었다', 'B'), true);
  assert.equal(gradeInQuote('어둠 등급 괴담', 'B'), true);
  assert.equal(gradeInQuote('[화요 퀴즈쇼 / 어스름(D) 등급]', 'D'), true, '괄호에 글자가 있으면 그 글자');
  assert.equal(gradeInQuote('C급보다 진한 색', 'C'), false);
  assert.equal(gradeInQuote('B등급이 아닌 것 같았다', 'B'), false);
  assert.equal(gradeInQuote('S급 판정', 'A'), false);
  // 빼기
  assert.deepEqual(stripGrades('B등급 꿈결이 가득 찬 실린더', q), { text: '꿈결이 가득 찬 실린더', cut: ['B등급'] });
  assert.deepEqual(stripGrades('꿈결 수집기 (A급)', q).text, '꿈결 수집기');
  assert.deepEqual(stripGrades('어둠 등급의 꿈결이 찬 실린더', q).cut, ['어둠 등급']);
  assert.deepEqual(stripGrades('B등급 판정을 받은 수집기', '판정 결과는 B등급이었다'), { text: 'B등급 판정을 받은 수집기', cut: [] }, '본문에 적힌 등급은 둔다');
  assert.deepEqual(stripGrades('어둠 현장에서 추출된 고농도 꿈결', q).cut, [], '등급 말이 아닌 것은 건드리지 않는다');
});
