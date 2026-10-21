// 본부 규칙 (DOM 없음). 임무 게시판 → 브리핑 → 출동 정보 → 정산, 재화·보관함·숙련·피로·부상·연구·이빨 상자.
// 출동 안의 일(전투·층·줍기)은 다른 모듈이 하고, 여기서는 MissionLaunch를 만들고 RunResult를 반영만 한다.
import type { AgentId, AgentStats, BagSlot, MissionLaunch, RunResult, Slot } from './contract';
import { AGENTS, AGENT_BY_ID, COFFEES, DECOR, MASTERY_UNLOCKS, MASTERY_XP, LOCKED_SUPPLY, MISSIONS, MISSION_BY_ID, PLACES, RELICS, RESEARCH, SUPPLY_FALLBACK, SURVIVORS, VARIANTS, type MissionDef, type PlaceId, type SupplyDef } from './data';
import type { MissionGoal } from './contract';
import type { HqSave } from './state';

export type Rand = () => number;

// ── 보급표: 아이템 스레드 표가 오면 setSupplyCatalog로 바꾼다 ──
let supply: SupplyDef[] = SUPPLY_FALLBACK;
export function setSupplyCatalog(list: SupplyDef[]) {
  if (list.length) supply = list.map((d) => ({ ...d, locked: d.locked ?? LOCKED_SUPPLY.has(d.id) }));
}
export const supplyCatalog = () => supply;
export const supplyDef = (id: string) => supply.find((s) => s.id === id);
export const itemName = (id: string) => supplyDef(id)?.name ?? id;

// ── 장소 ──
export function placeOpen(s: HqSave, id: PlaceId): boolean {
  switch (id) {
    case 'interview':
      return s.flags.firstRescue;
    case 'training':
      return s.flags.firstRun;
    case 'appraisal':
      return s.flags.firstRecovery;
    case 'lab':
      return s.flags.firstAppraisal;
    case 'tooth':
    case 'gallery':
    case 'pasta':
      return s.flags.firstSuppress;
    default:
      return true;
  }
}
export const openPlaces = (s: HqSave) => PLACES.filter((p) => placeOpen(s, p.id));

// ── 숙련 (16.3) ──
export function masteryLevel(xp: number): number {
  let lv = 1;
  for (let i = 1; i < MASTERY_XP.length; i++) if (xp >= MASTERY_XP[i]) lv = i + 1;
  return lv;
}
export function masteryNext(xp: number): number | null {
  const lv = masteryLevel(xp);
  return lv >= 10 ? null : MASTERY_XP[lv];
}
/** 그 단계까지 열린 것 id. 새 동작(move)은 3·6에서만 열린다. */
export function unlocksAt(level: number): string[] {
  return Object.entries(MASTERY_UNLOCKS)
    .filter(([lv]) => Number(lv) <= level)
    .map(([, u]) => u.id);
}
export const movesFor = (level: number) => unlocksAt(level);

// ── 능력치 (16.1 + 피로·부상·커피·브리핑) ──
export function rulebookRatio(s: HqSave): number {
  return Math.min(1, s.rulebook.length / 12);
}
export function statsFor(s: HqSave, agent: AgentId): AgentStats {
  const a = AGENT_BY_ID[agent];
  const rec = s.agents[agent];
  const st = { ...a.base };
  st.hp = Math.round(st.hp * (1 - 0.06 * rec.fatigue));
  if (s.coffee === 'mix') st.hp = Math.round(st.hp * 1.1);
  if (s.coffee === 'americano') st.speed = +(st.speed * 1.1).toFixed(2);
  if (s.coffee === 'black') st.charge = +(st.charge * 1.2).toFixed(2);
  if (rulebookRatio(s) >= 0.5) st.hp = Math.round(st.hp * 1.1);
  if (s.relics.includes('gauge')) st.charge = +(st.charge * 1.25).toFixed(2);
  return st;
}
export function canDeploy(s: HqSave, agent: AgentId): { ok: boolean; why: string } {
  const rec = s.agents[agent];
  if (rec.injured > 0) return { ok: false, why: `부상: ${rec.injured}일 더 쉬어야 함 (의무실에서 예산으로 바로 치료 가능)` };
  return { ok: true, why: rec.fatigue ? `피로 ${rec.fatigue}: 시작 체력 -${rec.fatigue * 6}%` : '' };
}

