// 관제 화면(호출 흐름)과 AI 상담 창 (설정 개편 5·6단계, 2026-11-12).
// 1) 관제 화면의 모든 조작을 눌러 그 설정의 원래 저장 자리(이 채팅 변수 / 새 채팅 기본값)에 적히는지, 누른 조작이 켜진 모양이 되는지
// 2) 시작 전(새 채팅 기본 설정): 메인 설정·상점 격자·생성 공통은 기본값에, 기능 값은 이 채팅에
// 3) 모든 「설정 →」이 그 메뉴 페이지의 그 줄로 가는지, 관제에서 바꾼 값이 메뉴 페이지에 같은 값으로 보이고 거꾸로도 그런지
// 4) AI 상담: 열기·닫기·자리, 묻기 → 바꾸자고 함(적용 안 됨) → 동의 → 적용 → 판 → 되돌리기, 목록에 없는 설정·고를 수 없는 값·범위 밖 수·
//    깨진 꼴·모델 실패, 동의 없이 바로 바꾸려는 답, 대화가 채팅(메시지·상태값)과 메인 요청에 한 글자도 안 들어가는지, 폰 판
// 사용법: node tests/flow-consult-browser.mjs <fixture.json>
import assert from 'node:assert/strict';
import { boot, chatOf, clickSel, goNode, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const browser = await launch();
const MARK = 'ZZ메인본문표식';
const started = () => ({ message: [{ role: 'user', data: 'hi' }, { role: 'char', data: `${MARK}\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]` }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fixed_theme: 'dark', $st_anomaly_on: '1' } });
const fresh = () => ({ message: [], scriptstate: {} });
const PC = { width: 1920, height: 1080, touch: false };
const PHONE = { width: 390, height: 844, touch: true };
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); checks++; };

const snap = (page) => page.evaluate(() => ({ chat: JSON.stringify(window.__chat.scriptstate ?? {}), prefs: window.__store['p:goei:prefs'] ?? '' }));
const DO = '.gw .fl-pc [data-action="fl-do"]';
const bar = (page) => page.evaluate(() => document.querySelector('.gw .fl-bar p')?.textContent ?? '');
const settle = async (page) => { await sleep(260); await page.waitForFunction(() => !document.querySelector('.gw .gw-save-state')); };

/** 관제 화면의 모든 조작을 한 번씩 누른다. where(값) = 그 조작이 적혀야 하는 곳 */
async function clickAll(page, where) {
  const done = new Set();
  let n = 0;
  for (let i = 0; i < 300; i++) {
    const next = await page.evaluate(([sel, done]) => {
      const e = [...document.querySelectorAll(sel)].find((e) => !e.disabled && e.getAttribute('aria-pressed') !== 'true' && !done.includes(e.dataset.value));
      if (!e) return null;
      return { v: e.dataset.value, row: e.closest('.fl-line')?.querySelector('.fl-name')?.textContent ?? '', sw: e.getAttribute('role') === 'switch', checked: e.getAttribute('aria-checked'), step: e.classList.contains('gx-step') ? e.parentElement.querySelector('b')?.textContent : null };
    }, [DO, [...done]]);
    if (!next) break;
    done.add(next.v);
    const a = await snap(page);
    await page.evaluate(([sel, v]) => [...document.querySelectorAll(sel)].find((e) => e.dataset.value === v).click(), [DO, next.v]);
    await settle(page);
    const b = await snap(page);
    const at = a.chat !== b.chat ? (a.prefs !== b.prefs ? 'both' : 'chat') : a.prefs !== b.prefs ? 'prefs' : 'none';
    eq(at, where(next.v), `${next.row} (${next.v}): 저장 자리`);
    // 화면: seg·격자 칸은 누른 것이 켜지고, 스위치는 뒤집히고, 수는 글이 바뀐다
    const now = await page.evaluate(([sel, v, row]) => {
      const same = [...document.querySelectorAll(sel)].find((e) => e.dataset.value === v);
      const line = [...document.querySelectorAll('.gw .fl-pc .fl-line')].find((l) => l.querySelector('.fl-name')?.textContent === row);
      return { pressed: same?.getAttribute('aria-pressed') ?? null, sw: line?.querySelector('[role="switch"]')?.getAttribute('aria-checked') ?? null, steps: [...(line?.querySelectorAll('.st-step b') ?? [])].map((x) => x.textContent).join('|') };
    }, [DO, next.v, next.row]);
    if (next.step !== null) ok(now.steps !== '' && !now.steps.split('|').includes(next.step) || now.steps.split('|').length > 1, `${next.row}: 수가 바뀜 (${next.step} → ${now.steps})`);
    else if (!next.sw) eq(now.pressed, 'true', `${next.row} (${next.v}): 누른 것이 켜짐`);
    n++;
  }
  return n;
}

