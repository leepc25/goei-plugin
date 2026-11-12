// 설정 창 「AI 상담」 (설정 개편 6단계, 2026-11-12 사용자 「시안대로 적용」. 모양 = 시안8).
// PC: 설정 창 옆에 뜨는 380px 창. 폰: 아래에서 올라오는 판. 설정 창 머리의 「AI 상담」 단추로 열고 닫는다.
// 셈(요청문·응답 읽기·값 대조)은 src/core/consult.ts. 여기는 화면과 순서:
//   1) 사용자 말 → 2) 모델 답. 바꾸자는 것(<set>)이 있으면 대조해서 「바꾸자고 한 것」으로 적어만 둔다 (적용 안 함)
//   3) 다음 사용자 말에 모델이 <apply> 를 내면, 그 전에 적어 둔 것만 적용하고 「바꾼 설정 N개」 판을 남긴다. 아니면 적어 둔 것은 버린다.
// 바꿀 수 있는 설정 = 관제 화면의 줄(flowpage.ts flowSections) 그대로. 적용도 그 줄의 원래 저장 동작(fl-do)으로 한다.
// 대화는 채팅(메시지·상태값)에 쓰지 않고 플러그인 저장소(goei:consult)에 채팅마다 따로 둔다 → 메인 요청에 들어갈 길이 없다.
import type { ChatContext } from '../../host/risu';
import { generate, type ModelChoice } from '../../host/llm';
import { savePrefs } from '../../host/prefs';
import { getPrefs } from '../../core/settings';
import { genSettings } from '../../core/advanced';
import { checkConsult, consultLabel, consultPrompt, parseConsult, type ConsultChange, type ConsultItem, type ConsultTalk } from '../../core/consult';
import { GHOST_ICON, ICONS } from '../icons';
import { flowSections, flowView, FLOW_DO, type Ctl, type Row } from './flowpage';
import { flowTokState } from './flow';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const KEY = 'goei:consult';
/** 채팅마다 남기는 줄 수 · 기억하는 채팅 수 · 모델에 넘기는 지난 대화 줄 수 */
const KEEP_LINES = 80;
const KEEP_CHATS = 30;
const TALK_LINES = 24;

interface CardRow { id: string; title: string; from: string; to: string; fromLabel: string; toLabel: string; go: [string, string] | null }
type Line = { who: 'me' | 'op' | 'sys' | 'err'; text: string } | { who: 'card'; rows: CardRow[]; undone?: boolean };
interface Saved { lines: Line[]; pending: ConsultChange[]; at: number }

export const consultUi = { open: false, busy: false, input: '', clear: false, drawn: -1 };
let store: Record<string, Saved> | null = null;
let loading = false;

