import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homeshop } from '../dist-test/core.mjs';
const { parseShow, applyShow, readShow, showVars, emptyShow, moodMap, hsSettings, HS_KEY, HS_NUM, parseClipGroups, clipsOf, idleState, nextIdle, moodClip, cueMs, installments } = homeshop;

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