// ── 임무 게시판 (5.1) ──
export interface MissionCard {
  def: MissionDef;
  /** 구조 요청 남은 출동 수 */
  left?: number;
  linked?: string;
  done: boolean;
}
/** 언제나 2~3장. 안 한 다음 임무를 먼저, 그다음 다시 할 수 있는 정규 조사. 본편 상황판에 차원 승강기가 떠 있으면 연계 표시. */
export function missionBoard(s: HqSave, boardNames: string[] = []): MissionCard[] {
  const open = MISSIONS.filter((m) => !m.requires || s.missionsDone.includes(m.requires));
  const fresh = open.filter((m) => !s.missionsDone.includes(m.id) && !s.failedRescues.includes(m.id));
  const cards: MissionCard[] = fresh.slice(0, 3).map((def) => ({ def, done: false, left: def.deadline ? Math.max(0, (s.deadlines[def.id] ?? s.runs + def.deadline) - s.runs) : undefined }));
  for (const def of open) {
    if (cards.length >= 3) break;
    if (def.repeat && !cards.some((c) => c.def.id === def.id)) cards.push({ def, done: s.missionsDone.includes(def.id) });
  }
  if (!cards.length) cards.push({ def: MISSIONS[0], done: true });
  const link = boardNames.find((n) => /승강기|엘리베이터/.test(n));
  if (link) cards[0] = { ...cards[0], linked: link };
  return cards;
}
/** 게시판을 연 순간 구조 요청 마감을 정한다 */
export function noteDeadlines(s: HqSave, cards: MissionCard[]) {
  for (const c of cards) if (c.def.deadline && s.deadlines[c.def.id] === undefined) s.deadlines[c.def.id] = s.runs + c.def.deadline;
}

// ── 보급 (5.4 · 12.3) ──
export function supplyOpen(s: HqSave, d: SupplyDef) {
  return !(d.locked ?? LOCKED_SUPPLY.has(d.id)) || s.researchDone.includes('rs_supply');
}
export function buy(s: HqSave, id: string): string {
  const d = supplyDef(id);
  if (!d || !supplyOpen(s, d)) return '살 수 없는 물건이에요.';
  if (s.currencies.budget < d.price) return `예산이 모자라요 (${d.price} 필요).`;
  s.currencies.budget -= d.price;
  s.stash[id] = (s.stash[id] ?? 0) + 1;
  return `${d.name} 1개 구입 (예산 -${d.price})`;
}
/** 보관함 → 칸. 같은 아이템이 이미 있으면 그 칸에 더한다 (칸당 max). */
export function equip(s: HqSave, slot: number, id: string): string {
  const d = supplyDef(id);
  if (!d || !(s.stash[id] > 0)) return '보관함에 없어요.';
  const cur = s.loadout[slot];
  if (cur && cur.id !== id) unequip(s, slot);
  const now = s.loadout[slot];
  if (now && now.n >= d.max) return `${d.name}은 한 칸에 ${d.max}개까지.`;
  s.stash[id]--;
  s.loadout[slot] = now ? { id, n: now.n + 1 } : { id, n: 1 };
  return `${slot + 1}번 칸: ${d.name} ×${s.loadout[slot]!.n}`;
}
export function unequip(s: HqSave, slot: number) {
  const cur = s.loadout[slot];
  if (!cur) return;
  s.stash[cur.id] = (s.stash[cur.id] ?? 0) + cur.n;
  s.loadout[slot] = null;
}
export function equipRelic(s: HqSave, slot: number, id: string | null): string {
  if (id && !s.relicsOwned.includes(id)) return '없는 유물이에요.';
  if (id && s.relics.includes(id)) s.relics[s.relics.indexOf(id)] = null;
  s.relics[slot] = id;
  return id ? `유물 ${slot + 1}: ${RELICS[id]?.name}` : `유물 ${slot + 1} 비움`;
}
export function pickCoffee(s: HqSave, id: string | null): string {
  s.coffee = id;
  const c = COFFEES.find((x) => x.id === id);
  return c ? `${c.name}: 다음 출동 ${c.effect}` : '커피 안 마심';
}

