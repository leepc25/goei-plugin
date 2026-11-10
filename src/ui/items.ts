// 소지품 메뉴 (2026-11-07 사용자 설계, docs/인계/소지품_1107/초안/mock2.mjs 가 그림 초안):
// 하위 탭 [가계부 | 소지품]. 가계부는 기록 메뉴에서 여기로 옮겨 왔다 (ui/wallet.ts 그대로).
// 소지품: 도구 줄(칸 수 알약 · 넘침 배지 · 물건|기록 토글 · PC는 직접 넣기·합치기 · 찾기) + 세 상자 (2026-11-07 밤 사용자, memory goei-equip-design):
//   「장착」(왼쪽 아바타 + 무기 2 · 장비 4) → 소지품 격자(8열) → 「사용」(놓는 만큼 늘어남). 버리기는 끄는 동안만 붉은 띠로.
// 끌어다 놓기(PC): 격자 → 장착 칸(장착) · 사용 상자(×n) · 버리기(한 번 확인), 장착 칸 → 격자(풀기). 팝업 단추(사용·장착·버리기)는 폰용으로 남김.
// 칸을 올리면 설명 말풍선(PC), 누르면 팝업. 폰은 직접 넣기·합치기가 아래 도구 줄에.
// 플러그인은 막지도 경고하지도 않는다: 칸이 넘치면 넘친 칸을 붉은 테두리로 보여 줄 뿐, 푸는 건 본편 응답 (core/items.ts).
import type { ChatContext } from '../host/risu';
import { updateChat } from '../host/risu';
import { refreshUseBox } from '../host/usebox';
import { itemIconStatus, itemIconUrl } from '../host/itemicons';
import { aliveAnchors } from '../core/wallet';
import {
  addItem, addUse, canMerge, canUse, invOn, dropUse, EQUIP_LABEL, EQUIP_SLOTS, equipItem, equippedOf, gridItems, isEquipped, ITEM_USE_AT_VAR, itemCarry, itemEditOn, itemLeft, itemSlots, itemUseVars, itemWeight, itemsVars, lastBotKey, liveItems, mergeItems,
  readItemUse, readItems, removeItem, searchItems, setItemLeft, STATE_LABEL, lineWeight, totalWeight, unequipItem, updateItem, weightText,
  type Item, type ItemEquip, type ItemLog, type Items, type ItemUse,
} from '../core/items';
import { findStatusTags } from '../core/world/status';
import { messageKey } from '../core/people/store';
import { drawerBox, drawerHtml } from './drawer';
import { ICONS } from './icons';
import { ITEM_ICON } from './itemIcons';
import { isPhone } from './media';
import { toast } from './toast';
import { walletOn, walletPane, walletTools, walletUi } from './wallet';
import { pointsOn } from '../core/points';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export type ItemsSub = 'wallet' | 'points' | 'items';
export interface ItemsNav { sub: ItemsSub; view: 'grid' | 'log'; open: string }

/** 소지품 메뉴 상태 (채팅이 바뀌면 resetItems). open = 팝업에 띄운 물건 id, mode = 팝업 안 화면 */
export const itemsUi = {
  sub: 'items' as ItemsSub,
  view: 'grid' as 'grid' | 'log',
  /** 기록 거르기: 전체 · 획득 · 사용 (사용 = 쓰기·버리기·없어짐·합침·팖) */
  logFilter: 'all' as 'all' | 'get' | 'out',
  q: '',
  open: '',
  mode: 'view' as 'view' | 'edit' | 'merge' | 'add' | 'drop',
  /** 버리기 띠에 끌어다 놓아 연 확인창: 취소하면 물건 팝업으로 가지 않고 닫는다 (2026-11-08 사용자) */
  dragDrop: false,
  notice: '',
  info: '',
};

export function resetItems(): void {
  Object.assign(itemsUi, { sub: 'items', view: 'grid', q: '', open: '', mode: 'view', dragDrop: false, notice: '', info: '' });
}
export const itemsNav = (): ItemsNav => ({ sub: itemsUi.sub, view: itemsUi.view, open: itemsUi.open });
export function applyItemsNav(n: ItemsNav): void {
  Object.assign(itemsUi, { sub: n.sub === 'wallet' || n.sub === 'points' ? n.sub : 'items', view: n.view === 'log' ? 'log' : 'grid', open: n.open ?? '', mode: 'view', notice: '' });
}

export const itemsOf = (ctx: ChatContext): Items => readItems(ctx.chat.scriptstate);
export const liveOf = (ctx: ChatContext): Item[] => liveItems(itemsOf(ctx), aliveAnchors(ctx.chat));

/** 물건 그림: PixelLab 그림 팩(host/itemicons.ts)에서 그림 낱말·이름으로 찾고, 없거나 아직 못 받았으면 공통 선 아이콘 */
export function itemPic(it: { name: string; icon?: string }): string {
  const u = itemIconUrl(it.name, it.icon);
  return u ? `<img src="${u}" alt="" draggable="false">` : ITEM_ICON;
}

/** 판정 글: 「무기 · 사용 · 남은 3 · 1.2kg · 손상」 */
export function traitsLine(it: Item, left: number | undefined): string {
  return [it.equip ? EQUIP_LABEL[it.equip] : '', left !== undefined ? `남은 ${left}` : it.use ? '사용' : '', it.weight !== undefined ? (it.uses !== undefined ? `${weightText(lineWeight(it, left)!)} (1개 ${weightText(it.weight)})` : weightText(it.weight)) : '', it.state !== 'ok' ? STATE_LABEL[it.state] : ''].filter(Boolean).join(' · ');
}

const FROM_NAME: Record<Item['from'], string> = { store: '상점', story: '본문', manual: '직접' };

