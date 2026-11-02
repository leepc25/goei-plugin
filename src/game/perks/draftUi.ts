// 방 보상 3택1 창 (임시 퍽·특성). 카드 그림은 아직 없어서(PixelLab 보류) 글 카드: 분류 띠·이름·종류·랭크·효과.
// 테두리: 일반 회색 · 희귀 파랑 · 특급 보라 · 쌍 금색 · 특성 빨강(10-30 A안). 특성은 장점·대가. 고르기: 눌러서 · 숫자 키(1~4) · 방향키 ←→(A·D) + Enter·Space·E · 게임패드 십자키·왼쪽 막대 + A. 열린 동안 월드를 멈춘다.
import { GRADE_MUL, GRADE_NAME, draft, graded, kitOf, type Offer } from './rules';

export const GRADE_COLOR = ['#8a8f96', '#4a8fe0', '#a86ae0'] as const;
export const PAIR_COLOR = '#e0b43a';
export const TRAIT_COLOR = '#e05a5a';
import type { FighterPlayer } from '../action/fighter/player';

const CAT_COLOR: Record<string, string> = {
  연타: '#e8a85a', 강타: '#e0603a', 사격: '#e8d25a', 몸놀림: '#6ad0a0', 막기: '#6aa8e8', 기술: '#b58aff', 상처: '#e06a9a', 사냥: '#c8c8c8', 버티기: '#8ad06a', 주머니: '#a0a0a0',
};
const css = `
.pk-ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(6,7,9,.72);z-index:50;font-family:'Galmuri11','DungGeunMo',monospace,sans-serif}
.pk-box{display:flex;flex-direction:column;align-items:center;gap:14px;max-width:96%}
.pk-title{color:#f2e3b0;font-size:20px;letter-spacing:2px;text-shadow:2px 2px 0 #000}
.pk-row{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}
.pk-card{width:220px;min-height:250px;background:#16181c;border:4px solid #4a4f57;box-shadow:0 0 0 2px #000,6px 6px 0 #000;color:#ddd;cursor:pointer;display:flex;flex-direction:column;image-rendering:pixelated}
.pk-card:hover,.pk-card.sel{transform:translateY(-6px);outline:none;box-shadow:0 0 0 2px #000,6px 6px 0 #000,0 0 18px 2px rgba(242,227,176,.55)}
.pk-grade{font-size:12px;color:#fff;padding:1px 6px;align-self:flex-start;text-shadow:1px 1px 0 #000}
.pk-band{height:10px}
.pk-in{padding:10px 12px;display:flex;flex-direction:column;gap:8px;flex:1}
.pk-name{font-size:17px;color:#fff;text-shadow:1px 1px 0 #000}
.pk-tag{display:flex;gap:6px;font-size:11px;color:#9aa0a8}
.pk-tag b{color:#000;padding:0 5px}
.pk-eff{font-size:13px;line-height:1.5;color:#d8d4c8}
.pk-cost{font-size:12px;line-height:1.5;color:#e88a8a}
.pk-key{margin-top:auto;font-size:11px;color:#6b7078;text-align:right}
.pk-btns{display:flex;gap:10px}
.pk-btn{background:#262a2f;color:#ddd;border:3px solid #4a4f57;padding:6px 12px;font:inherit;cursor:pointer;box-shadow:3px 3px 0 #000}
`;
let styled = false;

