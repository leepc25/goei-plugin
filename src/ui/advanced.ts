// 「고급 설정」 접는 칸 (v0.16.27, 사용자 설계): 각 기능 설정 맨 아래, 기본은 닫힘. 손대지 않아도 원본 기본값으로 돈다.
// 바꾼 항목은 이름 앞 점과 되돌리기 버튼으로 보이고, 닫힌 칸 제목에 바꾼 개수가 뜬다.
import { groupStep, numSet, setRow, setSeg, stepSize } from './setrow';
import { ADV, advChanged, advItem, advValue, advVar, type AdvFeature, type AdvItem } from '../core/advanced';
import { ACTIVE_BOOKS_VAR, activeBooks, bookNames, toggleActiveBook, type RefSource } from '../core/refs';
import { getPrefs } from '../core/settings';
import { savePrefs } from '../host/prefs';
import { updateCharacterLore, updateChat, type ChatContext } from '../host/risu';
import { syncDecorators, type LoreMode } from '../core/lore';
import { keepOpen } from './panels';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

type State = Record<string, unknown> | undefined;

function control(f: AdvFeature, item: AdvItem, cur: string): string {
  const id = `${f}:${item.key}`;
  if (item.type === 'text') return `<input class="gx-search ps-text adv-text" data-change="adv-set" data-key="${id}" value="${esc(cur)}" placeholder="비우면 기본" aria-label="${esc(item.label)}">`;
  // 켬·끔 둘뿐이면 스위치 (같은 값은 어디서나 같은 조작)
  if (item.type === 'pick' && item.opts?.length === 2 && item.opts.every(([v, l]) => (v === '1' && l === '켬') || (v === '0' && l === '끔'))) return setSeg('adv-set', id, cur === '1' ? '1' : '0', [['1', 'ON'], ['0', 'OFF']]);
  if (item.type === 'pick') {
    return `<div class="gx-segs gx-segs-sm">${(item.opts ?? [])
      .map(([v, label]) => `<button class="gx-seg${cur === v ? ' on' : ''}" data-action="adv-set" data-value="${id}=${v}" aria-pressed="${cur === v}">${esc(label)}</button>`)
      .join('')}</div>`;
  }
  // 숫자: −/+ 단추(사용자 2026-10-27, 상황판 인원 칸과 같은 모양) + 가운데 숫자는 직접 쳐도 된다.
  // 한 번에 움직이는 폭: 토큰 상한처럼 큰 수(상한 1만 이상)는 500, 나머지는 1. 0이 「공통」「제한 없음」 같은 뜻이면 숫자 대신 그 말
  const min = item.min ?? 0;
  const max = item.max ?? Number.MAX_SAFE_INTEGER;
  const step = max >= 10000 ? 500 : 1;
  const n = Math.min(max, Math.max(min, Number(cur) || 0));
  const zero = n === 0 && item.zero;
  const down = Math.max(min, n - step);
  const up = Math.min(max, n + step);
  return `<div class="st-step adv-step${stepSize(max === Number.MAX_SAFE_INTEGER ? 9999999 : max, item.unit ?? '', item.zero ?? '')}"><button class="gx-step" data-action="adv-set" data-value="${id}=${down}" ${n <= min ? 'disabled' : ''} aria-label="${esc(item.label)} 줄이기">−</button>
    <input class="adv-val" type="number" inputmode="numeric" min="${min}" max="${item.max ?? ''}" step="${step}" data-change="adv-set" data-key="${id}" value="${zero ? '' : n}"${item.zero ? ` placeholder="${esc(item.zero)}"` : ''} aria-label="${esc(item.label)}">${item.unit ? `<span>${esc(item.unit)}</span>` : ''}
    <button class="gx-step" data-action="adv-set" data-value="${id}=${up}" ${n >= max ? 'disabled' : ''} aria-label="${esc(item.label)} 늘리기">+</button></div>`;
}


