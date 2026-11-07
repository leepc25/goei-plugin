// 상점 화면 초안 (11-07): 실제 플러그인을 띄운 뒤 채팅 본문 흉내(상태창은 플러그인 display 처리기가 그린 것) 아래 「상점 열기」 단추,
// 그리고 소지품 틀(it-*)을 그대로 쓴 상점 팝업을 끼워 넣어 찍는다. 그림은 PixelLab 소지품 2회 미리보기에서 잘라 둔 12장.
// 사용법: node docs/인계/상점_1107/mock.mjs  → /mnt/project-files/작업_1107/상점_초안/*.png
import { readFileSync } from 'node:fs';
import { boot, closeEditor, closeWin, launch, loadFixture, openWin, sleep } from '../../../tests/qc-settings-harness.mjs';
const fx = loadFixture(new URL('../../../.scratch/fixture/fixture.json', import.meta.url).pathname);
const PIC = process.env.PIC_DIR || '/tmp/claude-0/shopmock';
const pic = (n) => `data:image/png;base64,${readFileSync(`${PIC}/${n}.png`).toString('base64')}`;
const icons = Object.fromEntries([...readFileSync(new URL('../../../src/ui/icons.ts', import.meta.url), 'utf8').matchAll(/^  (\w+): stroke\('(.*)'\),$/gm)].map((m) => [m[1], m[2]]));
const ic = (k, w = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${icons[k]}</svg>`;
const won = (n) => `₩ ${n.toLocaleString('ko-KR')}`;
const wonc = (n) => `₩${n.toLocaleString('ko-KR')}`;
// 칸용 짧은 표기: 「12만 원」「8만 5천 원」「1,500원」 (가계부 parseWon이 읽는 꼴)
const wonShort = (n) => { if (n < 10000) return `${n.toLocaleString('ko-KR')}원`; const man = Math.floor(n / 10000), chon = Math.round((n % 10000) / 1000); return `${man.toLocaleString('ko-KR')}만${chon ? ` ${chon}천` : ''} 원`; };
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
  ['spray', '호신용 최루 스프레이 (대용량)', '소모품', 15000, 5, '캡슐 하나짜리 호신 스프레이.', '대상 시야 방해'],
  ['sword', '낡은 검', '무기', 1538000, 1, '벽에 걸려 있던 것. 주인은 값을 깎지 않는다.', '근접 공격 강화'],
];
// ── 규격(기존 소지품·기록 틀 그대로): 조작 34px(폰 40)·모서리 조작 10/칸 12/안쪽 8 · 글 13.5/1.5·메타 12.5·제목 16 · 금액 mono 700 14(상세 머리만 16) · 색은 테마 변수만
const amt = (n, cls = '') => `<em class="sh-amt${cls ? ' ' + cls : ''}">${won(n)}</em>`;
const cell = (it, i, sel) => {
  const [p, name, , price] = it;
  const poor = price > BAL;
  return `<button class="it-c sh-c${i === sel ? ' sel' : ''}${poor ? ' poor' : ''}"><span class="it-ic"><img src="${pic(p)}" alt=""></span><b>${name}</b><span class="sh-band">${price.toLocaleString('ko-KR')}</span>${tip(it)}</button>`;
};
const meta = (kind, stock) => `<small class="sh-meta"><span class="sh-tag">${kind}</span>재고 ${stock}</small>`;
const tip = ([, name, kind, price, stock, desc, ef]) => `<div class="it-tip"><b>${name}</b>${meta(kind, stock)}${amt(price)}<p>${desc}</p><p class="ef">효과: ${ef}</p></div>`;
const grid = (sel = -1) => `<div class="it-grid sh-grid">${items.map((it, i) => cell(it, i, sel)).join('')}</div>`;
const loading = `<div class="sh-wait"><span class="sh-spin"></span>진열대를 살피는 중…</div>`;
const tools = (vp, req) => `<div class="gx-rec-tools it-tools sh-tools">
  <span class="sh-name">${ic('bag')}<b>${SHOP}</b></span><span class="it-cnt sh-bal">${amt(BAL)}</span>
  <span class="it-right"><span class="sh-q"><input class="gx-wt-q" type="text" value="${req ? '밤에 쓸 조명 도구하고 소금 같은 거' : ''}" placeholder="원하는 물건 적고 Enter"><button class="sh-go" aria-label="요청">↵</button></span><button class="it-act">${ic('refresh')}새로고침</button>${vp === 'pc' ? `<button class="it-act sh-x" aria-label="닫기">${ic('close')}</button>` : ''}</span></div>`;
const detail = (it) => {
  const [p, name, kind, price, stock, desc, ef] = it;
  const poor = price > BAL;
  const money = `<div class="sh-money"><div><i>값</i>${amt(price)}</div><div><i>지금 잔고</i>${amt(BAL)}</div><div class="${poor ? 'bad' : 'ok'}"><i>${poor ? '부족' : '산 뒤 잔고'}</i>${amt(Math.abs(BAL - price)).replace('₩', poor ? '−₩' : '₩')}</div></div>`;
  return `<div class="gx-agpop it-pop sh-det"><div class="gx-agpop-card it-card"><button class="gx-agpop-x">✕</button>
  <div class="it-ph sh-ph"><span class="it-ic"><img src="${pic(p)}" alt=""></span><div class="sh-phtx"><b>${name}</b>${meta(kind, stock)}${amt(price, 'big')}</div></div>
  <p>${desc}</p><p class="ef">효과: ${ef}</p>${money}
  <div class="it-btns"><button class="gx-chip on"${poor ? ' disabled' : ''}>구입</button><button class="gx-chip">자세히</button></div></div></div>`;
};
const popup = (vp, mode) => {
  const body = mode === 'loading' ? loading : grid(mode === 'detail' ? 0 : mode === 'poor' ? 11 : -1);
  return `<div class="gx sh-wrap"><div class="gx-agpop-card it-card sh-card">${tools(vp, mode === 'request')}<div class="it-body sh-body">${body}</div>${vp === 'phone' ? `<button class="it-act sh-close">${ic('close')}닫기</button>` : ''}</div>
  ${mode === 'detail' ? detail(items[0]) : mode === 'poor' ? detail(items[11]) : ''}</div>`;
};
// 채팅 본문 흉내 (Risu 기본 어두운 화면). 상태창은 플러그인 display 처리기 결과를 그대로 넣는다
const CHAR_TEXT = `철문을 밀자 기름 냄새와 쇠 냄새가 한꺼번에 밀려왔다. 천장까지 쌓인 선반 사이로 주인이 고개만 내밀었다. 「뭐 찾소.」 묻는 말이 아니라 그냥 던지는 소리였다. 카운터 뒤 라디오에서 저녁 뉴스가 작게 흘렀다.\n\n[▣|2025.01.12|07:40 PM|☁️|2°C|을지로 철물점|실종자 수색]`;
// 상태창(.gst)과 같은 폭·정렬: width fit-content, min-width min(100%,420px), margin auto, 모서리 14, 안 여백 16
const chatCard = (p) => `<div data-goei-card="shop" style="box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;width:fit-content;min-width:min(100%,420px);max-width:100%;margin:10px auto 0;padding:10px 16px;border:1px solid ${p.accentLine};border-radius:14px;background:${p.accentBg};color:${p.text};font-size:14px;line-height:1.5">
  <span><b style="color:${p.signal}">${SHOP}</b></span>
  <button type="button" style="flex:none;height:32px;padding:0 14px;border:1px solid ${p.accentLine};border-radius:10px;background:transparent;color:${p.text};font:inherit;font-size:13.5px;font-weight:600;cursor:pointer">상점 열기</button></div>`;
const css = `
.sh-chat{position:fixed;inset:0;overflow:auto;background:#1b1d22;color:#e6e6e6;font:15px/1.75 'Noto Sans KR',system-ui,sans-serif;padding:24px 0 120px}
.sh-msg{max-width:760px;margin:0 auto;padding:0 20px;display:flex;gap:14px}.sh-ava{flex:none;width:40px;height:40px;border-radius:50%;background:#3a4650}.sh-txt{flex:1;min-width:0}
.sh-user{opacity:.8;margin-bottom:22px}.sh-user .sh-ava{background:#4a4a55}
.sh-input{position:fixed;left:0;right:0;bottom:0;padding:14px 20px 22px;background:linear-gradient(transparent,#1b1d22 30%)}.sh-input div{max-width:760px;margin:0 auto;height:48px;border-radius:14px;background:#2a2d34;border:1px solid #3a3f48}
.sh-wrap{background:var(--scrim);--h:34px;--r:10px;--rc:12px;--ri:8px;--red:color-mix(in srgb,var(--danger) 80%,#fff);--red-bg:color-mix(in srgb,var(--danger) 12%,transparent);--red-ln:color-mix(in srgb,var(--danger) 55%,transparent)}
.sh-wrap *{box-sizing:border-box}
/* 금액: 어디서나 같은 글꼴·굵기·크기 */
.sh-amt{font:700 14px/1 var(--mono);font-style:normal;color:var(--text);white-space:nowrap;font-variant-numeric:tabular-nums}.sh-amt.big{font-size:16px;color:var(--signal)}
/* 메타(종류 표 + 재고): 어디서나 12.5 sub */
.sh-meta{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--sub);line-height:1.4}.sh-tag{display:inline-block;padding:2px 8px;border:1px solid var(--line);border-radius:var(--ri);color:var(--text);line-height:1.4}
/* 팝업 본체 */
.sh-card{width:min(100%,760px);align-items:stretch;gap:12px;padding:16px;max-height:calc(100% - 8px)}
/* 도구 줄: 모든 조작 34px·모서리 10 */
.sh-tools{gap:8px}.sh-tools .it-act,.sh-tools .it-cnt,.sh-tools .gx-wt-q{height:var(--h);border-radius:var(--r);border:1px solid var(--line);background:var(--panel2);font-size:13.5px}
.sh-name{display:inline-flex;align-items:center;gap:8px;height:var(--h);padding:0 4px;color:var(--text);font-size:16px;font-weight:700;white-space:nowrap}.sh-name svg{width:18px;height:18px;color:var(--signal)}
.sh-bal{padding:0 12px;color:var(--text)}
.sh-x{width:var(--h);padding:0;justify-content:center}.sh-x svg{color:var(--sub)}
.sh-q{position:relative;display:inline-flex;width:300px}.sh-q .gx-wt-q{width:100%;max-width:none;margin:0;padding:0 38px 0 12px}.sh-go{position:absolute;right:4px;top:4px;width:calc(var(--h) - 8px);height:calc(var(--h) - 8px);border:0;border-radius:var(--ri);background:var(--accent-bg);color:var(--signal);font:700 14px/1 inherit;cursor:pointer}
/* 칸: 그림 → 이름 13 → 값 띠(칸 아랫부분을 그대로 씀) */
.sh-c b{font-size:13.5px;padding-top:7px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sh-band{display:block;padding:3px 0 5px;color:var(--signal);font:600 12.5px/1.2 var(--mono);text-align:center;white-space:nowrap;font-variant-numeric:tabular-nums}
.sh-c.poor .sh-band{color:var(--red)}
/* 말풍선: 제목 14 · 메타 12.5 · 금액 14 · 글 13/1.5 */
.sh-grid .it-tip{display:none;width:260px;padding:12px}.sh-grid .it-c.tipon .it-tip{display:block}.sh-grid .it-tip b{font-size:14px;margin-bottom:6px}.sh-grid .it-tip .sh-amt{display:inline-block;margin-top:8px}.sh-grid .it-tip p{font-size:13px;line-height:1.5;margin-top:8px}
/* 불러오는 중 */
.sh-wait{display:flex;align-items:center;justify-content:center;gap:10px;min-height:260px;color:var(--sub);font-size:13.5px}.sh-spin{width:16px;height:16px;border-radius:50%;border:2px solid var(--line2);border-top-color:var(--signal)}
/* 상세: 그림 88 → 이름 16·메타·금액 16 / 글 13.5 / 돈 표 / 단추 */
.sh-det .it-card{width:min(420px,calc(100vw - 28px))}.sh-ph{align-items:center;gap:14px;padding-right:36px}.sh-ph .it-ic{width:88px;height:88px;border-radius:var(--rc)}.sh-ph .it-ic img{width:84%;height:84%;object-fit:contain;image-rendering:pixelated}
.sh-phtx{display:flex;flex-direction:column;gap:6px;min-width:0}.sh-phtx b{font-size:16px;line-height:1.3}
.sh-det .it-card p{font-size:13.5px;line-height:1.5;margin-top:12px}.sh-det .it-card p.ef{margin-top:6px}
.sh-money{margin-top:12px;border:1px solid var(--line);border-radius:var(--rc);background:var(--void);overflow:hidden}.sh-money>div{display:flex;justify-content:space-between;align-items:center;height:36px;padding:0 12px;border-top:1px solid var(--line)}.sh-money>div:first-child{border-top:0}.sh-money i{font-style:normal;font-size:13.5px;color:var(--sub)}
.sh-money .ok{background:var(--accent-bg)}.sh-money .ok .sh-amt{color:var(--signal)}.sh-money .bad{background:var(--red-bg)}.sh-money .bad i,.sh-money .bad .sh-amt{color:var(--red)}
.sh-det .it-btns{margin-top:12px}.sh-det .it-btns .gx-chip{height:var(--h);border-radius:var(--r);font-size:13.5px}.it-btns .gx-chip:disabled{opacity:.45}
.sh-det .gx-agpop-x,.sh-card .gx-agpop-x{width:30px;height:30px;border-radius:var(--ri)}
/* 폰: 조작 40 · 4열 · 도구 줄은 [잔고 … 새로고침] 다음 줄 글칸 · 맨 아래 닫기 */
@media (max-width:760px){.sh-wrap{--h:40px;align-items:stretch;padding:0}.sh-card{width:100%;height:100%;max-height:none;border:0;border-radius:0;padding:12px}.sh-tools{flex-wrap:wrap}.sh-name{flex:1 1 100%}
.it-right{display:contents}.sh-bal{order:1}.it-right .it-act{order:2;margin-left:auto;flex:none}.sh-q{order:3;width:100%;flex:1 1 100%}.sh-go{top:4px}
.sh-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.sh-ph .it-ic{width:96px;height:96px}
.sh-card{display:flex;flex-direction:column;max-height:100%;overflow:hidden}.sh-body{flex:1 1 auto;min-height:0;overflow-y:auto;margin:0 -2px;padding:0 2px}.sh-close{width:100%;height:var(--h);justify-content:center;border-radius:var(--r);font-size:13.5px;flex:none}.sh-close svg{color:var(--sub)}.sh-card .gx-agpop-x{top:8px;right:8px}}`;
const b = await launch(); const out = '/mnt/project-files/작업_1107/상점_초안/';
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
