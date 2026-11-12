// 호출 진행 상태 (11-09 사용자: 한 턴에 라우터→디렉터→본편→갱신기→인터넷이 어떻게 돌고 있는지 보이게 — 리수폿 MissionProgressPanel·유미 프로바이더 매니저 참고).
// 턴이 열리면(본편 요청 조립 시작) 그 턴에 돌 단계 계획(core/progplan.ts)을 깔고, 모델 호출이 시작·진행·끝날 때마다 적는다.
// 화면(host/progwin.ts)은 onProgress 로 구독해 그린다. 이 파일은 Risu API 를 쓰지 않는다 (시험: tests/progress.test.mjs).

/** 폰 막대의 점 다섯 개 (길이 고정, 11-09 사용자) */
/** other = 채팅 턴과 상관없는 단추 작업(상점 등): 폰 막대 점에는 안 나온다 (릴리스 점검 11-09: 상점이 「인터넷」 점을 켰다) */
export type StageGroup = 'router' | 'director' | 'main' | 'update' | 'net' | 'other';
export const GROUPS: StageGroup[] = ['router', 'director', 'main', 'update', 'net'];
export const GROUP_LABEL: Record<StageGroup, string> = { router: '라우터', director: '디렉터', main: '메인', update: '갱신기', net: '인터넷', other: '기타' };

export interface Stage {
  id: string;
  /** 칸·줄에 쓰는 이름 (통합 요청은 「통합」) */
  label: string;
  group: StageGroup;
  /** 작은 글씨 (통합 멤버 「괴담톡 · 괴담넷」) */
  note?: string;
  /** 이 단계에 속하는 호출 이름 (앞부분 일치, 긴 것이 이김) */
  match: string[];
}

export interface Call {
  id: number;
  label: string;
  /** main / aux / 전용 모델 ID */
  model: string;
  reqTokens: number;
  at: number;
  ms?: number;
  ok?: boolean;
  error?: string;
  respTokens?: number;
  /** 스트리밍으로 받는 중인 글자 수 */
  chars?: number;
  stage: string;
}

export interface Turn {
  at: number;
  plan: Stage[];
  calls: Call[];
  /** 본편 요청을 보낸 때 · 응답이 붙은 때 */
  mainAt?: number;
  replyAt?: number;
  replyTokens?: number;
  /** 본편에 보낸 토큰 (host/trace.ts 가 조립된 요청을 센 값) */
  mainTokens?: number;
  /** 턴이 다 끝난 때 (끝내기 요청이 왔고 도는 호출이 없을 때) */
  endAt?: number;
  /** 채팅 턴 밖(단추로 부른) 호출만 있는 턴 */
  manual: boolean;
  /** 본편이 실패·중지됐거나 너무 오래 응답이 없어 닫은 턴 (릴리스 점검 11-09: 「본편 응답 대기」로 영영 펼쳐져 있었다) */
  aborted?: boolean;
  /** 이 턴의 채팅 (body.ts 감시가 채운다). 채팅을 옮기면 턴을 치운다 */
  chat?: string;
}

/** 본편 응답을 이만큼 기다려도 안 오면 실패로 닫는다 */
export const PROGRESS_WATCHDOG = 10 * 60 * 1000;

export type StageState = 'wait' | 'run' | 'done' | 'fail' | 'skip';

let turn: Turn | null = null;
let seq = 0;
let endWanted = false;
const listeners = new Set<() => void>();

