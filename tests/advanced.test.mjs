import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  advanced, budget, LIMITS, HISTORY, CONTEXT, phone, refreshPrompt, incomingPlan, gnetSettings, G_POST_BASE, CFG, wikiPrompt, wikiSettings, wikiMainContext,
  saveDoc, settings, mainContext, addUserPost, addOutgoingDm,
} from '../dist-test/core.mjs';

const REAL = '/mnt/project-files/analysis/extracted/module.json';
const realLore = existsSync(REAL) ? (() => { const m = JSON.parse(readFileSync(REAL, 'utf8')); return m.lorebook ?? m.module?.lorebook; })() : null;
const { advValue, advChanged, applyAdvanced, refToggles, budgetFor, genSettings, advResetVars } = advanced;

test('advanced: defaults match the original, invalid values fall back, changed keys are listed', () => {
  assert.equal(advValue({}, 'gn', 'dm_history'), '50');
  assert.equal(advValue({}, 'ph', 'cd_invite'), '3');
  assert.equal(advValue({ '$ph_adv_turns': '300' }, 'ph', 'turns'), '8', '범위 밖');
  assert.equal(advValue({ '$ph_adv_turns': '2.5' }, 'ph', 'turns'), '8', '소수');
  assert.equal(advValue({ '$ph_adv_turns': '3' }, 'ph', 'turns'), '3');
  assert.equal(advValue({ '$lb_cfg_lb-gn.incoming_chance': '35' }, 'gn', 'incoming_chance'), '35', '원래 있던 변수');
  assert.deepEqual(advChanged({ '$nw_adv_secondary': '0', '$nw_adv_ref_count': '20' }, 'nw'), ['secondary']);
  assert.deepEqual(refToggles({}, 'gn'), { description: true, authors: true, persona: true, active: true, related: false, secondary: false });
  assert.equal(advResetVars('gn')['$lb_cfg_lb-gn.incoming_chance'], '100', '원래 변수는 비우지 않고 기본값');
  assert.equal(advResetVars('gn')['$lb_cfg_lb-gn.adv_turns'], '');
  // 기능 상한이 0이면 공통 상한
  assert.equal(budgetFor({ '$gen_budget': '9000' }, 'ph'), 9000);
  assert.equal(budgetFor({ '$gen_budget': '9000', '$ph_adv_budget': '5000' }, 'ph'), 5000);
  assert.deepEqual(genSettings({}), { language: null, retries: 1, retryModel: 'same' });
  assert.equal(genSettings({ '$gen_lang': 'en' }).language, 'Write all output in English.');
  // 새 채팅 기본값으로 저장되는 변수
  for (const k of ['$ph_adv_turns', '$nw_adv_ctx_count', '$gen_lang', '$lb_cfg_lb-gn.adv_ctx_own', '$nw_context', '$ph_context_messages']) assert.ok(settings.PREF_VAR.test(k), k);
});

test('advanced: applyAdvanced sets the shared limits and puts them back', () => {
  applyAdvanced({ '$lb_cfg_lb-gn.adv_replies': '9', '$ph_adv_members': '20', '$ph_adv_cd_incoming': '0' });
  assert.equal(LIMITS.replies, 9);
  assert.equal(phone.LIMITS.members, 20);
  assert.equal(phone.COOLDOWN.incoming, 0);
  applyAdvanced({});
  assert.equal(LIMITS.replies, 4);
  assert.equal(phone.LIMITS.members, 9);
  assert.equal(HISTORY.dmHistory, 50);
  assert.equal(CONTEXT.tokens, 3000);
  assert.equal(phone.HISTORY.contextTokens, 4000);
});

test('advanced: main context respects 게시글·쪽지 toggles and 내가 쓴 것만', () => {
  const st = { seq: G_POST_BASE, posts: [], dms: [], sources: {} };
  addUserPost(st, '나', '내 글', '본문', '2025.05.13 14:00');
  st.posts.push({ id: G_POST_BASE + 9, date: '', nick: 'x', title: '남의 글', views: 0, votes: 0, body: 'b', mine: false, comments: [] });
  addOutgoingDm(st, 'x', '안녕', '');
  const recs = (state) => {
    applyAdvanced({ '$lb_cfg_lb-gn.adv_ctx_focus': '0', ...state });
    const t = mainContext(st, '나', 'R');
    return t ? JSON.parse(t.split('\n')[2]).records : [];
  };
  assert.equal(recs({}).length, 3);
  assert.deepEqual(recs({ '$lb_cfg_lb-gn.adv_ctx_own': '1' }).map((r) => r.title ?? r.kind).sort(), ['private_message', '내 글']);
  assert.equal(recs({ '$lb_cfg_lb-gn.adv_ctx_dms': '0' }).filter((r) => r.kind === 'private_message').length, 0);
  assert.equal(recs({ '$lb_cfg_lb-gn.adv_ctx_posts': '0', '$lb_cfg_lb-gn.adv_ctx_dms': '0' }).length, 0);
  applyAdvanced({});
});

test('budget: fitPrompt trims step by step and fails clearly when it cannot fit', () => {
  const seen = [];
  const build = () => {
    seen.push([budget.trimPrevious(), budget.trimSecondary(), budget.trimRelated(), budget.trimTurns(8)]);
    return { messages: [{ content: '가'.repeat(100 * budget.trimTurns(8) + (budget.trimPrevious() ? 0 : 500)) }] };
  };
  const p = budget.fitPrompt(450, build);
  assert.ok(budget.promptTokens(p) <= 450);
  assert.deepEqual(seen[0], [false, false, false, 8]);
  assert.deepEqual(seen.at(-1), [true, true, true, 4]);
  assert.equal(budget.trimTurns(8), 8, '끝나면 단계가 0으로');
  assert.throws(() => budget.fitPrompt(10, build), budget.BudgetError);
  assert.equal(budget.fitPrompt(0, build).messages.length, 1, '0이면 그대로');
});

