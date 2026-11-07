// 소지품 메뉴 (2026-11-07 사용자 설계, docs/인계/소지품_1107/초안/mock2.mjs 가 그림 초안):
// 하위 탭 [가계부 | 소지품]. 가계부는 기록 메뉴에서 여기로 옮겨 왔다 (ui/wallet.ts 그대로).
// 소지품: 도구 줄(칸 수 알약 · 넘침 배지 · 물건|기록 토글 · PC는 직접 넣기·합치기 · 찾기) + 격자(정사각 그림 + 이름 한 줄).
// 칸을 올리면 설명 말풍선(PC), 누르면 팝업(사용·고치기·합치기·버리기). 폰은 직접 넣기·합치기가 아래 도구 줄에.
// 플러그인은 막지도 경고하지도 않는다: 칸이 넘치면 넘친 칸을 붉은 테두리로 보여 줄 뿐, 푸는 건 본편 응답 (core/items.ts).
import type { ChatContext } from '../host/risu';
import { updateChat } from '../host/risu';
import { refreshUseBox } from '../host/usebox';
import { aliveAnchors } from '../core/wallet';
import {
  addItem, ITEM_USE_AT_VAR, itemKindLabel, ITEM_KINDS, itemSlots, itemUseVars, itemsVars, liveItems, mergeItems, readItemUse, readItems, removeItem, searchItems, updateItem,
  type Item, type ItemLog, type Items,
} from '../core/items';
import { drawerBox, drawerHtml } from './drawer';
import { ICONS } from './icons';
import { ITEM_ICONS } from './itemIcons';
import { isPhone } from './media';
import { toast } from './toast';
import { walletOn, walletPane, walletTools } from './wallet';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export type ItemsSub = 'wallet' | 'items';
export interface ItemsNav { sub: ItemsSub; view: 'grid' | 'log'; open: string }

/** 소지품 메뉴 상태 (채팅이 바뀌면 resetItems). open = 팝업에 띄운 물건 id, mode = 팝업 안 화면 */
export const itemsUi = {
  sub: 'items' as ItemsSub,
  view: 'grid' as 'grid' | 'log',
  q: '',
  open: '',
  mode: 'view' as 'view' | 'edit' | 'merge' | 'add',
  notice: '',
  info: '',
};

export function resetItems(): void {
  Object.assign(itemsUi, { sub: 'items', view: 'grid', q: '', open: '', mode: 'view', notice: '', info: '' });
}
export const itemsNav = (): ItemsNav => ({ sub: itemsUi.sub, view: itemsUi.view, open: itemsUi.open });
export function applyItemsNav(n: ItemsNav): void {
  Object.assign(itemsUi, { sub: n.sub === 'wallet' ? 'wallet' : 'items', view: n.view === 'log' ? 'log' : 'grid', open: n.open ?? '', mode: 'view', notice: '' });
}

export const itemsOf = (ctx: ChatContext): Items => readItems(ctx.chat.scriptstate);
export const liveOf = (ctx: ChatContext): Item[] => liveItems(itemsOf(ctx), aliveAnchors(ctx.chat));

/** 칸 그림: PixelLab 물건 그림(game-src/items/, 이름 키워드 매칭)이 들어오면 여기서 고른다. 아직은 종류 선 아이콘 (자리 표시) */
function itemPic(it: Item): string {
  return ITEM_ICONS[it.kind];
}