/* ── 1. 시작 뒤: 모든 조작은 이 채팅에 ── */
{
  const { page, errors } = await boot(browser, fx, started(), PC);
  await openWin(page);
  await openEditor(page, 'manage:flow');
  await sleep(900);
  eq(await bar(page), '턴마다 보조 호출 2회 (조건에 따라 최대 3회) · 메인 1회', '맨 위 띠 (기본 설정)');
  const n = await clickAll(page, () => 'chat');
  ok(n >= 85, `조작 ${n}개를 눌렀다`);
  // 맨 위 띠와 줄의 호출 글이 바로 바뀐다
  const say = (row) => page.evaluate((row) => [...document.querySelectorAll('.gw .fl-pc .fl-line')].find((l) => l.querySelector('.fl-name')?.textContent === row)?.querySelector('.fl-said')?.textContent ?? '', row);
  const before = await bar(page);
  const routerTo = (await say('Router')) === '1회' ? 'code' : 'model';
  await clickSel(page, `${DO}[data-value="pp-set|router=${routerTo}"]`);
  await settle(page);
  ok((await bar(page)) !== before, '맨 위 띠의 호출 수가 바로 바뀜');
  eq(await say('Router'), routerTo === 'model' ? '1회' : '호출 없음', 'Router 호출 글');
  eq(await page.evaluate(() => !!document.querySelector('.gw .fl-pc [data-value="pp-set|model_router=aux"]')), routerTo === 'model', 'Router 모델은 「모델이 고름」일 때만');
  // 인물 사용을 끄면 Router·Director·갱신기·정리 줄이 흐려지고 띠가 준다
  await clickSel(page, `${DO}[data-value="pp-set|on=0"]`);
  await settle(page);
  eq(await say('Router'), '호출 없음 (인물 기록 끔)', '인물 끔: Router 호출 글');
  await clickSel(page, `${DO}[data-value="pp-set|on=1"]`);
  await settle(page);

  /* ── 3. 「설정 →」: 그 페이지의 그 줄 ── */
  const gos = await page.evaluate(() => [...new Set([...document.querySelectorAll('.gw .fl-pc [data-action="ed-flow-go"]')].map((e) => e.dataset.value))]);
  ok(gos.length >= 20, `「설정 →」 ${gos.length}가지`);
  for (const g of gos) {
    const [pg, to] = g.split('|');
    await clickSel(page, `.gw .fl-pc [data-action="ed-flow-go"][data-value="${g}"]`);
    await page.waitForFunction((pg) => document.querySelector('.gw .gw-tree-item.on')?.dataset.value === pg, pg);
    await sleep(200);
    const hit = await page.evaluate(() => {
      const el = document.querySelector('.gw .gw-body .gw-find-flash');
      if (!el) return null;
      const own = (h) => (h ? [...h.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : '');
      return { row: el.classList.contains('ps-row'), label: own(el.querySelector('.ps-label > b')), group: el.closest('.ps-group')?.querySelector('h3')?.textContent?.trim() ?? '', text: el.textContent.replace(/\s+/g, ' ').slice(0, 400) };
    });
    ok(hit, `${g}: 밝혀진 줄이 있다`);
    const [label, grp] = to.slice(2).split('@');
    if (hit.row) { eq(hit.label, label, `${g}: 줄 이름`); if (grp) eq(hit.group, grp, `${g}: 묶음`); }
    else ok(hit.text.includes(label), `${g}: 격자에 「${label}」 열이 있다`);
    await goNode(page, 'manage:flow');
    await sleep(120);
  }

  /* ── 3-2. 관제 ↔ 메뉴 페이지: 같은 값 ── */
  const pressedIn = (label) => page.evaluate((label) => {
    const own = (h) => (h ? [...h.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : '');
    const row = [...document.querySelectorAll('.gw .gw-body .ps-row')].find((r) => own(r.querySelector('.ps-label > b')) === label);
    return row?.querySelector('.gx-seg.on')?.textContent ?? row?.querySelector('[role="switch"]')?.getAttribute('aria-checked') ?? null;
  }, label);
  await clickSel(page, `${DO}[data-value="pp-set|director=note"]`);
  await settle(page);
  await goNode(page, 'set:people');
  eq(await pressedIn('Director'), '메모형(뒤)', '관제에서 바꾼 Director 가 인물 페이지에 보임');
  await clickSel(page, '.gw .gw-body [data-action="pp-set"][data-value="director=scene"]');
  await settle(page);
  await goNode(page, 'manage:flow');
  eq(await page.evaluate((sel) => document.querySelector(`${sel}[data-value="pp-set|director=scene"]`)?.getAttribute('aria-pressed'), DO), 'true', '인물 페이지에서 바꾼 Director 가 관제에 보임');
  await clickSel(page, `${DO}[data-value="set-asset-model|aux"]`);
  await settle(page);
  await goNode(page, 'set:image');
  eq(await pressedIn('모델'), '보조 모델', '관제에서 바꾼 이미지 태그 모델이 캐릭터 이미지 페이지에 보임');
  await goNode(page, 'manage:flow');
  await clickSel(page, `${DO}[data-value="adv-set|gen:retries=2"], ${DO}[data-value="adv-set|gen:retries=1"]`);
  await settle(page);
  const retries = (await chatOf(page)).scriptstate.$gen_retries || '1';
  await goNode(page, 'set:adv');
  eq(await page.evaluate(() => document.querySelector('.gw .gw-body [data-change="adv-set"][data-key="gen:retries"]')?.value), retries, '관제에서 바꾼 형식 오류 재시도가 생성 공통 페이지에 보임');
  eq(errors.length, 0, `콘솔 오류 없음: ${errors.slice(0, 3).join(' / ')}`);
  await page.close();
}

/* ── 2. 시작 전: 메뉴 페이지와 같은 곳에 ── */
{
  const { page, errors } = await boot(browser, fx, fresh(), PC);
  await openWin(page);
  await openEditor(page, 'manage:flow');
  await sleep(900);
  const n = await clickAll(page, (v) => (/^(set-|adv-set|fam-set\|s:)/.test(v) ? 'prefs' : 'chat'));
  ok(n >= 85, `시작 전 조작 ${n}개`);
  // 기본값에 적은 값은 그 메뉴 페이지(새 채팅 기본값)에도 같은 값
  await clickSel(page, `${DO}[data-value="set-asset-model|aux"]`);
  await settle(page);
  eq(JSON.parse((await snap(page)).prefs).basic.assetModel, 'aux', '시작 전 이미지 태그 모델 = 새 채팅 기본값');
  ok(/보조 호출 \d+회/.test(await bar(page)), '시작 전에도 맨 위 띠가 센다');
  eq(errors.length, 0, `콘솔 오류 없음(시작 전): ${errors.slice(0, 3).join(' / ')}`);
  await page.close();
}

/* ── 4. AI 상담 ── */
const SAY = (t) => `<say>${t}</say>`;
const logOf = (page) => page.evaluate(() => [...document.querySelectorAll('.gw-ai .gw-ai-log > *')].map((e) => `${e.className.replace('ai-m ', '')}: ${e.textContent.replace(/\s+/g, ' ').trim()}`));
async function send(page, text, replies) {
  await page.evaluate((r) => { window.__llm = r; }, replies);
  await page.evaluate((t) => { const i = document.querySelector('.gw-ai [name="ai-q"]'); i.value = t; i.dispatchEvent(new Event('input', { bubbles: true })); }, text);
  await clickSel(page, '.gw-ai [data-action="ai-send"]');
  await page.waitForFunction(() => document.querySelector('.gw-ai [name="ai-q"]')?.disabled === true).catch(() => {});
  await page.waitForFunction(() => document.querySelector('.gw-ai [name="ai-q"]')?.disabled === false, null, { timeout: 15000 });
  await sleep(150);
}
{
  const { page, errors } = await boot(browser, fx, started(), PC);
  await openWin(page);
  await openEditor(page, 'manage:flow');
  await sleep(600);
  // 머리의 「AI 상담」 단추: 닫기 단추 바로 앞
  const head = await page.evaluate(() => [...document.querySelector('.gw .gw-top-right').children].map((e) => e.dataset.action));
  eq(head.join(','), 'ai-toggle,ed-close', '설정 창 머리 오른쪽: AI 상담 · 닫기');
  eq(await page.evaluate(() => !!document.querySelector('.gw-ai')), false, '처음엔 닫혀 있다');
  await clickSel(page, '.gw [data-action="ai-toggle"]');
  await page.waitForSelector('.gw-ai');
  const box = await page.evaluate(() => { const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; }; return { win: r('.gw-win'), ai: r('.gw-ai'), vw: innerWidth }; });
  eq(box.ai.w, 380, 'PC: 상담 창 폭 380px');
  ok(box.ai.l >= box.win.r + 8 && box.ai.r <= box.vw, `PC: 설정 창 옆에 뜬다 (설정 ${box.win.l}~${box.win.r}, 상담 ${box.ai.l}~${box.ai.r})`);
  eq(box.ai.h, box.win.h, 'PC: 높이가 설정 창과 같다');
  ok(box.win.w <= 1340, '설정 창 폭 1340px 이하');
  eq(await page.evaluate(() => document.querySelector('.gw-ai .ai-model').textContent), '보조 모델', '기본은 보조 모델');
  const dir0 = (await chatOf(page)).scriptstate.$pp_director;

  // (가) 묻기 → 바꾸자고 함: 이 턴에는 아무것도 안 바뀐다
  await send(page, '토큰을 줄이고 싶어', [`${SAY('Director를 메모형(뒤)로 바꾸면 메인 요청 전 호출이 없어져요. 바꿀까요?')}\n<set>\npp.director=메모형(뒤)\n</set>`]);
  eq((await chatOf(page)).scriptstate.$pp_director, dir0, '바꾸자고 한 턴에는 적용하지 않는다');
  eq(await page.evaluate(() => document.querySelectorAll('.gw-ai .ai-card').length), 0, '판이 아직 없다');
  const req = await page.evaluate(() => window.__calls.llm.at(-1));
  eq(req.mode, 'submodel', '보조 모델로 부른다');
  const reqText = JSON.stringify(req.messages);
  ok(!reqText.includes('ZZ메인본문표식'), '상담 요청에 채팅 글이 없다');
  ok(reqText.includes('[pp.director]') && reqText.includes('[gen.retries]') && reqText.includes('[board.gn.auto]'), '상담 요청에 관제 화면의 설정 목록이 들어간다');
  ok(reqText.includes('턴마다 보조 호출'), '상담 요청에 지금 호출 수가 들어간다');
  // (나) 동의 → 적용 → 판
  await send(page, '응 바꿔줘', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
  eq((await chatOf(page)).scriptstate.$pp_director, 'note', '동의한 뒤에 적용된다');
  ok(JSON.stringify(await page.evaluate(() => window.__calls.llm.at(-1).messages)).includes('pp.director=메모형(뒤)'), '동의 턴 요청에 「바꾸자고 한 것」이 들어간다');
  const card = await page.evaluate(() => { const c = document.querySelector('.gw-ai .ai-card'); return c ? { head: c.querySelector('b').textContent, row: c.querySelector('.ai-ch').textContent.replace(/\s+/g, ' ').trim(), btns: [...c.querySelectorAll('button')].map((b) => b.textContent) } : null; });
  eq(card?.head, '바꾼 설정 1개', '판 머리');
  eq(card?.row, '인물 · Director사실형(앞) → 메모형(뒤)', '판: 무엇을 무엇에서 무엇으로');
  eq(card?.btns.join('|'), '되돌리기|설정으로 가기 →', '판 단추');
  eq(await page.evaluate((sel) => document.querySelector(`${sel}[data-value="pp-set|director=note"]`)?.getAttribute('aria-pressed'), DO), 'true', '바뀐 값이 설정 창에 바로 보인다');
  // (다) 되돌리기
  await clickSel(page, '.gw-ai [data-action="ai-undo"]');
  await page.waitForFunction(() => document.querySelector('.gw-ai .ai-card button')?.textContent === '되돌렸어요');
  eq((await chatOf(page)).scriptstate.$pp_director, 'facts', '되돌리기: 전 값으로');
  // (라) 설정으로 가기 →
  await clickSel(page, '.gw-ai [data-action="ai-go"]');
  await page.waitForFunction(() => document.querySelector('.gw .gw-tree-item.on')?.dataset.value === 'set:people');
  ok(await page.evaluate(() => !!document.querySelector('.gw .gw-body .gw-find-flash')), '설정으로 가기: 그 줄이 밝혀진다');
  ok(await page.evaluate(() => !!document.querySelector('.gw-ai')), 'PC: 다른 메뉴로 가도 상담 창은 그대로');
  // (마) 동의 없이 바로 바꾸려는 답: 적어 둔 것이 없으니 아무것도 안 바뀐다
  const on0 = (await chatOf(page)).scriptstate.$pp_on;
  await send(page, '인물 기록 꺼', [`${SAY('껐어요.')}\n<set>\npp.on=끔\n</set>\n<apply>yes</apply>`]);
  eq((await chatOf(page)).scriptstate.$pp_on, on0, '바꾸자고 한 적 없는 것은 <apply> 가 와도 적용하지 않는다');
  ok((await logOf(page)).some((l) => l.startsWith('ai-sys') && l.includes('아무것도 바꾸지 않았어요')), '적용하지 않았다고 알린다');
  // 사용자가 다른 말을 하면 적어 둔 것은 버린다
  await send(page, '아니 됐어', [SAY('알겠어요.')]);
  await send(page, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
  eq((await chatOf(page)).scriptstate.$pp_on, on0, '거절한 뒤의 <apply> 는 적용하지 않는다');
  // (바) 목록에 없는 설정 · 고를 수 없는 값 · 범위 밖 수는 빠지고, 맞는 것만 남는다
  await send(page, '이것저것 바꿔줘', [`${SAY('네 가지를 바꿀까요?')}\n<set>\nnope.key=1\n$pp_log=지움\npp.director=없는값\ngen.retries=9\npp.when=수동\n</set>`]);
  const sys = (await logOf(page)).filter((l) => l.startsWith('ai-sys')).at(-1) ?? '';
  ok(sys.includes('nope.key') && sys.includes('Director') && sys.includes('형식 오류 재시도'), `못 바꾸는 것을 알린다: ${sys}`);
  const before = (await chatOf(page)).scriptstate;
  await send(page, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
  const after = (await chatOf(page)).scriptstate;
  eq(after.$pp_when, 'manual', '맞는 것(갱신기 자동 호출 = 수동)만 적용');
  eq(after.$pp_director, before.$pp_director, '고를 수 없는 값은 적용 안 됨');
  eq(after.$gen_retries, before.$gen_retries, '범위 밖 수는 적용 안 됨');
  eq(after.$pp_log, before.$pp_log, '설정이 아닌 변수는 건드릴 길이 없다');
  // (사) 깨진 꼴: 다시 묻고(형식 오류 재시도), 끝까지 틀리면 실패 줄 + 다시 시도
  const calls0 = await page.evaluate(() => window.__calls.llm.length);
  await send(page, '괴담톡이 너무 자주 와', ['그냥 글', '또 그냥 글', '또', '또']);
  const tries = (await page.evaluate(() => window.__calls.llm.length)) - calls0;
  ok(tries >= 2, `깨진 꼴은 다시 묻는다 (${tries}번 부름)`);
  ok((await logOf(page)).at(-1).startsWith('ai-sys ai-err'), '끝까지 틀리면 「답을 받지 못했어요」 줄');
  await page.evaluate((r) => { window.__llm = r; }, [SAY('괴담톡 자동 호출이 매 턴이에요.')]);
  await clickSel(page, '.gw-ai [data-action="ai-retry"]');
  await page.waitForFunction(() => document.querySelector('.gw-ai .gw-ai-log > :last-child')?.classList.contains('ai-op'), null, { timeout: 15000 });
  eq((await logOf(page)).filter((l) => l.includes('괴담톡이 너무 자주 와')).length, 1, '다시 시도: 내 말은 한 번만');
  // (아) 모델 실패
  await send(page, '위키는?', []);
  ok((await logOf(page)).at(-1).includes('답을 받지 못했어요'), '모델 실패: 실패 줄');
  // (자) 메인 모델로 바꾸기 (이 기기 설정)
  await clickSel(page, '.gw-ai [data-action="ai-model"]');
  await page.waitForFunction(() => document.querySelector('.gw-ai .ai-model')?.textContent === '메인 모델');
  await send(page, '위키는?', [SAY('위키 자동 호출은 수동이에요.')]);
  eq(await page.evaluate(() => window.__calls.llm.at(-1).mode), 'model', '메인 모델로 부른다');
  await clickSel(page, '.gw-ai [data-action="ai-model"]');
  await page.waitForFunction(() => document.querySelector('.gw-ai .ai-model')?.textContent === '보조 모델');

  /* ── 대화는 채팅에도 메인 요청에도 없다 ── */
  const chat = await chatOf(page);
  const words = ['토큰을 줄이고 싶어', '괴담톡이 너무 자주 와', '메인 요청 전 호출이 없어져요', '바꾼 설정'];
  for (const w of words) ok(!JSON.stringify(chat).includes(w), `채팅(메시지·상태값)에 상담 글 없음: ${w}`);
  const stored = await page.evaluate(() => window.__store['p:goei:consult'] ?? '');
  ok(stored.includes('토큰을 줄이고 싶어') && stored.includes('메인 요청 전 호출이 없어져요'), '상담 대화는 플러그인 저장소(goei:consult)에 있다');
  const msgs = [{ role: 'system', content: 'sys' }, ...chat.message.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.data })), { role: 'user', content: '다음 말' }];
  const sent = JSON.stringify(await page.evaluate((m) => window.__calls.replacers[0](m, 'model'), msgs));
  ok(sent.length > 500, '메인 요청을 조립했다');
  for (const w of words) ok(!sent.includes(w), `메인 요청에 상담 글 없음: ${w}`);
  const sub = JSON.stringify(await page.evaluate((m) => window.__calls.replacers[0](m, 'submodel'), msgs));
  for (const w of words) ok(!sub.includes(w), `보조 요청에도 상담 글 없음: ${w}`);

  /* ── 닫기 · 다시 열기 ── */
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.gw-ai'));
  eq(await page.evaluate(() => document.querySelector('.gw').hidden), false, 'Esc: 상담 창만 닫히고 설정 창은 그대로');
  await clickSel(page, '.gw [data-action="ai-toggle"]');
  await page.waitForSelector('.gw-ai');
  ok((await logOf(page)).some((l) => l.includes('토큰을 줄이고 싶어')), '다시 열면 대화가 남아 있다');
  await clickSel(page, '.gw .gw-top [data-action="ed-close"]');
  await page.waitForFunction(() => document.querySelector('.gw')?.hidden === true);
  await clickSel(page, '.gx [data-action="ed-open"]');
  await page.waitForFunction(() => document.querySelector('.gw')?.hidden === false);
  eq(await page.evaluate(() => !!document.querySelector('.gw-ai')), false, '설정 창을 닫았다 열면 상담 창은 닫혀 있다');
  eq(errors.length, 0, `콘솔 오류 없음(상담): ${errors.slice(0, 3).join(' / ')}`);
  await page.close();
}

/* ── 4-2. 시작 전에도 상담이 기본값을 바꾼다 ── */
{
  const { page, errors } = await boot(browser, fx, fresh(), PC);
  await openWin(page);
  await openEditor(page, 'manage:flow');
  await sleep(600);
  await clickSel(page, '.gw [data-action="ai-toggle"]');
  await page.waitForSelector('.gw-ai');
  await send(page, '이미지 태그 모델을 보조로', [`${SAY('이미지 태그 모델을 보조 모델로 바꿀까요?')}\n<set>\nimg.model=보조 모델\npp.when=수동\n</set>`]);
  await send(page, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
  const s = await snap(page);
  eq(JSON.parse(s.prefs).basic.assetModel, 'aux', '시작 전: 메인 설정 값은 새 채팅 기본값에');
  eq(JSON.parse(s.chat).$pp_when, 'manual', '시작 전: 기능 값은 이 채팅에');
  eq(await page.evaluate(() => document.querySelector('.gw-ai .ai-card b')?.textContent), '바꾼 설정 2개', '시작 전: 판');
  eq(errors.length, 0, `콘솔 오류 없음(시작 전 상담): ${errors.slice(0, 3).join(' / ')}`);
  await page.close();
}

/* ── 5. 폰: 판 하나씩 · 첫 판 위 테두리 · 상담은 아래 판 ── */
{
  const { page, errors } = await boot(browser, fx, started(), PHONE);
  await openWin(page);
  await openEditor(page, 'manage:flow');
  await sleep(700);
  const ph = await page.evaluate(() => {
    const vis = (e) => e.offsetParent !== null;
    const cards = [...document.querySelectorAll('.gw .fl-ph > .flc')].filter(vis);
    const tops = [...new Set(cards.map((c) => { const s = getComputedStyle(c); return `${s.borderTopWidth} ${s.borderTopStyle}`; }))];
    const over = [...document.querySelectorAll('.gw .gw-body *')].filter((e) => vis(e) && e.getBoundingClientRect().right > innerWidth + 1).length;
    return { cards: cards.length, tops, pcShown: [...document.querySelectorAll('.gw .fl-pc')].filter(vis).length, over, steps: [...new Set([...document.querySelectorAll('.gw .fl-ph .st-step')].filter(vis).map((e) => `${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`))] };
  });
  ok(ph.cards >= 30, `폰: 기능마다 판 (${ph.cards}개)`);
  eq(ph.tops.join(','), '1px solid', '폰: 모든 판에 위 테두리');
  eq(ph.pcShown, 0, '폰: PC 표는 안 보인다');
  eq(ph.over, 0, '폰: 가로로 넘치는 것 없음');
  eq(ph.steps.length, 1, `폰: 수 상자는 한 가지 크기 (${ph.steps})`);
  // 폰에서도 조작이 저장된다
  const a = await snap(page);
  await clickSel(page, '.gw .fl-ph [data-action="fl-do"][data-value="pp-set|router=model"]');
  await settle(page);
  ok((await snap(page)).chat !== a.chat, '폰: 조작이 저장된다');
  await clickSel(page, '.gw [data-action="ai-toggle"]');
  await page.waitForSelector('.gw-ai');
  await sleep(200);
  const sheet = await page.evaluate(() => { const r = document.querySelector('.gw-ai').getBoundingClientRect(); return { l: Math.round(r.left), w: Math.round(r.width), b: Math.round(r.bottom), t: Math.round(r.top), vh: innerHeight, vw: innerWidth }; });
  eq(sheet.w, sheet.vw, '폰: 판이 화면 폭');
  eq(sheet.b, sheet.vh, '폰: 판이 화면 아래에 붙는다');
  ok(sheet.t > 100, '폰: 위에 설정 화면이 조금 보인다');
  await send(page, '갱신기를 수동으로', [`${SAY('갱신기 자동 호출을 수동으로 바꿀까요?')}\n<set>\npp.when=수동\n</set>`]);
  await send(page, '응', [`${SAY('바꿨어요.')}\n<apply>yes</apply>`]);
  eq((await chatOf(page)).scriptstate.$pp_when, 'manual', '폰: 상담으로 바꾼다');
  ok(await page.evaluate(() => { const i = document.querySelector('.gw-ai .gw-ai-in').getBoundingClientRect(); return i.bottom <= innerHeight + 1 && i.right <= innerWidth + 1; }), '폰: 글칸이 화면 안');
  // 판 바깥(어두운 곳)을 누르면 판만 닫힌다
  await page.mouse.click(195, 40);
  await page.waitForFunction(() => !document.querySelector('.gw-ai'));
  eq(await page.evaluate(() => document.querySelector('.gw').hidden), false, '폰: 바깥을 누르면 판만 닫힌다');
  // 설정으로 가기 → : 판을 닫고 그 줄로
  await clickSel(page, '.gw [data-action="ai-toggle"]');
  await page.waitForSelector('.gw-ai');
  await clickSel(page, '.gw-ai [data-action="ai-go"]');
  await page.waitForFunction(() => !document.querySelector('.gw-ai') && !!document.querySelector('.gw .gw-body .gw-find-flash'));
  checks++;
  eq(errors.length, 0, `콘솔 오류 없음(폰): ${errors.slice(0, 3).join(' / ')}`);
  await page.close();
}

await browser.close();
console.log(`flow-consult: ${checks} checks passed`);
