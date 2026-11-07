// 인물 기록(리수폿 이식) 한 턴 실제 실행 시험 (2026-11-07 사용자 지시 「고장난 걸 찾으라」).
// 가짜 Risu(tests/qc-host.mjs)에서 가짜 모델 응답을 넣어 Router → Director → 본편 주입 → 응답 → 갱신기 → 읽음 표시까지 돌리고,
// 각 단계가 실제로 호출되는지·결과가 저장되는지 본다. 사용법: node tests/qc-people-live-browser.mjs <fixture.json>
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { launch, boot, startChat, request, output, setVars, runner, sceneOf } from './qc-host.mjs';

const fxPath = process.argv[2];
if (!fxPath) throw new Error('사용법: node tests/qc-people-live-browser.mjs <fixture.json>');
const fixture = JSON.parse(readFileSync(fxPath, 'utf8'));
const fixtureDir = dirname(resolve(fxPath));
const browser = await launch();
const R = runner();
const sys = (c) => ({ role: 'system', content: c });
const usr = (c) => ({ role: 'user', content: c });
const bot = (c) => ({ role: 'assistant', content: c });
const ok = (json) => ({ type: 'success', result: JSON.stringify(json) });
const llmCalls = (page) => page.evaluate(() => (window.__calls.llm || []).map((o) => ({ mode: o.mode, staticModel: o.staticModel ?? null, system: String(o.messages?.[0]?.content ?? ''), data: String(o.messages?.[1]?.content ?? '') })));
const resetLlm = (page, queue) => page.evaluate((q) => { window.__llm = q; window.__calls.llm = []; }, queue);
const store = (page) => page.evaluate(() => window.__clone(window.__chat.goeiPeopleV1 ?? null));
const push = (page, role, data, chatId) => page.evaluate(([r, d, id]) => { window.__chat.message.push({ role: r, data: d, chatId: id }); }, [role, data, chatId]);
const findings = [];
const note = (s) => { findings.push(s); console.log('NOTE ' + s); };

const { page, errors, logs } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir });
const saved = await startChat(page, 'A00', 2);
const greeting = sceneOf(saved);
await setVars(page, { $pp_on: '1', $pp_when: 'turn', $pp_model: 'aux', $pp_router: 'model', $pp_director: 'scene', $pp_keep_raw: '1', $st_asset_on: '0' });

const U1 = '쟈알디 부장님께 인사하고 출동 준비를 한다.';
const C1 = '쟈알디가 고개를 끄덕였다. "왔군. 앉아." 그는 서류를 밀어 주며 짧게 웃었다. 스팡달이 문을 열고 들어왔다.';
const U2 = '그 사람에게 서류를 다시 건네며 어디로 가야 하는지 물었다.';
const C2 = '쟈알디는 서류를 받아 들고 한숨을 쉬었다. "명일 아파트. 고생했어, 이번엔 네 덕이야." 그는 커피를 내밀었다.';
let tagOf = (i) => `m${i + 1}`;

await push(page, 'user', U1, 'u1');
const base1 = [sys('SYSTEM PROMPT'), bot(greeting), usr(U1)];

await R.section('1 첫 요청: 기록 없음 → 보조 호출 0, 기록 블록 없음', async () => {
  await resetLlm(page, []);
  const out = await request(page, base1);
  const calls = await llmCalls(page);
  assert.equal(calls.length, 0, `보조 호출 ${calls.length}`);
  assert.ok(!out.some((m) => String(m.content).startsWith('[People records]')), '기록 블록 없음');
});

await R.section('2 첫 응답 → 갱신기 1회, 쟈알디·스팡달 시드, 빈 답이면 읽음 표시만', async () => {
  await push(page, 'char', C1, 'c1');
  await resetLlm(page, [ok({ entries: [], axes_init: [], cues: [], address: [], new_people: [], docs: [], suspicion: [], next_note: [] })]);
  await output(page);
  const calls = await llmCalls(page);
  assert.equal(calls.length, 1, `갱신기 호출 ${calls.length}`);
  assert.equal(calls[0].mode, 'submodel');
  const data = JSON.parse(calls[0].data);
  const s = await store(page);
  assert.ok(s?.people?.['쟈알디'], '쟈알디 시드');
  if (!s?.people?.['스팡달']) note('첫 응답에 이름이 나온 스팡달은 시드되지 않음 (시트 없음?)');
  const span = data.span ?? data.messages ?? [];
  console.log('  갱신기 people:', data.people?.map((p) => p.name ?? p).join(','), '| span 수:', Array.isArray(span) ? span.length : '?', '| 지침', calls[0].system.length, '자 | 자료', calls[0].data.length, '자');
  const last = Array.isArray(span) ? span[span.length - 1] : null;
  if (last && typeof last === 'object') { const k = Object.keys(last).find((x) => /^m\d+$/.test(String(last[x]))); if (k) { const n = Number(String(last[k]).slice(1)); tagOf = (i) => `m${n - (2 - i)}`; } console.log('  마지막 span 항목:', JSON.stringify(last).slice(0, 200)); }
  const readKeys = Object.keys(s.read ?? {});
  assert.ok(readKeys.length >= 1, `읽음 표시 ${readKeys.length}`);
  assert.ok(calls[0].system.includes('"issues"'), '출력 계약에 issues 칸');
  assert.ok(/every list is empty is never acceptable|all-empty response is never acceptable/.test(calls[0].system), '빈 답 금지 규칙');
});

