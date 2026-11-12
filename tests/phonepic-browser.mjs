// 괴담톡 인물 사진 보내기 뺌 (2026-11-12 사용자: 「그냥 사진 기능 빼자」 — 인물이 표정 그림을 기분 표시처럼 보냈다).
//  ① 괴담톡 방에 남은 옛 [사진:이름_표정] 글은 그림으로 안 바뀌고 사진 설명 틀로 보인다 (깨진 글·그림 없음), PC·폰
//  ② 게시판을 먼저 열었다가 괴담톡으로 와도 같다 (게시판의 그림 찾기가 남지 않는다)
//  ③ 괴담넷 글의 [사진:이름_표정] 은 전처럼 그림으로 보인다
// 사용법: node tests/phonepic-browser.mjs <fixture.json> [사진 폴더]
import { mkdirSync } from 'node:fs';
import { boot, closeEditor, launch, loadFixture, openWin, sleep } from './qc-settings-harness.mjs';
import * as core from '../dist-test/core.mjs';

const fx = loadFixture(process.argv[2]);
const shots = process.argv[3] || '';
if (shots) mkdirSync(shots, { recursive: true });
const browser = await launch();
let pass = 0; const fails = [];
const ok = (cond, name, info = '') => { if (cond) pass++; else { fails.push(`${name}${info ? ` — ${info}` : ''}`); console.log('FAIL', name, info); } };

const P = core.phone;
const ss0 = { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_anomaly_on: '1', $pp_on: '0' };
const base = { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.03.10|05:52 PM|🌧|8°C|중림동|목표]' }], scriptstate: ss0 };
// 방은 저장된 기록만으로 그려진다 (연락처 명부는 세계 자료 팩에 있어 여기서는 직접 적은 사람으로)
const who = { id: 'c_test', name: '진나솔', custom: true };
const TAG = `[사진:${who.name}_angry]`;
const st = P.blankState();
const room = { id: `dm_${who.id}`, kind: 'dm', members: [who.id], people: { [who.id]: who }, messages: [], draft: '', unread: 0 };
st.rooms[room.id] = room; st.order = [room.id];
P.push(st, room, who.id, TAG, '19:25');
P.push(st, room, who.id, '하, 미치겠네. 야, 너 뭐냐?', '19:25');
let chat = P.writePhone(base, st);
const gs = core.readGnet(base);
gs.posts.push({ id: 100001, date: '03.10 17:40', nick: '익명', title: '사진 올림', views: 3, votes: 0, body: `이 사람 봄\n${TAG}`, mine: false, comments: [] });
chat = { ...chat, scriptstate: { ...chat.scriptstate, $gn_raw: core.encode(gs) } };

const clickFirst = (page, sels) => page.evaluate((sels) => { for (const s of sels) { const e = [...document.querySelectorAll(s)].find((x) => x.offsetParent !== null) ?? document.querySelector(s); if (e) { e.click(); return s; } } return null; }, sels);
const goTab = async (page, t) => { await clickFirst(page, [`.gx-nav .gx-nb:not(.mob)[data-value="${t}"]`, `.gx-nav [data-action="tab"][data-value="${t}"]`, `[data-action="tab"][data-value="${t}"]`]); await sleep(700); };
const phoneRoom = async (page, id) => {
  await goTab(page, 'phone');
  await clickFirst(page, ['[data-action="ph-sub"][data-value="chats"]']); await sleep(500);
  // PC 는 고른 방을 다시 누르면 닫힌다 → 이미 열려 있으면 누르지 않는다
  if (!(await page.evaluate((id) => !!document.querySelector(`[data-action="ph-room"][data-value="${id}"].on`) && !!document.querySelector('.gx .ph-room'), id))) await clickFirst(page, [`[data-action="ph-room"][data-value="${id}"]`]);
  await page.waitForSelector('.ph-room', { timeout: 5000 }).catch(() => {});
  await sleep(500);
  return page.evaluate((tag) => {
    const scope = document.querySelector('.gx .ph-room');
    if (!scope) return { n: 0, imgs: [], photoCards: [], rawTag: false, text: '(방이 안 열림) ' + document.querySelector('.gx').textContent.replace(/\s+/g, ' ').slice(-200), sw: 0, iw: 1 };
    const bubbles = [];
    return {
      n: bubbles.length,
      imgs: [...scope.querySelectorAll('.at-card-image img, figure.at-card img, .at-photo img')].map((i) => i.getAttribute('src')),
      photoCards: [...scope.querySelectorAll('.at-card-photo')].map((c) => c.textContent.trim()),
      rawTag: scope.textContent.includes(tag) || scope.textContent.includes('[사진:'),
      text: scope.textContent.replace(/\s+/g, ' ').slice(0, 200),
      sw: document.documentElement.scrollWidth, iw: innerWidth,
    };
  }, TAG);
};

