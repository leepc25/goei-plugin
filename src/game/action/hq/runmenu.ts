// 출동 중 Esc 가방: 아이템 4칸(1~4키) · 회수물 가방 6칸 · 유물 · 이번 출동 강화 · 찾은 규칙 · 현금. 철수는 다락방에서만.
// 엔진은 openRunMenu(box, inv, onUse)로 띄우고, 1~4키는 useItem(inv, slot)으로 쓴다 (돌려준 id의 효과는 엔진·아이템 모듈이 적용).
import type { BagSlot, Slot } from './contract';
import { itemName, supplyDef } from './logic';
import { RELICS } from './data';

export interface RunInventory {
  items: Slot[];
  bag: BagSlot[];
  relics: string[];
  upgrades: string[];
  found: string[];
  sent: string[];
  cash: number;
  shards: number;
  /** 다락방(휴식방)·입구에 있으면 true → 철수 버튼이 켜진다 */
  canWithdraw: boolean;
}
export const newInventory = (items: Slot[], relics: string[]): RunInventory => ({ items: items.map((x) => (x ? { ...x } : null)), bag: [null, null, null, null, null, null], relics: relics.slice(), upgrades: [], found: [], sent: [], cash: 0, shards: 0, canWithdraw: false });

/** 1~4키. 쓸 수 있으면 아이템 id를 돌려주고 개수를 줄인다. 빈 칸이면 null (소모 없음). */
export function useItem(inv: RunInventory, slot: number): string | null {
  const s = inv.items[slot];
  if (!s || s.n <= 0) return null;
  s.n--;
  const id = s.id;
  if (s.n <= 0) inv.items[slot] = null;
  return id;
}
/** 주운 아이템: 같은 아이템 칸에 더하고(칸 최대까지), 아니면 빈 칸. 자리가 없으면 false */
export function addItem(inv: RunInventory, id: string): boolean {
  const max = supplyDef(id)?.max ?? 3;
  const same = inv.items.find((x) => x && x.id === id && x.n < max);
  if (same) return (same.n++, true);
  const i = inv.items.findIndex((x) => !x);
  if (i < 0) return false;
  inv.items[i] = { id, n: 1 };
  return true;
}
/** 회수물을 가방에. 6칸이 차면 false (더 뒤질지, 다락방에 갈지 고민하게 만드는 칸 수, 기획서 14장) */
export function addBag(inv: RunInventory, b: NonNullable<BagSlot>): boolean {
  const i = inv.bag.findIndex((x) => !x);
  if (i < 0) return false;
  inv.bag[i] = b;
  return true;
}

type IconDrawer = (ctx: CanvasRenderingContext2D, id: string, x: number, y: number, size: number) => void;
let iconDrawer: IconDrawer | null = null;
/** 아이템 스레드의 drawItemIcon을 넣는다 */
export function setItemIconDrawer(f: IconDrawer | null) {
  iconDrawer = f;
}
const ICON_COLOR: Record<string, string> = { medkit: '#d05050', bandage: '#e0d0c0', antidote: '#60c080', painkiller: '#e8ecee', sedative: '#9a7fd1', salt: '#e8e8e8', flash: '#f0f070', smoke: '#8a8a9a', charm: '#d0a040', energy: '#d0b040' };
export function drawIcon(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, size: number) {
  if (iconDrawer) return iconDrawer(ctx, id, x, y, size);
  ctx.fillStyle = ICON_COLOR[id] ?? '#8a8a8a';
  ctx.fillRect(x + 4, y + 4, size - 8, size - 8);
  ctx.fillStyle = '#111';
  ctx.font = `${Math.round(size * 0.45)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(itemName(id).slice(0, 1), x + size / 2, y + size / 2 + 1);
}
export function iconCanvas(id: string, size = 40): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawIcon(c.getContext('2d')!, id, 0, 0, size);
  c.className = 'hq-icon';
  return c;
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface RunMenuOpts {
  ruleText?: (id: string) => string;
  onWithdraw?: () => void;
  onClose?: () => void;
  title?: string;
}
/** Esc 가방을 box 위에 띄운다. 닫는 함수를 돌려준다. onUse(slot)는 칸을 눌렀을 때 (엔진이 useItem을 부르고 효과를 건다). */
export function openRunMenu(box: HTMLElement, inv: RunInventory, onUse: (slot: number) => void, opts: RunMenuOpts = {}): () => void {
  const el = document.createElement('div');
  el.className = 'hq-runmenu';
  const render = () => {
    el.innerHTML = `<div class="hq-sheet" role="dialog" aria-label="가방">
<div class="hq-sheet-head"><b>${esc(opts.title ?? '가방')}</b><span>현금 ${inv.cash} · 이상 파편 ${inv.shards}</span><button data-rm="close">닫기 (Esc)</button></div>
<h3>아이템 (1~4키)</h3><div class="hq-slots" data-items></div>
<h3>회수물 가방 ${inv.bag.filter(Boolean).length}/6</h3><div class="hq-bag">${inv.bag.map((b) => `<div class="hq-cell${b ? '' : ' empty'}">${b ? esc(b.name) : '빈 칸'}</div>`).join('')}</div>
<h3>유물</h3><p>${inv.relics.length ? inv.relics.map((r) => `${esc(RELICS[r]?.name ?? r)} <small>${esc(RELICS[r]?.effect ?? '')}</small>`).join(' · ') : '없음'}</p>
${inv.upgrades.length ? `<h3>이번 출동 강화</h3><p>${inv.upgrades.map(esc).join(' · ')}</p>` : ''}
<h3>찾은 규칙 ${inv.found.length}줄 (송신 ${inv.sent.length})</h3><ul>${inv.found.map((r) => `<li>${esc(opts.ruleText?.(r) ?? r)}${inv.sent.includes(r) ? ' <small>송신됨</small>' : ''}</li>`).join('') || '<li>아직 없음</li>'}</ul>
<div class="hq-row">${opts.onWithdraw ? `<button data-rm="withdraw" ${inv.canWithdraw ? '' : 'disabled'}>${inv.canWithdraw ? '철수 (다락방 로프)' : '철수는 다락방에서만'}</button>` : ''}</div></div>`;
    const slots = el.querySelector<HTMLElement>('[data-items]')!;
    inv.items.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'hq-slot';
      b.dataset.use = String(i);
      b.disabled = !s;
      if (s) b.append(iconCanvas(s.id, 36));
      b.insertAdjacentHTML('beforeend', `<span><b>${i + 1}</b> ${s ? `${esc(itemName(s.id))} ×${s.n}` : '빈 칸'}</span>`);
      slots.append(b);
    });
  };
  render();
  const onClick = (ev: Event) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-rm],[data-use]');
    if (!t) return;
    if (t.dataset.use) {
      onUse(Number(t.dataset.use));
      render();
    } else if (t.dataset.rm === 'close') close();
    else if (t.dataset.rm === 'withdraw' && inv.canWithdraw) (close(), opts.onWithdraw?.());
  };
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    el.remove();
    opts.onClose?.();
  };
  el.addEventListener('click', onClick);
  box.append(el);
  return close;
}