/** 기준 메시지 → 그때 상태창 날짜·시각 (RP 시간, 가계부 datesOf 와 같은 셈). 2026-11-07 사용자: 현실 날짜가 아니라 RP 날짜·시각을 보여야 한다 */
interface When { at: Map<string, string>; last: string }
function whenOf(ctx: ChatContext): When {
  const at = new Map<string, string>();
  let cur = '';
  (ctx.chat.message ?? []).forEach((m, i) => {
    const tags = findStatusTags(String((m as { data?: unknown }).data ?? ''));
    if (tags.length) {
      const t = tags[tags.length - 1];
      const d = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(t.date ?? '');
      const date = d ? `${d[1]}.${d[2].padStart(2, '0')}.${d[3].padStart(2, '0')}` : (t.date ?? '').trim();
      const next = [date, (t.time ?? '').trim()].filter(Boolean).join(' ');
      if (next) cur = next;
    }
    at.set(messageKey(m, i), cur);
  });
  return { at, last: cur };
}
/** 현실 시각 (KST) — 상태창이 없는 채팅에서만 */
const realOf = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${g('year')}.${g('month')}.${g('day')} ${g('hour')}:${g('minute')}`;
};
/** 줄의 때: 기준 메시지의 RP 날짜·시각 → 없으면(직접 넣기·버리기) 마지막 RP 시각 → 상태창이 없으면 현실 시각 */
const whenLabel = (w: When, anchor: string, iso: string) => (anchor ? w.at.get(anchor) : '') || w.last || realOf(iso);
const sourceLine = (it: Item, w: When) => [FROM_NAME[it.from], whenLabel(w, it.anchor, it.at), Number.isSafeInteger(it.price) ? `₩ ${it.price!.toLocaleString('en-US')}` : ''].filter(Boolean).join(' · ');

/** 이 채팅의 「사용」 자리 (이미 보낸 턴의 것은 비어 보인다) */
export function useQueue(ctx: ChatContext): ItemUse[] {
  return ctx.chat.scriptstate?.[ITEM_USE_AT_VAR] ? [] : readItemUse(ctx.chat.scriptstate);
}
const leftOf = (ctx: ChatContext, it: Item) => itemLeft(itemsOf(ctx), it, aliveAnchors(ctx.chat));

// ── 화면 ──

export function itemsTab(ctx: ChatContext): string {
  // 꺼진 쪽 하위 탭은 빼고(2026-11-07 사용자: 가계부·소지품 따로 켜고 끔), 지금 탭이 꺼졌으면 켜진 쪽으로
  // 포인트 (2026-11-08 사용자 「탭을 늘려」): 신분이 백일몽일 때만, 가계부 옆 같은 높이의 탭 (core/points.ts)
  const SUBS = ([['wallet', '가계부'], ['points', '포인트'], ['items', '소지품']] as [ItemsSub, string][]).filter(([v]) => (v === 'wallet' ? walletOn(ctx) : v === 'points' ? pointsOn(ctx.chat) : invOn(ctx.chat.scriptstate)));
  if (SUBS.length && !SUBS.some(([v]) => v === itemsUi.sub)) itemsUi.sub = SUBS[0][0];
  const tabs = `<div class="ph-subs gx-rec-tabs it-tabs" role="tablist">${SUBS.map(([v, l]) => `<button role="tab" class="ph-sub${itemsUi.sub === v ? ' on' : ''}" data-action="items-sub" data-value="${v}" aria-selected="${itemsUi.sub === v}" aria-pressed="${itemsUi.sub === v}">${l}</button>`).join('')}</div>`;
  const note = toast('items', itemsUi.info, (t) => {
    if (itemsUi.info === t) itemsUi.info = '';
  });
  if (itemsUi.sub === 'wallet' || itemsUi.sub === 'points') {
    const kind = itemsUi.sub === 'points' ? 'p' : 'won';
    walletUi.kind = kind;
    const drawer = isPhone() && (kind === 'p' || walletOn(ctx)) ? drawerBox(walletTools(ctx), 'gx-rdrawer') : '';
    return `<main class="gx-body gx-records gx-items">${tabs}${walletPane(ctx, kind)}${note}</main>${drawer}`;
  }
  const notice = itemsUi.notice ? `<div class="gx-err" role="alert">${esc(itemsUi.notice)}</div>` : '';
  // 폰: 직접 넣기·합치기는 아래 도구 줄 (하단 바 바로 위, 늘 보인다)
  const drawer = isPhone() ? drawerHtml(`${addButton('ph-tool')}${mergeButton(ctx, 'ph-tool')}`, '', 'gx-idrawer') : '';
  // PC 격자: 탭·도구 줄·장착 띠는 고정하고 격자만 스크롤 (it-fix, 2026-11-08 사용자)
  const fix = !isPhone() && itemsUi.view === 'grid' ? ' it-fix' : '';
  return `<main class="gx-body gx-records gx-items${fix}">${tabs}${notice}${itemsPane(ctx)}${note}</main>${popup(ctx)}${drawer}`;
}

const addButton = (cls: string) => `<button class="${cls} it-add" data-action="items-add" aria-label="직접 넣기">${ICONS.plus}<span class="${cls === 'ph-tool' ? 'ph-tool-l' : ''}">직접 넣기</span></button>`;
/** 합칠 상대가 있는 물건 (둘 다 소모성 + 이름에 같은 낱말) */
const mergeMates = (ctx: ChatContext, it: Item): Item[] => liveOf(ctx).filter((o) => canMerge(it, o));
function mergeButton(ctx: ChatContext, cls: string): string {
  const any = liveOf(ctx).some((it) => mergeMates(ctx, it).length);
  return `<button class="${cls} it-merge" data-action="items-merge-start" aria-label="합치기" title="같은 소모품끼리 합쳐요 (이름에 같은 낱말)" ${any ? '' : 'disabled'}>${ICONS.refresh}<span class="${cls === 'ph-tool' ? 'ph-tool-l' : ''}">합치기</span></button>`;
}

/** 칸 수·넘침·무게 (장착 칸 위 한 줄). 모두 같은 꼴의 칸(.it-stat), 넘치면 붉은 칸 */
function statsRow(ctx: ChatContext, live: Item[]): string {
  const carried = gridItems(live).length;
  const slots = itemSlots(ctx.chat.scriptstate);
  const over = Math.max(0, carried - slots);
  return `<div class="it-stats"><span class="it-stat${over ? ' over' : ''}" title="칸 ${carried} / ${slots}${over ? ` (${over}칸 넘침)` : ''}">${ICONS.bag}<b>${carried}</b><small>/ ${slots}</small>${over ? `<em>+${over}</em>` : ''}</span>${weightPill(ctx, live)}</div>`;
}

function itemsPane(ctx: ChatContext): string {
  const seg = (v: 'grid' | 'log', label: string) => `<button class="gx-seg${itemsUi.view === v ? ' on' : ''}" data-action="items-view" data-value="${v}" aria-pressed="${itemsUi.view === v}">${label}</button>`;
  // 도구 줄 (2026-11-08 사용자): 왼쪽 물건|기록, 오른쪽 직접 넣기·합치기·찾기. 칸 수·넘침·무게는 장착 띠의 장착 칸 위로 (equipBox)
  const tools = `<div class="gx-rec-tools gx-wt-tools it-tools">
    <div class="gx-segs gx-segs-sm it-segs">${seg('grid', '물건')}${seg('log', '기록')}</div>
    <span class="it-right">${isPhone() ? '' : `${addButton('it-act')}${mergeButton(ctx, 'it-act')}`}<input class="gx-wt-q it-q" type="search" data-input="items-q" value="${esc(itemsUi.q)}" placeholder="찾기: 물건·기록" aria-label="물건·기록 찾기"></span>
  </div>`;
  // 그림 팩(host/itemicons.ts): 처음 열 때 받는다. 받는 동안·실패는 한 줄로만 알리고, 그림은 선 아이콘으로 대신한다
  const st = itemIconStatus();
  const picNote = st.loading ? `<p class="it-picnote">물건 그림 받는 중… ${esc(st.progress)}</p>` : st.failed ? `<p class="it-picnote">물건 그림을 받지 못해 기본 아이콘으로 보여요. (${esc(st.failed)})</p>` : '';
  if (itemsUi.view === 'log') return `${tools}${picNote}<div class="it-body">${logList(ctx)}</div>`;
  // 격자만 스크롤 (2026-11-08 사용자): 탭·도구 줄·장착 띠는 고정, .it-scroll 안에서만. 버리기 띠는 그 위에 뜬다 (격자 줄 수와 상관없이 같은 높이)
  return `${tools}${picNote}${equipBox(ctx, 'items')}<div class="it-scrollwrap"><div class="it-body it-scroll">${gridHtml(ctx)}</div><div class="it-trash" data-drop="drop" aria-hidden="true">${ICONS.close}<span>여기에 놓으면 버려요</span></div></div>`;
}

/** 무게 합 알약 (2026-11-08 사용자): 장착한 것까지 전부 더한 무게 / 소지 한도. 넘으면 넘은 만큼 붉은색이 점점 진해진다 (막지 않음).
 *  --ov: 0~1 = 넘은 무게 ÷ 한도 (한도의 두 배면 가장 진함) */
function weightPill(ctx: ChatContext, live: Item[]): string {
  const w = totalWeight(live, (e) => leftOf(ctx, e));
  const cap = itemCarry(ctx.chat.scriptstate);
  const ov = w > cap ? Math.min(1, (w - cap) / cap) : 0;
  const num = (n: number) => String(Number(n.toFixed(1)));
  return `<span class="it-stat it-wgt${w > cap ? ' over' : ''}"${w > cap ? ` style="--ov:${ov.toFixed(3)}"` : ''} title="무게 ${num(w)}kg / 소지 한도 ${num(cap)}kg${w > cap ? ` (${num(w - cap)}kg 넘음)` : ''}">${ICONS.weight}<b>${num(w)}</b><small>/ ${num(cap)}kg</small></span>`;
}

/** 아바타 자리 (고른 아바타의 정면 대기 동작). 고르기 전·고유 인물이 아니면 빈 자리 */
let avatarHtml: (ctx: ChatContext) => string = () => '';
export function setAvatarHtml(fn: (ctx: ChatContext) => string): void {
  avatarHtml = fn;
}

/**
 * 「장착」 띠 (2026-11-08 사용자): 제목·「무기/장비」 글자 없이 [아바타 전신 | 장착 칸 | 사용칸].
 * 장착 칸 차례는 무기 2 → 장비 4 — PC 3열(무기·무기·장비 / 장비·장비·장비), 폰 2열(무기·무기 / 장비·장비 / 장비·장비). 무기 칸은 색이 다르고, 빈 칸은 기호로 갈래를 보인다.
 * where = 'items'(끌어다 놓기·누르면 팝업, 오른쪽에 사용칸) · 'sell'(상점 팔기: 아바타·사용칸 없이 칸만, 누르면 그 물건을 팔 물건으로)
 * 칸 data-drop="equip:갈래:번호" — 끌어 온 물건이 그 갈래가 아니면 놓이지 않는다 (app.ts 끌기 처리)
 */
export function equipBox(ctx: ChatContext, where: 'items' | 'sell', sel = ''): string {
  const { av, slots } = equipParts(ctx, where, sel);
  // 상점 팔기 (2026-11-08 사용자): 장착한 게 없어도 아바타와 빈 칸을 늘 보인다. 사용은 소지품 화면에서만 (사용자: 상점에서까지 쓰면 복잡)
  if (where === 'sell') return `<section class="it-box it-eqbox sell" aria-label="장착"><div class="it-eqin">${av ? `<div class="it-av">${av}</div>` : ''}${slots}</div></section>`;
  return `<section class="it-box it-eqbox" aria-label="장착"><div class="it-eqin">${av ? `<div class="it-av">${av}</div>` : ''}<div class="it-eqcol">${statsRow(ctx, liveOf(ctx))}${slots}</div>${useBox(ctx)}</div></section>`;
}

/** 장착 띠 조각: 아바타 · 장착 칸(무기 2 → 장비 4). 상점 팔기(PC)는 이 둘을 소지품 격자와 한 상자에 엮는다 (ui/shop.ts pickHtml) */
export function equipParts(ctx: ChatContext, where: 'items' | 'sell', sel = ''): { av: string; slots: string } {
  const live = liveOf(ctx);
  const eq = equippedOf(live);
  const slot = (k: ItemEquip, i: number) => {
    const it = eq[k][i];
    if (!it) return `<div class="it-slot it-s-${k} empty" data-drop="equip:${k}:${i}" aria-label="${EQUIP_LABEL[k]} 빈 칸" title="${EQUIP_LABEL[k]}"><span class="it-ic">${ICONS[k]}</span></div>`;
    const act = where === 'sell' ? 'shop-sell-pick' : 'items-open';
    return `<button class="it-slot it-s-${k}${stateCls(it)}${(where === 'sell' ? sel : itemsUi.open) === it.id ? ' sel' : ''}" data-action="${act}" data-value="${esc(it.id)}" data-drop="equip:${k}:${i}"${where === 'items' && !isPhone() ? ` draggable="true" data-drag="${esc(it.id)}" data-equip="${k}"${canUse(it) ? ' data-usable="1"' : ''}` : ''} aria-label="${esc(it.name)} (${EQUIP_LABEL[k]})"><span class="it-ic">${itemPic(it)}${wtMark(it, leftOf(ctx, it))}</span>${marks(it, leftOf(ctx, it))}${tipOf(it, leftOf(ctx, it), whenOf(ctx))}</button>`;
  };
  const slots = `<div class="it-eqslots">${(['weapon', 'gear'] as const).flatMap((k) => Array.from({ length: EQUIP_SLOTS[k] }, (_, i) => slot(k, i))).join('')}</div>`;
  return { av: avatarHtml(ctx), slots };
}

/** 「사용」칸 (장착 띠 오른쪽): 다음 메시지에 같이 보낼 물건 (칸 수 정하지 않음, 같은 물건 또 놓으면 ×2). 비면 안내 한 줄 */
function useBox(ctx: ChatContext): string {
  const live = liveOf(ctx);
  const q = useQueue(ctx).flatMap((u) => {
    const it = live.find((x) => x.id === u.id);
    return it ? [{ it, n: u.n }] : [];
  });
  const chips = q.map(({ it, n }) => `<span class="it-uchip"><span class="it-ic">${itemPic(it)}</span><b>${esc(it.name)}</b>${n > 1 ? `<em>×${n}</em>` : ''}<button class="it-ux" data-action="items-unuse" data-value="${esc(it.id)}" aria-label="${esc(it.name)} 사용 취소">${ICONS.close}</button></span>`).join('');
  return `<div class="it-usebox${q.length ? '' : ' empty'}" data-drop="use" aria-label="사용"><span class="it-ulab">사용</span><div class="it-uchips">${chips || `<p class="it-uhint">${isPhone() ? '물건을 눌러 「사용」을 고르면 여기에 모여요.' : '쓸 물건을 여기에 끌어다 놓으면 다음 메시지에 같이 보내요.'}</p>`}</div></div>`;
}

/** 무게 (2026-11-08 사용자): 그림 오른쪽 아래에 작게. 1개당 무게 × 남은 개수 */
const wtMark = (it: Item, left: number | undefined) => {
  const w = lineWeight(it, left);
  return w !== undefined ? `<span class="it-wt" title="무게">${weightText(w)}</span>` : '';
};
const stateCls = (it: Item) => (it.state === 'broken' ? ' broken' : it.state === 'damaged' ? ' damaged' : '');
/** 칸 위 표시: 남은 횟수 · 손상(노란 금) · 고장(붉은 표시) */
function marks(it: Item, left: number | undefined): string {
  return `${left !== undefined ? `<span class="it-left" title="남은 횟수">${left}</span>` : ''}${it.state === 'damaged' ? '<span class="it-crack" title="손상" aria-hidden="true"></span>' : it.state === 'broken' ? '<span class="it-brk" title="고장">고장</span>' : ''}`;
}
function tipOf(it: Item, left: number | undefined, w: When): string {
  const tr = traitsLine(it, left);
  return `<span class="it-tip" aria-hidden="true"><b>${esc(it.name)}</b><small>${esc([tr, sourceLine(it, w)].filter(Boolean).join(' · '))}</small>${it.desc ? `<p>${esc(it.desc)}</p>` : ''}${it.effect ? `<p class="ef">효과: ${esc(it.effect)}</p>` : ''}</span>`;
}

/** 격자: 장착 칸에 놓인 것 빼고 → 빈 칸(칸 수까지) → 넘친 물건(붉은 테두리). 찾는 중이면 맞는 것만(장착한 것도), 빈 칸 없음 */
export function gridHtml(ctx: ChatContext): string {
  const slots = itemSlots(ctx.chat.scriptstate);
  const q = itemsUi.q.trim();
  const live = liveOf(ctx);
  const list = q ? searchItems(itemsOf(ctx), aliveAnchors(ctx.chat), q).items : gridItems(live);
  if (q && !list.length) return `<p class="gx-wt-empty">맞는 물건이 없어요.</p>`;
  const w = whenOf(ctx);
  const queued = new Map(useQueue(ctx).map((u) => [u.id, u.n]));
  const cells = list.map((it, i) => cell(ctx, it, !q && i >= slots, w, queued.get(it.id) ?? 0));
  if (!q) for (let i = list.length; i < slots; i++) cells.push('<div class="it-c empty" aria-hidden="true"><span class="it-ic"></span><b>&nbsp;</b></div>');
  return `<div class="it-grid" data-drop="grid">${cells.join('')}</div>`;
}

function cell(ctx: ChatContext, it: Item, over: boolean, w: When, queued: number): string {
  const left = leftOf(ctx, it);
  // 「사용 예정」: 소모성은 남은 횟수를 다 놓았을 때만 흐리게, 아니면 놓은 수만 표시
  const all = queued > 0 && (left === undefined || queued >= left);
  const drag = !isPhone() ? ` draggable="true" data-drag="${esc(it.id)}"${it.equip ? ` data-equip="${it.equip}"` : ''}${canUse(it) ? ' data-usable="1"' : ''}` : '';
  return `<button class="it-c${over ? ' over' : ''}${itemsUi.open === it.id ? ' sel' : ''}${all ? ' queued' : ''}${stateCls(it)}" data-action="items-open" data-value="${esc(it.id)}"${drag} aria-label="${esc(it.name)}${over ? ' (넘침)' : ''}${queued ? ' (사용 예정)' : ''}"><span class="it-ic">${itemPic(it)}${wtMark(it, left)}</span>${marks(it, left)}${queued ? `<span class="it-q8">사용 예정${queued > 1 ? ` ×${queued}` : ''}</span>` : ''}<b>${esc(it.name)}</b>${tipOf(it, left, w)}</button>`;
}

const WHAT: Record<ItemLog['what'], string> = { get: '획득', use: '사용', drop: '버림', gone: '없어짐', destroy: '파괴', merge: '합침', sell: '팖' };
const BY: Record<ItemLog['by'], string> = { story: '본문', manual: '직접', use: '사용 단추', store: '상점' };
const WEEK = '일월화수목금토';
/** 「2025.05.10 15:41」 → 「2025.05.10 (토)」 (가계부 날짜 줄과 같은 꼴) */
function dayOf(when: string): string {
  const m = /(\d{4})\.(\d{2})\.(\d{2})/.exec(when);
  if (!m) return when.split(' ')[0] || '날짜 없음';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${m[1]}.${m[2]}.${m[3]} (${WEEK[d.getUTCDay()]})`;
}