export function onProgress(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
const notify = () => {
  for (const f of listeners) {
    try {
      f();
    } catch {
      /* 화면 쪽 오류는 진행 기록을 막지 않는다 */
    }
  }
};

export const progressTurn = (): Turn | null => turn;

/** 시험용 */
export function resetProgress(): void {
  if (graceTimer !== undefined) clearTimeout(graceTimer);
  graceTimer = undefined;
  turn = null;
  endWanted = false;
  seq = 0;
}

export const MAIN_STAGE: Stage = { id: 'main', label: '메인', group: 'main', match: [] };

/** 본편 요청 조립 시작: 새 턴 (계획은 progressPlan 으로 뒤에) */
export function progressBegin(): Turn {
  turn = { at: Date.now(), plan: [MAIN_STAGE], calls: [], manual: false };
  endWanted = false;
  notify();
  return turn;
}

/** 본편이 실패·중지됐다 (응답이 안 붙음): 도는 호출이 끝나면 턴을 닫는다. t 를 주면 그 턴일 때만 */
export function progressAbort(t?: Turn | null): void {
  if (!turn || turn.manual || turn.replyAt || turn.endAt || (t && t !== turn)) return;
  turn.aborted = true;
  endWanted = true;
  settle();
  notify();
}

/** 감시 (body.ts 1초마다): 턴에 채팅을 붙이고, 채팅이 바뀌었으면 치우고, 본편을 너무 오래 기다렸으면 실패로 닫는다 */
export function progressWatch(chat: string, now = Date.now()): void {
  if (!turn) return;
  if (turn.chat === undefined) turn.chat = chat;
  else if (turn.chat !== chat) {
    turn = null;
    endWanted = false;
    notify();
    return;
  }
  if (!turn.manual && !turn.replyAt && !turn.endAt && now - turn.at >= PROGRESS_WATCHDOG) progressAbort(turn);
}

/** 이 턴에 돌 단계 (본편 요청 조립 때 설정을 보고 미리 깐다). 본편 칸은 없으면 끼운다 */
export function progressPlan(stages: Stage[]): void {
  if (!turn || turn.manual) return;
  turn.plan = stages.some((s) => s.group === 'main') ? stages : sortPlan([...stages, MAIN_STAGE]);
  // 이미 적힌 호출(라우터·디렉터)을 새 계획의 단계에 다시 붙인다
  for (const c of turn.calls) c.stage = stageFor(turn, c.label).id;
  notify();
}

const ORDER: Record<StageGroup, number> = { router: 0, director: 1, main: 2, update: 3, net: 4, other: 5 };
export const sortPlan = (stages: Stage[]): Stage[] => [...stages].sort((a, b) => ORDER[a.group] - ORDER[b.group]);

export function progressMain(tokens?: number): void {
  if (!turn || turn.manual) return;
  turn.mainAt = Date.now();
  if (tokens !== undefined) turn.mainTokens = tokens;
  notify();
}

export function progressReply(tokens?: number): void {
  if (!turn || turn.manual) return;
  turn.replyAt = Date.now();
  turn.mainAt ??= turn.replyAt;
  if (tokens !== undefined) turn.replyTokens = tokens;
  notify();
}

/** 호출 이름에서 「다시 묻기 1」「(통합 뒤 따로)」 같은 꼬리를 뗀 바탕 이름 */
export const baseLabel = (label: string): string => label.replace(/\s*(다시 (묻기|보기)\s*\d*|\(통합 뒤 따로\))\s*$/u, '').trim();

/** 이름으로 단계 묶음 어림 (계획에 없는 호출·수동 호출) */
export function groupOf(label: string): StageGroup {
  const b = baseLabel(label);
  if (b.startsWith('라우터')) return 'router';
  if (b.startsWith('디렉터')) return 'director';
  if (/^(갱신기|정리|이미지 태그|위키)/u.test(b)) return 'update';
  if (/^상점/u.test(b)) return 'other';
  return 'net';
}

/** 호출 이름이 속하는 단계. 계획에 없으면 그 이름으로 단계를 만들어 끼운다 */
function stageFor(t: Turn, label: string): Stage {
  let best: Stage | null = null;
  let len = 0;
  // 이름이 계획 이름과 같을 때만 (꼬리 「다시 묻기 1」 등은 뗀다). 앞부분만 같은 단추 호출(「괴담톡 답장」 ↔ 자동 「괴담톡 확인」)은 따로 (릴리스 점검 11-09)
  const base = baseLabel(label);
  for (const s of t.plan) for (const m of s.match) if (m && (label === m || base === m) && m.length > len) (best = s), (len = m.length);
  if (best) return best;
  const b = baseLabel(label);
  const s: Stage = { id: `x:${b}`, label: b, group: groupOf(label), match: [b] };
  t.plan = sortPlan([...t.plan, s]);
  return s;
}

/** 모델 호출 시작 (host/llm.ts runModel). 열린 턴이 없거나 끝났으면 수동 턴을 연다 */
export function progressCallStart(label: string, model: string, reqTokens: number): number {
  // 본편을 너무 오래 기다린 턴(죽은 턴)에는 붙이지 않는다
  if (turn && !turn.manual && !turn.replyAt && !turn.endAt && Date.now() - turn.at >= PROGRESS_WATCHDOG) progressAbort(turn);
  if (!turn || turn.endAt) {
    turn = { at: Date.now(), plan: [], calls: [], manual: true };
    endWanted = true; // 수동 턴은 도는 호출이 없어지면 바로 끝
  }
  const id = ++seq;
  turn.calls.push({ id, label, model, reqTokens, at: Date.now(), stage: stageFor(turn, label).id });
  notify();
  return id;
}

export function progressCallChunk(id: number, chars: number): void {
  const c = turn?.calls.find((x) => x.id === id);
  if (!c || c.ms !== undefined) return;
  c.chars = chars;
  notify();
}

export function progressCallEnd(id: number, r: { ok: boolean; ms: number; respTokens?: number; error?: string }): void {
  const c = turn?.calls.find((x) => x.id === id);
  if (!c) return;
  c.ok = r.ok;
  c.ms = r.ms;
  if (r.respTokens !== undefined) c.respTokens = r.respTokens;
  if (r.error) c.error = r.error;
  settle();
  notify();
}

/** 턴의 뒤 작업이 다 끝났다 (body.ts). 아직 도는 호출이 있으면 그것이 끝날 때 닫힌다 */
export function progressEnd(t?: Turn | null): void {
  // 앞 턴의 뒤 작업이 늦게 끝나도 새 턴을 닫지 않는다 (릴리스 점검 11-09)
  if (!turn || turn.endAt || (t !== undefined && t !== turn)) return;
  endWanted = true;
  settle();
  notify();
}

export const running = (t: Turn): Call[] => t.calls.filter((c) => c.ms === undefined);

/** 수동 턴은 마지막 호출이 끝나고 이만큼 더 기다렸다 닫는다: 단추 작업이 호출을 차례로 여러 번 해도 한 턴에 모인다 (릴리스 점검 11-09) */
export const MANUAL_GRACE = 1500;
let graceTimer: ReturnType<typeof setTimeout> | undefined;
function settle(): void {
  if (!turn || !endWanted || turn.endAt || running(turn).length || !(turn.manual || turn.replyAt || turn.aborted)) return;
  if (!turn.manual) {
    turn.endAt = Date.now();
    return;
  }
  if (graceTimer !== undefined) clearTimeout(graceTimer);
  const t = turn;
  graceTimer = setTimeout(() => {
    graceTimer = undefined;
    if (turn === t && !t.endAt && !running(t).length) {
      t.endAt = Date.now();
      notify();
    }
  }, MANUAL_GRACE);
}

/** 단계 상태 */
export function stageState(t: Turn, s: Stage): StageState {
  if (s.group === 'main' && s.id === 'main') {
    if (t.manual) return 'skip';
    if (t.replyAt) return 'done';
    if (t.aborted) return 'fail';
    return t.mainAt ? 'run' : 'wait';
  }
  const calls = t.calls.filter((c) => c.stage === s.id);
  if (calls.some((c) => c.ms === undefined)) return 'run';
  if (!calls.length) return t.endAt ? 'skip' : 'wait';
  const last = calls[calls.length - 1];
  return last.ok ? 'done' : 'fail';
}

/** 폰 막대 점: 묶음별로 합친 상태 (계획에 없는 묶음은 skip) */
export function groupState(t: Turn, g: StageGroup): StageState {
  const states = t.plan.filter((s) => s.group === g).map((s) => stageState(t, s));
  if (!states.length) return 'skip';
  if (states.includes('run')) return 'run';
  if (states.includes('fail')) return 'fail';
  if (states.every((x) => x === 'done' || x === 'skip')) return states.includes('done') ? 'done' : 'skip';
  return 'wait';
}

/** 지금 도는 단계들 (없으면 빈 배열) */
export const runningStages = (t: Turn): Stage[] => t.plan.filter((s) => stageState(t, s) === 'run');

/** 끝난·도는 단계 수 / 전체 (머리글 「2 / 6」) */
export function stageCount(t: Turn): { done: number; total: number } {
  const total = t.plan.length;
  const idx = t.plan.map((s) => stageState(t, s));
  const done = idx.filter((x) => x === 'done' || x === 'fail' || x === 'skip').length;
  const run = idx.some((x) => x === 'run') ? 1 : 0;
  return { done: Math.min(total, done + run), total };
}

/** 턴 합계: 호출 수·보낸/받은 토큰·총 시간·실패 수. 본편도 한 번의 호출로 같이 센다 (2026-11-11 사용자: 합계가 안 맞는다) */
export function turnSummary(t: Turn): { calls: number; req: number; resp: number; ms: number; failed: number } {
  const done = t.calls.filter((c) => c.ms !== undefined);
  const main = t.replyAt ? 1 : 0;
  return {
    calls: done.length + main,
    req: done.reduce((n, c) => n + c.reqTokens, 0) + (main ? t.mainTokens ?? 0 : 0),
    resp: done.reduce((n, c) => n + (c.respTokens ?? 0), 0) + (main ? t.replyTokens ?? 0 : 0),
    ms: (t.endAt ?? Date.now()) - t.at,
    failed: t.plan.filter((s) => stageState(t, s) === 'fail').length,
  };
}
