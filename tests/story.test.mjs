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

test('모든 대본이 읽히고 표지·call이 전부 맞다', () => {
  const lib = S.buildLibrary();
  assert.deepEqual(lib.validate(), []);
  assert.ok(lib.scripts.size >= 25, `대본 ${lib.scripts.size}개`);
  for (const c of Object.values(S.CUTSCENES))
    for (const st of c.steps.flatMap((x) => (x.k === 'par' ? x.steps : [x]))) if (st.k === 'say') assert.ok(lib.scripts.has(st.script), `${c.id} → ${st.script}`);
});

test('요원 8명 × 대사표 태그 전부 있고 호명 3·총애 높낮이 2줄씩', () => {
  const tags = ['offer', 'brief', 'enter', 'enter_elevator', 'greet', 'called', 'combat', 'boss', 'kill', 'ult', 'hp_low', 'ammo_low', 'ammo_empty', 'find', 'rule_break', 'intrude_fake', 'intrude_daydream', 'rescue', 'win', 'evac', 'settle'];
  for (const a of S.AGENT_IDS) {
    for (const t of tags) assert.ok(S.AGENT_LINES[a][t]?.length, `${a}.${t}`);
    assert.equal(S.CALLS[a].length, 3, `${a} 호명`);
    assert.ok(S.FAVOR_LINES[a].high.length >= 2 && S.FAVOR_LINES[a].low.length >= 2);
    assert.ok(S.CALLS[a].every((l) => l.includes(S.AGENTS[a].name)), `${a} 호명에 이름`);
    for (const lines of Object.values(S.AGENT_LINES[a])) for (const l of lines) assert.ok(l.length > 0 && l.length <= 80, `${a}: ${l}`);
  }
});

test('모든 요원 × 주요 대본이 끝까지 돌고 빈 대사가 없다', () => {
  const lib = S.buildLibrary();
  const ids = ['jaemtri_desk', 'briefing', 'offer', 'supply', 'appraisal', 'lab', 'breakroom', 'settle', 'evac_wake', 'board', 'deal', 'attic', 'passenger_three', 'passenger_pair', 'passenger_supply', 'passenger_signs', 'passenger_missing', 'mirror', 'exit_panel', 'cs_first_day', 'cs_first_entry', 'cs_first_call', 'cs_evac', 'cs_exit'];
  for (const a of S.AGENT_IDS)
    for (const id of ids)
      for (const pick of [0, 1, 2, 3])
        for (const honest of [0, 1]) {
          const flags = { favor: pick - 1, rules: pick * 3, mission: `m${pick + 1}`, honest, liar: honest ? 'a' : 'b', loot: 1, unsent: 1, depth: 4, ftype: 'chase', result: ['return', 'retreat', 'evac'][pick % 3], male: a === 'gorgodio' || a === 'kyuras' };
          const said = play(lib, id, ctxFor(a, flags, seq(0.1, 0.7, 0.4)), [pick, pick, pick, 0]);
          for (const l of said) {
            assert.ok(!/\{|\}|undefined|NaN/.test(l), `${a}/${id}: ${l}`);
            assert.ok(!/: $/.test(l), `${a}/${id} 빈 대사`);
          }
        }
});

test('잼트리 임무 게시판: 앞 임무를 끝내야 다음 임무가 열린다', () => {
  const lib = S.buildLibrary();
  const flags = { met_jaemtri: 1 };
  const r = new S.StoryRunner(lib, ctxFor('jyaldi', flags, seq(0)));
  let s = r.start('jaemtri_desk');
  while (s.kind === 'say') s = r.next();
  s = r.choose(0); // 게시판
  while (s.kind === 'say') s = r.next();
  assert.equal(s.options.length, 2);
  assert.ok(s.options[0].text.startsWith('[조사]') && s.options[1].text.startsWith('다시'));
  flags.done_m1 = flags.done_m2 = flags.done_m3 = 1;
  s = r.start('jaemtri_desk');
  while (s.kind === 'say') s = r.next();
  s = r.choose(0);
  while (s.kind === 'say') s = r.next();
  assert.equal(s.options.length, 4, 'm4·m5·m7 + 돌아가기');
});

