// 세계 편집 창의 모델: 기록 하나를 고치면 기본 세계와 다른 부분만 덧쓰기(WorldOverrides)로 남긴다.
// 글로 가져오기(제목 동의어 → 칸, 안 맞는 절은 추가 칸), 조립 글·토큰 세기도 여기.
import type { Directory } from './directory';
import { orgOf } from './directory';
import { assembleAgent, assembleAnomaly, assembleAppendix, assembleOrg, assembleSite } from './assemble';
import { defaultRecord, fieldOrder, type ExtraField, type WorldOverrides, type WorldRecord } from './records';
import { FIELDS, type WorldKind } from './schema';
import { tokens } from '../gnet';

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** 완전한 기록 → 기본 기록과 다른 부분만. 기본과 같으면 undefined (덧쓰기를 지운다), 기본이 없으면 통째로 */
export function minimalOverride(kind: WorldKind, name: string, full: WorldRecord): Partial<WorldRecord> | undefined {
  const base = defaultRecord(kind, name);
  if (!base) return full;
  const out: Partial<WorldRecord> = {};
  const fields: Record<string, string> = {};
  for (const id of new Set([...Object.keys(base.fields), ...Object.keys(full.fields)])) {
    const a = base.fields[id] ?? '';
    const b = full.fields[id] ?? '';
    if (a !== b) fields[id] = b;
  }
  if (Object.keys(fields).length) out.fields = fields;
  if (!same(base.extra, full.extra)) out.extra = full.extra;
  if (!same(base.order, full.order)) out.order = full.order ?? [];
  if (!same(base.variants, full.variants)) out.variants = full.variants ?? {};
  if (!same(base.keys, full.keys)) out.keys = full.keys ?? '';
  if (!same(base.title, full.title)) out.title = full.title ?? '';
  if (!same(base.departments, full.departments)) out.departments = full.departments ?? {};
  if (!same(base.roster_notes, full.roster_notes)) out.roster_notes = full.roster_notes ?? [];
  if (!!base.noSummary !== !!full.noSummary) out.noSummary = !!full.noSummary;
  if (!!base.rosterOff !== !!full.rosterOff) out.rosterOff = !!full.rosterOff;
  return Object.keys(out).length ? out : undefined;
}

/** 덧쓰기에 기록을 적는다 (기본과 같으면 지움). 돌려주는 것은 새 덧쓰기 객체 */
export function putRecord(over: WorldOverrides, kind: WorldKind, name: string, full: WorldRecord): WorldOverrides {
  const next: WorldOverrides = { ...over, [kind]: { ...(over[kind] ?? {}) } };
  const m = minimalOverride(kind, name, full);
  const bucket = next[kind] as Record<string, Partial<WorldRecord>>;
  if (m) bucket[name] = m;
  else delete bucket[name];
  if (!Object.keys(bucket).length) delete next[kind];
  return next;
}

/** 기록 지우기: 기본 기록이면 deleted 표시, 카드에만 있던 것이면 덧쓰기에서 뺀다 */
export function removeRecord(over: WorldOverrides, kind: WorldKind, name: string): WorldOverrides {
  const next: WorldOverrides = { ...over, [kind]: { ...(over[kind] ?? {}) } };
  const bucket = next[kind] as Record<string, Partial<WorldRecord>>;
  if (defaultRecord(kind, name)) bucket[name] = { deleted: true };
  else delete bucket[name];
  if (!Object.keys(bucket).length) delete next[kind];
  return next;
}

/** 지운 기본 기록 되살리기 / 덧쓰기 전부 버리기 (기본으로) */
export function resetRecord(over: WorldOverrides, kind: WorldKind, name: string): WorldOverrides {
  const next: WorldOverrides = { ...over, [kind]: { ...(over[kind] ?? {}) } };
  delete (next[kind] as Record<string, unknown>)[name];
  if (!Object.keys(next[kind] as object).length) delete next[kind];
  return next;
}

export const emptyRecord = (): WorldRecord => ({ fields: {}, extra: [] });

/** 덧쓰기에 들어 있는 기록 수 (고친 것·지운 것·더한 것) */
export function overrideCount(over: WorldOverrides): number {
  let n = 0;
  for (const k of Object.keys(over) as (keyof WorldOverrides)[]) {
    if (k === 'relations') n += Object.keys(over.relations?.pairs ?? {}).length + (over.relations?.common !== undefined ? 1 : 0);
    else if (k === 'anomalyNote') n += over.anomalyNote !== undefined ? 1 : 0;
    else n += Object.keys(over[k] ?? {}).length;
  }
  return n;
}

