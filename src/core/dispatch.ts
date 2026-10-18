// 요원 이동·커스텀 임무 지시문. 원본 Lua의 agMvLoadTpl / WG.sceneDirective / M.submit / M.clean과 같은 규칙.
// 지시문 문장은 카드의 Directive 로어북에서 읽고, 채팅에는 SCENE_CARD로 감싼 유저 메시지 하나로 남긴다.
// 화면에는 카드(목표·투입)만 보이고, 모델 요청에서는 감싼 표식만 지운 본문이 간다.
import type { LoreEntry } from './types';

export class DirectiveError extends Error {}

export interface DirectiveFormat {
  destination: { name: string; located: string };
  party: {
    solo: string;
    group: string;
    support_one: string;
    support_many: string;
    separator: string;
    pair_separator: string;
    last_separator: string;
  };
  user_input: string;
}

export interface Directive {
  sections: Record<string, string>;
  format: DirectiveFormat;
}

const REQUIRED = ['COMMON', 'OPENING', 'CONTINUATION', 'CONTEXT'];

export function parseDirective(lore: LoreEntry[] | undefined): Directive {
  const raw = (lore ?? []).find((e) => e.comment === 'Directive')?.content;
  if (typeof raw !== 'string' || !raw.trim()) throw new DirectiveError('Directive 로어북을 읽지 못했어요.');
  const sections: Record<string, string> = {};
  const heads = [...raw.matchAll(/===([A-Z][A-Z0-9_]*)===/g)];
  heads.forEach((h, i) => {
    const name = h[1];
    if (name in sections) throw new DirectiveError(`Directive 섹션이 중복됐어요: ${name}`);
    const start = h.index! + h[0].length;
    const end = i + 1 < heads.length ? heads[i + 1].index! : raw.length;
    sections[name] = raw.slice(start, end).trim();
  });
  let format: DirectiveFormat;
  try {
    format = JSON.parse(sections.FORMAT ?? '') as DirectiveFormat;
  } catch {
    throw new DirectiveError('Directive의 FORMAT 섹션은 올바른 JSON이어야 해요.');
  }
  const keys: Record<string, string[]> = {
    destination: ['name', 'located'],
    party: ['solo', 'group', 'support_one', 'support_many', 'separator', 'pair_separator', 'last_separator'],
  };
  for (const [group, list] of Object.entries(keys)) {
    const obj = (format as unknown as Record<string, Record<string, unknown>>)?.[group];
    if (!obj || typeof obj !== 'object') throw new DirectiveError(`Directive FORMAT.${group}가 없어요.`);
    for (const k of list) if (typeof obj[k] !== 'string') throw new DirectiveError(`Directive FORMAT.${group}.${k}는 문자열이어야 해요.`);
  }
  if (typeof format.user_input !== 'string') throw new DirectiveError('Directive FORMAT.user_input은 문자열이어야 해요.');
  for (const name of REQUIRED) if (!sections[name]) throw new DirectiveError(`Directive의 ${name} 섹션을 확인하세요.`);
  return { sections, format };
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\[\[(\w+)\]\]/g, (_, key: string) => {
    if (!(key in values)) throw new DirectiveError(`Directive에서 쓸 수 없는 치환 항목이에요: [[${key}]]`);
    return String(values[key]);
  });
}

/** 목적지 문구. 위치를 알면 "지역 이름", 모르면 이름만 */
export function destination(d: Directive, name: string, location?: string): string {
  return fill(location?.trim() ? d.format.destination.located : d.format.destination.name, { NAME: name, LOCATION: location ?? '' });
}

function joinNames(d: Directive, list: string[]): string {
  const f = d.format.party;
  if (list.length <= 1) return list[0] ?? '';
  if (list.length === 2) return list[0] + f.pair_separator + list[1];
  return list.slice(0, -1).join(f.separator) + f.last_separator + list[list.length - 1];
}

function partyClause(d: Directive, names: string[], support: number): string {
  const f = d.format.party;
  const members = [...names];
  if (support > 0) members.push(fill(support === 1 ? f.support_one : f.support_many, { COUNT: support }));
  if (!members.length) return fill(f.solo, {});
  return fill(f.group, { MEMBERS: joinNames(d, members) });
}

/** COMMON + (OPENING|CONTINUATION) + CONTEXT */
export function sceneDirective(d: Directive, dest: string, names: string[], support: number, opening: boolean): string {
  const values = { DEST: dest, PARTY: partyClause(d, names, support) };
  return [d.sections.COMMON, d.sections[opening ? 'OPENING' : 'CONTINUATION'], d.sections.CONTEXT].map((t) => fill(t, values)).join('\n\n');
}

/** 함께 가는 인원: 요원 + 지원. 유저 포함 최대 4명 */
export const TEAM_MAX = 3;

