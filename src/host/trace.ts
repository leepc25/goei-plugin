// 호출 흐름 기록 (11-07 사용자: 「가장 최근 요청과 마지막 응답 결과를 프로세스 형태로」). 한 턴 = 본편 요청 조립 → 보조 호출들 → 본편 응답 → 응답 뒤 보조 호출들.
// 플러그인이 부르는 보조 호출은 전부 host/llm.ts runModel 을 거치므로 거기서 한 건씩 적고, 본편 요청·응답은 body.ts 가 적는다.
// 저장: 플러그인 저장소 goei-trace 에 최근 TRACE_KEEP 턴의 id 목록, 턴마다 goei-trace:<id> (바뀐 턴만 다시 쓴다. 전수검사 11-13). 요청·응답 원문은 한 건당 TRACE_TEXT 자까지(앞 2/3 + 뒤 1/3). 화면은 ui/editor/trace.ts.
import type { LlmMessage } from './llm';
import { tokens } from '../core/gnet';
import { progressBegin, progressMain, progressMainTokens, progressReply, progressTurn } from '../core/progress';

export interface TraceCall {
  /** 호출 종류 (라우터·디렉터·갱신기·괴담넷·괴담톡·위키·소지품·상점·…) */
  label: string;
  at: string;
  ms: number;
  /** main / aux / 전용 모델 ID */
  model: string;
  ok: boolean;
  error?: string;
  /** 요청 (역할: 내용, 줄바꿈으로 이음). 잘린 글 */
  request: string;
  requestChars: number;
  /** 요청 토큰 (토크나이저가 있으면 실측, 없으면 어림) */
  requestTokens?: number;
  /** 받은 값. 잘린 글 */
  response: string;
  responseChars: number;
  responseTokens?: number;
  /** 같은 턴 안 순서 (본편 응답 전 = before, 뒤 = after, 턴 밖 = manual) */
  phase: 'before' | 'after' | 'manual';
}

export interface TraceMain {
  at: string;
  /** 플러그인이 조립을 끝낸 뒤 요청 전체: 메시지별 역할·글자 수 */
  shape: { role: string; chars: number }[];
  /** 메시지 전부 원문 (아주 긴 것만 잘림). 11-09 사용자: 마지막 셋만 두니 24개 중 21개가 안 보였다 — 다섯 턴 다 전체를 둔다(플러그인 저장소라 용량 문제 없음) */
  tail: { role: string; content: string }[];
  /** 조립 단계 중 실패한 것 */
  failed: string[];
  totalChars: number;
  totalTokens?: number;
}

export interface TraceTurn {
  id: string;
  at: string;
  /** 본편 요청 (플러그인이 끼워 넣기 끝난 모양). 턴 밖 수동 호출만 있으면 없음 */
  main?: TraceMain;
  /** 본편 응답 (Risu 가 붙인 글). 잘린 글 */
  reply?: { at: string; text: string; chars: number; tokens?: number };
  calls: TraceCall[];
}

export const TRACE_KEEP = 5;
/** 요청·응답 글 하나의 보관 한도. 사실상 생략 없이 전부 남긴다 (2026-11-13 사용자: 「대부분 생략이 되어있는데 꼭 생략해야 하나」). 전에는 6000자·본편 40000자 */
export const TRACE_TEXT = 400000;
/** 본편 요청 메시지 하나의 보관 한도 */
export const TRACE_MAIN_TEXT = 400000;
/** 한 턴 원문(요청+응답) 합계 한도. 넘으면 그 턴의 오래된 호출부터 원문만 비운다. 이름·시간·글자 수·토큰 수는 남는다 (전수검사 11-13, 사용자 17-1) */
export const TRACE_TURN_CHARS = 3_000_000;
const EMPTIED = '(한 턴 기록이 300만 자를 넘어 오래된 호출부터 원문을 비웠어요)';
const KEY = 'goei-trace';
const turnKey = (id: string) => `${KEY}:${id}`;
/** 저장할 턴 (바뀐 것만). 한 번에 다섯 턴(수 MB)을 통째로 다시 쓰지 않게 (전수검사 11-13) */
const dirty = new Set<string>();
/** 저장소에 적힌 id 목록 (null = 모름 → 다음 저장 때 목록을 다시 쓴다) */
let savedIds: string[] | null = null;