/** 기록: 가계부와 같은 꼴 — 거르기 칩(전체·획득·사용) + RP 날짜별 묶음, 줄 앞 물건 그림, 최근 것부터 (2026-11-07 사용자) */
function logList(ctx: ChatContext): string {
  const q = itemsUi.q.trim();
  const all = q ? searchItems(itemsOf(ctx), aliveAnchors(ctx.chat), q).log : itemsOf(ctx).log.slice().reverse();
  const rows = all.filter((l) => (itemsUi.logFilter === 'get' ? l.what === 'get' : itemsUi.logFilter === 'out' ? l.what !== 'get' : true));
  const chip = (v: typeof itemsUi.logFilter, label: string, n: number) => `<button class="gx-chip${itemsUi.logFilter === v ? ' on' : ''}" data-action="items-log-filter" data-value="${v}" aria-pressed="${itemsUi.logFilter === v}">${label}${n ? ` <small>${n}</small>` : ''}</button>`;
  const got = all.filter((l) => l.what === 'get').length;
  const chips = `<div class="gx-rec-tools it-logchips">${chip('all', '전체', all.length)}${chip('get', '획득', got)}${chip('out', '사용', all.length - got)}</div>`;
  if (!rows.length) return `${chips}<p class="gx-wt-empty">${q ? '맞는 기록이 없어요.' : itemsUi.logFilter === 'get' ? '아직 획득한 물건이 없어요.' : itemsUi.logFilter === 'out' ? '아직 사용 기록이 없어요. 물건을 쓰거나 버리면 여기에 쌓여요.' : '아직 기록이 없어요. 물건을 얻거나 쓰면 여기에 쌓여요.'}</p>`;
  const w = whenOf(ctx);
  const pic = (l: ItemLog) => itemPic(l);
  const row = (l: ItemLog) => {
    const when = whenLabel(w, l.anchor, l.at);
    const sub = [BY[l.by] ?? l.by, l.what === 'use' && (l.n ?? 1) > 1 ? `×${l.n}` : '', l.note, l.quote ? `「${l.quote}」` : ''].filter(Boolean).join(' · ');
    return `<li class="gx-wt-row"><div class="gx-wt-main"><span class="it-ic">${pic(l)}</span><span class="gx-wt-memo"><b>${esc(l.name)} <em class="it-what ${l.what === 'get' ? 'get' : 'out'}">${WHAT[l.what] ?? l.what}</em></b><small>${esc(sub)}</small></span><span class="gx-wt-amt"><small>${esc(when.split(' ')[1] ?? when)}</small></span></div></li>`;
  };
  // RP 날짜별 묶음 (가계부처럼). 같은 날은 한 묶음, 묶음 머리에 획득·사용 수
  const groups: { day: string; rows: ItemLog[] }[] = [];
  for (const l of rows) {
    const day = dayOf(whenLabel(w, l.anchor, l.at));
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.rows.push(l);
    else groups.push({ day, rows: [l] });
  }
  return `${chips}<div class="gx-wallettab it-log">${groups.map((g) => {
    const gi = g.rows.filter((l) => l.what === 'get').length;
    const go = g.rows.length - gi;
    return `<section class="gx-wt-day"><h3><span>${esc(g.day)}</span><em>${[gi ? `획득 ${gi}` : '', go ? `사용 ${go}` : ''].filter(Boolean).join(' · ')}</em></h3><ul>${g.rows.map(row).join('')}</ul></section>`;
  }).join('')}</div>`;
}