function row(f: AdvFeature, item: AdvItem, state: State): string {
  const cur = advValue(state, f, item.key);
  const changed = cur !== String(item.def);
  return setRow(esc(item.label), control(f, item, cur), item.hint ? esc(item.hint) : '', `adv-row${item.type === 'num' ? ' adv-numrow' : ''}${changed ? ' changed' : ''}`);
}

function chips(f: AdvFeature, items: AdvItem[], state: State, label = ''): string {
  const html = `<div class="gx-chips">${items
    .map((i) => {
      const on = advValue(state, f, i.key) === '1';
      return `<button class="gx-chip${on ? ' on' : ''}" data-action="adv-set" data-value="${f}:${i.key}=${on ? '0' : '1'}" aria-pressed="${on}">${esc(i.label)}</button>`;
    })
    .join('')}</div>`;
  return label ? setRow(esc(label), html) : `<div class="ps-row adv-chips">${html}</div>`;
}

/** 세부 값 한 줄 · 칩 한 줄 (정의표의 adv·advchips 줄이 부른다) */
export function advRow(f: AdvFeature, key: string, state: State): string {
  const item = advItem(f, key);
  return item ? row(f, item, state) : '';
}
export function advChipRow(f: AdvFeature, keys: string[], state: State, label = ''): string {
  const items = keys.map((k) => advItem(f, k)).filter((i): i is AdvItem => !!i);
  return items.length ? chips(f, items, state, label) : '';
}
/** 같은 종류 수 여럿을 한 줄에 (keys = [항목, 짧은 이름]) */
export function advSetRow(f: AdvFeature, label: string, keys: [string, string][], state: State, help = ''): string {
  const cells = keys.map(([k, l]): [string, string] | null => { const item = advItem(f, k); return item ? [l, control(f, item, advValue(state, f, item.key))] : null; }).filter((c): c is [string, string] => !!c);
  return cells.length ? setRow(esc(label), numSet(cells), help ? esc(help) : '') : '';
}

/** 조작만 (표 칸용: 줄 틀 없이) */
export function advCtl(f: AdvFeature, key: string, state: State): string {
  const item = advItem(f, key);
  return item ? control(f, item, advValue(state, f, item.key)) : '';
}
export function advChipsCtl(f: AdvFeature, keys: string[], state: State): string {
  return `<div class="gx-chips">${keys.map((k) => advItem(f, k)).filter((i): i is AdvItem => !!i).map((i) => {
    const on = advValue(state, f, i.key) === '1';
    return `<button class="gx-chip${on ? ' on' : ''}" data-action="adv-set" data-value="${f}:${i.key}=${on ? '0' : '1'}" aria-pressed="${on}">${esc(i.label)}</button>`;
  }).join('')}</div>`;
}

// ── 「상시 로어북」 고르기 (설정 → 로어북 호출, 2026-11-12 사용자): 카드의 로어북 이름 목록에서 체크. 값은 $gen_active_books (core/refs.ts) ──
/** 목록이 열려 있는지 · 검색어 · 열 때 골라져 있던 이름(목록 맨 위에 둔다. 체크할 때마다 줄이 옮겨 다니지 않게 열 때 한 번만 정한다) (화면 상태, 저장하지 않는다) */
export const booksUi = { open: false, q: '', top: [] as string[] };
const low = (s: string) => s.trim().toLowerCase();

/** 목록 안쪽 (검색어를 칠 때 이 부분만 다시 그린다). 고른 이름이 카드에 없으면 맨 위에 「카드에 없음」으로 남겨 풀 수 있게 한다 */
export function activeBooksList(src: RefSource, state: State): string {
  const picked = activeBooks(state);
  const on = new Set(picked.map(low));
  const card = bookNames(src);
  const inCard = new Set(card.map(low));
  const gone = picked.filter((n) => !inCard.has(low(n)));
  if (!card.length && !gone.length) return '<p class="gx-muted dir-empty">고를 수 있는 로어북이 없어요.</p>';
  const q = low(booksUi.q);
  const top = new Set(booksUi.top.map(low));
  const list = [...gone, ...card.filter((n) => top.has(low(n))), ...card.filter((n) => !top.has(low(n)))].filter((n) => !q || n.toLowerCase().includes(q));
  if (!list.length) return '<p class="gx-muted dir-empty">검색 결과가 없어요.</p>';
  return list
    .map((n) => `<button class="dir-ext-item" data-action="adv-book" data-value="${esc(n)}" aria-pressed="${on.has(low(n))}"><b>${esc(n)}</b>${inCard.has(low(n)) ? '' : '<small>카드에 없음</small>'}<span class="ck-m box${on.has(low(n)) ? ' on' : ''}"></span></button>`)
    .join('');
}