export function validTeam(named: number, support: number): boolean {
  return Number.isInteger(support) && support >= 0 && named >= 0 && named + support <= TEAM_MAX;
}

// ── 채팅 기록 (SCENE_CARD) ──

export interface SceneSummary {
  target: string;
  party: string;
  /** 자동 전송이 막혀 아직 안 보낸 요청 (카드에 「전송을 눌러 주세요」·취소) */
  unsent?: boolean;
}

const OPEN_RE = /%%SCENE_CARD:([0-9a-f]+)%%\r?\n/;
const CARD_RE = /%%SCENE_CARD:([0-9a-f]+)%%\r?\n([\s\S]*?)\r?\n%%\/SCENE_CARD%%/g;

function toHex(s: string): string {
  return Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): string {
  const bytes = new Uint8Array((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)));
  return new TextDecoder().decode(bytes);
}

/** 원본과 같은 모양: %%SCENE_CARD:<JSON hex>%%\n본문\n%%/SCENE_CARD%% */
export function sceneRecord(summary: SceneSummary, body: string): string {
  return `%%SCENE_CARD:${toHex(JSON.stringify(summary))}%%\n${body}\n%%/SCENE_CARD%%`;
}

export function hasSceneCard(text: string): boolean {
  return typeof text === 'string' && text.includes('%%SCENE_CARD:');
}

export function readScene(text: string): SceneSummary | null {
  const m = OPEN_RE.exec(text);
  if (!m) return null;
  try {
    const s = JSON.parse(fromHex(m[1])) as SceneSummary;
    return { target: String(s.target ?? ''), party: String(s.party ?? ''), ...(s.unsent ? { unsent: true } : {}) };
  } catch {
    return null;
  }
}

/** 기록 카드의 「아직 안 보냄」 표시를 켜고 끈다 (본문은 그대로) */
export function setSceneUnsent(text: string, on: boolean): string {
  return text.replace(/%%SCENE_CARD:([0-9a-f]+)%%/g, (all, hex: string) => {
    try {
      const s = JSON.parse(fromHex(hex)) as SceneSummary;
      if (!!s.unsent === on) return all;
      const next: SceneSummary = { target: s.target, party: s.party, ...(on ? { unsent: true } : {}) };
      return `%%SCENE_CARD:${toHex(JSON.stringify(next))}%%`;
    } catch {
      return all;
    }
  });
}

export function isSceneUnsent(text: string): boolean {
  return hasSceneCard(text) && !!readScene(text)?.unsent;
}

// 기록 카드가 없는 메시지(시작 화면 직접 입력)는 끝에 표식을 붙여 「아직 안 보냄」을 적는다
export const UNSENT_MARK = '%%GOEI_UNSENT%%';
const UNSENT_RE = /\r?\n?%%GOEI_UNSENT%%/g;

/** 자동 전송이 막혀 아직 안 보낸 메시지인지 (기록 카드든 직접 입력이든) */
export function isUnsent(text: string): boolean {
  return typeof text === 'string' && (text.includes(UNSENT_MARK) || isSceneUnsent(text));
}

export function setUnsent(text: string, on: boolean): string {
  if (hasSceneCard(text)) return setSceneUnsent(text, on);
  const plain = text.replace(UNSENT_RE, '');
  return on ? `${plain}\n${UNSENT_MARK}` : plain;
}

/** 모델 요청용: 표식을 지운다 */
export function stripUnsentMark(text: string): string {
  return text.replace(UNSENT_RE, '');
}

/** 화면용: 표식 자리에 안내 줄 */
export function renderUnsentMark(text: string, html: string): string {
  return text.replace(UNSENT_RE, () => html);
}

/** 모델 요청용: 표식만 지우고 본문은 남긴다 */
export function stripSceneCard(text: string): string {
  return text.replace(/%%SCENE_CARD:[0-9a-f]+%%\r?\n/g, '').replace(/\r?\n%%\/SCENE_CARD%%/g, '');
}

/** 화면용: 기록 전체를 카드 하나로. render는 HTML 이스케이프한 목표·투입을 받는다 */
export function renderSceneCards(text: string, render: (s: SceneSummary) => string): string {
  return text.replace(CARD_RE, (all, hex: string) => {
    try {
      const s = JSON.parse(fromHex(hex)) as SceneSummary;
      return render({ target: String(s.target ?? ''), party: String(s.party ?? ''), ...(s.unsent ? { unsent: true } : {}) });
    } catch {
      return all;
    }
  });
}

/** 지시문 메시지 바로 뒤에 유저가 덧붙여 보낸 글을 "Situation:" 형식으로 합친다 */
export function withUserInput(d: Pick<Directive, 'format'> | null, body: string, extra: string): string {
  if (!extra.trim()) return body;
  const tpl = d?.format.user_input ?? 'Situation:\n[[INPUT]]';
  return `${body}\n\n${tpl.replace(/\[\[INPUT\]\]/g, extra)}`;
}
