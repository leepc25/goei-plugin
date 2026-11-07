import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const chev = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 6-6 6 6"/></svg>';
const html = `<!doctype html><meta charset="utf-8"><style>
:root{--void:#1A2226;--panel:#232D32;--panel2:#2C383E;--line:#3A4A50;--line2:#46565D;--text:#E9F0EE;--sub:#BECBC8;--dim:#8A9A97;--signal:#5EEAD4}
body{margin:0;background:#0d1114;color:var(--text);font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif;padding:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;width:1000px}
.box{background:var(--void);border:1px solid var(--line);border-radius:10px;overflow:hidden}.box h4{margin:0;padding:10px 12px;font-size:13px;color:var(--sub);font-weight:600}
.area{height:70px;padding:10px 12px;color:var(--dim);font-size:12px;border-bottom:1px solid var(--line);display:flex;align-items:flex-end}
.bar{position:relative;height:60px;display:flex;background:var(--void)}.nb{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--dim);font-size:11px;font-weight:600}.nb i{display:block;width:20px;height:20px;border-radius:5px;border:1.8px solid currentColor}
/* A: 혀(탭) */
.gA{position:absolute;left:50%;top:-7px;transform:translateX(-50%);width:88px;height:13px;background:var(--void);border:1px solid var(--line);border-bottom:0;border-radius:7px 7px 0 0;display:flex;align-items:center;justify-content:center;color:var(--sub);line-height:0}
/* B: 홈 + 막대 */
.gB{position:absolute;left:50%;top:-10px;transform:translateX(-50%);width:96px;height:11px;background:var(--panel2);border:1px solid var(--line2);border-bottom:0;border-radius:6px 6px 0 0;display:flex;align-items:center;justify-content:center}.gB i{width:40px;height:3px;border-radius:3px;background:var(--sub)}
/* C: 고리 */
.gC{position:absolute;left:50%;top:-12px;transform:translateX(-50%);width:84px;height:12px;border:2px solid var(--sub);border-radius:6px;background:var(--void)}.gC:after{content:"";position:absolute;left:14px;right:14px;top:3px;height:2px;border-radius:2px;background:var(--line2)}
</style><body>
${[['A. 납작한 혀(탭) + ∧', `<div class="gA">${chev}</div>`], ['B. 위로 솟은 홈에 막대', '<div class="gB"><i></i></div>'], ['C. 바 위에 얹은 손잡이 테', '<div class="gC"></div>']].map(([t, g]) => `<div class="box"><h4>${t}</h4><div class="area">도구 줄 (직접 넣기 · 합치기)</div><div class="bar">${g}<div class="nb"><i></i>임무</div><div class="nb"><i></i>기록</div><div class="nb"><i></i>상황판</div><div class="nb"><i></i>괴담톡</div><div class="nb"><i></i>소지품</div></div></div>`).join('')}
</body>`;
const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: 1032, height: 230 } });
await p.setContent(html); await p.screenshot({ path: '/mnt/project-files/작업_1107/초안_서랍손잡이_후보.png' }); await b.close(); console.log('ok');
