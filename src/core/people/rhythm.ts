// 서사 리듬 턴 계산 (리수폿 H, 2026-11-06 사용자 결정): 훅 규모별 회수 범위·새 훅 간격·동시 상한·한 번 연장을 코드가 센다.
// 턴 = 확정된 응답(char 메시지) 수. 훅의 심은 턴·마지막 진전 턴은 문서 항목의 기준 메시지에서 읽는다.
import type { Chat } from '../types';
import { liveEntries, type Liveness } from './store';
import { RHYTHM_HOOK_STAGES, RHYTHM_HOOK_TIERS, type PeopleStore } from './types';

export type HookTier = (typeof RHYTHM_HOOK_TIERS)[number];
export type HookStage = (typeof RHYTHM_HOOK_STAGES)[number];
/** 규모별 회수 검토 범위 (심은 뒤 몇 턴), 한 번 연장 턴, 동시 상한 (리수폿 원문) */
export const HOOK_WINDOW: Record<HookTier, [number, number]> = { short: [2, 7], mid: [7, 14], long: [20, 50] };
export const HOOK_EXTEND: Record<HookTier, number> = { short: 3, mid: 5, long: 10 };
export const HOOK_LIMIT: Record<HookTier, number> = { short: 2, mid: 2, long: 1 };
export const HOOK_PLANT_GAP = 3;
const ACTIVE: HookStage[] = ['seeded', 'hinted', 'escalated', 'payoff_ready'];

export interface HookClock {
  key: string;
  tier: HookTier;
  stage: HookStage;
  /** 심은 턴·마지막 진전 턴·지금까지 턴 수 */
  planted: number;
  last: number;
  age: number;
  sinceLast: number;
  /** 회수 검토 범위 (연장 포함) */
  window: [number, number];
  extended: boolean;
  /** 범위 안 (회수·진전을 검토할 때) / 범위를 넘김 */
  due: boolean;
  overdue: boolean;
}
export interface RhythmClock {
  turn: number;
  hooks: HookClock[];
  active: Record<HookTier, number>;
  lastPlant: number | null;
  plantAllowed: boolean;
  plantBlocked: string;
  /** 우선순위: 넘긴 흐름 → 준비된 회수 → 진전 때가 된 것 → 새 훅 */
  priority: string[];
}

/** 메시지 위치까지의 확정 응답 수 (턴) */
export function turnAt(chat: Chat, idx: number): number {
  const list = Array.isArray(chat.message) ? chat.message : [];
  let n = 0;
  for (let i = 0; i <= Math.min(idx, list.length - 1); i++) if (list[i].role === 'char') n++;
  return n;
}

export function parseHookHead(text: string): { stage: HookStage; tier: HookTier; ext: boolean } | null {
  const m = /^\[stage:([a-z_]+)\]\s*\[tier:([a-z]+)\](\s*\[ext\])?/.exec(text);
  if (!m || !(RHYTHM_HOOK_STAGES as readonly string[]).includes(m[1]) || !(RHYTHM_HOOK_TIERS as readonly string[]).includes(m[2])) return null;
  return { stage: m[1] as HookStage, tier: m[2] as HookTier, ext: !!m[3] };
}

/** 지금 턴 기준의 훅 시계. upto = 마지막 확정 메시지 위치 (없으면 끝) */
export function rhythmClock(store: PeopleStore, chat: Chat, live: Liveness, upto?: number): RhythmClock {
  const list = Array.isArray(chat.message) ? chat.message : [];
  const end = upto ?? list.length - 1;
  const turn = turnAt(chat, end);
  const hooks: HookClock[] = [];
  const active: Record<HookTier, number> = { short: 0, mid: 0, long: 0 };
  let lastPlant: number | null = null;
  for (const d of Object.values(store.docs)) {
    if (d.type !== 'rhythm' || !d.key.startsWith('hook:')) continue;
    const es = liveEntries(d.entries, live).filter((e) => (live.at.get(e.anchor) ?? -1) <= end);
    if (!es.length) continue;
    const head = parseHookHead(es[es.length - 1].text);
    if (!head) continue;
    const planted = turnAt(chat, live.at.get(es[0].anchor) ?? 0);
    const last = turnAt(chat, live.at.get(es[es.length - 1].anchor) ?? 0);
    lastPlant = lastPlant === null ? planted : Math.max(lastPlant, planted);
    const [lo, hi0] = HOOK_WINDOW[head.tier];
    const hi = hi0 + (head.ext ? HOOK_EXTEND[head.tier] : 0);
    const age = turn - planted;
    const isActive = ACTIVE.includes(head.stage);
    if (isActive) active[head.tier]++;
    hooks.push({ key: d.key, tier: head.tier, stage: head.stage, planted, last, age, sinceLast: turn - last, window: [lo, hi], extended: head.ext, due: isActive && age >= lo && age <= hi, overdue: isActive && age > hi });
  }
  const gapOk = lastPlant === null || turn - lastPlant >= HOOK_PLANT_GAP;
  const room = (RHYTHM_HOOK_TIERS as readonly HookTier[]).filter((t) => active[t] < HOOK_LIMIT[t]);
  const overdue = hooks.filter((h) => h.overdue);
  const plantAllowed = gapOk && room.length > 0 && !overdue.length;
  const plantBlocked = !gapOk ? `last plant ${turn - (lastPlant ?? 0)} turn(s) ago (need ${HOOK_PLANT_GAP})` : !room.length ? 'active limits reached' : overdue.length ? 'handle the overdue flow first' : '';
  const priority: string[] = [];
  const byNeglect = (a: HookClock, b: HookClock) => b.sinceLast - a.sinceLast;
  for (const h of [...overdue].sort(byNeglect)) priority.push(`overdue: ${h.key} (${h.tier}, ${h.age} turns since planting, window ${h.window[0]}–${h.window[1]}${h.extended ? ', already extended' : ', may extend once with [ext]'})`);
  for (const h of hooks.filter((h) => h.stage === 'payoff_ready' && !h.overdue).sort(byNeglect)) priority.push(`payoff ready: ${h.key}`);
  for (const h of hooks.filter((h) => h.due && h.stage !== 'payoff_ready' && (h.tier !== 'long' || h.sinceLast >= 5)).sort(byNeglect)) priority.push(`advance due: ${h.key} (${h.sinceLast} turns since last advance)`);
  if (plantAllowed) priority.push(`new plant allowed (${room.join('/')})`);
  return { turn, hooks, active, lastPlant, plantAllowed, plantBlocked, priority };
}

/** 지침·본편용 영어 요약 줄 */
export function rhythmClockLines(c: RhythmClock): string[] {
  const out = [`Turn ${c.turn} (confirmed replies). Active hooks: short ${c.active.short}/${HOOK_LIMIT.short}, mid ${c.active.mid}/${HOOK_LIMIT.mid}, long ${c.active.long}/${HOOK_LIMIT.long}. New plant ${c.plantAllowed ? 'allowed' : `not allowed: ${c.plantBlocked}`}.`];
  for (const h of c.hooks) if (ACTIVE.includes(h.stage)) out.push(`- ${h.key}: ${h.stage}, ${h.tier}, planted ${h.age} turn(s) ago, last advance ${h.sinceLast} turn(s) ago, payoff window ${h.window[0]}–${h.window[1]}${h.overdue ? ' — OVERDUE' : h.due ? ' — in window' : ''}${h.extended ? ' (extended)' : ''}`);
  if (c.priority.length) out.push(`Priority: ${c.priority.join(' · ')}`);
  return out;
}
