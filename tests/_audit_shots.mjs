// 전수 점검용 (2026-11-05, 일회성): 탭마다 PC·폰 세로·폰 가로 사진 + 버튼 규격·뒤로가기·서랍·넘침 측정.
// 사용: node tests/_audit_shots.mjs <fixture.json> <사진 폴더>
import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, launch, loadFixture, openWin, VIEWPORTS } from './qc-settings-harness.mjs';

const [fxPath, OUT = '.scratch/audit-shots'] = process.argv.slice(2);
const fx = loadFixture(fxPath);
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const report = {};

const STATUS = '[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
const REPLY = `첫 답. 쟈알디가 손을 흔들었다.\n[AN|서울특별시 종로구|QC 괴이|활성|B|없음|소란]\n[IN|서울특별시 중구|QC 사건|진행|정전]\n${STATUS}`;

const metrics = (page) => page.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const gw = document.querySelector('.gw'); const gwVis = gw && !gw.hidden && gw.getBoundingClientRect().width > 0;
  const root = (gwVis ? gw : document.querySelector('.gx')) || document.body;
  const btns = [...root.querySelectorAll('button')].filter(vis);
  const groups = {};
  for (const b of btns) {
    const cls = (b.className || '').split(/\s+/).filter((c) => c && !/^(on|primary|danger|desk|mob|save|active|live|ready)$/.test(c))[0] || '(없음)';
    const s = getComputedStyle(b); const r = b.getBoundingClientRect();
    const g = (groups[cls] ||= { n: 0, h: new Set(), w: new Set(), radius: new Set(), font: new Set(), small: 0 });
    g.n++; g.h.add(Math.round(r.height)); g.radius.add(s.borderRadius); g.font.add(s.fontSize);
    if (r.height < 32 || r.width < 32) g.small++;
  }
  for (const g of Object.values(groups)) for (const k of ['h', 'w', 'radius', 'font']) g[k] = [...g[k]].sort();
  const over = [];
  for (const el of root.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const s = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 2 && s.overflowX !== 'auto' && s.overflowX !== 'scroll' && s.overflowX !== 'hidden') over.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(/\s+/).slice(0, 2).join('.')} ${el.scrollWidth}>${el.clientWidth}`);
    if (over.length > 8) break;
  }
  const pageOver = document.scrollingElement.scrollWidth - innerWidth;
  const q = (sel) => [...root.querySelectorAll(sel)].some(vis);
  const headActs = [...root.querySelectorAll('.gx-head-act button, .gx-head button')].filter(vis).map((b) => b.dataset.action + (b.dataset.value ? ':' + b.dataset.value : '') || b.className);
  const backs = [...root.querySelectorAll('button')].filter(vis).filter((b) => /back/.test(b.dataset.action || '') || /back/.test(b.className) || /뒤로|돌아가/.test(b.getAttribute('aria-label') || '')).map((b) => b.dataset.action || b.className);
  const tiny = [...root.querySelectorAll('*')].filter((el) => vis(el) && el.childElementCount === 0 && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 11).length;
  const headH = root.querySelector('.gx-head')?.getBoundingClientRect().height ?? 0;
  const navW = root.querySelector('.gx-nav')?.getBoundingClientRect().width ?? 0;
  const mbarH = root.querySelector('.gx-mbar')?.getBoundingClientRect().height ?? 0;
  return {
    title: root.querySelector('.gx-head b, .gx-tabhead b')?.textContent?.trim(),
    headH: Math.round(headH), navW: Math.round(navW), mbarH: Math.round(mbarH),
    nav: q('.gx-nav'), mbar: q('.gx-mbar'), drawer: q('.ph-drawer, .gx-drawer, [class*="drawer"]'), drawerOpen: q('.ph-drawer.open, .ph-drawer.on'),
    headActs, backs, pageOver, over, tiny, buttons: groups,
  };
});

for (const vp of ['pc', 'phone', 'land']) {
  const R = (report[vp] = {});
  const { page, errors } = await boot(browser, fx, { message: [], scriptstate: {} }, vp);
  let n = 0;
  const shot = async (tag) => { await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/${vp}-${String(++n).padStart(2, '0')}-${tag}.png` }); R[tag] = await metrics(page); };
  const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
  try {
    await openWin(page);
    await page.waitForSelector('.gx-fac');
    await shot('picker');
    await click('.gx-fac[data-value="A00"]');
    await click('.gx-sc[data-value="2"]');
    await page.waitForTimeout(200);
    await shot('picker-picked');
    const before = await page.evaluate(() => window.__calls.setChat.length);
    await click('.gx-start');
    await page.waitForFunction((b) => window.__calls.setChat.length > b, before);
    await page.waitForTimeout(400);
    // 응답 하나 넣어 상황판에 괴이·사건이 생기게
    await page.evaluate(async (reply) => {
      window.__chat.message.push({ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: reply, chatId: 'c1' });
      const l = window.__calls.listeners?.[0];
      if (l) await l({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(window.__chat)), characterIndex: 0, chatIndex: 0, messageIndex: 1 });
    }, REPLY);
    await page.evaluate(() => { const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; });
    await openWin(page);
    await page.waitForTimeout(500);
    // 설치 안내로 설정 창이 저절로 열렸으면 닫는다
    await page.evaluate(() => document.querySelector('.gw [data-action="ed-close"]')?.click());
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('.gw [data-action="ed-confirm-no"], .gw [data-action="ed-close"][data-value="force"]')?.click());
    await page.waitForTimeout(300);
    await shot('board');
    if (vp !== 'pc') { if (await click('.gx .ph-grip')) { await page.waitForTimeout(350); await shot('board-drawer'); await click('.gx .ph-grip'); } }
    for (const tab of ['map', 'mission', 'phone', 'gnet', 'wiki', 'records', 'wallet']) {
      const ok = await click(`[data-action="tab"][data-value="${tab}"], [data-action="nav-tab"][data-value="${tab}"]`);
      if (!ok) { R[`${tab}`] = { missing: true }; continue; }
      await page.waitForTimeout(400);
      await shot(tab);
      if (tab === 'phone') {
        if (await click('[data-action="ph-dm"], .ph-contact, [data-action="ph-room"]')) { await page.waitForTimeout(400); await shot('phone-room'); if (vp !== 'pc' && await click('.gx .ph-grip')) { await page.waitForTimeout(300); await shot('phone-room-drawer'); await click('.gx .ph-grip'); } await click('[data-action="ph-back"]'); }
        if (await click('[data-action="ph-sub"][data-value="notice"], [data-action="ph-sub"][data-value="notices"]')) { await page.waitForTimeout(300); await shot('phone-notice'); }
      }
      if (tab === 'mission' && vp !== 'pc') { if (await click('[data-action="mission-swap"], .gx-mswap, .gx-stepswap')) { await page.waitForTimeout(300); await shot('mission-swapped'); } }
      if (tab === 'wiki') { if (await click('.nw-tile, [data-action="wiki-open"], .nw-card')) { await page.waitForTimeout(300); await shot('wiki-doc'); await click('[data-action="wiki-back"], [data-action="nav-back"]'); } }
      if (tab === 'records') { for (const sub of ['reports', 'people', 'wallet']) { if (await click(`[data-action="rec-sub"][data-value="${sub}"]`)) { await page.waitForTimeout(300); await shot(`records-${sub}`); } } }
      if (tab === 'map') { if (await click('[data-action="board-map"], .gx-evpick')) { await page.waitForTimeout(300); await shot('map-picked'); } }
    }
    // 사원증 창
    if (await click('[data-action="id-card"]')) { await page.waitForTimeout(300); await shot('idcard'); await page.keyboard.press('Escape'); }
    // 설정 창 페이지들
    if (await click('[data-action="id-card"]')) { await page.waitForTimeout(300); await shot('idcard-open'); await page.evaluate(() => document.querySelectorAll('.gx-idpop .gx-agpop-x').forEach((b) => b.click())); await page.waitForTimeout(200); }
    await click('[data-action="ed-open"]');
    await page.waitForFunction(() => { const g = document.querySelector('.gw'); return g && !g.hidden && g.querySelector('.gw-win'); });
    await page.waitForTimeout(300);
    await shot('settings');
    for (const node of ['set:image', 'set:board', 'set:phone', 'set:people', 'set:journal', 'set:adv', 'set:update', 'agent', 'guide:RP', 'manage:diag']) {
      const tab = node.startsWith('guide:') ? 'guide' : node.startsWith('manage:') || node === 'set:update' ? 'manage' : node.startsWith('set:') ? 'set' : 'world';
      await page.evaluate((t) => document.querySelector(`.gw [data-action="ed-tab"][data-value="${t}"]`)?.click(), tab);
      await page.waitForTimeout(150);
      const ok = await page.evaluate((n) => { const el = document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`); if (!el) return false; el.click(); return true; }, node);
      if (!ok) { R[`ed-${node}`] = { missing: true }; continue; }
      await page.waitForTimeout(300);
      await shot(`ed-${node.replace(/[:]/g, '_')}`);
    }
  } catch (e) {
    R.error = String(e?.stack || e);
    await page.screenshot({ path: `${OUT}/${vp}-ERR.png` }).catch(() => {});
  }
  R.errors = errors;
  await page.close();
}
writeFileSync(`${OUT}/metrics.json`, JSON.stringify(report, null, 1));
await browser.close();
console.log('done', Object.fromEntries(Object.entries(report).map(([k, v]) => [k, Object.keys(v).length])));