// ── 팝업 ──

function popup(ctx: ChatContext): string {
  if (itemsUi.mode === 'add') return shell('직접 넣기', form(null));
  if (!itemsUi.open) return '';
  const it = liveOf(ctx).find((x) => x.id === itemsUi.open);
  if (!it) return '';
  if (itemsUi.mode === 'edit' && itemEditOn(ctx.chat.scriptstate)) return shell('고치기', form(it, leftOf(ctx, it)));
  if (itemsUi.mode === 'merge') return shell('합치기', mergePick(ctx, it));
  const head = `<div class="it-ph"><span class="it-ic">${itemPic(it)}</span><div><b>${esc(it.name)}</b><small>${esc([traitsLine(it, leftOf(ctx, it)), sourceLine(it, whenOf(ctx))].filter(Boolean).join(' · '))}</small></div></div>`;
  if (itemsUi.mode === 'drop') {
    return shell('버리기', `${head}<p>버릴까요? 목록에서 빠지고 기록에 남아요.</p><div class="it-btns"><button class="gx-chip red" data-action="items-drop" data-value="${esc(it.id)}">버리기</button><button class="gx-chip" data-action="items-back">취소</button></div>`);
  }
  const queued = useQueue(ctx).find((u) => u.id === it.id)?.n ?? 0;
  const left = leftOf(ctx, it);
  const more = canUse(it) && (left === undefined ? !queued : queued < left);
  const equipped = isEquipped(it, liveOf(ctx));
  const body = `${head}
    ${it.desc ? `<p>${esc(it.desc)}</p>` : '<p class="dim">설명 없음</p>'}
    ${it.effect ? `<p class="ef">효과: ${esc(it.effect)}</p>` : ''}
    ${it.state === 'broken' ? '<p class="bad">고장 나서 쓸 수 없어요.</p>' : ''}
    ${it.text ? `<div class="it-note">${esc(it.text)}</div>` : ''}
    ${it.quote ? `<p class="qt">근거 「${esc(it.quote)}」</p>` : ''}
    <div class="it-btns">
      ${it.use ? `<button class="gx-chip${queued ? ' on' : ''}" data-action="items-use" data-value="${esc(it.id)}" ${more || queued ? '' : 'disabled'}>${queued ? (more ? `한 번 더 (×${queued + 1})` : `사용 ×${queued}`) : '사용'}</button>` : ''}
      ${queued ? `<button class="gx-chip" data-action="items-unuse" data-value="${esc(it.id)}">사용 취소</button>` : ''}
      ${it.equip ? `<button class="gx-chip" data-action="${equipped ? 'items-unequip' : 'items-equip'}" data-value="${esc(it.id)}">${equipped ? '장착 풀기' : '장착'}</button>` : ''}
      ${itemEditOn(ctx.chat.scriptstate) ? '<button class="gx-chip" data-action="items-edit">고치기</button>' : ''}
      ${it.uses !== undefined ? `<button class="gx-chip" data-action="items-merge" ${mergeMates(ctx, it).length ? '' : 'disabled'} title="이름에 같은 낱말이 있는 소모품끼리 합쳐요">합치기</button>` : ''}
      <button class="gx-chip red" data-action="items-drop-ask" data-value="${esc(it.id)}">버리기</button>
    </div>
    ${queued ? '<p class="dim">다음 메시지를 보낼 때 본편에 「이번 턴 사용」으로 넘어가요.</p>' : ''}`;
  return shell(it.name, body);
}

