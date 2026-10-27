// 세계 데이터 기록 → 로어 글 조립. 지금 카드 로어북 글과 같은 모양이 나와야 한다 (tools/check-world.mjs 로 원문과 대조).
// 빈 칸은 절을 찍지 않는다. 칸 제목과 다른 절 제목은 이식 때 ##### 로 글 안에 남겼으므로 그대로 나온다.
import type { AgentRow, AppendixRow, Directory, OrgRow, PlaceRow } from './directory';
import { orgOf } from './directory';
import { AGENT_FIELDS, ANOMALY_FIELDS, ANOMALY_NOTE, APPENDIX_FIELDS, ORG_FIELDS, SITE_FIELDS, type FieldDef } from './schema';
import { fieldOrder, fieldValue, type ExtraField, type WorldRecord } from './records';

const VAR = '{{getvar::st_faction}}';

/** 조직의 영문 이름을 플레이어 세력에 따라 다르게 부를 때의 CBS. 호칭 표(display)에서 코드별로 다른 이름을 모아 분기한다 */
export function orgNameCbs(dir: Directory, org: OrgRow): string {
  const base = org.spec.english || org.name;
  if (!org.faction) return base;
  const byName = new Map(dir.orgs.map((o) => [o.name, o.spec.english || o.name] as const));
  const def = dir.display.none?.[org.faction] ? byName.get(dir.display.none[org.faction]) ?? base : base;
  const branches: [string, string][] = [];
  for (const [viewer, names] of Object.entries(dir.display)) {
    if (viewer === 'none') continue;
    const n = names[org.faction];
    const en = n ? byName.get(n) ?? n : '';
    if (en && en !== def) branches.push([viewer, en]);
  }
  if (!branches.length) return def;
  const others = branches.map(([v]) => `{{#if {{not_equal::${VAR}::${v}}}}}`).join('');
  const close = '{{/if}}'.repeat(branches.length);
  return `${others}${def}${close}${branches.map(([v, en]) => `{{#if {{equal::${VAR}::${v}}}}}${en}{{/if}}`).join('')}`;
}

const lines = (rec: WorldRecord, sec: 'identity' | 'appearance', fields: FieldDef[], values: (f: FieldDef) => string): string[] => {
  const out: string[] = [];
  const extras = (at: string) => rec.extra.filter((e) => e.kind === 'line' && e.sec === sec && (e.at ?? '') === at).map((e) => `- ${e.name}: ${e.value}`);
  out.push(...extras(''));
  for (const f of fields) {
    const v = values(f);
    if (v) out.push(`- ${f.title}: ${v}`);
    out.push(...extras(f.id));
  }
  return out;
};

const blockExtras = (rec: WorldRecord): string[] => rec.extra.filter((e) => e.kind === 'block' && e.value.trim()).map((e) => `#### ${e.name}\n${e.value.trim()}`);

/** 요원 로어 글 (### Character - 영문명 → Identity → Appearance → Character → Voice → Background → Abilities → 추가 절) */
export function assembleAgent(rec: WorldRecord, a: AgentRow, dir: Directory, faction?: string): string {
  const v = (id: string) => fieldValue(rec, id, faction);
  const org = orgOf(dir.orgs, a.affiliation);
  const identity = lines(rec, 'identity', AGENT_FIELDS.filter((f) => f.sec === 'identity'), (f) => {
    if (f.id === 'organization') return v('organization') || (org ? orgNameCbs(dir, org) : '');
    return v(f.id);
  });
  const appearance = lines(rec, 'appearance', AGENT_FIELDS.filter((f) => f.sec === 'appearance'), (f) => v(f.id));
  const parts: string[] = [`### Character - ${a.english || a.name}`];
  if (identity.length) parts.push(`#### Identity\n${identity.join('\n')}`);
  if (appearance.length) parts.push(`#### Appearance\n${appearance.join('\n')}`);
  for (const f of AGENT_FIELDS.filter((f) => f.type === 'text')) {
    const t = v(f.id);
    if (t) parts.push(`#### ${f.title}\n${t}`);
  }
  parts.push(...blockExtras(rec));
  return parts.join('\n\n');
}

/** 절 모양 기록(조직·괴이·파밍): 순서(order)대로 칸·추가 절 */
function sections(rec: WorldRecord, defs: FieldDef[], faction?: string, skip: string[] = []): string[] {
  const out: string[] = [];
  const kind = defs === ORG_FIELDS ? 'org' : defs === ANOMALY_FIELDS ? 'anomaly' : 'site';
  for (const id of fieldOrder(kind, rec)) {
    if (id.startsWith('x:')) {
      const e = rec.extra.find((x: ExtraField) => x.kind === 'block' && `x:${x.name}` === id);
      if (e && e.value.trim()) out.push(`#### ${e.name}\n${e.value.trim()}`);
      continue;
    }
    if (skip.includes(id)) continue;
    const def = defs.find((f) => f.id === id);
    const t = def ? fieldValue(rec, id, faction) : '';
    if (def && t) out.push(`#### ${def.title}\n${t}`);
  }
  return out;
}

/** 괴이 로어 글: 고정 머리말 + 절들 */
export function assembleAnomaly(rec: WorldRecord, p: PlaceRow, faction?: string): string {
  const title = rec.title || `${p.english || p.label} (${p.label})`;
  const head = rec.titleRaw ? `### Instructions for the Implementation of ${title}` : `### Instructions for the Implementation of the Anomaly - ${title}`;
  return [head, ANOMALY_NOTE, ...sections(rec, ANOMALY_FIELDS, faction)].join('\n\n');
}

/** 파밍(미스틱 사이트) 로어 글 */
export function assembleSite(rec: WorldRecord, p: PlaceRow, faction?: string): string {
  const title = rec.title || p.english || p.label;
  return [`### ${title}`, ...sections(rec, SITE_FIELDS, faction)].join('\n\n');
}

/** 조직(세력 상세) 로어 글: 제목(호칭 표 CBS) + 코드 + 절들 */
export function assembleOrg(rec: WorldRecord, org: OrgRow, dir: Directory, faction?: string): string {
  const title = rec.title || `${orgNameCbs(dir, org)} (${org.name})`;
  const head = org.faction ? `### ${title}\n\n[Affiliation code: ${org.faction}]` : `### ${title}`;
  return [head, ...sections(rec, ORG_FIELDS, faction)].join('\n\n');
}

/** 부록 로어 글 */
export function assembleAppendix(rec: WorldRecord, r: AppendixRow, faction?: string): string {
  const title = fieldValue(rec, 'title', faction) || r.lore;
  const body = fieldValue(rec, 'body', faction);
  return [`### ${title}`, body, ...blockExtras(rec)].filter(Boolean).join('\n\n');
}

export const APPENDIX_DEFS = APPENDIX_FIELDS;
