// 장터 화면 초안 (11-07): 실제 플러그인을 띄운 뒤 채팅 본문 흉내(상태창은 플러그인 display 처리기가 그린 것) 아래 「장터 열기」 단추,
// 그리고 소지품 틀(it-*)을 그대로 쓴 장터 팝업을 끼워 넣어 찍는다. 그림은 PixelLab 소지품 2회 미리보기에서 잘라 둔 12장.
// 사용법: node docs/인계/장터_1107/mock.mjs  → /mnt/project-files/작업_1107/장터_초안/*.png
import { readFileSync } from 'node:fs';
import { boot, closeEditor, closeWin, launch, loadFixture, openWin, sleep } from '../../../tests/qc-settings-harness.mjs';
const fx = loadFixture(new URL('../../../.scratch/fixture/fixture.json', import.meta.url).pathname);
const PIC = process.env.PIC_DIR || '/tmp/claude-0/shopmock';
const pic = (n) => `data:image/png;base64,${readFileSync(`${PIC}/${n}.png`).toString('base64')}`;
const icons = Object.fromEntries([...readFileSync(new URL('../../../src/ui/icons.ts', import.meta.url), 'utf8').matchAll(/^  (\w+): stroke\('(.*)'\),$/gm)].map((m) => [m[1], m[2]]));
const ic = (k, w = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${icons[k]}</svg>`;
const won = (n) => `₩ ${n.toLocaleString('ko-KR')}`;
const wonc = (n) => `₩${n.toLocaleString('ko-KR')}`;
const BAL = 184000;
const SHOP = '을지로 철물점';
// 모델이 창작한 진열대 흉내: 이름·종류·값·재고·설명·효과. 그림은 이름으로 매칭된 것
const items = [
  ['flashlight', '손전등', '도구', 18000, 3, '건전지 넣는 묵직한 쇠 손전등. 주인이 「요즘 밤에 많이 찾는다」고 한다.', '어두운 곳에서 시야 확보'],
  ['charm', '부적', '부적', 30000, 1, '뒷방에서 꺼내 온 누런 종이 부적. 어디서 받았는지는 말하지 않는다.', '저급 괴이 접근 지연'],
  ['water', '생수', '식량', 1500, 10, '냉장고에 든 500ml 생수.', '갈증 해소'],
  ['sealbox', '봉인 상자', '괴이물', 120000, 1, '납땜한 철제 상자. 「안에 든 건 묻지 마라」.', '작은 괴이물 보관'],
  ['ring', '은반지', '귀중품', 85000, 1, '진열장 구석의 은반지. 안쪽에 글자가 새겨져 있다.', '—'],
  ['bag', '공구 가방', '착용', 42000, 2, '칸이 나뉜 튼튼한 공구 가방.', '소지품 칸 +2'],
  ['stake', '나무 말뚝', '무기', 9000, 6, '손잡이를 깎아 둔 참나무 말뚝.', '근접 공격'],
  ['pipe', '쇠파이프', '무기', 7000, 4, '절단해 둔 1m 쇠파이프.', '근접 공격'],
  ['taser', '전기충격기', '장비', 65000, 1, '허가증 없이 판다는 얘기는 하지 않는다.', '대상 기절 가능'],
  ['ext', '소화기', '도구', 38000, 2, '점검표가 붙은 분말 소화기.', '불 끄기'],
  ['spray', '호신 스프레이', '소모품', 15000, 5, '캡슐 하나짜리 호신 스프레이.', '대상 시야 방해'],
  ['sword', '낡은 검', '무기', 350000, 1, '벽에 걸려 있던 것. 주인은 값을 깎지 않는다.', '근접 공격 강화'],
];
const cell = (it, i, sel) => {
  const [p, name, kind, price, stock] = it;
  const poor = price > BAL;
  return `<button class="it-c sh-c${i === sel ? ' sel' : ''}${poor ? ' poor' : ''}"><span class="it-ic"><img src="${pic(p)}" alt=""></span><b>${name}</b><em class="sh-price">${wonc(price)}</em>${tip(it)}</button>`;
};
const tip = ([, name, kind, price, stock, desc, ef]) => `<div class="it-tip"><b>${name}</b><small>${kind} · 재고 ${stock}</small><em class="sh-price sh-price-ln">${won(price)}</em><p>${desc}</p><p class="ef">효과: ${ef}</p></div>`;
const grid = (sel = -1) => `<div class="it-grid sh-grid">${items.map((it, i) => cell(it, i, sel)).join('')}</div>`;
const loading = `<div class="sh-wait"><span class="sh-spin"></span>진열대를 살피는 중…</div>`;
const tools = (vp, req) => `<div class="gx-rec-tools it-tools sh-tools">
  <span class="sh-name">${ic('bag')}<b>${SHOP}</b></span><span class="it-cnt sh-bal"><b>${won(BAL)}</b></span>
  <span class="it-right"><button class="it-act${req ? ' on' : ''}">${ic('search')}물품 요청</button><button class="it-act">${ic('refresh')}새로고침</button>${vp === 'pc' ? `<button class="it-act sh-x" aria-label="닫기">${ic('close')}</button>` : ''}</span></div>
  ${req ? `<div class="sh-req"><input class="gx-wt-q" type="text" value="밤에 쓸 조명 도구하고 소금 같은 거" placeholder="원하는 물건을 적으세요 — 가게 주인이 찾아 봅니다"><button class="it-act on">${ic('search')}찾아 달라기</button></div>` : ''}`;
const detail = (it, phone) => {
  const [p, name, kind, price, stock, desc, ef] = it;
  const poor = price > BAL;
  const money = `<div class="sh-money"><div><i>값</i><em>${won(price)}</em></div><div><i>지금 잔고</i><em>${won(BAL)}</em></div><div class="${poor ? 'bad' : 'ok'}"><i>${poor ? '부족' : '산 뒤 잔고'}</i><em>${poor ? '−' : ''}${won(Math.abs(BAL - price))}</em></div></div>`;
  return `<div class="gx-agpop it-pop sh-det"><div class="gx-agpop-card it-card"><button class="gx-agpop-x">✕</button>
  <div class="it-ph sh-ph"><span class="it-ic"><img src="${pic(p)}" alt=""></span><div class="sh-phtx"><b>${name}</b><small><span class="sh-kind">${kind}</span> 재고 ${stock}</small><em class="sh-price sh-price-ln sh-price-big">${won(price)}</em></div></div>
  <p>${desc}</p><p class="ef">효과: ${ef}</p>${money}
  <div class="it-btns"><button class="gx-chip on"${poor ? ' disabled' : ''}>사기</button><button class="gx-chip">자세히</button></div></div></div>`;
};
const popup = (vp, mode) => {
  const body = mode === 'loading' ? loading : grid(mode === 'detail' || mode === 'poor' ? (mode === 'poor' ? 11 : 0) : mode === 'hover' ? -1 : -1);
  return `<div class="gx sh-wrap"><div class="gx-agpop-card it-card sh-card">${vp === 'phone' ? `<button class="gx-agpop-x">✕</button>` : ''}${tools(vp, mode === 'request')}<div class="it-body sh-body">${body}</div>${vp === 'phone' ? `<button class="it-act sh-close">${ic('close')}닫기</button>` : ''}</div>
  ${mode === 'detail' ? detail(items[0]) : mode === 'poor' ? detail(items[11]) : ''}</div>`;
};
// 채팅 본문 흉내 (Risu 기본 어두운 화면). 상태창은 플러그인 display 처리기 결과를 그대로 넣는다
const CHAR_TEXT = `철문을 밀자 기름 냄새와 쇠 냄새가 한꺼번에 밀려왔다. 천장까지 쌓인 선반 사이로 주인이 고개만 내밀었다. 「뭐 찾소.」 묻는 말이 아니라 그냥 던지는 소리였다. 카운터 뒤 라디오에서 저녁 뉴스가 작게 흘렀다.\n\n[▣|2025.01.12|07:40 PM|☁️|2°C|을지로 철물점|실종자 수색]`;
const chatCard = (p) => `<div data-goei-card="shop" style="display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid ${p.accentLine};border-radius:10px;background:${p.accentBg};color:${p.sub};font-size:.92em;line-height:1.5;flex-wrap:wrap;margin-top:14px">
  <span style="flex:1 1 14em;color:${p.text}"><b style="color:${p.signal}">${SHOP}</b> · 여기서 물건을 살 수 있다.</span>
  <button type="button" style="flex:none;padding:3px 12px;border:1px solid ${p.accentLine};border-radius:999px;background:transparent;color:${p.text};font:inherit;font-size:.92em;cursor:pointer">장터 열기</button></div>`;
const css = `
.sh-chat{position:fixed;inset:0;overflow:auto;background:#1b1d22;color:#e6e6e6;font:15px/1.75 'Noto Sans KR',system-ui,sans-serif;padding:24px 0 120px}
.sh-msg{max-width:760px;margin:0 auto;padding:0 20px;display:flex;gap:14px}.sh-ava{flex:none;width:40px;height:40px;border-radius:50%;background:#3a4650}.sh-txt{flex:1;min-width:0}
.sh-user{opacity:.8;margin-bottom:22px}.sh-user .sh-ava{background:#4a4a55}
.sh-input{position:fixed;left:0;right:0;bottom:0;padding:14px 20px 22px;background:linear-gradient(transparent,#1b1d22 30%)}.sh-input div{max-width:760px;margin:0 auto;height:48px;border-radius:14px;background:#2a2d34;border:1px solid #3a3f48}
.sh-wrap{background:var(--scrim)}
.sh-card{width:min(100%,760px);align-items:stretch;gap:12px;padding:16px;max-height:calc(100% - 8px)}
.sh-tools{gap:8px}.sh-name{display:inline-flex;align-items:center;gap:8px;height:34px;color:var(--text);font-size:16px;font-weight:700;white-space:nowrap}.sh-name svg{width:18px;height:18px;color:var(--signal)}
.sh-bal b{font-size:14px;color:var(--text)}
.sh-x{width:34px;padding:0;justify-content:center}.sh-x svg{color:var(--sub)}
.it-act.on{border-color:var(--signal);color:var(--signal)}
.sh-req{display:flex;gap:8px}.sh-req .gx-wt-q{flex:1;max-width:none;margin:0;height:36px}
.sh-c b{font-size:13.5px}.sh-c small{display:block;font-size:13px;color:var(--sub);font-family:var(--mono);line-height:1.2;padding-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sh-grid .it-tip small{font-size:13px;color:var(--sub)}.sh-grid .it-tip b{font-size:15px}.sh-grid .it-tip p{font-size:13.5px}.sh-det .it-ph{padding-right:40px}.sh-det .it-ph b{font-size:16px}.sh-det .it-ph small{font-size:13.5px;color:var(--sub)}.sh-det .it-card p{font-size:14px}
.sh-price{display:block;margin:6px -6px -5px;padding:7px 4px;border-top:1px solid var(--accent-line);border-radius:0 0 11px 11px;background:var(--accent-bg);color:var(--signal);font:700 14px/1 var(--mono);font-style:normal;text-align:center;white-space:nowrap;letter-spacing:-.01em}.sh-c.poor .sh-price{background:color-mix(in srgb,var(--danger,#e5484d) 14%,transparent);border-top-color:color-mix(in srgb,var(--danger,#e5484d) 50%,transparent);color:#ff7b80}.sh-price-ln{display:inline-block;margin:8px 0 0;padding:5px 10px;border:1px solid var(--accent-line);border-radius:8px;font-size:15px}.sh-price-h{margin:0 0 0 auto;align-self:center}.sh-poor{font-size:13.5px !important}
.sh-grid .it-tip{display:none}.sh-grid .it-c.tipon .it-tip{display:block}
.sh-wait{display:flex;align-items:center;justify-content:center;gap:10px;min-height:260px;color:var(--sub);font-size:14px}
.sh-spin{width:16px;height:16px;border-radius:50%;border:2px solid var(--line2);border-top-color:var(--signal)}
.sh-det .it-card{width:min(420px,calc(100vw - 28px))}.sh-ph{align-items:center;gap:14px}.sh-ph .it-ic{width:96px;height:96px;border-radius:14px}.sh-ph .it-ic img{width:84%;height:84%;object-fit:contain;image-rendering:pixelated}.sh-ph b{font-size:19px;line-height:1.2}.sh-phtx{display:flex;flex-direction:column;gap:4px;min-width:0}.sh-kind{display:inline-block;padding:2px 8px;margin-right:6px;border:1px solid var(--line2);border-radius:6px;font-size:12.5px;color:var(--text)}.sh-price-big{align-self:flex-start;margin-top:4px;font-size:18px;padding:6px 12px}.sh-ph small{font-size:13.5px;color:var(--sub)}.sh-money{display:flex;flex-direction:column;gap:0;margin-top:14px;border:1px solid var(--line);border-radius:12px;background:var(--void);overflow:hidden}.sh-money>div{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-top:1px solid var(--line)}.sh-money>div:first-child{border-top:0}.sh-money i{font-style:normal;font-size:13.5px;color:var(--sub)}.sh-money em{font:700 16px/1 var(--mono);font-style:normal;color:var(--text)}.sh-money .ok{background:var(--accent-bg)}.sh-money .ok em{color:var(--signal)}.sh-money .bad{background:color-mix(in srgb,var(--danger,#e5484d) 14%,transparent)}.sh-money .bad i,.sh-money .bad em{color:#ff7b80}.sh-poor{color:var(--danger,#e5484d) !important}
.it-btns .gx-chip:disabled{opacity:.45}
@media (max-width:760px){.sh-ph .it-ic{width:110px;height:110px}.sh-wrap{align-items:flex-start;padding:14px 14px 96px}.sh-card{width:100%;padding:12px;padding-top:14px;max-height:calc(100% - 0px)}.sh-close{width:100%;justify-content:center;height:44px;margin-top:4px;flex:none}.sh-close svg{color:var(--sub)}.sh-tools{flex-wrap:wrap}.sh-name{flex:1 1 100%;padding-right:36px}.it-right{margin-left:0;flex:1}.it-right .it-act{flex:1;justify-content:center}.sh-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.sh-req{flex-wrap:wrap}.sh-req .it-act{width:100%;justify-content:center}.sh-card .gx-agpop-x{top:8px;right:8px}}`;
const b = await launch(); const out = '/mnt/project-files/작업_1107/장터_초안/';
for (const vp of ['pc', 'phone']) {
  const { page } = await boot(b, fx, { message: [{ role: 'user', data: '철물점 문을 열고 들어간다.' }, { role: 'char', data: CHAR_TEXT }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark' } }, vp);
  await openWin(page); await sleep(300); if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true); await sleep(200);
  await page.addStyleTag({ content: css });
  const statusHtml = await page.evaluate((t) => window.__calls.handlers.display(t), CHAR_TEXT);
  const palette = await page.evaluate(() => { const g = document.querySelector('.gx'); const cs = getComputedStyle(g); const v = (k) => cs.getPropertyValue(k).trim(); return { text: v('--text'), sub: v('--sub'), signal: v('--signal'), accentBg: v('--accent-bg'), accentLine: v('--accent-line') }; });
  await closeWin(page); await sleep(200);
  await page.evaluate(() => { for (const el of document.body.querySelectorAll('*')) { if (el.children.length === 0 && /ANOMALY SIMULATION/.test(el.textContent || '')) { let n = el; while (n && n !== document.body && getComputedStyle(n).position !== 'fixed') n = n.parentElement; if (n && n !== document.body) n.style.display = 'none'; } } });
  const chat = `<div class="sh-chat"><div class="sh-msg sh-user"><div class="sh-ava"></div><div class="sh-txt">철물점 문을 열고 들어간다.</div></div><div class="sh-msg chat-message-container"><div class="sh-ava"></div><div class="sh-txt risu-chat">${statusHtml.replace(/\n/g, '<br>')}${chatCard(palette)}</div></div><div class="sh-input"><div></div></div></div>`;
  const modes = vp === 'pc' ? ['chat', 'grid', 'hover', 'detail', 'poor', 'request', 'loading'] : ['chat', 'grid', 'detail', 'request'];
  for (const mode of modes) {
    await page.evaluate(({ chat, pop }) => {
      document.querySelectorAll('.gx').forEach((g) => { if (!g.classList.contains('sh-wrap')) g.style.display = 'none'; });
      document.querySelector('.sh-chat')?.remove(); document.querySelector('.sh-wrap')?.remove();
      document.body.insertAdjacentHTML('beforeend', chat);
      if (pop) document.body.insertAdjacentHTML('beforeend', pop);
    }, { chat, pop: mode === 'chat' ? '' : popup(vp, mode) });
    if (mode === 'hover') await page.evaluate(() => { const c = document.querySelectorAll('.sh-c')[1]; c.classList.add('sel', 'tipon'); });
    await sleep(250);
    await page.screenshot({ path: `${out}${vp}_${mode}.png` });
  }
  await page.close();
}
await b.close(); console.log('ok');
