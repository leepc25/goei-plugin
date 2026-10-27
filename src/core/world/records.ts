// 세계 데이터 기록: 플러그인 기본 세계(src/data/world/*.json) + 카드 명부의 덧쓰기(DirectoryData.세계).
// 「기본 세계 + 덧쓰기」(사용자 2026-10-27): 카드에 같은 기록이 있으면 카드가 이기고, 카드에만 있으면 추가, deleted 면 기본 기록을 뺀다.
import agentsJson from '../../data/world/agents.json';
import orgsJson from '../../data/world/orgs.json';
import anomaliesJson from '../../data/world/anomalies.json';
import sitesJson from '../../data/world/sites.json';
import appendicesJson from '../../data/world/appendices.json';
import relationsJson from '../../data/world/relations.json';
import { FIELDS, type WorldKind } from './schema';

/** 기록별 추가 칸. kind=line 은 요원 Identity·Appearance 절의 「- 이름: 값」 한 줄(sec 절, at 칸 뒤·'' 이면 절 맨 앞), block 은 절 하나(맨 뒤) */
export interface ExtraField {
  name: string;
  value: string;
  kind: 'line' | 'block';
  sec?: 'identity' | 'appearance';
  at?: string;
}

export interface WorldRecord {
  /** 로어북 검색 키 (원문 key 그대로, 쉼표 구분). 비면 이름·영문명·별칭 */
  keys?: string;
  /** 괴이·파밍·조직 제목 줄에 쓰는 글 (비면 명부 영문명) */
  title?: string;
  /** 괴이: 제목이 「the Anomaly - 이름」 꼴이 아닌 원문 (세광특별시·유쾌연구소) */
  titleRaw?: boolean;
  fields: Record<string, string>;
  extra: ExtraField[];
  /** 칸 순서 (기본 칸 id 와 추가 칸 'x:이름'). 없으면 기본 순서 뒤에 추가 칸 */
  order?: string[];
  /** 플레이어 세력 코드별로 다른 칸 글 (예: 조직 소개를 B00 시점에서 다르게) */
  variants?: Record<string, Record<string, string>>;
  /** 조직: 부서 한글 → 영문 표기 (Roster 제목) */
  departments?: Record<string, string>;
  /** 조직: 명부 조직이 아닌 Faction 요약 전용 (탐미주의) */
  summaryOnly?: boolean;
  /** 조직: Faction 요약에 넣지 않음 (세력 상세 로어만. 남해지사) */
  noSummary?: boolean;
  /** 조직: Roster 에서 부서 안 묶음 꼬리표 (「A Jo (Elite Jo)」). department 가 같은 요원들 앞에 한 줄 */
  roster_notes?: { department: string; label: string }[];
  /** 요원: 🙂Roster 지침에서 뺌 (사용자 2026-10-27: 특정인 제외, 기본은 전원) */
  rosterOff?: boolean;
  /** 덧쓰기에서: 기본 기록을 지움 */
  deleted?: boolean;
}

export type RelationStage = 'hostile' | 'wary' | 'neutral' | 'favorable' | 'friendly';
export const RELATION_STAGES: RelationStage[] = ['hostile', 'wary', 'neutral', 'favorable', 'friendly'];
export const RELATION_LABEL: Record<RelationStage, string> = { hostile: '적대', wary: '경계', neutral: '중립', favorable: '호의', friendly: '우호' };

export interface RelationCell {
  stage: RelationStage;
  /** 메모. {A00} {B00} 같은 자리표는 조립 때 호칭 표의 이름으로 */
  memo?: string;
}
export interface Relations {
  /** 「보는 쪽>대상」 (조직 이름) → 칸. 중립은 적지 않는다 */
  pairs: Record<string, RelationCell>;
  /** 공통 규칙 글 (쌍 관계가 아닌 세력 전체 규칙) */
  common: string;
}

interface Pack {
  schema: number;
  kind: WorldKind;
  records: Record<string, WorldRecord>;
}

