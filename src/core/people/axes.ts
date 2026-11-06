// 성격 6축과 변화 후보 (리수폿 People profile · 2026-11-06 사용자 결정 「F」).
// 갱신기는 축을 바꾸지 않고 「이 장면에서 이런 모습이 보였다」는 관찰만 돌려준다. 코드가 같은 방향 관찰을 모아
// 살아 있는 관찰 4개 이상·서로 다른 메시지 3개 이상·확신 평균 55 이상이면 「검토」로 띄우고, 사용자가 승인해야 축이 움직인다.
// 관찰은 기준 메시지에 묶여 있어 다시 굴리기·삭제로 메시지가 사라지면 같이 죽는다 (항목과 같은 규칙).
import { hash, isAlive, plain, type Liveness } from './store';
import { AXES, AXIS_BANDS, AXIS_BANDS_EN, AXIS_LABEL, AXIS_LABEL_EN, CANDIDATE_READY, DEFAULT_AXES, EXPRESS_TO_AXIS, axisBand, expressOf, type Axes, type Axis, type Candidate, type CandidateDirection, type Observation, type Person } from './types';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const axisValue = (v: unknown): number => clamp(Math.round(Number(v) || 0), 0, 100);
export const isAxis = (v: unknown): v is Axis => typeof v === 'string' && (AXES as readonly string[]).includes(v);
const DIRECTIONS: CandidateDirection[] = ['up', 'down', 'new', 'weaken'];
export const isDirection = (v: unknown): v is CandidateDirection => typeof v === 'string' && DIRECTIONS.includes(v as CandidateDirection);

/** 옛 자료·시험 자료에 없는 칸 채우기 (axes·patterns·candidates) */
export function ensureAxes(p: Person): void {
  if (!p.axes) { p.axes = axesFromExpress(p.express); p.axesFrom = p.axesFrom ?? 'default'; }
  if (!Array.isArray(p.patterns)) p.patterns = [];
  if (!p.candidates || typeof p.candidates !== 'object') p.candidates = {};
}

/** 축 한 벌을 너그럽게 읽는다 (없는 축은 50) */
export function readAxes(raw: unknown): Axes {
  const out = DEFAULT_AXES();
  if (raw && typeof raw === 'object') for (const a of AXES) if ((raw as Record<string, unknown>)[a] !== undefined) out[a] = axisValue((raw as Record<string, unknown>)[a]);
  return out;
}

/** 옛 express(0~3)로 축 시작값: 감정 표출성만 그 값, 나머지는 50 */
export function axesFromExpress(express: 0 | 1 | 2 | 3): Axes {
  return { ...DEFAULT_AXES(), emotionalExpressiveness: EXPRESS_TO_AXIS[express] };
}

/** 축을 바꾸고 express 를 맞춘다 */
export function setAxes(p: Person, axes: Axes, from: Person['axesFrom']): void {
  p.axes = readAxes(axes);
  p.axesFrom = from;
  p.express = expressOf(p.axes);
}

/** 갱신기 자료·화면용: 축마다 값과 띠 설명(한국어) */
export const axesView = (raw: Axes | undefined) => { const axes = readAxes(raw); return AXES.map((a) => ({ axis: a, label: AXIS_LABEL[a], value: axes[a], band: AXIS_BANDS[a][axisBand(axes[a])] })); };
/** 본편 주입용 (영어 한 줄들) */
export const axesLinesEn = (raw: Axes | undefined): string[] => { const axes = readAxes(raw); return AXES.map((a) => `- ${AXIS_LABEL_EN[a]} ${axes[a]}/100: ${AXIS_BANDS_EN[a][axisBand(axes[a])]}`); };

export const candidateId = (who: string, axis: Axis | 'pattern', direction: CandidateDirection, pattern: string, n = 0) =>
  `k${hash(`${who}|${axis}|${direction}|${plain(pattern, 120).toLowerCase()}`)}${n ? `~${n}` : ''}`;

export interface ObserveInput {
  axis: Axis | 'pattern';
  direction: CandidateDirection;
  pattern: string;
  anchor: string;
  seq: number;
  quote: string;
  reason: string;
  strength: number;
  confidence: number;
}

/** 관찰 하나를 후보에 더한다. 같은 메시지의 같은 후보 관찰은 하나만. 거절된 후보는 더 모으지 않고, 승인·되돌린 후보 뒤에는 새 후보를 연다 */
export function observe(p: Person, o: ObserveInput, now: string): { ok: true; candidate: Candidate; fresh: boolean } | { ok: false; reason: string } {
  ensureAxes(p);
  const pattern = plain(o.pattern, 120);
  if (!pattern) return { ok: false, reason: '설명 없음' };
  let cand: Candidate | undefined;
  let n = 0;
  // 같은 설명의 후보 가운데 아직 모으는 것을 찾는다. 승인·되돌림이면 번호를 올려 새 후보
  for (;;) {
    const id = candidateId(p.name, o.axis, o.direction, pattern, n);
    const c = p.candidates[id];
    if (!c) break;
    if (c.status === 'rejected') return { ok: false, reason: '사용자가 거절한 후보' };
    if (c.status === 'collecting') { cand = c; break; }
    n++;
  }
  const fresh = !cand;
  if (!cand) cand = { id: candidateId(p.name, o.axis, o.direction, pattern, n), axis: o.axis, direction: o.direction, pattern, evidence: [], status: 'collecting', at: now };
  if (cand.evidence.some((e) => e.anchor === o.anchor && !e.void)) return { ok: false, reason: '같은 메시지의 관찰이 이미 있음' };
  const ob: Observation = { id: `o${hash(`${cand.id}|${o.anchor}|${o.seq}|${o.reason}`)}`, anchor: o.anchor, seq: o.seq, quote: plain(o.quote, 60), reason: plain(o.reason, 100), strength: axisValue(o.strength), confidence: axisValue(o.confidence) };
  cand.evidence = [...cand.evidence, ob].slice(-40);
  p.candidates[cand.id] = cand;
  return { ok: true, candidate: cand, fresh };
}

