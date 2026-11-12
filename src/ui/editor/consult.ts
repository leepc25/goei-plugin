// 설정 창 「AI 상담」 (설정 개편 6단계, 2026-11-12 사용자 「시안대로 적용」. 모양 = 시안8).
// PC: 설정 창 옆에 뜨는 380px 창. 폰: 아래에서 올라오는 판. 설정 창 머리의 「AI 상담」 단추로 열고 닫는다.
// 셈(요청문·응답 읽기·값 대조)은 src/core/consult.ts, 설정 목록은 catalog.ts (메뉴 화면을 그대로 읽는다). 여기는 화면과 순서:
//   1) 사용자 말 → 2) 모델 답. 바꾸자는 것(<set>)이 있으면 대조해서 「바꾸자고 한 것」으로 적어만 둔다 (적용 안 함)
//   3) 다음 사용자 말에 모델이 <apply> 를 내면, 그 전에 적어 둔 것만 적용하고 「바꾼 설정 N개」 판을 남긴다. 아니면 적어 둔 것은 버린다.
// 2026-11-12 사용자: 호출 흐름만이 아니라 설정 탭의 모든 메뉴. 메뉴마다 줄 이름은 늘 넘기고, 자세한 줄은 코드가 고른 메뉴 것만 넘긴다
//   (지금 보는 메뉴 · 바꾸자고 한 줄과 마지막 판의 메뉴 · 사용자 글에 이름이 나온 메뉴). 모자라면 모델이 <open> 으로 메뉴를 더 달라고 하고, 코드가 한 번만 다시 묻는다.
// 적용은 그 메뉴 화면의 조작이 보내는 동작 그대로 (상담 전용 통로 ai-do, src/ui/app.ts). 적용 뒤 화면을 다시 읽어 정말 바뀌었는지 본다.
// 대화는 채팅(메시지·상태값)에 쓰지 않고 플러그인 저장소(goei:consult)에 채팅마다 따로 둔다 → 메인 요청에 들어갈 길이 없다.
import type { ChatContext } from '../../host/risu';
import { generate, type ModelChoice } from '../../host/llm';
import { savePrefs } from '../../host/prefs';
import { loadTrace } from '../../host/trace';
import { getPrefs } from '../../core/settings';
import { advNum, genSettings } from '../../core/advanced';
import { tokens } from '../../core/gnet';
import { checkConsult, consultCan, consultLabel, consultPrompt, itemLine, parseConsult, type ConsultChange, type ConsultReply, type ConsultSource, type ConsultTalk } from '../../core/consult';
import { GHOST_ICON, ICONS } from '../icons';
import { catalogAll, catalogCurrent, catalogOthers, catalogPage, sendsFor, type CatMenu, type CatRow } from './catalog';
import { flowView } from './flowpage';
import { flowNodes, flowTokState } from './flow';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const KEY = 'goei:consult';
/** 채팅마다 남기는 줄 수 · 기억하는 채팅 수 · 모델에 넘기는 지난 대화 줄 수 */
const KEEP_LINES = 80;
const KEEP_CHATS = 30;
const TALK_LINES = 24;

interface CardRow { id: string; page: string; title: string; from: string; to: string; fromLabel: string; toLabel: string; go: [string, string] | null; scope?: string }
type Line = { who: 'me' | 'op' | 'sys' | 'err'; text: string; go?: [string, string] } | { who: 'card'; rows: CardRow[]; undone?: boolean };
interface Saved { lines: Line[]; pending: ConsultChange[]; at: number }

export const consultUi = { open: false, busy: false, input: '', clear: false, drawn: -1, confirm: false };
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

/* ── 요청에 넣는 것 ── */
const fmt = (n: number) => n.toLocaleString('ko-KR');
const flat = (s: string) => s.toLowerCase().replace(/\s+/g, '');
/** 목록 전체에서 id 로 (같은 조작이 두 메뉴에 있으면 앞의 것) */
const rowsOf = (menus: CatMenu[]): CatRow[] => {
  const seen = new Set<string>();
  return menus.flatMap((m) => m.rows).filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
};

