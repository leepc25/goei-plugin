// Faction(세력 요약·관계·공통 규칙)과 Roster(요원 한 줄 명단) 지침 조립 (docs/설계안_세계편집.md 2장).
// 지금 카드의 📜Faction·🙂Roster 로어북과 같은 모양을 조직·요원 기록과 세력 관계 격자에서 만든다.
import type { AgentRow, Directory, OrgRow } from './directory';
import { orgOf } from './directory';
import { orgNameCbs } from './assemble';
import { fieldValue, RELATION_STAGES, type Relations, type RelationStage, type WorldRecord } from './records';

const VAR = '{{getvar::st_faction}}';
export const FACTION_INTRO = 'This reference describes the world to the GM. Public labels, hidden affiliations, doctrine, and internal information are known to an NPC only through that NPC\'s actual access.';
export const ROSTER_INTRO = '- Purpose: GM reference for consistent character introductions before individual lore is active.\n- Detail: Use active character lore for fuller characterization.';
const STAGE_EN: Record<RelationStage, string> = { hostile: 'hostile', wary: 'wary', neutral: 'neutral', favorable: 'favorable', friendly: 'friendly' };

const firstParagraph = (t: string) => t.trim().split(/\n\s*\n/)[0]?.trim() ?? '';

/** 조직의 영문 제목 (코드 조직은 호칭 표 CBS, 그 밖은 영문명) */
export function orgTitle(dir: Directory, org: OrgRow): string {
  return orgNameCbs(dir, org);
}

/** 조직 기록의 칸 글. 세력별 변형(variants)이 있으면 그 세력일 때만 다른 글이 나오게 CBS 로 묶는다 */
function variantText(rec: WorldRecord, id: string, pick: (t: string) => string = (t) => t): string {
  const base = pick(fieldValue(rec, id));
  const vs = Object.entries(rec.variants ?? {}).filter(([, f]) => typeof f[id] === 'string').map(([code, f]) => [code, pick(f[id])] as const);
  if (!vs.length) return base;
  const others = vs.map(([c]) => `{{#if {{not_equal::${VAR}::${c}}}}}`).join('');
  return `${others}${base}${'{{/if}}'.repeat(vs.length)}${vs.map(([c, t]) => `{{#if {{equal::${VAR}::${c}}}}}${t}{{/if}}`).join('')}`;
}

/** 메모·공통 규칙의 {A00} 같은 자리표를 그 코드 조직의 제목으로 */
function fillCodes(text: string, dir: Directory): string {
  return text.replace(/\{([A-Z]\d\d)\}/g, (m, code: string) => {
    const org = dir.orgs.find((o) => o.faction === code);
    return org ? orgNameCbs(dir, org) : m;
  });
}

const code = (o: OrgRow) => (o.faction ? ` [${o.faction}]` : '');

/** Faction 지침: 세력 요약(소개 첫 문단) → 관계(중립 아닌 쌍만) → 공통 규칙 */
export function assembleFaction(dir: Directory, orgs: Map<string, WorldRecord>, rel: Relations): string {
  const parts: string[] = ['## Faction', FACTION_INTRO];
  const named = (name: string): string => {
    const o = dir.orgs.find((x) => x.name === name);
    return o ? orgNameCbs(dir, o) : name;
  };
  for (const o of dir.orgs) {
    const rec = orgs.get(o.name);
    if (rec?.noSummary) continue;
    const intro = rec ? variantText(rec, 'intro', firstParagraph) : '';
    const desc = intro || (o.spec.gm_desc ?? '').trim();
    if (!desc) continue;
    const title = o.spec.gm_name && !rec ? o.spec.gm_name : orgNameCbs(dir, o);
    parts.push(`### ${title}${code(o)}\n${desc}`);
  }
  // 명부 조직이 아닌 요약 전용(탐미주의)
  for (const [name, rec] of orgs) {
    if (!rec.summaryOnly || dir.orgs.some((o) => o.name === name)) continue;
    const intro = variantText(rec, 'intro', firstParagraph);
    if (intro) parts.push(`### ${rec.title || name}\n${intro}`);
  }
  const excluded = new Set([...orgs.entries()].filter(([, r]) => r.relOff).map(([n]) => n));
  const pairs = Object.entries(rel.pairs).filter(([k, c]) => c.stage !== 'neutral' && RELATION_STAGES.includes(c.stage) && !k.split('>').some((n) => excluded.has(n)));
  if (pairs.length) {
    const lines = pairs.map(([k, c]) => {
      const [a, b] = k.split('>');
      const memo = c.memo?.trim() ? ` — ${fillCodes(c.memo.trim().replace(/\n+/g, ' '), dir)}` : '';
      return `- ${named(a)} → ${named(b)}: ${STAGE_EN[c.stage]}${memo}`;
    });
    parts.push(`## Faction Relations\nHow each faction regards another (viewer → target). Factions not listed regard each other neutrally.\n${lines.join('\n')}`);
  }
  if (rel.common.trim()) parts.push(`## Faction Doctrine and Relations\n${fillCodes(rel.common.trim(), dir)}`);
  return parts.join('\n\n') + '\n\n---';
}

/** Roster 지침: 조직 → 부서(영문 표기) → 요원 소개 한 줄. 소개가 비면 그 요원은 빠진다 */
export function assembleRoster(dir: Directory, agents: Map<string, WorldRecord>, orgs: Map<string, WorldRecord>): string {
  const parts: string[] = [`## Roster\n${ROSTER_INTRO}`];
  const byOrg = new Map<string, AgentRow[]>();
  for (const a of dir.agents) {
    const rec = agents.get(a.lore);
    if (!rec || !fieldValue(rec, 'intro') || rec.rosterOff) continue;
    const o = orgOf(dir.orgs, a.affiliation);
    const key = o?.name ?? a.affiliation ?? '';
    (byOrg.get(key) ?? byOrg.set(key, []).get(key)!).push(a);
  }
  const orgOrder = [...dir.orgs.map((o) => o.name), ...[...byOrg.keys()].filter((k) => !dir.orgs.some((o) => o.name === k))];
  for (const name of orgOrder) {
    const rows = byOrg.get(name);
    if (!rows?.length) continue;
    const o = dir.orgs.find((x) => x.name === name);
    const orec = orgs.get(name);
    const depts = orec?.departments ?? {};
    const notes = orec?.roster_notes ?? [];
    const lines: string[] = [`### ${o ? orgNameCbs(dir, o) : name}${o ? code(o) : ''}`];
    // 부서 영문 표기로 묶는다 (같은 표기면 한 묶음). 순서는 처음 나온 요원 순
    const groups = new Map<string, AgentRow[]>();
    for (const a of rows) {
      const en = a.department ? depts[a.department] ?? agents.get(a.lore)?.fields.department_en ?? a.department : '';
      (groups.get(en) ?? groups.set(en, []).get(en)!).push(a);
    }
    for (const [en, list] of groups) {
      if (en) lines.push(`\n#### ${en}`);
      let lastDept = '';
      for (const a of list) {
        if (a.department !== lastDept) {
          const note = notes.find((n) => n.department === a.department);
          if (note) lines.push(note.label);
          lastDept = a.department;
        }
        lines.push(`- ${a.english || a.name} ${fieldValue(agents.get(a.lore)!, 'intro')}`);
      }
    }
    parts.push(lines.join('\n'));
  }
  return parts.join('\n\n') + '\n\n---';
}
