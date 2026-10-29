// 대사와 컷신 순수 로직 시험. 시험 번들은 스스로 만든다 (통합 빌드에 기대지 않음).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoryPure } from '../scripts/build-story.mjs';
await buildStoryPure('dist-test/story.mjs');
const S = await import('../dist-test/story.mjs');

const seq = (...v) => {
  let i = 0;
  return () => v[i++ % v.length];
};
const ctxFor = (agent, flags = {}, rng = Math.random) => ({
  flags,
  agent,
  rng,
  speakerName: (w) => S.castOf(w, agent).name,
  agentLine: (a, tag, r) => S.lookupLine(a, tag, flags, r),
  emitted: [],
  emit(e, a) {
    this.emitted.push([e, a]);
  },
});
/** 선택지는 매번 picks에서 하나씩, 말은 넘긴다. 끝까지 돌린 대사 목록 */
function play(lib, id, ctx, picks = []) {
  const r = new S.StoryRunner(lib, ctx);
  const said = [];
  let s = r.start(id);
  for (let g = 0; g < 400 && s.kind !== 'end'; g++) {
    if (s.kind === 'say') {
      said.push(`${s.name}: ${s.text}`);
      s = r.next();
    } else s = r.choose(s.options[Math.min(picks.shift() ?? 999, s.options.length - 1)].index);
  }
  assert.equal(s.kind, 'end', `${id} 끝남`);
  return said;
}

test('대본 형식: 말·무작위·선택지·조건·set·goto·call·emit', () => {
  const lib = new S.ScriptLibrary().add(`
=== a
jaemtri(smile): 안녕 {name}
~ narr: 하나
~ narr: 둘
* 가 -> x [set n += 2]
* 나 -> y [if n > 5]
-- x
> set n += 1
> goto z if n == 3
narr: 안 나옴
-- y
-- z
> emit hi {n}
> call b
narr: 끝 {n}
=== b
narr: 비
`);
  assert.deepEqual(lib.validate(), []);
  const ctx = ctxFor('eileen', {}, seq(0.9));
  const r = new S.StoryRunner(lib, ctx);
  let s = r.start('a');
  assert.equal(s.text, '안녕 에일린');
  assert.equal(s.mood, 'smile');
  s = r.next();
  assert.equal(s.text, '둘');
  s = r.next();
  assert.equal(s.kind, 'choice');
  assert.equal(s.options.length, 1, '조건 안 맞는 선택지는 숨김');
  s = r.choose(s.options[0].index);
  assert.equal(s.text, '비');
  assert.deepEqual(ctx.emitted, [['hi', '3']]);
  s = r.next();
  assert.equal(s.text, '끝 3');
  assert.equal(r.next().kind, 'end');
  assert.equal(ctx.flags.d100, undefined, '주사위 값은 끝나면 지움');
  assert.equal(ctx.flags['seen.a'], 1);
});

test('조건식', () => {
  const f = { a: 2, s: 'jyaldi', t: true };
  assert.equal(S.evaluate("a >= 2 && s == 'jyaldi'", f), true);
  assert.equal(S.evaluate('!t || a < 1', f), false);
  assert.equal(S.evaluate('(a + 1) - 3 == 0', f), true);
  assert.equal(S.evaluate('없는값 == 0', f), true);
  assert.throws(() => S.evaluate('a ==', f));
});

test('요원 8명 × 대사표 태그 전부 있다', () => {
  const tags = ['offer', 'brief', 'enter', 'enter_elevator', 'greet', 'called', 'combat', 'boss', 'kill', 'ult', 'hp_low', 'ammo_low', 'ammo_empty', 'find', 'rule_break', 'intrude_fake', 'intrude_daydream', 'rescue', 'win', 'evac', 'settle'];
  for (const a of S.AGENT_IDS) {
    for (const t of tags) assert.ok(S.AGENT_LINES[a][t]?.length, `${a}.${t}`);
    for (const lines of Object.values(S.AGENT_LINES[a])) for (const l of lines) assert.ok(l.length > 0 && l.length <= 80, `${a}: ${l}`);
  }
});

