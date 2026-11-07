import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
import fs from 'node:fs';
const src = fs.readFileSync('src/ui/itemIcons.ts', 'utf8');
const icons = Object.fromEntries([...src.matchAll(/^  (\w+): stroke\('(.*)'\),$/gm)].map(m => [m[1], m[2]]));
const ic = (k, s = 30) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[k]}</svg>`;
const nav = (k) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${{
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
  records: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
  board: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  phone: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  bag: '<path d="M5 8h14l-1 12H6Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  wiki: '<path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4Z"/><path d="M20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6Z"/>',
  gnet: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>', plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4-4"/>',
  idcard: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><circle cx="12" cy="10" r="2.6"/><path d="M8.5 16.5c.7-1.7 2-2.5 3.5-2.5s2.8.8 3.5 2.5"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>',
}[k]}</svg>`;
const items = [
  ['consumable', '소금 봉지', 2], ['tool', '손전등', 1], ['charm', '부적', 3], ['key', '낡은 열쇠', 1],
  ['device', '녹음기', 1], ['wear', '방검 조끼', 1], ['paper', '사건 파일', 1], ['medical', '진통제', 4],
  ['food', '생수', 2], ['anomaly', '검은 구슬', 1], ['valuable', '현금 봉투', 1], ['weapon', '접이식 칼', 1],
];
const cell = ([k, n], i, extra = '') => `<div class="c${extra}${i === 0 ? ' sel' : ''}"><span class="ci">${ic(k)}</span><b>${n}</b></div>`;
const grid = (over) => `<div class="grid">${items.map((it, i) => cell(it, i)).join('')}${'<div class="c empty"></div>'.repeat(4)}</div>` +
  (over ? `<div class="overh">넘침 — 본편이 이번 턴에 처리해요</div><div class="grid">${cell(['seal', '봉인 상자', 1], 9, ' over')}</div>` : '');