await push(page, 'user', U2, 'u2');
const base2 = [sys('SYSTEM PROMPT'), bot(greeting), usr(U1), bot(C1), usr(U2)];

await R.section('3 둘째 요청: Router 1회 → Director 1회 → 기록 블록 + Director 메모', async () => {
  await resetLlm(page, [ok({ selected: [{ name: '쟈알디', reason: '대화 상대' }], new_characters: [] }), ok({ notes: [{ who: '쟈알디', now: 'Tired, handing over papers.', react: 'Answers briefly.', must_not_reveal: ['명일 아파트의 진상'] }] })]);
  const out = await request(page, base2);
  const calls = await llmCalls(page);
  assert.equal(calls.length, 2, `보조 호출 ${calls.length} (Router·Director 기대 2)`);
  assert.ok(calls[0].system.startsWith('# Router'), 'Router 먼저');
  assert.ok(/Director/.test(calls[1].system), 'Director 다음');
  const rd = JSON.parse(calls[0].data);
  console.log('  Router 명단:', rd.catalog?.map((c) => c.name).join(','), '| recent', rd.recent?.length, '| Director 자료', calls[1].data.length, '자, 지침', calls[1].system.length, '자');
  const block = out.find((m) => String(m.content).startsWith('[People records]'));
  assert.ok(block && block.content.includes('쟈알디'), '기록 블록에 쟈알디');
  const dn = out.find((m) => String(m.content).startsWith('[Director note]'));
  assert.ok(dn && dn.content.includes('Tired'), 'Director 메모 삽입');
  assert.ok(/witnessed, learned/.test(block.content), '기록 블록 머리말에 지식 경계 규칙');
  assert.ok(/witnessed, learned/.test(dn.content) && /Never expose this note/.test(dn.content), 'Director 메모 머리말에 지식 경계·노출 금지');
  assert.ok(block.content.includes('스팡달'), 'Router 가 안 고른 스팡달(최근 글에 이름)도 코드 Router 로 들어감');
});

await R.section('4 Director 실패 → 메모 없이 진행 (경계 규칙도 없음?)', async () => {
  await setVars(page, { $pp_director_reuse: '0' });
  await resetLlm(page, [ok({ selected: [{ name: '쟈알디', reason: 'x' }], new_characters: [] }), { type: 'fail', result: 'boom' }]);
  const out = await request(page, base2);
  assert.ok(!out.some((m) => String(m.content).startsWith('[Director note]')), '메모 없음');
  assert.ok(out.some((m) => String(m.content).startsWith('[People records]')), '기록 블록은 있음');
  assert.ok(out.some((m) => /witnessed, learned/.test(String(m.content))), 'Director 실패 때도 지식 경계 규칙은 들어감');
});

await R.section('4b Director 형식 오류 → 고침 요청 1회 더 → 메모 삽입', async () => {
  await resetLlm(page, [ok({ selected: [{ name: '쟈알디', reason: 'x' }], new_characters: [] }), { type: 'success', result: '그냥 글로 답합니다.' }, ok({ notes: [{ who: '쟈알디', now: 'Repaired note.', must_not_reveal: [] }] })]);
  const out = await request(page, [...base2.slice(0, -1), usr(U2 + ' (다시)')]);
  const calls = await llmCalls(page);
  assert.equal(calls.filter((c) => /Director/.test(c.system)).length, 2, `Director 호출 2 (1차 + 고침)`);
  assert.ok(calls.some((c) => c.system.includes('## Output repair') && c.data.includes('invalid_previous_response')), '고침 요청에 오류·이전 답');
  assert.ok(out.some((m) => String(m.content).includes('Repaired note')), '고친 답이 메모로 들어감');
});