// ── 의무실·감정실·연구실·이빨 요정·면담실·부장실 ──
export const TREAT_COST = 150;
export function treat(s: HqSave, agent: AgentId): string {
  const rec = s.agents[agent];
  if (!rec.injured) return '다친 데 없어요.';
  if (s.currencies.budget < TREAT_COST) return `예산이 모자라요 (${TREAT_COST} 필요).`;
  s.currencies.budget -= TREAT_COST;
  rec.injured = 0;
  return `${AGENT_BY_ID[agent].name} 치료 완료 (예산 -${TREAT_COST})`;
}
export function appraise(s: HqSave): string[] {
  if (!s.appraisal.length) return ['감정할 회수물이 없어요.'];
  const lines: string[] = [];
  let sum = 0;
  for (const b of s.appraisal) {
    if (!b) continue;
    const r = b.research ?? 1;
    sum += r;
    lines.push(`${b.name} → 연구 자료 ${r}`);
  }
  s.currencies.research += sum;
  s.appraisal = [];
  s.flags.firstAppraisal = true;
  lines.push(`연구 자료 +${sum}`);
  return lines;
}
export function researchOpen(s: HqSave) {
  return RESEARCH.filter((r) => !s.researchDone.includes(r.id) && (!r.requires || s.researchDone.includes(r.requires)));
}
export function doResearch(s: HqSave, id: string): string {
  const r = RESEARCH.find((x) => x.id === id);
  if (!r || s.researchDone.includes(id)) return '없는 연구예요.';
  if (r.requires && !s.researchDone.includes(r.requires)) return '앞 연구가 먼저예요.';
  if (s.currencies.research < r.research || s.currencies.budget < r.budget) return `모자라요 (연구 자료 ${r.research} · 예산 ${r.budget}).`;
  s.currencies.research -= r.research;
  s.currencies.budget -= r.budget;
  s.researchDone.push(id);
  if (r.gives.startsWith('relic:')) {
    const rel = r.gives.slice(6);
    if (!s.relicsOwned.includes(rel)) s.relicsOwned.push(rel);
    return `연구 완료: ${r.name} → 유물 「${RELICS[rel].name}」 (${RELICS[rel].effect})`;
  }
  if (r.gives === 'danger') return `연구 완료: ${r.name} → 부장실에서 위험 단계를 결재할 수 있어요.`;
  return `연구 완료: ${r.name} → 보급품 목록 확장`;
}
export const DANGER_COST = (lv: number) => 300 * lv;
export function approveDanger(s: HqSave): string {
  if (!s.researchDone.includes('rs_danger')) return '부장: 「기준도 없이 위험 단계를 올리자고?」 (연구실 연구 필요)';
  if (s.maxDanger >= 5) return '이미 최고 단계예요.';
  const cost = DANGER_COST(s.maxDanger + 1);
  if (s.currencies.budget < cost) return `예산이 모자라요 (${cost} 필요).`;
  s.currencies.budget -= cost;
  s.maxDanger++;
  return `위험 단계 ${s.maxDanger} 결재 완료 (예산 -${cost})`;
}
export function setDanger(s: HqSave, lv: number) {
  s.danger = Math.max(0, Math.min(s.maxDanger, lv));
}
export const TOOTH_COST = 3;
export function openToothBox(s: HqSave, rand: Rand): string {
  if (s.currencies.teeth < TOOTH_COST) return `이빨이 모자라요 (${TOOTH_COST}개 필요).`;
  s.currencies.teeth -= TOOTH_COST;
  const r = rand();
  if (r < 0.12 && s.lostRelics.length) {
    const back = s.lostRelics.shift()!;
    s.relicsOwned.push(back);
    return `상자 안에서 빼앗겼던 유물이 나왔다: 「${RELICS[back].name}」`;
  }
  if (r < 0.3) {
    const pool = supply.filter((d) => supplyOpen(s, d));
    const d = pool[Math.floor(rand() * pool.length)];
    s.stash[d.id] = (s.stash[d.id] ?? 0) + 1;
    return `선물 상자: ${d.name} 1개`;
  }
  const junk = DECOR[Math.floor(rand() * DECOR.length)];
  if (!s.decor.includes(junk)) s.decor.push(junk);
  return `선물 상자: ${junk} (사무실에 놓았다)`;
}
export function interview(s: HqSave, who: string): string {
  const sv = SURVIVORS[who];
  if (!sv) return '';
  if (!s.interviewed.includes(who)) {
    s.interviewed.push(who);
    if (sv.rule && !s.rulebook.includes(sv.rule)) s.rulebook.push(sv.rule);
    return `${sv.name}: ${sv.clue} (규칙서 +1)`;
  }
  return `${sv.name}: ${sv.clue}`;
}