/** 기록 → 로어 글 (조립 글 보기·토큰). 명부 줄을 못 찾으면 칸만 이어 붙인다 */
export function recordText(kind: WorldKind, name: string, rec: WorldRecord, dir: Directory, faction?: string): string {
  if (kind === 'agent') {
    const a = dir.agents.find((x) => x.lore === name);
    if (a) return assembleAgent(rec, a, dir, faction);
  } else if (kind === 'anomaly' || kind === 'site') {
    const p = (kind === 'anomaly' ? dir.anomalies : dir.sites).find((x) => x.lore === name);
    if (p) return kind === 'anomaly' ? assembleAnomaly(rec, p, faction) : assembleSite(rec, p, faction);
  } else if (kind === 'org') {
    const o = dir.orgs.find((x) => x.name === name) ?? orgOf(dir.orgs, name);
    if (o) return assembleOrg(rec, o, dir, faction);
  } else {
    const r = dir.appendices.find((x) => x.lore === name);
    if (r) return assembleAppendix(rec, r, faction);
  }
  return fieldOrder(kind, rec)
    .map((id) => (id.startsWith('x:') ? rec.extra.find((e) => `x:${e.name}` === id)?.value ?? '' : rec.fields[id] ?? ''))
    .filter(Boolean)
    .join('\n\n');
}

export const recordTokens = (kind: WorldKind, name: string, rec: WorldRecord, dir: Directory): number => tokens(recordText(kind, name, rec, dir));

// ── 글로 가져오기 ──

/** 절 제목 동의어 (소문자 포함 검사). 앞에 있는 것이 먼저 */
const SYN: Record<WorldKind, [string, string[]][]> = {
  agent: [
    ['character', ['character', 'personality', '성격', '인격']], ['voice', ['voice', 'speech', 'dialogue', 'tone', '말투', '대사', '어투']],
    ['background', ['background', 'history', 'backstory', 'past', '배경', '과거', '이력']], ['abilities', ['abilit', 'skill', 'power', '능력', '기술']],
    ['intro', ['roster', '소개', 'summary']],
  ],
  org: [
    ['doctrine', ['doctrine', 'method', 'law', 'policy', '교리', '방침', '신조']], ['hq', ['headquarter', 'hq', 'location', 'site', '본부', '거점', '위치']],
    ['structure', ['structure', 'division', 'organization', '조직 구조', '구조', '편제']], ['hierarchy', ['hierarch', 'rank', '계급', '직급']],
    ['recruitment', ['recruit', 'contact', 'orientation', '모집', '접촉', '채용']], ['assets', ['asset', 'characteristic', 'trait', 'database', 'reward', 'classification', '자산', '특성']],
    ['personnel', ['personnel', 'member', 'worker', 'participant', 'freelancer', 'people', '인원', '구성원']], ['intro', ['identity', 'overview', 'summary', '소개', '정체', '개요']],
  ],
  anomaly: [
    ['entry', ['entry', 'entrance', 'access', 'arrival', 'approach', '입장', '진입', '접근']], ['survival', ['surviv', 'escape', 'exit', 'clear', 'rescue', 'resolution', 'ending', '생존', '탈출', '클리어', '해결']],
    ['rules', ['rule', 'etiquette', 'guideline', 'law', 'penalt', 'enforcement', 'mechanic', '규칙', '규율', '벌']], ['entities', ['entit', 'resident', 'staff', 'inhabitant', 'creature', 'monster', 'guardian', 'personnel', '개체', '존재', '주민', '괴물']],
    ['space', ['structure', 'zone', 'location', 'layout', 'floor', 'room', 'area', 'district', 'space', 'map', '구조', '공간', '구역', '층', '지도']], ['notes', ['note', 'misc', 'exposure', 'record', 'file', '비고', '기록', '참고']],
    ['identity', ['identity', 'overview', 'summary', 'nature', '정체', '개요', '소개']],
  ],
  site: [
    ['access', ['access', 'contact', 'entrance', 'how to', '접근', '입장', '연락']], ['location', ['location', 'appearance', 'exterior', '위치', '외관', '모습']],
    ['environment', ['environment', 'interior', 'atmosphere', '환경', '내부', '분위기']], ['rules', ['rule', 'trade', 'service', 'transaction', 'currency', 'price', 'protocol', 'etiquette', 'inventory', 'merchandise', '규칙', '거래', '대가', '가격', '이용']],
    ['keeper', ['keeper', 'owner', 'proprietor', 'tattooist', 'counselor', 'dokkaebi', 'personnel', 'staff', '주인', '운영', '점주']], ['identity', ['identity', 'overview', 'origin', 'nature', 'summary', '정체', '개요', '소개']],
  ],
  appendix: [['body', ['body', '본문']]],
};
const LINE_SYN: Record<string, [string, string[]][]> = {
  identity: [['age', ['age', '나이', '연령']], ['gender', ['gender', 'sex', '성별']], ['organization', ['organization', 'affiliation', 'faction', '소속', '조직']], ['department_en', ['department', 'team', 'division', '부서', '소속팀']], ['role', ['role', 'position', 'job', '역할', '직책', '직무']]],
  appearance: [['physique', ['physique', 'build', 'body', '체격', '체형']], ['appearance', ['appearance', 'looks', 'face', 'hair', '외모', '외형', '얼굴']], ['outfit', ['outfit', 'clothes', 'clothing', 'attire', 'dress', '복장', '옷']]],
};