test('말풍선 감독: 간격·태그 쿨다운·확률', () => {
  const p = new S.BarkPicker(() => 0);
  assert.ok(p.pick('combat:start', 'jyaldi', 0));
  assert.equal(p.pick('combat:kill', 'jyaldi', 1), null, '기본 간격 안');
  assert.ok(p.pick('hp:low', 'jyaldi', 1.5), '우선순위 높으면 짧은 간격');
  assert.equal(p.pick('hp:low', 'jyaldi', 10), null, '체력 낮음 25초 쿨다운');
  assert.ok(p.pick('hp:low', 'jyaldi', 30));
  const never = new S.BarkPicker(() => 0.99);
  assert.equal(never.pick('combat:kill', 'eileen', 100), null, '확률');
  assert.equal(p.pick('없는사건', 'eileen', 100), null);
  for (const e of Object.keys(S.EVENT_RULES)) for (const a of S.AGENT_IDS) assert.ok(S.agentLine(a, S.EVENT_RULES[e].tag, () => 0), `${e} ${a}`);
});

test('컷신 시퀀서: 시간 순서, 대화 기다림, 동시 진행, 건너뛰기', () => {
  const log = [];
  let talking = false;
  const io = {
    bg: (s) => log.push(`bg ${s}`),
    fade: (t, ms) => log.push(`fade ${t} ${ms}`),
    caption: (t) => log.push(`cap ${t}`),
    actor: (id, to, ms) => log.push(`actor ${id} ${to.x ?? ''} ${ms}`),
    emit: (e, a) => log.push(`emit ${e} ${a}`),
    dialogue: (id) => {
      talking = true;
      log.push(`say ${id}`);
    },
    line: () => {},
    agentLine: () => {},
    talking: () => talking,
    closeDialogue: () => {
      talking = false;
    },
  };
  const def = { id: 't', title: 't', form: '도트', steps: [{ k: 'bg', scene: 'a' }, { k: 'wait', ms: 500 }, { k: 'say', script: 's' }, { k: 'par', steps: [{ k: 'actor', id: 'x', x: 5, ms: 1000 }, { k: 'caption', text: 'c', ms: 400 }] }, { k: 'emit', event: 'done', arg: 't' }] };
  const c = new S.Cutscene(def, io);
  c.update(0.1);
  assert.deepEqual(log, ['bg a']);
  c.update(0.5);
  assert.equal(log.at(-1), 'say s');
  c.update(5);
  assert.equal(log.at(-1), 'say s', '대화 중엔 다음으로 안 감');
  talking = false;
  c.update(0.01);
  c.update(0.01);
  assert.deepEqual(log.slice(-2), ['actor x 5 1000', 'cap c']);
  c.update(0.5);
  assert.equal(c.done, false, '동시 진행은 가장 긴 것까지');
  c.update(0.6);
  assert.equal(log.at(-1), 'emit done t');
  assert.equal(c.done, true);
});

test('자유 대화: 모델 메시지 구성, 답 다듬기, 실패·지연 시 미리 쓴 답', async () => {
  const msgs = S.buildMessages('jaemtri', 'deadpole', { mission: 'm3', rules: 4 }, [], '커피 주세요');
  assert.equal(msgs[0].role, 'system');
  assert.ok(msgs[0].content.includes('잼트리') && msgs[0].content.includes('데드폴') && msgs[0].content.includes('m3'));
  assert.equal(msgs.at(-1).content, '커피 주세요');
  assert.equal(S.sanitize('잼트리: 「어머, 후배. *웃는다* 왔어?」', '잼트리'), '어머, 후배. 왔어?');
  assert.ok(!S.sanitize('응.\n데드폴: 네!', '잼트리').includes('데드폴'));
  assert.ok(S.sanitize('가'.repeat(400), '잼트리').length <= 161);

  let seen = null;
  const t = new S.FreeTalk({ model: async (m) => ((seen = m), '잼트리: 어머, 왔어?') });
  const r = await t.reply('jaemtri', '안녕', 'eileen', {});
  assert.deepEqual([r.source, r.text], ['model', '어머, 왔어?']);
  assert.ok(seen.length === 2);
  const r2 = await t.reply('jaemtri', '또', 'eileen', {});
  assert.equal(r2.source, 'model');
  assert.equal(t.history('jaemtri').length, 4, '대화 기록');

  const bad = new S.FreeTalk({ model: async () => Promise.reject(new Error('막힘')), rng: () => 0 });
  const r3 = await bad.reply('gognija', '블랙 커피', 'jyaldi', {});
  assert.equal(r3.source, 'offline');
  assert.ok(r3.text.includes('믹스커피'));
  const slow = new S.FreeTalk({ model: () => new Promise(() => {}), timeoutMs: 30 });
  const r4 = await slow.reply('elevator', '누구야', 'jyaldi', {});
  assert.equal(r4.source, 'offline');
  const none = new S.FreeTalk();
  for (const npc of Object.keys(S.PERSONAS)) assert.ok((await none.reply(npc, '안녕', 'eileen', {})).text.length > 0, npc);
});
