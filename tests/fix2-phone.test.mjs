// 괴담톡 전수검사 11-13 고침: JSON 뒤 군말·닫히지 않은 칸, 넣을 공지 0개, 수다 줄 수 상한
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix2/phone';
await mkdir(dir, { recursive: true });
await build({
  entryPoints: ['src/core/phone.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const P = await import(pathToFileURL(join(dir, 'core/phone.mjs')));

const room = (kind, members) => ({ id: `${kind}_1`, kind, members, people: Object.fromEntries(members.map((c) => [c, { id: c, name: c }])), messages: [], draft: '', unread: 0 });
const add = (content, sender) => ({ op: 'add', path: '/messages/-', value: { content, sender, type: 'text' } });

test('decodeJson: JSON 뒤 군말·닫히지 않은 말버릇 칸은 버리고 읽는다', () => {
  assert.deepEqual(P.decodeJson('{"updates":[{"a":1}]}\n이상입니다.'), { updates: [{ a: 1 }] });
  assert.deepEqual(P.decodeJson('{"updates":[],"x":"}{"}\n<ph-habits>[{"sender":"c_1","note":"짧게'), { updates: [], x: '}{' });
  assert.deepEqual(P.decodeJson('[1,2,]\n끝'), [1, 2], '군말을 뗀 뒤 쉼표 고치기도 한다');
  assert.deepEqual(P.decodeJson('{"a":1}'), { a: 1 });
  assert.throws(() => P.decodeJson('{"updates":[{"a":1}'), /JSON 문법 오류/, '정말 끊긴 JSON은 그대로 실패');
  assert.deepEqual(P.parseHabits('{"a":1}\n<ph-habits>[{"sender":"c_1","note":"x"}'), [], '닫히지 않은 칸은 저장하지 않는다');
});

test('parseReply: 닫는 표식이 빠져도 읽는다', () => {
  const r = room('dm', ['c_1']);
  const raw = `<lb-minitalk-patch>${JSON.stringify([add('안녕', 'c_1'), add('뭐해', 'c_1')])}`;
  assert.deepEqual(P.parseReply(raw, r, false).events.map((e) => e.text), ['안녕', '뭐해']);
});

test('넣을 공지 0개면 공지를 싣지 않는다', () => {
  const st = P.blankState();
  const b = { version: 2, seq: 1, items: [1, 2, 3].map((id) => ({ id, order: id, read: true, channel: 'A00', channelName: '관리국', issuer: '총무과', category: '공지', title: `t${id}`, text: 'x', time: '' })), checks: {}, seen: {} };
  const old = P.HISTORY.contextNotices;
  try {
    P.HISTORY.contextNotices = 0;
    const out = P.mainContext(st, b, P.phoneSettings({}), 'R');
    assert.ok(!/announcement/.test(out), '공지 0개');
    P.HISTORY.contextNotices = 1;
    const one = JSON.parse(P.mainContext(st, b, P.phoneSettings({}), 'R').split('\n')[2]);
    assert.equal(one.records.filter((x) => x.kind === 'announcement').length, 1);
  } finally {
    P.HISTORY.contextNotices = old;
  }
});

test('수다 줄 수가 12보다 크면 그 요청의 방 상한도 따라간다', () => {
  const state = { '$ph_banter_min': '20', '$ph_banter_max': '30' };
  assert.equal(P.eventCap(state, true), 30);
  assert.equal(P.eventCap(state, false), P.LIMITS.events);
  assert.equal(P.eventCap({}, true), P.LIMITS.events, '기본(6~12)은 그대로');
  const r = room('group', ['c_1', 'c_2']);
  const events = Array.from({ length: 25 }, (_, i) => ({ type: 'message', sender: i % 2 ? 'c_1' : 'c_2', text: `말${i}` }));
  assert.equal(P.keepValid(events, r).length, P.LIMITS.events);
  assert.equal(P.keepValid(events, r, [], 30).length, 25);
});