const shell = (label: string, inner: string) => `<div class="gx-agpop it-pop" data-action="items-close" role="dialog" aria-label="${esc(label)}"><div class="gx-agpop-card it-card" data-action="items-keep"><button class="gx-agpop-x" data-action="items-close" aria-label="닫기">${ICONS.close}</button>${inner}</div></div>`;

function form(it: Item | null, left?: number): string {
  const eq = it?.equip ?? '';
  const opt = (v: string, l: string) => `<option value="${v}"${eq === v ? ' selected' : ''}>${l}</option>`;
  // 폼 요소를 쓰지 않는다: 플러그인 창 iframe 에 allow-forms 가 없어 submit 이 오지 않는다 (tests/qc-settings-static). 저장은 단추의 data-action 으로
  return `<div class="it-form" data-it-form="1">
    <label><span>이름</span><input name="name" maxlength="30" required value="${esc(it?.name ?? '')}" placeholder="예: 소금 봉지"></label>
    <label><span>설명</span><input name="desc" maxlength="80" value="${esc(it?.desc ?? '')}" placeholder="양·상태도 글로 (예: 두 봉지 남음)"></label>
    <label><span>효과</span><input name="effect" maxlength="60" value="${esc(it?.effect ?? '')}" placeholder="있으면 (예: 저급 괴이의 접근을 늦춘다)"></label>
    <label><span>장착</span><select name="equip">${opt('', '없음')}${opt('weapon', '무기')}${opt('gear', '장비')}</select></label>
    <label class="it-chk"><span>사용</span><span><input type="checkbox" name="use"${it?.use ? ' checked' : ''}> 쓸 수 있음</span></label>
    <label><span>횟수</span><input name="uses" type="number" min="1" max="999" inputmode="numeric" value="${left ?? it?.uses ?? ''}" placeholder="소모성이면 남은 횟수 (비우면 닳지 않음)"></label>
    <label><span>무게(1개)</span><input name="weight" type="number" min="0" step="0.001" inputmode="decimal" value="${it?.weight ?? ''}" placeholder="kg"></label>
    <div class="it-btns"><button type="button" class="gx-chip on" data-action="items-save" data-value="${esc(it?.id ?? '')}">${it ? '저장' : '넣기'}</button><button type="button" class="gx-chip" data-action="${it ? 'items-back' : 'items-close'}">취소</button></div>
  </div>`;
}