const DEFAULTS: Record<WorldKind, Record<string, WorldRecord>> = {
  agent: (agentsJson as Pack).records,
  org: (orgsJson as Pack).records,
  anomaly: (anomaliesJson as Pack).records,
  site: (sitesJson as Pack).records,
  appendix: (appendicesJson as Pack).records,
};
const DEFAULT_RELATIONS: Relations = { pairs: (relationsJson as { pairs: Record<string, RelationCell> }).pairs, common: (relationsJson as { common: string }).common };

/** 카드 명부에 저장되는 덧쓰기. 기록은 부분(fields 일부만)이어도 된다 */
export interface WorldOverrides {
  agent?: Record<string, Partial<WorldRecord>>;
  org?: Record<string, Partial<WorldRecord>>;
  anomaly?: Record<string, Partial<WorldRecord>>;
  site?: Record<string, Partial<WorldRecord>>;
  appendix?: Record<string, Partial<WorldRecord>>;
  relations?: { pairs?: Record<string, RelationCell | null>; common?: string };
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function cleanExtra(v: unknown): ExtraField[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => obj(x))
    .filter((x) => str(x.name).trim())
    .map((x) => ({
      name: str(x.name).trim(),
      value: str(x.value),
      kind: x.kind === 'line' ? ('line' as const) : ('block' as const),
      ...(x.sec === 'identity' || x.sec === 'appearance' ? { sec: x.sec, at: str(x.at) } : {}),
    }));
}

/** 기본 + 덧쓰기 → 완전한 기록. 덧쓰기의 fields 는 칸별로 덮고(빈 문자열도 덮음), extra·order·variants 는 통째로 바꾼다 */
export function mergeRecord(base: WorldRecord | undefined, over: Partial<WorldRecord> | undefined): WorldRecord | null {
  if (over?.deleted) return null;
  if (!base && !over) return null;
  const fields: Record<string, string> = { ...(base?.fields ?? {}) };
  for (const [k, v] of Object.entries(obj(over?.fields))) if (typeof v === 'string') fields[k] = v;
  const variants: Record<string, Record<string, string>> = {};
  for (const [code, vf] of Object.entries(obj(over?.variants ?? base?.variants))) {
    const m: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj(vf))) if (typeof v === 'string') m[k] = v;
    if (Object.keys(m).length) variants[code] = m;
  }
  const out: WorldRecord = {
    fields,
    extra: over?.extra !== undefined ? cleanExtra(over.extra) : (base?.extra ?? []),
  };
  const keys = over?.keys ?? base?.keys;
  if (keys) out.keys = keys;
  const title = over?.title ?? base?.title;
  if (title) out.title = title;
  if (over?.titleRaw ?? base?.titleRaw) out.titleRaw = true;
  const order = over?.order ?? base?.order;
  if (Array.isArray(order) && order.length) out.order = order.map(String);
  if (Object.keys(variants).length) out.variants = variants;
  const departments = over?.departments ?? base?.departments;
  if (departments && Object.keys(departments).length) out.departments = { ...departments };
  if (over?.summaryOnly ?? base?.summaryOnly) out.summaryOnly = true;
  if (over?.noSummary ?? base?.noSummary) out.noSummary = true;
  if (over?.rosterOff ?? base?.rosterOff) out.rosterOff = true;
  const notes = over?.roster_notes ?? base?.roster_notes;
  if (Array.isArray(notes) && notes.length) out.roster_notes = notes.map((n) => ({ department: String(n.department ?? ''), label: String(n.label ?? '') }));
  return out;
}

/** 종류별 전체 기록 (기본 순서, 카드에만 있는 것은 뒤에). 이름 → 기록 */
export function worldRecords(kind: WorldKind, overrides?: WorldOverrides): Map<string, WorldRecord> {
  const base = DEFAULTS[kind];
  const over = (overrides?.[kind] ?? {}) as Record<string, Partial<WorldRecord>>;
  const out = new Map<string, WorldRecord>();
  for (const [name, rec] of Object.entries(base)) {
    const m = mergeRecord(rec, over[name]);
    if (m) out.set(name, m);
  }
  for (const [name, rec] of Object.entries(over)) {
    if (out.has(name) || base[name]) continue;
    const m = mergeRecord(undefined, rec);
    if (m) out.set(name, m);
  }
  return out;
}