for (const [name, vp] of [['PC', { width: 1920, height: 1080 }], ['폰', { width: 390, height: 844, touch: true }]]) {
  const { page, errors } = await boot(browser, fx, chat, vp);
  await openWin(page);
  await goTab(page, 'board'); await closeEditor(page, true).catch(() => {});
  // ① 괴담톡 먼저
  const a = await phoneRoom(page, room.id);
  ok(a.photoCards.length === 1, `${name} ① 옛 사진 글이 사진 설명 틀 하나로 보인다`, JSON.stringify(a.photoCards) + ' ' + a.text);
  ok(a.photoCards.length === 1 && a.photoCards[0].includes(who.name) && !/_angry/.test(a.photoCards[0]), `${name} ① 틀에는 이름만 (표정 말은 안 보인다)`, JSON.stringify(a.photoCards));
  ok(a.imgs.length === 0, `${name} ① 그림으로 바뀌지 않는다`, JSON.stringify(a.imgs));
  ok(!a.rawTag, `${name} ① [사진:…] 글자가 그대로 드러나지 않는다`, a.text);
  ok(a.text.includes('하, 미치겠네'), `${name} ① 같이 온 말은 그대로 보인다`, a.text);
  ok(a.sw <= a.iw + 1, `${name} ① 가로 넘침 없음`, `${a.sw}/${a.iw}`);
  if (shots) await page.screenshot({ path: `${shots}/phone_${name === 'PC' ? 'pc' : 'ph'}.png` });
  // ③ 괴담넷 글은 그림
  await goTab(page, 'net');
  await clickFirst(page, ['.gx [data-action="br-go"][data-value="gn"]']); await sleep(900);
  await clickFirst(page, ['[data-action="gn-open"][data-value="100001"]', '[data-action="gn-open-side"][data-value="100001"]']);
  await sleep(900);
  const g = await page.evaluate(() => {
    const b = document.querySelector('.gn-post-body');
    return b ? { imgs: [...b.querySelectorAll('img')].map((i) => (i.getAttribute('src') || '').slice(0, 40)), ph: b.querySelectorAll('.ax-ph').length, text: b.textContent.trim().slice(0, 100) } : null;
  });
  ok(!!g && g.imgs.length === 1 && g.imgs[0].length > 0 && g.ph === 0, `${name} ③ 괴담넷 글의 [사진:…] 은 그림으로 보인다`, JSON.stringify(g));
  if (shots) await page.screenshot({ path: `${shots}/gnet_${name === 'PC' ? 'pc' : 'ph'}.png` });
  // ② 게시판을 본 뒤 괴담톡
  const b2 = await phoneRoom(page, room.id);
  ok(b2.photoCards.length === 1 && b2.imgs.length === 0, `${name} ② 괴담넷을 본 뒤에도 괴담톡은 그림으로 안 바뀐다`, JSON.stringify([b2.photoCards, b2.imgs]));
  ok(errors.length === 0, `${name} 콘솔 오류 없음`, errors.join(' | ').slice(0, 300));
  await page.close();
}
await browser.close();
console.log(`${fails.length ? 'FAIL' : 'PASS'} phonepic: ${pass} 통과, ${fails.length} 실패`);
if (fails.length) { for (const f of fails) console.log(' -', f); process.exit(1); }