/** [지금 상태]: 호출 흐름 한 줄 요약 + 마디마다 이름 · 턴마다 가는지 · 모델 · 호출 글 · 예상 토큰 (editor/flow.ts flowNodes) */
export function consultState(ctx: ChatContext, started: boolean): string {
  const { pre, main, post, manual } = flowNodes(flowView(ctx, started).ctx);
  const all = [...pre, ...post];
  const sure = all.reduce((n, x) => n + x.sure, 0);
  const maybe = all.reduce((n, x) => n + x.maybe, 0);
  const ready = flowTokState().ready;
  const tok = all.filter((x) => x.on && typeof x.tok === 'number').reduce((n, x) => n + (x.tok as number), 0);
  const line = (x: (typeof all)[number]) => `- ${x.name} | ${x.on ? '턴마다 호출' : '턴마다 호출 없음'}${x.model ? ` | 모델: ${x.model}` : ''} | 호출: ${x.calls}${ready && x.on && typeof x.tok === 'number' ? ` | 예상 토큰 ${fmt(x.tok)}` : ''}`;
  return [
    `턴마다 보조 호출 ${sure}회${maybe ? ` (조건에 따라 최대 ${sure + maybe}회)` : ''} · 메인 1회${ready ? ` · 예상 토큰 ${fmt(tok)}` : ''}`,
    ...(started ? [] : ['아직 채팅을 시작하기 전이에요. 값은 새 채팅이 받을 값이에요.']),
    '메인 요청 전', ...pre.map(line),
    '메인 응답', `- ${main.name} | 호출: ${main.calls}`,
    '메인 응답 뒤', ...post.map(line),
    '누르거나 열 때만', ...manual.map((x) => `- ${x.name}${x.model ? ` | 모델: ${x.model}` : ''} | 호출: ${x.calls}`),
  ].join('\n');
}

/** [지난 턴 실제]: 마지막 턴의 호출마다 숫자 한 줄. 채팅 글(요청·응답 원문, 실패 글)은 넣지 않는다 */
export async function consultLast(): Promise<string> {
  let turns: Awaited<ReturnType<typeof loadTrace>> = [];
  try { turns = await loadTrace(); } catch { /* 못 읽으면 기록 없음 */ }
  // 턴 밖에서 누른 호출만 있는 묶음(상점 열기·AI 상담 등)은 「지난 턴」이 아니다 (flowpage.ts lastTurn 과 같은 규칙)
  const t = [...turns].reverse().find((x) => x.main || x.calls.some((c) => c.phase !== 'manual'));
  if (!t) return '(지난 턴 기록 없음)';
  const calls = t.calls.filter((c) => c.phase !== 'manual');
  const model = (m: string) => (m === 'main' ? '메인' : m === 'aux' ? '보조' : 'ID 지정 모델');
  const sent = calls.reduce((n, c) => n + (c.requestTokens ?? 0), 0);
  const got = calls.reduce((n, c) => n + (c.responseTokens ?? 0), 0);
  return [
    `메인 요청 ${t.main?.totalTokens !== undefined ? `${fmt(t.main.totalTokens)}토큰` : '기록 없음'} · 메인 응답 ${t.reply?.tokens !== undefined ? `${fmt(t.reply.tokens)}토큰` : '기록 없음'}`,
    ...calls.map((c) => `- ${c.label} | ${c.phase === 'before' ? '메인 요청 전' : '메인 응답 뒤'} | ${model(c.model)} | 보낸 토큰 ${fmt(c.requestTokens ?? 0)} | 받은 토큰 ${fmt(c.responseTokens ?? 0)} | ${Math.round(c.ms / 100) / 10}초 | ${c.ok ? '성공' : '실패'}`),
    `보조 호출 ${calls.length}회 · 보낸 토큰 ${fmt(sent)} · 받은 토큰 ${fmt(got)}`,
  ].join('\n');
}

/** [메뉴]: 메뉴마다 소개와 줄 이름. 끝에 설정 메뉴가 아닌 항목 이름 (안내만) */
export function consultMenus(menus: CatMenu[]): string {
  const names = (m: CatMenu) => [...new Set(m.rows.flatMap((r) => r.keys))].join(', ');
  return [...menus.map((m) => `- ${m.menu}${m.intro ? `: ${m.intro}` : ''} | 줄: ${names(m)}`), '이 창에서 바꿀 수 없는 곳 (자리만 안내)', catalogOthers()].join('\n');
}