const detail = `<section class="det"><div class="dh">${ic('consumable', 26)}<div><b>소금 봉지</b><small>소모품 · 장터 · 11-07 ₩ 6,000</small></div></div>
<p>관리국 지급품, 두 봉지 남음. 문턱이나 창틀에 뿌려 두면 하룻밤은 버틴다.</p><p class="ef">효과: 저급 괴이의 접근을 늦춘다</p>
<div class="btns"><button class="pri">사용</button><button>고치기</button><button>합치기</button><button class="danger">버리기</button></div></section>`;
const tabs = `<div class="subs"><button>가계부</button><button class="on">소지품</button></div>`;
const head = `<div class="hd"><div class="t">12 / 16</div><div class="s">${nav('search')}<span>물건·기록 찾기</span></div></div>`;
const foot = `<div class="foot"><button class="add">${nav('plus')} 직접 넣기</button><details><summary>사용·처분 기록 (3)</summary><div class="log">11-07 부적 1장 사용 (본문) · 11-06 생수 1병 사용 (사용 단추) · 11-06 손수건 버림</div></details></div>`;
const css = `
:root{--void:#1A2226;--panel:#232D32;--panel2:#2C383E;--line:#3A4A50;--line2:#46565D;--text:#E9F0EE;--sub:#BECBC8;--dim:#8A9A97;--signal:#5EEAD4;--accent-bg:rgba(94,234,212,.12);--danger:#e5484d}
*{box-sizing:border-box}body{margin:0;background:#0d1114;color:var(--text);font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif;font-size:14px}
.win{background:var(--void);display:grid;overflow:hidden;border:1px solid var(--line)}
.gxhead{height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid var(--line)}
.gxhead b{font-size:15px}.gxhead .act{display:flex;gap:8px;align-items:center}.gxhead .act .x{width:34px;height:34px;display:grid;place-items:center;color:var(--sub);border:0;background:none}
.won{font-weight:700;font-size:13px;color:var(--signal);background:var(--accent-bg);border-radius:9px;padding:4px 10px}
.subs{display:flex;gap:6px;padding:10px 14px 0}.subs button{flex:1;height:34px;border-radius:10px;border:1px solid var(--line2);background:none;color:var(--sub);font-weight:600}.subs .on{background:var(--accent-bg);color:var(--signal);border-color:transparent}
.hd{display:flex;justify-content:space-between;align-items:center;padding:12px 14px 8px}.hd .t{font-weight:700;font-size:16px}.hd .s{display:flex;gap:6px;align-items:center;color:var(--dim);font-size:12px;border:1px solid var(--line2);border-radius:9px;padding:5px 10px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0 14px}
.c{position:relative;aspect-ratio:1;background:var(--panel);border:1px solid var(--line);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:6px}
.c .ci{color:var(--signal)}.c b{font-size:11.5px;font-weight:600;text-align:center;line-height:1.2}.c.empty{background:none;border:1px dashed var(--line2)}
.c .q{position:absolute;right:6px;top:6px;font-style:normal;font-size:10.5px;font-weight:700;background:var(--line2);border-radius:7px;padding:1px 5px}
.c.sel{border-color:var(--signal);box-shadow:0 0 0 1px var(--signal) inset}.c.over{border-color:var(--danger)}
.overh{color:var(--danger);font-size:12px;padding:12px 14px 6px;font-weight:600}
.det{margin:12px 14px 0;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px}.det .dh{display:flex;gap:10px;align-items:center;color:var(--signal)}.det .dh b{color:var(--text);font-size:15px;display:block}.det .dh small{color:var(--dim);font-size:11.5px}
.det p{margin:10px 0 0;color:var(--sub);font-size:13px;line-height:1.5}.det .ef{color:var(--text)}.btns{display:flex;gap:6px;margin-top:12px}.btns button{flex:1;height:36px;border-radius:9px;border:1px solid var(--line2);background:none;color:var(--sub);font-weight:600;font-size:13px}.btns .pri{background:var(--signal);color:#0d1b19;border-color:transparent}.btns .danger{color:var(--danger)}
.foot{padding:12px 14px}.add{width:100%;height:40px;border-radius:10px;border:1px dashed var(--line2);background:none;color:var(--sub);font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px}details{margin-top:10px;color:var(--dim);font-size:12.5px}summary{cursor:pointer}.log{padding:8px 0 0;line-height:1.6}
/* phone bottom */
.tools{height:52px;display:flex;align-items:center;gap:4px;padding:4px 8px;border-top:1px solid var(--line);background:var(--void)}.tools .tb{flex:1;height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--sub);font-size:11px;font-weight:600;border-radius:12px}.tools .menu{flex:0 0 44px;color:var(--text)}.tools .menu.on{background:var(--accent-bg);color:var(--signal)}
.common{height:52px;display:flex;gap:4px;padding:4px 8px;border-top:1px solid var(--line2);background:var(--panel);box-shadow:0 -10px 20px -14px rgba(0,0,0,.6)}.common .tb{flex:1;height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--sub);font-size:11px;font-weight:600}
.bottom{position:relative}.grip{position:absolute;left:50%;top:-11px;transform:translateX(-50%);width:60px;height:22px;background:none;border:0;display:flex;align-items:center;justify-content:center;z-index:2}.grip i{width:28px;height:4px;border-radius:4px;background:var(--sub)}.grip.on i{background:var(--signal)}
.stack{position:relative}.drawer{position:absolute;left:0;right:0;bottom:0;height:52px;display:flex;gap:4px;padding:4px 8px;background:var(--panel);border-top:1px solid var(--line2);box-shadow:0 -10px 20px -14px rgba(0,0,0,.6)}.drawer .tb{flex:1;height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--sub);font-size:11px;font-weight:600}
.win{position:relative}.dim{position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:5}.pop{position:relative;width:330px}.pop .det{margin:0;box-shadow:0 20px 40px -20px rgba(0,0,0,.8)}.pclose{position:absolute;right:8px;top:8px;width:30px;height:30px;border:0;background:none;color:var(--dim)}
.bar{height:60px;display:flex;border-top:1px solid var(--line);background:var(--void)}.bar .nb{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--dim);font-size:11px;font-weight:600}.bar .nb.on{color:var(--signal)}
.usebox{margin:0 14px 8px;background:var(--panel);border:1px solid var(--signal);border-radius:12px;padding:8px 10px;display:flex;align-items:center;gap:8px;font-size:12.5px}.usebox .chip{background:var(--accent-bg);color:var(--signal);border-radius:8px;padding:3px 8px;font-weight:600}.usebox .x{margin-left:auto;color:var(--dim)}
.input{margin:0 14px 10px;height:44px;border:1px solid var(--line2);border-radius:12px;display:flex;align-items:center;padding:0 12px;color:var(--dim)}
/* PC */
.pc{width:1180px;height:760px;grid-template-columns:236px 1fr;grid-template-rows:52px 1fr;grid-template-areas:"head head" "nav body"}.pc .gxhead{grid-area:head}
.nav{grid-area:nav;border-right:1px solid var(--line);padding:16px 12px;display:flex;flex-direction:column;gap:4px}.nav .nb{display:flex;align-items:center;gap:10px;height:40px;padding:0 12px;border-radius:10px;color:var(--sub);font-weight:600}.nav .nb.on{background:var(--accent-bg);color:var(--signal)}
.nav .card{background:var(--panel);border-radius:12px;height:150px;margin-bottom:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--dim);font-size:12px}.nav .card .ph{width:56px;height:56px;border-radius:50%;background:var(--line2)}.nav .gap{flex:1}.nav .hist{display:flex;gap:6px;justify-content:center;color:var(--dim)}
.body{grid-area:body;display:grid;grid-template-columns:1fr 360px;overflow:hidden}.body .left{overflow:auto}.body .right{border-left:1px solid var(--line);padding-top:12px}.body .right .det{margin:0 14px}
.pc{width:1180px;height:620px}.pc .body{grid-template-columns:1fr 300px}.pc .left{min-width:0;padding:12px 16px}
.pcbar{display:flex;align-items:center;gap:8px;margin-bottom:12px}.pcbar .subs{padding:0;gap:0;border:1px solid var(--line2);border-radius:9px;overflow:hidden}.pcbar .subs button{flex:none;height:30px;padding:0 14px;border:0;border-radius:0;font-size:13px}.pcbar .t{font-weight:700;font-size:15px;margin-left:6px}.pcbar .ov{color:var(--danger);font-size:12px;font-weight:600;margin-left:4px}
.pcbar .tb{display:flex;align-items:center;gap:5px;height:30px;padding:0 10px;border:1px solid var(--line2);border-radius:9px;color:var(--sub);font-size:12.5px;font-weight:600}.pcbar .tb:first-of-type{margin-left:auto}.pcbar .s{height:30px;padding:0 10px}
.pc .grid{grid-template-columns:repeat(8,70px);gap:6px;padding:0}.pc .c{aspect-ratio:auto;height:70px;gap:4px;border-radius:9px;padding:4px}.pc .c svg{width:22px;height:22px}.pc .c b{font-size:11px}
.logbox{margin-top:16px;border-top:1px solid var(--line);padding-top:10px}.logbox .lt{font-size:12px;font-weight:700;color:var(--dim);margin-bottom:6px}.lr{font-size:12.5px;color:var(--sub);line-height:1.9}.lr span{color:var(--dim);margin-right:8px}.lr em{font-style:normal;color:var(--dim);margin-left:6px;font-size:11.5px}
.pc .right{padding:12px 0}
`;
const phoneHtml = (open, over, pop = false) => `<!doctype html><meta charset="utf-8"><style>${css}.win{width:390px;height:844px;grid-template-rows:52px 1fr auto}</style><body><div class="win">
<div class="gxhead"><b>소지품</b><div class="act"><span class="won">₩ 134,000</span><button class="x">${nav('idcard')}</button><button class="x">${nav('close')}</button></div></div>
<div style="overflow:auto">${tabs}${head}${grid(over)}${foot}</div>${pop ? `<div class="dim"><div class="pop">${detail}<button class="pclose">${nav('close')}</button></div></div>` : ''}
<div><div class="stack"><div class="tools"><div class="tb">${nav('plus')}직접 넣기</div><div class="tb">${nav('refresh')}합치기</div></div>${open ? `<div class="drawer"><div class="tb">${nav('wiki')}위키</div><div class="tb">${nav('gnet')}괴담넷</div><div class="tb">${nav('settings')}설정</div></div>` : ''}</div>
<div class="bar bottom"><div class="grip${open ? ' on' : ''}"><i></i></div><div class="nb">${nav('map')}임무</div><div class="nb">${nav('records')}기록</div><div class="nb">${nav('board')}상황판</div><div class="nb">${nav('phone')}괴담톡</div><div class="nb on">${nav('bag')}소지품</div></div></div></div></body>`;
const chatHtml = `<!doctype html><meta charset="utf-8"><style>${css}.win{width:390px;height:300px;grid-template-rows:1fr auto;background:#141a1e}</style><body><div class="win"><div style="padding:14px;color:var(--dim);font-size:12.5px">(채팅 본문 — Risu 입력창 바로 위에 플러그인이 띄우는 상자)</div>
<div><div class="usebox">이번 턴 사용 <span class="chip">소금 봉지</span><span class="chip">손전등</span><span class="x">×</span></div><div class="input">메시지를 입력하세요…</div></div></div></body>`;
const pcGrid = `<div class="grid">${items.map((it, i) => cell(it, i)).join('')}${'<div class="c empty"></div>'.repeat(4)}${cell(['seal', '봉인 상자'], 9, ' over')}</div>`;
const pcLeft = `<div class="pcbar"><div class="subs">${'<button>가계부</button><button class="on">소지품</button>'}</div><div class="t">12 / 16 <span class="ov">+1 넘침</span></div><div class="tb">${nav('plus')} 직접 넣기</div><div class="tb">${nav('refresh')} 합치기</div><div class="s">${nav('search')}<span>물건·기록 찾기</span></div></div>
${pcGrid}<div class="logbox"><div class="lt">사용·처분 기록</div><div class="lr"><span>11-07</span>부적 1장 사용 <em>본문</em></div><div class="lr"><span>11-06</span>생수 1병 사용 <em>사용 단추</em></div><div class="lr"><span>11-06</span>손수건 버림 <em>직접</em></div></div>`;
const pcHtml = `<!doctype html><meta charset="utf-8"><style>${css}</style><body><div class="win pc">
<div class="gxhead"><b>소지품</b><div class="act"><span class="won">₩ 134,000</span><button class="x">${nav('idcard')}</button><button class="x">${nav('close')}</button></div></div>
<div class="nav"><div class="card"><div class="ph"></div>사원증 카드</div><div class="nb">${nav('board')}상황판</div><div class="nb">${nav('map')}임무</div><div class="nb">${nav('phone')}괴담톡</div><div class="nb">${nav('gnet')}괴담넷</div><div class="nb">${nav('wiki')}위키</div><div class="nb on">${nav('bag')}소지품</div><div class="nb">${nav('records')}기록</div><div class="nb">${nav('settings')}설정</div><div class="gap"></div><div class="hist">‹ 뒤로 &nbsp; 앞으로 ›</div></div>
<div class="body"><div class="left">${pcLeft}</div><div class="right">${detail}</div></div></div></body>`;
const b = await chromium.launch(); const out = '/mnt/project-files/작업_1107/초안_';
let p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: 400, height: 860 } });
await p.setContent(phoneHtml(false, false)); await p.screenshot({ path: out + '폰_소지품.png' });
await p.setContent(phoneHtml(false, false, true)); await p.screenshot({ path: out + '폰_상세팝업.png' });
await p.setContent(phoneHtml(true, true)); await p.screenshot({ path: out + '폰_서랍열림_넘침.png' });
p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: 400, height: 310 } }); await p.setContent(chatHtml); await p.screenshot({ path: out + '폰_사용상자.png' });
p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: 1200, height: 640 } }); await p.setContent(pcHtml); await p.screenshot({ path: out + 'PC_소지품.png' });
await b.close(); console.log('ok');
