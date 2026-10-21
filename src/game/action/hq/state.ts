// 본부 저장 데이터 모양 (본부 스레드 소유). 저장소(pluginStorage 슬롯)는 리스 탑재 스레드의 bridge.saves가 들고,
// 본문은 이 모양의 JSON 문자열이다. 모양이 바뀌면 HQ_SCHEMA 숫자를 올리고 migrate()에 옮기는 줄을 더한다.
import type { AgentId, BagSlot, RunResult, Slot } from './contract';
import { OLD_ITEM_IDS, type PlaceId } from './data';

export const HQ_SCHEMA = 'goei-hq/1';

export interface AgentRecord {
  xp: number;
  /** 연속 출동 피로 0~3 (기획서 5.2). 하루 쉬면 0 */
  fatigue: number;
  /** 영구 부상: 남은 휴식 일수 (부록 E.5). 0이면 건강 */
  injured: number;
  runs: number;
  deepest: number;
  /** 마지막으로 본 숙련 단계 (새 단계 알림용) */
  seenLevel: number;
}

export interface HqSave {
  schema: typeof HQ_SCHEMA;
  /** 본부 귀환 횟수 = 하루 */
  day: number;
  runs: number;
  /** 본부 가로 화면에서 서 있던 곳 */
  x: number;
  currencies: { budget: number; research: number; teeth: number };
  agents: Record<AgentId, AgentRecord>;
  selected: AgentId;
  support: AgentId | null;
  /** 보관함: 아이템 id → 개수 (영구) */
  stash: Record<string, number>;
  /** 출동 아이템 4칸 (1~4키) */
  loadout: Slot[];
  relicsOwned: string[];
  relics: (string | null)[];
  coffee: string | null;
  researchDone: string[];
  /** 감정 대기 회수물 */
  appraisal: BagSlot[];
  rulebook: string[];
  deepest: number;
  missionsDone: string[];
  /** 고른 임무 */
  mission: string | null;
  /** 구조 요청 마감: 임무 id → 출동 횟수 */
  deadlines: Record<string, number>;
  failedRescues: string[];
  danger: number;
  maxDanger: number;
  flags: { firstRun: boolean; firstRecovery: boolean; firstAppraisal: boolean; firstSuppress: boolean; firstRescue: boolean };
  /** 본 대화·사건 id (대화 스레드의 flags도 여기에 넣는다) */
  album: string[];
  storyFlags: Record<string, unknown>;
  decor: string[];
  rescued: string[];
  interviewed: string[];
  lostRelics: string[];
  /** 마지막 정산 (본부로 돌아와 다시 열면 보여 줌, 보고서 붙이기에 씀) */
  last: null | { runId: string; mission: string; agent: AgentId; how: RunResult['how']; lines: string[]; result: RunResult; day: number };
  /** 출동 중이면 그 출동 정보 (앱을 닫았다 열면 '출동 중' 표시) */
  active: null | { runId: string; mission: string; agent: AgentId; seed: number };
  records: { bestFloors: number; bestKills: number; fastestReturn: number };
}

const agentRecord = (): AgentRecord => ({ xp: 0, fatigue: 0, injured: 0, runs: 0, deepest: 0, seenLevel: 1 });

export function newSave(): HqSave {
  return {
    schema: HQ_SCHEMA,
    day: 1,
    runs: 0,
    x: 200,
    currencies: { budget: 200, research: 0, teeth: 0 },
    agents: { jyaldi: agentRecord(), eileen: agentRecord() },
    selected: 'jyaldi',
    support: null,
    stash: { medkit: 1, salt: 1 },
    loadout: [{ id: 'medkit', n: 2 }, { id: 'bandage', n: 1 }, { id: 'flash', n: 1 }, null],
    relicsOwned: [],
    relics: [null, null],
    coffee: null,
    researchDone: [],
    appraisal: [],
    rulebook: [],
    deepest: 0,
    missionsDone: [],
    mission: null,
    deadlines: {},
    failedRescues: [],
    danger: 0,
    maxDanger: 0,
    flags: { firstRun: false, firstRecovery: false, firstAppraisal: false, firstSuppress: false, firstRescue: false },
    album: [],
    storyFlags: {},
    decor: [],
    rescued: [],
    interviewed: [],
    lostRelics: [],
    last: null,
    active: null,
    records: { bestFloors: 0, bestKills: 0, fastestReturn: 0 },
  };
}

/** 저장 문자열 → 본부 데이터. 모양이 다르거나 깨졌으면 null (호출한 쪽이 새로 시작을 묻는다). 빠진 칸은 기본값으로 채운다. */
export function parseSave(text: string | null | undefined): HqSave | null {
  if (!text) return null;
  let d: Partial<HqSave>;
  try {
    d = JSON.parse(text);
  } catch {
    return null;
  }
  if (!d || typeof d !== 'object' || d.schema !== HQ_SCHEMA) return null;
  const base = newSave();
  const out = { ...base, ...d } as HqSave;
  out.currencies = { ...base.currencies, ...d.currencies };
  out.flags = { ...base.flags, ...d.flags };
  out.records = { ...base.records, ...d.records };
  out.agents = { ...base.agents };
  for (const id of Object.keys(base.agents) as AgentId[]) out.agents[id] = { ...agentRecord(), ...d.agents?.[id] };
  if (!Array.isArray(out.loadout) || out.loadout.length !== 4) out.loadout = base.loadout;
  if (!Array.isArray(out.relics) || out.relics.length !== 2) out.relics = [null, null];
  // 예전 임시 아이템 id → 아이템 모듈 id
  const fix = (id: string) => OLD_ITEM_IDS[id] ?? id;
  out.loadout = out.loadout.map((x) => (x ? { id: fix(x.id), n: x.n } : null));
  const stash: Record<string, number> = {};
  for (const [id, n] of Object.entries(out.stash ?? {})) stash[fix(id)] = (stash[fix(id)] ?? 0) + n;
  out.stash = stash;
  return out;
}

export const saveText = (s: HqSave) => JSON.stringify(s);
