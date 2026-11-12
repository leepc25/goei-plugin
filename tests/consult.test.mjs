// 설정 창 AI 상담의 셈 (src/core/consult.ts): 응답 읽기 · 값 대조(목록에 없는 설정, 고를 수 없는 값, 범위 밖 수) · 요청문에 들어가는 것.
// 실행: node --test tests/consult.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-consult-'));
await build({ entryPoints: ['src/core/consult.ts'], outdir: dir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, loader: { '.txt': 'text' }, logLevel: 'silent' });
const { parseConsult, checkConsult, consultValue, consultLabel, consultPrompt, CONSULT_MAX } = await import(pathToFileURL(join(dir, 'consult.mjs')));

const ITEMS = [
  { id: 'pp.on', group: '메인 요청 전 · 인물', name: '사용', kind: 'pick', cur: '1', opts: [['1', 'ON'], ['0', 'OFF']] },
  { id: 'pp.director', group: '메인 요청 전 · 인물', name: 'Director', kind: 'pick', cur: 'facts', opts: [['off', '사용 안 함'], ['note', '메모형(뒤)'], ['facts', '사실형(앞)'], ['scene', '연출형(앞)']], calls: '1회', help: '설명' },
  { id: 'board.gn.auto', group: '메인 응답 뒤 · 괴담톡 · 인터넷 · 위키', name: '괴담넷 · 자동 호출', kind: 'pick', cur: '1', opts: [['1', '수동'], ['open', '창을 열 때'], ['0', '매 턴']] },
  { id: 'gen.retries', group: '생성 공통', name: '형식 오류 재시도', kind: 'step', cur: '1', lo: 0, hi: 3, unit: '회' },
  { id: 'gen.reiterate', group: '생성 공통', name: '다시 보기', kind: 'step', cur: '0', lo: 0, hi: 2, unit: '회', zero: '안 함' },
];

test('응답 읽기: <say> · <set> · <apply>', () => {
  const r = parseConsult('<say>바꿀까요?</say>\n<set>\npp.director=메모형(뒤)\n[gen.retries] = 2회\n쓸데없는 줄\n</set>');
  assert.equal(r.say, '바꿀까요?');
  assert.deepEqual(r.set, [{ id: 'pp.director', raw: '메모형(뒤)' }, { id: 'gen.retries', raw: '2회' }]);
  assert.equal(r.apply, false);
  assert.equal(parseConsult('<say>바꿨어요</say><apply>yes</apply>').apply, true);
  assert.equal(parseConsult('<say>아니요</say><apply>no</apply>').apply, false);
  assert.throws(() => parseConsult('그냥 글'), /say/);
  assert.throws(() => parseConsult('<say>  </say>'), /say/);
});

test('값 대조: 보이는 이름·켬끔·수·0일 때의 말만 받는다', () => {
  const by = (id) => ITEMS.find((i) => i.id === id);
  assert.equal(consultValue(by('pp.director'), '메모형(뒤)'), 'note');
  assert.equal(consultValue(by('pp.director'), '「메모형 (뒤)」'), 'note');
  assert.equal(consultValue(by('pp.director'), 'note'), 'note');
  assert.equal(consultValue(by('pp.director'), '없는값'), null);
  assert.equal(consultValue(by('pp.on'), '끔'), '0');
  assert.equal(consultValue(by('pp.on'), 'OFF'), '0');
  assert.equal(consultValue(by('board.gn.auto'), '매 턴'), '0');
  assert.equal(consultValue(by('gen.retries'), '2'), '2');
  assert.equal(consultValue(by('gen.retries'), '3회'), '3');
  assert.equal(consultValue(by('gen.retries'), '9'), null);
  assert.equal(consultValue(by('gen.retries'), '-1'), null);
  assert.equal(consultValue(by('gen.retries'), '2.5'), null);
  assert.equal(consultValue(by('gen.retries'), '많이'), null);
  assert.equal(consultValue(by('gen.reiterate'), '안 함'), '0');
  assert.equal(consultLabel(by('gen.reiterate'), '0'), '안 함');
  assert.equal(consultLabel(by('pp.on'), '0'), '끔');
  assert.equal(consultLabel(by('board.gn.auto'), '0'), '매 턴');
});

