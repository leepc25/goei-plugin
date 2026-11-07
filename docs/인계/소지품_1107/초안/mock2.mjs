// 소지품 화면 초안 2 (11-07 06:40): 실제 플러그인 창 안에 기록 메뉴와 같은 틀(밑줄 탭·현황 판·칩·목록)로 끼워 넣어 찍는다.
// 사용법: node docs/인계/소지품_1107/초안/mock2.mjs  → /mnt/project-files/작업_1107/초안2_*.png
import { readFileSync } from 'node:fs';
import { boot, closeEditor, launch, loadFixture, openWin, sleep } from '../../../../tests/qc-settings-harness.mjs';
const fx = loadFixture(new URL('../../../../.scratch/fixture/fixture.json', import.meta.url).pathname);
const src = readFileSync(new URL('../../../../src/ui/itemIcons.ts', import.meta.url), 'utf8');
const icons = Object.fromEntries([...src.matchAll(/^  (\w+): stroke\('(.*)'\),$/gm)].map(m => [m[1], m[2]]));
const ic = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[k]}</svg>`;
const items = [['consumable', '소금 봉지'], ['tool', '손전등'], ['charm', '부적'], ['key', '낡은 열쇠'], ['device', '녹음기'], ['wear', '방검 조끼'], ['paper', '사건 파일'], ['medical', '진통제'], ['food', '생수'], ['anomaly', '검은 구슬'], ['valuable', '현금 봉투'], ['weapon', '접이식 칼']];
const cell = ([k, n], i) => `<button class="it-c${i === 0 ? ' sel' : ''}"><span class="it-ic">${ic(k)}</span><b>${n}</b></button>`;
const grid = `<div class="it-grid">${items.map(cell).join('')}${'<div class="it-c empty"></div>'.repeat(4)}<button class="it-c over"><span class="it-ic">${ic('seal')}</span><b>봉인 상자</b></button></div>`;
const tip = `<div class="it-tip"><b>소금 봉지</b><small>소모품 · 장터 11-07</small><p>관리국 지급품, 두 봉지 남음. 문턱이나 창틀에 뿌려 두면 하룻밤은 버틴다.</p><p class="ef">효과: 저급 괴이의 접근을 늦춘다</p></div>`;
const pop = `<div class="it-dim"><div class="it-pop"><div class="it-ph"><span class="it-ic">${ic('consumable')}</span><div><b>소금 봉지</b><small>소모품 · 장터 · 11-07 ₩ 6,000</small></div><button class="gx-x it-x">✕</button></div>
<p>관리국 지급품, 두 봉지 남음. 문턱이나 창틀에 뿌려 두면 하룻밤은 버틴다.</p><p class="ef">효과: 저급 괴이의 접근을 늦춘다</p>
<div class="it-btns"><button class="gx-chip on">사용</button><button class="gx-chip">고치기</button><button class="gx-chip">합치기</button><button class="gx-chip red">버리기</button></div></div></div>`;
const log = `<div class="gx-wt-list">
<li class="gx-wt-row"><div class="gx-wt-main"><span class="gx-wt-memo"><b>부적 1장 사용</b><small>본문 · 「부적을 꺼내 문틈에 끼웠다」</small></span><span class="gx-wt-amt"><small>11-07</small></span></div></li>
<li class="gx-wt-row"><div class="gx-wt-main"><span class="gx-wt-memo"><b>생수 1병 사용</b><small>사용 단추</small></span><span class="gx-wt-amt"><small>11-06</small></span></div></li>
<li class="gx-wt-row"><div class="gx-wt-main"><span class="gx-wt-memo"><b>손수건 버림</b><small>직접</small></span><span class="gx-wt-amt"><small>11-06</small></span></div></li></div>`;
const body = (mode) => `<div class="ph-subs gx-rec-tabs it-tabs" role="tablist"><button class="ph-sub">가계부</button><button class="ph-sub on">소지품</button></div><div class="gx-wallettab it-tab">
<section class="gx-mon gx-wt-tiles"><div class="gx-mon-osd"><span><span class="gx-mon-tag live"><i></i>소지품</span></span><span>2025.01.01</span></div>
<div class="gx-mon-cells"><div class="gx-mon-cell gx-wt-tile bal"><small>칸</small><div class="gx-wt-balrow"><b class="mint">12 / 16</b></div><span>한계 「가방 하나와 주머니, 두 손」</span></div>
<div class="gx-mon-cell gx-wt-tile"><small>넘침</small><b class="red">1</b><span>본편이 이번 턴에 처리</span></div><div class="gx-mon-cell gx-wt-tile"><small>이번 턴 사용</small><b class="mint">1</b><span>소금 봉지</span></div><div class="gx-mon-cell gx-wt-tile"><small>기록</small><b class="">3</b><span>사용·처분</span></div></div></section>
<div class="gx-rec-tools gx-wt-tools"><button class="gx-chip${mode === 'log' ? '' : ' on'}">물건</button><button class="gx-chip${mode === 'log' ? ' on' : ''}">기록</button><button class="gx-chip">＋ 직접 넣기</button><button class="gx-chip">합치기</button><input class="gx-wt-q" type="search" placeholder="찾기: 물건·기록"></div>
${mode === 'log' ? log : grid}${mode === 'hover' ? tip : ''}${mode === 'pop' ? pop : ''}</div>`;
const css = `
.it-tabs.gx-rec-tabs{grid-template-columns:repeat(2,1fr)}.it-tab{display:flex;flex-direction:column;flex:1;min-height:0;position:relative}
.it-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));grid-auto-rows:1fr;gap:10px;flex:1;min-height:0}
.it-c{position:relative;min-width:0;border:1px solid var(--line);border-radius:14px;background:var(--panel);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:8px;font:inherit}
.it-c .it-ic{color:var(--signal);width:48%;aspect-ratio:1;display:grid;place-items:center}.it-c .it-ic svg{width:100%;height:100%}.it-c b{font-size:13px;font-weight:600;text-align:center;line-height:1.2}
.it-c.empty{background:none;border:1px dashed var(--line2)}.it-c.sel{border-color:var(--signal);box-shadow:0 0 0 1px var(--signal) inset}.it-c.over{border-color:var(--danger,#e5484d)}.it-c:hover{background:color-mix(in srgb,var(--signal) 6%,var(--panel))}
.it-tip{position:absolute;left:150px;top:214px;width:260px;background:var(--void);border:1px solid var(--line2);border-radius:12px;padding:10px 12px;box-shadow:0 14px 30px -12px rgba(0,0,0,.8);z-index:3}.it-tip b{display:block;font-size:14px}.it-tip small{color:var(--dim);font-size:11.5px}.it-tip p{margin:8px 0 0;font-size:12.5px;line-height:1.5;color:var(--sub)}.it-tip .ef{color:var(--text)}
.it-dim{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:50}.it-pop{width:min(360px,calc(100vw - 32px));background:var(--panel);border:1px solid var(--line2);border-radius:14px;padding:14px;box-shadow:0 24px 50px -20px rgba(0,0,0,.9)}
.it-ph{display:flex;gap:10px;align-items:center}.it-ph .it-ic{width:34px;height:34px;color:var(--signal)}.it-ph .it-ic svg{width:100%;height:100%}.it-ph b{display:block;font-size:15px}.it-ph small{color:var(--dim);font-size:11.5px}.it-x{margin-left:auto}
.it-pop p{margin:10px 0 0;font-size:13px;line-height:1.5;color:var(--sub)}.it-pop .ef{color:var(--text)}.it-btns{display:flex;gap:6px;margin-top:12px}.it-btns .gx-chip{flex:1;justify-content:center}.it-btns .red{color:#e5484d;border-color:#e5484d}
@media (max-width:760px){.it-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.it-tip{display:none}}`;
const b = await launch(); const out = '/mnt/project-files/작업_1107/초안2_';
for (const vp of ['pc', 'phone']) {
  const { page } = await boot(b, fx, { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark' } }, vp);
  await openWin(page); await sleep(300); if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true); await sleep(200);
  await page.evaluate(() => document.querySelector('[data-action="tab"][data-value="records"]')?.click()); await sleep(300);
  await page.addStyleTag({ content: css });
  for (const mode of vp === 'pc' ? ['hover', 'pop', 'log'] : ['grid', 'pop']) {
    await page.evaluate((html) => {
      const m = document.querySelector('main.gx-body'); m.innerHTML = html;
      const t = document.querySelector('.gx-title, .gx-head h1, .gx-brand b'); if (t) t.textContent = '소지품';
      const nb = document.querySelector('.gx-nb[data-value="records"]'); if (nb && !document.querySelector('.gx-nb[data-value="items"]')) { const c = nb.cloneNode(true); c.dataset.value = 'items'; c.querySelector('span').textContent = '소지품'; c.classList.add('on'); nb.classList.remove('on'); nb.before(c); }
      const mb = document.querySelector('.gx-x.gx-recbtn'); if (mb) mb.classList.add('on');
    }, body(mode));
    await sleep(200);
    await page.screenshot({ path: `${out}${vp}_${mode}.png` });
  }
  await page.close();
}
await b.close(); console.log('ok');