export const liveEvidence = (c: Candidate, live: Liveness): Observation[] => c.evidence.filter((e) => !e.void && isAlive({ anchor: e.anchor, quote: e.quote, src: 'story' }, live));

export interface CandidateStats { n: number; scenes: number; confidence: number; strength: number; delta: number; ready: boolean }
/** 살아 있는 관찰로 센 후보의 상태. delta 는 승인 시 움직일 양 (±2~8, pattern 은 0) */
export function candidateStats(c: Candidate, live: Liveness): CandidateStats {
  const ev = liveEvidence(c, live);
  const n = ev.length;
  const scenes = new Set(ev.map((e) => e.anchor)).size;
  const confidence = n ? Math.round(ev.reduce((s, e) => s + e.confidence, 0) / n) : 0;
  const strength = n ? Math.round(ev.reduce((s, e) => s + e.strength, 0) / n) : 0;
  const sign = c.direction === 'down' || c.direction === 'weaken' ? -1 : 1;
  const delta = c.axis === 'pattern' ? 0 : sign * clamp(Math.round(strength / 15), 2, 8);
  const ready = n >= CANDIDATE_READY.evidence && scenes >= CANDIDATE_READY.scenes && confidence >= CANDIDATE_READY.confidence;
  return { n, scenes, confidence, strength, delta, ready };
}

/** 검토 대상 후보 (모으는 중이고 조건을 채운 것) */
export const reviewCandidates = (p: Person, live: Liveness): Candidate[] => Object.values(p.candidates ?? {}).filter((c) => c.status === 'collecting' && candidateStats(c, live).ready);

/** 승인: 축이면 delta 만큼 움직이고(출처 manual), pattern 이면 장기 변화에 더하거나 뺀다 */
export function approveCandidate(p: Person, id: string, live: Liveness, now: string): string | null {
  const c = p.candidates[id];
  if (!c || c.status !== 'collecting') return '승인할 수 있는 후보가 아니에요';
  const st = candidateStats(c, live);
  if (!st.ready) return '아직 관찰이 모자라요';
  if (c.axis === 'pattern') {
    if (c.direction === 'weaken') {
      const had = p.patterns.includes(c.pattern);
      p.patterns = p.patterns.filter((t) => t !== c.pattern);
      c.applied = { pattern: c.pattern, removed: had };
    } else {
      if (!p.patterns.includes(c.pattern)) p.patterns = [...p.patterns, c.pattern].slice(-30);
      c.applied = { pattern: c.pattern };
    }
  } else {
    const before = p.axes[c.axis];
    const after = axisValue(before + st.delta);
    c.applied = { axis: c.axis, before, after };
    setAxes(p, { ...p.axes, [c.axis]: after }, 'manual');
  }
  c.status = 'approved';
  c.at = now;
  return null;
}

export function rejectCandidate(p: Person, id: string, now: string): string | null {
  const c = p.candidates[id];
  if (!c || c.status !== 'collecting') return '거절할 수 있는 후보가 아니에요';
  c.status = 'rejected';
  c.at = now;
  return null;
}

/** 되돌리기: 승인으로 바뀐 축·장기 변화를 전으로 */
export function revertCandidate(p: Person, id: string, now: string): string | null {
  const c = p.candidates[id];
  if (!c || c.status !== 'approved' || !c.applied) return '되돌릴 수 있는 후보가 아니에요';
  const ap = c.applied;
  if ('axis' in ap) setAxes(p, { ...p.axes, [ap.axis]: ap.before }, 'manual');
  else if (ap.removed) p.patterns = [...p.patterns, ap.pattern].slice(-30);
  else p.patterns = p.patterns.filter((t) => t !== ap.pattern);
  c.status = 'reverted';
  c.at = now;
  return null;
}

/** 후보 정리: 관찰이 하나도 안 살아 있는 「모으는 중」 후보는 지운다 (메시지가 다 사라진 것) */
export function pruneCandidates(p: Person, live: Liveness): number {
  ensureAxes(p);
  let n = 0;
  for (const [id, c] of Object.entries(p.candidates)) {
    if (c.status === 'collecting' && !liveEvidence(c, live).length) { delete p.candidates[id]; n++; }
  }
  return n;
}
