import { VENDORS } from './data';
import type { ItemRun } from './inventory';
import { buy, sell, sellPrice, type BuyResult, type Shop } from './shop';
import { drawItemIcon } from './icons';
/**
 * 중림 상인 거래 창. 통합 게임 화면(1280×720 무대) 위에 겹친다. 열려 있는 동안 엔진은 전투를 멈춘다(isOpen).
 * 체력·상태 적용은 onBuy로 엔진에 넘긴다(heal 비율, cure 목록, hpCost 비율).
 */
const CSS = `
.gi-shop{position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:30;padding:12px;box-sizing:border-box;pointer-events:auto;font-family:system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#e8ecee}
.gi-shop[hidden]{display:none}
.gi-shop .panel{background:#1b2226;border:1px solid #3a464d;border-radius:14px;width:min(560px,100%);max-height:100%;overflow:auto;padding:14px 16px;box-sizing:border-box}
.gi-shop header{display:flex;align-items:center;gap:10px}
.gi-shop header div{display:flex;flex-direction:column}
.gi-shop header small{color:#8a969c}
.gi-shop .cash{margin-left:auto;color:#e6d36a;font-weight:700}
.gi-shop .say{color:#cfd6da;margin:10px 0}
.gi-shop h4{margin:14px 0 6px;color:#8a969c;font-size:13px}
.gi-shop .row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:#232d32;border:1px solid #33404a;border-radius:10px;color:inherit;font:inherit;padding:8px 10px;margin:0 0 6px;cursor:pointer}
.gi-shop .row:disabled{opacity:.45;cursor:default}
.gi-shop .row.sel{border-color:#e6d36a}
.gi-shop .t{display:flex;flex-direction:column;flex:1;min-width:0}
.gi-shop .t small{color:#8a969c;font-size:12px}
.gi-shop .p{display:flex;flex-direction:column;align-items:flex-end;color:#e6d36a;font-weight:700;white-space:nowrap}
.gi-shop .p small{color:#8a969c;font-weight:400;font-size:11px}
.gi-shop .msg{min-height:20px;color:#9fd9a6;margin:8px 0}
.gi-shop footer{display:flex;justify-content:flex-end}
.gi-shop footer button{font:inherit;padding:8px 16px;border-radius:8px;border:1px solid #4a565d;background:#2c383e;color:#e8ecee;cursor:pointer}
`;
const WHY: Record<string, string> = { cash: '현금이 모자라', stock: '품절', full: '1~4칸이 가득', ammoFull: '탄이 가득', loan: '빚부터 갚아' };

export interface ShopPanel {
  open(shop: Shop, run: ItemRun, onBuy: (r: Extract<BuyResult, { ok: true }>) => void, onClose?: () => void): void;
  close(): void;
  isOpen(): boolean;
  dispose(): void;
}
export function createShopPanel(root: HTMLElement): ShopPanel {
  if (!document.getElementById('gi-shop-css')) {
    const s = document.createElement('style');
    s.id = 'gi-shop-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  const box = document.createElement('div');
  box.className = 'gi-shop';
  box.hidden = true;
  root.appendChild(box);
  let cur: { shop: Shop; run: ItemRun; onBuy: (r: Extract<BuyResult, { ok: true }>) => void; onClose?: () => void } | null = null;
  let sel = 0;
  let msg = '';

  const render = () => {
    if (!cur) return;
    const { shop, run } = cur;
    const v = VENDORS[shop.vendor];
    const icon = (o: Shop['offers'][number]) =>
      o.kind === 'ammo' ? 'ammo-' + o.ref : o.kind === 'clinic' ? 'backalley' : o.kind === 'loan' ? 'shinyuri' : o.kind === 'gamble' ? 'vending' : o.ref;
    const rows = shop.offers
      .map(
        o => `<button class="row" data-k="${o.key}" ${o.stock <= 0 ? 'disabled' : ''}><canvas width="40" height="40" data-icon="${icon(o)}"></canvas>
        <span class="t"><b>${o.name}</b><small>${o.desc}</small></span>
        <span class="p">${o.kind === 'loan' ? '빌리기' : o.hpCost ? '체력 20%' : o.price + '원'}<small>${o.stock <= 0 ? '품절' : o.kind === 'loan' ? '' : '남음 ' + o.stock}</small></span></button>`,
      )
      .join('');
    const bag = shop.buys
      ? `<h4>회수물 팔기</h4>${
          run.bag
            .map((b, i) => (b ? `<button class="row" data-sell="${i}"><canvas width="40" height="40" data-icon="${b.id}"></canvas><span class="t"><b>${b.name}</b></span><span class="p">${sellPrice(shop, b.value)}원</span></button>` : ''))
            .join('') || '<p class="say">가방이 비었다</p>'
        }`
      : '';
    box.innerHTML = `<div class="panel"><header><canvas width="44" height="44" data-icon="${shop.vendor}"></canvas><div><b>${v.name}</b><small>${v.title}</small></div><span class="cash">현금 ${run.cash}${run.debt ? ` · 빚 ${run.debt}` : ''}</span></header>
      <p class="say">「${shop.greet}」</p>${rows}${bag}<p class="msg">${msg}</p><footer><button data-close>나가기</button></footer></div>`;
    box.querySelectorAll<HTMLCanvasElement>('canvas[data-icon]').forEach(c => drawItemIcon(c.getContext('2d')!, c.dataset.icon!, 0, 0, c.width));
    const list = [...box.querySelectorAll<HTMLButtonElement>('.row')];
    sel = Math.max(0, Math.min(sel, list.length - 1));
    list[sel]?.classList.add('sel');
  };
  const press = (b: HTMLElement) => {
    if (!cur) return;
    if (b.dataset.close !== undefined) return close();
    if (b.dataset.sell !== undefined) {
      msg = `${sell(cur.shop, cur.run, +b.dataset.sell)}원 받음`;
      return render();
    }
    const k = b.dataset.k;
    if (!k) return;
    const r = buy(cur.shop, cur.run, k);
    if (r.ok) {
      cur.onBuy(r);
      msg = `받음: ${r.got}`;
    } else msg = WHY[r.why];
    render();
  };
  box.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (b) press(b);
  });
  // 키보드: ↑↓ 고르기, A·E·Enter·Space 사기, Esc 나가기. 게임 입력으로 새지 않게 막는다.
  const onKey = (e: KeyboardEvent) => {
    if (!cur) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (e.repeat) return;
    const list = [...box.querySelectorAll<HTMLButtonElement>('.row')];
    if (e.code === 'Escape' || e.code === 'KeyQ') close();
    else if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      sel = (sel + (e.code === 'ArrowDown' ? 1 : list.length - 1)) % Math.max(1, list.length);
      render();
      list[sel]?.scrollIntoView({ block: 'nearest' });
    } else if (['KeyA', 'KeyE', 'Enter', 'Space'].includes(e.code) && list[sel] && !list[sel].disabled) press(list[sel]);
  };
  window.addEventListener('keydown', onKey, true);

  function close() {
    if (!cur) return;
    const c = cur.onClose;
    cur = null;
    box.hidden = true;
    box.innerHTML = '';
    c?.();
  }
  return {
    open(shop, run, onBuy, onClose) {
      cur = { shop, run, onBuy, onClose };
      sel = 0;
      msg = '';
      box.hidden = false;
      render();
    },
    close,
    isOpen: () => !!cur,
    dispose() {
      window.removeEventListener('keydown', onKey, true);
      box.remove();
    },
  };
}