// ── 출동 (5.3 · 6.1) ──
export function variantFor(seed: number) {
  return VARIANTS[seed % VARIANTS.length];
}
/** 출동 정보 만들기. 아이템 4칸·커피는 출동으로 넘어가고 본부 쪽은 비운다 (돌아오면 남은 것만 돌려받음). */
export function launch(s: HqSave, missionId: string, seed: number): MissionLaunch | string {
  const m = MISSION_BY_ID[missionId];
  if (!m) return '임무를 고르세요.';
  const can = canDeploy(s, s.selected);
  if (!can.ok) return can.why;
  if (s.active) return '이미 출동 중이에요.';
  const rec = s.agents[s.selected];
  const level = masteryLevel(rec.xp);
  const runId = `${s.day}-${s.runs + 1}-${seed.toString(36)}`;
  const l: MissionLaunch = {
    runId,
    seed,
    agent: s.selected,
    support: s.support && s.support !== s.selected && s.agents[s.support].injured === 0 ? s.support : null,
    goal: { id: m.id, kind: m.kind, title: m.title, depth: m.depth, rules: m.rules, rescue: m.rescue, recover: m.recover },
    stats: statsFor(s, s.selected),
    mastery: level,
    moves: movesFor(level),
    items: s.loadout.map((x) => (x ? { ...x } : null)),
    relics: s.relics.filter((x): x is string => !!x),
    coffee: s.coffee,
    danger: s.danger,
    variant: variantFor(seed).id,
    knownRules: s.rulebook.slice(),
    deepest: s.deepest,
  };
  s.loadout = [null, null, null, null];
  s.coffee = null;
  s.mission = m.id;
  s.active = { runId, mission: m.id, agent: s.selected, seed };
  return l;
}

/** 출동 중 앱을 닫았다가 다시 열었는데 출동 상태가 없으면: 출동 포기 = 후송 취급 */
export function abandonActive(s: HqSave) {
  s.active = null;
}

// ── 엔진 결과 정리 ──
/** 구조된 사람 id (층 모듈은 'missing:5' 같은 id를 쓴다) → 면담실 생존자 id */
export const survivorId = (id: string) => (SURVIVORS[id] ? id : id.startsWith('missing') ? 'worker' : id);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
/** 층 모듈 기록(stage.*)을 RunResult 칸으로 옮긴다. 엔진이 notes를 넘겨주면 쓴다. */
export function normalizeResult(r: RunResult): RunResult {
  const n = r.notes;
  if (!n) return r;
  const out = { ...r };
  const found = arr(n['stage.found']);
  if (!out.found.length && found.length) out.found = found;
  const sent = arr(n['stage.sent']);
  if (!out.sent.length && sent.length) out.sent = sent;
  const rescued = arr(n['stage.rescued']);
  if (!out.rescued.length && rescued.length) out.rescued = rescued;
  out.rescued = [...new Set(out.rescued.map(survivorId))];
  if (typeof n['stage.depth'] === 'number') out.depth = Math.max(out.depth, n['stage.depth'] as number);
  return out;
}
/** 임무 달성 판정은 본부가 한다 (층 모듈은 임무를 모른다). 귀환해야 성공. */
export function judgeMission(g: MissionGoal, r: RunResult): boolean {
  if (r.how !== 'return') return false;
  const n = r.notes;
  if (!n) return r.missionDone;
  const visited = arr(n['stage.visited']).join(' ');
  const bosses = arr(n.bosses);
  switch (g.kind) {
    case '조사':
      if (g.id === 'm3') return visited.includes('추격') && r.depth >= g.depth;
      if (g.id === 'm8') return n['stage.trial'] === 'success';
      if (g.id === 'm5') return visited.includes('재현') && r.found.length >= (g.rules ?? 1);
      return r.found.length >= (g.rules ?? 1);
    case '구조':
      return r.rescued.length > 0;
    case '진압':
      return r.depth >= g.depth && (n.boss === true || bosses.length > 0);
    case '회수':
      return r.bag.some((b) => b?.id === g.recover) || n[`stage.${g.recover}`] === true;
    case '기록':
      return r.depth >= g.depth;
  }
}

