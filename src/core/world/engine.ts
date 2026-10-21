// 상황판 엔진: 괴이(AN)·사건(IN)·미스틱 사이트(MS)·요원(AG) 상태를 하나의 JSON으로 들고,
// 모델 출력 태그를 반영하고, 새 발생을 추첨하고, 로어북에 넣을 브리핑을 만든다.
// 원본 Lua의 WG.*, parseAnomalies, parseIncidents, parseMysticSite, agParse, spawnAndBrief와 같은 규칙.
// Risu API를 부르지 않는 순수 로직이라 rng를 넣어 그대로 검사할 수 있다.
import { BUILTIN } from '../factions';
import type { FactionCode } from '../types';
import { type Catalog, factionNames, presetCanon } from './catalog';
import { landmarkLoc, locName, POOL, regionMatch, SEALED_LOC, uniqueRegion } from './geo';
import {
  type AgState,
  scanAffiliation,
  scanAgents,
  scanAnomalies,
  scanIncidents,
  scanMysticSites,
  scanStatus,
} from './tags';

export type Origin = 'auto' | 'model' | 'manual';

export interface AnEntry {
  loc: string;
  name: string;
  state: '발생대기' | '활성';
  grade: string;
  deploy: string;
  kind: 'preset' | 'random';
  origin: Origin;
  presetName: string;
  since: number | null;
  born: number | null;
  /** 유저가 지금 탐사 중이면 자동 종료하지 않는다 */
  exploring: boolean;
  /** 현장 상황 (2026-10-21 추가. 옛 상태엔 없다) */
  situation?: string;
}

export interface InEntry {
  loc: string;
  name: string;
  state: '발생대기' | '진행';
  situation: string;
  /** 투입 인원 (2026-10-21 추가. 옛 상태엔 없다) */
  deploy?: string;
  kind: 'landmark' | 'random';
  origin: Origin;
  since: number | null;
  born: number | null;
}

export interface MsEntry {
  loc: string;
  name: string;
  state: '발생대기' | '출현';
  visitors: string;
  /** 현장 상황 (2026-10-21 추가. 옛 상태엔 없다) */
  situation?: string;
  origin: Origin;
  since: number | null;
  born: number | null;
}

export interface AgentRecord {
  st: AgState | '미정';
  situation: string;
  since: number | null;
  /** 사망 상태로 지난 응답 수 */
  dead: number;
  /** 모델 태그로 상태를 받은 적이 있는지 (태그가 없던 요원의 '미정'은 편성 가능) */
  tagged?: boolean;
}

export interface WorldState {
  v: 1;
  /** 발생 추첨 회차. 막 끝난 괴이가 곧바로 다시 뽑히지 않게 하는 데 쓴다 */
  epoch: number;
  /** 상태창 시각(분). 경과 시간과 자동 종료에 쓴다 */
  minute: number | null;
  an: AnEntry[];
  inc: InEntry[];
  ms: MsEntry[];
  agents: Record<string, AgentRecord>;
  retired: string[];
  /** 이번 응답에서 결번을 채운 예비 인원 */
  promoted: string[];
  blocks: Record<string, number>;
  skip: { an?: string; in?: string; ms?: string };
  /** 커스텀 임무로 요청했지만 아직 모델 태그로 등록되지 않은 대상 */
  pending: { an?: string; ms?: string; in?: string };
  /** 커스텀 임무 등록 결과 안내 */
  notice: string;
  /** 막 끝난 상황. 이름 막기(blocks)와 같은 동안만 상황판에 흐리게 남긴다 (2026-10-20 사용자) */
  ended: EndedEntry[];
}

export interface EndedEntry {
  kind: 'an' | 'in' | 'ms';
  name: string;
  loc: string;
  grade?: string;
  /** 이 회차까지 보인다 (blocks 값과 같음) */
  until: number;
}

export interface WorldSettings {
  extra_cap: number;
  extra_ms_cap: number;
  extra_in_cap: number;
  preset_cap: number;
  preset_p: number;
  random_cap: number;
  random_p: number;
  incident_cap: number;
  incident_p: number;
  mystic_cap: number;
  mystic_p: number;
  preset_expire: number;
  random_expire: number;
  incident_expire: number;
  mystic_expire: number;
  preset_ttl: number;
  random_ttl: number;
  incident_ttl: number;
  mystic_ttl: number;
  landmark_share: number;
  agent_limit: number;
}