await R.section('5 둘째 응답 → 갱신기: 항목 반영·읽음 표시', async () => {
  await push(page, 'char', C2, 'c2');
  // 응답은 요청 자료를 보고 만든다: 마지막 확정 span 항목(assistant)의 태그를 쓴다
  await page.evaluate(() => {
    window.__calls.llm = [];
    window.__origLLM2 = window.risuai.runLLMModel;
    window.risuai.runLLMModel = async (o) => {
      window.__calls.llm.push(o);
      const data = JSON.parse(o.messages[1].content);
      const last = [...(data.span ?? [])].reverse().find((x) => x.role === 'assistant');
      const tag = last?.m;
      window.__tag = tag;
      return { type: 'success', result: JSON.stringify({ entries: [{ who: '쟈알디', slot: 'state', op: 'add', text: '한숨을 쉬며 피곤해 보임', m: tag, quote: '한숨을 쉬었다' }, { who: '쟈알디', slot: 'knowledge', op: 'add', text: '유저가 명일 아파트로 간다', m: tag, quote: '명일 아파트' }], cues: [{ who: '쟈알디', cue: '도움', m: tag, quote: '고생했어', reason: '유저의 일처리' }], next_note: [] }) };
    };
  });
  await output(page);
  await page.evaluate(() => { window.risuai.runLLMModel = window.__origLLM2; });
  const tag = await page.evaluate(() => window.__tag);
  const calls = await llmCalls(page);
  assert.equal(calls.length, 1, `갱신기 호출 ${calls.length}`);
  const data = JSON.parse(calls[0].data);
  const s = await store(page);
  const p = s.people['쟈알디'];
  const n = Object.values(p.slots ?? {}).reduce((a, es) => a + (Array.isArray(es) ? es.length : 0), 0);
  console.log('  태그', tag, '| 저장 항목 수', n, '| 읽음', Object.keys(s.read ?? {}).length, '| 변화 수', (s.changes ?? []).length, '| lastRun', s.lastRun ? Object.keys(s.lastRun).join(',') : '없음');
  if (n < 2) { const span = JSON.stringify(data.span ?? data).slice(0, 400); note(`갱신기 항목 2개가 반영되지 않음 (저장 ${n}). 태그 추정 ${tag}. span: ${span}`); }
  console.log('  store keys', Object.keys(s).join(','), '| 쟈알디 keys', Object.keys(p).join(','), '| affinity', JSON.stringify(p.affinity), '| runs', JSON.stringify(s.runs ?? s.lastRun ?? null).slice(0,300));
  console.log('  한숨 항목', JSON.stringify((p.slots.state??[]).filter(e=>/한숨/.test(e.text))), '| 지식', JSON.stringify((p.slots.knowledge??[]).filter(e=>/명일/.test(e.text))));
  const diag = await page.evaluate(() => JSON.parse(window.__store['p:goei-people-diag'] || '[]').map((d) => ({ reason: d.reason, ok: d.ok, error: d.error, stage: d.stage, people: d.people, report: d.report ? { applied: d.report.applied, dropped: d.report.dropped, held: d.report.held } : null })));
  console.log('  diag', JSON.stringify(diag, null, 0).slice(0, 4000));
  console.log('  changes', JSON.stringify(s.changes ?? []).slice(0, 400));
  assert.ok(Object.keys(s.read ?? {}).length >= 2, '응답 2개 읽음');
});

if (!process.env.SKIP6) await R.section('6 Router 시간 초과 3회 → 그 뒤로 영구 생략?', async () => {
  await setVars(page, { $pp_router_timeout: '5', $pp_director: 'off' });
  await page.evaluate(() => { window.__origLLM = window.risuai.runLLMModel; window.risuai.runLLMModel = () => new Promise(() => {}); });
  for (let i = 0; i < 3; i++) await request(page, [...base2, bot(C2), usr(`다시 묻는다 ${i}`)]);
  await page.evaluate(() => { window.risuai.runLLMModel = window.__origLLM; });
  await resetLlm(page, [ok({ selected: [{ name: '쟈알디', reason: 'x' }], new_characters: [] })]);
  await request(page, [...base2, bot(C2), usr('네 번째 요청')]);
  const calls = await llmCalls(page);
  assert.equal(calls.length, 1, `시간 초과 3회 뒤 네 번째 요청에서 Router 다시 호출 (${calls.length})`);
});

await browser.close();
console.log('\n=== 고장·누락 목록 ===');
for (const f of findings) console.log('- ' + f);
console.log('=== 결과 ===');
console.log(R.table ? R.table() : JSON.stringify(R.results ?? '', null, 0));
if (errors.length) console.log('페이지 오류:', errors);
console.log(logs.filter((l) => /people|인물|Router|Director/i.test(l)).slice(-20).join('\n'));
