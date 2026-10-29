// 출시 전 QC · 본편 요청·응답·표시 파이프라인 (docs/qc/02_request_pipeline.md).
// 가짜 Risu(tests/qc-host.mjs)에서 채팅을 시작한 뒤 beforeRequest → 결과 메시지 배열, output 리스너, display 처리기를 직접 검사한다.
// 사용법: node tests/qc-pipeline-browser.mjs <fixture.json>
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { launch, boot, startChat, request, output, display, input, chat, setVars, counts, resetCounts, waitLite, runner } from './qc-host.mjs';

const fxPath = process.argv[2];
if (!fxPath) throw new Error('사용법: node tests/qc-pipeline-browser.mjs <fixture.json>');
const fixture = JSON.parse(readFileSync(fxPath, 'utf8'));
const fixtureDir = dirname(resolve(fxPath));
const core = await import('../dist-test/core.mjs');
const browser = await launch();
const R = runner();
const LORE_MARK = '<!-- goei:lore -->';
const STATUS = '[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부 사무실|없음|쟈알디|없음|관리국/신입|140000]';
const STATUS2 = '[▣|2025.01.01|03:10 AM|🌧️|3°C|관리국 지하 주차장|명일 아파트|쟈알디,에일린|투입|관리국/신입|138000]';
const sys = (c) => ({ role: 'system', content: c });
const usr = (c) => ({ role: 'user', content: c });
const bot = (c) => ({ role: 'assistant', content: c });
const loreOf = (out) => out.find((m) => typeof m.content === 'string' && m.content.startsWith(LORE_MARK));
const idxOf = (out, pred) => out.findIndex((m) => typeof m.content === 'string' && pred(m.content));
const unresolved = (t) => [...new Set((t.match(/\{\{[^}]*\}\}/g) ?? []))].filter((x) => x !== '{{user}}');

