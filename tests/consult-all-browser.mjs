// AI 상담: 모든 설정 (2026-11-12 사용자 결정 — 호출 흐름 50줄만이 아니라 설정 메뉴 전부를 묻고 바꾼다).
// 1) 메뉴마다: 그 화면의 모든 줄 이름이 상담 목록에 있는지, id 가 겹치지 않는지, 요청에 채팅 글이 없는지
// 2) 메뉴마다: 바꿀 수 있는 줄을 전부 한 번에 바꾸자고 하고(한 답에 10개 한도 없음) → 동의 → 화면을 다시 읽어 값 대조 → 되돌리기 → 저장소가 처음과 같은지.
//    한 번에 못 바뀐 줄(다른 줄에 묶여 잠긴 것 등)은 하나씩 다시 해 본다
// 3) 시작 전(새 채팅 기본 설정)에도 같은 일
// 4) 상담 전용 통로(ai-do): 지우기·초기화·없는 값·범위 밖 수·꺾쇠가 든 글은 받지 않는다
// 5) 글 칸(길이·줄바꿈·꺾쇠·기본값과 같으면 저장 안 함), 못 바꾸는 줄·잠긴 줄, <open> 은 한 번만, <go>, 대화 지우기(다른 채팅·설정은 그대로),
//    요청 토큰 상한, 증상 지식의 줄 이름이 목록에 있는지, 폰
// 사용법: node tests/consult-all-browser.mjs <fixture.json> [결과 폴더]
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { boot, chatOf, clickSel, closeEditor, closeWin, goNode, launch, loadFixture, openEditor, openWin, setChat, sleep } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const OUT = process.argv[3] || '';
if (OUT) mkdirSync(OUT, { recursive: true });
let browser = await launch();
// 절마다 브라우저를 새로 띄운다 (전수 두 번 뒤 같은 브라우저로 이어 가면 Chromium 탭이 죽는 일이 있었다)
const renew = async () => { await browser.close().catch(() => {}); browser = await launch(); };
const MARK = 'ZZ메인본문표식';
const started = (extra = {}) => ({ message: [{ role: 'user', data: 'hi' }, { role: 'char', data: `${MARK}\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]` }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fixed_theme: 'dark', $st_anomaly_on: '1', ...extra } });
const fresh = () => ({ message: [], scriptstate: {} });
const PC = { width: 1920, height: 1080, touch: false };
const PHONE = { width: 390, height: 844, touch: true };
let checks = 0;
// PART=sweep,fresh,misc,shots 로 절을 고른다 (없으면 전부)
const PART = (process.env.PART || 'sweep,fresh,misc,shots').split(',');
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); checks++; };
const report = { menus: [], fresh: [], sizes: {}, notes: [] };
process.on('exit', () => { if (OUT) writeFileSync(`${OUT}/consult-all${process.env.PART ? `-${process.env.PART.replace(/,/g, '-')}` : ''}.json`, JSON.stringify(report, null, 1)); });

// 상담 대화와 호출 기록(부를 때마다 쌓임)은 설정이 아니다
const NOISE = (process.env.NOISE || 'p:goei:consult,p:goei-trace').split(',');
/** 저장소(채팅 변수 + 플러그인 저장소)가 같은가. 다르면 다른 열쇠만 보인다 */
const same = (a, b, msg) => { const d = a === b ? [] : diffKeys(a, b); assert.equal(d.slice(0, 8).join(', '), '', msg); checks++; };
const SAY = (t) => `<say>${t}</say>`;
const snap = (page) => page.evaluate((NOISE) => JSON.stringify({ chat: window.__chat.scriptstate ?? {}, store: Object.fromEntries(Object.entries(window.__store).filter(([k, v]) => !NOISE.includes(k) && String(v).length < 200000)) }), NOISE);
const logOf = (page) => page.evaluate(() => [...document.querySelectorAll('.gw-ai .gw-ai-log > *')].map((e) => `${e.className.replace('ai-m ', '')}: ${e.textContent.replace(/\s+/g, ' ').trim()}`));
const calls = (page) => page.evaluate(() => (window.__calls.llm ?? []).length);
const lastReq = (page) => page.evaluate(() => window.__calls.llm.at(-1).messages.map((m) => m.content));
async function send(page, text, replies) {
  await page.evaluate((r) => { window.__llm = r; }, replies);
  await page.evaluate((t) => { const i = document.querySelector('.gw-ai [name="ai-q"]'); i.value = t; i.dispatchEvent(new Event('input', { bubbles: true })); }, text);
  await clickSel(page, '.gw-ai [data-action="ai-send"]');
  await page.waitForFunction(() => document.querySelector('.gw-ai [name="ai-q"]')?.disabled === true).catch(() => {});
  await page.waitForFunction(() => document.querySelector('.gw-ai [name="ai-q"]')?.disabled === false, null, { timeout: 120000 });
  await sleep(120);
}
async function openConsult(page) {
  if (!(await page.evaluate(() => !!document.querySelector('.gw-ai')))) { await clickSel(page, '.gw [data-action="ai-toggle"]'); await page.waitForSelector('.gw-ai'); }
}
/** 대화 지우기 (물음에 「대화 지우기」) */
async function clearTalk(page) {
  if (await page.evaluate(() => document.querySelector('.gw-ai [data-action="ai-clear"]')?.disabled !== false)) return;
  await clickSel(page, '.gw-ai [data-action="ai-clear"]');
  await page.waitForSelector('.gw-ai [data-action="ai-clear-yes"]');
  await clickSel(page, '.gw-ai [data-action="ai-clear-yes"]');
  await page.waitForFunction(() => !document.querySelector('.gw-ai [data-action="ai-clear-yes"]'));
}