/** 열기. 고르면 그 퍽·특성을 얻고 닫힌다 */
export function openDraft(root: HTMLElement, p: FighterPlayer, o: { world?: { paused: boolean } | null; onDone?: (picked: Offer | null) => void; offers?: Offer[] } = {}): void {
  if (!styled) { document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`); styled = true; }
  root.querySelector('.pk-ov')?.remove();
  const kit = kitOf(p.art.cfg, (id) => p.core.has(id), p.base.str);
  const was = o.world?.paused ?? false;
  if (o.world) o.world.paused = true;
  const ov = document.createElement('div');
  ov.className = 'pk-ov';
  const close = (pick: Offer | null) => {
    if (pick?.type === 'perk') p.perks.add(pick.def.name, pick.grade);
    else if (pick?.type === 'trait') p.perks.addTrait(pick.def.name);
    ov.remove();
    window.removeEventListener('keydown', onKey, true);
    cancelAnimationFrame(padRaf);
    if (o.world) o.world.paused = was;
    o.onDone?.(pick);
  };
  let offers: Offer[] = [];
  let sel = 0;
  const mark = () => ov.querySelectorAll('.pk-card').forEach((c, i) => c.classList.toggle('sel', i === sel));
  const move = (d: number) => { if (!offers.length) return; sel = (sel + d + offers.length) % offers.length; mark(); };
  const onKey = (e: KeyboardEvent) => {
    const n = Number(e.key);
    const hit = () => { e.preventDefault(); e.stopPropagation(); };
    if (n >= 1 && n <= offers.length) { hit(); close(offers[n - 1]); }
    else if (e.key === 'ArrowLeft' || e.code === 'KeyA') { hit(); move(-1); }
    else if (e.key === 'ArrowRight' || e.code === 'KeyD') { hit(); move(1); }
    else if ((e.key === 'Enter' || e.key === ' ' || e.code === 'KeyE') && offers[sel]) { hit(); close(offers[sel]); }
  };
  // 게임패드: 십자키·왼쪽 막대 좌우로 옮기고 A(0번)로 고른다. 누른 순간만 본다(창이 열릴 때 누르고 있던 것은 무시)
  let padRaf = 0, padPrev: Record<string, boolean> = { l: true, r: true, a: true };
  const padTick = () => {
    const g = [...(navigator.getGamepads?.() ?? [])].find((x) => x && x.connected);
    if (g) {
      const now = { l: !!g.buttons[14]?.pressed || (g.axes[0] ?? 0) < -0.5, r: !!g.buttons[15]?.pressed || (g.axes[0] ?? 0) > 0.5, a: !!g.buttons[0]?.pressed };
      if (now.l && !padPrev.l) move(-1);
      if (now.r && !padPrev.r) move(1);
      if (now.a && !padPrev.a && offers[sel]) return close(offers[sel]);
      padPrev = now;
    }
    padRaf = requestAnimationFrame(padTick);
  };
  let preset = o.offers ?? null;
  const render = () => {
    offers = preset ?? draft(kit, { ranks: p.perks.ranks, traits: p.perks.traits }, Math.random, p.perks.depth);
    preset = null;
    ov.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'pk-box';
    box.innerHTML = `<div class="pk-title">보상 · 하나를 고른다</div>`;
    const row = document.createElement('div');
    row.className = 'pk-row';
    offers.forEach((f, i) => {
      const c = document.createElement('div');
      c.tabIndex = 0;
      if (f.type === 'perk') {
        const d = f.def, pair = d.kind === '쌍', col = pair ? PAIR_COLOR : GRADE_COLOR[f.grade];
        c.className = 'pk-card';
        c.style.borderColor = col;
        const max = d.rank >= 99 ? '' : ` · ${f.rank}/${d.rank}번째`;
        const gtxt = pair ? '쌍' : GRADE_NAME[f.grade] + (graded(d) && f.grade ? ` · 수치 ×${GRADE_MUL[f.grade]}` : '');
        c.innerHTML = `<div class="pk-band" style="background:${CAT_COLOR[d.cat] ?? '#888'}"></div><div class="pk-in"><div class="pk-name">${d.name}</div><div class="pk-grade" style="background:${col}">${gtxt}</div><div class="pk-tag"><b style="background:${CAT_COLOR[d.cat] ?? '#888'}">${d.cat}</b><span>${d.kind}${max}</span></div><div class="pk-eff">${d.eff}</div>${d.cond && pair ? `<div class="pk-tag">${d.cond}</div>` : ''}<div class="pk-key">${i + 1}</div></div>`;
      } else {
        c.className = 'pk-card';
        c.style.borderColor = TRAIT_COLOR;
        c.innerHTML = `<div class="pk-band" style="background:${TRAIT_COLOR}"></div><div class="pk-in"><div class="pk-name">${f.def.name}</div><div class="pk-tag"><b style="background:${TRAIT_COLOR}">특성</b><span>장점 + 대가</span></div><div class="pk-eff">${f.def.good}</div><div class="pk-cost">대가: ${f.def.cost}</div><div class="pk-key">${i + 1}</div></div>`;
      }
      c.onclick = () => close(f);
      c.onmouseenter = () => { sel = i; mark(); };
      row.append(c);
    });
    box.append(row);
    const btns = document.createElement('div');
    btns.className = 'pk-btns';
    // 규정상 이렇게 해도 돼: 후보를 다시 뽑는다(괴이 한 번에 2회)
    const left = p.perks.rerollsLeft();
    if (left > 0) {
      const b = document.createElement('button');
      b.className = 'pk-btn';
      b.textContent = `다시 뽑기 (${left})`;
      b.onclick = () => { p.perks.useReroll(); render(); };
      btns.append(b);
    }
    const skip = document.createElement('button');
    skip.className = 'pk-btn';
    skip.textContent = '받지 않음';
    skip.onclick = () => close(null);
    btns.append(skip);
    box.append(btns);
    ov.append(box);
    if (!offers.length) box.querySelector('.pk-title')!.textContent = '더 받을 퍽이 없다';
    sel = 0; mark();
  };
  render();
  window.addEventListener('keydown', onKey, true);
  padRaf = requestAnimationFrame(padTick);
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
  root.append(ov);
}