test('목록 대조: 없는 설정·못 고르는 값은 빠지고, 지금 값과 같은 것은 조용히 빠진다', () => {
  const { ok, bad } = checkConsult(ITEMS, [
    { id: 'nope.key', raw: '1' }, { id: '$pp_log', raw: '' }, { id: 'pp.director', raw: '없는값' }, { id: 'gen.retries', raw: '9' },
    { id: 'pp.on', raw: '켬' }, { id: 'board.gn.auto', raw: '매 턴' }, { id: 'gen.reiterate', raw: '1' }, { id: 'gen.reiterate', raw: '2' },
  ]);
  assert.deepEqual(ok, [{ id: 'board.gn.auto', value: '0' }, { id: 'gen.reiterate', value: '2' }]);
  assert.equal(bad.length, 4);
  assert.ok(bad[0].includes('nope.key') && bad[2].includes('Director') && bad[3].includes('형식 오류 재시도'));
});

test('한 번에 바꾸는 줄 수 한도', () => {
  const many = Array.from({ length: 14 }, (_, i) => ({ id: `x.${i}`, group: 'g', name: `줄${i}`, kind: 'pick', cur: 'a', opts: [['a', '가'], ['b', '나']] }));
  const { ok, bad } = checkConsult(many, many.map((m) => ({ id: m.id, raw: '나' })));
  assert.equal(ok.length, CONSULT_MAX);
  assert.ok(bad.some((b) => b.includes(`${CONSULT_MAX}개까지`)));
});

test('요청문: 설정 목록·지금 상태·바꾸자고 한 것·이 창의 대화만. 대사 예시 없음', () => {
  const m = consultPrompt({ items: ITEMS, summary: '턴마다 보조 호출 2회 · 메인 1회', pending: [{ id: 'pp.director', value: 'note' }], talk: [{ who: 'me', text: '토큰을 줄이고 싶어' }, { who: 'op', text: '바꿀까요?' }, { who: 'me', text: '응' }] });
  assert.equal(m.length, 2);
  assert.equal(m[0].role, 'system');
  assert.ok(m[0].content.includes('<say>') && m[0].content.includes('<apply>yes</apply>') && m[0].content.includes(`At most ${CONSULT_MAX} lines`));
  assert.ok(!/\{max\}/.test(m[0].content));
  // 지침에 대화 예시(따옴표로 든 한국어 대사)를 넣지 않는다
  assert.ok(!/[가-힣]/.test(m[0].content.replace(/\[설정 목록\]|\[지금 상태\]|\[바꾸자고 한 것\]|해요체/g, '')), '지침에 한국어 예시 문장이 없다');
  const u = m[1].content;
  assert.ok(u.includes('[pp.director] 메인 요청 전 · 인물 · Director | 지금: 사실형(앞) | 고를 수 있는 값: 사용 안 함 / 메모형(뒤) / 사실형(앞) / 연출형(앞) | 호출: 1회 | 설명: 설명'));
  assert.ok(u.includes('[gen.retries] 생성 공통 · 형식 오류 재시도 | 지금: 1회 | 고를 수 있는 값: 0~3회 (정수)'));
  assert.ok(u.includes('[pp.on] 메인 요청 전 · 인물 · 사용 | 지금: 켬 | 고를 수 있는 값: 켬 / 끔'));
  assert.ok(u.includes('[바꾸자고 한 것]\npp.director=메모형(뒤)'));
  assert.ok(u.trimEnd().endsWith('[사용자] 응'));
  assert.ok(consultPrompt({ items: ITEMS, summary: '', pending: [], talk: [] })[1].content.includes('[바꾸자고 한 것]\n(없음)'));
});