const chatKey = (ctx: ChatContext) => {
  const cha = String((ctx.char as { chaId?: string }).chaId ?? '').trim() || `c${ctx.charIndex}`;
  const id = String((ctx.chat as Record<string, unknown>).id ?? '').trim() || `i${ctx.chatIndex}`;
  return `${cha}:${id}`;
};
const mine = (ctx: ChatContext): Saved => {
  const k = chatKey(ctx);
  store ??= {};
  return (store[k] ??= { lines: [], pending: [], at: 0 });
};
function ensureLoaded(render: () => void): void {
  if (store || loading) return;
  loading = true;
  void (async () => {
    let next: Record<string, Saved> = {};
    try {
      const raw: unknown = await risuai.pluginStorage.getItem(KEY);
      const v: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (v && typeof v === 'object') next = v as Record<string, Saved>;
    } catch { /* 못 읽으면 빈 대화로 */ }
    store = { ...next, ...(store ?? {}) };
    loading = false;
    render();
  })();
}
async function persist(): Promise<void> {
  if (!store) return;
  const keys = Object.keys(store).sort((a, b) => (store![b].at ?? 0) - (store![a].at ?? 0));
  for (const k of keys.slice(KEEP_CHATS)) delete store[k];
  for (const k of Object.keys(store)) store[k].lines = store[k].lines.slice(-KEEP_LINES);
  try {
    await risuai.pluginStorage.setItem(KEY, JSON.stringify(store));
  } catch (error) {
    console.log(`[goei] AI 상담 대화를 저장하지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/* ── 바꿀 수 있는 설정: 관제 화면의 줄 그대로 ── */
interface Entry { item: ConsultItem; ctl: Ctl; title: string; go: [string, string] | null }
export function consultCatalog(ctx: ChatContext, started: boolean): { entries: Entry[]; summary: string } {
  const { sections, nodes } = flowSections(ctx, started);
  const entries: Entry[] = [];
  for (const s of sections) for (const t of s.tables) {
    const walk = (r: Row): void => {
      for (const c of [...r.ctls, ...(r.grid ?? [])]) {
        if (!c) continue;
        const name = c.label ? `${r.name} · ${c.label}` : r.name;
        entries.push({ ctl: c, title: `${t.title || s.title} · ${name}`, go: r.go, item: { id: c.id, group: t.title ? `${s.title} · ${t.title}` : s.title, name, kind: c.kind, cur: c.cur, opts: c.opts, lo: c.lo, hi: c.hi, unit: c.unit, zero: c.zero, calls: r.calls, help: r.help } });
      }
      (r.after ?? []).forEach(walk);
    };
    [...(t.leads ?? []), ...t.rows].forEach(walk);
  }
  const all = [...nodes.pre, ...nodes.post];
  const sure = all.reduce((n, x) => n + x.sure, 0);
  const maybe = all.reduce((n, x) => n + x.maybe, 0);
  const tok = all.filter((x) => x.on && typeof x.tok === 'number').reduce((n, x) => n + (x.tok as number), 0);
  const summary = `턴마다 보조 호출 ${sure}회${maybe ? ` (조건에 따라 최대 ${sure + maybe}회)` : ''} · 메인 1회${flowTokState().ready ? ` · 예상 토큰 ${tok.toLocaleString('ko-KR')}` : ''}${started ? '' : '\n아직 채팅을 시작하기 전이에요. 값은 새 채팅이 받을 값이에요.'}`;
  return { entries, summary };
}

/* ── 화면 ── */
const modelOf = (): ModelChoice => (getPrefs().consultModel === 'main' ? 'main' : 'aux');
export const consultButton = (): string => `<button class="gx-mini ai-open${consultUi.open ? ' on' : ''}" data-action="ai-toggle" aria-pressed="${consultUi.open}">AI 상담</button>`;

function lineHtml(l: Line, i: number, busy: boolean): string {
  if (l.who === 'card') {
    const go = l.rows.find((r) => r.go)?.go;
    return `<div class="ai-card"><b>바꾼 설정 ${l.rows.length}개</b>${l.rows.map((r) => `<div class="ai-ch"><span>${esc(r.title)}</span><i><s>${esc(r.fromLabel)}</s> → <em>${esc(r.toLabel)}</em></i></div>`).join('')}
      <div class="ai-btns">${l.undone ? '<button class="gx-mini" disabled>되돌렸어요</button>' : `<button class="gx-mini" data-action="ai-undo" data-value="${i}"${busy ? ' disabled' : ''}>되돌리기</button>`}${go ? `<button class="gx-mini" data-action="ai-go" data-value="${esc(go[0])}|${esc(go[1])}">설정으로 가기 →</button>` : ''}</div></div>`;
  }
  if (l.who === 'err') return `<div class="ai-sys ai-err"><span>${esc(l.text)}</span><button class="gx-mini" data-action="ai-retry"${busy ? ' disabled' : ''}>다시 시도</button></div>`;
  if (l.who === 'sys') return `<div class="ai-sys">${esc(l.text)}</div>`;
  return `<div class="ai-m ${l.who === 'me' ? 'ai-me' : 'ai-op'}">${esc(l.text)}</div>`;
}

export function consultAside(ctx: ChatContext | null, render: () => void): string {
  if (!consultUi.open) return '';
  ensureLoaded(render);
  const lines = ctx && store ? mine(ctx).lines : [];
  const busy = consultUi.busy;
  const model = modelOf();
  return `<aside class="gw-ai" role="dialog" aria-label="AI 상담">
    <div class="gw-ai-top"><span class="gw-brand">${GHOST_ICON}</span><b>AI 상담</b><button class="ai-model" data-action="ai-model" data-value="${model === 'aux' ? 'main' : 'aux'}" aria-label="부를 모델: ${model === 'aux' ? '보조 모델' : '메인 모델'}"${busy ? ' disabled' : ''}>${model === 'aux' ? '보조 모델' : '메인 모델'}</button><button class="gx-x" data-action="ai-close" aria-label="닫기">${ICONS.close}</button></div>
    <div class="gw-ai-log" aria-live="polite">
      <div class="ai-sys">설정을 묻거나 바꿔 달라고 하세요. 이 대화는 메인 요청에 들어가지 않아요.</div>
      ${lines.map((l, i) => lineHtml(l, i, busy)).join('')}
    </div>
    <div class="gw-ai-in"><input class="gx-search" name="ai-q" data-input="ai-q" data-enter="ai-send" value="${esc(consultUi.input)}" maxlength="500" placeholder="${busy ? '보내는 중…' : '설정에 대해 물어보세요'}" aria-label="메시지" autocomplete="off"${busy || !ctx ? ' disabled' : ''}><button class="gx-mini" data-action="ai-send" data-take="ai-q"${busy || !ctx ? ' disabled' : ''}>보내기</button></div>
  </aside>`;
}

/** 그린 뒤: 새 줄이 생겼으면 맨 아래로, 보낸 뒤엔 글칸 비우기 */
export function consultAfterRender(root: HTMLElement, ctx: ChatContext | null): void {
  root.classList.toggle('ai-on', consultUi.open);
  if (!consultUi.open) { consultUi.drawn = -1; return; }
  const input = root.querySelector<HTMLInputElement>('.gw-ai [name="ai-q"]');
  if (input && consultUi.clear) { input.value = ''; consultUi.clear = false; }
  const n = ctx && store ? mine(ctx).lines.length : 0;
  const log = root.querySelector<HTMLElement>('.gw-ai-log');
  if (log && n !== consultUi.drawn) log.scrollTop = log.scrollHeight;
  consultUi.drawn = n;
}

export interface ConsultDeps {
  render(): void;
  /** 지금 채팅 (바꾼 뒤 새로 읽은 것) */
  ctx(): ChatContext | null;
  started(): boolean;
  /** 패널의 동작 처리기 (fl-do 가 그 설정의 원래 저장 동작을 부른다) */
  panel(action: string, value?: string): Promise<void>;
  /** 설정 창의 동작 (「설정으로 가기 →」) */
  editor(action: string, value?: string): Promise<void>;
  phone(): boolean;
}

/** 값 하나를 그 설정의 원래 동작으로 바꾸고, 정말 바뀌었는지 다시 읽어 본다 */
async function setOne(d: ConsultDeps, id: string, value: string): Promise<CardRow | null> {
  const ctx = d.ctx();
  if (!ctx) return null;
  const e = consultCatalog(ctx, d.started()).entries.find((x) => x.item.id === id);
  if (!e || e.item.cur === value) return null;
  for (const a of e.ctl.act(value)) await d.panel(FLOW_DO, a);
  const after = d.ctx();
  const now = after ? consultCatalog(after, d.started()).entries.find((x) => x.item.id === id) : null;
  if (!now || now.item.cur !== value) return null;
  return { id, title: e.title, from: e.item.cur, to: value, fromLabel: consultLabel(e.item, e.item.cur), toLabel: consultLabel(now.item, value), go: e.go };
}

async function ask(d: ConsultDeps, ctx: ChatContext): Promise<void> {
  const key = chatKey(ctx);
  const me = mine(ctx);
  const started = d.started();
  const { entries, summary } = consultCatalog(ctx, started);
  const items = entries.map((e) => e.item);
  const pending = me.pending.filter((p) => items.some((i) => i.id === p.id));
  const talk: ConsultTalk[] = me.lines.filter((l): l is { who: 'me' | 'op'; text: string } => l.who === 'me' || l.who === 'op').slice(-TALK_LINES);
  const gen = genSettings(flowView(ctx, started).scope);
  consultUi.busy = true;
  d.render();
  try {
    const { value } = await generate(consultPrompt({ items, summary, pending, talk }), modelOf(), parseConsult, { retries: gen.retries, retryModel: gen.retryModel, label: 'AI 상담' });
    const now = d.ctx();
    const same = !!now && chatKey(now) === key;
    me.lines.push({ who: 'op', text: value.say });
    me.pending = [];
    if (value.apply) {
      // 적용: 앞 턴에 적어 둔 것만. 이번 답의 <set> 은 적용하지 않는다
      if (!pending.length) me.lines.push({ who: 'sys', text: '바꾸자고 한 것이 없어서 아무것도 바꾸지 않았어요.' });
      else if (!same) me.lines.push({ who: 'sys', text: '채팅이 바뀌어서 아무것도 바꾸지 않았어요.' });
      else {
        const rows: CardRow[] = [];
        const failed: string[] = [];
        for (const p of pending) {
          const row = await setOne(d, p.id, p.value);
          if (row) rows.push(row);
          else failed.push(entries.find((e) => e.item.id === p.id)?.item.name ?? p.id);
        }
        if (rows.length) me.lines.push({ who: 'card', rows });
        if (failed.length) me.lines.push({ who: 'sys', text: `바꾸지 못했어요: ${failed.join(', ')}` });
      }
    }
    if (value.set.length && !(value.apply && pending.length)) {
      const { ok, bad } = checkConsult(items, value.set);
      me.pending = ok;
      if (bad.length) me.lines.push({ who: 'sys', text: `바꿀 수 없는 것은 뺐어요. ${bad.join(' · ')}` });
    }
  } catch (error) {
    me.lines.push({ who: 'err', text: `답을 받지 못했어요. ${(error instanceof Error ? error.message : String(error)).split('\n')[0].slice(0, 200)}` });
  }
  me.at = Date.now();
  consultUi.busy = false;
  await persist();
  d.render();
}

export async function consultAction(action: string, value: string | undefined, d: ConsultDeps): Promise<void> {
  const ctx = d.ctx();
  if (action === 'ai-toggle' || action === 'ai-close') {
    consultUi.open = action === 'ai-toggle' ? !consultUi.open : false;
    return d.render();
  }
  if (action === 'ai-go') {
    if (d.phone()) consultUi.open = false; // 폰: 판이 화면을 덮으니 닫고 간다
    return d.editor('ed-flow-go', value);
  }
  if (action === 'ai-model') {
    if (consultUi.busy) return;
    await savePrefs((p) => { const { consultModel: _drop, ...rest } = p; return value === 'main' ? { ...rest, consultModel: 'main' as const } : rest; });
    return d.render();
  }
  if (!ctx || consultUi.busy || !store) return;
  const me = mine(ctx);
  if (action === 'ai-send') {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!text) return;
    me.lines.push({ who: 'me', text });
    consultUi.input = '';
    consultUi.clear = true;
    return ask(d, ctx);
  }
  if (action === 'ai-retry') {
    const last = me.lines.at(-1);
    if (last?.who !== 'err') return;
    me.lines.pop();
    return ask(d, ctx);
  }
  if (action === 'ai-undo') {
    const card = me.lines[Number(value)];
    if (!card || card.who !== 'card' || card.undone) return;
    consultUi.busy = true;
    d.render();
    const failed: string[] = [];
    for (const r of [...card.rows].reverse()) {
      const cur = consultCatalog(d.ctx() ?? ctx, d.started()).entries.find((e) => e.item.id === r.id);
      if (cur && cur.item.cur === r.from) continue; // 이미 그 값
      if (!(await setOne(d, r.id, r.from))) failed.push(r.title);
    }
    if (failed.length) me.lines.push({ who: 'sys', text: `되돌리지 못했어요: ${failed.join(', ')}` });
    else card.undone = true;
    me.at = Date.now();
    consultUi.busy = false;
    await persist();
    return d.render();
  }
}

/** 설정 창을 닫을 때 */
export function consultClose(): void {
  consultUi.open = false;
}
