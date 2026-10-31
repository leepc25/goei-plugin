// 필드 가게·가방 창 (docs/게임_성장_경제_설계.md 4·5장). 자료·계산은 src/game/world/fieldShop.ts, 돈은 가계부(bridge.wallet), 가방·재고는 bridge.fieldState.
// 창이 열려 있는 동안 게임은 멈춘다(blocking). 마우스·터치로 고르고 Esc로 닫는다.
import { BAG_SLOTS, FIELD_ITEMS, SHOPS, addBag, bagUsed, canAdd, emptyState, give, giftable, haggle, isOpen, parseState, priceOf, sellPriceOf, stockOf, takeBag, type FieldItemDef, type FieldState, type ShopDef } from '../../world/fieldShop';
import type { GameFieldState } from '../../bridge';

const CSS = `
.gf-shop{position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:30;padding:12px;box-sizing:border-box;pointer-events:auto;font-family:system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#e8ecee}
.gf-shop[hidden]{display:none}
.gf-shop .panel{background:#1b2226;border:1px solid #3a464d;border-radius:14px;width:min(580px,100%);max-height:100%;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden}
.gf-shop header{display:flex;align-items:center;gap:10px;padding:14px 16px 8px}
.gf-shop header div{display:flex;flex-direction:column;min-width:0}
.gf-shop header b{font-size:18px}
.gf-shop header small{color:#8a969c}
.gf-shop .won{margin-left:auto;color:#cfe3c8;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.gf-shop .x{width:34px;height:34px;border-radius:9px;border:1px solid #4a565d;background:#2c383e;color:#e8ecee;font:inherit;cursor:pointer}
.gf-shop .tabs{display:flex;gap:6px;padding:0 16px 8px}
.gf-shop .tabs button{font:inherit;font-size:14px;font-weight:700;padding:6px 14px;border-radius:999px;border:1px solid #3a464d;background:transparent;color:#8a969c;cursor:pointer}
.gf-shop .tabs button.on{background:#e8ecee;color:#1b2226;border-color:#e8ecee}
.gf-shop .tabs .sp{flex:1}
.gf-shop .tabs .hg{border-color:#e6d36a;color:#e6d36a}
.gf-shop .list{overflow:auto;padding:0 16px;flex:1;min-height:0}
.gf-shop .row{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;text-align:left;background:#232d32;border:1px solid #33404a;border-radius:10px;color:inherit;font:inherit;padding:8px 10px;margin:0 0 6px;cursor:pointer}
.gf-shop .row:disabled{opacity:.45;cursor:default}
.gf-shop .ic{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;font-weight:900;font-size:13px;color:#1b2226}
.gf-shop .ic.food{background:#e0b060}.gf-shop .ic.drink{background:#7fc0e0}.gf-shop .ic.med{background:#6fcf8a}.gf-shop .ic.gift{background:#e08aa8}.gf-shop .ic.misc{background:#a8b0b4}
.gf-shop .t{display:flex;flex-direction:column;min-width:0}
.gf-shop .t small{color:#8a969c;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gf-shop .p{display:flex;flex-direction:column;align-items:flex-end;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}
.gf-shop .p small{color:#8a969c;font-weight:500;font-size:11.5px}
.gf-shop .p s{color:#8a969c;font-weight:500;font-size:11.5px}
.gf-shop .acts{display:flex;gap:6px}
.gf-shop .acts button{font:inherit;font-size:13px;font-weight:700;padding:6px 10px;border-radius:8px;border:1px solid #4a565d;background:#2c383e;color:#e8ecee;cursor:pointer}
.gf-shop .msg{min-height:22px;color:#9fd9a6;padding:6px 16px 14px}
.gf-shop .msg.bad{color:#ff9d90}
.gf-shop .empty{color:#8a969c;padding:18px 4px}
`;

const won = (n: number) => `${n < 0 ? '−' : ''}₩ ${Math.abs(Math.trunc(n)).toLocaleString('en-US')}`;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** 받침에 맞춘 목적격 조사 */
const eul = (w: string) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return `${w}${c >= 0 && c <= 11171 && c % 28 !== 0 ? '을' : '를'}`; };
const KIND_MARK: Record<FieldItemDef['kind'], string> = { food: '食', drink: '飮', med: '藥', gift: '贈', misc: '物' };