// ── 정산 (6.4 · 13 · 15 · 16 · 부록 E.5) ──
export const CASH_RATE = { return: 0.5, withdraw: 0.5, evac: 0 } as const;
export const MASTERY_GAIN = (r: RunResult) => 20 + r.floors * 10 + (r.missionDone ? 30 : 0) + Math.min(30, r.kills);

export function settle(s: HqSave, l: MissionLaunch, raw: RunResult, rand: Rand): string[] {
  // 같은 출동을 두 번 정산하지 않는다 (다시 열기·이중 호출)
  const id = raw.runId ?? l.runId;
  if (s.last?.runId === id && id) return s.last.lines;
  if (s.active && l.runId && s.active.runId !== l.runId) return ['다른 출동의 결과라 정산하지 않았어요.'];
  const lines: string[] = [];
  const r0 = normalizeResult(raw);
  const r = { ...r0, missionDone: judgeMission(l.goal, r0) };
  const m = MISSION_BY_ID[l.goal.id];
  const evac = r.how === 'evac';
  const success = r.how === 'return' && r.missionDone;
  const agent = AGENT_BY_ID[l.agent];
  lines.push(evac ? `후송: ${josa(agent.name, '이', '가')} 의무실 침대에서 깨어났다.` : success ? `귀환: ${agent.name}, 임무 「${m.title}」 성공.` : r.how === 'return' ? `귀환: 임무 「${m.title}」 미달성. 성공 보상은 없다.` : `철수: ${josa(agent.name, '이', '가')} 다락방 로프로 철수했다. 성공 보상은 없다.`);

  // 규칙서: 송신한 정보는 전부, 안 보낸 정보는 후송이면 절반
  const unsent = r.found.filter((f) => !r.sent.includes(f));
  const kept = evac ? [...r.sent, ...unsent.filter((_, i) => i % 2 === 0)] : r.found.slice();
  let added = 0;
  for (const id of kept) if (!s.rulebook.includes(id)) (s.rulebook.push(id), added++);
  if (added || (evac && unsent.length)) lines.push(`규칙서 +${added}줄${evac && unsent.length ? ` (미송신 ${unsent.length}줄 중 ${Math.ceil(unsent.length / 2)}줄만 남음)` : ''}`);

  // 재화: 현금은 출동 안에서만, 귀환·철수 때 절반을 예산으로
  const cashToBudget = Math.floor(r.cash * CASH_RATE[r.how]);
  let budget = cashToBudget + (evac ? Math.floor(r.budget / 2) : r.budget);
  let teeth = evac ? Math.floor(r.teeth / 2) : r.teeth;
  let research = 0;
  if (success) {
    budget += m.reward.budget;
    teeth += m.reward.teeth;
    research += m.reward.research;
    if (!s.missionsDone.includes(m.id)) s.missionsDone.push(m.id);
    if (m.kind === '진압') s.flags.firstSuppress = true;
  }
  // 깊이 보상 배율 (8.4: 깊을수록 보상 배율)
  const mult = 1 + Math.max(0, r.depth - 3) * 0.1;
  budget = Math.round(budget * mult);
  // 사채 상환 (17.2 신유리): 못 갚으면 유물 압류
  if (r.debt > 0) {
    const pay = Math.min(r.debt, s.currencies.budget + budget);
    budget -= pay;
    if (pay < r.debt && s.relicsOwned.length) {
      const taken = s.relicsOwned.pop()!;
      s.relics = s.relics.map((x) => (x === taken ? null : x));
      lines.push(`사채를 다 못 갚아 유물 「${RELICS[taken].name}」${josa(RELICS[taken].name, '을', '를').slice(RELICS[taken].name.length)} 압류당했다.`);
    } else lines.push(`사채 ${r.debt} 상환`);
  }
  s.currencies.budget = Math.max(0, s.currencies.budget + budget);
  s.currencies.teeth += teeth;
  s.currencies.research += research;
  const got: string[] = [];
  if (budget) got.push(`예산 ${budget > 0 ? '+' : ''}${budget}${cashToBudget > 0 ? ` (현금 ${r.cash}의 절반 포함${mult > 1 ? `, 깊이 배율 ×${mult.toFixed(1)}` : ''})` : mult > 1 && budget > 0 ? ` (깊이 배율 ×${mult.toFixed(1)})` : ''}`);
  if (teeth) got.push(`이빨 +${teeth}`);
  if (research) got.push(`연구 자료 +${research}`);
  if (evac && r.cash > 0) got.push(`현금 ${r.cash} 잃음`);
  lines.push(got.length ? got.join(' · ') : '얻은 재화 없음');

  // 회수물: 후송이면 절반, 나머지는 감정실로
  const bag = r.bag.filter((b): b is NonNullable<BagSlot> => !!b);
  const keptBag = evac ? bag.filter((_, i) => i % 2 === 0) : bag;
  if (keptBag.length) {
    s.appraisal.push(...keptBag);
    s.flags.firstRecovery = true;
    lines.push(`회수물 ${keptBag.length}개 감정 대기${evac && bag.length > keptBag.length ? ` (${bag.length - keptBag.length}개 잃음)` : ''}`);
  }
  // 아이템: 귀환·철수면 남은 것 다시 칸으로, 후송이면 잃음
  if (!evac) {
    s.loadout = r.itemsLeft.slice(0, 4).map((x) => (x && x.n > 0 ? { ...x } : null));
    while (s.loadout.length < 4) s.loadout.push(null);
  } else {
    const lost = r.itemsLeft.filter((x) => x && x.n > 0).length;
    if (lost) lines.push(`가져간 아이템을 잃었다 (${lost}칸)`);
  }
  // 구조
  for (const who of r.rescued) if (!s.rescued.includes(who)) (s.rescued.push(who), (s.flags.firstRescue = true), lines.push(`구조: ${SURVIVORS[who]?.name ?? who} → 면담실`));

  // 숙련
  const rec = s.agents[l.agent];
  const before = masteryLevel(rec.xp);
  const gain = MASTERY_GAIN(r);
  rec.xp += gain;
  rec.runs++;
  rec.deepest = Math.max(rec.deepest, r.depth);
  const after = masteryLevel(rec.xp);
  lines.push(`${agent.name} 숙련 경험 +${gain}${after > before ? ` → 숙련 ${after}단계!` : ''}`);
  for (let lv = before + 1; lv <= after; lv++) {
    const u = MASTERY_UNLOCKS[lv];
    if (!u) continue;
    lines.push(`  숙련 ${lv}: ${u.label}${u.move ? ` · ${lv === 3 ? agent.moveA : agent.moveB}` : ''}`);
    if (u.id === 'relic_own') s.relicsOwned.push(`own_${l.agent}`);
  }

  // 피로: 이번에 나간 요원 +1, 쉰 요원은 하루 쉬어 0 (5.2). 부상 휴식 일수도 하루 줄인다.
  for (const a of AGENTS) {
    const ar = s.agents[a.id];
    if (a.id === l.agent) ar.fatigue = Math.min(3, ar.fatigue + 1);
    else {
      ar.fatigue = 0;
      if (ar.injured > 0) ar.injured--;
    }
  }
  // 영구 부상 (부록 E.5): 후송 때 15% + 위험 단계마다 5%
  if (evac && rand() < 0.15 + 0.05 * l.danger) {
    rec.injured = 1;
    lines.push(`${agent.name} 부상: 다음 출동 1회 쉬어야 한다 (의무실에서 예산 ${TREAT_COST}로 바로 치료 가능)`);
  }
  // 영구 손실 (15.3): 위험 단계 2 이상 후송에서 10%로 유물 하나를 괴이에 빼앗김
  if (evac && l.danger >= 2 && l.relics.length && rand() < 0.1) {
    const taken = l.relics[Math.floor(rand() * l.relics.length)];
    s.relicsOwned = s.relicsOwned.filter((x) => x !== taken);
    s.relics = s.relics.map((x) => (x === taken ? null : x));
    s.lostRelics.push(taken);
    lines.push(`유물 「${RELICS[taken].name}」${josa(RELICS[taken].name, '을', '를').slice(RELICS[taken].name.length)} 괴이에 빼앗겼다. 이빨 요정 상자에서 다시 나올 수도 있다.`);
  }
  // 구조 요청 마감
  s.runs++;
  for (const [id, until] of Object.entries(s.deadlines)) {
    if (s.missionsDone.includes(id) || s.failedRescues.includes(id)) continue;
    if (s.runs >= until && !(success && id === m.id)) {
      s.failedRescues.push(id);
      lines.push(`구조 요청 「${MISSION_BY_ID[id].title}」 마감을 넘겼다. 다음에 만나면 더는 사람이 아닐 것이다.`);
    }
  }
  // 기록·영구 지름길
  s.deepest = Math.max(s.deepest, r.depth);
  s.records.bestFloors = Math.max(s.records.bestFloors, r.floors);
  s.records.bestKills = Math.max(s.records.bestKills, r.kills);
  if (success && (!s.records.fastestReturn || r.seconds < s.records.fastestReturn)) s.records.fastestReturn = Math.round(r.seconds);
  s.flags.firstRun = true;
  s.day++;
  s.active = null;
  s.mission = null;
  const { notes: _notes, ...lastResult } = r;
  void _notes;
  s.last = { runId: id ?? '', mission: m.id, agent: l.agent, how: r.how, lines, result: { ...lastResult, runId: id }, day: s.day - 1 };
  return lines;
}