/** 원본 WG.spec 기본값 */
export const DEFAULT_SETTINGS: WorldSettings = {
  extra_cap: 3,
  extra_ms_cap: 3,
  extra_in_cap: 3,
  preset_cap: 2,
  preset_p: 100,
  random_cap: 1,
  random_p: 100,
  incident_cap: 1,
  incident_p: 50,
  mystic_cap: 1,
  mystic_p: 100,
  preset_expire: 1,
  random_expire: 1,
  incident_expire: 1,
  mystic_expire: 1,
  preset_ttl: 48,
  random_ttl: 48,
  incident_ttl: 12,
  mystic_ttl: 24,
  landmark_share: 50,
  agent_limit: 12,
};

export type Rng = () => number;

export function emptyWorld(): WorldState {
  return { v: 1, epoch: 0, minute: null, an: [], inc: [], ms: [], agents: {}, retired: [], promoted: [], blocks: {}, skip: {}, pending: {}, notice: '', ended: [] };
}

export function parseWorld(raw: unknown): WorldState {
  if (typeof raw !== 'string' || !raw) return emptyWorld();
  try {
    const w = JSON.parse(raw) as WorldState;
    if (w && w.v === 1 && Array.isArray(w.an) && Array.isArray(w.inc) && Array.isArray(w.ms)) {
      return { ...emptyWorld(), ...w, pending: { ...(w.pending ?? {}) }, ended: Array.isArray(w.ended) ? w.ended : [] };
    }
  } catch {
    /* 깨진 값은 새로 시작 */
  }
  return emptyWorld();
}

