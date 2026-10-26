// 시작값: 로어북 요원 시트(영어, #### 절) → 기록 칸. 절 단위 혼합 — Identity·Character 는 기록으로 옮기고(이야기로 바뀜),
// Voice·Background·Abilities·Appearance 는 시트 원문을 그대로 본편에 둔다 (거의 안 바뀜, 사용자가 고치면 바로 반영).
import { entryId, hash, plain } from './store';
import type { Entry, Person, Register, SlotId } from './types';

/** 기록으로 옮기는 절 → 칸 */
export const SEED_SECTIONS: Record<string, SlotId> = { Identity: 'identity', Character: 'personality' };
/** 시트 원문 그대로 두는 절 */
export const FIXED_SECTIONS = ['Appearance', 'Voice', 'Background', 'Abilities'];

export interface Sheet {
  title: string;
  sections: Record<string, string>;
}

/** `### Character - Name` 머리와 `#### 절` 들로 나눈다. 절 이름은 그대로 (대소문자 유지) */
export function parseSheet(text: string): Sheet {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n');
  const out: Sheet = { title: '', sections: {} };
  let cur: string | null = null;
  for (const line of lines) {
    const h3 = /^###\s+(.+?)\s*$/.exec(line);
    const h4 = /^####\s+(.+?)\s*$/.exec(line);
    if (h3 && !h4) {
      out.title = h3[1];
      cur = null;
      continue;
    }
    if (h4) {
      cur = h4[1];
      out.sections[cur] = '';
      continue;
    }
    if (cur !== null) out.sections[cur] += (out.sections[cur] ? '\n' : '') + line;
  }
  for (const k of Object.keys(out.sections)) out.sections[k] = out.sections[k].trim();
  return out;
}

/** 절 본문의 글머리표 줄들을 항목으로 (`- `, `[Flaws]` 같은 소제목은 다음 항목 앞에 붙인다) */
export function bullets(section: string): string[] {
  const out: string[] = [];
  let label = '';
  for (const raw of section.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const tag = /^\[([^\]]+)\]$/.exec(line);
    if (tag) {
      label = tag[1];
      continue;
    }
    const b = /^[-*•]\s+(.+)$/.exec(line);
    const text = b ? b[1] : line;
    out.push(label ? `[${label}] ${text}` : text);
  }
  return out;
}

export interface SeedBase {
  faction?: string;
  express?: 0 | 1 | 2 | 3;
  minor?: boolean;
  aliases?: string[];
  /** 유저 대상 호감 시작값 (relations-base orgs 로 계산한 것) */
  affinityBase?: number;
  address?: { toUser: string; register: Register };
}

/** 새 인물 기록. sheet 가 없으면 빈 기록 (사용자가 만든 NPC) */
export function seedPerson(name: string, sheet: string | null, base: SeedBase = {}, now = new Date().toISOString()): Person {
  const p: Person = {
    name,
    faction: base.faction ?? '',
    seeded: { from: sheet ? 'lore' : base.address ? 'dialogue' : 'none', at: now, ...(sheet ? { hash: hash(sheet) } : {}) },
    slots: {},
    affinity: { base: base.affinityBase ?? 0 },
    address: base.address ?? { toUser: '', register: '존댓말' },
    express: base.express ?? 1,
    ...(base.minor ? { minor: true } : {}),
    aliases: base.aliases ?? [],
  };
  if (sheet) {
    const s = parseSheet(sheet);
    for (const [section, slot] of Object.entries(SEED_SECTIONS)) {
      const body = s.sections[section];
      if (!body) continue;
      const list: Entry[] = bullets(body).map((text, i) => ({ id: entryId(name, slot, '#0', i, text), text: plain(text, 300), src: 'seed', anchor: '#0', seq: i }));
      if (list.length) p.slots[slot] = list;
    }
  }
  return p;
}

/** 시트의 고정 절만 (본편에 원문으로 넣을 부분) */
export function fixedSections(sheet: string): { name: string; body: string }[] {
  const s = parseSheet(sheet);
  return FIXED_SECTIONS.filter((n) => s.sections[n]).map((n) => ({ name: n, body: s.sections[n] }));
}