export interface FieldShopHost {
  root: HTMLElement;
  store?: GameFieldState;
  /** 지금 필드 시각 (자정부터 분). 모르면 null */
  minute(): number | null;
  /** 잔고 (모르면 null = 돈 기능 없음) */
  balance(): number | null;
  /** 가계부에 적기 (+ 들어옴, − 나감). 적은 뒤 잔고, 못 적으면 null */
  pay(amount: number, memo: string): Promise<number | null>;
  /** 주인공 체력 비율 회복 */
  heal(ratio: number): void;
  /** 장부 사건 (먹었다·샀다) */
  record(text: string): void;
  /** 흥정 운 (가게 주인 성향이 들어갈 자리) */
  rng(): number;
  /** 확정 사실 (본편 요청에 들어감): 「필드 가방」 = 지금 든 것 */
  fact?(key: string, value: string): void;
  /** 가까이 있는 이름 인물 (선물 상대). 없으면 null */
  nearPerson?(): string | null;
  /** 선물 사건: counts = 오늘 이 사람에게 처음 (인물 기록 호감 계기) */
  gift?(who: string, item: string, counts: boolean): void;
}

export interface FieldShop {
  open(shopId: string): string | null;
  openBag(): void;
  isOpen(): boolean;
  state(): FieldState;
  dispose(): void;
}

