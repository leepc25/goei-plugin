// 「다음 메시지에 사용」 칩 (host/usebox.ts) — 2026-11-12 사용자: 「채팅 보냈는데 왜 안 없어져」
// 보는 것: 놓으면 마지막 메시지 아래에 보임 → 보내면(요청 조립) 이름표가 「보내는 중」(전수검사 11-13), 요청에는 한 번만 실림 → 응답이 붙으면 숨고 기록만 남음 → 다음 턴엔 안 실림
//         빈 입력 이어 쓰기 · 다시 굴리기 · 요청 실패(기다림 시간 초과) · 새로 고침.
// 사용법: node tests/usebar-browser.mjs [out-dir]   (out-dir 을 주면 PC·폰 사진을 남긴다)
import { mkdirSync } from 'node:fs';
import { boot, closeEditor, closeWin, launch, loadFixture, openWin, sleep } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';

const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const out = process.argv[2] ?? '';
if (out) mkdirSync(out, { recursive: true });
const mk = (name, desc, extra = {}) => ({ id: `i_${name}`, name, desc, effect: '', use: false, state: 'ok', from: 'story', anchor: 'c1', at: '2026-11-07T00:00:00Z', ...extra });
const items = { list: [mk('소형 손전등', '건전지 넉넉', { use: true }), mk('딸기맛 막대사탕', '두 개', { use: true, uses: 2 }), mk('낡은 열쇠', '어디 것인지 모름')], log: [] };
const STATUS = '[▣|2025.03.10|05:52 PM|🌧️|8°C|중림동 손길 의원 회복실|목표]';
const base = () => ({
  message: [{ role: 'user', data: 'hi', chatId: 'u1' }, { role: 'char', data: `본문\n${STATUS}`, chatId: 'c1' }],
  scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_items: JSON.stringify(items), $st_look: JSON.parse(distPack('goei-data-looks')).looks.find((l) => l.g === '여')?.id ?? '' },
});