export function validName(n: unknown): n is string {
  return (
    typeof n === 'string' &&
    n.trim() !== '' &&
    /[\p{L}\p{N}]/u.test(n) &&
    !/^\s*[[{]/.test(n) &&
    !n.includes('\n') &&
    !['content', 'comment', 'name', 'null'].includes(n)
  );
}

// ── 공통 ──

function occupied(w: WorldState): Set<string> {
  return new Set([...w.an, ...w.inc, ...w.ms].map((e) => e.loc));
}

function pick<T>(list: T[], rng: Rng): T | undefined {
  return list.length ? list[Math.floor(rng() * list.length)] : undefined;
}

function place(w: WorldState, skip: string | undefined, rng: Rng): string | undefined {
  const taken = occupied(w);
  return pick(POOL.filter((l) => !taken.has(l) && l !== skip), rng);
}

function block(w: WorldState, group: string, name: string) {
  if (name) w.blocks[`${group}:${name}`] = w.epoch + 1;
}

function blocked(w: WorldState, group: string, name: string): boolean {
  return (w.blocks[`${group}:${name}`] ?? -1) >= w.epoch;
}

function remember(w: WorldState, kind: EndedEntry['kind'], e: { name: string; loc: string; state: string }, grade?: string) {
  // 발생 예정이던 것은 시작도 안 했으니 남기지 않는다
  if (e.state === '발생대기') return;
  w.ended = [...(w.ended ?? []).filter((x) => !(x.kind === kind && x.name === e.name && x.loc === e.loc)), { kind, name: e.name, loc: e.loc, ...(grade ? { grade } : {}), until: w.epoch + 1 }];
}
function endAn(w: WorldState, e: AnEntry) {
  remember(w, 'an', e, e.grade);
  block(w, 'an', e.name);
  w.skip.an = e.loc;
  w.an = w.an.filter((x) => x !== e);
}
function endIn(w: WorldState, e: InEntry) {
  remember(w, 'in', e);
  block(w, 'in', e.name);
  w.skip.in = e.loc;
  w.inc = w.inc.filter((x) => x !== e);
}
function endMs(w: WorldState, e: MsEntry) {
  remember(w, 'ms', e);
  block(w, 'ms', e.name);
  w.skip.ms = e.loc;
  w.ms = w.ms.filter((x) => x !== e);
}

// ── 발생 추첨 ──

function spawnAn(w: WorldState, c: Catalog, s: WorldSettings, preset: boolean, rng: Rng) {
  const group = preset ? 'preset' : 'random';
  const n = w.an.filter((e) => e.origin === 'auto' && e.kind === group).length;
  if (n >= s[`${group}_cap`] || !(rng() * 100 < s[`${group}_p`])) return;
  let name = '';
  if (preset) {
    const active = new Set(w.an.map((e) => e.presetName || presetCanon(c, e.name)));
    const choice = pick(c.anomalies.filter((a) => !active.has(a.name) && a.name !== w.pending.an && !blocked(w, 'an', a.name)), rng);
    if (!choice) return;
    name = choice.name;
  }
  const loc = place(w, w.skip.an, rng);
  if (!loc) return;
  w.an.push({
    loc, name, state: '발생대기', grade: '', deploy: '', kind: group, origin: 'auto',
    presetName: name, since: null, born: w.minute, exploring: false,
  });
  w.skip.an = undefined;
}

function spawnIncident(w: WorldState, c: Catalog, s: WorldSettings, rng: Rng) {
  const n = w.inc.filter((e) => e.origin === 'auto').length;
  if (n >= s.incident_cap || !(rng() * 100 < s.incident_p)) return;
  const taken = occupied(w);
  const allowed = c.landmarks.filter((lm) => {
    const l = landmarkLoc(lm.sido, lm.gu);
    return l && l !== SEALED_LOC && !taken.has(l) && l !== w.skip.in && lm.name !== w.pending.in && !w.inc.some((e) => e.name === lm.name) && !blocked(w, 'in', lm.name);
  });
  const isLandmark = rng() * 100 < s.landmark_share;
  let loc: string | undefined;
  let name = '';
  if (isLandmark) {
    const lm = pick(allowed, rng);
    if (!lm) return;
    loc = landmarkLoc(lm.sido, lm.gu) ?? undefined;
    name = lm.name;
  } else {
    loc = place(w, w.skip.in, rng);
  }
  if (!loc) return;
  w.inc.push({ loc, name, state: '발생대기', situation: '', kind: isLandmark ? 'landmark' : 'random', origin: 'auto', since: null, born: w.minute });
  w.skip.in = undefined;
}

function spawnMystic(w: WorldState, c: Catalog, s: WorldSettings, rng: Rng) {
  const n = w.ms.filter((e) => e.origin === 'auto').length;
  if (n >= s.mystic_cap || !(rng() * 100 < s.mystic_p)) return;
  const active = new Set(w.ms.map((e) => e.name));
  const site = pick(c.mysticSites.filter((m) => !active.has(m.name) && m.name !== w.pending.ms && !blocked(w, 'ms', m.name)), rng);
  if (!site) return;
  const loc = place(w, w.skip.ms, rng);
  if (!loc) return;
  w.ms.push({ loc, name: site.name, state: '발생대기', visitors: '', origin: 'auto', since: null, born: w.minute });
  w.skip.ms = undefined;
}

/** RP 유지 시간이 지난 항목을 끝낸다. 유저가 탐사 중인 괴이는 남긴다 */
export function expire(w: WorldState, s: WorldSettings) {
  const now = w.minute;
  if (now === null) return;
  const old = (e: { born: number | null; since: number | null }, group: 'preset' | 'random' | 'incident' | 'mystic') => {
    if (e.born === null) e.born = e.since ?? now;
    const hours = s[`${group}_ttl`];
    return s[`${group}_expire`] === 1 && hours > 0 && now - e.born >= hours * 60;
  };
  for (const e of [...w.an]) if (!e.exploring && old(e, e.kind)) endAn(w, e);
  for (const e of [...w.inc]) if (old(e, 'incident')) endIn(w, e);
  for (const e of [...w.ms]) if (old(e, 'mystic')) endMs(w, e);
}

/** 응답 한 번마다 한 번: 회차를 올리고, 오래된 항목을 끝내고, 네 그룹을 무작위 순서로 한 번씩 추첨 */
export function tick(w: WorldState, c: Catalog, s: WorldSettings, rng: Rng) {
  w.epoch += 1;
  w.ended = (w.ended ?? []).filter((e) => e.until >= w.epoch);
  expire(w, s);
  const groups = ['preset', 'random', 'incident', 'mystic'];
  for (let i = groups.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [groups[i], groups[j]] = [groups[j], groups[i]];
  }
  for (const g of groups) {
    if (g === 'preset') spawnAn(w, c, s, true, rng);
    else if (g === 'random') spawnAn(w, c, s, false, rng);
    else if (g === 'incident') spawnIncident(w, c, s, rng);
    else spawnMystic(w, c, s, rng);
  }
}

// ── 요원 ──

/** 이 소속에서 보이는 요원 (결번 제외, 상한까지) */
export function rosterFor(w: WorldState, c: Catalog, faction: string, limit: number) {
  return c.people.filter((p) => p.rosterFor.includes(faction as FactionCode) && !w.retired.includes(p.id)).slice(0, limit);
}

function agentRecord(w: WorldState, code: string): AgentRecord {
  w.agents[code] ??= { st: '미정', situation: '', since: null, dead: 0 };
  return w.agents[code];
}

/** 문장 속 P001·A00 같은 코드를 이름으로 */
export function codesToNames(text: string, c: Catalog, faction: string): string {
  if (!/[A-Z]+\d+/.test(text)) return text;
  const people = new Map(c.people.map((p) => [p.id, p.name]));
  const factions = factionNames(c, faction);
  return text.replace(/(?<![\w])([A-Z]+\d+)(?![\w])/g, (code) => factions[code] ?? people.get(code) ?? code);
}

function applyAgents(w: WorldState, c: Catalog, s: WorldSettings, faction: string, text: string) {
  const roster = rosterFor(w, c, faction, s.agent_limit);
  for (const t of scanAgents(text)) {
    const key = t.who.replace(/-/g, '').toUpperCase();
    const p = roster.find((r) => r.id === key || r.english === t.who);
    if (!p) continue;
    const rec = agentRecord(w, p.id);
    if (rec.st !== t.state || rec.since === null) rec.since = w.minute;
    rec.st = t.state;
    rec.tagged = true;
    rec.situation = t.situation ? codesToNames(t.situation, c, faction) : '';
  }
}

/** 사망 상태로 refill번 응답이 지나면 결번 처리하고 다음 예비 인원을 올린다 */
function refillAgents(w: WorldState, c: Catalog, s: WorldSettings, faction: string) {
  w.promoted = [];
  const before = rosterFor(w, c, faction, s.agent_limit).map((p) => p.id);
  let retired = false;
  for (const code of before) {
    const rec = agentRecord(w, code);
    if (rec.st === '사망') {
      rec.dead += 1;
      if (rec.dead >= c.refill) {
        rec.dead = 0;
        w.retired.push(code);
        retired = true;
      }
    } else rec.dead = 0;
  }
  if (!retired) return;
  for (const p of rosterFor(w, c, faction, s.agent_limit)) {
    if (!before.includes(p.id)) w.promoted.push(`${p.id}(${p.name})`);
  }
}

// ── 모델 태그 반영 ──

function matchAn(w: WorldState, region: string, name: string): AnEntry | undefined {
  let best: AnEntry | undefined;
  let score = 0;
  let tied = false;
  const r = region.trim().replace(/\s+/g, '');
  for (const e of w.an) {
    const ln = locName(e.loc);
    if (!regionMatch(region, ln)) continue;
    let points = r === ln.replace(/\s+/g, '') ? 10 : 1;
    if (name && (name === e.name || name === e.presetName)) points += 100;
    if (points > score) {
      best = e;
      score = points;
      tied = false;
    } else if (points === score) tied = true;
  }
  return tied ? undefined : best;
}

/** 지역 이름에 맞는 첫 loc (커스텀 임무 등록용, 원본과 같이 첫 일치) */
function firstRegion(region: string): string | null {
  for (const loc of POOL) if (regionMatch(region, locName(loc))) return loc;
  return null;
}

function applyAnomalies(w: WorldState, c: Catalog, s: WorldSettings, faction: string, text: string) {
  const pending = w.pending.an;
  let handled = false;
  for (const t of scanAnomalies(text)) {
    const canon = presetCanon(c, t.name);
    const manualIncoming = !!pending && canon === pending;
    let e: AnEntry | undefined;
    // 이미 등록된 수동·모델 프리셋은 이름으로 먼저 찾는다 (같은 지역의 다른 괴이를 잘못 고치지 않게)
    const existing = canon ? w.an.find((x) => x.origin !== 'auto' && presetCanon(c, x.name || x.presetName) === canon) : undefined;
    if (existing) {
      if (regionMatch(t.region, locName(existing.loc))) {
        e = existing;
        if (manualIncoming) handled = true;
      }
    } else if (manualIncoming) {
      handled = true;
      const extra = w.an.filter((x) => x.origin !== 'auto').length;
      const active = w.an.some((x) => x.presetName === canon || presetCanon(c, x.name) === canon);
      if (t.state !== '활성' || extra >= s.extra_cap || active) {
        w.notice = '등록 실패: 추가 발생 여유분이 가득 찼거나 프리셋이 이미 발생 중이에요.';
      } else {
        const loc = firstRegion(t.region);
        if (!loc) w.notice = '등록 실패: 모델이 적은 지역을 지도에서 찾을 수 없어요. 다시 요청해 주세요.';
        else if (occupied(w).has(loc)) w.notice = '등록 실패: 모델이 고른 지역에 다른 괴이·사건이 있어요. 다시 요청해 주세요.';
        else {
          e = {
            loc, name: canon, state: '발생대기', grade: '', deploy: '', kind: 'preset', origin: 'manual',
            presetName: canon, since: null, born: w.minute, exploring: false,
          };
          w.an.push(e);
          w.notice = `커스텀 임무 등록: ${canon}`;
        }
      }
    } else {
      e = matchAn(w, t.region, canon ?? t.name);
      if (!e && t.state === '활성' && validName(t.name) && !w.an.some((x) => x.name === t.name)) {
        // 모델이 스스로 낸 괴이는 추가 여유분 안에서만 받는다 (요청 대기 중인 커스텀 임무 몫은 남김)
        const extra = w.an.filter((x) => x.origin !== 'auto').length + (pending ? 1 : 0);
        const presetActive = canon && w.an.some((x) => x.presetName === canon || presetCanon(c, x.name) === canon);
        const loc = uniqueRegion(t.region);
        if (extra < s.extra_cap && !presetActive && loc && !occupied(w).has(loc)) {
          e = {
            loc, name: '', state: '발생대기', grade: '', deploy: '', kind: canon ? 'preset' : 'random', origin: 'model',
            presetName: canon ?? '', since: null, born: w.minute, exploring: false,
          };
          w.an.push(e);
        }
      }
    }
    if (!e) continue;
    if (t.state !== '활성') {
      endAn(w, e);
      continue;
    }
    if (e.kind === 'preset' && validName(e.presetName)) e.name = e.presetName;
    else if (validName(t.name)) e.name = t.name;
    if (t.deploy) e.deploy = t.deploy;
    if (e.state !== '활성' || e.since === null) e.since = w.minute;
    e.state = '활성';
    if (t.grade) e.grade = t.grade;
    // 상황 칸이 없는 옛 카드 지침이면 비워 둔다 (그때는 위키 요약이 대신 보인다)
    if (t.situation) e.situation = codesToNames(t.situation, c, faction);
  }
  if (pending && handled) w.pending.an = undefined;
  else if (pending) w.notice = `${pending}: 발생 태그를 기다리는 중이에요. 다음 응답에서 다시 안내해요.`;
}

function applyIncidents(w: WorldState, c: Catalog, s: WorldSettings, faction: string, text: string) {
  for (const t of scanIncidents(text)) {
    if (!validName(t.name)) continue;
    const lm = c.landmarks.find((l) => l.name === t.name);
    // 시군구 없는 거점은 응답이 적은 지역으로 (그 시도 안에서만)
    const loc = lm && lm.gu ? landmarkLoc(lm.sido, lm.gu) : uniqueRegion(t.region);
    if (lm && !lm.gu && loc && !loc.startsWith(`${lm.sido}-`)) continue;
    if (!loc || loc === SEALED_LOC || !regionMatch(t.region, locName(loc))) continue;
    let e = w.inc.find((x) => x.name === t.name);
    if (e && e.loc !== loc) continue;
    if (!e) {
      if (t.state !== '진행') continue;
      // 이름이 아직 없는 자동 사건이 이 자리에서 첫 이름을 받는 경우
      if (!lm) e = w.inc.find((x) => x.loc === loc && x.state === '발생대기' && x.kind === 'random' && !x.name);
      if (e) e.name = t.name;
      else {
        const pending = w.pending.in;
        const reserved = pending && pending !== t.name && !w.inc.some((x) => x.name === pending) ? 1 : 0;
        const extra = w.inc.filter((x) => x.origin !== 'auto').length + reserved;
        if (extra >= s.extra_in_cap || blocked(w, 'in', t.name)) continue;
        if (!lm && occupied(w).has(loc)) continue;
        const origin: Origin = pending === t.name ? 'manual' : 'model';
        e = { loc, name: t.name, state: '발생대기', situation: '', kind: lm ? 'landmark' : 'random', origin, since: null, born: w.minute };
        w.inc.push(e);
      }
    }
    if (w.pending.in === t.name) w.pending.in = undefined;
    if (t.state === '종료') {
      endIn(w, e);
      continue;
    }
    e.situation = t.situation ? codesToNames(t.situation, c, faction) : '';
    if (t.deploy) e.deploy = t.deploy;
    if (e.state !== '진행' || e.since === null) e.since = w.minute;
    e.state = '진행';
  }
}

function applyMysticSites(w: WorldState, c: Catalog, s: WorldSettings, faction: string, text: string) {
  for (const t of scanMysticSites(text)) {
    let e = w.ms.find((x) => x.name === t.name);
    if (e) {
      if (!regionMatch(t.region, locName(e.loc))) continue;
    } else {
      if (t.state !== '출현' || !c.mysticSites.some((m) => m.name === t.name)) continue;
      const pending = w.pending.ms;
      const reserved = pending && pending !== t.name && !w.ms.some((x) => x.name === pending) ? 1 : 0;
      const extra = w.ms.filter((x) => x.origin !== 'auto').length + reserved;
      const loc = uniqueRegion(t.region);
      if (extra >= s.extra_ms_cap || !loc || occupied(w).has(loc)) continue;
      e = { loc, name: t.name, state: '발생대기', visitors: '', origin: pending === t.name ? 'manual' : 'model', since: null, born: w.minute };
      w.ms.push(e);
    }
    if (w.pending.ms === t.name) w.pending.ms = undefined;
    if (t.state === '소실') {
      endMs(w, e);
      continue;
    }
    e.visitors = t.visitors || '없음';
    if (t.situation) e.situation = codesToNames(t.situation, c, faction);
    if (e.since === null) e.since = w.minute;
    e.state = '출현';
  }
}

/** 상태창 마지막 칸(지금 다루는 괴이)으로 탐사 중 표시. 상태창이 없거나 이름이 안 맞으면 그대로 둔다 */
function applyExploration(w: WorldState, target: string | null) {
  if (target === null) return;
  const matched = target === '' ? [] : w.an.filter((e) => e.name.trim() === target);
  if (target !== '' && matched.length === 0) return;
  for (const e of w.an) e.exploring = matched.includes(e);
}

export interface OutputResult {
  world: WorldState;
  /** [AC]로 소속이 바뀌었으면 새 소속 코드 */
  faction: FactionCode | null;
}

/** 모델 응답 한 번을 반영한다. 원본 editOutput 순서와 같다 */
export function applyOutput(prev: WorldState, c: Catalog, s: WorldSettings, faction: string, text: string, rng: Rng): OutputResult {
  const w: WorldState = structuredClone(prev);
  w.notice = '';
  const status = scanStatus(text);
  if (status.minute !== null) w.minute = status.minute;

  let newFaction: FactionCode | null = null;
  const ac = scanAffiliation(text);
  if (ac && (c.affiliations ? ac in c.affiliations : BUILTIN.includes(ac)) && ac !== faction) {
    applyAgents(w, c, s, faction, text); // 바뀌기 전 명단 기준으로 먼저 반영
    newFaction = ac as FactionCode;
  }
  const now = newFaction ?? faction;

  applyAnomalies(w, c, s, now, text);
  applyIncidents(w, c, s, now, text);
  applyMysticSites(w, c, s, now, text);
  applyExploration(w, status.target);
  tick(w, c, s, rng);

  if (!newFaction) applyAgents(w, c, s, now, text);
  refillAgents(w, c, s, now);
  return { world: w, faction: newFaction };
}

/** START 직후 첫 추첨 (원본: 첫 입력 때 한 번) */
export function bootstrap(c: Catalog, s: WorldSettings, rng: Rng): WorldState {
  const w = emptyWorld();
  tick(w, c, s, rng);
  return w;
}

// ── 브리핑 (로어북 🏷️Tag 의 {{getvar::an_report}} 등) ──

function age(w: WorldState, since: number | null): string {
  if (w.minute === null || since === null) return '';
  const mins = Math.max(0, w.minute - since);
  return ` {${Math.floor(mins / 60)}시간 ${mins % 60}분 전}`;
}

export interface Reports {
  an: string;
  in: string;
  ms: string;
  ag: string;
}

export function reports(w: WorldState, c: Catalog, s: WorldSettings, faction: string): Reports {
  const an = w.an.map((e) => {
    const ln = locName(e.loc);
    if (e.state === '발생대기') return `NEW [AN|${ln}|${e.name || '<발생지점>'}|활성|<등급>|<배치>|<상황>]`;
    return `[AN|${ln}|${e.name}|${e.state}|${e.grade}|${e.deploy || '없음'}|${e.situation || '<상황>'}]${age(w, e.since)}`;
  });
  const inc = w.inc.map((e) => {
    const ln = locName(e.loc);
    if (e.state === '발생대기') return `NEW [IN|${ln}|${e.name || '<발생지점>'}|진행|<배치>|<상황>]`;
    return `[IN|${ln}|${e.name}|${e.state}|${e.deploy || '없음'}|${e.situation}]${age(w, e.since)}`;
  });
  const ms = w.ms.map((e) => {
    const ln = locName(e.loc);
    if (e.state === '발생대기') return `NEW [MS|${ln}|${e.name}|출현|<방문자>|<상황>]`;
    return `[MS|${ln}|${e.name}|${e.state}|${e.visitors || '없음'}|${e.situation || '<상황>'}]${age(w, e.since)}`;
  });
  if (w.pending.an && !w.an.some((e) => e.presetName === w.pending.an || e.name === w.pending.an)) {
    an.push(`NEW [AN|<발생 지역: 시도와 시군구>|${w.pending.an}|활성|<등급>|<배치>|<상황>]`);
  }
  if (w.pending.in && !w.inc.some((e) => e.name === w.pending.in)) {
    const lm = c.landmarks.find((l) => l.name === w.pending.in);
    const loc = lm && landmarkLoc(lm.sido, lm.gu);
    inc.push(`NEW [IN|${loc ? locName(loc) : '<발생 지역: 시도와 시군구>'}|${w.pending.in}|진행|<배치>|<상황>]`);
  }
  if (w.pending.ms && !w.ms.some((e) => e.name === w.pending.ms)) {
    ms.push(`NEW [MS|<발생 지역: 시도와 시군구>|${w.pending.ms}|출현|<방문자>|<상황>]`);
  }
  const lines: string[] = [];
  const map: string[] = [];
  for (const p of rosterFor(w, c, faction, s.agent_limit)) {
    const rec = w.agents[p.id];
    map.push(`${p.id} ${p.name && p.name !== p.english ? `${p.name} (${p.english})` : p.name || p.english}`);
    if (!rec || rec.st === '미정') lines.push(`NEW [AG|${p.id}|<상태>|<상황>]`);
    else lines.push(`[AG|${p.id}|${rec.st}|${rec.situation}]${age(w, rec.since)}`);
  }
  lines.sort();
  map.sort();
  const ag = [...lines, ...(lines.length ? [''] : []), `- code: ${map.length ? map.join(' | ') : 'none'}`].join('\n');
  return { an: an.join('\n'), in: inc.join('\n'), ms: ms.join('\n'), ag };
}

// ── 유저 조작 (지도·커스텀 임무 창) ──

export type EventKind = 'an' | 'in' | 'ms';

export interface WorldEvent {
  kind: EventKind;
  index: number;
  loc: string;
  name: string;
  /** 같은 대상인지 확인하는 값 (창을 연 사이 바뀌었으면 조작을 막는다) */
  key: string;
  grade: string;
  people: string;
  report: string;
}

/** 지도에 표시하는 진행 중 상황 (발생 예정은 제외, 원본 M.records와 같음) */
export function activeEvents(w: WorldState): WorldEvent[] {
  const out: WorldEvent[] = [];
  const key = (kind: string, e: { loc: string; name: string; born: number | null }) => `${kind}|${e.loc}|${e.name}|${e.born ?? ''}`;
  w.an.forEach((e, index) => {
    if (e.state === '활성') out.push({ kind: 'an', index, loc: e.loc, name: e.name || '이름 미확인', key: key('an', e), grade: e.grade, people: e.deploy, report: e.situation ?? '' });
  });
  w.inc.forEach((e, index) => {
    if (e.state === '진행') out.push({ kind: 'in', index, loc: e.loc, name: e.name || '이름 미확인', key: key('in', e), grade: '', people: e.deploy ?? '', report: e.situation });
  });
  w.ms.forEach((e, index) => {
    if (e.state === '출현') out.push({ kind: 'ms', index, loc: e.loc, name: e.name, key: key('ms', e), grade: '', people: e.visitors, report: e.situation ?? '' });
  });
  return out.sort((a, b) => a.loc.localeCompare(b.loc) || a.kind.localeCompare(b.kind));
}

/** 상황판에 흐리게 남길 막 끝난 상황. 같은 이름이 다시 진행 중이면 뺀다 */
export function endedShown(w: WorldState): EndedEntry[] {
  const live = (k: EndedEntry['kind'], name: string) => (k === 'an' ? w.an : k === 'in' ? w.inc : w.ms).some((e) => e.name === name && e.state !== '발생대기');
  return (w.ended ?? []).filter((e) => e.until >= w.epoch && !(e.name && live(e.kind, e.name)));
}

/** 유저가 상황을 끝낸다 (원본 상황 종료 버튼). 대상이 바뀌었으면 false */
export function endEvent(w: WorldState, key: string): boolean {
  const ev = activeEvents(w).find((e) => e.key === key);
  if (!ev) return false;
  if (ev.kind === 'an') endAn(w, w.an[ev.index]);
  else if (ev.kind === 'in') endIn(w, w.inc[ev.index]);
  else endMs(w, w.ms[ev.index]);
  return true;
}

export type MissionKind = 'an' | 'ms' | 'lm';

/** 커스텀 임무 요청을 걸어 둔다. 안 되면 이유를 돌려준다 */
export function requestMission(w: WorldState, c: Catalog, s: WorldSettings, kind: MissionKind, name: string): string | null {
  if (kind === 'an') {
    if (!c.anomalies.some((a) => a.name === name)) return '목록에 없는 괴이예요.';
    if (w.an.some((e) => e.presetName === name || presetCanon(c, e.name) === name)) return '이미 발생 중인 괴이예요.';
    if (w.an.filter((e) => e.origin !== 'auto').length >= s.extra_cap) return '추가 발생 여유분이 가득 찼어요. 기존 괴이를 끝낸 뒤 다시 요청해 주세요.';
    w.pending.an = name;
  } else if (kind === 'ms') {
    if (!c.mysticSites.some((m) => m.name === name)) return '목록에 없는 특수예요.';
    if (!w.ms.some((e) => e.name === name) && w.ms.filter((e) => e.origin !== 'auto').length >= s.extra_ms_cap) return '특수 추가 여유분이 가득 찼어요.';
    w.pending.ms = name;
  } else {
    if (!c.landmarks.some((l) => l.name === name)) return '목록에 없는 거점이에요.';
    if (!w.inc.some((e) => e.name === name) && w.inc.filter((e) => e.origin !== 'auto').length >= s.extra_in_cap) return '사건 추가 여유분이 가득 찼어요.';
    w.pending.in = name;
  }
  w.notice = `요청 대기: ${name} (다음 응답에서 등록돼요)`;
  return null;
}

/** 걸어 둔 커스텀 임무 요청을 지운다 */
export function cancelMission(w: WorldState, kind: EventKind): void {
  w.pending[kind] = undefined;
  w.notice = '';
}

/** 편성할 수 없는 요원 상태 (원본 lock) */
export const LOCKED_STATES = ['작전투입', '실종', '사망', '미정'];

/** 원본과 같이 태그로 받은 상태만 잠근다. 아직 태그가 없던 요원은 편성할 수 있다 */
export function agentLocked(rec: AgentRecord | undefined): boolean {
  if (!rec || !LOCKED_STATES.includes(rec.st)) return false;
  return rec.st !== '미정' || rec.tagged === true;
}