let turns: TraceTurn[] | null = null;
let loading: Promise<TraceTurn[]> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** 지금 열린 턴 (본편 요청 조립이 시작되면 열리고, 다음 조립이 시작되면 닫힌다) */
let open: TraceTurn | null = null;
/** 열린 턴에 본편 응답이 붙었는지 (그 뒤 호출은 after) */
let replied = false;
/** 열린 턴의 응답 뒤 작업이 다 끝났는지 (그 뒤 손으로 누른 호출은 manual. 전수검사 11-13: 지난 턴 합계에 섞였다) */
let ended = false;

export const clip = (s: string, max = TRACE_TEXT): string => {
  if (s.length <= max) return s;
  const head = Math.floor(max * 2 / 3);
  const tail = max - head;
  return `${s.slice(0, head)}\n…(${s.length - max}자 생략)…\n${s.slice(-tail)}`;
};

async function load(): Promise<TraceTurn[]> {
  if (turns) return turns;
  if (!loading) {
    loading = (async () => {
      try {
        const raw: unknown = await risuai.pluginStorage.getItem(KEY);
        const v = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
        const ok = (t: unknown): t is TraceTurn => !!t && typeof (t as TraceTurn).id === 'string' && Array.isArray((t as TraceTurn).calls);
        if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
          // 지금 모양: id 목록 + 턴마다 따로
          const got = await Promise.all((v as string[]).map(async (id) => {
            try {
              const r: unknown = await risuai.pluginStorage.getItem(turnKey(id));
              const t = typeof r === 'string' ? (JSON.parse(r) as unknown) : r;
              return ok(t) ? t : null;
            } catch {
              return null;
            }
          }));
          turns = got.filter((t): t is TraceTurn => !!t);
          savedIds = [...(v as string[])];
        } else {
          // 옛 모양(턴 배열 통째): 다음 저장 때 턴마다 나눠 쓴다
          turns = Array.isArray(v) ? v.filter(ok) : [];
          for (const t of turns) dirty.add(t.id);
          savedIds = null;
        }
      } catch {
        turns = [];
      }
      return turns;
    })();
  }
  return loading;
}

/** 기록이 바뀔 때 알림 (11-09 사용자: 열어 둔 호출 기록 페이지가 저절로 갱신되게 — 「다시 읽기」 단추 대신) */
const listeners = new Set<() => void>();
export function onTraceChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
const notify = () => {
  for (const f of listeners) {
    try {
      f();
    } catch {
      /* 화면 쪽 오류는 기록을 막지 않는다 */
    }
  }
};

/** id: 바뀐 턴. 화면에는 바로 알리고, 저장은 조금 모았다가 바뀐 턴만 쓴다 (전수검사 11-13) */
function save(id?: string): void {
  if (id) dirty.add(id);
  notify();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void (async () => {
      try {
        const keep = (await load()).slice(-TRACE_KEEP);
        const ids = keep.map((t) => t.id);
        const write = keep.filter((t) => dirty.has(t.id));
        dirty.clear();
        const before = savedIds;
        const same = !!before && before.length === ids.length && before.every((x, i) => x === ids[i]);
        savedIds = ids;
        for (const t of write) await risuai.pluginStorage.setItem(turnKey(t.id), JSON.stringify(t));
        if (!same) await risuai.pluginStorage.setItem(KEY, JSON.stringify(ids));
        for (const old of before ?? []) if (!ids.includes(old)) await risuai.pluginStorage.removeItem(turnKey(old)).catch(() => {});
      } catch {
        /* 기록을 못 남겨도 진행 */
      }
    })();
  }, 1500);
}

/** 화면용: 최근 턴 (최신이 뒤) */
export async function loadTrace(): Promise<TraceTurn[]> {
  return [...(await load())];
}

export async function clearTrace(): Promise<void> {
  turns = [];
  open = null;
  replied = false;
  ended = false;
  dirty.clear();
  savedIds = [];
  notify();
  try {
    await risuai.pluginStorage.setItem(KEY, '[]');
    const keys: unknown = await risuai.pluginStorage.keys();
    for (const k of Array.isArray(keys) ? keys : []) if (typeof k === 'string' && k.startsWith(`${KEY}:`)) await risuai.pluginStorage.removeItem(k).catch(() => {});
  } catch {
    /* 무시 */
  }
}