export const worldRecord = (kind: WorldKind, name: string, overrides?: WorldOverrides): WorldRecord | null => worldRecords(kind, overrides).get(name) ?? null;

export function worldRelations(overrides?: WorldOverrides): Relations {
  const pairs: Record<string, RelationCell> = { ...DEFAULT_RELATIONS.pairs };
  for (const [k, v] of Object.entries(overrides?.relations?.pairs ?? {})) {
    if (v === null) delete pairs[k];
    else if (v && RELATION_STAGES.includes(v.stage)) pairs[k] = { stage: v.stage, ...(v.memo ? { memo: v.memo } : {}) };
  }
  return { pairs, common: overrides?.relations?.common ?? DEFAULT_RELATIONS.common };
}

/** 기본 세계에 그 이름의 기록이 있는지 (카드 덧쓰기와 구분해 보여 줄 때) */
export const isDefaultRecord = (kind: WorldKind, name: string): boolean => name in DEFAULTS[kind];
/** 기본 세계의 기록 (덧쓰기 전) */
export const defaultRecord = (kind: WorldKind, name: string): WorldRecord | undefined => DEFAULTS[kind][name];

// ── 지금 보고 있는 카드의 세계 (가상 로어북을 만들 때 기록해 둔다. 인물 기록의 세력 시작값 등이 읽는다) ──
/** 기본 세력 코드 → 기본 세계의 조직 이름 (명부를 읽기 전·시험에서도 격자를 코드로 찾을 수 있게) */
export const BUILTIN_ORG_CODES: Record<string, string> = { A00: '관리국', B00: '가짜 관리국', C00: '백일몽', D00: '민간인', E00: '프리랜서' };
let active: { relations: Relations; orgCodes: Record<string, string> } = { relations: DEFAULT_RELATIONS, orgCodes: { ...BUILTIN_ORG_CODES } };
export function setActiveWorld(relations: Relations, orgCodes: Record<string, string>): void {
  active = { relations, orgCodes: { ...BUILTIN_ORG_CODES, ...orgCodes } };
}
export const activeRelations = (): Relations => active.relations;
/** 조직 코드(A00)나 이름 → 격자의 조직 이름 */
export const activeOrgName = (codeOrName: string): string => active.orgCodes[codeOrName] ?? codeOrName;

/** 단계 → 평판 시작값 (단계 경계의 가운데: 적대 -80 · 경계 -40 · 중립 0 · 호의 40 · 우호 80) */
export const STAGE_VALUE: Record<RelationStage, number> = { hostile: -80, wary: -40, neutral: 0, favorable: 40, friendly: 80 };
/** 보는 쪽 → 대상의 시작 단계 (격자). 없으면 중립 */
export function relationStage(viewer: string, target: string, rel: Relations = active.relations): RelationStage {
  return rel.pairs[`${activeOrgName(viewer)}>${activeOrgName(target)}`]?.stage ?? 'neutral';
}

/** 기록의 칸 순서: order 가 있으면 그대로(모르는 id 는 뺌, 빠진 기본 칸은 뒤에), 없으면 기본 칸 순서 + 추가 칸 */
export function fieldOrder(kind: WorldKind, rec: WorldRecord): string[] {
  const base = FIELDS[kind].map((f) => f.id);
  const extras = rec.extra.map((e) => `x:${e.name}`);
  const all = [...base, ...extras];
  if (!rec.order) return all;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of rec.order) if (all.includes(id) && !seen.has(id)) (seen.add(id), out.push(id));
  for (const id of all) if (!seen.has(id)) out.push(id);
  return out;
}

/** 조립할 때 쓸 칸 값: 플레이어 세력 코드의 변형이 있으면 그것 */
export function fieldValue(rec: WorldRecord, id: string, faction?: string): string {
  const v = faction ? rec.variants?.[faction]?.[id] : undefined;
  return (v ?? rec.fields[id] ?? '').trim();
}