const b = await launch();
const fails = [];
for (const vp of ['pc', 'phone']) {
  const errors = [];
  let page;
  /** 장면마다 새 페이지 (앞 장면의 창 상태·기억이 섞이지 않게) */
  const fresh = async () => {
    if (page) await page.close();
    const r0 = await boot(b, fx, base(), vp, { store: { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') } });
    page = r0.page; r0.errors && errors.push(r0.errors);
  };
  await fresh();
  const bad = (m) => { fails.push(`[${vp}] ${m}`); console.log('FAIL', vp, m); };
  const click = async (sel) => { await page.evaluate((q) => document.querySelector(q)?.click(), sel); await sleep(250); };

  /** 소지품 창에서 물건을 「사용」에 놓는다 (창이 새 채팅을 다 읽을 때까지 기다리고, 놓였는지 변수로 확인) */
  const queue = async (names = ['소형 손전등', '딸기맛 막대사탕']) => {
    await openWin(page); await sleep(300);
    if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
    // 소지품 탭: 보이는 단추를 누른다 (PC 는 숨은 폰 탭이 먼저 잡힌다)
    for (let i = 0; i < 10 && !(await page.$('.it-c')); i++) {
      await page.evaluate(() => { const t = [...document.querySelectorAll('[data-action="tab"][data-value="items"], [data-action="nav-tab"][data-value="items"]')]; (t.find((x) => x.offsetParent !== null) ?? t[0])?.click(); });
      await sleep(400);
    }
    for (const n of names) {
      const id = `i_${n}`;
      for (let i = 0; i < 8; i++) {
        if (await page.evaluate((k) => (window.__chat.scriptstate.$st_item_use ?? '').includes(k), id)) break;
        await page.waitForSelector(`.it-c[data-value="${id}"]`, { timeout: 5000 });
        await click(`.it-c[data-value="${id}"]`);
        await click('[data-action="items-use"]');
        await click('[data-action="items-close"]');
        await sleep(200);
      }
    }
    await closeWin(page); await sleep(300);
  };
  /** 채팅 화면 흉내: 지금 채팅을 화면 처리기로 그려 놓고, 마지막 메시지의 칩 상태를 읽는다 */
  const bar = () => page.evaluate(async () => {
    document.querySelector('#chatmock')?.remove();
    const list = document.createElement('div');
    list.id = 'chatmock';
    list.style.cssText = 'position:fixed;left:16px;right:16px;bottom:70px;z-index:1;display:flex;flex-direction:column-reverse;color:#ddd;font:14px sans-serif';
    for (const m of [...window.__chat.message].reverse()) {
      const d = document.createElement('div');
      d.className = 'chat-message-container';
      d.dataset.role = m.role;
      d.innerHTML = await window.__calls.handlers.display(m.data);
      list.appendChild(d);
    }
    const input = document.createElement('div');
    input.id = 'inputmock';
    input.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;height:44px;border:1px solid #556;border-radius:8px;z-index:1';
    document.querySelector('#inputmock')?.remove();
    document.body.append(list, input);
    const vis = (e) => getComputedStyle(e).display !== 'none';
    const cards = [...list.querySelectorAll('[data-goei-card="use"]')];
    const on = cards.filter(vis);
    const card = on[0];
    return {
      shown: on.length,
      label: card ? getComputedStyle(card.querySelector('[data-gu-label]'), '::before').content.replace(/^"|"$/g, '') : '',
      under: card ? card.closest('.chat-message-container').dataset.role : '',
      last: card ? card.closest('.chat-message-container') === list.firstElementChild : false,
      names: card ? [...card.querySelectorAll('[data-gu]')].filter(vis).map((e) => getComputedStyle(e, '::before').content.replace(/^"|"$/g, '')) : [],
      overflow: card ? card.getBoundingClientRect().right > innerWidth + 1 || card.getBoundingClientRect().left < -1 : false,
      gapToInput: card ? Math.round(input.getBoundingClientRect().top - card.getBoundingClientRect().bottom) : null,
    };
  });
  /** 본편 요청 조립을 부른다 (유저 메시지를 넣었으면 그것까지). 요청 속 uses 줄 수를 돌려준다 */
  const send = (text) => page.evaluate(async (t) => {
    const c = window.__chat;
    if (t !== null) c.message.push({ role: 'user', data: t, chatId: `u${c.message.length}` });
    const msgs = c.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
    const req = await window.__calls.replacers[0](msgs, 'model');
    const inv = req.filter((m) => typeof m.content === 'string' && m.content.startsWith('[Inventory]')).map((m) => m.content);
    return { blocks: inv.length, uses: inv.join('\n').split('\n').filter((l) => /^This turn: .*uses /.test(l)), text: inv.join('\n') };
  }, text);
  /** 응답이 붙었다 */
  const respond = (text = `다음 장면.\n${STATUS}`) => page.evaluate(async (t) => {
    const c = window.__chat;
    c.message.push({ role: 'char', data: t, chatId: `c${c.message.length}` });
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
  }, text);
  const vars = () => page.evaluate(() => ({ use: window.__chat.scriptstate.$st_item_use ?? '', at: window.__chat.scriptstate.$st_item_use_at ?? '', log: JSON.parse(window.__chat.scriptstate.$st_items).log.filter((l) => l.what === 'use').map((l) => `${l.name}@${l.anchor}`) }));
  const reset = fresh;
  const shot = async (n) => { if (out) await page.screenshot({ path: `${out}/${vp}_${n}.png` }); };

  // ── 1. 놓기 → 보내기 → 응답 → 다음 턴 ──
  await queue();
  let s = await bar();
  console.log(vp, '1 queued', JSON.stringify(s));
  if (s.shown !== 1 || !s.last || s.under !== 'char' || s.names.length !== 2) bad(`놓은 뒤 칩이 마지막 응답 아래에 2개로 보여야 한다: ${JSON.stringify(s)}`);
  if (s.overflow) bad('칩 상자가 화면 밖으로 넘친다');
  await shot('1_queued');
  let r = await send('내용을 계속 이어가주세요');
  if (r.uses.length !== 1 || !/소형 손전등/.test(r.uses[0]) || !/딸기맛 막대사탕/.test(r.uses[0])) bad(`요청에 uses 줄이 한 번 실려야 한다: ${JSON.stringify(r.uses)}`);
  s = await bar();
  console.log(vp, '1 sent', JSON.stringify(s), JSON.stringify(r.uses));
  if (s.shown !== 1 || s.label !== '보내는 중' || s.names.length !== 2) bad(`보낸 뒤(응답 전) 칩은 이름표 「보내는 중」으로 남아야 한다: ${JSON.stringify(s)}`);
  await shot('2_sent_waiting');
  await respond();
  s = await bar();
  let v = await vars();
  console.log(vp, '1 responded', JSON.stringify(s), JSON.stringify(v));
  if (s.shown !== 0) bad(`응답 뒤 칩이 남아 있다: ${JSON.stringify(s)}`);
  if (!v.at || v.log.length !== 2) bad(`응답 뒤 사용 기록 2줄과 보낸 턴 표시가 있어야 한다: ${JSON.stringify(v)}`);
  r = await send('다음');
  if (r.uses.length) bad(`다음 턴 요청에 지난 사용이 또 실렸다: ${JSON.stringify(r.uses)}`);
  await respond();
  v = await vars();
  s = await bar();
  if (v.use || v.at || s.shown) bad(`다음 턴 응답 뒤에는 자리가 비어야 한다: ${JSON.stringify(v)} ${JSON.stringify(s)}`);

  // ── 2. 빈 입력으로 이어 쓰기 (새 유저 메시지 없음) ──
  await reset(); await queue();
  r = await send(null);
  s = await bar();
  if (r.uses.length !== 1 || s.shown !== 1 || s.label !== '보내는 중') bad(`빈 입력 이어 쓰기: 요청에 한 번 실리고 칩은 「보내는 중」이어야 한다: ${JSON.stringify(r.uses)} ${JSON.stringify(s)}`);
  await respond();
  v = await vars(); s = await bar();
  console.log(vp, '2 continue', JSON.stringify(v));
  if (s.shown || v.log.length !== 2) bad(`빈 입력 이어 쓰기 응답 뒤: ${JSON.stringify(v)} ${JSON.stringify(s)}`);

  // ── 3. 다시 굴리기: 응답을 지우고 같은 유저 턴으로 다시 요청 ──
  await reset(); await queue();
  await send('쓴다'); await respond();
  await page.evaluate(() => { window.__chat.message.pop(); });
  r = await send(null);
  s = await bar();
  if (r.uses.length !== 1 || s.shown) bad(`다시 굴리기: 요청에 한 번 실리고 칩은 숨은 채여야 한다: ${JSON.stringify(r.uses)} ${JSON.stringify(s)}`);
  await respond();
  v = await vars();
  console.log(vp, '3 reroll', JSON.stringify(v));
  if (v.log.length !== 2) bad(`다시 굴린 응답에 사용 기록이 2줄이어야 한다(옛 응답 것은 죽음): ${JSON.stringify(v)}`);

  // ── 4. 보낸 뒤 응답 전에 물건을 더 놓으면 그것만 보인다 ──
  await reset();
  await queue(['소형 손전등']);
  await send('켠다');
  await queue(['딸기맛 막대사탕']);
  s = await bar();
  console.log(vp, '4 added while waiting', JSON.stringify(s));
  if (s.shown !== 1 || s.names.length !== 1 || !/막대사탕/.test(s.names[0])) bad(`보낸 뒤 더 놓은 것만 보여야 한다: ${JSON.stringify(s)}`);

  // ── 5. 요청 실패: 응답 알림 없이 기다림이 끝나면(180초) 다시 보인다 ──
  await reset();
  await page.clock.install();
  await queue();
  await send('쓴다');
  s = await bar();
  if (s.shown !== 1 || s.label !== '보내는 중') bad(`실패 시험: 보낸 직후엔 이름표가 「보내는 중」이어야 한다: ${JSON.stringify(s)}`);
  await page.clock.fastForward(181_000);
  await sleep(400);
  s = await bar();
  v = await vars();
  console.log(vp, '5 timeout', JSON.stringify(s), JSON.stringify(v));
  if (s.shown !== 1 || s.names.length !== 2 || v.at) bad(`응답이 안 오면 칩이 다시 보여야 한다(아직 안 쓰임): ${JSON.stringify(s)} ${JSON.stringify(v)}`);
  if (s.under !== 'user') bad(`이때 칩은 마지막 메시지(보낸 유저 메시지) 아래다: ${JSON.stringify(s)}`);
  await shot('3_failed_back');
  r = await send(null);
  if (r.uses.length !== 1) bad(`실패 뒤 다시 보내면 다시 실려야 한다: ${JSON.stringify(r.uses)}`);

  const errs = errors.flat();
  if (errs.length) bad(`page errors: ${errs.slice(0, 3).join(' | ')}`);
  await page.close();
}
await b.close();
if (fails.length) { console.log(`\n${fails.length} FAIL`); for (const f of fails) console.log(' -', f); process.exit(1); }
console.log('usebar-browser OK');