/** 사용자 글에 이름이 나온 메뉴: 메뉴 이름, 또는 한두 메뉴에만 있는 묶음·줄 이름 (여러 메뉴에 다 있는 이름으로는 메뉴를 못 고른다) */
export function menusInText(menus: CatMenu[], text: string): string[] {
  const t = flat(text);
  if (!t) return [];
  const where = new Map<string, Set<string>>();
  for (const m of menus) for (const k of new Set(m.rows.flatMap((r) => [...r.keys, r.group]).map(flat).filter((k) => k.length >= 2))) (where.get(k) ?? where.set(k, new Set()).get(k)!).add(m.page);
  const byName = menus.filter((m) => t.includes(flat(m.menu))).map((m) => m.page);
  const byRow = [...where].filter(([k, pages]) => pages.size <= 2 && t.includes(k)).flatMap(([, pages]) => [...pages]);
  return [...new Set([...byName, ...byRow])];
}

/** 펼칠 메뉴를 차례대로 고른다. 「생성 공통 → 요청 토큰 상한」이 있으면 그 안에 드는 메뉴까지만 (못 든 메뉴는 이름 목록에만 남는다) */
function openMenus(menus: CatMenu[], want: string[], base: number, budget: number): CatMenu[] {
  const out: CatMenu[] = [];
  let used = base;
  for (const page of [...new Set(want)]) {
    const m = menus.find((x) => x.page === page);
    if (!m || !m.rows.length) continue;
    const cost = budget > 0 ? tokens(m.rows.map(itemLine).join('\n')) : 0;
    if (budget > 0 && used + cost > budget) continue;
    used += cost;
    out.push(m);
  }
  return out;
}

/* ── 화면 ── */
const modelOf = (): ModelChoice => (getPrefs().consultModel === 'main' ? 'main' : 'aux');
export const consultButton = (): string => `<button class="gx-mini ai-open${consultUi.open ? ' on' : ''}" data-action="ai-toggle" aria-pressed="${consultUi.open}">AI 상담</button>`;
const goBtn = (go: [string, string]) => `<button class="gx-mini" data-action="ai-go" data-value="${esc(go[0])}|${esc(go[1])}">설정으로 가기 →</button>`;

function lineHtml(l: Line, i: number, busy: boolean): string {
  if (l.who === 'card') {
    const go = l.rows.find((r) => r.go)?.go;
    return `<div class="ai-card"><b>바꾼 설정 ${l.rows.length}개</b>${l.rows.map((r) => `<div class="ai-ch"><span>${esc(r.title)}${r.scope ? `<i class="gx-scope">${esc(r.scope)}</i>` : ''}</span><i><s>${esc(r.fromLabel)}</s> → <em>${esc(r.toLabel)}</em></i></div>`).join('')}
      <div class="ai-btns">${l.undone ? '<button class="gx-mini" disabled>되돌렸어요</button>' : `<button class="gx-mini" data-action="ai-undo" data-value="${i}"${busy ? ' disabled' : ''}>되돌리기</button>`}${go ? goBtn(go) : ''}</div></div>`;
  }
  if (l.who === 'err') return `<div class="ai-sys ai-err"><span>${esc(l.text)}</span><button class="gx-mini" data-action="ai-retry"${busy ? ' disabled' : ''}>다시 시도</button></div>`;
  if (l.who === 'sys') return `<div class="ai-sys">${esc(l.text)}</div>`;
  return `<div class="ai-m ${l.who === 'me' ? 'ai-me' : 'ai-op'}">${esc(l.text)}</div>${l.go ? `<div class="ai-btns ai-gobtn">${goBtn(l.go)}</div>` : ''}`;
}