/** 요청문의 [설정 목록]을 읽는다: 메뉴 이름 → 줄들 */
function parseList(user) {
  const at = user.indexOf('[설정 목록]');
  const end = user.indexOf('\n[바꾸자고 한 것]');
  const out = new Map();
  let cur = null;
  for (const line of user.slice(at, end).split('\n')) {
    const h = /^## (.+)$/.exec(line);
    if (h) { cur = []; out.set(h[1], cur); continue; }
    const m = /^\[([^\]\s]+)\] (.*)$/.exec(line);
    if (!m || !cur) continue;
    const parts = m[2].split(' | ');
    const get = (k) => { const p = parts.find((x) => x.startsWith(`${k}: `)); return p === undefined ? null : p.slice(k.length + 2); };
    const can = get('고를 수 있는 값');
    const row = { id: m[1], label: parts[0], cur: get('지금'), can, no: get('바꾸기'), where: get('저장') };
    row.stride = Number(/지금 값에서 (\d+)씩/.exec(can ?? '')?.[1] ?? 1);
    const num = can && /^(-?\d+)~(-?\d+).* \(정수\)$/.exec(can);
    row.kind = !can ? 'info' : num ? 'num' : /^정수( \(.+\))?, (화면의|지금 값에서)/.test(can) ? 'step' : /^글( \(최대 \d+자\))?, (한 줄|여러 줄은)/.test(can) ? 'text' : 'pick';
    if (num) { row.lo = Number(num[1]); row.hi = Number(num[2]); }
    if (row.kind === 'text') { row.max = Number(/최대 (\d+)자/.exec(can)?.[1] ?? 0); row.multi = can.includes('여러 줄'); }
    if (row.kind === 'pick') row.opts = can.split(' / ');
    cur.push(row);
  }
  return out;
}
const numOf = (s) => { const n = Number.parseInt(String(s ?? '').replace(/,/g, ''), 10); return Number.isFinite(n) ? n : 0; };
const FORM = {
  'ms-roll.cos:tiers': (c) => `${c}\\n시험가|test tier|1|2|1`,
  'ms-roll.bm:tiers': (c) => `${c}\\n시험가|test tier|1|2|1`,
  'ms-desk.axes': (c) => `${c}\\n시험: 가, 나`,
  'pp-bounds': () => '70,30,-10,-50',
  'set-wallet-start': () => '12345',
};
/** 그 줄을 바꿀 새 값 (모델이 적을 글) */
function target(r, alt = false) {
  if (r.kind === 'pick') { const others = r.opts.filter((o) => o !== r.cur); return alt ? others.at(-1) : others[0]; }
  if (r.kind === 'num') { const c = numOf(r.cur); return String(c + 1 <= r.hi && !alt ? c + 1 : c - 1 >= r.lo ? c - 1 : c + 1); }
  if (r.kind === 'step') return String(numOf(r.cur) + (alt ? -1 : 1) * r.stride);
  // 꼴이 정해진 글 칸: 그 꼴에 맞는 글 (틀린 꼴은 원래 처리기가 받지 않는다)
  if (FORM[r.id]) return FORM[r.id](r.cur);
  const base = r.cur === '(빈 글)' ? '' : r.cur;
  const add = r.multi && base ? `${base}\\n시험` : base ? `${base} 시험` : '시험';
  return r.max && add.replace(/\\n/g, '\n').length > r.max ? `시험 ${base}`.slice(0, Math.max(2, r.max - 4)) : add;
}
const reached = (r, now, want) => (r.kind === 'pick' ? now.cur === want : r.kind === 'text' ? now.cur !== r.cur : numOf(now.cur) === Number(want));
/** 지금 보는 메뉴의 목록을 읽는다 (그 메뉴 화면을 열어 두면 코드가 그 메뉴를 펼친다) */
async function readMenu(page, name) {
  await send(page, '무엇을 바꿀 수 있어?', [SAY('네')]);
  const [system, user] = await lastReq(page);
  ok(!system.includes(MARK) && !user.includes(MARK), `${name}: 상담 요청에 채팅 글이 없다`);
  const list = parseList(user);
  ok(list.has(name), `${name}: 지금 보는 메뉴가 펼쳐진다`);
  return { rows: list.get(name), system, user, opened: [...list.keys()] };
}
/** 바꾸자고 함 → 동의. 돌아오는 것: 판에 적힌 줄 수, 알림 줄들 */
async function propose(page, rows, alt = false) {
  const set = rows.map((r) => `${r.id}=${target(r, alt)}`).join('\n');
  const n0 = (await logOf(page)).length;
  await send(page, '그렇게 바꾸자', [`${SAY('이렇게 바꿀까요?')}\n<set>\n${set}\n</set>`]);
  const mid = (await logOf(page)).slice(n0);
  await send(page, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
  const log = (await logOf(page)).slice(n0);
  const card = await page.evaluate(() => { const c = [...document.querySelectorAll('.gw-ai .ai-card')].at(-1); return c ? [...c.querySelectorAll('.ai-ch')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()) : []; });
  const isNew = log.some((l) => l.startsWith('ai-card'));
  return { card: isNew ? card : [], dropped: mid.filter((l) => l.startsWith('ai-sys') && l.includes('뺐어요')), failed: log.filter((l) => l.includes('바꾸지 못했어요')) };
}
async function undoLast(page) {
  const n = await page.evaluate(() => document.querySelectorAll('.gw-ai .ai-card').length);
  if (!n) return 'no-card';
  await page.evaluate(() => [...document.querySelectorAll('.gw-ai .ai-card')].at(-1).querySelector('[data-action="ai-undo"]').click());
  await page.waitForFunction(() => { const c = [...document.querySelectorAll('.gw-ai .ai-card')].at(-1); const b = c.querySelector('button'); const last = document.querySelector('.gw-ai .gw-ai-log > :last-child'); return (b?.textContent === '되돌렸어요' && !document.querySelector('.gw-ai [name="ai-q"]').disabled) || last?.textContent.includes('되돌리지 못했어요'); }, null, { timeout: 120000 });
  await sleep(150);
  const last = (await logOf(page)).at(-1);
  return last.includes('되돌리지 못했어요') ? last : 'ok';
}
function diffKeys(a, b, vals = false) {
  const A = JSON.parse(a); const B = JSON.parse(b);
  const flat = (o) => { const out = {}; for (const [k, v] of Object.entries(o.chat)) out[`chat ${k}`] = v; for (const [k, v] of Object.entries(o.store)) { let j = null; try { j = JSON.parse(v); } catch { /* 글 그대로 */ } if (j && typeof j === 'object') { const walk = (p, x) => { if (x && typeof x === 'object' && !Array.isArray(x)) for (const [kk, vv] of Object.entries(x)) walk(`${p}.${kk}`, vv); else out[p] = JSON.stringify(x); }; walk(k, j); } else out[k] = v; } return out; };
  const fa = flat(A); const fb = flat(B);
  // 빈 값과 없는 값은 같은 것으로 본다 (기본값으로 돌아간 변수)
  const empty = (v) => v === undefined || v === '' || v === '""' || v === 'null';
  const keys = [...new Set([...Object.keys(fa), ...Object.keys(fb)])].filter((k) => fa[k] !== fb[k] && !(empty(fa[k]) && empty(fb[k])));
  return vals ? keys.map((k) => `${k}: ${String(fa[k] ?? '(없음)').slice(0, 40)} → ${String(fb[k] ?? '(없음)').slice(0, 40)}`) : keys;
}

/** 메뉴 하나를 전수로: 읽기 → 전부 바꾸기 → 대조 → 되돌리기 → 못 바뀐 줄은 하나씩 */
async function sweepMenu(page, node, name, into) {
  await goNode(page, node);
  await sleep(250);
  await clearTalk(page);
  const before = await snap(page);
  const first = await readMenu(page, name);
  const rows = first.rows;
  eq(new Set(rows.map((r) => r.id)).size, rows.length, `${name}: id 가 겹치지 않는다`);
  // 화면의 줄 이름이 모두 목록에 있다
  const labels = await page.evaluate(() => {
    const own = (h) => (h ? [...h.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : '');
    return [...new Set([...document.querySelectorAll('.gw .gw-body .ps-row')].filter((r) => !r.closest('.ck-ph, .fl-ph, [hidden]') && !r.classList.contains('lc-row') /* 로어북 점검 결과 줄: 설정이 아니다 */).map((r) => own(r.querySelector('.ps-label > b'))).filter(Boolean))];
  });
  const missing = labels.filter((l) => !rows.some((r) => r.label.split(' · ').includes(l) || r.label.includes(l)));
  eq(missing.join(', '), '', `${name}: 화면의 줄 이름이 모두 목록에 있다`);
  const can = rows.filter((r) => r.kind !== 'info' && !r.no);
  // 「사용」 같은 큰 스위치는 맨 뒤에 (먼저 끄면 딸린 줄이 잠긴다)
  const master = (r) => /(^|· )사용$/.test(r.label);
  // 큰 스위치는 한 번에 바꾸는 묶음에 넣지 않고 따로 하나씩 한다 (끄면 딸린 줄이 화면에서 사라져 대조할 수 없다)
  const order = can.filter((r) => !master(r));
  const alone = can.filter(master);
  const res = { menu: name, node, rows: rows.length, info: rows.filter((r) => r.no && !r.no.includes('잠김')).length, locked: rows.filter((r) => r.no?.includes('잠김')).length, kinds: {}, changed: 0, single: [], cannot: [], undo: 'ok', leftover: [], screen: [] };
  for (const r of can) res.kinds[r.kind] = (res.kinds[r.kind] ?? 0) + 1;
  into.push(res);
  let doneIds = new Set();
  if (order.length) {
    const p = await propose(page, order);
    const after = await readMenu(page, name);
    for (const r of order) {
      const now = after.rows.find((x) => x.id === r.id);
      if (now && reached(r, now, target(r))) doneIds.add(r.id);
    }
    res.changed = doneIds.size;
    res.card = p.card.length;
    res.dropped = p.dropped;
    ok((await snap(page)) !== before || !doneIds.size, `${name}: 바꾼 값이 저장소에 적혔다`);
    res.undo = await undoLast(page);
    // 되돌린 뒤: 화면의 값이 처음과 같은가 (screen), 저장소 글자까지 같은가 (leftover — 「없음」이 「기본값을 적음」으로 바뀐 것은 값은 같고 글자만 다르다)
    const back = await readMenu(page, name);
    res.screen = rows.filter((r) => back.rows.find((x) => x.id === r.id)?.cur !== r.cur).map((r) => `${r.label}: ${r.cur} → ${back.rows.find((x) => x.id === r.id)?.cur}`);
    res.leftover = diffKeys(before, await snap(page), true);
  }
  // 한 번에 못 바뀐 줄: 처음 상태에서 하나씩 (다른 값으로도 한 번)
  for (const r of [...order.filter((x) => !doneIds.has(x.id)), ...alone]) {
    let okOne = false;
    let why = '';
    for (const alt of [false, true]) {
      await clearTalk(page);
      const cur = (await readMenu(page, name)).rows.find((x) => x.id === r.id);
      if (!cur || cur.no || cur.kind === 'info') { why = cur ? `지금 잠김 (${cur.no})` : '화면에 없음'; break; }
      const want = target(cur, alt);
      if (want === undefined || want === cur.cur) { why = '고를 다른 값이 없음'; continue; }
      const p = await propose(page, [cur], alt);
      const now = (await readMenu(page, name)).rows.find((x) => x.id === r.id);
      if (now && reached(cur, now, want)) { okOne = true; const u = await undoLast(page); if (u !== 'ok') why = u; break; }
      why = [...p.dropped, ...p.failed].join(' / ') || `값이 그대로 (${cur.cur} → ${want})`;
      if (p.card.length) await undoLast(page);
    }
    if (okOne) res.single.push(why ? `${r.label} (되돌리기: ${why})` : r.label);
    else res.cannot.push(`${r.label} [${r.id}]: ${why}`);
  }
  if (res.single.length || res.cannot.length) { const end = await readMenu(page, name); res.screen2 = rows.filter((r) => end.rows.find((x) => x.id === r.id)?.cur !== r.cur).map((r) => `${r.label}: ${r.cur} → ${end.rows.find((x) => x.id === r.id)?.cur}`); res.leftover2 = diffKeys(before, await snap(page), true); }
  console.log(`  ${name}: 줄 ${res.rows} (안내 ${res.info}, 잠김 ${res.locked}) · 한 번에 ${res.changed}/${order.length} (판 ${res.card ?? 0}줄) · 하나씩 ${res.single.length} · 못 바꿈 ${res.cannot.length} · 되돌린 뒤 화면 값 다름 ${res.screen.length + (res.screen2?.length ?? 0)} · 저장소 글자 다름 ${res.leftover.length}${res.undo === 'ok' ? '' : ` · ${res.undo}`}`);
  return res;
}
const menuNodes = (page) => page.evaluate(() => [...document.querySelectorAll('.gw [data-action="ed-node"]')].map((e) => ({ node: e.dataset.value, name: (e.querySelector(':scope > span')?.textContent ?? '').trim() })).filter((x) => x.node.startsWith('set:')));

/* ── 1·2. 시작 뒤: 모든 메뉴 ── */
let allRows = [];
let menuNames = [];
if (PART.includes('sweep')) {
  const { page, errors } = await boot(browser, fx, started(), PC);
  await openWin(page);
  await openEditor(page, 'set:screen');
  await sleep(500);
  await openConsult(page);
  // 머리: 대화 지우기 · 모델 · 닫기. 대화가 없으면 「대화 지우기」는 못 누른다
  const head = await page.evaluate(() => [...document.querySelectorAll('.gw-ai .gw-ai-top button')].map((b) => `${b.dataset.action}${b.disabled ? '(잠김)' : ''}`));
  ok(head.includes('ai-clear(잠김)'), `대화가 없을 때 「대화 지우기」는 잠겨 있다 (${head.join(',')})`);
  const nodes = await menuNodes(page);
  ok(nodes.length >= 18, `설정 메뉴 ${nodes.length}개`);
  menuNames = nodes.map((n) => n.name);
  console.log('시작 뒤 전수');
  for (const n of nodes) {
    const r = await sweepMenu(page, n.node, n.name, report.menus);
    eq(r.undo, 'ok', `${n.name}: 되돌리기`);
    eq([...r.screen, ...(r.screen2 ?? [])].slice(0, 6).join(' / '), '', `${n.name}: 되돌리면 화면의 모든 값이 처음과 같다`);
  }
  const total = report.menus.reduce((n, m) => n + m.changed + m.single.length, 0);
  ok(total >= 300, `상담으로 바꾸고 되돌린 줄 ${total}개`);
  ok(report.menus.some((m) => (m.card ?? 0) > 10), '한 번에 11개 넘게 바꾼다 (한도 없음)');
  eq(errors.length, 0, `콘솔 오류 없음(전수): ${errors.slice(0, 3).join(' / ')}`);
  await page.close();
}

/* ── 3. 시작 전(새 채팅 기본 설정): 모든 메뉴 ── */
if (PART.includes('fresh')) {
  await renew();
  const { page, errors } = await boot(browser, fx, fresh(), PC);
  await openWin(page);
  await openEditor(page, 'set:screen');
  await sleep(500);
  await openConsult(page);
  console.log('시작 전 전수');
  for (const n of await menuNodes(page)) {
    const r = await sweepMenu(page, n.node, n.name, report.fresh);
    eq(r.undo, 'ok', `시작 전 ${n.name}: 되돌리기`);
    eq([...r.screen, ...(r.screen2 ?? [])].slice(0, 6).join(' / '), '', `시작 전 ${n.name}: 되돌리면 화면의 모든 값이 처음과 같다`);
  }
  eq(errors.length, 0, `콘솔 오류 없음(시작 전 전수): ${errors.slice(0, 3).join(' / ')}`);
  await page.close();
}

/* ── 4·5. 통로·글 칸·못 바꾸는 줄·<open>·<go>·대화 지우기·상한·증상 지식 ── */
if (PART.includes('misc')) {
  await renew();
  const { page, errors } = await boot(browser, fx, started(), PC);
  await openWin(page);
  await openEditor(page, 'set:people');
  await sleep(500);
  await openConsult(page);
  const shot = async () => {};
  menuNames = (await menuNodes(page)).map((n) => n.name);

  // (가) 상담 전용 통로: 화면에 그 조작이 없는 동작·값은 받지 않는다
  // 통로는 패널의 동작 처리기에만 있다: 패널 뿌리(.gx)에 단추를 잠깐 넣어 그 처리기를 바로 부른다
  const doRaw = async (value, where = '.gx') => {
    await page.evaluate(([v, where]) => { const b = document.createElement('button'); b.dataset.action = 'ai-do'; b.dataset.value = v; b.id = 'raw-do'; document.querySelector(where).appendChild(b); b.click(); b.remove(); }, [value, where]);
    await sleep(350);
  };
  const s0 = await snap(page);
  for (const v of ['people|pp-reset|', 'people|pp-del|x', 'people|pp-set|director=없는값', 'people|pp-set|block_cap=999999', 'adv|adv-set|gen:retries=99', 'adv|adv-set|gen:retries=-1', 'people|pp-always|<b>굵게</b>', `set:people|pp-always|${'가'.repeat(401)}`, 'people|ed-node|world', 'people|guide-set|consult=x', 'people|upd-run|', 'people|set-reset|', 'nope|pp-set|director=note', 'adv|pp-set|director=note', 'world|pp-set|director=note']) {
    await doRaw(v);
    same(s0, await snap(page), `통로가 받지 않는다: ${v.slice(0, 50)}`);
  }
  // 설정 창 안에서 누른 ai-do 는 상담 창 동작으로 가서 버려진다 (통로에 닿지 않는다)
  await doRaw('people|pp-set|director=note', '.gw .gw-body');
  same(s0, await snap(page), '설정 창 안의 ai-do 단추는 통로에 닿지 않는다');
  await doRaw('people|pp-set|director=note');
  eq((await chatOf(page)).scriptstate.$pp_director, 'note', '통로: 화면에 있는 조작과 값은 받는다 (대조)');
  await doRaw('people|pp-set|director=facts');

  // (나) 못 바꾸는 줄·잠긴 줄·꺾쇠·너무 긴 글·없는 id
  const people = await readMenu(page, '인물');
  await goNode(page, 'set:status');
  const status = await readMenu(page, '상태창');
  const info = status.rows.find((r) => r.kind === 'info') ?? people.rows.find((r) => r.kind === 'info');
  const locked = status.rows.find((r) => r.no?.includes('잠김'));
  ok(locked, '잠긴 줄이 목록에 「바꾸기: 못 함 (지금 잠김)」으로 보인다');
  await goNode(page, 'set:people');
  const s1 = await snap(page);
  const bads = [`${locked.id}=사용 안 함`, 'pp-always=<b>굵게</b>', `pp-always=${'가'.repeat(401)}`, 'guide.consult=지침을 바꿔', 'pp-reset=yes', 'lore.1=지움', ...(info ? [`${info.id}=켬`] : [])];
  await send(page, '다 바꿔', [`${SAY('바꿀까요?')}\n<set>\n${bads.join('\n')}\n</set>`]);
  const sysBad = (await logOf(page)).filter((l) => l.startsWith('ai-sys')).at(-1) ?? '';
  ok(sysBad.includes('지금은 잠겨 있는 설정') && sysBad.includes('< > 는 쓸 수 없어요') && sysBad.includes('글이 너무 길어요') && sysBad.includes('guide.consult') && sysBad.includes('pp-reset'), `못 바꾸는 까닭을 알린다: ${sysBad.slice(0, 300)}`);
  await send(page, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
  same(s1, await snap(page), '못 바꾸는 것만 있으면 아무것도 바뀌지 않는다');

  // (다) 글 칸: 한 줄 칸의 \n 은 빈칸, 판에 옛 글 → 새 글, 되돌리기
  await clearTalk(page);
  await send(page, '항상 포함할 인물에 넣어줘', [`${SAY('두 사람을 넣을까요?')}\n<set>\npp-always=김솔음,\\n류재관\n</set>`]);
  await send(page, '응', [`${SAY('넣었어요.')}\n<apply>yes</apply>`]);
  const always = (await chatOf(page)).scriptstate.$pp_always ?? JSON.stringify((await chatOf(page)).scriptstate);
  ok(/김솔음, ?류재관/.test(always) && !always.includes('\n') && !always.includes('\\n'), `한 줄 글 칸: \\n 은 빈칸으로 (${String(always).slice(0, 60)})`);
  const tcard = await page.evaluate(() => document.querySelector('.gw-ai .ai-card .ai-ch')?.textContent.replace(/\s+/g, ' ').trim() ?? '');
  ok(tcard.includes('항상 포함할 인물') && tcard.includes('(빈 글)') && tcard.includes('류재관'), `글 칸 판: 옛 글 → 새 글 (${tcard})`);
  await shot('5-text-card');
  eq(await undoLast(page), 'ok', '글 칸 되돌리기');
  ok(!((await chatOf(page)).scriptstate.$pp_always ?? ''), '글 칸 되돌리기: 빈 글로');

  // (라) 여러 줄 글 칸 + 기본값이 든 칸(deftext): 바꾸면 저장, 기본값과 같은 글로 돌리면 저장하지 않는다
  await goNode(page, 'set:cos');
  await sleep(250);
  await clearTalk(page);
  const cos = await readMenu(page, '우주 쇼핑몰');
  const tiers = cos.rows.find((r) => r.id === 'ms-roll.cos:tiers');
  const genres = cos.rows.find((r) => r.id === 'ms-roll.cos:genres');
  ok(tiers?.kind === 'text' && tiers.multi && genres?.kind === 'text', '기본값이 든 칸(값 등급·장르 목록)이 글 칸으로 목록에 있다');
  ok(tiers.cur.includes('\\n') && !tiers.cur.includes('\n'), '여러 줄 글의 지금 값은 \\n 으로 이은 한 줄');
  const sCos = await snap(page);
  await send(page, '장르에 horror 추가', [`${SAY('장르 목록과 값 등급을 바꿀까요?')}\n<set>\nms-roll.cos:genres=${genres.cur}, horror\nms-roll.cos:tiers=${tiers.cur}\\n시험가|test tier|1|2|1\n</set>`]);
  await send(page, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
  const cos2 = await readMenu(page, '우주 쇼핑몰');
  ok(cos2.rows.find((r) => r.id === genres.id).cur.endsWith(', horror'), '기본값이 든 칸: 상담이 바꾼 글이 화면에 있다');
  const t2 = cos2.rows.find((r) => r.id === tiers.id).cur;
  ok(t2.split('\\n').length === tiers.cur.split('\\n').length + 1 && t2.includes('시험가|test tier|1|2|1'), '여러 줄 글 칸: \\n 이 진짜 줄바꿈으로 들어갔다 (한 줄 늘어남)');
  ok(await page.evaluate(() => !!document.querySelector('.gw [data-change="ms-roll"][data-key="cos:genres"]')?.closest('.ps-row')?.classList.contains('ps-changed')), '바꾼 줄 표시(점)가 붙는다');
  ok((await snap(page)) !== sCos, '바꾼 글이 저장됐다');
  // 기본값과 똑같은 글로 되돌리자고 하면: 저장을 지운다 (기본값 = 저장 안 함)
  await send(page, '원래대로', [`${SAY('원래 글로 돌릴까요?')}\n<set>\nms-roll.cos:genres=${genres.cur}\nms-roll.cos:tiers=${tiers.cur}\n</set>`]);
  await send(page, '응', [`${SAY('돌렸어요.')}\n<apply>yes</apply>`]);
  eq(diffKeys(sCos, await snap(page)).join(', '), '', '기본값과 같은 글 = 저장하지 않음 (저장소가 처음과 같다)');
  ok(!(await page.evaluate(() => !!document.querySelector('.gw [data-change="ms-roll"][data-key="cos:genres"]')?.closest('.ps-row')?.classList.contains('ps-changed'))), '기본값으로 돌아가면 바꾼 줄 표시가 없다');

  // (마) <open>: 한 번만 다시 묻는다. 두 번째 답이 또 <open> 뿐이면 실패 줄
  await goNode(page, 'manage:flow');
  await clearTalk(page);
  let c0 = await calls(page);
  await send(page, '느려', ['<open>인물</open>', '<open>위키</open>', '<open>상점</open>', '<open>상점</open>']);
  const gen = (await chatOf(page)).scriptstate.$gen_retries;
  const tries = (await calls(page)) - c0;
  ok(tries % 2 === 0 && tries <= 2 * (1 + Number(gen || 1)), `<open> 은 물음마다 한 번만 다시 묻는다 (부른 횟수 ${tries})`);
  ok((await logOf(page)).at(-1).startsWith('ai-sys ai-err'), '<open> 만 되풀이하면 「답을 받지 못했어요」');
  const opened2 = parseList((await lastReq(page))[1]);
  ok(opened2.has('인물') && !opened2.has('위키') && !opened2.has('상점'), `두 번째 <open> 의 메뉴는 펼치지 않는다 (${[...opened2.keys()].join(', ')})`);
  // 없는 메뉴 이름·못 여는 탭 이름은 버린다 (다시 묻지 않는다)
  await clearTalk(page);
  c0 = await calls(page);
  await send(page, '로어북 지워줘', [`<open>없는메뉴, 저장·불러오기, 요원</open>${SAY('그건 상담에서 못 해요.')}`]);
  eq((await calls(page)) - c0, 1, '없는 메뉴·다른 탭 이름의 <open> 은 다시 묻지 않는다');

  // (바) 크기: 메뉴 없음 / 메뉴 하나 / 가장 큰 메뉴 셋 / 전부
  const sizeOf = async () => { const [s, u] = await lastReq(page); return { system: s.length, user: u.length, opened: [...parseList(u).keys()] }; };
  await clearTalk(page);
  await send(page, '안녕', [SAY('네')]);
  report.sizes.none = await sizeOf();
  eq(report.sizes.none.opened.length, 0, '관제 화면에서 메뉴 이름이 없는 말: 펼친 메뉴 없음');
  const [, uNone] = await lastReq(page);
  for (const n of menuNames) ok(uNone.includes(`\n- ${n}:`) || uNone.includes(`\n- ${n} | 줄:`), `메뉴 목록에 「${n}」`);
  ok(uNone.includes('[지금 상태]') && uNone.includes('[지난 턴 실제]') && uNone.includes('[메뉴]'), '요청에 지금 상태·지난 턴 실제·메뉴 묶음이 있다');
  await clearTalk(page);
  await send(page, '안녕', ['<open>인물</open>', SAY('네')]);
  report.sizes.one = await sizeOf();
  await clearTalk(page);
  await send(page, '안녕', ['<open>인터넷, 괴담톡, 망상홈쇼핑</open>', SAY('네')]);
  report.sizes.three = await sizeOf();
  eq(report.sizes.three.opened.length, 3, '메뉴 셋을 펼친다');
  await clearTalk(page);
  await send(page, '안녕', [`<open>${menuNames.join(', ')}</open>`, SAY('네')]);
  report.sizes.all = await sizeOf();
  eq(report.sizes.all.opened.length, menuNames.length, '메뉴 전부를 펼친다');
  allRows = [...parseList((await lastReq(page))[1]).entries()].flatMap(([menu, rows]) => rows.map((r) => ({ ...r, menu })));
  eq(new Set(allRows.map((r) => r.id)).size, allRows.length, `모든 메뉴를 합쳐도 id 가 겹치지 않는다 (${allRows.length}줄)`);
  // 사용자 글에 메뉴 이름이 있으면 코드가 그 메뉴를 펼친다 (모델이 달라고 하지 않아도)
  await clearTalk(page);
  await send(page, '위키 자동 호출이 뭐야', [SAY('네')]);
  ok(parseList((await lastReq(page))[1]).has('위키'), '사용자 글에 나온 메뉴 이름은 코드가 펼친다');

  // (사) 증상 지식: 지침에 적은 「줄 이름」이 모두 목록에 있다
  const guide = readFileSync(new URL('../src/data/guides/consult.txt', import.meta.url), 'utf8');
  const know = guide.slice(guide.indexOf('KNOWLEDGE'), guide.indexOf('CHANGE', guide.indexOf('KNOWLEDGE')));
  const names = [...new Set([...know.matchAll(/「([^」]+)」/g)].map((m) => m[1]))];
  ok(names.length >= 10, `증상 지식의 이름 ${names.length}개`);
  await clearTalk(page);
  await send(page, '안녕', [`<open>${menuNames.join(', ')}</open>`, SAY('네')]);
  const uAll = (await lastReq(page))[1];
  const stateText = uAll.slice(uAll.indexOf('[지금 상태]'), uAll.indexOf('[메뉴]'));
  const lost = names.filter((n) => !allRows.some((r) => r.label.split(' · ').includes(n)) && !stateText.includes(n));
  eq(lost.join(', '), '', '증상 지식에 적은 이름이 모두 설정 목록(또는 지금 상태 묶음)에 있다');

  // (아) 요청 토큰 상한(생성 공통): 0 이 아니면 그 안에서만 메뉴를 펼친다
  await doRaw('adv|adv-set|gen:budget=6000');
  eq((await chatOf(page)).scriptstate.$gen_budget, '6000', '요청 토큰 상한을 6000 으로 (통로)');
  await clearTalk(page);
  await send(page, '안녕', [`<open>${menuNames.join(', ')}</open>`, SAY('네')]);
  report.sizes.budget6000 = await sizeOf();
  ok(report.sizes.budget6000.opened.length < menuNames.length, `요청 토큰 상한 안에서만 펼친다 (${report.sizes.budget6000.opened.length}/${menuNames.length}개)`);
  await doRaw('adv|adv-set|gen:budget=0');

  // (자) <go>: 답 아래 「설정으로 가기 →」 단추 → 그 줄로
  await clearTalk(page);
  await send(page, '로어북 지워줘', [`${SAY('그건 상담에서 못 해요. 화면에서 직접 하셔야 해요.')}\n<go>pp-set.director</go>`]);
  ok(await page.evaluate(() => !!document.querySelector('.gw-ai .ai-gobtn [data-action="ai-go"]')), '<go>: 답 아래 「설정으로 가기 →」 단추');
  await shot('6-go');
  await clickSel(page, '.gw-ai .ai-gobtn [data-action="ai-go"]');
  await page.waitForFunction(() => document.querySelector('.gw .gw-tree-item.on')?.dataset.value === 'set:people');
  ok(await page.evaluate(() => !!document.querySelector('.gw .gw-body .gw-find-flash')), '<go>: 그 줄이 밝혀진다');
  await send(page, '음', [`${SAY('네')}\n<go>없는.id</go>`]);
  eq(await page.evaluate(() => document.querySelectorAll('.gw-ai .ai-gobtn').length), 1, '없는 id 의 <go> 는 단추를 만들지 않는다');

  // (차) 대화 지우기: 한 번 묻고, 이 채팅의 대화만 지운다 (설정·다른 채팅은 그대로)
  await clearTalk(page);
  await send(page, 'Director를 메모형으로', [`${SAY('바꿀까요?')}\n<set>\npp-set.director=메모형(뒤)\n</set>`]);
  await send(page, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
  eq((await chatOf(page)).scriptstate.$pp_director, 'note', '지우기 전: 상담이 바꾼 값');
  const chatA = await chatOf(page);
  // 다른 채팅으로 가서 한마디 (창을 닫았다 열어야 플러그인이 바뀐 채팅을 읽는다)
  const reopen = async () => { await closeEditor(page, true); await closeWin(page); await sleep(300); await openWin(page); await openEditor(page, 'set:people'); await sleep(300); await openConsult(page); };
  await setChat(page, { ...started(), id: 'other-chat', name: '다른 채팅' });
  await reopen();
  await send(page, '다른채팅표식말', [SAY('다른채팅답')]);
  await setChat(page, chatA);
  await reopen();
  const sBefore = await snap(page);
  const stored0 = await page.evaluate(() => window.__store['p:goei:consult'] ?? '');
  ok(stored0.includes('Director를 메모형으로'), '지우기 전: 저장소에 이 채팅의 대화');
  ok(stored0.includes('다른채팅표식말') && !(await logOf(page)).some((l) => l.includes('다른채팅표식말')) && (await logOf(page)).some((l) => l.includes('Director를 메모형으로')), '다른 채팅에서 한 말은 그 채팅의 대화로 따로 있다 (이 채팅 창에는 안 보인다)');
  await clickSel(page, '.gw-ai [data-action="ai-clear"]');
  await page.waitForSelector('.gw-ai [data-action="ai-clear-yes"]');
  eq(await page.evaluate(() => document.querySelector('.gw-ai .gw-confirm-box p')?.textContent), '이 채팅의 상담 대화를 지울까요? 바꾼 설정은 그대로 둬요.', '대화 지우기: 한 번 묻는다');
  ok(await page.evaluate(() => { const a = document.querySelector('.gw-ai').getBoundingClientRect(); const b = document.querySelector('.gw-ai .gw-confirm-box').getBoundingClientRect(); return b.left >= a.left && b.right <= a.right && b.top >= a.top && b.bottom <= a.bottom; }), '물음 상자가 상담 창 안에 있다');
  await shot('7-clear-ask');
  await clickSel(page, '.gw-ai [data-action="ai-clear-no"]');
  await page.waitForFunction(() => !document.querySelector('.gw-ai [data-action="ai-clear-yes"]'));
  ok((await logOf(page)).some((l) => l.includes('Director를 메모형으로')), '취소: 대화가 그대로');
  await clickSel(page, '.gw-ai [data-action="ai-clear"]');
  await page.waitForSelector('.gw-ai [data-action="ai-clear-yes"]');
  await clickSel(page, '.gw-ai [data-action="ai-clear-yes"]');
  await page.waitForFunction(() => !document.querySelector('.gw-ai [data-action="ai-clear-yes"]'));
  await sleep(200);
  const cleared = await logOf(page);
  ok(!cleared.some((l) => l.startsWith('ai-me') || l.startsWith('ai-op') || l.startsWith('ai-card')), `지운 뒤: 대화·판이 없다 (${cleared.join(' / ').slice(0, 120)})`);
  same(sBefore, await snap(page), '대화를 지워도 바꾼 설정은 그대로');
  const stored1 = await page.evaluate(() => window.__store['p:goei:consult'] ?? '');
  ok(!stored1.includes('Director를 메모형으로'), '저장소에서도 이 채팅의 대화가 지워졌다');
  ok(stored1.includes('다른채팅표식말') && stored1.includes('다른채팅답'), '다른 채팅의 대화는 그대로');
  // 지운 뒤 <apply> 가 와도 적어 둔 것이 없다
  await send(page, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
  same(sBefore, await snap(page), '지운 뒤의 <apply> 는 아무것도 바꾸지 않는다');
  await shot('8-after-clear');

  // (카) 상담 글은 채팅에도 메인·보조 요청에도 없다
  const chat = await chatOf(page);
  const words = ['다른채팅표식말', '지침을 바꿔', '바꾼 설정', '그건 상담에서 못 해요'];
  for (const w of words) ok(!JSON.stringify(chat).includes(w), `채팅에 상담 글 없음: ${w}`);
  const msgs = [{ role: 'system', content: 'sys' }, ...chat.message.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.data })), { role: 'user', content: '다음 말' }];
  for (const mode of ['model', 'submodel']) {
    const sent = JSON.stringify(await page.evaluate(([m, mode]) => window.__calls.replacers[0](m, mode), [msgs, mode]));
    for (const w of [...words, 'KNOWLEDGE', '[설정 목록]']) ok(!sent.includes(w), `${mode} 요청에 상담 글 없음: ${w}`);
  }
  eq(errors.length, 0, `콘솔 오류 없음(통로·글): ${errors.slice(0, 3).join(' / ')}`);
  await page.close();
}

/* ── 지난 턴 실제: 숫자만 넘긴다 (요청·응답 원문은 안 넘긴다) ── */
if (PART.includes('misc')) {
  const RAW = 'ZZ기록원문표식';
  await renew();
  const call = (label, phase, model, rq, rs, ms) => ({ id: label, at: '2026-11-12T10:00:00.000Z', label, model, ok: true, request: `system: ${RAW}`, requestChars: 100, requestTokens: rq, response: RAW, responseChars: 50, responseTokens: rs, phase, ms });
  const turn = { id: 't1', at: '2026-11-12T10:00:00.000Z', main: { at: '2026-11-12T10:00:00.000Z', shape: [{ role: 'user', chars: 10 }], tail: [{ role: 'user', content: RAW }], failed: [], totalChars: 90000, totalTokens: 31234 }, reply: { at: '2026-11-12T10:00:30.000Z', text: RAW, chars: 2000, tokens: 1234 }, calls: [call('Director', 'before', 'aux', 5210, 310, 4200), call('인물 갱신', 'after', 'aux', 30120, 890, 15300), call('AI 상담', 'manual', 'aux', 4000, 100, 900)] };
  const { page, errors } = await boot(browser, fx, started(), PC, { store: { 'p:goei-trace': JSON.stringify([turn]) } });
  await openWin(page);
  await openEditor(page, 'manage:flow');
  await sleep(500);
  await openConsult(page);
  await send(page, '왜 느려', [SAY('네')]);
  const u = (await lastReq(page))[1];
  const last = u.slice(u.indexOf('[지난 턴 실제]'), u.indexOf('[메뉴]'));
  ok(last.includes('31,234') && last.includes('1,234') && last.includes('Director') && last.includes('5,210') && last.includes('인물 갱신') && last.includes('30,120'), `지난 턴 실제: 호출마다 숫자 (${last.replace(/\n/g, ' / ').slice(0, 300)})`);
  ok(!last.includes('AI 상담'), '지난 턴 실제: 턴 밖에서 누른 호출(AI 상담 자신 등)은 넣지 않는다');
  ok(!(await lastReq(page)).join('\n').includes(RAW), '지난 턴 실제: 요청·응답 원문은 넘기지 않는다');
  report.lastTurn = last;
  eq(errors.length, 0, `콘솔 오류 없음(지난 턴): ${errors.slice(0, 3).join(' / ')}`);
  await page.close();
}

/* ── 사진: PC ── */
async function shots(vp, tag) {
  const { page, errors } = await boot(browser, fx, started(), vp);
  const phone = vp.touch;
  const shot = async (name) => { if (OUT) { await sleep(250); await page.screenshot({ path: `${OUT}/${tag}-${name}.png` }); } };
  await openWin(page);
  await openEditor(page, 'manage:flow');
  await sleep(600);
  await openConsult(page);
  await sleep(200);
  // 머리 한 줄: 제목 · 대화 지우기 · 모델 · 닫기가 한 줄에, 가로로 넘치지 않는다
  const head = await page.evaluate(() => {
    const ai = document.querySelector('.gw-ai');
    const btns = [...ai.querySelectorAll('[data-action="ai-clear"], [data-action="ai-model"], [data-action="ai-close"]')].map((b) => b.getBoundingClientRect());
    const a = ai.getBoundingClientRect();
    return { n: btns.length, tops: [...new Set(btns.map((b) => Math.round(b.top + b.height / 2)))], inside: btns.every((b) => b.left >= a.left - 1 && b.right <= a.right + 1), over: [...ai.querySelectorAll('*')].filter((e) => e.offsetParent !== null && e.getBoundingClientRect().right > innerWidth + 1).length };
  });
  eq(head.n, 3, `${tag}: 머리에 대화 지우기·모델·닫기`);
  ok(head.tops.length === 1 || Math.max(...head.tops) - Math.min(...head.tops) <= 3, `${tag}: 머리 단추가 한 줄 (${head.tops})`);
  ok(head.inside && head.over === 0, `${tag}: 머리가 넘치지 않는다`);
  await shot('1-open');
  await send(page, '답이 너무 늦게 와', ['<open>인물, 생성 공통</open>', `${SAY('메인 요청 전에 인물 Director 가 사실형(앞)으로 한 번 돌아요. 메모형(뒤)로 바꾸면 그 기다림이 없어지고, 대신 이번 턴 지시는 지난 턴 것을 써요. 바꿀까요?')}\n<set>\npp-set.director=메모형(뒤)\npp-set.director_timeout=30초\n</set>`]);
  await shot('2-propose');
  await send(page, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
  await shot('3-card');
  // 30줄 판
  await send(page, '인터넷 값을 다', ['<open>인터넷</open>', SAY('네')]);
  const net = parseList((await lastReq(page))[1]).get('인터넷').filter((r) => r.kind !== 'info' && !r.no && !/사용$/.test(r.label)).slice(0, 30);
  const p = await propose(page, net);
  ok(p.card.length >= 20, `${tag}: 한 판에 ${p.card.length}줄`);
  const wide = await page.evaluate(() => { const ai = document.querySelector('.gw-ai').getBoundingClientRect(); const c = [...document.querySelectorAll('.gw-ai .ai-card')].at(-1); return [...c.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > ai.right + 1).length; });
  eq(wide, 0, `${tag}: 긴 판이 상담 창 밖으로 넘치지 않는다`);
  await page.evaluate(() => { const c = [...document.querySelectorAll('.gw-ai .ai-card')].at(-1); c.scrollIntoView({ block: 'start' }); });
  await shot('4-card-30');
  await page.evaluate(() => { const l = document.querySelector('.gw-ai .gw-ai-log'); l.scrollTop = l.scrollHeight; });
  await shot('4b-card-30-end');
  eq(await undoLast(page), 'ok', `${tag}: 30줄 판 되돌리기`);
  // 글 칸 판
  await send(page, '항상 포함할 인물', [`${SAY('넣을까요?')}\n<set>\npp-always=김솔음, 류재관\n</set>`]);
  await send(page, '응', [`${SAY('넣었어요.')}\n<apply>yes</apply>`]);
  await shot('5-text-card');
  await send(page, '로어북 지워줘', [`${SAY('그건 상담에서 못 해요. 세계 탭에서 직접 하셔야 해요.')}\n<go>pp-set.director</go>`]);
  await shot('6-go');
  await clickSel(page, '.gw-ai [data-action="ai-clear"]');
  await page.waitForSelector('.gw-ai [data-action="ai-clear-yes"]');
  ok(await page.evaluate(() => { const b = document.querySelector('.gw-ai .gw-confirm-box').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; }), `${tag}: 물음 상자가 화면 안`);
  await shot('7-clear-ask');
  await clickSel(page, '.gw-ai [data-action="ai-clear-yes"]');
  await page.waitForFunction(() => !document.querySelector('.gw-ai [data-action="ai-clear-yes"]'));
  await shot('8-after-clear');
  if (phone) ok(await page.evaluate(() => { const i = document.querySelector('.gw-ai .gw-ai-in').getBoundingClientRect(); return i.bottom <= innerHeight + 1 && i.right <= innerWidth + 1; }), '폰: 글칸이 화면 안');
  eq(errors.length, 0, `콘솔 오류 없음(${tag}): ${errors.slice(0, 3).join(' / ')}`);
  await page.close();
}
if (PART.includes('shots')) { await renew(); await shots(PC, 'pc'); await shots(PHONE, 'phone'); }

await browser.close();
console.log(`consult-all: ${checks} checks passed`);
