// click-audit --probe: 고른 카드 테두리 (11-09 「고른 카드는 어디서나 민트 2px」 확인용)
// 지금 화면에 있는 고를 수 있는 카드(세력·임무·요원·소지품 칸)를 첫 것과 맨 끝 것 하나씩 눌러, 고른 카드를 크게 잘라 찍고
// 테두리 두께(자체 border + ::after 줄)·조상 칸에 잘리는지를 잰다.
// 쓰기 예: --start picker (세력) / --start board --from 'nav-tab|map>tab|mission' (임무, 폰 'tab|map>tab|mission') / --start items --from 'nav-tab|items' (소지품, 폰 'tab|items')
const KINDS = [
  ['세력', '[data-action="faction"]', '.gx-fac.on'],
  ['임무', '[data-action="pick-event"]', '.gx-mlist li.gx-mx.sel'],
  ['임무 펼침', '[data-action="mission-open"]', '.gx-mlist li.gx-mx.open'], // 임무 탭: 카드를 펼쳐(mission-open) 고르기
  ['임무 카드', '[data-action="mission-pick"]', '.gx-mlist li.gx-mx.sel'],
  ['요원', '.gx-acard.pick[data-action]', '.gx-acard.pick.on'],
  ['소지품', '.it-c[data-action]', '.it-c.sel'],
  ['장착칸', '.it-slot[data-action]', '.it-slot.sel'],
];

const inspect = (selSel) => {
  const el = [...document.querySelectorAll(selSel)].find((e) => e.getBoundingClientRect().width > 0);
  if (!el) return null;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const cs = getComputedStyle(el), af = getComputedStyle(el, '::after');
  const r = el.getBoundingClientRect();
  let clip = '';
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (/(hidden|auto|scroll|clip)/.test(s.overflow + s.overflowX + s.overflowY)) {
      const q = p.getBoundingClientRect();
      const cut = [r.left < q.left + 0.5 && '왼', r.right > q.right - 0.5 && '오른', r.top < q.top + 0.5 && '위', r.bottom > q.bottom - 0.5 && '아래'].filter(Boolean);
      if (cut.length) { clip = `${(p.className || p.tagName).toString().split(' ')[0]} 칸 ${cut.join('·')}쪽 끝에 닿음`; break; }
    }
  }
  return {
    cls: el.className.toString().slice(0, 80),
    border: `${cs.borderTopWidth} ${cs.borderTopColor}`,
    after: af.content !== 'none' ? `${af.borderTopWidth} ${af.borderTopColor} z${af.zIndex} inset ${af.top}` : '없음',
    shadow: cs.boxShadow,
    clip,
    rect: { x: r.left, y: r.top, w: r.width, h: r.height },
  };
};

export default async function (page, { vp, shots, log }) {
  const out = [];
  for (const [name, clickSel, selSel] of KINDS) {
    const n = await page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().width > 0).length, clickSel);
    if (!n) continue;
    for (const which of ['first', 'last']) {
      await page.evaluate(([s, w]) => { const all = [...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().width > 0); const el = w === 'first' ? all[0] : all.at(-1); if (!el) return; el.scrollIntoView({ block: 'center' }); el.click(); }, [clickSel, which]);
      await page.waitForTimeout(700);
      const info = await page.evaluate(inspect, selSel);
      let shot = '';
      if (info) {
        const m = 14, { x, y, w, h } = info.rect;
        shot = `${vp}_probe_고른카드_${name}_${which}.png`;
        await page.screenshot({ path: `${shots}/${shot}`, clip: { x: Math.max(0, x - m), y: Math.max(0, y - m), width: w + m * 2, height: h + m * 2 }, scale: 'device' });
      }
      out.push({ name, which, count: n, info, shot });
      log(`${vp} 고른 ${name}(${which}/${n}): ${info ? `테두리 ${info.border} · 덧줄 ${info.after}${info.clip ? ' · ' + info.clip : ''}` : '고른 표시 못 찾음'}`);
    }
  }
  return out;
}
