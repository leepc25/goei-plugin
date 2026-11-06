// 일회성 (2026-11-06): 연대기·사원증 뒷면 확인 사진. 사용: node tests/_shots_chronicle.mjs <fixture.json> <사진 폴더>
import { mkdirSync } from 'node:fs';
import { boot, launch, loadFixture, openWin } from './qc-settings-harness.mjs';

const [fxPath, OUT] = process.argv.slice(2);
const fx = loadFixture(fxPath);
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const ST = (d, t) => `[▣|2025.01.0${d}|${t}|☀️|4°C|관리국|없음]`;
const REPLY = `첫 답.\n[AN|서울특별시 종로구|QC 괴이|활성|B|없음|소란]\n${ST(1, '02:47 AM')}`;
const cue = (who, cueName, anchor, seq, reason = '') => ({ id: `c${who}${anchor}${seq}`, anchor, seq, src: 'manual', who, kind: 'cue', cue: cueName, reason });
const ag = (...n) => n.map((name) => ({ id: '', name, st: '휴게' }));
const D = (day, h, m) => Date.UTC(2025, 0, day, h, m) / 60000;
const rows = [
  { id: 'j1', kind: 'an', name: '소라 랜드', loc: 'A1', grade: 'B', at: D(1, 4, 11), since: D(1, 2, 50), born: null, idx: 3, anchor: 'c2', mine: true, cause: 'model', agents: ag('쟈알디', '스팡달'), result: '격리 완료', cleared: true },
  { id: 'j2', kind: 'in', name: '을지로 정전', loc: 'A1', at: D(2, 9, 30), since: D(2, 8, 0), born: null, idx: 5, anchor: 'c3', mine: true, cause: 'manual', agents: ag('쟈알디'), result: '복구' },
  { id: 'j3', kind: 'in', name: '남의 사건', loc: 'A1', at: D(2, 10, 0), since: null, born: null, idx: 5, anchor: 'c3', mine: false, cause: 'ttl', agents: [], result: '' },
];
const people = { schema: 1, people: { 쟈알디: { name: '쟈알디', faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 55 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [] } }, factions: {}, docs: {}, log: [cue('쟈알디', '큰도움', 'c2', 0, '현장에서 엄호해 줌'), cue('쟈알디', '헌신', 'c3', 0, '부상을 대신 입음')], folded: {}, read: {}, pending: {}, ignored: [] };
const wallet = { start: 50000, log: [{ id: 'w1', anchor: 'c2', amount: -12000, memo: '택시', src: 'story', at: '' }, { id: 'w2', anchor: 'c3', amount: -4500, memo: '편의점', src: 'story', at: '' }] };

for (const vp of ['pc', 'phone']) {
  const { page, errors } = await boot(browser, fx, { message: [], scriptstate: {} }, vp);
  const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
  const shot = async (tag) => { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${vp}_${tag}.png` }); };
  await openWin(page);
  await page.waitForSelector('.gx-fac');
  await click('.gx-fac[data-value="A00"]');
  await click('.gx-sc[data-value="2"]');
  const before = await page.evaluate(() => window.__calls.setChat.length);
  await click('.gx-start');
  await page.waitForFunction((b) => window.__calls.setChat.length > b, before);
  await page.waitForTimeout(2000);
  await page.evaluate(async (REPLY) => {
    const c = window.__chat;
    c.message.push({ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' });
    const l = window.__calls.listeners?.[0];
    if (l) await l({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: 1 });
  }, REPLY);
  await page.waitForTimeout(800);
  console.log(await page.evaluate(({ rows, people, wallet, more }) => {
    const c = window.__chat;
    c.message.push(...more);
    c.scriptstate.$goei_journal = JSON.stringify({ v: 1, rows });
    c.scriptstate.$st_wallet = JSON.stringify(wallet);
    c.goeiPeopleV1 = people;
    window.__button.cb(); // 닫기
    return [c.message.length, c.message.map((m) => m.role).join(','), Object.keys(c.scriptstate).length];
  }, { rows, people, wallet, more: [{ role: 'user', data: '계속', chatId: 'u2' }, { role: 'char', data: `둘째.\n${ST(1, '04:11 AM')}`, chatId: 'c2' }, { role: 'user', data: '계속', chatId: 'u3' }, { role: 'char', data: `셋째.\n${ST(2, '09:30 AM')}`, chatId: 'c3' }] }));
  await openWin(page);
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('.gw [data-action="ed-close"]')?.click());
  if (vp === 'pc') {
    await click('.gx-nav-brand [data-action="id-flip"]');
    await shot('사원증_뒷면');
    await click('.gx-nav-brand [data-action="id-flip"]');
  } else {
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelector('.gw [data-action="ed-close"]')?.click());
    await page.waitForSelector('.gx-idbtn', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(600);
    await page.click('.gx-idbtn');
    await page.waitForSelector('.gx-idpop');
    await shot('사원증_앞면');
    await click('.gx-idpop [data-action="id-flip"]');
    await page.waitForSelector('.gx-idpop .gx-id.back');
    await shot('사원증_뒷면');
    await page.evaluate(() => document.querySelectorAll('.gx-idpop').forEach((b) => b.remove()));
  }
  await click('[data-action="tab"][data-value="records"]');
  await page.waitForTimeout(300);
  await click('[data-action="rec-sub"][data-value="chronicle"]');
  await shot('연대기');
  await click('[data-action="rec-sub"][data-value="wallet"]');
  await shot('가계부_달줄');
  console.log(vp, errors.length ? errors : '오류 없음');
  await page.close();
}
await browser.close();
