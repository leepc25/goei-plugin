// NPC 자유 대화 두뇌 (src/game/action/npc/brain.ts) 시험. 스스로 묶어서 불러온다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'goei-npc-'));
const out = await build({ entryPoints: ['src/game/action/npc/brain.ts'], bundle: true, format: 'esm', platform: 'node', write: false, loader: { '.json': 'json' } });
writeFileSync(join(dir, 'npc.mjs'), out.outputFiles[0].text);
const B = await import(join(dir, 'npc.mjs'));
const SHEETS = JSON.parse(readFileSync('src/game/action/npc/sheets.json', 'utf8'));

const rel = (favor = 0) => ({ favor, met: 0, log: [], memo: [] });
const ctx = (id, t = {}, favor = 0) => ({ def: B.npcDef(id), target: { npc: id, place: '시험', ...t }, rel: rel(favor), hinted: new Set(), day: 3 });

test('답 읽기: 이름표·따옴표·지문·생각을 지우고 태그를 뽑는다', () => {
  const r = B.parseReply('<think>속으로</think>마덕희: "*팔짱을 낀다* 현금이면 돼요. (웃음)"\n[[호감 +1]] [[거래]]', '마덕희');
  assert.equal(r.text, '현금이면 돼요.');
  assert.deepEqual(r.tags.map((t) => t.kind), ['favor', 'trade']);
  const e = B.parseReply('Fine.\n[[favor -1]][[hostile]]', '누구');
  assert.deepEqual(e.tags.map((t) => t.kind), ['favor', 'hostile']);
  assert.ok(B.parseReply('가'.repeat(400), 'x').text.length <= 171);
  assert.equal(B.parseReply('좋아요.\n요원: 그럼 갑시다.', 'x').text, '좋아요.', '상대 대사를 이어 쓰면 자른다');
});

test('판정: 호감은 한 번에 ±1, 적대는 호감 -2 이하에서만', () => {
  const c = ctx('blaret', {}, -1);
  const e1 = B.decide([{ kind: 'favor', arg: '-3' }, { kind: 'hostile', arg: '' }], c);
  assert.equal(c.rel.favor, -2);
  assert.ok(e1.some((e) => e.kind === 'hostile'), '-1에서 -2로 떨어지면 적대 가능');
  const c2 = ctx('blaret', {}, 1);
  assert.ok(!B.decide([{ kind: 'hostile', arg: '' }], c2).some((e) => e.kind === 'hostile'), '호감 +1이면 적대 안 됨');
});

test('판정: 거래는 거래 버튼이 있을 때만, 적대면 동행·거래·선물 없음', () => {
  assert.equal(B.decide([{ kind: 'trade', arg: '' }], ctx('madeokhee')).length, 0);
  const t = { actions: [{ id: 'trade', label: '거래', run() {} }] };
  assert.equal(B.decide([{ kind: 'trade', arg: '' }], ctx('madeokhee', t))[0].kind, 'trade');
  const c = ctx('brownie', { canJoin: true }, -2);
  const e = B.decide([{ kind: 'hostile', arg: '' }, { kind: 'gift', arg: 'medkit' }], c);
  assert.deepEqual(e.map((x) => x.kind), ['hostile']);
});

test('판정: 단서는 주어진 목록에서 번호로만, 같은 만남에서 두 번 안 준다', () => {
  const hints = [{ id: 'r1', text: '인사하면 산다' }, { id: 'r2', text: '문은 셋째' }];
  const c = ctx('jyaldi', { hints });
  assert.equal(B.decide([{ kind: 'hint', arg: '2' }], c)[0].hint.id, 'r2');
  assert.equal(B.decide([{ kind: 'hint', arg: '2' }], c).length, 0, '이미 준 단서');
  assert.equal(B.decide([{ kind: 'hint', arg: '9' }], c).length, 0, '없는 번호');
});

test('판정: 선물은 하루 한 번, 허락된 물건만', () => {
  const c = ctx('brownie', {}, 2);
  assert.equal(B.decide([{ kind: 'gift', arg: 'rifle' }], c)[0]?.item, 'medkit', '목록에 하나뿐이면 그것');
  assert.equal(B.decide([{ kind: 'gift', arg: 'medkit' }], c).length, 0, '같은 날 두 번 안 됨');
});

test('판정: 동행은 호감 +1부터, 동행 불가 자리는 무시', () => {
  assert.equal(B.decide([{ kind: 'join', arg: '' }], ctx('leejaheon', { canJoin: true }, 0)).length, 0);
  assert.equal(B.decide([{ kind: 'join', arg: '' }], ctx('leejaheon', { canJoin: true }, 1))[0].kind, 'join');
  assert.equal(B.decide([{ kind: 'join', arg: '' }], ctx('leejaheon', {}, 3)).length, 0);
});

test('프롬프트: 시트·상황·태그 안내가 들어가고, minor 인물에만 미성년자 안전 줄이 붙는다', () => {
  const agent = { id: 'jyaldi', name: '쟈알디', title: '부장', voice: '짧고 건조하게' };
  // 콘쥬스는 2026-10-26부터 20세 (minor 아님)
  const m = B.buildPrompt({ def: B.npcDef('konjyuce'), target: { npc: 'konjyuce', place: '본부 2층', facts: ['본부 3일차'] }, sheet: 'SHEET', agent, rel: rel(1), meta: { events: ['괴이 「X」'] }, text: '안녕' });
  const s = m[0].content;
  assert.match(s, /SHEET/);
  assert.match(s, /본부 2층/);
  assert.doesNotMatch(s, /미성년자/);
  assert.match(s, /괴이 「X」/);
  const minor = B.buildPrompt({ def: { ...B.npcDef('konjyuce'), minor: true }, target: { npc: 'konjyuce', place: '본부' }, agent, rel: rel(1), text: '안녕' })[0].content;
  assert.match(minor, /미성년자/);
  assert.equal(m.at(-1).content, '안녕');
  const h = B.buildPrompt({ def: B.npcDef('jyaldi'), target: { npc: 'jyaldi', place: '본부', hints: [{ id: 'a', text: '첫 단서' }], allow: ['hint'] }, agent, rel: rel(), text: '?' })[0].content;
  assert.match(h, /1\) 첫 단서/);
  assert.doesNotMatch(h, /\[\[호감/, '허락 안 된 태그는 안내하지 않는다');
});

test('시트: 외모 칸을 빼고 2600자 안으로, 명단의 시트 이름은 모두 있다', () => {
  const t = B.trimSheet('@@depth 0\n#### Appearance\n- 키 큼\n#### Background\n- a\n- b\n- c\n#### Personality\n- 침착');
  assert.doesNotMatch(t, /키 큼|@@/);
  assert.match(t, /침착/);
  assert.doesNotMatch(t, /- c/);
  for (const [id, d] of Object.entries(B.ROSTER ?? {})) if (d.sheet) assert.ok(SHEETS[d.sheet], `${id} 시트 ${d.sheet}`);
  for (const v of Object.values(SHEETS)) assert.ok(v.length <= 2600);
});

test('관계: 저장·불러오기, 이름 없는 사람은 판이 끝나면 잊는다', () => {
  let saved = null;
  const st = { load: () => saved, save: (s) => (saved = s) };
  const r = new B.Relations(st);
  r.favor('blaret', 5);
  r.get('ps:1', true).favor = 2;
  r.save();
  r.forgetTemp();
  const r2 = new B.Relations(st);
  assert.equal(r2.get('blaret').favor, 3, '+3에서 멈춘다');
  assert.equal(r2.get('ps:1').favor, 0);
});