test('승강기 탑승: 첫 탑승에만 호명, 인사로 총애가 오르고 -3~+3을 넘지 않는다', () => {
  const lib = S.buildLibrary();
  const flags = { favor: 2, depth: 4, ftype: 'trial' };
  const said1 = play(lib, 'board', ctxFor('eileen', flags, () => 0.01), [0]);
  assert.ok(said1.some((l) => l.includes('와이셔츠')), '첫 호명');
  assert.equal(flags.favor, 3);
  assert.ok(said1.some((l) => l.includes('다들 내리기만')), '총애 3: 외로움 한 줄');
  assert.ok(said1.some((l) => l.includes('벽에 숙제')), '총애 2 이상: 맞는 층 힌트');
  const said2 = play(lib, 'board', ctxFor('eileen', flags, () => 0.01), [0]);
  assert.equal(flags.favor, 3, '상한');
  assert.ok(!said2.some((l) => l.includes('와이셔츠') || l.includes('생일')), '두 번째 탑승은 호명 없음');
  flags.favor = -2;
  play(lib, 'board', ctxFor('eileen', flags), [1]);
  assert.equal(flags.favor, -3);
  const said3 = play(lib, 'board', ctxFor('eileen', flags), [1]);
  assert.equal(flags.favor, -3, '하한');
  assert.ok(said3.some((l) => l.includes('닫히지 않습니다')), '총애 -3: 갇힘');
});

test('호명은 같은 요원에게 3줄을 차례로', () => {
  const flags = {};
  const got = [0, 1, 2, 3].map(() => S.lookupLine('gorgodio', 'el:call', flags, Math.random));
  assert.equal(new Set(got.slice(0, 3)).size, 3);
  assert.equal(got[3], got[0]);
});

test('떠도는 승객: 로제몬은 거짓을 알아보고, 둘 중 사연 긴 쪽이 거짓이다', () => {
  const lib = S.buildLibrary();
  const lie = play(lib, 'passenger_three', ctxFor('rojemon', { honest: 0 }), [0]);
  assert.ok(lie.some((l) => l.startsWith('로제몬: 헛소리하지 마')));
  const ctx = ctxFor('eileen', { honest: 0 });
  play(lib, 'passenger_three', ctx, [0]);
  assert.deepEqual(ctx.emitted.at(-1), ['passenger', 'lure']);
  const ctx2 = ctxFor('eileen', { honest: 1 });
  play(lib, 'passenger_three', ctx2, [0]);
  assert.deepEqual(ctx2.emitted.at(-1), ['passenger', 'right']);
  for (const liar of ['a', 'b']) {
    const r = new S.StoryRunner(lib, ctxFor('kyuras', { liar }));
    let s = r.start('passenger_pair');
    const lens = [];
    while (s.kind === 'say') {
      if (s.who === 'passenger') lens.push(s.text.length);
      s = r.next();
    }
    const longIsA = lens[0] > lens[1];
    assert.equal(longIsA, liar === 'a', '긴 쪽이 거짓');
    const c = ctxFor('kyuras', { liar });
    play(lib, 'passenger_pair', c, [liar === 'a' ? 1 : 0]);
    assert.ok(c.emitted.some(([e, a]) => e === 'passenger' && a === 'right'));
    assert.equal(c.flags.rule_passenger, 1, '처음 맞히면 규칙서에 한 줄');
  }
});

test('EXIT: 조건 전에는 막히고, 다 채우면 출구 컷신', () => {
  const lib = S.buildLibrary();
  const c1 = ctxFor('jyaldi', { rules: 9, favor: 3, reached_b12: 1 });
  const said = play(lib, 'exit_panel', c1);
  assert.ok(said[0].includes('아직 안 돼요'));
  const c2 = ctxFor('jyaldi', { rules: 10, favor: 3, reached_b12: 1 });
  play(lib, 'exit_panel', c2);
  assert.deepEqual(c2.emitted, [['cutscene', 'exit']]);
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
  // 건너뛰기: 끝 상태만
  const log2 = [];
  const c2 = new S.Cutscene(S.CUTSCENES.first_entry, { ...io, bg: (s) => log2.push(s), emit: (e) => log2.push(e), dialogue: () => {}, talking: () => false, closeDialogue: () => {} });
  c2.update(0.01);
  c2.skip();
  assert.equal(c2.done, true);
  assert.equal(log2.at(-1), 'cutscene:done');
  assert.equal(log2.at(-2), 'lobby_wrong');
});

test('모든 컷신이 대화 없이 120초 안에 끝난다', () => {
  for (const def of Object.values(S.CUTSCENES)) {
    const c = new S.Cutscene(def, { dialogue: () => {}, line: () => {}, agentLine: () => {}, talking: () => false, closeDialogue: () => {} });
    for (let i = 0; i < 2400 && !c.done; i++) c.update(0.05);
    assert.ok(c.done, def.id);
  }
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