export function createFieldShop(h: FieldShopHost): FieldShop {
  if (!document.getElementById('gf-shop-css')) {
    const s = document.createElement('style');
    s.id = 'gf-shop-css';
    s.textContent = CSS;
    document.head.append(s);
  }
  const el = document.createElement('div');
  el.className = 'gf-shop';
  el.hidden = true;
  h.root.append(el);
  let st: FieldState = emptyState();
  let loaded = false;
  void h.store?.load().then((t) => { if (!loaded) { st = parseState(t); loaded = true; } }).catch(() => {});
  let lastBag = '';
  const save = () => {
    void h.store?.save(JSON.stringify(st));
    // 가방이 바뀌었으면 본편에 확정 사실로 (같은 key는 나중 것이 이긴다)
    const bag = Object.entries(st.bag).map(([id, n]) => `${FIELD_ITEMS[id]?.name ?? id}×${n}`).join(', ') || '없음';
    if (bag !== lastBag) { lastBag = bag; h.fact?.('필드 가방', bag); }
  };
  let shop: ShopDef | null = null;
  let tab: 'buy' | 'sell' | 'bag' = 'buy';
  let msg = '';
  let bad = false;
  let discount = 0;
  let busy = false;
  const hour = () => { const m = h.minute(); return m === null ? null : (m / 60) % 24; };
  const day = () => { const m = h.minute(); return m === null ? 0 : Math.floor(m / 1440); };
  const say = (t: string, isBad = false) => ((msg = t), (bad = isBad), render());

  const rowBuy = (it: FieldItemDef, left: number): string => {
    const base = priceOf(it, shop!, { hour: hour() });
    const p = base === null ? null : Math.max(100, Math.round((base * (1 - discount)) / 100) * 100);
    const off = p === null || left <= 0 || busy;
    return `<button class="row" data-buy="${it.id}"${off ? ' disabled' : ''}><span class="ic ${it.kind}">${KIND_MARK[it.kind]}</span><span class="t"><b>${esc(it.name)}</b><small>${esc(it.desc)}</small></span><span class="p">${p === null ? '안 팖' : esc(won(p))}${discount && base !== null ? `<s>${esc(won(base))}</s>` : ''}<small>${left > 0 ? `남은 ${left}` : '품절'}</small></span></button>`;
  };
  const rowSell = (it: FieldItemDef, n: number): string => {
    const p = sellPriceOf(it, shop!, { hour: hour() });
    return `<button class="row" data-sell="${it.id}"${p === null || busy ? ' disabled' : ''}><span class="ic ${it.kind}">${KIND_MARK[it.kind]}</span><span class="t"><b>${esc(it.name)} ×${n}</b><small>${esc(it.desc)}</small></span><span class="p">${p === null ? '안 삼' : esc(won(p))}</span></button>`;
  };
  const rowBag = (it: FieldItemDef, n: number): string => {
    const who = giftable(it) ? h.nearPerson?.() ?? null : null;
    return `<div class="row" style="cursor:default"><span class="ic ${it.kind}">${KIND_MARK[it.kind]}</span><span class="t"><b>${esc(it.name)} ×${n}</b><small>${esc(it.desc)}</small></span><span class="acts">${who ? `<button data-give="${it.id}" data-who="${esc(who)}">${esc(who)}에게 주기</button>` : ''}${it.heal || it.verb ? `<button data-use="${it.id}">${it.kind === 'food' ? '먹기' : it.kind === 'drink' ? '마시기' : '쓰기'}</button>` : ''}<button data-drop="${it.id}">버리기</button></span></div>`;
  };

  function render() {
    const bal = h.balance();
    const bag = Object.entries(st.bag).filter(([id]) => FIELD_ITEMS[id]);
    let list = '';
    if (tab === 'buy' && shop) {
      const stock = stockOf(st, shop, h.minute());
      list = Object.keys(shop.stock).map((id) => rowBuy(FIELD_ITEMS[id], stock[id] ?? 0)).join('');
    } else if (tab === 'sell' && shop) {
      list = bag.length ? bag.map(([id, n]) => rowSell(FIELD_ITEMS[id], n)).join('') : '<p class="empty">가방이 비었어요.</p>';
    } else {
      list = bag.length ? bag.map(([id, n]) => rowBag(FIELD_ITEMS[id], n)).join('') : '<p class="empty">가방이 비었어요. 가게에서 산 물건이 여기에 들어와요.</p>';
    }
    el.innerHTML = `<div class="panel" role="dialog" aria-label="${esc(shop?.name ?? '가방')}">
      <header><div><b>${esc(shop?.name ?? '가방')}</b><small>${esc(shop ? shop.greet : `가방 ${bagUsed(st)}/${BAG_SLOTS}칸`)}</small></div>${bal !== null ? `<span class="won">${esc(won(bal))}</span>` : ''}<button class="x" data-close aria-label="닫기">✕</button></header>
      ${shop ? `<div class="tabs"><button data-tab="buy" class="${tab === 'buy' ? 'on' : ''}">사기</button>${shop.buys ? `<button data-tab="sell" class="${tab === 'sell' ? 'on' : ''}">팔기</button>` : ''}<button data-tab="bag" class="${tab === 'bag' ? 'on' : ''}">가방 ${bagUsed(st)}/${BAG_SLOTS}</button><span class="sp"></span>${shop.haggle && tab === 'buy' && !discount ? '<button class="hg" data-haggle>깎아 주세요</button>' : ''}</div>` : ''}
      <div class="list">${list}</div>
      <div class="msg${bad ? ' bad' : ''}" aria-live="polite">${esc(msg)}</div>
    </div>`;
  }

  async function buyOne(id: string) {
    const it = FIELD_ITEMS[id];
    if (!it || !shop || busy) return;
    const stock = stockOf(st, shop, h.minute());
    if ((stock[id] ?? 0) <= 0) return say('품절이에요.', true);
    if (!canAdd(st, id)) return say(`가방이 가득 찼어요 (${BAG_SLOTS}칸).`, true);
    const base = priceOf(it, shop, { hour: hour() });
    if (base === null) return say('팔지 않는대요.', true);
    const p = Math.max(100, Math.round((base * (1 - discount)) / 100) * 100);
    const bal = h.balance();
    if (bal !== null && bal < p) return say(`잔액이 모자라요 (${won(bal)}).`, true);
    busy = true;
    render();
    const after = bal === null ? 0 : await h.pay(-p, `${shop.name} ${it.name}`);
    busy = false;
    if (after === null) return say('결제하지 못했어요.', true);
    stock[id] = (stock[id] ?? 0) - 1;
    addBag(st, id);
    save();
    say(`${eul(it.name)} 샀어요. −${p.toLocaleString('en-US')}원`);
  }
  async function sellOne(id: string) {
    const it = FIELD_ITEMS[id];
    if (!it || !shop || busy || !st.bag[id]) return;
    const p = sellPriceOf(it, shop, { hour: hour() });
    if (p === null) return say('그건 안 사요.', true);
    busy = true;
    render();
    const after = h.balance() === null ? 0 : await h.pay(p, `${shop.name}에 ${it.name} 팜`);
    busy = false;
    if (after === null) return say('받지 못했어요.', true);
    takeBag(st, id);
    save();
    say(`${eul(it.name)} 팔았어요. +${p.toLocaleString('en-US')}원`);
  }
  function useOne(id: string) {
    const it = FIELD_ITEMS[id];
    if (!it || !takeBag(st, id)) return;
    if (it.heal) h.heal(it.heal);
    h.record(`{user} ${({ 먹었다: 'ate', 마셨다: 'drank', 피웠다: 'smoked' } as Record<string, string>)[it.verb ?? ''] ?? 'used'} ${it.name}.`);   // 모델에게 가는 장부 글은 영어 (10-31)
    save();
    say(`${eul(it.name)} ${it.verb ?? '썼다'}.${it.heal ? ` 체력 +${Math.round(it.heal * 100)}%` : ''}`);
  }

  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === el || t.closest('[data-close]')) return close();
    const b = t.closest<HTMLElement>('[data-buy],[data-sell],[data-use],[data-drop],[data-give],[data-tab],[data-haggle]');
    if (!b || (b as HTMLButtonElement).disabled) return;
    if (b.dataset.tab) return ((tab = b.dataset.tab as typeof tab), (msg = ''), render());
    if (b.dataset.buy) return void buyOne(b.dataset.buy);
    if (b.dataset.sell) return void sellOne(b.dataset.sell);
    if (b.dataset.use) return useOne(b.dataset.use);
    if (b.dataset.drop) { takeBag(st, b.dataset.drop); save(); return say('버렸어요.'); }
    if (b.dataset.give && b.dataset.who) {
      const it = FIELD_ITEMS[b.dataset.give];
      const r = give(st, b.dataset.give, b.dataset.who, day());
      if (!r.ok || !it) return;
      save();
      h.gift?.(b.dataset.who, it.name, r.counts);
      return say(r.counts ? `${b.dataset.who}에게 ${eul(it.name)} 건넸다.` : `${b.dataset.who}에게 ${eul(it.name)} 건넸다. (오늘은 이미 선물해서 호감엔 안 셈)`);
    }
    if (b.hasAttribute('data-haggle') && shop) {
      const d = haggle(st, shop, day(), h.rng);
      save();
      if (d > 0) { discount = d; return say(`「에이, ${Math.round(d * 100)}% 빼 줄게.」`); }
      return say((st.shops[shop.id]?.haggleFail ?? 0) >= 2 ? '「오늘은 더 못 깎아.」' : '「그 값이 최선이에요.」', true);
    }
  });
  const onKey = (e: KeyboardEvent) => { if (!el.hidden && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  window.addEventListener('keydown', onKey, true);

  function close() {
    el.hidden = true;
    shop = null;
    discount = 0;
  }
  return {
    open(id) {
      const def = SHOPS[id];
      if (!def) return null;
      if (!isOpen(def, hour())) return `${def.name} 문이 닫혀 있다 (${String(def.hours[0]).padStart(2, '0')}:00~${String(def.hours[1] % 24).padStart(2, '0')}:00)`;
      shop = def;
      tab = 'buy';
      msg = '';
      bad = false;
      discount = 0;
      el.hidden = false;
      render();
      return null;
    },
    openBag() {
      shop = null;
      tab = 'bag';
      msg = '';
      el.hidden = false;
      render();
    },
    isOpen: () => !el.hidden,
    state: () => st,
    dispose() {
      window.removeEventListener('keydown', onKey, true);
      el.remove();
    },
  };
}
