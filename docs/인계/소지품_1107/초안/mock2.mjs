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
const grid = `<div class="it-grid">${items.map(cell).join('')}${'<div class="it-c empty"><span class="it-ic"></span><b>&nbsp;</b></div>'.repeat(4)}<button class="it-c over"><span class="it-ic">${ic('seal')}</span><b>봉인 상자</b></button></div>`;
const tip = `<div class="it-tip"><b>소금 봉지</b><small>소모품 · 장터 11-07</small><p>관리국 지급품, 두 봉지 남음. 문턱이나 창틀에 뿌려 두면 하룻밤은 버틴다.</p><p class="ef">효과: 저급 괴이의 접근을 늦춘다</p></div>`;
const pop = `<div class="it-dim"><div class="it-pop"><div class="it-ph"><span class="it-ic">${ic('consumable')}</span><div><b>소금 봉지</b><small>소모품 · 장터 · 11-07 ₩ 6,000</small></div><button class="gx-x it-x">✕</button></div>
<p>관리국 지급품, 두 봉지 남음. 문턱이나 창틀에 뿌려 두면 하룻밤은 버틴다.</p><p class="ef">효과: 저급 괴이의 접근을 늦춘다</p>
<div class="it-btns"><button class="gx-chip on">사용</button><button class="gx-chip">고치기</button><button class="gx-chip">합치기</button><button class="gx-chip red">버리기</button></div></div></div>`;
const log = `<div class="gx-wt-list">
<li class="gx-wt-row"><div class="gx-wt-main"><span class="gx-wt-memo"><b>부적 1장 사용</b><small>본문 · 「부적을 꺼내 문틈에 끼웠다」</small></span><span class="gx-wt-amt"><small>11-07</small></span></div></li>
<li class="gx-wt-row"><div class="gx-wt-main"><span class="gx-wt-memo"><b>생수 1병 사용</b><small>사용 단추</small></span><span class="gx-wt-amt"><small>11-06</small></span></div></li>
<li class="gx-wt-row"><div class="gx-wt-main"><span class="gx-wt-memo"><b>손수건 버림</b><small>직접</small></span><span class="gx-wt-amt"><small>11-06</small></span></div></li></div>`;
const body = (mode, vp) => `<div class="ph-subs gx-rec-tabs it-tabs" role="tablist"><button class="ph-sub">가계부</button><button class="ph-sub on">소지품</button></div><div class="gx-wallettab it-tab">

<div class="gx-rec-tools gx-wt-tools it-tools-row"><span class="it-cnt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1 12H6Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg><b>12</b><small>/ 16</small></span><span class="it-over">넘침 <b>1</b></span><div class="gx-segs gx-segs-sm"><button class="gx-seg${mode === 'log' ? '' : ' on'}">물건</button><button class="gx-seg${mode === 'log' ? ' on' : ''}">기록</button></div>${vp === 'pc' ? '<button class="it-act it-right"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>직접 넣기</button><button class="it-act"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/></svg>합치기</button>' : ''}<input class="gx-wt-q" type="search" placeholder="찾기: 물건·기록"></div>
${mode === 'log' ? log : grid}${mode === 'hover' ? tip : ''}${mode === 'pop' ? pop : ''}</div>`;
const css = `
.it-cnt{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px 0 10px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--sub);font-family:var(--mono)}.it-cnt svg{width:16px;height:16px;color:var(--signal)}.it-cnt b{font-size:15px;color:var(--text)}.it-cnt small{font-size:12px;color:var(--dim)}
.it-over{display:inline-flex;align-items:center;gap:4px;height:32px;padding:0 10px;margin-right:14px;border-radius:999px;border:1px solid color-mix(in srgb,#e5484d 55%,transparent);background:color-mix(in srgb,#e5484d 12%,transparent);color:#ff7b80;font-size:12px;font-weight:600;font-family:var(--mono)}.it-over b{font-size:14px}
.it-right{margin-left:auto}.it-act{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border:1px solid var(--line2);border-radius:10px;background:var(--panel);color:var(--text);font:600 13px/1 inherit;font-family:inherit}.it-act svg{width:16px;height:16px;color:var(--signal)}.it-act+.it-act{margin-right:12px}.it-tools-row .gx-wt-q{width:200px;flex:none}.it-cnt b{font-size:16px;color:var(--signal)}.it-cnt em{font-style:normal;font-size:12px;color:#e5484d;font-weight:600}
.it-tabs.gx-rec-tabs{grid-template-columns:repeat(2,1fr)}.it-tab{display:flex;flex-direction:column;flex:1;min-height:0;position:relative}
.it-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;align-content:start}
.it-c{position:relative;min-width:0;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--text);display:flex;flex-direction:column;align-items:stretch;gap:0;padding:6px 6px 5px;font:inherit}
.it-c .it-ic{color:var(--signal);width:100%;aspect-ratio:1;display:grid;place-items:center;border-radius:8px;background:color-mix(in srgb,var(--void) 60%,var(--panel))}.it-c .it-ic svg{width:56%;height:56%}.it-c b{font-size:12.5px;font-weight:600;text-align:center;line-height:1.2;padding-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.it-c.empty .it-ic{background:none}
.it-c.empty{background:none;border:1px dashed var(--line2)}.it-c.sel{border-color:var(--signal);box-shadow:0 0 0 1px var(--signal) inset}.it-c.over{border-color:var(--danger,#e5484d)}.it-c:hover{background:color-mix(in srgb,var(--signal) 6%,var(--panel))}
.it-tip{position:absolute;left:140px;top:60px;width:260px;background:var(--void);border:1px solid var(--line2);border-radius:12px;padding:10px 12px;box-shadow:0 14px 30px -12px rgba(0,0,0,.8);z-index:3}.it-tip b{display:block;font-size:14px}.it-tip small{color:var(--dim);font-size:11.5px}.it-tip p{margin:8px 0 0;font-size:12.5px;line-height:1.5;color:var(--sub)}.it-tip .ef{color:var(--text)}
.it-dim{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:50}.it-pop{width:min(360px,calc(100vw - 32px));background:var(--panel);border:1px solid var(--line2);border-radius:14px;padding:14px;box-shadow:0 24px 50px -20px rgba(0,0,0,.9)}
.it-ph{display:flex;gap:10px;align-items:center}.it-ph .it-ic{width:34px;height:34px;color:var(--signal)}.it-ph .it-ic svg{width:100%;height:100%}.it-ph b{display:block;font-size:15px}.it-ph small{color:var(--dim);font-size:11.5px}.it-x{margin-left:auto}
.it-pop p{margin:10px 0 0;font-size:13px;line-height:1.5;color:var(--sub)}.it-pop .ef{color:var(--text)}.it-btns{display:flex;gap:6px;margin-top:12px}.it-btns .gx-chip{flex:1;justify-content:center}.it-btns .red{color:#e5484d;border-color:#e5484d}
@media (max-width:760px){.it-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.it-tip{display:none}.it-over{margin-right:4px}.it-tools-row .gx-wt-q{width:auto;flex:1}}
.it-bottom{position:absolute;left:0;right:0;z-index:4}.it-tools,.it-drawer{height:52px;display:flex;gap:4px;padding:4px 8px;border-top:1px solid var(--line);background:var(--void)}
.it-drawer{position:absolute;left:0;right:0;bottom:0;background:var(--panel);border-top:1px solid var(--line2);box-shadow:0 -10px 20px -14px rgba(0,0,0,.6)}
.it-tb{flex:1;height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:0;background:none;color:var(--sub);font:600 11px/1 inherit;font-family:inherit}.it-tb svg{width:22px !important;height:22px !important;flex:none;display:block}
.it-grip{position:absolute !important;left:50% !important;bottom:-1px !important;top:auto !important;transform:translateX(-50%) !important;width:48px !important;min-width:0 !important;height:8px !important;min-height:0 !important;line-height:0;background:var(--void);border:1px solid var(--line);border-bottom:0;border-radius:5px 5px 0 0;display:flex;align-items:center;justify-content:center;padding:0;z-index:6}.it-grip i{width:18px;height:2px;border-radius:2px;background:var(--dim)}.it-grip.on i{background:var(--signal)}`;
const b = await launch(); const out = '/mnt/project-files/작업_1107/초안2_';
for (const vp of ['pc', 'phone']) {
  const { page } = await boot(b, fx, { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark' } }, vp);
  await openWin(page); await sleep(300); if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true); await sleep(200);
  await page.evaluate(() => document.querySelector('[data-action="tab"][data-value="records"]')?.click()); await sleep(300);
  await page.addStyleTag({ content: css });
  await page.evaluate(() => { for (const el of document.body.querySelectorAll('*')) { if (el.children.length === 0 && /ANOMALY SIMULATION/.test(el.textContent || '')) { let n = el; while (n && n !== document.body && getComputedStyle(n).position !== 'fixed') n = n.parentElement; if (n && n !== document.body) n.style.display = 'none'; } } });
  for (const mode of vp === 'pc' ? ['hover', 'pop', 'log'] : ['grid', 'pop', 'drawer']) {
    await page.evaluate(({ html, mode }) => { document.body.dataset.itDrawer = mode === 'drawer' ? '1' : '';
      const m = document.querySelector('main.gx-body'); m.innerHTML = html;
      const t = document.querySelector('.gx-title, .gx-head h1, .gx-brand b'); if (t) t.textContent = '소지품';
      const nb = document.querySelector('.gx-nb[data-value="records"]'); if (nb && !document.querySelector('.gx-nb[data-value="items"]')) { const c = nb.cloneNode(true); c.dataset.value = 'items'; c.querySelector('span').textContent = '소지품'; c.classList.add('on'); nb.classList.remove('on'); nb.before(c); }
      const mb = document.querySelector('.gx-x.gx-recbtn'); if (mb) mb.classList.add('on');
      if (window.innerWidth <= 760) {
        const brand = document.querySelector('.gx-brand b'); if (brand) brand.textContent = '소지품';
        document.querySelectorAll('.gx-head-act button').forEach(b => { const l = b.getAttribute('aria-label') || ''; if (/기록|설정/.test(l)) b.remove(); });
        const track = document.querySelector('.gx-mtrack');
        if (track && !track.querySelector('[data-value="items"]')) {
          const get = (v) => track.querySelector(`[data-value="${v}"]`);
          const mk = (v, label, svg) => { const b = get('map').cloneNode(true); b.dataset.value = v; b.querySelector('span').textContent = label; b.querySelector('svg').innerHTML = svg; return b; };
          const bag = '<path d="M5 8h14l-1 12H6Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>';
          const rec = '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 13.5h7M8.5 17h4"/>';
          const items = mk('items', '소지품', bag), recs = mk('records', '기록', rec);
          const order = [get('map'), recs, get('board'), get('phone'), items];
          get('wiki')?.remove(); get('gnet')?.remove();
          track.innerHTML = ''; order.forEach(b => { b.classList.toggle('on', b.dataset.value === 'items'); b.setAttribute('aria-current', b.dataset.value === 'items'); track.append(b); });
        }
        const mbar = document.querySelector('.gx-mbar');
        document.querySelector('.it-bottom')?.remove();
        const wrap = document.createElement('div'); wrap.className = 'it-bottom';
        const open = document.body.dataset.itDrawer === '1';
        wrap.innerHTML = `<div class="it-tools"><button class="it-tb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span>직접 넣기</span></button><button class="it-tb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/></svg><span>합치기</span></button></div>
          ${open ? `<div class="it-drawer"><button class="it-tb">${document.querySelector('.gx-head .gx-logo') ? '' : ''}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4Z"/><path d="M20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6Z"/></svg><span>위키</span></button><button class="it-tb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg><span>괴담넷</span></button><button class="it-tb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg><span>설정</span></button></div>` : ''}
          <button class="it-grip${open ? ' on' : ''}" aria-label="서랍"><i></i></button>`;
        const foot = mbar.parentElement; const panel = foot.parentElement; panel.style.position = 'relative'; wrap.style.bottom = foot.getBoundingClientRect().height + 'px'; panel.append(wrap); foot.querySelectorAll('.ph-grip').forEach(g => g.remove()); const main = document.querySelector('main.gx-body'); main.style.paddingBottom = '60px';
      }
    }, { html: body(mode === 'drawer' ? 'grid' : mode, vp), mode });
    await sleep(200);
    if (process.env.DBG && mode === 'drawer') console.log(await page.evaluate(() => { const g = document.querySelector('.it-grip'); const r = g.getBoundingClientRect(); const e = document.elementFromPoint(r.left + 24, r.top + 4); return JSON.stringify({ r: [r.left, r.top, r.width, r.height], top: e?.className, disp: getComputedStyle(g).display, vis: getComputedStyle(g).visibility, op: getComputedStyle(g).opacity, wrap: document.querySelector('.it-bottom').getBoundingClientRect().bottom, ov: getComputedStyle(document.querySelector('.it-bottom')).overflow }); }));
    await page.screenshot({ path: `${out}${vp}_${mode}.png` });
  }
  await page.close();
}
await b.close(); console.log('ok');
