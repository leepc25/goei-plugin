// 「고급 설정」 접는 칸 (v0.16.27, 사용자 설계): 각 기능 설정 맨 아래, 기본은 닫힘. 손대지 않아도 원본 기본값으로 돈다.
// 바꾼 항목은 이름 앞 점과 되돌리기 버튼으로 보이고, 닫힌 칸 제목에 바꾼 개수가 뜬다.
import { numWidth, setRow } from './setrow';
import { ADV, advChanged, advItem, advValue, advVar, type AdvFeature, type AdvItem } from '../core/advanced';
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
  return `<div class="st-step adv-step"><button class="gx-step" data-action="adv-set" data-value="${id}=${down}" ${n <= min ? 'disabled' : ''} aria-label="${esc(item.label)} 줄이기">−</button>
    <input class="adv-val" type="number" inputmode="numeric" min="${min}" max="${item.max ?? ''}" step="${step}" data-change="adv-set" data-key="${id}" value="${zero ? '' : n}"${item.zero ? ` placeholder="${esc(item.zero)}"` : ''}${zeroWidth(item.zero, max)} aria-label="${esc(item.label)}">${item.unit ? `<span>${esc(item.unit)}</span>` : ''}
    <button class="gx-step" data-action="adv-set" data-value="${id}=${up}" ${n >= max ? 'disabled' : ''} aria-label="${esc(item.label)} 늘리기">+</button></div>`;
}

/** 0일 때 보이는 말이 기본 칸(6.2em)보다 길면 칸을 그 말만큼 넓힌다 (모든 세부 값 줄 공통) */
const zeroWidth = (z?: string, max = 0): string => (z && [...z].length > 5 ? ` style="width:${[...z].length + 1.2}em"` : ` style="width:${numWidth(max)}"`);

function row(f: AdvFeature, item: AdvItem, state: State): string {
  const cur = advValue(state, f, item.key);
  const changed = cur !== String(item.def);
  return setRow(esc(item.label), control(f, item, cur), item.hint ? esc(item.hint) : '', `adv-row${item.type === 'num' ? ' adv-numrow' : ''}${changed ? ' changed' : ''}`);
}

function chips(f: AdvFeature, items: AdvItem[], state: State): string {
  return `<div class="ps-row adv-chips"><div class="gx-chips">${items
    .map((i) => {
      const on = advValue(state, f, i.key) === '1';
      return `<button class="gx-chip${on ? ' on' : ''}" data-action="adv-set" data-value="${f}:${i.key}=${on ? '0' : '1'}" aria-pressed="${on}">${esc(i.label)}</button>`;
    })
    .join('')}</div></div>`;
}

/** 세부 값 한 줄 · 칩 한 줄 (정의표의 adv·advchips 줄이 부른다) */
export function advRow(f: AdvFeature, key: string, state: State): string {
  const item = advItem(f, key);
  return item ? row(f, item, state) : '';
}
export function advChipRow(f: AdvFeature, keys: string[], state: State): string {
  const items = keys.map((k) => advItem(f, k)).filter((i): i is AdvItem => !!i);
  return items.length ? chips(f, items, state) : '';
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

/** 접지 않고 펼친 묶음들 (메인 설정의 생성 공통·로어북). extra[묶음 순서]는 그 묶음 안 맨 아래에 붙인다 */
export function advSections(f: AdvFeature, state: State, extra: Record<number, string> = {}, only?: number[]): string {
  return ADV[f]
    .map((g, gi) => (only && !only.includes(gi) ? '' : `<section class="ps-group"><h3>${esc(g.title)}</h3><div class="ps-rows">${g.chips?.length ? chips(f, g.chips, state) : ''}${g.items.map((i) => row(f, i, state)).join('')}</div>${extra[gi] ?? ''}</section>`))
    .join('');
}

/** 기능 설정 맨 아래에 붙이는 접힌 칸 */
export function advancedBox(f: AdvFeature, state: State): string {
  const n = advChanged(state, f).length;
  const groups = ADV[f]
    .map((g, gi) => {
      const body = `${g.chips?.length ? chips(f, g.chips, state) : ''}${g.items.map((i) => row(f, i, state)).join('')}`;
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