const matchSyn = (title: string, table: [string, string[]][]): string | undefined => {
  const t = title.toLowerCase();
  return table.find(([, words]) => words.some((w) => t.includes(w)))?.[0];
};

export interface ImportResult {
  fields: Record<string, string>;
  extra: ExtraField[];
  /** 배정 결과 (절 제목 → 칸 id 또는 'x:제목') */
  map: [string, string][];
}

/** 붙여 넣은 글을 칸에 배정한다. 제목 줄(#·**굵게**·「제목:」 한 줄)로 절을 나누고 동의어로 칸을 찾는다. 안 맞는 절은 그 제목 그대로 추가 칸 */
export function parseImport(kind: WorldKind, text: string): ImportResult {
  const lines = text.replace(/\r/g, '').split('\n');
  const sections: { title: string; body: string[] }[] = [{ title: '', body: [] }];
  for (const line of lines) {
    const h = /^#{1,6}\s+(.+?)\s*#*$/.exec(line) ?? /^\*\*([^*]{1,60})\*\*:?\s*$/.exec(line) ?? /^\[([^\]]{1,40})\]\s*$/.exec(line);
    if (h) sections.push({ title: h[1].trim(), body: [] });
    else sections[sections.length - 1].body.push(line);
  }
  const fields: Record<string, string> = {};
  const extra: ExtraField[] = [];
  const map: [string, string][] = [];
  const put = (id: string, body: string) => {
    fields[id] = fields[id] ? `${fields[id]}\n\n${body}` : body;
  };
  const textFields = FIELDS[kind].filter((f) => f.type === 'text').map((f) => f.id);
  const firstText = textFields[0] ?? FIELDS[kind][0].id;
  for (const sec of sections) {
    const body = sec.body.join('\n').trim();
    if (!sec.title) {
      if (body) {
        // 제목 없는 첫 글: 요원은 「- 나이: …」 꼴이면 Identity 줄로, 아니면 첫 글칸
        if (kind === 'agent' && /^- /m.test(body)) parseAgentLines(body, 'identity', fields, extra);
        else put(firstText, body);
        map.push(['(앞글)', firstText]);
      }
      continue;
    }
    if (kind === 'agent') {
      const t = sec.title.toLowerCase();
      if (/identity|정체|기본|신상/.test(t)) {
        parseAgentLines(body, 'identity', fields, extra);
        map.push([sec.title, 'identity']);
        continue;
      }
      if (/appearance|외모|외형|looks/.test(t) && /^- /m.test(body)) {
        parseAgentLines(body, 'appearance', fields, extra);
        map.push([sec.title, 'appearance']);
        continue;
      }
    }
    if (kind === 'appendix') {
      put('body', body ? `##### ${sec.title}\n${body}` : `##### ${sec.title}`);
      map.push([sec.title, 'body']);
      continue;
    }
    const id = matchSyn(sec.title, SYN[kind]);
    if (id) {
      put(id, body);
      map.push([sec.title, id]);
    } else {
      extra.push({ name: sec.title, value: body, kind: 'block' });
      map.push([sec.title, `x:${sec.title}`]);
    }
  }
  return { fields, extra, map };
}

function parseAgentLines(body: string, sec: 'identity' | 'appearance', fields: Record<string, string>, extra: ExtraField[]): void {
  let prev = '';
  for (const raw of body.split('\n')) {
    const m = /^-?\s*\*{0,2}([^:*]{1,30})\*{0,2}\s*[:：]\s*(.*)$/.exec(raw.trim());
    if (!m) {
      if (raw.trim() && prev) fields[prev] = `${fields[prev]} ${raw.trim()}`;
      continue;
    }
    const id = matchSyn(m[1], LINE_SYN[sec]);
    if (id) {
      fields[id] = m[2].trim();
      prev = id;
    } else {
      extra.push({ name: m[1].trim(), value: m[2].trim(), kind: 'line', sec, at: prev });
    }
  }
}

/** 칸 순서에서 한 칸을 위·아래로 */
export function moveField(kind: WorldKind, rec: WorldRecord, id: string, dir: -1 | 1): string[] {
  const order = fieldOrder(kind, rec);
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  [order[i], order[j]] = [order[j], order[i]];
  return order;
}

export function moveFieldTo(kind: WorldKind, rec: WorldRecord, id: string, before: string | null): string[] {
  const order = fieldOrder(kind, rec).filter((x) => x !== id);
  const at = before ? order.indexOf(before) : -1;
  if (at < 0) order.push(id);
  else order.splice(at, 0, id);
  return order;
}