/** 검색어를 칠 때: 목록만 다시 그린다 (입력 칸은 그대로). 이 입력이 아니면 false */
export function booksInput(name: string, value: string, root: ParentNode | null | undefined, src: RefSource, state: State): boolean {
  if (name !== 'adv-books-q') return false;
  booksUi.q = value;
  const box = root?.querySelector('.ps-ctl > .dir-ext > .dir-ext-list');
  if (box) box.innerHTML = activeBooksList(src, state);
  return true;
}

/** 「상시 로어북」 줄: 고른 개수 + 「로어북 선택」. 누르면 그 줄 아래에 검색 칸과 목록이 열린다 (명부의 사진 고르기와 같은 방식).
 *  목록의 체크는 AI 상담이 누르지 않는다 (data-consult="no": 카드마다 이름이 다른 목록. 상담에는 설명만 간다) */
export function activeBooksRow(src: RefSource, state: State): string {
  const n = activeBooks(state).length;
  const list = booksUi.open
    ? `<div class="dir-ext" data-consult="no"><input class="gx-search" data-input="adv-books-q" value="${esc(booksUi.q)}" placeholder="검색" aria-label="검색" autocomplete="off"><div class="dir-ext-list">${activeBooksList(src, state)}</div></div>`
    : '';
  return setRow('상시 로어북', `<span class="ph-inline"><span>${n}개 선택</span><button class="gx-mini${booksUi.open ? ' on' : ''}" data-action="adv-books" aria-expanded="${booksUi.open}">로어북 선택</button></span>${list}`, '조건 없이 늘 넘기는 로어북이에요.', 'adv-row');
}

/** 접지 않고 펼친 묶음들 (메인 설정의 생성 공통·로어북). extra[묶음 순서]는 그 묶음 안 맨 아래에 붙인다. rows[묶음 순서]는 그 묶음의 줄 맨 아래에 넣는다 */
export function advSections(f: AdvFeature, state: State, extra: Record<number, string> = {}, only?: number[], noTitle = false, rows: Record<number, string> = {}): string {
  return ADV[f]
    .map((g, gi) => (only && !only.includes(gi) ? '' : `<section class="ps-group">${noTitle ? '' : `<h3>${esc(g.title)}</h3>`}<div class="ps-rows">${groupStep(`${g.chips?.length ? chips(f, g.chips, state) : ''}${g.items.map((i) => row(f, i, state)).join('')}`)}${rows[gi] ?? ''}</div>${extra[gi] ?? ''}</section>`))
    .join('');
}

/** 기능 설정 맨 아래에 붙이는 접힌 칸 */
export function advancedBox(f: AdvFeature, state: State): string {
  const n = advChanged(state, f).length;
  const groups = ADV[f]
    .map((g, gi) => {
      const body = groupStep(`${g.chips?.length ? chips(f, g.chips, state) : ''}${g.items.map((i) => row(f, i, state)).join('')}`);
      if (g.fold) {
        return `<details class="ps-adv-sub" data-keep="adv-${f}-${gi}"${keepOpen(`adv-${f}-${gi}`)}><summary>${esc(g.title)}</summary><div class="ps-rows">${body}</div></details>`;
      }
      return `<section class="ps-group"><h3>${esc(g.title)}</h3><div class="ps-rows">${body}</div></section>`;
    })
    .join('');
  return `<details class="ps-adv" data-keep="adv-${f}"${keepOpen(`adv-${f}`)}><summary class="ps-adv-sum"><b>고급 설정</b>${n ? `<span class="adv-count">${n}개 바꿈</span>` : ''}</summary><div class="ps-adv-body">${groups}</div></details>`;
}

