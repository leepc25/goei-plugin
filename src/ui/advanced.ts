// 「고급 설정」 접는 칸 (v0.16.27, 사용자 설계): 각 기능 설정 맨 아래, 기본은 닫힘. 손대지 않아도 원본 기본값으로 돈다.
// 바꾼 항목은 이름 앞 점과 되돌리기 버튼으로 보이고, 닫힌 칸 제목에 바꾼 개수가 뜬다.
import { ADV, advChanged, advItem, advResetVars, advValue, advVar, type AdvFeature, type AdvItem } from '../core/advanced';
import { getPrefs } from '../core/settings';
import { savePrefs } from '../host/prefs';
import { updateCharacterLore, updateChat, type ChatContext } from '../host/risu';
import { syncDecorators, type LoreMode } from '../core/lore';
import { ICONS } from './icons';
import { keepOpen } from './panels';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const advUi = { confirm: '' as AdvFeature | '' };

type State = Record<string, unknown> | undefined;

function control(f: AdvFeature, item: AdvItem, cur: string): string {
  const id = `${f}:${item.key}`;
  if (item.type === 'pick') {
    return `<div class="gx-segs gx-segs-sm">${(item.opts ?? [])
      .map(([v, label]) => `<button class="gx-seg${cur === v ? ' on' : ''}" data-action="adv-set" data-value="${id}=${v}" aria-pressed="${cur === v}">${esc(label)}</button>`)
      .join('')}</div>`;
  }
  // 0이 「공통」「제한 없음」 같은 뜻이면 칸을 비우고 그 말을 흐리게 보여 준다
  const zero = cur === '0' && item.zero;
  return `<span class="adv-num"><input class="gx-search" type="number" inputmode="numeric" min="${item.min ?? 0}" max="${item.max ?? ''}" step="1" data-change="adv-set" data-key="${id}" value="${zero ? '' : esc(cur)}"${item.zero ? ` placeholder="${esc(item.zero)}"` : ''} aria-label="${esc(item.label)}"><span>${esc(item.unit ?? '')}</span></span>`;
}

function row(f: AdvFeature, item: AdvItem, state: State): string {
  const cur = advValue(state, f, item.key);
  const changed = cur !== String(item.def);
  // 되돌리기 자리는 늘 비워 둔다 (바꾼 줄만 칸이 밀리지 않게)
  const reset = changed
    ? `<button class="ph-tool sm adv-reset" data-action="adv-reset" data-value="${f}:${item.key}" aria-label="${esc(item.label)} 기본값으로" title="기본값 ${esc(item.def)}">${ICONS.refresh}</button>`
    : '<span class="adv-reset" aria-hidden="true"></span>';
  return `<div class="ps-row adv-row${item.type === 'num' ? ' adv-numrow' : ''}${changed ? ' changed' : ''}"><div class="ps-label"><b>${esc(item.label)}</b>${item.hint ? `<small>${esc(item.hint)}</small>` : ''}</div><div class="ps-ctl">${control(f, item, cur)}${reset}</div></div>`;
}

function chips(f: AdvFeature, items: AdvItem[], state: State): string {
  return `<div class="ps-row adv-chips"><div class="gx-chips">${items
    .map((i) => {
      const on = advValue(state, f, i.key) === '1';
      return `<button class="gx-chip${on ? ' on' : ''}" data-action="adv-set" data-value="${f}:${i.key}=${on ? '0' : '1'}" aria-pressed="${on}">${esc(i.label)}</button>`;
    })
    .join('')}</div></div>`;
}

/** 접지 않고 펼친 묶음들 (메인 설정의 생성 공통·로어북). extra[묶음 순서]는 그 묶음 안 맨 아래에 붙인다 */
export function advSections(f: AdvFeature, state: State, extra: Record<number, string> = {}): string {
  return ADV[f]
    .map((g, gi) => `<section class="ps-group"><h3>${esc(g.title)}</h3><div class="ps-rows">${g.chips?.length ? chips(f, g.chips, state) : ''}${g.items.map((i) => row(f, i, state)).join('')}</div>${extra[gi] ?? ''}</section>`)
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
  const foot = n
    ? advUi.confirm === f
      ? `<div class="st-confirm adv-foot"><p>고급 설정 ${n}개를 모두 기본값으로 돌릴까요?</p><div class="gx-row-btns"><button class="gx-mini danger" data-action="adv-reset-yes" data-value="${f}">되돌리기</button><button class="gx-mini" data-action="adv-reset-no">취소</button></div></div>`
      : `<div class="adv-foot"><button class="gx-mini" data-action="adv-reset-all" data-value="${f}">${ICONS.refresh}모두 기본값으로</button></div>`
    : '';
  return `<details class="ps-adv" data-keep="adv-${f}"${keepOpen(`adv-${f}`)}><summary class="ps-adv-sum"><b>고급 설정</b>${n ? `<span class="adv-count">${n}개 바꿈</span>` : ''}</summary><div class="ps-adv-body">${groups}${foot}</div></details>`;
}

/** 기본값으로: 비워 둔다. 원래 있던 변수(v)는 기능 코드가 빈 값을 0으로 읽을 수 있어 기본값을 적는다 */
const blank = (item: AdvItem) => (item.v ? String(item.def) : '');

/** "f:key=값" → [기능, 항목, 저장할 값('' = 기본값)] */
function parse(value: string): [AdvFeature, AdvItem, string] | null {
  const m = /^(gn|ph|nw|hq|gen):([a-z_]+)=(.*)$/.exec(value);
  if (!m) return null;
  const f = m[1] as AdvFeature;
  const item = advItem(f, m[2]);
  if (!item) return null;
  let v = m[3].trim();
  if (item.type === 'num') {
    const n = Number(v);
    if (v === '' || !Number.isFinite(n)) return [f, item, blank(item)];
    v = String(Math.min(item.max ?? Infinity, Math.max(item.min ?? 0, Math.round(n))));
  } else if (item.type === 'bool' ? v !== '0' && v !== '1' : !item.opts?.some(([o]) => o === v)) return null;
  return [f, item, v === String(item.def) ? blank(item) : v];
}

export interface AdvEnv {
  render(): void;
  refresh(): Promise<void>;
}

/** adv-* 버튼. scope 'defaults'는 시작 전 기본 설정 화면(새 채팅 기본값을 바로 고침) */
export async function handleAdvanced(action: string, value: string | undefined, ctx: ChatContext, env: AdvEnv, scope: 'chat' | 'defaults' = 'chat'): Promise<boolean> {
  const v = value ?? '';
  if (action === 'adv-reset-all' || action === 'adv-reset-no') {
    advUi.confirm = action === 'adv-reset-all' && v in ADV ? (v as AdvFeature) : '';
    env.render();
    return true;
  }
  let vars: Record<string, string> | null = null;
  if (action === 'adv-set') {
    const hit = parse(v);
    if (hit) vars = { [advVar(hit[0], hit[1])]: hit[2] };
  } else if (action === 'adv-reset') {
    const [f, key] = v.split(':') as [AdvFeature, string];
    const item = f in ADV ? advItem(f, key) : undefined;
    if (item) vars = { [advVar(f, item)]: blank(item) };
  } else if (action === 'adv-reset-yes') {
    advUi.confirm = '';
    if (v in ADV) vars = advResetVars(v as AdvFeature);
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