// ── 1) 새 카드(자리 항목 없음): 플러그인이 로어 덩어리를 직접 끼운다 ──
{
  const { page, errors, logs } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir });
  const saved = await startChat(page, 'A00', 2);
  const greeting = fixture.alternateGreetings[saved.fmIndex];
  const first = '쟈알디 부장님께 인사하고 출동 준비를 한다.';
  await page.evaluate((t) => { window.__chat.message.push({ role: 'user', data: t, chatId: 'u1' }); }, first);
  const base = [sys('SYSTEM PROMPT'), bot(greeting), usr(first)];

  await R.section('1-0 시작 메시지 아래 첫 행동 안내: 첫 전송 전에만', async () => {
    const h = await display(page, greeting);
    assert.ok(h.includes('data-goei-card="opening"') && h.includes('data-goei-repick'), '첫 장면 아래 안내');
    assert.ok(!(await display(page, '다른 글')).includes('data-goei-card="opening"'));
  });

  await R.section('1-1 첫 전송: 로어 덩어리 하나, 순서, 시드, {{user}} 보존, 장식 줄 없음, 중복 없음', async () => {
    await resetCounts(page);
    const out = await request(page, base);
    assert.deepEqual(await counts(page), { chat: 1, char: 1, setChat: 0, setChar: 0 }, '요청 하나에 채팅·캐릭터를 한 번씩만 읽는다');
    const lore = loreOf(out);
    assert.ok(lore, '로어 덩어리');
    assert.equal(out.filter((m) => typeof m.content === 'string' && m.content.includes(LORE_MARK)).length, 1, '덩어리는 하나');
    assert.ok(out.indexOf(lore) < idxOf(out, (c) => c === greeting), '로어는 첫 장면(인사말) 앞');
    const b = lore.content;
    const at = (s) => { const i = b.indexOf(s); assert.ok(i >= 0, `있어야: ${s}`); return i; };
    const order = [at('## RP Guidance'), at('## Tag System Directive'), at('## Status'), at('## Faction\n'), at('## Roster'), at('[Affiliation code: A00]'), at('### Character - Jyaldi')];
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `순서 RP→Tag→Status→Faction→Roster→세력(시드)→요원: ${order}`);
    assert.equal((b.match(/## RP Guidance/g) ?? []).length, 1, 'RP 지침 한 번');
    assert.equal((b.match(/^## Status/gm) ?? []).length, 1, '상태창 절 한 번');
    assert.equal((b.match(/### Character - Jyaldi/g) ?? []).length, 1, '시드와 고른 로어가 겹치면 한 번만');
    assert.ok(!/^- Jyaldi \(/m.test(b) && /^- Aileen \(/m.test(b), '전체 로어가 들어간 인물은 Roster 한 줄 소개에서 빠짐 (trimRoster)');
    assert.ok(b.includes('### Character - Jaemtri') && b.includes('### Character - Spangdal'), '시드(A00-2: 관리국·쟈알디·잼트리·스팡달)');
    assert.ok(!b.includes('%%SEED%%') && !b.includes('%%/SEED%%'), '시드 표식은 모델에 가지 않음');
    assert.ok(!b.includes('@@dont_activate'), '장식 줄은 보내지 않음');
    assert.deepEqual(unresolved(b), [], 'CBS는 모두 풀림 ({{user}}만 남김)');
    assert.ok(b.includes("name of {{user}}'s current encounter"), '유저 이름을 모르면 {{user}}를 그대로 둔다');
    assert.ok(b.includes('Fields in order: 날짜 | 시각 | 날씨 | 기온 | 위치 | 목표 | 동행 | 투입 | 신분 | 잔고'), '상태창 절은 칸 구성으로');
    assert.ok(out.at(-1).content.startsWith('## Inserting Character Visual Images'), '이미지 지침은 맨 끝');
    assert.ok(out.at(-1).content.includes('Jyaldi') && out.at(-1).content.includes('Do not create tags for {{user}}'), '주인공 이미지 OFF 기본');
    assert.equal(out.filter((m) => m.role === 'user').length, 1);
    assert.ok(!(await display(page, greeting)).includes('data-goei-card="opening"'), '첫 전송 뒤에는 안내 없음');
  });

  await R.section('1-2 첫 전송 다시 굴리기: 시드 유지 · 두 번째 전송부터 시드 제거', async () => {
    const out = await request(page, base);
    assert.ok(loreOf(out).content.includes('[Affiliation code: A00]'), '다시 굴리기(유저 턴 1)에도 시드');
    await page.evaluate((s) => { window.__chat.message.push({ role: 'char', data: `쟈알디가 고개를 끄덕였다.\n${s}`, chatId: 'c1' }, { role: 'user', data: '조용히 기다린다.', chatId: 'u2' }); }, STATUS);
    const out2 = await request(page, [sys('SYSTEM PROMPT'), bot(greeting), usr(first), bot(`쟈알디가 고개를 끄덕였다.\n${STATUS}`), usr('조용히 기다린다.')]);
    const b = loreOf(out2).content;
    assert.ok(!b.includes('### Character - Spangdal'), '두 번째 전송: 시드 없음 (스팡달은 글에 안 나옴)');
    assert.ok(b.includes('### Character - Jyaldi'), '글에 나온 쟈알디는 고른다');
    assert.ok(!b.includes('[Affiliation code: A00]') || greeting.includes('관리국'), '세력 글은 키워드로만');
  });

  await R.section('1-3 상태창 블록: 지난 줄 제거·마지막만, 마지막 사용자 앞, 잔고는 장부 값', async () => {
    const msgs = [sys('S'), bot(greeting), usr(first), bot(`첫 답.\n${STATUS}`), usr('둘'), bot(`둘째 답.\n${STATUS2}`), usr('셋')];
    await page.evaluate(() => { window.__chat.message.push({ role: 'char', data: '둘째 답.', chatId: 'c2' }, { role: 'user', data: '셋', chatId: 'u3' }); });
    const out = await request(page, msgs);
    const texts = out.filter((m) => !m.content.startsWith(LORE_MARK)).map((m) => m.content);
    assert.equal(texts.filter((t) => t.includes('[▣|')).length, 1, '상태창 줄은 블록 하나에만 (로어 덩어리의 예시 줄 제외)');
    const blk = out.findIndex((m) => m.content.startsWith('[Previous status]'));
    assert.ok(blk > 0 && out[blk + 1].role === 'user' && out[blk + 1].content === '셋', '블록은 마지막 사용자 메시지 바로 앞');
    assert.ok(out[blk].content.includes('|관리국 지하 주차장|명일 아파트|쟈알디,에일린|투입|관리국/신입|140000]'), `마지막 줄을 칸 구성대로, 잔고는 장부(140000): ${out[blk].content}`);
    assert.equal(out.find((m) => m.content.startsWith('첫 답.')).content, '첫 답.', '지난 응답의 줄은 지우고 본문만');
    assert.ok(!out.some((m) => m.content.includes('\n[▣') && !m.content.startsWith('[Previous status]') && !m.content.startsWith(LORE_MARK)));
  });

  await R.section('1-4 칸 구성 on/hide/off 와 장부·신분 보충', async () => {
    const msgs = [sys('S'), bot(greeting), usr(first), bot(`답.\n${STATUS}`), usr('다음')];
    await setVars(page, { $st_col_weather: 'off', $st_col_temp: 'hide', $st_col_wallet: 'off', $st_col_identity: 'on' });
    let out = await request(page, msgs);
    let blk = out.find((m) => m.content.startsWith('[Previous status]')).content;
    assert.ok(blk.includes('[▣|2025.01.01|02:47 AM|4°C|관리국 본부 사무실|없음|쟈알디|없음|관리국/신입]'), `날씨·잔고 칸 빠짐(hide 는 남음): ${blk}`);
    assert.ok(blk.includes('Fields: 날짜 | 시각 | 기온 | 위치 | 목표 | 동행 | 투입 | 신분'));
    // 잔고 칸 켜고 장부에 거래가 있으면 그 값. 거래는 기준 메시지가 살아 있을 때만
    await setVars(page, { $st_col_weather: 'on', $st_col_temp: 'on', $st_col_wallet: 'on', $st_wallet: JSON.stringify({ start: 100000, log: [{ id: 'a', anchor: 'u1', amount: -30000, memo: '택시', src: 'story', at: '' }, { id: 'b', anchor: 'gone', amount: 99999, memo: '없는 메시지', src: 'story', at: '' }, { id: 'c', anchor: '', amount: 5000, memo: '수동', src: 'manual', at: '' }] }) });
    out = await request(page, msgs);
    blk = out.find((m) => m.content.startsWith('[Previous status]')).content;
    assert.ok(blk.includes('|관리국/신입|75000]'), `장부 = 100000 − 30000 + 5000 (사라진 기준은 빼고): ${blk}`);
    // 신분 칸이 비면 인물 기록의 신분으로
    await page.evaluate(() => { window.__chat.goeiPeopleV1 = { people: {}, docs: {}, factions: {}, log: [], identity: { faction: 'B00', rank: '대리', level: 3, from: 'status', anchor: 'c1' } }; });
    out = await request(page, [sys('S'), bot(greeting), usr(first), bot('답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음|없음|없음|없음|없음]'), usr('다음')]);
    blk = out.find((m) => m.content.startsWith('[Previous status]')).content;
    assert.ok(blk.includes('|없음|없음|없음|가짜 관리국/대리|75000]'), `신분 보충: ${blk}`);
    await page.evaluate(() => { delete window.__chat.goeiPeopleV1; delete window.__chat.scriptstate.$st_wallet; });
  });

  await R.section('1-5 상태창 태그가 깨졌을 때 (칸 부족·초과·전각 구분자·닫는 괄호 없음·여러 개·없음)', async () => {
    const run = async (line) => {
      const out = await request(page, [sys('S'), bot(greeting), usr(first), bot(`답.\n${line}`), usr('다음')]);
      return out.find((m) => m.content.startsWith('[Previous status]'))?.content ?? null;
    };
    assert.ok((await run('[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음]')).includes('[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음|없음|없음|없음|140000]'), '옛 6칸 → 10칸');
    const over = await run('[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음|없음|없음|관리국/신입|140000|덤|덤]');
    assert.ok(over && over.includes('[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음|없음|없음|관리국/신입|140000]'), `칸 초과: ${over}`);
    const full = await run('【▣｜2025.01.01｜02:47 AM｜☀️｜4°C｜관리국 본부｜없음｜없음｜없음｜관리국/신입｜140000】');
    assert.ok(full && full.includes('|관리국 본부|없음|없음|없음|관리국/신입|140000]'), `전각 구분자: ${full}`);
    const open = await run('[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음|없음|없음|관리국/신입|140000');
    assert.ok(open && open.includes('|관리국 본부|'), `닫는 괄호 없음: ${open}`);
    const multi = await run(`${STATUS}\n${STATUS2}`);
    assert.ok(multi.includes('관리국 지하 주차장') && !multi.includes('관리국 본부 사무실'), '한 응답에 둘이면 마지막');
    assert.equal(await run('상태창 없음'), null, '상태창이 없으면 블록 없음');
    const bad = await run('[▣|날짜모름|시각모름|☀️|4°C|관리국 본부|없음|없음|없음|관리국/신입|140000]');
    assert.ok(bad && bad.includes('[▣|'), `읽지 못하는 줄은 그대로: ${bad}`);
  });

  await R.section('1-6 RP 지침이 description 에 있으면 다시 넣지 않고, 괴이 머리말은 한 번만', async () => {
    await page.evaluate(() => { window.__chat.message.push({ role: 'user', data: '명일 아파트와 소라 랜드 이야기를 듣는다.', chatId: 'u6' }); });
    const out = await request(page, [sys('## RP Guidance\n(카드 설명)'), bot(greeting), usr('명일 아파트와 소라 랜드 이야기를 듣는다.')]);
    await page.evaluate(() => { window.__chat.message.pop(); });
    const b = loreOf(out).content;
    assert.ok(!b.includes('## RP Guidance'), 'RP 지침 중복 없음');
    const note = core.ANOMALY_NOTE.slice(0, 40);
    assert.ok(b.includes('Myeongil Apartment') || b.includes('명일 아파트'), '괴이 로어');
    assert.equal((b.match(new RegExp(note.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 1, '괴이 머리말 한 번');
  });

  await R.section('1-7 lore_mode: Risu가 직접 → 가상 항목은 플러그인이 Risu 방식으로 고른다', async () => {
    await setVars(page, { $gen_lore_mode: 'risu' });
    const out = await request(page, [sys('S'), bot(greeting), usr('Jyaldi 에게 간다.')]);
    const b = loreOf(out).content;
    assert.ok(b.includes('### Character - Jyaldi'), 'Risu 방식(띄어쓰기 무시 포함)으로 가상 항목을 고른다');
    assert.ok(!b.includes('@@dont_activate'));
    await setVars(page, { $gen_lore_mode: '' });
  });

  await R.section('1-8 사용자가 카드에 직접 넣은 항목: 플러그인이 고름 ↔ Risu 직접 (@@dont_activate 동기화)', async () => {
    await page.evaluate(() => {
      window.__char.globalLore.push({ key: 'folder:qc-agent', comment: '🙂요원', mode: 'folder', content: '' }, { key: '아무개', comment: '아무개', folder: 'folder:qc-agent', mode: 'normal', insertorder: 600, content: '아무개는 QC 요원이다.' });
      window.__liteChar = window.__char;
    });
    await input(page, '아무개가 들어왔다.');
    let e = await page.evaluate(() => window.__char.globalLore.find((x) => x.comment === '아무개'));
    assert.ok(e.content.startsWith('@@dont_activate\n'), '플러그인이 고름: 줄을 붙임');
    assert.equal((await counts(page)).setChat, 0, '자리 항목 없는 카드는 로어 변수를 저장하지 않음');
    await page.evaluate(() => { window.__chat.message.push({ role: 'user', data: '아무개가 들어왔다.', chatId: 'u9' }); });
    let out = await request(page, [sys('S'), bot(greeting), usr('아무개가 들어왔다.')]);
    assert.ok(loreOf(out).content.includes('아무개는 QC 요원이다.'), '요청에 들어감');
    assert.ok(!loreOf(out).content.includes('@@dont_activate'));
    await setVars(page, { $gen_lore_mode: 'risu' });
    await input(page, '아무개가 들어왔다.');
    e = await page.evaluate(() => window.__char.globalLore.find((x) => x.comment === '아무개'));
    assert.ok(!e.content.startsWith('@@'), 'Risu 직접: 줄을 뗌');
    out = await request(page, [sys('S'), bot(greeting), usr('아무개가 들어왔다.')]);
    assert.ok(!loreOf(out).content.includes('아무개는 QC 요원이다.'), 'Risu 직접: 진짜 항목은 Risu 몫 (플러그인은 가상 항목만)');
    await setVars(page, { $gen_lore_mode: '' });
    await page.evaluate(() => { window.__chat.message.pop(); window.__char.globalLore = window.__char.globalLore.filter((x) => x.key !== 'folder:qc-agent' && x.comment !== '아무개'); window.__liteChar = window.__char; });
  });

  await R.section('1-9 부록 해금: [🔓|…] 반영·본문 제거, 해금 전엔 조건만', async () => {
    const dir = core.readDirectory(core.withWorldLore(fixture.globalLore));
    const app = dir.appendices.find((r) => r.unlock && r.parent);
    assert.ok(app, '해금 조건 있는 부록이 명부에 있어야');
    const parentLore = fixture.globalLore.find((e) => e.comment === app.parent) ? app.parent : app.parent;
    const mention = `${parentLore}에 대해 묻는다.`;
    await page.evaluate((t) => { window.__chat.message.push({ role: 'user', data: t, chatId: 'u10' }); }, mention);
    let out = await request(page, [sys('S'), bot(greeting), usr(mention)]);
    let b = loreOf(out).content;
    assert.ok(b.includes(`[Locked appendix: 「${app.lore}」]`), `해금 전: 조건만 (${app.lore})`);
    // 응답에 해금 표시
    await page.evaluate((tag) => { window.__chat.message.push({ role: 'char', data: `비밀이 드러났다.\n${tag}\n[▣|2025.01.01|04:00 AM|☀️|4°C|남해|없음|없음|없음|관리국/신입|140000]`, chatId: 'c10' }); }, `[🔓|${app.lore}]`);
    await output(page);
    const c = await chat(page);
    assert.ok(!c.message.at(-1).data.includes('🔓'), '본문에서 해금 표시 제거');
    assert.ok(JSON.parse(c.scriptstate.$goei_unlocked).includes(app.lore), '해금 기록');
    await page.evaluate(() => { window.__chat.message.push({ role: 'user', data: '계속', chatId: 'u11' }); });
    out = await request(page, [sys('S'), bot(greeting), usr(mention), bot('비밀이 드러났다.'), usr('계속')]);
    b = loreOf(out).content;
    assert.ok(!b.includes('[Locked appendix:'), '해금 뒤: 조건 안내 없음');
    const html = await display(page, `본문\n[🔓|${app.lore}]\n끝`);
    assert.ok(!html.includes('🔓'), '표시에서도 해금 표시 제거');
  });

  assert.deepEqual(errors, []);
  console.log('logs', logs);
  await page.close();
}

// ── 2) 옛 카드(자리 항목 있음): 변수에 적고 요청 속 글을 고친다 (patchSlots) ──
{
  const F = { ag: 'folder:qc-old-agent' };
  const oldLore = [
    ...fixture.globalLore,
    { key: F.ag, comment: '🙂요원', mode: 'folder', content: '' },
    { comment: '차여진', key: 'Yeo-jin, 차여진, 여진', folder: F.ag, insertorder: 600, mode: 'normal', content: '@@dont_activate\n### Character - Cha Yeo-jin\n여진 글 {{user}}' },
    ...['Faction', 'Mystic', 'Anomaly', 'Agent'].map((n) => ({ comment: `📚Lore slot · ${n}`, key: '', alwaysActive: true, mode: 'normal', content: `{{getvar::goei_lore_${n.toLowerCase()}}}` })),
  ];
  const oldFixture = { ...fixture, globalLore: oldLore };
  const { page, errors } = await boot(browser, oldFixture, { message: [{ role: 'char', data: '조용한 밤이다.', chatId: 'c0' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_anomaly_on: '0' } }, { fixtureDir });
  await waitLite(page);
  await R.section('2-1 입력 때 변수에 적고(같으면 저장 안 함), 요청 직전 patchSlots, 덩어리는 안 끼움', async () => {
    await resetCounts(page);
    assert.equal(await input(page, '차여진이 웃었다.'), '차여진이 웃었다.');
    let c = await chat(page);
    assert.ok(c.scriptstate.$goei_lore_agent.includes('여진 글'), '요원 자리 변수');
    assert.ok(!c.scriptstate.$goei_lore_agent.includes('@@dont_activate'));
    assert.equal((await counts(page)).setChat, 1);
    await input(page, '차여진이 웃었다.');
    assert.equal((await counts(page)).setChat, 1, '같은 값이면 저장하지 않음 (sameVars)');
    const before = c.scriptstate.$goei_lore_agent;
    await page.evaluate((t) => { window.__chat.message.push({ role: 'user', data: t, chatId: 'u1' }); }, '차여진이 웃었다.');
    const req = [sys(`앞\n\n${before}\n\n뒤`), usr('차여진이 웃었다.')];
    let out = await request(page, req);
    assert.ok(!out.some((m) => m.content.includes(LORE_MARK)), '옛 카드엔 덩어리를 끼우지 않음');
    assert.ok(out[0].content.includes(before), '깊이 안이면 그대로');
    await page.evaluate(() => { window.__chat.message = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'char' : 'user', data: '아무도 없다.', chatId: `m${i}` })); });
    out = await request(page, req);
    assert.equal(out[0].content, '앞\n\n\n\n뒤', '깊이 밖으로 밀리면 요청 속 글을 뺀다');
  });
  await R.section('2-2 저장 동시성: 입력(로어 변수 저장)과 응답 처리(상황판 저장)가 겹쳐도 둘 다 남는다', async () => {
    await page.evaluate(() => { window.__chat.scriptstate.$st_anomaly_on = '1'; window.__chat.scriptstate.$goei_world = JSON.stringify({ v: 1, epoch: 0, minute: null, an: [], inc: [], ms: [], agents: {}, ended: [], blocked: {}, notice: '' }); window.__chatDelay = 40; });
    await page.evaluate(() => { window.__chat.message.push({ role: 'char', data: '차여진이 왔다.\n[AG|P001|외근|순찰]\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|없음]', chatId: 'cX' }); });
    await page.evaluate(async () => {
      const c = window.__chat;
      await Promise.all([
        window.__calls.handlers.input('차여진 한 번 더'),
        window.__calls.listeners[0]({ char: window.__clone(window.__char), chat: window.__clone(c), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 }),
      ]);
    });
    const c = await chat(page);
    assert.ok(c.scriptstate.$goei_lore_agent.includes('여진 글'), '로어 변수 남음');
    assert.ok(c.scriptstate.$goei_last, '상황판 처리 남음');
    assert.equal(c.message.at(-1).data, '차여진이 왔다.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|없음]', '본문 정리');
    await page.evaluate(() => { window.__chatDelay = 0; });
  });
  assert.deepEqual(errors, []);
  await page.close();
}

// ── 3) 설정 조합: 에셋·주인공·캐릭터로 플레이·인물 기록·참고 기록·방문 기록 ──
{
  const { page, errors } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir });
  const saved = await startChat(page, 'A00', 2);
  const greeting = fixture.alternateGreetings[saved.fmIndex];
  await page.evaluate(() => { window.__userName = 'Tester'; window.__persona = 'Tester is a rookie agent who loves coffee.'; window.__chat.message.push({ role: 'user', data: '쟈알디와 인사한다.', chatId: 'u1' }); });
  const base = () => [sys('SYS\nTester is a rookie agent who loves coffee.'), bot(greeting), usr('쟈알디와 인사한다.')];
  const imgPrompt = (out) => out.find((m) => m.content.startsWith('## Inserting Character Visual Images'))?.content ?? null;

  await R.section('3-1 에셋 on/off × main/aux × 주인공 에셋 × 캐릭터로 플레이 → 이미지 지침', async () => {
    let out = await request(page, base());
    assert.ok(imgPrompt(out)?.includes('Do not create tags for {{user}}'), '기본: main·주인공 OFF');
    await setVars(page, { $st_asset_on: '0' });
    assert.equal(imgPrompt(await request(page, base())), null, '에셋 끔');
    await setVars(page, { $st_asset_on: '1', $st_asset_model: 'aux' });
    assert.equal(imgPrompt(await request(page, base())), null, '보조 모델이면 메인 지침 없음');
    await setVars(page, { $st_asset_model: 'main', $st_asset_player: '1' });
    out = await request(page, base());
    assert.ok(!imgPrompt(out).includes('Do not create tags for {{user}}') && imgPrompt(out).includes('Tester'), '주인공 ON: 페르소나 이름이 명단에');
    // 옛 카드의 Asset 로어북 본문이 요청에 남아 있으면 지운다
    out = await request(page, [sys('## Inserting Character Visual Images\n옛 본문\nOnly use those provided.\n---'), ...base()]);
    assert.equal(out.filter((m) => m.content.includes('## Inserting Character Visual Images')).length, 1, '옛 Asset 본문 제거');
    await setVars(page, { $st_asset_player: '0' });
  });

  await R.section('3-2 캐릭터로 플레이: 페르소나 교체·이름 치환·이미지 태그 숨김', async () => {
    await setVars(page, { $st_player: 'P001' });
    let out = await request(page, [...base(), bot('Tester가 웃었다. - Characters {name}: Jyaldi, Aileen')]);
    const s0 = out[0].content;
    assert.ok(s0.includes('## Player Character') && s0.includes('The user plays 쟈알디 (Jyaldi)') && !s0.includes('loves coffee'), `페르소나 자리에 주인공 글: ${s0.slice(0, 120)}`);
    assert.ok(!out.some((m) => /\bTester\b/.test(m.content)), '페르소나 이름 → 요원 이름');
    assert.ok(out.at(-2).content.includes('쟈알디가 웃었다'));
    assert.ok(!imgPrompt(out).includes('Jyaldi'), '주인공 OFF: 주인공 요원은 이미지 명단에서 뺌');
    assert.ok(!loreOf(out).content.includes('### Character - Jyaldi'), '주인공 요원 로어는 고르지 않음 (주인공 글로 대신)');
    await setVars(page, { $st_asset_player: '1' });
    out = await request(page, base());
    assert.ok(imgPrompt(out).includes('Jyaldi') && !imgPrompt(out).includes('Tester'), '주인공 ON + 캐릭터 플레이: 요원 이름만');
    await setVars(page, { $st_asset_player: '0', $st_player: '' });
  });

  await R.section('3-3 imgSend 기본 6: 오래된 이미지 태그 제거 (0·1 은 7절)', async () => {
    const msgs = [sys('S'), ...Array.from({ length: 8 }, (_, i) => (i % 2 ? bot(`답 ${i} <img=Jyaldi_smile>`) : usr(`말 ${i}`))), usr('끝')];
    const tagged = (out) => out.filter((m) => m.role !== 'system' && m.content.includes('<img=')).length;
    assert.equal(tagged(await request(page, msgs)), 3, '기본 6개 (끝 포함 최근 6개 = 답 7·5·3 남음)');
  });

  await R.section('3-4 인물 기록: inject 모드 전부 × director 모드 전부', async () => {
    const SHEET = fixture.globalLore.find((e) => e.comment === '쟈알디')?.content ?? '';
    const store = { people: { 쟈알디: { name: '쟈알디', faction: 'A00', seeded: { from: 'lore', at: '' }, slots: { state: [{ id: 'e1', text: '피곤하다.', src: 'story', anchor: 'u1', seq: 0 }] }, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: ['Jyaldi'] } }, docs: {}, factions: {}, log: [] };
    await page.evaluate((s) => { window.__chat.goeiPeopleV1 = s; }, store);
    const block = (out) => out.find((m) => m.content.startsWith('[People records]'));
    for (const inject of ['split', 'append', 'record']) {
      await setVars(page, { $pp_inject: inject, $pp_director: 'off' });
      const out = await request(page, base());
      const b = block(out);
      assert.ok(b && b.content.includes('## 쟈알디') && b.content.includes('피곤하다'), `${inject}: 기록 블록`);
      assert.equal(out.indexOf(b), out.length - 3, `${inject}: 마지막 사용자 앞 (이미지 지침은 맨 끝)`);
      const lore = loreOf(out).content;
      if (inject === 'split' || inject === 'record') assert.ok(!lore.includes('### Character - Jyaldi'), `${inject}: 시트 원문은 요청에서 뺀다`);
      else assert.ok(lore.includes('### Character - Jyaldi'), 'append: 시트 그대로');
    }
    await setVars(page, { $pp_inject: 'off' });
    assert.equal(block(await request(page, base())), undefined, 'off: 블록 없음');
    await setVars(page, { $pp_on: '0', $pp_inject: 'split' });
    assert.equal(block(await request(page, base())), undefined, '기능 끔: 블록 없음');
    // 연출형 Director: 보조 모델 1회, 실패해도 요청은 나간다
    await setVars(page, { $pp_on: '1', $pp_director: 'scene', $pp_director_timeout: '5' });
    await page.evaluate(() => { window.__llm = [{ type: 'success', result: JSON.stringify({ notes: [{ who: '쟈알디', now: '커피를 마신다', react: '짧게 답한다', must_not_reveal: ['비밀'] }] }) }]; window.__calls.llm = []; });
    let out = await request(page, base());
    assert.equal((await page.evaluate(() => window.__calls.llm.length)), 1, 'Director 보조 호출 1회');
    assert.equal((await page.evaluate(() => window.__calls.llm[0].mode)), 'submodel');
    assert.ok(out.some((m) => m.content.startsWith('[Director note]') && m.content.includes('커피를 마신다')), 'Director 메모 삽입');
    await page.evaluate(() => { window.__llm = [{ type: 'fail', result: 'boom' }]; window.__calls.llm = []; });
    await setVars(page, { $pp_director_reuse: '0' });
    out = await request(page, base());
    assert.ok(!out.some((m) => m.content.startsWith('[Director note]')) && block(out), '실패하면 메모 없이 진행');
    await setVars(page, { $pp_director: 'facts' });
    assert.ok(block(await request(page, base())), 'facts 모드');
    await page.evaluate(() => { delete window.__chat.goeiPeopleV1; });
  });

  await R.section('3-5 괴담넷·괴담톡·위키 참고 기록 on/off 와 총 상한 (fitTotal)', async () => {
    const gn = core.encode({ seq: 1846001, sources: {}, dms: [{ nick: '익명1', side: 'in', body: '쟈알디 봤어?', unread: false, date: '2025.01.01' }], posts: [{ id: 1846001, date: '2025.01.01', nick: '익명7', title: '명일 아파트 소문', views: 3, votes: 1, body: '어젯밤 명일 아파트에서 비명이 들렸다. '.repeat(20), mine: false, comments: [] }] });
    const ph = JSON.stringify({ version: 2, seq: 2, mid: 2, order: ['r1'], rooms: { r1: { id: 'r1', kind: 'dm', members: ['P001'], people: { P001: { name: '쟈알디' } }, messages: [{ id: 1, sender: 'me', text: '부장님 지금 어디세요?', time: '02:00', kind: 'message', audience: ['P001'] }, { id: 2, sender: 'P001', text: '본부다. 빨리 와라.', time: '02:01', kind: 'message', audience: ['P001'] }], draft: '', unread: 0 } } });
    const doc = { key: '', comment: 'WIKI｜명일 아파트', mode: 'normal', insertorder: 0, alwaysActive: false, content: `[NW_PRIVATE_BEGIN]\n<!--NW_META:${JSON.stringify({ title: '명일 아파트', mode: 'create', model: 'aux', created: 1, length: 'short', sources: [], primarySources: [], writingRequest: '', direct: false })}-->\n<lightboard-namuwiki>[Paragraph]명일 아파트는 위키 창작 문서다.</lightboard-namuwiki>\n[NW_PRIVATE_END]` };
    await page.evaluate(([gn, ph, doc]) => { window.__chat.scriptstate.$gn_raw = gn; window.__chat.scriptstate.$ph_state = ph; window.__chat.localLore = [doc]; }, [gn, ph, doc]);
    const ctxOf = (out) => out.filter((m) => m.content.startsWith('[MODULE_CONTEXT_BEGIN]')).map((m) => m.content);
    const feature = (t) => /"feature":"(\w+)"/.exec(t)?.[1];
    // 기본: 괴담넷(변수 '0' = 포함)·괴담톡 켜짐, 위키는 꺼짐('1' 이 켬)
    let c = ctxOf(await request(page, base()));
    assert.deepEqual(c.map(feature).sort(), ['gnet', 'phone'], `기본 반영: ${c.map(feature)}`);
    await setVars(page, { $nw_context: '1', $nw_adv_ctx_focus: '0' });
    let out = await request(page, base());
    c = ctxOf(out);
    assert.deepEqual(c.map(feature).sort(), ['gnet', 'phone', 'wiki']);
    assert.equal(out.indexOf(out.find((m) => m.content.startsWith('[MODULE_CONTEXT_BEGIN]'))), out.length - 3 - 2, '참고 기록은 마지막 사용자 메시지 앞 (상태창 블록 없음, 이미지 지침은 끝)');
    await setVars(page, { $ph_context: '0', $nw_context: '0' });
    c = ctxOf(await request(page, base()));
    assert.deepEqual(c.map(feature), ['gnet'], '괴담톡·위키 끔');
    await setVars(page, { '$lb_cfg_lb-gn.context': '1', $ph_context: '1' });
    c = ctxOf(await request(page, base()));
    assert.deepEqual(c.map(feature), ['phone'], '괴담넷 끔(변수 1 = 빼기)');
    await setVars(page, { '$lb_cfg_lb-gn.context': '0', $ph_context: '1', $nw_context: '1' });
    c = ctxOf(await request(page, base()));
    const full = c.reduce((n, t) => n + core.tokens(t), 0);
    const cap = Math.floor(full * 0.6);
    await setVars(page, { $gen_ctx_total: String(cap) });
    c = ctxOf(await request(page, base()));
    const total = c.reduce((n, t) => n + core.tokens(t), 0);
    console.log(`  참고 기록 전체 ${full}토큰 → 총 상한 ${cap}: ${total}토큰 (${c.map(feature)})`);
    assert.ok(total < full && total <= cap * 1.2 && c.length >= 1, `총 상한 ${cap} 안으로 나눔: ${total} (${c.map(feature)})`);
    await setVars(page, { $gen_ctx_total: '0', $nw_context: '0' });
    await page.evaluate(() => { delete window.__chat.scriptstate.$gn_raw; delete window.__chat.scriptstate.$ph_state; window.__chat.localLore = []; });
  });

  await R.section('3-6 방문 기록·필드 사실: 기준 메시지 뒤에 막간, 사실은 마지막 사용자 앞', async () => {
    await page.evaluate(() => {
      window.__chat.message.push({ role: 'char', data: '쟈알디가 손을 흔들었다.', chatId: 'c1' }, { role: 'user', data: '본부로 돌아간다.', chatId: 'u2' });
      window.__chat.goeiHqVisitV1 = { turns: [{ id: 't1', at: 1, agentId: 'P002', name: '스팡달', user: '안녕하세요', reply: '어, 왔어?', anchor: 'c1', room: 'office' }] };
      window.__chat.goeiFieldV1 = { events: [{ id: 'f1', at: 2, anchor: 'c1', kind: 'move', text: '휴게실로 이동', fact: { key: '위치', value: '본부 휴게실' } }, { id: 'f2', at: 3, anchor: 'gone', kind: 'kill', text: '사라진 메시지', fact: { key: '사망', value: '누군가', permanent: true } }] };
    });
    const out = await request(page, [sys('S'), bot(greeting), usr('쟈알디와 인사한다.'), bot('쟈알디가 손을 흔들었다.'), usr('본부로 돌아간다.')]);
    const il = out.findIndex((m) => m.content.startsWith('[필드 막간]'));
    assert.ok(il > 0 && out[il - 1].content === '쟈알디가 손을 흔들었다.', '막간은 대화가 일어난 메시지 바로 뒤');
    assert.ok(out[il].content.includes('스팡달: 어, 왔어?') && out[il].content.includes('(이동) 휴게실로 이동'));
    const ff = out.findIndex((m) => m.content.startsWith('[Field facts]'));
    const lastUser = out.map((m) => m.role).lastIndexOf('user');
    assert.ok(ff > il && ff < lastUser && out[lastUser].content === '본부로 돌아간다.' && out.slice(ff + 1, lastUser).every((m) => m.role === 'system'), `사실 블록은 막간 뒤·마지막 사용자 앞: ${JSON.stringify(out.map((m) => [m.role, m.content.slice(0, 20)]))}`);
    assert.ok(out[ff].content.includes('- 위치: 본부 휴게실') && !out[ff].content.includes('사망'), '사라진 기준의 사실은 빠짐');
    await page.evaluate(() => { delete window.__chat.goeiHqVisitV1; delete window.__chat.goeiFieldV1; window.__chat.message.splice(-2); });
  });

  await R.section('3-7 읽기 실패·예외: 채팅을 못 읽어도 요청은 나가고, 응답 처리는 예외를 던지지 않는다', async () => {
    await page.evaluate(() => { window.__chatFail = true; });
    const out = await request(page, base());
    assert.equal(out.length, 3, '아무것도 바꾸지 못해도 원래 메시지 그대로');
    await page.evaluate(() => { window.__chat.message.push({ role: 'char', data: '답.\n[AG|P001|외근|순찰]', chatId: 'cF' }); });
    await output(page);
    await page.evaluate(() => { window.__chatFail = false; window.__chat.message.pop(); });
  });

  assert.deepEqual(errors, []);
  await page.close();
}

// ── 4) 표시: XSS·Lite 판정 전·다른 봇 ──
{
  const { page, errors } = await boot(browser, fixture, { message: [{ role: 'user', data: 'hi' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2' } }, { fixtureDir });
  const XSS = '<img src=x onerror=alert(1)>"\'<script>alert(2)</script>';
  await R.section('4-1 Lite 판정 전: 상태창·시작 카드·전화 카드·지시문 카드는 바로 그린다, 다른 글은 손대지 않음', async () => {
    const h = await display(page, `본문\n${STATUS}`);
    assert.ok(h.includes('data-goei-status') && !h.includes('[▣|') && h.includes('data-goei-user'), '상태창');
    await waitLite(page);
    const other = await boot(browser, { name: '다른 봇', alternateGreetings: [], globalLore: [] }, { message: [] });
    await other.page.waitForTimeout(1500);
    assert.equal(await display(other.page, '그냥 글 [AN|서울|x|활성|B|없음] <img=Nobody_smile>'), '그냥 글 [AN|서울|x|활성|B|없음] <img=Nobody_smile>', '다른 봇의 글은 그대로');
    const o2 = await display(other.page, `본문\n${STATUS}`);
    assert.ok(o2.includes('data-goei-status'), '상태창 표식이 있는 글은 이 봇 것으로 보고 그린다');
    await other.page.close();
  });
  await R.section('4-2 모델 출력·이름에 HTML 이 있어도 escape (XSS)', async () => {
    const h1 = await display(page, core.sceneRecord({ target: XSS, party: `파티${XSS}` }, '본문'));
    const raw = (h) => /<(img|script)\b/.test(h.replace(/<img src="\{\{source::user\}\}" alt="">/, ''));
    assert.ok(!raw(h1) && h1.includes('&lt;script&gt;') && h1.includes('&quot;&#39;'), `지시문 카드: ${h1}`);
    const h2 = await display(page, core.startRecord(`첫 상황 ${XSS}`));
    assert.ok(!raw(h2) && h2.includes('&lt;img'), `시작 카드: ${h2}`);
    const h3 = await display(page, core.phone.callRecord(XSS, '통화 목적'));
    assert.ok(!raw(h3) && h3.includes('&lt;script&gt;'), `전화 카드: ${h3}`);
    const h4 = await display(page, `[▣|2025.01.01|02:47 AM|☀️|4°C|${XSS}|$& 목표 $'|없음|없음|관리국/신입|140000]`);
    assert.ok(!raw(h4) && h4.includes('&lt;script&gt;'), `상태창 위치: ${h4}`);
    assert.ok(h4.includes('$&amp; 목표 $&#39;') && (h4.match(/data-goei-status/g) ?? []).length === 1, `상태창 값의 $& 가 치환 기호로 안 풀림: ${h4}`);
    const h5 = await display(page, '앞 <img={{x}}_smile> <img=Jyaldi_smile> <img=Nobody_smile> 뒤');
    assert.ok(!h5.includes('<img=') && h5.includes('{{raw::Jyaldi_smile}}') && (h5.match(/class="gim"/g) ?? []).length === 1, `이미지 태그: ${h5}`);
    assert.ok(!h5.includes('{{raw::{{x}}') && !h5.includes('Nobody'), '이름에 기호가 있거나 모르는 이름이면 칸을 그리지 않음');
    const h6 = await display(page, '앞 <img=Jyaldi"_smile> 뒤');
    assert.ok(!h6.includes('{{raw::') && !/<img\s/.test(h6.replace(/<img src="\{\{source::user\}\}" alt="">/, '')), `따옴표가 든 태그는 그림 주소로 가지 않음: ${h6}`);
  });
  await R.section('4-3 랜딩·전송 대기·첫 행동 안내', async () => {
    const landing = fixture.firstMessage || 'data-goei="landing"';
    const h = await display(page, landing.includes('landing') ? landing : '<div data-goei="landing">x</div>');
    assert.ok(h.includes('data-goei-card="landing"') && h.includes('유령 버튼을 눌러 시작하세요'), '랜딩 카드');
    const u = await display(page, `놓은 글\n%%GOEI_UNSENT%%`);
    assert.ok(u.includes('전송 대기') && u.includes('data-goei-cancel') && !u.includes('%%'), '전송 대기 줄');
  });
  assert.deepEqual(errors, []);
  await page.close();
}

// ── 5) 응답 처리: 다시 굴리기·편집·옛 채팅 보강·상황판 극값 ──
{
  const { page, errors } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir });
  await startChat(page, 'A00', 2);
  await R.section('5-1 다시 굴리기(같은 messageIndex): 이전 응답 반영을 되돌리고 이번 것만', async () => {
    const before = (await chat(page)).scriptstate.$goei_world;
    await page.evaluate(() => { window.__chat.message.push({ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: '첫 답.\n[AN|서울특별시 종로구|QC 괴이|활성|B|없음|소란]\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]', chatId: 'c1' }); });
    await output(page);
    let c = await chat(page);
    assert.ok(JSON.parse(c.scriptstate.$goei_world).an.some((a) => a.name === 'QC 괴이'), '첫 응답의 괴이 반영');
    assert.equal(c.message[1].data, '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]');
    await page.evaluate(() => { window.__chat.message[1] = { role: 'char', data: '다시 굴린 답.\n[▣|2025.01.01|02:50 AM|☀️|4°C|관리국|없음]', chatId: 'c1b' }; });
    await output(page);
    c = await chat(page);
    assert.ok(!JSON.parse(c.scriptstate.$goei_world).an.some((a) => a.name === 'QC 괴이'), '다시 굴리면 이전 응답의 괴이는 사라짐');
    assert.ok(JSON.parse(c.scriptstate.$goei_world).an.length <= JSON.parse(before).an.length + 1, '이전 응답 위에 쌓이지 않음 (추첨 한 번만큼만 늘 수 있음)');
    assert.equal(c.message[1].data, '다시 굴린 답.\n[▣|2025.01.01|02:50 AM|☀️|4°C|관리국|없음]');
    // 같은 응답에 다시 불려도 그대로
    const w = c.scriptstate.$goei_world;
    await output(page);
    assert.equal((await chat(page)).scriptstate.$goei_world, w);
  });
  await R.section('5-2 옛 채팅 보강: 빠진 기본 변수·세력 변수를 채우고, 전송 대기 표시를 끈다', async () => {
    await page.evaluate(() => {
      delete window.__chat.scriptstate.$st_asset_on; delete window.__chat.scriptstate.$st_asset_limit; window.__chat.scriptstate.$fac_codes = '옛값';
      window.__chat.message[0] = { role: 'user', data: '출동\n%%GOEI_UNSENT%%', chatId: 'u1' };
    });
    await output(page);
    const c = await chat(page);
    assert.equal(c.scriptstate.$st_asset_on, '1');
    assert.equal(c.scriptstate.$st_asset_limit, '2');
    assert.equal(c.scriptstate.$fac_codes, '', '세력 변수를 명부대로');
    assert.equal(c.message[0].data, '출동', '전송 대기 표시 제거');
  });
  await R.section('5-3 응답을 편집한 뒤 다시 처리하면 새 지문으로, 다른 봇 메시지는 손대지 않음', async () => {
    await page.evaluate(() => { window.__chat.message.push({ role: 'user', data: '둘', chatId: 'u2' }, { role: 'char', data: '둘째 답.\n[AG|P001|외근|순찰]\n[▣|2025.01.01|03:00 AM|☀️|4°C|관리국|없음]', chatId: 'c2' }); });
    await output(page);
    let c = await chat(page);
    assert.equal(c.message[3].data, '둘째 답.\n[▣|2025.01.01|03:00 AM|☀️|4°C|관리국|없음]');
    assert.match(c.scriptstate.$ag_report, /\[AG\|P001\|외근\|순찰\]/);
    const last = c.scriptstate.$goei_last;
    // 같은 자리에 다른 본문(다시 굴리기와 구별할 길이 없다): 이전 응답의 반영을 되돌리고 이번 본문만 반영한다
    await page.evaluate(() => { window.__chat.message[3] = { ...window.__chat.message[3], data: '고친 둘째 답.\n[AG|P001|부상|낙상]\n[▣|2025.01.01|03:05 AM|☀️|4°C|관리국|없음]' }; });
    await output(page);
    c = await chat(page);
    assert.notEqual(c.scriptstate.$goei_last, last, '지문 갱신');
    assert.match(c.scriptstate.$ag_report, /\[AG\|P001\|부상\|낙상\]/, '같은 자리의 새 본문만 반영 (외근은 사라짐)');
    assert.doesNotMatch(c.scriptstate.$ag_report, /외근\|순찰/);
    const n = (await counts(page)).setChat;
    await page.evaluate(async () => { await window.__calls.listeners[0]({ char: { name: '다른 봇', globalLore: [] }, chat: { message: [{ role: 'char', data: '[AN|x|y|활성|B|없음]' }], scriptstate: { $st_anomaly_on: '1' } }, characterIndex: 1, chatIndex: 0, messageIndex: 0 }); });
    assert.equal((await counts(page)).setChat, n, '다른 봇은 저장하지 않음');
  });
  await R.section('5-5 보조 모델 이미지 태그 보충: 마지막 응답에만, 실패하면 본문 그대로·안내만', async () => {
    await setVars(page, { $pp_on: '0', $st_asset_model: 'aux', $st_asset_on: '1' });
    await page.evaluate(() => { window.__llm = [{ type: 'success', result: JSON.stringify([{ line: 1, tag: '<img=Jyaldi_smile>' }]) }]; window.__calls.llm = []; });
    await page.evaluate(() => { window.__chat.message.push({ role: 'user', data: '다섯', chatId: 'u5' }, { role: 'char', data: '쟈알디가 웃었다.\n\n그리고 걸어갔다.\n[▣|2025.01.01|05:00 AM|☀️|4°C|관리국|없음]', chatId: 'c5' }); });
    await output(page);
    let c = await chat(page);
    assert.equal((await page.evaluate(() => window.__calls.llm.length)), 1, '보조 모델 1회');
    assert.ok(c.message.at(-1).data.includes('<img=Jyaldi_smile>') && c.message.at(-1).data.endsWith('[▣|2025.01.01|05:00 AM|☀️|4°C|관리국|없음]'), `태그 보충·상태창 유지: ${c.message.at(-1).data}`);
    assert.ok(!(await display(page, c.message.at(-1).data)).includes('<img='), '표시에서는 그림 칸');
    await page.evaluate(() => { window.__llm = [{ type: 'fail', result: 'boom' }]; window.__calls.llm = []; });
    await page.evaluate(() => { window.__chat.message.push({ role: 'user', data: '여섯', chatId: 'u6' }, { role: 'char', data: '스팡달이 왔다.\n[▣|2025.01.01|05:10 AM|☀️|4°C|관리국|없음]', chatId: 'c6' }); });
    await output(page);
    c = await chat(page);
    assert.equal(c.message.at(-1).data, '스팡달이 왔다.\n[▣|2025.01.01|05:10 AM|☀️|4°C|관리국|없음]', '실패하면 본문 그대로');
    assert.ok(String(c.scriptstate.$goei_asset_note).includes('보조 모델'), '실패 이유는 변수에');
    await setVars(page, { $st_asset_model: 'main' });
  });
  await R.section('5-4 응답 처리 한 번의 읽기·저장 횟수 (인물 기록 끔·보조 모델 없음)', async () => {
    await setVars(page, { $pp_on: '0' });
    await page.evaluate(() => { window.__calls.llm = []; window.__chat.message.push({ role: 'user', data: '넷', chatId: 'u4' }, { role: 'char', data: '넷째 답.\n[AG|P002|내근|서류]\n[▣|2025.01.01|04:00 AM|☀️|4°C|관리국|없음]', chatId: 'c4' }); });
    await resetCounts(page);
    await output(page);
    const c = await counts(page);
    console.log(`  output reads chat=${c.chat} char=${c.char} saves chat=${c.setChat} char=${c.setChar}`);
    assert.ok(c.chat <= 2 && c.char <= 1 && c.setChat === 1, `읽기 chat≤2·char≤1, 저장 1: ${JSON.stringify(c)}`);
    assert.equal((await page.evaluate(() => (window.__calls.llm ?? []).length)), 0, '보조 모델 호출 없음');
  });
  assert.deepEqual(errors, []);
  await page.close();
}

// ── 6) 긴 채팅 (메시지 500개 × 2KB): 요청·표시 시간, 읽기 횟수 ──
{
  const big = Array.from({ length: 500 }, (_, i) => ({ role: i % 2 ? 'char' : 'user', data: `${i % 2 ? '쟈알디가 말했다. ' : '나는 걸었다. '}${'가나다라마바사 '.repeat(120)}${i % 2 ? `\n[▣|2025.01.0${(i % 9) + 1}|0${i % 10}:00 AM|☀️|4°C|관리국 ${i}|없음|없음|없음|관리국/신입|140000]` : ''}`, chatId: `m${i}` }));
  const { page, errors } = await boot(browser, fixture, { message: big, scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_anomaly_on: '1' } }, { fixtureDir });
  await waitLite(page);
  await R.section('6-1 긴 채팅: beforeRequest 1초 안, display 메시지당 5ms 안, 읽기 2번', async () => {
    const msgs = [sys('S'), ...big.map((m) => (m.role === 'user' ? usr(m.data) : bot(m.data)))];
    await resetCounts(page);
    const t = await page.evaluate(async (m) => { const t0 = performance.now(); const out = await window.__calls.replacers[0](m, 'model'); return [performance.now() - t0, out.length, JSON.stringify(out).length]; }, msgs);
    const c = await counts(page);
    console.log(`  beforeRequest ${t[0].toFixed(0)}ms, ${t[1]} messages, ${(t[2] / 1024).toFixed(0)}KB, reads chat=${c.chat} char=${c.char}`);
    assert.ok(t[0] < 1500, `beforeRequest ${t[0]}ms`);
    assert.deepEqual([c.chat, c.char], [1, 1]);
    const d = await page.evaluate(async (list) => { const t0 = performance.now(); for (const x of list) await window.__calls.handlers.display(x); return (performance.now() - t0) / list.length; }, big.slice(-100).map((m) => m.data));
    console.log(`  display ${d.toFixed(2)}ms/message`);
    assert.ok(d < 5, `display ${d}ms`);
  });
  assert.deepEqual(errors, []);
  await page.close();
}

// ── 7) 기기 설정 imgSend·imgShow 0/1 (부팅 때 저장소에 넣는다) ──
for (const [send, show, keepTags, when] of [[0, 0, 4, false], [2, 1, 1, true]]) {
  const { page, errors } = await boot(browser, fixture, { message: [{ role: 'user', data: 'hi' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2' } }, { fixtureDir, prefs: { imgSend: send, imgShow: show } });
  await waitLite(page);
  await R.section(`7-${send} imgSend ${send}·imgShow ${show}: 요청의 태그 ${send ? `최근 ${send}개` : '전부'}, 표시 조건 ${when ? '있음' : '없음'}`, async () => {
    const msgs = [sys('S'), ...Array.from({ length: 8 }, (_, i) => (i % 2 ? bot(`답 ${i} <img=Jyaldi_smile>`) : usr(`말 ${i}`))), usr('끝')];
    const out = await request(page, msgs);
    assert.equal(out.filter((m) => m.role !== 'system' && m.content.includes('<img=')).length, keepTags);
    const h = await display(page, '앞 <img=Jyaldi_smile> 뒤');
    assert.equal(h.includes('{{#when'), when, h);
    assert.ok(h.includes('{{raw::Jyaldi_smile}}'));
  });
  assert.deepEqual(errors, []);
  await page.close();
}

// ── 8) 요청 조립 단계가 하나씩 던져도(예외 주입 globalThis.__goeiFaultSteps) 요청은 나가고 플러그인 표식은 없다 (개선 나3 정책: 막지 않고 표식만 지움) ──
{
  const { page, errors, logs } = await boot(browser, fixture, { message: [], scriptstate: {} }, { fixtureDir });
  const saved = await startChat(page, 'A00', 2);
  const greeting = fixture.alternateGreetings[saved.fmIndex];
  const MARKERS = ['%%SCENE_CARD:', '%%/SCENE_CARD%%', '%%PHONE_CALL:', '%%/PHONE_CALL%%', '%%GOEI_START%%', '%%/GOEI_START%%', '%%GOEI_UNSENT%%', '%%SEED%%', '%%/SEED%%'];
  // 플러그인이 채팅에 남기는 표식을 모두 담은 원문 요청 (첫 전송이라 로어 단계가 시드 표식도 끼운다)
  const raw = () => [
    sys('SYSTEM PROMPT'),
    bot(`${greeting}\n${STATUS}`),
    usr(core.startRecord('시작 화면에서 적은 첫 상황')),
    bot(`[AN|명일 아파트|발생] 괴이가 나타났다.\n[🔓|부록 하나]\n${STATUS2}`),
    usr(`${core.sceneRecord({ target: '명일 아파트', party: '쟈알디' }, '{{user}} moves to 명일 아파트 with 쟈알디.')}\n추가 요청`),
    usr(core.phone.callRecord('에일린', '지원 요청')),
    usr(core.setUnsent('아직 안 보낸 글', true)),
    usr('마지막 행동'),
  ];
  const leaked = (out) => out.filter((m) => typeof m.content === 'string' && MARKERS.some((k) => m.content.includes(k))).map((m) => m.content.slice(0, 60));
  const setFault = (names) => page.evaluate((n) => { globalThis.__goeiFaultSteps = n; }, names);
  const check = (out, name) => {
    assert.ok(Array.isArray(out) && out.length >= 5, `요청이 나간다 (${out?.length})`);
    assert.deepEqual(leaked(out), [], `${name}: 표식이 모델에 가지 않음`);
    assert.equal([...out].reverse().find((m) => m.role === 'user')?.content, '마지막 행동', '마지막 사용자 메시지 유지');
    assert.ok(out.some((m) => m.content.includes('{{user}} moves to 명일 아파트 with 쟈알디.')), '지시문 본문은 남음');
    assert.ok(out.some((m) => m.content.includes('places a phone call to 에일린')), '전화 본문은 남음');
    assert.ok(out.some((m) => m.content === '시작 화면에서 적은 첫 상황' || m.content.includes('시작 화면에서 적은 첫 상황')), '시작 카드 본문은 남음');
    assert.ok(!out.some((m) => m.role === 'assistant' && (m.content.includes('[AN|') || m.content.includes('[🔓|'))), '지난 응답의 상황판 태그·해금 표시 없음');
  };

  await R.section('8-0 주입 없음: 표식 없음 · 실패 로그 없음 · 로어(시드 본문) 있음', async () => {
    logs.length = 0;
    const out = await request(page, raw());
    check(out, '정상');
    assert.ok(loreOf(out) && loreOf(out).content.includes('[Affiliation code: A00]'), '시드 본문은 들어감');
    assert.ok(!logs.some((l) => l.includes('요청 조립 실패')), `실패 로그 없음: ${logs.join(' | ')}`);
  });

  // 단계 이름은 src/body.ts onBeforeRequest 의 step()/stepAsync() 이름. 「시드 채팅 읽기」는 채팅 읽기가 실패했고 요청에 시드 표식이 있을 때만 돈다
  // (채팅을 못 읽으면 로어 단계가 시드를 끼우지 않으니, 원문에 시드 표식이 있는 경우로 — 옛 카드의 📕Start Lore 자리 항목 모양)
  const STEPS = [['지시문·전화 풀기'], ['시작 카드 표식'], ['옛 이미지 태그'], ['채팅 읽기'], ['유저 이름'], ['기록 태그 정리'], ['로어'], ['주인공'], ['막간'], ['명부 다듬기'], ['참고 기록'], ['신분'], ['상태창 모양'], ['상태창'], ['인물 기록'], ['이미지 지침'], ['시드'], ['채팅 읽기', '시드 채팅 읽기']];
  for (const names of STEPS) {
    await R.section(`8-단계 「${names.join('·')}」 가 던져도 요청은 나가고 표식은 없다`, async () => {
      await setFault(names);
      logs.length = 0;
      const out = await request(page, names.includes('시드 채팅 읽기') ? [sys(`${core.SEED_OPEN}\n시드 글\n${core.SEED_CLOSE}`), ...raw()] : raw());
      check(out, names.join('·'));
      const line = logs.find((l) => l.includes('[goei] 요청 조립 실패: 단계'));
      assert.ok(line, `실패 로그 한 줄: ${logs.join(' | ')}`);
      for (const n of names) assert.ok(line.includes(`${n}(시험용 예외 주입)`), `로그에 단계 이름 「${n}」: ${line}`);
      assert.equal(logs.filter((l) => l.includes('요청 조립 실패')).length, 1, '모아서 한 줄');
    });
  }

  await R.section('8-전체 본체 beforeRequest 가 통째로 던지면 시작기가 표식만 지워 보낸다', async () => {
    await setFault(['beforeRequest']);
    logs.length = 0;
    const out = await request(page, raw());
    assert.deepEqual(leaked(out), [], '표식 없음');
    assert.equal(out.length, raw().length, '단계는 하나도 못 돌아 메시지 수는 원문과 같음');
    assert.ok(out.some((m) => m.content.includes('{{user}} moves to 명일 아파트 with 쟈알디.')) && out.at(-1).content === '마지막 행동', '단계가 안 돌아 이미지 지침도 없음');
    assert.ok(!out.some((m) => m.role === 'assistant' && m.content.includes('[AN|')), '괴이 카드라 지난 응답 상황판 태그도 지움');
    assert.ok(logs.some((l) => l.includes('[goei] 요청 처리기 실패') && l.includes('시험용 예외 주입(beforeRequest)')), `시작기 로그: ${logs.join(' | ')}`);
  });

  await R.section('8-복구 주입을 끄면 다시 정상', async () => {
    await setFault(null);
    logs.length = 0;
    const out = await request(page, raw());
    check(out, '복구');
    assert.ok(loreOf(out), '로어 덩어리');
    assert.ok(!logs.some((l) => l.includes('요청 조립 실패') || l.includes('요청 처리기 실패')));
  });
  assert.deepEqual(errors, []);
  await page.close();
}

await browser.close();
console.log(`\n${R.results.length - R.failed()}/${R.results.length} 통과`);
process.exit(R.failed() ? 1 : 0);
