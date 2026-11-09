// click-audit --probe: 지도 이름표 겹침·숨은 핀 점 누르기 (11-09 점검 13 확인용)
// 쓰기: node scripts/click-audit.mjs --vp pc --start board --from 'nav-tab|map' --probe scripts/click-audit-probes/map-declutter.mjs --out .scratch/ca-mapprobe
//       (폰은 --vp phone --from 'tab|map')
// 지도마다(전국·인천·경기북부·경기남부) 원래 크기 → 확대 3번 → 축소 3번 하며 잰다:
//   보이는 이름끼리 겹침, 이름이 남의 점·확대 단추를 덮음, 숨은 이름표(lab-off)의 점이 맨 위에 있어 눌리는지, 숨은 점 하나를 실제로 눌러 반응하는지
const MAPS = [['01', '전국'], ['03', '인천'], ['09', '경기북부'], ['10', '경기남부']];
const STEPS = ['reset', 'in', 'in', 'in', 'out', 'out', 'out'];

const measure = () => {
  const cv = document.querySelector('.gx-canvas');
  if (!cv) return { err: '지도 없음' };
  const B = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const F = B(cv);
  const inF = (r) => r.r > F.l && r.l < F.r && r.b > F.t && r.t < F.b;
  const ov = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  const labs = [...cv.querySelectorAll('.gx-pin.gx-plab')];
  const dots = [...cv.querySelectorAll('.gx-pin.gx-pdot')];
  const nm = (el) => el.getAttribute('aria-label') || el.textContent.trim();
  const zb = [...cv.querySelectorAll('.gx-zbtn')].map(B);
  const shown = labs.map((el, i) => ({ el, i, n: el.querySelector('.gx-pname') })).filter((x) => x.n && !x.el.classList.contains('lab-off') && getComputedStyle(x.el).visibility !== 'hidden' && getComputedStyle(x.el).display !== 'none').map((x) => ({ ...x, r: B(x.n) })).filter((x) => inF(x.r));
  const dotR = dots.map((d) => { const g = d.querySelector('.gx-dot'); return g ? B(g) : null; });
  const nameName = [], nameDot = [], nameZoom = [];
  for (let a = 0; a < shown.length; a++) {
    for (let b = a + 1; b < shown.length; b++) { const o = ov(shown[a].r, shown[b].r); if (o > 4) nameName.push(`${nm(shown[a].el)}↔${nm(shown[b].el)} ${Math.round(o)}px²`); }
    dotR.forEach((d, j) => { if (j !== shown[a].i && d && inF(d)) { const o = ov(shown[a].r, d); if (o > 4) nameDot.push(`${nm(shown[a].el)} 이름이 ${nm(labs[j])} 점을 덮음 ${Math.round(o)}px²`); } });
    for (const z of zb) if (ov(shown[a].r, z) > 4) nameZoom.push(`${nm(shown[a].el)} 이름이 확대 단추 밑`);
  }
  const hidden = labs.map((el, i) => ({ el, i })).filter((x) => x.el.classList.contains('lab-off'));
  const hiddenDots = hidden.map(({ el, i }) => {
    const d = dotR[i];
    if (!d || !inF(d)) return { name: nm(el), out: true };
    const x = (d.l + d.r) / 2, y = (d.t + d.b) / 2;
    const top = document.elementFromPoint(x, y);
    const ok = !!top && dots[i].contains(top);
    return { name: nm(el), ok, top: ok ? '' : (top?.className || top?.tagName || '없음').toString().slice(0, 60), x, y, tab: dots[i].tabIndex, title: dots[i].getAttribute('title') || '' };
  });
  const z = cv.querySelector('.gx-mapzoom')?.style.transform || '';
  return { map: cv.dataset.map, z, shown: shown.length, total: labs.length, nameName, nameDot, nameZoom, hiddenDots };
};

export default async function (page, { vp, shots, log }) {
  const out = [];
  const settle = () => page.waitForTimeout(450);
  for (const [code, label] of MAPS) {
    // 지역 바꾸기: 그 지역 핀(이름표나 점)을 스크립트로 눌러 들어간다 (전국은 「전국」 단추)
    const went = await page.evaluate((c) => {
      const cur = document.querySelector('.gx-canvas')?.dataset.map;
      if (cur === c) return true;
      if (c !== '01' && cur !== '01') { const n = document.querySelector('[data-action="map-region"][data-value="01"]'); if (n) n.click(); }
      return 'retry';
    }, code);
    if (went === 'retry') { await settle(); await page.evaluate((c) => document.querySelector(`[data-action="map-region"][data-value="${c}"]`)?.click(), code); }
    await settle();
    const now = await page.evaluate(() => document.querySelector('.gx-canvas')?.dataset.map);
    if (now !== code) { out.push({ map: code, label, err: `못 들어감(지금 ${now})` }); continue; }
    for (const [k, st] of STEPS.entries()) {
      await page.evaluate((s) => document.querySelector(`.gx-zbtn[data-zoom="${s}"]`)?.click(), st);
      await settle();
      const m = await page.evaluate(measure);
      const shot = `${vp}_probe_${label}_${k}_${st}.png`;
      const cv = await page.$('.gx-canvas');
      if (cv) await cv.screenshot({ path: `${shots}/${shot}` });
      out.push({ label, step: `${k}:${st}`, shot, ...m });
      log(`${vp} ${label} ${k}:${st} 보이는 이름 ${m.shown}/${m.total} · 이름끼리 ${m.nameName?.length} · 이름→점 ${m.nameDot?.length} · 숨은 점 못 누름 ${m.hiddenDots?.filter((h) => !h.ok && !h.out).length}`);
    }
    // 숨은 점 하나를 실제로 눌러 본다 (원래 크기에서)
    await page.evaluate(() => document.querySelector('.gx-zbtn[data-zoom="reset"]')?.click());
    await settle();
    const m = await page.evaluate(measure);
    const h = m.hiddenDots?.find((x) => x.ok);
    if (h) {
      const before = await page.evaluate(() => ({ map: document.querySelector('.gx-canvas')?.dataset.map, sel: [...document.querySelectorAll('.gx-pin.sel')].map((e) => e.getAttribute('aria-label')).join(',') , html: document.querySelector('.gx-panel')?.innerHTML.length }));
      if (vp === 'phone') await page.touchscreen.tap(h.x, h.y); else await page.mouse.click(h.x, h.y);
      await settle();
      const after = await page.evaluate(() => ({ map: document.querySelector('.gx-canvas')?.dataset.map, sel: [...document.querySelectorAll('.gx-pin.sel')].map((e) => e.getAttribute('aria-label')).join(','), html: document.querySelector('.gx-panel')?.innerHTML.length }));
      const shot = `${vp}_probe_${label}_숨은점_${h.name}.png`;
      await page.screenshot({ path: `${shots}/${shot}` });
      out.push({ label, step: 'hidden-click', name: h.name, before, after, changed: JSON.stringify(before) !== JSON.stringify(after), shot });
      log(`${vp} ${label} 숨은 점 「${h.name}」 누름 → ${JSON.stringify(before) !== JSON.stringify(after) ? '반응함' : '반응 없음'}`);
      // 지역에 들어갔으면 다음 지도로 가기 위해 그대로 둔다(다음 지도에서 전국으로 돌아감)
    }
  }
  return out;
}