/** 합칠 상대 고르기: 지금 물건이 남고 고른 물건이 그 줄로 들어간다 (같은 소모품끼리만, canMerge) */
function mergePick(ctx: ChatContext, keep: Item): string {
  const others = mergeMates(ctx, keep);
  const w = whenOf(ctx);
  return `<div class="it-ph"><span class="it-ic">${itemPic(keep)}</span><div><b>${esc(keep.name)}</b><small>합칠 상대를 고르세요. 이름·설명은 이 물건 그대로, 남은 횟수와 무게만 더해져요.</small></div></div>
    <ul class="it-pick">${others.map((o) => `<li><button class="it-pickrow" data-action="items-merge-to" data-value="${esc(o.id)}"><span class="it-ic">${itemPic(o)}</span><span><b>${esc(o.name)}</b><small>${esc(o.desc || sourceLine(o, w))}</small></span></button></li>`).join('')}</ul>
    <div class="it-btns"><button class="gx-chip" data-action="items-back">취소</button></div>`;
}

// ── 동작 ──

export interface ItemsEnv {
  render(): void;
  refresh(): Promise<void>;
}

/** 소지품 메뉴의 data-action. 처리했으면 true. form 은 폼 요소를 넘긴다 (items-save) */
export async function itemsAction(action: string, value: string | undefined, ctx: ChatContext, env: ItemsEnv, formEl?: HTMLElement | null): Promise<boolean> {
  const write = (fn: (it: Items, alive: Set<string>) => Items) => updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const cur = readItems(chat.scriptstate);
    const next = fn(cur, aliveAnchors(chat));
    if (next === cur) return null;
    return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...itemsVars(next) } };
  });
  switch (action) {
    case 'items-sub':
      itemsUi.sub = value === 'wallet' || value === 'points' ? value : 'items';
      Object.assign(walletUi, { open: null, edit: false, notice: '' });
      itemsUi.open = '';
      itemsUi.mode = 'view';
      itemsUi.notice = '';
      env.render();
      return true;
    case 'items-log-filter':
      itemsUi.logFilter = value === 'get' ? 'get' : value === 'out' ? 'out' : 'all';
      env.render();
      return true;
    case 'items-view':
      itemsUi.view = value === 'log' ? 'log' : 'grid';
      env.render();
      return true;
    case 'items-open':
      itemsUi.open = value ?? '';
      itemsUi.mode = 'view';
      env.render();
      return true;
    case 'items-keep':
      return true;
    case 'items-close':
      itemsUi.open = '';
      itemsUi.mode = 'view';
      itemsUi.dragDrop = false;
      env.render();
      return true;
    case 'items-back':
      // 끌어다 놓아 연 버리기 확인을 취소하면 물건 팝업 없이 닫는다
      if (itemsUi.mode === 'drop' && itemsUi.dragDrop) itemsUi.open = '';
      itemsUi.mode = 'view';
      itemsUi.dragDrop = false;
      env.render();
      return true;
    case 'items-add':
      itemsUi.open = '';
      itemsUi.mode = 'add';
      env.render();
      return true;
    case 'items-edit':
      if (!itemEditOn(ctx.chat.scriptstate)) return true;
      itemsUi.mode = 'edit';
      env.render();
      return true;
    case 'items-merge':
      itemsUi.mode = 'merge';
      env.render();
      return true;
    case 'items-merge-start': {
      // 도구 줄의 합치기: 먼저 남길 물건을 고르게 (합칠 상대가 있는 첫 물건부터 팝업으로)
      const first = liveOf(ctx).find((x) => mergeMates(ctx, x).length);
      if (!first) return true;
      itemsUi.open = first.id;
      itemsUi.mode = 'merge';
      itemsUi.info = '남길 물건의 팝업에서 합칠 상대를 고르세요. 다른 물건을 남기려면 그 칸을 먼저 누르세요.';
      env.render();
      return true;
    }
    case 'items-merge-to': {
      const keep = itemsUi.open;
      if (!keep || !value) return true;
      // 합친 기록은 마지막 응답에 묶어 다음 요청 「This turn」에 넘긴다 (core/items.ts mergedNow)
      const anchor = lastBotKey(ctx.chat);
      await write((it, alive) => mergeItems(it, alive, keep, value, anchor));
      itemsUi.mode = 'view';
      itemsUi.info = '합쳤어요.';
      await env.refresh();
      return true;
    }
    case 'items-drop-ask':
      if (!value) return true;
      itemsUi.open = value;
      itemsUi.mode = 'drop';
      itemsUi.dragDrop = false;
      env.render();
      return true;
    case 'items-drop': {
      if (!value) return true;
      await write((it) => removeItem(it, value, 'drop', 'manual'));
      await dropFromUse(ctx, value);
      itemsUi.open = '';
      itemsUi.mode = 'view';
      itemsUi.dragDrop = false;
      itemsUi.info = '버렸어요. 기록에 남아요.';
      await env.refresh();
      return true;
    }
    case 'items-save': {
      const f = formEl;
      if (!f) return true;
      const get = (n: string) => String(f.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${n}"]`)?.value ?? '').trim();
      const use = !!f.querySelector<HTMLInputElement>('[name="use"]')?.checked;
      const usesRaw = get('uses');
      const uses = /^\d+$/.test(usesRaw) && Number(usesRaw) >= 1 ? Math.min(999, Number(usesRaw)) : undefined;
      const name = get('name');
      if (!name) {
        itemsUi.notice = '이름을 적어 주세요.';
        env.render();
        return true;
      }
      const wRaw = get('weight');
      const weight = wRaw ? itemWeight(wRaw) : undefined;
      const patch = { name, desc: get('desc'), effect: get('effect'), use, equip: get('equip'), ...(weight !== undefined ? { weight } : {}) };
      if (value) {
        // 횟수 칸: 소모성이면 「지금 남은 횟수」로 맞춘다. 비소모 ↔ 소모성 바꿈도 여기서
        await write((it, alive) => {
          const cur = it.list.find((x) => x.id === value);
          let next = updateItem(it, value, cur?.uses === undefined || uses === undefined ? { ...patch, uses: uses ?? '' } : patch);
          if (cur?.uses !== undefined && uses !== undefined) next = setItemLeft(next, alive, value, uses);
          return next;
        });
      } else await write((it, alive) => addItem(it, alive, { ...patch, uses, from: 'manual', anchor: '' }));
      itemsUi.mode = 'view';
      itemsUi.notice = '';
      itemsUi.info = value ? '고쳤어요.' : '넣었어요.';
      if (!value) itemsUi.open = '';
      await env.refresh();
      return true;
    }
    case 'items-use': {
      // 「사용」 자리에 하나 더 (채팅 변수 $st_item_use, 같은 물건은 ×n). 결과는 응답을 읽은 보조 모델이, 소모성 횟수는 응답이 붙을 때 프로그램이 뺀다
      const it = liveOf(ctx).find((x) => x.id === value);
      if (!it) return true;
      await queueUse(ctx, (q) => addUse(q, it, leftOf(ctx, it)));
      itemsUi.info = canUse(it) ? `「${it.name}」을 다음 메시지에 같이 보내요.` : `「${it.name}」은 지금 쓸 수 없어요.`;
      await env.refresh();
      return true;
    }
    case 'items-unuse': {
      if (!value) return true;
      await dropFromUse(ctx, value);
      itemsUi.info = '사용을 취소했어요.';
      await env.refresh();
      return true;
    }
    case 'items-equip':
    case 'items-unequip': {
      if (!value) return true;
      await write((it, alive) => (action === 'items-equip' ? equipItem(it, alive, value) : unequipItem(it, value)));
      const it = liveOf(ctx).find((x) => x.id === value);
      if (action === 'items-equip' && it?.equip && !equippedOf(liveOf(ctx))[it.equip].some((x) => !x || x.id === it.id)) itemsUi.info = `${EQUIP_LABEL[it.equip]} 칸이 다 찼어요. 칸에 있는 것을 먼저 풀거나, 칸으로 끌어다 바꾸세요.`;
      await env.refresh();
      return true;
    }
    case 'items-dnd': {
      // 끌어다 놓기 (app.ts): 「id|자리」. 자리 = equip:갈래:번호 · grid · use · drop
      const [id, to = ''] = (value ?? '').split('|');
      const it = liveOf(ctx).find((x) => x.id === id);
      if (!it) return true;
      if (to.startsWith('equip:')) {
        const [, k, n] = to.split(':');
        if (it.equip !== k) {
          itemsUi.info = it.equip ? `「${it.name}」은 ${EQUIP_LABEL[it.equip]} 칸에 들어가요.` : `「${it.name}」은 장착하는 물건이 아니에요.`;
          env.render();
          return true;
        }
        await write((x, alive) => equipItem(x, alive, id, Number(n)));
      } else if (to === 'grid') {
        if (!isEquipped(it, liveOf(ctx))) return true;
        await write((x) => unequipItem(x, id));
      } else if (to === 'use') {
        if (!canUse(it)) {
          itemsUi.info = it.state === 'broken' ? `「${it.name}」은 고장 나서 쓸 수 없어요.` : `「${it.name}」은 쓰는 물건이 아니에요.`;
          env.render();
          return true;
        }
        await queueUse(ctx, (q) => addUse(q, it, leftOf(ctx, it)));
      } else if (to === 'drop') {
        itemsUi.open = id;
        itemsUi.mode = 'drop';
        itemsUi.dragDrop = true;
        env.render();
        return true;
      } else return true;
      await env.refresh();
      return true;
    }
    default:
      return false;
  }
}