/** 기본값으로: 비워 둔다. 원래 있던 변수(v)는 기능 코드가 빈 값을 0으로 읽을 수 있어 기본값을 적는다 */
const blank = (item: AdvItem) => (item.v ? String(item.def) : '');

/** "f:key=값" → [기능, 항목, 저장할 값('' = 기본값)] */
function parse(value: string): [AdvFeature, AdvItem, string] | null {
  const m = /^(gn|ph|nw|gen):([a-z_]+)=(.*)$/.exec(value);
  if (!m) return null;
  const f = m[1] as AdvFeature;
  const item = advItem(f, m[2]);
  if (!item) return null;
  let v = m[3].trim();
  if (item.type === 'num') {
    const n = Number(v);
    if (v === '' || !Number.isFinite(n)) return [f, item, blank(item)];
    v = String(Math.min(item.max ?? Infinity, Math.max(item.min ?? 0, Math.round(n))));
  } else if (item.type === 'text') v = v.slice(0, 120);
  else if (item.type === 'bool' ? v !== '0' && v !== '1' : !item.opts?.some(([o]) => o === v)) return null;
  return [f, item, v === String(item.def) ? blank(item) : v];
}

export interface AdvEnv {
  render(): void;
  refresh(): Promise<void>;
}

/** adv-* 버튼. scope 'defaults'는 시작 전 기본 설정 화면(새 채팅 기본값을 바로 고침) */
export async function handleAdvanced(action: string, value: string | undefined, ctx: ChatContext, env: AdvEnv, scope: 'chat' | 'defaults' = 'chat'): Promise<boolean> {
  const v = value ?? '';
  let vars: Record<string, string> | null = null;
  if (action === 'adv-set') {
    const hit = parse(v);
    if (hit) vars = { [advVar(hit[0], hit[1])]: hit[2] };
  } else if (action === 'adv-books') {
    booksUi.open = !booksUi.open;
    booksUi.q = '';
    booksUi.top = booksUi.open ? activeBooks(scope === 'defaults' ? getPrefs().vars : ctx.chat.scriptstate) : [];
  } else if (action === 'adv-book') {
    // 「상시 로어북」 체크: 누른 이름을 넣거나 뺀다 (기본값과 같아지면 비운다)
    // 저장하는 그 순간의 값에서 고친다 (연달아 눌러도 앞 체크가 사라지지 않게)
    if (!v.trim()) return true;
    if (scope === 'defaults') {
      await savePrefs((p) => {
        const next = { ...(p.vars ?? {}) };
        const x = toggleActiveBook(next, v);
        if (x) next[ACTIVE_BOOKS_VAR] = x;
        else delete next[ACTIVE_BOOKS_VAR];
        return { ...p, vars: next };
      });
      env.render();
      return true;
    }
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [ACTIVE_BOOKS_VAR]: toggleActiveBook(chat.scriptstate, v) } }));
    await env.refresh();
    return true;
  } else return false;
  if (!vars) {
    env.render();
    return true;
  }
  const patch = vars;
  if (scope === 'defaults') {
    await savePrefs((p) => {
      const next = { ...(p.vars ?? {}) };
      for (const [k, x] of Object.entries(patch)) {
        if (x) next[k] = x;
        else delete next[k];
      }
      return { ...p, vars: next };
    });
    env.render();
    return true;
  }
  const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...patch } }));
  // 로어북 보내는 방식을 바꾸면 카드 로어북 첫 줄(@@dont_activate)도 바로 맞춘다
  const mode = advValue(saved?.scriptstate, 'gen', 'lore_mode') as LoreMode;
  if (syncDecorators(ctx.char.globalLore, mode)) await updateCharacterLore(ctx.charIndex, (lore) => syncDecorators(lore, mode)).catch(() => false);
  await env.refresh();
  return true;
}

/** 시작 전 기본 설정 화면이 보여 줄 값 */
export const defaultsState = (): State => getPrefs().vars;