/** 본편에 붙일 짧은 보고서 (22.2). 버튼을 누를 때만 쓴다. */
export function reportText(s: HqSave): string {
  const l = s.last;
  if (!l) return '';
  const m = MISSION_BY_ID[l.mission];
  const how = l.how === 'evac' ? '후송' : l.how === 'withdraw' ? '자발 철수' : '귀환';
  const depth = l.result.depth <= 3 ? `L${l.result.depth}` : `B-${l.result.depth - 3}`;
  const rules = l.result.found.length ? ` 확인한 규칙 ${l.result.found.length}줄.` : '';
  const saved = l.result.rescued.map((w) => SURVIVORS[w]?.name ?? w);
  return `[관리국 출동 보고] ${AGENT_BY_ID[l.agent].name} · 차원 승강기 · 임무 「${m.title}」 · ${how} (최저 ${depth}, 층 ${l.result.floors}).${rules}${saved.length ? ` 구조: ${saved.join(', ')}.` : ''}`;
}

/** 저장 목록에 보일 제목·요약 (리스 탑재 스레드 bridge.saves.write 용) */
export function saveTitle(s: HqSave) {
  return { title: `${s.day}일차 · ${AGENT_BY_ID[s.selected].name}`, summary: `예산 ${s.currencies.budget} · 규칙서 ${s.rulebook.length}줄 · 최저 ${s.deepest ? (s.deepest <= 3 ? `L${s.deepest}` : `B-${s.deepest - 3}`) : '—'}` };
}

export type { Slot };

/** 받침에 따라 조사 고르기: josa('쟈알디', '이', '가') → '쟈알디가' */
function josa(word: string, withBatchim: string, without: string): string {
  const c = word.charCodeAt(word.length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return word + (has ? withBatchim : without);
}