const FROM_NAME: Record<Item['from'], string> = { store: '상점', story: '본문', manual: '직접' };
const dateOf = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[2]}-${m[3]}` : '';
};
const sourceLine = (it: Item) => [itemKindLabel(it.kind), FROM_NAME[it.from], dateOf(it.at), Number.isSafeInteger(it.price) ? `₩ ${it.price!.toLocaleString('en-US')}` : ''].filter(Boolean).join(' · ');

// ── 화면 ──

export function itemsTab(ctx: ChatContext): string {
  const SUBS: [ItemsSub, string][] = [['wallet', '가계부'], ['items', '소지품']];
  const tabs = `<div class="ph-subs gx-rec-tabs it-tabs" role="tablist">${SUBS.map(([v, l]) => `<button role="tab" class="ph-sub${itemsUi.sub === v ? ' on' : ''}" data-action="items-sub" data-value="${v}" aria-selected="${itemsUi.sub === v}" aria-pressed="${itemsUi.sub === v}">${l}</button>`).join('')}</div>`;
  const note = toast('items', itemsUi.info, (t) => {
    if (itemsUi.info === t) itemsUi.info = '';
  });
  if (itemsUi.sub === 'wallet') {
    const drawer = isPhone() && walletOn(ctx) ? drawerBox(walletTools(ctx), 'gx-rdrawer') : '';
    return `<main class="gx-body gx-records gx-items">${tabs}${walletPane(ctx)}${note}</main>${drawer}`;
  }
  const notice = itemsUi.notice ? `<div class="gx-err" role="alert">${esc(itemsUi.notice)}</div>` : '';
  // 폰: 직접 넣기·합치기는 아래 도구 줄 (하단 바 바로 위, 늘 보인다)
  const drawer = isPhone() ? drawerHtml(`${addButton('ph-tool')}${mergeButton(ctx, 'ph-tool')}`, '', 'gx-idrawer') : '';
  return `<main class="gx-body gx-records gx-items">${tabs}${notice}${itemsPane(ctx)}${note}</main>${popup(ctx)}${drawer}`;
}

const addButton = (cls: string) => `<button class="${cls} it-add" data-action="items-add" aria-label="직접 넣기">${ICONS.plus}<span class="${cls === 'ph-tool' ? 'ph-tool-l' : ''}">직접 넣기</span></button>`;
function mergeButton(ctx: ChatContext, cls: string): string {
  const n = liveOf(ctx).length;
  return `<button class="${cls} it-merge" data-action="items-merge-start" aria-label="합치기" ${n < 2 ? 'disabled' : ''}>${ICONS.refresh}<span class="${cls === 'ph-tool' ? 'ph-tool-l' : ''}">합치기</span></button>`;
}

function itemsPane(ctx: ChatContext): string {
  const list = liveOf(ctx);
  const slots = itemSlots(ctx.chat.scriptstate);
  const over = Math.max(0, list.length - slots);
  const seg = (v: 'grid' | 'log', label: string) => `<button class="gx-seg${itemsUi.view === v ? ' on' : ''}" data-action="items-view" data-value="${v}" aria-pressed="${itemsUi.view === v}">${label}</button>`;
  const tools = `<div class="gx-rec-tools gx-wt-tools it-tools">
    <span class="it-cnt" title="칸 ${list.length} / ${slots}">${ICONS.bag}<b>${list.length}</b><small>/ ${slots}</small></span>
    ${over ? `<span class="it-over">넘침 <b>${over}</b></span>` : ''}
    <div class="gx-segs gx-segs-sm it-segs">${seg('grid', '물건')}${seg('log', '기록')}</div>
    ${isPhone() ? '' : `<span class="it-right">${addButton('it-act')}${mergeButton(ctx, 'it-act')}</span>`}
    <input class="gx-wt-q it-q" type="search" data-input="items-q" value="${esc(itemsUi.q)}" placeholder="찾기: 물건·기록" aria-label="물건·기록 찾기">
  </div>`;
  return `${tools}<div class="it-body">${itemsUi.view === 'log' ? logList(ctx) : gridHtml(ctx)}</div>`;
}

/** 격자: 산 물건 → 빈 칸(칸 수까지) → 넘친 물건(붉은 테두리). 찾는 중이면 맞는 것만, 빈 칸 없음 */
export function gridHtml(ctx: ChatContext): string {
  const slots = itemSlots(ctx.chat.scriptstate);
  const q = itemsUi.q.trim();
  const all = liveOf(ctx);
  const list = q ? searchItems(itemsOf(ctx), aliveAnchors(ctx.chat), q).items : all;
  if (q && !list.length) return `<p class="gx-wt-empty">맞는 물건이 없어요.</p>`;
  const cells = list.map((it, i) => cell(it, !q && i >= slots));
  if (!q) for (let i = list.length; i < slots; i++) cells.push('<div class="it-c empty" aria-hidden="true"><span class="it-ic"></span><b>&nbsp;</b></div>');
  return `<div class="it-grid">${cells.join('')}</div>`;
}

function cell(it: Item, over: boolean): string {
  const tip = `<span class="it-tip" aria-hidden="true"><b>${esc(it.name)}</b><small>${esc(sourceLine(it))}</small>${it.desc ? `<p>${esc(it.desc)}</p>` : ''}${it.effect ? `<p class="ef">효과: ${esc(it.effect)}</p>` : ''}</span>`;
  return `<button class="it-c${over ? ' over' : ''}${itemsUi.open === it.id ? ' sel' : ''}" data-action="items-open" data-value="${esc(it.id)}" aria-label="${esc(it.name)}${over ? ' (넘침)' : ''}"><span class="it-ic">${itemPic(it)}</span><b>${esc(it.name)}</b>${tip}</button>`;
}

const WHAT: Record<ItemLog['what'], string> = { use: '사용', drop: '버림', gone: '없어짐', merge: '합침' };
const BY: Record<ItemLog['by'], string> = { story: '본문', manual: '직접', use: '사용 단추' };

/** 기록: 가계부 거래 줄과 같은 모양 (최근 것부터) */
function logList(ctx: ChatContext): string {
  const q = itemsUi.q.trim();
  const rows = q ? searchItems(itemsOf(ctx), aliveAnchors(ctx.chat), q).log : itemsOf(ctx).log.slice().reverse();
  if (!rows.length) return `<p class="gx-wt-empty">${q ? '맞는 기록이 없어요.' : '아직 사용·처분 기록이 없어요. 물건을 쓰거나 버리면 여기에 쌓여요.'}</p>`;
  return `<ul class="gx-wt-list it-log">${rows.map((l) => `<li class="gx-wt-row"><div class="gx-wt-main"><span class="gx-wt-memo"><b>${esc(l.name)} ${WHAT[l.what] ?? l.what}</b><small>${esc([BY[l.by] ?? l.by, l.note, l.quote ? `「${l.quote}」` : ''].filter(Boolean).join(' · '))}</small></span><span class="gx-wt-amt"><small>${esc(dateOf(l.at))}</small></span></div></li>`).join('')}</ul>`;
}

// ── 팝업 ──

function popup(ctx: ChatContext): string {
  if (itemsUi.mode === 'add') return shell('직접 넣기', form(null));
  if (!itemsUi.open) return '';
  const it = liveOf(ctx).find((x) => x.id === itemsUi.open);
  if (!it) return '';
  if (itemsUi.mode === 'edit') return shell('고치기', form(it));
  if (itemsUi.mode === 'merge') return shell('합치기', mergePick(ctx, it));
  const use = readItemUse(ctx.chat.scriptstate);
  const queued = use.some((n) => n === it.name);
  const body = `<div class="it-ph"><span class="it-ic">${itemPic(it)}</span><div><b>${esc(it.name)}</b><small>${esc(sourceLine(it))}</small></div></div>
    ${it.desc ? `<p>${esc(it.desc)}</p>` : '<p class="dim">설명 없음</p>'}
    ${it.effect ? `<p class="ef">효과: ${esc(it.effect)}</p>` : ''}
    ${it.quote ? `<p class="qt">근거 「${esc(it.quote)}」</p>` : ''}
    <div class="it-btns">
      <button class="gx-chip${queued ? ' on' : ''}" data-action="items-use" data-value="${esc(it.id)}" aria-pressed="${queued}">${queued ? '사용 취소' : '사용'}</button>
      <button class="gx-chip" data-action="items-edit">고치기</button>
      <button class="gx-chip" data-action="items-merge" ${liveOf(ctx).length < 2 ? 'disabled' : ''}>합치기</button>
      <button class="gx-chip red" data-action="items-drop" data-value="${esc(it.id)}">버리기</button>
    </div>
    ${queued ? '<p class="dim">다음 메시지를 보낼 때 본편에 「이번 턴 사용」으로 넘어가요.</p>' : ''}`;
  return shell(it.name, body);
}

const shell = (label: string, inner: string) => `<div class="gx-agpop it-pop" data-action="items-close" role="dialog" aria-label="${esc(label)}"><div class="gx-agpop-card it-card" data-action="items-keep"><button class="gx-agpop-x" data-action="items-close" aria-label="닫기">${ICONS.close}</button>${inner}</div></div>`;

function form(it: Item | null): string {
  const kinds = ITEM_KINDS.map((k) => `<option value="${k.id}"${(it?.kind ?? 'misc') === k.id ? ' selected' : ''}>${k.label}</option>`).join('');
  return `<form class="it-form" data-action="items-save" data-value="${esc(it?.id ?? '')}">
    <label><span>이름</span><input name="name" maxlength="30" required value="${esc(it?.name ?? '')}" placeholder="예: 소금 봉지"></label>
    <label><span>종류</span><select name="kind">${kinds}</select></label>
    <label><span>설명</span><input name="desc" maxlength="80" value="${esc(it?.desc ?? '')}" placeholder="양·상태도 글로 (예: 두 봉지 남음)"></label>
    <label><span>효과</span><input name="effect" maxlength="60" value="${esc(it?.effect ?? '')}" placeholder="있으면 (예: 저급 괴이의 접근을 늦춘다)"></label>
    <div class="it-btns"><button type="submit" class="gx-chip on">${it ? '저장' : '넣기'}</button><button type="button" class="gx-chip" data-action="${it ? 'items-back' : 'items-close'}">취소</button></div>
  </form>`;
}

/** 합칠 상대 고르기: 지금 물건이 남고 고른 물건이 그 줄로 들어간다 (이름이 달라도 된다) */
function mergePick(ctx: ChatContext, keep: Item): string {
  const others = liveOf(ctx).filter((x) => x.id !== keep.id);
  return `<div class="it-ph"><span class="it-ic">${itemPic(keep)}</span><div><b>${esc(keep.name)}</b><small>이 물건에 합칠 상대를 고르세요. 상대 칸은 빠지고 설명은 뒤에 붙어요.</small></div></div>
    <ul class="it-pick">${others.map((o) => `<li><button class="it-pickrow" data-action="items-merge-to" data-value="${esc(o.id)}"><span class="it-ic">${itemPic(o)}</span><span><b>${esc(o.name)}</b><small>${esc(o.desc || sourceLine(o))}</small></span></button></li>`).join('')}</ul>
    <div class="it-btns"><button class="gx-chip" data-action="items-back">취소</button></div>`;
}

// ── 동작 ──

export interface ItemsEnv {
  render(): void;
  refresh(): Promise<void>;
}

/** 소지품 메뉴의 data-action. 처리했으면 true. form 은 폼 요소를 넘긴다 (items-save) */
export async function itemsAction(action: string, value: string | undefined, ctx: ChatContext, env: ItemsEnv, formEl?: HTMLFormElement | null): Promise<boolean> {
  const write = (fn: (it: Items, alive: Set<string>) => Items) => updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const cur = readItems(chat.scriptstate);
    const next = fn(cur, aliveAnchors(chat));
    if (next === cur) return null;
    return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...itemsVars(next) } };
  });
  switch (action) {
    case 'items-sub':
      itemsUi.sub = value === 'wallet' ? 'wallet' : 'items';
      itemsUi.open = '';
      itemsUi.mode = 'view';
      itemsUi.notice = '';
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
      env.render();
      return true;
    case 'items-back':
      itemsUi.mode = 'view';
      env.render();
      return true;
    case 'items-add':
      itemsUi.open = '';
      itemsUi.mode = 'add';
      env.render();
      return true;
    case 'items-edit':
      itemsUi.mode = 'edit';
      env.render();
      return true;
    case 'items-merge':
      itemsUi.mode = 'merge';
      env.render();
      return true;
    case 'items-merge-start': {
      // 도구 줄의 합치기: 먼저 남길 물건을 고르게 (첫 칸부터 팝업으로)
      const first = liveOf(ctx)[0];
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
      await write((it) => mergeItems(it, keep, value));
      itemsUi.mode = 'view';
      itemsUi.info = '합쳤어요.';
      await env.refresh();
      return true;
    }
    case 'items-drop': {
      if (!value) return true;
      await write((it) => removeItem(it, value, 'drop', 'manual'));
      itemsUi.open = '';
      itemsUi.mode = 'view';
      itemsUi.info = '버렸어요. 기록에 남아요.';
      await env.refresh();
      return true;
    }
    case 'items-save': {
      const f = formEl;
      if (!f) return true;
      const get = (n: string) => String((f.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null)?.value ?? '').trim();
      const name = get('name');
      if (!name) {
        itemsUi.notice = '이름을 적어 주세요.';
        env.render();
        return true;
      }
      const patch = { name, kind: get('kind'), desc: get('desc'), effect: get('effect') };
      if (value) await write((it) => updateItem(it, value, patch));
      else await write((it, alive) => addItem(it, alive, { ...patch, from: 'manual', anchor: '' }));
      itemsUi.mode = 'view';
      itemsUi.notice = '';
      itemsUi.info = value ? '고쳤어요.' : '넣었어요.';
      if (!value) itemsUi.open = '';
      await env.refresh();
      return true;
    }
    case 'items-use': {
      // 「사용」 상자에 넣고 빼기 (채팅 변수 $st_item_use). 목록은 그대로 — 결과는 응답을 읽은 보조 모델이 반영
      const it = liveOf(ctx).find((x) => x.id === value);
      if (!it) return true;
      await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
        // 이미 보낸 상자($st_item_use_at 있음)는 비우고 새로 시작한다 (지난 턴 것을 또 넘기지 않게)
        const sent = !!chat.scriptstate?.[ITEM_USE_AT_VAR];
        const cur = sent ? [] : readItemUse(chat.scriptstate);
        const next = cur.includes(it.name) ? cur.filter((n) => n !== it.name) : [...cur, it.name];
        return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...itemUseVars(next), [ITEM_USE_AT_VAR]: '' } };
      });
      void refreshUseBox(ctx.charIndex, ctx.chatIndex);
      itemsUi.info = readItemUse(ctx.chat.scriptstate).includes(it.name) ? '사용을 취소했어요.' : `「${it.name}」을 다음 메시지에 같이 보내요.`;
      await env.refresh();
      return true;
    }
    default:
      return false;
  }
}

/** 찾기 칸 입력: 격자·기록만 다시 그린다 (입력칸 초점 유지) */
export function itemsInput(root: HTMLElement, ctx: ChatContext, v: string): void {
  itemsUi.q = v;
  const box = root.querySelector('.it-body');
  if (box) box.innerHTML = itemsUi.view === 'log' ? logList(ctx) : gridHtml(ctx);
}