async function push(t: TraceTurn): Promise<void> {
  const list = await load();
  list.push(t);
  while (list.length > TRACE_KEEP) list.shift();
  save(t.id);
}

/** 본편 요청 조립 시작: 새 턴을 연다 (이전 턴은 닫힌다) */
export async function traceBegin(): Promise<void> {
  const t: TraceTurn = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), calls: [] };
  open = t;
  replied = false;
  ended = false;
  progressBegin(); // 진행 창 (core/progress.ts): 새 턴
  await push(t);
}

/** 본편 요청 조립 끝: 최종 모양을 적는다 */
export function traceMain(messages: { role?: string; content?: unknown }[], failed: string[]): void {
  if (!open) return;
  const rows = messages.map((m) => ({ role: String(m?.role ?? ''), content: typeof m?.content === 'string' ? m.content : '' }));
  open.main = {
    at: new Date().toISOString(),
    shape: rows.map((r) => ({ role: r.role, chars: r.content.length })),
    tail: rows.map((r) => ({ role: r.role, content: clip(r.content, TRACE_MAIN_TEXT) })),
    failed: [...failed],
    totalChars: rows.reduce((n, r) => n + r.content.length, 0),
  };
  progressMain(); // 본편 요청을 보낸다
  save(open.id);
  // 토큰 수는 요청을 보낸 뒤에 센다. 긴 요청은 세는 데 1초 가까이 걸려 본편이 늦게 나갔다 (전수검사 11-13)
  const t = open;
  const main = open.main;
  const pt = progressTurn();
  setTimeout(() => {
    main.totalTokens = rows.reduce((n, r) => n + tokens(r.content), 0);
    if (pt) progressMainTokens(main.totalTokens, pt);
    save(t.id);
  }, 0);
}

/** 본편 응답이 붙었다 */
export function traceReply(text: string): void {
  if (!open) return;
  open.reply = { at: new Date().toISOString(), text: clip(text), chars: text.length, tokens: tokens(text) };
  replied = true;
  progressReply(open.reply.tokens);
  save(open.id);
}

/** 지금 열린 턴의 id (body.ts 가 응답 뒤 작업을 마칠 때 그 턴만 닫으려고 쥔다) */
export const traceTurnId = (): string | null => open?.id ?? null;

/** 턴의 응답 뒤 작업이 다 끝났다. 앞 턴의 뒤 작업이 늦게 끝나도 새 턴은 닫지 않는다 */
export function traceEnd(id: string | null): void {
  if (open && id && open.id === id) ended = true;
}

/** 보조 호출 한 건 (runModel 이 부른다). 열린 턴이 없으면 수동 턴을 만든다. 턴이 끝난 뒤의 호출은 그 턴에 manual 로 붙는다 */
export async function traceCall(c: Omit<TraceCall, 'phase' | 'at'> & { at: string }): Promise<void> {
  let t = open;
  let phase: TraceCall['phase'] = ended ? 'manual' : replied ? 'after' : 'before';
  if (!t) {
    const list = await load();
    const last = list[list.length - 1];
    if (last && !last.main && Date.now() - new Date(last.at).getTime() < 10 * 60 * 1000) t = last;
    else {
      t = { id: `${Date.now().toString(36)}m`, at: c.at, calls: [] };
      await push(t);
    }
    phase = 'manual';
  }
  t.calls.push({ ...c, phase });
  let sum = t.calls.reduce((n, x) => n + x.request.length + x.response.length, 0);
  for (const x of t.calls) {
    if (sum <= TRACE_TURN_CHARS) break;
    if (x.request === EMPTIED) continue;
    sum -= x.request.length + x.response.length - EMPTIED.length;
    x.request = EMPTIED;
    x.response = '';
  }
  save(t.id);
}

/** runModel 의 요청 메시지를 기록용 글로 */
export function requestText(messages: LlmMessage[]): string {
  return messages.map((m) => `[${m.role}]\n${m.content}`).join('\n\n');
}
