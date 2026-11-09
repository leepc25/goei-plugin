// 호출 흐름 기록 (11-07 사용자: 「가장 최근 요청과 마지막 응답 결과를 프로세스 형태로」). 한 턴 = 본편 요청 조립 → 보조 호출들 → 본편 응답 → 응답 뒤 보조 호출들.
// 플러그인이 부르는 보조 호출은 전부 host/llm.ts runModel 을 거치므로 거기서 한 건씩 적고, 본편 요청·응답은 body.ts 가 적는다.
// 저장: 플러그인 저장소 goei-trace 에 최근 TRACE_KEEP 턴. 요청·응답 원문은 한 건당 TRACE_TEXT 자까지(앞 2/3 + 뒤 1/3). 화면은 ui/editor/trace.ts.
import type { LlmMessage } from './llm';
import { tokens } from '../core/gnet';
import { progressBegin, progressMain, progressReply } from '../core/progress';

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
  /** 마지막 세 메시지 원문 (잘린 글) — 플러그인이 끼운 블록은 보통 여기 있다 */
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
export const TRACE_TEXT = 6000;
const KEY = 'goei-trace';

let turns: TraceTurn[] | null = null;
let loading: Promise<TraceTurn[]> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** 지금 열린 턴 (본편 요청 조립이 시작되면 열리고, 다음 조립이 시작되면 닫힌다) */
let open: TraceTurn | null = null;
/** 열린 턴에 본편 응답이 붙었는지 (그 뒤 호출은 after) */
let replied = false;

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
        turns = Array.isArray(v) ? (v as TraceTurn[]).filter((t) => t && typeof t.id === 'string' && Array.isArray(t.calls)) : [];
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

function save(): void {
  notify();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void (async () => {
      try {
        const list = await load();
        await risuai.pluginStorage.setItem(KEY, JSON.stringify(list.slice(-TRACE_KEEP)));
      } catch {
        /* 기록을 못 남겨도 진행 */
      }
    })();
  }, 300);
}

/** 화면용: 최근 턴 (최신이 뒤) */
export async function loadTrace(): Promise<TraceTurn[]> {
  return [...(await load())];
}

export async function clearTrace(): Promise<void> {
  turns = [];
  open = null;
  replied = false;
  notify();
  try {
    await risuai.pluginStorage.setItem(KEY, '[]');
  } catch {
    /* 무시 */
  }
}

async function push(t: TraceTurn): Promise<void> {
  const list = await load();
  list.push(t);
  while (list.length > TRACE_KEEP) list.shift();
  save();
}

/** 본편 요청 조립 시작: 새 턴을 연다 (이전 턴은 닫힌다) */
export async function traceBegin(): Promise<void> {
  const t: TraceTurn = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), calls: [] };
  open = t;
  replied = false;
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
    tail: rows.slice(-3).map((r) => ({ role: r.role, content: clip(r.content) })),
    failed: [...failed],
    totalChars: rows.reduce((n, r) => n + r.content.length, 0),
    totalTokens: rows.reduce((n, r) => n + tokens(r.content), 0),
  };
  progressMain(); // 본편 요청을 보낸다
  save();
}

/** 본편 응답이 붙었다 */
export function traceReply(text: string): void {
  if (!open) return;
  open.reply = { at: new Date().toISOString(), text: clip(text), chars: text.length, tokens: tokens(text) };
  replied = true;
  progressReply(open.reply.tokens);
  save();
}

/** 보조 호출 한 건 (runModel 이 부른다). 열린 턴이 없으면 수동 턴을 만든다 */
export async function traceCall(c: Omit<TraceCall, 'phase' | 'at'> & { at: string }): Promise<void> {
  let t = open;
  let phase: TraceCall['phase'] = replied ? 'after' : 'before';
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
  save();
}

/** runModel 의 요청 메시지를 기록용 글로 */
export function requestText(messages: LlmMessage[]): string {
  return messages.map((m) => `[${m.role}]\n${m.content}`).join('\n\n');
}