export function consultAside(ctx: ChatContext | null, render: () => void): string {
  if (!consultUi.open) return '';
  ensureLoaded(render);
  const lines = ctx && store ? mine(ctx).lines : [];
  const busy = consultUi.busy;
  const model = modelOf();
  // 대화 지우기: 한 번 묻는다 (설정 창의 확인 칸과 같은 모양, 이 창 안에서)
  const confirm = consultUi.confirm && lines.length && !busy
    ? '<div class="gw-confirm"><div class="gw-confirm-box"><p>이 채팅의 상담 대화를 지울까요? 바꾼 설정은 그대로 둬요.</p><div class="gx-row-btns"><button class="gx-mini danger" data-action="ai-clear-yes">대화 지우기</button><button class="gx-mini" data-action="ai-clear-no">취소</button></div></div></div>'
    : '';
  return `<aside class="gw-ai" role="dialog" aria-label="AI 상담">
    <div class="gw-ai-top"><span class="gw-brand">${GHOST_ICON}</span><b>AI 상담</b><button class="ai-model" data-action="ai-model" data-value="${model === 'aux' ? 'main' : 'aux'}" aria-label="부를 모델: ${model === 'aux' ? '보조 모델' : '메인 모델'}"${busy ? ' disabled' : ''}>${model === 'aux' ? '보조 모델' : '메인 모델'}</button><button class="ai-model ai-clear" data-action="ai-clear"${busy || !lines.length ? ' disabled' : ''}>대화 지우기</button><button class="gx-x" data-action="ai-close" aria-label="닫기">${ICONS.close}</button></div>
    <div class="gw-ai-log" aria-live="polite">
      <div class="ai-sys">설정을 묻거나 바꿔 달라고 하세요. 이 대화는 메인 요청에 들어가지 않아요.</div>
      ${lines.map((l, i) => lineHtml(l, i, busy)).join('')}
    </div>
    <div class="gw-ai-in"><input class="gx-search" name="ai-q" data-input="ai-q" data-enter="ai-send" value="${esc(consultUi.input)}" maxlength="500" placeholder="${busy ? '보내는 중…' : '설정에 대해 물어보세요'}" aria-label="메시지" autocomplete="off"${busy || !ctx ? ' disabled' : ''}><button class="gx-mini" data-action="ai-send" data-take="ai-q"${busy || !ctx ? ' disabled' : ''}>보내기</button></div>${confirm}
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
  /** 패널의 동작 처리기 (ai-do 가 그 설정의 원래 저장 동작을 부른다) */
  panel(action: string, value?: string): Promise<void>;
  /** 설정 창의 동작 (「설정으로 가기 →」) */
  editor(action: string, value?: string): Promise<void>;
  phone(): boolean;
}

const rowAt = (page: string, id: string): CatRow | undefined => catalogPage(page).find((r) => r.id === id);
const press = (d: ConsultDeps, page: string, a: [string, string]) => d.panel('ai-do', `${page}|${a[0]}|${a[1]}`);
/** − + 단추만 있는 수: 한 칸씩 눌러 간다. 닿으면 true (지나쳤거나 더 안 움직이면 false) */
async function stepTo(d: ConsultDeps, page: string, id: string, value: string): Promise<boolean> {
  for (let i = 0; i < 400; i++) {
    const cur = rowAt(page, id);
    if (!cur) return false;
    if (cur.cur === value) return true;
    const [a] = sendsFor(cur, value);
    if (!a) return false;
    const gap = Number(value) - Number(cur.cur);
    await press(d, page, a);
    const next = rowAt(page, id);
    if (!next || next.cur === cur.cur) return false; // 더 안 움직임 (범위 끝)
    if ((Number(value) - Number(next.cur)) * gap < 0) return false; // 지나침 (한 칸이 그 값에 닿지 않음)
  }
  return false;
}
/** 값 하나를 그 설정의 원래 동작으로 바꾸고, 화면을 다시 읽어 정말 바뀌었는지 본다 */
async function setOne(d: ConsultDeps, page: string, id: string, value: string): Promise<CardRow | null> {
  const e = rowAt(page, id);
  if (!e || !consultCan(e) || e.cur === value) return null;
  const card = (now: CatRow): CardRow => ({ id, page, title: `${e.menu} · ${e.name}`, from: e.cur, to: now.cur, fromLabel: consultLabel(e, e.cur), toLabel: consultLabel(now, now.cur), go: e.go, ...(e.scope ? { scope: e.scope } : {}) });
  if (e.ctl?.t === 'rel') {
    if (await stepTo(d, page, id, value)) { const now = rowAt(page, id); return now ? card(now) : null; }
    await stepTo(d, page, id, e.cur); // 그 값에 못 닿았으면 처음 값으로
    return null;
  }
  for (const a of sendsFor(e, value)) await press(d, page, a);
  const now = rowAt(page, id);
  if (!now) return null;
  // 글 칸은 처리기가 글을 다듬을 수 있다 (빈칸 정리 등): 바뀌었으면 화면에 남은 글을 판에 적는다
  if (e.kind === 'text' ? now.cur === e.cur : now.cur !== value) return null;
  return card(now);
}

async function ask(d: ConsultDeps, ctx: ChatContext): Promise<void> {
  const key = chatKey(ctx);
  const me = mine(ctx);
  const started = d.started();
  consultUi.busy = true;
  d.render();
  try {
    const menus = catalogAll();
    const all = rowsOf(menus);
    const pending = me.pending.filter((p) => all.some((i) => i.id === p.id));
    const talk: ConsultTalk[] = me.lines.filter((l): l is { who: 'me' | 'op'; text: string } => l.who === 'me' || l.who === 'op').slice(-TALK_LINES).map((l) => ({ who: l.who, text: l.text }));
    const scope = flowView(ctx, started).scope;
    const gen = genSettings(scope);
    const budget = advNum(scope, 'gen', 'budget');
    const lastCard = [...me.lines].reverse().find((l) => l.who === 'card');
    const pageOf = (id: string) => all.find((r) => r.id === id)?.page ?? '';
    const said = [...me.lines].reverse().find((l) => l.who === 'me');
    // 펼칠 메뉴: 지금 보는 메뉴 → 바꾸자고 한 줄·마지막 판의 메뉴 → 사용자 글에 이름이 나온 메뉴 → (다시 물을 때) 모델이 달라고 한 메뉴
    const want = [catalogCurrent(), ...pending.map((p) => pageOf(p.id)), ...(lastCard?.who === 'card' ? lastCard.rows.map((r) => r.page) : []), ...menusInText(menus, said && said.who === 'me' ? said.text : '')].filter(Boolean);
    const src = (opened: CatMenu[]): ConsultSource => ({ state: consultState(ctx, started), last, menus: consultMenus(menus), opened: opened.map((m) => ({ menu: m.menu, items: m.rows })), all, pending, talk });
    const last = await consultLast();
    const size = (m: { content: string }[]) => m.reduce((n, x) => n + tokens(x.content), 0);
    const base = budget > 0 ? size(consultPrompt(src([]))) : 0;
    const call = async (wantNow: string[]): Promise<ConsultReply> =>
      (await generate(consultPrompt(src(openMenus(menus, wantNow, base, budget))), modelOf(), parseConsult, { retries: gen.retries, retryModel: gen.retryModel, label: 'AI 상담' })).value;
    let value = await call(want);
    // <open>: 모델이 메뉴를 더 달라고 하면 그 메뉴를 더해 한 번만 다시 묻는다 (그 답은 화면에 내지 않는다). 없는 메뉴 이름은 버린다
    const more = value.open.map((n) => menus.find((m) => flat(m.menu) === flat(n))?.page ?? '').filter((p) => p && !want.includes(p));
    if (more.length) value = await call([...want, ...more]);
    if (!value.say) throw new Error('<say> 블록이 없어요.');
    const now = d.ctx();
    const same = !!now && chatKey(now) === key;
    const go = all.find((r) => r.id === value.go)?.go;
    me.lines.push({ who: 'op', text: value.say, ...(go ? { go } : {}) });
    me.pending = [];
    if (value.apply) {
      // 적용: 앞 턴에 적어 둔 것만. 이번 답의 <set> 은 적용하지 않는다
      if (!pending.length) me.lines.push({ who: 'sys', text: '바꾸자고 한 것이 없어서 아무것도 바꾸지 않았어요.' });
      else if (!same) me.lines.push({ who: 'sys', text: '채팅이 바뀌어서 아무것도 바꾸지 않았어요.' });
      else {
        const rows: CardRow[] = [];
        const failed: string[] = [];
        for (const p of pending) {
          const row = await setOne(d, pageOf(p.id), p.id, p.value);
          if (row) rows.push(row);
          else failed.push(all.find((e) => e.id === p.id)?.name ?? p.id);
        }
        if (rows.length) me.lines.push({ who: 'card', rows });
        if (failed.length) me.lines.push({ who: 'sys', text: `바꾸지 못했어요: ${failed.join(', ')}` });
      }
    }
    if (value.set.length && !(value.apply && pending.length)) {
      const { ok, bad } = checkConsult(all, value.set);
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
    consultUi.confirm = false;
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
  if (action === 'ai-clear' || action === 'ai-clear-no') {
    // 대화 지우기: 한 번 묻는다
    consultUi.confirm = action === 'ai-clear' && me.lines.length > 0;
    return d.render();
  }
  if (action === 'ai-clear-yes') {
    // 이 채팅의 상담 대화(판 포함)와 「바꾸자고 한 것」만 비운다. 바꾼 설정값·다른 채팅의 대화·모델 고르기는 그대로
    if (!consultUi.confirm) return;
    consultUi.confirm = false;
    me.lines = [];
    me.pending = [];
    me.at = Date.now();
    await persist();
    return d.render();
  }
  consultUi.confirm = false;
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
      const cur = rowAt(r.page, r.id);
      if (cur && cur.cur === r.from) continue; // 이미 그 값
      if (!(await setOne(d, r.page, r.id, r.from))) failed.push(r.title);
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
  consultUi.confirm = false;
}
