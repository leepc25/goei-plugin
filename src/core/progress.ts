// 호출 진행 상태 (11-09 사용자: 한 턴에 라우터→디렉터→본편→갱신기→인터넷이 어떻게 돌고 있는지 보이게 — 리수폿 MissionProgressPanel·유미 프로바이더 매니저 참고).
// 턴이 열리면(본편 요청 조립 시작) 그 턴에 돌 단계 계획(core/progplan.ts)을 깔고, 모델 호출이 시작·진행·끝날 때마다 적는다.
// 화면(host/progwin.ts)은 onProgress 로 구독해 그린다. 이 파일은 Risu API 를 쓰지 않는다 (시험: tests/progress.test.mjs).

/** 폰 막대의 점 다섯 개 (길이 고정, 11-09 사용자) */
export type StageGroup = 'router' | 'director' | 'main' | 'update' | 'net';
export const GROUPS: StageGroup[] = ['router', 'director', 'main', 'update', 'net'];
export const GROUP_LABEL: Record<StageGroup, string> = { router: '라우터', director: '디렉터', main: '본편', update: '갱신기', net: '인터넷' };

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
  /** 턴이 다 끝난 때 (끝내기 요청이 왔고 도는 호출이 없을 때) */
  endAt?: number;
  /** 채팅 턴 밖(단추로 부른) 호출만 있는 턴 */
  manual: boolean;
}

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
  turn = null;
  endWanted = false;
  seq = 0;
}

export const MAIN_STAGE: Stage = { id: 'main', label: '본편', group: 'main', match: [] };

/** 본편 요청 조립 시작: 새 턴 (계획은 progressPlan 으로 뒤에) */
export function progressBegin(): void {
  turn = { at: Date.now(), plan: [MAIN_STAGE], calls: [], manual: false };
  endWanted = false;
  notify();
}

/** 이 턴에 돌 단계 (본편 요청 조립 때 설정을 보고 미리 깐다). 본편 칸은 없으면 끼운다 */
export function progressPlan(stages: Stage[]): void {
  if (!turn || turn.manual) return;
  turn.plan = stages.some((s) => s.group === 'main') ? stages : sortPlan([...stages, MAIN_STAGE]);
  // 이미 적힌 호출(라우터·디렉터)을 새 계획의 단계에 다시 붙인다
  for (const c of turn.calls) c.stage = stageFor(turn, c.label).id;
  notify();
}

const ORDER: Record<StageGroup, number> = { router: 0, director: 1, main: 2, update: 3, net: 4 };
export const sortPlan = (stages: Stage[]): Stage[] => [...stages].sort((a, b) => ORDER[a.group] - ORDER[b.group]);

export function progressMain(): void {
  if (!turn || turn.manual) return;
  turn.mainAt = Date.now();
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
  return 'net';
}

/** 호출 이름이 속하는 단계. 계획에 없으면 그 이름으로 단계를 만들어 끼운다 */
function stageFor(t: Turn, label: string): Stage {
  let best: Stage | null = null;
  let len = 0;
  for (const s of t.plan) for (const m of s.match) if (m && label.startsWith(m) && m.length > len) (best = s), (len = m.length);
  if (best) return best;
  const b = baseLabel(label);
  const s: Stage = { id: `x:${b}`, label: b, group: groupOf(label), match: [b] };
  t.plan = sortPlan([...t.plan, s]);
  return s;
}

/** 모델 호출 시작 (host/llm.ts runModel). 열린 턴이 없거나 끝났으면 수동 턴을 연다 */
export function progressCallStart(label: string, model: string, reqTokens: number): number {
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
export function progressEnd(): void {
  if (!turn || turn.endAt) return;
  endWanted = true;
  settle();
  notify();
}

export const running = (t: Turn): Call[] => t.calls.filter((c) => c.ms === undefined);

function settle(): void {
  if (turn && endWanted && !turn.endAt && !running(turn).length && (turn.manual || turn.replyAt)) turn.endAt = Date.now();
}

/** 단계 상태 */
export function stageState(t: Turn, s: Stage): StageState {
  if (s.group === 'main' && s.id === 'main') {
    if (t.manual) return 'skip';
    if (t.replyAt) return 'done';
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

/** 턴 합계: 호출 수·요청/응답 토큰·총 시간·실패 수 */
export function turnSummary(t: Turn): { calls: number; req: number; resp: number; ms: number; failed: number } {
  const done = t.calls.filter((c) => c.ms !== undefined);
  return {
    calls: done.length,
    req: done.reduce((n, c) => n + c.reqTokens, 0),
    resp: done.reduce((n, c) => n + (c.respTokens ?? 0), 0),
    ms: (t.endAt ?? Date.now()) - t.at,
    failed: t.plan.filter((s) => stageState(t, s) === 'fail').length,
  };
}
