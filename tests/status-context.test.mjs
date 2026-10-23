import test from 'node:test';
import assert from 'node:assert/strict';
import { withStatusBlock, lastStatusLine, stripStatusLines, STATUS_HEAD } from '../dist-test/core.mjs';

const S1 = '[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음|없음|없음]';
const S2 = '[▣|2025.01.01|03:10 AM|☀️|4°C|관리국 본부|소라 랜드|쟈알디|없음]';
const chat = () => [
  { role: 'system', content: '지침' },
  { role: 'assistant', content: `첫 장면 글.\n${S1}` },
  { role: 'user', content: '본부로 간다' },
  { role: 'assistant', content: `둘째 장면 글.\n${S2}` },
  { role: 'user', content: '목표를 확인한다' },
];

test('마지막 상태창 줄만 남기고 지난 줄은 지운다', () => {
  const out = withStatusBlock(chat());
  const text = out.map((m) => m.content).join('\n---\n');
  assert.ok(!text.includes(S1));
  assert.equal(out.filter((m) => m.content.includes('[▣|')).length, 1);
  assert.ok(out.find((m) => m.content.startsWith(STATUS_HEAD)).content.includes(S2));
});

test('블록은 마지막 사용자 메시지 바로 앞에 들어간다', () => {
  const out = withStatusBlock(chat());
  assert.equal(out.at(-1).content, '목표를 확인한다');
  assert.ok(out.at(-2).content.startsWith(STATUS_HEAD));
});

test('본문은 그대로 남는다', () => {
  const out = stripStatusLines(chat());
  assert.equal(out[1].content, '첫 장면 글.');
  assert.equal(out[3].content, '둘째 장면 글.');
});

test('다시 굴리기: 마지막 응답이 요청에 없으면 그 직전 줄이 들어간다', () => {
  const m = chat().slice(0, 3);
  assert.equal(lastStatusLine(m), S1);
  const out = withStatusBlock(m);
  assert.ok(out.find((x) => x.content.startsWith(STATUS_HEAD)).content.includes(S1));
});

test('상태창이 하나도 없으면 아무것도 바꾸지 않는다', () => {
  const m = [{ role: 'assistant', content: '글' }, { role: 'user', content: '입력' }];
  assert.deepEqual(withStatusBlock(m), m);
});

test('두 번 불러도 블록이 하나', () => {
  const once = withStatusBlock(chat());
  assert.equal(withStatusBlock(once).length, once.length);
});

test('옛 6칸 상태창도 마지막 줄로 쓴다', () => {
  const old = '[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|소라 랜드]';
  const out = withStatusBlock([{ role: 'assistant', content: `글\n${old}` }, { role: 'user', content: '입력' }]);
  assert.ok(out.find((x) => x.content.startsWith(STATUS_HEAD)).content.includes(old));
});
