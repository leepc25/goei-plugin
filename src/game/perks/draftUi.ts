// 방 보상 3택1 창 (임시 퍽·특성). 카드 그림은 아직 없어서(PixelLab 보류) 글 카드: 분류 띠·이름·종류·랭크·효과.
// 쌍 퍽은 금색 테두리, 특성은 보라 테두리에 장점·대가. 숫자 키(1~4)나 눌러서 고른다. 열린 동안 월드를 멈춘다.
import { draft, kitOf, type Offer } from './rules';
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
.pk-card:hover,.pk-card:focus{transform:translateY(-4px);outline:none;border-color:#e8e2c8}
.pk-card.pair{border-color:#e0b43a}.pk-card.trait{border-color:#9a6ae0}
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
export function openDraft(root: HTMLElement, p: FighterPlayer, o: { world?: { paused: boolean } | null; onDone?: (picked: Offer | null) => void } = {}): void {
  if (!styled) { document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`); styled = true; }
  root.querySelector('.pk-ov')?.remove();
  const kit = kitOf(p.art.cfg, (id) => p.core.has(id), p.base.str);
  const was = o.world?.paused ?? false;
  if (o.world) o.world.paused = true;
  const ov = document.createElement('div');
  ov.className = 'pk-ov';
  const close = (pick: Offer | null) => {
    if (pick?.type === 'perk') p.perks.add(pick.def.name);
    else if (pick?.type === 'trait') p.perks.addTrait(pick.def.name);
    ov.remove();
    window.removeEventListener('keydown', onKey, true);
    if (o.world) o.world.paused = was;
    o.onDone?.(pick);
  };
  let offers: Offer[] = [];
  const onKey = (e: KeyboardEvent) => {
    const n = Number(e.key);
    if (n >= 1 && n <= offers.length) { e.preventDefault(); e.stopPropagation(); close(offers[n - 1]); }
  };
  const render = () => {
    offers = draft(kit, { ranks: p.perks.ranks, traits: p.perks.traits });
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
        const d = f.def, pair = d.kind === '쌍';
        c.className = `pk-card${pair ? ' pair' : ''}`;
        const max = d.rank >= 99 ? '' : ` · ${f.rank}/${d.rank}`;
        c.innerHTML = `<div class="pk-band" style="background:${CAT_COLOR[d.cat] ?? '#888'}"></div><div class="pk-in"><div class="pk-name">${d.name}</div><div class="pk-tag"><b style="background:${CAT_COLOR[d.cat] ?? '#888'}">${d.cat}</b><span>${d.kind}${max}</span></div><div class="pk-eff">${d.eff}</div>${d.cond && pair ? `<div class="pk-tag">${d.cond}</div>` : ''}<div class="pk-key">${i + 1}</div></div>`;
      } else {
        c.className = 'pk-card trait';
        c.innerHTML = `<div class="pk-band" style="background:#9a6ae0"></div><div class="pk-in"><div class="pk-name">${f.def.name}</div><div class="pk-tag"><b style="background:#9a6ae0">특성</b><span>장점 + 대가</span></div><div class="pk-eff">${f.def.good}</div><div class="pk-cost">대가: ${f.def.cost}</div><div class="pk-key">${i + 1}</div></div>`;
      }
      c.onclick = () => close(f);
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
  };
  render();
  window.addEventListener('keydown', onKey, true);
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
  root.append(ov);
}
