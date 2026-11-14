// 사용: NODE_PATH=$(npm root -g) node build.cjs <시안 폴더>
// <폴더>/page.html 의 .plate(자유 CSS, 그림 조각이 됨) 를 plates/*.jpg 로 찍고,
// .arca(아카라이브에 그대로 붙는 인라인 HTML) 와 엮어 arca.html 을 만든 뒤 PC(860)·폰(360) 미리보기를 찍는다.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const dir = path.resolve(process.argv[2]); const W = 860;
const BANNED = /display\s*:\s*(flex|grid|inline-grid)|grid-template|position\s*:|z-index|overflow|[^-]gap\s*:|transform|animation|transition|opacity|filter|clip-path|mask|-webkit-|cursor|pointer-events|user-select|writing-mode|conic-gradient|mix-blend|outline|url\(/i;
const BADTAG = /<(style|script|link|code|button|form|input|select|textarea|mark|small|svg|picture|source|abbr|cite|q|dl|dt|dd)\b/i;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: 1000 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(dir, 'page.html')); await p.waitForLoadState('networkidle'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  fs.mkdirSync(path.join(dir, 'plates'), { recursive: true });
  const blocks = await p.$$('body > .plate, body > .arca');
  let out = ''; let n = 0; const warn = [];
  for (const el of blocks) {
    const cls = await el.getAttribute('class');
    if (/\bplate\b/.test(cls)) {
      const name = String(++n).padStart(2, '0') + '-' + ((await el.getAttribute('data-name')) || 'plate');
      const box = await el.boundingBox();
      if (Math.round(box.width) !== W) warn.push(`${name}: 폭 ${box.width} (860이어야 함)`);
      await el.screenshot({ path: path.join(dir, 'plates', name + '.jpg'), type: 'jpeg', quality: 90 });
      const minFont = await el.evaluate((e) => { let m = 999; e.querySelectorAll('*').forEach((x) => { if ([...x.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) { const s = parseFloat(getComputedStyle(x).fontSize); if (!x.closest('[data-deco]')) m = Math.min(m, s); } }); return m; });
      if (minFont < 30) warn.push(`${name}: 그림 속 글자 ${minFont}px — 폰에서는 0.42배로 줄어 ${Math.round(minFont * 0.42)}px. 읽어야 하는 글자는 30px 이상이거나 .arca 로 뺄 것 (안 읽혀도 되는 장식 글자는 data-deco 를 붙임)`);
      out += `<img src="plates/${name}.jpg" style="display:block;width:100%;height:auto;margin:0;">\n`;
    } else {
      const html = await el.evaluate((e) => e.innerHTML.trim());
      const styles = [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
      for (const s of styles) { const m = s.match(BANNED); if (m) warn.push(`.arca 금지 CSS: ${m[0]} ← ${s.slice(0, 80)}`); }
      const t = html.match(BADTAG); if (t) warn.push(`.arca 금지 태그: ${t[0]}`);
      if (/\sclass=/.test(html)) warn.push('.arca 안에 class 사용 (인라인 style 만)');
      if (/<!--/.test(html)) warn.push('.arca 안에 주석');
      out += html + '\n';
    }
  }
  fs.writeFileSync(path.join(dir, 'arca.html'), out);
  const shell = (bg, pad) => `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"><body style="margin:0;background:${bg};font-family:Pretendard,'Noto Sans KR',sans-serif;font-size:15px;line-height:1.6;color:${bg === '#fff' ? '#222' : '#d3d3d3'}"><div style="padding:${pad}px">${out}</div></body>`;
  const counts = {};
  for (const [tag, vw, pad, bg, dsf] of [['pc', W, 0, '#fff', 1], ['phone', 390, 15, '#fff', 2], ['phonedark', 390, 15, '#222', 2]]) {
    const f = path.join(dir, `_preview_${tag}.html`); fs.writeFileSync(f, shell(bg, pad));
    const q = await b.newPage({ viewport: { width: vw, height: 900 }, deviceScaleFactor: dsf });
    await q.goto('file://' + f); await q.waitForLoadState('networkidle'); await q.evaluate(() => document.fonts.ready); await q.waitForTimeout(400);
    const H = await q.evaluate(() => document.documentElement.scrollHeight);
    await q.screenshot({ path: path.join(dir, `preview_${tag}.png`), fullPage: true });
    const step = tag === 'pc' ? 1300 : 800; let i = 0;
    if (tag !== 'phonedark') for (let y = 0; y < H; y += step) await q.screenshot({ path: path.join(dir, `part_${tag}_${String(++i).padStart(2, '0')}.png`), clip: { x: 0, y, width: vw, height: Math.min(step, H - y) } });
    counts[tag] = { height: H, parts: i };
    await q.close();
  }
  console.log(JSON.stringify(counts));
  console.log(warn.length ? '경고:\n- ' + warn.join('\n- ') : '경고 없음');
  await b.close();
})();