/** 「사용」 자리 바꾸기. 이미 보낸 자리($st_item_use_at 있음)는 비우고 새로 시작한다 (지난 턴 것을 또 넘기지 않게) */
async function queueUse(ctx: ChatContext, fn: (q: ItemUse[]) => ItemUse[]): Promise<void> {
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const sent = !!chat.scriptstate?.[ITEM_USE_AT_VAR];
    const cur = sent ? [] : readItemUse(chat.scriptstate);
    const next = fn(cur);
    if (!sent && JSON.stringify(next) === JSON.stringify(cur)) return null;
    return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...itemUseVars(next), [ITEM_USE_AT_VAR]: '' } };
  });
  void refreshUseBox(ctx.charIndex, ctx.chatIndex);
}
/** 사용 자리에서 빼기 (버리기·팔기·취소). 상점 팔기도 쓴다 */
export async function dropFromUse(ctx: { charIndex: number; chatIndex: number }, id: string): Promise<void> {
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    if (chat.scriptstate?.[ITEM_USE_AT_VAR]) return null;
    const cur = readItemUse(chat.scriptstate);
    const next = dropUse(cur, id);
    return next.length === cur.length ? null : { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...itemUseVars(next) } };
  });
  void refreshUseBox(ctx.charIndex, ctx.chatIndex);
}

/** 찾기 칸 입력: 격자·기록만 다시 그린다 (입력칸 초점 유지) */
export function itemsInput(root: HTMLElement, ctx: ChatContext, v: string): void {
  itemsUi.q = v;
  const box = root.querySelector('.it-body');
  if (box) box.innerHTML = itemsUi.view === 'log' ? logList(ctx) : gridHtml(ctx);
}