test('advanced: real card prompts follow reference toggles, persona, turns and language', { skip: !realLore }, () => {
  const base = { $st_faction: 'B00', $an_report: '소라 랜드 발생' };
  const chat = (extra) => ({ message: [{ role: 'user', data: '첫 턴' }, { role: 'char', data: '응답 하나' }, { role: 'user', data: '둘째 턴' }], scriptstate: { ...base, ...extra }, note: '노트' });
  const src = (extra) => ({ char: { name: '괴이봇', desc: '봇 설명 글', globalLore: realLore }, chat: chat(extra), persona: '키가 큰 탐정' });
  const st = { seq: G_POST_BASE, posts: [], dms: [], sources: {} };
  const run = (extra) => {
    const s = src(extra);
    const r = refreshPrompt(s, st, incomingPlan(s.chat, st, gnetSettings(s.chat.scriptstate), '나', () => 0), '나', {});
    return r.messages.map((m) => m.content);
  };
  let [sys, user] = run({});
  assert.ok(user.includes('[공통: 봇 설명]') && user.includes('[공통: 작가 노트]') && user.includes('[공통: 사용자 페르소나]\n키가 큰 탐정'));
  assert.ok(user.includes('[user]\n첫 턴'));
  [sys, user] = run({ [CFG('adv_desc')]: '0', [CFG('adv_persona')]: '0', [CFG('adv_turns')]: '1', '$gen_lang': 'ja' });
  assert.ok(!user.includes('[공통: 봇 설명]') && !user.includes('사용자 페르소나') && user.includes('[공통: 작가 노트]'));
  assert.ok(!user.includes('첫 턴') && user.includes('둘째 턴'), '마지막 1턴만');
  assert.ok(sys.endsWith('Write all output in Japanese.'));
  assert.ok(user.includes('[활성 로어북: 현재 발생 상황]'), '상시 로어북을 꺼도 앱 자료는 남음');
  [, user] = run({ [CFG('adv_turns')]: '0' });
  assert.ok(!user.includes('첫 턴') && !user.includes('둘째 턴'), '0이면 본편을 보지 않음');
  // 위키: 이전 문서는 상한에 걸리면 가장 먼저 빠진다
  const w = src({});
  const req = { title: '소라 랜드', inherited: [], previous: `<lightboard-namuwiki>${'옛 본문 '.repeat(4000)}</lightboard-namuwiki>`, writingRequest: '', direct: false };
  const full = wikiPrompt(w, req, wikiSettings(w.chat.scriptstate), {});
  assert.ok(full.messages[1].content.includes('[이전 위키'));
  const cap = budget.promptTokens(full) - 1000;
  const fit = budget.fitPrompt(cap, () => wikiPrompt(w, req, wikiSettings(w.chat.scriptstate), {}));
  assert.ok(!fit.messages[1].content.includes('[이전 위키') && budget.promptTokens(fit) <= cap);
  applyAdvanced({});
});

test('advanced: wiki main context sends the newest chat documents within the count and token cap', () => {
  let chat = { message: [], scriptstate: {}, localLore: [] };
  const orig = { '$nw_adv_ctx_focus': '0', '$nw_adv_ctx_count': '1' };
  const meta = (title, created) => ({ title, mode: 'expand', model: 'main', created, length: 'short', sources: [], primarySources: [], writingRequest: '', direct: false });
  const body = (t) => `<lightboard-namuwiki>[Paragraph]${t}</lightboard-namuwiki>`;
  chat = saveDoc(chat, meta('옛 문서', 10), body('옛'));
  chat = saveDoc(chat, meta('새 문서', 20), body('새'));
  const rec = (c) => JSON.parse(wikiMainContext(c, 'R').split('\n')[2]).records;
  chat.scriptstate = orig;
  assert.deepEqual(rec(chat).map((r) => r.title), ['새 문서']);
  chat.scriptstate = { ...orig, '$nw_adv_ctx_count': '2' };
  assert.deepEqual(rec(chat).map((r) => r.title), ['옛 문서', '새 문서']);
  assert.equal(rec(chat)[1].kind, 'wiki_reference');
  chat.scriptstate = { ...orig, '$nw_adv_ctx_count': '2', '$nw_adv_ctx_tokens': '1' };
  assert.equal(wikiMainContext(chat, 'R'), '');
});

test('budget: fitTotal splits the main-story total by each feature cap and gives unused share to the rest', () => {
  // 길이 n 토큰짜리 글을 상한 안에서 만든다 (한글 1자 = 1토큰)
  const part = (cap, want) => ({ cap, build: (c) => '가'.repeat(c > 0 ? Math.min(want, c) : want) });
  const sizes = (r) => r.map((t) => t.length);
  assert.deepEqual(sizes(budget.fitTotal([part(4000, 4000), part(3000, 3000)], 0)), [4000, 3000], '0이면 그대로');
  assert.deepEqual(sizes(budget.fitTotal([part(4000, 4000), part(3000, 3000)], 7000)), [4000, 3000], '안 넘치면 그대로');
  assert.deepEqual(sizes(budget.fitTotal([part(4000, 4000), part(4000, 4000)], 4000)), [2000, 2000], '비율대로');
  // 적게 쓰는 기능의 남는 몫은 다른 기능에
  assert.deepEqual(sizes(budget.fitTotal([part(4000, 500), part(4000, 4000)], 3000)), [500, 2500]);
  assert.ok(sizes(budget.fitTotal([part(4000, 4000), part(3000, 3000), part(8000, 8000)], 5000)).reduce((a, b) => a + b) <= 5000);
});
